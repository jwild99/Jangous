// Basketball Game Engine

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  inFlight: boolean;
  scored: boolean;
}

export interface Shot {
  angle: number;    // radians, 0 = right, π/2 = up
  power: number;   // 0-100
  result?: "score" | "miss" | "rim";
  points?: number;
}

export interface BasketballState {
  currentPlayer: "player1" | "player2";
  player1Score: number;
  player2Score: number;
  player1ShotsLeft: number;
  player2ShotsLeft: number;
  phase: "aiming" | "flight" | "result" | "over";
  ball: Ball;
  lastShot?: Shot;
  shotsTaken: number;
  winner?: "player1" | "player2" | "draw";
  resultMessage?: string;
}

export const BASKETBALL_CONSTANTS = {
  COURT_W: 400,
  COURT_H: 300,
  HOOP_X: 330,       // hoop center X
  HOOP_Y: 110,       // hoop center Y
  HOOP_R: 18,        // hoop radius (scoring zone)
  BALL_R: 12,
  SHOOTER_X: 70,
  SHOOTER_Y: 220,
  THREE_POINT_X: 160, // shots from left of this line are 3-pointers
  SHOTS_PER_PLAYER: 5,
  GRAVITY: 0.5,
} as const;

export function createBasketballState(): BasketballState {
  const { SHOOTER_X, SHOOTER_Y } = BASKETBALL_CONSTANTS;
  return {
    currentPlayer: "player1",
    player1Score: 0,
    player2Score: 0,
    player1ShotsLeft: BASKETBALL_CONSTANTS.SHOTS_PER_PLAYER,
    player2ShotsLeft: BASKETBALL_CONSTANTS.SHOTS_PER_PLAYER,
    phase: "aiming",
    ball: { x: SHOOTER_X, y: SHOOTER_Y, vx: 0, vy: 0, inFlight: false, scored: false },
    shotsTaken: 0,
  };
}

export function shootBall(state: BasketballState, angle: number, power: number): BasketballState {
  const { SHOOTER_X, SHOOTER_Y } = BASKETBALL_CONSTANTS;
  const speed = power * 0.22;
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;

  return {
    ...state,
    phase: "flight",
    ball: {
      x: SHOOTER_X,
      y: SHOOTER_Y,
      vx,
      vy,
      inFlight: true,
      scored: false,
    },
    lastShot: { angle, power },
  };
}

export function simulateBasketball(state: BasketballState): BasketballState {
  if (state.phase !== "flight") return state;

  const { GRAVITY, HOOP_X, HOOP_Y, HOOP_R, COURT_W, COURT_H, SHOOTER_X, SHOOTER_Y, THREE_POINT_X } = BASKETBALL_CONSTANTS;

  let { x, y, vx, vy } = state.ball;
  vy += GRAVITY;
  x += vx;
  y += vy;

  // Check if passed through hoop
  const dx = x - HOOP_X;
  const dy = y - HOOP_Y;
  const dist = Math.sqrt(dx*dx + dy*dy);
  const isScore = dist < HOOP_R && vy > 0 && y > HOOP_Y - 5; // ball falling downward through hoop

  if (isScore) {
    const points = state.lastShot && state.lastShot.angle !== undefined
      ? (SHOOTER_X < THREE_POINT_X ? 3 : 2)
      : 2;
    const isP1 = state.currentPlayer === "player1";
    const newState = {
      ...state,
      player1Score: isP1 ? state.player1Score + points : state.player1Score,
      player2Score: !isP1 ? state.player2Score + points : state.player2Score,
      ball: { ...state.ball, x, y, vx, vy, scored: true },
      phase: "result" as const,
      lastShot: state.lastShot ? { ...state.lastShot, result: "score" as const, points } : undefined,
      resultMessage: `${points} Points!`,
    };
    return advanceTurn(newState);
  }

  // Ball out of bounds or hit floor
  if (x > COURT_W + 20 || y > COURT_H || x < -20) {
    const rimHit = dist < HOOP_R * 2.5;
    const newState = {
      ...state,
      ball: { ...state.ball, x, y, vx, vy },
      phase: "result" as const,
      lastShot: state.lastShot
        ? { ...state.lastShot, result: (rimHit ? "rim" : "miss") as "rim" | "miss" }
        : undefined,
      resultMessage: rimHit ? "Rim!" : "Miss!",
    };
    return advanceTurn(newState);
  }

  // Continue flight
  return {
    ...state,
    ball: { ...state.ball, x, y, vx, vy },
  };
}

function advanceTurn(state: BasketballState): BasketballState {
  const isP1 = state.currentPlayer === "player1";
  const newP1Shots = isP1 ? state.player1ShotsLeft - 1 : state.player1ShotsLeft;
  const newP2Shots = !isP1 ? state.player2ShotsLeft - 1 : state.player2ShotsLeft;

  // After brief result display, switch or end
  const gameOver = newP1Shots <= 0 && newP2Shots <= 0;
  const nextPlayer = isP1 ? "player2" : "player1";
  const canNextPlayerShoot = nextPlayer === "player1" ? newP1Shots > 0 : newP2Shots > 0;

  if (gameOver) {
    let winner: "player1" | "player2" | "draw";
    if (state.player1Score > state.player2Score) winner = "player1";
    else if (state.player2Score > state.player1Score) winner = "player2";
    else winner = "draw";

    return { ...state, player1ShotsLeft: newP1Shots, player2ShotsLeft: newP2Shots, phase: "over", winner };
  }

  const { SHOOTER_X, SHOOTER_Y } = BASKETBALL_CONSTANTS;

  return {
    ...state,
    player1ShotsLeft: newP1Shots,
    player2ShotsLeft: newP2Shots,
    currentPlayer: canNextPlayerShoot ? nextPlayer : state.currentPlayer,
    phase: "result",
    shotsTaken: state.shotsTaken + 1,
    ball: { x: SHOOTER_X, y: SHOOTER_Y, vx: 0, vy: 0, inFlight: false, scored: false },
  };
}
