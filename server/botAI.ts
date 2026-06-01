// Bot AI logic for all games — difficulty-aware for every supported game
import type { HoleDefinition } from "@shared/miniGolfEngine";

type ChessPiece = {
  type: "pawn" | "rook" | "knight" | "bishop" | "queen" | "king";
  color: "white" | "black";
} | null;

type ChessBoard = ChessPiece[][];

// ─── Chess AI ────────────────────────────────────────────────────────────────
// Easy:   picks from any legal move at random
// Medium: prefers captures and center control
// Hard:   1-ply minimax — picks the move that maximises material gain while
//         minimising the opponent's best capture response
export function generateChessMove(
  board: ChessBoard,
  color: "white" | "black",
  difficulty: "easy" | "medium" | "hard" = "medium"
): { from: [number, number]; to: [number, number] } | null {
  const moves: { from: [number, number]; to: [number, number]; score: number }[] = [];
  const opponent = color === "white" ? "black" : "white";

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === color) {
        const validMoves = getValidChessMoves(board, [row, col], piece);
        for (const move of validMoves) {
          let score = 0;
          const targetPiece = board[move[0]][move[1]];
          if (targetPiece) score += getPieceValue(targetPiece) * 10;
          if (move[0] >= 3 && move[0] <= 4 && move[1] >= 3 && move[1] <= 4) score += 3;
          moves.push({ from: [row, col], to: move, score });
        }
      }
    }
  }

  if (moves.length === 0) return null;

  if (difficulty === "easy") {
    // Completely random legal move
    return moves[Math.floor(Math.random() * moves.length)];
  }

  if (difficulty === "medium") {
    // Add randomness but prefer captures + center
    moves.forEach(m => { m.score += Math.random() * 8; });
    moves.sort((a, b) => b.score - a.score);
    return { from: moves[0].from, to: moves[0].to };
  }

  // Hard: 1-ply look-ahead
  for (const m of moves) {
    const newBoard = board.map(r => [...r]);
    newBoard[m.to[0]][m.to[1]] = newBoard[m.from[0]][m.from[1]];
    newBoard[m.from[0]][m.from[1]] = null;

    // Penalty: opponent best counter-capture after this move
    let bestOpponentCapture = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = newBoard[r][c];
        if (p && p.color === opponent) {
          for (const om of getValidChessMoves(newBoard, [r, c], p)) {
            const captured = newBoard[om[0]][om[1]];
            if (captured && captured.color === color) {
              bestOpponentCapture = Math.max(bestOpponentCapture, getPieceValue(captured));
            }
          }
        }
      }
    }
    m.score -= bestOpponentCapture * 8;
  }

  moves.sort((a, b) => b.score - a.score);
  return { from: moves[0].from, to: moves[0].to };
}

function getPieceValue(piece: ChessPiece): number {
  if (!piece) return 0;
  const values = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 100 };
  return values[piece.type];
}

function getValidChessMoves(board: ChessBoard, from: [number, number], piece: ChessPiece): [number, number][] {
  if (!piece) return [];
  const [row, col] = from;
  const moves: [number, number][] = [];

  switch (piece.type) {
    case "pawn": {
      const direction = piece.color === "white" ? -1 : 1;
      const startRow  = piece.color === "white" ? 6 : 1;
      if (board[row + direction]?.[col] === null) {
        moves.push([row + direction, col]);
        if (row === startRow && board[row + 2 * direction]?.[col] === null)
          moves.push([row + 2 * direction, col]);
      }
      for (const dcol of [-1, 1]) {
        const target = board[row + direction]?.[col + dcol];
        if (target && target.color !== piece.color) moves.push([row + direction, col + dcol]);
      }
      break;
    }
    case "rook":
      for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]] as [number,number][]) {
        for (let i = 1; i < 8; i++) {
          const nr = row + dr * i, nc = col + dc * i;
          if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break;
          const target = board[nr][nc];
          if (target === null) { moves.push([nr, nc]); }
          else { if (target.color !== piece.color) moves.push([nr, nc]); break; }
        }
      }
      break;
    case "knight":
      for (const [dr, dc] of [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]] as [number,number][]) {
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const target = board[nr][nc];
          if (!target || target.color !== piece.color) moves.push([nr, nc]);
        }
      }
      break;
    case "bishop":
      for (const [dr, dc] of [[1,1],[1,-1],[-1,1],[-1,-1]] as [number,number][]) {
        for (let i = 1; i < 8; i++) {
          const nr = row + dr * i, nc = col + dc * i;
          if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break;
          const target = board[nr][nc];
          if (target === null) { moves.push([nr, nc]); }
          else { if (target.color !== piece.color) moves.push([nr, nc]); break; }
        }
      }
      break;
    case "queen":
      for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]] as [number,number][]) {
        for (let i = 1; i < 8; i++) {
          const nr = row + dr * i, nc = col + dc * i;
          if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break;
          const target = board[nr][nc];
          if (target === null) { moves.push([nr, nc]); }
          else { if (target.color !== piece.color) moves.push([nr, nc]); break; }
        }
      }
      break;
    case "king":
      for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]] as [number,number][]) {
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const target = board[nr][nc];
          if (!target || target.color !== piece.color) moves.push([nr, nc]);
        }
      }
      break;
  }
  return moves;
}

// ─── Connect-4 AI ────────────────────────────────────────────────────────────
// Easy:   random legal column
// Medium: win/block/center heuristic (original)
// Hard:   2-ply minimax (considers opponent's best follow-up)
type Connect4Cell  = "empty" | "player1" | "player2";
type Connect4Board = Connect4Cell[][];

export function generateConnect4Move(
  board: Connect4Board,
  player: "player1" | "player2",
  difficulty: "easy" | "medium" | "hard" = "medium"
): number | null {
  const legalCols = [0,1,2,3,4,5,6].filter(c => canPlaceDisc(board, c));
  if (legalCols.length === 0) return null;

  if (difficulty === "easy") {
    return legalCols[Math.floor(Math.random() * legalCols.length)];
  }

  const opponent = player === "player1" ? "player2" : "player1";

  // Check winning move
  for (const col of legalCols) {
    if (checkConnect4Winner(simulateMove(board, col, player)) === player) return col;
  }
  // Block opponent win
  for (const col of legalCols) {
    if (checkConnect4Winner(simulateMove(board, col, opponent)) === opponent) return col;
  }

  if (difficulty === "medium") {
    const columnPreference = [3,2,4,1,5,0,6];
    for (const col of columnPreference) {
      if (canPlaceDisc(board, col)) return col;
    }
  }

  // Hard: pick column with best 2-ply score
  let bestScore = -Infinity, bestCol = legalCols[0];
  for (const col of legalCols) {
    const b1 = simulateMove(board, col, player);
    // Opponent's best reply
    const oppLegal = [0,1,2,3,4,5,6].filter(c => canPlaceDisc(b1, c));
    let worstOppGain = 0;
    for (const oc of oppLegal) {
      const b2 = simulateMove(b1, oc, opponent);
      if (checkConnect4Winner(b2) === opponent) { worstOppGain = 100; break; }
    }
    // Center preference bonus
    const centerBonus = [3,2,4,1,5,0,6].indexOf(col);
    const score = -worstOppGain + (6 - centerBonus);
    if (score > bestScore) { bestScore = score; bestCol = col; }
  }
  return bestCol;
}

function canPlaceDisc(board: Connect4Board, col: number): boolean {
  return board[0][col] === "empty";
}

function simulateMove(board: Connect4Board, col: number, player: Connect4Cell): Connect4Board {
  const newBoard = board.map(row => [...row]);
  for (let row = 5; row >= 0; row--) {
    if (newBoard[row][col] === "empty") { newBoard[row][col] = player; break; }
  }
  return newBoard;
}

function checkConnect4Winner(board: Connect4Board): Connect4Cell | "draw" | null {
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 4; col++) {
      const c = board[row][col];
      if (c !== "empty" && c === board[row][col+1] && c === board[row][col+2] && c === board[row][col+3]) return c;
    }
  }
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 7; col++) {
      const c = board[row][col];
      if (c !== "empty" && c === board[row+1][col] && c === board[row+2][col] && c === board[row+3][col]) return c;
    }
  }
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const c = board[row][col];
      if (c !== "empty" && c === board[row+1][col+1] && c === board[row+2][col+2] && c === board[row+3][col+3]) return c;
    }
  }
  for (let row = 0; row < 3; row++) {
    for (let col = 3; col < 7; col++) {
      const c = board[row][col];
      if (c !== "empty" && c === board[row+1][col-1] && c === board[row+2][col-2] && c === board[row+3][col-3]) return c;
    }
  }
  return null;
}

// ─── Mini Golf AI ─────────────────────────────────────────────────────────────
// Easy:   high angle error (±30°), wide power variance
// Medium: moderate error (±12°), decent power
// Hard:   near-perfect aim (±3°), tight power control
type MiniGolfState = {
  currentHole: number;
  player2: { ball: { position: { x: number; y: number } } };
};

// Check if a straight path from (x1,y1) to (x2,y2) passes through a water hazard
function pathCrossesWater(
  x1: number, y1: number, x2: number, y2: number,
  hole: HoleDefinition
): boolean {
  const steps = 20;
  for (const obs of hole.obstacles) {
    if (obs.type !== "water") continue;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;
      if (px >= obs.x && px <= obs.x + obs.width && py >= obs.y && py <= obs.y + obs.height) {
        return true;
      }
    }
  }
  return false;
}

// Check if ball position is near a sand trap
function nearSand(x: number, y: number, hole: HoleDefinition): boolean {
  for (const obs of hole.obstacles) {
    if (obs.type !== "sand") continue;
    const dx = obs.x - x;
    const dy = obs.y - y;
    if (Math.sqrt(dx * dx + dy * dy) < obs.radius + 10) return true;
  }
  return false;
}

export function generateMiniGolfShot(
  state: MiniGolfState,
  holePos: { x: number; y: number },
  difficulty: "easy" | "medium" | "hard" = "medium",
  holeDef?: HoleDefinition
): { x: number; y: number } {
  const ballPos = state.player2.ball.position;
  const dx = holePos.x - ballPos.x;
  const dy = holePos.y - ballPos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  let baseAngle = Math.atan2(dy, dx);

  // Hazard avoidance for medium/hard bots: if direct path crosses water, try deflecting angle
  if (holeDef && difficulty !== "easy") {
    const directBlocked = pathCrossesWater(ballPos.x, ballPos.y, holePos.x, holePos.y, holeDef);
    if (directBlocked) {
      // Try 8 candidate deflection angles and pick first clear path
      const deflections = [0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.2, -1.2];
      for (const d of deflections) {
        const testAngle = baseAngle + d;
        const testX = ballPos.x + Math.cos(testAngle) * dist;
        const testY = ballPos.y + Math.sin(testAngle) * dist;
        if (!pathCrossesWater(ballPos.x, ballPos.y, testX, testY, holeDef)) {
          baseAngle = testAngle;
          break;
        }
      }
    }
  }

  // Reduce power if starting near sand (sand will slow the ball)
  const inSand = holeDef ? nearSand(ballPos.x, ballPos.y, holeDef) : false;
  const sandBoost = inSand ? 0.15 : 0;

  let angleError: number;
  let powerPct: number;

  switch (difficulty) {
    case "easy":
      angleError = (Math.random() - 0.5) * (Math.PI / 3); // ±30°
      powerPct   = 0.25 + Math.random() * 0.55;
      break;
    case "medium":
      angleError = (Math.random() - 0.5) * (Math.PI / 8); // ±11°
      powerPct   = 0.45 + Math.random() * 0.35 + sandBoost;
      break;
    case "hard":
    default:
      angleError = (Math.random() - 0.5) * (Math.PI / 28); // ±3.2°
      powerPct   = 0.55 + Math.random() * 0.20 + sandBoost;
      break;
  }

  const angle   = baseAngle + angleError;
  // shotSpeed mimics client formula: 2 + power*4.0 — range 2–6 px/frame
  const shotSpeed = 2 + powerPct * 100 * 4.0 / 100;
  // Clamp speed so the ball doesn't overshoot short distances
  const clampedSpeed = Math.min(shotSpeed, 2 + (dist / 40) * 4.0);

  return {
    x: Math.cos(angle) * clampedSpeed,
    y: Math.sin(angle) * clampedSpeed,
  };
}

// ─── Rock Paper Scissors AI ───────────────────────────────────────────────────
type RPSChoice = "rock" | "paper" | "scissors";
type RPSRound  = {
  roundNumber: number;
  player1Choice: RPSChoice | null;
  player2Choice: RPSChoice | null;
  result: string | null;
  revealed: boolean;
};
const choiceCounters: { [key in RPSChoice]: RPSChoice } = { rock: "paper", paper: "scissors", scissors: "rock" };

export function generateRPSChoice(roundHistory: RPSRound[], botDifficulty: string = "medium"): RPSChoice {
  const choices: RPSChoice[] = ["rock", "paper", "scissors"];
  if (botDifficulty === "easy") return choices[Math.floor(Math.random() * 3)];

  const validRounds = roundHistory.filter(r => r.player1Choice !== null);

  if (botDifficulty === "medium") {
    if (validRounds.length === 0) return choices[Math.floor(Math.random() * 3)];
    const lastChoice = validRounds[validRounds.length - 1].player1Choice!;
    return Math.random() < 0.6 ? choiceCounters[lastChoice] : choices[Math.floor(Math.random() * 3)];
  }

  // Hard
  if (validRounds.length < 2) return choices[Math.floor(Math.random() * 3)];
  const playerChoices = validRounds.map(r => r.player1Choice!);
  const frequency: { [key in RPSChoice]: number } = { rock: 0, paper: 0, scissors: 0 };
  playerChoices.forEach(c => frequency[c]++);
  const mostCommon = Object.entries(frequency).sort((a, b) => b[1] - a[1])[0][0] as RPSChoice;
  const lastTwo = playerChoices.slice(-2);
  if (lastTwo.length === 2 && lastTwo[0] === lastTwo[1] && Math.random() < 0.8) return choiceCounters[lastTwo[1]];
  if (Math.random() < 0.7) return choiceCounters[mostCommon];
  return choices[Math.floor(Math.random() * 3)];
}

// ─── Dots & Boxes AI ─────────────────────────────────────────────────────────
export function generateDotsAndBoxesMove(gameState: any, difficulty: "easy" | "medium" | "hard"): any | null {
  const { getBotMove } = require("@shared/dotsAndBoxesEngine");
  return getBotMove(gameState, difficulty);
}

// ─── 8-Ball Pool AI ───────────────────────────────────────────────────────────
// Implementation lives in @shared/eightBallBot so client and server share it.
import { generateEightBallBotMove, eightBallThinkingTime as _eightBallThink } from "@shared/eightBallBot";
export const generateEightBallMove = generateEightBallBotMove;
export const eightBallThinkingTime = _eightBallThink;


// ─── Bowling AI ───────────────────────────────────────────────────────────────
export function generateBowlingMove(
  _gameState: any,
  _player: "player1" | "player2",
  difficulty: "easy" | "medium" | "hard" = "medium"
): { angle: number; speed: number } | null {
  switch (difficulty) {
    case "easy":
      return { angle: -25 + Math.random() * 50, speed: 35 + Math.random() * 40 };
    case "medium":
      return { angle: -12 + Math.random() * 24, speed: 58 + Math.random() * 28 };
    case "hard": {
      const pocketAngle = 3 + (Math.random() - 0.5) * 2.5;
      return { angle: pocketAngle, speed: 72 + Math.random() * 18 };
    }
    default: return null;
  }
}

// ─── Cup King AI ──────────────────────────────────────────────────────────────
export function generateCupKingMove(
  gameState: any,
  player: "player1" | "player2",
  difficulty: "easy" | "medium" | "hard" = "medium"
): { angle: number; power: number } | null {
  const targetCups = player === "player1" ? gameState.player2Cups : gameState.player1Cups;
  const activeCups = targetCups?.filter((cup: any) => !cup.hit) ?? [];
  if (activeCups.length === 0) return null;

  const centerX = 400;

  switch (difficulty) {
    case "easy": {
      const cup = activeCups[Math.floor(Math.random() * activeCups.length)];
      return { angle: -35 + Math.random() * 70, power: 35 + Math.random() * 45 };
    }
    case "medium": {
      const cup = activeCups[Math.floor(Math.random() * activeCups.length)];
      const base = Math.atan2(cup.x - centerX, 50) * (180 / Math.PI);
      return {
        angle: Math.max(-45, Math.min(45, base + (-6 + Math.random() * 12))),
        power: 55 + Math.random() * 30,
      };
    }
    case "hard": {
      // Aim at most reachable (front) cup
      const frontCups = activeCups.filter((c: any) =>
        player === "player1" ? c.y < 150 : c.y > 450
      );
      const cup = frontCups.length > 0 ? frontCups[0] : activeCups[0];
      const base = Math.atan2(cup.x - centerX, 50) * (180 / Math.PI);
      return {
        angle: Math.max(-45, Math.min(45, base + (-2 + Math.random() * 4))),
        power: 68 + Math.random() * 18,
      };
    }
    default: return null;
  }
}

// ─── Stack Tower AI ───────────────────────────────────────────────────────────
export function generateStackTowerMove(
  gameState: any,
  player: "player1" | "player2",
  difficulty: "easy" | "medium" | "hard" = "medium"
): { action: "drop" } | null {
  const playerState = gameState[player] ?? gameState;
  const isOver = playerState.isGameOver ?? gameState.isGameOver ?? false;
  const currentBlock = playerState.currentBlock ?? gameState.currentBlock;
  const blocks: any[] = playerState.blocks ?? gameState.blocks ?? [];
  if (isOver || !currentBlock || currentBlock.placed) return null;

  const previousBlock = blocks[blocks.length - 1];
  const targetX = previousBlock ? previousBlock.x : 200;
  const distanceFromTarget = Math.abs(currentBlock.x - targetX);
  const perfectThreshold = currentBlock.width * 0.02;
  const isPerfect = distanceFromTarget <= perfectThreshold;

  let dropProb = 0;
  if (difficulty === "easy") {
    dropProb = isPerfect ? 0.78 : (distanceFromTarget > currentBlock.width * 0.3 ? 0.06 : 0);
  } else if (difficulty === "medium") {
    dropProb = isPerfect ? 0.90 : (distanceFromTarget > currentBlock.width * 0.3 ? 0.02 : 0);
  } else {
    dropProb = isPerfect ? 0.97 : 0;
  }

  return Math.random() < dropProb ? { action: "drop" } : null;
}

// ─── Basketball AI ────────────────────────────────────────────────────────────
// Easy:   random angle, variable power — misses often
// Medium: aimed near the hoop with ±12° error
// Hard:   near-perfect angle ±3°, optimal power
export function generateBasketballMove(
  _gameState: any,
  difficulty: "easy" | "medium" | "hard" = "medium"
): { angle: number; power: number } {
  // Hoop is at (330, 110), shooter at (70, 220) in engine coords
  // Perfect angle (radians): atan2(110-220, 330-70) = atan2(-110, 260) ≈ -0.4
  const PERFECT_ANGLE = Math.atan2(110 - 220, 330 - 70); // ≈ -0.4 rad

  switch (difficulty) {
    case "easy": {
      const angle = PERFECT_ANGLE + (Math.random() - 0.5) * (Math.PI * 0.65);
      const power = 30 + Math.random() * 60;
      return { angle, power };
    }
    case "medium": {
      const angle = PERFECT_ANGLE + (Math.random() - 0.5) * 0.38;
      const power = 52 + Math.random() * 22;
      return { angle, power };
    }
    case "hard":
    default: {
      const angle = PERFECT_ANGLE + (Math.random() - 0.5) * 0.10;
      const power = 57 + Math.random() * 10;
      return { angle, power };
    }
  }
}

// ─── Football AI ──────────────────────────────────────────────────────────────
// Returns the receiverId to throw to (0-indexed, receivers have IDs 1, 2, 3)
// Easy:   random receiver
// Medium: randomly weighted toward less-covered receivers
// Hard:   picks the receiver furthest from defenders
export function generateFootballMove(
  gameState: any,
  difficulty: "easy" | "medium" | "hard" = "medium"
): { receiverId: number } {
  const receivers: any[] = gameState.receivers ?? [];
  const defenders: any[] = gameState.defenders ?? [];

  if (receivers.length === 0) return { receiverId: 1 };

  if (difficulty === "easy") {
    const r = receivers[Math.floor(Math.random() * receivers.length)];
    return { receiverId: r.id };
  }

  // Score each receiver by distance to nearest defender (higher = more open)
  const scored = receivers.map((rec: any) => {
    let minDefDist = Infinity;
    for (const def of defenders) {
      const dx = rec.x - def.x, dy = rec.y - def.y;
      minDefDist = Math.min(minDefDist, Math.sqrt(dx * dx + dy * dy));
    }
    return { id: rec.id, openness: minDefDist };
  });

  if (difficulty === "medium") {
    // Weighted random — more open = more likely to be picked
    const total = scored.reduce((s, r) => s + r.openness, 0);
    let rand = Math.random() * total;
    for (const r of scored) {
      rand -= r.openness;
      if (rand <= 0) return { receiverId: r.id };
    }
    return { receiverId: scored[0].id };
  }

  // Hard — always pick most open receiver
  scored.sort((a, b) => b.openness - a.openness);
  return { receiverId: scored[0].id };
}
