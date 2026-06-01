export type Cell = "empty" | "player1" | "player2";
export type Board = Cell[][];

export interface Move {
  column: number;
  row: number;
  player: "player1" | "player2";
}

export interface GameState {
  board: Board;
  currentTurn: "player1" | "player2";
  moveHistory: Move[];
  lastMove: Move | null;
  winner: "player1" | "player2" | "draw" | null;
  isGameOver: boolean;
}

// Initialize a 7x6 Connect 4 board
export function createEmptyBoard(): Board {
  return Array(6).fill(null).map(() => Array(7).fill("empty"));
}

// Initialize game state
export function initializeGameState(): GameState {
  return {
    board: createEmptyBoard(),
    currentTurn: "player1",
    moveHistory: [],
    lastMove: null,
    winner: null,
    isGameOver: false,
  };
}

// Find lowest empty row in a column (gravity)
export function findLowestEmptyRow(board: Board, column: number): number {
  if (column < 0 || column >= 7) return -1;
  
  for (let row = 5; row >= 0; row--) {
    if (board[row][column] === "empty") {
      return row;
    }
  }
  return -1; // Column is full
}

// Validate a move
export function isValidMove(gameState: GameState, column: number): boolean {
  if (gameState.isGameOver) return false;
  if (column < 0 || column >= 7) return false;
  return findLowestEmptyRow(gameState.board, column) !== -1;
}

// Check for winner
export function checkWinner(board: Board): "player1" | "player2" | "draw" | null {
  // Check horizontal
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 4; col++) {
      const cell = board[row][col];
      if (
        cell !== "empty" &&
        cell === board[row][col + 1] &&
        cell === board[row][col + 2] &&
        cell === board[row][col + 3]
      ) {
        return cell;
      }
    }
  }

  // Check vertical
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row < 3; row++) {
      const cell = board[row][col];
      if (
        cell !== "empty" &&
        cell === board[row + 1][col] &&
        cell === board[row + 2][col] &&
        cell === board[row + 3][col]
      ) {
        return cell;
      }
    }
  }

  // Check diagonal (down-right)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const cell = board[row][col];
      if (
        cell !== "empty" &&
        cell === board[row + 1][col + 1] &&
        cell === board[row + 2][col + 2] &&
        cell === board[row + 3][col + 3]
      ) {
        return cell;
      }
    }
  }

  // Check diagonal (down-left)
  for (let row = 0; row < 3; row++) {
    for (let col = 3; col < 7; col++) {
      const cell = board[row][col];
      if (
        cell !== "empty" &&
        cell === board[row + 1][col - 1] &&
        cell === board[row + 2][col - 2] &&
        cell === board[row + 3][col - 3]
      ) {
        return cell;
      }
    }
  }

  // Check for draw (board is full)
  if (board.every(row => row.every(cell => cell !== "empty"))) {
    return "draw";
  }

  return null;
}

// Make a move and return new game state (or null if invalid)
export function makeMove(
  gameState: GameState,
  column: number,
  player: "player1" | "player2"
): GameState | null {
  // Validate move
  if (!isValidMove(gameState, column)) {
    return null;
  }

  // Validate it's the correct player's turn
  if (gameState.currentTurn !== player) {
    return null;
  }

  const row = findLowestEmptyRow(gameState.board, column);
  if (row === -1) return null;

  // Create new board with the move
  const newBoard = gameState.board.map(r => [...r]);
  newBoard[row][column] = player;

  // Create move record
  const move: Move = {
    column,
    row,
    player,
  };

  // Check for winner
  const winner = checkWinner(newBoard);
  const isGameOver = winner !== null;

  // Create new game state
  const newGameState: GameState = {
    board: newBoard,
    currentTurn: player === "player1" ? "player2" : "player1",
    moveHistory: [...gameState.moveHistory, move],
    lastMove: move,
    winner,
    isGameOver,
  };

  return newGameState;
}

// Get move notation (for logging)
export function getMoveNotation(move: Move): string {
  return `${move.player === "player1" ? "R" : "Y"}${move.column + 1}`;
}

// Get full move sequence as string
export function getMoveSequence(gameState: GameState): string {
  return gameState.moveHistory.map(move => getMoveNotation(move)).join(" ");
}
