import { useEffect, useRef, useState } from "react";
import MatchIntroAnimation from "@/components/MatchIntroAnimation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Trophy, Clock, Pause, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import type { AirHockeyGameState } from "@shared/airhockeyEngine";
import type { MatchWithPlayers } from "@shared/schema";
import { VictoryAnimation, DefeatAnimation } from "@/components/VictoryAnimation";
import { GameHUD, emitFeedEvent, EventFeed } from "@/components/games/GameHUD";
import { GameLayout } from "@/components/games/GameLayout";

interface AirHockeyGameProps {
  match: MatchWithPlayers;
  currentUserId?: string;
}

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 520;
const TABLE_MARGIN = 22;
const GOAL_WIDTH = 150;
const PUCK_RADIUS = 13;
const PADDLE_RADIUS = 28;

export function AirHockeyGame({ match, currentUserId }: AirHockeyGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<AirHockeyGameState | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const animationFrameRef = useRef<number>();
  const keysRef = useRef(new Set<string>());
  
  const isPlayer1 = currentUserId === match.player1Id;
  const matchId = match.id;
  const isPractice = !!(match.isPractice || match.isBotMatch);
  const botDifficulty = (match.botDifficulty ?? "medium") as "easy" | "medium" | "hard";
  const p1Name = match.player1?.firstName || match.player1?.username || "Player 1";
  const p2Name = (match.isPractice || match.isBotMatch)
    ? (match.botDifficulty ? `Bot (${match.botDifficulty})` : "Bot")
    : (match.player2?.firstName || match.player2?.username || "Player 2");

  // ── Local (practice/bot) physics state ────────────────────────────────────
  // Mutable ref so the RAF loop never stales on setGameState closures
  const localRef = useRef<AirHockeyGameState | null>(null);
  // Bot state machine — persisted across ticks for anti-jitter + reaction delay
  const botStateRef = useRef<{
    mode: "HOME" | "TRACK" | "INTERCEPT" | "ATTACK";
    targetX: number;
    targetY: number;
    lastTargetUpdate: number;
    modeEnteredAt: number;
    reactedAt: number;     // when bot first "noticed" current puck trajectory
    lastPuckVx: number;
    lastPuckVy: number;
  }>({
    mode: "HOME", targetX: CANVAS_WIDTH - 150, targetY: CANVAS_HEIGHT / 2,
    lastTargetUpdate: 0, modeEnteredAt: 0, reactedAt: 0,
    lastPuckVx: 0, lastPuckVy: 0,
  });

  // ── Client-side prediction state
  const myPaddleYRef = useRef(CANVAS_HEIGHT / 2);
  const myPaddleXRef = useRef(isPlayer1 ? 120 : CANVAS_WIDTH - 120);
  const lastPaddleUpdateRef = useRef(0);
  const lastServerStateRef = useRef<AirHockeyGameState | null>(null);
  const interpolationAlphaRef = useRef(0);
  
  // Mouse control tracking
  const isMouseControllingRef = useRef(false);
  const mouseControlTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Goal celebration state
  const [showGoal, setShowGoal] = useState(false);
  const [goalScorer, setGoalScorer] = useState<"left" | "right" | null>(null);
  const [showVictory, setShowVictory] = useState(false);
  const [showDefeat, setShowDefeat] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const prevScoresRef = useRef<{ left: number; right: number; initialized: boolean }>({ 
    left: 0, 
    right: 0, 
    initialized: false 
  });
  const hideGoalTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Motion trail state - store recent puck positions for trail effect
  const puckTrailRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; timestamp: number }>>([]);
  
  // Audio context for sound effects
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  // Sound effect functions
  const playWallTap = (speed: number) => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // Soft tap sound - higher pitch, short duration
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
    
    // Volume scales with speed (0.05 to 0.15)
    const volume = Math.min(0.15, 0.05 + (speed / 2000) * 0.1);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.08);
  };

  const playHardSlam = (speed: number) => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    
    // Hard slam - lower frequency, longer sustain
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
    
    // Volume scales with speed (0.1 to 0.3)
    const volume = Math.min(0.3, 0.1 + (speed / 1000) * 0.2);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.2);
  };

  const playGoalSiren = () => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    
    // Goal siren - rising and falling tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.linearRampToValueAtTime(800, now + 0.3);
    osc.frequency.linearRampToValueAtTime(400, now + 0.6);
    
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.7);
  };

  const playCrowdCheer = () => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    
    // Crowd cheer - white noise with filtered envelope
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Generate white noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.Q.value = 1;
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.2);
    gain.gain.linearRampToValueAtTime(0.1, now + 1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    noise.start(now);
    noise.stop(now + 2);
  };

  const playVictorySound = () => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const now = ctx.currentTime;
    // Ascending fanfare: three rising tones
    const freqs = [523, 659, 784, 1047];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0.18, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.4);
    });
  };

  // Track previous puck position for collision detection
  const prevPuckPosRef = useRef<{ x: number; y: number } | null>(null);
  
  // Collision cooldowns to prevent rapid-fire sound effects
  const lastWallHitRef = useRef<number>(0);
  const lastPaddleHitRef = useRef<number>(0);
  const WALL_COOLDOWN_MS = 150; // 150ms between wall sounds
  const PADDLE_COOLDOWN_MS = 100; // 100ms between paddle sounds

  // ── Local physics helpers (for practice/bot mode) ──────────────────────────
  // Difficulty profile — controls reaction delay, max speed, prediction
  // horizon, aim error, dead-zone for anti-jitter, and target-refresh cadence.
  const BOT_PROFILES = {
    easy: {
      maxSpeed: 520, accel: 0.06, reactionMs: 450, predictMs: 80,
      aimErrorRad: 0.35, powerScale: 0.65, deadZonePx: 14, refreshMs: 220,
      mistakeChance: 0.18,
    },
    medium: {
      maxSpeed: 780, accel: 0.10, reactionMs: 220, predictMs: 160,
      aimErrorRad: 0.18, powerScale: 0.85, deadZonePx: 8,  refreshMs: 130,
      mistakeChance: 0.08,
    },
    hard: {
      maxSpeed: 1050, accel: 0.16, reactionMs: 90, predictMs: 240,
      aimErrorRad: 0.07, powerScale: 1.0,  deadZonePx: 4,  refreshMs: 70,
      mistakeChance: 0.03,
    },
  } as const;
  const WALL_REST = 0.94;
  const COLL_REST = 1.05;
  const PUCK_FRIC = 0.997;
  const PUCK_MASS = 1;
  const PADDLE_MASS = 3;
  const MAX_SPEED = 1100;
  const FIXED_DT  = 1 / 60;

  function createLocalState(): AirHockeyGameState {
    const now = Date.now();
    return {
      puck: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, vx: 3.5, vy: 1.5 },
      leftPaddle:  { x: 120,               y: CANVAS_HEIGHT / 2, vx: 0, vy: 0 },
      rightPaddle: { x: CANVAS_WIDTH - 120, y: CANVAS_HEIGHT / 2, vx: 0, vy: 0 },
      leftScore: 0, rightScore: 0,
      status: "playing", lastUpdate: now, targetScore: 7,
      currentServer: "left",
      lastLeftPaddleUpdate: 0, lastRightPaddleUpdate: 0,
      leftStats:  { goals:0,shots:0,saves:0,hitSpeedPeak:0,possessionSeconds:0,lastPossessionSide:null,possessionStartTime:now },
      rightStats: { goals:0,shots:0,saves:0,hitSpeedPeak:0,possessionSeconds:0,lastPossessionSide:null,possessionStartTime:now },
    };
  }

  function localPhysicsStep(s: AirHockeyGameState, dt: number): { state: AirHockeyGameState; scored: "left"|"right"|null } {
    const p = { ...s.puck };
    const lp = { ...s.leftPaddle };
    const rp = { ...s.rightPaddle };

    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= PUCK_FRIC; p.vy *= PUCK_FRIC;

    // Clamp puck speed
    const spd = Math.hypot(p.vx, p.vy);
    if (spd > MAX_SPEED) { p.vx = p.vx/spd*MAX_SPEED; p.vy = p.vy/spd*MAX_SPEED; }

    // Goal check
    const m = TABLE_MARGIN;
    const gTop = CANVAS_HEIGHT/2 - GOAL_WIDTH/2;
    const gBot = CANVAS_HEIGHT/2 + GOAL_WIDTH/2;
    let scored: "left"|"right"|null = null;

    if (p.x - PUCK_RADIUS <= m) {
      if (p.y > gTop && p.y < gBot) { scored = "right"; }
      else { p.x = m + PUCK_RADIUS; p.vx *= -WALL_REST; }
    }
    if (p.x + PUCK_RADIUS >= CANVAS_WIDTH - m) {
      if (p.y > gTop && p.y < gBot) { scored = "left"; }
      else { p.x = CANVAS_WIDTH - m - PUCK_RADIUS; p.vx *= -WALL_REST; }
    }
    if (p.y - PUCK_RADIUS <= m) { p.y = m + PUCK_RADIUS; p.vy *= -WALL_REST; }
    if (p.y + PUCK_RADIUS >= CANVAS_HEIGHT - m) { p.y = CANVAS_HEIGHT - m - PUCK_RADIUS; p.vy *= -WALL_REST; }

    // Paddle collisions
    for (const pad of [lp, rp]) {
      const dx = p.x - pad.x, dy = p.y - pad.y;
      const dist = Math.hypot(dx, dy);
      const minD = PUCK_RADIUS + PADDLE_RADIUS;
      if (dist < minD && dist > 0) {
        const nx = dx/dist, ny = dy/dist;
        p.x += nx*(minD - dist); p.y += ny*(minD - dist);
        const rvx = p.vx - pad.vx, rvy = p.vy - pad.vy;
        const relN = rvx*nx + rvy*ny;
        if (relN < 0) {
          const j = -(1 + COLL_REST) * relN / (1/PUCK_MASS + 1/PADDLE_MASS);
          p.vx += j*nx/PUCK_MASS; p.vy += j*ny/PUCK_MASS;
          const ps = Math.hypot(pad.vx, pad.vy);
          if (ps > 30) { const b = Math.min(ps*0.35,280); p.vx += pad.vx/ps*b; p.vy += pad.vy/ps*b; }
        }
        const finalSpd = Math.hypot(p.vx, p.vy);
        if (finalSpd > MAX_SPEED) { p.vx = p.vx/finalSpd*MAX_SPEED; p.vy = p.vy/finalSpd*MAX_SPEED; }
      }
    }

    // Decay paddle velocities
    lp.vx *= 0.85; lp.vy *= 0.85;
    rp.vx *= 0.85; rp.vy *= 0.85;

    const newState: AirHockeyGameState = { ...s, puck: p, leftPaddle: lp, rightPaddle: rp };
    return { state: newState, scored };
  }

  function resetPuck(s: AirHockeyGameState, dir: number): AirHockeyGameState {
    const angle = (Math.random() * Math.PI / 3) - (Math.PI / 6);
    const speed = 420 + Math.random() * 120;
    return {
      ...s,
      puck: {
        x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2,
        vx: dir * speed * Math.cos(angle),
        vy: speed * Math.sin(angle),
      },
    };
  }

  // ── Practice mode: init + RAF game loop ────────────────────────────────────
  useEffect(() => {
    if (!isPractice) return;
    const init = createLocalState();
    localRef.current = init;
    setGameState(init);
    prevScoresRef.current = { left: 0, right: 0, initialized: true };

    const profile = BOT_PROFILES[botDifficulty];
    let lastTs = 0;
    let raf: number;

    const tick = (ts: number) => {
      if (!lastTs) lastTs = ts;
      let dt = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;

      let s = localRef.current!;
      // Clamp to fixed time steps
      let acc = dt;
      while (acc >= FIXED_DT) {
        // ── Bot AI — state machine with prediction + anti-jitter ─────────
        const now = performance.now();
        const bot = botStateRef.current;
        const puck = s.puck;
        const botPad = s.rightPaddle;

        // Reaction delay: if puck velocity changed significantly, wait reactionMs
        // before updating bot's mental model of where the puck is headed.
        const dvx = puck.vx - bot.lastPuckVx;
        const dvy = puck.vy - bot.lastPuckVy;
        if (Math.hypot(dvx, dvy) > 120) {
          bot.reactedAt = now + profile.reactionMs;
        }
        const hasReacted = now >= bot.reactedAt;

        // Predict puck position predictMs into the future (single wall bounce)
        const horizon = (hasReacted ? profile.predictMs : 0) / 1000;
        let predX = puck.x + puck.vx * horizon * PUCK_FRIC;
        let predY = puck.y + puck.vy * horizon * PUCK_FRIC;
        // Reflect off top/bottom walls
        const yMin = TABLE_MARGIN + PUCK_RADIUS;
        const yMax = CANVAS_HEIGHT - TABLE_MARGIN - PUCK_RADIUS;
        if (predY < yMin) predY = yMin + (yMin - predY);
        if (predY > yMax) predY = yMax - (predY - yMax);
        predY = Math.max(yMin, Math.min(yMax, predY));

        // Decide mode
        const puckOnBotSide   = puck.x > CANVAS_WIDTH / 2;
        const puckApproaching = puck.vx > 30;
        const puckSlow        = Math.hypot(puck.vx, puck.vy) < 200;
        const minModeDuration = 120; // ms — prevents mode flicker
        const canSwitch = now - bot.modeEnteredAt > minModeDuration;

        let newMode = bot.mode;
        if (canSwitch && hasReacted) {
          if (puckOnBotSide && puckSlow) {
            newMode = "ATTACK";
          } else if (puckApproaching) {
            newMode = "INTERCEPT";
          } else if (puckOnBotSide) {
            newMode = "TRACK";
          } else {
            newMode = "HOME";
          }
        }
        if (newMode !== bot.mode) {
          bot.mode = newMode;
          bot.modeEnteredAt = now;
        }

        // Compute target based on mode (refresh-throttled)
        const needRefresh = now - bot.lastTargetUpdate > profile.refreshMs;
        if (needRefresh && hasReacted) {
          // Aim error scales with profile
          const errY = (Math.random() - 0.5) * profile.aimErrorRad * 120;
          // Occasional mistake — bot picks wrong y
          const blunder = Math.random() < profile.mistakeChance
            ? (Math.random() - 0.5) * 180
            : 0;

          if (bot.mode === "HOME") {
            bot.targetX = CANVAS_WIDTH - 140;
            bot.targetY = CANVAS_HEIGHT / 2 + errY * 0.3;
          } else if (bot.mode === "TRACK") {
            bot.targetX = CANVAS_WIDTH - 160;
            bot.targetY = predY + errY + blunder;
          } else if (bot.mode === "INTERCEPT") {
            // Move forward to meet the puck — front of bot's half
            bot.targetX = Math.max(CANVAS_WIDTH / 2 + PADDLE_RADIUS + 20,
              Math.min(CANVAS_WIDTH - 100, predX - PUCK_RADIUS));
            bot.targetY = predY + errY + blunder;
          } else { // ATTACK
            // Position behind puck so paddle hits toward player goal corners
            const goalCornerY = puck.y < CANVAS_HEIGHT / 2
              ? CANVAS_HEIGHT / 2 + GOAL_WIDTH / 4   // aim away from puck's side
              : CANVAS_HEIGHT / 2 - GOAL_WIDTH / 4;
            const aimVecX = TABLE_MARGIN - puck.x; // toward left goal
            const aimVecY = goalCornerY - puck.y;
            const aimLen  = Math.hypot(aimVecX, aimVecY) || 1;
            bot.targetX = puck.x - (aimVecX / aimLen) * (PUCK_RADIUS + PADDLE_RADIUS);
            bot.targetY = puck.y - (aimVecY / aimLen) * (PUCK_RADIUS + PADDLE_RADIUS) + errY * 0.3;
          }
          bot.lastTargetUpdate = now;
        }

        bot.lastPuckVx = puck.vx;
        bot.lastPuckVy = puck.vy;

        // Clamp target to bot half playable area
        bot.targetX = Math.max(CANVAS_WIDTH / 2 + PADDLE_RADIUS,
          Math.min(CANVAS_WIDTH - TABLE_MARGIN - PADDLE_RADIUS, bot.targetX));
        bot.targetY = Math.max(TABLE_MARGIN + PADDLE_RADIUS,
          Math.min(CANVAS_HEIGHT - TABLE_MARGIN - PADDLE_RADIUS, bot.targetY));

        // Anti-jitter dead zone: if already very close, hold position
        const dxBot = bot.targetX - botPad.x;
        const dyBot = bot.targetY - botPad.y;
        const distBot = Math.hypot(dxBot, dyBot);

        let vxBot: number, vyBot: number;
        if (distBot < profile.deadZonePx) {
          vxBot = botPad.vx * 0.5;
          vyBot = botPad.vy * 0.5;
        } else {
          // Smooth accel toward target — clamp to maxSpeed
          const desiredSpeed = Math.min(profile.maxSpeed, distBot / FIXED_DT);
          const ux = dxBot / distBot, uy = dyBot / distBot;
          const targetVx = ux * desiredSpeed;
          const targetVy = uy * desiredSpeed;
          vxBot = botPad.vx + (targetVx - botPad.vx) * profile.accel * 60 * FIXED_DT;
          vyBot = botPad.vy + (targetVy - botPad.vy) * profile.accel * 60 * FIXED_DT;
          // Clamp
          const vSpd = Math.hypot(vxBot, vyBot);
          if (vSpd > profile.maxSpeed) {
            vxBot = vxBot / vSpd * profile.maxSpeed;
            vyBot = vyBot / vSpd * profile.maxSpeed;
          }
          // Power scale for difficulty
          vxBot *= profile.powerScale;
          vyBot *= profile.powerScale;
        }

        const newRp = {
          ...botPad,
          vx: vxBot, vy: vyBot,
          x: Math.max(CANVAS_WIDTH/2 + PADDLE_RADIUS,
              Math.min(CANVAS_WIDTH - TABLE_MARGIN - PADDLE_RADIUS, botPad.x + vxBot * FIXED_DT)),
          y: Math.max(TABLE_MARGIN + PADDLE_RADIUS,
              Math.min(CANVAS_HEIGHT - TABLE_MARGIN - PADDLE_RADIUS, botPad.y + vyBot * FIXED_DT)),
        };

        // Player paddle tracks mouse/touch refs
        const plx = Math.max(TABLE_MARGIN + PADDLE_RADIUS, Math.min(CANVAS_WIDTH/2 - PADDLE_RADIUS, myPaddleXRef.current));
        const ply = Math.max(TABLE_MARGIN + PADDLE_RADIUS, Math.min(CANVAS_HEIGHT - TABLE_MARGIN - PADDLE_RADIUS, myPaddleYRef.current));
        const prevLp = s.leftPaddle;
        const newLp = {
          ...prevLp,
          x: plx, y: ply,
          vx: (plx - prevLp.x) / FIXED_DT,
          vy: (ply - prevLp.y) / FIXED_DT,
        };

        const stepped = localPhysicsStep({ ...s, leftPaddle: newLp, rightPaddle: newRp }, FIXED_DT);
        s = stepped.state;

        if (stepped.scored) {
          const sc = stepped.scored;
          const prev = prevScoresRef.current;
          const leftScore  = s.leftScore  + (sc === "left"  ? 1 : 0);
          const rightScore = s.rightScore + (sc === "right" ? 1 : 0);
          s = { ...s, leftScore, rightScore };

          // Goal celebration
          if (sc === "left" && leftScore > prev.left) {
            setGoalScorer("left"); setShowGoal(true);
            playGoalSiren(); setTimeout(() => playCrowdCheer(), 200);
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6, x: 0.3 }, colors: ["#22d3ee","#06b6d4","#0891b2"] });
            setTimeout(() => setShowGoal(false), 1800);
            emitFeedEvent({ kind: "goal", label: "GOAL!", sub: `${leftScore}–${rightScore}` });
          }
          if (sc === "right" && rightScore > prev.right) {
            setGoalScorer("right"); setShowGoal(true);
            playGoalSiren(); setTimeout(() => playCrowdCheer(), 200);
            confetti({ particleCount: 80, spread: 60, origin: { y: 0.6, x: 0.7 }, colors: ["#a78bfa","#8b5cf6","#7c3aed"] });
            setTimeout(() => setShowGoal(false), 1800);
            emitFeedEvent({ kind: "generic", label: "Opponent scores", sub: `${leftScore}–${rightScore}` });
          }
          prevScoresRef.current = { left: leftScore, right: rightScore, initialized: true };

          // Game over?
          if (leftScore >= s.targetScore || rightScore >= s.targetScore) {
            s = { ...s, status: "finished" };
            localRef.current = s;
            setGameState({ ...s });
            // Player is always left paddle in practice mode
            const playerWon = leftScore >= s.targetScore;
            if (playerWon) {
              setShowVictory(true);
              playVictorySound();
            } else {
              setShowDefeat(true);
            }
            return;
          }
          // Reset puck
          s = resetPuck(s, sc === "left" ? 1 : -1);
        }

        acc -= FIXED_DT;
      }

      localRef.current = s;
      setGameState({ ...s });
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPractice, botDifficulty]);

  // ── Initialize WebSocket connection (PvP only) ──────────────────────────────
  // Initialize WebSocket connection
  useEffect(() => {
    if (isPractice) return;  // Skip WS in practice mode
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "join", matchId, userId: currentUserId }));
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, [matchId, currentUserId]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyP") {
        setIsPaused(prev => !prev);
        return;
      }
      keysRef.current.add(e.code);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Client-side paddle movement with throttled network updates (20fps instead of 60fps)
  useEffect(() => {
    if (!gameState || isPaused) return;

    let lastFrameTime = Date.now();
    const THROTTLE_MS = 50; // Send updates every 50ms (20 updates/sec)

    const updatePaddle = () => {
      const now = Date.now();
      const deltaTime = (now - lastFrameTime) / 1000; // seconds
      lastFrameTime = now;

      // Skip keyboard control if mouse is currently controlling
      if (isMouseControllingRef.current) {
        frameId = requestAnimationFrame(updatePaddle);
        return;
      }

      const keys = keysRef.current;
      let dx = 0, dy = 0;
      const speed = 560; // pixels per second

      if (isPlayer1) {
        // Left paddle: W/S for vertical, A/D for horizontal
        if (keys.has("KeyW")) dy -= speed * deltaTime;
        if (keys.has("KeyS")) dy += speed * deltaTime;
        if (keys.has("KeyA")) dx -= speed * deltaTime;
        if (keys.has("KeyD")) dx += speed * deltaTime;
      } else {
        // Right paddle: Arrow Up/Down for vertical, Left/Right for horizontal
        if (keys.has("ArrowUp")) dy -= speed * deltaTime;
        if (keys.has("ArrowDown")) dy += speed * deltaTime;
        if (keys.has("ArrowLeft")) dx -= speed * deltaTime;
        if (keys.has("ArrowRight")) dx += speed * deltaTime;
      }

      if (dx !== 0 || dy !== 0) {
        // Y-axis bounds
        const minY = TABLE_MARGIN + PADDLE_RADIUS;
        const maxY = CANVAS_HEIGHT - TABLE_MARGIN - PADDLE_RADIUS;
        const newY = Math.max(minY, Math.min(maxY, myPaddleYRef.current + dy));
        myPaddleYRef.current = newY;

        // X-axis bounds with half-line enforcement
        const centerX = CANVAS_WIDTH / 2;
        const minX = TABLE_MARGIN + PADDLE_RADIUS;
        const maxX = CANVAS_WIDTH - TABLE_MARGIN - PADDLE_RADIUS;
        
        let newX;
        if (isPlayer1) {
          // Left paddle can't cross center line
          const leftMaxX = centerX - PADDLE_RADIUS;
          newX = Math.max(minX, Math.min(leftMaxX, myPaddleXRef.current + dx));
        } else {
          // Right paddle can't cross center line
          const rightMinX = centerX + PADDLE_RADIUS;
          newX = Math.max(rightMinX, Math.min(maxX, myPaddleXRef.current + dx));
        }
        myPaddleXRef.current = newX;

        // Throttled network update - only send every 50ms
        if (ws && ws.readyState === WebSocket.OPEN && now - lastPaddleUpdateRef.current >= THROTTLE_MS) {
          lastPaddleUpdateRef.current = now;
          ws.send(JSON.stringify({
            type: "air-hockey-paddle",
            matchId,
            paddleX: newX,
            paddleY: newY,
            timestamp: now, // High-resolution timestamp for lag compensation
          }));
        }
      }

      frameId = requestAnimationFrame(updatePaddle);
    };

    let frameId = requestAnimationFrame(updatePaddle);
    return () => cancelAnimationFrame(frameId);
  }, [gameState, isPaused, isPlayer1, ws, matchId]);

  // Mouse controls - paddle follows mouse cursor directly
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const THROTTLE_MS = 50;
    let lastMouseUpdate = 0;
    let isMouseOverCanvas = false;

    const canvasPos = (evt: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((evt.clientX - rect.left) * CANVAS_WIDTH) / rect.width,
        y: ((evt.clientY - rect.top) * CANVAS_HEIGHT) / rect.height,
      };
    };

    const sendPaddleUpdate = (x: number, y: number) => {
      const now = Date.now();
      if (ws && ws.readyState === WebSocket.OPEN && now - lastMouseUpdate >= THROTTLE_MS) {
        lastMouseUpdate = now;
        ws.send(JSON.stringify({
          type: "air-hockey-paddle",
          matchId,
          paddleX: x,
          paddleY: y,
          timestamp: now,
        }));
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseOverCanvas) return;
      
      const pos = canvasPos(e);
      const isMyHalf = isPlayer1 ? pos.x < CANVAS_WIDTH / 2 : pos.x >= CANVAS_WIDTH / 2;
      
      // Only control paddle when mouse is on your half of the table
      if (!isMyHalf) return;
      
      // Activate mouse control and reset timeout
      isMouseControllingRef.current = true;
      if (mouseControlTimeoutRef.current) {
        clearTimeout(mouseControlTimeoutRef.current);
      }
      // Disable mouse control after 100ms of no mouse movement
      mouseControlTimeoutRef.current = setTimeout(() => {
        isMouseControllingRef.current = false;
      }, 100);
      
      // Y-axis bounds
      const y = Math.max(
        TABLE_MARGIN + PADDLE_RADIUS,
        Math.min(CANVAS_HEIGHT - TABLE_MARGIN - PADDLE_RADIUS, pos.y)
      );
      
      // X-axis bounds with half-line enforcement
      const centerX = CANVAS_WIDTH / 2;
      const minX = TABLE_MARGIN + PADDLE_RADIUS;
      const maxX = CANVAS_WIDTH - TABLE_MARGIN - PADDLE_RADIUS;
      
      let x;
      if (isPlayer1) {
        const leftMaxX = centerX - PADDLE_RADIUS;
        x = Math.max(minX, Math.min(leftMaxX, pos.x));
      } else {
        const rightMinX = centerX + PADDLE_RADIUS;
        x = Math.max(rightMinX, Math.min(maxX, pos.x));
      }
      
      myPaddleXRef.current = x;
      myPaddleYRef.current = y;
      sendPaddleUpdate(x, y);
    };

    const handleMouseEnter = () => {
      isMouseOverCanvas = true;
    };

    const handleMouseLeave = () => {
      isMouseOverCanvas = false;
      isMouseControllingRef.current = false;
      if (mouseControlTimeoutRef.current) {
        clearTimeout(mouseControlTimeoutRef.current);
        mouseControlTimeoutRef.current = null;
      }
    };

    canvas.addEventListener("mouseenter", handleMouseEnter);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("mousemove", handleMouseMove);

    return () => {
      canvas.removeEventListener("mouseenter", handleMouseEnter);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("mousemove", handleMouseMove);
      if (mouseControlTimeoutRef.current) {
        clearTimeout(mouseControlTimeoutRef.current);
      }
    };
  }, [isPlayer1, ws, matchId]);

  // Touch controls for mobile with throttled updates
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const THROTTLE_MS = 50;
    let lastTouchUpdate = 0;

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const now = Date.now();
      
      for (const touch of Array.from(e.touches)) {
        const touchX = ((touch.clientX - rect.left) * CANVAS_WIDTH) / rect.width;
        const touchY = ((touch.clientY - rect.top) * CANVAS_HEIGHT) / rect.height;
        const isMyHalf = isPlayer1 ? touchX < CANVAS_WIDTH / 2 : touchX >= CANVAS_WIDTH / 2;
        
        if (isMyHalf) {
          // Y-axis bounds
          const y = Math.max(
            TABLE_MARGIN + PADDLE_RADIUS,
            Math.min(CANVAS_HEIGHT - TABLE_MARGIN - PADDLE_RADIUS, touchY)
          );
          
          // X-axis bounds with half-line enforcement
          const centerX = CANVAS_WIDTH / 2;
          const minX = TABLE_MARGIN + PADDLE_RADIUS;
          const maxX = CANVAS_WIDTH - TABLE_MARGIN - PADDLE_RADIUS;
          
          let x;
          if (isPlayer1) {
            const leftMaxX = centerX - PADDLE_RADIUS;
            x = Math.max(minX, Math.min(leftMaxX, touchX));
          } else {
            const rightMinX = centerX + PADDLE_RADIUS;
            x = Math.max(rightMinX, Math.min(maxX, touchX));
          }
          
          myPaddleXRef.current = x;
          myPaddleYRef.current = y;
          
          if (ws && ws.readyState === WebSocket.OPEN && now - lastTouchUpdate >= THROTTLE_MS) {
            lastTouchUpdate = now;
            ws.send(JSON.stringify({
              type: "air-hockey-paddle",
              matchId,
              paddleX: x,
              paddleY: y,
              timestamp: now, // High-resolution timestamp for lag compensation
            }));
          }
        }
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      // Initialize paddle position on first touch without throttling
      const rect = canvas.getBoundingClientRect();
      for (const touch of Array.from(e.touches)) {
        const touchX = ((touch.clientX - rect.left) * CANVAS_WIDTH) / rect.width;
        const touchY = ((touch.clientY - rect.top) * CANVAS_HEIGHT) / rect.height;
        const isMyHalf = isPlayer1 ? touchX < CANVAS_WIDTH / 2 : touchX >= CANVAS_WIDTH / 2;
        if (isMyHalf) {
          const y = Math.max(TABLE_MARGIN + PADDLE_RADIUS, Math.min(CANVAS_HEIGHT - TABLE_MARGIN - PADDLE_RADIUS, touchY));
          const centerX = CANVAS_WIDTH / 2;
          let x: number;
          if (isPlayer1) x = Math.max(TABLE_MARGIN + PADDLE_RADIUS, Math.min(centerX - PADDLE_RADIUS, touchX));
          else x = Math.max(centerX + PADDLE_RADIUS, Math.min(CANVAS_WIDTH - TABLE_MARGIN - PADDLE_RADIUS, touchX));
          myPaddleXRef.current = x;
          myPaddleYRef.current = y;
        }
      }
    };

    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
    };
  }, [isPlayer1, ws, matchId]);

  // Listen for game state updates from WebSocket with interpolation setup
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "air-hockey-state" && data.matchId === matchId) {
          // Store previous state for interpolation
          if (gameState) {
            lastServerStateRef.current = gameState;
          }
          
          setGameState(data.state);
          interpolationAlphaRef.current = 0; // Reset interpolation
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    ws.addEventListener("message", handleMessage);

    return () => {
      ws.removeEventListener("message", handleMessage);
    };
  }, [ws, matchId, gameState]);

  // Detect match end (PvP) and trigger victory/defeat overlay
  useEffect(() => {
    if (!gameState || isPractice) return;
    if (gameState.status === "finished") {
      const playerWon = isPlayer1
        ? gameState.leftScore > gameState.rightScore
        : gameState.rightScore > gameState.leftScore;
      if (playerWon) {
        setShowVictory(true);
        playVictorySound();
      } else {
        setShowDefeat(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.status]);

  // Detect goal scored and trigger celebration
  useEffect(() => {
    if (!gameState) return;

    const currentLeft = gameState.leftScore;
    const currentRight = gameState.rightScore;
    const prevLeft = prevScoresRef.current.left;
    const prevRight = prevScoresRef.current.right;
    const isInitialized = prevScoresRef.current.initialized;

    // If not initialized yet, just store the current scores and mark as initialized
    if (!isInitialized) {
      prevScoresRef.current = { left: currentLeft, right: currentRight, initialized: true };
      return;
    }

    // Check if left player scored
    if (currentLeft > prevLeft) {
      // Clear any existing timeout before setting new one
      if (hideGoalTimeoutRef.current) {
        clearTimeout(hideGoalTimeoutRef.current);
      }

      setGoalScorer("left");
      setShowGoal(true);
      
      // Play goal sounds
      playGoalSiren();
      setTimeout(() => playCrowdCheer(), 200);
      
      // Trigger confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6, x: 0.3 },
        colors: ['#22d3ee', '#06b6d4', '#0891b2'],
      });

      // Hide after 2 seconds
      hideGoalTimeoutRef.current = setTimeout(() => {
        setShowGoal(false);
        hideGoalTimeoutRef.current = null;
      }, 2000);
    }

    // Check if right player scored
    if (currentRight > prevRight) {
      // Clear any existing timeout before setting new one
      if (hideGoalTimeoutRef.current) {
        clearTimeout(hideGoalTimeoutRef.current);
      }

      setGoalScorer("right");
      setShowGoal(true);
      
      // Play goal sounds
      playGoalSiren();
      setTimeout(() => playCrowdCheer(), 200);
      
      // Trigger confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6, x: 0.7 },
        colors: ['#a78bfa', '#8b5cf6', '#7c3aed'],
      });

      // Hide after 2 seconds
      hideGoalTimeoutRef.current = setTimeout(() => {
        setShowGoal(false);
        hideGoalTimeoutRef.current = null;
      }, 2000);
    }

    // Update previous scores
    prevScoresRef.current = { left: currentLeft, right: currentRight, initialized: true };
  }, [gameState]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideGoalTimeoutRef.current) {
        clearTimeout(hideGoalTimeoutRef.current);
        hideGoalTimeoutRef.current = null;
      }
    };
  }, []);

  // Pre-render static table to offscreen canvas (avoids expensive shadowBlur per frame)
  const tableCanvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const offscreen = document.createElement("canvas");
    offscreen.width = CANVAS_WIDTH;
    offscreen.height = CANVAS_HEIGHT;
    const offCtx = offscreen.getContext("2d");
    if (offCtx) {
      drawTable(offCtx);
    }
    tableCanvasRef.current = offscreen;
  }, []);

  // Optimized rendering loop with client-side prediction and interpolation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const SERVER_UPDATE_RATE = 1000 / 30;
    let lastRenderTime = performance.now();

    const render = (currentTime: number) => {
      const deltaTime = currentTime - lastRenderTime;
      lastRenderTime = currentTime;

      interpolationAlphaRef.current = Math.min(1, interpolationAlphaRef.current + deltaTime / SERVER_UPDATE_RATE);

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      if (tableCanvasRef.current) {
        ctx.drawImage(tableCanvasRef.current, 0, 0);
      }

      drawScores(ctx, gameState);

      // Draw paddles with client-side prediction for local player (predict both x and y)
      const leftPaddle = isPlayer1 
        ? { ...gameState.leftPaddle, x: myPaddleXRef.current, y: myPaddleYRef.current } 
        : gameState.leftPaddle;
      const rightPaddle = !isPlayer1 
        ? { ...gameState.rightPaddle, x: myPaddleXRef.current, y: myPaddleYRef.current } 
        : gameState.rightPaddle;

      // Draw dynamic lighting under paddles
      drawPaddleLight(ctx, leftPaddle, "#22d3ee");
      drawPaddleLight(ctx, rightPaddle, "#a78bfa");

      // Draw paddles
      drawPaddle(ctx, leftPaddle, "#22d3ee");
      drawPaddle(ctx, rightPaddle, "#a78bfa");

      // Draw puck with interpolation for smooth movement
      const interpolatedPuck = interpolatePuck(gameState.puck);
      
      // Update motion trail
      const now = performance.now();
      const speed = Math.hypot(interpolatedPuck.vx, interpolatedPuck.vy);
      puckTrailRef.current.push({
        x: interpolatedPuck.x,
        y: interpolatedPuck.y,
        vx: interpolatedPuck.vx,
        vy: interpolatedPuck.vy,
        timestamp: now,
      });
      
      // Keep only recent trail positions (last 200ms)
      puckTrailRef.current = puckTrailRef.current.filter(p => now - p.timestamp < 200);
      
      // Detect collisions for sound effects
      detectCollisions(interpolatedPuck, speed, leftPaddle, rightPaddle);
      
      // Draw dynamic lighting under puck
      drawPuckLight(ctx, interpolatedPuck, speed);
      
      // Draw motion trail
      drawMotionTrail(ctx, interpolatedPuck, speed);
      
      // Draw puck
      drawPuck(ctx, interpolatedPuck);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState, isPlayer1]);

  // Interpolate puck position for smoother movement
  const interpolatePuck = (currentPuck: AirHockeyGameState['puck']) => {
    if (!lastServerStateRef.current || interpolationAlphaRef.current >= 1) {
      return currentPuck;
    }

    const prevPuck = lastServerStateRef.current.puck;
    const alpha = interpolationAlphaRef.current;

    return {
      x: prevPuck.x + (currentPuck.x - prevPuck.x) * alpha,
      y: prevPuck.y + (currentPuck.y - prevPuck.y) * alpha,
      vx: currentPuck.vx,
      vy: currentPuck.vy,
    };
  };

  // Collision detection for sound effects with cooldown to prevent rapid-fire
  const detectCollisions = (
    puck: { x: number; y: number; vx: number; vy: number },
    speed: number,
    leftPaddle: { x: number; y: number },
    rightPaddle: { x: number; y: number }
  ) => {
    const now = performance.now();
    const m = TABLE_MARGIN;
    
    // Check wall collisions with cooldown
    const hitLeftWall = puck.x - PUCK_RADIUS <= m;
    const hitRightWall = puck.x + PUCK_RADIUS >= CANVAS_WIDTH - m;
    const hitTopWall = puck.y - PUCK_RADIUS <= m;
    const hitBottomWall = puck.y + PUCK_RADIUS >= CANVAS_HEIGHT - m;
    
    if ((hitLeftWall || hitRightWall || hitTopWall || hitBottomWall) && speed > 50) {
      // Only play sound if cooldown has elapsed
      if (now - lastWallHitRef.current >= WALL_COOLDOWN_MS) {
        playWallTap(speed);
        lastWallHitRef.current = now;
      }
    }
    
    // Check paddle collisions with cooldown
    const distToLeft = Math.hypot(puck.x - leftPaddle.x, puck.y - leftPaddle.y);
    const distToRight = Math.hypot(puck.x - rightPaddle.x, puck.y - rightPaddle.y);
    
    const prevPuck = prevPuckPosRef.current;
    if (prevPuck) {
      const prevDistToLeft = Math.hypot(prevPuck.x - leftPaddle.x, prevPuck.y - leftPaddle.y);
      const prevDistToRight = Math.hypot(prevPuck.x - rightPaddle.x, prevPuck.y - rightPaddle.y);
      
      // Detect paddle hit (transition from far to close)
      const hitLeftPaddle = prevDistToLeft > PUCK_RADIUS + PADDLE_RADIUS && distToLeft <= PUCK_RADIUS + PADDLE_RADIUS;
      const hitRightPaddle = prevDistToRight > PUCK_RADIUS + PADDLE_RADIUS && distToRight <= PUCK_RADIUS + PADDLE_RADIUS;
      
      if ((hitLeftPaddle || hitRightPaddle) && speed > 100) {
        // Only play sound if cooldown has elapsed
        if (now - lastPaddleHitRef.current >= PADDLE_COOLDOWN_MS) {
          playHardSlam(speed);
          lastPaddleHitRef.current = now;
        }
      }
    }
    
    prevPuckPosRef.current = { x: puck.x, y: puck.y };
  };

  // Draw dynamic light under puck
  const drawPuckLight = (
    ctx: CanvasRenderingContext2D,
    puck: { x: number; y: number; vx: number; vy: number },
    speed: number
  ) => {
    // Light intensity proportional to speed
    const intensity = Math.min(0.6, 0.2 + (speed / 1000) * 0.4);
    const radius = 40 + (speed / 1000) * 20;
    
    const grad = ctx.createRadialGradient(puck.x, puck.y, 0, puck.x, puck.y, radius);
    grad.addColorStop(0, `rgba(245, 158, 11, ${intensity})`);
    grad.addColorStop(0.5, `rgba(245, 158, 11, ${intensity * 0.3})`);
    grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    
    ctx.fillStyle = grad;
    ctx.fillRect(puck.x - radius, puck.y - radius, radius * 2, radius * 2);
  };

  // Draw dynamic light under paddle — radius grows with paddle velocity
  const drawPaddleLight = (
    ctx: CanvasRenderingContext2D,
    paddle: { x: number; y: number; vx?: number; vy?: number },
    color: string
  ) => {
    const speed  = Math.hypot(paddle.vx ?? 0, paddle.vy ?? 0);
    const radius = 55 + Math.min(speed / 12, 30);
    const alpha  = 0.12 + Math.min(speed / 1600, 0.16);
    const grad   = ctx.createRadialGradient(paddle.x, paddle.y, 0, paddle.x, paddle.y, radius);
    grad.addColorStop(0, `${color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`);
    grad.addColorStop(0.5, `${color}22`);
    grad.addColorStop(1, `${color}00`);
    ctx.fillStyle = grad;
    ctx.fillRect(paddle.x - radius, paddle.y - radius, radius * 2, radius * 2);
  };

  // Draw motion trail
  const drawMotionTrail = (
    ctx: CanvasRenderingContext2D,
    currentPuck: { x: number; y: number; vx: number; vy: number },
    speed: number
  ) => {
    const trail = puckTrailRef.current;
    if (trail.length < 2) return;
    
    // Trail length proportional to speed (0 to 10 segments)
    const maxSegments = Math.min(10, Math.floor((speed / 500) * 10));
    const segmentsToShow = Math.min(maxSegments, trail.length);
    
    for (let i = trail.length - segmentsToShow; i < trail.length; i++) {
      const point = trail[i];
      const age = performance.now() - point.timestamp;
      const ageRatio = age / 200; // 0 to 1
      
      // Fade out older trail segments
      const opacity = (1 - ageRatio) * 0.4;
      const size = PUCK_RADIUS * (1 - ageRatio * 0.5);
      
      if (opacity > 0) {
        const grad = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, size);
        grad.addColorStop(0, `rgba(245, 158, 11, ${opacity})`);
        grad.addColorStop(1, `rgba(245, 158, 11, 0)`);
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const drawTable = (ctx: CanvasRenderingContext2D) => {
    const m  = TABLE_MARGIN;
    const cx = CANVAS_WIDTH  / 2;
    const cy = CANVAS_HEIGHT / 2;
    const gTop = cy - GOAL_WIDTH / 2;
    const gBot = cy + GOAL_WIDTH / 2;

    // ── Subtle grid overlay ─────────────────────────────────────────────────
    ctx.save();
    ctx.strokeStyle = "rgba(34,211,238,0.03)";
    ctx.lineWidth = 1;
    for (let gx = m; gx <= CANVAS_WIDTH - m; gx += 60) {
      ctx.beginPath(); ctx.moveTo(gx, m); ctx.lineTo(gx, CANVAS_HEIGHT - m); ctx.stroke();
    }
    for (let gy = m; gy <= CANVAS_HEIGHT - m; gy += 60) {
      ctx.beginPath(); ctx.moveTo(m, gy); ctx.lineTo(CANVAS_WIDTH - m, gy); ctx.stroke();
    }
    ctx.restore();

    // ── Left goal box ───────────────────────────────────────────────────────
    ctx.save();
    const leftGoalGrad = ctx.createLinearGradient(0, gTop, 60, gTop);
    leftGoalGrad.addColorStop(0, "rgba(34,211,238,0.25)");
    leftGoalGrad.addColorStop(1, "rgba(34,211,238,0)");
    ctx.fillStyle = leftGoalGrad;
    ctx.fillRect(m, gTop, 60, GOAL_WIDTH);

    ctx.strokeStyle = "rgba(34,211,238,0.9)";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 12;
    // Top and bottom of goal opening
    ctx.beginPath(); ctx.moveTo(m, gTop); ctx.lineTo(m + 60, gTop); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(m, gBot); ctx.lineTo(m + 60, gBot); ctx.stroke();
    ctx.restore();

    // ── Right goal box ──────────────────────────────────────────────────────
    ctx.save();
    const rightGoalGrad = ctx.createLinearGradient(CANVAS_WIDTH, gTop, CANVAS_WIDTH - 60, gTop);
    rightGoalGrad.addColorStop(0, "rgba(167,139,250,0.25)");
    rightGoalGrad.addColorStop(1, "rgba(167,139,250,0)");
    ctx.fillStyle = rightGoalGrad;
    ctx.fillRect(CANVAS_WIDTH - m - 60, gTop, 60, GOAL_WIDTH);

    ctx.strokeStyle = "rgba(167,139,250,0.9)";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "#a78bfa";
    ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(CANVAS_WIDTH - m, gTop); ctx.lineTo(CANVAS_WIDTH - m - 60, gTop); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(CANVAS_WIDTH - m, gBot); ctx.lineTo(CANVAS_WIDTH - m - 60, gBot); ctx.stroke();
    ctx.restore();

    // ── Table boundary ──────────────────────────────────────────────────────
    ctx.save();
    ctx.shadowColor = "rgba(34,211,238,0.5)";
    ctx.shadowBlur = 16;
    ctx.strokeStyle = "rgba(34,211,238,0.85)";
    ctx.lineWidth = 2.5;
    // Draw boundary leaving goal openings
    ctx.beginPath();
    // Top wall
    ctx.moveTo(m, m); ctx.lineTo(CANVAS_WIDTH - m, m);
    // Right wall top (above goal)
    ctx.moveTo(CANVAS_WIDTH - m, m); ctx.lineTo(CANVAS_WIDTH - m, gTop);
    // Right wall bottom (below goal)
    ctx.moveTo(CANVAS_WIDTH - m, gBot); ctx.lineTo(CANVAS_WIDTH - m, CANVAS_HEIGHT - m);
    // Bottom wall
    ctx.moveTo(CANVAS_WIDTH - m, CANVAS_HEIGHT - m); ctx.lineTo(m, CANVAS_HEIGHT - m);
    // Left wall bottom (below goal)
    ctx.moveTo(m, CANVAS_HEIGHT - m); ctx.lineTo(m, gBot);
    // Left wall top (above goal)
    ctx.moveTo(m, gTop); ctx.lineTo(m, m);
    ctx.stroke();
    ctx.restore();

    // ── Center line ─────────────────────────────────────────────────────────
    ctx.save();
    ctx.setLineDash([10, 6]);
    ctx.strokeStyle = "rgba(34,211,238,0.5)";
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur  = 8;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, m);
    ctx.lineTo(cx, CANVAS_HEIGHT - m);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // ── Center circle + dot ─────────────────────────────────────────────────
    ctx.save();
    ctx.shadowColor = "rgba(34,211,238,0.6)";
    ctx.shadowBlur  = 14;
    ctx.strokeStyle = "rgba(34,211,238,0.6)";
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 72, 0, Math.PI * 2);
    ctx.stroke();

    // Outer ring (faint)
    ctx.strokeStyle = "rgba(34,211,238,0.2)";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 90, 0, Math.PI * 2);
    ctx.stroke();

    // Center dot
    ctx.shadowBlur = 20;
    ctx.fillStyle  = "rgba(34,211,238,0.8)";
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── Player zone labels ──────────────────────────────────────────────────
    ctx.save();
    ctx.font      = "bold 11px monospace";
    ctx.fillStyle = "rgba(34,211,238,0.18)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("YOUR ZONE", cx / 2, CANVAS_HEIGHT - m - 14);
    ctx.fillStyle = "rgba(167,139,250,0.18)";
    ctx.fillText("OPP ZONE", cx + cx / 2, CANVAS_HEIGHT - m - 14);
    ctx.restore();
  };


  const drawScores = (ctx: CanvasRenderingContext2D, state: AirHockeyGameState) => {
    const cx = CANVAS_WIDTH / 2;
    const y  = 38;

    ctx.save();
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";

    // Left score
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur  = 18;
    ctx.fillStyle   = "#22d3ee";
    ctx.font        = "700 30px monospace";
    ctx.fillText(`${state.leftScore}`, cx - 80, y);

    // Separator
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = "rgba(255,255,255,0.2)";
    ctx.font        = "300 22px monospace";
    ctx.fillText(":", cx, y - 1);

    // Right score
    ctx.shadowColor = "#a78bfa";
    ctx.shadowBlur  = 18;
    ctx.fillStyle   = "#a78bfa";
    ctx.font        = "700 30px monospace";
    ctx.fillText(`${state.rightScore}`, cx + 80, y);

    // First-to label
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = "rgba(255,255,255,0.18)";
    ctx.font        = "500 10px monospace";
    ctx.fillText(`FIRST TO ${state.targetScore}`, cx, y + 20);

    ctx.restore();
  };

  const drawPaddle = (ctx: CanvasRenderingContext2D, paddle: { x: number; y: number; vx?: number; vy?: number }, color: string) => {
    const { x, y } = paddle;
    const speed = Math.hypot(paddle.vx ?? 0, paddle.vy ?? 0);
    const glowIntensity = Math.min(1, speed / 400);

    ctx.save();

    // Outer glow ring (intensifies with speed)
    if (glowIntensity > 0.05) {
      const outerGrad = ctx.createRadialGradient(x, y, PADDLE_RADIUS * 0.8, x, y, PADDLE_RADIUS + 14 + glowIntensity * 10);
      outerGrad.addColorStop(0, color + "88");
      outerGrad.addColorStop(1, color + "00");
      ctx.fillStyle = outerGrad;
      ctx.beginPath();
      ctx.arc(x, y, PADDLE_RADIUS + 14 + glowIntensity * 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // Paddle body
    const bodyGrad = ctx.createRadialGradient(x - PADDLE_RADIUS * 0.3, y - PADDLE_RADIUS * 0.3, 2, x, y, PADDLE_RADIUS);
    bodyGrad.addColorStop(0, color);
    bodyGrad.addColorStop(0.6, color + "cc");
    bodyGrad.addColorStop(1, color + "66");
    ctx.shadowColor  = color;
    ctx.shadowBlur   = 14 + glowIntensity * 20;
    ctx.fillStyle    = bodyGrad;
    ctx.beginPath();
    ctx.arc(x, y, PADDLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Inner ring (handle) 
    ctx.shadowBlur   = 0;
    ctx.strokeStyle  = "rgba(255,255,255,0.25)";
    ctx.lineWidth    = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, PADDLE_RADIUS - 9, 0, Math.PI * 2);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  const drawPuck = (ctx: CanvasRenderingContext2D, puck: { x: number; y: number; vx?: number; vy?: number }) => {
    const { x, y } = puck;
    const speed = Math.hypot(puck.vx ?? 0, puck.vy ?? 0);
    const speedPct = Math.min(1, speed / 900);

    ctx.save();

    // Shadow
    ctx.shadowColor   = "rgba(0,0,0,0.8)";
    ctx.shadowBlur    = 8;
    ctx.shadowOffsetY = 4;

    // Outer glow (amber → orange → red at high speed)
    const glowColor = speedPct > 0.6
      ? `rgba(255, ${Math.round(100 - speedPct * 60)}, 0, ${0.3 + speedPct * 0.4})`
      : `rgba(245, 158, 11, ${0.2 + speedPct * 0.3})`;
    const puckGlow = ctx.createRadialGradient(x, y, 0, x, y, PUCK_RADIUS + 8 + speedPct * 12);
    puckGlow.addColorStop(0, glowColor);
    puckGlow.addColorStop(1, "rgba(245,158,11,0)");
    ctx.fillStyle = puckGlow;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(x, y, PUCK_RADIUS + 8 + speedPct * 12, 0, Math.PI * 2);
    ctx.fill();

    // Puck body gradient (dark disc)
    const bodyGrad = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, PUCK_RADIUS);
    bodyGrad.addColorStop(0, "#4a3300");
    bodyGrad.addColorStop(0.5, "#2a1a00");
    bodyGrad.addColorStop(1, "#120c00");
    ctx.shadowColor = speedPct > 0.5 ? `rgba(255,${Math.round(120 - speedPct * 80)},0,0.8)` : "#f59e0b";
    ctx.shadowBlur  = 16 + speedPct * 24;
    ctx.fillStyle   = bodyGrad;
    ctx.beginPath();
    ctx.arc(x, y, PUCK_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Edge ring
    ctx.shadowBlur   = 0;
    const edgeColor  = speedPct > 0.6 ? `rgba(255,${Math.round(180 - speedPct * 100)},0,0.9)` : "rgba(245,158,11,0.8)";
    ctx.strokeStyle  = edgeColor;
    ctx.lineWidth    = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, PUCK_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    // Gloss highlight
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.arc(x - PUCK_RADIUS * 0.3, y - PUCK_RADIUS * 0.35, PUCK_RADIUS * 0.38, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // Practice mode: restart by reinitializing local state
  const handlePracticeRestart = () => {
    const init = createLocalState();
    localRef.current = init;
    setGameState(init);
    prevScoresRef.current = { left: 0, right: 0, initialized: true };
    setShowVictory(false);
    setShowDefeat(false);
  };

  if (!gameState) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4 animate-spin" />
          <p className="text-lg">{isPractice ? "Starting practice match…" : "Connecting to game server…"}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <GameLayout match={match} currentUserId={currentUserId} accentColor="#22d3ee" accentRgb="34,211,238" compact showPills={false}>
      {showIntro && (
        <MatchIntroAnimation
          playerOneName={p1Name}
          playerTwoName={p2Name}
          playerOneImage={match.player1?.profileImageUrl}
          playerTwoImage={isPractice ? undefined : match.player2?.profileImageUrl}
          playerOneStake={parseFloat(match.betAmount || "0")}
          playerTwoStake={parseFloat(match.betAmount || "0")}
          isPractice={!!(match.isPractice)}
          isBotMatch={!!(match.isBotMatch)}
          gameLabel="Air Hockey"
          winCondition="First to 7 goals"
          timeLimit="3-min round"
          disconnectPolicy="5-min reconnect window"
          onComplete={() => setShowIntro(false)}
        />
      )}
      {/* Premium Game HUD */}
      <GameHUD
        match={match}
        currentUserId={currentUserId}
        leftScore={gameState.leftScore}
        rightScore={gameState.rightScore}
      />

      {/* Controls HUD */}
      <div className="flex gap-3 items-center flex-wrap justify-center">
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="hidden sm:block">
          <Badge variant="outline" className="gap-1 border-cyan-500/30 bg-cyan-500/5 text-cyan-300">
            {isPlayer1 ? "W/A/S/D or Mouse" : "Arrow Keys or Mouse"}
          </Badge>
        </motion.div>
        {isPractice && (
          <Badge variant="outline" className="border-violet-500/30 bg-violet-500/10 text-violet-300 capitalize">
            Bot · {botDifficulty}
          </Badge>
        )}
        {!isPractice && (
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="hidden sm:block">
            <Badge variant="outline" className="border-purple-500/30 bg-purple-500/5 text-purple-300">
              Pause (P)
            </Badge>
          </motion.div>
        )}
        {!isPractice && (
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPaused(!isPaused)}
              data-testid="button-pause-game"
              className="border-amber-500/30 bg-amber-500/5 text-amber-300"
            >
              {isPaused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
              {isPaused ? "Resume" : "Pause"}
            </Button>
          </motion.div>
        )}
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
            First to {gameState.targetScore} wins
          </Badge>
        </motion.div>
      </div>

      {/* Game Status */}
      {gameState.status === 'finished' && (
        <Alert>
          <Trophy className="w-4 h-4" />
          <AlertDescription className="flex items-center gap-3">
            <span>
              <strong>Match Over!</strong>{" "}
              {gameState.leftScore > gameState.rightScore
                ? isPlayer1 ? "You win!" : "Opponent wins!"
                : isPlayer1 ? "Opponent wins!" : "You win!"}
            </span>
            {isPractice && (
              <Button size="sm" variant="outline" onClick={handlePracticeRestart} data-testid="button-practice-restart">
                Play Again
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {isPaused && gameState.status !== 'finished' && (
        <Alert>
          <Pause className="w-4 h-4" />
          <AlertDescription>Game Paused - Press P to resume</AlertDescription>
        </Alert>
      )}

      {/* Game Canvas */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="relative w-full max-w-[900px]"
      >
        {/* Neon glow effect */}
        <div className="absolute inset-0 rounded-2xl blur-xl opacity-30 bg-gradient-to-br from-cyan-500/20 via-purple-500/20 to-amber-500/20" />
        
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="relative border-2 border-cyan-500/30 rounded-2xl shadow-2xl"
          style={{
            background: "radial-gradient(ellipse at center, #0f172a 0%, #0b0f14 70%)",
            touchAction: "none",
            boxShadow: "0 0 40px rgba(34, 211, 238, 0.15), 0 0 80px rgba(167, 139, 250, 0.1)",
            maxWidth: "100%",
            height: "auto",
          }}
          data-testid="canvas-air-hockey"
        />
      </motion.div>

      {/* Control hints */}
      <Card className="w-full max-w-2xl">
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <div className="font-semibold mb-2">Controls:</div>
            {/* Desktop controls */}
            <div className="hidden sm:grid grid-cols-2 gap-2">
              <div>• <span className="font-mono">Mouse</span>: Paddle follows your cursor (on your half)</div>
              <div>• <span className="font-mono">{isPlayer1 ? "W/A/S/D" : "Arrow Keys"}</span>: Keyboard control</div>
              <div>• <span className="font-mono">P</span>: Pause game</div>
            </div>
            {/* Mobile controls */}
            <div className="sm:hidden space-y-1">
              <div>• <strong>Drag your finger</strong> anywhere on your half to move your paddle</div>
              <div>• Your half is the {isPlayer1 ? "left" : "right"} side of the table</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Goal Celebration Overlay */}
      <AnimatePresence>
        {showGoal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0],
              }}
              transition={{
                duration: 0.5,
                repeat: Infinity,
                repeatType: "reverse",
              }}
              className="relative"
            >
              {/* Glow effect */}
              <div 
                className="absolute inset-0 blur-3xl opacity-60"
                style={{
                  background: goalScorer === "left" 
                    ? "radial-gradient(circle, #22d3ee, #06b6d4)" 
                    : "radial-gradient(circle, #a78bfa, #8b5cf6)",
                }}
              />
              
              {/* Main text */}
              <div className="relative">
                <motion.h1
                  animate={{
                    textShadow: [
                      "0 0 20px rgba(255,255,255,0.5)",
                      "0 0 40px rgba(255,255,255,0.8)",
                      "0 0 20px rgba(255,255,255,0.5)",
                    ],
                  }}
                  transition={{
                    duration: 0.5,
                    repeat: Infinity,
                    repeatType: "reverse",
                  }}
                  className="font-display font-black text-8xl md:text-9xl px-8 py-4 rounded-3xl"
                  style={{
                    background: goalScorer === "left"
                      ? "linear-gradient(135deg, #22d3ee, #06b6d4, #0891b2)"
                      : "linear-gradient(135deg, #a78bfa, #8b5cf6, #7c3aed)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.5))",
                  }}
                >
                  GOAL!!!
                </motion.h1>
                
                {/* Sparkles */}
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 rounded-full"
                    style={{
                      background: goalScorer === "left" ? "#22d3ee" : "#a78bfa",
                      top: "50%",
                      left: "50%",
                    }}
                    animate={{
                      x: Math.cos((i * Math.PI * 2) / 8) * 100,
                      y: Math.sin((i * Math.PI * 2) / 8) * 100,
                      opacity: [1, 0],
                      scale: [1, 0],
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.1,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Event feed overlay */}
      <div className="fixed bottom-24 right-4 z-40 pointer-events-none">
        <EventFeed />
      </div>

      {/* Victory / Defeat overlays */}
      <VictoryAnimation
        show={showVictory}
        winnerName="You"
        scalpsWon={0}
        onDismiss={() => {
          setShowVictory(false);
          if (isPractice) handlePracticeRestart();
        }}
      />
      <DefeatAnimation
        show={showDefeat}
        onDismiss={() => {
          setShowDefeat(false);
          if (isPractice) handlePracticeRestart();
        }}
      />
    </GameLayout>
  );
}
