import { useEffect, useState, useRef, useCallback } from "react";
import MatchIntroAnimation from "@/components/MatchIntroAnimation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MatchWithPlayers } from "@shared/schema";
import { GameLayout } from "@/components/games/GameLayout";
import { getBotOpponentName } from "@/lib/botMatchUtils";
import { generateEightBallBotMove as generateLocalEightBallMove } from "@shared/eightBallBot";
import {
  type EightBallState,
  simulatePhysics,
  createInitialState,
  executeShot,
  findFirstBallContact,
  findFreeCuePosition,
  cloneState,
  EIGHT_BALL_CONSTANTS,
} from "@shared/eightBallEngine";

import { ArrowLeft, Trophy } from "lucide-react";
import { useLocation } from "wouter";
import { GameHUD, emitFeedEvent, EventFeed } from "@/components/games/GameHUD";
import { useToast } from "@/hooks/use-toast";

// Physics constants from engine (visual must match physics exactly)
const { TABLE_WIDTH, TABLE_HEIGHT, BALL_RADIUS, POCKET_RADIUS,
  PHYS_RAIL: ENG_RAIL, CORNER_MOUTH: ENG_CORNER, SIDE_MOUTH: ENG_SIDE } = EIGHT_BALL_CONSTANTS;

interface EightBallGameProps {
  match: MatchWithPlayers;
  currentUserId?: string;
}

// Ball number → color
const BALL_COLORS: Record<number, string> = {
  1: "#f0c000", 2: "#1a44cc", 3: "#cc1414", 4: "#7a1daa",
  5: "#e85500", 6: "#1a7a1a", 7: "#aa1111", 8: "#111111",
  9: "#f0c000", 10: "#1a44cc", 11: "#cc1414", 12: "#7a1daa",
  13: "#e85500", 14: "#1a7a1a", 15: "#aa1111",
};

type EvType = "good" | "bad" | "info";
interface GameEvent { text: string; sub?: string; type: EvType; id: number }

// ─── Table builder ────────────────────────────────────────────────────────────
function buildTableCanvas(W: number, H: number, RAIL: number): HTMLCanvasElement {
  const off = document.createElement("canvas");
  off.width = W; off.height = H;
  const g = off.getContext("2d")!;

  const S        = W / TABLE_WIDTH;
  const PR       = POCKET_RADIUS * S;
  const CORNER_C = ENG_CORNER * S;
  const SIDE_C   = ENG_SIDE   * S;
  const CT       = 6;   // cushion strip thickness (px)

  // ── Outer wood frame ────────────────────────────────────────────────────────
  const wood = g.createLinearGradient(0, 0, W, H);
  wood.addColorStop(0,    "#b87333");
  wood.addColorStop(0.18, "#8c4e1a");
  wood.addColorStop(0.42, "#6b3410");
  wood.addColorStop(0.72, "#4e250a");
  wood.addColorStop(1,    "#2c1204");
  g.fillStyle = wood;
  g.fillRect(0, 0, W, H);

  // Wood grain
  for (let y = 0; y < H; y += 3.5) {
    const a  = 0.014 + ((y * 11) % 7) * 0.006;
    const wv = Math.sin(y * 0.04 + 0.8) * 4;
    g.strokeStyle = `rgba(0,0,0,${a.toFixed(3)})`;
    g.lineWidth = 0.5;
    g.beginPath(); g.moveTo(wv, y); g.lineTo(W + wv, y); g.stroke();
  }
  // Gold outer edge
  g.strokeStyle = "rgba(220,165,55,0.55)";
  g.lineWidth = 2.5;
  g.strokeRect(1.2, 1.2, W - 2.4, H - 2.4);
  // Inner shadow line
  g.strokeStyle = "rgba(0,0,0,0.5)";
  g.lineWidth = 2;
  g.strokeRect(RAIL - 2, RAIL - 2, W - (RAIL - 2) * 2, H - (RAIL - 2) * 2);

  // ── 3-D rail bevel ───────────────────────────────────────────────────────
  // Top/left highlight
  g.fillStyle = "rgba(255,200,80,0.14)";
  g.beginPath();
  g.moveTo(0, 0); g.lineTo(RAIL, RAIL); g.lineTo(W - RAIL, RAIL); g.lineTo(W, 0); g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(0, 0); g.lineTo(RAIL, RAIL); g.lineTo(RAIL, H - RAIL); g.lineTo(0, H); g.closePath();
  g.fill();
  // Bottom/right shadow
  g.fillStyle = "rgba(0,0,0,0.38)";
  g.beginPath();
  g.moveTo(0, H); g.lineTo(RAIL, H - RAIL); g.lineTo(W - RAIL, H - RAIL); g.lineTo(W, H); g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(W, 0); g.lineTo(W - RAIL, RAIL); g.lineTo(W - RAIL, H - RAIL); g.lineTo(W, H); g.closePath();
  g.fill();

  // ── Felt surface ──────────────────────────────────────────────────────────
  const felt = g.createRadialGradient(W * 0.5, H * 0.36, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.68);
  felt.addColorStop(0,    "#2ab85a");
  felt.addColorStop(0.28, "#0f7c3e");
  felt.addColorStop(0.62, "#0a5e2a");
  felt.addColorStop(1,    "#053016");
  g.fillStyle = felt;
  g.fillRect(RAIL, RAIL, W - RAIL * 2, H - RAIL * 2);

  // Felt nap (fine grain)
  g.save();
  g.globalAlpha = 0.028;
  g.strokeStyle = "#90ffb8";
  g.lineWidth = 0.4;
  for (let x = RAIL; x < W - RAIL; x += 8) {
    g.beginPath(); g.moveTo(x, RAIL); g.lineTo(x, H - RAIL); g.stroke();
  }
  for (let y = RAIL; y < H - RAIL; y += 8) {
    g.beginPath(); g.moveTo(RAIL, y); g.lineTo(W - RAIL, y); g.stroke();
  }
  g.restore();

  // Overhead light bloom (twin lamp bar effect)
  for (const lx of [W * 0.3, W * 0.7]) {
    const lm = g.createRadialGradient(lx, H * 0.28, 0, lx, H * 0.5, W * 0.38);
    lm.addColorStop(0,   "rgba(255,255,200,0.13)");
    lm.addColorStop(0.5, "rgba(255,255,180,0.04)");
    lm.addColorStop(1,   "transparent");
    g.fillStyle = lm;
    g.fillRect(RAIL, RAIL, W - RAIL * 2, H - RAIL * 2);
  }

  // ── Cushion rubber strips ─────────────────────────────────────────────────
  // Inner surface of rubber — deep emerald
  const drawCushion = (x: number, y: number, w: number, h: number) => {
    // Dark base
    g.fillStyle = "#094d26";
    g.fillRect(x, y, w, h);
    // Highlight (top/left)
    const isHoriz = w > h;
    if (isHoriz) {
      g.fillStyle = "rgba(50,220,120,0.18)";
      g.fillRect(x, y, w, h * 0.38);
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.fillRect(x, y + h * 0.7, w, h * 0.3);
    } else {
      g.fillStyle = "rgba(50,220,120,0.18)";
      g.fillRect(x, y, w * 0.38, h);
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.fillRect(x + w * 0.7, y, w * 0.3, h);
    }
  };

  // Top rail — two segments
  drawCushion(CORNER_C,       RAIL - CT, W / 2 - CORNER_C - SIDE_C, CT);
  drawCushion(W / 2 + SIDE_C, RAIL - CT, W / 2 - CORNER_C - SIDE_C, CT);
  // Bottom rail
  drawCushion(CORNER_C,       H - RAIL,  W / 2 - CORNER_C - SIDE_C, CT);
  drawCushion(W / 2 + SIDE_C, H - RAIL,  W / 2 - CORNER_C - SIDE_C, CT);
  // Left rail
  drawCushion(RAIL - CT, CORNER_C, CT, H - 2 * CORNER_C);
  // Right rail
  drawCushion(W - RAIL,  CORNER_C, CT, H - 2 * CORNER_C);

  // Inset shadow along felt edge (depth feel)
  g.save();
  g.strokeStyle = "rgba(0,0,0,0.75)";
  g.lineWidth = 8;
  g.strokeRect(RAIL + 2, RAIL + 2, W - RAIL * 2 - 4, H - RAIL * 2 - 4);
  g.restore();

  // ── Spot markers & head string ────────────────────────────────────────────
  g.strokeStyle = "rgba(255,255,255,0.1)";
  g.lineWidth = 1.5;
  for (const sx of [W * 0.25, W * 0.5, W * 0.75]) {
    g.beginPath(); g.arc(sx, H * 0.5, 4, 0, Math.PI * 2); g.stroke();
  }
  g.strokeStyle = "rgba(255,255,255,0.055)";
  g.lineWidth = 1;
  g.setLineDash([4, 7]);
  g.beginPath(); g.moveTo(W * 0.25, RAIL); g.lineTo(W * 0.25, H - RAIL); g.stroke();
  g.setLineDash([]);

  // ── Pockets ───────────────────────────────────────────────────────────────
  // Corner pockets: realistic triangular-jaw design
  // The jaw is formed by two angled cushion-tip edges meeting at the corner opening.
  // Side pockets: elongated oval with parallel jaw faces.

  const drawCornerPocket = (cx: number, cy: number, sx: number, sy: number) => {
    // sx, sy: signs — +1 means pocket faces inward from that corner
    const vr   = PR * 1.22;
    const jaw  = CORNER_C * 0.55;  // jaw depth

    // Jaw corners (angled face tips of each rail toward the pocket)
    const j1x = cx + sx * jaw, j1y = cy;         // tip on long rail
    const j2x = cx,             j2y = cy + sy * jaw; // tip on short rail

    // Pocket opening triangle: fill wood frame corner black
    g.save();
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(j1x, cy);
    g.lineTo(j1x, j2y);
    g.lineTo(cx, j2y);
    g.closePath();
    g.fillStyle = "#050201";
    g.fill();

    // Hole gradient (deep black with brown rim)
    const hcx = cx + sx * jaw * 0.6;
    const hcy = cy + sy * jaw * 0.6;
    const aura = g.createRadialGradient(hcx, hcy, 0, hcx, hcy, vr * 2.2);
    aura.addColorStop(0,    "rgba(0,0,0,0.95)");
    aura.addColorStop(0.5,  "rgba(0,0,0,0.6)");
    aura.addColorStop(1,    "transparent");
    g.fillStyle = aura;
    g.beginPath(); g.arc(hcx, hcy, vr * 2.2, 0, Math.PI * 2); g.fill();

    // Leather collar
    const collar = g.createRadialGradient(hcx - sx * vr * 0.15, hcy - sy * vr * 0.15, 0, hcx, hcy, vr * 1.22);
    collar.addColorStop(0,   "#7c4818");
    collar.addColorStop(0.55,"#3e2008");
    collar.addColorStop(1,   "#190900");
    g.fillStyle = collar;
    g.beginPath(); g.arc(hcx, hcy, vr * 1.22, 0, Math.PI * 2); g.fill();

    // Deep hole
    const depth = g.createRadialGradient(hcx, hcy, 0, hcx, hcy, vr);
    depth.addColorStop(0,   "#100804");
    depth.addColorStop(0.8, "#050301");
    depth.addColorStop(1,   "#000000");
    g.fillStyle = depth;
    g.beginPath(); g.arc(hcx, hcy, vr, 0, Math.PI * 2); g.fill();

    // Metal point protectors (chrome tips at cushion jaws)
    const drawJawTip = (tx: number, ty: number, ax: number, ay: number) => {
      const chrome = g.createRadialGradient(tx - ax * 1.5, ty - ay * 1.5, 0, tx, ty, 4.5);
      chrome.addColorStop(0,   "#e8e0c8");
      chrome.addColorStop(0.5, "#9e9888");
      chrome.addColorStop(1,   "#484038");
      g.fillStyle = chrome;
      g.beginPath(); g.arc(tx, ty, 3.8, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(255,245,210,0.5)"; g.lineWidth = 0.8;
      g.beginPath(); g.arc(tx - ax * 1.2, ty - ay * 1.2, 1.6, 0, Math.PI * 2); g.stroke();
    };
    drawJawTip(j1x, j1y + sy * 1.5, -sx, -sy);
    drawJawTip(j2x + sx * 1.5, j2y, -sx, -sy);

    // Subtle leather sheen highlight
    g.strokeStyle = "rgba(200,130,50,0.4)";
    g.lineWidth = 1.6;
    const a1 = Math.atan2(-sy, -sx) - 0.3;
    const a2 = a1 + 0.9;
    g.beginPath(); g.arc(hcx - sx * vr * 0.2, hcy - sy * vr * 0.2, vr * 0.72, a1, a2);
    g.stroke();
    g.restore();
  };

  const drawSidePocket = (cx: number, cy: number, onTop: boolean) => {
    const sy   = onTop ? 1 : -1;
    const vr   = PR * 1.08;
    const jawW = SIDE_C;     // half-width of pocket mouth
    const jawD = CT + 4;     // depth of jaw face

    // Pocket recess (dark zone behind jaws)
    g.save();
    g.fillStyle = "#060302";
    g.fillRect(cx - jawW * 1.1, onTop ? (RAIL - jawD) : (cy - 2), jawW * 2.2, jawD + 4);

    // Depth gradient
    const aura = g.createRadialGradient(cx, cy, 0, cx, cy, vr * 2.0);
    aura.addColorStop(0,   "rgba(0,0,0,0.92)");
    aura.addColorStop(0.5, "rgba(0,0,0,0.55)");
    aura.addColorStop(1,   "transparent");
    g.fillStyle = aura;
    g.beginPath(); g.arc(cx, cy, vr * 2.0, 0, Math.PI * 2); g.fill();

    // Leather collar (wider oval for side pocket)
    const collar = g.createRadialGradient(cx - 2, cy - sy * vr * 0.15, 0, cx, cy, vr * 1.15);
    collar.addColorStop(0,   "#7c4818");
    collar.addColorStop(0.55,"#3e2008");
    collar.addColorStop(1,   "#190900");
    g.fillStyle = collar;
    g.beginPath();
    g.ellipse(cx, cy, vr * 1.15, vr * 0.95, 0, 0, Math.PI * 2);
    g.fill();

    // Deep hole
    const depth = g.createRadialGradient(cx, cy, 0, cx, cy, vr * 0.96);
    depth.addColorStop(0,   "#100804");
    depth.addColorStop(0.8, "#050301");
    depth.addColorStop(1,   "#000000");
    g.fillStyle = depth;
    g.beginPath();
    g.ellipse(cx, cy, vr * 0.96, vr * 0.78, 0, 0, Math.PI * 2);
    g.fill();

    // Jaw faces (flat rubber faces on each side of opening)
    const jawFaceY = onTop ? RAIL - CT : H - RAIL + CT - 4;
    g.fillStyle = "#0a5a2a";
    g.fillRect(cx - jawW * 1.08, jawFaceY - (onTop ? 0 : 4), 5, CT + 4);
    g.fillRect(cx + jawW * 1.08 - 5, jawFaceY - (onTop ? 0 : 4), 5, CT + 4);

    // Metal jaw tips
    const tipY = onTop ? RAIL - 2 : H - RAIL + 2;
    for (const tx of [cx - jawW * 1.05, cx + jawW * 1.05]) {
      const chrome = g.createRadialGradient(tx - 1, tipY - sy * 1.5, 0, tx, tipY, 4);
      chrome.addColorStop(0,   "#e0d8c0");
      chrome.addColorStop(0.5, "#989080");
      chrome.addColorStop(1,   "#403830");
      g.fillStyle = chrome;
      g.beginPath(); g.arc(tx, tipY, 3.5, 0, Math.PI * 2); g.fill();
    }

    // Leather sheen arc
    g.strokeStyle = "rgba(200,130,50,0.38)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(cx - 2, cy - sy * vr * 0.15, vr * 0.7, Math.PI * 0.2, Math.PI * 0.8);
    g.stroke();
    g.restore();
  };

  // Draw all 6 pockets
  drawCornerPocket(0,     0,     +1, +1);  // top-left
  drawCornerPocket(W,     0,     -1, +1);  // top-right
  drawCornerPocket(0,     H,     +1, -1);  // bottom-left
  drawCornerPocket(W,     H,     -1, -1);  // bottom-right
  drawSidePocket(W / 2,  PR * 0.7,      true);   // top-center
  drawSidePocket(W / 2,  H - PR * 0.7,  false);  // bottom-center

  return off;
}

// ─── Ball renderer ────────────────────────────────────────────────────────────
function drawBall(g: CanvasRenderingContext2D, ball: { x:number; y:number; number:number; type:string; pocketed:boolean }, S: number) {
  const bx = ball.x * S;
  const by = ball.y * S;
  const r  = BALL_RADIUS * S;
  if (ball.pocketed) return;

  g.save();
  g.translate(bx, by);

  // Contact shadow
  g.save();
  g.globalAlpha = 0.40;
  const sd = g.createRadialGradient(r * 0.25, r * 0.55, 0, r * 0.25, r * 0.55, r * 1.15);
  sd.addColorStop(0, "rgba(0,0,0,0.75)"); sd.addColorStop(1, "transparent");
  g.fillStyle = sd;
  g.beginPath(); g.ellipse(r * 0.2, r * 0.55, r * 1.1, r * 0.48, 0, 0, Math.PI * 2); g.fill();
  g.restore();

  const isCue   = ball.type === "cue";
  const isEight = ball.type === "eight";
  const base    = isCue ? "#f2efe8" : isEight ? "#1a1a1a" : BALL_COLORS[ball.number] ?? "#888";

  // 3-D sphere gradient
  const lightX = -r * 0.3; const lightY = -r * 0.3;
  const sphere = g.createRadialGradient(lightX, lightY, r * 0.05, 0, 0, r * 1.05);
  const lighten = (hex: string, amt: number) => {
    const n = parseInt(hex.replace("#",""),16);
    const cl = (v: number) => Math.max(0,Math.min(255,v+amt)).toString(16).padStart(2,"0");
    return `#${cl((n>>16)&255)}${cl((n>>8)&255)}${cl(n&255)}`;
  };
  sphere.addColorStop(0,    lighten(base, 90));
  sphere.addColorStop(0.28, lighten(base, 38));
  sphere.addColorStop(0.6,  base);
  sphere.addColorStop(1,    lighten(base, -72));
  g.fillStyle = sphere;
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();

  // Stripe band for stripe balls
  if (ball.type === "stripe") {
    const sc = BALL_COLORS[ball.number] ?? "#e8c200";
    g.save();
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.clip();
    const bandG = g.createLinearGradient(0, -r, 0, r);
    bandG.addColorStop(0,   "rgba(0,0,0,0)");
    bandG.addColorStop(0.2, "rgba(0,0,0,0)");
    bandG.addColorStop(0.28, sc);
    bandG.addColorStop(0.72, sc);
    bandG.addColorStop(0.8, "rgba(0,0,0,0)");
    bandG.addColorStop(1,   "rgba(0,0,0,0)");
    g.fillStyle = bandG;
    g.fillRect(-r, -r, r * 2, r * 2);
    g.restore();
  }

  // Number disc
  if (ball.number > 0) {
    g.fillStyle = "rgba(255,255,255,0.94)";
    g.beginPath(); g.arc(0, 0, r * 0.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#111";
    g.font = `bold ${Math.round(r * 0.8)}px sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(ball.number.toString(), 0, r * 0.04);
  }

  // Gloss highlight
  const gloss = g.createRadialGradient(lightX, lightY, 0, lightX * 0.7, lightY * 0.7, r * 0.55);
  gloss.addColorStop(0, "rgba(255,255,255,0.78)");
  gloss.addColorStop(0.4,"rgba(255,255,255,0.22)");
  gloss.addColorStop(1,  "rgba(255,255,255,0)");
  g.fillStyle = gloss;
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();

  // Specular dot
  g.fillStyle = "rgba(255,255,255,0.65)";
  g.beginPath(); g.arc(-r * 0.27, -r * 0.3, r * 0.1, 0, Math.PI * 2); g.fill();

  // Rim
  g.strokeStyle = "rgba(0,0,0,0.3)"; g.lineWidth = 0.7;
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();

  g.restore();
}

// Power meter colour ramp: green → yellow → red as power increases 0 → 100.
function powerColor(pct: number): string {
  const h = Math.max(0, Math.min(120, 120 * (1 - pct / 100)));
  return `hsl(${Math.round(h)}, 85%, 50%)`;
}

// Rounded-rectangle path helper for canvas overlays.
function roundRectPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y,     x + w, y + h, rr);
  g.arcTo(x + w, y + h, x,     y + h, rr);
  g.arcTo(x,     y + h, x,     y,     rr);
  g.arcTo(x,     y,     x + w, y,     rr);
  g.closePath();
}

// ─── Spin / English control ──────────────────────────────────────────────────
// A draggable cue-ball widget: the dot marks where the tip strikes the ball.
// Up = follow (top spin), down = draw (back spin), sides = left/right english.
function SpinControl({
  value, onChange, disabled,
}: {
  value: { x: number; y: number };
  onChange: (v: { x: number; y: number }) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const apply = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let nx = (clientX - cx) / (r.width / 2);
    let ny = (clientY - cy) / (r.height / 2);
    const m = Math.hypot(nx, ny);
    if (m > 1) { nx /= m; ny /= m; }
    onChange({ x: Math.round(nx * 100) / 100, y: Math.round(-ny * 100) / 100 });
  };

  const onDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    apply(e.clientX, e.clientY);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    e.stopPropagation();
    apply(e.clientX, e.clientY);
  };
  const onUp = (e: React.PointerEvent) => {
    draggingRef.current = false;
    e.stopPropagation();
  };

  const dotLeft = `${50 + value.x * 42}%`;
  const dotTop  = `${50 - value.y * 42}%`;
  const active  = Math.abs(value.x) > 0.04 || Math.abs(value.y) > 0.04;

  const label =
    !active ? "Center"
    : (Math.abs(value.y) >= Math.abs(value.x)
        ? (value.y > 0 ? "Top spin (follow)" : "Back spin (draw)")
        : (value.x > 0 ? "Right english" : "Left english"));

  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Spin</span>
      <div
        ref={ref}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        data-testid="control-spin"
        className={`relative rounded-full touch-none ${disabled ? "opacity-40" : "cursor-pointer"}`}
        style={{
          width: 76, height: 76,
          background: "radial-gradient(circle at 38% 32%, #ffffff 0%, #e7ecf3 45%, #aab4c4 100%)",
          boxShadow: "inset 0 2px 6px rgba(255,255,255,0.85), inset 0 -8px 14px rgba(20,30,45,0.32), 0 4px 14px rgba(0,0,0,0.5)",
          border: "1px solid rgba(255,255,255,0.25)",
        }}
      >
        {/* Crosshair */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-[14%] bottom-[14%] w-px -translate-x-1/2" style={{ background: "rgba(40,55,75,0.28)" }} />
          <div className="absolute top-1/2 left-[14%] right-[14%] h-px -translate-y-1/2" style={{ background: "rgba(40,55,75,0.28)" }} />
        </div>
        {/* Contact dot */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none transition-[left,top] duration-75"
          style={{
            left: dotLeft, top: dotTop, width: 18, height: 18,
            background: active
              ? "radial-gradient(circle at 35% 30%, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.75) 70%)"
              : "radial-gradient(circle at 35% 30%, rgba(120,135,155,0.95) 0%, rgba(80,95,115,0.85) 70%)",
            boxShadow: active
              ? "0 0 10px 2px hsl(var(--primary) / 0.6), 0 1px 3px rgba(0,0,0,0.5)"
              : "0 1px 3px rgba(0,0,0,0.4)",
            border: "1.5px solid rgba(255,255,255,0.85)",
          }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground h-3.5 tabular-nums">{label}</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function EightBallGame({ match, currentUserId }: EightBallGameProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [showIntro, setShowIntro] = useState(true);
  const [gameState, setGameState] = useState<EightBallState>(() =>
    (match.gameState as any)?.balls ? (match.gameState as EightBallState) : createInitialState()
  );
  const [aimAngle, setAimAngle]       = useState(Math.PI);
  const [isDragging, setIsDragging]   = useState(false);
  const [dragPower, setDragPower]     = useState(0);
  const [canvasScale, setCanvasScale] = useState(1);
  const [gameEvent, setGameEvent]     = useState<GameEvent | null>(null);
  const [pocketFlash, setPocketFlash] = useState(false);
  const [ballInHand, setBallInHand]   = useState(false);
  const [spin, setSpin]               = useState({ x: 0, y: 0 }); // cue english: x=side, y=follow/draw
  const evId = useRef(0);

  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const tableRef      = useRef<HTMLCanvasElement | null>(null);
  const animRef       = useRef<number>();
  const wsRef         = useRef<WebSocket | null>(null);
  const simRef        = useRef<EightBallState | null>(null);   // live, mutated-in-place sim state
  const ballInHandRef = useRef(false);
  const spinRef       = useRef({ x: 0, y: 0 });
  const drawRef       = useRef<(state: EightBallState, showAim: boolean) => void>(() => {});

  // Stable refs for event handlers (avoid stale closure bugs)
  const gsRef         = useRef(gameState);
  const aimRef        = useRef(aimAngle);
  const draggingRef   = useRef(false);
  const powerRef      = useRef(0);
  const originRef     = useRef<{x:number;y:number}|null>(null);
  const matchRef      = useRef(match);
  const ip1Ref        = useRef(match.player1Id === currentUserId);
  const prevSimRef    = useRef(false);

  useEffect(() => { gsRef.current   = gameState; }, [gameState]);
  useEffect(() => { aimRef.current  = aimAngle;  }, [aimAngle]);
  useEffect(() => { matchRef.current = match;     }, [match]);
  useEffect(() => { ip1Ref.current  = match.player1Id === currentUserId; }, [match, currentUserId]);

  const isPlayer1   = match.player1Id === currentUserId;
  const player1Name = match.player1?.firstName || "Player 1";
  const player2Name = getBotOpponentName(match);

  // isMyTurn — reads from refs so never stale
  const isMyTurn = useCallback((): boolean => {
    const m   = matchRef.current;
    const gs  = gsRef.current;
    const ip1 = ip1Ref.current;
    if (m.isPractice) return true;
    return (gs.currentPlayer === "player1" && ip1) ||
           (gs.currentPlayer === "player2" && !ip1);
  }, []);

  // ── Event banner ────────────────────────────────────────────────────────────
  const showEvent = useCallback((text: string, sub?: string, type: EvType = "info") => {
    const id = ++evId.current;
    setGameEvent({ text, sub, type, id });
    setTimeout(() => setGameEvent(e => e?.id === id ? null : e), 2800);
  }, []);

  // ── Canvas scale ─────────────────────────────────────────────────────────
  useEffect(() => {
    const upd = () => {
      const c = containerRef.current;
      if (!c) return;
      const s = Math.min(1.15, Math.max(0.42, (c.clientWidth - 4) / TABLE_WIDTH));
      setCanvasScale(s);
    };
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);

  const CW   = Math.round(TABLE_WIDTH  * canvasScale);
  const CH   = Math.round(TABLE_HEIGHT * canvasScale);
  const RAIL = Math.round(22 * canvasScale);

  // ── Build offscreen table ────────────────────────────────────────────────
  useEffect(() => {
    if (CW < 100) return;
    tableRef.current = buildTableCanvas(CW, CH, RAIL);
  }, [CW, CH, RAIL]);

  // ── Sync match state ─────────────────────────────────────────────────────
  useEffect(() => {
    if ((match.gameState as any)?.balls) setGameState(match.gameState as EightBallState);
  }, [match.gameState]);

  // ── Physics loop ─────────────────────────────────────────────────────────
  // Runs entirely inside a ref-driven rAF loop. Physics mutates the working
  // state in place (no per-frame clone) and draws straight to the canvas every
  // frame. React state is only updated ONCE — when every ball has stopped.
  useEffect(() => {
    if (!gameState.simulationRunning) return;
    // Deep clone ONCE at the start of the shot (turn transition).
    simRef.current = cloneState(gameState);

    const tick = () => {
      const sim = simRef.current;
      if (!sim) return;
      simulatePhysics(sim);              // mutates sim.balls in place
      drawRef.current(sim, false);       // render this frame without setState
      if (!sim.simulationRunning) {
        // All balls settled — commit the final state to React exactly once.
        simRef.current = null;
        setGameState(cloneState(sim));
        return;
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.simulationRunning]);

  // Keep spin ref in sync for the rAF/draw + fireShot closures.
  useEffect(() => { spinRef.current = spin; }, [spin]);

  // Keep ball-in-hand ref in sync, and auto-enable it for the player who
  // receives ball-in-hand after the opponent fouls.
  useEffect(() => { ballInHandRef.current = ballInHand; }, [ballInHand]);
  useEffect(() => {
    if (!gameState.simulationRunning && !gameState.gameOver && gameState.foul && isMyTurn()) {
      setBallInHand(true);
    } else {
      setBallInHand(false);
    }
  }, [gameState.simulationRunning, gameState.gameOver, gameState.foul, gameState.currentPlayer, isMyTurn]);

  // ── Detect shot resolution → fire events ────────────────────────────────
  useEffect(() => {
    const wasRunning = prevSimRef.current;
    prevSimRef.current = gameState.simulationRunning;
    if (!wasRunning || gameState.simulationRunning) return;
    // Shot just ended
    const pocketed = gameState.lastShotPocketed;
    const foul     = gameState.foul;
    const over     = gameState.gameOver;

    if (over) {
      const wName = gameState.winner === "player1" ? player1Name : player2Name;
      showEvent(`${wName} Wins!`, undefined, "good");
    } else if (pocketed.includes(8) && !over) {
      showEvent("8-Ball Sunk!", "Opponent wins the game", "bad");
    } else if (foul) {
      const cbSunk = !gsRef.current.balls.find(b => b.type === "cue" && !b.pocketed);
      showEvent(cbSunk ? "Scratch!" : "Foul!", "Cue ball in hand for opponent", "bad");
    } else if (pocketed.length >= 2) {
      showEvent("Multi-ball!", `${pocketed.length} balls pocketed`, "good");
      setPocketFlash(true); setTimeout(() => setPocketFlash(false), 800);
    } else if (pocketed.length === 1) {
      const pool = ["Nice Shot!", "Clean Pocket!", "Ball Down!", "Well Played!"];
      showEvent(pool[(pocketed[0] + Math.floor(Date.now()/1000)) % pool.length], undefined, "good");
      setPocketFlash(true); setTimeout(() => setPocketFlash(false), 500);
    }
  }, [gameState.simulationRunning, gameState.lastShotPocketed, gameState.foul, gameState.gameOver, gameState.winner, player1Name, player2Name, showEvent]);

  // ── WebSocket (multiplayer sync) ─────────────────────────────────────────
  useEffect(() => {
    if (match.isPractice) return;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      ws.onopen  = () => ws.send(JSON.stringify({ type: "join", matchId: match.id, userId: currentUserId }));
      ws.onmessage = ev => {
        const d = JSON.parse(ev.data);
        // Only accept server state AFTER simulation ends (bot's reply)
        // Skip if we're already simulating locally (avoid overriding mid-sim)
        if (d.type === "8-ball-move" && d.matchId === match.id && !gsRef.current.simulationRunning) {
          setGameState(d.gameState);
        } else if (d.type === "error") {
          toast({ title: "Error", description: d.message, variant: "destructive" });
        }
      };
      ws.onerror  = () => console.warn("[8-ball] WS not available — running local physics");
      wsRef.current = ws;
    } catch { console.warn("[8-ball] WS create failed"); }
    return () => { try { if (ws?.readyState < 2) ws.close(); } catch {} };
  }, [match.id, match.isPractice, currentUserId, toast]);

  // ── Bot moves ────────────────────────────────────────────────────────────
  // Variable thinking time per difficulty; if server fetch fails, fall back to
  // local bot generator so the bot NEVER freezes the game.
  useEffect(() => {
    if (match.isPractice || !match.isBotMatch || match.status !== "in-progress") return;
    if (gameState.gameOver || gameState.simulationRunning) return;
    const botP = isPlayer1 ? "player2" : "player1";
    if (gameState.currentPlayer !== botP) return;

    const diff = (match.botDifficulty ?? "medium") as "easy" | "medium" | "hard";
    const thinkMs = diff === "easy" ? 1200 + Math.random() * 1300
                  : diff === "hard" ? 400  + Math.random() * 600
                                    : 800  + Math.random() * 700;

    let cancelled = false;
    const applyMove = (angle: number, power: number) => {
      if (cancelled) return;
      setGameState(prev => executeShot(prev, angle, power));
    };

    const t = setTimeout(async () => {
      // 6-second hard timeout so a hung request never freezes the bot
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));
      try {
        const r = await Promise.race([
          fetch(`/api/matches/${match.id}/bot-move`, {
            method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          }),
          timeout,
        ]);
        if (r && (r as Response).ok) {
          const d = await (r as Response).json();
          if (d.move?.angle !== undefined && d.move?.power !== undefined) {
            applyMove(d.move.angle, d.move.power);
            return;
          }
          if (d.move?.gameState && !cancelled) {
            setGameState(d.move.gameState);
            return;
          }
        }
        throw new Error("server bot-move unavailable");
      } catch (err) {
        console.warn("[8-ball] Bot move server failed, using local fallback", err);
        // Local fallback — guaranteed move, never freezes
        try {
          const local = generateLocalEightBallMove(gsRef.current, botP, diff);
          if (local) applyMove(local.angle, local.power);
        } catch (e2) {
          console.error("[8-ball] Local bot fallback failed", e2);
        }
      }
    }, thinkMs);
    return () => { cancelled = true; clearTimeout(t); };
  }, [match.isBotMatch, match.isPractice, match.status, match.id, match.botDifficulty, gameState.currentPlayer, gameState.gameOver, gameState.simulationRunning, isPlayer1]);

  // ══════════════════════════════════════════════════════════════════════════
  // THE ONLY SHOT FUNCTION — ALWAYS applies locally via executeShot.
  // No WebSocket dependency for shot physics. WS is for server sync only.
  // This means shots work 100% of the time regardless of connection state.
  // ══════════════════════════════════════════════════════════════════════════
  const fireShot = useCallback(() => {
    const gs = gsRef.current;

    // Guard: not my turn, already simulating, or game over
    if (gs.simulationRunning) {
      console.log("[8-ball] fireShot: blocked — simulation running");
      return;
    }
    if (gs.gameOver) {
      console.log("[8-ball] fireShot: blocked — game over");
      return;
    }
    if (!isMyTurn()) {
      console.log("[8-ball] fireShot: blocked — not my turn. currentPlayer:", gs.currentPlayer);
      return;
    }

    // Capture shot parameters from refs (always current)
    const angle = aimRef.current;
    const power = Math.max(10, powerRef.current); // minimum 10% so taps register
    const spinX = spinRef.current.x;
    const spinY = spinRef.current.y;

    console.log(`[8-ball] FIRE — angle:${angle.toFixed(3)} power:${power.toFixed(1)}% spin:(${spinX.toFixed(2)},${spinY.toFixed(2)})`);

    // Reset drag state synchronously via refs (prevent double-fire)
    draggingRef.current = false;
    powerRef.current    = 0;
    originRef.current   = null;
    setIsDragging(false);
    setDragPower(0);

    // ── ALWAYS apply physics locally ──────────────────────────────────────
    // This is the critical fix: executeShot runs client-side regardless of
    // WebSocket availability. The ball ALWAYS moves.
    const next = executeShot(gs, angle, power, spinX, spinY);
    const cb   = next.balls.find(b => b.type === "cue");
    console.log(`[8-ball] velocity — vx:${cb?.vx?.toFixed(2)} vy:${cb?.vy?.toFixed(2)} simRunning:${next.simulationRunning}`);
    setGameState(next);

    // Reset english back to center for the next shot.
    spinRef.current = { x: 0, y: 0 };
    setSpin({ x: 0, y: 0 });

    // ── Also sync to server for bot response (fire-and-forget) ───────────
    // Server will compute bot's reply and send it back via WS.
    // If WS isn't available, local physics is still correct for practice/bot.
    if (!matchRef.current.isPractice && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "8-ball-move", matchId: matchRef.current.id, angle, power, spinX, spinY,
      }));
    }
  }, [isMyTurn]);

  // ── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (gsRef.current.simulationRunning || gsRef.current.gameOver) return;
      if (!isMyTurn()) return;
      if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); fireShot(); }
      if (e.code === "ArrowLeft")  setAimAngle(a => { const n = a - 0.03; aimRef.current = n; return n; });
      if (e.code === "ArrowRight") setAimAngle(a => { const n = a + 0.03; aimRef.current = n; return n; });
    };
    window.addEventListener("keydown", kd);
    return () => window.removeEventListener("keydown", kd);
  }, [fireShot, isMyTurn]);

  // ── Table coord helper ────────────────────────────────────────────────────
  const toTable = useCallback((cx: number, cy: number) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * TABLE_WIDTH, y: ((cy - r.top) / r.height) * TABLE_HEIGHT };
  }, []);

  const getCueBall = () => gsRef.current.balls.find(b => b.type === "cue" && !b.pocketed);

  // Ball-in-hand: drop the cue ball anywhere in the LEFT QUARTER of the table.
  // Position is clamped to the zone and nudged off any ball it would overlap.
  const placeCueBall = useCallback((tx: number, ty: number) => {
    const maxX = TABLE_WIDTH / 4 - BALL_RADIUS;
    const desiredX = Math.min(maxX, tx);
    setGameState(prev => {
      const next = cloneState(prev);
      const cue = next.balls.find(b => b.type === "cue");
      if (cue) {
        const spot = findFreeCuePosition(next.balls, desiredX, ty);
        cue.x = Math.min(maxX, spot.x);
        cue.y = spot.y;
        cue.vx = 0; cue.vy = 0; cue.pocketed = false;
      }
      return next;
    });
    setBallInHand(false);
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // POINTER EVENTS — unified mouse + touch via setPointerCapture
  // setPointerCapture routes ALL subsequent events to this element even when
  // the pointer leaves the canvas bounds. Eliminates missed-release bugs.
  // ══════════════════════════════════════════════════════════════════════════
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gsRef.current.simulationRunning || gsRef.current.gameOver) return;
    if (!isMyTurn()) return;

    const pt = toTable(e.clientX, e.clientY);

    // Ball-in-hand: click inside the left quarter places the cue ball there.
    if (ballInHandRef.current) {
      if (pt.x <= TABLE_WIDTH / 4) {
        placeCueBall(pt.x, pt.y);
      } else {
        toast({ title: "Ball in hand", description: "Place the cue ball in the highlighted left zone.", variant: "default" });
      }
      return;
    }

    // Capture pointer — events follow the pointer everywhere
    e.currentTarget.setPointerCapture(e.pointerId);

    const cb = getCueBall();
    if (!cb) return;

    // Lock aim to click direction
    const angle = Math.atan2(pt.y - cb.y, pt.x - cb.x);
    setAimAngle(angle);
    aimRef.current = angle;

    // Start drag
    originRef.current  = pt;
    draggingRef.current = true;
    powerRef.current    = 0;
    setIsDragging(true);
    setDragPower(0);

    console.log(`[8-ball] Drag START angle:${angle.toFixed(3)}`);
  }, [isMyTurn, toTable]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = toTable(e.clientX, e.clientY);
    const cb = getCueBall();
    if (!cb) return;

    if (draggingRef.current && originRef.current) {
      // Measure pullback in opposite-of-aim direction
      const ang  = aimRef.current;
      const dx   = pt.x - originRef.current.x;
      const dy   = pt.y - originRef.current.y;
      const pull = dx * (-Math.cos(ang)) + dy * (-Math.sin(ang));
      const pct  = Math.min(100, Math.max(0, (pull / 180) * 100));
      powerRef.current = pct;
      setDragPower(pct);
    } else if (!draggingRef.current && !gsRef.current.simulationRunning) {
      // Free aim
      const angle = Math.atan2(pt.y - cb.y, pt.x - cb.x);
      setAimAngle(angle);
      aimRef.current = angle;
    }
  }, [toTable]);

  const onPointerUp = useCallback((_e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) return;
    console.log(`[8-ball] Drag END power:${powerRef.current.toFixed(1)}%`);
    fireShot();
  }, [fireShot]);

  // ── Unified canvas draw ───────────────────────────────────────────────────
  // Called both by React (on aim/state change) and by the physics rAF loop every
  // frame. Reads live aim/power/drag/ball-in-hand from refs so it stays correct
  // without re-creating on every input.
  const drawGame = useCallback((gs: EightBallState, showAim: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas || CW < 100) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const S = canvasScale;

    // Static table
    const tc = tableRef.current;
    if (tc && tc.width === CW) {
      ctx.drawImage(tc, 0, 0);
    } else {
      ctx.fillStyle = "#0e7038"; ctx.fillRect(0, 0, CW, CH);
    }

    const cueBall  = gs.balls.find(b => b.type === "cue" && !b.pocketed);
    const inHand   = ballInHandRef.current;
    const canShoot = showAim && cueBall && !gs.simulationRunning && !gs.gameOver && isMyTurn() && !inHand;

    // ── Ball-in-hand placement zone (left quarter) ────────────────────────
    if (inHand && !gs.simulationRunning && !gs.gameOver) {
      const zoneW = (TABLE_WIDTH / 4) * S;
      ctx.save();
      ctx.fillStyle = "rgba(80,200,255,0.10)";
      ctx.fillRect(ENG_RAIL, ENG_RAIL, zoneW - ENG_RAIL, CH - ENG_RAIL * 2);
      ctx.strokeStyle = "rgba(120,210,255,0.7)";
      ctx.lineWidth = 1.5; ctx.setLineDash([7, 6]);
      ctx.strokeRect(ENG_RAIL, ENG_RAIL, zoneW - ENG_RAIL, CH - ENG_RAIL * 2);
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(190,235,255,0.9)";
      ctx.font = `${Math.round(11 * S)}px sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("Tap to place cue ball", zoneW * 0.5 + ENG_RAIL * 0.5, CH * 0.5);
      ctx.restore();
    }

    // ── Aim + Cue visuals ─────────────────────────────────────────────────
    if (canShoot && cueBall) {
      const bx = cueBall.x * S;
      const by = cueBall.y * S;
      const br = BALL_RADIUS * S;
      const ang = aimRef.current;
      const cw  = Math.cos(ang);
      const sw  = Math.sin(ang);
      const power = powerRef.current;
      const dragging = draggingRef.current;

      ctx.save();
      const contact = findFirstBallContact(cueBall, ang, gs.balls);
      if (contact) {
        const gx = contact.contactX * S;
        const gy = contact.contactY * S;
        // Cue travel line to ghost contact
        const lg = ctx.createLinearGradient(bx, by, gx, gy);
        lg.addColorStop(0, "rgba(255,255,255,0.7)");
        lg.addColorStop(1, "rgba(255,255,255,0.1)");
        ctx.strokeStyle = lg; ctx.lineWidth = 1.4;
        ctx.setLineDash([8 * S, 5 * S]);
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(gx, gy); ctx.stroke();
        ctx.setLineDash([]);
        // Ghost ball circle
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.8;
        ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.arc(gx, gy, br, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        // Target-ball deflection line (direction the struck ball will travel:
        // from the contact point through the target ball's center).
        const hb = contact.hitBall;
        let ddx = hb.x - contact.contactX;
        let ddy = hb.y - contact.contactY;
        const dl = Math.hypot(ddx, ddy) || 1;
        ddx /= dl; ddy /= dl;
        const hx = hb.x * S, hy = hb.y * S;
        const dex = hx + ddx * 165 * S, dey = hy + ddy * 165 * S;
        ctx.strokeStyle = "rgba(255,210,90,0.85)"; ctx.lineWidth = 1.6;
        ctx.setLineDash([6 * S, 5 * S]);
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(dex, dey); ctx.stroke();
        ctx.setLineDash([]);

        // Cue-ball post-contact path (spin-aware preview).
        // Base = natural "stun" tangent (incoming velocity minus its normal
        // component). Spin then bends it: follow/draw push along the impact
        // normal (forward/back), side english nudges it laterally.
        const sp   = spinRef.current;
        const dotN = cw * ddx + sw * ddy;
        let rx = cw - dotN * ddx;          // stun roll-off direction
        let ry = sw - dotN * ddy;
        rx += ddx * sp.y * 1.1;            // follow (+) / draw (−)
        ry += ddy * sp.y * 1.1;
        rx += -ddy * sp.x * 0.5;           // left/right english (lateral)
        ry +=  ddx * sp.x * 0.5;
        const rl = Math.hypot(rx, ry);
        if (rl > 0.08) {
          rx /= rl; ry /= rl;
          const cpx = gx + rx * 100 * S, cpy = gy + ry * 100 * S;
          ctx.strokeStyle = "rgba(120,210,255,0.85)"; ctx.lineWidth = 1.5;
          ctx.setLineDash([5 * S, 5 * S]);
          ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(cpx, cpy); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = "rgba(120,210,255,0.95)";
          ctx.beginPath(); ctx.arc(cpx, cpy, 2.4 * S, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        const ex = bx + cw * 380 * S;
        const ey = by + sw * 380 * S;
        const lg = ctx.createLinearGradient(bx, by, ex, ey);
        lg.addColorStop(0, "rgba(255,255,255,0.65)");
        lg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = lg; ctx.lineWidth = 1.3;
        ctx.setLineDash([8 * S, 5 * S]);
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();

      // Cue stick (pulls back proportional to power)
      const pullback = (power / 100) * 55 * S;
      const cueLen   = 165 * S;
      const tipGap   = (BALL_RADIUS + 3.5) * S + pullback;
      const tx       = bx - cw * tipGap;
      const ty       = by - sw * tipGap;
      const bux      = tx - cw * cueLen;
      const buy      = ty - sw * cueLen;

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 12;
      const cg = ctx.createLinearGradient(tx, ty, bux, buy);
      cg.addColorStop(0,    "#d4a850");
      cg.addColorStop(0.06, "#9e6420");
      cg.addColorStop(0.45, "#5c3210");
      cg.addColorStop(1,    "#1e0c04");
      ctx.strokeStyle = cg; ctx.lineWidth = 7 * S; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(bux, buy); ctx.stroke();
      ctx.shadowBlur = 0;
      // White ferrule
      ctx.strokeStyle = "#eee8de"; ctx.lineWidth = 7.5 * S;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - cw * 8 * S, ty - sw * 8 * S);
      ctx.stroke();
      // Blue leather tip
      ctx.strokeStyle = "#1e38aa"; ctx.lineWidth = 7 * S;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - cw * 4 * S, ty - sw * 4 * S);
      ctx.stroke();
      ctx.restore();

      // Power ring (green→yellow→red arc around cue ball)
      if (dragging && power > 0) {
        const pct = power / 100;
        const rr  = (BALL_RADIUS + 6.5) * S;
        ctx.save();
        ctx.strokeStyle = powerColor(power);
        ctx.lineWidth = 3.5 * S; ctx.lineCap = "round";
        ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(bx, by, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
        ctx.stroke();
        ctx.restore();
      }
    }

    // ── Balls ─────────────────────────────────────────────────────────────
    for (const b of gs.balls) {
      drawBall(ctx, b, S);
    }

    // ── On-canvas status overlay (turn · group · balls left) ──────────────
    drawCanvasOverlay(ctx, gs, S);

  }, [CW, CH, canvasScale, isMyTurn]);

  // Draw the per-player status chips + turn banner directly on the canvas.
  const drawCanvasOverlay = useCallback((ctx: CanvasRenderingContext2D, gs: EightBallState, S: number) => {
    const chipW = Math.min(176 * S, CW * 0.4);
    const chipH = 30 * S;
    const pad   = ENG_RAIL + 5 * S;
    const groupInfo = (g: typeof gs.player1Group) => {
      if (!g) return { label: "Open", left: null as number | null };
      const left = gs.balls.filter(b => b.type === g && !b.pocketed).length;
      return { label: g === "solid" ? "Solids" : "Stripes", left };
    };
    const p1 = groupInfo(gs.player1Group);
    const p2 = groupInfo(gs.player2Group);

    const drawChip = (x: number, name: string, info: { label: string; left: number | null }, active: boolean, align: "left" | "right") => {
      ctx.save();
      roundRectPath(ctx, x, pad, chipW, chipH, 6 * S);
      ctx.fillStyle = active ? "rgba(139,92,246,0.28)" : "rgba(8,16,12,0.55)";
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = active ? "rgba(167,139,250,0.9)" : "rgba(255,255,255,0.14)";
      ctx.stroke();
      ctx.textBaseline = "middle";
      ctx.textAlign = align;
      const tx = align === "left" ? x + 9 * S : x + chipW - 9 * S;
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = `600 ${Math.round(12 * S)}px sans-serif`;
      ctx.fillText(name.length > 14 ? name.slice(0, 13) + "…" : name, tx, pad + chipH * 0.34);
      ctx.fillStyle = "rgba(200,210,225,0.85)";
      ctx.font = `${Math.round(10.5 * S)}px sans-serif`;
      const sub = info.left === null ? info.label : `${info.label} · ${info.left} left`;
      ctx.fillText(sub, tx, pad + chipH * 0.72);
      ctx.restore();
    };

    drawChip(pad, player1Name, p1, gs.currentPlayer === "player1" && !gs.gameOver, "left");
    drawChip(CW - pad - chipW, player2Name, p2, gs.currentPlayer === "player2" && !gs.gameOver, "right");

    // Center status banner
    let banner = "";
    if (gs.gameOver) banner = `${gs.winner === "player1" ? player1Name : player2Name} wins`;
    else if (gs.simulationRunning) banner = "";
    else if (ballInHandRef.current) banner = "Ball in hand";
    else banner = `${gs.currentPlayer === "player1" ? player1Name : player2Name}'s turn`;
    if (banner) {
      ctx.save();
      ctx.font = `600 ${Math.round(11.5 * S)}px sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const tw = ctx.measureText(banner).width + 18 * S;
      const bx = CW / 2 - tw / 2;
      roundRectPath(ctx, bx, pad + 1, tw, chipH - 2, 6 * S);
      ctx.fillStyle = "rgba(8,16,12,0.6)"; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText(banner, CW / 2, pad + chipH / 2);
      ctx.restore();
    }
  }, [CW, player1Name, player2Name]);

  // Keep the draw ref pointed at the latest closure for the rAF loop.
  useEffect(() => { drawRef.current = drawGame; }, [drawGame]);

  // React-driven render: redraw whenever idle state / aim / power changes.
  // (During simulation the rAF loop owns the canvas and this stays dormant.)
  useEffect(() => {
    if (gameState.simulationRunning) return;
    drawGame(gameState, true);
  }, [gameState, aimAngle, isDragging, dragPower, ballInHand, spin, drawGame]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const isP1Turn = gameState.currentPlayer === "player1";
  const myTurnNow = isMyTurn();

  const evBorder = gameEvent?.type === "good" ? "border-green-500/60 bg-green-950/80"
                 : gameEvent?.type === "bad"  ? "border-red-500/60 bg-red-950/80"
                 :                              "border-white/20 bg-black/70";
  const evColor  = gameEvent?.type === "good" ? "text-green-300"
                 : gameEvent?.type === "bad"  ? "text-red-300" : "text-white";

  return (
    <GameLayout match={match} currentUserId={currentUserId} accentColor="#8b5cf6" accentRgb="139,92,246" showPills={false} className="flex flex-col" controls="Drag cue to aim" winCondition="Pot all balls + 8-ball">
      {showIntro && (
        <MatchIntroAnimation
          playerOneName={player1Name}
          playerTwoName={player2Name}
          playerOneImage={match.player1?.profileImageUrl}
          playerTwoImage={match.isBotMatch ? undefined : match.player2?.profileImageUrl}
          playerOneStake={parseFloat(match.betAmount || "0")}
          playerTwoStake={parseFloat(match.betAmount || "0")}
          isPractice={!!(match.isPractice)}
          isBotMatch={!!(match.isBotMatch)}
          gameLabel="8-Ball Pool"
          winCondition="Pot all + 8-ball"
          timeLimit="30s per shot"
          disconnectPolicy="5-min reconnect window"
          onComplete={() => setShowIntro(false)}
        />
      )}
      {/* Premium Game HUD */}
      <div className="px-3 pt-2">
        <GameHUD
          match={match}
          currentUserId={currentUserId}
          activePlayer={gameState.gameOver ? null : (myTurnNow ? "left" : "right")}
          leftLabel={
            gameState.gameOver ? undefined
            : myTurnNow ? (gameState.player1Group ? `Your turn · ${isPlayer1 ? gameState.player1Group : gameState.player2Group}` : "Your turn")
            : "Waiting..."
          }
          rightLabel={
            gameState.gameOver ? undefined
            : !myTurnNow ? (gameState.player2Group ? `Shooting · ${isPlayer1 ? gameState.player2Group : gameState.player1Group}` : "Their turn")
            : "Waiting..."
          }
        />
      </div>
      {/* Event feed overlay */}
      <div className="fixed bottom-24 right-4 z-40 pointer-events-none">
        <EventFeed />
      </div>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-3 py-2 border-b bg-card/90 backdrop-blur-sm shrink-0 sticky top-0 z-20">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="button-back-8ball">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <h2 className="font-bold">8-Ball Pool</h2>
          {match.betAmount && parseFloat(match.betAmount) > 0 && (
            <Badge variant="secondary" className="text-xs">${match.betAmount}</Badge>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {gameState.gameOver && (
            <Badge className="gap-1">
              <Trophy className="w-3 h-3" />
              {gameState.winner === "player1" ? player1Name : player2Name} Wins!
            </Badge>
          )}
        </div>
      </div>

      {/* ── Player panels ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 px-3 pt-3 pb-2 shrink-0">
        {[
          { name: player1Name, player: match.player1, group: gameState.player1Group, active: isP1Turn, label: "P1" },
          { name: player2Name, player: match.player2, group: gameState.player2Group, active: !isP1Turn, label: "P2" },
        ].map(({ name, player, group, active, label }, i) => (
          <div key={i}
            className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-md bg-card border transition-all duration-400 overflow-hidden ${
              active && !gameState.gameOver
                ? "border-primary/70 shadow-[0_0_18px_-4px_hsl(var(--primary)/0.5)]"
                : "border-border/60"
            }`}
          >
            {/* Active player glow bar */}
            {active && !gameState.gameOver && (
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary rounded-l-md" />
            )}
            <Avatar className="w-8 h-8 shrink-0">
              <AvatarImage src={player?.profileImageUrl || undefined} style={{ objectFit: "cover" }} />
              <AvatarFallback className="text-xs font-bold">{player?.firstName?.[0] || label}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate leading-tight">{name}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {group ? (
                  <>
                    <div className="w-2.5 h-2.5 rounded-full border border-white/20"
                         style={{ background: group === "solid" ? "#f0c000" : "linear-gradient(135deg,#f0c000 40%,#f2efe8 40%)" }} />
                    <span className="text-xs text-muted-foreground">
                      {group === "solid" ? "Solids" : "Stripes"} ·{" "}
                      {gameState.balls.filter(b => b.type === group && !b.pocketed).length} left
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Break shot</span>
                )}
              </div>
            </div>
            {active && !gameState.gameOver && (
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* ── Game area ─────────────────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 flex flex-col items-center justify-center px-2 py-2 gap-2">

        {/* Status line */}
        <div className="h-6 flex items-center justify-center">
          {gameState.simulationRunning ? (
            <span className="text-xs text-muted-foreground animate-pulse tracking-wide">Simulating…</span>
          ) : gameState.gameOver ? (
            <span className="text-xs text-muted-foreground">Game over</span>
          ) : myTurnNow ? (
            <span className="text-xs text-muted-foreground">
              {isDragging ? `Power · ${Math.round(dragPower)}%` : "Hover to aim · Drag back · Release to shoot"}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Waiting for {isP1Turn ? player1Name : player2Name}…
            </span>
          )}
        </div>

        {/* Atmospheric pool hall background */}
        <div
          className="relative rounded-xl overflow-hidden"
          style={{
            padding: "28px 32px 28px 32px",
            background: [
              "radial-gradient(ellipse 80% 60% at 50% 20%, rgba(60,180,100,0.09) 0%, transparent 60%)",
              "radial-gradient(ellipse 120% 80% at 50% 50%, rgba(10,30,18,0.98) 0%, rgba(5,14,8,0.99) 100%)",
            ].join(", "),
            boxShadow: "0 0 80px 20px rgba(18,80,40,0.25), 0 0 140px 40px rgba(0,0,0,0.85)",
          }}
        >
          {/* Ceiling light shaft */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: "10%", right: "10%", top: 0, height: "28px",
              background: "linear-gradient(to bottom, rgba(240,230,180,0.12) 0%, transparent 100%)",
              filter: "blur(8px)",
            }}
          />
          {/* Side ambient glow — left */}
          <div className="absolute left-0 top-1/4 bottom-1/4 w-6 pointer-events-none"
            style={{ background: "linear-gradient(to right, rgba(20,100,50,0.15), transparent)" }} />
          {/* Side ambient glow — right */}
          <div className="absolute right-0 top-1/4 bottom-1/4 w-6 pointer-events-none"
            style={{ background: "linear-gradient(to left, rgba(20,100,50,0.15), transparent)" }} />

        {/* Table container */}
        <div className="relative" style={{ width: CW, height: CH }}>
          <canvas
            ref={canvasRef}
            width={CW}
            height={CH}
            className={`block select-none rounded-sm transition-shadow duration-300 ${
              pocketFlash ? "shadow-[0_0_36px_10px_rgba(70,255,120,0.4)]" : ""
            }`}
            style={{
              cursor: gameState.simulationRunning ? "default" : ballInHand ? "copy" : isDragging ? "grabbing" : "crosshair",
              touchAction: "none",
            }}
            data-testid="canvas-pool-table"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          />

          {/* Spin / english control — floats in the bottom-right of the felt */}
          {myTurnNow && !gameState.simulationRunning && !gameState.gameOver && !ballInHand && (
            <div
              className="absolute bottom-3 right-3 z-20 rounded-xl p-2 backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-200"
              style={{ background: "rgba(8,16,12,0.55)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 8px 24px rgba(0,0,0,0.55)" }}
            >
              <SpinControl value={spin} onChange={setSpin} />
            </div>
          )}

          {/* Event overlay */}
          {gameEvent && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`px-5 py-3 rounded-lg border backdrop-blur-md ${evBorder} animate-in fade-in-0 zoom-in-95 duration-200`}>
                <p className={`text-lg font-bold text-center tracking-wide ${evColor}`}>{gameEvent.text}</p>
                {gameEvent.sub && (
                  <p className="text-xs text-center text-muted-foreground mt-0.5">{gameEvent.sub}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Power bar (drag only) */}
        {isDragging && (
          <div className="flex items-center gap-2.5 w-44">
            <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-75"
                style={{
                  width: `${dragPower}%`,
                  background: `linear-gradient(to right, ${powerColor(0)}, ${powerColor(50)}, ${powerColor(dragPower)})`,
                }}
              />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{Math.round(dragPower)}%</span>
          </div>
        )}

        {/* Game over actions */}
        {gameState.gameOver && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setGameState(createInitialState())}>
              Play Again
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setLocation("/")}>
              Leave
            </Button>
          </div>
        )}
        </div>{/* /atmospheric pool hall wrapper */}
      </div>
    </GameLayout>
  );
}
