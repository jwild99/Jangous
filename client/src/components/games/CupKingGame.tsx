import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  CupKingGameState,
  CupKingMove,
  applyCupKingMove,
  simulateCupKingPhysicsStep,
  getCupCounts,
  getCupKingConstants,
  initCupKingGame,
} from "@shared/cupKingEngine";
import type { MatchWithPlayers } from "@shared/schema";
import { GameLayout } from "@/components/games/GameLayout";
import { getBotOpponentName } from "@/lib/botMatchUtils";
import { Trophy, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface CupKingGameProps {
  match: MatchWithPlayers;
  currentUserId?: string;
}

export default function CupKingGame({ match, currentUserId }: CupKingGameProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [angle, setAngle] = useState(0);
  const [power, setPower] = useState(60);
  const [gameState, setGameState] = useState<CupKingGameState>(() => {
    if (match.gameState && (match.gameState as any).player1Cups) {
      return match.gameState as CupKingGameState;
    }
    return initCupKingGame();
  });
  const animationFrameRef = useRef<number>();
  const currentStateRef = useRef<CupKingGameState>(gameState);
  const wsRef = useRef<WebSocket | null>(null);

  const constants = getCupKingConstants();
  const isPlayer1 = match.player1Id === currentUserId;
  const currentPlayerNum = gameState.currentPlayer;
  const isMyTurn = match.isPractice || (currentPlayerNum === 1 && isPlayer1) || (currentPlayerNum === 2 && !isPlayer1);

  // Update current state ref
  useEffect(() => {
    currentStateRef.current = gameState;
  }, [gameState]);

  // Update game state when match data changes
  useEffect(() => {
    if (match.gameState && (match.gameState as any).player1Cups) {
      setGameState(match.gameState as CupKingGameState);
    }
  }, [match.gameState]);

  // Auto-generate bot moves
  useEffect(() => {
    if (match.isPractice || !match.isBotMatch || match.status !== "in-progress") return;
    if (gameState.winner !== null) return;
    if (gameState.isSimulating) return;
    
    const botPlayer = isPlayer1 ? 2 : 1;
    const isBotTurn = gameState.currentPlayer === botPlayer;
    
    if (isBotTurn) {
      const timer = setTimeout(async () => {
        try {
          const response = await fetch(`/api/matches/${match.id}/bot-move`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.move && data.move.gameState) {
              setGameState(data.move.gameState);
            }
          }
        } catch (error) {
          console.error("Bot move error:", error);
        }
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [match.isBotMatch, match.isPractice, match.status, match.id, gameState.currentPlayer, gameState.winner, gameState.isSimulating, isPlayer1]);

  // WebSocket connection for real-time multiplayer
  const setupWebSocket = useCallback(() => {
    if (match.isPractice) return;
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "join", matchId: match.id, userId: currentUserId }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === "cup-king-move" && data.matchId === match.id) {
          setGameState(data.gameState);
        } else if (data.type === "error") {
          toast({
            title: "Error",
            description: data.message,
            variant: "destructive",
          });
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      wsRef.current = ws;
      
      return () => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
    }
  }, [match.id, match.isPractice, currentUserId, toast]);

  useEffect(() => {
    return setupWebSocket();
  }, [setupWebSocket]);

  // Physics simulation loop
  useEffect(() => {
    if (!gameState.isSimulating) return;

    const simulate = () => {
      const { state: newState, shouldContinue } = simulateCupKingPhysicsStep(currentStateRef.current);
      currentStateRef.current = newState;
      setGameState(newState);

      if (shouldContinue) {
        animationFrameRef.current = requestAnimationFrame(simulate);
      } else {
        // Check for winner after simulation ends
        if (newState.winner) {
          const winnerName = newState.winner === 1 
            ? (match.player1?.firstName || "Player 1")
            : getBotOpponentName(match);
          toast({
            title: newState.winner === (isPlayer1 ? 1 : 2) ? "You Win!" : "You Lose!",
            description: `${winnerName} has won the match!`,
          });
        }
      }
    };

    animationFrameRef.current = requestAnimationFrame(simulate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState.isSimulating, match.player1?.firstName, match.player2?.firstName, isPlayer1, toast]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const CW = constants.CANVAS_WIDTH;
    const CH = constants.CANVAS_HEIGHT;

    // Dark ambient background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CH);
    bgGrad.addColorStop(0, "#0a0e1a");
    bgGrad.addColorStop(1, "#060810");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CW, CH);

    // Table surface
    const tableGrad = ctx.createLinearGradient(0, 0, 0, CH);
    tableGrad.addColorStop(0, "#1a1520");
    tableGrad.addColorStop(0.5, "#1e1828");
    tableGrad.addColorStop(1, "#1a1520");
    ctx.fillStyle = tableGrad;
    ctx.fillRect(20, 20, CW - 40, CH - 40);

    // Table border
    ctx.strokeStyle = "rgba(100,80,60,0.3)";
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, CW - 40, CH - 40);

    // Ambient lighting
    const ambGlow = ctx.createRadialGradient(CW / 2, CH / 2, 0, CW / 2, CH / 2, CW * 0.5);
    ambGlow.addColorStop(0, "rgba(139,92,246,0.04)");
    ambGlow.addColorStop(1, "transparent");
    ctx.fillStyle = ambGlow;
    ctx.fillRect(0, 0, CW, CH);

    // Center line with glow
    ctx.save();
    ctx.shadowColor = "rgba(100,120,200,0.3)";
    ctx.shadowBlur = 6;
    ctx.strokeStyle = "rgba(100,120,200,0.2)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    ctx.moveTo(30, CH / 2);
    ctx.lineTo(CW - 30, CH / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Draw 3D cups helper
    const drawCup = (cx: number, cy: number, r: number, baseColor: string, highlightColor: string) => {
      // Cup shadow
      ctx.save();
      ctx.globalAlpha = 0.3;
      const shadowGrad = ctx.createRadialGradient(cx + 2, cy + r * 0.4, 0, cx + 2, cy + r * 0.4, r * 1.3);
      shadowGrad.addColorStop(0, "rgba(0,0,0,0.5)");
      shadowGrad.addColorStop(1, "transparent");
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.ellipse(cx + 2, cy + r * 0.4, r * 1.2, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Cup body (3D sphere gradient)
      const cupGrad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.1, cx, cy, r);
      cupGrad.addColorStop(0, highlightColor);
      cupGrad.addColorStop(0.6, baseColor);
      const darken = (hex: string) => {
        const num = parseInt(hex.replace("#", ""), 16);
        const r = Math.max(0, ((num >> 16) & 0xff) - 60);
        const g = Math.max(0, ((num >> 8) & 0xff) - 60);
        const b = Math.max(0, (num & 0xff) - 60);
        return `rgb(${r},${g},${b})`;
      };
      cupGrad.addColorStop(1, darken(baseColor));
      ctx.fillStyle = cupGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Liquid surface (dark circle inside)
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.65, 0, Math.PI * 2);
      ctx.fill();

      // Specular highlight
      const specGrad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx - r * 0.3, cy - r * 0.3, r * 0.5);
      specGrad.addColorStop(0, "rgba(255,255,255,0.4)");
      specGrad.addColorStop(1, "transparent");
      ctx.fillStyle = specGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Rim edge
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    };

    // Draw player 2's cups (top) - red
    gameState.player2Cups.forEach((cup) => {
      if (!cup.hit) {
        drawCup(cup.x, cup.y, cup.radius, "#dc2626", "#f87171");
      }
    });

    // Draw player 1's cups (bottom) - blue
    gameState.player1Cups.forEach((cup) => {
      if (!cup.hit) {
        drawCup(cup.x, cup.y, cup.radius, "#2563eb", "#60a5fa");
      }
    });

    // Draw ball with 3D shading
    if (gameState.ball) {
      const bx = gameState.ball.x;
      const by = gameState.ball.y;
      const br = gameState.ball.radius;

      // Ball shadow
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.ellipse(bx + 1, by + br * 0.4, br * 0.9, br * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Ball body
      const ballGrad = ctx.createRadialGradient(bx - br * 0.25, by - br * 0.25, br * 0.05, bx, by, br);
      ballGrad.addColorStop(0, "#fff8e0");
      ballGrad.addColorStop(0.4, "#facc15");
      ballGrad.addColorStop(1, "#b8860b");
      ctx.fillStyle = ballGrad;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();

      // Specular dot
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.beginPath();
      ctx.arc(bx - br * 0.2, by - br * 0.25, br * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw aim guide
    if (isMyTurn && !gameState.isSimulating) {
      const startY = isPlayer1 ? CH - 30 : 30;
      const startX = CW / 2;
      const direction = isPlayer1 ? -1 : 1;
      const angleRad = (angle * Math.PI) / 180;

      const guideLength = 100;
      const endX = startX + Math.sin(angleRad) * guideLength;
      const endY = startY + direction * Math.cos(angleRad) * guideLength;

      // Glowing aim line
      ctx.save();
      ctx.shadowColor = "rgba(80,255,140,0.4)";
      ctx.shadowBlur = 6;
      const aimGrad = ctx.createLinearGradient(startX, startY, endX, endY);
      aimGrad.addColorStop(0, "rgba(80,255,140,0.7)");
      aimGrad.addColorStop(1, "rgba(80,255,140,0)");
      ctx.strokeStyle = aimGrad;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Power indicator ring
      ctx.save();
      ctx.strokeStyle = "rgba(80,255,140,0.3)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(startX, startY, (power / 100) * 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(80,255,140,0.08)";
      ctx.fill();
      ctx.restore();

      // Center dot
      ctx.fillStyle = "rgba(80,255,140,0.8)";
      ctx.beginPath();
      ctx.arc(startX, startY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [gameState, angle, power, isMyTurn, isPlayer1, constants]);

  const handleThrow = async () => {
    if (!isMyTurn || gameState.isSimulating || gameState.winner !== null) return;

    const move: CupKingMove = { angle, power };

    // For practice mode, apply move locally
    if (match.isPractice) {
      const newState = applyCupKingMove(gameState, move);
      setGameState(newState);
      return;
    }

    // Send move to server for validation
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "cup-king-move",
        matchId: match.id,
        move,
      }));
    }
  };

  const cupCounts = getCupCounts(gameState);
  const player1Name = match.player1?.firstName || "Player 1";
  const player2Name = getBotOpponentName(match);
  const currentPlayerName = gameState.currentPlayer === 1 ? player1Name : player2Name;

  return (
    <GameLayout match={match} currentUserId={currentUserId} accentColor="#ef4444" accentRgb="239,68,68" controls="Set angle & power" winCondition="Sink all cups first" showPills={false}>
      <div className="border-b" style={{ background: "rgba(0,0,0,0.35)", borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between px-4 md:px-8 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              data-testid="button-back-cup-king"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="text-xl font-bold text-white/90">Cup King</h2>
              <Badge variant={match.status === "in-progress" ? "default" : "secondary"}>
                {match.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Player Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div
            className="p-4 rounded-xl border transition-all duration-300"
            style={{
              background: "rgba(37,99,235,0.08)",
              borderColor: gameState.currentPlayer === 1 && !gameState.winner ? "rgba(37,99,235,0.5)" : "rgba(255,255,255,0.08)",
              boxShadow: gameState.currentPlayer === 1 && !gameState.winner ? "0 0 20px rgba(37,99,235,0.22)" : "none",
            }}
          >
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={match.player1?.profileImageUrl || undefined} style={{ objectFit: 'cover' }} />
                <AvatarFallback style={{ background: "rgba(37,99,235,0.3)", color: "#93c5fd" }}>{match.player1?.firstName?.[0] || "P1"}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-semibold text-white/90">{player1Name}</div>
                <div className="text-sm text-white/40">{cupCounts.player1} cups left</div>
              </div>
              {gameState.currentPlayer === 1 && !gameState.winner && (
                <Badge variant="outline" style={{ borderColor: "rgba(37,99,235,0.5)", color: "#93c5fd" }}>Turn</Badge>
              )}
            </div>
          </div>

          <div
            className="p-4 rounded-xl border transition-all duration-300"
            style={{
              background: "rgba(220,38,38,0.08)",
              borderColor: gameState.currentPlayer === 2 && !gameState.winner ? "rgba(220,38,38,0.5)" : "rgba(255,255,255,0.08)",
              boxShadow: gameState.currentPlayer === 2 && !gameState.winner ? "0 0 20px rgba(220,38,38,0.22)" : "none",
            }}
          >
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={match.player2?.profileImageUrl || undefined} style={{ objectFit: 'cover' }} />
                <AvatarFallback style={{ background: "rgba(220,38,38,0.3)", color: "#fca5a5" }}>{match.player2?.firstName?.[0] || "P2"}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-semibold text-white/90">{player2Name}</div>
                <div className="text-sm text-white/40">{cupCounts.player2} cups left</div>
              </div>
              {gameState.currentPlayer === 2 && !gameState.winner && (
                <Badge variant="outline" style={{ borderColor: "rgba(220,38,38,0.5)", color: "#fca5a5" }}>Turn</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Winner Banner */}
        {gameState.winner && (
          <div
            className="mb-6 p-6 rounded-2xl border text-center"
            style={{ background: "rgba(251,191,36,0.08)", borderColor: "rgba(251,191,36,0.35)" }}
          >
            <div className="flex items-center justify-center gap-2" style={{ color: "#fde68a" }}>
              <Trophy className="w-6 h-6" />
              <span className="text-xl font-bold">
                {gameState.winner === 1 ? player1Name : player2Name} Wins!
              </span>
            </div>
          </div>
        )}

        {/* Game Canvas */}
        <div
          className="mb-6 rounded-2xl border overflow-hidden"
          style={{ background: "rgba(0,0,0,0.3)", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <div className="p-4">
            <canvas
              ref={canvasRef}
              width={constants.CANVAS_WIDTH}
              height={constants.CANVAS_HEIGHT}
              className="w-full rounded-xl"
              style={{ maxWidth: "100%", height: "auto" }}
              data-testid="canvas-cup-king"
            />
          </div>
        </div>

        {/* Controls */}
        {!gameState.winner && isMyTurn && !gameState.isSimulating && (
          <div
            className="rounded-xl border p-6"
            style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <div className="space-y-6">
              <div>
                <Label htmlFor="angle-slider" className="text-base mb-3 block text-white/80">
                  Angle: {angle}°
                </Label>
                <Slider
                  id="angle-slider"
                  min={-45}
                  max={45}
                  step={1}
                  value={[angle]}
                  onValueChange={(values) => setAngle(values[0])}
                  className="w-full"
                  data-testid="slider-angle"
                />
                <div className="flex justify-between text-xs text-white/40 mt-2">
                  <span>← Left (-45°)</span>
                  <span>Center (0°)</span>
                  <span>Right (45°) →</span>
                </div>
              </div>

              <div>
                <Label htmlFor="power-slider" className="text-base mb-3 block text-white/80">
                  Power: {power}%
                </Label>
                <Slider
                  id="power-slider"
                  min={0}
                  max={100}
                  step={1}
                  value={[power]}
                  onValueChange={(values) => setPower(values[0])}
                  className="w-full"
                  data-testid="slider-power"
                />
                <div className="flex justify-between text-xs text-white/40 mt-2">
                  <span>Soft (0%)</span>
                  <span>Medium (50%)</span>
                  <span>Hard (100%)</span>
                </div>
              </div>

              <Button
                onClick={handleThrow}
                className="w-full"
                size="lg"
                data-testid="button-throw"
              >
                Throw Ball
              </Button>
            </div>
          </div>
        )}

        {/* Waiting message */}
        {!gameState.winner && !isMyTurn && (
          <div
            className="rounded-xl border p-6 text-center"
            style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <p className="text-white/40">
              {gameState.isSimulating ? "Ball in flight..." : `Waiting for ${currentPlayerName} to throw...`}
            </p>
          </div>
        )}
      </div>
    </GameLayout>
  );
}
