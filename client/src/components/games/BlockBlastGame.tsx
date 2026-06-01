import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  BlockBlastGameState,
  PlayerBoard,
  TETROMINO_SHAPES,
  TETROMINO_COLORS,
  BOARD_WIDTH,
  BOARD_HEIGHT,
  spawnPiece,
  movePiece,
  rotatePiece,
  hardDrop,
  holdPiece,
  clearLines,
  addGarbageRows,
  isGameOver,
  initializeGameState,
} from "@shared/blockBlastEngine";
import type { MatchWithPlayers } from "@shared/schema";
import { GameLayout } from "@/components/games/GameLayout";
import { getBotOpponentName } from "@/lib/botMatchUtils";
import {
  ArrowLeft,
  Grid2x2,
  Timer,
  Trophy,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ArrowDownToLine,
} from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

const CELL_SIZE = 24;
const MINI_CELL_SIZE = 16;
const BOARD_CANVAS_WIDTH = BOARD_WIDTH * CELL_SIZE;
const BOARD_CANVAS_HEIGHT = BOARD_HEIGHT * CELL_SIZE;

type PlayerAction = "left" | "right" | "down" | "rotate" | "hardDrop" | "hold";

interface BlockBlastGameProps {
  match: MatchWithPlayers;
  currentUserId?: string;
}

function isValidBlockBlastState(s: unknown): s is BlockBlastGameState {
  if (!s || typeof s !== "object") return false;
  const obj = s as Record<string, unknown>;
  return (
    typeof obj.player1Board === "object" &&
    obj.player1Board !== null &&
    typeof obj.player2Board === "object" &&
    obj.player2Board !== null &&
    typeof obj.status === "string"
  );
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(x + 2, y + 2, size - 4, 3);
  ctx.fillRect(x + 2, y + 2, 3, size - 4);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(x + size - 4, y + 2, 3, size - 4);
  ctx.fillRect(x + 2, y + size - 4, size - 4, 3);
}

function drawBoard(ctx: CanvasRenderingContext2D, board: PlayerBoard) {
  const W = BOARD_CANVAS_WIDTH;
  const H = BOARD_CANVAS_HEIGHT;

  ctx.fillStyle = "#0a0a14";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let r = 0; r < BOARD_HEIGHT; r++) {
    for (let c = 0; c < BOARD_WIDTH; c++) {
      ctx.strokeRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
  }

  for (let r = 0; r < BOARD_HEIGHT; r++) {
    for (let c = 0; c < BOARD_WIDTH; c++) {
      const cell = board.grid[r][c];
      if (cell !== "empty") {
        const color =
          cell === "player1" ? "#4f8ef7" : cell === "player2" ? "#f74f8e" : "#666";
        drawCell(ctx, c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, color);
      }
    }
  }

  const piece = board.currentPiece;
  if (!piece) return;

  const shape = TETROMINO_SHAPES[piece.type][piece.rotation];

  // Ghost piece
  let ghostY = piece.position.y;
  outer: while (true) {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (shape[r][c] === 1) {
          const nr = ghostY + r + 1;
          const nc = piece.position.x + c;
          if (nc < 0 || nc >= BOARD_WIDTH || nr >= BOARD_HEIGHT) break outer;
          if (nr >= 0 && board.grid[nr][nc] !== "empty") break outer;
        }
      }
    }
    ghostY++;
  }

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (shape[r][c] === 1) {
        const gr = ghostY + r;
        const gc = piece.position.x + c;
        if (gr >= 0 && gr < BOARD_HEIGHT && gc >= 0 && gc < BOARD_WIDTH) {
          ctx.fillStyle = "rgba(255,255,255,0.12)";
          ctx.fillRect(gc * CELL_SIZE + 1, gr * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
          ctx.strokeStyle = "rgba(255,255,255,0.25)";
          ctx.lineWidth = 1;
          ctx.strokeRect(gc * CELL_SIZE + 0.5, gr * CELL_SIZE + 0.5, CELL_SIZE - 1, CELL_SIZE - 1);
        }
      }
    }
  }

  // Active piece
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (shape[r][c] === 1) {
        const pr = piece.position.y + r;
        const pc = piece.position.x + c;
        if (pr >= 0 && pr < BOARD_HEIGHT && pc >= 0 && pc < BOARD_WIDTH) {
          drawCell(ctx, pc * CELL_SIZE, pr * CELL_SIZE, CELL_SIZE, piece.color);
        }
      }
    }
  }
}

function drawMiniPiece(ctx: CanvasRenderingContext2D, type: string | null) {
  if (!type) return;
  const t = type as keyof typeof TETROMINO_SHAPES;
  const shape = TETROMINO_SHAPES[t][0];
  const color = TETROMINO_COLORS[t];

  let minC = 4, maxC = 0, minR = 4, maxR = 0;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (shape[r][c] === 1) {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
  }
  const rows = maxR - minR + 1;
  const cols = maxC - minC + 1;
  const offX = Math.floor((4 - cols) / 2) - minC;
  const offY = Math.floor((4 - rows) / 2) - minR;

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (shape[r][c] === 1) {
        drawCell(
          ctx,
          (c + offX) * MINI_CELL_SIZE,
          (r + offY) * MINI_CELL_SIZE,
          MINI_CELL_SIZE,
          color
        );
      }
    }
  }
}

/** Apply a single action locally to a player board (for bot/practice local simulation) */
function applyActionToBoard(
  board: PlayerBoard,
  action: PlayerAction,
  playerType: "player1" | "player2"
): { board: PlayerBoard; linesCleared: number } {
  let b = { ...board };

  if (!b.currentPiece) {
    b = spawnPiece(b, playerType);
  }

  if (action === "rotate") {
    b = rotatePiece(b);
    return { board: b, linesCleared: 0 };
  }

  if (action === "hold") {
    b = holdPiece(b);
    if (!b.currentPiece) b = spawnPiece(b, playerType);
    return { board: b, linesCleared: 0 };
  }

  if (action === "hardDrop") {
    b = hardDrop(b, playerType);
  } else {
    b = movePiece(b, action, playerType);
    if (b.currentPiece !== null) return { board: b, linesCleared: 0 };
  }

  if (b.currentPiece === null) {
    const { board: cb, linesCleared } = clearLines(b);
    b = cb;
    if (b.garbageRows > 0) {
      b = addGarbageRows(b, b.garbageRows);
      b = { ...b, garbageRows: 0 };
    }
    b = spawnPiece(b, playerType);
    return { board: b, linesCleared };
  }

  return { board: b, linesCleared: 0 };
}

function generateBotAction(board: PlayerBoard, difficulty: string): PlayerAction {
  if (!board.currentPiece) return "down";

  const r = Math.random();

  if (difficulty === "easy") {
    if (r < 0.15) return "rotate";
    if (r < 0.35) return "left";
    if (r < 0.55) return "right";
    if (r < 0.65) return "hardDrop";
    return "down";
  }

  if (difficulty === "hard") {
    const piece = board.currentPiece;
    let bestScore = -Infinity;
    let bestAction: PlayerAction = "hardDrop";

    for (let rot = 0; rot < 4; rot++) {
      for (let col = -2; col < BOARD_WIDTH; col++) {
        const testPiece = {
          ...piece,
          rotation: rot,
          position: { x: col, y: piece.position.y },
        };
        const testShape = TETROMINO_SHAPES[testPiece.type][testPiece.rotation];
        let valid = true;
        for (let r2 = 0; r2 < 4 && valid; r2++) {
          for (let c2 = 0; c2 < 4 && valid; c2++) {
            if (testShape[r2][c2] === 1 && (testPiece.position.x + c2 < 0 || testPiece.position.x + c2 >= BOARD_WIDTH)) {
              valid = false;
            }
          }
        }
        if (!valid) continue;

        let gy = testPiece.position.y;
        dropLoop: while (true) {
          for (let r2 = 0; r2 < 4; r2++) {
            for (let c2 = 0; c2 < 4; c2++) {
              if (testShape[r2][c2] === 1) {
                const nr = gy + r2 + 1;
                const nc = testPiece.position.x + c2;
                if (nr >= BOARD_HEIGHT || (nr >= 0 && board.grid[nr][nc] !== "empty")) {
                  break dropLoop;
                }
              }
            }
          }
          gy++;
        }

        const tempGrid = board.grid.map(row => [...row]);
        for (let r2 = 0; r2 < 4; r2++) {
          for (let c2 = 0; c2 < 4; c2++) {
            if (testShape[r2][c2] === 1) {
              const gr = gy + r2;
              const gc = testPiece.position.x + c2;
              if (gr >= 0 && gr < BOARD_HEIGHT && gc >= 0 && gc < BOARD_WIDTH) {
                tempGrid[gr][gc] = "player2";
              }
            }
          }
        }

        let lines = 0, holes = 0, height = 0, bumpiness = 0;
        const colHeights = Array(BOARD_WIDTH).fill(0);

        for (let c2 = 0; c2 < BOARD_WIDTH; c2++) {
          for (let r2 = 0; r2 < BOARD_HEIGHT; r2++) {
            if (tempGrid[r2][c2] !== "empty") { colHeights[c2] = BOARD_HEIGHT - r2; break; }
          }
        }
        for (let r2 = 0; r2 < BOARD_HEIGHT; r2++) {
          if (tempGrid[r2].every(c3 => c3 !== "empty")) lines++;
        }
        for (let c2 = 0; c2 < BOARD_WIDTH; c2++) {
          let hasBlock = false;
          for (let r2 = 0; r2 < BOARD_HEIGHT; r2++) {
            if (tempGrid[r2][c2] !== "empty") hasBlock = true;
            else if (hasBlock) holes++;
          }
          height = Math.max(height, colHeights[c2]);
        }
        for (let c2 = 0; c2 < BOARD_WIDTH - 1; c2++) {
          bumpiness += Math.abs(colHeights[c2] - colHeights[c2 + 1]);
        }

        const score = lines * 200 - holes * 150 - height * 30 - bumpiness * 20;
        if (score > bestScore) {
          bestScore = score;
          const rotDiff = (rot - piece.rotation + 4) % 4;
          if (col < piece.position.x) bestAction = "left";
          else if (col > piece.position.x) bestAction = "right";
          else if (rotDiff > 0) bestAction = "rotate";
          else bestAction = "hardDrop";
        }
      }
    }
    return bestAction;
  }

  // medium
  if (r < 0.1) return "rotate";
  if (r < 0.25) return "left";
  if (r < 0.4) return "right";
  if (r < 0.6) return "hardDrop";
  return "down";
}

export default function BlockBlastGame({ match, currentUserId }: BlockBlastGameProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [gameState, setGameState] = useState<BlockBlastGameState>(() => {
    if (isValidBlockBlastState(match.gameState)) return match.gameState;
    return initializeGameState(90, true);
  });

  const myBoardRef = useRef<HTMLCanvasElement>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement>(null);
  const holdCanvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const stateRef = useRef(gameState);
  const dropTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameOverNotifiedRef = useRef(false);

  const isLocalMode = match.isBotMatch || match.isPractice;
  const isPlayer1 = match.player1Id === currentUserId;
  const playerKey = isPlayer1 ? "player1Board" : "player2Board";
  const oppKey = isPlayer1 ? "player2Board" : "player1Board";
  const myBoard = gameState[playerKey];
  const oppBoard = gameState[oppKey];

  const player1Name = match.player1?.username || match.player1?.firstName || "Player 1";
  const player2Name = getBotOpponentName(match);
  const myName = isPlayer1 ? player1Name : player2Name;
  const oppName = isPlayer1 ? player2Name : player1Name;

  const timeRemaining = Math.max(0, Math.ceil(gameState.timeRemaining));
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  // Sync server-pushed state
  useEffect(() => {
    if (isValidBlockBlastState(match.gameState)) {
      setGameState(match.gameState);
    }
  }, [match.gameState]);

  // WebSocket connection for PvP matches
  useEffect(() => {
    if (isLocalMode || !currentUserId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", matchId: match.id, userId: currentUserId }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "gameState" && data.matchId === match.id && isValidBlockBlastState(data.gameState)) {
          stateRef.current = data.gameState;
          setGameState(data.gameState);
        } else if (data.type === "matchComplete" && data.matchId === match.id) {
          if (isValidBlockBlastState(data.gameState)) {
            stateRef.current = data.gameState;
            setGameState(data.gameState);
          }
          toast({
            title: "Match Complete!",
            description: data.winner === currentUserId ? "You won!" : "You lost.",
          });
        }
      } catch {}
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [match.id, isLocalMode, currentUserId, toast]);

  // Send action to server (PvP) or apply locally (bot/practice)
  const dispatchAction = useCallback(
    (action: PlayerAction) => {
      const st = stateRef.current;
      if (st.status !== "playing") return;

      if (!isLocalMode) {
        // PvP: send action to server — server is authoritative
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({ type: "block-blast-action", matchId: match.id, userId: currentUserId, action })
          );
        }
        return;
      }

      // Local simulation for bot/practice matches
      const boardKey = isPlayer1 ? "player1Board" : "player2Board";
      const oppBoardKey = isPlayer1 ? "player2Board" : "player1Board";
      const playerType = isPlayer1 ? "player1" : "player2";

      const { board: newBoard, linesCleared } = applyActionToBoard(
        st[boardKey],
        action,
        playerType as "player1" | "player2"
      );

      let oppBoard2 = st[oppBoardKey];
      if (st.garbageEnabled && linesCleared >= 2) {
        oppBoard2 = addGarbageRows(oppBoard2, Math.floor(linesCleared / 2));
      }

      const gameOver = isGameOver(newBoard);
      const newSt: BlockBlastGameState = {
        ...st,
        [boardKey]: newBoard,
        [oppBoardKey]: oppBoard2,
        status: gameOver ? "finished" : st.status,
        winner: gameOver
          ? playerType === "player1"
            ? "player2"
            : "player1"
          : st.winner,
      };
      stateRef.current = newSt;
      setGameState(newSt);
    },
    [isLocalMode, isPlayer1, match.id, currentUserId]
  );

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (stateRef.current.status !== "playing") return;
      switch (e.key) {
        case "ArrowLeft":  e.preventDefault(); dispatchAction("left"); break;
        case "ArrowRight": e.preventDefault(); dispatchAction("right"); break;
        case "ArrowDown":  e.preventDefault(); dispatchAction("down"); break;
        case "ArrowUp":    e.preventDefault(); dispatchAction("rotate"); break;
        case " ":          e.preventDefault(); dispatchAction("hardDrop"); break;
        case "c":
        case "C":          dispatchAction("hold"); break;
        case "z":
        case "Z":          dispatchAction("rotate"); break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [dispatchAction]);

  // 3-2-1 countdown (local/bot/practice only; PvP state is managed server-side)
  useEffect(() => {
    if (!isLocalMode) return;
    const st = stateRef.current;
    if (st.status !== "countdown" && st.status !== "waiting") return;

    let val = 3;
    const tick = () => {
      val--;
      if (val <= 0) {
        const cur = stateRef.current;
        const p1 = spawnPiece(cur.player1Board, "player1");
        const p2 = spawnPiece(cur.player2Board, "player2");
        const playing: BlockBlastGameState = {
          ...cur,
          status: "playing",
          player1Board: p1,
          player2Board: p2,
          startTime: Date.now(),
          lastUpdate: Date.now(),
        };
        stateRef.current = playing;
        setGameState(playing);
      } else {
        const cur = stateRef.current;
        const next = { ...cur, countdownValue: val };
        stateRef.current = next;
        setGameState(next);
        countdownRef.current = setTimeout(tick, 1000);
      }
    };
    countdownRef.current = setTimeout(tick, 1000);
    return () => {
      if (countdownRef.current) clearTimeout(countdownRef.current);
    };
  }, []);

  // Local gravity / timer (only for bot/practice modes)
  useEffect(() => {
    if (!isLocalMode || gameState.status !== "playing") return;

    dropTimerRef.current = setInterval(() => {
      const st = stateRef.current;
      if (st.status !== "playing") return;

      const elapsed = (Date.now() - st.startTime) / 1000;
      const newTimeRemaining = Math.max(0, st.gameDuration - elapsed);

      if (newTimeRemaining <= 0) {
        const winner =
          st.player1Board.score > st.player2Board.score ? "player1"
          : st.player2Board.score > st.player1Board.score ? "player2"
          : "tie";
        const finished: BlockBlastGameState = { ...st, status: "finished", timeRemaining: 0, winner };
        stateRef.current = finished;
        setGameState(finished);
        return;
      }

      // Apply gravity drop to the local player's board
      const boardKey = isPlayer1 ? "player1Board" : "player2Board";
      const playerType = isPlayer1 ? "player1" : "player2";
      const { board: newBoard, linesCleared } = applyActionToBoard(
        st[boardKey],
        "down",
        playerType as "player1" | "player2"
      );

      const oppBoardKey = isPlayer1 ? "player2Board" : "player1Board";
      let opp = st[oppBoardKey];
      if (st.garbageEnabled && linesCleared >= 2) {
        opp = addGarbageRows(opp, Math.floor(linesCleared / 2));
      }

      const gameOver = isGameOver(newBoard);
      const ns: BlockBlastGameState = {
        ...st,
        [boardKey]: newBoard,
        [oppBoardKey]: opp,
        timeRemaining: newTimeRemaining,
        status: gameOver ? "finished" : "playing",
        winner: gameOver ? (playerType === "player1" ? "player2" : "player1") : st.winner,
      };
      stateRef.current = ns;
      setGameState(ns);
    }, 1000);

    return () => {
      if (dropTimerRef.current) clearInterval(dropTimerRef.current);
    };
  }, [gameState.status, isLocalMode, isPlayer1]);

  // PvP gravity is handled server-side; no client gravity interval needed

  // Bot AI (local simulation for bot matches)
  useEffect(() => {
    if (!match.isBotMatch || gameState.status !== "playing") return;

    const botDelay =
      match.botDifficulty === "hard" ? 300
      : match.botDifficulty === "easy" ? 900
      : 550;

    const runBot = () => {
      const st = stateRef.current;
      if (st.status !== "playing") return;

      const botBoardKey = isPlayer1 ? "player2Board" : "player1Board";
      const botPlayerType = isPlayer1 ? "player2" : "player1";
      const myBoardKey = isPlayer1 ? "player1Board" : "player2Board";

      let botBoard = st[botBoardKey];
      if (!botBoard.currentPiece) {
        botBoard = spawnPiece(botBoard, botPlayerType as "player1" | "player2");
      }

      const action = generateBotAction(botBoard, match.botDifficulty || "medium");
      const { board: newBotBoard, linesCleared } = applyActionToBoard(
        botBoard,
        action,
        botPlayerType as "player1" | "player2"
      );

      let myBrd = st[myBoardKey];
      if (st.garbageEnabled && linesCleared >= 2) {
        myBrd = addGarbageRows(myBrd, Math.floor(linesCleared / 2));
      }

      const ns: BlockBlastGameState = {
        ...st,
        [botBoardKey]: newBotBoard,
        [myBoardKey]: myBrd,
      };
      stateRef.current = ns;
      setGameState(ns);

      botTimerRef.current = setTimeout(runBot, botDelay + Math.random() * 200);
    };

    botTimerRef.current = setTimeout(runBot, botDelay);
    return () => {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
    };
  }, [gameState.status, match.isBotMatch, match.botDifficulty, isPlayer1]);

  // Complete bot/practice match via REST when game ends locally
  useEffect(() => {
    if (!isLocalMode || gameState.status !== "finished" || gameOverNotifiedRef.current) return;
    gameOverNotifiedRef.current = true;

    const myScore = isPlayer1 ? gameState.player1Board.score : gameState.player2Board.score;
    const oppScore = isPlayer1 ? gameState.player2Board.score : gameState.player1Board.score;
    const myPlayerType = isPlayer1 ? "player1" : "player2";
    const iWon = gameState.winner === myPlayerType;
    const isDraw = gameState.winner === "tie";

    fetch(`/api/matches/${match.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        winnerId: isDraw ? null : iWon ? currentUserId : (isPlayer1 ? match.player2Id : match.player1Id),
        player1Score: isPlayer1 ? myScore : oppScore,
        player2Score: isPlayer1 ? oppScore : myScore,
      }),
    }).catch(() => {});
  }, [gameState.status, gameState.winner, isLocalMode, currentUserId, isPlayer1, match.id, match.player1Id, match.player2Id]);

  // Canvas rendering: local player board
  useEffect(() => {
    const canvas = myBoardRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawBoard(ctx, isPlayer1 ? gameState.player1Board : gameState.player2Board);
  }, [gameState, isPlayer1]);

  // Canvas: next piece
  useEffect(() => {
    const canvas = nextCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0a0a14";
    ctx.fillRect(0, 0, 4 * MINI_CELL_SIZE, 4 * MINI_CELL_SIZE);
    drawMiniPiece(ctx, myBoard.nextPiece);
  }, [myBoard.nextPiece]);

  // Canvas: held piece
  useEffect(() => {
    const canvas = holdCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0a0a14";
    ctx.fillRect(0, 0, 4 * MINI_CELL_SIZE, 4 * MINI_CELL_SIZE);
    if (myBoard.heldPiece) drawMiniPiece(ctx, myBoard.heldPiece);
  }, [myBoard.heldPiece]);

  const isGameFinished = gameState.status === "finished";
  const myPlayerType = isPlayer1 ? "player1" : "player2";
  const iWon = gameState.winner === myPlayerType;
  const isDraw = gameState.winner === "tie";

  return (
    <GameLayout match={match} currentUserId={currentUserId} accentColor="#6366f1" accentRgb="99,102,241" controls="Click block then click grid" winCondition="Most points wins" helpItems={[{ label: "Select", value: "Click a block piece from the tray" }, { label: "Place", value: "Click a valid grid position" }, { label: "Clear", value: "Fill a full row or column" }]} className="p-2 sm:p-4">
      <div className="max-w-2xl mx-auto space-y-3">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            data-testid="button-back-to-lobby"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />Back
          </Button>
          <Badge variant="outline" data-testid="badge-game-type">
            <Grid2x2 className="w-3.5 h-3.5 mr-1.5" />Block Blast
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2 items-center">
          <div
            className="p-3 rounded-xl border text-center transition-all duration-300"
            style={{
              background: "rgba(99,102,241,0.08)",
              borderColor: "rgba(99,102,241,0.4)",
              boxShadow: "0 0 16px rgba(99,102,241,0.15)",
            }}
          >
            <div className="text-xs text-white/50 mb-1 truncate" data-testid="text-my-name">
              {myName}
            </div>
            <div className="text-2xl font-black tabular-nums" style={{ color: "#a5b4fc", textShadow: "0 0 16px rgba(99,102,241,0.5)" }} data-testid="text-my-score">
              {myBoard.score}
            </div>
            <div className="text-xs text-white/40">pts</div>
          </div>

          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-1 text-white/50">
              <Timer className="w-3.5 h-3.5" />
              <span className="font-mono text-sm font-black" data-testid="text-timer">
                {minutes}:{seconds.toString().padStart(2, "0")}
              </span>
            </div>
            {gameState.status === "countdown" && (
              <div className="text-2xl font-black text-white animate-pulse" data-testid="text-countdown">
                {gameState.countdownValue}
              </div>
            )}
          </div>

          <div
            className="p-3 rounded-xl border text-center transition-all duration-300"
            style={{
              background: "rgba(239,68,68,0.08)",
              borderColor: "rgba(239,68,68,0.4)",
              boxShadow: "0 0 16px rgba(239,68,68,0.12)",
            }}
          >
            <div className="text-xs text-white/50 mb-1 truncate" data-testid="text-opp-name">
              {oppName}
            </div>
            <div className="text-2xl font-black tabular-nums" style={{ color: "#f87171" }} data-testid="text-opp-score">
              {oppBoard.score}
            </div>
            <div className="text-xs text-white/40">pts</div>
          </div>
        </div>

        <div className="flex gap-3 justify-center">
          <div className="flex flex-col gap-2">
            <div className="p-2 rounded-lg border space-y-1" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}>
              <div className="text-xs text-white/40 text-center font-medium tracking-wider">HOLD</div>
              <canvas
                ref={holdCanvasRef}
                width={4 * MINI_CELL_SIZE}
                height={4 * MINI_CELL_SIZE}
                className="rounded block"
                style={{ imageRendering: "pixelated" }}
                data-testid="canvas-hold-piece"
              />
            </div>
            <div className="p-2 rounded-lg border space-y-1" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}>
              <div className="text-xs text-white/40 text-center font-medium tracking-wider">NEXT</div>
              <canvas
                ref={nextCanvasRef}
                width={4 * MINI_CELL_SIZE}
                height={4 * MINI_CELL_SIZE}
                className="rounded block"
                style={{ imageRendering: "pixelated" }}
                data-testid="canvas-next-piece"
              />
            </div>
            <div className="p-2 rounded-lg border text-center" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}>
              <div className="text-xs text-white/40">Lines</div>
              <div className="text-sm font-bold text-white/80" data-testid="text-lines-cleared">
                {myBoard.linesCleared}
              </div>
            </div>
            {myBoard.comboCount > 1 && (
              <Badge variant="outline" className="text-xs" data-testid="badge-combo">
                {myBoard.comboCount}x Combo!
              </Badge>
            )}
          </div>

          <div className="flex flex-col items-center gap-1">
            <canvas
              ref={myBoardRef}
              width={BOARD_CANVAS_WIDTH}
              height={BOARD_CANVAS_HEIGHT}
              className="rounded-xl block"
              style={{ maxWidth: "100%", height: "auto", imageRendering: "pixelated", border: "1px solid rgba(99,102,241,0.3)", boxShadow: "0 0 24px rgba(99,102,241,0.12)" }}
              data-testid="canvas-my-board"
            />
            <div className="text-xs text-muted-foreground">
              {isPlayer1 ? "You (P1)" : "You (P2)"}
            </div>
          </div>

          <div className="flex flex-col items-center gap-1">
            <OpponentMiniBoard board={oppBoard} />
            <div className="text-xs text-muted-foreground">Opponent</div>
          </div>
        </div>

        {gameState.status === "playing" && (
          <div className="sm:hidden">
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" className="w-full" onPointerDown={() => dispatchAction("left")} data-testid="button-move-left">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button variant="outline" size="sm" className="w-full" onPointerDown={() => dispatchAction("rotate")} data-testid="button-rotate">
                <RotateCcw className="w-5 h-5" />
              </Button>
              <Button variant="outline" size="sm" className="w-full" onPointerDown={() => dispatchAction("right")} data-testid="button-move-right">
                <ChevronRight className="w-5 h-5" />
              </Button>
              <Button variant="outline" size="sm" className="w-full" onPointerDown={() => dispatchAction("hold")} data-testid="button-hold">
                Hold (C)
              </Button>
              <Button variant="outline" size="sm" className="w-full" onPointerDown={() => dispatchAction("down")} data-testid="button-move-down">
                <ChevronDown className="w-5 h-5" />
              </Button>
              <Button size="sm" className="w-full" onPointerDown={() => dispatchAction("hardDrop")} data-testid="button-hard-drop">
                <ArrowDownToLine className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}

        <div className="p-3 rounded-xl border" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)" }}>
          <div className="text-xs text-white/40">
            <span className="font-medium text-white/60 block mb-1">Controls</span>
            <kbd className="bg-white/10 px-1 rounded text-xs">←→</kbd> Move &nbsp;
            <kbd className="bg-white/10 px-1 rounded text-xs">↑/Z</kbd> Rotate &nbsp;
            <kbd className="bg-white/10 px-1 rounded text-xs">↓</kbd> Soft drop &nbsp;
            <kbd className="bg-white/10 px-1 rounded text-xs">Space</kbd> Hard drop &nbsp;
            <kbd className="bg-white/10 px-1 rounded text-xs">C</kbd> Hold
          </div>
        </div>

        {isGameFinished && (
          <div className="p-4 rounded-2xl border text-center space-y-3" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.10)" }}>
            <Trophy className="w-8 h-8 mx-auto text-yellow-400" />
            <p className="font-bold text-lg text-white/90" data-testid="text-game-result">
              {isDraw ? "It's a Draw!" : iWon ? "You Win!" : "Opponent Wins"}
            </p>
            <p className="text-sm text-white/40">
              You: {isPlayer1 ? gameState.player1Board.score : gameState.player2Board.score} pts ·
              Opponent: {isPlayer1 ? gameState.player2Board.score : gameState.player1Board.score} pts
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setLocation("/")}
              data-testid="button-back-lobby-postgame"
            >
              Back to Lobby
            </Button>
          </div>
        )}
      </div>
    </GameLayout>
  );
}

function OpponentMiniBoard({ board }: { board: PlayerBoard }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const MINI = 6;
  const W = BOARD_WIDTH * MINI;
  const H = BOARD_HEIGHT * MINI;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0a0a14";
    ctx.fillRect(0, 0, W, H);

    for (let r = 0; r < BOARD_HEIGHT; r++) {
      for (let c = 0; c < BOARD_WIDTH; c++) {
        const cell = board.grid[r][c];
        if (cell !== "empty") {
          ctx.fillStyle =
            cell === "player1" ? "#4f8ef7" : cell === "player2" ? "#f74f8e" : "#666";
          ctx.fillRect(c * MINI + 1, r * MINI + 1, MINI - 2, MINI - 2);
        }
      }
    }

    if (board.currentPiece) {
      const shape = TETROMINO_SHAPES[board.currentPiece.type][board.currentPiece.rotation];
      ctx.fillStyle = board.currentPiece.color;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          if (shape[r][c] === 1) {
            const pr = board.currentPiece.position.y + r;
            const pc = board.currentPiece.position.x + c;
            if (pr >= 0 && pr < BOARD_HEIGHT && pc >= 0 && pc < BOARD_WIDTH) {
              ctx.fillRect(pc * MINI + 1, pr * MINI + 1, MINI - 2, MINI - 2);
            }
          }
        }
      }
    }
  }, [board, W, H]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className="border border-border rounded block"
      style={{ imageRendering: "pixelated" }}
      data-testid="canvas-opp-board"
    />
  );
}
