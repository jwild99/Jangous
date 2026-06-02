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
  // Stored cue-ball "english" (contact offset), consumed at first ball contact.
  // spinX: side english (−1 left … +1 right). spinY: follow (+1) ↔ draw (−1).
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
const MIN_VELOCITY = 0.08;

// ── Pre-computed collision constants (hoisted out of hot loops) ───────────────
const BALL_DIAMETER    = BALL_RADIUS * 2;       // 20
const BALL_DIAMETER_SQ = BALL_DIAMETER * BALL_DIAMETER; // 400

// ── Motion model ─────────────────────────────────────────────────────────────
// Rolling resistance: subtract a FIXED amount of speed each frame (linear
// deceleration) instead of a flat multiplier. This matches real rolling balls
// and gives a long, natural roll-out followed by a clean stop.
const ROLL_DECEL = 0.16;        // table-units/frame of speed lost to rolling
// Split each frame into sub-steps so fast balls cannot tunnel through each other
// or through cushions in a single large position jump.
const SUBSTEPS   = 6;

// ── Physics boundaries (table units from outer edge) ──────────────────────────
// Balls bounce at the CUSHION FACE, not the outer rail artwork.
const PHYS_RAIL     = 22;        // must match visual RAIL in EightBallGame.tsx
const CUSHION_REST  = 0.78;      // cushion restitution (real pool ≈ 0.75–0.85)
const CUSHION_TANGENTIAL = 0.86; // sideways momentum retained after a rail hit
const BALL_REST     = 0.96;      // ball-ball restitution

// Pocket mouth openings cut into the cushion geometry.
const CORNER_MOUTH  = 30;        // how far from each corner the wall is "open"
const SIDE_MOUTH    = 28;        // half-width of side-pocket opening in cushion

// Derived playfield boundaries
const LEFT   = PHYS_RAIL;
const RIGHT  = TABLE_WIDTH  - PHYS_RAIL;
const TOP    = PHYS_RAIL;
const BOTTOM = TABLE_HEIGHT - PHYS_RAIL;

// ── Pocket centers (inset to the real felt pocket mouths) ────────────────────
// These are aligned with the rendered pocket holes in EightBallGame.tsx so a
// ball drops exactly where the visible hole is — not at the raw (0,0) corner.
const CORNER_POCKET_INSET = CORNER_MOUTH * 0.55 * 0.6; // ≈ 9.9 — matches drawn corner hole
const SIDE_POCKET_INSET   = POCKET_RADIUS * 0.7;       // ≈ 15.4 — matches drawn side hole

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

  // Six pockets — centers inset to the actual felt pocket mouths
  const pockets: Pocket[] = [
    { x: CORNER_POCKET_INSET,               y: CORNER_POCKET_INSET,                radius: POCKET_RADIUS },
    { x: TABLE_WIDTH / 2,                   y: SIDE_POCKET_INSET,                  radius: POCKET_RADIUS },
    { x: TABLE_WIDTH - CORNER_POCKET_INSET, y: CORNER_POCKET_INSET,                radius: POCKET_RADIUS },
    { x: CORNER_POCKET_INSET,               y: TABLE_HEIGHT - CORNER_POCKET_INSET, radius: POCKET_RADIUS },
    { x: TABLE_WIDTH / 2,                   y: TABLE_HEIGHT - SIDE_POCKET_INSET,   radius: POCKET_RADIUS },
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

// ── Fast structural clone (deep enough for this state shape) ──────────────────
// Used only at turn transitions (shot start / settle), NEVER per physics frame.
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
  const spd = 3.5 + (p / 100) * 24.5;   // 3.5 – 28 table-units/frame
  cue.vx = Math.cos(angle) * spd;
  cue.vy = Math.sin(angle) * spd;

  // Stash english on the cue ball — applied when it first strikes another ball.
  cue.spinX = Math.max(-1, Math.min(1, spinX));
  cue.spinY = Math.max(-1, Math.min(1, spinY));

  next.simulationRunning = true;
  next.lastShotPocketed  = [];
  next.validHit  = false;
  next.foul      = false;
  return next;
}

// ── Spin / "english" model ───────────────────────────────────────────────────
// Follow/draw acts along the impact normal; side english adds a tangential
// kick. Both scale with the impact speed so spin feels proportional to power,
// and the stored spin is consumed (zeroed) so it only applies on first contact.
const FOLLOW_K  = 0.5;   // strength of follow (+) / draw (−)
const ENGLISH_K = 0.32;  // strength of side english
function applyCueSpin(cue: Ball, nx: number, ny: number, towardTarget: boolean, impactSpeed: number) {
  const sx = cue.spinX ?? 0;
  const sy = cue.spinY ?? 0;
  if (sx === 0 && sy === 0) return;
  // Normal pointing FROM the cue ball TOWARD the struck ball.
  const inx = towardTarget ? nx : -nx;
  const iny = towardTarget ? ny : -ny;
  // Tangent (normal rotated +90°) for side english.
  const itx = -iny;
  const ity =  inx;
  cue.vx += inx * sy * impactSpeed * FOLLOW_K + itx * sx * impactSpeed * ENGLISH_K;
  cue.vy += iny * sy * impactSpeed * FOLLOW_K + ity * sx * impactSpeed * ENGLISH_K;
  cue.spinX = 0;
  cue.spinY = 0;
}

// ── Wall collision with proper pocket openings + tangential rail friction ─────
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
      ball.vy = Math.abs(ball.vy) * CUSHION_REST;   // normal: reflect + restitution
      ball.vx *= CUSHION_TANGENTIAL;                // tangential: rail kills sideways
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
      ball.vx *= CUSHION_TANGENTIAL;
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
      ball.vy *= CUSHION_TANGENTIAL;
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
      ball.vy *= CUSHION_TANGENTIAL;
      hit = true;
    }
  }

  return hit;
}

// ── Ball-ball elastic collision (stable, energy-conserving) ───────────────────
function applyBallCollision(b1: Ball, b2: Ball): boolean {
  const dx  = b2.x - b1.x;
  const dy  = b2.y - b1.y;
  const d2  = dx * dx + dy * dy;
  if (d2 >= BALL_DIAMETER_SQ || d2 < 0.0001) return false;

  const dist = Math.sqrt(d2);
  const nx   = dx / dist;
  const ny   = dy / dist;
  const tx   = -ny;
  const ty   =  nx;

  // Positional separation (push apart equally)
  const penetration = BALL_DIAMETER - dist;
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

  // Apply stored cue-ball english on first contact. n points b1 → b2, so the
  // cue→target direction is +n when the cue is b1, −n when the cue is b2.
  const impactSpeed = Math.abs(v1n - v2n);
  if (b1.type === "cue")      applyCueSpin(b1, nx, ny, true,  impactSpeed);
  else if (b2.type === "cue") applyCueSpin(b2, nx, ny, false, impactSpeed);

  return true;
}

// Advance one render frame, MUTATING the state's balls in place (no per-frame
// allocation/clone — the previous JSON.parse(JSON.stringify) churned the GC).
// A deep clone happens only at turn transitions (executeShot / settle).
export function simulatePhysics(state: EightBallState): EightBallState {
  const balls = state.balls;

  // ── Sub-stepped integration ───────────────────────────────────────────────
  for (let step = 0; step < SUBSTEPS; step++) {
    // Move a fraction of this frame
    for (const ball of balls) {
      if (ball.pocketed) continue;
      ball.x += ball.vx / SUBSTEPS;
      ball.y += ball.vy / SUBSTEPS;
    }

    // Cushion collisions
    for (const ball of balls) {
      if (!ball.pocketed) applyWallCollision(ball);
    }

    // Ball-ball collisions
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

    // Pocket detection (per sub-step so balls can't skip over a pocket)
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

  // ── Rolling deceleration (linear, applied once per frame) ──────────────────
  for (const ball of balls) {
    if (ball.pocketed) continue;
    const sp = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (sp <= MIN_VELOCITY) { ball.vx = 0; ball.vy = 0; continue; }
    const ns = sp - ROLL_DECEL;
    if (ns <= MIN_VELOCITY) { ball.vx = 0; ball.vy = 0; }
    else { const f = ns / sp; ball.vx *= f; ball.vy *= f; }
  }

  // ── Settle check ───────────────────────────────────────────────────────────
  const settled = balls.every(b => b.pocketed || (b.vx === 0 && b.vy === 0));
  if (settled) {
    state.simulationRunning = false;
    return evaluateTurn(state);
  }

  return state;
}

// Find a non-overlapping resting position for the cue ball near a desired spot.
// Clamps inside the playfield, then spirals outward until it finds a gap so the
// cue never spawns on top of another ball.
export function findFreeCuePosition(
  balls: Ball[], desiredX: number, desiredY: number,
): { x: number; y: number } {
  const clampX = (v: number) => Math.max(LEFT + BALL_RADIUS, Math.min(RIGHT - BALL_RADIUS, v));
  const clampY = (v: number) => Math.max(TOP + BALL_RADIUS, Math.min(BOTTOM - BALL_RADIUS, v));
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

function evaluateTurn(s: EightBallState): EightBallState {
  // Scratch / cue ball sunk → respawn without overlapping any other ball
  const cue = s.balls.find(b => b.type === "cue");
  if (!cue || cue.pocketed) {
    s.foul = true;
    if (cue) {
      cue.pocketed = false;
      const spot = findFreeCuePosition(s.balls, TABLE_WIDTH * 0.25, TABLE_HEIGHT / 2);
      cue.x = spot.x;
      cue.y = spot.y;
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
    const c = fx * fx + fy * fy - BALL_DIAMETER_SQ;
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
