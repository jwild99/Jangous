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
  type FootballState,
  type Player,
  createFootballState,
  snapBall,
  throwToReceiver,
  simulateFootball,
  startNewPlay,
  startNextDrive,
  FOOTBALL_CONSTANTS as C,
} from "@shared/footballEngine";

interface Props {
  match: MatchWithPlayers;
  currentUserId?: string;
}

const SCALE = 1.4;
const W = C.FIELD_W * SCALE;
const H = C.FIELD_H * SCALE;
function s(v: number) { return v * SCALE; }

export default function FootballGame({ match, currentUserId }: Props) {
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const animRef = useRef<number>();

  const [state, setState] = useState<FootballState>(() => {
    if (match.gameState && (match.gameState as any).phase) {
      return match.gameState as FootballState;
    }
    return createFootballState();
  });

  const isPlayer1 = match.player1Id === currentUserId;
  const isMyTurn = match.isPractice ||
    (state.currentPlayer === "player1" && isPlayer1) ||
    (state.currentPlayer === "player2" && !isPlayer1);

  // Bot trigger — fires when it is the bot's drive (player2 possession, play-setup phase)
  useEffect(() => {
    if (!match.isBotMatch || match.isPractice || match.status !== "in-progress") return;
    if (state.currentPlayer !== "player2") return;
    if (!["play-setup", "snap"].includes(state.phase)) return;
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/matches/${match.id}/bot-move`, { method: "POST", credentials: "include" });
        if (r.ok) {
          const data = await r.json();
          if (data.gameState) setState(data.gameState);
        }
      } catch (err) { console.error("[Football bot]", err); }
    }, 1200);
    return () => clearTimeout(timer);
  }, [match.isBotMatch, match.isPractice, match.status, match.id, state.currentPlayer, state.phase]);

  // WebSocket
  const sendFootballState = (gameState: FootballState) => {
    if (match.isPractice) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "football-state", matchId: match.id, gameState }));
    }
  };

  useEffect(() => {
    if (match.isPractice) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    ws.onopen = () => ws.send(JSON.stringify({ type: "join", matchId: match.id, userId: currentUserId }));
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.type === "football-state" && d.matchId === match.id) setState(d.gameState);
    };
    wsRef.current = ws;
    return () => { ws.close(); };
  }, [match.id, match.isPractice, currentUserId]);

  // Physics simulation
  useEffect(() => {
    if (state.phase !== "flight" && state.phase !== "snap") return;
    const tick = () => {
      setState(prev => simulateFootball(prev));
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [state.phase]);

  // Auto-advance result
  useEffect(() => {
    if (state.phase !== "result") return;
    if (isMyTurn) sendFootballState(state);
    const t = setTimeout(() => {
      setState(prev => {
        if (prev.phase !== "result") return prev;
        const next = startNewPlay(prev);
        if (isMyTurn) sendFootballState(next);
        return next;
      });
    }, 2500);
    return () => clearTimeout(t);
  }, [state.phase]);

  // Auto-advance TD
  useEffect(() => {
    if (state.phase !== "td") return;
    if (isMyTurn) sendFootballState(state);
    const t = setTimeout(() => {
      setState(prev => {
        if (prev.phase !== "td") return prev;
        const next = startNextDrive(prev);
        sendFootballState(next);
        return next;
      });
    }, 2500);
    return () => clearTimeout(t);
  }, [state.phase]);

  const handleSnap = useCallback(() => {
    if (!isMyTurn || state.phase !== "play-setup") return;
    setState(prev => {
      const next = snapBall(prev);
      sendFootballState(next);
      return next;
    });
  }, [isMyTurn, state.phase]);

  const handleThrow = useCallback((receiverId: number) => {
    if (!isMyTurn || state.phase !== "snap") return;
    setState(prev => {
      const next = throwToReceiver(prev, receiverId);
      sendFootballState(next);
      return next;
    });
  }, [isMyTurn, state.phase]);

  const getCanvasReceiver = useCallback((cx: number, cy: number): number | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const sx = (cx - rect.left) * (W / rect.width);
    const sy = (cy - rect.top) * (H / rect.height);
    let nearest: Player | null = null;
    let nearDist = Infinity;
    state.receivers.forEach(r => {
      const dx = s(r.x) - sx, dy = s(r.y) - sy;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < s(25) && d < nearDist) { nearest = r; nearDist = d; }
    });
    return nearest ? (nearest as Player).id : null;
  }, [state.receivers]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rid = getCanvasReceiver(e.clientX, e.clientY);
    if (rid !== null) handleThrow(rid);
    else if (state.phase === "play-setup") handleSnap();
  };

  const handleCanvasTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const t = e.touches[0];
    const rid = getCanvasReceiver(t.clientX, t.clientY);
    if (rid !== null) handleThrow(rid);
    else if (state.phase === "play-setup") handleSnap();
  };

  // Drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Sky/background
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    skyGrad.addColorStop(0, "#0a1a2e");
    skyGrad.addColorStop(1, "#1a3050");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // ── Field ──────────────────────────────────────────────────────────
    const fieldGrad = ctx.createLinearGradient(0, H * 0.35, 0, H);
    fieldGrad.addColorStop(0, "#1a5c2a");
    fieldGrad.addColorStop(0.5, "#165224");
    fieldGrad.addColorStop(1, "#0d3a18");
    ctx.fillStyle = fieldGrad;
    ctx.fillRect(0, s(90), W, H - s(90));

    // Yard lines
    for (let yd = 0; yd <= 100; yd += 10) {
      const x = s(C.ENDZONE_W) + (yd / 100) * s(C.FIELD_W - C.ENDZONE_W * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, s(90)); ctx.lineTo(x, H); ctx.stroke();
      // Yard number
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = `${s(8)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`${yd}`, x, H - s(8));
    }

    // Hash marks
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 0.8;
    for (let yd = 0; yd <= 100; yd += 5) {
      const x = s(C.ENDZONE_W) + (yd / 100) * s(C.FIELD_W - C.ENDZONE_W * 2);
      ctx.beginPath(); ctx.moveTo(x, s(130)); ctx.lineTo(x, s(150)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, s(200)); ctx.lineTo(x, s(220)); ctx.stroke();
    }

    // Endzones
    const ez1 = ctx.createLinearGradient(0, 0, s(C.ENDZONE_W), 0);
    ez1.addColorStop(0, "#4a1010"); ez1.addColorStop(1, "#1a5c2a");
    ctx.fillStyle = ez1;
    ctx.fillRect(0, s(90), s(C.ENDZONE_W), H - s(90));
    const ez2 = ctx.createLinearGradient(W - s(C.ENDZONE_W), 0, W, 0);
    ez2.addColorStop(0, "#1a5c2a"); ez2.addColorStop(1, "#103a80");
    ctx.fillStyle = ez2;
    ctx.fillRect(W - s(C.ENDZONE_W), s(90), s(C.ENDZONE_W), H - s(90));

    // Endzone text
    ctx.save();
    ctx.fillStyle = "rgba(255,80,80,0.6)";
    ctx.font = `bold ${s(14)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.translate(s(C.ENDZONE_W / 2), H / 2 + s(20));
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("HOME", 0, 0);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = "rgba(80,120,255,0.6)";
    ctx.font = `bold ${s(14)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.translate(W - s(C.ENDZONE_W / 2), H / 2 + s(20));
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("AWAY", 0, 0);
    ctx.restore();

    // ── Line of scrimmage ──────────────────────────────────────────────
    const losX = s(state.lineOfScrimmage);
    ctx.strokeStyle = "rgba(255,255,0,0.5)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath(); ctx.moveTo(losX, s(90)); ctx.lineTo(losX, H); ctx.stroke();
    ctx.setLineDash([]);

    // First down line
    const fdX = s(Math.min(state.firstDownLine, C.FIELD_W - C.ENDZONE_W));
    ctx.strokeStyle = "rgba(255,120,0,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(fdX, s(90)); ctx.lineTo(fdX, H); ctx.stroke();

    // ── QB ────────────────────────────────────────────────────────────
    const qbX = s(state.qb.x), qbY = s(state.qb.y);
    drawPlayer(ctx, qbX, qbY, "#ff9900", "QB", isMyTurn);

    // ── Receivers ─────────────────────────────────────────────────────
    state.receivers.forEach(r => {
      const canThrow = state.phase === "snap" && isMyTurn;
      drawPlayer(ctx, s(r.x), s(r.y), canThrow ? "#44ff88" : "#228844", `R${r.id}`);
      // Hover ring for clickable receivers
      if (canThrow) {
        ctx.save();
        ctx.strokeStyle = "rgba(80,255,120,0.5)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(s(r.x), s(r.y), s(22), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    });

    // ── Defenders ─────────────────────────────────────────────────────
    state.defenders.forEach(d => {
      drawPlayer(ctx, s(d.x), s(d.y), "#cc2222", "D");
    });

    // ── Ball ──────────────────────────────────────────────────────────
    const { ball } = state;
    const bShadowH = Math.max(0, ball.altitude);
    if (ball.inFlight) {
      // Shadow on ground (shows where ball will land)
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(s(ball.x), s(ball.y) + bShadowH * 0.6, s(8), s(4), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Ball at altitude
    const ballDrawY = s(ball.y) - ball.altitude * SCALE * 0.3;
    ctx.save();
    ctx.fillStyle = "#c8601a";
    ctx.strokeStyle = "#7a3008";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(s(ball.x), ballDrawY, s(C.BALL_R), s(C.BALL_R * 0.55), Math.atan2(ball.vy, ball.vx), 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Lace
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s(ball.x) - s(3), ballDrawY);
    ctx.lineTo(s(ball.x) + s(3), ballDrawY);
    ctx.stroke();
    ctx.restore();

    // ── HUD ───────────────────────────────────────────────────────────
    // Down & distance banner
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.beginPath(); ctx.roundRect(s(150), s(4), s(200), s(28), s(4)); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${s(10)}px sans-serif`;
    ctx.textAlign = "center";
    const downStr = ["", "1st", "2nd", "3rd", "4th"][Math.min(state.down, 4)];
    ctx.fillText(`${downStr} & ${state.yardsToGo} yds`, s(250), s(21));

    // ── Result overlay ────────────────────────────────────────────────
    if (state.resultMessage) {
      const isTD = state.resultMessage.includes("TOUCHDOWN");
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = isTD ? "rgba(255,170,0,0.95)" : "rgba(20,20,50,0.9)";
      ctx.beginPath(); ctx.roundRect(W/2 - s(100), H/2 - s(25), s(200), s(50), s(8)); ctx.fill();
      ctx.restore();
      ctx.fillStyle = isTD ? "#111" : "#fff";
      ctx.font = `bold ${s(14)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(state.resultMessage, W/2, H/2 + s(5));
    }

    // ── Game over overlay ─────────────────────────────────────────────
    if (state.phase === "over") {
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ffe080";
      ctx.font = `bold ${s(18)}px sans-serif`;
      ctx.textAlign = "center";
      const winMsg = state.winner === "draw" ? "Draw!" :
        state.winner === "player1" ? (match.player1?.firstName || "Player 1") + " Wins!" :
        (match.player2?.firstName || "Player 2") + " Wins!";
      ctx.fillText(winMsg, W/2, H/2);
      ctx.font = `${s(10)}px sans-serif`;
      ctx.fillStyle = "#ccc";
      ctx.fillText(`${match.player1?.firstName || "P1"}: ${state.player1Score} — ${match.player2?.firstName || "P2"}: ${state.player2Score}`, W/2, H/2 + s(22));
    }

    // Instructions overlay
    if (state.phase === "play-setup" && isMyTurn) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath(); ctx.roundRect(s(10), s(6), s(180), s(22), s(4)); ctx.fill();
      ctx.fillStyle = "#88ffaa";
      ctx.font = `${s(8)}px sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText("Tap/click field to SNAP the ball", s(16), s(20));
    } else if (state.phase === "snap" && isMyTurn) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath(); ctx.roundRect(s(10), s(6), s(200), s(22), s(4)); ctx.fill();
      ctx.fillStyle = "#88ffaa";
      ctx.font = `${s(8)}px sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText("Tap a GREEN receiver to throw!", s(16), s(20));
    }

  }, [state, isMyTurn, match]);

  function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, label: string, glow = false) {
    const pr = s(C.PLAYER_R);
    if (glow) {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
    }
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, pr, 0, Math.PI * 2); ctx.fill();
    if (glow) ctx.restore();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, pr, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${s(6)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y);
    ctx.textBaseline = "alphabetic";
  }

  const p1Name = match.player1?.firstName || "Player 1";
  const p2Name = match.player2?.firstName || "Player 2";

  return (
    <GameLayout match={match} currentUserId={currentUserId} accentColor="#22c55e" accentRgb="34,197,94" controls="Choose direction & kick" winCondition="Most goals wins" showPills={false}>
      <div className="border-b" style={{ background: "rgba(0,0,0,0.35)", borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between px-4 py-3 max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="button-back-football">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="text-xl font-bold text-white/90">Football</h2>
              <Badge variant="secondary" className="text-xs">
                {state.currentPlayer === "player1" ? p1Name : p2Name}'s Possession
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-xs text-white/40">{p1Name}</div>
              <div className="text-2xl font-black tabular-nums text-white/90" style={{ textShadow: "0 0 16px rgba(34,197,94,0.5)" }} data-testid="score-p1-football">{state.player1Score}</div>
            </div>
            <div className="font-black text-white/30">VS</div>
            <div className="text-center">
              <div className="text-xs text-white/40">{p2Name}</div>
              <div className="text-2xl font-black tabular-nums text-white/90" style={{ textShadow: "0 0 16px rgba(239,68,68,0.5)" }} data-testid="score-p2-football">{state.player2Score}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Player cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[match.player1, match.player2].map((p, i) => {
            const isP1 = i === 0;
            const isActive = state.currentPlayer === (isP1 ? "player1" : "player2");
            const color = isP1 ? { r: 34, g: 197, b: 94 } : { r: 239, g: 68, b: 68 };
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
                    <div className="text-xs text-white/40">
                      Drive {isP1 ? state.p1DrivesDone + 1 : state.p2DrivesDone + 1} of {C.DRIVES_EACH}
                    </div>
                  </div>
                  {isActive && <Badge variant="outline" className="text-xs">Has Ball</Badge>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Field canvas */}
        <div
          className="mb-4 rounded-2xl border overflow-hidden"
          style={{ background: "rgba(0,0,0,0.3)", borderColor: "rgba(255,255,255,0.08)" }}
          data-testid="game-football"
        >
          <div className="p-3">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              className="rounded-xl mx-auto block cursor-pointer"
              style={{ maxWidth: "100%", height: "auto", touchAction: "none" }}
              onClick={handleCanvasClick}
              onTouchStart={handleCanvasTouch}
              data-testid="canvas-football-field"
            />
          </div>
        </div>

        {/* Action buttons */}
        {isMyTurn && !state.driveComplete && state.phase !== "over" && (
          <div
            className="rounded-xl border p-4 flex items-center gap-4 flex-wrap"
            style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
          >
            {state.phase === "play-setup" && (
              <Button onClick={handleSnap} className="px-8" data-testid="button-snap">
                Snap Ball
              </Button>
            )}
            {state.phase === "snap" && (
              <div className="flex gap-2 flex-wrap">
                {state.receivers.map(r => (
                  <Button
                    key={r.id}
                    onClick={() => handleThrow(r.id)}
                    variant="outline"
                    className="border-green-500/50 text-green-400"
                    data-testid={`button-throw-${r.id}`}
                  >
                    Throw R{r.id}
                  </Button>
                ))}
              </div>
            )}
            <div className="text-xs text-white/40 ml-auto">
              Down {state.down} · {state.yardsToGo} yds to go
            </div>
          </div>
        )}

        {!isMyTurn && !state.winner && (
          <div
            className="rounded-xl border p-4 text-center text-white/40"
            style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
          >
            Waiting for {state.currentPlayer === "player1" ? p1Name : p2Name}...
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
              {p1Name}: {state.player1Score} · {p2Name}: {state.player2Score}
            </div>
          </div>
        )}
      </div>
    </GameLayout>
  );
}
