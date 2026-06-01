import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  StackTowerGameState,
  StackTowerMove,
  updateStackTowerPhysics,
  canMakeStackTowerMove,
  applyStackTowerMove,
  initStackTowerGame,
  STACK_TOWER_CONSTANTS,
} from "@shared/stackTowerEngine";
import type { MatchWithPlayers } from "@shared/schema";
import { GameLayout } from "@/components/games/GameLayout";
import { getBotOpponentName } from "@/lib/botMatchUtils";
import { Trophy, Layers, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface StackTowerGameProps {
  match: MatchWithPlayers;
  currentUserId?: string;
}

function isValidStackTowerState(s: unknown): s is StackTowerGameState {
  if (!s || typeof s !== "object") return false;
  const obj = s as Record<string, unknown>;
  return (
    typeof obj.player1 === "object" &&
    obj.player1 !== null &&
    typeof obj.player2 === "object" &&
    obj.player2 !== null &&
    typeof obj.gamePhase === "string"
  );
}

export default function StackTowerGame({ match, currentUserId }: StackTowerGameProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [gameState, setGameState] = useState<StackTowerGameState>(() => {
    if (isValidStackTowerState(match.gameState)) {
      return match.gameState;
    }
    return initStackTowerGame();
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const currentStateRef = useRef<StackTowerGameState>(gameState);
  const wsRef = useRef<WebSocket | null>(null);

  const isPlayer1 = match.player1Id === currentUserId;
  const playerNum: 1 | 2 = isPlayer1 ? 1 : 2;
  const myPlayer = isPlayer1 ? gameState.player1 : gameState.player2;
  const oppPlayer = isPlayer1 ? gameState.player2 : gameState.player1;
  const canMove = canMakeStackTowerMove(gameState, playerNum);
  const isGameOver = gameState.gamePhase === "finished" || myPlayer.isGameOver;

  const player1Name = match.player1?.username || match.player1?.firstName || "Player 1";
  const player2Name = getBotOpponentName(match);
  const myName = isPlayer1 ? player1Name : player2Name;
  const oppName = isPlayer1 ? player2Name : player1Name;

  useEffect(() => {
    currentStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    if (isValidStackTowerState(match.gameState)) {
      setGameState(match.gameState);
    }
  }, [match.gameState]);

  useEffect(() => {
    if (!match.isBotMatch || match.status !== "in-progress") return;
    if (gameState.gamePhase !== "playing") return;

    const botPlayerNum: 1 | 2 = isPlayer1 ? 2 : 1;
    const botCanMove = canMakeStackTowerMove(gameState, botPlayerNum);

    if (!botCanMove) return;

    const delay = 600 + Math.random() * 800;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/matches/${match.id}/bot-move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.move && isValidStackTowerState(data.move.gameState)) {
            setGameState(data.move.gameState);
          }
        }
      } catch (err) {
        console.error("Bot move error:", err);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [match, gameState, isPlayer1]);

  useEffect(() => {
    if (match.isPractice || !currentUserId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", matchId: match.id, userId: currentUserId }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "gameState" && data.matchId === match.id && isValidStackTowerState(data.gameState)) {
          setGameState(data.gameState);
        } else if (data.type === "matchComplete" && data.matchId === match.id) {
          if (isValidStackTowerState(data.gameState)) setGameState(data.gameState);
          toast({
            title: "Match Complete!",
            description: data.winner === currentUserId ? "You won!" : "You lost.",
          });
        }
      } catch {}
    };

    return () => ws.close();
  }, [match.id, match.isPractice, currentUserId, toast]);

  useEffect(() => {
    if (gameState.gamePhase !== "playing") return;

    const simulate = () => {
      const newState = updateStackTowerPhysics(currentStateRef.current);
      currentStateRef.current = newState;
      setGameState({ ...newState });
      animationFrameRef.current = requestAnimationFrame(simulate);
    };

    animationFrameRef.current = requestAnimationFrame(simulate);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [gameState.gamePhase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const C = STACK_TOWER_CONSTANTS;
    const W = C.CANVAS_WIDTH;
    const H = C.CANVAS_HEIGHT;

    // Background with depth
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "#06081a");
    bgGrad.addColorStop(0.7, "#0a0e22");
    bgGrad.addColorStop(1, "#0e1230");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle grid with perspective feel
    ctx.save();
    ctx.strokeStyle = "rgba(59,130,246,0.04)";
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.restore();

    // Ambient glow behind tower area
    const towerGlow = ctx.createRadialGradient(W / 2, C.GROUND_Y - 100, 0, W / 2, C.GROUND_Y - 100, W * 0.4);
    towerGlow.addColorStop(0, "rgba(139,92,246,0.06)");
    towerGlow.addColorStop(1, "transparent");
    ctx.fillStyle = towerGlow;
    ctx.fillRect(0, 0, W, H);

    // Ground line with glow
    ctx.save();
    ctx.shadowColor = "rgba(59,130,246,0.4)";
    ctx.shadowBlur = 8;
    ctx.strokeStyle = "rgba(59,130,246,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, C.GROUND_Y);
    ctx.lineTo(W, C.GROUND_Y);
    ctx.stroke();
    ctx.restore();

    // Ground surface
    const groundGrad = ctx.createLinearGradient(0, C.GROUND_Y, 0, H);
    groundGrad.addColorStop(0, "rgba(15,20,40,0.8)");
    groundGrad.addColorStop(1, "rgba(10,14,30,1)");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, C.GROUND_Y, W, H - C.GROUND_Y);

    const myBlocks = myPlayer.blocks;
    myBlocks.forEach((block, i) => {
      const hue = 210 + (i * 8) % 80;
      const bx = block.x - block.width / 2;
      const by = block.y - C.BLOCK_HEIGHT;

      // Block shadow
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(bx + 3, by + 3, block.width, C.BLOCK_HEIGHT);
      ctx.restore();

      // Block body with 3D gradient
      const blockGrad = ctx.createLinearGradient(bx, by, bx, by + C.BLOCK_HEIGHT);
      blockGrad.addColorStop(0, `hsl(${hue}, 70%, 62%)`);
      blockGrad.addColorStop(0.5, `hsl(${hue}, 70%, 55%)`);
      blockGrad.addColorStop(1, `hsl(${hue}, 70%, 42%)`);
      ctx.fillStyle = blockGrad;
      ctx.fillRect(bx, by, block.width, C.BLOCK_HEIGHT);

      // Top highlight
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(bx + 2, by + 2, block.width - 4, 4);

      // Bottom edge shadow
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(bx, by + C.BLOCK_HEIGHT - 2, block.width, 2);

      // Side edge
      ctx.strokeStyle = `hsl(${hue}, 70%, 35%)`;
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, block.width, C.BLOCK_HEIGHT);
    });

    const blk = myPlayer.currentBlock;
    if (blk && !blk.placed && gameState.gamePhase === "playing" && !myPlayer.isGameOver) {
      const bx = blk.x - blk.width / 2;
      const by = blk.y - C.BLOCK_HEIGHT;

      // Moving block glow
      ctx.save();
      ctx.shadowColor = "rgba(249,115,22,0.3)";
      ctx.shadowBlur = 10;

      const movGrad = ctx.createLinearGradient(bx, by, bx, by + C.BLOCK_HEIGHT);
      movGrad.addColorStop(0, "#fb923c");
      movGrad.addColorStop(0.5, "#f97316");
      movGrad.addColorStop(1, "#c2410c");
      ctx.fillStyle = movGrad;
      ctx.fillRect(bx, by, blk.width, C.BLOCK_HEIGHT);
      ctx.restore();

      // Top highlight
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(bx + 2, by + 2, blk.width - 4, 4);

      ctx.strokeStyle = "#ea580c";
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, blk.width, C.BLOCK_HEIGHT);

      if (canMove && myBlocks.length > 0) {
        const last = myBlocks[myBlocks.length - 1];
        const overlapLeft = Math.max(blk.x - blk.width / 2, last.x - last.width / 2);
        const overlapRight = Math.min(blk.x + blk.width / 2, last.x + last.width / 2);
        const overlap = Math.max(0, overlapRight - overlapLeft);
        const pct = last.width > 0 ? (overlap / last.width) * 100 : 0;
        const indicatorColor = pct >= 95 ? "#22c55e" : pct >= 85 ? "#eab308" : "#f97316";
        ctx.save();
        ctx.shadowColor = indicatorColor;
        ctx.shadowBlur = 6;
        ctx.strokeStyle = indicatorColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(bx - 2, by - 2, blk.width + 4, C.BLOCK_HEIGHT + 4);
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Drop guide line
      ctx.fillStyle = "rgba(249,115,22,0.08)";
      ctx.fillRect(bx, blk.y, blk.width, C.GROUND_Y - blk.y);
    }

    if (myPlayer.isGameOver && gameState.gamePhase !== "finished") {
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, H / 2 - 55, W, 110);
      ctx.save();
      ctx.shadowColor = "rgba(239,68,68,0.5)";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 40px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Game Over!", W / 2, H / 2);
      ctx.restore();
      ctx.textAlign = "left";
    }

    if (gameState.gamePhase === "finished") {
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillRect(0, H / 2 - 65, W, 130);
      const isWinner = gameState.winner === playerNum;
      const isDraw = gameState.isDraw;
      ctx.save();
      ctx.shadowColor = isDraw ? "rgba(234,179,8,0.5)" : isWinner ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)";
      ctx.shadowBlur = 12;
      ctx.fillStyle = isDraw ? "#eab308" : isWinner ? "#22c55e" : "#ef4444";
      ctx.font = "bold 44px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(isDraw ? "Draw!" : isWinner ? "You Win!" : "You Lose", W / 2, H / 2 - 16);
      ctx.restore();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${myPlayer.score} blocks stacked`, W / 2, H / 2 + 24);
      ctx.textAlign = "left";
    }
  }, [gameState, myPlayer, canMove, playerNum]);

  const handleDrop = async () => {
    if (!canMove || gameState.gamePhase !== "playing") return;

    const move: StackTowerMove = { action: "drop", timestamp: Date.now() };

    try {
      if (match.isPractice) {
        const newState = applyStackTowerMove(currentStateRef.current, playerNum, move);
        currentStateRef.current = newState;
        setGameState(newState);
        return;
      } else if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "stack-tower-drop",
          matchId: match.id,
          userId: currentUserId,
        }));
      } else {
        const afterDrop = applyStackTowerMove(currentStateRef.current, playerNum, move);
        currentStateRef.current = afterDrop;
        setGameState(afterDrop);
        await fetch(`/api/matches/${match.id}/bot-move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        }).then(r => r.ok ? r.json() : null).then(data => {
          if (data?.move && isValidStackTowerState(data.move.gameState)) {
            currentStateRef.current = data.move.gameState;
            setGameState(data.move.gameState);
          }
        }).catch(() => {});
      }
    } catch (err) {
      console.error("Move error:", err);
      toast({ title: "Move Failed", description: "Try again.", variant: "destructive" });
    }
  };

  return (
    <GameLayout match={match} currentUserId={currentUserId} accentColor="#06b6d4" accentRgb="6,182,212" controls="Tap / Space to drop" winCondition="Highest stack wins" helpItems={[{ label: "Drop", value: "Tap the button or press Space" }, { label: "Stack", value: "Land precisely for perfect score" }, { label: "Overhang", value: "Missed area is cut off" }]} className="p-2 sm:p-4">
      <div className="max-w-lg mx-auto space-y-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")} data-testid="button-back-to-lobby">
            <ArrowLeft className="w-4 h-4 mr-1" />Back
          </Button>
          <Badge variant="outline" data-testid="badge-game-type">
            <Layers className="w-3.5 h-3.5 mr-1.5" />Stack Tower
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2 items-center">
          <div
            className="p-3 rounded-xl border text-center transition-all duration-300"
            style={{
              background: "rgba(6,182,212,0.08)",
              borderColor: !myPlayer.isGameOver ? "rgba(6,182,212,0.4)" : "rgba(255,255,255,0.08)",
              boxShadow: !myPlayer.isGameOver ? "0 0 16px rgba(6,182,212,0.18)" : "none",
            }}
          >
            <div className="text-xs text-white/50 mb-1 truncate" data-testid="text-my-name">{myName}</div>
            <div className="text-2xl font-black tabular-nums" style={{ color: "#22d3ee", textShadow: "0 0 16px rgba(6,182,212,0.5)" }} data-testid="text-my-score">{myPlayer.score}</div>
            <div className="text-xs text-white/40">blocks</div>
          </div>
          <div className="text-center font-black text-sm" style={{ color: "white", textShadow: "0 0 12px rgba(139,92,246,0.6)" }}>VS</div>
          <div
            className="p-3 rounded-xl border text-center transition-all duration-300"
            style={{
              background: "rgba(239,68,68,0.08)",
              borderColor: !oppPlayer.isGameOver ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.08)",
              boxShadow: !oppPlayer.isGameOver ? "0 0 16px rgba(239,68,68,0.15)" : "none",
            }}
          >
            <div className="text-xs text-white/50 mb-1 truncate" data-testid="text-opp-name">{oppName}</div>
            <div className="text-2xl font-black tabular-nums" style={{ color: "#f87171" }} data-testid="text-opp-score">{oppPlayer.score}</div>
            <div className="text-xs text-white/40">blocks</div>
          </div>
        </div>

        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            width={STACK_TOWER_CONSTANTS.CANVAS_WIDTH}
            height={STACK_TOWER_CONSTANTS.CANVAS_HEIGHT}
            className="rounded-xl block"
            style={{ maxWidth: "100%", height: "auto", border: "1px solid rgba(6,182,212,0.3)", boxShadow: "0 0 30px rgba(6,182,212,0.15)" }}
            data-testid="canvas-stack-tower"
          />
        </div>

        {gameState.gamePhase === "playing" && !myPlayer.isGameOver && (
          <Button
            onClick={handleDrop}
            size="lg"
            disabled={!canMove}
            className="w-full text-base font-bold"
            data-testid="button-drop-block"
          >
            {canMove ? "Drop Block!" : "Wait for your block..."}
          </Button>
        )}

        {isGameOver && (
          <div
            className="p-4 rounded-xl border text-center space-y-3"
            style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.10)" }}
          >
            <Trophy className="w-8 h-8 mx-auto text-yellow-400" />
            <p className="font-bold text-lg text-white/90" data-testid="text-game-result">
              {gameState.isDraw
                ? "It's a Draw!"
                : gameState.winner === playerNum
                ? "You Win!"
                : "Opponent Wins"}
            </p>
            <p className="text-sm text-white/40">
              You: {myPlayer.score} blocks · Opponent: {oppPlayer.score} blocks
            </p>
            <Button variant="outline" className="w-full" onClick={() => setLocation("/")}>
              Back to Lobby
            </Button>
          </div>
        )}
      </div>
    </GameLayout>
  );
}
