import { useEffect, useRef, useState, useCallback } from "react";
import MatchIntroAnimation from "@/components/MatchIntroAnimation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, RotateCcw, ChevronLeft, ChevronRight, Zap, Target, MoveHorizontal, Crosshair } from "lucide-react";
import { GameHUD, emitFeedEvent, EventFeed } from "@/components/games/GameHUD";
import { GameLayout } from "@/components/games/GameLayout";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { MatchWithPlayers } from "@shared/schema";
import { getBotOpponentName } from "@/lib/botMatchUtils";
import {
  type BowlingGameState,
  createInitialState,
  executeBowl,
  simulatePhysics,
  createPins,
  LANE_WIDTH,
  LANE_LENGTH,
  PIN_RADIUS,
  BALL_RADIUS,
} from "@shared/bowlingEngine";
import { soundManager } from "@/lib/soundManager";

interface Props {
  match: MatchWithPlayers;
  currentUserId?: string;
}

// ── Canvas / perspective constants ─────────────────────────────────────────
const CV_W = 520;
const CV_H = 720;
const CENTER_X = CV_W / 2;
const FAR_Y = 68;         // canvas y for pin end (far)
const NEAR_Y = 650;       // canvas y for foul line (near)
const FAR_HW = 58;        // half-lane width at pins (px)
const NEAR_HW = 200;      // half-lane width at foul line (px)

// World: ball starts at y=1100, moves toward pins at y=200
// t=0 → far (pins), t=1 → near (bowler)
function worldToCanvas(wx: number, wy: number): { x: number; y: number; scale: number } {
  const t = Math.max(0, Math.min(1, (wy - 200) / 900)); // 0=pins, 1=foul
  const sy = FAR_Y + (NEAR_Y - FAR_Y) * t;
  const hw = FAR_HW + (NEAR_HW - FAR_HW) * t;
  const sx = CENTER_X + ((wx - 400) / 400) * hw;
  const scale = FAR_HW / NEAR_HW + (1 - FAR_HW / NEAR_HW) * t;
  return { x: sx, y: sy, scale };
}

function perspScale(wy: number): number {
  const t = Math.max(0, Math.min(1, (wy - 200) / 900));
  return 0.28 + 0.72 * t;
}

export default function BowlingGame({ match, currentUserId }: Props) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const rafRef = useRef<number>();
  const shakeRef = useRef({ x: 0, y: 0, intensity: 0 });
  const prevKnockedRef = useRef(0);
  const flashTimerRef = useRef<NodeJS.Timeout>();

  const [showIntro, setShowIntro] = useState(true);
  const [gameState, setGameState] = useState<BowlingGameState>(() =>
    (match.gameState as any)?.pins ? (match.gameState as BowlingGameState) : createInitialState()
  );
  // ── Phase-based shot system ──────────────────────────────────────────────
  type ShotPhase = "position" | "aim" | "power" | "effect";
  const [shotPhase, setShotPhase] = useState<ShotPhase>("position");
  const [bowlerOffset, setBowlerOffset] = useState(0);  // world X offset -150..+150
  const [aim, setAim] = useState(0);        // -1 to +1 (left to right)
  const [spin, setSpin] = useState(0);       // set from effectPct at fire time
  const [powerPct, setPowerPct] = useState(50);
  const [powerDir, setPowerDir] = useState(1);
  const [powerRunning, setPowerRunning] = useState(false);
  const [effectPct, setEffectPct] = useState(50);       // 0=R-hook, 50=straight, 100=L-hook
  const [effectDir, setEffectDir] = useState(1);
  const [effectRunning, setEffectRunning] = useState(false);
  const [flashLabel, setFlashLabel] = useState<"STRIKE" | "SPARE" | null>(null);
  const [flashOpacity, setFlashOpacity] = useState(0);

  // Reset phase each time it becomes my turn
  const prevTurnRef = useRef<string | null>(null);

  const isPlayer1 = match.player1Id === currentUserId;
  const isMyTurn = match.isPractice
    || (gameState.currentPlayer === "player1" && isPlayer1)
    || (gameState.currentPlayer === "player2" && !isPlayer1);
  // ── Sync state from server (PvP) ─────────────────────────────────────────
  useEffect(() => {
    if ((match.gameState as any)?.pins) {
      setGameState(match.gameState as BowlingGameState);
    }
  }, [match.gameState]);

  // ── Power timing bar oscillation ─────────────────────────────────────────
  useEffect(() => {
    if (!powerRunning) return;
    const speed = 1.8; // pct per tick
    const interval = setInterval(() => {
      setPowerPct(prev => {
        let next = prev + powerDir * speed;
        if (next >= 100) { setPowerDir(-1); next = 100; }
        if (next <= 0) { setPowerDir(1); next = 0; }
        return next;
      });
    }, 16);
    return () => clearInterval(interval);
  }, [powerRunning, powerDir]);

  // ── Effect (spin) oscillation ─────────────────────────────────────────────
  useEffect(() => {
    if (!effectRunning) return;
    const speed = 2.2;
    const interval = setInterval(() => {
      setEffectPct(prev => {
        let next = prev + effectDir * speed;
        if (next >= 100) { setEffectDir(-1); next = 100; }
        if (next <= 0)   { setEffectDir(1);  next = 0;   }
        return next;
      });
    }, 16);
    return () => clearInterval(interval);
  }, [effectRunning, effectDir]);

  // ── Reset shot phase when turn changes ────────────────────────────────────
  useEffect(() => {
    const cur = gameState.currentPlayer;
    if (cur !== prevTurnRef.current && isMyTurn && !gameState.simulationRunning && !gameState.gameOver) {
      setShotPhase("position");
      setBowlerOffset(0);
      setAim(0);
      setPowerPct(50);
      setEffectPct(50);
      setPowerRunning(false);
      setEffectRunning(false);
    }
    prevTurnRef.current = cur;
  }, [gameState.currentPlayer, isMyTurn, gameState.simulationRunning, gameState.gameOver]);

  // ── Keyboard controls for phase system ────────────────────────────────────
  useEffect(() => {
    if (!isMyTurn || gameState.simulationRunning || gameState.gameOver) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        if (shotPhase === "position") setBowlerOffset(p => Math.max(-150, p - 20));
        if (shotPhase === "aim")      setAim(p => Math.max(-1, p - 0.08));
      }
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        if (shotPhase === "position") setBowlerOffset(p => Math.min(150, p + 20));
        if (shotPhase === "aim")      setAim(p => Math.min(1, p + 0.08));
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handlePhaseAdvance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurn, gameState.simulationRunning, gameState.gameOver, shotPhase]);

  // ── Local physics loop ────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameState.simulationRunning) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      setGameState(prev => {
        if (!prev.simulationRunning) return prev;
        let next = prev;
        for (let i = 0; i < 4; i++) {
          if (next.simulationRunning) next = simulatePhysics(next);
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [gameState.simulationRunning]);

  // ── Screen shake + strike/spare flash ────────────────────────────────────
  useEffect(() => {
    const knocked = gameState.pinsKnockedThisRoll;
    if (knocked > prevKnockedRef.current) {
      const delta = knocked - prevKnockedRef.current;
      shakeRef.current.intensity = Math.min(delta * 1.2, 8);
      if (delta >= 3) soundManager.playMove();
    }
    prevKnockedRef.current = knocked;
  }, [gameState.pinsKnockedThisRoll]);

  useEffect(() => {
    if (gameState.strikeFlash) {
      soundManager.playWin();
      triggerFlash("STRIKE");
    } else if (gameState.spareFlash) {
      soundManager.playNotification();
      triggerFlash("SPARE");
    }
  }, [gameState.strikeFlash, gameState.spareFlash]);

  function triggerFlash(label: "STRIKE" | "SPARE") {
    setFlashLabel(label);
    setFlashOpacity(1);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    // Hold at full opacity for 1s, then fade out over 0.8s
    flashTimerRef.current = setTimeout(() => {
      const startTime = Date.now();
      const fadeOut = () => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 1 - elapsed / 800);
        setFlashOpacity(remaining);
        if (remaining > 0) {
          flashTimerRef.current = setTimeout(fadeOut, 16);
        } else {
          setFlashLabel(null);
        }
      };
      fadeOut();
    }, 1000);
  }

  // ── WebSocket ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (match.isPractice) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    ws.onopen = () => ws.send(JSON.stringify({ type: "join", matchId: match.id, userId: currentUserId }));
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.type === "bowling-move" && d.matchId === match.id) setGameState(d.gameState);
    };
    wsRef.current = ws;
    return () => ws.close();
  }, [match.id, match.isPractice, currentUserId]);

  // ── Bot moves ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (match.isPractice || !match.isBotMatch || match.status !== "in-progress") return;
    if (gameState.gameOver || gameState.simulationRunning) return;
    const botPlayer = isPlayer1 ? "player2" : "player1";
    if (gameState.currentPlayer !== botPlayer) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/matches/${match.id}/bot-move`, {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        });
        if (res.ok) {
          const d = await res.json();
          if (d.move?.gameState) setGameState(d.move.gameState);
        }
      } catch {}
    }, 1200);
    return () => clearTimeout(timer);
  }, [match.isBotMatch, match.isPractice, match.status, match.id, gameState.currentPlayer,
      gameState.gameOver, gameState.simulationRunning, isPlayer1]);

  // ── Canvas rendering ──────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Screen shake decay
    const sk = shakeRef.current;
    if (sk.intensity > 0.1) {
      sk.x = (Math.random() - 0.5) * sk.intensity;
      sk.y = (Math.random() - 0.5) * sk.intensity;
      sk.intensity *= 0.85;
    } else {
      sk.x = 0; sk.y = 0; sk.intensity = 0;
    }

    ctx.clearRect(0, 0, CV_W, CV_H);
    ctx.save();
    ctx.translate(sk.x, sk.y);

    // ── Background ──────────────────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, 0, CV_H);
    bg.addColorStop(0, "#070710");
    bg.addColorStop(1, "#0d0d1c");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CV_W, CV_H);

    // Ambient glow above pins
    const ambGlow = ctx.createRadialGradient(CENTER_X, FAR_Y + 40, 0, CENTER_X, FAR_Y + 40, 180);
    ambGlow.addColorStop(0, "rgba(180,140,255,0.10)");
    ambGlow.addColorStop(1, "transparent");
    ctx.fillStyle = ambGlow;
    ctx.fillRect(0, 0, CV_W, CV_H);

    // ── Draw perspective lane ───────────────────────────────────────────────
    // Perspective lane corners
    const tl = { x: CENTER_X - FAR_HW, y: FAR_Y };
    const tr = { x: CENTER_X + FAR_HW, y: FAR_Y };
    const bl = { x: CENTER_X - NEAR_HW, y: NEAR_Y };
    const br = { x: CENTER_X + NEAR_HW, y: NEAR_Y };

    // Gutters (outer area)
    const gutterW = 34;
    ctx.fillStyle = "#0a0a12";
    ctx.beginPath();
    ctx.moveTo(tl.x - gutterW * (FAR_HW / NEAR_HW), FAR_Y);
    ctx.lineTo(tl.x, FAR_Y);
    ctx.lineTo(bl.x, NEAR_Y);
    ctx.lineTo(bl.x - gutterW, NEAR_Y);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tr.x + gutterW * (FAR_HW / NEAR_HW), FAR_Y);
    ctx.lineTo(tr.x, FAR_Y);
    ctx.lineTo(br.x, NEAR_Y);
    ctx.lineTo(br.x + gutterW, NEAR_Y);
    ctx.closePath();
    ctx.fill();

    // Gutter edge lines
    ctx.strokeStyle = "rgba(100,75,40,0.25)";
    ctx.lineWidth = 1;
    for (const [ax, ay, bx, by] of [
      [tl.x - gutterW * 0.29, FAR_Y, bl.x - gutterW, NEAR_Y] as [number, number, number, number],
      [tr.x + gutterW * 0.29, FAR_Y, br.x + gutterW, NEAR_Y] as [number, number, number, number],
    ]) {
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }

    // Lane wood base
    const laneGrad = ctx.createLinearGradient(tl.x, 0, tr.x, 0);
    laneGrad.addColorStop(0, "#5a3d18");
    laneGrad.addColorStop(0.12, "#7a5528");
    laneGrad.addColorStop(0.5, "#9a7540");
    laneGrad.addColorStop(0.88, "#7a5528");
    laneGrad.addColorStop(1, "#5a3d18");
    ctx.fillStyle = laneGrad;
    ctx.beginPath();
    ctx.moveTo(tl.x, FAR_Y); ctx.lineTo(tr.x, FAR_Y);
    ctx.lineTo(br.x, NEAR_Y); ctx.lineTo(bl.x, NEAR_Y);
    ctx.closePath();
    ctx.fill();

    // Wood plank lines (perspective-correct)
    const plankCount = 12;
    ctx.strokeStyle = "rgba(45,28,10,0.22)";
    ctx.lineWidth = 1;
    for (let i = 1; i < plankCount; i++) {
      const frac = i / plankCount;
      const farX = tl.x + (tr.x - tl.x) * frac;
      const nearX = bl.x + (br.x - bl.x) * frac;
      ctx.beginPath();
      ctx.moveTo(farX, FAR_Y);
      ctx.lineTo(nearX, NEAR_Y);
      ctx.stroke();
    }

    // Overhead spotlight (warmth over pin deck area)
    const spot = ctx.createRadialGradient(CENTER_X, FAR_Y + 80, 0, CENTER_X, FAR_Y + 80, 160);
    spot.addColorStop(0, "rgba(255,230,170,0.14)");
    spot.addColorStop(1, "transparent");
    ctx.fillStyle = spot;
    ctx.beginPath();
    ctx.moveTo(tl.x, FAR_Y); ctx.lineTo(tr.x, FAR_Y);
    ctx.lineTo(br.x, NEAR_Y); ctx.lineTo(bl.x, NEAR_Y);
    ctx.closePath();
    ctx.fill();

    // Lane reflection shimmer (subtle)
    const shimmer = ctx.createLinearGradient(0, NEAR_Y, 0, FAR_Y);
    shimmer.addColorStop(0, "rgba(255,255,255,0.03)");
    shimmer.addColorStop(0.5, "rgba(255,255,255,0.07)");
    shimmer.addColorStop(1, "rgba(255,255,255,0.01)");
    ctx.fillStyle = shimmer;
    ctx.beginPath();
    ctx.moveTo(tl.x, FAR_Y); ctx.lineTo(tr.x, FAR_Y);
    ctx.lineTo(br.x, NEAR_Y); ctx.lineTo(bl.x, NEAR_Y);
    ctx.closePath();
    ctx.fill();

    // Oil pattern overlay (front 40% of lane looks shinier/lighter)
    const oilT = 0.6; // lane fraction that's oiled
    const oilFarY = FAR_Y + (NEAR_Y - FAR_Y) * (1 - oilT);
    const oilFarL = CENTER_X - (FAR_HW + (NEAR_HW - FAR_HW) * (1 - oilT));
    const oilFarR = CENTER_X + (FAR_HW + (NEAR_HW - FAR_HW) * (1 - oilT));
    const oilGrad = ctx.createLinearGradient(0, oilFarY, 0, NEAR_Y);
    oilGrad.addColorStop(0, "rgba(200,220,255,0)");
    oilGrad.addColorStop(1, "rgba(200,220,255,0.06)");
    ctx.fillStyle = oilGrad;
    ctx.beginPath();
    ctx.moveTo(oilFarL, oilFarY); ctx.lineTo(oilFarR, oilFarY);
    ctx.lineTo(br.x, NEAR_Y); ctx.lineTo(bl.x, NEAR_Y);
    ctx.closePath();
    ctx.fill();

    // Approach dots (5 dots near foul line)
    const dotsWorldY = 1020;
    const dotPositions = [-150, -75, 0, 75, 150];
    for (const dx of dotPositions) {
      const dp = worldToCanvas(400 + dx, dotsWorldY);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.arc(dp.x, dp.y, 3.5 * dp.scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // Arrow targeting markers (7 arrows at y≈700)
    const arrowWorldY = 700;
    const arrowOffsets = [-225, -150, -75, 0, 75, 150, 225];
    for (const ax of arrowOffsets) {
      const ap = worldToCanvas(400 + ax, arrowWorldY);
      const s = ap.scale;
      ctx.fillStyle = "rgba(210,175,90,0.22)";
      ctx.beginPath();
      ctx.moveTo(ap.x, ap.y - 7 * s);
      ctx.lineTo(ap.x - 4 * s, ap.y + 4 * s);
      ctx.lineTo(ap.x + 4 * s, ap.y + 4 * s);
      ctx.closePath();
      ctx.fill();
    }

    // Foul line (neon red glow)
    const flP = worldToCanvas(0, LANE_LENGTH - 100);
    const flP2 = worldToCanvas(LANE_WIDTH, LANE_LENGTH - 100);
    ctx.save();
    ctx.shadowColor = "rgba(255,60,60,0.8)";
    ctx.shadowBlur = 10;
    ctx.strokeStyle = "rgba(255,80,80,0.85)";
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(flP.x, flP.y); ctx.lineTo(flP2.x, flP2.y); ctx.stroke();
    ctx.restore();

    // Lane edge lines (neon trim)
    ctx.save();
    ctx.strokeStyle = "rgba(180,135,70,0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tl.x, FAR_Y); ctx.lineTo(bl.x, NEAR_Y);
    ctx.moveTo(tr.x, FAR_Y); ctx.lineTo(br.x, NEAR_Y);
    ctx.stroke();
    ctx.restore();

    // ── Aim trajectory ──────────────────────────────────────────────────────
    if (!gameState.simulationRunning && isMyTurn && !gameState.gameOver) {
      drawAimGuide(ctx);
    }

    // ── Pins ────────────────────────────────────────────────────────────────
    // Sort pins by y (world) ascending so farther pins draw first (painter's algorithm)
    const sortedPins = [...gameState.pins].sort((a, b) => a.y - b.y);
    for (const pin of sortedPins) {
      const { x: px, y: py, scale: ps } = worldToCanvas(pin.x, pin.y);
      const pr = PIN_RADIUS * ps * 1.3;

      if (pin.standing) {
        // Shadow
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.beginPath();
        ctx.ellipse(px + 1.5, py + pr * 0.55, pr * 0.9, pr * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Pin body 3D gradient
        const pg = ctx.createRadialGradient(px - pr * 0.22, py - pr * 0.28, pr * 0.08, px, py, pr);
        pg.addColorStop(0, "#ffffff");
        pg.addColorStop(0.55, "#f0ede6");
        pg.addColorStop(0.9, "#d4cfc6");
        pg.addColorStop(1, "#b8b0a0");
        ctx.fillStyle = pg;
        ctx.shadowColor = "rgba(0,0,0,0.2)";
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Red stripe
        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = "rgba(200,30,30,0.65)";
        ctx.fillRect(px - pr, py - pr * 0.18, pr * 2, pr * 0.36);
        ctx.restore();

        // Specular
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath();
        ctx.arc(px - pr * 0.2, py - pr * 0.28, pr * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Edge
        ctx.strokeStyle = "rgba(0,0,0,0.1)";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Knocked pin: faded ring on floor
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = "#aaa";
        ctx.beginPath();
        ctx.ellipse(px, py + pr * 0.5, pr * 1.1, pr * 0.35, pin.angle, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // ── Ball ────────────────────────────────────────────────────────────────
    if (gameState.ball) {
      const { ball } = gameState;
      const { x: bx, y: by, scale: bs } = worldToCanvas(ball.x, ball.y);
      const br2 = BALL_RADIUS * bs * 1.35;

      // Ball shadow
      ctx.save();
      ctx.globalAlpha = 0.4;
      const shG = ctx.createRadialGradient(bx + 2, by + br2 * 0.6, 0, bx + 2, by + br2 * 0.6, br2 * 1.4);
      shG.addColorStop(0, "rgba(0,0,0,0.7)");
      shG.addColorStop(1, "transparent");
      ctx.fillStyle = shG;
      ctx.beginPath();
      ctx.ellipse(bx + 3, by + br2 * 0.5, br2 * 1.3, br2 * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Ball body
      const ballG = ctx.createRadialGradient(bx - br2 * 0.32, by - br2 * 0.32, br2 * 0.05, bx, by, br2);
      ballG.addColorStop(0, "#4e5a9a");
      ballG.addColorStop(0.35, "#1e2860");
      ballG.addColorStop(0.8, "#0d1435");
      ballG.addColorStop(1, "#05080e");
      ctx.fillStyle = ballG;
      ctx.shadowColor = "rgba(60,90,255,0.3)";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(bx, by, br2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Spin visual: rotating finger holes
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(ball.rotation * (ball.spin >= 0 ? 1 : -1) + ball.rotation);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath(); ctx.arc(-br2 * 0.22, -br2 * 0.28, br2 * 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(br2 * 0.22, -br2 * 0.28, br2 * 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, br2 * 0.12, br2 * 0.13, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Specular highlight
      const specG = ctx.createRadialGradient(bx - br2 * 0.3, by - br2 * 0.32, 0, bx - br2 * 0.3, by - br2 * 0.3, br2 * 0.55);
      specG.addColorStop(0, "rgba(255,255,255,0.45)");
      specG.addColorStop(1, "transparent");
      ctx.fillStyle = specG;
      ctx.beginPath(); ctx.arc(bx, by, br2, 0, Math.PI * 2); ctx.fill();

      // Speed streak
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      if (speed > 6) {
        const streak = Math.min((speed - 6) / 14, 1);
        const { x: tx, y: ty } = worldToCanvas(ball.x - ball.vx * 6, ball.y - ball.vy * 6);
        const streakG = ctx.createLinearGradient(tx, ty, bx, by);
        streakG.addColorStop(0, "transparent");
        streakG.addColorStop(1, `rgba(80,100,220,${streak * 0.5})`);
        ctx.strokeStyle = streakG;
        ctx.lineWidth = br2 * 1.4;
        ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(bx, by); ctx.stroke();
      }
    }

    // ── Lane edge panel (alley) ─────────────────────────────────────────────
    // Pin deck backdrop
    const deckY = FAR_Y - 18;
    ctx.fillStyle = "#080810";
    ctx.fillRect(0, 0, CV_W, deckY + 4);

    // Neon strip at top (pin deck)
    const neonG = ctx.createLinearGradient(tl.x, 0, tr.x, 0);
    neonG.addColorStop(0, "transparent");
    neonG.addColorStop(0.25, "rgba(140,80,255,0.6)");
    neonG.addColorStop(0.75, "rgba(80,140,255,0.6)");
    neonG.addColorStop(1, "transparent");
    ctx.fillStyle = neonG;
    ctx.fillRect(tl.x, FAR_Y - 5, tr.x - tl.x, 5);

    ctx.restore(); // end shake transform

    // ── Strike/Spare flash overlay ──────────────────────────────────────────
    if (flashLabel && flashOpacity > 0) {
      const isStrike = flashLabel === "STRIKE";
      const fc = isStrike ? "rgba(255,210,30," : "rgba(100,220,255,";
      ctx.save();
      ctx.globalAlpha = flashOpacity * 0.18;
      ctx.fillStyle = isStrike ? "#ffaa00" : "#44aaff";
      ctx.fillRect(0, 0, CV_W, CV_H);
      ctx.globalAlpha = 1;

      ctx.font = `bold ${isStrike ? 64 : 52}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = isStrike ? "#ffaa00" : "#44aaff";
      ctx.shadowBlur = 40;
      ctx.fillStyle = isStrike ? "#ffdd44" : "#88eeff";
      ctx.globalAlpha = Math.min(flashOpacity, 1);
      ctx.fillText(flashLabel, CV_W / 2, CV_H / 2 - 30);
      if (isStrike) {
        ctx.font = "bold 20px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.shadowBlur = 16;
        ctx.fillText("PERFECT ROLL!", CV_W / 2, CV_H / 2 + 30);
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // ── Game over overlay ────────────────────────────────────────────────────
    if (gameState.gameOver && gameState.winner) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.72)";
      ctx.fillRect(0, 0, CV_W, CV_H);

      const wColor = gameState.winner === "player1" ? "#ff2d8a"
        : gameState.winner === "player2" ? "#44aaff" : "#ffcc44";
      const wLabel = gameState.winner === "tie" ? "TIE GAME!"
        : gameState.winner === "player1"
          ? `${match.player1?.firstName || "P1"} WINS!`
          : `${getBotOpponentName(match)} WINS!`;

      ctx.font = "bold 38px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = wColor;
      ctx.shadowColor = wColor;
      ctx.shadowBlur = 30;
      ctx.fillText(wLabel, CV_W / 2, CV_H / 2 - 28);

      ctx.font = "bold 18px sans-serif";
      ctx.fillStyle = "#ddd";
      ctx.shadowBlur = 0;
      ctx.fillText(
        `${gameState.player1TotalScore} — ${gameState.player2TotalScore}`,
        CV_W / 2, CV_H / 2 + 16
      );
      ctx.restore();
    }

  }, [gameState, aim, spin, isMyTurn, flashLabel, flashOpacity]);

  // Aim guide helper (called from render)
  function drawAimGuide(ctx: CanvasRenderingContext2D) {
    const startWorldX = 400 + aim * 100; // aim: -1..1 maps to ±100 world units
    const startWorldY = LANE_LENGTH - 110;
    const startP = worldToCanvas(startWorldX, startWorldY);

    // Simulate straight + hook trajectory for visual guide
    const angleRad = Math.atan2(aim * 0.35, 1) * 0.6;
    const vx0 = Math.sin(angleRad) * 18;
    const vy0 = -Math.cos(angleRad) * 18;

    let wx = startWorldX, wy = startWorldY;
    let bvx = vx0, bvy = vy0;

    const points: [number, number, number][] = [];
    for (let s = 0; s < 80; s++) {
      const hookM = wy > 800 ? 0 : wy > 400 ? (800 - wy) / 400 * 0.6 : 0.6;
      bvx += -spin * hookM * 0.16;
      bvx *= 0.988; bvy *= 0.988;
      wx += bvx; wy += bvy;
      if (wy < 150) break;
      const p = worldToCanvas(wx, wy);
      points.push([p.x, p.y, p.scale]);
    }

    if (points.length < 2) return;

    // Draw dashed gradient guide line
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.lineCap = "round";
    for (let i = 1; i < points.length; i++) {
      const alpha = (1 - i / points.length) * 0.65;
      ctx.strokeStyle = `rgba(100,255,150,${alpha})`;
      ctx.lineWidth = points[i][2] * 3.5;
      ctx.shadowColor = "rgba(80,255,130,0.5)";
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.moveTo(points[i - 1][0], points[i - 1][1]);
      ctx.lineTo(points[i][0], points[i][1]);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    // Start dot
    ctx.fillStyle = "rgba(100,255,150,0.9)";
    ctx.shadowColor = "rgba(100,255,150,0.8)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(startP.x, startP.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── Bowl action ───────────────────────────────────────────────────────────
  const handleBowl = async (finalPower: number, finalSpin: number) => {
    if (gameState.simulationRunning || !isMyTurn || gameState.gameOver) return;
    soundManager.playClick();

    const angle = aim * 22; // map aim -1..1 to ±22 degree lane angle
    const speed = Math.max(30, finalPower);

    if (match.isPractice) {
      const newState = executeBowl(gameState, angle, speed, finalSpin);
      setGameState(newState);
    } else if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "bowling-move", matchId: match.id, angle, speed, spin: finalSpin }));
    } else {
      try {
        const res = await fetch(`/api/matches/${match.id}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ angle, speed, spin: finalSpin }),
        });
        if (res.ok) {
          const d = await res.json();
          if (d.gameState) setGameState(d.gameState);
        }
      } catch {}
    }
    // Reset for next roll
    setShotPhase("position");
    setPowerRunning(false);
    setEffectRunning(false);
    setPowerPct(50);
    setEffectPct(50);
    setAim(0);
    setBowlerOffset(0);
  };

  // ── Phase advance (Space / button click) ─────────────────────────────────
  const handlePhaseAdvance = () => {
    if (!isMyTurn || gameState.simulationRunning || gameState.gameOver) return;
    if (shotPhase === "position") {
      setShotPhase("aim");
    } else if (shotPhase === "aim") {
      setShotPhase("power");
      setPowerPct(50);
      setPowerDir(1);
      setPowerRunning(true);
    } else if (shotPhase === "power") {
      setPowerRunning(false);
      setShotPhase("effect");
      setEffectPct(50);
      setEffectDir(1);
      setEffectRunning(true);
    } else if (shotPhase === "effect") {
      setEffectRunning(false);
      const lockedSpin = (effectPct / 100) * 2 - 1; // 0→-1 (R-hook), 50→0, 100→+1 (L-hook)
      setSpin(lockedSpin);
      handleBowl(powerPct, lockedSpin);
    }
  };

  const p1Name = match.player1?.firstName || "Player 1";
  const p2Name = getBotOpponentName(match);
  const myFrames = isPlayer1 ? gameState.player1Frames : gameState.player2Frames;
  const oppFrames = isPlayer1 ? gameState.player2Frames : gameState.player1Frames;
  const myScore = isPlayer1 ? gameState.player1TotalScore : gameState.player2TotalScore;
  const oppScore = isPlayer1 ? gameState.player2TotalScore : gameState.player1TotalScore;
  const curFrame = gameState.currentFrame;

  return (
    <GameLayout match={match} currentUserId={currentUserId} accentColor="#f59e0b" accentRgb="245,158,11" showPills={false} className="flex flex-col">
      {showIntro && (
        <MatchIntroAnimation
          playerOneName={p1Name}
          playerTwoName={p2Name}
          playerOneImage={match.player1?.profileImageUrl}
          playerTwoImage={match.isBotMatch ? undefined : match.player2?.profileImageUrl}
          playerOneStake={parseFloat(match.betAmount || "0")}
          playerTwoStake={parseFloat(match.betAmount || "0")}
          isPractice={!!(match.isPractice)}
          isBotMatch={!!(match.isBotMatch)}
          gameLabel="Bowling"
          winCondition="Highest score after 10 frames"
          timeLimit="30s per throw"
          disconnectPolicy="5-min reconnect window"
          onComplete={() => setShowIntro(false)}
        />
      )}
      {/* Premium HUD */}
      <div className="px-3 pt-2">
        <GameHUD
          match={match}
          currentUserId={currentUserId}
          leftScore={gameState.player1TotalScore}
          rightScore={gameState.player2TotalScore}
          activePlayer={gameState.gameOver ? null : (isMyTurn ? "left" : "right")}
          leftLabel={
            gameState.gameOver ? undefined
            : isMyTurn ? `Frame ${curFrame} · Your turn`
            : "Waiting..."
          }
          rightLabel={
            gameState.gameOver ? undefined
            : !isMyTurn ? `Frame ${curFrame} · Throwing`
            : "Waiting..."
          }
        />
      </div>
      {/* Event feed overlay */}
      <div className="fixed bottom-24 right-4 z-40 pointer-events-none">
        <EventFeed />
      </div>

      {/* Header */}
      <div className="border-b bg-card shrink-0">
        <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="button-back-bowling">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="text-xl font-bold">Bowling</h2>
              <Badge variant={match.status === "in-progress" ? "default" : "secondary"} className="text-xs">
                Frame {Math.min(curFrame + 1, 10)} / 10
              </Badge>
            </div>
          </div>

          {/* Score strip */}
          <div className="flex items-center gap-4">
            {[
              { name: p1Name, score: gameState.player1TotalScore, img: match.player1?.profileImageUrl, isP1: true },
              { name: p2Name, score: gameState.player2TotalScore, img: match.player2?.profileImageUrl, isP1: false },
            ].map(({ name, score, img, isP1 }) => (
              <div key={name} className="flex items-center gap-2">
                <Avatar className="w-7 h-7">
                  <AvatarImage src={img || undefined} />
                  <AvatarFallback className="text-xs">{name[0]}</AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">{name}</div>
                  <div className={`font-mono text-sm font-bold ${isP1 ? "text-pink-400" : "text-blue-400"}`}>{score}</div>
                </div>
                {gameState.currentPlayer === (isP1 ? "player1" : "player2") && !gameState.gameOver && (
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-5xl mx-auto w-full gap-4 px-4 py-4">
        {/* Canvas */}
        <div className="relative flex-shrink-0">
          <canvas
            ref={canvasRef}
            width={CV_W}
            height={CV_H}
            className="rounded-lg border border-border mx-auto block"
            style={{ maxWidth: "100%", height: "auto", background: "#070710" }}
            data-testid="canvas-bowling-lane"
          />
        </div>

        {/* Controls + Scoreboard */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Frames scoreboard */}
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Scorecard</div>
            {[
              { name: p1Name, frames: gameState.player1Frames, total: gameState.player1TotalScore },
              { name: p2Name, frames: gameState.player2Frames, total: gameState.player2TotalScore },
            ].map(({ name, frames, total }) => (
              <div key={name} className="mb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold">{name}</span>
                  <span className="text-xs text-muted-foreground ml-auto font-mono font-bold">{total}</span>
                </div>
                <div className="flex gap-0.5">
                  {frames.map((f, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-8 rounded-sm text-xs font-mono flex items-center justify-center transition-colors ${
                        i === curFrame && !gameState.gameOver
                          ? "bg-primary/20 border border-primary/40"
                          : "bg-muted/40"
                      }`}
                    >
                      {f.isStrike ? (
                        <span className="text-yellow-400 font-bold">X</span>
                      ) : f.isSpare ? (
                        <span className="text-blue-400 font-bold">/</span>
                      ) : f.rolls.length > 0 ? (
                        <span className="text-muted-foreground">{f.rolls.join("-")}</span>
                      ) : (
                        <span className="text-muted-foreground/30">·</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Turn indicator */}
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            {gameState.gameOver ? (
              <div className="text-sm font-semibold text-muted-foreground">Game Over</div>
            ) : (
              <div className="text-sm">
                <span className="text-muted-foreground">Turn: </span>
                <span className="font-semibold">
                  {gameState.currentPlayer === "player1" ? p1Name : p2Name}
                </span>
                {gameState.simulationRunning && (
                  <span className="ml-2 text-yellow-400 text-xs animate-pulse">Rolling...</span>
                )}
              </div>
            )}
          </div>

          {/* Phase-based shot controls */}
          {isMyTurn && !gameState.gameOver && !gameState.simulationRunning && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-4">
              {/* Phase progress indicator */}
              <div className="flex items-center gap-1">
                {(["position", "aim", "power", "effect"] as const).map((p, i) => (
                  <div key={p} className="flex items-center gap-1 flex-1">
                    <div className={`flex-1 h-1 rounded-full transition-colors ${
                      ["position","aim","power","effect"].indexOf(shotPhase) >= i
                        ? "bg-primary" : "bg-muted"
                    }`} />
                    {i < 3 && <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />}
                  </div>
                ))}
              </div>

              {/* Step labels */}
              <div className="grid grid-cols-4 gap-1 text-center">
                {(["position","aim","power","effect"] as const).map((p) => (
                  <div key={p} className={`text-xs font-medium capitalize transition-colors ${shotPhase === p ? "text-primary" : "text-muted-foreground/50"}`}>
                    {p}
                  </div>
                ))}
              </div>

              {/* ── POSITION phase ── */}
              {shotPhase === "position" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MoveHorizontal className="w-3.5 h-3.5" />Lane position</span>
                    <span className="font-mono">{bowlerOffset > 0 ? `+${bowlerOffset}` : bowlerOffset}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full relative">
                    <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-primary shadow transition-all"
                      style={{ left: `${((bowlerOffset + 150) / 300) * 100}%`, transform: "translate(-50%,-50%)" }} />
                    <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-muted-foreground/30" style={{ left: "50%" }} />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setBowlerOffset(p => Math.max(-150, p - 20))} data-testid="button-bowl-left">
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button className="flex-1" onClick={handlePhaseAdvance} data-testid="button-bowl-confirm-position">
                      Lock Position
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => setBowlerOffset(p => Math.min(150, p + 20))} data-testid="button-bowl-right">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ── AIM phase ── */}
              {shotPhase === "aim" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Crosshair className="w-3.5 h-3.5" />Aim angle</span>
                    <span className="font-mono">{aim < -0.05 ? "← Left" : aim > 0.05 ? "Right →" : "Center"}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full relative cursor-pointer"
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setAim(Math.max(-1, Math.min(1, (e.clientX - r.left) / r.width * 2 - 1)));
                    }}
                    data-testid="slider-bowling-aim"
                  >
                    <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-muted-foreground/30" style={{ left: "50%" }} />
                    <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-blue-400 shadow transition-all"
                      style={{ left: `${(aim + 1) / 2 * 100}%`, transform: "translate(-50%,-50%)" }} />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setAim(a => Math.max(-1, a - 0.1))} data-testid="button-aim-left">
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button className="flex-1" onClick={handlePhaseAdvance} data-testid="button-bowl-confirm-aim">
                      Lock Aim
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => setAim(a => Math.min(1, a + 0.1))} data-testid="button-aim-right">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ── POWER phase ── */}
              {shotPhase === "power" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5" />Power</span>
                    <span className="font-mono font-bold" style={{ color: powerPct > 85 ? "#ef4444" : powerPct > 65 ? "#f59e0b" : "#22c55e" }}>
                      {Math.round(powerPct)}%
                    </span>
                  </div>
                  <div className="h-6 bg-muted rounded-full overflow-hidden relative">
                    <div className="h-full rounded-full transition-none" style={{
                      width: `${powerPct}%`,
                      background: `linear-gradient(to right, #22c55e, #f59e0b 65%, ${powerPct > 85 ? "#ef4444" : "#f59e0b"})`,
                    }} />
                    <div className="absolute top-0 bottom-0 w-0.5 bg-white/40" style={{ left: "75%" }} />
                    {/* Oscillating marker */}
                    <div className="absolute top-1 bottom-1 w-1 rounded-full bg-white/80 shadow-lg transition-none"
                      style={{ left: `calc(${powerPct}% - 2px)` }} />
                  </div>
                  <Button className="w-full" onClick={handlePhaseAdvance} data-testid="button-bowl-confirm-power">
                    <Zap className="w-4 h-4 mr-2" />
                    Lock Power!
                  </Button>
                </div>
              )}

              {/* ── EFFECT phase ── */}
              {shotPhase === "effect" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5" />Hook effect</span>
                    <span className="font-mono font-bold" style={{ color: "#a78bfa" }}>
                      {effectPct < 45 ? `R-hook ${Math.round((50 - effectPct) * 2)}%` : effectPct > 55 ? `L-hook ${Math.round((effectPct - 50) * 2)}%` : "Straight"}
                    </span>
                  </div>
                  <div className="h-6 bg-muted rounded-full overflow-hidden relative">
                    {/* Left half (R-hook) */}
                    {effectPct < 50 && (
                      <div className="absolute top-0 bottom-0 rounded-l-full"
                        style={{ right: "50%", left: `${effectPct}%`, background: "linear-gradient(to right, #f97316, #a78bfa)" }} />
                    )}
                    {/* Right half (L-hook) */}
                    {effectPct > 50 && (
                      <div className="absolute top-0 bottom-0 rounded-r-full"
                        style={{ left: "50%", width: `${(effectPct - 50)}%`, background: "linear-gradient(to right, #a78bfa, #3b82f6)" }} />
                    )}
                    {/* Center line */}
                    <div className="absolute top-0 bottom-0 w-0.5 bg-white/40" style={{ left: "50%" }} />
                    <div className="absolute top-1 bottom-1 w-1 rounded-full bg-white/80 shadow-lg transition-none"
                      style={{ left: `calc(${effectPct}% - 2px)` }} />
                  </div>
                  <div className="flex gap-2 text-xs text-muted-foreground justify-between px-1">
                    <span>R-hook</span><span>Straight</span><span>L-hook</span>
                  </div>
                  <Button className="w-full" onClick={handlePhaseAdvance} data-testid="button-bowl-fire"
                    style={{ background: "linear-gradient(135deg,#a78bfa,#6366f1)" }}>
                    <Target className="w-4 h-4 mr-2" />
                    Bowl!
                  </Button>
                </div>
              )}

              <p className="text-xs text-muted-foreground/50 text-center">
                {shotPhase === "position" ? "Use ← → arrows or buttons to move" :
                 shotPhase === "aim"      ? "Use ← → arrows or click the bar to aim" :
                 shotPhase === "power"    ? "Watch the meter and press Space to lock" :
                                           "Timing the hook — press Space to fire!"}
              </p>
            </div>
          )}

          {/* Waiting / Game over */}
          {!isMyTurn && !gameState.gameOver && !gameState.simulationRunning && (
            <div className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">
              Waiting for {gameState.currentPlayer === "player1" ? p1Name : p2Name}...
            </div>
          )}

          {gameState.gameOver && (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setLocation("/")} className="flex-1" data-testid="button-back-home-bowling">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Home
              </Button>
              {match.isPractice && (
                <Button onClick={() => setGameState(createInitialState())} className="flex-1" data-testid="button-new-game-bowling">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  New Game
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </GameLayout>
  );
}
