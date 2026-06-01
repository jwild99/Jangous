import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { MatchWithPlayers } from "@shared/schema";
import { GameLayout } from "@/components/games/GameLayout";
import { getBotOpponentName } from "@/lib/botMatchUtils";
import { 
  ArrowLeft, 
  Clock, 
  Flag, 
  Trophy, 
  AlertCircle,
  Download 
} from "lucide-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  type GameState,
  type Position,
  type PieceColor,
  type PieceType,
  getLegalMoves,
  positionToAlgebraic,
  generatePGN,
  initializeGameState
} from "@shared/chessEngine";
import { useToast } from "@/hooks/use-toast";

interface ChessGameProps {
  match: MatchWithPlayers;
  currentUserId?: string;
}

const pieceSymbols: Record<string, string> = {
  "white-king": "♔",
  "white-queen": "♕",
  "white-rook": "♖",
  "white-bishop": "♗",
  "white-knight": "♘",
  "white-pawn": "♙",
  "black-king": "♚",
  "black-queen": "♛",
  "black-rook": "♜",
  "black-bishop": "♝",
  "black-knight": "♞",
  "black-pawn": "♟",
};

// File/rank labels
const FILES = ["a","b","c","d","e","f","g","h"];
const RANKS = ["8","7","6","5","4","3","2","1"];

export default function ProductionChessGame({ match, currentUserId }: ChessGameProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const lastMoveTimeRef = useRef<number>(Date.now());

  const [gameState, setGameState] = useState<GameState>(() => {
    if (match.gameState && (match.gameState as any).board) {
      return match.gameState as GameState;
    }
    const state = initializeGameState();
    // Initialize chess clocks if time control is set
    if (match.timeControl && match.timeControl > 0) {
      state.player1TimeRemaining = match.timeControl * 1000;
      state.player2TimeRemaining = match.timeControl * 1000;
    }
    return state;
  });

  const [selectedSquare, setSelectedSquare] = useState<Position | null>(null);
  const [legalMoves, setLegalMoves] = useState<Position[]>([]);
  const [promotionDialog, setPromotionDialog] = useState<{
    from: Position;
    to: Position;
  } | null>(null);
  const [player1Time, setPlayer1Time] = useState(
    match.player1TimeRemaining ?? (match.timeControl && match.timeControl > 0 ? match.timeControl * 1000 : null)
  );
  const [player2Time, setPlayer2Time] = useState(
    match.player2TimeRemaining ?? (match.timeControl && match.timeControl > 0 ? match.timeControl * 1000 : null)
  );

  const isPlayer1 = match.player1Id === currentUserId;
  const playerColor: PieceColor = isPlayer1 ? "white" : "black";
  const isMyTurn = match.isPractice || gameState.currentTurn === playerColor;

  // Chess clock timer
  useEffect(() => {
    if (!match.timeControl || match.status !== "in-progress" || match.isPractice) return;
    if (gameState.isCheckmate || gameState.isStalemate || gameState.isDraw) return;

    const interval = setInterval(() => {
      if (gameState.currentTurn === "white" && player1Time !== null) {
        setPlayer1Time(prev => Math.max(0, (prev || 0) - 100));
      } else if (gameState.currentTurn === "black" && player2Time !== null) {
        setPlayer2Time(prev => Math.max(0, (prev || 0) - 100));
      }
    }, 100);

    return () => clearInterval(interval);
  }, [gameState.currentTurn, match.timeControl, match.status, match.isPractice, gameState.isCheckmate, gameState.isStalemate, gameState.isDraw, player1Time, player2Time]);

  // Server-side timeout check (polls server periodically to catch timeouts even without moves)
  useEffect(() => {
    if (!match.timeControl || match.status !== "in-progress" || match.isPractice) return;
    if (gameState.isCheckmate || gameState.isStalemate || gameState.isDraw) return;

    const checkTimeout = async () => {
      try {
        const response = await fetch(`/api/matches/${match.id}/check-timeout`, {
          method: "POST",
          credentials: "include",
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.timeout) {
            toast({
              title: "Time's Up!",
              description: `${data.winner === "white" ? "Black" : "White"} ran out of time`,
              variant: "destructive",
            });
            // Reload match data to get updated state
            window.location.reload();
          }
        }
      } catch (error) {
        console.error("Timeout check error:", error);
      }
    };

    // Check every 2 seconds
    const interval = setInterval(checkTimeout, 2000);
    return () => clearInterval(interval);
  }, [match.id, match.timeControl, match.status, match.isPractice, gameState.isCheckmate, gameState.isStalemate, gameState.isDraw, toast]);

  // WebSocket connection
  useEffect(() => {
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
        
        if (data.type === "chess-move" && data.matchId === match.id) {
          setGameState(data.gameState);
          
          // Update times from server gameState (server is source of truth)
          if (data.gameState.player1TimeRemaining !== undefined) {
            setPlayer1Time(data.gameState.player1TimeRemaining);
          }
          if (data.gameState.player2TimeRemaining !== undefined) {
            setPlayer2Time(data.gameState.player2TimeRemaining);
          }
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

  const sendMove = useCallback((from: Position, to: Position, promotionPiece?: PieceType) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "chess-move",
        matchId: match.id,
        from,
        to,
        promotionPiece,
      }));
    }
  }, [match.id]);

  const handleSquareClick = (row: number, col: number) => {
    if (!isMyTurn || gameState.isCheckmate || gameState.isStalemate || gameState.isDraw) {
      return;
    }

    const clickedPos: Position = { row, col };
    const piece = gameState.board[row][col];

    // If a square is already selected
    if (selectedSquare) {
      // Check if clicked square is a legal move
      const isLegal = legalMoves.some(pos => pos.row === row && pos.col === col);
      
      if (isLegal) {
        const fromPiece = gameState.board[selectedSquare.row][selectedSquare.col];
        
        // Check for pawn promotion
        if (fromPiece?.type === "pawn" && (row === 0 || row === 7)) {
          setPromotionDialog({ from: selectedSquare, to: clickedPos });
        } else {
          sendMove(selectedSquare, clickedPos);
        }
        
        setSelectedSquare(null);
        setLegalMoves([]);
      } else if (piece && piece.color === playerColor) {
        // Select different piece
        setSelectedSquare(clickedPos);
        setLegalMoves(getLegalMoves(gameState, clickedPos));
      } else {
        // Deselect
        setSelectedSquare(null);
        setLegalMoves([]);
      }
    } else if (piece && piece.color === playerColor) {
      // Select piece
      setSelectedSquare(clickedPos);
      setLegalMoves(getLegalMoves(gameState, clickedPos));
    }
  };

  const handlePromotion = (pieceType: PieceType) => {
    if (promotionDialog) {
      sendMove(promotionDialog.from, promotionDialog.to, pieceType);
      setPromotionDialog(null);
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  };

  const handleForfeit = async () => {
    try {
      const response = await fetch(`/api/matches/${match.id}/forfeit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      
      if (response.ok) {
        toast({
          title: "Match Forfeited",
          description: "You have forfeited the match",
        });
        setLocation("/");
      } else {
        throw new Error("Failed to forfeit");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to forfeit match",
        variant: "destructive",
      });
    }
  };

  const downloadPGN = () => {
    const player1Name = match.player1?.firstName || match.player1?.email?.split('@')[0] || "Player 1";
    const player2Name = match.player2?.firstName || match.player2?.email?.split('@')[0] || "Player 2";
    const pgn = generatePGN(gameState, player1Name, player2Name);
    
    const blob = new Blob([pgn], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chess-match-${match.id.substring(0, 8)}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (milliseconds: number | null) => {
    if (milliseconds === null) return "";
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <GameLayout match={match} currentUserId={currentUserId} accentColor="#a78bfa" accentRgb="167,139,250" controls="Click pieces to move" winCondition="Checkmate to win" helpItems={[{ label: "Move", value: "Click a piece then a square" }, { label: "Win", value: "Checkmate the king" }, { label: "Promote", value: "Reach the opposite back rank" }]}>
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Back to Lobby</span>
            <span className="sm:hidden">Back</span>
          </Button>
          
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center">
            <Badge variant="secondary">Chess</Badge>
            {gameState.isCheck && !gameState.isCheckmate && (
              <Badge variant="destructive">Check!</Badge>
            )}
            {gameState.isCheckmate && (
              <Badge variant="default">Checkmate</Badge>
            )}
            {gameState.isStalemate && (
              <Badge variant="secondary">Stalemate</Badge>
            )}
            {gameState.isDraw && !gameState.isStalemate && (
              <Badge variant="secondary">Draw</Badge>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadPGN}
              data-testid="button-download-pgn"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">PGN</span>
            </Button>
            {!gameState.isCheckmate && !gameState.isStalemate && !gameState.isDraw && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleForfeit}
                data-testid="button-forfeit"
              >
                <Flag className="w-4 h-4" />
                <span className="hidden sm:inline ml-2">Forfeit</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Game Board */}
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-center">
          {/* Player 2 (Black) */}
          <div
            className="p-4 rounded-xl border transition-all duration-300"
            style={{
              background: "rgba(30,30,40,0.6)",
              borderColor: gameState.currentTurn === "black" ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.08)",
              boxShadow: gameState.currentTurn === "black" ? "0 0 20px rgba(99,102,241,0.22)" : "none",
            }}
          >
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={match.player2?.profileImageUrl || undefined} />
                <AvatarFallback style={{ background: "rgba(30,30,50,0.8)", color: "#a5b4fc" }}>
                  {match.isBotMatch ? "B" : (match.player2?.firstName?.[0] || "P2")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-semibold text-white/90" data-testid="text-player2-name">
                  {getBotOpponentName(match)}
                </div>
                <div className="text-sm text-white/40">Black</div>
              </div>
              {player2Time !== null && (
                <div
                  className="font-mono text-xl font-bold"
                  style={{ color: gameState.currentTurn === "black" ? "#a5b4fc" : "rgba(255,255,255,0.5)" }}
                  data-testid="text-player2-time"
                >
                  <Clock className="w-4 h-4 inline mr-1" />
                  {formatTime(player2Time)}
                </div>
              )}
            </div>
          </div>

          {/* Chess Board */}
          <div className="flex flex-col items-center gap-1">
            {/* Board with wood frame */}
            <div
              className="rounded-lg p-3 sm:p-4"
              style={{
                background: "linear-gradient(135deg, #5c3d1e 0%, #3d2510 40%, #5c3d1e 70%, #3d2510 100%)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,200,80,0.15)",
              }}
            >
              {/* File labels (top) */}
              <div className="flex pl-4 mb-0.5">
                {FILES.map(f => (
                  <div key={f} className="flex-1 text-center text-xs font-bold text-amber-300/70 select-none">{f}</div>
                ))}
              </div>

              {/* Board rows */}
              <div className="flex">
                {/* Rank labels (left) */}
                <div className="flex flex-col mr-0.5">
                  {RANKS.map(r => (
                    <div key={r} className="flex-1 flex items-center justify-center w-4 text-xs font-bold text-amber-300/70 select-none">{r}</div>
                  ))}
                </div>

                {/* Squares */}
                <div
                  className="grid grid-cols-8"
                  style={{
                    borderRadius: "4px",
                    overflow: "hidden",
                    boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.4)",
                  }}
                >
                  {gameState.board.map((row, rowIndex) =>
                    row.map((piece, colIndex) => {
                      const isLight = (rowIndex + colIndex) % 2 === 0;
                      const isSelected = selectedSquare?.row === rowIndex && selectedSquare?.col === colIndex;
                      const isLegalMove = legalMoves.some(pos => pos.row === rowIndex && pos.col === colIndex);
                      const lastMove = gameState.moveHistory[gameState.moveHistory.length - 1];
                      const isLastMoveFrom = lastMove?.from.row === rowIndex && lastMove?.from.col === colIndex;
                      const isLastMoveTo = lastMove?.to.row === rowIndex && lastMove?.to.col === colIndex;

                      // Check if this is the king in check
                      const isKingInCheck = gameState.isCheck && piece?.type === "king" && piece?.color === gameState.currentTurn;

                      // Base square color
                      let squareBg = isLight ? "#f0d9b5" : "#b58863";
                      if (isLastMoveFrom || isLastMoveTo) {
                        squareBg = isLight ? "#f6f669" : "#baca2b";
                      }
                      if (isSelected) {
                        squareBg = isLight ? "#a9d16e" : "#6aaa23";
                      }
                      if (isKingInCheck) {
                        squareBg = "#ff4444";
                      }

                      return (
                        <motion.button
                          key={`${rowIndex}-${colIndex}`}
                          onClick={() => handleSquareClick(rowIndex, colIndex)}
                          className="relative flex items-center justify-center"
                          style={{
                            width: "clamp(36px, 8vw, 72px)",
                            height: "clamp(36px, 8vw, 72px)",
                            backgroundColor: squareBg,
                            cursor: isMyTurn && !gameState.isCheckmate && !gameState.isStalemate ? "pointer" : "default",
                            transition: "background-color 0.15s ease",
                            boxShadow: isKingInCheck ? "inset 0 0 20px rgba(255,0,0,0.6)" : undefined,
                          }}
                          data-testid={`square-${positionToAlgebraic({ row: rowIndex, col: colIndex })}`}
                          whileHover={isMyTurn && !gameState.isCheckmate ? { filter: "brightness(1.12)" } : {}}
                          whileTap={isMyTurn ? { scale: 0.94 } : {}}
                        >
                          {/* Piece */}
                          {piece && (
                            <motion.span
                              key={`${piece.color}-${piece.type}-${rowIndex}-${colIndex}`}
                              initial={{ scale: 0.85, opacity: 0.7 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ duration: 0.15 }}
                              style={{
                                fontSize: "clamp(20px, 4.5vw, 44px)",
                                lineHeight: 1,
                                userSelect: "none",
                                filter: piece.color === "white"
                                  ? "drop-shadow(0 1px 3px rgba(0,0,0,0.8)) drop-shadow(0 0 6px rgba(255,255,255,0.3))"
                                  : "drop-shadow(0 2px 4px rgba(0,0,0,0.9)) drop-shadow(0 0 2px rgba(0,0,0,0.5))",
                                color: piece.color === "white" ? "#ffffff" : "#1a1a1a",
                                WebkitTextStroke: piece.color === "white" ? "0.5px #888" : "0.5px transparent",
                              }}
                            >
                              {pieceSymbols[`${piece.color}-${piece.type}`]}
                            </motion.span>
                          )}

                          {/* Legal move indicator */}
                          {isLegalMove && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              {piece ? (
                                <div
                                  className="absolute inset-0 rounded-none"
                                  style={{
                                    boxShadow: "inset 0 0 0 4px rgba(0,200,80,0.8)",
                                    background: "rgba(0,180,80,0.15)",
                                  }}
                                />
                              ) : (
                                <div
                                  className="rounded-full"
                                  style={{
                                    width: "32%",
                                    height: "32%",
                                    background: "rgba(0,0,0,0.2)",
                                  }}
                                />
                              )}
                            </div>
                          )}

                          {/* Selected square glow */}
                          {isSelected && (
                            <div
                              className="absolute inset-0 pointer-events-none"
                              style={{
                                boxShadow: "inset 0 0 12px rgba(80,220,80,0.5)",
                              }}
                            />
                          )}
                        </motion.button>
                      );
                    })
                  )}
                </div>

                {/* Rank labels (right) */}
                <div className="flex flex-col ml-0.5">
                  {RANKS.map(r => (
                    <div key={r} className="flex-1 flex items-center justify-center w-4 text-xs font-bold text-amber-300/70 select-none">{r}</div>
                  ))}
                </div>
              </div>

              {/* File labels (bottom) */}
              <div className="flex pl-4 mt-0.5">
                {FILES.map(f => (
                  <div key={f} className="flex-1 text-center text-xs font-bold text-amber-300/70 select-none">{f}</div>
                ))}
              </div>
            </div>

            {/* Game Status */}
            {(gameState.isCheckmate || gameState.isStalemate || gameState.isDraw) && (
              <Alert className="mt-2 max-w-sm">
                <Trophy className="h-4 w-4" />
                <AlertDescription>
                  {gameState.isCheckmate && `Checkmate! ${gameState.winner === "white" ? "White" : "Black"} wins!`}
                  {gameState.isStalemate && "Stalemate! Game is a draw."}
                  {gameState.isDraw && !gameState.isStalemate && "Draw by repetition or 50-move rule."}
                </AlertDescription>
              </Alert>
            )}

            {gameState.isCheck && !gameState.isCheckmate && (
              <div
                className="mt-2 px-4 py-2 rounded-lg text-sm font-bold text-center"
                style={{ background: "rgba(220,40,40,0.85)", color: "#fff", boxShadow: "0 0 16px rgba(255,0,0,0.5)" }}
              >
                CHECK!
              </div>
            )}

            {isMyTurn && !gameState.isCheck && !gameState.isCheckmate && !gameState.isStalemate && !gameState.isDraw && (
              <div className="mt-2 text-sm text-muted-foreground text-center">Your turn — click a piece to move</div>
            )}
          </div>

          {/* Player 1 (White) */}
          <div
            className="p-4 rounded-xl border transition-all duration-300"
            style={{
              background: "rgba(240,217,181,0.06)",
              borderColor: gameState.currentTurn === "white" ? "rgba(251,191,36,0.5)" : "rgba(255,255,255,0.08)",
              boxShadow: gameState.currentTurn === "white" ? "0 0 20px rgba(251,191,36,0.2)" : "none",
            }}
          >
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={match.player1?.profileImageUrl || undefined} />
                <AvatarFallback style={{ background: "rgba(240,217,181,0.15)", color: "#fde68a" }}>
                  {match.player1?.firstName?.[0] || "P1"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-semibold text-white/90" data-testid="text-player1-name">
                  {match.player1?.firstName || match.player1?.email?.split('@')[0] || "Player 1"}
                </div>
                <div className="text-sm text-white/40">White</div>
              </div>
              {player1Time !== null && (
                <div
                  className="font-mono text-xl font-bold"
                  style={{ color: gameState.currentTurn === "white" ? "#fde68a" : "rgba(255,255,255,0.5)" }}
                  data-testid="text-player1-time"
                >
                  <Clock className="w-4 h-4 inline mr-1" />
                  {formatTime(player1Time)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Move History */}
        <div
          className="mt-4 p-4 rounded-xl border"
          style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)" }}
        >
          <h3 className="font-semibold mb-2 text-white/70 text-sm uppercase tracking-wide">Move History</h3>
          <div className="text-sm font-mono max-h-32 overflow-y-auto">
            {gameState.moveHistory.length === 0 ? (
              <p className="text-white/30">No moves yet</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {gameState.moveHistory.map((move, index) => {
                  if (index % 2 === 0) {
                    const moveNumber = Math.floor(index / 2) + 1;
                    const whiteMove = move.notation;
                    const blackMove = gameState.moveHistory[index + 1]?.notation;
                    return (
                      <div key={index} className="flex gap-2">
                        <span className="text-muted-foreground w-8">{moveNumber}.</span>
                        <span className="w-20">{whiteMove}</span>
                        {blackMove && <span className="w-20">{blackMove}</span>}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Promotion Dialog */}
      <Dialog open={!!promotionDialog} onOpenChange={() => setPromotionDialog(null)}>
        <DialogContent data-testid="dialog-promotion">
          <DialogHeader>
            <DialogTitle>Promote Pawn</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-4">
            {(["queen", "rook", "bishop", "knight"] as PieceType[]).map((pieceType) => (
              <Button
                key={pieceType}
                onClick={() => handlePromotion(pieceType)}
                variant="outline"
                className="h-24 text-6xl"
                data-testid={`button-promote-${pieceType}`}
              >
                {pieceSymbols[`${playerColor}-${pieceType}`]}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </GameLayout>
  );
}
