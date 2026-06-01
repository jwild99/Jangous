// Bowling Engine — AAA Overhaul
// Hook mechanics, oil zones, chain-reaction pin physics

export interface Pin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  standing: boolean;
  mass: number;
  angle: number;      // visual tilt for knocked pins
  angularV: number;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  spin: number;       // -1 to +1 (positive = left hook, negative = right hook)
  rotation: number;   // cumulative visual rotation angle
}

export interface Frame {
  rolls: number[];
  score: number;
  isStrike: boolean;
  isSpare: boolean;
  isComplete: boolean;
}

export interface BowlingGameState {
  currentPlayer: "player1" | "player2";
  currentFrame: number;
  currentRoll: number;
  player1Frames: Frame[];
  player2Frames: Frame[];
  player1TotalScore: number;
  player2TotalScore: number;
  ball: Ball | null;
  pins: Pin[];
  simulationRunning: boolean;
  gameOver: boolean;
  winner: "player1" | "player2" | "tie" | null;
  pinsKnockedThisRoll: number;
  strikeFlash: boolean;
  spareFlash: boolean;
}

export const LANE_WIDTH = 800;
export const LANE_LENGTH = 1200;
export const PIN_RADIUS = 16;
export const BALL_RADIUS = 24;
const PIN_MASS = 1.5;
const BALL_MASS = 7.2;
const FRICTION = 0.988;

// Standard 10-pin layout
const PIN_DEFS: { row: number; col: number }[] = [
  { row: 0, col: 0 },
  { row: 1, col: 0 }, { row: 1, col: 1 },
  { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 },
  { row: 3, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 },
];

export function createInitialState(): BowlingGameState {
  return {
    currentPlayer: "player1",
    currentFrame: 0,
    currentRoll: 0,
    player1Frames: initFrames(),
    player2Frames: initFrames(),
    player1TotalScore: 0,
    player2TotalScore: 0,
    ball: null,
    pins: createPins(),
    simulationRunning: false,
    gameOver: false,
    winner: null,
    pinsKnockedThisRoll: 0,
    strikeFlash: false,
    spareFlash: false,
  };
}

function initFrames(): Frame[] {
  return Array.from({ length: 10 }, () => ({
    rolls: [], score: 0, isStrike: false, isSpare: false, isComplete: false,
  }));
}

export function createPins(): Pin[] {
  const pins: Pin[] = [];
  const startY = 200;
  const startX = LANE_WIDTH / 2;
  const spacing = 38;
  for (const { row, col } of PIN_DEFS) {
    pins.push({
      x: startX + (col - row / 2) * spacing,
      y: startY + row * spacing,
      vx: 0, vy: 0,
      radius: PIN_RADIUS,
      standing: true,
      mass: PIN_MASS,
      angle: 0,
      angularV: 0,
    });
  }
  return pins;
}

// Oil zone hook multiplier: ball travels from y=1100 (near) → y=200 (pins, far)
// Decreasing y = approaching pins = increasing friction/hook
function hookMult(wy: number): number {
  if (wy > 800) return 0;              // front: oiled, no hook
  if (wy > 500) return (800 - wy) / 300 * 0.35;
  if (wy > 300) return 0.35 + (500 - wy) / 200 * 0.5;
  return 0.85 + (300 - wy) / 300 * 0.15; // back: maximum hook
}

export function executeBowl(
  state: BowlingGameState,
  angle: number,   // degrees -30 to +30
  speed: number,   // 0-100
  spin: number = 0 // -1 (right hook) to +1 (left hook)
): BowlingGameState {
  if (state.simulationRunning || state.gameOver) return state;
  const rad = (angle * Math.PI) / 180;
  const vel = (Math.max(0, Math.min(100, speed)) / 100) * 28;
  return {
    ...state,
    ball: {
      x: LANE_WIDTH / 2,
      y: LANE_LENGTH - 100,
      vx: Math.sin(rad) * vel,
      vy: -Math.cos(rad) * vel,
      radius: BALL_RADIUS,
      mass: BALL_MASS,
      spin: Math.max(-1, Math.min(1, spin)),
      rotation: 0,
    },
    simulationRunning: true,
    pinsKnockedThisRoll: 0,
    strikeFlash: false,
    spareFlash: false,
  };
}

export function simulatePhysics(state: BowlingGameState): BowlingGameState {
  if (!state.simulationRunning || !state.ball) return state;

  const ball = { ...state.ball };
  const pins = state.pins.map(p => ({ ...p }));

  // ── Ball movement & hook ─────────────────────────────────────────────────
  ball.x += ball.vx;
  ball.y += ball.vy;
  ball.rotation -= Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) * 0.07;

  const hm = hookMult(ball.y);
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  if (hm > 0 && speed > 0.5) {
    ball.vx += -ball.spin * hm * 0.018 * (speed / 28);
  }

  ball.vx *= FRICTION;
  ball.vy *= FRICTION;

  // Gutter walls
  if (ball.x - ball.radius < 0) { ball.x = ball.radius; ball.vx = Math.abs(ball.vx) * 0.12; }
  if (ball.x + ball.radius > LANE_WIDTH) { ball.x = LANE_WIDTH - ball.radius; ball.vx = -Math.abs(ball.vx) * 0.12; }

  // ── Ball-pin collisions ──────────────────────────────────────────────────
  for (const pin of pins) {
    if (!pin.standing) continue;
    const dx = pin.x - ball.x;
    const dy = pin.y - ball.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = ball.radius + pin.radius;
    if (dist < minDist && dist > 0) {
      const nx = dx / dist, ny = dy / dist;
      pin.standing = false;
      // Pin gets most of the momentum in direction of impact
      pin.vx = nx * speed * 0.62 + ball.vx * 0.30;
      pin.vy = ny * speed * 0.22 + ball.vy * 0.06;
      pin.angularV = (Math.random() - 0.5) * 0.5;
      // Ball barely deflects
      ball.vx += nx * (-speed * 0.04);
      ball.vx += (Math.random() - 0.5) * 0.25;
    }
  }

  // ── Pin movement ──────────────────────────────────────────────────────────
  for (const pin of pins) {
    if (pin.standing) continue;
    pin.x += pin.vx;
    pin.y += pin.vy;
    pin.angle += pin.angularV;
    pin.vx *= 0.905;
    pin.vy *= 0.905;
    pin.angularV *= 0.88;
    pin.x = Math.max(40, Math.min(LANE_WIDTH - 40, pin.x));
    pin.y = Math.max(100, Math.min(500, pin.y));
  }

  // ── Pin-pin chain knockdown ───────────────────────────────────────────────
  for (let i = 0; i < pins.length; i++) {
    const mover = pins[i];
    if (mover.standing) continue;
    const mv = Math.sqrt(mover.vx * mover.vx + mover.vy * mover.vy);
    if (mv < 0.9) continue;
    for (let j = 0; j < pins.length; j++) {
      if (i === j || !pins[j].standing) continue;
      const target = pins[j];
      const dx = target.x - mover.x;
      const dy = target.y - mover.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < mover.radius + target.radius && dist > 0) {
        const nx = dx / dist, ny = dy / dist;
        target.standing = false;
        target.vx = nx * mv * 0.62 + (Math.random() - 0.5) * 0.4;
        target.vy = ny * mv * 0.55;
        target.angularV = (Math.random() - 0.5) * 0.42;
        mover.vx *= 0.65;
        mover.vy *= 0.65;
      }
    }
  }

  // ── End check ────────────────────────────────────────────────────────────
  const ballSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  const allStopped = pins.every(p => p.standing || (Math.abs(p.vx) < 0.12 && Math.abs(p.vy) < 0.12));

  if ((ball.y < 130 || ballSpeed < 0.18) && allStopped) {
    const knocked = pins.filter(p => !p.standing).length;
    const settled: BowlingGameState = {
      ...state, ball: null, simulationRunning: false, pins,
      pinsKnockedThisRoll: knocked, strikeFlash: false, spareFlash: false,
    };
    return updateScore(settled, knocked);
  }

  return { ...state, ball, pins, pinsKnockedThisRoll: pins.filter(p => !p.standing).length };
}

// ── Scoring (original proven logic preserved) ─────────────────────────────
function updateScore(state: BowlingGameState, pinsKnocked: number): BowlingGameState {
  const ns = { ...state };
  const frames = ns.currentPlayer === "player1"
    ? [...ns.player1Frames]
    : [...ns.player2Frames];
  const cf = { ...frames[ns.currentFrame] };
  cf.rolls = [...cf.rolls, pinsKnocked];
  frames[ns.currentFrame] = cf;

  if (ns.currentPlayer === "player1") ns.player1Frames = frames;
  else ns.player2Frames = frames;

  let strikeFlash = false;
  let spareFlash = false;

  if (ns.currentRoll === 0 && pinsKnocked === 10) {
    // Strike
    cf.isStrike = true;
    cf.isComplete = true;
    strikeFlash = true;
    ns.pins = createPins();
    if (ns.currentPlayer === "player1") {
      ns.currentPlayer = "player2";
    } else {
      ns.currentPlayer = "player1";
      ns.currentFrame = Math.min(ns.currentFrame + 1, 9);
      ns.currentRoll = 0;
      if (ns.currentFrame >= 10) ns.gameOver = true;
    }
  } else if (ns.currentRoll === 1) {
    const total = cf.rolls[0] + cf.rolls[1];
    if (total === 10) { cf.isSpare = true; spareFlash = true; }
    cf.isComplete = true;
    ns.pins = createPins();
    if (ns.currentPlayer === "player1") {
      ns.currentPlayer = "player2";
      ns.currentRoll = 0;
    } else {
      ns.currentPlayer = "player1";
      ns.currentFrame = Math.min(ns.currentFrame + 1, 9);
      ns.currentRoll = 0;
      if (ns.currentFrame >= 10) ns.gameOver = true;
    }
  } else {
    // First ball, not a strike → second ball in same frame, but other player goes first
    ns.currentRoll = 1;
    if (ns.currentPlayer === "player1") {
      ns.currentPlayer = "player2";
    } else {
      ns.currentPlayer = "player1";
    }
  }

  ns.player1TotalScore = calcScore(ns.player1Frames);
  ns.player2TotalScore = calcScore(ns.player2Frames);

  if (ns.gameOver) {
    ns.winner = ns.player1TotalScore > ns.player2TotalScore ? "player1"
      : ns.player2TotalScore > ns.player1TotalScore ? "player2" : "tie";
  }

  ns.strikeFlash = strikeFlash;
  ns.spareFlash = spareFlash;

  return ns;
}

function calcScore(frames: Frame[]): number {
  let total = 0;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (f.isStrike) {
      total += 10;
      if (frames[i + 1]) {
        total += frames[i + 1].rolls[0] || 0;
        if (frames[i + 1].isStrike && frames[i + 2]) {
          total += frames[i + 2].rolls[0] || 0;
        } else {
          total += frames[i + 1].rolls[1] || 0;
        }
      }
    } else if (f.isSpare) {
      total += 10;
      if (frames[i + 1]) total += frames[i + 1].rolls[0] || 0;
    } else {
      total += (f.rolls[0] || 0) + (f.rolls[1] || 0);
    }
  }
  return total;
}

export function calculateTotalScore(frames: Frame[]): number {
  return calcScore(frames);
}

export function resetForNextRoll(state: BowlingGameState): BowlingGameState {
  return state;
}
