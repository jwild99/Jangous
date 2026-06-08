// Mini Golf Physics Engine — Server-authoritative deterministic physics

export interface Vector2 {
  x: number;
  y: number;
}

export interface Ball {
  position: Vector2;
  velocity: Vector2;
  isMoving: boolean;
  isInHole: boolean;
  rotation?: number;
  angularVelocity?: number;
  trail?: Vector2[];
}

export interface ObstacleWall {
  type: "wall";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ObstacleSand {
  type: "sand";
  x: number;
  y: number;
  radius: number;
  surfaceMaterial?: string;
}

export interface ObstacleWater {
  type: "water";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ObstacleRamp {
  type: "ramp";
  x: number;
  y: number;
  width: number;
  height: number;
  direction: "up" | "down" | "left" | "right";
  speedMultiplier: number;
}

export type Obstacle = ObstacleWall | ObstacleSand | ObstacleWater | ObstacleRamp;

export interface HoleDefinition {
  id: number;
  name: string;
  par: number;
  spawnPoint: Vector2;
  cupPosition: Vector2;
  cupRadius: number;
  obstacles: Obstacle[];
  bounds: {
    width: number;
    height: number;
  };
}

export interface PlayerState {
  playerId: string;
  ball: Ball;
  strokes: number;
  holeComplete: boolean;
}

export interface MiniGolfGameState {
  currentHole: number;
  totalHoles: number;
  player1: PlayerState;
  player2: PlayerState;
  perHoleStrokes: {
    [holeNumber: number]: {
      player1: number;
      player2: number;
    };
  };
  currentTurn: "player1" | "player2";
  isMatchComplete: boolean;
  winner: "player1" | "player2" | "tie" | null;
  isSuddenDeath: boolean;
  matchSeed?: string; // Match ID used for procedural hole generation
}

// ─── Physics constants ─────────────────────────────────────────────────────
const FRICTION = 0.982;
const BOUNCE_DAMPING = 0.72;
const MIN_VELOCITY = 0.015;
const PHYSICS_TIMESTEP = 1 / 60;
const MAX_SIMULATION_STEPS = 720; // 12 seconds max
const SAND_FRICTION = 0.91;

// ─── Gameplay constants ────────────────────────────────────────────────────
// Hard cap on strokes per hole. If a player can't sink the ball in this many
// strokes, the hole is considered finished for them (prevents infinite bot loops).
export const MAX_STROKES_PER_HOLE = 8;

// ─── Vector utilities ──────────────────────────────────────────────────────
export function addVectors(v1: Vector2, v2: Vector2): Vector2 {
  return { x: v1.x + v2.x, y: v1.y + v2.y };
}
export function scaleVector(v: Vector2, scalar: number): Vector2 {
  return { x: v.x * scalar, y: v.y * scalar };
}
export function magnitude(v: Vector2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}
export function normalize(v: Vector2): Vector2 {
  const mag = magnitude(v);
  if (mag === 0) return { x: 0, y: 0 };
  return { x: v.x / mag, y: v.y / mag };
}
export function distance(p1: Vector2, p2: Vector2): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}
export function dotProduct(v1: Vector2, v2: Vector2): number {
  return v1.x * v2.x + v1.y * v2.y;
}

// ─── Seeded RNG ────────────────────────────────────────────────────────────
// Deterministic: same seed always produces same holes. Used client + server.

function hashString(s: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let z = Math.imul(s ^ (s >>> 15), 1 | s);
    z ^= z + Math.imul(z ^ (z >>> 7), 61 | z);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRng(matchSeed: string, holeIndex: number): () => number {
  // Combine match seed + hole index for per-hole unique stream
  const combined = hashString(`${matchSeed}::h${holeIndex}`);
  return mulberry32(combined);
}

// ─── Geometry helpers ──────────────────────────────────────────────────────
function closestPointOnSegment(p: Vector2, a: Vector2, b: Vector2): Vector2 {
  const ap = { x: p.x - a.x, y: p.y - a.y };
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const ab2 = ab.x * ab.x + ab.y * ab.y;
  if (ab2 === 0) return a;
  const t = Math.max(0, Math.min(1, (ap.x * ab.x + ap.y * ab.y) / ab2));
  return { x: a.x + ab.x * t, y: a.y + ab.y * t };
}

// ─── Obstacle collision ────────────────────────────────────────────────────
export function checkObstacleCollision(
  ball: Ball,
  obstacle: Obstacle,
  hole: HoleDefinition
): {
  collided: boolean;
  newVelocity?: Vector2;
  newPosition?: Vector2;
  penalty?: "water";
} {
  const ballRadius = 5;

  if (obstacle.type === "wall") {
    const closest = closestPointOnSegment(
      ball.position,
      { x: obstacle.x1, y: obstacle.y1 },
      { x: obstacle.x2, y: obstacle.y2 }
    );
    const dist = distance(ball.position, closest);

    if (dist < ballRadius + 2) {
      const wallVec = { x: obstacle.x2 - obstacle.x1, y: obstacle.y2 - obstacle.y1 };
      const wallNorm = normalize({ x: -wallVec.y, y: wallVec.x });
      const dot = dotProduct(ball.velocity, wallNorm);
      const reflection = {
        x: ball.velocity.x - 2 * dot * wallNorm.x,
        y: ball.velocity.y - 2 * dot * wallNorm.y,
      };
      const pushDir = normalize({ x: ball.position.x - closest.x, y: ball.position.y - closest.y });
      const newPosition = {
        x: closest.x + pushDir.x * (ballRadius + 2),
        y: closest.y + pushDir.y * (ballRadius + 2),
      };
      return { collided: true, newVelocity: scaleVector(reflection, BOUNCE_DAMPING), newPosition };
    }
  }

  if (obstacle.type === "sand") {
    const dist = distance(ball.position, { x: obstacle.x, y: obstacle.y });
    if (dist < obstacle.radius) {
      return { collided: true, newVelocity: scaleVector(ball.velocity, SAND_FRICTION) };
    }
  }

  if (obstacle.type === "water") {
    const inWater =
      ball.position.x >= obstacle.x &&
      ball.position.x <= obstacle.x + obstacle.width &&
      ball.position.y >= obstacle.y &&
      ball.position.y <= obstacle.y + obstacle.height;
    if (inWater) {
      return { collided: true, newPosition: { ...hole.spawnPoint }, newVelocity: { x: 0, y: 0 }, penalty: "water" };
    }
  }

  if (obstacle.type === "ramp") {
    const inRamp =
      ball.position.x >= obstacle.x &&
      ball.position.x <= obstacle.x + obstacle.width &&
      ball.position.y >= obstacle.y &&
      ball.position.y <= obstacle.y + obstacle.height;
    if (inRamp) {
      return { collided: true, newVelocity: scaleVector(ball.velocity, obstacle.speedMultiplier) };
    }
  }

  return { collided: false };
}

// ─── Single-step physics ───────────────────────────────────────────────────
function physicsStep(ball: Ball, hole: HoleDefinition): { ball: Ball; waterPenalty: boolean } {
  let currentBall = { ...ball };
  let waterPenalty = false;

  // Friction — check sand first
  let currentFriction = FRICTION;
  for (const obs of hole.obstacles) {
    if (obs.type === "sand") {
      const dist = distance(currentBall.position, { x: obs.x, y: obs.y });
      if (dist < obs.radius) { currentFriction = SAND_FRICTION; break; }
    }
  }
  currentBall.velocity = scaleVector(currentBall.velocity, currentFriction);

  // Stop check
  if (magnitude(currentBall.velocity) < MIN_VELOCITY) {
    return { ball: { ...currentBall, velocity: { x: 0, y: 0 }, isMoving: false }, waterPenalty };
  }

  // Move
  currentBall.position = addVectors(currentBall.position, scaleVector(currentBall.velocity, PHYSICS_TIMESTEP));

  // Spin
  currentBall.rotation = ((currentBall.rotation ?? 0) + magnitude(currentBall.velocity) * PHYSICS_TIMESTEP * 0.3) % (Math.PI * 2);

  // Bounds bounce
  const ballR = 5;
  if (currentBall.position.x < ballR) {
    currentBall.velocity.x = Math.abs(currentBall.velocity.x) * BOUNCE_DAMPING;
    currentBall.position.x = ballR;
  }
  if (currentBall.position.x > hole.bounds.width - ballR) {
    currentBall.velocity.x = -Math.abs(currentBall.velocity.x) * BOUNCE_DAMPING;
    currentBall.position.x = hole.bounds.width - ballR;
  }
  if (currentBall.position.y < ballR) {
    currentBall.velocity.y = Math.abs(currentBall.velocity.y) * BOUNCE_DAMPING;
    currentBall.position.y = ballR;
  }
  if (currentBall.position.y > hole.bounds.height - ballR) {
    currentBall.velocity.y = -Math.abs(currentBall.velocity.y) * BOUNCE_DAMPING;
    currentBall.position.y = hole.bounds.height - ballR;
  }

  // Obstacle collisions
  for (const obs of hole.obstacles) {
    const col = checkObstacleCollision(currentBall, obs, hole);
    if (col.collided) {
      if (col.newVelocity) currentBall.velocity  = col.newVelocity;
      if (col.newPosition) currentBall.position  = col.newPosition;
      if (col.penalty === "water") waterPenalty = true;
    }
  }

  return { ball: currentBall, waterPenalty };
}

// ─── Simulate one shot — instant (server + practice fallback) ──────────────
export function simulateShot(
  ball: Ball,
  initialVelocity: Vector2,
  hole: HoleDefinition
): { finalBall: Ball; waterPenalty: boolean } {
  let currentBall: Ball = { ...ball, velocity: { ...initialVelocity }, isMoving: true };
  let steps = 0;
  let waterPenalty = false;

  while (steps < MAX_SIMULATION_STEPS) {
    steps++;
    const prevPosition = { ...currentBall.position };
    const result = physicsStep(currentBall, hole);
    currentBall = result.ball;
    if (result.waterPenalty) { waterPenalty = true; }

    // Anti-tunneling: resolve obstacle collisions along the path travelled.
    const frameDist = distance(prevPosition, currentBall.position);
    const subSteps = Math.min(8, Math.max(1, Math.ceil(frameDist / 4)));
    for (let s = 1; s <= subSteps; s++) {
      const t = s / subSteps;
      const samplePos = {
        x: prevPosition.x + (currentBall.position.x - prevPosition.x) * t,
        y: prevPosition.y + (currentBall.position.y - prevPosition.y) * t,
      };
      let collidedThisSub = false;
      for (const obs of hole.obstacles) {
        const probe: Ball = { ...currentBall, position: samplePos };
        const col = checkObstacleCollision(probe, obs, hole);
        if (col.collided) {
          if (col.newPosition) currentBall.position = col.newPosition;
          if (col.newVelocity) currentBall.velocity = col.newVelocity;
          if (col.penalty === "water") waterPenalty = true;
          collidedThisSub = true;
          break;
        }
      }
      if (collidedThisSub) break;
    }

    if (!currentBall.isMoving) break;

    // Cup gravity for slow near-cup rolls.
    const distToCup = distance(currentBall.position, hole.cupPosition);
    const speed = magnitude(currentBall.velocity);
    if (distToCup < hole.cupRadius * 3 && speed < 3) {
      const pull = normalize({
        x: hole.cupPosition.x - currentBall.position.x,
        y: hole.cupPosition.y - currentBall.position.y,
      });
      const strength = (1 - distToCup / (hole.cupRadius * 3)) * 0.35;
      currentBall.velocity = {
        x: currentBall.velocity.x + pull.x * strength,
        y: currentBall.velocity.y + pull.y * strength,
      };
    }

    // Speed-gated sink with a tightened radius (fast shots lip out).
    if (distToCup < hole.cupRadius && magnitude(currentBall.velocity) < 12) {
      currentBall.isInHole = true;
      currentBall.isMoving = false;
      currentBall.velocity = { x: 0, y: 0 };
      break;
    }
    if (waterPenalty) break;
  }

  return { finalBall: currentBall, waterPenalty };
}

// ─── Simulate shot — return every N-th step for client animation ───────────
export function simulateShotSteps(
  ball: Ball,
  initialVelocity: Vector2,
  hole: HoleDefinition,
  recordEvery = 1
): { steps: Ball[]; waterPenalty: boolean } {
  const steps: Ball[] = [];
  let currentBall: Ball = { ...ball, velocity: { ...initialVelocity }, isMoving: true, rotation: ball.rotation ?? 0 };
  let stepCount = 0;
  let waterPenalty = false;

  while (stepCount < MAX_SIMULATION_STEPS) {
    stepCount++;
    const prevPosition = { ...currentBall.position };
    const result = physicsStep(currentBall, hole);
    currentBall = result.ball;
    if (result.waterPenalty) waterPenalty = true;

    // Anti-tunneling: sub-sample the path travelled this frame and resolve
    // obstacle collisions at each sub-point so fast shots can't pass through
    // thin walls. Number of sub-steps scales with distance travelled.
    const frameDist = distance(prevPosition, currentBall.position);
    const subSteps = Math.min(8, Math.max(1, Math.ceil(frameDist / 4)));
    for (let s = 1; s <= subSteps; s++) {
      const t = s / subSteps;
      const samplePos = {
        x: prevPosition.x + (currentBall.position.x - prevPosition.x) * t,
        y: prevPosition.y + (currentBall.position.y - prevPosition.y) * t,
      };
      let collidedThisSub = false;
      for (const obs of hole.obstacles) {
        const probe: Ball = { ...currentBall, position: samplePos };
        const col = checkObstacleCollision(probe, obs, hole);
        if (col.collided) {
          if (col.newPosition) currentBall.position = col.newPosition;
          if (col.newVelocity) currentBall.velocity = col.newVelocity;
          if (col.penalty === "water") waterPenalty = true;
          collidedThisSub = true;
          break;
        }
      }
      if (collidedThisSub) break;
    }

    // Cup gravity: when the ball is near the cup and rolling slowly, gently
    // pull it toward the centre so good shots fall in satisfyingly. The pull
    // is small so it never feels fake and fast shots still lip out.
    const distToCup = distance(currentBall.position, hole.cupPosition);
    const speed = magnitude(currentBall.velocity);
    if (distToCup < hole.cupRadius * 3 && speed < 3) {
      const pull = normalize({
        x: hole.cupPosition.x - currentBall.position.x,
        y: hole.cupPosition.y - currentBall.position.y,
      });
      const strength = (1 - distToCup / (hole.cupRadius * 3)) * 0.35;
      currentBall.velocity = {
        x: currentBall.velocity.x + pull.x * strength,
        y: currentBall.velocity.y + pull.y * strength,
      };
    }

    if (stepCount % recordEvery === 0) {
      steps.push({ ...currentBall });
    }

    if (!currentBall.isMoving) {
      steps.push({ ...currentBall });
      break;
    }

    // Sink check: ball must be over the cup AND slow enough, otherwise it
    // rolls over / lips out. Sink radius is tighter than the visual cup.
    if (distToCup < hole.cupRadius && magnitude(currentBall.velocity) < 12) {
      currentBall.isInHole = true;
      currentBall.isMoving = false;
      currentBall.velocity = { x: 0, y: 0 };
      steps.push({ ...currentBall });
      break;
    }
    if (waterPenalty) {
      steps.push({ ...currentBall });
      break;
    }
  }

  return { steps, waterPenalty };
}

// ─── Game state helpers ────────────────────────────────────────────────────
export function initializeMatch(
  player1Id: string,
  player2Id: string,
  totalHoles = 3,
  startingHole = 1,
  matchSeed?: string
): MiniGolfGameState {
  const hole = getHoleDefinition(startingHole, matchSeed);
  return {
    currentHole: startingHole,
    totalHoles,
    player1: {
      playerId: player1Id,
      ball: { position: { ...hole.spawnPoint }, velocity: { x: 0, y: 0 }, isMoving: false, isInHole: false },
      strokes: 0,
      holeComplete: false,
    },
    player2: {
      playerId: player2Id,
      ball: { position: { ...hole.spawnPoint }, velocity: { x: 0, y: 0 }, isMoving: false, isInHole: false },
      strokes: 0,
      holeComplete: false,
    },
    perHoleStrokes: {},
    currentTurn: "player1",
    isMatchComplete: false,
    winner: null,
    isSuddenDeath: false,
    matchSeed,
  };
}

export function processShot(
  gameState: MiniGolfGameState,
  player: "player1" | "player2",
  shotVelocity: Vector2
): MiniGolfGameState {
  const hole = getHoleDefinition(gameState.currentHole, gameState.matchSeed);
  const playerState = gameState[player];
  const { finalBall, waterPenalty } = simulateShot(playerState.ball, shotVelocity, hole);
  const newStrokesUncapped = playerState.strokes + 1 + (waterPenalty ? 1 : 0);
  const newStrokes = Math.min(newStrokesUncapped, MAX_STROKES_PER_HOLE);
  // Hole is complete if the ball is sunk OR the player has hit the per-hole stroke cap
  const reachedStrokeLimit = newStrokes >= MAX_STROKES_PER_HOLE && !finalBall.isInHole;
  const holeComplete = finalBall.isInHole || reachedStrokeLimit;

  const otherPlayer = player === "player1" ? "player2" : "player1";
  const otherPlayerDone = gameState[otherPlayer].holeComplete;

  // Smart turn logic: keep turn with the player who hasn't finished yet.
  let nextTurn: "player1" | "player2";
  if (otherPlayerDone && !holeComplete) {
    nextTurn = player;
  } else {
    nextTurn = otherPlayer;
  }

  return {
    ...gameState,
    [player]: { ...playerState, ball: finalBall, strokes: newStrokes, holeComplete },
    currentTurn: nextTurn,
  };
}

export function advanceToNextHole(gameState: MiniGolfGameState): MiniGolfGameState {
  const holeStrokes = { player1: gameState.player1.strokes, player2: gameState.player2.strokes };
  const updatedState = {
    ...gameState,
    perHoleStrokes: { ...gameState.perHoleStrokes, [gameState.currentHole]: holeStrokes },
  };

  if (updatedState.isSuddenDeath) {
    if (holeStrokes.player1 < holeStrokes.player2) return { ...updatedState, isMatchComplete: true, winner: "player1" };
    if (holeStrokes.player2 < holeStrokes.player1) return { ...updatedState, isMatchComplete: true, winner: "player2" };
    const nextHole = (gameState.currentHole % getTotalHoles()) + 1;
    const nextHoleDef = getHoleDefinition(nextHole, gameState.matchSeed);
    const resetBall = { position: { ...nextHoleDef.spawnPoint }, velocity: { x: 0, y: 0 }, isMoving: false, isInHole: false };
    return { ...updatedState, currentHole: nextHole, currentTurn: "player1", player1: { ...updatedState.player1, ball: resetBall, strokes: 0, holeComplete: false }, player2: { ...updatedState.player2, ball: resetBall, strokes: 0, holeComplete: false } };
  }

  const nextHole = gameState.currentHole + 1;
  if (nextHole > gameState.totalHoles) {
    const completedState = { ...updatedState, isMatchComplete: true };
    const totalScore = calculateTotalScore(completedState);
    if (totalScore.player1Total === totalScore.player2Total) {
      const sdHole = getHoleDefinition(1, gameState.matchSeed);
      const resetBall = { position: { ...sdHole.spawnPoint }, velocity: { x: 0, y: 0 }, isMoving: false, isInHole: false };
      return { ...updatedState, currentHole: 1, currentTurn: "player1", isSuddenDeath: true, player1: { ...updatedState.player1, ball: resetBall, strokes: 0, holeComplete: false }, player2: { ...updatedState.player2, ball: resetBall, strokes: 0, holeComplete: false } };
    }
    return { ...completedState, winner: totalScore.winner };
  }

  const nextHoleDef = getHoleDefinition(nextHole, gameState.matchSeed);
  const resetBall = { position: { ...nextHoleDef.spawnPoint }, velocity: { x: 0, y: 0 }, isMoving: false, isInHole: false };
  return { ...updatedState, currentHole: nextHole, currentTurn: "player1", player1: { ...updatedState.player1, ball: resetBall, strokes: 0, holeComplete: false }, player2: { ...updatedState.player2, ball: resetBall, strokes: 0, holeComplete: false } };
}

export function calculateTotalScore(gameState: MiniGolfGameState): {
  player1Total: number;
  player2Total: number;
  winner: "player1" | "player2" | "tie" | null;
} {
  let p1 = gameState.player1.strokes;
  let p2 = gameState.player2.strokes;
  for (const h in gameState.perHoleStrokes) {
    p1 += gameState.perHoleStrokes[h].player1;
    p2 += gameState.perHoleStrokes[h].player2;
  }
  let winner: "player1" | "player2" | "tie" | null = null;
  if (gameState.isMatchComplete) {
    winner = p1 < p2 ? "player1" : p2 < p1 ? "player2" : "tie";
  }
  return { player1Total: p1, player2Total: p2, winner };
}

// ─── Hole lookup — procedural when matchSeed provided ─────────────────────
export function getHoleDefinition(holeNumber: number, matchSeed?: string): HoleDefinition {
  if (matchSeed) {
    // Generate procedural hole based on match seed + hole number
    return generateProceduralHole(matchSeed, holeNumber - 1);
  }
  // Fall back to curated static holes
  const all = getAllHoles();
  return all[(holeNumber - 1) % all.length] || all[0];
}
export function getTotalHoles(): number { return getAllHoles().length; }

// ─── Boundary walls helper ─────────────────────────────────────────────────
function boundaryWalls(): ObstacleWall[] {
  return [
    { type: "wall", x1: 0,   y1: 0,   x2: 600, y2: 0   },
    { type: "wall", x1: 0,   y1: 600, x2: 600, y2: 600  },
    { type: "wall", x1: 0,   y1: 0,   x2: 0,   y2: 600  },
    { type: "wall", x1: 600, y1: 0,   x2: 600, y2: 600  },
  ];
}

// Clamp helper
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ─── Procedural Hole Archetypes (8 total) ─────────────────────────────────
// Each archetype uses a seeded RNG so it always produces the same hole for the same match.
// All generated holes are guaranteed to have a playable path and safe spawn/cup positions.

type Rng = () => number;

const ARCHETYPE_NAMES = [
  "Challenge Alley",    // 0
  "Left Dogleg",        // 1
  "Right Dogleg",       // 2
  "Slalom Gates",       // 3
  "Island Green",       // 4
  "Bank Shot",          // 5
  "Precision Tunnel",   // 6
  "Hazard Field",       // 7
];

// Archetype 0 — STRAIGHT CHALLENGE
// Horizontal run with alternating baffles from top/bottom, sand hazard, optional water strip
function genStraightChallenge(rng: Rng, id: number): HoleDefinition {
  const spawnX = 50 + rng() * 20;
  const spawnY = clamp(260 + (rng() - 0.5) * 100, 200, 400);
  const cupX   = 520 + rng() * 20;
  const cupY   = clamp(300 + (rng() - 0.5) * 200, 130, 470);

  // Two baffles from alternating sides; leave 200px gap for ball
  const b1x = 160 + rng() * 60;         // 160-220
  const b1h = 100 + rng() * 80;         // 100-180 (from top)
  const b2x = 290 + rng() * 70;         // 290-360
  const b2h = 100 + rng() * 80;         // from bottom
  const b3x = 420 + rng() * 60;         // 420-480
  const b3h = 80 + rng() * 70;
  const b3fromTop = rng() > 0.5;

  // Sand: place off the direct center line (above or below midpoint)
  const sandSide = rng() > 0.5 ? 1 : -1;
  const sandX = 200 + rng() * 150;
  const sandY = clamp(spawnY + sandSide * (80 + rng() * 60), 60, 540);
  const sandR = 28 + rng() * 22;

  // Second optional sand
  const hasSand2 = rng() > 0.55;
  const sand2X = 350 + rng() * 100;
  const sand2Y = clamp(spawnY + (-sandSide) * (80 + rng() * 50), 60, 540);

  // Optional water strip on top or bottom edge
  const hasWater = rng() > 0.6;
  const waterOnTop = rng() > 0.5;
  const waterX = 80 + rng() * 100;
  const waterW = 250 + rng() * 150;

  const obs: Obstacle[] = [
    ...boundaryWalls(),
    { type: "wall", x1: b1x, y1: 0,         x2: b1x, y2: b1h },
    { type: "wall", x1: b2x, y1: 600 - b2h, x2: b2x, y2: 600 },
    ...(b3fromTop
      ? [{ type: "wall" as const, x1: b3x, y1: 0, x2: b3x, y2: b3h }]
      : [{ type: "wall" as const, x1: b3x, y1: 600 - b3h, x2: b3x, y2: 600 }]),
    { type: "sand", x: sandX, y: sandY, radius: sandR },
    ...(hasSand2 ? [{ type: "sand" as const, x: sand2X, y: sand2Y, radius: 22 + rng() * 16 }] : []),
    ...(hasWater
      ? [{ type: "water" as const, x: waterX, y: waterOnTop ? 0 : 540, width: waterW, height: 60 }]
      : []),
  ];

  return { id, name: "Challenge Alley", par: 2, spawnPoint: { x: spawnX, y: spawnY }, cupPosition: { x: cupX, y: cupY }, cupRadius: 12, obstacles: obs, bounds: { width: 600, height: 600 } };
}

// Archetype 1 — LEFT DOGLEG
// Spawn bottom-left, first leg goes right, then turns upward to cup at top-right
function genDoglegLeft(rng: Rng, id: number): HoleDefinition {
  const channelW  = 110 + rng() * 60;   // channel width: 110-170
  const spawnY    = clamp(500 + rng() * 40, 490, 545);
  const spawnX    = 45 + rng() * 20;
  const turnX     = clamp(320 + rng() * 100, 300, 420);
  const cupY      = clamp(60 + rng() * 60, 50, 120);
  const cupX      = clamp(turnX + (rng() - 0.5) * 40, turnX - 30, turnX + 30);

  // Channel: horizontal at bottom, then vertical up to cup
  const hChanTop  = spawnY - channelW / 2;   // top wall of horizontal channel
  const hChanBot  = spawnY + channelW / 2;   // bottom wall
  const vChanLeft = turnX - channelW / 2;
  const vChanRight= turnX + channelW / 2;

  // Optional hazard at corner turn
  const hasCornerHazard = rng() > 0.45;
  const sandAtCorner: Obstacle[] = hasCornerHazard && rng() > 0.5
    ? [{ type: "sand", x: turnX, y: spawnY - channelW * 0.3, radius: 30 }]
    : [];
  const waterAtCorner: Obstacle[] = hasCornerHazard && rng() <= 0.5
    ? [{ type: "water", x: vChanLeft + 10, y: hChanTop + 10, width: channelW - 20, height: 60 }]
    : [];

  // Extra sand in vertical leg
  const hasMidSand = rng() > 0.5;
  const midSandY = clamp((hChanTop + cupY) / 2 + (rng() - 0.5) * 60, cupY + 60, hChanTop - 60);

  const obs: Obstacle[] = [
    ...boundaryWalls(),
    // Inner top wall of horizontal channel (from spawn side to turn)
    { type: "wall", x1: spawnX + 20, y1: hChanTop, x2: vChanLeft, y2: hChanTop },
    // Inner bottom wall of horizontal channel → extends past turn to right boundary
    { type: "wall", x1: spawnX + 20, y1: hChanBot, x2: 600, y2: hChanBot },
    // Left wall of vertical channel (from top to corner)
    { type: "wall", x1: vChanLeft, y1: 0, x2: vChanLeft, y2: hChanTop },
    // Right wall of vertical channel (from top to bottom channel)
    { type: "wall", x1: vChanRight, y1: 0, x2: vChanRight, y2: hChanBot },
    ...sandAtCorner,
    ...waterAtCorner,
    ...(hasMidSand ? [{ type: "sand" as const, x: turnX, y: midSandY, radius: 26 }] : []),
  ];

  return { id, name: "Left Dogleg", par: 3, spawnPoint: { x: spawnX, y: spawnY }, cupPosition: { x: cupX, y: cupY }, cupRadius: 12, obstacles: obs, bounds: { width: 600, height: 600 } };
}

// Archetype 2 — RIGHT DOGLEG
// Spawn top-left, goes right then turns down to cup at bottom-right
function genDoglegRight(rng: Rng, id: number): HoleDefinition {
  const channelW  = 110 + rng() * 60;
  const spawnY    = clamp(55 + rng() * 40, 50, 110);
  const spawnX    = 45 + rng() * 20;
  const turnX     = clamp(320 + rng() * 100, 300, 420);
  const cupY      = clamp(500 + rng() * 50, 490, 545);
  const cupX      = clamp(turnX + (rng() - 0.5) * 40, turnX - 30, turnX + 30);

  const hChanTop  = spawnY - channelW / 2;
  const hChanBot  = spawnY + channelW / 2;
  const vChanLeft = turnX - channelW / 2;
  const vChanRight= turnX + channelW / 2;

  const hasCornerHazard = rng() > 0.45;
  const sandAtCorner: Obstacle[] = hasCornerHazard && rng() > 0.5
    ? [{ type: "sand", x: turnX, y: spawnY + channelW * 0.3, radius: 30 }]
    : [];
  const waterAtCorner: Obstacle[] = hasCornerHazard && rng() <= 0.5
    ? [{ type: "water", x: vChanLeft + 10, y: hChanBot - 10, width: channelW - 20, height: 60 }]
    : [];

  const hasMidSand = rng() > 0.5;
  const midSandY = clamp((hChanBot + cupY) / 2 + (rng() - 0.5) * 60, hChanBot + 60, cupY - 60);

  const obs: Obstacle[] = [
    ...boundaryWalls(),
    { type: "wall", x1: spawnX + 20, y1: hChanTop, x2: 600, y2: hChanTop },
    { type: "wall", x1: spawnX + 20, y1: hChanBot, x2: vChanLeft, y2: hChanBot },
    { type: "wall", x1: vChanLeft,   y1: hChanTop, x2: vChanLeft, y2: 600 },
    { type: "wall", x1: vChanRight,  y1: hChanBot, x2: vChanRight, y2: 600 },
    ...sandAtCorner,
    ...waterAtCorner,
    ...(hasMidSand ? [{ type: "sand" as const, x: turnX, y: midSandY, radius: 26 }] : []),
  ];

  return { id, name: "Right Dogleg", par: 3, spawnPoint: { x: spawnX, y: spawnY }, cupPosition: { x: cupX, y: cupY }, cupRadius: 12, obstacles: obs, bounds: { width: 600, height: 600 } };
}

// Archetype 3 — SLALOM GATES
// Three vertical gate walls with alternating openings; spawn left, cup right
function genSlalom(rng: Rng, id: number): HoleDefinition {
  const spawnY = clamp(280 + (rng() - 0.5) * 60, 240, 360);
  const cupY   = clamp(280 + (rng() - 0.5) * 80, 220, 380);
  const gateOpen = 160 + rng() * 50;    // gap in each gate: 160-210px

  // Gate x positions
  const g1x = 140 + rng() * 30;
  const g2x = 280 + rng() * 30;
  const g3x = 420 + rng() * 30;

  // Which side is open: alternating, randomize start
  const firstFromTop = rng() > 0.5;

  function gateWalls(gx: number, openFromTop: boolean, openSize: number): ObstacleWall[] {
    if (openFromTop) {
      // Open gap at top (ball can go through top zone)
      return [
        { type: "wall", x1: gx, y1: openSize, x2: gx, y2: 600 },
      ];
    } else {
      // Open gap at bottom
      return [
        { type: "wall", x1: gx, y1: 0, x2: gx, y2: 600 - openSize },
      ];
    }
  }

  const g1walls = gateWalls(g1x, firstFromTop, gateOpen);
  const g2walls = gateWalls(g2x, !firstFromTop, gateOpen);
  const g3walls = gateWalls(g3x, firstFromTop, gateOpen);

  // Water hazard between gate 1 and 2, on the opposite side of the gap
  const hasWater = rng() > 0.4;
  const waterY = firstFromTop ? 600 - 80 : 0;  // on the blocked side
  const waterX = g1x + 20;
  const waterW = g2x - g1x - 40;

  // Sand in the middle (between gates)
  const hasSand = rng() > 0.5;
  const sandX = (g1x + g2x) / 2;
  const sandY = firstFromTop ? 600 - 60 : 60;

  const obs: Obstacle[] = [
    ...boundaryWalls(),
    ...g1walls, ...g2walls, ...g3walls,
    ...(hasWater && waterW > 60 ? [{ type: "water" as const, x: waterX, y: waterY, width: waterW, height: 70 }] : []),
    ...(hasSand ? [{ type: "sand" as const, x: sandX, y: sandY, radius: 28 }] : []),
  ];

  return { id, name: "Slalom Gates", par: 3, spawnPoint: { x: 45, y: spawnY }, cupPosition: { x: 545, y: cupY }, cupRadius: 12, obstacles: obs, bounds: { width: 600, height: 600 } };
}

// Archetype 4 — ISLAND GREEN
// Cup in center surrounded by water moat; gap on one random side; ramp near spawn
function genIsland(rng: Rng, id: number): HoleDefinition {
  const islandSize = 90 + rng() * 40;      // island radius: 90-130
  const cx = 300, cy = 300;
  const moatW = islandSize + 60;           // moat outer edge
  const moatInner = islandSize;

  const gapSide = Math.floor(rng() * 4);   // 0=top 1=right 2=bottom 3=left
  const gapSize = 60 + rng() * 30;

  // Moat as 4 rectangles leaving a gap on gapSide
  const moatObstacles: ObstacleWater[] = [];
  const x0 = cx - moatW, y0 = cy - moatW;
  const x1 = cx + moatW, y1 = cy + moatW;
  const iX0 = cx - moatInner, iY0 = cy - moatInner;
  const iX1 = cx + moatInner, iY1 = cy + moatInner;

  const gapHalf = gapSize / 2;
  if (gapSide === 0) {
    // Gap at top — water left + right of gap on top edge
    moatObstacles.push({ type: "water", x: x0, y: iY0, width: moatInner - gapHalf, height: moatW - moatInner });
    moatObstacles.push({ type: "water", x: cx + gapHalf, y: iY0, width: moatInner - gapHalf, height: moatW - moatInner });
    moatObstacles.push({ type: "water", x: iX0, y: y0, width: moatInner * 2, height: moatW - moatInner }); // far top
    moatObstacles.push({ type: "water", x: x0, y: iY0, width: moatW - moatInner, height: moatInner * 2 }); // left
    moatObstacles.push({ type: "water", x: iX1, y: iY0, width: moatW - moatInner, height: moatInner * 2 }); // right
    moatObstacles.push({ type: "water", x: iX0, y: iY1, width: moatInner * 2, height: moatW - moatInner }); // bottom
  } else if (gapSide === 1) {
    // Gap at right
    moatObstacles.push({ type: "water", x: iX1, y: cy - gapHalf, width: moatW - moatInner, height: moatInner - gapHalf });
    moatObstacles.push({ type: "water", x: iX1, y: cy + gapHalf, width: moatW - moatInner, height: moatInner - gapHalf });
    moatObstacles.push({ type: "water", x: x0, y: iY0, width: moatW - moatInner, height: moatInner * 2 }); // left
    moatObstacles.push({ type: "water", x: iX0, y: y0, width: moatInner * 2, height: moatW - moatInner }); // top
    moatObstacles.push({ type: "water", x: iX0, y: iY1, width: moatInner * 2, height: moatW - moatInner }); // bottom
  } else if (gapSide === 2) {
    // Gap at bottom
    moatObstacles.push({ type: "water", x: iX0, y: iY1, width: moatInner - gapHalf, height: moatW - moatInner });
    moatObstacles.push({ type: "water", x: cx + gapHalf, y: iY1, width: moatInner - gapHalf, height: moatW - moatInner });
    moatObstacles.push({ type: "water", x: iX0, y: y0, width: moatInner * 2, height: moatW - moatInner }); // top
    moatObstacles.push({ type: "water", x: x0, y: iY0, width: moatW - moatInner, height: moatInner * 2 }); // left
    moatObstacles.push({ type: "water", x: iX1, y: iY0, width: moatW - moatInner, height: moatInner * 2 }); // right
  } else {
    // Gap at left
    moatObstacles.push({ type: "water", x: x0, y: cy - gapHalf, width: moatW - moatInner, height: moatInner - gapHalf });
    moatObstacles.push({ type: "water", x: x0, y: cy + gapHalf, width: moatW - moatInner, height: moatInner - gapHalf });
    moatObstacles.push({ type: "water", x: iX1, y: iY0, width: moatW - moatInner, height: moatInner * 2 }); // right
    moatObstacles.push({ type: "water", x: iX0, y: y0, width: moatInner * 2, height: moatW - moatInner }); // top
    moatObstacles.push({ type: "water", x: iX0, y: iY1, width: moatInner * 2, height: moatW - moatInner }); // bottom
  }

  // Spawn opposite the gap
  const spawnPoints: Record<number, Vector2> = {
    0: { x: 300, y: 540 }, // gap top → spawn bottom
    1: { x: 60, y: 300 },  // gap right → spawn left
    2: { x: 300, y: 60 },  // gap bottom → spawn top
    3: { x: 540, y: 300 }, // gap left → spawn right
  };
  const spawn = spawnPoints[gapSide] || { x: 60, y: 300 };

  // Ramp boost on spawn side to help reach island
  const rampDir: Record<number, "up"|"down"|"left"|"right"> = { 0: "up", 1: "right", 2: "down", 3: "left" };
  const rampPositions: Record<number, { x: number; y: number; w: number; h: number }> = {
    0: { x: 265, y: 460, w: 70, h: 50 },
    1: { x: 90,  y: 265, w: 50, h: 70 },
    2: { x: 265, y: 90,  w: 70, h: 50 },
    3: { x: 460, y: 265, w: 50, h: 70 },
  };
  const rp = rampPositions[gapSide];

  const obs: Obstacle[] = [
    ...boundaryWalls(),
    ...moatObstacles,
    { type: "ramp", x: rp.x, y: rp.y, width: rp.w, height: rp.h, direction: rampDir[gapSide], speedMultiplier: 1.4 },
  ];

  return { id, name: "Island Green", par: 4, spawnPoint: spawn, cupPosition: { x: cx, y: cy }, cupRadius: 14, obstacles: obs, bounds: { width: 600, height: 600 } };
}

// Archetype 5 — BANK SHOT
// Diagonal wall blocks direct path; must bank to reach cup
function genBankShot(rng: Rng, id: number): HoleDefinition {
  const spawnX = 55 + rng() * 20;
  const spawnY = 480 + rng() * 60;

  // Cup: top-right corner area
  const cupX = 500 + rng() * 50;
  const cupY = 60 + rng() * 80;

  // Large diagonal wall separating spawn area from cup area
  const wallX1 = 150 + rng() * 80;  // left end near bottom
  const wallY1 = 200 + rng() * 80;  // around y=200-280
  const wallX2 = 380 + rng() * 80;  // right end further right
  const wallY2 = wallY1 + 60 + rng() * 80;  // angled down

  // Second diagonal for bank opportunity
  const wall2X1 = wallX2 - 20;
  const wall2Y1 = wallY2;
  const wall2X2 = 600;
  const wall2Y2 = wallY2 + 40 + rng() * 60;

  // Sand traps near miss zones
  const sand1X = clamp(wallX1 - 60, 60, 300);
  const sand1Y = clamp(wallY1 + 60, 80, 500);
  const sand2X = clamp(wallX2 + 30, 200, 520);
  const sand2Y = clamp(wallY2 - 80, 60, 500);

  const hasWater = rng() > 0.45;
  const waterX = clamp(wallX1 + 20, 80, 350);
  const waterY = clamp(wallY1 + 20, 60, 400);
  const waterW = 80 + rng() * 60;
  const waterH = 50 + rng() * 40;

  const obs: Obstacle[] = [
    ...boundaryWalls(),
    { type: "wall", x1: wallX1, y1: wallY1, x2: wallX2, y2: wallY2 },
    { type: "wall", x1: wall2X1, y1: wall2Y1, x2: wall2X2, y2: wall2Y2 },
    { type: "sand", x: sand1X, y: sand1Y, radius: 28 + rng() * 16 },
    { type: "sand", x: sand2X, y: sand2Y, radius: 26 + rng() * 14 },
    ...(hasWater ? [{ type: "water" as const, x: waterX, y: waterY, width: waterW, height: waterH }] : []),
  ];

  return { id, name: "Bank Shot", par: 3, spawnPoint: { x: spawnX, y: spawnY }, cupPosition: { x: cupX, y: cupY }, cupRadius: 12, obstacles: obs, bounds: { width: 600, height: 600 } };
}

// Archetype 6 — PRECISION TUNNEL
// Very narrow channel; requires careful aiming; sand inside tunnel
function genPrecisionTunnel(rng: Rng, id: number): HoleDefinition {
  const channelH = 60 + rng() * 40;   // channel height: 60-100px
  const spawnY   = 300;
  const spawnX   = 45;
  const cupX     = 545;
  const cupY     = clamp(300 + (rng() - 0.5) * 40, 270, 330);

  // Narrow horizontal channel walls
  const chanTop = spawnY - channelH / 2;
  const chanBot = spawnY + channelH / 2;

  // Optional kink: channel shifts up or down in the middle
  const hasKink = rng() > 0.45;
  const kinkX = 260 + rng() * 80;  // where the kink is
  const kinkShift = (rng() - 0.5) * 60;  // how much it shifts

  // Sand traps inside the narrow channel
  const sand1X = 160 + rng() * 80;
  const sand1Y = spawnY + (rng() - 0.5) * (channelH * 0.3);

  const sand2X = 360 + rng() * 80;
  const sand2Y = spawnY + (hasKink ? kinkShift * 0.5 : 0);

  // Water hazard outside the channel (beyond the walls — visually informative)
  const hasTopWater = rng() > 0.5;
  const hasBotWater = rng() > 0.5;

  const obs: Obstacle[] = [
    ...boundaryWalls(),
    // Top wall of channel (left segment)
    { type: "wall", x1: 50,    y1: chanTop,            x2: hasKink ? kinkX : 590, y2: chanTop },
    // Bottom wall (left segment)
    { type: "wall", x1: 50,    y1: chanBot,            x2: hasKink ? kinkX : 590, y2: chanBot },
    ...(hasKink ? [
      // Top wall right segment (shifted)
      { type: "wall" as const, x1: kinkX, y1: chanTop + kinkShift, x2: 560, y2: chanTop + kinkShift },
      // Bottom wall right segment (shifted)
      { type: "wall" as const, x1: kinkX, y1: chanBot + kinkShift, x2: 560, y2: chanBot + kinkShift },
      // Connector walls at kink
      { type: "wall" as const, x1: kinkX, y1: chanTop, x2: kinkX, y2: chanTop + kinkShift },
      { type: "wall" as const, x1: kinkX, y1: chanBot, x2: kinkX, y2: chanBot + kinkShift },
    ] : []),
    { type: "sand", x: sand1X, y: sand1Y, radius: Math.min(22, channelH * 0.3) },
    { type: "sand", x: sand2X, y: hasKink ? clamp(spawnY + kinkShift * 0.5, chanTop + 20, chanBot - 20) : spawnY, radius: Math.min(20, channelH * 0.28) },
    ...(hasTopWater ? [{ type: "water" as const, x: 80, y: 0, width: 440, height: Math.max(0, chanTop - 10) }] : []),
    ...(hasBotWater ? [{ type: "water" as const, x: 80, y: chanBot + 10, width: 440, height: Math.max(0, 600 - chanBot - 10) }] : []),
  ];

  return { id, name: "Precision Tunnel", par: 3, spawnPoint: { x: spawnX, y: spawnY }, cupPosition: { x: cupX, y: cupY }, cupRadius: 11, obstacles: obs, bounds: { width: 600, height: 600 } };
}

// Archetype 7 — HAZARD FIELD
// Open field scattered with water and sand hazards; clear path exists but requires navigation
function genHazardField(rng: Rng, id: number): HoleDefinition {
  const spawnX = 50 + rng() * 30;
  const spawnY = clamp(280 + (rng() - 0.5) * 80, 220, 380);
  const cupX   = 510 + rng() * 40;
  const cupY   = clamp(280 + (rng() - 0.5) * 100, 200, 400);

  // Place 2 water patches and 2-3 sand traps in the middle region
  // Keep them away from spawn (first 120px) and cup (last 80px)
  // And away from center Y line by at least 40px
  const hazardsX = [160, 260, 360, 450];  // x lanes for hazards
  const midY = (spawnY + cupY) / 2;

  const w1x = hazardsX[0] + rng() * 40;
  const w1y = clamp(midY + (rng() > 0.5 ? 80 : -120), 60, 480);
  const w1w = 80 + rng() * 60;
  const w1h = 50 + rng() * 40;

  const w2x = hazardsX[2] + rng() * 50;
  const w2y = clamp(midY + (rng() > 0.5 ? -120 : 80), 60, 480);
  const w2w = 70 + rng() * 60;
  const w2h = 50 + rng() * 40;

  // Sand traps between/around water
  const s1x = hazardsX[1] + (rng() - 0.5) * 40;
  const s1y = clamp(midY + (rng() - 0.5) * 40, 80, 520);

  const s2x = hazardsX[3] + (rng() - 0.5) * 30;
  const s2y = clamp(midY + (rng() - 0.5) * 50, 80, 520);

  const s3x = 200 + rng() * 200;
  const s3y = clamp(midY - 60, 60, 540);

  // Wall block: one center island wall for bank shot opportunity
  const hasBlock = rng() > 0.5;
  const blockX = 260 + rng() * 80;
  const blockY = clamp(midY + (rng() - 0.5) * 60, 120, 480);
  const blockLen = 60 + rng() * 50;

  const obs: Obstacle[] = [
    ...boundaryWalls(),
    { type: "water", x: w1x, y: w1y, width: w1w, height: w1h },
    { type: "water", x: w2x, y: w2y, width: w2w, height: w2h },
    { type: "sand", x: s1x, y: s1y, radius: 28 + rng() * 18 },
    { type: "sand", x: s2x, y: s2y, radius: 26 + rng() * 16 },
    { type: "sand", x: s3x, y: s3y, radius: 22 + rng() * 14 },
    ...(hasBlock ? [
      { type: "wall" as const, x1: blockX, y1: blockY, x2: blockX + blockLen * 0.7, y2: blockY - blockLen * 0.5 },
    ] : []),
  ];

  return { id, name: "Hazard Field", par: 4, spawnPoint: { x: spawnX, y: spawnY }, cupPosition: { x: cupX, y: cupY }, cupRadius: 12, obstacles: obs, bounds: { width: 600, height: 600 } };
}

// ─── Main procedural generator ─────────────────────────────────────────────
const ARCHETYPES = [
  genStraightChallenge,  // 0
  genDoglegLeft,         // 1
  genDoglegRight,        // 2
  genSlalom,             // 3
  genIsland,             // 4
  genBankShot,           // 5
  genPrecisionTunnel,    // 6
  genHazardField,        // 7
];

// Sequence of archetypes per hole — designed for variety and escalating challenge
// Repeats after 9 holes
const ARCHETYPE_SEQUENCE = [0, 1, 3, 6, 4, 5, 2, 7, 0];

export function generateProceduralHole(matchSeed: string, holeIndex: number): HoleDefinition {
  const archetypeIdx = ARCHETYPE_SEQUENCE[holeIndex % ARCHETYPE_SEQUENCE.length];
  const rng = seededRng(matchSeed, holeIndex);
  const generator = ARCHETYPES[archetypeIdx];
  return generator(rng, holeIndex + 1);
}

// ─── Hole Definitions (9 curated static holes) ────────────────────────────
// Used as fallback when no matchSeed is provided.
const holeDefinitions: HoleDefinition[] = [
  {
    // Hole 1 — Night Drive (Par 2) — straight with one sand trap offset
    id: 1, name: "Night Drive", par: 2,
    spawnPoint: { x: 60, y: 300 }, cupPosition: { x: 540, y: 300 }, cupRadius: 12,
    bounds: { width: 600, height: 600 },
    obstacles: [
      { type: "wall", x1: 0,   y1: 0,   x2: 600, y2: 0 },
      { type: "wall", x1: 0,   y1: 600, x2: 600, y2: 600 },
      { type: "wall", x1: 0,   y1: 0,   x2: 0,   y2: 600 },
      { type: "wall", x1: 600, y1: 0,   x2: 600, y2: 600 },
      { type: "sand", x: 280, y: 420, radius: 40 },
    ],
  },
  {
    // Hole 2 — Dog Leg (Par 3) — L-shaped corridor
    id: 2, name: "Dog Leg", par: 3,
    spawnPoint: { x: 60, y: 480 }, cupPosition: { x: 480, y: 120 }, cupRadius: 12,
    bounds: { width: 600, height: 600 },
    obstacles: [
      { type: "wall", x1: 0,   y1: 0,   x2: 600, y2: 0 },
      { type: "wall", x1: 0,   y1: 600, x2: 600, y2: 600 },
      { type: "wall", x1: 0,   y1: 0,   x2: 0,   y2: 600 },
      { type: "wall", x1: 600, y1: 0,   x2: 600, y2: 600 },
      { type: "wall", x1: 200, y1: 0,   x2: 200, y2: 320 },
      { type: "wall", x1: 200, y1: 320, x2: 500, y2: 320 },
      { type: "wall", x1: 500, y1: 320, x2: 500, y2: 600 },
      { type: "sand", x: 110, y: 380, radius: 35 },
    ],
  },
  {
    // Hole 3 — Gauntlet (Par 3) — alternating slalom walls
    id: 3, name: "The Gauntlet", par: 3,
    spawnPoint: { x: 60, y: 300 }, cupPosition: { x: 540, y: 300 }, cupRadius: 12,
    bounds: { width: 600, height: 600 },
    obstacles: [
      { type: "wall", x1: 0,   y1: 0,   x2: 600, y2: 0 },
      { type: "wall", x1: 0,   y1: 600, x2: 600, y2: 600 },
      { type: "wall", x1: 0,   y1: 0,   x2: 0,   y2: 600 },
      { type: "wall", x1: 600, y1: 0,   x2: 600, y2: 600 },
      { type: "wall", x1: 160, y1: 0,   x2: 160, y2: 200 },
      { type: "wall", x1: 160, y1: 400, x2: 160, y2: 600 },
      { type: "wall", x1: 300, y1: 150, x2: 300, y2: 450 },
      { type: "wall", x1: 440, y1: 0,   x2: 440, y2: 200 },
      { type: "wall", x1: 440, y1: 400, x2: 440, y2: 600 },
      { type: "water", x: 200, y: 230, width: 80, height: 140 },
    ],
  },
  {
    // Hole 4 — The Island (Par 4) — water moat around cup area
    id: 4, name: "The Island", par: 4,
    spawnPoint: { x: 60, y: 60 }, cupPosition: { x: 300, y: 300 }, cupRadius: 14,
    bounds: { width: 600, height: 600 },
    obstacles: [
      { type: "wall", x1: 0,   y1: 0,   x2: 600, y2: 0 },
      { type: "wall", x1: 0,   y1: 600, x2: 600, y2: 600 },
      { type: "wall", x1: 0,   y1: 0,   x2: 0,   y2: 600 },
      { type: "wall", x1: 600, y1: 0,   x2: 600, y2: 600 },
      { type: "water", x: 160, y: 160, width: 280, height: 80  },
      { type: "water", x: 160, y: 360, width: 280, height: 80  },
      { type: "water", x: 160, y: 240, width: 80,  height: 120 },
      { type: "water", x: 360, y: 240, width: 80,  height: 120 },
      { type: "ramp", x: 60,  y: 270, width: 60, height: 60, direction: "right", speedMultiplier: 1.4 },
    ],
  },
  {
    // Hole 5 — Ricochet (Par 3) — diagonal walls for bank shots
    id: 5, name: "Ricochet", par: 3,
    spawnPoint: { x: 60, y: 540 }, cupPosition: { x: 540, y: 60 }, cupRadius: 12,
    bounds: { width: 600, height: 600 },
    obstacles: [
      { type: "wall", x1: 0,   y1: 0,   x2: 600, y2: 0 },
      { type: "wall", x1: 0,   y1: 600, x2: 600, y2: 600 },
      { type: "wall", x1: 0,   y1: 0,   x2: 0,   y2: 600 },
      { type: "wall", x1: 600, y1: 0,   x2: 600, y2: 600 },
      { type: "wall", x1: 150, y1: 300, x2: 300, y2: 150 },
      { type: "wall", x1: 300, y1: 450, x2: 450, y2: 300 },
      { type: "sand", x: 300, y: 300, radius: 30 },
    ],
  },
  {
    // Hole 6 — Speed Run (Par 2) — ramps for a fast straight shot
    id: 6, name: "Speed Run", par: 2,
    spawnPoint: { x: 60, y: 300 }, cupPosition: { x: 540, y: 300 }, cupRadius: 12,
    bounds: { width: 600, height: 600 },
    obstacles: [
      { type: "wall", x1: 0,   y1: 0,   x2: 600, y2: 0 },
      { type: "wall", x1: 0,   y1: 600, x2: 600, y2: 600 },
      { type: "wall", x1: 0,   y1: 0,   x2: 0,   y2: 600 },
      { type: "wall", x1: 600, y1: 0,   x2: 600, y2: 600 },
      { type: "wall", x1: 100, y1: 0,   x2: 100, y2: 200 },
      { type: "wall", x1: 100, y1: 400, x2: 100, y2: 600 },
      { type: "wall", x1: 500, y1: 0,   x2: 500, y2: 200 },
      { type: "wall", x1: 500, y1: 400, x2: 500, y2: 600 },
      { type: "ramp", x: 180, y: 250, width: 80,  height: 100, direction: "right", speedMultiplier: 1.5 },
      { type: "ramp", x: 340, y: 250, width: 80,  height: 100, direction: "right", speedMultiplier: 1.3 },
    ],
  },
  {
    // Hole 7 — The Maze (Par 5)
    id: 7, name: "The Maze", par: 5,
    spawnPoint: { x: 40, y: 40 }, cupPosition: { x: 560, y: 560 }, cupRadius: 14,
    bounds: { width: 600, height: 600 },
    obstacles: [
      { type: "wall", x1: 0,   y1: 0,   x2: 600, y2: 0 },
      { type: "wall", x1: 0,   y1: 600, x2: 600, y2: 600 },
      { type: "wall", x1: 0,   y1: 0,   x2: 0,   y2: 600 },
      { type: "wall", x1: 600, y1: 0,   x2: 600, y2: 600 },
      { type: "wall", x1: 100, y1: 100, x2: 500, y2: 100 },
      { type: "wall", x1: 500, y1: 100, x2: 500, y2: 300 },
      { type: "wall", x1: 200, y1: 200, x2: 200, y2: 400 },
      { type: "wall", x1: 200, y1: 400, x2: 400, y2: 400 },
      { type: "wall", x1: 400, y1: 200, x2: 400, y2: 300 },
      { type: "wall", x1: 100, y1: 300, x2: 300, y2: 300 },
      { type: "wall", x1: 100, y1: 300, x2: 100, y2: 500 },
      { type: "wall", x1: 300, y1: 500, x2: 500, y2: 500 },
      { type: "water", x: 420, y: 420, width: 80, height: 80 },
      { type: "sand",  x: 150, y: 200, radius: 28 },
    ],
  },
  {
    // Hole 8 — Double Bend (Par 4)
    id: 8, name: "Double Bend", par: 4,
    spawnPoint: { x: 60, y: 540 }, cupPosition: { x: 540, y: 540 }, cupRadius: 12,
    bounds: { width: 600, height: 600 },
    obstacles: [
      { type: "wall", x1: 0,   y1: 0,   x2: 600, y2: 0 },
      { type: "wall", x1: 0,   y1: 600, x2: 600, y2: 600 },
      { type: "wall", x1: 0,   y1: 0,   x2: 0,   y2: 600 },
      { type: "wall", x1: 600, y1: 0,   x2: 600, y2: 600 },
      { type: "wall", x1: 200, y1: 600, x2: 200, y2: 350 },
      { type: "wall", x1: 200, y1: 350, x2: 400, y2: 350 },
      { type: "wall", x1: 400, y1: 350, x2: 400, y2: 0 },
      { type: "water", x: 210, y: 360, width: 180, height: 50 },
      { type: "sand",  x: 100, y: 480,  radius: 32 },
      { type: "sand",  x: 500, y: 480,  radius: 32 },
    ],
  },
  {
    // Hole 9 — Pinball (Par 3) — diamond obstacle
    id: 9, name: "Pinball", par: 3,
    spawnPoint: { x: 60, y: 300 }, cupPosition: { x: 540, y: 300 }, cupRadius: 12,
    bounds: { width: 600, height: 600 },
    obstacles: [
      { type: "wall", x1: 0,   y1: 0,   x2: 600, y2: 0 },
      { type: "wall", x1: 0,   y1: 600, x2: 600, y2: 600 },
      { type: "wall", x1: 0,   y1: 0,   x2: 0,   y2: 600 },
      { type: "wall", x1: 600, y1: 0,   x2: 600, y2: 600 },
      { type: "wall", x1: 300, y1: 200, x2: 380, y2: 300 },
      { type: "wall", x1: 380, y1: 300, x2: 300, y2: 400 },
      { type: "wall", x1: 300, y1: 400, x2: 220, y2: 300 },
      { type: "wall", x1: 220, y1: 300, x2: 300, y2: 200 },
      { type: "sand", x: 150, y: 150, radius: 30 },
      { type: "sand", x: 450, y: 450, radius: 30 },
      { type: "water", x: 240, y: 0,   width: 120, height: 60 },
      { type: "water", x: 240, y: 540, width: 120, height: 60 },
    ],
  },
];

export function getAllHoles(): HoleDefinition[] { return holeDefinitions; }
export const holes: HoleDefinition[] = holeDefinitions;
