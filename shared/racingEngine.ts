// AAA Arcade Top-Down Racing Engine — full overhaul

export interface CarState {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  speed: number;
  steer: number;
  throttle: number;
  brake: number;
  lap: number;
  nextCheckpoint: number;
  finished: boolean;
  currentLapTime: number;
  totalTime: number;
  offTrack: boolean;
  drifting: boolean;
  nearestTrackIdx: number;
  checkpointCooldown: number;
  lastLapFlash: number;
}

export interface TrackPoint { x: number; y: number; }

export interface TireMark { x: number; y: number; alpha: number; angle: number; }

export interface RacingTrack {
  name: string;
  description: string;
  difficulty: "Beginner" | "Medium" | "Expert";
  points: TrackPoint[];
  width: number;
  laps: number;
  color: string;
}

export type RacePhase = "reveal" | "countdown" | "racing" | "finished" | "over";

export interface RacingState {
  phase: RacePhase;
  car: CarState;
  countdown: number;
  revealTimer: number;
  currentPlayer: "player1" | "player2";
  player1Time?: number;
  player2Time?: number;
  winner?: "player1" | "player2" | "draw";
  track: RacingTrack;
  tireMarks: TireMark[];
  elapsed: number;
}

export const RACING_CONSTANTS = {
  MAX_SPEED: 7.5,
  ACCEL: 0.32,
  BRAKE_FORCE: 0.88,
  DRAG: 0.973,
  TURN_RATE: 0.075,
  GRIP: 0.22,
  OFF_TRACK_SPEED_MULT: 0.6,
  OFF_TRACK_GRIP: 0.55,
  WALL_PUSH: 5,
} as const;

// ─── Track definitions ────────────────────────────────────────────────────────

function bz(p0: TrackPoint, p1: TrackPoint, p2: TrackPoint, p3: TrackPoint, steps = 12): TrackPoint[] {
  const pts: TrackPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    pts.push({
      x: mt**3*p0.x + 3*mt**2*t*p1.x + 3*mt*t**2*p2.x + t**3*p3.x,
      y: mt**3*p0.y + 3*mt**2*t*p1.y + 3*mt*t**2*p2.y + t**3*p3.y,
    });
  }
  return pts;
}

function buildTrack(...segments: TrackPoint[][]): TrackPoint[] {
  const pts: TrackPoint[] = [];
  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si];
    const start = si === 0 ? 0 : 1;
    for (let i = start; i < seg.length; i++) pts.push(seg[i]);
  }
  return pts;
}

// Track 1 — Neon Circuit (beginner, large flowing oval with chicane, ~940×600)
const NEON_CIRCUIT_POINTS: TrackPoint[] = buildTrack(
  // Start/finish straight (bottom) →
  bz({x:160,y:510},{x:360,y:510},{x:560,y:510},{x:720,y:510}, 10),
  // Sweeping right-hander (going up) ↗
  bz({x:720,y:510},{x:850,y:510},{x:900,y:450},{x:900,y:350}, 10),
  // Top-right straight ↑
  bz({x:900,y:350},{x:900,y:260},{x:880,y:200},{x:820,y:165}, 8),
  // Top section →← (with chicane)
  bz({x:820,y:165},{x:760,y:140},{x:700,y:155},{x:650,y:165}, 6),
  bz({x:650,y:165},{x:600,y:175},{x:565,y:145},{x:520,y:145}, 6),
  bz({x:520,y:145},{x:475,y:145},{x:440,y:175},{x:395,y:165}, 6),
  bz({x:395,y:165},{x:350,y:155},{x:300,y:145},{x:240,y:155}, 6),
  // Left section going down ↓
  bz({x:240,y:155},{x:160,y:170},{x:100,y:225},{x:90,y:310}, 10),
  // Bottom-left sweeper ↘
  bz({x:90,y:310},{x:80,y:390},{x:100,y:460},{x:160,y:510}, 10),
);

// Track 2 — Street Circuit (medium, city corners, ~760×600)
const STREET_CIRCUIT_POINTS: TrackPoint[] = buildTrack(
  // Long start straight →
  bz({x:130,y:540},{x:330,y:540},{x:530,y:540},{x:650,y:530}, 10),
  // First right-hander ↗
  bz({x:650,y:530},{x:720,y:520},{x:740,y:480},{x:740,y:420}, 7),
  // Short straight up ↑
  bz({x:740,y:420},{x:740,y:360},{x:740,y:310},{x:730,y:270}, 6),
  // Tight right chicane
  bz({x:730,y:270},{x:720,y:240},{x:690,y:220},{x:650,y:215}, 5),
  bz({x:650,y:215},{x:600,y:210},{x:570,y:230},{x:560,y:260}, 5),
  bz({x:560,y:260},{x:550,y:290},{x:530,y:310},{x:490,y:310}, 5),
  // Top-right straight ←
  bz({x:490,y:310},{x:430,y:310},{x:350,y:310},{x:290,y:305}, 6),
  // Inner hairpin ↓↙
  bz({x:290,y:305},{x:230,y:300},{x:205,y:270},{x:210,y:230}, 7),
  bz({x:210,y:230},{x:215,y:190},{x:250,y:170},{x:300,y:170}, 7),
  // Top straight ←
  bz({x:300,y:170},{x:380,y:160},{x:480,y:150},{x:570,y:145}, 7),
  // Top-left hairpin ↑←
  bz({x:570,y:145},{x:640,y:140},{x:680,y:110},{x:680,y:70}, 7),
  bz({x:680,y:70},{x:680,y:35},{x:640,y:15},{x:580,y:15}, 7),
  // Top straight ←
  bz({x:580,y:15},{x:490,y:15},{x:380,y:20},{x:280,y:25}, 7),
  // Far-left hairpin ↑←↓
  bz({x:280,y:25},{x:180,y:30},{x:130,y:60},{x:120,y:110}, 7),
  bz({x:120,y:110},{x:110,y:160},{x:120,y:220},{x:130,y:280}, 7),
  // Back to start straight ↓
  bz({x:130,y:280},{x:130,y:380},{x:130,y:460},{x:130,y:540}, 7),
);

// Track 3 — Mountain Pass (expert, tight hairpins, ~660×580)
const MOUNTAIN_PASS_POINTS: TrackPoint[] = buildTrack(
  // Start straight →
  bz({x:110,y:520},{x:240,y:520},{x:370,y:515},{x:450,y:500}, 8),
  // First hairpin (right) ↗→↙
  bz({x:450,y:500},{x:530,y:480},{x:570,y:440},{x:565,y:385}, 8),
  bz({x:565,y:385},{x:560,y:330},{x:520,y:300},{x:460,y:295}, 8),
  // Narrow climb ←↑
  bz({x:460,y:295},{x:390,y:290},{x:320,y:280},{x:255,y:265}, 7),
  // Second hairpin (left) ↑←↓
  bz({x:255,y:265},{x:195,y:250},{x:155,y:215},{x:160,y:165}, 8),
  bz({x:160,y:165},{x:165,y:120},{x:200,y:95},{x:250,y:88}, 8),
  // Mid section →↗
  bz({x:250,y:88},{x:320,y:78},{x:400,y:82},{x:460,y:90}, 7),
  // Third hairpin (right) ↗→↙
  bz({x:460,y:90},{x:540,y:100},{x:590,y:140},{x:590,y:190}, 8),
  bz({x:590,y:190},{x:590,y:240},{x:560,y:270},{x:505,y:275}, 7),
  // Long descent ←↙
  bz({x:505,y:275},{x:430,y:280},{x:350,y:300},{x:280,y:320}, 7),
  // Final hairpin (left) ↓↙↑
  bz({x:280,y:320},{x:210,y:340},{x:170,y:380},{x:175,y:430}, 8),
  bz({x:175,y:430},{x:180,y:480},{x:130,y:520},{x:110,y:520}, 5),
);

export const TRACKS: RacingTrack[] = [
  {
    name: "Neon Circuit",
    description: "Flowing oval with a technical chicane. Great for learning.",
    difficulty: "Beginner",
    points: NEON_CIRCUIT_POINTS,
    width: 62,
    laps: 3,
    color: "#7c3aed",
  },
  {
    name: "Street Circuit",
    description: "Tight city corners and long straights. Know your braking points.",
    difficulty: "Medium",
    points: STREET_CIRCUIT_POINTS,
    width: 52,
    laps: 3,
    color: "#0ea5e9",
  },
  {
    name: "Mountain Pass",
    description: "Technical hairpins and narrow roads. Experts only.",
    difficulty: "Expert",
    points: MOUNTAIN_PASS_POINTS,
    width: 44,
    laps: 3,
    color: "#ef4444",
  },
];

// ─── Track index from matchId (deterministic randomness) ─────────────────────

export function getTrackIndexFromMatchId(matchId: string): number {
  let hash = 0;
  for (let i = 0; i < matchId.length; i++) {
    hash = (hash * 31 + matchId.charCodeAt(i)) >>> 0;
  }
  return hash % TRACKS.length;
}

// ─── Car & state creation ────────────────────────────────────────────────────

function createCar(track: RacingTrack): CarState {
  const start = track.points[0];
  const next = track.points[Math.min(3, track.points.length - 1)];
  const angle = Math.atan2(next.y - start.y, next.x - start.x);
  return {
    x: start.x,
    y: start.y,
    angle,
    vx: 0,
    vy: 0,
    speed: 0,
    steer: 0,
    throttle: 0,
    brake: 0,
    lap: 0,
    nextCheckpoint: 1,
    finished: false,
    currentLapTime: 0,
    totalTime: 0,
    offTrack: false,
    drifting: false,
    nearestTrackIdx: 0,
    checkpointCooldown: 0,
    lastLapFlash: 0,
  };
}

export function createRacingState(trackIndex = 0): RacingState {
  const track = TRACKS[Math.abs(trackIndex) % TRACKS.length];
  return {
    phase: "reveal",
    car: createCar(track),
    countdown: 3,
    revealTimer: 2.8,
    currentPlayer: "player1",
    track,
    tireMarks: [],
    elapsed: 0,
  };
}

// ─── Input ───────────────────────────────────────────────────────────────────

export interface CarInput {
  throttle: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
}

// ─── Local nearest track point (prevents start/finish ambiguity) ─────────────
// Searches within a sliding window around the car's last known position on track.
// This prevents the global search from jumping to the WRONG end of a closed loop.

export function findNearestTrackPointLocal(
  track: RacingTrack,
  x: number,
  y: number,
  hint: number,
  windowSize = 120,
): number {
  const n = track.points.length;
  let best = hint;
  let bestDist = Infinity;
  for (let di = -windowSize; di <= windowSize; di++) {
    const i = ((hint + di) % n + n) % n;
    const p = track.points[i];
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

// ─── Simulation ──────────────────────────────────────────────────────────────

export function simulateRacing(state: RacingState, input: CarInput, dt = 1): RacingState {
  if (state.phase !== "racing") return state;

  const { MAX_SPEED, ACCEL, BRAKE_FORCE, DRAG, TURN_RATE, GRIP, OFF_TRACK_SPEED_MULT, OFF_TRACK_GRIP } = RACING_CONSTANTS;
  let car = { ...state.car };
  const { track } = state;

  // ── Inputs ────────────────────────────────────────────────────────────────
  car.throttle = input.throttle ? 1 : 0;
  car.brake = input.brake ? 1 : 0;
  car.steer = input.left ? -1 : input.right ? 1 : 0;

  // ── Local nearest point (off-track detection) ─────────────────────────────
  // Use a LOCAL search anchored to the car's last known position to avoid
  // jumping to the wrong section of track near the start/finish line.
  const nearestIdx = findNearestTrackPointLocal(track, car.x, car.y, car.nearestTrackIdx);
  car.nearestTrackIdx = nearestIdx;
  const nearestPt = track.points[nearestIdx];
  const offTrackDist = Math.sqrt((nearestPt.x - car.x) ** 2 + (nearestPt.y - car.y) ** 2);
  const halfWidth = track.width * 0.5;
  car.offTrack = offTrackDist > halfWidth;

  const currentGrip = car.offTrack ? OFF_TRACK_GRIP : GRIP;
  const speedCap = car.offTrack ? MAX_SPEED * OFF_TRACK_SPEED_MULT : MAX_SPEED;

  // ── Steering (speed-proportional) ─────────────────────────────────────────
  const speedMag = Math.sqrt(car.vx * car.vx + car.vy * car.vy);
  const steerFactor = Math.min(speedMag / MAX_SPEED, 1) * 0.6 + 0.4;
  car.angle += TURN_RATE * car.steer * steerFactor * dt;

  // ── Throttle force ────────────────────────────────────────────────────────
  if (car.throttle > 0) {
    car.vx += Math.cos(car.angle) * ACCEL * car.throttle * dt;
    car.vy += Math.sin(car.angle) * ACCEL * car.throttle * dt;
  }

  // ── Braking ───────────────────────────────────────────────────────────────
  if (car.brake > 0) {
    const brakeFactor = Math.pow(BRAKE_FORCE, dt);
    car.vx *= brakeFactor;
    car.vy *= brakeFactor;
  }

  // ── Lateral grip (drift model) ────────────────────────────────────────────
  const fwd = Math.cos(car.angle) * car.vx + Math.sin(car.angle) * car.vy;
  const lat = -Math.sin(car.angle) * car.vx + Math.cos(car.angle) * car.vy;
  const newLat = lat * (1 - currentGrip * dt * 3);
  car.vx = Math.cos(car.angle) * fwd - Math.sin(car.angle) * newLat;
  car.vy = Math.sin(car.angle) * fwd + Math.cos(car.angle) * newLat;

  car.drifting = Math.abs(lat) > 1.2 && speedMag > 1.5;

  // ── Drag ──────────────────────────────────────────────────────────────────
  const dragFactor = Math.pow(DRAG, dt);
  car.vx *= dragFactor;
  car.vy *= dragFactor;

  // ── Speed cap ─────────────────────────────────────────────────────────────
  const newSpeed = Math.sqrt(car.vx * car.vx + car.vy * car.vy);
  if (newSpeed > speedCap) {
    const scale = speedCap / newSpeed;
    car.vx *= scale;
    car.vy *= scale;
  }
  car.speed = Math.sqrt(car.vx * car.vx + car.vy * car.vy);

  // ── Move ──────────────────────────────────────────────────────────────────
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  // ── Wall push-back (LOCAL search — prevents finish-line confusion) ─────────
  const nearestIdx2 = findNearestTrackPointLocal(track, car.x, car.y, car.nearestTrackIdx);
  // Update nearest ONLY if the local search finds something closer
  const np2 = track.points[nearestIdx2];
  const distNow = Math.sqrt((np2.x - car.x) ** 2 + (np2.y - car.y) ** 2);
  if (distNow > halfWidth * 1.05) {
    const pushDist = distNow - halfWidth;
    const pushX = (np2.x - car.x) / distNow;
    const pushY = (np2.y - car.y) / distNow;
    car.x += pushX * pushDist * 0.9;
    car.y += pushY * pushDist * 0.9;
    const dot = car.vx * pushX + car.vy * pushY;
    if (dot < 0) {
      car.vx -= 1.3 * dot * pushX;
      car.vy -= 1.3 * dot * pushY;
    }
    car.vx *= 0.6;
    car.vy *= 0.6;
  }
  car.speed = Math.sqrt(car.vx * car.vx + car.vy * car.vy);

  // ── Time tracking ─────────────────────────────────────────────────────────
  const dtSec = dt / 60;
  car.currentLapTime += dtSec;
  car.totalTime += dtSec;

  // ── Checkpoint progression (with cooldown to prevent double-counting) ──────
  // Cooldown prevents a single checkpoint from firing multiple times when
  // the car is stationary on it or crosses it at the start/finish boundary.
  let lapIncremented = false;
  if (car.checkpointCooldown > 0) {
    car.checkpointCooldown = Math.max(0, car.checkpointCooldown - dt);
  } else {
    const n = track.points.length;
    const cpIdx = car.nextCheckpoint % n;
    const cp = track.points[cpIdx];
    const cpDist = Math.sqrt((car.x - cp.x) ** 2 + (car.y - cp.y) ** 2);

    // Generous detection radius: full track width (not 0.75x) so no checkpoint
    // is ever missed even at full speed with wide turns.
    if (cpDist < track.width) {
      car.nextCheckpoint++;
      car.checkpointCooldown = 18; // ~0.3s cooldown at 60fps

      // Lap complete: nextCheckpoint has wrapped back around to 0
      if (car.nextCheckpoint % n === 0) {
        car.lap++;
        car.nextCheckpoint = 0;
        car.currentLapTime = 0;
        car.lastLapFlash = 1.0; // signal render to show flash
        lapIncremented = true;
      }
    }
  }

  // Decay lap flash signal
  if (car.lastLapFlash > 0 && !lapIncremented) {
    car.lastLapFlash = Math.max(0, car.lastLapFlash - dt * 0.03);
  }

  // ── Tire marks ────────────────────────────────────────────────────────────
  let tireMarks = state.tireMarks;
  if (car.drifting || car.offTrack) {
    tireMarks = [
      ...tireMarks.slice(-200),
      { x: car.x, y: car.y, alpha: car.drifting ? 0.55 : 0.35, angle: car.angle },
    ];
  }
  tireMarks = tireMarks.map(m => ({ ...m, alpha: m.alpha * 0.992 })).filter(m => m.alpha > 0.02);

  // ── Finished ──────────────────────────────────────────────────────────────
  if (car.lap >= track.laps && !car.finished) {
    car.finished = true;
    const newState: RacingState = { ...state, car, tireMarks, phase: "finished", elapsed: state.elapsed + dt };
    if (state.currentPlayer === "player1") {
      return { ...newState, player1Time: car.totalTime };
    } else {
      const player2Time = car.totalTime;
      let winner: "player1" | "player2" | "draw" | undefined;
      if (state.player1Time !== undefined) {
        if (state.player1Time < player2Time) winner = "player1";
        else if (player2Time < state.player1Time) winner = "player2";
        else winner = "draw";
      }
      return { ...newState, player2Time, phase: "over", winner };
    }
  }

  return { ...state, car, tireMarks, elapsed: state.elapsed + dt };
}

// ─── Find nearest track point (global — legacy, kept for minimap) ─────────────

export function findNearestTrackPoint(track: RacingTrack, x: number, y: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < track.points.length; i++) {
    const p = track.points[i];
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

// ─── Phase transitions ────────────────────────────────────────────────────────

export function tickReveal(state: RacingState, dt: number): RacingState {
  if (state.phase !== "reveal") return state;
  const next = state.revealTimer - dt / 60;
  if (next <= 0) {
    return { ...state, revealTimer: 0, phase: "countdown" };
  }
  return { ...state, revealTimer: next };
}

export function startRacingCountdown(state: RacingState): RacingState {
  if (state.phase !== "countdown") return state;
  if (state.countdown <= 1) {
    return { ...state, phase: "racing", countdown: 0 };
  }
  return { ...state, countdown: state.countdown - 1 };
}

export function startPlayer2Race(state: RacingState): RacingState {
  return {
    ...state,
    phase: "reveal",
    countdown: 3,
    revealTimer: 2.8,
    currentPlayer: "player2",
    car: createCar(state.track),
    tireMarks: [],
    elapsed: 0,
  };
}

// ─── Utility ──────────────────────────────────────────────────────────────────

export function formatRaceTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const secsStr = secs < 10 ? "0" + secs.toFixed(2) : secs.toFixed(2);
  return `${mins}:${secsStr}`;
}

// Camera bounds for a track
export function getTrackBounds(track: RacingTrack): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of track.points) {
    minX = Math.min(minX, p.x - track.width);
    minY = Math.min(minY, p.y - track.width);
    maxX = Math.max(maxX, p.x + track.width);
    maxY = Math.max(maxY, p.y + track.width);
  }
  return { minX, minY, maxX, maxY };
}
