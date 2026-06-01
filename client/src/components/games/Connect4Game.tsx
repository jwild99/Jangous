import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { MatchWithPlayers } from "@shared/schema";
import { GameLayout } from "@/components/games/GameLayout";
import { getBotOpponentName } from "@/lib/botMatchUtils";
import type { GameState as Connect4GameState } from "@shared/connect4Engine";
import { ArrowLeft, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

interface Connect4GameProps {
  match: MatchWithPlayers;
  currentUserId?: string;
}

export default function Connect4Game({ match, currentUserId }: Connect4GameProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [gameState, setGameState] = useState<Connect4GameState>(() => {
    if (match.gameState && (match.gameState as any).board) {
      return match.gameState as Connect4GameState;
    }
    // Default initial state
    return {
      board: Array(6).fill(null).map(() => Array(7).fill("empty")),
      currentTurn: "player1",
      moveHistory: [],
      lastMove: null,
      winner: null,
      isGameOver: false,
    };
  });
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const isPlayer1 = match.player1Id === currentUserId;
  const isMyTurn = match.isPractice || (gameState.currentTurn === "player1" && isPlayer1) || (gameState.currentTurn === "player2" && !isPlayer1);

  // Update game state when match data changes (for reconnect support)
  useEffect(() => {
    if (match.gameState && (match.gameState as any).board) {
      setGameState(match.gameState as Connect4GameState);
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
            if (data.move && data.move.gameState) {
              setGameState(data.move.gameState);
            }
          }
        } catch (error) {
          console.error("Bot move error:", error);
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [match.isBotMatch, match.isPractice, match.status, match.id, gameState.currentTurn, gameState.isGameOver, isPlayer1]);

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
        
        if (data.type === "connect4-move" && data.matchId === match.id) {
          setGameState(data.gameState);
        } else if (data.type === "error") {
          toast({
            title: "Error",
            description: data.message,
            variant: "destructive",
          });
        } else if (data.type === "player-disconnected" && data.matchId === match.id) {
          // Notify that opponent disconnected
          if (data.userId !== currentUserId) {
            toast({
              title: "Opponent Disconnected",
              description: `Waiting for reconnection (${Math.floor(data.gracePeriodMs / 1000)}s grace period)...`,
              variant: "default",
            });
          }
        } else if (data.type === "player-reconnected" && data.matchId === match.id) {
          // Notify that opponent reconnected
          if (data.userId !== currentUserId) {
            toast({
              title: "Opponent Reconnected",
              description: "The match continues!",
            });
          }
        } else if (data.type === "match-forfeit" && data.matchId === match.id) {
          // Handle forfeit notification
          const isWinner = data.winnerId === currentUserId;
          const isForfeitedPlayer = data.forfeitedById === currentUserId;
          
          if (isWinner) {
            toast({
              title: "You Win!",
              description: "Your opponent forfeited the match",
              variant: "default",
            });
          } else if (isForfeitedPlayer) {
            toast({
              title: "Match Forfeited",
              description: "You have forfeited the match",
              variant: "destructive",
            });
          }
          
          // Redirect to lobby after a delay
          setTimeout(() => {
            window.location.href = "/lobby";
          }, 3000);
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

  const dropDisc = async (col: number) => {
    // In practice mode, allow any move. Otherwise check turn.
    if (!match.isPractice && !isMyTurn) return;
    if (match.status !== "in-progress" || gameState.isGameOver) return;

    // For practice mode, manually manage board and use engine for win detection
    if (match.isPractice) {
      const { findLowestEmptyRow, checkWinner } = await import("@shared/connect4Engine");
      
      const row = findLowestEmptyRow(gameState.board, col);
      if (row === -1) return; // Column is full
      
      // Create new board with the move (use currentTurn's color)
      const newBoard = gameState.board.map(r => [...r]);
      newBoard[row][col] = gameState.currentTurn;
      
      // Check for winner using engine
      const winner = checkWinner(newBoard);
      const isGameOver = winner !== null;
      
      // Create move record
      const move = {
        column: col,
        row,
        player: gameState.currentTurn,
      };
      
      // Update state (keep same turn in practice mode for consecutive moves)
      const newGameState = {
        board: newBoard,
        currentTurn: gameState.currentTurn, // Don't alternate in practice
        moveHistory: [...gameState.moveHistory, move],
        lastMove: move,
        winner,
        isGameOver,
      };
      
      setGameState(newGameState);
      
      // Show win/draw notification
      if (isGameOver) {
        toast({
          title: winner === "draw" ? "Draw!" : `${winner === "player1" ? "Red" : "Yellow"} Wins!`,
          description: "Practice match ended",
        });
      }
      return;
    }

    // Send move to server for validation
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "connect4-move",
        matchId: match.id,
        column: col,
      }));
    }
  };

  return (
    <GameLayout match={match} currentUserId={currentUserId} accentColor="#f59e0b" accentRgb="245,158,11" controls="Click a column to drop" winCondition="4 in a row wins" showPills={false}>
      <div className="border-b" style={{ background: "rgba(0,0,0,0.35)", borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between px-4 md:px-8 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              data-testid="button-back-connect4"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="text-xl font-bold font-display">Connect 4</h2>
              <Badge variant={match.status === "in-progress" ? "default" : "secondary"}>
                {match.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Player 1 — Red */}
          <div
            className="p-4 rounded-xl border transition-all duration-300"
            style={{
              background: "rgba(220,38,38,0.08)",
              borderColor: gameState.currentTurn === "player1" && !gameState.isGameOver ? "rgba(220,38,38,0.5)" : "rgba(255,255,255,0.08)",
              boxShadow: gameState.currentTurn === "player1" && !gameState.isGameOver ? "0 0 22px rgba(220,38,38,0.22)" : "none",
            }}
          >
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={match.player1?.profileImageUrl || undefined} style={{ objectFit: 'cover' }} />
                <AvatarFallback style={{ background: "rgba(220,38,38,0.3)", color: "#fca5a5" }}>{match.player1?.firstName?.[0] || "P1"}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-semibold text-white/90">{match.player1?.firstName || "Player 1"}</div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: "#ef4444", boxShadow: "0 0 6px rgba(239,68,68,0.6)" }} />
                  <span className="text-sm text-white/40">Red</span>
                </div>
              </div>
              {gameState.currentTurn === "player1" && !gameState.isGameOver && (
                <Badge variant="outline" style={{ borderColor: "rgba(239,68,68,0.5)", color: "#fca5a5" }}>
                  <Clock className="w-3 h-3 mr-1" />
                  Turn
                </Badge>
              )}
            </div>
          </div>

          {/* Player 2 — Yellow */}
          <div
            className="p-4 rounded-xl border transition-all duration-300"
            style={{
              background: "rgba(234,179,8,0.07)",
              borderColor: gameState.currentTurn === "player2" && !gameState.isGameOver ? "rgba(234,179,8,0.5)" : "rgba(255,255,255,0.08)",
              boxShadow: gameState.currentTurn === "player2" && !gameState.isGameOver ? "0 0 22px rgba(234,179,8,0.2)" : "none",
            }}
          >
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={match.player2?.profileImageUrl || undefined} style={{ objectFit: 'cover' }} />
                <AvatarFallback style={{ background: "rgba(234,179,8,0.2)", color: "#fde68a" }}>{match.isBotMatch ? "B" : (match.player2?.firstName?.[0] || "P2")}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-semibold text-white/90">{getBotOpponentName(match)}</div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: "#eab308", boxShadow: "0 0 6px rgba(234,179,8,0.6)" }} />
                  <span className="text-sm text-white/40">Yellow</span>
                </div>
              </div>
              {gameState.currentTurn === "player2" && !gameState.isGameOver && (
                <Badge variant="outline" style={{ borderColor: "rgba(234,179,8,0.5)", color: "#fde68a" }}>
                  <Clock className="w-3 h-3 mr-1" />
                  Turn
                </Badge>
              )}
            </div>
          </div>
        </div>

        {gameState.isGameOver && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div
              className="p-4 rounded-xl border text-center"
              style={{ background: "rgba(255,215,0,0.07)", borderColor: "rgba(251,191,36,0.35)" }}
            >
              <div className="text-lg font-bold text-white/90">
                {gameState.winner === "draw"
                  ? "Game Drawn!"
                  : `${gameState.winner === "player1" ? (match.player1?.firstName || "Red") : getBotOpponentName(match)} Wins!`}
              </div>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl mx-auto"
        >
          <div
            className="p-4 md:p-6 rounded-2xl border"
            style={{ background: "rgba(0,0,0,0.35)", borderColor: "rgba(255,255,255,0.08)" }}
          >
            {/* Drop indicator row — shows ghost disc in hovered column */}
            <div className="grid grid-cols-7 gap-2 mb-1 px-2" data-testid="connect4-drop-indicators">
              {Array.from({ length: 7 }).map((_, colIndex) => {
                const canDrop = isMyTurn && match.status === "in-progress" && !gameState.isGameOver;
                const isHovered = hoveredCol === colIndex && canDrop;
                return (
                  <div
                    key={`indicator-${colIndex}`}
                    className="aspect-square rounded-full transition-all duration-150"
                    style={{
                      background: isHovered
                        ? gameState.currentTurn === "player1"
                          ? "rgba(239,68,68,0.55)"
                          : "rgba(234,179,8,0.55)"
                        : "transparent",
                      boxShadow: isHovered
                        ? gameState.currentTurn === "player1"
                          ? "0 0 10px rgba(239,68,68,0.4)"
                          : "0 0 10px rgba(234,179,8,0.4)"
                        : "none",
                    }}
                  />
                );
              })}
            </div>

            {/* Board */}
            <div
              className="p-2 md:p-3 rounded-xl relative"
              style={{ background: "linear-gradient(180deg, hsl(222 50% 12%), hsl(222 50% 8%))", boxShadow: "inset 0 4px 20px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.3)" }}
              data-testid="connect4-board"
            >
              <div className="grid grid-cols-7 gap-1.5 md:gap-2">
                {gameState.board.map((row, rowIndex) =>
                  row.map((cell, colIndex) => {
                    const canDrop = isMyTurn && match.status === "in-progress" && !gameState.isGameOver;
                    const isLastMove = gameState.lastMove?.column === colIndex && gameState.lastMove?.row === rowIndex;
                    const isWinningPiece = gameState.isGameOver && cell !== "empty" && cell === gameState.winner;
                    
                    const discStyle = cell === "player1"
                      ? {
                          background: "radial-gradient(circle at 35% 35%, #f87171, #dc2626, #991b1b)",
                          boxShadow: isLastMove
                            ? "0 0 16px rgba(239,68,68,0.9), 0 0 4px rgba(239,68,68,0.5), inset 0 -3px 6px rgba(0,0,0,0.35)"
                            : isWinningPiece
                            ? "0 0 12px rgba(239,68,68,0.6), inset 0 -3px 6px rgba(0,0,0,0.3)"
                            : "inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -3px 6px rgba(0,0,0,0.35)",
                        }
                      : cell === "player2"
                      ? {
                          background: "radial-gradient(circle at 35% 35%, #fde047, #facc15, #a16207)",
                          boxShadow: isLastMove
                            ? "0 0 16px rgba(234,179,8,0.9), 0 0 4px rgba(234,179,8,0.5), inset 0 -3px 6px rgba(0,0,0,0.35)"
                            : isWinningPiece
                            ? "0 0 12px rgba(234,179,8,0.6), inset 0 -3px 6px rgba(0,0,0,0.3)"
                            : "inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -3px 6px rgba(0,0,0,0.35)",
                        }
                      : {
                          background: "radial-gradient(circle at 35% 30%, hsl(222 55% 18%), hsl(222 55% 8%))",
                          boxShadow: "inset 0 3px 8px rgba(0,0,0,0.7), inset 0 -1px 2px rgba(255,255,255,0.03)",
                        };

                    return (
                      <motion.button
                        key={`${rowIndex}-${colIndex}`}
                        onClick={() => dropDisc(colIndex)}
                        onMouseEnter={() => setHoveredCol(colIndex)}
                        onMouseLeave={() => setHoveredCol(null)}
                        disabled={!canDrop}
                        className={`aspect-square rounded-full ${canDrop ? "cursor-pointer" : "cursor-default"}`}
                        style={discStyle}
                        initial={isLastMove && cell !== "empty" ? { scale: 0.3, opacity: 0 } : false}
                        animate={isLastMove && cell !== "empty" ? { scale: 1, opacity: 1 } : undefined}
                        transition={isLastMove ? { type: "spring", stiffness: 400, damping: 15 } : undefined}
                        data-testid={`cell-${rowIndex}-${colIndex}`}
                      />
                    );
                  })
                )}
              </div>
            </div>

            {match.status === "waiting" && (
              <div className="mt-4 text-center">
                <p className="text-white/40">Waiting for opponent to join...</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </GameLayout>
  );
}
