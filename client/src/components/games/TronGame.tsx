import { useEffect, useRef, useState, useCallback } from "react";
import MatchIntroAnimation from "@/components/MatchIntroAnimation";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MatchWithPlayers } from "@shared/schema";
import { emitFeedEvent, EventFeed, GameHUD, StreakBadge, CurrencyBadge, ShopButton } from "./GameHUD";
import { GameLayout } from "@/components/games/GameLayout";
import { Zap, Shield, Expand, Swords, Wifi, WifiOff } from "lucide-react";
import { useMobileControls } from "@/lib/mobileControls";

// ─── Constants ───────────────────────────────────────────────────────────────

const CANVAS_W = 800;
const CANVAS_H = 520;
const CELL = 10;
const COLS = CANVAS_W / CELL;
const ROWS = CANVAS_H / CELL;

const DIR_VEC: Record<string, { x: number; y: number }> = {
  UP:    { x: 0,  y: -1 },
  DOWN:  { x: 0,  y: 1  },
  LEFT:  { x: -1, y: 0  },
  RIGHT: { x: 1,  y: 0  },
};

const OPPOSITE: Record<string, string> = {
  UP: "DOWN", DOWN: "UP", LEFT: "RIGHT", RIGHT: "LEFT",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type Dir = "UP" | "DOWN" | "LEFT" | "RIGHT";

interface PowerUpInstance {
  id: string;
  type: PowerUpType;
  col: number;
  row: number;
  spawnTime: number;
  duration: number; // ms — 0 = instant
}

interface ActivePowerUp {
  type: PowerUpType;
  expiresAt: number;
}

type PowerUpType = "speed" | "phase" | "thick" | "shrink" | "emp";

interface Bike {
  id: number;
  col: number;
  row: number;
  dir: Dir;
  pendingDir: Dir;
  trail: Array<{ col: number; row: number }>;
  color: string;
  glowColor: string;
  alive: boolean;
  activePowerUps: ActivePowerUp[];
  isBot: boolean;
  score: number;
  winStreak: number;
}

interface GameState {
  bikes: Bike[];
  powerUps: PowerUpInstance[];
  phase: "countdown" | "playing" | "roundEnd" | "matchEnd";
  countdownValue: number;
  roundWinnerId: number | null;
  matchWinnerId: number | null;
  tick: number;
  frameTs: number;
}

// ─── Bot difficulty profiles ─────────────────────────────────────────────────

const BOT_PROFILES = {
  easy:   { reactionDelay: 4, lookahead: 3, aggression: 0.25, mistake: 0.18 },
  medium: { reactionDelay: 2, lookahead: 5, aggression: 0.45, mistake: 0.09 },
  hard:   { reactionDelay: 1, lookahead: 8, aggression: 0.70, mistake: 0.03 },
};

// ─── Power-up metadata ───────────────────────────────────────────────────────

const POWER_UP_META: Record<PowerUpType, {
  label: string; color: string; glow: string; duration: number; icon: string;
}> = {
  speed:  { label: "Speed",   color: "#facc15", glow: "#facc1580", duration: 6000,  icon: "⚡" },
  phase:  { label: "Phase",   color: "#38bdf8", glow: "#38bdf880", duration: 3500,  icon: "⊙" },
  thick:  { label: "Thick",   color: "#fb923c", glow: "#fb923c80", duration: 5000,  icon: "▣" },
  shrink: { label: "Shrink",  color: "#4ade80", glow: "#4ade8080", duration: 5000,  icon: "◎" },
  emp:    { label: "EMP",     color: "#a78bfa", glow: "#a78bfa80", duration: 0,     icon: "⋆" },
};

// ─── Audio context (singleton) ───────────────────────────────────────────────

let _ac: AudioContext | null = null;
function getAC(): AudioContext {
  if (!_ac) _ac = new AudioContext();
  return _ac;
}
function resumeAC() { if (_ac?.state === "suspended") _ac.resume(); }

function playTone(freq: number, type: OscillatorType = "square", dur = 0.1, vol = 0.12) {
  try {
    const ac = getAC();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + dur);
  } catch (_) {}
}

function playCrash()    { playTone(80,  "sawtooth", 0.25, 0.2); }
function playPickup(t: PowerUpType) {
  const freqMap: Record<PowerUpType, number> = { speed: 880, phase: 660, thick: 550, shrink: 770, emp: 440 };
  playTone(freqMap[t], "triangle", 0.18, 0.15);
}
function playRoundWin() {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, "triangle", 0.22, 0.14), i * 100));
}
function playCountdown(n: number) { playTone(n === 0 ? 1047 : 440, "square", 0.08, 0.1); }
function playMove() { playTone(220, "square", 0.03, 0.04); }
function playEMP() { playTone(120, "sawtooth", 0.4, 0.25); }

// ─── Trail grid lookup (fast O(1)) ───────────────────────────────────────────

type TrailGrid = Uint8Array; // 1 if occupied

function buildTrailGrid(bikes: Bike[]): TrailGrid {
  const grid = new Uint8Array(COLS * ROWS);
  for (const bike of bikes) {
    for (const { col, row } of bike.trail) {
      if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
        grid[row * COLS + col] = 1;
      }
    }
    if (bike.alive) {
      if (bike.col >= 0 && bike.col < COLS && bike.row >= 0 && bike.row < ROWS) {
        grid[bike.row * COLS + bike.col] = 1;
      }
    }
  }
  return grid;
}

function checkHit(col: number, row: number, grid: TrailGrid): boolean {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
  return grid[row * COLS + col] === 1;
}

// ─── Bot AI ──────────────────────────────────────────────────────────────────

function getBotDir(
  bot: Bike,
  bikes: Bike[],
  profile: typeof BOT_PROFILES.medium,
  tick: number
): Dir {
  if (tick % Math.max(1, profile.reactionDelay) !== 0) return bot.pendingDir;
  if (Math.random() < profile.mistake) return bot.pendingDir;

  const grid = buildTrailGrid(bikes);
  const dirs: Dir[] = ["UP", "DOWN", "LEFT", "RIGHT"];
  const validDirs = dirs.filter((d) => {
    if (d === OPPOSITE[bot.pendingDir]) return false;
    const v = DIR_VEC[d];
    const nc = bot.col + v.x;
    const nr = bot.row + v.y;
    return !checkHit(nc, nr, grid);
  });

  if (validDirs.length === 0) return bot.pendingDir;

  // Score each direction by how much space is reachable (simple flood-fill lookahead)
  let bestDir = validDirs[0];
  let bestScore = -1;
  for (const d of validDirs) {
    const v = DIR_VEC[d];
    let score = 0;
    let cc = bot.col + v.x;
    let cr = bot.row + v.y;
    // Simple N-step lookahead
    for (let step = 0; step < profile.lookahead; step++) {
      if (checkHit(cc, cr, grid)) break;
      score++;
      cc += v.x;
      cr += v.y;
    }
    if (score > bestScore) {
      bestScore = score;
      bestDir = d;
    }
  }

  return bestDir;
}

// ─── Initial game state ───────────────────────────────────────────────────────

function makeInitialState(isPractice: boolean, botDifficulty: string): GameState {
  const bikes: Bike[] = [
    {
      id: 0,
      col: Math.floor(COLS * 0.2),
      row: Math.floor(ROWS / 2),
      dir: "RIGHT",
      pendingDir: "RIGHT",
      trail: [],
      color: "#22d3ee",
      glowColor: "#22d3ee80",
      alive: true,
      activePowerUps: [],
      isBot: false,
      score: 0,
      winStreak: 0,
    },
    {
      id: 1,
      col: Math.floor(COLS * 0.8),
      row: Math.floor(ROWS / 2),
      dir: "LEFT",
      pendingDir: "LEFT",
      trail: [],
      color: "#f472b6",
      glowColor: "#f472b680",
      alive: true,
      activePowerUps: [],
      isBot: isPractice,
      score: 0,
      winStreak: 0,
    },
  ];
  return {
    bikes,
    powerUps: [],
    phase: "countdown",
    countdownValue: 3,
    roundWinnerId: null,
    matchWinnerId: null,
    tick: 0,
    frameTs: 0,
  };
}

// ─── Arena Themes ────────────────────────────────────────────────────────────

export type ArenaTheme = "classic" | "neon-city" | "lava" | "ice" | "tournament";

interface ArenaThemeDef {
  id: ArenaTheme;
  label: string;
  bg: string;
  gridColor: string;
  borderStops: [string, string, string];
  scanlines?: boolean;
  emberGlow?: boolean;
  iceShimmer?: boolean;
  borderWidth?: number;
}

export const ARENA_THEMES: Record<ArenaTheme, ArenaThemeDef> = {
  "classic": {
    id: "classic",
    label: "Classic Grid",
    bg: "#040414",
    gridColor: "rgba(100,100,200,0.08)",
    borderStops: ["rgba(139,92,246,0.6)", "rgba(59,130,246,0.3)", "rgba(236,72,153,0.6)"],
  },
  "neon-city": {
    id: "neon-city",
    label: "Neon City",
    bg: "#0a0218",
    gridColor: "rgba(217,70,239,0.10)",
    borderStops: ["rgba(217,70,239,0.7)", "rgba(34,211,238,0.4)", "rgba(217,70,239,0.7)"],
    scanlines: true,
    borderWidth: 3,
  },
  "lava": {
    id: "lava",
    label: "Lava Core",
    bg: "#15050a",
    gridColor: "rgba(251,113,133,0.10)",
    borderStops: ["rgba(251,113,133,0.7)", "rgba(245,158,11,0.5)", "rgba(251,113,133,0.7)"],
    emberGlow: true,
    borderWidth: 3,
  },
  "ice": {
    id: "ice",
    label: "Ice Wireframe",
    bg: "#02141c",
    gridColor: "rgba(34,211,238,0.14)",
    borderStops: ["rgba(34,211,238,0.7)", "rgba(165,243,252,0.4)", "rgba(34,211,238,0.7)"],
    iceShimmer: true,
  },
  "tournament": {
    id: "tournament",
    label: "Tournament",
    bg: "#0a0810",
    gridColor: "rgba(250,204,21,0.10)",
    borderStops: ["rgba(250,204,21,0.8)", "rgba(245,158,11,0.5)", "rgba(250,204,21,0.8)"],
    borderWidth: 4,
  },
};

// ─── Renderer ────────────────────────────────────────────────────────────────

function drawNeonGrid(ctx: CanvasRenderingContext2D, ts: number, theme: ArenaTheme = "classic") {
  const t = (Object.prototype.hasOwnProperty.call(ARENA_THEMES, theme) ? ARENA_THEMES[theme] : ARENA_THEMES.classic) ?? ARENA_THEMES.classic;

  // Background
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Lava ember underglow
  if (t.emberGlow) {
    const grad = ctx.createRadialGradient(CANVAS_W / 2, CANVAS_H, 0, CANVAS_W / 2, CANVAS_H, CANVAS_H);
    grad.addColorStop(0, "rgba(251,113,133,0.18)");
    grad.addColorStop(0.5, "rgba(245,158,11,0.06)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  // Ice shimmer
  if (t.iceShimmer) {
    const shimmer = (Math.sin(ts / 600) + 1) / 2;
    const grad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
    grad.addColorStop(0, `rgba(165,243,252,${0.04 + shimmer * 0.04})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  // Animated grid
  const drift = (ts / 4000) % 1;
  ctx.strokeStyle = t.gridColor;
  ctx.lineWidth = 0.5;
  for (let c = -1; c <= COLS + 1; c++) {
    const x = (c + drift) * CELL;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_H);
    ctx.stroke();
  }
  for (let r = -1; r <= ROWS + 1; r++) {
    const y = (r + drift) * CELL;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_W, y);
    ctx.stroke();
  }

  // Neon city scanlines overlay
  if (t.scanlines) {
    ctx.fillStyle = "rgba(255,255,255,0.025)";
    const scanOffset = Math.floor((ts / 30) % 4);
    for (let y = scanOffset; y < CANVAS_H; y += 4) {
      ctx.fillRect(0, y, CANVAS_W, 1);
    }
  }

  // Arena border glow
  const grd = ctx.createLinearGradient(0, 0, CANVAS_W, 0);
  grd.addColorStop(0,   t.borderStops[0]);
  grd.addColorStop(0.5, t.borderStops[1]);
  grd.addColorStop(1,   t.borderStops[2]);
  ctx.strokeStyle = grd;
  ctx.lineWidth = t.borderWidth ?? 2;
  ctx.strokeRect(1, 1, CANVAS_W - 2, CANVAS_H - 2);
}

function drawTrail(
  ctx: CanvasRenderingContext2D,
  bike: Bike,
  now: number
) {
  const thick = hasActivePowerUp(bike, "thick") ? 2.2 : 1;
  ctx.shadowBlur = 8 * thick;
  ctx.shadowColor = bike.glowColor;
  ctx.fillStyle = bike.color;
  for (let i = 0; i < bike.trail.length; i++) {
    const { col, row } = bike.trail[i];
    const alpha = Math.min(1, (i + 1) / Math.max(bike.trail.length, 1));
    ctx.globalAlpha = 0.35 + alpha * 0.65;
    ctx.fillRect(col * CELL + 1, row * CELL + 1, CELL * thick - 1, CELL * thick - 1);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function drawBike(
  ctx: CanvasRenderingContext2D,
  bike: Bike,
  now: number
) {
  if (!bike.alive) return;
  const shrink = hasActivePowerUp(bike, "shrink");
  const phase  = hasActivePowerUp(bike, "phase");
  const size   = shrink ? 5 : 8;
  const cx = bike.col * CELL + CELL / 2;
  const cy = bike.row * CELL + CELL / 2;

  ctx.save();
  ctx.globalAlpha = phase ? 0.55 : 1;
  ctx.shadowBlur = 18;
  ctx.shadowColor = bike.glowColor;

  // Outer glow ring
  ctx.beginPath();
  ctx.arc(cx, cy, size + 3, 0, Math.PI * 2);
  ctx.fillStyle = bike.glowColor;
  ctx.fill();

  // Core
  ctx.beginPath();
  ctx.arc(cx, cy, size, 0, Math.PI * 2);
  ctx.fillStyle = bike.color;
  ctx.fill();

  // White hot center
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.restore();
}

function drawPowerUp(ctx: CanvasRenderingContext2D, pu: PowerUpInstance, now: number) {
  const meta = POWER_UP_META[pu.type];
  const cx = pu.col * CELL + CELL / 2;
  const cy = pu.row * CELL + CELL / 2;
  const pulse = 0.8 + 0.2 * Math.sin((now / 400) * Math.PI * 2);

  ctx.save();
  ctx.shadowBlur = 20 * pulse;
  ctx.shadowColor = meta.glow;

  // Rotating ring
  ctx.strokeStyle = meta.color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 11 * pulse, 0, Math.PI * 2);
  ctx.stroke();

  // Core
  ctx.fillStyle = meta.color + "30";
  ctx.beginPath();
  ctx.arc(cx, cy, 9 * pulse, 0, Math.PI * 2);
  ctx.fill();

  // Icon (text)
  ctx.fillStyle = meta.color;
  ctx.font = `bold ${10 * pulse}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(meta.icon, cx, cy);

  ctx.restore();
}

function drawExplosion(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  color: string,
  progress: number
) {
  const cx = col * CELL + CELL / 2;
  const cy = row * CELL + CELL / 2;
  const inv = 1 - progress;
  ctx.save();

  // Hot white core flash (first 25% of life)
  if (progress < 0.25) {
    const coreAlpha = 1 - progress / 0.25;
    ctx.globalAlpha = coreAlpha;
    ctx.shadowBlur = 50;
    ctx.shadowColor = "#ffffff";
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx, cy, 14 * coreAlpha, 0, Math.PI * 2);
    ctx.fill();
  }

  // Expanding shockwave ring
  ctx.globalAlpha = inv * 0.7;
  ctx.shadowBlur = 30 * inv;
  ctx.shadowColor = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5 * inv;
  ctx.beginPath();
  ctx.arc(cx, cy, progress * 80, 0, Math.PI * 2);
  ctx.stroke();

  // 16 outward shrapnel particles (deterministic per-explosion via col+row hash)
  ctx.globalAlpha = inv;
  ctx.shadowBlur = 14 * inv;
  ctx.shadowColor = color;
  const seed = (col * 73856093) ^ (row * 19349663);
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const variance = (((seed >> i) & 0xf) / 15) * 0.4 + 0.8;
    const dist = progress * 70 * variance;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    ctx.fillStyle = i % 2 === 0 ? color : "#fde68a";
    ctx.beginPath();
    ctx.arc(x, y, 2.5 * inv * variance, 0, Math.PI * 2);
    ctx.fill();
  }

  // Smoke wisps trailing the blast
  ctx.globalAlpha = inv * 0.3;
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(120,120,140,0.5)";
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + progress * 0.8;
    const dist = progress * 50;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, 6 * inv, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawPickupRing(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  color: string,
  progress: number
) {
  const cx = col * CELL + CELL / 2;
  const cy = row * CELL + CELL / 2;
  const inv = 1 - progress;
  ctx.save();
  // Outer expanding ring
  ctx.globalAlpha = inv * 0.9;
  ctx.shadowBlur = 22 * inv;
  ctx.shadowColor = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * inv;
  ctx.beginPath();
  ctx.arc(cx, cy, 6 + progress * 32, 0, Math.PI * 2);
  ctx.stroke();
  // Inner faster ring
  ctx.globalAlpha = inv * 0.7;
  ctx.lineWidth = 1.5 * inv;
  ctx.beginPath();
  ctx.arc(cx, cy, 4 + progress * 22, 0, Math.PI * 2);
  ctx.stroke();
  // Spark burst
  ctx.shadowBlur = 8 * inv;
  ctx.fillStyle = "#fde68a";
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const dist = 5 + progress * 26;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, 1.6 * inv, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasActivePowerUp(bike: Bike, type: PowerUpType): boolean {
  const now = Date.now();
  return bike.activePowerUps.some((p) => p.type === type && p.expiresAt > now);
}

function spawnPowerUp(powerUps: PowerUpInstance[], bikes: Bike[]): PowerUpInstance | null {
  if (powerUps.length >= 3) return null;
  const grid = buildTrailGrid(bikes);
  for (let attempt = 0; attempt < 30; attempt++) {
    const col = Math.floor(Math.random() * (COLS - 10)) + 5;
    const row = Math.floor(Math.random() * (ROWS - 6)) + 3;
    if (!checkHit(col, row, grid)) {
      const types: PowerUpType[] = ["speed", "phase", "thick", "shrink", "emp"];
      const type = types[Math.floor(Math.random() * types.length)];
      const meta = POWER_UP_META[type];
      return {
        id: `${Date.now()}-${Math.random()}`,
        type,
        col,
        row,
        spawnTime: Date.now(),
        duration: meta.duration,
      };
    }
  }
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TronGameProps {
  match: MatchWithPlayers;
  currentUserId?: string;
}

export function TronGame({ match, currentUserId }: TronGameProps) {
  const isPractice = !!(
    (match as any).isPractice ||
    (match as any).isBotMatch ||
    match.status === "practice"
  );
  const botDifficulty: keyof typeof BOT_PROFILES =
    ((match as any).botDifficulty as any) || "medium";

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const stateRef   = useRef<GameState>(makeInitialState(isPractice, botDifficulty));
  const rafRef     = useRef<number>(0);
  const keyQueue   = useRef<string[]>([]);
  const lastTickTs = useRef<number>(0);
  const spawnTimer = useRef<number>(0);
  const countTimer = useRef<number>(0);
  const explosions = useRef<Array<{ col: number; row: number; color: string; startTs: number }>>([]);
  const pickupRings = useRef<Array<{ col: number; row: number; color: string; startTs: number }>>([]);
  const [showIntro, setShowIntro] = useState(true);
  const mobileCtrl = useMobileControls();
  const [arenaTheme, setArenaTheme] = useState<ArenaTheme>(() => {
    try {
      const saved = localStorage.getItem("tron-arena-theme") as ArenaTheme | null;
      if (saved && Object.prototype.hasOwnProperty.call(ARENA_THEMES, saved)) return saved;
    } catch {}
    return "classic";
  });
  const arenaThemeRef = useRef<ArenaTheme>(arenaTheme);
  useEffect(() => {
    arenaThemeRef.current = arenaTheme;
    try { localStorage.setItem("tron-arena-theme", arenaTheme); } catch {}
  }, [arenaTheme]);
  const [uiState, setUiState] = useState<{
    phase: GameState["phase"];
    countdownValue: number;
    roundWinnerId: number | null;
    matchWinnerId: number | null;
    bikes: Array<{ id: number; score: number; alive: boolean; activePowerUps: ActivePowerUp[] }>;
  }>({
    phase: "countdown",
    countdownValue: 3,
    roundWinnerId: null,
    matchWinnerId: null,
    bikes: [],
  });

  // Resolve tick speed based on power-ups
  const getTickMs = useCallback((bike: Bike) => {
    return hasActivePowerUp(bike, "speed") ? 55 : 80;
  }, []);

  const resetRound = useCallback(() => {
    const s = stateRef.current;
    const bikes = s.bikes.map((b, i) => ({
      ...b,
      col: i === 0 ? Math.floor(COLS * 0.2) : Math.floor(COLS * 0.8),
      row: Math.floor(ROWS / 2),
      dir: i === 0 ? "RIGHT" as Dir : "LEFT" as Dir,
      pendingDir: i === 0 ? "RIGHT" as Dir : "LEFT" as Dir,
      trail: [],
      alive: true,
      activePowerUps: [],
    }));
    stateRef.current = {
      ...s,
      bikes,
      powerUps: [],
      phase: "countdown",
      countdownValue: 3,
      roundWinnerId: null,
      tick: 0,
    };
    countTimer.current = Date.now();
    spawnTimer.current = Date.now() + 4000;
    explosions.current = [];
    pickupRings.current = [];
    lastTickTs.current = 0;
  }, []);

  // ── Main game loop ─────────────────────────────────────────────────────────
  const tick = useCallback((now: number) => {
    rafRef.current = requestAnimationFrame(tick);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const s = stateRef.current;

    // ── Draw ────────────────────────────────────────────────────────────────
    drawNeonGrid(ctx, now, arenaThemeRef.current);

    // Power-ups
    for (const pu of s.powerUps) {
      drawPowerUp(ctx, pu, now);
    }

    // Trails
    for (const bike of s.bikes) {
      drawTrail(ctx, bike, now);
    }

    // Bikes
    for (const bike of s.bikes) {
      drawBike(ctx, bike, now);
    }

    // Explosions
    const activeExp = explosions.current.filter((e) => now - e.startTs < 700);
    for (const e of activeExp) {
      drawExplosion(ctx, e.col, e.row, e.color, (now - e.startTs) / 700);
    }
    explosions.current = activeExp;

    // Pickup rings
    const activeRings = pickupRings.current.filter((r) => now - r.startTs < 450);
    for (const r of activeRings) {
      drawPickupRing(ctx, r.col, r.row, r.color, (now - r.startTs) / 450);
    }
    pickupRings.current = activeRings;

    // Countdown overlay
    if (s.phase === "countdown") {
      ctx.fillStyle = "rgba(4,4,20,0.55)";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      const elapsed = now - countTimer.current;
      const remaining = Math.ceil(3 - elapsed / 1000);
      if (remaining !== s.countdownValue) {
        playCountdown(remaining <= 0 ? 0 : remaining);
        s.countdownValue = remaining;
      }
      if (remaining <= 0) {
        s.phase = "playing";
        lastTickTs.current = now;
        stateRef.current = { ...s };
      } else {
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowBlur = 40;
        ctx.shadowColor = "#a78bfa";
        ctx.font = `bold ${80 + (3 - remaining) * 15}px monospace`;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(remaining <= 0 ? "GO!" : String(remaining), CANVAS_W / 2, CANVAS_H / 2);
        ctx.restore();
      }
      setUiState((prev) => ({ ...prev, phase: s.phase, countdownValue: remaining }));
      return;
    }

    if (s.phase === "roundEnd" || s.phase === "matchEnd") {
      setUiState((prev) => ({
        ...prev,
        phase: s.phase,
        roundWinnerId: s.roundWinnerId,
        matchWinnerId: s.matchWinnerId,
        bikes: s.bikes.map((b) => ({ id: b.id, score: b.score, alive: b.alive, activePowerUps: b.activePowerUps })),
      }));
      return;
    }

    // ── Game tick ────────────────────────────────────────────────────────────
    const player0 = s.bikes.find((b) => !b.isBot);
    const baseTickMs = getTickMs(player0 ?? s.bikes[0]);
    if (now - lastTickTs.current < baseTickMs) {
      setUiState((prev) => ({
        ...prev,
        bikes: s.bikes.map((b) => ({ id: b.id, score: b.score, alive: b.alive, activePowerUps: b.activePowerUps })),
      }));
      return;
    }
    lastTickTs.current = now;

    // Process key queue for player
    const dirMap: Record<string, Dir> = {
      ArrowUp: "UP", ArrowDown: "DOWN", ArrowLeft: "LEFT", ArrowRight: "RIGHT",
      w: "UP", s: "DOWN", a: "LEFT", d: "RIGHT",
      W: "UP", S: "DOWN", A: "LEFT", D: "RIGHT",
    };
    while (keyQueue.current.length > 0) {
      const key = keyQueue.current.shift()!;
      const dir = dirMap[key];
      if (dir && player0 && dir !== OPPOSITE[player0.pendingDir]) {
        player0.pendingDir = dir;
        break;
      }
    }

    // Bot decision
    const bots = s.bikes.filter((b) => b.isBot && b.alive);
    for (const bot of bots) {
      const profile = BOT_PROFILES[botDifficulty];
      bot.pendingDir = getBotDir(bot, s.bikes, profile, s.tick);
    }

    // Move bikes
    const grid = buildTrailGrid(s.bikes.filter((b) => b.alive));
    const nowMs = Date.now();

    for (const bike of s.bikes) {
      if (!bike.alive) continue;
      bike.dir = bike.pendingDir;
      const v = DIR_VEC[bike.dir];
      const nextCol = bike.col + v.x;
      const nextRow = bike.row + v.y;

      const phaseActive = hasActivePowerUp(bike, "phase");
      const hitWall = nextCol < 0 || nextCol >= COLS || nextRow < 0 || nextRow >= ROWS;
      const hitTrail = !hitWall && checkHit(nextCol, nextRow, grid);

      if ((hitWall || hitTrail) && !phaseActive) {
        bike.alive = false;
        explosions.current.push({ col: bike.col, row: bike.row, color: bike.color, startTs: now });
        playCrash();
      } else {
        bike.trail.push({ col: bike.col, row: bike.row });
        if (phaseActive && hitWall) {
          // Wrap through walls
          bike.col = ((nextCol % COLS) + COLS) % COLS;
          bike.row = ((nextRow % ROWS) + ROWS) % ROWS;
        } else {
          // Normal move (or phase through trail — just move forward)
          bike.col = nextCol;
          bike.row = nextRow;
        }
      }

      // Check power-up collision
      for (let pi = s.powerUps.length - 1; pi >= 0; pi--) {
        const pu = s.powerUps[pi];
        if (pu.col === bike.col && pu.row === bike.row) {
          s.powerUps.splice(pi, 1);
          playPickup(pu.type);
          emitFeedEvent({ kind: "combo", label: POWER_UP_META[pu.type].label + "!" });
          pickupRings.current.push({ col: bike.col, row: bike.row, color: POWER_UP_META[pu.type].color, startTs: now });

          if (pu.type === "emp") {
            // Remove nearby trails
            const empRange = 8;
            for (const other of s.bikes) {
              if (other.id === bike.id) continue;
              other.trail = other.trail.filter(
                (t) => Math.abs(t.col - bike.col) + Math.abs(t.row - bike.row) > empRange
              );
            }
            playEMP();
          } else {
            bike.activePowerUps.push({
              type: pu.type,
              expiresAt: nowMs + POWER_UP_META[pu.type].duration,
            });
          }
        }
      }

      // Expire power-ups
      bike.activePowerUps = bike.activePowerUps.filter((p) => p.expiresAt > nowMs);
    }

    // Spawn power-ups
    if (now > spawnTimer.current) {
      const pu = spawnPowerUp(s.powerUps, s.bikes);
      if (pu) s.powerUps.push(pu);
      spawnTimer.current = now + 5000 + Math.random() * 4000;
    }

    // Check round end
    const alive = s.bikes.filter((b) => b.alive);
    if (alive.length <= 1) {
      const winner = alive[0] ?? null;
      if (winner) {
        winner.score++;
        winner.winStreak++;
        emitFeedEvent({ kind: "streak", label: `Round Win!` });
        playRoundWin();
        for (const b of s.bikes) {
          if (b.id !== winner.id) b.winStreak = 0;
        }
      }
      s.roundWinnerId = winner?.id ?? null;

      const TARGET_WINS = 3;
      if (winner && winner.score >= TARGET_WINS) {
        s.phase = "matchEnd";
        s.matchWinnerId = winner.id;
        emitFeedEvent({ kind: "matchpoint", label: winner.isBot ? "Bot Wins!" : "You Win!" });
      } else {
        s.phase = "roundEnd";
        setTimeout(() => {
          resetRound();
        }, 2400);
      }
    }

    s.tick++;
    setUiState({
      phase: s.phase,
      countdownValue: s.countdownValue,
      roundWinnerId: s.roundWinnerId,
      matchWinnerId: s.matchWinnerId,
      bikes: s.bikes.map((b) => ({ id: b.id, score: b.score, alive: b.alive, activePowerUps: b.activePowerUps })),
    });
  }, [getTickMs, resetRound, botDifficulty]);

  // ── Start / cleanup ────────────────────────────────────────────────────────
  useEffect(() => {
    stateRef.current = makeInitialState(isPractice, botDifficulty);
    countTimer.current = performance.now();
    spawnTimer.current = performance.now() + 5000;
    explosions.current = [];
    pickupRings.current = [];
    lastTickTs.current = 0;
    keyQueue.current = [];

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick, isPractice, botDifficulty]);

  // ── Keyboard input ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      resumeAC();
      const relevant = ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","w","s","a","d","W","S","A","D"];
      if (relevant.includes(e.key)) {
        e.preventDefault();
        keyQueue.current.push(e.key);
        playMove();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Touch / swipe input ────────────────────────────────────────────────────
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onStart = (e: TouchEvent) => {
      resumeAC();
      const t = e.touches[0];
      touchStart.current = { x: t.clientX, y: t.clientY };
    };
    const onEnd = (e: TouchEvent) => {
      if (!touchStart.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStart.current.x;
      const dy = t.clientY - touchStart.current.y;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (Math.max(absX, absY) < 20) { touchStart.current = null; return; }
      const dir = absX > absY ? (dx > 0 ? "ArrowRight" : "ArrowLeft") : (dy > 0 ? "ArrowDown" : "ArrowUp");
      keyQueue.current.push(dir);
      playMove();
      touchStart.current = null;
    };
    canvas.addEventListener("touchstart", onStart, { passive: true });
    canvas.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      canvas.removeEventListener("touchstart", onStart);
      canvas.removeEventListener("touchend", onEnd);
    };
  }, []);

  // Programmatic direction tap (used by on-screen D-pad)
  const tapDir = useCallback((key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight") => {
    resumeAC();
    keyQueue.current.push(key);
    playMove();
  }, []);

  const handleRestart = () => {
    stateRef.current = makeInitialState(isPractice, botDifficulty);
    countTimer.current = performance.now();
    spawnTimer.current = performance.now() + 5000;
    explosions.current = [];
    pickupRings.current = [];
    lastTickTs.current = 0;
    keyQueue.current = [];
  };

  const myBike   = uiState.bikes.find((b) => b.id === 0);
  const oppBike  = uiState.bikes.find((b) => b.id === 1);

  return (
    <GameLayout match={match} currentUserId={currentUserId} accentColor="#a3e635" accentRgb="163,230,53" compact showPills={false}>
      {showIntro && (
        <MatchIntroAnimation
          playerOneName={match.player1?.firstName || "Player 1"}
          playerTwoName={isPractice ? "Bot" : (match.player2?.firstName || "Player 2")}
          playerOneImage={match.player1?.profileImageUrl}
          playerTwoImage={isPractice ? undefined : match.player2?.profileImageUrl}
          playerOneStake={parseFloat((match as any).betAmount || "0")}
          playerTwoStake={parseFloat((match as any).betAmount || "0")}
          isPractice={!!(match as any).isPractice}
          isBotMatch={isPractice}
          gameLabel="Tron Lightcycle"
          winCondition="Best of 3 rounds"
          timeLimit="No time limit"
          disconnectPolicy="5-min reconnect window"
          onComplete={() => setShowIntro(false)}
        />
      )}
      {/* Top HUD bar */}
      <GameHUD
        match={match}
        currentUserId={currentUserId}
        leftScore={myBike?.score}
        rightScore={oppBike?.score}
        centerContent={
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold">TRON · LIGHT CYCLES</span>
            {isPractice && (
              <Badge variant="outline" className="text-[9px] border-violet-500/30 text-violet-300 px-1.5 py-0 h-4">
                Bot · {botDifficulty}
              </Badge>
            )}
          </div>
        }
        extraBadges={
          <>
            {myBike?.activePowerUps.filter((p) => p.expiresAt > Date.now()).map((p) => {
              const meta = POWER_UP_META[p.type];
              const remaining = Math.max(0, Math.ceil((p.expiresAt - Date.now()) / 1000));
              return (
                <Badge
                  key={p.type}
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 h-4"
                  style={{ color: meta.color, borderColor: meta.color + "50" }}
                >
                  {meta.icon} {meta.label} {remaining}s
                </Badge>
              );
            })}
          </>
        }
      />

      {/* Score bar */}
      <div className="flex items-center gap-4 w-full justify-center">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: "#22d3ee", boxShadow: "0 0 8px #22d3ee" }} />
          <span className="text-xs font-bold text-cyan-400">You</span>
          <span className="text-2xl font-black font-mono text-cyan-300">{myBike?.score ?? 0}</span>
        </div>
        <span className="text-muted-foreground font-bold">—</span>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black font-mono text-pink-300">{oppBike?.score ?? 0}</span>
          <span className="text-xs font-bold text-pink-400">{isPractice ? "Bot" : "Opponent"}</span>
          <div className="w-3 h-3 rounded-full" style={{ background: "#f472b6", boxShadow: "0 0 8px #f472b6" }} />
        </div>
        <Badge variant="secondary" className="text-[10px]">First to 3</Badge>
      </div>

      {/* Arena theme picker */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 px-2" data-testid="tron-theme-picker">
        <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold mr-1">Arena</span>
        {(Object.keys(ARENA_THEMES) as ArenaTheme[]).map((tid) => {
          const t = ARENA_THEMES[tid];
          const active = arenaTheme === tid;
          return (
            <button
              key={tid}
              type="button"
              onClick={() => setArenaTheme(tid)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all hover-elevate active-elevate-2 ${
                active
                  ? "border-white/40 text-white"
                  : "border-white/10 text-white/50"
              }`}
              style={
                active
                  ? {
                      background: t.bg,
                      boxShadow: `0 0 12px ${t.borderStops[0]}`,
                      borderColor: t.borderStops[0],
                    }
                  : { background: "rgba(255,255,255,0.03)" }
              }
              data-testid={`tron-theme-${tid}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="rounded-lg w-full max-w-full"
          style={{
            border: "1px solid rgba(139,92,246,0.3)",
            boxShadow: "0 0 40px rgba(139,92,246,0.2), 0 0 80px rgba(59,130,246,0.08)",
            height: "auto",
            aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
            touchAction: "none",
          }}
          onClick={resumeAC}
          data-testid="canvas-tron"
        />

        {/* Round / Match end overlay */}
        <AnimatePresence>
          {(uiState.phase === "roundEnd" || uiState.phase === "matchEnd") && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="absolute inset-0 flex flex-col items-center justify-center rounded-lg"
              style={{ background: "rgba(4,4,20,0.82)", backdropFilter: "blur(6px)" }}
            >
              {uiState.phase === "matchEnd" ? (
                <>
                  <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="text-5xl font-black font-mono mb-2"
                    style={{
                      color: uiState.matchWinnerId === 0 ? "#22d3ee" : "#f472b6",
                      textShadow: `0 0 40px ${uiState.matchWinnerId === 0 ? "#22d3ee" : "#f472b6"}`,
                    }}
                  >
                    {uiState.matchWinnerId === 0 ? "VICTORY" : "DEFEATED"}
                  </motion.div>
                  <p className="text-muted-foreground text-sm mb-4">
                    {uiState.matchWinnerId === 0 ? "You won the match!" : "Better luck next time."}
                  </p>
                  <Button onClick={handleRestart} variant="outline" className="border-violet-500/40 text-violet-300">
                    Play Again
                  </Button>
                </>
              ) : (
                <>
                  <motion.div
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="text-3xl font-black font-mono mb-1"
                    style={{
                      color: uiState.roundWinnerId === 0 ? "#22d3ee" : "#f472b6",
                      textShadow: `0 0 30px ${uiState.roundWinnerId === 0 ? "#22d3ee" : "#f472b6"}`,
                    }}
                  >
                    {uiState.roundWinnerId === 0 ? "ROUND WIN" : uiState.roundWinnerId === null ? "DRAW" : "ELIMINATED"}
                  </motion.div>
                  <p className="text-muted-foreground text-xs">Next round starting…</p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile D-pad — touch users */}
      {(() => {
        const sz = mobileCtrl.size;
        const op = mobileCtrl.opacity;
        const btnStyle = {
          width: sz, height: sz,
          background: "rgba(34,211,238,0.08)",
          border: "1px solid rgba(34,211,238,0.3)",
          boxShadow: "0 0 12px -4px rgba(34,211,238,0.4)",
        };
        const press = (k: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight") => {
          tapDir(k);
          if (mobileCtrl.haptic && typeof navigator !== "undefined" && "vibrate" in navigator) {
            try { (navigator as any).vibrate?.(10); } catch {}
          }
        };
        return (
          <div className={`md:hidden flex mt-2 select-none ${mobileCtrl.hand === "left" ? "justify-start pl-4" : "justify-end pr-4"}`}
               style={{ opacity: op }}>
            <div className="flex flex-col items-center gap-1">
              <button
                onTouchStart={(e) => { e.preventDefault(); press("ArrowUp"); }}
                onClick={() => press("ArrowUp")}
                className="rounded-xl flex items-center justify-center font-bold text-cyan-300 text-2xl active-elevate-2"
                style={btnStyle}
                data-testid="button-tron-up"
                aria-label="Move up"
              >▲</button>
              <div className="flex gap-3">
                <button
                  onTouchStart={(e) => { e.preventDefault(); press("ArrowLeft"); }}
                  onClick={() => press("ArrowLeft")}
                  className="rounded-xl flex items-center justify-center font-bold text-cyan-300 text-2xl active-elevate-2"
                  style={btnStyle}
                  data-testid="button-tron-left"
                  aria-label="Move left"
                >◀</button>
                <div style={{ width: sz, height: sz }} />
                <button
                  onTouchStart={(e) => { e.preventDefault(); press("ArrowRight"); }}
                  onClick={() => press("ArrowRight")}
                  className="rounded-xl flex items-center justify-center font-bold text-cyan-300 text-2xl active-elevate-2"
                  style={btnStyle}
                  data-testid="button-tron-right"
                  aria-label="Move right"
                >▶</button>
              </div>
              <button
                onTouchStart={(e) => { e.preventDefault(); press("ArrowDown"); }}
                onClick={() => press("ArrowDown")}
                className="rounded-xl flex items-center justify-center font-bold text-cyan-300 text-2xl active-elevate-2"
                style={btnStyle}
                data-testid="button-tron-down"
                aria-label="Move down"
              >▼</button>
              <p className="text-[10px] text-white/40 mt-1">Swipe on grid or tap arrows</p>
            </div>
          </div>
        );
      })()}

      {/* Bottom HUD */}
      <div className="flex gap-3 items-center flex-wrap justify-center w-full">
        <Badge variant="outline" className="gap-1 border-cyan-500/30 bg-cyan-500/5 text-cyan-300 text-[10px] hidden md:inline-flex">
          W/A/S/D or Arrows
        </Badge>
        <Badge variant="outline" className="gap-1 border-pink-500/30 bg-pink-500/5 text-pink-300 text-[10px]">
          Collect power-ups for abilities
        </Badge>
        {uiState.phase === "matchEnd" && (
          <Button size="sm" variant="outline" onClick={handleRestart}>
            New Match
          </Button>
        )}
      </div>

      {/* Event Feed */}
      <div className="fixed bottom-24 right-4 z-40">
        <EventFeed />
      </div>

      {/* Controls reminder */}
      <div className="flex gap-2 flex-wrap justify-center">
        {(Object.entries(POWER_UP_META) as Array<[PowerUpType, typeof POWER_UP_META.speed]>).map(([type, meta]) => (
          <div
            key={type}
            className="flex items-center gap-1 text-[9px] rounded-full px-2 py-0.5"
            style={{
              color: meta.color,
              background: "rgba(0,0,0,0.4)",
              border: `1px solid ${meta.color}30`,
            }}
          >
            <span>{meta.icon}</span>
            <span>{meta.label}</span>
          </div>
        ))}
      </div>
    </GameLayout>
  );
}
