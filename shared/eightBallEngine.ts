export type BallType = "cue" | "solid" | "stripe" | "eight";

export interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;   // radians — accumulates as the ball rolls (visual spin)
  type: BallType;
  pocketed: boolean;
  number: number;
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

const TABLE_WIDTH = 800;
const TABLE_HEIGHT = 400;
const BALL_RADIUS = 10;
const POCKET_RADIUS = 22;
const MIN_VELOCITY = 0.08;
const BALL_DIAMETER = BALL_RADIUS * 2;
const BALL_DIAMETER_SQ = BALL_DIAMETER * BALL_DIAMETER;
const ROLL_DECEL = 0.14;
const SUBSTEPS = 6;
const PHYS_RAIL = 22;
const CUSHION_REST = 0.78;
const CUSHION_TANGENTIAL = 0.86;
const BALL_REST = 0.96;
const CORNER_MOUTH = 30;
const SIDE_MOUTH = 28;
const LEFT = PHYS_RAIL;
const RIGHT = TABLE_WIDTH - PHYS_RAIL;
const TOP = PHYS_RAIL;
const BOTTOM = TABLE_HEIGHT - PHYS_RAIL;
const CORNER_POCKET_INSET = CORNER_MOUTH * 0.55 * 0.6;
const SIDE_POCKET_INSET = POCKET_RADIUS * 0.7;

export function createInitialState() {}
export function cloneState(s) {}
export function executeShot(s,a,p,sx,sy) {}
export function simulatePhysics(s) {}
export function findFreeCuePosition(b,x,y) {}
export function computeWallBounceTrajectory(x,y,dx,dy,m,n) {}
export function findFirstBallContact(c,a,b) {}
export const EIGHT_BALL_CONSTANTS = {};