/**
 * Block Blast Game Engine
 * Competitive head-to-head Tetris-style puzzle game
 * Two players race to clear lines and score points within a time limit
 */

export type CellState = "empty" | "player1" | "player2";
export type TetrominoType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

export interface Vector2 {
  x: number;
  y: number;
}

export interface Tetromino {
  type: TetrominoType;
  rotation: number; // 0, 1, 2, or 3 (90-degree rotations)
  position: Vector2; // Top-left position on the grid
  color: string;
}

export interface PlayerBoard {
  grid: CellState[][]; // 20 rows x 10 columns
  currentPiece: Tetromino | null;
  nextPiece: TetrominoType;
  heldPiece: TetrominoType | null; // Piece being held for swap
  canSwapHold: boolean; // Prevents multiple swaps per drop
  score: number;
  linesCleared: number;
  comboCount: number; // Consecutive line clears
  garbageRows: number; // Pending garbage rows to add
  lastMoveTime: number;
}

export interface BlockBlastGameState {
  player1Board: PlayerBoard;
  player2Board: PlayerBoard;
  status: "waiting" | "countdown" | "playing" | "finished";
  timeRemaining: number; // seconds
  gameDuration: number; // total game time in seconds (default 90)
  winner: "player1" | "player2" | "tie" | null;
  countdownValue: number; // 3, 2, 1, 0 (for initial countdown)
  garbageEnabled: boolean; // Whether cleared lines send garbage to opponent
  startTime: number;
  lastUpdate: number;
}

// Tetromino shape definitions (I, O, T, S, Z, J, L)
// Each shape has 4 rotations, represented as a 4x4 grid (1 = filled, 0 = empty)
export const TETROMINO_SHAPES: Record<TetrominoType, number[][][]> = {
  I: [
    [[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]],
    [[0,0,1,0], [0,0,1,0], [0,0,1,0], [0,0,1,0]],
    [[0,0,0,0], [0,0,0,0], [1,1,1,1], [0,0,0,0]],
    [[0,1,0,0], [0,1,0,0], [0,1,0,0], [0,1,0,0]]
  ],
  O: [
    [[0,1,1,0], [0,1,1,0], [0,0,0,0], [0,0,0,0]],
    [[0,1,1,0], [0,1,1,0], [0,0,0,0], [0,0,0,0]],
    [[0,1,1,0], [0,1,1,0], [0,0,0,0], [0,0,0,0]],
    [[0,1,1,0], [0,1,1,0], [0,0,0,0], [0,0,0,0]]
  ],
  T: [
    [[0,1,0,0], [1,1,1,0], [0,0,0,0], [0,0,0,0]],
    [[0,1,0,0], [0,1,1,0], [0,1,0,0], [0,0,0,0]],
    [[0,0,0,0], [1,1,1,0], [0,1,0,0], [0,0,0,0]],
    [[0,1,0,0], [1,1,0,0], [0,1,0,0], [0,0,0,0]]
  ],
  S: [
    [[0,1,1,0], [1,1,0,0], [0,0,0,0], [0,0,0,0]],
    [[0,1,0,0], [0,1,1,0], [0,0,1,0], [0,0,0,0]],
    [[0,0,0,0], [0,1,1,0], [1,1,0,0], [0,0,0,0]],
    [[1,0,0,0], [1,1,0,0], [0,1,0,0], [0,0,0,0]]
  ],
  Z: [
    [[1,1,0,0], [0,1,1,0], [0,0,0,0], [0,0,0,0]],
    [[0,0,1,0], [0,1,1,0], [0,1,0,0], [0,0,0,0]],
    [[0,0,0,0], [1,1,0,0], [0,1,1,0], [0,0,0,0]],
    [[0,1,0,0], [1,1,0,0], [1,0,0,0], [0,0,0,0]]
  ],
  J: [
    [[1,0,0,0], [1,1,1,0], [0,0,0,0], [0,0,0,0]],
    [[0,1,1,0], [0,1,0,0], [0,1,0,0], [0,0,0,0]],
    [[0,0,0,0], [1,1,1,0], [0,0,1,0], [0,0,0,0]],
    [[0,1,0,0], [0,1,0,0], [1,1,0,0], [0,0,0,0]]
  ],
  L: [
    [[0,0,1,0], [1,1,1,0], [0,0,0,0], [0,0,0,0]],
    [[0,1,0,0], [0,1,0,0], [0,1,1,0], [0,0,0,0]],
    [[0,0,0,0], [1,1,1,0], [1,0,0,0], [0,0,0,0]],
    [[1,1,0,0], [0,1,0,0], [0,1,0,0], [0,0,0,0]]
  ]
};

export const TETROMINO_COLORS: Record<TetrominoType, string> = {
  I: "#00f0f0", // Cyan
  O: "#f0f000", // Yellow
  T: "#a000f0", // Purple
  S: "#00f000", // Green
  Z: "#f00000", // Red
  J: "#0000f0", // Blue
  L: "#f0a000", // Orange
};

// Game constants
export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;
export const DEFAULT_GAME_DURATION = 90; // seconds
export const DROP_SPEED = 1000; // milliseconds between automatic drops
export const POINTS_PER_LINE = 100;
export const COMBO_BONUS = 50;
export const GARBAGE_THRESHOLD = 2; // Lines to send 1 garbage row

// Initialize an empty board
export function createEmptyBoard(): CellState[][] {
  return Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill("empty"));
}

// Get random tetromino type
export function getRandomTetromino(): TetrominoType {
  const types: TetrominoType[] = ["I", "O", "T", "S", "Z", "J", "L"];
  return types[Math.floor(Math.random() * types.length)];
}

// Initialize player board
export function createPlayerBoard(playerType: "player1" | "player2"): PlayerBoard {
  return {
    grid: createEmptyBoard(),
    currentPiece: null,
    nextPiece: getRandomTetromino(),
    heldPiece: null,
    canSwapHold: true,
    score: 0,
    linesCleared: 0,
    comboCount: 0,
    garbageRows: 0,
    lastMoveTime: Date.now(),
  };
}

// Initialize game state
export function initializeGameState(gameDuration = DEFAULT_GAME_DURATION, garbageEnabled = true): BlockBlastGameState {
  return {
    player1Board: createPlayerBoard("player1"),
    player2Board: createPlayerBoard("player2"),
    status: "countdown",
    timeRemaining: gameDuration,
    gameDuration,
    winner: null,
    countdownValue: 3,
    garbageEnabled,
    startTime: Date.now(),
    lastUpdate: Date.now(),
  };
}

// Spawn new piece at top of board
export function spawnPiece(board: PlayerBoard, playerType: "player1" | "player2"): PlayerBoard {
  const newPiece: Tetromino = {
    type: board.nextPiece,
    rotation: 0,
    position: { x: Math.floor(BOARD_WIDTH / 2) - 2, y: 0 },
    color: TETROMINO_COLORS[board.nextPiece],
  };

  return {
    ...board,
    currentPiece: newPiece,
    nextPiece: getRandomTetromino(),
    canSwapHold: true,
    lastMoveTime: Date.now(),
  };
}

// Check if piece collides with board or boundaries
export function checkCollision(
  board: CellState[][],
  piece: Tetromino
): boolean {
  const shape = TETROMINO_SHAPES[piece.type][piece.rotation];
  
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (shape[row][col] === 1) {
        const newRow = piece.position.y + row;
        const newCol = piece.position.x + col;
        
        // Check boundaries
        if (newCol < 0 || newCol >= BOARD_WIDTH || newRow >= BOARD_HEIGHT) {
          return true;
        }
        
        // Check collision with existing blocks
        if (newRow >= 0 && board[newRow][newCol] !== "empty") {
          return true;
        }
      }
    }
  }
  
  return false;
}

// Lock piece into the board
export function lockPiece(
  board: PlayerBoard,
  playerType: "player1" | "player2"
): PlayerBoard {
  if (!board.currentPiece) return board;

  const newGrid = board.grid.map(row => [...row]);
  const shape = TETROMINO_SHAPES[board.currentPiece.type][board.currentPiece.rotation];
  
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (shape[row][col] === 1) {
        const gridRow = board.currentPiece.position.y + row;
        const gridCol = board.currentPiece.position.x + col;
        
        if (gridRow >= 0 && gridRow < BOARD_HEIGHT && gridCol >= 0 && gridCol < BOARD_WIDTH) {
          newGrid[gridRow][gridCol] = playerType;
        }
      }
    }
  }
  
  return {
    ...board,
    grid: newGrid,
    currentPiece: null,
  };
}

// Clear completed lines and return updated board with score
export function clearLines(
  board: PlayerBoard
): { board: PlayerBoard; linesCleared: number } {
  const newGrid: CellState[][] = [];
  let linesCleared = 0;
  
  // Check each row from bottom to top
  for (let row = BOARD_HEIGHT - 1; row >= 0; row--) {
    if (board.grid[row].every(cell => cell !== "empty")) {
      linesCleared++;
    } else {
      newGrid.unshift([...board.grid[row]]);
    }
  }
  
  // Add empty rows at top to maintain board height
  while (newGrid.length < BOARD_HEIGHT) {
    newGrid.unshift(Array(BOARD_WIDTH).fill("empty"));
  }
  
  // Calculate score with combo bonus
  const isCombo = board.comboCount > 0;
  const baseScore = linesCleared * POINTS_PER_LINE;
  const comboBonus = isCombo ? board.comboCount * COMBO_BONUS : 0;
  const totalScore = baseScore + comboBonus;
  
  return {
    board: {
      ...board,
      grid: newGrid,
      score: board.score + totalScore,
      linesCleared: board.linesCleared + linesCleared,
      comboCount: linesCleared > 0 ? board.comboCount + 1 : 0,
    },
    linesCleared,
  };
}

// Add garbage rows to board (from opponent's line clears)
export function addGarbageRows(board: PlayerBoard, rowCount: number): PlayerBoard {
  if (rowCount === 0) return board;

  const newGrid = [...board.grid];
  
  // Remove top rows
  newGrid.splice(0, rowCount);
  
  // Add garbage rows at bottom
  for (let i = 0; i < rowCount; i++) {
    const garbageRow: CellState[] = Array(BOARD_WIDTH).fill("player2"); // Filled with opponent color
    // Add one random gap per garbage row for fairness
    const gapPosition = Math.floor(Math.random() * BOARD_WIDTH);
    garbageRow[gapPosition] = "empty";
    newGrid.push(garbageRow);
  }
  
  return {
    ...board,
    grid: newGrid,
    garbageRows: 0, // Reset pending garbage
  };
}

// Move piece (left, right, down)
export function movePiece(
  board: PlayerBoard,
  direction: "left" | "right" | "down",
  playerType: "player1" | "player2"
): PlayerBoard {
  if (!board.currentPiece) return board;

  const dx = direction === "left" ? -1 : direction === "right" ? 1 : 0;
  const dy = direction === "down" ? 1 : 0;
  
  const movedPiece: Tetromino = {
    ...board.currentPiece,
    position: {
      x: board.currentPiece.position.x + dx,
      y: board.currentPiece.position.y + dy,
    },
  };
  
  if (!checkCollision(board.grid, movedPiece)) {
    return {
      ...board,
      currentPiece: movedPiece,
      lastMoveTime: Date.now(),
    };
  } else if (direction === "down") {
    // Piece can't move down, so lock it
    return lockPiece(board, playerType);
  }
  
  return board;
}

// Rotate piece clockwise
export function rotatePiece(
  board: PlayerBoard
): PlayerBoard {
  if (!board.currentPiece) return board;

  const rotatedPiece: Tetromino = {
    ...board.currentPiece,
    rotation: (board.currentPiece.rotation + 1) % 4,
  };
  
  if (!checkCollision(board.grid, rotatedPiece)) {
    return {
      ...board,
      currentPiece: rotatedPiece,
      lastMoveTime: Date.now(),
    };
  }
  
  return board;
}

// Hard drop piece to bottom
export function hardDrop(
  board: PlayerBoard,
  playerType: "player1" | "player2"
): PlayerBoard {
  if (!board.currentPiece) return board;

  let droppedPiece = board.currentPiece;
  
  while (!checkCollision(board.grid, {
    ...droppedPiece,
    position: { x: droppedPiece.position.x, y: droppedPiece.position.y + 1 }
  })) {
    droppedPiece = {
      ...droppedPiece,
      position: { x: droppedPiece.position.x, y: droppedPiece.position.y + 1 }
    };
  }
  
  return lockPiece({
    ...board,
    currentPiece: droppedPiece,
  }, playerType);
}

// Hold current piece and swap with held piece
export function holdPiece(board: PlayerBoard): PlayerBoard {
  if (!board.currentPiece || !board.canSwapHold) return board;

  const currentType = board.currentPiece.type;
  const heldType = board.heldPiece;
  
  if (heldType === null) {
    // No held piece, just hold current and spawn next
    return {
      ...board,
      currentPiece: null,
      heldPiece: currentType,
      canSwapHold: false,
    };
  } else {
    // Swap current with held
    return {
      ...board,
      currentPiece: {
        type: heldType,
        rotation: 0,
        position: { x: Math.floor(BOARD_WIDTH / 2) - 2, y: 0 },
        color: TETROMINO_COLORS[heldType],
      },
      heldPiece: currentType,
      canSwapHold: false,
    };
  }
}

// Check if game is over for a player (piece at top)
export function isGameOver(board: PlayerBoard): boolean {
  if (!board.currentPiece) return false;
  return checkCollision(board.grid, board.currentPiece) && board.currentPiece.position.y === 0;
}

// Determine winner based on scores
export function determineWinner(state: BlockBlastGameState): "player1" | "player2" | "tie" {
  if (state.player1Board.score > state.player2Board.score) {
    return "player1";
  } else if (state.player2Board.score > state.player1Board.score) {
    return "player2";
  }
  return "tie";
}

export class BlockBlastEngine {
  private state: BlockBlastGameState;

  constructor(gameDuration = DEFAULT_GAME_DURATION, garbageEnabled = true) {
    this.state = initializeGameState(gameDuration, garbageEnabled);
  }

  getState(): BlockBlastGameState {
    return this.state;
  }

  startCountdown(): void {
    this.state.status = "countdown";
    this.state.countdownValue = 3;
  }

  updateCountdown(): void {
    if (this.state.status !== "countdown") return;
    
    this.state.countdownValue--;
    if (this.state.countdownValue === 0) {
      this.startGame();
    }
  }

  startGame(): void {
    this.state.status = "playing";
    this.state.startTime = Date.now();
    this.state.lastUpdate = Date.now();
    
    // Spawn initial pieces for both players
    this.state.player1Board = spawnPiece(this.state.player1Board, "player1");
    this.state.player2Board = spawnPiece(this.state.player2Board, "player2");
  }

  update(deltaTime: number): void {
    if (this.state.status !== "playing") return;

    // Update timer
    this.state.timeRemaining -= deltaTime / 1000;
    this.state.lastUpdate = Date.now();

    // Check for game end
    if (this.state.timeRemaining <= 0) {
      this.endGame();
    }
  }

  handleMove(
    player: "player1" | "player2",
    action: "left" | "right" | "down" | "rotate" | "hardDrop" | "hold"
  ): void {
    if (this.state.status !== "playing") return;

    const boardKey = player === "player1" ? "player1Board" : "player2Board";
    let board = this.state[boardKey];

    // Handle different actions
    switch (action) {
      case "left":
      case "right":
      case "down":
        board = movePiece(board, action, player);
        break;
      case "rotate":
        board = rotatePiece(board);
        break;
      case "hardDrop":
        board = hardDrop(board, player);
        break;
      case "hold":
        board = holdPiece(board);
        break;
    }

    // If piece was locked (no current piece), check for line clears
    if (board.currentPiece === null) {
      const { board: clearedBoard, linesCleared } = clearLines(board);
      board = clearedBoard;

      // Send garbage to opponent if enabled
      if (this.state.garbageEnabled && linesCleared >= GARBAGE_THRESHOLD) {
        const garbageRows = Math.floor(linesCleared / GARBAGE_THRESHOLD);
        const opponentKey = player === "player1" ? "player2Board" : "player1Board";
        this.state[opponentKey].garbageRows += garbageRows;
      }

      // Add pending garbage rows
      if (board.garbageRows > 0) {
        board = addGarbageRows(board, board.garbageRows);
      }

      // Spawn new piece
      board = spawnPiece(board, player);

      // Check for game over
      if (isGameOver(board)) {
        this.endGame();
      }
    }

    this.state[boardKey] = board;
  }

  endGame(): void {
    this.state.status = "finished";
    this.state.timeRemaining = 0;
    this.state.winner = determineWinner(this.state);
  }

  getWinner(): "player1" | "player2" | "tie" | null {
    return this.state.winner;
  }

  getPlayer1Score(): number {
    return this.state.player1Board.score;
  }

  getPlayer2Score(): number {
    return this.state.player2Board.score;
  }
}
