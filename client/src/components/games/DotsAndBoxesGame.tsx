import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { MatchWithPlayers } from "@shared/schema";
import { GameLayout } from "@/components/games/GameLayout";
import { getBotOpponentName } from "@/lib/botMatchUtils";
import type { GameState as DotsAndBoxesGameState, Line } from "@shared/dotsAndBoxesEngine";
import { ArrowLeft, Clock, Trophy } from "lucide-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";

interface DotsAndBoxesGameProps {
  match: MatchWithPlayers;
  currentUserId?: string;
}

export default function DotsAndBoxesGame({ match, currentUserId }: DotsAndBoxesGameProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [gameState, setGameState] = useState<DotsAndBoxesGameState>(() => {
    if (match.gameState && (match.gameState as any).gridSize) {
      return match.gameState as DotsAndBoxesGameState;
    }
    const boxSize = 4;
    const gridSize = boxSize + 1;
    return {
      gridSize,
      horizontalLines: Array(gridSize).fill(null).map(() => Array(boxSize).fill("empty")),
      verticalLines: Array(boxSize).fill(null).map(() => Array(gridSize).fill("empty")),
      boxes: Array(boxSize).fill(null).map(() => Array(boxSize).fill("empty")),
      currentTurn: "player1",
      moveHistory: [],
      lastMove: null,
      winner: null,
      isGameOver: false,
      player1Score: 0,
      player2Score: 0,
      lastMoveCompletedBox: false,
    };
  });
  const [hoveredLine, setHoveredLine] = useState<Line | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const isPlayer1 = match.player1Id === currentUserId;
  const isMyTurn = match.isPractice || (gameState.currentTurn === "player1" && isPlayer1) || (gameState.currentTurn === "player2" && !isPlayer1);

  // Update game state when match data changes (for reconnect support)
  useEffect(() => {
    if (match.gameState && (match.gameState as any).gridSize) {
      setGameState(match.gameState as DotsAndBoxesGameState);
    }
  }, [match.gameState]);

  // Auto-generate bot moves
  useEffect(() => {
    if (match.isPractice || !match.isBotMatch || match.status !== "in-progress") return;
    if (gameState.isGameOver) return;
    
    const botPlayer = isPlayer1 ? "player2" : "player1";
    const isBotTurn = gameState.currentTurn === botPlayer;
    
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
            if (data.gameState) {
              setGameState(data.gameState);
            }
          }
        } catch (error) {
          console.error("Bot move error:", error);
        }
      }, 800); // Bot thinking delay
      
      return () => clearTimeout(timer);
    }
  }, [gameState.currentTurn, gameState.isGameOver, match.id, match.isPractice, match.isBotMatch, match.status, isPlayer1]);

  // Confetti on win
  useEffect(() => {
    if (gameState.isGameOver && gameState.winner) {
      const isWinner = (gameState.winner === "player1" && isPlayer1) || 
                       (gameState.winner === "player2" && !isPlayer1);
      
      if (isWinner) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    }
  }, [gameState.isGameOver, gameState.winner, isPlayer1]);

  // WebSocket setup
  const setupWebSocket = useCallback(() => {
    if (match.isPractice) return () => {};
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        ws.send(JSON.stringify({ 
          type: "join", 
          matchId: match.id, 
          userId: currentUserId 
        }));
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "gameState" && data.matchId === match.id) {
            setGameState(data.gameState);
          }
          
          if (data.type === "matchComplete" && data.matchId === match.id) {
            setGameState(data.gameState);
          }
        } catch (error) {
          console.error("WebSocket message error:", error);
        }
      };
      
      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
      
      ws.onclose = () => {
        setTimeout(() => {
          if (match.status === "in-progress") {
            setupWebSocket();
          }
        }, 3000);
      };
      
      wsRef.current = ws;
      
      return () => {
        ws.close();
      };
    } catch (error) {
      console.error("WebSocket connection error:", error);
      return () => {};
    }
  }, [match.id, match.isPractice, match.status, currentUserId, toast]);

  useEffect(() => {
    return setupWebSocket();
  }, [setupWebSocket]);

  const drawLine = (line: Line) => {
    if (!match.isPractice && !isMyTurn) return;
    if (gameState.isGameOver) return;
    
    // Check if line is already drawn
    if (line.isHorizontal) {
      if (gameState.horizontalLines[line.row][line.col] !== "empty") return;
    } else {
      if (gameState.verticalLines[line.row][line.col] !== "empty") return;
    }
    
    // Send move via WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "dots-and-boxes-move",
        matchId: match.id,
        line: line,
      }));
    } else if (match.isPractice) {
      // Practice mode: update locally
      toast({
        title: "Practice Mode",
        description: "WebSocket not connected. Use PvP mode for real-time gameplay.",
        variant: "destructive",
      });
    }
  };

  const gridSize = gameState.gridSize;
  const boxSize = gridSize - 1;
  const dotSize = 12;
  const spacing = 80;
  const lineThickness = 4;

  const P1_COLOR = "rgb(99, 102, 241)";    // indigo — player 1
  const P2_COLOR = "rgb(239, 68, 68)";      // red    — player 2
  const HOVER_COLOR = "rgba(255,255,255,0.55)";
  const EMPTY_COLOR = "rgba(255,255,255,0.10)";

  const getPlayerColor = (owner: "player1" | "player2" | "empty") => {
    if (owner === "player1") return P1_COLOR;
    if (owner === "player2") return P2_COLOR;
    return "transparent";
  };

  const getLineColor = (owner: "player1" | "player2" | "empty", isHovered: boolean) => {
    if (owner === "player1") return P1_COLOR;
    if (owner === "player2") return P2_COLOR;
    if (isHovered && isMyTurn) return HOVER_COLOR;
    return EMPTY_COLOR;
  };

  return (
    <GameLayout match={match} currentUserId={currentUserId} accentColor="#ec4899" accentRgb="236,72,153" controls="Click between two dots" winCondition="Most boxes wins" helpItems={[{ label: "Click", value: "Draw a line between dots" }, { label: "Box", value: "Close a box to score a point" }, { label: "Bonus", value: "Closing a box earns another turn" }]} className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Lobby
          </Button>
          
          {match.isPractice && (
            <Badge variant="secondary" data-testid="badge-practice">
              Practice Mode
            </Badge>
          )}
        </div>

        {/* Players Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Player 1 */}
          <div
            className="p-4 rounded-xl border transition-all duration-300"
            style={{
              background: "rgba(99,102,241,0.08)",
              borderColor: gameState.currentTurn === "player1" && !gameState.isGameOver ? "rgba(99,102,241,0.55)" : "rgba(255,255,255,0.08)",
              boxShadow: gameState.currentTurn === "player1" && !gameState.isGameOver ? "0 0 22px rgba(99,102,241,0.25)" : "none",
            }}
          >
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={match.player1?.profileImageUrl || undefined} />
                <AvatarFallback style={{ background: "rgba(99,102,241,0.3)", color: "#a5b4fc" }}>
                  {match.player1?.username?.[0] || "P1"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-semibold text-sm text-white/90">
                  {match.player1?.username || "Player 1"}
                </div>
                <div className="text-xs text-white/40">
                  {gameState.player1Score} {gameState.player1Score === 1 ? "box" : "boxes"}
                </div>
              </div>
              {gameState.currentTurn === "player1" && !gameState.isGameOver && (
                <Clock className="w-4 h-4 animate-pulse" style={{ color: "#a5b4fc" }} />
              )}
            </div>
          </div>

          {/* Match Info */}
          <div
            className="p-4 rounded-xl border text-center"
            style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <div className="space-y-2">
              <div
                className="text-2xl font-black tabular-nums"
                style={{ color: "white", textShadow: "0 0 20px rgba(99,102,241,0.6)" }}
              >
                {gameState.player1Score} — {gameState.player2Score}
              </div>
              <div className="text-xs text-white/40">
                {gameState.isGameOver ? (
                  <span className="flex items-center justify-center gap-1">
                    <Trophy className="w-3 h-3 text-yellow-400" />
                    Game Over
                  </span>
                ) : gameState.lastMoveCompletedBox ? (
                  <span className="font-semibold" style={{ color: "hsl(45 100% 60%)" }}>Bonus Turn!</span>
                ) : (
                  `${gameState.currentTurn === "player1" ? (match.player1?.username || "Player 1") : getBotOpponentName(match)}'s Turn`
                )}
              </div>
              {match.potAmount && Number(match.potAmount) > 0 && (
                <div className="text-xs font-semibold" style={{ color: "#4ade80" }}>
                  {match.potAmount} Scalps at stake
                </div>
              )}
            </div>
          </div>

          {/* Player 2 */}
          <div
            className="p-4 rounded-xl border transition-all duration-300"
            style={{
              background: "rgba(239,68,68,0.08)",
              borderColor: gameState.currentTurn === "player2" && !gameState.isGameOver ? "rgba(239,68,68,0.55)" : "rgba(255,255,255,0.08)",
              boxShadow: gameState.currentTurn === "player2" && !gameState.isGameOver ? "0 0 22px rgba(239,68,68,0.25)" : "none",
            }}
          >
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={match.player2?.profileImageUrl || undefined} />
                <AvatarFallback style={{ background: "rgba(239,68,68,0.3)", color: "#fca5a5" }}>
                  {match.player2?.username?.[0] || "P2"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-semibold text-sm text-white/90">
                  {getBotOpponentName(match)}
                </div>
                <div className="text-xs text-white/40">
                  {gameState.player2Score} {gameState.player2Score === 1 ? "box" : "boxes"}
                </div>
              </div>
              {gameState.currentTurn === "player2" && !gameState.isGameOver && (
                <Clock className="w-4 h-4 animate-pulse" style={{ color: "#fca5a5" }} />
              )}
            </div>
          </div>
        </div>

        {/* Game Board */}
        <div
          className="rounded-2xl border p-4 sm:p-8"
          style={{ background: "rgba(0,0,0,0.25)", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <div className="flex justify-center overflow-x-auto">
            <svg 
              width={spacing * boxSize + dotSize * 2} 
              height={spacing * boxSize + dotSize * 2}
              className="rounded-lg"
              style={{ maxWidth: "100%", height: "auto", touchAction: "manipulation" }}
            >
              {/* Boxes (filled rectangles) */}
              {gameState.boxes.map((row, rowIdx) =>
                row.map((owner, colIdx) => (
                  <motion.rect
                    key={`box-${rowIdx}-${colIdx}`}
                    x={dotSize + colIdx * spacing + lineThickness / 2}
                    y={dotSize + rowIdx * spacing + lineThickness / 2}
                    width={spacing - lineThickness}
                    height={spacing - lineThickness}
                    fill={getPlayerColor(owner)}
                    opacity={owner === "empty" ? 0 : 0.3}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: owner === "empty" ? 0 : 0.3, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                ))
              )}

              {/* Horizontal Lines */}
              {gameState.horizontalLines.map((row, rowIdx) =>
                row.map((owner, colIdx) => {
                  const line: Line = { row: rowIdx, col: colIdx, isHorizontal: true };
                  const isHovered = Boolean(hoveredLine?.isHorizontal && hoveredLine.row === rowIdx && hoveredLine.col === colIdx);
                  const canClick = owner === "empty" && isMyTurn && !gameState.isGameOver;
                  
                  return (
                    <g key={`h-line-${rowIdx}-${colIdx}`}>
                      {/* Visible line */}
                      <rect
                        x={dotSize + colIdx * spacing}
                        y={dotSize + rowIdx * spacing - lineThickness / 2}
                        width={spacing}
                        height={lineThickness}
                        rx={lineThickness / 2}
                        fill={getLineColor(owner, isHovered)}
                        data-testid={`line-h-${rowIdx}-${colIdx}`}
                        style={{ transition: "fill 0.15s" }}
                      />
                      {/* Invisible wide hitbox for easy clicking */}
                      <rect
                        x={dotSize + colIdx * spacing + dotSize / 2}
                        y={dotSize + rowIdx * spacing - 14}
                        width={spacing - dotSize}
                        height={28}
                        fill="transparent"
                        className={canClick ? "cursor-pointer" : ""}
                        onClick={() => { if (canClick) drawLine(line); }}
                        onMouseEnter={() => { if (owner === "empty") setHoveredLine(line); }}
                        onMouseLeave={() => setHoveredLine(null)}
                      />
                    </g>
                  );
                })
              )}

              {/* Vertical Lines */}
              {gameState.verticalLines.map((row, rowIdx) =>
                row.map((owner, colIdx) => {
                  const line: Line = { row: rowIdx, col: colIdx, isHorizontal: false };
                  const isHovered = Boolean(hoveredLine && !hoveredLine.isHorizontal && hoveredLine.row === rowIdx && hoveredLine.col === colIdx);
                  const canClick = owner === "empty" && isMyTurn && !gameState.isGameOver;
                  
                  return (
                    <g key={`v-line-${rowIdx}-${colIdx}`}>
                      {/* Visible line */}
                      <rect
                        x={dotSize + colIdx * spacing - lineThickness / 2}
                        y={dotSize + rowIdx * spacing}
                        width={lineThickness}
                        height={spacing}
                        rx={lineThickness / 2}
                        fill={getLineColor(owner, isHovered)}
                        data-testid={`line-v-${rowIdx}-${colIdx}`}
                        style={{ transition: "fill 0.15s" }}
                      />
                      {/* Invisible wide hitbox */}
                      <rect
                        x={dotSize + colIdx * spacing - 14}
                        y={dotSize + rowIdx * spacing + dotSize / 2}
                        width={28}
                        height={spacing - dotSize}
                        fill="transparent"
                        className={canClick ? "cursor-pointer" : ""}
                        onClick={() => { if (canClick) drawLine(line); }}
                        onMouseEnter={() => { if (owner === "empty") setHoveredLine(line); }}
                        onMouseLeave={() => setHoveredLine(null)}
                      />
                    </g>
                  );
                })
              )}

              {/* Dots */}
              {Array.from({ length: gridSize }).map((_, rowIdx) =>
                Array.from({ length: gridSize }).map((_, colIdx) => (
                  <circle
                    key={`dot-${rowIdx}-${colIdx}`}
                    cx={dotSize + colIdx * spacing}
                    cy={dotSize + rowIdx * spacing}
                    r={dotSize / 2}
                    fill="white"
                    className="pointer-events-none"
                  />
                ))
              )}
            </svg>
          </div>
        </div>

        {/* Game Over Message */}
        {gameState.isGameOver && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div
              className="p-6 rounded-2xl border text-center"
              style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.10)" }}
            >
              <Trophy className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
              <h2 className="text-2xl font-bold mb-2 text-white/90" data-testid="text-game-over">
                {gameState.winner === "draw" 
                  ? "It's a Draw!" 
                  : `${gameState.winner === "player1" ? (match.player1?.username || "Player 1") : getBotOpponentName(match)} Wins!`}
              </h2>
              <p className="text-white/50 mb-4">
                Final Score: {gameState.player1Score} — {gameState.player2Score}
              </p>
              <Button onClick={() => setLocation("/")} data-testid="button-return-lobby">
                Return to Lobby
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </GameLayout>
  );
}
