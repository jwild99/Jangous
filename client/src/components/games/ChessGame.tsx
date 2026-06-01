import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { MatchWithPlayers } from "@shared/schema";
import { getBotOpponentName } from "@/lib/botMatchUtils";
import { ArrowLeft, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

interface ChessGameProps {
  match: MatchWithPlayers;
  currentUserId?: string;
}

type ChessPiece = {
  type: "pawn" | "rook" | "knight" | "bishop" | "queen" | "king";
  color: "white" | "black";
};

type ChessBoard = (ChessPiece | null)[][];

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

function initializeBoard(): ChessBoard {
  const board: ChessBoard = Array(8).fill(null).map(() => Array(8).fill(null));
  
  // Black pieces
  board[0] = [
    { type: "rook", color: "black" },
    { type: "knight", color: "black" },
    { type: "bishop", color: "black" },
    { type: "queen", color: "black" },
    { type: "king", color: "black" },
    { type: "bishop", color: "black" },
    { type: "knight", color: "black" },
    { type: "rook", color: "black" },
  ];
  board[1] = Array(8).fill({ type: "pawn", color: "black" });
  
  // White pieces
  board[6] = Array(8).fill({ type: "pawn", color: "white" });
  board[7] = [
    { type: "rook", color: "white" },
    { type: "knight", color: "white" },
    { type: "bishop", color: "white" },
    { type: "queen", color: "white" },
    { type: "king", color: "white" },
    { type: "bishop", color: "white" },
    { type: "knight", color: "white" },
    { type: "rook", color: "white" },
  ];
  
  return board;
}

export default function ChessGame({ match, currentUserId }: ChessGameProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [board, setBoard] = useState<ChessBoard>(() => {
    // Initialize from match gameState if it exists, otherwise create new board
    if (match.gameState && (match.gameState as any).board) {
      return (match.gameState as any).board;
    }
    return initializeBoard();
  });
  const [selectedSquare, setSelectedSquare] = useState<[number, number] | null>(null);
  const [currentTurn, setCurrentTurn] = useState<"white" | "black">(() => {
    // Initialize from match gameState if it exists, otherwise start with white
    if (match.gameState && (match.gameState as any).currentTurn) {
      return (match.gameState as any).currentTurn;
    }
    return "white";
  });
  const wsRef = useRef<WebSocket | null>(null);

  const isPlayer1 = match.player1Id === currentUserId;
  const playerColor = isPlayer1 ? "white" : "black";
  const isMyTurn = match.isPractice || currentTurn === playerColor;

  // Update board and turn when match data changes (polling updates)
  useEffect(() => {
    if (match.gameState && (match.gameState as any).board) {
      setBoard((match.gameState as any).board);
    }
    if (match.gameState && (match.gameState as any).currentTurn) {
      setCurrentTurn((match.gameState as any).currentTurn);
    }
  }, [match.gameState]);

  // Auto-generate bot moves
  useEffect(() => {
    if (match.isPractice || !match.isBotMatch || match.status !== "in-progress") return;
    
    const botColor = isPlayer1 ? "black" : "white";
    const isBotTurn = currentTurn === botColor;
    
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
            if (data.move) {
              setBoard(data.move.board);
              setCurrentTurn(data.move.currentTurn);
            }
          }
        } catch (error) {
          console.error("Bot move error:", error);
        }
      }, 1000); // 1 second delay for realism
      
      return () => clearTimeout(timer);
    }
  }, [match.isBotMatch, match.status, match.id, currentTurn, isPlayer1]);

  useEffect(() => {
    // Skip WebSocket for practice mode
    if (match.isPractice) return;
    
    // WebSocket connection for real-time updates
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "join", matchId: match.id, userId: currentUserId }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === "move" && data.matchId === match.id) {
          // Update board with opponent's move
          setBoard(data.board);
          setCurrentTurn(data.currentTurn);
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
  }, [match.id, match.isPractice]);

  const handleSquareClick = (row: number, col: number) => {
    if (match.status !== "in-progress" || !isMyTurn) return;

    if (selectedSquare) {
      // Try to move piece
      const [fromRow, fromCol] = selectedSquare;
      const piece = board[fromRow][fromCol];
      
      if (piece && piece.color === playerColor) {
        // Simple move (no validation for MVP - would need chess.js for full rules)
        const newBoard = board.map(row => [...row]);
        newBoard[row][col] = piece;
        newBoard[fromRow][fromCol] = null;
        
        setBoard(newBoard);
        setCurrentTurn(currentTurn === "white" ? "black" : "white");
        setSelectedSquare(null);

        // Send move via WebSocket
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: "move",
            matchId: match.id,
            board: newBoard,
            currentTurn: currentTurn === "white" ? "black" : "white",
          }));
        }
      }
    } else {
      // Select piece
      const piece = board[row][col];
      // In practice mode, can select any piece
      if (match.isPractice) {
        if (piece) {
          setSelectedSquare([row, col]);
        }
      } else if (piece && piece.color === playerColor) {
        setSelectedSquare([row, col]);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Game Header */}
      <div className="border-b bg-card">
        <div className="flex items-center justify-between px-4 md:px-8 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              data-testid="button-back-game"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="text-xl font-bold font-display">Chess</h2>
              <Badge variant={match.status === "in-progress" ? "default" : "secondary"}>
                {match.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Players */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Player 1 (White) */}
          <Card className={`p-4 ${currentTurn === "white" ? "ring-2 ring-primary" : ""}`}>
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage 
                  src={match.player1?.profileImageUrl || undefined}
                  style={{ objectFit: 'cover' }}
                />
                <AvatarFallback>
                  {match.player1?.firstName?.[0] || "P1"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-semibold" data-testid="text-player1-name">
                  {match.player1?.firstName || "Player 1"}
                </div>
                <div className="text-sm text-muted-foreground">White</div>
              </div>
              {currentTurn === "white" && (
                <Badge variant="outline">
                  <Clock className="w-3 h-3 mr-1" />
                  Turn
                </Badge>
              )}
            </div>
          </Card>

          {/* Player 2 (Black) */}
          <Card className={`p-4 ${currentTurn === "black" ? "ring-2 ring-primary" : ""}`}>
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage 
                  src={match.player2?.profileImageUrl || undefined}
                  style={{ objectFit: 'cover' }}
                />
                <AvatarFallback>
                  {match.isBotMatch ? "B" : (match.player2?.firstName?.[0] || "P2")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-semibold" data-testid="text-player2-name">
                  {getBotOpponentName(match)}
                </div>
                <div className="text-sm text-muted-foreground">Black</div>
              </div>
              {currentTurn === "black" && (
                <Badge variant="outline">
                  <Clock className="w-3 h-3 mr-1" />
                  Turn
                </Badge>
              )}
            </div>
          </Card>
        </div>

        {/* Chess Board */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl mx-auto"
        >
          <Card className="p-4 md:p-8">
            <div className="aspect-square w-full" data-testid="chess-board">
              <div className="grid grid-cols-8 gap-0 w-full h-full border-2 border-border rounded-md overflow-hidden">
                {board.map((row, rowIndex) =>
                  row.map((piece, colIndex) => {
                    const isLight = (rowIndex + colIndex) % 2 === 0;
                    const isSelected = selectedSquare?.[0] === rowIndex && selectedSquare?.[1] === colIndex;
                    
                    return (
                      <button
                        key={`${rowIndex}-${colIndex}`}
                        onClick={() => handleSquareClick(rowIndex, colIndex)}
                        className={`aspect-square flex items-center justify-center text-4xl md:text-5xl transition-all ${
                          isLight ? "bg-muted" : "bg-card"
                        } ${isSelected ? "ring-2 ring-primary ring-inset" : ""} ${
                          isMyTurn && match.status === "in-progress" ? "hover-elevate cursor-pointer" : "cursor-default"
                        }`}
                        disabled={!isMyTurn || match.status !== "in-progress"}
                        data-testid={`square-${rowIndex}-${colIndex}`}
                      >
                        {piece && pieceSymbols[`${piece.color}-${piece.type}`]}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {match.status === "waiting" && (
              <div className="mt-4 text-center">
                <p className="text-muted-foreground">Waiting for opponent to join...</p>
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
