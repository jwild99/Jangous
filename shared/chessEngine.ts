/**
 * Production-ready Chess Engine
 * Implements complete chess rules including:
 * - All piece movements with validation
 * - Special moves: castling, en passant, promotion
 * - Check, checkmate, stalemate detection
 * - Draw by repetition, 50-move rule, insufficient material
 * - PGN notation generation
 */

export type PieceType = "pawn" | "rook" | "knight" | "bishop" | "queen" | "king";
export type PieceColor = "white" | "black";

export interface ChessPiece {
  type: PieceType;
  color: PieceColor;
}

export type ChessBoard = (ChessPiece | null)[][];

export interface Position {
  row: number;
  col: number;
}

export interface Move {
  from: Position;
  to: Position;
  piece: ChessPiece;
  captured?: ChessPiece;
  isEnPassant?: boolean;
  isCastling?: boolean;
  isPromotion?: boolean;
  promotionPiece?: PieceType;
  notation?: string;
}

export interface GameState {
  board: ChessBoard;
  currentTurn: PieceColor;
  castlingRights: {
    whiteKingSide: boolean;
    whiteQueenSide: boolean;
    blackKingSide: boolean;
    blackQueenSide: boolean;
  };
  enPassantTarget: Position | null;
  halfMoveClock: number; // For 50-move rule
  fullMoveNumber: number;
  moveHistory: Move[];
  positionHistory: string[]; // For threefold repetition
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  winner?: PieceColor | "draw";
  player1TimeRemaining?: number; // Chess clock time in milliseconds
  player2TimeRemaining?: number; // Chess clock time in milliseconds
  lastMoveTimestamp?: number; // Server timestamp of last move for server-side clock tracking
}

// Initialize a standard chess board
export function initializeChessBoard(): ChessBoard {
  const board: ChessBoard = Array(8).fill(null).map(() => Array(8).fill(null));
  
  // Black pieces (row 0-1)
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
  for (let col = 0; col < 8; col++) {
    board[1][col] = { type: "pawn", color: "black" };
  }
  
  // White pieces (row 6-7)
  for (let col = 0; col < 8; col++) {
    board[6][col] = { type: "pawn", color: "white" };
  }
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

// Initialize game state
export function initializeGameState(): GameState {
  return {
    board: initializeChessBoard(),
    currentTurn: "white",
    castlingRights: {
      whiteKingSide: true,
      whiteQueenSide: true,
      blackKingSide: true,
      blackQueenSide: true,
    },
    enPassantTarget: null,
    halfMoveClock: 0,
    fullMoveNumber: 1,
    moveHistory: [],
    positionHistory: [boardToFEN(initializeChessBoard())],
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
    isDraw: false,
  };
}

// Convert position to algebraic notation (e.g., "e4")
export function positionToAlgebraic(pos: Position): string {
  const files = "abcdefgh";
  return files[pos.col] + (8 - pos.row);
}

// Convert algebraic notation to position
export function algebraicToPosition(algebraic: string): Position {
  const files = "abcdefgh";
  const col = files.indexOf(algebraic[0]);
  const row = 8 - parseInt(algebraic[1]);
  return { row, col };
}

// Get piece at position
export function getPieceAt(board: ChessBoard, pos: Position): ChessPiece | null {
  if (pos.row < 0 || pos.row > 7 || pos.col < 0 || pos.col > 7) {
    return null;
  }
  return board[pos.row][pos.col];
}

// Check if position is on board
export function isValidPosition(pos: Position): boolean {
  return pos.row >= 0 && pos.row <= 7 && pos.col >= 0 && pos.col <= 7;
}

// Find king position
export function findKing(board: ChessBoard, color: PieceColor): Position | null {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === "king" && piece.color === color) {
        return { row, col };
      }
    }
  }
  return null;
}

// Check if a square is under attack
export function isSquareUnderAttack(
  board: ChessBoard,
  pos: Position,
  attackingColor: PieceColor
): boolean {
  // Check all pieces of attacking color
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === attackingColor) {
        const moves = getPseudoLegalMoves(board, { row, col }, piece);
        if (moves.some(move => move.row === pos.row && move.col === pos.col)) {
          return true;
        }
      }
    }
  }
  return false;
}

// Get pseudo-legal moves (doesn't check for check)
function getPseudoLegalMoves(board: ChessBoard, from: Position, piece: ChessPiece): Position[] {
  switch (piece.type) {
    case "pawn":
      return getPawnMoves(board, from, piece.color);
    case "knight":
      return getKnightMoves(board, from, piece.color);
    case "bishop":
      return getBishopMoves(board, from, piece.color);
    case "rook":
      return getRookMoves(board, from, piece.color);
    case "queen":
      return getQueenMoves(board, from, piece.color);
    case "king":
      return getKingMoves(board, from, piece.color);
    default:
      return [];
  }
}

// Pawn moves
function getPawnMoves(board: ChessBoard, from: Position, color: PieceColor): Position[] {
  const moves: Position[] = [];
  const direction = color === "white" ? -1 : 1;
  const startRow = color === "white" ? 6 : 1;
  
  // Forward move
  const forward = { row: from.row + direction, col: from.col };
  if (isValidPosition(forward) && !getPieceAt(board, forward)) {
    moves.push(forward);
    
    // Double forward from start
    if (from.row === startRow) {
      const doubleForward = { row: from.row + 2 * direction, col: from.col };
      if (!getPieceAt(board, doubleForward)) {
        moves.push(doubleForward);
      }
    }
  }
  
  // Diagonal captures
  for (const colOffset of [-1, 1]) {
    const capture = { row: from.row + direction, col: from.col + colOffset };
    if (isValidPosition(capture)) {
      const targetPiece = getPieceAt(board, capture);
      if (targetPiece && targetPiece.color !== color) {
        moves.push(capture);
      }
    }
  }
  
  return moves;
}

// Knight moves
function getKnightMoves(board: ChessBoard, from: Position, color: PieceColor): Position[] {
  const moves: Position[] = [];
  const offsets = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];
  
  for (const [dRow, dCol] of offsets) {
    const to = { row: from.row + dRow, col: from.col + dCol };
    if (isValidPosition(to)) {
      const targetPiece = getPieceAt(board, to);
      if (!targetPiece || targetPiece.color !== color) {
        moves.push(to);
      }
    }
  }
  
  return moves;
}

// Bishop moves (diagonal sliding)
function getBishopMoves(board: ChessBoard, from: Position, color: PieceColor): Position[] {
  const moves: Position[] = [];
  const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  
  for (const [dRow, dCol] of directions) {
    let row = from.row + dRow;
    let col = from.col + dCol;
    
    while (row >= 0 && row <= 7 && col >= 0 && col <= 7) {
      const targetPiece = board[row][col];
      if (targetPiece) {
        if (targetPiece.color !== color) {
          moves.push({ row, col });
        }
        break;
      }
      moves.push({ row, col });
      row += dRow;
      col += dCol;
    }
  }
  
  return moves;
}

// Rook moves (horizontal/vertical sliding)
function getRookMoves(board: ChessBoard, from: Position, color: PieceColor): Position[] {
  const moves: Position[] = [];
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  
  for (const [dRow, dCol] of directions) {
    let row = from.row + dRow;
    let col = from.col + dCol;
    
    while (row >= 0 && row <= 7 && col >= 0 && col <= 7) {
      const targetPiece = board[row][col];
      if (targetPiece) {
        if (targetPiece.color !== color) {
          moves.push({ row, col });
        }
        break;
      }
      moves.push({ row, col });
      row += dRow;
      col += dCol;
    }
  }
  
  return moves;
}

// Queen moves (combination of bishop and rook)
function getQueenMoves(board: ChessBoard, from: Position, color: PieceColor): Position[] {
  return [...getBishopMoves(board, from, color), ...getRookMoves(board, from, color)];
}

// King moves
function getKingMoves(board: ChessBoard, from: Position, color: PieceColor): Position[] {
  const moves: Position[] = [];
  const offsets = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
  ];
  
  for (const [dRow, dCol] of offsets) {
    const to = { row: from.row + dRow, col: from.col + dCol };
    if (isValidPosition(to)) {
      const targetPiece = getPieceAt(board, to);
      if (!targetPiece || targetPiece.color !== color) {
        moves.push(to);
      }
    }
  }
  
  return moves;
}

// Check if move leaves king in check
function wouldBeInCheck(board: ChessBoard, move: Move, color: PieceColor): boolean {
  // Make the move on a copy
  const testBoard = board.map(row => [...row]);
  testBoard[move.to.row][move.to.col] = testBoard[move.from.row][move.from.col];
  testBoard[move.from.row][move.from.col] = null;
  
  // Handle en passant capture
  if (move.isEnPassant) {
    const captureRow = move.to.row + (color === "white" ? 1 : -1);
    testBoard[captureRow][move.to.col] = null;
  }
  
  // Find king position
  const kingPos = findKing(testBoard, color);
  if (!kingPos) return true; // King not found = invalid
  
  // Check if king is under attack
  const opponentColor = color === "white" ? "black" : "white";
  return isSquareUnderAttack(testBoard, kingPos, opponentColor);
}

// Get all legal moves for a piece
export function getLegalMoves(
  gameState: GameState,
  from: Position
): Position[] {
  const piece = getPieceAt(gameState.board, from);
  if (!piece || piece.color !== gameState.currentTurn) {
    return [];
  }
  
  let pseudoMoves = getPseudoLegalMoves(gameState.board, from, piece);
  
  // Add en passant for pawns
  if (piece.type === "pawn" && gameState.enPassantTarget) {
    const direction = piece.color === "white" ? -1 : 1;
    const enPassantRow = from.row + direction;
    if (enPassantRow === gameState.enPassantTarget.row &&
        Math.abs(from.col - gameState.enPassantTarget.col) === 1) {
      pseudoMoves.push(gameState.enPassantTarget);
    }
  }
  
  // Add castling for king
  if (piece.type === "king") {
    const castlingMoves = getCastlingMoves(gameState, from, piece.color);
    pseudoMoves.push(...castlingMoves);
  }
  
  // Filter out moves that would leave king in check
  const legalMoves = pseudoMoves.filter(to => {
    const move: Move = {
      from,
      to,
      piece,
      captured: getPieceAt(gameState.board, to) || undefined,
      isEnPassant: piece.type === "pawn" && 
        gameState.enPassantTarget?.row === to.row &&
        gameState.enPassantTarget?.col === to.col,
    };
    return !wouldBeInCheck(gameState.board, move, piece.color);
  });
  
  return legalMoves;
}

// Get castling moves
function getCastlingMoves(
  gameState: GameState,
  from: Position,
  color: PieceColor
): Position[] {
  const moves: Position[] = [];
  const { board, castlingRights } = gameState;
  const row = color === "white" ? 7 : 0;
  const opponentColor = color === "white" ? "black" : "white";
  
  // King must be on original square
  if (from.row !== row || from.col !== 4) return moves;
  
  // King must not be in check
  if (isSquareUnderAttack(board, from, opponentColor)) return moves;
  
  // Kingside castling
  if ((color === "white" && castlingRights.whiteKingSide) ||
      (color === "black" && castlingRights.blackKingSide)) {
    const f1 = { row, col: 5 };
    const g1 = { row, col: 6 };
    const h1 = { row, col: 7 };
    
    if (!getPieceAt(board, f1) && !getPieceAt(board, g1) &&
        getPieceAt(board, h1)?.type === "rook" &&
        !isSquareUnderAttack(board, f1, opponentColor) &&
        !isSquareUnderAttack(board, g1, opponentColor)) {
      moves.push(g1);
    }
  }
  
  // Queenside castling
  if ((color === "white" && castlingRights.whiteQueenSide) ||
      (color === "black" && castlingRights.blackQueenSide)) {
    const d1 = { row, col: 3 };
    const c1 = { row, col: 2 };
    const b1 = { row, col: 1 };
    const a1 = { row, col: 0 };
    
    if (!getPieceAt(board, d1) && !getPieceAt(board, c1) && !getPieceAt(board, b1) &&
        getPieceAt(board, a1)?.type === "rook" &&
        !isSquareUnderAttack(board, d1, opponentColor) &&
        !isSquareUnderAttack(board, c1, opponentColor)) {
      moves.push(c1);
    }
  }
  
  return moves;
}

// Make a move and return updated game state
export function makeMove(
  gameState: GameState,
  from: Position,
  to: Position,
  promotionPiece?: PieceType
): GameState | null {
  const piece = getPieceAt(gameState.board, from);
  if (!piece || piece.color !== gameState.currentTurn) {
    return null;
  }
  
  const legalMoves = getLegalMoves(gameState, from);
  if (!legalMoves.some(pos => pos.row === to.row && pos.col === to.col)) {
    return null;
  }
  
  // Create new state
  const newState: GameState = JSON.parse(JSON.stringify(gameState));
  const newBoard = newState.board;
  
  const captured = getPieceAt(newBoard, to) ?? undefined;
  const isEnPassant = piece.type === "pawn" && 
    gameState.enPassantTarget?.row === to.row &&
    gameState.enPassantTarget?.col === to.col;
  const isCastling = piece.type === "king" && Math.abs(to.col - from.col) === 2;
  const isPromotion = piece.type === "pawn" && (to.row === 0 || to.row === 7);
  
  // Execute move
  newBoard[to.row][to.col] = newBoard[from.row][from.col];
  newBoard[from.row][from.col] = null;
  
  // Handle en passant capture
  if (isEnPassant) {
    const captureRow = to.row + (piece.color === "white" ? 1 : -1);
    newBoard[captureRow][to.col] = null;
  }
  
  // Handle castling
  if (isCastling) {
    const rookFromCol = to.col === 6 ? 7 : 0;
    const rookToCol = to.col === 6 ? 5 : 3;
    newBoard[to.row][rookToCol] = newBoard[to.row][rookFromCol];
    newBoard[to.row][rookFromCol] = null;
  }
  
  // Handle promotion
  if (isPromotion && promotionPiece) {
    newBoard[to.row][to.col] = { type: promotionPiece, color: piece.color };
  }
  
  // Update castling rights
  if (piece.type === "king") {
    if (piece.color === "white") {
      newState.castlingRights.whiteKingSide = false;
      newState.castlingRights.whiteQueenSide = false;
    } else {
      newState.castlingRights.blackKingSide = false;
      newState.castlingRights.blackQueenSide = false;
    }
  }
  if (piece.type === "rook") {
    if (piece.color === "white") {
      if (from.col === 0) newState.castlingRights.whiteQueenSide = false;
      if (from.col === 7) newState.castlingRights.whiteKingSide = false;
    } else {
      if (from.col === 0) newState.castlingRights.blackQueenSide = false;
      if (from.col === 7) newState.castlingRights.blackKingSide = false;
    }
  }
  
  // Update en passant target
  if (piece.type === "pawn" && Math.abs(to.row - from.row) === 2) {
    newState.enPassantTarget = {
      row: (from.row + to.row) / 2,
      col: from.col
    };
  } else {
    newState.enPassantTarget = null;
  }
  
  // Update move clocks
  if (piece.type === "pawn" || captured) {
    newState.halfMoveClock = 0;
  } else {
    newState.halfMoveClock++;
  }
  
  if (piece.color === "black") {
    newState.fullMoveNumber++;
  }
  
  // Record move
  const move: Move = {
    from,
    to,
    piece,
    captured,
    isEnPassant,
    isCastling,
    isPromotion,
    promotionPiece,
    notation: moveToNotation(gameState.board, from, to, piece, captured, isCastling, isPromotion, promotionPiece)
  };
  newState.moveHistory.push(move);
  
  // Switch turn
  newState.currentTurn = piece.color === "white" ? "black" : "white";
  
  // Record position for repetition detection
  newState.positionHistory.push(boardToFEN(newBoard));
  
  // Check game end conditions
  updateGameStatus(newState);
  
  return newState;
}

// Convert move to algebraic notation
function moveToNotation(
  board: ChessBoard,
  from: Position,
  to: Position,
  piece: ChessPiece,
  captured?: ChessPiece,
  isCastling?: boolean,
  isPromotion?: boolean,
  promotionPiece?: PieceType
): string {
  if (isCastling) {
    return to.col === 6 ? "O-O" : "O-O-O";
  }
  
  let notation = "";
  
  if (piece.type !== "pawn") {
    notation += piece.type[0].toUpperCase();
  }
  
  notation += positionToAlgebraic(from);
  notation += captured ? "x" : "-";
  notation += positionToAlgebraic(to);
  
  if (isPromotion && promotionPiece) {
    notation += "=" + promotionPiece[0].toUpperCase();
  }
  
  return notation;
}

// Update game status (check, checkmate, stalemate, draw)
function updateGameStatus(gameState: GameState): void {
  const currentColor = gameState.currentTurn;
  const opponentColor = currentColor === "white" ? "black" : "white";
  
  // Check if current player is in check
  const kingPos = findKing(gameState.board, currentColor);
  if (kingPos) {
    gameState.isCheck = isSquareUnderAttack(gameState.board, kingPos, opponentColor);
  }
  
  // Check if current player has any legal moves
  let hasLegalMoves = false;
  outer: for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = gameState.board[row][col];
      if (piece && piece.color === currentColor) {
        const moves = getLegalMoves(gameState, { row, col });
        if (moves.length > 0) {
          hasLegalMoves = true;
          break outer;
        }
      }
    }
  }
  
  // Checkmate or stalemate
  if (!hasLegalMoves) {
    if (gameState.isCheck) {
      gameState.isCheckmate = true;
      gameState.winner = opponentColor;
    } else {
      gameState.isStalemate = true;
      gameState.isDraw = true;
      gameState.winner = "draw";
    }
    return;
  }
  
  // 50-move rule
  if (gameState.halfMoveClock >= 100) { // 50 moves per player = 100 half-moves
    gameState.isDraw = true;
    gameState.winner = "draw";
    return;
  }
  
  // Threefold repetition
  const currentPosition = gameState.positionHistory[gameState.positionHistory.length - 1];
  const repetitions = gameState.positionHistory.filter(pos => pos === currentPosition).length;
  if (repetitions >= 3) {
    gameState.isDraw = true;
    gameState.winner = "draw";
    return;
  }
  
  // Insufficient material
  if (hasInsufficientMaterial(gameState.board)) {
    gameState.isDraw = true;
    gameState.winner = "draw";
  }
}

// Check for insufficient material
function hasInsufficientMaterial(board: ChessBoard): boolean {
  const pieces: ChessPiece[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (board[row][col]) {
        pieces.push(board[row][col]!);
      }
    }
  }
  
  // King vs King
  if (pieces.length === 2) return true;
  
  // King + Bishop vs King or King + Knight vs King
  if (pieces.length === 3) {
    const nonKings = pieces.filter(p => p.type !== "king");
    if (nonKings.length === 1 && (nonKings[0].type === "bishop" || nonKings[0].type === "knight")) {
      return true;
    }
  }
  
  return false;
}

// Convert board to FEN (simplified for position only)
function boardToFEN(board: ChessBoard): string {
  let fen = "";
  for (let row = 0; row < 8; row++) {
    let emptyCount = 0;
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        if (emptyCount > 0) {
          fen += emptyCount;
          emptyCount = 0;
        }
        const symbol = pieceToFEN(piece);
        fen += symbol;
      } else {
        emptyCount++;
      }
    }
    if (emptyCount > 0) {
      fen += emptyCount;
    }
    if (row < 7) {
      fen += "/";
    }
  }
  return fen;
}

function pieceToFEN(piece: ChessPiece): string {
  const symbols: Record<PieceType, string> = {
    pawn: "p",
    rook: "r",
    knight: "n",
    bishop: "b",
    queen: "q",
    king: "k"
  };
  const symbol = symbols[piece.type];
  return piece.color === "white" ? symbol.toUpperCase() : symbol;
}

// Generate PGN from move history
export function generatePGN(gameState: GameState, whitePlayer: string, blackPlayer: string): string {
  let pgn = `[Event "Duel Match"]\n`;
  pgn += `[White "${whitePlayer}"]\n`;
  pgn += `[Black "${blackPlayer}"]\n`;
  pgn += `[Result "${gameState.winner === "white" ? "1-0" : gameState.winner === "black" ? "0-1" : "1/2-1/2"}"]\n\n`;
  
  let moveNumber = 1;
  for (let i = 0; i < gameState.moveHistory.length; i++) {
    if (i % 2 === 0) {
      pgn += `${moveNumber}. `;
    }
    pgn += gameState.moveHistory[i].notation + " ";
    if (i % 2 === 1) {
      moveNumber++;
    }
  }
  
  if (gameState.isCheckmate) {
    pgn += gameState.winner === "white" ? "1-0" : "0-1";
  } else if (gameState.isDraw) {
    pgn += "1/2-1/2";
  }
  
  return pgn.trim();
}
