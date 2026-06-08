import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { MatchWithPlayers } from "@shared/schema";
import { GameLayout } from "@/components/games/GameLayout";
import { getBotOpponentName, getBotOpponentInitial } from "@/lib/botMatchUtils";
import type { MiniGolfGameState, HoleDefinition, Obstacle, Ball } from "@shared/miniGolfEngine";
import {
  holes as staticHoles,
  getHoleDefinition,
  initializeMatch,
  simulateShotSteps,
  advanceToNextHole,
  magnitude,
  MAX_STROKES_PER_HOLE,
} from "@shared/miniGolfEngine";
import { ArrowLeft, Trophy, Flag, Zap, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

interface MiniGolfGameProps {
  match: MatchWithPlayers;
  currentUserId?: string;
}

// ─── Theme System ────────────────────────────────────────────────────────────
interface Theme {
  name: string;
  bg: string; bgGrad0: string; bgGrad1: string;
  grassPrimary: string; grassSecondary: string;
  grassLine: string; grassLineAlpha: number;
  wallFill: string; wallLine: string; wallGlow: string;
  water: string; waterRip: string; waterGlow: string;
  sand: string; sandDot: string;
  cup: string; cupRim: string; cupGlow: string;
  flag: string;
  teeText: string;
  aimLine: string; aimDot: string;
  ramp: string;
  ambientTop: string; ambientBottom: string;
  vignetteColor: string;
  skyColor: string;
}

const THEMES: Theme[] = [
  // ── Bright Arcade — matches reference image: checkerboard green, white rails, blue water ──
  {
    name: "classic",
    bg: "#3ec73e",             bgGrad0: "#4fd44f",     bgGrad1: "#2da82d",
    grassPrimary: "#4acd4a",   grassSecondary: "#38b838", grassLine: "#5de05d", grassLineAlpha: 0.4,
    wallFill: "#f0f0f0",       wallLine: "#e0e0e0",    wallGlow: "rgba(0,0,0,0.3)",
    water: "#2196F3",          waterRip: "#64B5F6",    waterGlow: "#1565C0",
    sand: "#F4C842",           sandDot: "#E6B030",
    cup: "#111111",            cupRim: "#cccccc",      cupGlow: "#888888",
    flag: "#ff2222",           teeText: "#ffffff",
    aimLine: "#ffffff",        aimDot: "#ffff88",
    ramp: "#9C27B0",
    ambientTop: "rgba(255,255,255,0.08)",  ambientBottom: "rgba(0,0,0,0.05)",
    vignetteColor: "rgba(0,0,0,0.15)",     skyColor: "#87ceeb",
  },
  // ── Neon (holes 4-6) ──────────────────────────────────────────────────────
  {
    name: "neon",
    bg: "#030e06",             bgGrad0: "#081a0c",     bgGrad1: "#030e06",
    grassPrimary: "#061208",   grassSecondary: "#030e06", grassLine: "#00e5b0", grassLineAlpha: 0.04,
    wallFill: "#0d1f10",       wallLine: "#00e5b0",    wallGlow: "#00ffcc",
    water: "#00080f",          waterRip: "#0044cc",    waterGlow: "#0033ff",
    sand: "#1a0f00",           sandDot: "#7a4a00",
    cup: "#000000",            cupRim: "#22ff88",      cupGlow: "#00ffaa",
    flag: "#ff3b58",           teeText: "#00e5b0",
    aimLine: "#ff8c00",        aimDot: "#ffcc44",
    ramp: "#7c3aed",
    ambientTop: "rgba(0,255,180,0.03)",    ambientBottom: "rgba(0,0,0,0.3)",
    vignetteColor: "rgba(0,0,0,0.7)",      skyColor: "#030e06",
  },
  // ── Beach (holes 7-9) ─────────────────────────────────────────────────────
  {
    name: "beach",
    bg: "#4acd4a",             bgGrad0: "#5ae05a",     bgGrad1: "#38b838",
    grassPrimary: "#4acd4a",   grassSecondary: "#38b838", grassLine: "#5de05d", grassLineAlpha: 0.4,
    wallFill: "#f5f5f5",       wallLine: "#e0e0e0",    wallGlow: "rgba(0,0,0,0.25)",
    water: "#1e90ff",          waterRip: "#64B5F6",    waterGlow: "#0d6efd",
    sand: "#e8d060",           sandDot: "#c8a820",
    cup: "#111111",            cupRim: "#ff8844",      cupGlow: "#ff6622",
    flag: "#ff4422",           teeText: "#1a1a1a",
    aimLine: "#ff6600",        aimDot: "#ffaa44",
    ramp: "#8B6914",
    ambientTop: "rgba(255,220,100,0.10)",  ambientBottom: "rgba(0,60,0,0.08)",
    vignetteColor: "rgba(0,40,0,0.15)",    skyColor: "#87ceeb",
  },
  // ── Space (holes 10+) ─────────────────────────────────────────────────────
  {
    name: "space",
    bg: "#04020a",             bgGrad0: "#0a0520",     bgGrad1: "#020108",
    grassPrimary: "#0a0520",   grassSecondary: "#060318", grassLine: "#6644ff", grassLineAlpha: 0.08,
    wallFill: "#1a0a40",       wallLine: "#aa44ff",    wallGlow: "#cc66ff",
    water: "#000820",          waterRip: "#2244aa",    waterGlow: "#3366cc",
    sand: "#2a1a40",           sandDot: "#6644aa",
    cup: "#000000",            cupRim: "#aa44ff",      cupGlow: "#dd88ff",
    flag: "#ff44aa",           teeText: "#aa44ff",
    aimLine: "#aa44ff",        aimDot: "#dd88ff",
    ramp: "#4422aa",
    ambientTop: "rgba(100,50,255,0.05)",   ambientBottom: "rgba(0,0,40,0.4)",
    vignetteColor: "rgba(0,0,0,0.75)",     skyColor: "#04020a",
  },
];
function getTheme(holeNumber: number): Theme {
  const idx = Math.floor((holeNumber - 1) / 3) % THEMES.length;
  return THEMES[idx];
}

// Legacy C fallback — used for seam line color only
const C = {
  ballShad: "rgba(0,0,0,0.65)",
  ramp:     "#7c3aed",
};

export default function MiniGolfGame({ match, currentUserId }: MiniGolfGameProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [gameState, setGameState] = useState<MiniGolfGameState>(() => {
    if (match.gameState) return match.gameState as MiniGolfGameState;
    return initializeMatch(
      match.player1Id || "player1",
      match.player2Id || "player2",
      match.miniGolfHoleCount || 3,
      1
    );
  });

  const [isAiming, setIsAiming]     = useState(false);
  const [power, setPower]           = useState(0);
  const [angle, setAngle]           = useState(0);
  const [isAnimating, setIsAnimating]       = useState(false);
  const [showHoleIn, setShowHoleIn]         = useState(false);
  const [showWaterPenalty, setShowWaterPenalty] = useState(false);
  const [holeSummary, setHoleSummary] = useState<{
    holeNumber: number;
    par: number;
    player1Strokes: number;
    player2Strokes: number;
    winner: "player1" | "player2" | "tie";
    isFinalHole: boolean;
  } | null>(null);
  const [botStatus, setBotStatus] = useState<string | null>(null);

  const botTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const prevHoleRef = useRef<number>(0);

  const isAimingRef    = useRef(false);
  const angleRef       = useRef(0);
  const powerRef       = useRef(0);
  const isAnimatingRef = useRef(false);
  const pendingGameStateRef = useRef<MiniGolfGameState | null>(null);
  const botTurnInProgressRef = useRef(false); // Mutex: prevents multiple simultaneous bot shots
  const processedShotIdsRef = useRef<Set<string>>(new Set()); // Dedup: prevents double-scoring
  const gamePhaseRef = useRef<string>("AWAITING_HUMAN_SHOT"); // State machine phase tracker
  const lastResetReasonRef = useRef<string | null>(null); // Debug: why ball was last reset

  // rAF animation
  const rafRef               = useRef<number>();
  const animStepsRef         = useRef<Ball[]>([]);
  const animIndexRef         = useRef(0);
  const animBallRef          = useRef<Ball | null>(null);
  const animOnCompleteRef    = useRef<((finalBall: Ball, hadWater: boolean) => void) | null>(null);
  const animHadWaterRef      = useRef(false);

  const canvasRef       = useRef<HTMLCanvasElement | null>(null);
  const wsRef           = useRef<WebSocket | null>(null);
  const frameRef        = useRef(0); // global frame counter for animations
  const particlesRef    = useRef<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string }[]>([]);
  const waterSplashRef  = useRef<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number }[]>([]);
  const sandPuffRef     = useRef<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number }[]>([]);
  const prevBallPosRef  = useRef<{ x: number; y: number } | null>(null);
  const prevBallVelRef  = useRef<{ x: number; y: number } | null>(null);
  const lastInSandRef   = useRef(false); // tracks if ball was in sand last frame

  // ── Generated hole definitions (procedural, seeded by match ID) ─────────
  // All holes in this match are deterministic: same match.id → same courses.
  const generatedHoles = useMemo(() => {
    const seed = (match as any).id || "";
    const count = Math.max(gameState.totalHoles, 9);
    return Array.from({ length: count }, (_, i) =>
      getHoleDefinition(i + 1, seed || undefined)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(match as any).id]);

  const isPlayer1 = match.player1Id === currentUserId;
  const playerKey = isPlayer1 ? "player1" : "player2";

  // NOTE: match.gameState sync via useEffect intentionally removed.
  // It caused the snap-back bug: React Query refetches match after bot-move,
  // updating match.gameState with server state mid-animation, teleporting the ball.
  // Initial state is set via useState() initializer. Live sync comes from WS only.

  // ── WebSocket ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (match.isPractice) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => ws.send(JSON.stringify({ type: "join", matchId: match.id, userId: currentUserId }));

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "mini-golf-update" && data.matchId === match.id) {
        // Buffer like mini-golf-shot: never interrupt active ball animation
        if (isAnimatingRef.current) {
          pendingGameStateRef.current = data.gameState;
        } else {
          setGameState(data.gameState);
        }
        if (data.penalty === "water") {
          toast({ title: "Water Penalty!", description: "+1 stroke, ball returned to start", variant: "destructive" });
        }
        if (data.gameState.isMatchComplete) {
          const w = data.gameState.winner;
          toast({ title: "Match Complete", description: w === "tie" ? "It's a tie!" : w === playerKey ? "You win!" : "Opponent wins!" });
          setTimeout(() => setLocation("/lobby"), 3000);
        }
      } else if (data.type === "mini-golf-shot" && data.matchId === match.id) {
        // Buffer incoming state — apply after any running animation completes to prevent ball teleport
        if (isAnimatingRef.current) {
          pendingGameStateRef.current = data.gameState;
        } else {
          setGameState(data.gameState);
        }
        if (data.gameState.isMatchComplete) {
          const w = data.gameState.winner;
          toast({ title: "Match Complete", description: w === "tie" ? "It's a tie!" : w === playerKey ? "You win!" : "Opponent wins!" });
          setTimeout(() => setLocation("/lobby"), 3000);
        }
      } else if (data.type === "player-disconnected" && data.matchId === match.id) {
        if (data.userId !== currentUserId) {
          toast({ title: "Opponent Disconnected", description: `Grace period: ${Math.floor(data.gracePeriodMs / 1000)}s` });
        }
      } else if (data.type === "match-forfeit" && data.matchId === match.id) {
        const isWinner = data.winnerId === currentUserId;
        toast({ title: isWinner ? "You Win!" : "Match Forfeited", description: isWinner ? "Opponent forfeited" : "You forfeited", variant: isWinner ? "default" : "destructive" });
        setTimeout(() => setLocation("/lobby"), 3000);
      }
    };

    wsRef.current = ws;
    return () => { if (ws.readyState <= 1) ws.close(); };
  }, [match.id, match.isPractice, currentUserId, playerKey, toast, setLocation]);

  // ── Track timers so we can centrally clean them up ─────────────────────────
  const trackTimer = useCallback((t: ReturnType<typeof setTimeout>) => {
    botTimersRef.current.add(t);
    return t;
  }, []);
  const clearAllBotTimers = useCallback(() => {
    botTimersRef.current.forEach((t) => clearTimeout(t));
    botTimersRef.current.clear();
  }, []);

  // ── Bot trigger ───────────────────────────────────────────────────────────  useEffect(() => {
    if (!match.isBotMatch || match.isPractice || match.status !== "in-progress") return;
    if (gameState.currentTurn !== "player2" || gameState.isMatchComplete) return;
    // Safety: don't fire if bot already finished this hole, summary showing, or animating
    if (gameState.player2.holeComplete) return;
    if (holeSummary) return;
    if (isAnimatingRef.current) return;
    // MUTEX: only one bot turn at a time — prevents multiple API calls from rapid re-renders
    if (botTurnInProgressRef.current) {
      console.log('[MiniGolf bot] BOT_TURN_BLOCKED_ALREADY_IN_PROGRESS');
      return;
    }
    botTurnInProgressRef.current = true;
    gamePhaseRef.current = "BOT_THINKING";
    setBotStatus(`Bot is aiming… (shot ${gameState.player2.strokes + 1}/${MAX_STROKES_PER_HOLE})`);
    console.log('[MiniGolf] BOT_TURN_START hole=' + gameState.currentHole + ' strokes=' + gameState.player2.strokes);
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/matches/${match.id}/bot-move`, { method: "POST", credentials: "include" });
        if (r.ok) {
          const data = await r.json();
          if (data.move?.gameState) {
            const newGs = data.move.gameState;
            // ShotId dedup: prevents double-scoring from duplicate API responses
            const shotId = `${match.id}-h${gameState.currentHole}-bot-s${gameState.player2.strokes + 1}`;
            if (processedShotIdsRef.current.has(shotId)) {
              console.warn('[MiniGolf] BLOCKED_DUPLICATE_SCORE', shotId);
            } else {
              processedShotIdsRef.current.add(shotId);
              console.log('[MiniGolf] SHOT_RESULT_CONFIRMED', shotId, 'strokes=', newGs.player2?.strokes);
              gamePhaseRef.current = "BOT_RESULT_PENDING";
              // Buffer like WS: don't interrupt animation with a state jump
              if (isAnimatingRef.current) {
                pendingGameStateRef.current = newGs;
              } else {
                setGameState(newGs);
              }
            }
          }
        } else {
          console.error('[MiniGolf bot] API error', r.status);
        }
      } catch (err) {
        console.error("[MiniGolf bot]", err);
      } finally {
        botTurnInProgressRef.current = false;
        gamePhaseRef.current = "CHECK_HOLE_COMPLETE";
        botTimersRef.current.delete(timer);
      }
    }, 900);
    trackTimer(timer);
    return () => {
      clearTimeout(timer);
      botTimersRef.current.delete(timer);
      botTurnInProgressRef.current = false;
    };
  // NOTE: gameState.player2.strokes intentionally NOT in deps.
  // Adding it causes the effect to re-fire every time bot scores, creating a scoring loop.
  // Effect should only re-fire when the TURN changes or hole advances.
  }, [match.isBotMatch, match.isPractice, match.status, match.id, gameState.currentTurn, gameState.currentHole, gameState.isMatchComplete, gameState.player2.holeComplete, holeSummary, trackTimer, isAnimating]);

  // ── Clear bot status when it's no longer bot's turn ───────────────────────
  useEffect(() => {
    if (gameState.currentTurn !== "player2" || gameState.player2.holeComplete || gameState.isMatchComplete) {
      setBotStatus(null);
    }
  }, [gameState.currentTurn, gameState.player2.holeComplete, gameState.isMatchComplete]);

  // ── Centralized timer cleanup on unmount ──────────────────────────────────
  useEffect(() => {
    return () => {
      clearAllBotTimers();
    };
  }, [clearAllBotTimers]);

  // ── Hole summary detection: when currentHole changes, show summary of last hole
  useEffect(() => {
    const prev = prevHoleRef.current;
    const cur = gameState.currentHole;
    if (prev === 0) {
      prevHoleRef.current = cur;
      return;
    }
    if (cur !== prev) {
      // New hole: clear per-hole dedup set so valid shots are not blocked
      processedShotIdsRef.current.clear();
      lastResetReasonRef.current = 'NEW_HOLE_START';
      console.log('[MiniGolf] NEXT_HOLE_LOADING hole=' + cur);
    }
    if (cur !== prev && !gameState.isMatchComplete) {
      const recorded = gameState.perHoleStrokes[prev];
      if (recorded) {
        const holeDef = generatedHoles[prev - 1];
        const p1 = recorded.player1;
        const p2 = recorded.player2;
        const winner: "player1" | "player2" | "tie" =
          p1 < p2 ? "player1" : p2 < p1 ? "player2" : "tie";
        const isFinalHole = cur > gameState.totalHoles;
        setHoleSummary({
          holeNumber: prev,
          par: holeDef?.par ?? 3,
          player1Strokes: p1,
          player2Strokes: p2,
          winner,
          isFinalHole,
        });
        const t = setTimeout(() => {
          setHoleSummary(null);
        }, 2800);
        trackTimer(t);
      }
    }
    prevHoleRef.current = cur;
  }, [gameState.currentHole, gameState.perHoleStrokes, gameState.isMatchComplete, gameState.totalHoles, generatedHoles, trackTimer]);

  // ── Start ball animation ──────────────────────────────────────────────────
  const startAnimation = useCallback((steps: Ball[], hadWater: boolean, onComplete: (final: Ball, hadWater: boolean) => void) => {
    animStepsRef.current       = steps;
    animIndexRef.current       = 0;
    animHadWaterRef.current    = hadWater;
    animOnCompleteRef.current  = onComplete;
    animBallRef.current        = steps[0] ?? null;
    isAnimatingRef.current     = true;
    setIsAnimating(true);
  }, []);

  // ── Main render + animation loop ──────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = () => {
      frameRef.current++;

      // Advance animation
      if (isAnimatingRef.current && animStepsRef.current.length > 0) {
        const STEPS_PER_FRAME = 4;
        animIndexRef.current = Math.min(animIndexRef.current + STEPS_PER_FRAME, animStepsRef.current.length - 1);
        animBallRef.current  = animStepsRef.current[animIndexRef.current];

        // ── Hazard particle detection ─────────────────────────────────────────
        const animBall = animBallRef.current;
        if (animBall) {
          const animHole = generatedHoles[gameState.currentHole - 1] ?? generatedHoles[0];
          const bx = animBall.position.x;
          const by = animBall.position.y;
          if (animHole?.obstacles) {
            let ballInSandThisFrame = false;
            for (const obs of animHole.obstacles) {
              // ── Water (rectangle hit-test) ──────────────────────────────
              if (obs.type === "water") {
                const inWater =
                  bx >= obs.x && bx <= obs.x + obs.width &&
                  by >= obs.y && by <= obs.y + obs.height;
                if (inWater && waterSplashRef.current.length < 6) {
                  // Burst of water drops on entry
                  const count = 10 + Math.floor(Math.random() * 8);
                  for (let k = 0; k < count; k++) {
                    const ang = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 1.6;
                    const spd = 1.5 + Math.random() * 4;
                    waterSplashRef.current.push({
                      x: bx + (Math.random() - 0.5) * 6,
                      y: by + (Math.random() - 0.5) * 6,
                      vx: Math.cos(ang) * spd,
                      vy: Math.sin(ang) * spd - 1,
                      life: 22 + Math.floor(Math.random() * 14),
                      maxLife: 36,
                    });
                  }
                  setShowWaterPenalty(true);
                  setTimeout(() => setShowWaterPenalty(false), 1800);
                }
              }

              // ── Sand (circle hit-test) ────────────────────────────────
              if (obs.type === "sand") {
                const dist = Math.hypot(bx - obs.x, by - obs.y);
                if (dist <= obs.radius) {
                  ballInSandThisFrame = true;
                  // Continuous light puff while rolling in sand (throttled)
                  if (frameRef.current % 3 === 0 && lastInSandRef.current) {
                    const vel = animBall.velocity ?? { x: 0, y: 0 };
                    const spd = Math.hypot(vel.x, vel.y);
                    if (spd > 0.5) {
                      const count = 2 + Math.floor(spd / 3);
                      for (let k = 0; k < count; k++) {
                        const ang = Math.atan2(vel.y, vel.x) + Math.PI + (Math.random() - 0.5) * Math.PI;
                        sandPuffRef.current.push({
                          x: bx + (Math.random() - 0.5) * 4,
                          y: by + (Math.random() - 0.5) * 4,
                          vx: Math.cos(ang) * (0.5 + Math.random() * 1.5),
                          vy: Math.sin(ang) * (0.5 + Math.random() * 1.5),
                          life: 16 + Math.floor(Math.random() * 10),
                          maxLife: 26,
                        });
                      }
                    }
                  }
                }
              }
            }
            lastInSandRef.current = ballInSandThisFrame;
          }
        }

        if (animIndexRef.current >= animStepsRef.current.length - 1) {
        isAnimatingRef.current = false;
        setIsAnimating(false);
        const final = animStepsRef.current[animStepsRef.current.length - 1];
        const hadWater = animHadWaterRef.current;
        console.log('[MiniGolf] ANIM_COMPLETE isInHole=' + final.isInHole + ' hadWater=' + hadWater + ' phase=' + gamePhaseRef.current);
        animOnCompleteRef.current?.(final, hadWater);
        animOnCompleteRef.current = null;
        if (final.isInHole) {
          setShowHoleIn(true);
          gamePhaseRef.current = "BALL_HOLED";
          console.log('[MiniGolf] BALL_HOLED - tee reset now blocked this hole');
        }
        // Flush buffered server state AFTER animation completes
        if (pendingGameStateRef.current) {
          const pending = pendingGameStateRef.current;
          pendingGameStateRef.current = null;
          setGameState(pending);
        }
        if (gamePhaseRef.current !== "BALL_HOLED") {
          gamePhaseRef.current = "AWAITING_HUMAN_SHOT";
        }
      }
      }

      drawFrame(ctx);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, playerKey, isAiming, angle, power]);

  // ─────────────────────────────────────────────────────────────────────────
  // Draw
  // ─────────────────────────────────────────────────────────────────────────
  function drawFrame(ctx: CanvasRenderingContext2D) {
    const hole    = generatedHoles[gameState.currentHole - 1] ?? generatedHoles[0] ?? staticHoles[0];
    const W       = hole.bounds.width;
    const H       = hole.bounds.height;
    const T       = getTheme(gameState.currentHole);
    const frame   = frameRef.current;

    // Display ball: use animated position if animating, else real position
    // Only use animated ball for this player's own shot animation
  const isMyAnimation = isAnimatingRef.current && animBallRef.current;
  const displayBall = isMyAnimation ? animBallRef.current! : gameState[playerKey].ball;Background ──────────────────────────────────────────────────────────
    ctx.fillStyle = T.bg;
    ctx.fillRect(0, 0, W, H);

    // Fairway gradient — radial, center brighter
    const fwGrad = ctx.createRadialGradient(W * 0.4, H * 0.3, 0, W / 2, H / 2, W * 0.85);
    fwGrad.addColorStop(0, T.bgGrad0);
    fwGrad.addColorStop(1, T.bgGrad1);
    ctx.fillStyle = fwGrad;
    ctx.fillRect(0, 0, W, H);

    // ── Ambient directional light (top-left sun / glow) ─────────────────────
    const sunGrad = ctx.createRadialGradient(W * 0.2, H * 0.1, 0, W * 0.2, H * 0.1, W * 0.9);
    sunGrad.addColorStop(0, T.ambientTop);
    sunGrad.addColorStop(1, "transparent");
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, W, H);

    // ── Grass texture ───────────────────────────────────────────────────────
    if (T.name === "classic" || T.name === "beach") {
      // Checkerboard tile grid — reference image arcade style
      const TILE = 40;
      ctx.save();
      for (let tx = 0; tx < W; tx += TILE) {
        for (let ty = 0; ty < H; ty += TILE) {
          const isEven = (((tx / TILE) + (ty / TILE)) % 2 === 0);
          ctx.fillStyle = isEven ? T.grassPrimary : T.grassSecondary;
          ctx.fillRect(tx, ty, TILE, TILE);
        }
      }
      ctx.restore();
    } else if (T.name === "space") {
      // Star field
      ctx.save();
      for (let s = 0; s < 60; s++) {
        const sx = ((s * 173 + 42) % W); const sy = ((s * 97 + 17) % H);
        const brightness = 0.3 + ((s * 37) % 7) / 10;
        ctx.globalAlpha = brightness; ctx.fillStyle = "#ffffff"; ctx.fillRect(sx, sy, 1, 1);
      }
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = T.grassLine; ctx.lineWidth = 1; ctx.globalAlpha = T.grassLineAlpha;
      for (let i = 0; i < W; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); }
      for (let j = 0; j < H; j += 40) { ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(W, j); ctx.stroke(); }
      ctx.restore();
    } else {
      // Neon: subtle crosshatch
      ctx.strokeStyle = T.grassLine; ctx.lineWidth = 1; ctx.globalAlpha = T.grassLineAlpha;
      for (let i = 0; i < W; i += 30) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); }
      for (let j = 0; j < H; j += 30) { ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(W, j); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    // Reset alpha
    ctx.globalAlpha = 1;

    // ── Obstacles ───────────────────────────────────────────────────────────
    hole.obstacles.forEach((obs: Obstacle) => drawObstacle(ctx, obs, hole, frame, T));

    // ── Tee marker ─────────────────────────────────────────────────────────
    const sp = hole.spawnPoint;
    ctx.save();
    ctx.shadowColor = T.wallLine;
    ctx.shadowBlur  = T.name === "neon" || T.name === "space" ? 10 : 4;
    ctx.strokeStyle = T.wallLine;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = T.name === "classic" ? "rgba(255,255,255,0.08)" : "rgba(0,229,176,0.08)";
    ctx.fill();
    ctx.font = "bold 8px sans-serif";
    ctx.fillStyle = T.teeText;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("TEE", sp.x, sp.y);
    ctx.restore();

    // ── Hole cup ────────────────────────────────────────────────────────────
    drawCup(ctx, hole, frame, T);

    // ── Aim line & trajectory preview ──────────────────────────────────────
    if (isAimingRef.current && !isAnimatingRef.current) {
      drawAimLine(ctx, displayBall.position, angleRef.current, powerRef.current, hole, T);
    }

    // ── Ball shadow (ground) ────────────────────────────────────────────────
    if (!displayBall.isInHole) {
      const bx = displayBall.position.x;
      const by = displayBall.position.y;
      ctx.save();
      ctx.globalAlpha = 0.35;
      const shadowGrad = ctx.createRadialGradient(bx + 2, by + 4, 0, bx + 2, by + 4, 10);
      shadowGrad.addColorStop(0, "rgba(0,0,0,0.8)");
      shadowGrad.addColorStop(1, "transparent");
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.ellipse(bx + 2, by + 6, 9, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Ball ────────────────────────────────────────────────────────────────
    if (!displayBall.isInHole) {
      drawBall(ctx, displayBall, T);
    }

    // ── Water splash particles ──────────────────────────────────────────────
    drawWaterSplash(ctx, T);

    // ── Sand puff particles ─────────────────────────────────────────────────
    drawSandPuff(ctx, T);

    // ── Impact flash particles ──────────────────────────────────────────────
    drawParticles(ctx, frame, T);

    // ── Power meter ─────────────────────────────────────────────────────────
    if (isAimingRef.current && !isAnimatingRef.current) {
      drawPowerMeter(ctx, powerRef.current, W, H, T);
    }

    // ── Vignette (depth) ────────────────────────────────────────────────────
    const vignette = ctx.createRadialGradient(W / 2, H / 2, W * 0.28, W / 2, H / 2, W * 0.75);
    vignette.addColorStop(0, "transparent");
    vignette.addColorStop(1, T.vignetteColor);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    // ── Bottom ambient shadow ────────────────────────────────────────────────
    const bottomGrad = ctx.createLinearGradient(0, H * 0.7, 0, H);
    bottomGrad.addColorStop(0, "transparent");
    bottomGrad.addColorStop(1, T.ambientBottom);
    ctx.fillStyle = bottomGrad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle, hole: HoleDefinition, frame: number, T: Theme) {
    ctx.save();

    if (obs.type === "wall") {
    const wallVec = { x: obs.x2 - obs.x1, y: obs.y2 - obs.y1 };
    const len = Math.hypot(wallVec.x, wallVec.y);
    if (len < 1) { ctx.restore(); return; }
    const nx = -wallVec.y / len;
    const ny = wallVec.x / len;
    // Wall half-thickness — chunky white rail like reference image
    const ht = (T.name === "classic" || T.name === "beach") ? 9 : 6;
    // Drop shadow
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 4;
    // Slab fill
    ctx.beginPath();
    ctx.moveTo(obs.x1 + nx * ht, obs.y1 + ny * ht);
    ctx.lineTo(obs.x2 + nx * ht, obs.y2 + ny * ht);
    ctx.lineTo(obs.x2 - nx * ht, obs.y2 - ny * ht);
    ctx.lineTo(obs.x1 - nx * ht, obs.y1 - ny * ht);
    ctx.closePath();
    ctx.fillStyle = (T.name === "classic" || T.name === "beach") ? "#f5f5f5" : T.wallFill;
    ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    // Highlight top edge
    ctx.beginPath();
    ctx.moveTo(obs.x1 + nx * ht, obs.y1 + ny * ht);
    ctx.lineTo(obs.x2 + nx * ht, obs.y2 + ny * ht);
    ctx.strokeStyle = (T.name === "classic" || T.name === "beach") ? "rgba(255,255,255,0.95)" : T.wallGlow;
    ctx.lineWidth = (T.name === "neon" || T.name === "space") ? 2 : 3;
    ctx.lineCap = "round";
    if (T.name === "neon" || T.name === "space") {
      ctx.shadowColor = T.wallGlow; ctx.shadowBlur = 10;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Bottom edge (shadow strip)
    ctx.beginPath();
    ctx.moveTo(obs.x1 - nx * ht, obs.y1 - ny * ht);
    ctx.lineTo(obs.x2 - nx * ht, obs.y2 - ny * ht);
    ctx.strokeStyle = (T.name === "classic" || T.name === "beach") ? "rgba(0,0,0,0.20)" : "rgba(0,0,0,0.5)";
    ctx.lineWidth = 2; ctx.stroke();
    // Rounded caps
    ctx.fillStyle = (T.name === "classic" || T.name === "beach") ? "#f5f5f5" : T.wallFill;
    [{ x: obs.x1, y: obs.y1 }, { x: obs.x2, y: obs.y2 }].forEach(pt => {
      ctx.beginPath(); ctx.arc(pt.x, pt.y, ht, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(pt.x, pt.y, ht, 0, Math.PI * 2);
      ctx.strokeStyle = (T.name === "classic" || T.name === "beach") ? "rgba(255,255,255,0.9)" : T.wallGlow;
      ctx.lineWidth = 2; ctx.stroke();
    });
  }

    if (obs.type === "water") {
    // Bright blue water fill — reference image style
    ctx.save();
    // Base blue fill
    ctx.fillStyle = T.water;
    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    // Lighter animated shimmer
    const shimmer = ctx.createLinearGradient(obs.x, obs.y, obs.x + obs.width, obs.y + obs.height);
    shimmer.addColorStop(0, "rgba(255,255,255,0.15)");
    shimmer.addColorStop(0.5, "rgba(255,255,255,0.05)");
    shimmer.addColorStop(1, "rgba(255,255,255,0.15)");
    ctx.fillStyle = shimmer;
    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    // Animated ripple lines
    const rippleT = (frame * 0.025) % 1;
    for (let r = 0; r < 3; r++) {
      const rPct = (r / 3 + rippleT) % 1;
      const rAlpha = 0.45 * (1 - rPct);
      ctx.strokeStyle = `rgba(255,255,255,${rAlpha.toFixed(2)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let wx = obs.x + 4; wx <= obs.x + obs.width - 4; wx += 4) {
        const wy = obs.y + obs.height * rPct + Math.sin((wx - obs.x) * 0.12 + frame * 0.05) * 2.5;
        if (wx === obs.x + 4) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
      }
      ctx.stroke();
    }
    // Water border
    ctx.strokeStyle = T.waterRip;
    ctx.lineWidth = 3;
    ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
    ctx.restore();
  }

    if (obs.type === "sand") {
      // Themed sand bunker
      const sandGrad = ctx.createRadialGradient(obs.x, obs.y, 0, obs.x, obs.y, obs.radius);
      sandGrad.addColorStop(0, T.sandDot);
      sandGrad.addColorStop(1, T.sand);
      ctx.fillStyle = sandGrad;
      ctx.beginPath();
      ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
      ctx.fill();
      // Rim
      ctx.shadowColor = T.sandDot;
      ctx.shadowBlur  = 6;
      ctx.strokeStyle = T.sandDot;
      ctx.lineWidth   = 2;
      ctx.stroke();
      // Stipple dots
      ctx.shadowBlur = 0;
      for (let d = 0; d < 14; d++) {
        const theta = (d / 14) * Math.PI * 2;
        const rr    = obs.radius * (0.4 + (d % 3) * 0.15);
        const dx    = obs.x + Math.cos(theta) * rr;
        const dy    = obs.y + Math.sin(theta) * rr;
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = T.wallLine;
        ctx.beginPath();
        ctx.arc(dx, dy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    if (obs.type === "ramp") {
      const rampGrad = ctx.createLinearGradient(obs.x, obs.y, obs.x + obs.width, obs.y + obs.height);
      rampGrad.addColorStop(0, T.ramp + "cc");
      rampGrad.addColorStop(1, T.ramp);
      ctx.fillStyle = rampGrad;
      ctx.shadowColor = T.wallGlow;
      ctx.shadowBlur  = 12;
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
      ctx.strokeStyle = T.wallLine;
      ctx.lineWidth   = 2;
      ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);

      // Arrow direction indicator
      const arrowMap: Record<string, [number, number][]> = {
        up:    [[0.5, 0.7], [0.3, 0.35], [0.5, 0.25], [0.7, 0.35]],
        down:  [[0.5, 0.3], [0.3, 0.65], [0.5, 0.75], [0.7, 0.65]],
        left:  [[0.7, 0.5], [0.35, 0.3], [0.25, 0.5], [0.35, 0.7]],
        right: [[0.3, 0.5], [0.65, 0.3], [0.75, 0.5], [0.65, 0.7]],
      };
      const pts = arrowMap[obs.direction] ?? arrowMap.right;
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      pts.forEach(([px, py], i) => {
        const ax = obs.x + obs.width * px;
        const ay = obs.y + obs.height * py;
        if (i === 0) ctx.moveTo(ax, ay); else ctx.lineTo(ax, ay);
      });
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  function drawCup(ctx: CanvasRenderingContext2D, hole: HoleDefinition, frame: number, T: Theme) {
    const cp = hole.cupPosition;
    ctx.save();

    // Outer pulsing glow
    const pulse = 0.6 + 0.4 * Math.sin(frame * 0.07);
    const rimGrad = ctx.createRadialGradient(cp.x, cp.y, hole.cupRadius * 0.6, cp.x, cp.y, hole.cupRadius * 2.0);
    rimGrad.addColorStop(0, T.cupGlow + Math.round(pulse * 0.4 * 255).toString(16).padStart(2, "0"));
    rimGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.arc(cp.x, cp.y, hole.cupRadius * 2.0, 0, Math.PI * 2);
    ctx.fill();

    // Cup interior (dark hole)
    ctx.shadowColor = T.cupGlow;
    ctx.shadowBlur  = 16 * pulse;
    ctx.fillStyle   = T.cup;
    ctx.beginPath();
    ctx.arc(cp.x, cp.y, hole.cupRadius, 0, Math.PI * 2);
    ctx.fill();

    // Rim ring
    ctx.strokeStyle = T.cupRim;
    ctx.lineWidth   = 2.5;
    ctx.stroke();

    // Flag pole
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = "#888";
    ctx.lineWidth   = 2;
    ctx.lineCap     = "round";
    ctx.beginPath();
    ctx.moveTo(cp.x, cp.y - hole.cupRadius * 0.5);
    ctx.lineTo(cp.x, cp.y - 45);
    ctx.stroke();

    // Animated flag
    const flagWave = Math.sin(frame * 0.1) * 5;
    ctx.fillStyle = T.flag;
    ctx.shadowColor = T.flag;
    ctx.shadowBlur  = T.name === "neon" || T.name === "space" ? 10 : 4;
    ctx.beginPath();
    ctx.moveTo(cp.x, cp.y - 45);
    ctx.lineTo(cp.x + 20 + flagWave, cp.y - 36);
    ctx.lineTo(cp.x, cp.y - 27);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawBall(ctx: CanvasRenderingContext2D, ball: Ball, T: Theme) {
  const { x, y } = ball.position;
  const r = 7;
  const rot = ball.rotation ?? 0;
  ctx.save();
  // Drop shadow
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 6; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3;
  // Ball body
  const ballGrad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  if (T.name === "classic" || T.name === "beach") {
    ballGrad.addColorStop(0, "#ffffff"); ballGrad.addColorStop(0.7, "#eeeeee"); ballGrad.addColorStop(1, "#cccccc");
  } else {
    ballGrad.addColorStop(0, T.wallLine); ballGrad.addColorStop(1, T.wallFill);
  }
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = ballGrad; ctx.fill();
  ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  // Outline
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = (T.name === "neon" || T.name === "space") ? T.wallGlow : "rgba(0,0,0,0.22)";
  ctx.lineWidth = 1.5; ctx.stroke();
  // Spin stripe
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI);
  ctx.strokeStyle = (T.name === "neon" || T.name === "space") ? T.aimLine : "rgba(0,0,0,0.15)";
  ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
  ctx.restore();
}
function drawAimLine(
    ctx: CanvasRenderingContext2D,
    ballPos: { x: number; y: number },
    angle: number,
    power: number,
    hole: HoleDefinition,
    T: Theme
  ) {
    if (power < 2) return;
    const maxLen = 160;
    const len    = (power / 100) * maxLen;
    const endX   = ballPos.x + Math.cos(angle) * len;
    const endY   = ballPos.y + Math.sin(angle) * len;

    ctx.save();

    // Gradient line (fade out) — theme colored
    const grad = ctx.createLinearGradient(ballPos.x, ballPos.y, endX, endY);
    grad.addColorStop(0, T.aimLine + "e6");
    grad.addColorStop(1, T.aimLine + "18");
    ctx.strokeStyle = grad;
    ctx.lineWidth   = 2.5;
    ctx.setLineDash([8, 6]);
    ctx.shadowColor = T.aimLine;
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.moveTo(ballPos.x, ballPos.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrow head
    const arrowSize = 10;
    ctx.fillStyle = T.aimLine;
    ctx.shadowColor = T.aimLine;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - arrowSize * Math.cos(angle - 0.5), endY - arrowSize * Math.sin(angle - 0.5));
    ctx.lineTo(endX - arrowSize * Math.cos(angle + 0.5), endY - arrowSize * Math.sin(angle + 0.5));
    ctx.closePath();
    ctx.fill();

    // Trajectory preview dots — shot speed 1.5 + (power/100) * 5.5 = 1.5-7.0 px/step
    const DOT_COUNT = 8;
    const velScale  = (2 + power * 4.0) * 0.016;
    let px = ballPos.x, py = ballPos.y;
    let vx = Math.cos(angle) * velScale, vy = Math.sin(angle) * velScale;
    for (let d = 0; d < DOT_COUNT; d++) {
      px += vx * 5;
      py += vy * 5;
      vx *= 0.96; vy *= 0.96;
      if (px < 0 || px > hole.bounds.width || py < 0 || py > hole.bounds.height) break;
      const alpha = 0.55 - d * 0.08;
      ctx.shadowBlur = 0;
      ctx.fillStyle  = T.aimDot;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(px, py, 3.5 - d * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function drawPowerMeter(ctx: CanvasRenderingContext2D, power: number, W: number, H: number, T: Theme) {
    const barX = W - 22;
    const barH = H * 0.55;
    const barY = (H - barH) / 2;
    const barW = 12;

    ctx.save();
    // Bar background
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    roundRectPath(ctx, barX - 2, barY - 2, barW + 4, barH + 4, 6);
    ctx.fill();

    // Filled portion
    const fillH   = (power / 100) * barH;
    const fillY   = barY + barH - fillH;
    const fillGrad = ctx.createLinearGradient(0, fillY + fillH, 0, fillY);
    fillGrad.addColorStop(0, "#22c55e");
    fillGrad.addColorStop(0.5, "#f59e0b");
    fillGrad.addColorStop(1, "#ef4444");
    ctx.fillStyle = fillGrad;
    ctx.shadowColor = "#f59e0b";
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    roundRectPath(ctx, barX, fillY, barW, fillH, 4);
    ctx.fill();

    // Border
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    roundRectPath(ctx, barX, barY, barW, barH, 4);
    ctx.stroke();

    // Power label
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font      = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`${Math.round(power)}%`, barX + barW / 2, barY + barH + 5);

    ctx.restore();
  }

  function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawParticles(ctx: CanvasRenderingContext2D, _frame: number, T: Theme) {
    const live = particlesRef.current;
    if (live.length === 0) return;
    ctx.save();
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      p.x  += p.vx;
      p.y  += p.vy;
      p.vy += 0.15; // gravity
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life--;
      if (p.life <= 0) { live.splice(i, 1); continue; }
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = 4;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5 * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
    ctx.restore();

    // Detect wall impacts by tracking velocity direction changes
    const ball = isAnimatingRef.current && animBallRef.current
      ? animBallRef.current
      : gameState[playerKey].ball;
    const vel = ball.velocity ?? { x: 0, y: 0 };
    const spd = Math.hypot(vel.x, vel.y);
    if (spd > 6 && prevBallVelRef.current) {
      const pv = prevBallVelRef.current;
      const dot = (vel.x * pv.x + vel.y * pv.y) / (spd * Math.hypot(pv.x, pv.y) + 0.001);
      if (dot < 0.5) {
        // Velocity direction changed significantly — wall impact
        const pos = ball.position;
        const count = 8 + Math.floor(spd / 8);
        for (let k = 0; k < count; k++) {
          const baseAngle = Math.atan2(-pv.y, -pv.x) + (Math.random() - 0.5) * Math.PI;
          const speed2 = 2 + Math.random() * 4;
          live.push({
            x: pos.x, y: pos.y,
            vx: Math.cos(baseAngle) * speed2,
            vy: Math.sin(baseAngle) * speed2,
            life: 18 + Math.floor(Math.random() * 12),
            maxLife: 30,
            color: T.wallGlow,
          });
        }
      }
    }
    prevBallVelRef.current = { x: vel.x, y: vel.y };
  }

  // ── Water splash draw ────────────────────────────────────────────────────
  function drawWaterSplash(ctx: CanvasRenderingContext2D, _T: Theme) {
    const live = waterSplashRef.current;
    if (live.length === 0) return;
    ctx.save();
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      p.x  += p.vx;
      p.y  += p.vy;
      p.vy += 0.18;   // gravity pulls drops back down
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.life--;
      if (p.life <= 0) { live.splice(i, 1); continue; }
      const alpha = p.life / p.maxLife;
      // Draw as elongated drop shape
      ctx.globalAlpha = alpha * 0.85;
      ctx.shadowColor = "#4dd0fb";
      ctx.shadowBlur  = 5;
      ctx.fillStyle   = alpha > 0.5 ? "#a8eeff" : "#4dd0fb";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2 * alpha + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
    ctx.restore();
  }

  // ── Sand puff draw ───────────────────────────────────────────────────────
  function drawSandPuff(ctx: CanvasRenderingContext2D, _T: Theme) {
    const live = sandPuffRef.current;
    if (live.length === 0) return;
    ctx.save();
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      p.x  += p.vx;
      p.y  += p.vy;
      p.vx *= 0.88;
      p.vy *= 0.88;
      p.life--;
      if (p.life <= 0) { live.splice(i, 1); continue; }
      const alpha = (p.life / p.maxLife) * 0.65;
      const radius = (1 - p.life / p.maxLife) * 6 + 2; // grows as it dissipates
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#e8c97a";
      ctx.shadowColor = "#c4a84a";
      ctx.shadowBlur  = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
    ctx.restore();
  }

  // ─── Aim helpers ─────────────────────────────────────────────────────────
  function computeAim(canvasX: number, canvasY: number) {
    const ballPos = gameState[playerKey].ball.position;
    const dx      = canvasX - ballPos.x;
    const dy      = canvasY - ballPos.y;
    const a       = Math.atan2(dy, dx);
    const p       = Math.min(Math.sqrt(dx * dx + dy * dy) / 1.8, 100);
    angleRef.current = a;
    powerRef.current = p;
    setAngle(a);
    setPower(p);
  }

  function toCanvasCoords(e: { clientX: number; clientY: number }, canvas: HTMLCanvasElement, hole: HoleDefinition): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * hole.bounds.width)  / rect.width,
      y: ((e.clientY - rect.top)  * hole.bounds.height) / rect.height,
    };
  }

  // ─── Shot execution ───────────────────────────────────────────────────────
  const handleShot = useCallback(async () => {
    if (match.status !== "in-progress") return;
    if (!match.isPractice && gameState.currentTurn !== playerKey) {
      toast({ title: "Not your turn", variant: "destructive" });
      return;
    }
    if (isAnimatingRef.current) return;
    if (powerRef.current < 1) return;
    const shotId = `${match.id}-h${gameState.currentHole}-${playerKey}-s${gameState[playerKey].strokes + 1}`;
    if (processedShotIdsRef.current.has(shotId)) {
      console.warn('[MiniGolf] BLOCKED_DUPLICATE_SHOT', shotId);
      return;
    }
    processedShotIdsRef.current.add(shotId);
    console.log('[MiniGolf] SHOT_CREATED', shotId);
    gamePhaseRef.current = "HUMAN_SHOT_IN_PROGRESS";

    const currentAngle = angleRef.current;
    const currentPower = powerRef.current;
    // Scale power: 0% = gentle 2px/step, 100% = strong 402px/s (travels ~370px on fairway)
    // Power 0-100 → speed 1.5–7 px/step for sane ball travel distance
    const powerFrac = Math.min(Math.max(currentPower, 0), 100) / 100;
    const shotSpeed = 1.5 + powerFrac * 5.5;
    const velocity = {
      x: Math.cos(currentAngle) * shotSpeed,
      y: Math.sin(currentAngle) * shotSpeed,
    };

    isAimingRef.current = false;
    setIsAiming(false);
    angleRef.current = 0;
    powerRef.current = 0;
    setPower(0);

    const hole    = generatedHoles[gameState.currentHole - 1] ?? generatedHoles[0] ?? staticHoles[0];
    const ball    = gameState[playerKey].ball;
    const { steps, waterPenalty } = simulateShotSteps(ball, velocity, hole, 2);

    if (match.isPractice) {
      startAnimation(steps, waterPenalty, (finalBall, hadWater) => {
        const extraStrokes = hadWater ? 1 : 0;
        const newStrokesUncapped = gameState[playerKey].strokes + 1 + extraStrokes;
        const newStrokes = Math.min(newStrokesUncapped, MAX_STROKES_PER_HOLE);
        const reachedLimit = newStrokes >= MAX_STROKES_PER_HOLE && !finalBall.isInHole;
        const holeComplete = finalBall.isInHole || reachedLimit;
        const updatedPlayer = {
          ...gameState[playerKey],
          ball: finalBall,
          strokes: newStrokes,
          holeComplete,
        };
        if (hadWater) {
          toast({ title: "Water Penalty!", description: "+1 stroke", variant: "destructive" });
        }
        if (reachedLimit) {
          toast({ title: "Stroke limit reached", description: `Max ${MAX_STROKES_PER_HOLE} strokes — moving to next hole`, variant: "destructive" });
        }
        if (holeComplete) {
          const nextGs = advanceToNextHole({ ...gameState, [playerKey]: updatedPlayer });
          setGameState(nextGs);
          if (nextGs.isMatchComplete) {
            toast({ title: "Practice Complete!", description: `Finished in ${Object.values(nextGs.perHoleStrokes).reduce((s: number, h: any) => s + h[playerKey], 0)} strokes` });
            const t = setTimeout(() => setLocation("/lobby"), 3000);
            trackTimer(t);
          }
        } else {
          setGameState({ ...gameState, [playerKey]: updatedPlayer });
        }
        const t = setTimeout(() => setShowHoleIn(false), 1500);
        trackTimer(t);
      });
    } else {
      // Multiplayer: animate locally for feel, then WS confirms final state
      startAnimation(steps, waterPenalty, () => {
        setTimeout(() => setShowHoleIn(false), 1500);
      });
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "mini-golf-shot", matchId: match.id, userId: currentUserId, velocity }));
      }
    }
  }, [match, gameState, playerKey, currentUserId, toast, setLocation, startAnimation]);

  // ─── Canvas event handlers ────────────────────────────────────────────────
  const canvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (match.status !== "in-progress") return;
    if (!match.isPractice && gameState.currentTurn !== playerKey) return;
    if (isAnimatingRef.current) return;
    const canvas = canvasRef.current!;
    const hole   = generatedHoles[gameState.currentHole - 1] ?? generatedHoles[0] ?? staticHoles[0];
    const pos    = toCanvasCoords(e.nativeEvent, canvas, hole);
    computeAim(pos.x, pos.y);
    isAimingRef.current = true;
    setIsAiming(true);
  };

  const canvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isAimingRef.current) return;
    const canvas = canvasRef.current!;
    const hole   = generatedHoles[gameState.currentHole - 1] ?? generatedHoles[0] ?? staticHoles[0];
    const pos    = toCanvasCoords(e.nativeEvent, canvas, hole);
    computeAim(pos.x, pos.y);
  };

  const canvasMouseUp = () => {
    if (!isAimingRef.current) return;
    handleShot();
  };

  const canvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (match.status !== "in-progress") return;
    if (!match.isPractice && gameState.currentTurn !== playerKey) return;
    if (isAnimatingRef.current) return;
    if (e.touches.length === 0) return;
    const canvas = canvasRef.current!;
    const hole   = generatedHoles[gameState.currentHole - 1] ?? generatedHoles[0] ?? staticHoles[0];
    const pos    = toCanvasCoords(e.touches[0], canvas, hole);
    computeAim(pos.x, pos.y);
    isAimingRef.current = true;
    setIsAiming(true);
  };

  const canvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isAimingRef.current) return;
    if (e.touches.length === 0) return;
    const canvas = canvasRef.current!;
    const hole   = generatedHoles[gameState.currentHole - 1] ?? generatedHoles[0] ?? staticHoles[0];
    const pos    = toCanvasCoords(e.touches[0], canvas, hole);
    computeAim(pos.x, pos.y);
  };

  const canvasTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isAimingRef.current) return;
    handleShot();
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const getTotalStrokes = (player: "player1" | "player2") =>
    Object.values(gameState.perHoleStrokes).reduce((s, h) => s + h[player], 0) +
    (gameState[player].holeComplete ? 0 : gameState[player].strokes);

  const currentHole = generatedHoles[gameState.currentHole - 1] ?? generatedHoles[0] ?? staticHoles[0];
  const isMyTurn    = match.isPractice || gameState.currentTurn === playerKey;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <GameLayout match={match} currentUserId={currentUserId} accentColor="#00e5b0" accentRgb="0,229,176" controls="Drag to aim & shoot" winCondition="Fewest strokes wins" showPills={false}>
      {/* Header */}
      <div className="border-b border-white/5 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3 max-w-5xl mx-auto gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/lobby")} data-testid="button-back-minigolf">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="font-bold text-lg font-display" style={{ color: "#00e5b0" }}>Mini Golf</h2>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                {gameState.isSuddenDeath ? (
                  <Badge variant="destructive" className="animate-pulse text-xs">
                    <Zap className="w-3 h-3 mr-1" /> Sudden Death
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs border-emerald-700 text-emerald-400">
                    <Flag className="w-3 h-3 mr-1" />
                    Hole {gameState.currentHole} / {gameState.totalHoles}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs border-white/10 text-white/60">
                  {currentHole.name}
                </Badge>
                <Badge variant="outline" className="text-xs border-amber-700 text-amber-400">
                  Par {currentHole.par}
                </Badge>
                {match.potAmount && parseFloat(match.potAmount) > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    <Trophy className="w-3 h-3 mr-1" />{match.potAmount} S
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Score strip */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-white/40">You</div>
              <div className="text-xl font-bold tabular-nums" style={{ color: "#00e5b0" }}>{getTotalStrokes(playerKey)}</div>
            </div>
            <div className="text-white/20 text-sm">vs</div>
            <div>
              <div className="text-xs text-white/40">Opp</div>
              <div className="text-xl font-bold tabular-nums text-white/70">
                {getTotalStrokes(playerKey === "player1" ? "player2" : "player1")}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 py-4">
        {/* Player turn indicator */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {(["player1", "player2"] as const).map((pk) => {
            const pl     = pk === "player1" ? match.player1 : match.player2;
            const active = gameState.currentTurn === pk;
            return (
              <div
                key={pk}
                className="flex items-center gap-2 rounded-xl px-3 py-2 transition-all"
                style={{
                  background: active ? "rgba(0,229,176,0.08)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? "rgba(0,229,176,0.4)" : "rgba(255,255,255,0.06)"}`,
                  boxShadow: active ? "0 0 20px rgba(0,229,176,0.1)" : "none",
                }}
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage src={pl?.profileImageUrl || undefined} style={{ objectFit: "cover" }} />
                  <AvatarFallback className="text-xs">
                    {pk === "player2" ? getBotOpponentInitial(match) : (pl?.firstName?.[0] ?? "P1")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: active ? "#00e5b0" : "#ffffff99" }}>
                    {pk === "player2" ? getBotOpponentName(match) : (pl?.firstName ?? "Player 1")}
                  </div>
                  <div className="text-xs text-white/40">{getTotalStrokes(pk)} strokes</div>
                </div>
                {active && (
                  <Badge variant="outline" className="text-xs border-emerald-700 text-emerald-400 shrink-0">
                    <ChevronRight className="w-3 h-3" /> Turn
                  </Badge>
                )}
              </div>
            );
          })}
        </div>

        {/* Status hint */}
        <div className="text-center mb-3 min-h-[20px]">
          {isAnimating ? (
            <p className="text-xs text-white/40">Ball in motion...</p>
          ) : match.status === "waiting" ? (
            <p className="text-xs text-white/40">Waiting for opponent...</p>
          ) : isMyTurn ? (
            <p className="text-xs" style={{ color: "#00e5b0" }}>
              {isAiming
                ? `Release to shoot · Power: ${Math.round(power)}%`
                : `Drag to aim · Strokes ${gameState[playerKey].strokes}/${MAX_STROKES_PER_HOLE}`}
            </p>
          ) : botStatus ? (
            <p className="text-xs animate-pulse" style={{ color: "#fbbf24" }}>{botStatus}</p>
          ) : (
            <p className="text-xs text-white/40">Opponent's turn...</p>
          )}
        </div>

        {/* Canvas */}
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex justify-center">
          <div className="relative rounded-2xl overflow-hidden"
            style={{ boxShadow: "0 0 60px rgba(0,229,176,0.08), 0 0 120px rgba(0,80,40,0.15)" }}>
            <canvas
              ref={canvasRef}
              width={currentHole.bounds.width}
              height={currentHole.bounds.height}
              className="block"
              style={{
                maxWidth: "100%",
                height: "auto",
                touchAction: "none",
                cursor: isMyTurn && !isAnimating ? "crosshair" : "default",
              }}
              onMouseDown={canvasMouseDown}
              onMouseMove={canvasMouseMove}
              onMouseUp={canvasMouseUp}
              onMouseLeave={() => {
                if (isAimingRef.current) {
                  isAimingRef.current = false;
                  setIsAiming(false);
                }
              }}
              onTouchStart={canvasTouchStart}
              onTouchMove={canvasTouchMove}
              onTouchEnd={canvasTouchEnd}
              data-testid="minigolf-canvas"
            />
          </div>
        </motion.div>

        {/* Controls legend */}
        <div className="flex justify-center gap-3 mt-3 flex-wrap px-2">
          <span className="text-[11px] text-white/30">
            <span className="text-white/50 font-medium">Desktop:</span> Click + drag to aim, release to shoot
          </span>
          <span className="text-[11px] text-white/30">
            <span className="text-white/50 font-medium">Mobile:</span> Touch + drag to aim, lift to shoot
          </span>
        </div>

        {/* Scorecard */}
        <div className="mt-6 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.3)" }}>
          <div className="px-4 py-2 text-xs font-semibold text-white/40 uppercase tracking-wider border-b border-white/5">
            Scorecard
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-2 text-white/40 font-normal text-xs">Player</th>
                  {generatedHoles.slice(0, gameState.totalHoles).map((h: HoleDefinition, i: number) => (
                    <th key={i} className={`text-center px-2 py-2 text-xs font-normal ${i + 1 === gameState.currentHole ? "text-emerald-400" : "text-white/30"}`}>
                      {i + 1}
                    </th>
                  ))}
                  <th className="text-center px-3 py-2 text-white/50 font-semibold text-xs">Total</th>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-1.5 text-white/25 text-xs">Par</td>
                  {generatedHoles.slice(0, gameState.totalHoles).map((h: HoleDefinition, i: number) => (
                    <td key={i} className="text-center text-white/25 text-xs">{h.par}</td>
                  ))}
                  <td className="text-center text-white/30 text-xs font-semibold">
                    {generatedHoles.slice(0, gameState.totalHoles).reduce((s: number, h: HoleDefinition) => s + h.par, 0)}
                  </td>
                </tr>
              </thead>
              <tbody>
                {(["player1", "player2"] as const).map((pk) => {
                  const pl = pk === "player1" ? match.player1 : match.player2;
                  const isMe = pk === playerKey;
                  return (
                    <tr key={pk} className={isMe ? "bg-emerald-900/10" : ""}>
                      <td className="px-4 py-2 text-xs font-medium" style={{ color: isMe ? "#00e5b0" : "#ffffff60" }}>
                        {pl?.firstName ?? (pk === "player1" ? "P1" : "P2")}{isMe ? " (you)" : ""}
                      </td>
                      {generatedHoles.slice(0, gameState.totalHoles).map((_: HoleDefinition, i: number) => {
                        const hn    = i + 1;
                        const strokes = gameState.perHoleStrokes[hn]?.[pk];
                        const par     = generatedHoles[i]?.par ?? 3;
                        const isCurrent = hn === gameState.currentHole && !gameState.perHoleStrokes[hn];
                        const live = isCurrent && gameState[pk].strokes > 0 ? gameState[pk].strokes : null;
                        const val  = strokes ?? live;
                        const diff = val != null ? val - par : null;
                        return (
                          <td key={i} className="text-center py-2 text-xs">
                            {val != null ? (
                              <span style={{ color: diff === null ? "white" : diff < 0 ? "#22ff88" : diff === 0 ? "#60a5fa" : "#f87171" }}>
                                {val}
                              </span>
                            ) : (
                              <span className="text-white/20">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="text-center py-2 text-xs font-bold" style={{ color: isMe ? "#00e5b0" : "#ffffff80" }}>
                        {getTotalStrokes(pk)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Water penalty overlay */}
      <AnimatePresence>
        {showWaterPenalty && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: -20 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
          >
            <div className="text-center">
              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ repeat: 2, duration: 0.4 }}
                className="text-4xl font-black font-display"
                style={{
                  background: "linear-gradient(135deg, #4dd0fb, #0ea5e9, #4dd0fb)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 0 20px rgba(77,208,251,0.7))",
                }}
              >
                SPLASH!
              </motion.div>
              <div className="text-white/70 text-base mt-1 font-semibold tracking-wide">
                Water Penalty +1
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hole summary overlay */}
      <AnimatePresence>
        {holeSummary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 px-4"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
            onClick={() => setHoleSummary(null)}
            data-testid="hole-summary-overlay"
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 20 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="w-full max-w-sm rounded-2xl p-5"
              style={{
                background: "linear-gradient(160deg, rgba(8,16,12,0.95) 0%, rgba(0,40,28,0.95) 100%)",
                border: "1px solid rgba(0,229,176,0.35)",
                boxShadow: "0 0 60px rgba(0,229,176,0.25)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-4">
                <div className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-400/80">Hole {holeSummary.holeNumber} Complete</div>
                <div className="text-[11px] text-white/40 mt-0.5">Par {holeSummary.par}</div>
              </div>
              <div className="space-y-2 mb-4">
                {(["player1", "player2"] as const).map((pk) => {
                  const isMe = pk === playerKey;
                  const strokes = pk === "player1" ? holeSummary.player1Strokes : holeSummary.player2Strokes;
                  const name = pk === "player2"
                    ? (match.isBotMatch ? getBotOpponentName(match) : match.player2?.firstName ?? "Player 2")
                    : (match.player1?.firstName ?? "Player 1");
                  const isWinner = holeSummary.winner === pk;
                  const diff = strokes - holeSummary.par;
                  return (
                    <div
                      key={pk}
                      className="flex items-center justify-between rounded-lg px-3 py-2"
                      style={{
                        background: isWinner ? "rgba(0,229,176,0.12)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${isWinner ? "rgba(0,229,176,0.4)" : "rgba(255,255,255,0.06)"}`,
                      }}
                      data-testid={`hole-summary-row-${pk}`}
                    >
                      <div className="text-sm font-medium" style={{ color: isMe ? "#00e5b0" : "#fff" }}>
                        {name}{isMe ? " (you)" : ""}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/40">{diff === 0 ? "E" : diff > 0 ? `+${diff}` : diff}</span>
                        <span className="text-lg font-black tabular-nums" style={{ color: isWinner ? "#00e5b0" : "#fff" }}>
                          {strokes}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-center text-xs text-white/50 mb-3">
                {holeSummary.winner === "tie"
                  ? "Hole tied"
                  : holeSummary.winner === playerKey
                    ? "You won the hole!"
                    : "Opponent won the hole"}
              </div>
              <div className="text-center text-[11px] text-white/40 mb-3">
                Running total — You {getTotalStrokes(playerKey)} · Opp {getTotalStrokes(playerKey === "player1" ? "player2" : "player1")}
              </div>
              <Button
                onClick={() => setHoleSummary(null)}
                className="w-full"
                variant="default"
                data-testid="button-next-hole"
              >
                {gameState.isMatchComplete ? "View Results" : "Next Hole"}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hole-in overlay */}
      <AnimatePresence>
        {showHoleIn && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -40 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 0.7 }}
                className="text-6xl font-black font-display"
                style={{
                  background: "linear-gradient(135deg, #00e5b0, #22ff88, #00e5b0)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 0 30px rgba(0,229,176,0.6))",
                }}
              >
                HOLE!
              </motion.div>
              <div className="text-white/60 text-lg mt-1">Ball in the cup!</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GameLayout>
  );
}
