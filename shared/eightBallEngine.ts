export type BallType = "cue" | "solid" | "stripe" | "eight";

export interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: BallType;
  pocketed: boolean;
  number: number;
}

export interface Pocket {
  x: number;
  y: number;
  radius: number;
}

export interface EightBallState {
  balls: Ball[];
  pockets: Pocket[];
  currentPlayer: "player1" | "player2";
  player1Group: BallType | null;
  player2Group: BallType | null;
  breakCompleted: boolean;
  foul: boolean;
  winner: "player1" | "player2" | null;
  gameOver: boolean;
  validHit: boolean;
  cueAngle: number;
  cuePower: number;
  simulationRunning: boolean;
  lastShotPocketed: number[];
}

const TABLE_WIDTH  = 800;
const TABLE_HEIGHT = 400;
const BALL_RADIUS  = 10;
const POCKET_RADIUS = 22;
const FRICTION     = 0.984;      // slightly less friction = more realistic long roll
const MIN_VELOCITY = 0.08;

// ── Physics boundaries (table units from outer edge) ──────────────────────────
// Balls bounce at the CUSHION FACE, not the outer rail artwork.
// The cushion face is at PHYS_RAIL from each edge.
const PHYS_RAIL     = 22;        // must match visual RAIL in EightBallGame.tsx
const CUSHION_REST  = 0.78;      // cushion restitution (real pool ≈ 0.75–0.85)
const BALL_REST     = 0.96;      // ball-ball restitution

// Pocket mouth openings cut into the cushion geometry.
// Balls that are in these zones do NOT collide with the cushion wall.
const CORNER_MOUTH  = 30;        // how far from each corner the wall is "open"
const SIDE_MOUTH    = 28;        // half-width of side-pocket opening in cushion

// Derived playfield boundaries
const LEFT   = PHYS_RAIL;
const RIGHT  = TABLE_WIDTH  - PHYS_RAIL;
const TOP    = PHYS_RAIL;
const BOTTOM = TABLE_HEIGHT - PHYS_RAIL;

export function createInitialState(): EightBallState {
  const balls: Ball[] = [];

  // Cue ball
  balls.push({ id: 0, x: TABLE_WIDTH * 0.25, y: TABLE_HEIGHT / 2,
               vx: 0, vy: 0, type: "cue", pocketed: false, number: 0 });

  // Rack in triangle at 70% from left
  const rackX  = TABLE_WIDTH * 0.70;
  const rackY  = TABLE_HEIGHT / 2;
  const spacing = BALL_RADIUS * 2.08;
  const order   = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 8];
  let idx = 0;

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
      const x = rackX + row * spacing * (Math.sqrt(3) / 2);
      const y = rackY + (col - row / 2) * spacing;
      const n = order[idx++];
      balls.push({
        id: idx, x, y, vx: 0, vy: 0,
        type: n === 8 ? "eight" : n <= 7 ? "solid" : "stripe",
        pocketed: false, number: n,
      });
    }
  }

  // Six pockets — positions at the felt boundary corners / midpoints
  const pockets: Pocket[] = [
    { x: 0,            y: 0,            radius: POCKET_RADIUS },
    { x: TABLE_WIDTH / 2, y: 0,         radius: POCKET_RADIUS },
    { x: TABLE_WIDTH,  y: 0,            radius: POCKET_RADIUS },
    { x: 0,            y: TABLE_HEIGHT, radius: POCKET_RADIUS },
    { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT, radius: POCKET_RADIUS },
    { x: TABLE_WIDTH,  y: TABLE_HEIGHT, radius: POCKET_RADIUS },
  ];

  return {
    balls, pockets,
    currentPlayer: "player1",
    player1Group: null, player2Group: null,
    breakCompleted: false,
    foul: false, winner: null, gameOver: false, validHit: false,
    cueAngle: 0, cuePower: 0,
    simulationRunning: false, lastShotPocketed: [],
  };
}

export function executeShot(state: EightBallState, angle: number, power: number): EightBallState {
  const next = JSON.parse(JSON.stringify(state)) as EightBallState;
  const cue  = next.balls.find(b => b.type === "cue" && !b.pocketed);
  if (!cue) return next;

  const p   = Math.max(0, Math.min(100, power));
  const spd = 3.5 + (p / 100) * 24.5;   // 3.5 – 28 table-units/frame
  cue.vx = Math.cos(angle) * spd;
  cue.vy = Math.sin(angle) * spd;

  next.simulationRunning = true;
  next.lastShotPocketed  = [];
  next.validHit  = false;
  next.foul      = false;
  return next;
}

// ── Wall collision with proper pocket openings ────────────────────────────────
// Returns true if a cushion bounce occurred (for sound/FX triggers).
function applyWallCollision(ball: Ball): boolean {
  let hit = false;

  // ── TOP wall ───────────────────────────────────────────────────────────────
  if (ball.y - BALL_RADIUS < TOP) {
    const openCornerL = ball.x < CORNER_MOUTH;
    const openCornerR = ball.x > TABLE_WIDTH - CORNER_MOUTH;
    const openSide    = Math.abs(ball.x - TABLE_WIDTH / 2) < SIDE_MOUTH;
    if (!openCornerL && !openCornerR && !openSide) {
      ball.y = TOP + BALL_RADIUS;
      ball.vy = Math.abs(ball.vy) * CUSHION_REST;
      hit = true;
    }
  }

  // ── BOTTOM wall ────────────────────────────────────────────────────────────
  if (ball.y + BALL_RADIUS > BOTTOM) {
    const openCornerL = ball.x < CORNER_MOUTH;
    const openCornerR = ball.x > TABLE_WIDTH - CORNER_MOUTH;
    const openSide    = Math.abs(ball.x - TABLE_WIDTH / 2) < SIDE_MOUTH;
    if (!openCornerL && !openCornerR && !openSide) {
      ball.y = BOTTOM - BALL_RADIUS;
      ball.vy = -Math.abs(ball.vy) * CUSHION_REST;
      hit = true;
    }
  }

  // ── LEFT wall ──────────────────────────────────────────────────────────────
  if (ball.x - BALL_RADIUS < LEFT) {
    const openCornerT = ball.y < CORNER_MOUTH;
    const openCornerB = ball.y > TABLE_HEIGHT - CORNER_MOUTH;
    if (!openCornerT && !openCornerB) {
      ball.x = LEFT + BALL_RADIUS;
      ball.vx = Math.abs(ball.vx) * CUSHION_REST;
      hit = true;
    }
  }

  // ── RIGHT wall ─────────────────────────────────────────────────────────────
  if (ball.x + BALL_RADIUS > RIGHT) {
    const openCornerT = ball.y < CORNER_MOUTH;
    const openCornerB = ball.y > TABLE_HEIGHT - CORNER_MOUTH;
    if (!openCornerT && !openCornerB) {
      ball.x = RIGHT - BALL_RADIUS;
      ball.vx = -Math.abs(ball.vx) * CUSHION_REST;
      hit = true;
    }
  }

  return hit;
}

// ── Ball-ball elastic collision (stable V2 with improved energy conservation) ─
function applyBallCollision(b1: Ball, b2: Ball): boolean {
  const dx  = b2.x - b1.x;
  const dy  = b2.y - b1.y;
  const d2  = dx * dx + dy * dy;
  const min = BALL_RADIUS * 2;
  if (d2 >= min * min || d2 < 0.0001) return false;

  const dist = Math.sqrt(d2);
  const nx   = dx / dist;
  const ny   = dy / dist;
  const tx   = -ny;
  const ty   =  nx;

  // Positional separation (push apart equally)
  const penetration = min - dist;
  const push = penetration * 0.52;
  b1.x -= nx * push; b1.y -= ny * push;
  b2.x += nx * push; b2.y += ny * push;

  // Velocity decomposition into normal + tangential
  const v1n = b1.vx * nx + b1.vy * ny;
  const v2n = b2.vx * nx + b2.vy * ny;
  const v1t = b1.vx * tx + b1.vy * ty;
  const v2t = b2.vx * tx + b2.vy * ty;

  // Only resolve if balls are approaching each other
  if (v1n - v2n <= 0) return false;

  // Equal-mass elastic with restitution
  const e    = BALL_REST;
  const j    = (1 + e) * (v1n - v2n) / 2;
  const n1v  = v1n - j;
  const n2v  = v2n + j;

  b1.vx = n1v * nx + v1t * tx;
  b1.vy = n1v * ny + v1t * ty;
  b2.vx = n2v * nx + v2t * tx;
  b2.vy = n2v * ny + v2t * ty;

  return true;
}

export function simulatePhysics(state: EightBallState): EightBallState {
  const next = JSON.parse(JSON.stringify(state)) as EightBallState;

  // ── Move & apply friction ─────────────────────────────────────────────────
  for (const ball of next.balls) {
    if (ball.pocketed) continue;
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vx *= FRICTION;
    ball.vy *= FRICTION;
    if (Math.abs(ball.vx) < MIN_VELOCITY) ball.vx = 0;
    if (Math.abs(ball.vy) < MIN_VELOCITY) ball.vy = 0;
  }

  // ── Cushion collisions (correct felt boundary) ────────────────────────────
  for (const ball of next.balls) {
    if (!ball.pocketed) applyWallCollision(ball);
  }

  // ── Ball-ball collisions (multi-pass for stability) ───────────────────────
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < next.balls.length; i++) {
      for (let j = i + 1; j < next.balls.length; j++) {
        const b1 = next.balls[i];
        const b2 = next.balls[j];
        if (b1.pocketed || b2.pocketed) continue;
        const hit = applyBallCollision(b1, b2);
        if (hit && (b1.type === "cue" || b2.type === "cue")) {
          next.validHit = true;
        }
      }
    }
  }

  // ── Pocket detection ──────────────────────────────────────────────────────
  for (const ball of next.balls) {
    if (ball.pocketed) continue;
    for (const pocket of next.pockets) {
      const dx = ball.x - pocket.x;
      const dy = ball.y - pocket.y;
      if (dx * dx + dy * dy < pocket.radius * pocket.radius) {
        ball.pocketed = true;
        ball.vx = 0; ball.vy = 0;
        next.lastShotPocketed.push(ball.number);
        if (ball.type === "cue") next.foul = true;
        break;
      }
    }
  }

  // ── Check if all balls settled ────────────────────────────────────────────
  const settled = next.balls.every(b =>
    b.pocketed || (Math.abs(b.vx) < MIN_VELOCITY && Math.abs(b.vy) < MIN_VELOCITY)
  );

  if (settled) {
    next.simulationRunning = false;
    return evaluateTurn(next);
  }

  return next;
}

function evaluateTurn(state: EightBallState): EightBallState {
  const s = { ...state };

  // Scratch / cue ball sunk
  const cue = s.balls.find(b => b.type === "cue");
  if (!cue || cue.pocketed) {
    s.foul = true;
    if (cue) {
      cue.pocketed = false;
      cue.x = TABLE_WIDTH * 0.25;
      cue.y = TABLE_HEIGHT / 2;
      cue.vx = 0; cue.vy = 0;
    }
  }

  // No valid hit = foul
  if (!s.validHit && !s.foul) s.foul = true;

  // Break shot: assign groups on first ball(s) pocketed
  if (!s.breakCompleted && s.lastShotPocketed.length > 0) {
    s.breakCompleted = true;
    const first = s.balls.find(b =>
      b.pocketed && b.type !== "cue" && b.type !== "eight" &&
      s.lastShotPocketed.includes(b.number)
    );
    if (first) {
      if (s.currentPlayer === "player1") {
        s.player1Group = first.type; s.player2Group = first.type === "solid" ? "stripe" : "solid";
      } else {
        s.player2Group = first.type; s.player1Group = first.type === "solid" ? "stripe" : "solid";
      }
    }
  }

  // 8-ball win/loss check
  const eight = s.balls.find(b => b.type === "eight");
  if (eight?.pocketed) {
    const myGroup = s.currentPlayer === "player1" ? s.player1Group : s.player2Group;
    const remaining = s.balls.filter(b => b.type === myGroup && !b.pocketed).length;
    if (remaining === 0 && !s.foul) {
      s.winner = s.currentPlayer;
    } else {
      s.winner = s.currentPlayer === "player1" ? "player2" : "player1";
    }
    s.gameOver = true;
  }

  // Turn switch on foul or no pocket
  if (!s.gameOver && (s.foul || s.lastShotPocketed.length === 0)) {
    s.currentPlayer = s.currentPlayer === "player1" ? "player2" : "player1";
  }

  return s;
}

export function getValidMoves(state: EightBallState): { angle: number; power: number }[] {
  const moves: { angle: number; power: number }[] = [];
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    for (const p of [30, 55, 80]) {
      moves.push({ angle: a, power: p });
    }
  }
  return moves;
}

export function findFirstBallContact(
  cueBall: Ball, aimAngle: number, balls: Ball[],
): { contactX: number; contactY: number; hitBall: Ball } | null {
  const rdx = Math.cos(aimAngle);
  const rdy = Math.sin(aimAngle);
  let minT = Infinity;
  let result: { contactX: number; contactY: number; hitBall: Ball } | null = null;

  for (const ball of balls) {
    if (ball.pocketed || ball.type === "cue") continue;
    const fx = ball.x - cueBall.x;
    const fy = ball.y - cueBall.y;
    const b  = fx * rdx + fy * rdy;
    if (b <= 0) continue;
    const c = fx * fx + fy * fy - (BALL_RADIUS * 2) ** 2;
    const disc = b * b - c;
    if (disc < 0) continue;
    const t = b - Math.sqrt(disc);
    if (t > 0 && t < minT) {
      minT = t;
      result = { contactX: cueBall.x + rdx * t, contactY: cueBall.y + rdy * t, hitBall: ball };
    }
  }
  return result;
}

export const EIGHT_BALL_CONSTANTS = {
  TABLE_WIDTH,
  TABLE_HEIGHT,
  BALL_RADIUS,
  POCKET_RADIUS,
  PHYS_RAIL,
  CORNER_MOUTH,
  SIDE_MOUTH,
};
