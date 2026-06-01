export interface CupKingCup {
  x: number;
  y: number;
  radius: number;
  hit: boolean;
}

export interface CupKingBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export interface CupKingGameState {
  currentPlayer: 1 | 2;
  player1Cups: CupKingCup[];
  player2Cups: CupKingCup[];
  ball: CupKingBall | null;
  isSimulating: boolean;
  winner: 1 | 2 | null;
  turnCount: number;
}

export interface CupKingMove {
  angle: number; // -45 to 45 degrees
  power: number; // 0 to 100
}

// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const CUP_RADIUS = 20;
const BALL_RADIUS = 8;
const GRAVITY = 0.5;
const FRICTION = 0.98;
const BOUNCE_DAMPING = 0.7;
const CUPS_PER_SIDE = 6;

/**
 * Initialize a new Cup King game
 */
export function initCupKingGame(): CupKingGameState {
  const player1Cups = generateCupFormation(1);
  const player2Cups = generateCupFormation(2);

  return {
    currentPlayer: 1,
    player1Cups,
    player2Cups,
    ball: null,
    isSimulating: false,
    winner: null,
    turnCount: 0,
  };
}

/**
 * Generate cup formation for a player
 * Classic beer pong triangle formation (6 cups in pyramid)
 */
function generateCupFormation(player: 1 | 2): CupKingCup[] {
  const cups: CupKingCup[] = [];
  const baseY = player === 1 ? 550 : 50;
  const centerX = CANVAS_WIDTH / 2;
  
  // 3-2-1 pyramid formation (6 cups total)
  // Bottom row: 3 cups
  cups.push(
    { x: centerX - 45, y: baseY, radius: CUP_RADIUS, hit: false },
    { x: centerX, y: baseY, radius: CUP_RADIUS, hit: false },
    { x: centerX + 45, y: baseY, radius: CUP_RADIUS, hit: false }
  );
  
  // Middle row: 2 cups
  const middleY = player === 1 ? baseY - 40 : baseY + 40;
  cups.push(
    { x: centerX - 22.5, y: middleY, radius: CUP_RADIUS, hit: false },
    { x: centerX + 22.5, y: middleY, radius: CUP_RADIUS, hit: false }
  );
  
  // Top row: 1 cup
  const topY = player === 1 ? baseY - 80 : baseY + 80;
  cups.push(
    { x: centerX, y: topY, radius: CUP_RADIUS, hit: false }
  );
  
  return cups;
}

/**
 * Apply a move to the game state
 */
export function applyCupKingMove(
  state: CupKingGameState,
  move: CupKingMove
): CupKingGameState {
  if (state.winner !== null || state.isSimulating) {
    return state;
  }

  // Create ball based on current player's position
  const startY = state.currentPlayer === 1 ? CANVAS_HEIGHT - 30 : 30;
  const startX = CANVAS_WIDTH / 2;
  
  // Convert angle and power to velocity
  const angleRad = (move.angle * Math.PI) / 180;
  const speedMultiplier = move.power / 100;
  const baseSpeed = 15;
  const speed = baseSpeed * speedMultiplier;
  
  // Ball direction: player 1 shoots up, player 2 shoots down
  const direction = state.currentPlayer === 1 ? -1 : 1;
  
  const vx = Math.sin(angleRad) * speed;
  const vy = direction * Math.cos(angleRad) * speed;

  const newState = {
    ...state,
    ball: {
      x: startX,
      y: startY,
      vx,
      vy,
      radius: BALL_RADIUS,
    },
    isSimulating: true,
  };

  return newState;
}

/**
 * Simulate one physics step
 * Returns updated state and whether simulation should continue
 */
export function simulateCupKingPhysicsStep(
  state: CupKingGameState
): { state: CupKingGameState; shouldContinue: boolean } {
  if (!state.ball || !state.isSimulating) {
    return { state, shouldContinue: false };
  }

  let ball = { ...state.ball };
  let player1Cups = [...state.player1Cups];
  let player2Cups = [...state.player2Cups];
  let hitMade = false;

  // Apply gravity
  ball.vy += GRAVITY;
  
  // Apply friction
  ball.vx *= FRICTION;
  ball.vy *= FRICTION;
  
  // Update position
  ball.x += ball.vx;
  ball.y += ball.vy;
  
  // Wall collisions (left and right)
  if (ball.x - ball.radius < 0) {
    ball.x = ball.radius;
    ball.vx = -ball.vx * BOUNCE_DAMPING;
  } else if (ball.x + ball.radius > CANVAS_WIDTH) {
    ball.x = CANVAS_WIDTH - ball.radius;
    ball.vx = -ball.vx * BOUNCE_DAMPING;
  }
  
  // Top and bottom wall collisions
  if (ball.y - ball.radius < 0) {
    ball.y = ball.radius;
    ball.vy = -ball.vy * BOUNCE_DAMPING;
  } else if (ball.y + ball.radius > CANVAS_HEIGHT) {
    ball.y = CANVAS_HEIGHT - ball.radius;
    ball.vy = -ball.vy * BOUNCE_DAMPING;
  }
  
  // Check collisions with opponent's cups
  const targetCups = state.currentPlayer === 1 ? player2Cups : player1Cups;
  
  targetCups.forEach((cup, index) => {
    if (cup.hit) return;
    
    const dx = ball.x - cup.x;
    const dy = ball.y - cup.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < ball.radius + cup.radius) {
      // Cup hit!
      cup.hit = true;
      hitMade = true;
      
      // Bounce ball away from cup
      const angle = Math.atan2(dy, dx);
      ball.vx = Math.cos(angle) * Math.abs(ball.vx) * BOUNCE_DAMPING;
      ball.vy = Math.sin(angle) * Math.abs(ball.vy) * BOUNCE_DAMPING;
    }
  });
  
  // Update the appropriate cup array
  if (state.currentPlayer === 1) {
    player2Cups = targetCups;
  } else {
    player1Cups = targetCups;
  }
  
  // Check if ball has stopped moving (low velocity)
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  const shouldContinue = speed > 0.1;
  
  // If simulation finished, switch players and check for winner
  let newCurrentPlayer = state.currentPlayer;
  let winner = state.winner;
  let turnCount = state.turnCount;
  
  if (!shouldContinue) {
    // Switch to other player
    newCurrentPlayer = state.currentPlayer === 1 ? 2 : 1;
    turnCount++;
    
    // Check for winner
    const player1CupsRemaining = player1Cups.filter(c => !c.hit).length;
    const player2CupsRemaining = player2Cups.filter(c => !c.hit).length;
    
    if (player1CupsRemaining === 0) {
      winner = 2;
    } else if (player2CupsRemaining === 0) {
      winner = 1;
    }
  }

  const newState: CupKingGameState = {
    ...state,
    ball: shouldContinue ? ball : null,
    player1Cups,
    player2Cups,
    isSimulating: shouldContinue,
    currentPlayer: newCurrentPlayer,
    winner,
    turnCount,
  };

  return { state: newState, shouldContinue };
}

/**
 * Get remaining cups count for each player
 */
export function getCupCounts(state: CupKingGameState): { player1: number; player2: number } {
  return {
    player1: state.player1Cups.filter(c => !c.hit).length,
    player2: state.player2Cups.filter(c => !c.hit).length,
  };
}

/**
 * Check if move is valid
 */
export function isValidCupKingMove(state: CupKingGameState, move: CupKingMove): boolean {
  if (state.winner !== null || state.isSimulating) {
    return false;
  }
  
  // Validate angle and power ranges
  if (move.angle < -45 || move.angle > 45) {
    return false;
  }
  
  if (move.power < 0 || move.power > 100) {
    return false;
  }
  
  return true;
}

/**
 * Get game constants for rendering
 */
export function getCupKingConstants() {
  return {
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    CUP_RADIUS,
    BALL_RADIUS,
    CUPS_PER_SIDE,
  };
}
