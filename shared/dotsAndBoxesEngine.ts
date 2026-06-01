export type LineState = "empty" | "player1" | "player2";
export type BoxOwner = "empty" | "player1" | "player2";

// Represents a line between two dots
export interface Line {
  row: number;
  col: number;
  isHorizontal: boolean;
}

export interface Move extends Line {
  player: "player1" | "player2";
}

export interface GameState {
  gridSize: number; // Number of dots per side (5 = 4x4 boxes)
  horizontalLines: LineState[][]; // [row][col] - line below dot at (row,col)
  verticalLines: LineState[][]; // [row][col] - line to right of dot at (row,col)
  boxes: BoxOwner[][]; // [row][col] - box ownership
  currentTurn: "player1" | "player2";
  moveHistory: Move[];
  lastMove: Move | null;
  winner: "player1" | "player2" | "draw" | null;
  isGameOver: boolean;
  player1Score: number; // Number of boxes owned
  player2Score: number;
  lastMoveCompletedBox: boolean; // If true, same player goes again
}

// Initialize game with specified grid size (default 5x5 dots = 4x4 boxes)
export function initializeGameState(gridSize: number = 5): GameState {
  const boxSize = gridSize - 1;
  
  return {
    gridSize,
    // Horizontal lines: gridSize rows, gridSize-1 cols
    horizontalLines: Array(gridSize).fill(null).map(() => 
      Array(boxSize).fill("empty")
    ),
    // Vertical lines: gridSize-1 rows, gridSize cols
    verticalLines: Array(boxSize).fill(null).map(() => 
      Array(gridSize).fill("empty")
    ),
    // Boxes: boxSize x boxSize
    boxes: Array(boxSize).fill(null).map(() => 
      Array(boxSize).fill("empty")
    ),
    currentTurn: "player1",
    moveHistory: [],
    lastMove: null,
    winner: null,
    isGameOver: false,
    player1Score: 0,
    player2Score: 0,
    lastMoveCompletedBox: false,
  };
}

// Validate if a line can be drawn
export function isValidMove(gameState: GameState, line: Line): boolean {
  if (gameState.isGameOver) return false;
  
  const { row, col, isHorizontal } = line;
  const boxSize = gameState.gridSize - 1;
  
  if (isHorizontal) {
    // Horizontal lines: check bounds
    if (row < 0 || row >= gameState.gridSize || col < 0 || col >= boxSize) {
      return false;
    }
    return gameState.horizontalLines[row][col] === "empty";
  } else {
    // Vertical lines: check bounds
    if (row < 0 || row >= boxSize || col < 0 || col >= gameState.gridSize) {
      return false;
    }
    return gameState.verticalLines[row][col] === "empty";
  }
}

// Check if a specific box is complete (all 4 sides drawn)
export function isBoxComplete(
  gameState: GameState,
  boxRow: number,
  boxCol: number
): boolean {
  const { horizontalLines, verticalLines } = gameState;
  
  // Top side
  const top = horizontalLines[boxRow][boxCol];
  // Bottom side
  const bottom = horizontalLines[boxRow + 1][boxCol];
  // Left side
  const left = verticalLines[boxRow][boxCol];
  // Right side
  const right = verticalLines[boxRow][boxCol + 1];
  
  return (
    top !== "empty" &&
    bottom !== "empty" &&
    left !== "empty" &&
    right !== "empty"
  );
}

// Get boxes that would be completed by drawing a line
export function getCompletedBoxes(gameState: GameState, line: Line): number[][] {
  const { row, col, isHorizontal } = line;
  const completedBoxes: number[][] = [];
  const boxSize = gameState.gridSize - 1;
  
  // Create a temporary state with the line drawn
  const tempState = JSON.parse(JSON.stringify(gameState)) as GameState;
  
  if (isHorizontal) {
    tempState.horizontalLines[row][col] = "player1"; // Temporary player doesn't matter
    
    // Check box above (if exists)
    if (row > 0) {
      if (isBoxComplete(tempState, row - 1, col)) {
        completedBoxes.push([row - 1, col]);
      }
    }
    
    // Check box below (if exists)
    if (row < boxSize) {
      if (isBoxComplete(tempState, row, col)) {
        completedBoxes.push([row, col]);
      }
    }
  } else {
    tempState.verticalLines[row][col] = "player1"; // Temporary player doesn't matter
    
    // Check box to left (if exists)
    if (col > 0) {
      if (isBoxComplete(tempState, row, col - 1)) {
        completedBoxes.push([row, col - 1]);
      }
    }
    
    // Check box to right (if exists)
    if (col < boxSize) {
      if (isBoxComplete(tempState, row, col)) {
        completedBoxes.push([row, col]);
      }
    }
  }
  
  return completedBoxes;
}

// Make a move and return new game state (or null if invalid)
export function makeMove(gameState: GameState, line: Line): GameState | null {
  if (!isValidMove(gameState, line)) {
    return null;
  }
  
  const newState = JSON.parse(JSON.stringify(gameState)) as GameState;
  const { row, col, isHorizontal } = line;
  const player = newState.currentTurn;
  
  // Draw the line
  if (isHorizontal) {
    newState.horizontalLines[row][col] = player;
  } else {
    newState.verticalLines[row][col] = player;
  }
  
  // Check which boxes were completed
  const completedBoxes = getCompletedBoxes(gameState, line);
  
  // Claim completed boxes
  for (const [boxRow, boxCol] of completedBoxes) {
    newState.boxes[boxRow][boxCol] = player;
    if (player === "player1") {
      newState.player1Score++;
    } else {
      newState.player2Score++;
    }
  }
  
  // Record the move
  const move: Move = { ...line, player };
  newState.moveHistory.push(move);
  newState.lastMove = move;
  
  // If boxes were completed, player gets another turn
  newState.lastMoveCompletedBox = completedBoxes.length > 0;
  
  if (!newState.lastMoveCompletedBox) {
    // Switch turns
    newState.currentTurn = player === "player1" ? "player2" : "player1";
  }
  
  // Check for game over
  const boxSize = newState.gridSize - 1;
  const totalBoxes = boxSize * boxSize;
  
  if (newState.player1Score + newState.player2Score === totalBoxes) {
    newState.isGameOver = true;
    
    if (newState.player1Score > newState.player2Score) {
      newState.winner = "player1";
    } else if (newState.player2Score > newState.player1Score) {
      newState.winner = "player2";
    } else {
      newState.winner = "draw";
    }
  }
  
  return newState;
}

// Get all valid moves for current state
export function getValidMoves(gameState: GameState): Line[] {
  if (gameState.isGameOver) return [];
  
  const validMoves: Line[] = [];
  const boxSize = gameState.gridSize - 1;
  
  // Check all horizontal lines
  for (let row = 0; row < gameState.gridSize; row++) {
    for (let col = 0; col < boxSize; col++) {
      const line: Line = { row, col, isHorizontal: true };
      if (isValidMove(gameState, line)) {
        validMoves.push(line);
      }
    }
  }
  
  // Check all vertical lines
  for (let row = 0; row < boxSize; row++) {
    for (let col = 0; col < gameState.gridSize; col++) {
      const line: Line = { row, col, isHorizontal: false };
      if (isValidMove(gameState, line)) {
        validMoves.push(line);
      }
    }
  }
  
  return validMoves;
}

// Bot AI: Easy difficulty - random valid move
export function getBotMoveEasy(gameState: GameState): Line | null {
  const validMoves = getValidMoves(gameState);
  if (validMoves.length === 0) return null;
  
  const randomIndex = Math.floor(Math.random() * validMoves.length);
  return validMoves[randomIndex];
}

// Bot AI: Medium difficulty - prioritize completing boxes, avoid giving opponent boxes
export function getBotMoveMedium(gameState: GameState): Line | null {
  const validMoves = getValidMoves(gameState);
  if (validMoves.length === 0) return null;
  
  // 1. Prioritize moves that complete boxes
  const boxCompletingMoves = validMoves.filter(
    move => getCompletedBoxes(gameState, move).length > 0
  );
  
  if (boxCompletingMoves.length > 0) {
    // Pick the move that completes the most boxes
    boxCompletingMoves.sort((a, b) => 
      getCompletedBoxes(gameState, b).length - getCompletedBoxes(gameState, a).length
    );
    return boxCompletingMoves[0];
  }
  
  // 2. Avoid moves that give opponent a box on their next turn
  const safeMoves = validMoves.filter(move => {
    const tempState = makeMove(gameState, move);
    if (!tempState) return false;
    
    // Check if opponent can complete a box after this move
    const opponentMoves = getValidMoves(tempState);
    const opponentCanComplete = opponentMoves.some(
      oppMove => getCompletedBoxes(tempState, oppMove).length > 0
    );
    
    return !opponentCanComplete;
  });
  
  if (safeMoves.length > 0) {
    const randomIndex = Math.floor(Math.random() * safeMoves.length);
    return safeMoves[randomIndex];
  }
  
  // 3. If all moves give opponent a box, pick randomly
  const randomIndex = Math.floor(Math.random() * validMoves.length);
  return validMoves[randomIndex];
}

// Bot AI: Hard difficulty - minimax-inspired strategy
export function getBotMoveHard(gameState: GameState): Line | null {
  const validMoves = getValidMoves(gameState);
  if (validMoves.length === 0) return null;
  
  // 1. If we can complete boxes, complete as many as possible
  const boxCompletingMoves = validMoves.filter(
    move => getCompletedBoxes(gameState, move).length > 0
  );
  
  if (boxCompletingMoves.length > 0) {
    boxCompletingMoves.sort((a, b) => 
      getCompletedBoxes(gameState, b).length - getCompletedBoxes(gameState, a).length
    );
    return boxCompletingMoves[0];
  }
  
  // 2. Advanced: Count boxes with 3 sides completed (critical)
  const safeMoves = validMoves.filter(move => {
    const tempState = makeMove(gameState, move);
    if (!tempState) return false;
    
    // Count how many 3-sided boxes we'd create
    const threeSidedCount = countThreeSidedBoxes(tempState);
    
    // Avoid creating 3-sided boxes if possible
    return threeSidedCount === countThreeSidedBoxes(gameState);
  });
  
  if (safeMoves.length > 0) {
    const randomIndex = Math.floor(Math.random() * safeMoves.length);
    return safeMoves[randomIndex];
  }
  
  // 3. If we must create a 3-sided box, pick the move that creates the fewest
  const randomIndex = Math.floor(Math.random() * validMoves.length);
  return validMoves[randomIndex];
}

// Helper: Count boxes with exactly 3 sides completed
function countThreeSidedBoxes(gameState: GameState): number {
  let count = 0;
  const boxSize = gameState.gridSize - 1;
  
  for (let row = 0; row < boxSize; row++) {
    for (let col = 0; col < boxSize; col++) {
      if (gameState.boxes[row][col] !== "empty") continue;
      
      let sides = 0;
      
      if (gameState.horizontalLines[row][col] !== "empty") sides++;
      if (gameState.horizontalLines[row + 1][col] !== "empty") sides++;
      if (gameState.verticalLines[row][col] !== "empty") sides++;
      if (gameState.verticalLines[row][col + 1] !== "empty") sides++;
      
      if (sides === 3) count++;
    }
  }
  
  return count;
}

// Get bot move based on difficulty
export function getBotMove(gameState: GameState, difficulty: "easy" | "medium" | "hard"): Line | null {
  switch (difficulty) {
    case "easy":
      return getBotMoveEasy(gameState);
    case "medium":
      return getBotMoveMedium(gameState);
    case "hard":
      return getBotMoveHard(gameState);
    default:
      return getBotMoveEasy(gameState);
  }
}
