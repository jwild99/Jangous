import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import type { MatchWithPlayers } from "@shared/schema";
import { GameLayout } from "@/components/games/GameLayout";
import {
  type BasketballState,
  type Shot,
  createBasketballState,
  shootBall,
  simulateBasketball,
  BASKETBALL_CONSTANTS as C,
} from "@shared/basketballEngine";

interface Props {
  match: MatchWithPlayers;
  currentUserId?: string;
}

const SCALE = 1.6;
const W = C.COURT_W * SCALE;
const H = C.COURT_H * SCALE;

function s(v: number) { return v * SCALE; }

export default function BasketballGame({ match, currentUserId }: Props) {
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const animRef = useRef<number>();

  const [state, setState] = useState<BasketballState>(() => {
    if (match.gameState && (match.gameState as any).currentPlayer) {
      return match.gameState as BasketballState;
    }
    return createBasketballState();
  });

  const [aimAngle, setAimAngle] = useState(-Math.PI / 4); // default: 45° up-right
  const [power, setPower] = useState(60);
  const [isDragging, setIsDragging] = useState(false);
  const [resultTimer, setResultTimer] = useState(0);
  const [ballTrail, setBallTrail] = useState<{x:number;y:number}[]>([]);

  const isPlayer1 = match.player1Id === currentUserId;
  const isMyTurn = match.isPractice ||
    (state.currentPlayer === "player1" && isPlayer1) ||
    (state.currentPlayer === "player2" && !isPlayer1);

  // WebSocket
  useEffect(() => {
    if (match.isPractice) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    ws.onopen = () => ws.send(JSON.stringify({ type: "join", matchId: match.id, userId: currentUserId }));
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.type === "basketball-state" && d.matchId === match.id) setState(d.gameState);
    };
    wsRef.current = ws;
    return () => { ws.close(); };
  }, [match.id, match.isPractice, currentUserId]);

  // Bot trigger — fires when it is the bot's turn (player2, aiming phase)
  useEffect(() => {
    if (!match.isBotMatch || match.isPractice || match.status !== "in-progress") return;
    if (state.currentPlayer !== "player2" || state.phase !== "aiming") return;
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/matches/${match.id}/bot-move`, { method: "POST", credentials: "include" });
        if (r.ok) {
          const data = await r.json();
          if (data.gameState) setState(data.gameState);
        }
      } catch (err) { console.error("[Basketball bot]", err); }
    }, 900);
    return () => clearTimeout(timer);
  }, [match.isBotMatch, match.isPractice, match.status, match.id, state.currentPlayer, state.phase]);

  // Physics simulation loop during flight
  useEffect(() => {
    if (state.phase !== "flight") return;
    const tick = () => {
      setState(prev => {
        if (prev.phase !== "flight") return prev;
        const next = simulateBasketball(prev);
        setBallTrail(t => [...t.slice(-18), { x: prev.ball.x, y: prev.ball.y }]);
        return next;
      });
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [state.phase]);

  // Auto-advance from result state after a short delay
  useEffect(() => {
    if (state.phase !== "result") { setResultTimer(0); return; }
    const t = setTimeout(() => {
      setState(prev => {
        if (prev.phase !== "result") return prev;
        return { ...prev, phase: "aiming", resultMessage: undefined };
      });
      setBallTrail([]);
    }, 1800);
    return () => clearTimeout(t);
  }, [state.phase]);

  const handleShoot = useCallback(async () => {
    if (!isMyTurn || state.phase !== "aiming" || state.phase as string === "over") return;
    setBallTrail([]);

    if (match.isPractice) {
      setState(prev => shootBall(prev, aimAngle, power));
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "basketball-shoot", matchId: match.id, angle: aimAngle, power }));
    } else {
      // fallback local
      setState(prev => shootBall(prev, aimAngle, power));
    }
  }, [isMyTurn, state.phase, match.isPractice, match.id, aimAngle, power]);

  // Keyboard shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); handleShoot(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleShoot]);

  // Aim from mouse/touch on canvas
  const getAngleFromEvent = (cx: number, cy: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return aimAngle;
    const rect = canvas.getBoundingClientRect();
    const sx = (cx - rect.left) * (W / rect.width);
    const sy = (cy - rect.top) * (H / rect.height);
    const bx = s(C.SHOOTER_X);
    const by = s(C.SHOOTER_Y);
    return Math.atan2(sy - by, sx - bx);
  };

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── Court background ────────────────────────────────────────────
    const courtGrad = ctx.createLinearGradient(0, 0, 0, H);
    courtGrad.addColorStop(0, "#1a0a00");
    courtGrad.addColorStop(1, "#0a0500");
    ctx.fillStyle = courtGrad;
    ctx.fillRect(0, 0, W, H);

    // Court floor (hardwood)
    const floorGrad = ctx.createLinearGradient(0, H * 0.55, 0, H);
    floorGrad.addColorStop(0, "#7a4a18");
    floorGrad.addColorStop(0.5, "#8b5a22");
    floorGrad.addColorStop(1, "#6b3a12");
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, s(C.COURT_H * 0.5), W, H - s(C.COURT_H * 0.5));

    // Hardwood lines
    ctx.save();
    ctx.strokeStyle = "rgba(180,120,40,0.3)";
    ctx.lineWidth = 1;
    for (let bx = 0; bx < W; bx += s(12)) {
      ctx.beginPath(); ctx.moveTo(bx, s(C.COURT_H * 0.5)); ctx.lineTo(bx, H); ctx.stroke();
    }
    ctx.restore();

    // Background wall
    const wallGrad = ctx.createLinearGradient(0, 0, 0, H * 0.6);
    wallGrad.addColorStop(0, "#1c1225");
    wallGrad.addColorStop(1, "#0d0818");
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, W, H * 0.6);

    // Ambient crowd glow
    const crowdGlow = ctx.createRadialGradient(W/2, 0, 0, W/2, 0, W * 0.7);
    crowdGlow.addColorStop(0, "rgba(100,50,200,0.15)");
    crowdGlow.addColorStop(1, "transparent");
    ctx.fillStyle = crowdGlow;
    ctx.fillRect(0, 0, W, H * 0.5);

    // ── Three-point arc ───────────────────────────────────────────────
    ctx.save();
    ctx.strokeStyle = "rgba(255,180,50,0.35)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(s(C.HOOP_X), s(C.HOOP_Y + 80), s(100), -Math.PI * 0.85, Math.PI * 0.85);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // ── Backboard ─────────────────────────────────────────────────────
    const bbX = s(C.HOOP_X + 20);
    const bbY = s(C.HOOP_Y - 22);
    // Backboard post
    ctx.fillStyle = "#555";
    ctx.fillRect(bbX - 2, bbY, 4, s(60));
    // Backboard glass
    const bbGrad = ctx.createLinearGradient(bbX - 18, 0, bbX + 18, 0);
    bbGrad.addColorStop(0, "rgba(160,220,255,0.6)");
    bbGrad.addColorStop(0.5, "rgba(200,240,255,0.9)");
    bbGrad.addColorStop(1, "rgba(160,220,255,0.6)");
    ctx.fillStyle = bbGrad;
    ctx.fillRect(bbX - 18, bbY, 36, s(28));
    ctx.strokeStyle = "#ff4400";
    ctx.lineWidth = 2;
    ctx.strokeRect(bbX - 8, bbY + s(8), 16, s(10));
    // Backboard glare
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(bbX - 16, bbY + 2, 12, s(8));

    // ── Hoop ──────────────────────────────────────────────────────────
    const hx = s(C.HOOP_X);
    const hy = s(C.HOOP_Y);
    const hr = s(C.HOOP_R);
    // Hoop shadow
    ctx.save();
    ctx.globalAlpha = 0.4;
    const hoopShadow = ctx.createRadialGradient(hx + 4, hy + 4, 0, hx + 4, hy + 4, hr * 1.5);
    hoopShadow.addColorStop(0, "rgba(0,0,0,0.6)");
    hoopShadow.addColorStop(1, "transparent");
    ctx.fillStyle = hoopShadow;
    ctx.beginPath(); ctx.ellipse(hx + 4, hy + 4, hr * 1.4, hr * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Hoop ring
    const hoopGrad = ctx.createLinearGradient(hx - hr, hy, hx + hr, hy);
    hoopGrad.addColorStop(0, "#cc3300");
    hoopGrad.addColorStop(0.4, "#ff6600");
    hoopGrad.addColorStop(0.7, "#cc3300");
    ctx.strokeStyle = hoopGrad;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(hx, hy, hr, hr * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Net lines
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(hx + Math.cos(ang) * hr, hy + Math.sin(ang) * hr * 0.42);
      ctx.lineTo(hx + Math.cos(ang) * hr * 0.4, hy + s(20));
      ctx.stroke();
    }
    // Net bottom ring
    ctx.beginPath();
    ctx.ellipse(hx, hy + s(20), hr * 0.4, hr * 0.2, 0, 0, Math.PI * 2);
    ctx.stroke();

    // ── Ball trail ────────────────────────────────────────────────────
    ballTrail.forEach((p, i) => {
      const alpha = (i / ballTrail.length) * 0.4;
      const r = s(C.BALL_R) * 0.5 * (i / ballTrail.length);
      ctx.beginPath();
      ctx.arc(s(p.x), s(p.y), r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,140,30,${alpha})`;
      ctx.fill();
    });

    // ── Ball ──────────────────────────────────────────────────────────
    const bx = s(state.ball.x);
    const by = s(state.ball.y);
    const br = s(C.BALL_R);
    // Ball shadow on floor
    if (state.ball.y > C.COURT_H * 0.5) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.beginPath();
      ctx.ellipse(bx, s(C.COURT_H * 0.85), br * 1.1, br * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Ball body
    const ballGrad = ctx.createRadialGradient(bx - br*0.3, by - br*0.35, br*0.05, bx, by, br);
    ballGrad.addColorStop(0, "#ff9a44");
    ballGrad.addColorStop(0.4, "#e85a00");
    ballGrad.addColorStop(1, "#992200");
    ctx.fillStyle = ballGrad;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
    // Ball seams
    ctx.strokeStyle = "rgba(80,0,0,0.7)";
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(bx, by, br, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    ctx.beginPath(); ctx.arc(bx, by, br, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx, by - br); ctx.quadraticCurveTo(bx + br * 0.6, by, bx, by + br); ctx.stroke();
    // Gloss
    const ballGloss = ctx.createRadialGradient(bx - br*0.3, by - br*0.35, 0, bx - br*0.2, by - br*0.25, br*0.5);
    ballGloss.addColorStop(0, "rgba(255,255,255,0.55)");
    ballGloss.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = ballGloss;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();

    // ── Aim guide ─────────────────────────────────────────────────────
    if (isMyTurn && state.phase === "aiming") {
      const sbx = s(C.SHOOTER_X);
      const sby = s(C.SHOOTER_Y);
      const aimLen = power * 3.5;
      const endX = sbx + Math.cos(aimAngle) * aimLen;
      const endY = sby + Math.sin(aimAngle) * aimLen;
      const aimGrad = ctx.createLinearGradient(sbx, sby, endX, endY);
      aimGrad.addColorStop(0, "rgba(255,200,50,0.9)");
      aimGrad.addColorStop(1, "rgba(255,200,50,0)");
      ctx.save();
      ctx.strokeStyle = aimGrad;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 5]);
      ctx.shadowColor = "rgba(255,200,50,0.6)";
      ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.moveTo(sbx, sby); ctx.lineTo(endX, endY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Arc preview dots
      const spd = power * 0.22;
      const vx = Math.cos(aimAngle) * spd;
      const vy = Math.sin(aimAngle) * spd;
      let px2 = C.SHOOTER_X, py2 = C.SHOOTER_Y, pvx = vx, pvy = vy;
      for (let i = 0; i < 20; i++) {
        pvy += 0.5; px2 += pvx; py2 += pvy;
        if (py2 > C.COURT_H + 10 || px2 > C.COURT_W + 20) break;
        const alpha = (1 - i / 20) * 0.5;
        ctx.beginPath();
        ctx.arc(s(px2), s(py2), s(C.BALL_R) * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,200,50,${alpha})`;
        ctx.fill();
      }
    }

    // ── Shooter player silhouette ─────────────────────────────────────
    const spx = s(C.SHOOTER_X);
    const spy = s(C.SHOOTER_Y);
    ctx.fillStyle = isMyTurn ? "#ff6600" : "#666";
    ctx.beginPath();
    // Body
    ctx.arc(spx, spy - s(18), s(8), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(spx - s(5), spy - s(10), s(10), s(18));
    // Legs
    ctx.fillRect(spx - s(4), spy + s(8), s(4), s(12));
    ctx.fillRect(spx, spy + s(8), s(4), s(12));

    // ── Result overlay ────────────────────────────────────────────────
    if (state.phase === "result" && state.resultMessage) {
      const isScore = state.resultMessage.includes("Points");
      ctx.save();
      ctx.globalAlpha = 0.88;
      ctx.fillStyle = isScore ? "rgba(20,180,80,0.95)" : "rgba(180,30,30,0.88)";
      const tw = ctx.measureText(state.resultMessage).width + 40;
      ctx.beginPath();
      ctx.roundRect(W/2 - tw/2, H/2 - 30, tw, 56, 12);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${s(16)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(state.resultMessage, W/2, H/2);
    }

    // ── Game Over overlay ─────────────────────────────────────────────
    if (state.phase === "over") {
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ffe080";
      ctx.font = `bold ${s(20)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const winMsg = state.winner === "draw" ? "Draw!" :
        state.winner === "player1" ? (match.player1?.firstName || "Player 1") + " Wins!" :
        (match.player2?.firstName || "Player 2") + " Wins!";
      ctx.fillText(winMsg, W/2, H/2);
    }

  }, [state, aimAngle, power, isMyTurn, ballTrail, match]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMyTurn || state.phase !== "aiming") return;
    setAimAngle(getAngleFromEvent(e.clientX, e.clientY));
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isMyTurn || state.phase !== "aiming") return;
    e.preventDefault();
    const t = e.touches[0];
    setAimAngle(getAngleFromEvent(t.clientX, t.clientY));
  };

  const p1Name = match.player1?.firstName || "Player 1";
  const p2Name = match.player2?.firstName || "Player 2";

  return (
    <GameLayout match={match} currentUserId={currentUserId} accentColor="#f97316" accentRgb="249,115,22" controls="Aim & set power" winCondition="Most baskets wins" showPills={false}>
      <div className="border-b" style={{ background: "rgba(0,0,0,0.35)", borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between px-4 py-3 max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="button-back-basketball">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="text-xl font-bold text-white/90">Basketball</h2>
              <Badge variant={state.currentPlayer === "player1" ? "default" : "secondary"} className="text-xs">
                {state.currentPlayer === "player1" ? p1Name : p2Name}'s turn
              </Badge>
            </div>
          </div>
          {/* Scores */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-xs text-white/40">{p1Name}</div>
              <div className="text-2xl font-black tabular-nums text-white/90" style={{ textShadow: "0 0 16px rgba(249,115,22,0.5)" }} data-testid="score-player1">{state.player1Score}</div>
              <div className="text-xs text-white/40">{state.player1ShotsLeft} shots left</div>
            </div>
            <div className="font-black text-white/30">VS</div>
            <div className="text-center">
              <div className="text-xs text-white/40">{p2Name}</div>
              <div className="text-2xl font-black tabular-nums text-white/90" style={{ textShadow: "0 0 16px rgba(59,130,246,0.5)" }} data-testid="score-player2">{state.player2Score}</div>
              <div className="text-xs text-white/40">{state.player2ShotsLeft} shots left</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Player info row */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[match.player1, match.player2].map((p, i) => {
            const isP1 = i === 0;
            const isActive = state.currentPlayer === (isP1 ? "player1" : "player2");
            const color = isP1 ? { r: 249, g: 115, b: 22 } : { r: 59, g: 130, b: 246 };
            return (
              <div
                key={i}
                className="p-3 rounded-xl border transition-all duration-300"
                style={{
                  background: `rgba(${color.r},${color.g},${color.b},0.08)`,
                  borderColor: isActive ? `rgba(${color.r},${color.g},${color.b},0.5)` : "rgba(255,255,255,0.08)",
                  boxShadow: isActive ? `0 0 18px rgba(${color.r},${color.g},${color.b},0.2)` : "none",
                }}
              >
                <div className="flex items-center gap-2">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={p?.profileImageUrl || undefined} />
                    <AvatarFallback style={{ background: `rgba(${color.r},${color.g},${color.b},0.25)` }}>{p?.firstName?.[0] || (isP1 ? "P1" : "P2")}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-white/90">{p?.firstName || (isP1 ? "Player 1" : "Player 2")}</div>
                    <div className="text-xs text-white/40">{isP1 ? state.player1ShotsLeft : state.player2ShotsLeft} shots remaining</div>
                  </div>
                  {isActive && <Badge variant="outline" className="text-xs">Active</Badge>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Court canvas */}
        <div
          className="mb-4 rounded-2xl border overflow-hidden"
          style={{ background: "rgba(0,0,0,0.3)", borderColor: "rgba(255,255,255,0.08)" }}
          data-testid="game-basketball"
        >
          <div className="p-3">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              className="rounded-xl mx-auto block cursor-crosshair"
              style={{ maxWidth: "100%", height: "auto", touchAction: "none" }}
              onMouseMove={handleMouseMove}
              onTouchMove={handleTouchMove}
              onTouchStart={(e) => { e.preventDefault(); const t = e.touches[0]; setAimAngle(getAngleFromEvent(t.clientX, t.clientY)); }}
              data-testid="canvas-basketball-court"
            />
          </div>
        </div>

        {/* Controls */}
        {isMyTurn && state.phase === "aiming" && (
          <div
            className="rounded-xl border p-4"
            style={{ background: "rgba(249,115,22,0.06)", borderColor: "rgba(249,115,22,0.25)" }}
          >
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white/80">Shot Power</span>
                  <span className="text-sm text-white/50">{power}%</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={100}
                  value={power}
                  onChange={e => setPower(Number(e.target.value))}
                  className="w-full accent-orange-500"
                  data-testid="slider-basketball-power"
                />
              </div>
              <Button
                onClick={handleShoot}
                style={{ background: "rgba(249,115,22,0.9)" }}
                className="text-white px-8"
                data-testid="button-basketball-shoot"
              >
                Shoot!
              </Button>
            </div>
            <div className="mt-2 text-xs text-white/40">
              Move mouse / drag on court to aim • Slider controls power • Shoot button or Space to shoot
            </div>
          </div>
        )}

        {!isMyTurn && state.phase === "aiming" && !state.winner && (
          <div
            className="rounded-xl border p-4 text-center text-white/40"
            style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
          >
            Waiting for {state.currentPlayer === "player1" ? p1Name : p2Name} to shoot...
          </div>
        )}

        {state.phase === "over" && (
          <div
            className="mt-4 rounded-2xl border p-6 text-center"
            style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.10)" }}
          >
            <div className="text-2xl font-bold mb-2 text-white/90">
              {state.winner === "draw" ? "Draw!" :
                state.winner === "player1" ? `${p1Name} Wins!` : `${p2Name} Wins!`}
            </div>
            <div className="text-white/50">
              Final Score — {p1Name}: {state.player1Score} · {p2Name}: {state.player2Score}
            </div>
          </div>
        )}
      </div>
    </GameLayout>
  );
}
