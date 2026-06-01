import { useEffect, useRef, useState, useCallback } from "react";
import MatchIntroAnimation from "@/components/MatchIntroAnimation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Flag, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { useLocation } from "wouter";
import type { MatchWithPlayers } from "@shared/schema";
import { GameLayout } from "@/components/games/GameLayout";
import {
  type RacingState,
  type CarInput,
  type RacingTrack,
  createRacingState,
  simulateRacing,
  startRacingCountdown,
  startPlayer2Race,
  tickReveal,
  formatRaceTime,
  RACING_CONSTANTS,
  TRACKS,
  getTrackBounds,
  getTrackIndexFromMatchId,
} from "@shared/racingEngine";
import { soundManager } from "@/lib/soundManager";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  match: MatchWithPlayers;
  currentUserId?: string;
}

const CAM_W = 680;
const CAM_H = 480;
const MINIMAP_W = 130;
const MINIMAP_H = 90;

// ─── Small Web Audio helpers ─────────────────────────────────────────────────
function makeAudioCtx() {
  try { return new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { return null; }
}
let _audioCtx: AudioContext | null = null;
function audioCtx() { return _audioCtx || (_audioCtx = makeAudioCtx()); }

function playLapSound() {
  const ctx = audioCtx(); if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = "sine";
  const t = ctx.currentTime;
  osc.frequency.setValueAtTime(440, t);
  osc.frequency.linearRampToValueAtTime(880, t + 0.12);
  osc.frequency.linearRampToValueAtTime(660, t + 0.22);
  gain.gain.setValueAtTime(0.18, t);
  gain.gain.linearRampToValueAtTime(0, t + 0.3);
  osc.start(t); osc.stop(t + 0.32);
}

function playCheckpointSound() {
  const ctx = audioCtx(); if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = "square";
  osc.frequency.setValueAtTime(660, ctx.currentTime);
  gain.gain.setValueAtTime(0.06, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
  osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.12);
}

export default function RacingGame({ match, currentUserId }: Props) {
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>();
  const inputRef = useRef<CarInput>({ throttle: false, brake: false, left: false, right: false });
  const stateRef = useRef<RacingState | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const camRef = useRef({ x: 0, y: 0 });
  const lastCountdownRef = useRef(3);
  const prevLapRef = useRef(0);
  const prevCpRef = useRef(1);

  const trackIndex = match.isPractice ? 0 : getTrackIndexFromMatchId(match.id);
  const [state, setState] = useState<RacingState>(() => createRacingState(trackIndex));
  const [touchThrottle, setTouchThrottle] = useState(false);
  const [touchBrake, setTouchBrake] = useState(false);
  const [touchLeft, setTouchLeft] = useState(false);
  const [touchRight, setTouchRight] = useState(false);
  const [lapFlash, setLapFlash] = useState<{ lap: number; total: number } | null>(null);
  const [showIntro, setShowIntro] = useState(true);

  const isPlayer1 = match.player1Id === currentUserId;
  const isMyTurn = match.isPractice
    || (state.currentPlayer === "player1" && isPlayer1)
    || (state.currentPlayer === "player2" && !isPlayer1);

  // Sync touch input
  useEffect(() => {
    inputRef.current.throttle = touchThrottle;
    inputRef.current.brake = touchBrake;
    inputRef.current.left = touchLeft;
    inputRef.current.right = touchRight;
  }, [touchThrottle, touchBrake, touchLeft, touchRight]);

  useEffect(() => { stateRef.current = state; }, [state]);

  // Detect lap changes and play feedback
  useEffect(() => {
    const car = state.car;
    if (car.lap > prevLapRef.current && state.phase === "racing") {
      prevLapRef.current = car.lap;
      playLapSound();
      setLapFlash({ lap: car.lap, total: state.track.laps });
      setTimeout(() => setLapFlash(null), 2200);
    }
    if (car.nextCheckpoint !== prevCpRef.current && state.phase === "racing") {
      prevCpRef.current = car.nextCheckpoint;
      if (car.lap < state.track.laps) playCheckpointSound();
    }
  }, [state.car.lap, state.car.nextCheckpoint, state.phase]);

  // ── WebSocket PvP sync ────────────────────────────────────────────────────
  useEffect(() => {
    if (match.isPractice) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    ws.onopen = () => ws.send(JSON.stringify({ type: "join", matchId: match.id, userId: currentUserId }));
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.type === "racing-state" && d.matchId === match.id) {
        const remote = d.gameState;
        setState(prev => {
          if (prev.phase === "finished" && remote.player2Time !== undefined) {
            const winner = prev.player1Time! < remote.player2Time ? "player1"
              : remote.player2Time < prev.player1Time! ? "player2" : "draw";
            return { ...prev, player2Time: remote.player2Time, phase: "over", winner };
          }
          if (remote.player1Time !== undefined && prev.phase === "countdown" && !isPlayer1) {
            return { ...prev, player1Time: remote.player1Time };
          }
          return prev;
        });
      }
    };
    wsRef.current = ws;
    return () => { ws.close(); };
  }, [match.id, match.isPractice, currentUserId, isPlayer1]);

  // ── Send lap time when player finishes ────────────────────────────────────
  useEffect(() => {
    if (match.isPractice) return;
    if (state.phase === "finished" && isPlayer1 && state.player1Time !== undefined) {
      wsRef.current?.send(JSON.stringify({ type: "racing-complete", matchId: match.id, lapTime: state.player1Time }));
    }
    if (state.phase === "over" && !isPlayer1 && state.player2Time !== undefined) {
      wsRef.current?.send(JSON.stringify({ type: "racing-complete", matchId: match.id, lapTime: state.player2Time }));
    }
  }, [state.phase, isPlayer1, match.isPractice, match.id]);

  // ── Keyboard controls ─────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "ArrowUp"    || e.code === "KeyW") { e.preventDefault(); inputRef.current.throttle = true; }
      if (e.code === "ArrowDown"  || e.code === "KeyS") { e.preventDefault(); inputRef.current.brake = true; }
      if (e.code === "ArrowLeft"  || e.code === "KeyA") { e.preventDefault(); inputRef.current.left = true; }
      if (e.code === "ArrowRight" || e.code === "KeyD") { e.preventDefault(); inputRef.current.right = true; }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "ArrowUp"    || e.code === "KeyW") inputRef.current.throttle = false;
      if (e.code === "ArrowDown"  || e.code === "KeyS") inputRef.current.brake = false;
      if (e.code === "ArrowLeft"  || e.code === "KeyA") inputRef.current.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") inputRef.current.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // ── Track reveal timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (state.phase !== "reveal" || !isMyTurn) return;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / (1000 / 60), 3);
      last = now;
      setState(prev => tickReveal(prev, dt));
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [state.phase, isMyTurn]);

  // ── Countdown timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (state.phase !== "countdown" || !isMyTurn) return;
    const t = setInterval(() => {
      setState(prev => {
        if (prev.phase !== "countdown") return prev;
        const next = startRacingCountdown(prev);
        if (next.countdown < lastCountdownRef.current) {
          soundManager.playClick();
          lastCountdownRef.current = next.countdown;
        }
        if (next.phase === "racing") soundManager.playNotification();
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [state.phase, isMyTurn]);

  // ── Main game loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.phase !== "racing" || !isMyTurn) return;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / (1000 / 60), 3);
      last = now;
      setState(prev => simulateRacing(prev, inputRef.current, dt));
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [state.phase, isMyTurn]);

  useEffect(() => {
    if (state.phase === "finished") soundManager.playWin();
  }, [state.phase]);

  // ── Rendering ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { track, car, phase } = state;
    const bounds = getTrackBounds(track);
    const trackW = bounds.maxX - bounds.minX;
    const trackH = bounds.maxY - bounds.minY;

    // ── Camera follow car ─────────────────────────────────────────────────
    const targetCamX = car.x - CAM_W / 2;
    const targetCamY = car.y - CAM_H / 2;
    const lerpSpeed = phase === "reveal" ? 0.05 : 0.1;
    camRef.current.x += (targetCamX - camRef.current.x) * lerpSpeed;
    camRef.current.y += (targetCamY - camRef.current.y) * lerpSpeed;
    const camX = camRef.current.x;
    const camY = camRef.current.y;

    // ── Background ────────────────────────────────────────────────────────
    const bgGrad = ctx.createRadialGradient(CAM_W / 2, CAM_H / 2, 0, CAM_W / 2, CAM_H / 2, CAM_W * 0.8);
    bgGrad.addColorStop(0, "#0d0d20");
    bgGrad.addColorStop(1, "#060610");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CAM_W, CAM_H);

    // Perspective grid — moves with camera for depth illusion
    ctx.save();
    ctx.strokeStyle = "rgba(80,40,180,0.07)";
    ctx.lineWidth = 1;
    const gridSize = 80;
    const gox = ((-camX * 0.6) % gridSize + gridSize) % gridSize;
    const goy = ((-camY * 0.6) % gridSize + gridSize) % gridSize;
    for (let gx = gox - gridSize; gx < CAM_W + gridSize; gx += gridSize) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, CAM_H); ctx.stroke();
    }
    for (let gy = goy - gridSize; gy < CAM_H + gridSize; gy += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(CAM_W, gy); ctx.stroke();
    }
    ctx.restore();

    // Radial ambient glow near track center
    const trackCX = ((bounds.minX + bounds.maxX) / 2) - camX;
    const trackCY = ((bounds.minY + bounds.maxY) / 2) - camY;
    const ambGlow = ctx.createRadialGradient(trackCX, trackCY, 0, trackCX, trackCY, 380);
    ambGlow.addColorStop(0, track.color + "18");
    ambGlow.addColorStop(1, "transparent");
    ctx.fillStyle = ambGlow;
    ctx.fillRect(0, 0, CAM_W, CAM_H);

    ctx.save();
    ctx.translate(-camX, -camY);

    const pts = track.points;
    const hw = track.width / 2 - 2;

    // ── Tire marks ────────────────────────────────────────────────────────
    for (const tm of state.tireMarks) {
      ctx.save();
      ctx.globalAlpha = tm.alpha * 0.65;
      ctx.fillStyle = "#0a0a18";
      ctx.translate(tm.x, tm.y);
      ctx.rotate(tm.angle);
      ctx.fillRect(-9, -4, 8, 8);
      ctx.restore();
    }

    // ── Track outer glow ──────────────────────────────────────────────────
    ctx.save();
    ctx.shadowColor = track.color + "44";
    ctx.shadowBlur = 40;
    ctx.strokeStyle = track.color + "22";
    ctx.lineWidth = track.width + 24;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // ── Track shadow/base ─────────────────────────────────────────────────
    ctx.save();
    ctx.strokeStyle = "#080812";
    ctx.lineWidth = track.width + 12;
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // ── Road surface ──────────────────────────────────────────────────────
    ctx.save();
    ctx.strokeStyle = "#20202e";
    ctx.lineWidth = track.width;
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // ── Kerb strips (outer + inner alternating red/white) ─────────────────
    const drawKerb = (offset: number, kerbWidth: number) => {
      const kerbPts = pts.map((pt, i) => {
        const prev2 = pts[(i - 1 + pts.length) % pts.length];
        const next2 = pts[(i + 1) % pts.length];
        const dx1 = pt.x - prev2.x, dy1 = pt.y - prev2.y;
        const dx2 = next2.x - pt.x, dy2 = next2.y - pt.y;
        const l1 = Math.sqrt(dx1*dx1+dy1*dy1)||1, l2 = Math.sqrt(dx2*dx2+dy2*dy2)||1;
        const nx = (-dy1/l1 + -dy2/l2) * 0.5;
        const ny = (dx1/l1 + dx2/l2) * 0.5;
        return { x: pt.x + nx * offset, y: pt.y + ny * offset };
      });
      // Draw thick base kerb
      ctx.save();
      ctx.strokeStyle = "#2a2a3a";
      ctx.lineWidth = kerbWidth + 2;
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(kerbPts[0].x, kerbPts[0].y);
      for (let i = 1; i < kerbPts.length; i++) ctx.lineTo(kerbPts[i].x, kerbPts[i].y);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      // Kerb segments — alternating red/white
      const segLen = 22;
      for (let i = 0; i < kerbPts.length; i++) {
        const seg = Math.floor(i / segLen) % 2;
        ctx.save();
        ctx.strokeStyle = seg === 0 ? "rgba(220,30,30,0.7)" : "rgba(255,255,255,0.7)";
        ctx.lineWidth = kerbWidth;
        ctx.lineCap = "butt";
        if (i < kerbPts.length - 1) {
          ctx.beginPath();
          ctx.moveTo(kerbPts[i].x, kerbPts[i].y);
          ctx.lineTo(kerbPts[i+1].x, kerbPts[i+1].y);
          ctx.stroke();
        }
        ctx.restore();
      }
    };
    drawKerb(hw + 5, 5);
    drawKerb(-(hw + 5), 5);

    // ── Road texture — animated dashes ────────────────────────────────────
    ctx.save();
    ctx.strokeStyle = "#2c2c3e";
    ctx.lineWidth = track.width - 14;
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.setLineDash([50, 8]);
    ctx.lineDashOffset = -state.elapsed * 0.5;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // ── Edge neon lines ───────────────────────────────────────────────────
    const drawEdge = (offset: number, glow: boolean) => {
      const edgePts = pts.map((pt, i) => {
        const prev2 = pts[(i - 1 + pts.length) % pts.length];
        const next2 = pts[(i + 1) % pts.length];
        const dx1 = pt.x - prev2.x, dy1 = pt.y - prev2.y;
        const dx2 = next2.x - pt.x, dy2 = next2.y - pt.y;
        const l1 = Math.sqrt(dx1*dx1+dy1*dy1)||1, l2 = Math.sqrt(dx2*dx2+dy2*dy2)||1;
        const nx = (-dy1/l1 + -dy2/l2) * 0.5;
        const ny = (dx1/l1 + dx2/l2) * 0.5;
        return { x: pt.x + nx * offset, y: pt.y + ny * offset };
      });
      ctx.save();
      ctx.strokeStyle = track.color + "cc";
      ctx.lineWidth = 2;
      if (glow) { ctx.shadowColor = track.color; ctx.shadowBlur = 12; }
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(edgePts[0].x, edgePts[0].y);
      for (let i = 1; i < edgePts.length; i++) ctx.lineTo(edgePts[i].x, edgePts[i].y);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    };
    drawEdge(hw, true);
    drawEdge(-hw, true);

    // ── Center dashes ─────────────────────────────────────────────────────
    ctx.save();
    ctx.strokeStyle = "rgba(255,220,50,0.22)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([18, 16]);
    ctx.lineDashOffset = -state.elapsed * 0.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // ── Checkpoint gates ──────────────────────────────────────────────────
    const cpStep = Math.max(1, Math.floor(pts.length / 8));
    pts.forEach((pt, i) => {
      if (i % cpStep !== 0 || i === 0) return; // skip the finish line (drawn separately)
      const isNext = i === car.nextCheckpoint % pts.length;
      if (!isNext && phase !== "reveal") return;
      const prev2 = pts[(i - 1 + pts.length) % pts.length];
      const dirX = pt.x - prev2.x, dirY = pt.y - prev2.y;
      const len = Math.sqrt(dirX*dirX+dirY*dirY)||1;
      const nx = -dirY/len, ny = dirX/len;
      ctx.save();
      // Gate post left
      const postR = 5;
      const gateColor = isNext ? "#00ffaa" : "rgba(80,80,140,0.4)";
      if (isNext) { ctx.shadowColor = "#00ffaa"; ctx.shadowBlur = 20; }
      // Gate line
      ctx.strokeStyle = gateColor;
      ctx.lineWidth = isNext ? 3 : 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(pt.x + nx * hw, pt.y + ny * hw);
      ctx.lineTo(pt.x - nx * hw, pt.y - ny * hw);
      ctx.stroke();
      ctx.setLineDash([]);
      // Posts
      if (isNext) {
        [1, -1].forEach(side => {
          ctx.beginPath();
          ctx.arc(pt.x + nx * hw * side, pt.y + ny * hw * side, postR, 0, Math.PI * 2);
          ctx.fillStyle = "#00ffaa";
          ctx.fill();
        });
      }
      ctx.restore();
    });

    // ── Start/Finish line ─────────────────────────────────────────────────
    const sp = pts[0];
    const sNext = pts[3];
    const dSx = sNext.x - sp.x, dSy = sNext.y - sp.y;
    const sLen = Math.sqrt(dSx*dSx+dSy*dSy)||1;
    const snx = -dSy/sLen, sny = dSx/sLen;

    // Checkered flags pattern
    ctx.save();
    const checkSize = 9;
    const lineLen = track.width;
    for (let ci = -Math.floor(lineLen / checkSize / 2); ci <= Math.floor(lineLen / checkSize / 2); ci++) {
      const px = sp.x + snx * ci * checkSize;
      const py = sp.y + sny * ci * checkSize;
      ctx.fillStyle = ci % 2 === 0 ? "#ffffff" : "#111111";
      ctx.fillRect(px - checkSize/2, py - checkSize/2, checkSize, checkSize);
    }
    // Glowing white line
    ctx.strokeStyle = "rgba(255,255,255,1)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.moveTo(sp.x + snx * hw, sp.y + sny * hw);
    ctx.lineTo(sp.x - snx * hw, sp.y - sny * hw);
    ctx.stroke();
    // Large post markers
    [1, -1].forEach(side => {
      ctx.beginPath();
      ctx.arc(sp.x + snx * hw * side, sp.y + sny * hw * side, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 18;
      ctx.fill();
    });
    ctx.restore();

    // ── Car rendering ─────────────────────────────────────────────────────
    if (phase !== "reveal") {
      const carColor = isMyTurn ? "#ff2d8a" : "#3399ff";
      const carLen = 22, carWid = 12;

      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);

      // Speed streaks (behind)
      if (car.speed > 3) {
        const streakAlpha = Math.min((car.speed - 3) / (RACING_CONSTANTS.MAX_SPEED - 3), 1) * 0.55;
        for (let s = 0; s < 4; s++) {
          const streakLen = car.speed * 6 + s * 9;
          const sy = s < 2 ? -carWid * 0.5 : carWid * 0.5;
          const sx = s % 2 === 0 ? -carLen * 0.35 : -carLen * 0.28;
          const grad = ctx.createLinearGradient(-streakLen, sy, sx, sy);
          grad.addColorStop(0, "transparent");
          grad.addColorStop(1, carColor + Math.floor(streakAlpha * 255).toString(16).padStart(2, "0"));
          ctx.fillStyle = grad;
          ctx.fillRect(-streakLen, sy - 1.5, streakLen + sx, 3);
        }
      }

      // Drop shadow
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(3, 4, carLen * 0.72, carWid * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Body gradient
      const bodyGrad = ctx.createLinearGradient(-carLen, -carWid, carLen, carWid);
      bodyGrad.addColorStop(0, adjustColor(carColor, -55));
      bodyGrad.addColorStop(0.25, adjustColor(carColor, 20));
      bodyGrad.addColorStop(0.6, carColor);
      bodyGrad.addColorStop(1, adjustColor(carColor, -60));
      ctx.fillStyle = bodyGrad;
      ctx.shadowColor = carColor;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.roundRect(-carLen, -carWid, carLen * 2, carWid * 2, 5);
      ctx.fill();

      // Top highlight stripe
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.roundRect(-carLen * 0.6, -carWid * 0.7, carLen * 1.2, carWid * 0.4, 2);
      ctx.fill();

      // Cockpit / windshield
      ctx.fillStyle = "rgba(150,240,255,0.8)";
      ctx.shadowColor = "#88eeff";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.roundRect(carLen * 0.05, -carWid * 0.6, carLen * 0.42, carWid * 1.2, 3);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Racing number panel
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.roundRect(-carLen * 0.55, -carWid * 0.5, carLen * 0.4, carWid, 2);
      ctx.fill();
      ctx.fillStyle = carColor;
      ctx.font = `bold ${carWid * 0.85}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(isMyTurn ? "1" : "2", -carLen * 0.35, 0);
      ctx.textBaseline = "alphabetic";

      // Side exhaust vents
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      [[-carLen * 0.75, -carWid], [-carLen * 0.75, carWid - 4]].forEach(([vx, vy]) => {
        ctx.fillRect(vx, vy, carLen * 0.35, 4);
      });

      // Wheels
      const wx = carLen * 0.42, wy = carWid + 3;
      ctx.shadowBlur = 0;
      [[-wx, -wy], [wx, -wy], [-wx, wy], [wx, wy]].forEach(([wpx, wpy]) => {
        // Tire
        ctx.fillStyle = "#151520";
        ctx.beginPath();
        ctx.ellipse(wpx, wpy, 5.5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        // Rim
        ctx.fillStyle = "#888";
        ctx.beginPath();
        ctx.ellipse(wpx, wpy, 3, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Rim highlight
        ctx.fillStyle = "#ccc";
        ctx.beginPath();
        ctx.ellipse(wpx - 0.7, wpy - 0.7, 1.2, 1, 0, 0, Math.PI * 2);
        ctx.fill();
      });

      // Rear exhaust glow
      if (car.speed > 1.5 && car.throttle > 0) {
        for (let t = 0; t < 5; t++) {
          const alpha = (1 - t / 5) * 0.35 * (car.speed / RACING_CONSTANTS.MAX_SPEED);
          ctx.globalAlpha = alpha;
          const exhaustColor = car.offTrack ? "#c08040" : (carColor + "bb");
          ctx.fillStyle = exhaustColor;
          ctx.beginPath();
          ctx.arc(-carLen + t * 5, (Math.random() - 0.5) * 5, 2.5 + t * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // Drifting sparks
      if (car.drifting) {
        for (let s = 0; s < 4; s++) {
          ctx.globalAlpha = Math.random() * 0.6 + 0.2;
          ctx.fillStyle = "#ffcc44";
          const sx2 = (Math.random() - 0.5) * carLen * 2;
          const sy2 = (Math.random() - 0.5) * carWid * 2;
          ctx.beginPath();
          ctx.arc(sx2, sy2, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    }

    ctx.restore(); // end camera transform

    // ── Screen-space speed lines ──────────────────────────────────────────
    if (phase === "racing" && car.speed > RACING_CONSTANTS.MAX_SPEED * 0.7) {
      const speedNorm = (car.speed - RACING_CONSTANTS.MAX_SPEED * 0.7) / (RACING_CONSTANTS.MAX_SPEED * 0.3);
      ctx.save();
      ctx.globalAlpha = speedNorm * 0.12;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      const numLines = 18;
      for (let sl = 0; sl < numLines; sl++) {
        const angle2 = car.angle;
        const startR = 60 + Math.random() * 80;
        const lineLen2 = 80 + Math.random() * 120;
        const ox = CAM_W / 2 + (Math.random() - 0.5) * CAM_W * 0.9;
        const oy = CAM_H / 2 + (Math.random() - 0.5) * CAM_H * 0.9;
        ctx.beginPath();
        ctx.moveTo(ox - Math.cos(angle2) * startR, oy - Math.sin(angle2) * startR);
        ctx.lineTo(ox - Math.cos(angle2) * (startR + lineLen2), oy - Math.sin(angle2) * (startR + lineLen2));
        ctx.stroke();
      }
      ctx.restore();
    }

    // ── HUD overlays ──────────────────────────────────────────────────────
    if (phase === "racing" || phase === "finished" || phase === "over") {
      drawHUD(ctx, state, isMyTurn, track, bounds, trackW, trackH);
    }

    // ── Track Reveal Overlay ──────────────────────────────────────────────
    if (phase === "reveal") {
      drawRevealScreen(ctx, track, state.revealTimer);
    }

    // ── Countdown overlay ─────────────────────────────────────────────────
    if (phase === "countdown" && isMyTurn) {
      drawCountdown(ctx, state.countdown);
    }

    // ── Waiting overlay ───────────────────────────────────────────────────
    if (!isMyTurn && (phase === "countdown" || phase === "reveal")) {
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(0, 0, CAM_W, CAM_H);
      ctx.fillStyle = "#aaaacc";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        state.currentPlayer === "player1" ? "Waiting for Player 1 to race..." : "Waiting for Player 2 to race...",
        CAM_W / 2, CAM_H / 2
      );
      ctx.textBaseline = "alphabetic";
    }

    // ── Finished / Over overlay ───────────────────────────────────────────
    if (phase === "finished" || phase === "over") {
      drawFinishScreen(ctx, state, match, isMyTurn);
    }

  }, [state, isMyTurn, match]);

  // ─── Drawing helpers ──────────────────────────────────────────────────────

  function drawHUD(
    ctx: CanvasRenderingContext2D,
    state: RacingState,
    isMyTurn: boolean,
    track: RacingTrack,
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    trackW: number,
    trackH: number
  ) {
    const { car } = state;
    const phase = state.phase;

    // ── Speed dial (bottom-left) ─────────────────────────────────────────
    const sbX = 14, sbY = CAM_H - 48;
    const sbW = 130, sbH = 34;

    // Panel backdrop
    ctx.save();
    ctx.fillStyle = "rgba(5,5,18,0.85)";
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(sbX, sbY, sbW, sbH, 8); ctx.fill(); ctx.stroke();

    // Speed bar track
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath(); ctx.roundRect(sbX + 4, sbY + 16, sbW - 8, 12, 4); ctx.fill();

    // Speed bar fill
    const speedPct = car.speed / RACING_CONSTANTS.MAX_SPEED;
    const speedGrad = ctx.createLinearGradient(sbX + 4, 0, sbX + sbW - 4, 0);
    speedGrad.addColorStop(0, "#0055ff");
    speedGrad.addColorStop(0.5, "#aa00ff");
    speedGrad.addColorStop(1, "#ff2d8a");
    ctx.fillStyle = speedGrad;
    if (speedPct > 0) {
      ctx.shadowColor = "#ff2d8a";
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.roundRect(sbX + 4, sbY + 16, Math.max(0, (sbW - 8) * speedPct), 12, 4); ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Speed label
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold 10px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("SPEED", sbX + 6, sbY + 13);
    ctx.textAlign = "right";
    ctx.fillStyle = "#aaccff";
    ctx.fillText(`${Math.round(speedPct * 220)} km/h`, sbX + sbW - 6, sbY + 13);
    ctx.restore();

    // Off-track warning pill
    if (car.offTrack) {
      ctx.save();
      ctx.fillStyle = "rgba(255,80,20,0.9)";
      ctx.shadowColor = "#ff5014";
      ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.roundRect(sbX, sbY - 26, 110, 20, 6); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("! OFF TRACK !", sbX + 55, sbY - 11);
      ctx.restore();
    }

    // ── Lap counter (top-right) ──────────────────────────────────────────
    const lapX = CAM_W - 110, lapY = 12;
    ctx.save();
    ctx.fillStyle = "rgba(5,5,18,0.88)";
    ctx.strokeStyle = track.color + "88";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = track.color;
    ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.roundRect(lapX, lapY, 96, 34, 8); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = track.color;
    ctx.font = `bold 10px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("LAP", lapX + 48, lapY + 13);
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold 15px sans-serif`;
    ctx.fillText(`${Math.min(car.lap + 1, state.track.laps)} / ${state.track.laps}`, lapX + 48, lapY + 30);
    ctx.restore();

    // ── Timer (top-center) ───────────────────────────────────────────────
    const timerColor = phase === "racing" ? "#7effb0" : "#888";
    ctx.save();
    ctx.fillStyle = "rgba(5,5,18,0.88)";
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(CAM_W / 2 - 64, 12, 128, 34, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = `bold 9px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("TIME", CAM_W / 2, 25);
    ctx.fillStyle = timerColor;
    ctx.font = `bold 16px monospace`;
    ctx.shadowColor = timerColor;
    ctx.shadowBlur = 8;
    ctx.fillText(formatRaceTime(car.totalTime), CAM_W / 2, 40);
    ctx.shadowBlur = 0;
    ctx.restore();

    // ── P1 time panel (top-left) ─────────────────────────────────────────
    if (state.player1Time !== undefined || state.player2Time !== undefined) {
      ctx.save();
      ctx.fillStyle = "rgba(5,5,18,0.85)";
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(12, 12, 148, 52, 8); ctx.fill(); ctx.stroke();
      ctx.font = `bold 9px sans-serif`;
      ctx.textAlign = "left";
      if (state.player1Time !== undefined) {
        ctx.fillStyle = "#ff88bb";
        ctx.fillText("P1", 20, 30);
        ctx.fillStyle = "#ffffff";
        ctx.font = `11px monospace`;
        ctx.fillText(formatRaceTime(state.player1Time), 38, 30);
      }
      if (state.player2Time !== undefined) {
        ctx.fillStyle = "#88bbff";
        ctx.font = `bold 9px sans-serif`;
        ctx.fillText("P2", 20, 50);
        ctx.fillStyle = "#ffffff";
        ctx.font = `11px monospace`;
        ctx.fillText(formatRaceTime(state.player2Time), 38, 50);
      }
      ctx.restore();
    }

    // Minimap (bottom-right)
    drawMinimap(ctx, state, bounds, trackW, trackH);
  }

  function drawMinimap(
    ctx: CanvasRenderingContext2D,
    state: RacingState,
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    trackW: number,
    trackH: number
  ) {
    const { track, car } = state;
    const mx = CAM_W - MINIMAP_W - 12;
    const my = CAM_H - MINIMAP_H - 12;
    const scaleX = MINIMAP_W / (trackW || 1);
    const scaleY = MINIMAP_H / (trackH || 1);
    const ms = Math.min(scaleX, scaleY) * 0.85;

    ctx.save();
    // Panel
    ctx.fillStyle = "rgba(4,4,16,0.88)";
    ctx.strokeStyle = track.color + "66";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = track.color;
    ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.roundRect(mx - 6, my - 6, MINIMAP_W + 12, MINIMAP_H + 12, 8); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.translate(mx, my);

    const pts = track.points;
    const offX = -bounds.minX * ms + (MINIMAP_W - trackW * ms) / 2;
    const offY = -bounds.minY * ms + (MINIMAP_H - trackH * ms) / 2;

    // Track
    ctx.strokeStyle = track.color + "99";
    ctx.lineWidth = track.width * ms * 1.1;
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0].x * ms + offX, pts[0].y * ms + offY);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * ms + offX, pts[i].y * ms + offY);
    ctx.closePath();
    ctx.stroke();

    // Road surface
    ctx.strokeStyle = "#1e1e2e";
    ctx.lineWidth = (track.width - 8) * ms;
    ctx.beginPath();
    ctx.moveTo(pts[0].x * ms + offX, pts[0].y * ms + offY);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * ms + offX, pts[i].y * ms + offY);
    ctx.closePath();
    ctx.stroke();

    // Finish line dot on minimap
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(pts[0].x * ms + offX, pts[0].y * ms + offY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Car dot
    const carMapX = car.x * ms + offX;
    const carMapY = car.y * ms + offY;
    const dotColor = isMyTurn ? "#ff2d8a" : "#3399ff";
    ctx.fillStyle = dotColor;
    ctx.shadowColor = dotColor;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(carMapX, carMapY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  function drawRevealScreen(ctx: CanvasRenderingContext2D, track: RacingTrack, timer: number) {
    const progress = 1 - Math.max(timer - 0.3, 0) / 2.5;
    const fadeIn = Math.min(progress * 4, 1);
    const slideIn = 1 - Math.max(1 - progress * 3, 0);

    ctx.fillStyle = `rgba(0,0,0,${0.82 * fadeIn})`;
    ctx.fillRect(0, 0, CAM_W, CAM_H);
    if (fadeIn < 0.1) return;

    ctx.save();
    ctx.globalAlpha = fadeIn;

    const cardW = 360, cardH = 210;
    const cardX = CAM_W / 2 - cardW / 2;
    const cardY = CAM_H / 2 - cardH / 2 - 20 + (1 - slideIn) * 40;

    // Card
    ctx.fillStyle = "rgba(6,6,20,0.97)";
    ctx.strokeStyle = track.color;
    ctx.lineWidth = 2;
    ctx.shadowColor = track.color;
    ctx.shadowBlur = 40;
    ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, 14); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner glow strip
    const innerGlow = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY);
    innerGlow.addColorStop(0, "transparent");
    innerGlow.addColorStop(0.5, track.color + "22");
    innerGlow.addColorStop(1, "transparent");
    ctx.fillStyle = innerGlow;
    ctx.fillRect(cardX, cardY, cardW, 3);

    ctx.fillStyle = track.color;
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("TRACK SELECTED", CAM_W / 2, cardY + 26);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 30px sans-serif";
    ctx.shadowColor = track.color;
    ctx.shadowBlur = 16;
    ctx.fillText(track.name, CAM_W / 2, cardY + 68);
    ctx.shadowBlur = 0;

    // Difficulty badge
    const diffColors: Record<string, string> = { "Beginner": "#22c55e", "Medium": "#f59e0b", "Expert": "#ef4444" };
    const diffColor = diffColors[track.difficulty] || "#fff";
    ctx.fillStyle = diffColor + "25";
    ctx.strokeStyle = diffColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(CAM_W / 2 - 52, cardY + 80, 104, 22, 11); ctx.fill(); ctx.stroke();
    ctx.fillStyle = diffColor;
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(track.difficulty.toUpperCase(), CAM_W / 2, cardY + 96);

    ctx.fillStyle = "rgba(200,200,220,0.75)";
    ctx.font = "12px sans-serif";
    ctx.fillText(track.description, CAM_W / 2, cardY + 135);

    // Mini track preview
    const bounds = getTrackBounds(track);
    const prevW = 150, prevH = 55;
    const prevX = CAM_W / 2 - prevW / 2;
    const prevY = cardY + 152;
    const prevScale = Math.min(prevW / (bounds.maxX - bounds.minX || 1), prevH / (bounds.maxY - bounds.minY || 1)) * 0.9;
    const prevOffX = prevX - bounds.minX * prevScale + (prevW - (bounds.maxX - bounds.minX) * prevScale) / 2;
    const prevOffY = prevY - bounds.minY * prevScale + (prevH - (bounds.maxY - bounds.minY) * prevScale) / 2;

    ctx.strokeStyle = track.color;
    ctx.lineWidth = track.width * prevScale;
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.shadowColor = track.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(track.points[0].x * prevScale + prevOffX, track.points[0].y * prevScale + prevOffY);
    for (let i = 1; i < track.points.length; i++) ctx.lineTo(track.points[i].x * prevScale + prevOffX, track.points[i].y * prevScale + prevOffY);
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = "#10101e";
    ctx.lineWidth = (track.width - 8) * prevScale;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(track.points[0].x * prevScale + prevOffX, track.points[0].y * prevScale + prevOffY);
    for (let i = 1; i < track.points.length; i++) ctx.lineTo(track.points[i].x * prevScale + prevOffX, track.points[i].y * prevScale + prevOffY);
    ctx.closePath();
    ctx.stroke();

    // Animated dots
    for (let d = 0; d < 3; d++) {
      const dotAlpha = Math.sin(Date.now() / 280 + d * 1.1) * 0.5 + 0.5;
      ctx.globalAlpha = fadeIn * dotAlpha;
      ctx.fillStyle = track.color;
      ctx.beginPath();
      ctx.arc(CAM_W / 2 - 12 + d * 12, cardY + cardH + 16, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawCountdown(ctx: CanvasRenderingContext2D, countdown: number) {
    const text = countdown <= 0 ? "GO!" : countdown.toString();
    const isGo = countdown <= 0;
    const r = 58;
    const pulse = Math.abs(Math.sin(Date.now() / 120)) * 4;

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.arc(CAM_W / 2, CAM_H / 2, r + pulse + 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isGo ? "#00ff80" : "#ffcc00";
    ctx.lineWidth = 3 + pulse * 0.5;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 24 + pulse * 2;
    ctx.beginPath();
    ctx.arc(CAM_W / 2, CAM_H / 2, r + pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = isGo ? "#00ff80" : "#ffcc00";
    ctx.font = `bold ${isGo ? 40 : 52}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 28 + pulse * 3;
    ctx.fillText(text, CAM_W / 2, CAM_H / 2);
    ctx.shadowBlur = 0;
    ctx.textBaseline = "alphabetic";
    ctx.restore();
  }

  function drawFinishScreen(ctx: CanvasRenderingContext2D, state: RacingState, match: MatchWithPlayers, isMyTurn: boolean) {
    if (state.phase === "finished" && state.currentPlayer === "player1") {
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(0, 0, CAM_W, CAM_H);
      ctx.fillStyle = "#ffe080";
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "#ffe080";
      ctx.shadowBlur = 20;
      ctx.fillText(`Finished! ${formatRaceTime(state.player1Time!)}`, CAM_W / 2, CAM_H / 2 - 14);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#aaa";
      ctx.font = "13px sans-serif";
      ctx.fillText("Waiting for Player 2...", CAM_W / 2, CAM_H / 2 + 18);
      ctx.textBaseline = "alphabetic";
      return;
    }
    if (state.phase === "over" && state.winner) {
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.fillRect(0, 0, CAM_W, CAM_H);

      const winLabel = state.winner === "draw" ? "DRAW!"
        : state.winner === "player1"
          ? `${match.player1?.firstName || "Player 1"} WINS!`
          : `${match.player2?.firstName || "Player 2"} WINS!`;
      const winColor = state.winner === "draw" ? "#ffcc00"
        : state.winner === "player1" ? "#ff2d8a" : "#4499ff";

      // Big win text
      ctx.fillStyle = winColor;
      ctx.font = "bold 36px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = winColor;
      ctx.shadowBlur = 40;
      ctx.fillText(winLabel, CAM_W / 2, CAM_H / 2 - 52);
      ctx.shadowBlur = 0;

      // Times box
      ctx.fillStyle = "rgba(4,4,18,0.85)";
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(CAM_W / 2 - 120, CAM_H / 2 - 30, 240, 84, 10); ctx.fill(); ctx.stroke();

      if (state.player1Time !== undefined) {
        ctx.fillStyle = "#ff88bb";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("PLAYER 1", CAM_W / 2, CAM_H / 2 - 14);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 15px monospace";
        ctx.fillText(formatRaceTime(state.player1Time), CAM_W / 2, CAM_H / 2 + 6);
      }
      if (state.player2Time !== undefined) {
        ctx.fillStyle = "#88bbff";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("PLAYER 2", CAM_W / 2, CAM_H / 2 + 30);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 15px monospace";
        ctx.fillText(formatRaceTime(state.player2Time), CAM_W / 2, CAM_H / 2 + 50);
      }
      if (state.player1Time !== undefined && state.player2Time !== undefined) {
        const diff = Math.abs(state.player1Time - state.player2Time);
        ctx.fillStyle = "#888";
        ctx.font = "11px monospace";
        ctx.fillText(`Gap: ${formatRaceTime(diff)}`, CAM_W / 2, CAM_H / 2 + 68);
      }
      ctx.textBaseline = "alphabetic";
    }
  }

  function adjustColor(hex: string, amount: number): string {
    const n = parseInt(hex.replace("#", ""), 16);
    const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
    const b = Math.max(0, Math.min(255, (n & 255) + amount));
    return `rgb(${r},${g},${b})`;
  }

  const handleNextPlayer = () => {
    prevLapRef.current = 0;
    prevCpRef.current = 1;
    setState(prev => startPlayer2Race(prev));
  };

  return (
    <GameLayout match={match} currentUserId={currentUserId} accentColor="#ef4444" accentRgb="239,68,68" controls="WASD / Arrow keys" winCondition="Fastest lap wins" helpItems={[{ label: "Throttle", value: "W / Up Arrow" }, { label: "Brake", value: "S / Down Arrow" }, { label: "Steer", value: "A/D / Left/Right" }, { label: "Mobile", value: "On-screen buttons" }]} className="flex flex-col">
      {showIntro && (
        <MatchIntroAnimation
          playerOneName={match.player1?.firstName || "Player 1"}
          playerTwoName={match.isPractice ? "Bot" : (match.player2?.firstName || "Player 2")}
          playerOneImage={match.player1?.profileImageUrl}
          playerTwoImage={match.isPractice ? undefined : match.player2?.profileImageUrl}
          playerOneStake={parseFloat((match as any).betAmount || "0")}
          playerTwoStake={parseFloat((match as any).betAmount || "0")}
          isPractice={!!(match.isPractice)}
          isBotMatch={!!(match.isBotMatch)}
          gameLabel="Racing"
          winCondition="Fastest lap wins"
          timeLimit="3 laps"
          disconnectPolicy="5-min reconnect window"
          onComplete={() => setShowIntro(false)}
        />
      )}
      {/* Header */}
      <div className="border-b shrink-0" style={{ background: "rgba(0,0,0,0.35)", borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="button-back-racing">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="text-xl font-bold text-white/90">Racing</h2>
              <Badge variant="secondary" className="text-xs" style={{ color: state.track.color }}>
                {state.track.name} · {state.track.difficulty}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {[match.player1, match.player2].map((p, i) => {
              const time = i === 0 ? state.player1Time : state.player2Time;
              const isActive = state.currentPlayer === (i === 0 ? "player1" : "player2");
              return (
                <div key={i} className="flex items-center gap-2">
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={p?.profileImageUrl || undefined} />
                    <AvatarFallback className="text-xs">{p?.firstName?.[0] || (i === 0 ? "P1" : "P2")}</AvatarFallback>
                  </Avatar>
                  <div className="text-center">
                    <div className="text-xs text-white/40">{p?.firstName || (i === 0 ? "P1" : "P2")}</div>
                    {time !== undefined ? (
                      <div className={`font-mono text-xs font-bold ${i === 0 ? "text-pink-400" : "text-blue-400"}`}>
                        {formatRaceTime(time)}
                      </div>
                    ) : (
                      <div className="text-xs text-white/30">{isActive ? "Racing..." : "Waiting"}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Game area */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 py-3 gap-3">
        {/* Canvas + lap flash overlay */}
        <div className="relative rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <canvas
            ref={canvasRef}
            width={CAM_W}
            height={CAM_H}
            style={{ maxWidth: "100%", height: "auto", display: "block", margin: "0 auto", background: "#060610" }}
            data-testid="canvas-racing-track"
          />
          {/* Lap complete banner */}
          <AnimatePresence>
            {lapFlash && (
              <motion.div
                key={`lap-${lapFlash.lap}`}
                initial={{ opacity: 0, scaleX: 0.6 }}
                animate={{ opacity: 1, scaleX: 1 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.22, exit: { duration: 0.4, delay: 1.4 } }}
                className="absolute inset-x-0 top-1/4 flex items-center justify-center pointer-events-none"
              >
                <div className="px-8 py-3 rounded-xl text-center"
                  style={{ background: "rgba(4,4,20,0.92)", border: "1.5px solid rgba(255,255,255,0.15)", boxShadow: `0 0 40px ${state.track.color}66` }}>
                  {lapFlash.lap >= lapFlash.total ? (
                    <div className="text-2xl font-bold text-yellow-300" style={{ textShadow: "0 0 20px #ffcc00" }}>
                      FINAL LAP COMPLETE!
                    </div>
                  ) : (
                    <>
                      <div className="text-xs text-muted-foreground tracking-widest mb-0.5">LAP COMPLETE</div>
                      <div className="text-2xl font-bold" style={{ color: state.track.color, textShadow: `0 0 16px ${state.track.color}` }}>
                        LAP {lapFlash.lap} / {lapFlash.total}
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* "Next Player" button */}
        {state.phase === "finished" && state.currentPlayer === "player1" && !isPlayer1 && (
          <div className="text-center">
            <Button onClick={handleNextPlayer} size="lg" className="w-full max-w-sm" data-testid="button-start-p2-race">
              <Flag className="w-4 h-4 mr-2" />
              Start Your Race!
            </Button>
          </div>
        )}

        {/* Done screen */}
        {state.phase === "over" && (
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => setLocation("/")} data-testid="button-back-home-racing">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Home
            </Button>
            {match.isPractice && (
              <Button onClick={() => {
                prevLapRef.current = 0;
                prevCpRef.current = 1;
                setState(createRacingState(trackIndex));
              }} data-testid="button-race-again">
                Race Again
              </Button>
            )}
          </div>
        )}

        {/* Desktop controls hint */}
        {isMyTurn && (state.phase === "racing" || state.phase === "countdown") && (
          <div className="hidden sm:flex items-center justify-center gap-6 text-xs text-white/40">
            <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs">W</kbd> / <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs">↑</kbd> Throttle</span>
            <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs">A</kbd><kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs">D</kbd> / <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs">←</kbd><kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs">→</kbd> Steer</span>
            <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs">S</kbd> / <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs">↓</kbd> Brake</span>
          </div>
        )}

        {/* Mobile touch controls */}
        {isMyTurn && (state.phase === "racing" || state.phase === "countdown") && (
          <div className="sm:hidden flex items-end justify-between px-2 pb-2 gap-4">
            <div className="flex gap-3">
              <Button size="lg" variant="outline" className="w-16 h-16 touch-none select-none text-xl"
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setTouchLeft(true); }}
                onPointerUp={() => setTouchLeft(false)} onPointerCancel={() => setTouchLeft(false)}
                data-testid="button-touch-left">
                <ChevronLeft className="w-7 h-7" />
              </Button>
              <Button size="lg" variant="outline" className="w-16 h-16 touch-none select-none text-xl"
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setTouchRight(true); }}
                onPointerUp={() => setTouchRight(false)} onPointerCancel={() => setTouchRight(false)}
                data-testid="button-touch-right">
                <ChevronRight className="w-7 h-7" />
              </Button>
            </div>
            <div className="flex flex-col gap-3">
              <Button size="lg" className="w-20 h-14 touch-none select-none bg-green-600"
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setTouchThrottle(true); }}
                onPointerUp={() => setTouchThrottle(false)} onPointerCancel={() => setTouchThrottle(false)}
                data-testid="button-touch-throttle">
                <ChevronUp className="w-6 h-6" />
              </Button>
              <Button size="lg" variant="outline" className="w-20 h-12 touch-none select-none"
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setTouchBrake(true); }}
                onPointerUp={() => setTouchBrake(false)} onPointerCancel={() => setTouchBrake(false)}
                data-testid="button-touch-brake">
                <ChevronDown className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </GameLayout>
  );
}
