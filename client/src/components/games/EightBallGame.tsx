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
  computeWallBounceTrajectory,
  EIGHT_BALL_CONSTANTS,
} from "@shared/eightBallEngine";

import { ArrowLeft, Trophy, Circle } from "lucide-react";
import { useLocation } from "wouter";
import { GameHUD, emitFeedEvent, EventFeed } from "@/components/games/GameHUD";
import { useToast } from "@/hooks/use-toast";

const { TABLE_WIDTH, TABLE_HEIGHT, BALL_RADIUS, POCKET_RADIUS,
  PHYS_RAIL: ENG_RAIL, CORNER_MOUTH: ENG_CORNER, SIDE_MOUTH: ENG_SIDE } = EIGHT_BALL_CONSTANTS;

interface EightBallGameProps {
  match: MatchWithPlayers;
  currentUserId?: string;
}

// Ball number Ã¢ÂÂ base color
const BALL_COLORS: Record<number, string> = {
  1: "#f0c000", 2: "#1a44cc", 3: "#cc1414", 4: "#7a1daa",
  5: "#e85500", 6: "#1a7a1a", 7: "#aa1111", 8: "#111111",
  9: "#f0c000", 10: "#1a44cc", 11: "#cc1414", 12: "#7a1daa",
  13: "#e85500", 14: "#1a7a1a", 15: "#aa1111",
};

type EvType = "good" | "bad" | "info";
interface GameEvent { text: string; sub?: string; type: EvType; id: number; emoji?: string }

// Ã¢ÂÂÃ¢ÂÂ Particle system Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: "spark" | "ring" | "star";
}

function spawnPocketParticles(
  px: number, py: number, ballColor: string, particles: Particle[], S: number,
) {
  const cx = px * S;
  const cy = py * S;
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.4;
    const speed = (1.8 + Math.random() * 3.5) * S;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 22 + Math.random() * 14,
      maxLife: 36,
      color: ballColor,
      size: (1.5 + Math.random() * 2.5) * S,
      type: Math.random() < 0.25 ? "star" : "spark",
    });
  }
  // Expanding ring
  particles.push({
    x: cx, y: cy, vx: 0, vy: 0,
    life: 20, maxLife: 20,
    color: "rgba(255,255,255,0.9)",
    size: BALL_RADIUS * S,
    type: "ring",
  });
  // Gold shimmer ring
  particles.push({
    x: cx, y: cy, vx: 0, vy: 0,
    life: 14, maxLife: 14,
    color: "rgba(255,210,60,0.85)",
    size: BALL_RADIUS * S * 0.6,
    type: "ring",
  });
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, points: number, outer: number, inner: number) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
}

function updateAndDrawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): Particle[] {
  const alive: Particle[] = [];
  for (const p of particles) {
    if (p.life <= 0) continue;
    p.x  += p.vx;
    p.y  += p.vy;
    p.vy += 0.08; // subtle gravity
    p.vx *= 0.96;
    p.life--;
    const alpha = p.life / p.maxLife;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (p.type === "ring") {
      const progress = 1 - alpha;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5 * alpha;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size + progress * p.size * 2.2, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.type === "star") {
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 5;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.life * 0.22);
      drawStar(ctx, 0, 0, 4, p.size * alpha, p.size * 0.45 * alpha);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    alive.push(p);
  }
  return alive;
}

// Ã¢ÂÂÃ¢ÂÂ Table builder Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
function buildTableCanvas(W: number, H: number, RAIL: number): HTMLCanvasElement {
  const off = document.createElement("canvas");
  off.width = W; off.height = H;
  const g = off.getContext("2d")!;

  const S       = W / TABLE_WIDTH;
  const PR      = POCKET_RADIUS * S;
  const CORNER_C = ENG_CORNER * S;
  const SIDE_C   = ENG_SIDE   * S;
  const CT       = 6;

  // Outer dark frame
  g.fillStyle = "#1a0a00";
  g.fillRect(0, 0, W, H);
  // Dark border
  g.strokeStyle = "rgba(80,40,0,0.8)";
  g.lineWidth = 3;
  g.strokeRect(1, 1, W - 2, H - 2);

  // Red rail background
  const rail = g.createLinearGradient(0, 0, 0, H);
  rail.addColorStop(0,   "#8b1a1a");
  rail.addColorStop(0.5, "#6b1010");
  rail.addColorStop(1,   "#4a0808");
  g.fillStyle = rail;
  g.fillRect(3, 3, W - 6, H - 6);

  // Rail highlight/bevel
  g.fillStyle = "rgba(255,80,80,0.12)";
  g.beginPath();
  g.moveTo(3, 3); g.lineTo(RAIL, RAIL); g.lineTo(W - RAIL, RAIL); g.lineTo(W - 3, 3); g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(3, 3); g.lineTo(RAIL, RAIL); g.lineTo(RAIL, H - RAIL); g.lineTo(3, H - 3); g.closePath();
  g.fill();
  g.fillStyle = "rgba(0,0,0,0.4)";
  g.beginPath();
  g.moveTo(3, H - 3); g.lineTo(RAIL, H - RAIL); g.lineTo(W - RAIL, H - RAIL); g.lineTo(W - 3, H - 3); g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(W - 3, 3); g.lineTo(W - RAIL, RAIL); g.lineTo(W - RAIL, H - RAIL); g.lineTo(W - 3, H - 3); g.closePath();
  g.fill();

  // Diamond markers on rails (white dots)
  const drawDiamond = (x: number, y: number) => {
    g.beginPath(); g.arc(x, y, 4 * S, 0, Math.PI * 2);
    g.fillStyle = "rgba(255,255,255,0.85)"; g.fill();
    g.strokeStyle = "rgba(0,0,0,0.3)"; g.lineWidth = 0.5; g.stroke();
  };
  // Top rail diamonds
  const topY = RAIL * 0.5; const botY = H - RAIL * 0.5;
  const lftX = RAIL * 0.5; const rgtX = W - RAIL * 0.5;
  for (let i = 1; i <= 3; i++) { drawDiamond(W * i / 4, topY); drawDiamond(W * i / 4, botY); }
  for (let i = 1; i <= 1; i++) { drawDiamond(lftX, H * i / 2); drawDiamond(rgtX, H * i / 2); }

  // Blue felt surface
  const felt = g.createRadialGradient(W * 0.5, H * 0.4, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.7);
  felt.addColorStop(0,    "#1fa8e8");
  felt.addColorStop(0.3,  "#1590cc");
  felt.addColorStop(0.7,  "#0e6fa0");
  felt.addColorStop(1,    "#0a5580");
  g.fillStyle = felt;
  g.fillRect(RAIL, RAIL, W - RAIL * 2, H - RAIL * 2);

  // Felt texture lines
  g.save();
  g.globalAlpha = 0.035;
  g.strokeStyle = "#60d0ff";
  g.lineWidth = 0.5;
  for (let x = RAIL; x < W - RAIL; x += 6) {
    g.beginPath(); g.moveTo(x, RAIL); g.lineTo(x, H - RAIL); g.stroke();
  }
  g.restore();

  // Center overhead light
  const lm = g.createRadialGradient(W * 0.5, H * 0.3, 0, W * 0.5, H * 0.5, W * 0.5);
  lm.addColorStop(0,   "rgba(255,255,255,0.10)");
  lm.addColorStop(0.5, "rgba(200,240,255,0.04)");
  lm.addColorStop(1,   "transparent");
  g.fillStyle = lm;
  g.fillRect(RAIL, RAIL, W - RAIL * 2, H - RAIL * 2);

  // Cushion rubber strips (dark red)
  const drawCushion = (x: number, y: number, w: number, h: number) => {
    g.fillStyle = "#6b1010";
    g.fillRect(x, y, w, h);
    const isHoriz = w > h;
    if (isHoriz) {
      g.fillStyle = "rgba(255,80,80,0.15)";
      g.fillRect(x, y, w, h * 0.35);
      g.fillStyle = "rgba(0,0,0,0.4)";
      g.fillRect(x, y + h * 0.65, w, h * 0.35);
    } else {
      g.fillStyle = "rgba(255,80,80,0.15)";
      g.fillRect(x, y, w * 0.35, h);
      g.fillStyle = "rgba(0,0,0,0.4)";
      g.fillRect(x + w * 0.65, y, w * 0.35, h);
    }
  };

  drawCushion(CORNER_C,       RAIL - CT, W / 2 - CORNER_C - SIDE_C, CT);
  drawCushion(W / 2 + SIDE_C, RAIL - CT, W / 2 - CORNER_C - SIDE_C, CT);
  drawCushion(CORNER_C,       H - RAIL,  W / 2 - CORNER_C - SIDE_C, CT);
  drawCushion(W / 2 + SIDE_C, H - RAIL,  W / 2 - CORNER_C - SIDE_C, CT);
  drawCushion(RAIL - CT, CORNER_C, CT, H - 2 * CORNER_C);
  drawCushion(W - RAIL,  CORNER_C, CT, H - 2 * CORNER_C);

  g.save();
  g.strokeStyle = "rgba(0,0,0,0.75)";
  g.lineWidth = 8;
  g.strokeRect(RAIL + 2, RAIL + 2, W - RAIL * 2 - 4, H - RAIL * 2 - 4);
  g.restore();

  // Spot markers & head string
  g.strokeStyle = "rgba(255,255,255,0.18)";
  g.lineWidth = 1.5;
  for (const sx of [W * 0.25, W * 0.5, W * 0.75]) {
    g.beginPath(); g.arc(sx, H * 0.5, 4, 0, Math.PI * 2); g.stroke();
  }
  g.strokeStyle = "rgba(255,255,255,0.08)";
  g.lineWidth = 1;
  g.setLineDash([4, 7]);
  g.beginPath(); g.moveTo(W * 0.25, RAIL); g.lineTo(W * 0.25, H - RAIL); g.stroke();
  g.setLineDash([]);
  // Felt inner border shadow
  g.save();
  g.strokeStyle = "rgba(0,0,0,0.5)";
  g.lineWidth = 6;
  g.strokeRect(RAIL + 2, RAIL + 2, W - RAIL * 2 - 4, H - RAIL * 2 - 4);
  g.restore();

  // Pockets
  const drawCornerPocket = (cx: number, cy: number, sx: number, sy: number) => {
    const vr  = PR * 1.22;
    const jaw = CORNER_C * 0.55;
    const j1x = cx + sx * jaw, j1y = cy;
    const j2x = cx,             j2y = cy + sy * jaw;

    g.save();
    g.beginPath();
    g.moveTo(cx, cy); g.lineTo(j1x, cy); g.lineTo(j1x, j2y); g.lineTo(cx, j2y);
    g.closePath();
    g.fillStyle = "#050201"; g.fill();

    const hcx = cx + sx * jaw * 0.6;
    const hcy = cy + sy * jaw * 0.6;
    const aura = g.createRadialGradient(hcx, hcy, 0, hcx, hcy, vr * 2.2);
    aura.addColorStop(0,   "rgba(0,0,0,0.95)");
    aura.addColorStop(0.5, "rgba(0,0,0,0.6)");
    aura.addColorStop(1,   "transparent");
    g.fillStyle = aura;
    g.beginPath(); g.arc(hcx, hcy, vr * 2.2, 0, Math.PI * 2); g.fill();

    const collar = g.createRadialGradient(hcx - sx * vr * 0.15, hcy - sy * vr * 0.15, 0, hcx, hcy, vr * 1.22);
    collar.addColorStop(0,    "#7c4818");
    collar.addColorStop(0.55, "#3e2008");
    collar.addColorStop(1,    "#190900");
    g.fillStyle = collar;
    g.beginPath(); g.arc(hcx, hcy, vr * 1.22, 0, Math.PI * 2); g.fill();

    const depth = g.createRadialGradient(hcx, hcy, 0, hcx, hcy, vr);
    depth.addColorStop(0,   "#100804");
    depth.addColorStop(0.8, "#050301");
    depth.addColorStop(1,   "#000000");
    g.fillStyle = depth;
    g.beginPath(); g.arc(hcx, hcy, vr, 0, Math.PI * 2); g.fill();

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

    g.strokeStyle = "rgba(200,130,50,0.4)";
    g.lineWidth = 1.6;
    const a1 = Math.atan2(-sy, -sx) - 0.3;
    const a2 = a1 + 0.9;
    g.beginPath(); g.arc(hcx - sx * vr * 0.2, hcy - sy * vr * 0.2, vr * 0.72, a1, a2);
    g.stroke();
    g.restore();
  };

  const drawSidePocket = (cx: number, cy: number, onTop: boolean) => {
    const sy  = onTop ? 1 : -1;
    const vr  = PR * 1.08;
    const jawW = SIDE_C;
    const jawD = CT + 4;

    g.save();
    g.fillStyle = "#060302";
    g.fillRect(cx - jawW * 1.1, onTop ? (RAIL - jawD) : (cy - 2), jawW * 2.2, jawD + 4);

    const aura = g.createRadialGradient(cx, cy, 0, cx, cy, vr * 2.0);
    aura.addColorStop(0,   "rgba(0,0,0,0.92)");
    aura.addColorStop(0.5, "rgba(0,0,0,0.55)");
    aura.addColorStop(1,   "transparent");
    g.fillStyle = aura;
    g.beginPath(); g.arc(cx, cy, vr * 2.0, 0, Math.PI * 2); g.fill();

    const collar = g.createRadialGradient(cx - 2, cy - sy * vr * 0.15, 0, cx, cy, vr * 1.15);
    collar.addColorStop(0,    "#7c4818");
    collar.addColorStop(0.55, "#3e2008");
    collar.addColorStop(1,    "#190900");
    g.fillStyle = collar;
    g.beginPath(); g.ellipse(cx, cy, vr * 1.15, vr * 0.95, 0, 0, Math.PI * 2); g.fill();

    const depth = g.createRadialGradient(cx, cy, 0, cx, cy, vr * 0.96);
    depth.addColorStop(0,   "#100804");
    depth.addColorStop(0.8, "#050301");
    depth.addColorStop(1,   "#000000");
    g.fillStyle = depth;
    g.beginPath(); g.ellipse(cx, cy, vr * 0.96, vr * 0.78, 0, 0, Math.PI * 2); g.fill();

    const jawFaceY = onTop ? RAIL - CT : H - RAIL + CT - 4;
    g.fillStyle = "#0a5a2a";
    g.fillRect(cx - jawW * 1.08, jawFaceY - (onTop ? 0 : 4), 5, CT + 4);
    g.fillRect(cx + jawW * 1.08 - 5, jawFaceY - (onTop ? 0 : 4), 5, CT + 4);

    const tipY = onTop ? RAIL - 2 : H - RAIL + 2;
    for (const tx of [cx - jawW * 1.05, cx + jawW * 1.05]) {
      const chrome = g.createRadialGradient(tx - 1, tipY - sy * 1.5, 0, tx, tipY, 4);
      chrome.addColorStop(0,   "#e0d8c0");
      chrome.addColorStop(0.5, "#989080");
      chrome.addColorStop(1,   "#403830");
      g.fillStyle = chrome;
      g.beginPath(); g.arc(tx, tipY, 3.5, 0, Math.PI * 2); g.fill();
    }

    g.strokeStyle = "rgba(200,130,50,0.38)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(cx - 2, cy - sy * vr * 0.15, vr * 0.7, Math.PI * 0.2, Math.PI * 0.8);
    g.stroke();
    g.restore();
  };

  drawCornerPocket(0, 0,  +1, +1);
  drawCornerPocket(W, 0,  -1, +1);
  drawCornerPocket(0, H,  +1, -1);
  drawCornerPocket(W, H,  -1, -1);
  drawSidePocket(W / 2,  PR * 0.7,     true);
  drawSidePocket(W / 2,  H - PR * 0.7, false);

  return off;
}

// Ã¢ÂÂÃ¢ÂÂ Ball renderer Ã¢ÂÂ uses ball.rotation for realistic rolling spin Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
function drawBall(
  g: CanvasRenderingContext2D,
  ball: { x: number; y: number; number: number; type: string; pocketed: boolean; rotation: number },
  S: number,
) {
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
  const isStripe = ball.type === "stripe";
  const base    = isCue ? "#f2efe8" : isEight ? "#1a1a1a" : isStripe ? "#f0ece0" : BALL_COLORS[ball.number] ?? "#888"; // stripe=white base

  // 3-D sphere gradient (fixed light source Ã¢ÂÂ doesn't rotate with ball)
  const lightX = -r * 0.3;
  const lightY = -r * 0.3;
  const sphere = g.createRadialGradient(lightX, lightY, r * 0.05, 0, 0, r * 1.05);
  const lighten = (hex: string, amt: number) => {
    const n = parseInt(hex.replace("#", ""), 16);
    const cl = (v: number) => Math.max(0, Math.min(255, v + amt)).toString(16).padStart(2, "0");
    return `#${cl((n >> 16) & 255)}${cl((n >> 8) & 255)}${cl(n & 255)}`;
  };
  sphere.addColorStop(0,    lighten(base, 90));
  sphere.addColorStop(0.28, lighten(base, 38));
  sphere.addColorStop(0.6,  base);
  sphere.addColorStop(1,    lighten(base, -72));
  g.fillStyle = sphere;
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();

  // Visual rotation Ã¢ÂÂ scaled down so the spin looks smooth (~2 rot/sec at medium speed)
  // Numbers spin WITH the ball so rolling is clearly visible
  const rot = (ball.rotation ?? 0) * 1.0; // full rotation rate

  g.save(); // save pre-rotation state for gloss later
  g.rotate(rot);

  // Stripe band for stripe balls
  if (ball.type === "stripe") {
    const sc = BALL_COLORS[ball.number] ?? "#e8c200";
    g.save();
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.clip();
    const bandG = g.createLinearGradient(0, -r, 0, r);
    bandG.addColorStop(0,    "rgba(0,0,0,0)");
    bandG.addColorStop(0.2,  "rgba(0,0,0,0)");
    bandG.addColorStop(0.28, sc);
    bandG.addColorStop(0.72, sc);
    bandG.addColorStop(0.8,  "rgba(0,0,0,0)");
    bandG.addColorStop(1,    "rgba(0,0,0,0)");
    g.fillStyle = bandG;
    g.fillRect(-r, -r, r * 2, r * 2);
    g.restore();
  }

  // Number disc Ã¢ÂÂ spins with ball so rolling is obvious
  if (ball.number > 0) {
    g.fillStyle = "rgba(255,255,255,0.94)";
    g.beginPath(); g.arc(0, 0, r * 0.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#111";
    g.font = `bold ${Math.round(r * 0.8)}px sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(ball.number.toString(), 0, r * 0.04);
  }

  g.restore(); // back to pre-rotation Ã¢ÂÂ gloss stays fixed at light source

  // Gloss highlight (fixed light position, doesn't rotate)
  const gloss = g.createRadialGradient(lightX, lightY, 0, lightX * 0.7, lightY * 0.7, r * 0.55);
  gloss.addColorStop(0,   "rgba(255,255,255,0.78)");
  gloss.addColorStop(0.4, "rgba(255,255,255,0.22)");
  gloss.addColorStop(1,   "rgba(255,255,255,0)");
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

// Power meter colour ramp
function powerColor(pct: number): string {
  const h = Math.max(0, Math.min(120, 120 * (1 - pct / 100)));
  return `hsl(${Math.round(h)}, 85%, 50%)`;
}

// Rounded rectangle path helper
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

// Ã¢ÂÂÃ¢ÂÂ Spin / English control Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
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
    const cy = r.top  + r.height / 2;
    let nx = (clientX - cx) / (r.width  / 2);
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
  const onUp = (e: React.PointerEvent) => { draggingRef.current = false; e.stopPropagation(); };

  // Contact dot position (clamped to 80% of radius)
  const dotX = value.x * 38;
  const dotY = -value.y * 38;
  const active = Math.abs(value.x) > 0.04 || Math.abs(value.y) > 0.04;

  const label =
    !active ? "Center"
    : (Math.abs(value.y) >= Math.abs(value.x)
        ? (value.y > 0 ? "Top spin" : "Draw")
        : (value.x > 0 ? "Right english" : "Left english"));

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.7)" }}>Spin</span>
      <div
        ref={ref}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        data-testid="control-spin"
        className={`relative rounded-full touch-none ${disabled ? "opacity-40" : "cursor-pointer"}`}
        style={{
          width: 100, height: 100,
          // Large pearl cue ball look
          background: "radial-gradient(circle at 35% 28%, #ffffff 0%, #e8edf5 30%, #c0ccdc 65%, #8898b0 100%)",
          boxShadow: [
            "inset 0 3px 8px rgba(255,255,255,0.9)",
            "inset 0 -10px 20px rgba(10,20,40,0.45)",
            "0 6px 20px rgba(0,0,0,0.7)",
            active ? "0 0 18px 4px rgba(255,60,60,0.5)" : "",
          ].filter(Boolean).join(", "),
          border: "2px solid rgba(255,255,255,0.3)",
        }}
      >
        {/* Crosshair lines */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div style={{ position: "absolute", left: "50%", top: "12%", bottom: "12%", width: "1px", background: "rgba(0,0,80,0.2)", transform: "translateX(-50%)" }} />
          <div style={{ position: "absolute", top: "50%", left: "12%", right: "12%", height: "1px", background: "rgba(0,0,80,0.2)", transform: "translateY(-50%)" }} />
        </div>
        {/* Red contact indicator */}
        <div
          className="absolute pointer-events-none transition-[left,top] duration-75"
          style={{
            left: `calc(50% + ${dotX}px)`,
            top: `calc(50% + ${dotY}px)`,
            transform: "translate(-50%, -50%)",
            width: 22, height: 22,
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 30%, #ff6060 0%, #cc0000 70%)",
            boxShadow: "0 0 8px 3px rgba(255,0,0,0.6), 0 2px 4px rgba(0,0,0,0.5)",
            border: "2px solid rgba(255,180,180,0.8)",
          }}
        />
        {/* Gloss */}
        <div className="absolute pointer-events-none" style={{
          top: "10%", left: "20%", width: "35%", height: "30%",
          background: "radial-gradient(ellipse, rgba(255,255,255,0.55) 0%, transparent 100%)",
          borderRadius: "50%",
        }} />
      </div>
      <span className="text-[10px] tabular-nums" style={{ color: "rgba(255,255,255,0.6)", height: "14px" }}>{label}</span>
    </div>
  );
}

// Ã¢ÂÂÃ¢ÂÂ Pocketed ball tray Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
function PocketedTray({ balls, group, side }: {
  balls: Array<{ number: number; type: string; pocketed: boolean }>;
  group: string | null;
  side: "left" | "right";
}) {
  const pocketed = balls.filter(b => b.pocketed && b.type !== "cue" && b.type !== "eight" && (group ? b.type === group : true));
  const slots = 7;
  return (
    <div className={`flex items-center gap-1 ${side === "right" ? "flex-row-reverse" : "flex-row"}`}>
      {Array.from({ length: slots }).map((_, i) => {
        const ball = pocketed[i];
        if (!ball) return (
          <div key={i} className="w-5 h-5 rounded-full border border-white/10" style={{ background: "rgba(255,255,255,0.04)" }} />
        );
        return (
          <div key={i} className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold border border-white/20"
            style={{
              background: BALL_COLORS[ball.number] ?? "#888",
              boxShadow: `0 0 6px 1px ${BALL_COLORS[ball.number] ?? "#888"}66`,
              color: ball.number === 8 ? "#fff" : "#000",
            }}>
            {ball.number}
          </div>
        );
      })}
    </div>
  );
}

// Ã¢ÂÂÃ¢ÂÂ Component Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
export default function EightBallGame({ match, currentUserId }: EightBallGameProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [showIntro, setShowIntro]     = useState(true);
  const [gameState, setGameState]     = useState<EightBallState>(() =>
    (match.gameState as any)?.balls ? (match.gameState as EightBallState) : createInitialState()
  );
  const [aimAngle, setAimAngle]       = useState(Math.PI);
  const [isDragging, setIsDragging]   = useState(false);
  const [dragPower, setDragPower]     = useState(0);
  const [canvasScale, setCanvasScale] = useState(1);
  const [gameEvent, setGameEvent]     = useState<GameEvent | null>(null);
  const [pocketFlash, setPocketFlash] = useState(false);
  const [ballInHand, setBallInHand]   = useState(false);
  const [spin, setSpin]               = useState({ x: 0, y: 0 });
  const evId = useRef(0);

  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const tableRef      = useRef<HTMLCanvasElement | null>(null);
  const animRef       = useRef<number>();
  const wsRef         = useRef<WebSocket | null>(null);
  const simRef        = useRef<EightBallState | null>(null);
  const ballInHandRef = useRef(false);
  const spinRef       = useRef({ x: 0, y: 0 });
  const drawRef       = useRef<(state: EightBallState, showAim: boolean) => void>(() => {});
  const particlesRef  = useRef<Particle[]>([]);
  const prevPocketedRef = useRef<number[]>([]);

  const gsRef       = useRef(gameState);
  const aimRef      = useRef(aimAngle);
  const draggingRef = useRef(false);
  const powerRef    = useRef(0);
  const originRef   = useRef<{ x: number; y: number } | null>(null);
  const matchRef    = useRef(match);
  const ip1Ref      = useRef(match.player1Id === currentUserId);
  const prevSimRef  = useRef(false);

  useEffect(() => { gsRef.current  = gameState; }, [gameState]);
  useEffect(() => { aimRef.current = aimAngle;  }, [aimAngle]);
  useEffect(() => { matchRef.current = match;   }, [match]);
  useEffect(() => { ip1Ref.current = match.player1Id === currentUserId; }, [match, currentUserId]);

  const isPlayer1   = match.player1Id === currentUserId;
  const player1Name = match.player1?.firstName || "Player 1";
  const player2Name = getBotOpponentName(match);

  const isMyTurn = useCallback((): boolean => {
    const m   = matchRef.current;
    const gs  = gsRef.current;
    const ip1 = ip1Ref.current;
    if (m.isPractice) return true;
    return (gs.currentPlayer === "player1" && ip1) ||
           (gs.currentPlayer === "player2" && !ip1);
  }, []);

  const showEvent = useCallback((text: string, sub?: string, type: EvType = "info", emoji?: string) => {
    const id = ++evId.current;
    setGameEvent({ text, sub, type, id, emoji });
    setTimeout(() => setGameEvent(e => e?.id === id ? null : e), 3000);
  }, []);

  // Canvas scale
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

  // Build offscreen table
  useEffect(() => {
    if (CW < 100) return;
    tableRef.current = buildTableCanvas(CW, CH, RAIL);
  }, [CW, CH, RAIL]);

  // Sync match state
  useEffect(() => {
    if ((match.gameState as any)?.balls) setGameState(match.gameState as EightBallState);
  }, [match.gameState]);

  // Physics rAF loop
  useEffect(() => {
    if (!gameState.simulationRunning) return;
    simRef.current = cloneState(gameState);

    const tick = () => {
      const sim = simRef.current;
      if (!sim) return;
      simulatePhysics(sim);
      drawRef.current(sim, false);
      if (!sim.simulationRunning) {
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

  useEffect(() => { spinRef.current = spin; }, [spin]);
  useEffect(() => { ballInHandRef.current = ballInHand; }, [ballInHand]);

  useEffect(() => {
    if (!gameState.simulationRunning && !gameState.gameOver && gameState.foul && isMyTurn()) {
      setBallInHand(true);
    } else {
      setBallInHand(false);
    }
  }, [gameState.simulationRunning, gameState.gameOver, gameState.foul, gameState.currentPlayer, isMyTurn]);

  // Detect shot resolution Ã¢ÂÂ spawn particles + fire events
  useEffect(() => {
    const wasRunning = prevSimRef.current;
    prevSimRef.current = gameState.simulationRunning;
    if (!wasRunning || gameState.simulationRunning) return;

    const pocketed = gameState.lastShotPocketed;
    const foul     = gameState.foul;
    const over     = gameState.gameOver;

    // Spawn pocket particles for each newly pocketed ball
    const prev = prevPocketedRef.current;
    for (const num of pocketed) {
      if (prev.includes(num)) continue;
      const ball = gameState.balls.find(b => b.number === num);
      if (!ball) continue;
      const pocket = gameState.pockets.reduce((best, p) => {
        const d  = Math.hypot(p.x - ball.x, p.y - ball.y);
        const bd = Math.hypot(best.x - ball.x, best.y - ball.y);
        return d < bd ? p : best;
      }, gameState.pockets[0]);
      const color = num === 0 ? "#f2efe8" : (BALL_COLORS[num] ?? "#888");
      spawnPocketParticles(pocket.x, pocket.y, color, particlesRef.current, canvasScale);
    }
    prevPocketedRef.current = pocketed;

    if (over) {
      const wName = gameState.winner === "player1" ? player1Name : player2Name;
      showEvent(`${wName} Wins!`, undefined, "good", "Ã°ÂÂÂ");
    } else if (pocketed.includes(8) && !over) {
      showEvent("8-Ball Sunk!", "Opponent wins the game", "bad", "Ã°ÂÂÂ");
    } else if (foul) {
      const cbSunk = !gsRef.current.balls.find(b => b.type === "cue" && !b.pocketed);
      showEvent(cbSunk ? "Scratch!" : "Foul!", "Ball in hand for opponent", "bad", "Ã¢ÂÂ Ã¯Â¸Â");
    } else if (pocketed.length >= 2) {
      showEvent("Multi-ball!", `${pocketed.length} balls pocketed`, "good", "Ã°ÂÂÂ¥");
      setPocketFlash(true); setTimeout(() => setPocketFlash(false), 900);
    } else if (pocketed.length === 1) {
      const pool = ["Nice Shot!", "Clean Pocket!", "Ball Down!", "Well Played!"];
      const emojis = ["Ã°ÂÂÂ¯", "Ã¢ÂÂ¨", "Ã°ÂÂÂ«", "Ã°ÂÂÂ±"];
      const idx = (pocketed[0] + Math.floor(Date.now() / 1000)) % pool.length;
      showEvent(pool[idx], undefined, "good", emojis[idx]);
      setPocketFlash(true); setTimeout(() => setPocketFlash(false), 600);
    }
  }, [gameState.simulationRunning, gameState.lastShotPocketed, gameState.foul, gameState.gameOver,
      gameState.winner, player1Name, player2Name, showEvent, canvasScale, gameState.balls, gameState.pockets]);

  // WebSocket (multiplayer sync)
  useEffect(() => {
    if (match.isPractice) return;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      ws.onopen    = () => ws.send(JSON.stringify({ type: "join", matchId: match.id, userId: currentUserId }));
      ws.onmessage = ev => {
        const d = JSON.parse(ev.data);
        if (d.type === "8-ball-move" && d.matchId === match.id && !gsRef.current.simulationRunning) {
          setGameState(d.gameState);
        } else if (d.type === "error") {
          toast({ title: "Error", description: d.message, variant: "destructive" });
        }
      };
      ws.onerror  = () => console.warn("[8-ball] WS not available Ã¢ÂÂ running local physics");
      wsRef.current = ws;
    } catch { console.warn("[8-ball] WS create failed"); }
    return () => { try { if (ws?.readyState < 2) ws.close(); } catch {} }
  }, [match.id, match.isPractice, currentUserId, toast]);

  // Bot moves
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
      const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 6000));
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
            applyMove(d.move.angle, d.move.power); return;
          }
          if (d.move?.gameState && !cancelled) { setGameState(d.move.gameState); return; }
        }
        throw new Error("server bot-move unavailable");
      } catch {
        try {
          const local = generateLocalEightBallMove(gsRef.current, botP, diff);
          if (local) applyMove(local.angle, local.power);
        } catch (e2) { console.error("[8-ball] Local bot fallback failed", e2); }
      }
    }, thinkMs);
    return () => { cancelled = true; clearTimeout(t); };
  }, [match.isBotMatch, match.isPractice, match.status, match.id, match.botDifficulty,
      gameState.currentPlayer, gameState.gameOver, gameState.simulationRunning, isPlayer1]);

  const fireShot = useCallback(() => {
    const gs = gsRef.current;
    if (gs.simulationRunning || gs.gameOver || !isMyTurn()) return;

    const angle = aimRef.current;
    const power = Math.max(10, powerRef.current);
    const spinX = spinRef.current.x;
    const spinY = spinRef.current.y;

    draggingRef.current = false;
    powerRef.current    = 0;
    originRef.current   = null;
    setIsDragging(false);
    setDragPower(0);

    const next = executeShot(gs, angle, power, spinX, spinY);
    setGameState(next);

    spinRef.current = { x: 0, y: 0 };
    setSpin({ x: 0, y: 0 });

    if (!matchRef.current.isPractice && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "8-ball-move", matchId: matchRef.current.id, angle, power, spinX, spinY,
      }));
    }
  }, [isMyTurn]);

  // Keyboard
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

  const toTable = useCallback((cx: number, cy: number) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const rect = c.getBoundingClientRect();
    return { x: ((cx - rect.left) / rect.width) * TABLE_WIDTH, y: ((cy - rect.top) / rect.height) * TABLE_HEIGHT };
  }, []);

  const getCueBall = () => gsRef.current.balls.find(b => b.type === "cue" && !b.pocketed);

  const placeCueBall = useCallback((tx: number, ty: number) => {
    const maxX = TABLE_WIDTH / 4 - BALL_RADIUS;
    const desiredX = Math.min(maxX, tx);
    setGameState(prev => {
      const next = cloneState(prev);
      const cue  = next.balls.find(b => b.type === "cue");
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

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gsRef.current.simulationRunning || gsRef.current.gameOver) return;
    if (!isMyTurn()) return;

    const pt = toTable(e.clientX, e.clientY);

    if (ballInHandRef.current) {
      if (pt.x <= TABLE_WIDTH / 4) {
        placeCueBall(pt.x, pt.y);
      } else {
        toast({ title: "Ball in hand", description: "Place the cue ball in the highlighted left zone.", variant: "default" });
      }
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);

    const cb = getCueBall();
    if (!cb) return;

    const angle = Math.atan2(pt.y - cb.y, pt.x - cb.x);
    setAimAngle(angle);
    aimRef.current  = angle;
    originRef.current   = pt;
    draggingRef.current = true;
    powerRef.current    = 0;
    setIsDragging(true);
    setDragPower(0);
  }, [isMyTurn, toTable]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = toTable(e.clientX, e.clientY);
    const cb = getCueBall();
    if (!cb) return;

    if (draggingRef.current && originRef.current) {
      const ang  = aimRef.current;
      const dx   = pt.x - originRef.current.x;
      const dy   = pt.y - originRef.current.y;
      const pull = dx * (-Math.cos(ang)) + dy * (-Math.sin(ang));
      const pct  = Math.min(100, Math.max(0, (pull / 180) * 100));
      powerRef.current = pct;
      setDragPower(pct);
    } else if (!draggingRef.current && !gsRef.current.simulationRunning) {
      const angle = Math.atan2(pt.y - cb.y, pt.x - cb.x);
      setAimAngle(angle);
      aimRef.current = angle;
    }
  }, [toTable]);

  const onPointerUp = useCallback((_e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) return;
    fireShot();
  }, [fireShot]);

  // Ã¢ÂÂÃ¢ÂÂ Canvas draw Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  const drawGame = useCallback((gs: EightBallState, showAim: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas || CW < 100) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const S = canvasScale;

    // Static table
    const tc = tableRef.current;
    if (tc && tc.width === CW) ctx.drawImage(tc, 0, 0);
    else { ctx.fillStyle = "#0e7038"; ctx.fillRect(0, 0, CW, CH); }

    const cueBall  = gs.balls.find(b => b.type === "cue" && !b.pocketed);
    const inHand   = ballInHandRef.current;
    const canShoot = showAim && cueBall && !gs.simulationRunning && !gs.gameOver && isMyTurn() && !inHand;

    // Ball-in-hand zone
    if (inHand && !gs.simulationRunning && !gs.gameOver) {
      const zoneW = (TABLE_WIDTH / 4) * S;
      ctx.save();
      ctx.fillStyle   = "rgba(80,200,255,0.08)";
      ctx.fillRect(ENG_RAIL, ENG_RAIL, zoneW - ENG_RAIL, CH - ENG_RAIL * 2);
      ctx.strokeStyle = "rgba(120,210,255,0.65)";
      ctx.lineWidth   = 1.5; ctx.setLineDash([7, 6]);
      ctx.strokeRect(ENG_RAIL, ENG_RAIL, zoneW - ENG_RAIL, CH - ENG_RAIL * 2);
      ctx.setLineDash([]);
      ctx.fillStyle     = "rgba(190,235,255,0.9)";
      ctx.font          = `${Math.round(11 * S)}px sans-serif`;
      ctx.textAlign     = "center"; ctx.textBaseline = "middle";
      ctx.fillText("Tap to place cue ball", zoneW * 0.5 + ENG_RAIL * 0.5, CH * 0.5);
      ctx.restore();
    }

    // Ã¢ÂÂÃ¢ÂÂ Aim visuals Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
    if (canShoot && cueBall) {
      const bx  = cueBall.x * S;
      const by  = cueBall.y * S;
      const br  = BALL_RADIUS * S;
      const ang = aimRef.current;
      const cw  = Math.cos(ang);
      const sw  = Math.sin(ang);
      const power   = powerRef.current;
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

        // Ghost ball
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.8;
        ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.arc(gx, gy, br, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        // Target ball deflection line
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

        // Cue-ball post-contact path (spin-aware)
        const sp   = spinRef.current;
        const dotN = cw * ddx + sw * ddy;
        let rx = cw - dotN * ddx;
        let ry = sw - dotN * ddy;
        rx += ddx * sp.y * 1.1;
        ry += ddy * sp.y * 1.1;
        rx += -ddy * sp.x * 0.5;
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
        // No ball hit Ã¢ÂÂ show wall-bounce trajectory lines
        const segs = computeWallBounceTrajectory(cueBall.x, cueBall.y, cw, sw, 2, 480);
        segs.forEach((seg, i) => {
          const alpha = 0.65 - i * 0.22;
          if (alpha <= 0) return;
          const lx1 = seg.x1 * S, ly1 = seg.y1 * S;
          const lx2 = seg.x2 * S, ly2 = seg.y2 * S;
          const lg2 = ctx.createLinearGradient(lx1, ly1, lx2, ly2);
          lg2.addColorStop(0, `rgba(255,255,255,${alpha})`);
          lg2.addColorStop(1, `rgba(255,255,255,${Math.max(0, alpha - 0.3)})`);
          ctx.strokeStyle = lg2;
          ctx.lineWidth   = i === 0 ? 1.3 : 1.0;
          ctx.setLineDash(i === 0 ? [8 * S, 5 * S] : [5 * S, 6 * S]);
          ctx.beginPath(); ctx.moveTo(lx1, ly1); ctx.lineTo(lx2, ly2); ctx.stroke();
          ctx.setLineDash([]);
          // Bounce dot
          if (i < segs.length - 1) {
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            ctx.beginPath(); ctx.arc(lx2, ly2, 2.5 * S, 0, Math.PI * 2); ctx.fill();
          }
        });
      }

      ctx.restore();

      // Cue stick
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
      ctx.strokeStyle = "#eee8de"; ctx.lineWidth = 7.5 * S;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - cw * 8 * S, ty - sw * 8 * S); ctx.stroke();
      ctx.strokeStyle = "#1e38aa"; ctx.lineWidth = 7 * S;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - cw * 4 * S, ty - sw * 4 * S); ctx.stroke();
      ctx.restore();

      // Power ring
      if (dragging && power > 0) {
        const pct = power / 100;
        const rr  = (BALL_RADIUS + 6.5) * S;
        ctx.save();
        ctx.strokeStyle = powerColor(power);
        ctx.lineWidth   = 3.5 * S; ctx.lineCap = "round";
        ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(bx, by, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Ã¢ÂÂÃ¢ÂÂ Balls Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
    for (const b of gs.balls) {
      drawBall(ctx, b as any, S);
    }

    // Ã¢ÂÂÃ¢ÂÂ Particles Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
    if (particlesRef.current.length > 0) {
      particlesRef.current = updateAndDrawParticles(ctx, particlesRef.current);
    }

    // Ã¢ÂÂÃ¢ÂÂ Canvas overlay Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
    drawCanvasOverlay(ctx, gs, S);

  }, [CW, CH, canvasScale, isMyTurn]);

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
      ctx.fillStyle   = active ? "rgba(139,92,246,0.28)" : "rgba(8,16,12,0.55)";
      ctx.fill();
      ctx.lineWidth   = active ? 1.5 : 1.2;
      ctx.strokeStyle = active ? "rgba(167,139,250,0.9)" : "rgba(255,255,255,0.14)";
      if (active) { ctx.shadowColor = "rgba(167,139,250,0.6)"; ctx.shadowBlur = 8; }
      ctx.stroke();
      ctx.shadowBlur    = 0;
      ctx.textBaseline  = "middle";
      ctx.textAlign     = align;
      const tx = align === "left" ? x + 9 * S : x + chipW - 9 * S;
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = `600 ${Math.round(12 * S)}px sans-serif`;
      ctx.fillText(name.length > 14 ? name.slice(0, 13) + "Ã¢ÂÂ¦" : name, tx, pad + chipH * 0.34);
      ctx.fillStyle = "rgba(200,210,225,0.85)";
      ctx.font = `${Math.round(10.5 * S)}px sans-serif`;
      const sub = info.left === null ? info.label : `${info.label} ÃÂ· ${info.left} left`;
      ctx.fillText(sub, tx, pad + chipH * 0.72);
      ctx.restore();
    };

    drawChip(pad, player1Name, p1, gs.currentPlayer === "player1" && !gs.gameOver, "left");
    drawChip(CW - pad - chipW, player2Name, p2, gs.currentPlayer === "player2" && !gs.gameOver, "right");

    // Center turn banner
    let banner = "";
    if (gs.gameOver)            banner = `${gs.winner === "player1" ? player1Name : player2Name} wins`;
    else if (gs.simulationRunning) banner = "";
    else if (ballInHandRef.current) banner = "Ball in hand";
    else                        banner = `${gs.currentPlayer === "player1" ? player1Name : player2Name}'s turn`;

    if (banner) {
      ctx.save();
      ctx.font          = `600 ${Math.round(11.5 * S)}px sans-serif`;
      ctx.textAlign     = "center"; ctx.textBaseline = "middle";
      const tw = ctx.measureText(banner).width + 18 * S;
      const bx = CW / 2 - tw / 2;
      roundRectPath(ctx, bx, pad + 1, tw, chipH - 2, 6 * S);
      ctx.fillStyle   = "rgba(8,16,12,0.6)"; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle   = "rgba(255,255,255,0.92)";
      ctx.fillText(banner, CW / 2, pad + chipH / 2);
      ctx.restore();
    }
  }, [CW, player1Name, player2Name]);

  useEffect(() => { drawRef.current = drawGame; }, [drawGame]);

  useEffect(() => {
    if (gameState.simulationRunning) return;
    drawGame(gameState, true);
  }, [gameState, aimAngle, isDragging, dragPower, ballInHand, spin, drawGame]);

  const isP1Turn = gameState.currentPlayer === "player1";
  const myTurnNow = isMyTurn();

  // Event banner colors
  const evBg    = gameEvent?.type === "good" ? "from-emerald-950/95 to-green-900/90 border-emerald-400/50"
                : gameEvent?.type === "bad"  ? "from-red-950/95 to-rose-900/90 border-red-400/50"
                :                              "from-slate-900/95 to-slate-800/90 border-white/20";
  const evColor = gameEvent?.type === "good" ? "text-emerald-300"
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

      {/* HUD */}
      <div className="px-3 pt-2">
        <GameHUD
          match={match}
          currentUserId={currentUserId}
          activePlayer={gameState.gameOver ? null : (myTurnNow ? "left" : "right")}
          leftLabel={
            gameState.gameOver ? undefined
            : myTurnNow ? (gameState.player1Group ? `Your turn ÃÂ· ${isPlayer1 ? gameState.player1Group : gameState.player2Group}` : "Your turn")
            : "Waiting..."
          }
          rightLabel={
            gameState.gameOver ? undefined
            : !myTurnNow ? (gameState.player2Group ? `Shooting ÃÂ· ${isPlayer1 ? gameState.player2Group : gameState.player1Group}` : "Their turn")
            : "Waiting..."
          }
        />
      </div>

      {/* Event feed */}
      <div className="fixed bottom-24 right-4 z-40 pointer-events-none">
        <EventFeed />
      </div>

      {/* Top bar */}
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
            <Badge className="gap-1 bg-yellow-500/20 text-yellow-300 border-yellow-500/40 animate-pulse">
              <Trophy className="w-3 h-3" />
              {gameState.winner === "player1" ? player1Name : player2Name} Wins!
            </Badge>
          )}
        </div>
      </div>

      {/* Ã¢ÂÂÃ¢ÂÂ Player panels Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ */}
      <div className="grid grid-cols-2 gap-2 px-3 pt-3 pb-2 shrink-0">
        {[
          { name: player1Name, player: match.player1, group: gameState.player1Group, active: isP1Turn, label: "P1", side: "left" as const },
          { name: player2Name, player: match.player2, group: gameState.player2Group, active: !isP1Turn, label: "P2", side: "right" as const },
        ].map(({ name, player, group, active, label, side }, i) => (
          <div key={i}
            className={`relative flex flex-col gap-1.5 px-3 py-2.5 rounded-xl bg-card border transition-all duration-300 overflow-hidden ${
              active && !gameState.gameOver
                ? "border-primary/70 shadow-[0_0_20px_-4px_hsl(var(--primary)/0.55)]"
                : "border-border/50"
            }`}
          >
            {/* Active player glow bar */}
            {active && !gameState.gameOver && (
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary rounded-l-xl animate-pulse" />
            )}
            <div className="flex items-center gap-2">
              <div className="relative shrink-0">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={player?.profileImageUrl || undefined} style={{ objectFit: "cover" }} />
                  <AvatarFallback className="text-xs font-bold">{player?.firstName?.[0] || label}</AvatarFallback>
                </Avatar>
                {active && !gameState.gameOver && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-card animate-pulse" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate leading-tight">{name}</div>
                {group ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-2.5 h-2.5 rounded-full border border-white/20"
                         style={{ background: group === "solid" ? "#f0c000" : "linear-gradient(135deg,#f0c000 40%,#f2efe8 40%)" }} />
                    <span className="text-xs text-muted-foreground">
                      {group === "solid" ? "Solids" : "Stripes"} ÃÂ· {gameState.balls.filter(b => b.type === group && !b.pocketed).length} left
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Break shot</span>
                )}
              </div>
            </div>
            {/* Pocketed ball tray */}
            <PocketedTray balls={gameState.balls} group={group} side={side} />
          </div>
        ))}
      </div>

      {/* Ã¢ÂÂÃ¢ÂÂ Game area Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ */}
      <div ref={containerRef} className="flex-1 flex flex-col items-center justify-center px-2 py-2 gap-2">

        {/* Status line */}
        <div className="h-6 flex items-center justify-center">
          {gameState.simulationRunning ? (
            <span className="text-xs text-muted-foreground animate-pulse tracking-wide">SimulatingÃ¢ÂÂ¦</span>
          ) : gameState.gameOver ? (
            <span className="text-xs text-yellow-400 font-semibold">Game over</span>
          ) : myTurnNow ? (
            <span className="text-xs text-muted-foreground">
              {isDragging ? (
                <span className="text-primary font-medium">Power ÃÂ· {Math.round(dragPower)}%</span>
              ) : "Hover to aim ÃÂ· Drag back ÃÂ· Release to shoot"}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Waiting for {isP1Turn ? player1Name : player2Name}Ã¢ÂÂ¦
            </span>
          )}
        </div>

        {/* Pool hall wrapper */}
        <div
          className="relative rounded-xl overflow-hidden"
          style={{
            padding: "20px 20px 20px 20px",
            background: "radial-gradient(ellipse 120% 100% at 50% 50%, rgba(5,10,20,0.98) 0%, rgba(2,5,10,0.99) 100%)",
            boxShadow: "0 0 60px 10px rgba(0,80,160,0.2), 0 0 120px 30px rgba(0,0,0,0.9)",
          }}
        >
          {/* Overhead light */}
          <div className="absolute pointer-events-none"
            style={{ left: "5%", right: "5%", top: 0, height: "24px",
              background: "linear-gradient(to bottom, rgba(200,220,255,0.15) 0%, transparent 100%)",
              filter: "blur(6px)" }} />

          {/* Table */}
          <div className="relative" style={{ width: CW, height: CH }}>
            <canvas
              ref={canvasRef}
              width={CW}
              height={CH}
              className={`block select-none rounded-sm transition-shadow duration-300 ${
                pocketFlash ? "shadow-[0_0_48px_14px_rgba(70,255,120,0.45)]" : ""
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

            {/* Spin control */}
            {myTurnNow && !gameState.simulationRunning && !gameState.gameOver && !ballInHand && (
              <div
                className="absolute bottom-3 right-3 z-20 rounded-xl p-2 backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-200"
                style={{ background: "rgba(8,16,12,0.55)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 8px 24px rgba(0,0,0,0.55)" }}
              >
                <SpinControl value={spin} onChange={setSpin} />
              </div>
            )}

            {/* Event overlay banner */}
            {gameEvent && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className={`px-5 py-3 rounded-2xl border backdrop-blur-md bg-gradient-to-b ${evBg} animate-in fade-in-0 zoom-in-90 duration-300 shadow-2xl`}>
                  <div className="flex items-center gap-2 justify-center">
                    {gameEvent.emoji && <span className="text-2xl">{gameEvent.emoji}</span>}
                    <p className={`text-xl font-black text-center tracking-wide ${evColor}`}>{gameEvent.text}</p>
                  </div>
                  {gameEvent.sub && (
                    <p className="text-xs text-center text-muted-foreground mt-1">{gameEvent.sub}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Vertical power bar Ã¢ÂÂ left side like reference */}
          {myTurnNow && !gameState.simulationRunning && !gameState.gameOver && (
            <div className="absolute left-0 top-0 bottom-0 flex flex-col items-center justify-end py-4 pl-1" style={{ width: "18px" }}>
              <div className="relative flex-1 w-3 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.5)", maxHeight: "80%" }}>
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-75"
                  style={{
                    height: `${dragPower}%`,
                    background: `linear-gradient(to top, ${powerColor(dragPower)}, ${powerColor(50)}, ${powerColor(0)})`,
                    boxShadow: dragPower > 0 ? `0 0 6px 2px ${powerColor(dragPower)}88` : "none",
                  }}
                />
              </div>
              {dragPower > 0 && (
                <span className="text-[8px] font-bold mt-1 tabular-nums" style={{ color: powerColor(dragPower) }}>
                  {Math.round(dragPower)}
                </span>
              )}
            </div>
          )}

          {/* Game over actions */}
          {gameState.gameOver && (
            <div className="flex gap-2 justify-center mt-3">
              <Button
                size="sm"
                className="bg-primary/90 hover:bg-primary shadow-lg shadow-primary/25 font-bold px-6"
                onClick={() => setGameState(createInitialState())}
              >
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
