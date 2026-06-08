export type BallType = "cue" | "solid" | "stripe" | "eight";

export interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation?: number;  // radians Ã¢ÂÂ accumulates as the ball rolls (undefined-safe for old states)
  type: BallType;
  pocketed: boolean;
  number: number;
  // Stored cue-ball "english" (contact offset), consumed at first ball contact.
  // spinX: side english (Ã¢ÂÂ1 left Ã¢ÂÂ¦ +1 right). spinY: follow (+1) Ã¢ÂÂ draw (Ã¢ÂÂ1).
  spinX?: number;
  spinY?: number;
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
const MIN_VELOCITY = 0.02; // lower Ã¢ÂÂ balls roll to a more natural full stop

// Ã¢ÂÂÃ¢ÂÂ Pre-computed collision constants (hoisted out of hot loops) Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
const BALL_DIAMETER    = BALL_RADIUS * 2;        // 20
const BALL_DIAMETER_SQ = BALL_DIAMETER * BALL_DIAMETER; // 400

// Ã¢ÂÂÃ¢ÂÂ Motion model Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
// Rolling resistance: subtract a FIXED amount of speed each frame (linear
// deceleration) instead of a flat multiplier. This matches real rolling balls
// and gives a long, natural roll-out followed by a clean stop.
const ROLL_DECEL = 0.04; // much lower Ã¢ÂÂ balls glide long like the reference
const SUBSTEPS = 6;

// Ã¢ÂÂÃ¢ÂÂ Physics boundaries Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
const PHYS_RAIL          = 22;
const CUSHION_REST       = 0.88;  // higher Ã¢ÂÂ balls keep more energy off rails
const CUSHION_TANGENTIAL = 0.92;  // higher Ã¢ÂÂ less sideways scrub on cushion
const BALL_REST          = 0.97;  // higher Ã¢ÂÂ ball-ball collisions stay livelier

const CORNER_MOUTH = 30;
const SIDE_MOUTH   = 28;

const LEFT   = PHYS_RAIL;
const RIGHT  = TABLE_WIDTH  - PHYS_RAIL;
const TOP    = PHYS_RAIL;
const BOTTOM = TABLE_HEIGHT - PHYS_RAIL;

// Ã¢ÂÂÃ¢ÂÂ Pocket centers (inset to real felt pocket mouths) Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
const CORNER_POCKET_INSET = CORNER_MOUTH * 0.55 * 0.6;
const SIDE_POCKET_INSET   = POCKET_RADIUS * 0.7;

export function createInitialState(): EightBallState {
  const balls: Ball[] = [];

  balls.push({
    id: 0, x: TABLE_WIDTH * 0.25, y: TABLE_HEIGHT / 2,
    vx: 0, vy: 0, rotation: 0, type: "cue", pocketed: false, number: 0,
  });

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
        id: idx, x, y, vx: 0, vy: 0, rotation: 0,
        type: n === 8 ? "eight" : n <= 7 ? "solid" : "stripe",
        pocketed: false, number: n,
      });
    }
  }

  const pockets: Pocket[] = [
    { x: CORNER_POCKET_INSET,              y: CORNER_POCKET_INSET,              radius: POCKET_RADIUS },
    { x: TABLE_WIDTH / 2,                  y: SIDE_POCKET_INSET,                radius: POCKET_RADIUS },
    { x: TABLE_WIDTH - CORNER_POCKET_INSET, y: CORNER_POCKET_INSET,             radius: POCKET_RADIUS },
    { x: CORNER_POCKET_INSET,              y: TABLE_HEIGHT - CORNER_POCKET_INSET, radius: POCKET_RADIUS },
    { x: TABLE_WIDTH / 2,                  y: TABLE_HEIGHT - SIDE_POCKET_INSET,  radius: POCKET_RADIUS },
    { x: TABLE_WIDTH - CORNER_POCKET_INSET, y: TABLE_HEIGHT - CORNER_POCKET_INSET, radius: POCKET_RADIUS },
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

// Ã¢ÂÂÃ¢ÂÂ Fast structural clone Ã¢ÂÂ only at turn transitions, never per physics frame Ã¢ÂÂ
export function cloneState(state: EightBallState): EightBallState {
  return {
    ...state,
    balls: state.balls.map(b => ({ ...b })),
    pockets: state.pockets.map(p => ({ ...p })),
    lastShotPocketed: [...state.lastShotPocketed],
  };
}

export function executeShot(
  state: EightBallState, angle: number, power: number,
  spinX: number = 0, spinY: number = 0,
): EightBallState {
  const next = cloneState(state);
  const cue  = next.balls.find(b => b.type === "cue" && !b.pocketed);
  if (!cue) return next;

  const p   = Math.max(0, Math.min(100, power));
  const spd = 5 + (p / 100) * 30;  // faster shots, more momentum like the reference
  cue.vx = Math.cos(angle) * spd;
  cue.vy = Math.sin(angle) * spd;

  cue.spinX = Math.max(-1, Math.min(1, spinX));
  cue.spinY = Math.max(-1, Math.min(1, spinY));

  next.simulationRunning = true;
  next.lastShotPocketed  = [];
  next.validHit  = false;
  next.foul      = false;
  return next;
}

// Ã¢ÂÂÃ¢ÂÂ Spin / english model Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
const FOLLOW_K  = 0.5;
const ENGLISH_K = 0.32;
function applyCueSpin(cue: Ball, nx: number, ny: number, towardTarget: boolean, impactSpeed: number) {
  const sx = cue.spinX ?? 0;
  const sy = cue.spinY ?? 0;
  if (sx === 0 && sy === 0) return;
  const inx = towardTarget ? nx : -nx;
  const iny = towardTarget ? ny : -ny;
  const itx = -iny;
  const ity =  inx;
  cue.vx += inx * sy * impactSpeed * FOLLOW_K + itx * sx * impactSpeed * ENGLISH_K;
  cue.vy += iny * sy * impactSpeed * FOLLOW_K + ity * sx * impactSpeed * ENGLISH_K;
  cue.spinX = 0;
  cue.spinY = 0;
}

// Ã¢ÂÂÃ¢ÂÂ Wall collision with pocket openings + tangential rail friction Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
function applyWallCollision(ball: Ball): boolean {
  let hit = false;

  if (ball.y - BALL_RADIUS < TOP) {
    const openCornerL = ball.x < CORNER_MOUTH;
    const openCornerR = ball.x > TABLE_WIDTH - CORNER_MOUTH;
    const openSide    = Math.abs(ball.x - TABLE_WIDTH / 2) < SIDE_MOUTH;
    if (!openCornerL && !openCornerR && !openSide) {
      ball.y  = TOP + BALL_RADIUS;
      ball.vy = Math.abs(ball.vy) * CUSHION_REST;
      ball.vx *= CUSHION_TANGENTIAL;
      hit = true;
    }
  }

  if (ball.y + BALL_RADIUS > BOTTOM) {
    const openCornerL = ball.x < CORNER_MOUTH;
    const openCornerR = ball.x > TABLE_WIDTH - CORNER_MOUTH;
    const openSide    = Math.abs(ball.x - TABLE_WIDTH / 2) < SIDE_MOUTH;
    if (!openCornerL && !openCornerR && !openSide) {
      ball.y  = BOTTOM - BALL_RADIUS;
      ball.vy = -Math.abs(ball.vy) * CUSHION_REST;
      ball.vx *= CUSHION_TANGENTIAL;
      hit = true;
    }
  }

  if (ball.x - BALL_RADIUS < LEFT) {
    const openCornerT = ball.y < CORNER_MOUTH;
    const openCornerB = ball.y > TABLE_HEIGHT - CORNER_MOUTH;
    if (!openCornerT && !openCornerB) {
      ball.x  = LEFT + BALL_RADIUS;
      ball.vx = Math.abs(ball.vx) * CUSHION_REST;
      ball.vy *= CUSHION_TANGENTIAL;
      hit = true;
    }
  }

  if (ball.x + BALL_RADIUS > RIGHT) {
    const openCornerT = ball.y < CORNER_MOUTH;
    const openCornerB = ball.y > TABLE_HEIGHT - CORNER_MOUTH;
    if (!openCornerT && !openCornerB) {
      ball.x  = RIGHT - BALL_RADIUS;
      ball.vx = -Math.abs(ball.vx) * CUSHION_REST;
      ball.vy *= CUSHION_TANGENTIAL;
      hit = true;
    }
  }

  return hit;
}

// Ã¢ÂÂÃ¢ÂÂ Ball-ball elastic collision Ã¢ÂÂ two passes per sub-step for stability Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
function applyBallCollision(b1: Ball, b2: Ball): boolean {
  const dx = b2.x - b1.x;
  const dy = b2.y - b1.y;
  const d2 = dx * dx + dy * dy;
  if (d2 >= BALL_DIAMETER_SQ || d2 < 0.0001) return false;

  const dist = Math.sqrt(d2);
  const nx   = dx / dist;
  const ny   = dy / dist;
  const tx   = -ny;
  const ty   =  nx;

  const penetration = BALL_DIAMETER - dist;
  const push = penetration * 0.52;
  b1.x -= nx * push; b1.y -= ny * push;
  b2.x += nx * push; b2.y += ny * push;

  const v1n = b1.vx * nx + b1.vy * ny;
  const v2n = b2.vx * nx + b2.vy * ny;
  const v1t = b1.vx * tx + b1.vy * ty;
  const v2t = b2.vx * tx + b2.vy * ty;

  if (v1n - v2n <= 0) return false;

  const e   = BALL_REST;
  const j   = (1 + e) * (v1n - v2n) / 2;
  const n1v = v1n - j;
  const n2v = v2n + j;

  b1.vx = n1v * nx + v1t * tx;
  b1.vy = n1v * ny + v1t * ty;
  b2.vx = n2v * nx + v2t * tx;
  b2.vy = n2v * ny + v2t * ty;

  const impactSpeed = Math.abs(v1n - v2n);
  if (b1.type === "cue") applyCueSpin(b1, nx, ny, true,  impactSpeed);
  else if (b2.type === "cue") applyCueSpin(b2, nx, ny, false, impactSpeed);

  return true;
}

// Ã¢ÂÂÃ¢ÂÂ Main physics step Ã¢ÂÂ mutates balls in place, no per-frame allocation Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
export function simulatePhysics(state: EightBallState): EightBallState {
  const balls = state.balls;

  for (let step = 0; step < SUBSTEPS; step++) {
    // Move fraction of this frame
    for (const ball of balls) {
      if (ball.pocketed) continue;
      ball.x += ball.vx / SUBSTEPS;
      ball.y += ball.vy / SUBSTEPS;
      // Direction-aware spin: x-velocity drives rotation (reverses on rail bounce)
      ball.rotation = (ball.rotation ?? 0) + ball.vx / (BALL_RADIUS * SUBSTEPS);
    }

    // Cushion collisions
    for (const ball of balls) {
      if (!ball.pocketed) applyWallCollision(ball);
    }

    // Ball-ball collisions Ã¢ÂÂ TWO passes per sub-step for dense-rack stability
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const b1 = balls[i];
          const b2 = balls[j];
          if (b1.pocketed || b2.pocketed) continue;
          const hit = applyBallCollision(b1, b2);
          if (hit && (b1.type === "cue" || b2.type === "cue")) {
            state.validHit = true;
          }
        }
      }
    }

    // Pocket detection per sub-step (prevents tunnelling into pockets)
    for (const ball of balls) {
      if (ball.pocketed) continue;
      for (const pocket of state.pockets) {
        const pdx = ball.x - pocket.x;
        const pdy = ball.y - pocket.y;
        if (pdx * pdx + pdy * pdy < pocket.radius * pocket.radius) {
          ball.pocketed = true;
          ball.vx = 0; ball.vy = 0;
          state.lastShotPocketed.push(ball.number);
          if (ball.type === "cue") state.foul = true;
          break;
        }
      }
    }
  }

  // Rolling deceleration Ã¢ÂÂ linear, applied once per frame after all sub-steps
  for (const ball of balls) {
    if (ball.pocketed) continue;
    const sp = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (sp <= MIN_VELOCITY) { ball.vx = 0; ball.vy = 0; continue; }
    const ns = sp - ROLL_DECEL;
    if (ns <= MIN_VELOCITY) { ball.vx = 0; ball.vy = 0; }
    else { const f = ns / sp; ball.vx *= f; ball.vy *= f; }
  }

  // Settle check
  const settled = balls.every(b => b.pocketed || (b.vx === 0 && b.vy === 0));
  if (settled) {
    state.simulationRunning = false;
    return evaluateTurn(state);
  }

  return state;
}

// Ã¢ÂÂÃ¢ÂÂ Find a non-overlapping cue ball position near a desired spot Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
export function findFreeCuePosition(
  balls: Ball[], desiredX: number, desiredY: number,
): { x: number; y: number } {
  const clampX = (v: number) => Math.max(LEFT + BALL_RADIUS, Math.min(RIGHT - BALL_RADIUS, v));
  const clampY = (v: number) => Math.max(TOP  + BALL_RADIUS, Math.min(BOTTOM - BALL_RADIUS, v));
  const fits = (px: number, py: number) => {
    for (const b of balls) {
      if (b.pocketed || b.type === "cue") continue;
      const dx = b.x - px, dy = b.y - py;
      if (dx * dx + dy * dy < BALL_DIAMETER_SQ) return false;
    }
    return true;
  };

  const cx = clampX(desiredX);
  const cy = clampY(desiredY);
  if (fits(cx, cy)) return { x: cx, y: cy };

  for (let r = BALL_RADIUS; r <= 240; r += BALL_RADIUS) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
      const px = clampX(cx + Math.cos(a) * r);
      const py = clampY(cy + Math.sin(a) * r);
      if (fits(px, py)) return { x: px, y: py };
    }
  }
  return { x: cx, y: cy };
}

// Ã¢ÂÂÃ¢ÂÂ Compute wall-bounce aim line segments (for renderer trajectory preview) Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
// Returns up to `maxBounces` segments. Each segment is {x1,y1,x2,y2}.
export function computeWallBounceTrajectory(
  startX: number, startY: number, dirX: number, dirY: number,
  maxBounces = 2, maxLen = 500,
): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const segs: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  let x  = startX, y  = startY;
  let dx = dirX,   dy = dirY;
  let remaining = maxLen;

  for (let bounce = 0; bounce <= maxBounces; bounce++) {
    // How far to each wall
    const tLeft   = dx < 0 ? (LEFT   + BALL_RADIUS - x) / dx : Infinity;
    const tRight  = dx > 0 ? (RIGHT  - BALL_RADIUS - x) / dx : Infinity;
    const tTop    = dy < 0 ? (TOP    + BALL_RADIUS - y) / dy : Infinity;
    const tBottom = dy > 0 ? (BOTTOM - BALL_RADIUS - y) / dy : Infinity;

    const tWall = Math.min(
      tLeft  > 0 ? tLeft  : Infinity,
      tRight > 0 ? tRight : Infinity,
      tTop   > 0 ? tTop   : Infinity,
      tBottom > 0 ? tBottom : Infinity,
    );

    const tStep = Math.min(tWall, remaining);
    const ex = x + dx * tStep;
    const ey = y + dy * tStep;
    segs.push({ x1: x, y1: y, x2: ex, y2: ey });
    remaining -= tStep;
    if (remaining <= 0 || bounce === maxBounces) break;

    // Reflect direction
    if (tStep === tLeft || tStep === tRight)  dx = -dx;
    if (tStep === tTop  || tStep === tBottom) dy = -dy;
    x = ex; y = ey;
  }
  return segs;
}

function evaluateTurn(s: EightBallState): EightBallState {
  const cue = s.balls.find(b => b.type === "cue");
  if (!cue || cue.pocketed) {
    s.foul = true;
    if (cue) {
      cue.pocketed = false;
      const spot = findFreeCuePosition(s.balls, TABLE_WIDTH * 0.25, TABLE_HEIGHT / 2);
      cue.x = spot.x; cue.y = spot.y;
      cue.vx = 0; cue.vy = 0;
    }
  }

  if (!s.validHit && !s.foul) s.foul = true;

  // Ã¢ÂÂÃ¢ÂÂ Break shot group assignment Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
  // FIX: only set breakCompleted = true AFTER a group ball is actually found.
  // This prevents the state getting stuck with null groups if only the 8-ball
  // or no ball was pocketed on break.
  if (!s.breakCompleted && s.lastShotPocketed.length > 0) {
    const first = s.balls.find(b =>
      b.pocketed && b.type !== "cue" && b.type !== "eight" &&
      s.lastShotPocketed.includes(b.number)
    );
    if (first) {
      s.breakCompleted = true; // only flip once a real group ball is found
      if (s.currentPlayer === "player1") {
        s.player1Group = first.type;
        s.player2Group = first.type === "solid" ? "stripe" : "solid";
      } else {
        s.player2Group = first.type;
        s.player1Group = first.type === "solid" ? "stripe" : "solid";
      }
    }
  }

  const eight = s.balls.find(b => b.type === "eight");
  if (eight?.pocketed) {
    const myGroup  = s.currentPlayer === "player1" ? s.player1Group : s.player2Group;
    const remaining = s.balls.filter(b => b.type === myGroup && !b.pocketed).length;
    if (remaining === 0 && !s.foul) {
      s.winner = s.currentPlayer;
    } else {
      s.winner = s.currentPlayer === "player1" ? "player2" : "player1";
    }
    s.gameOver = true;
  }

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
    const c    = fx * fx + fy * fy - BALL_DIAMETER_SQ;
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
