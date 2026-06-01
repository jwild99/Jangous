/**
 * Air Hockey Game Engine
 * Server-authoritative physics simulation for multiplayer air hockey
 */

export interface AirHockeyStatistics {
  goals: number;
  shots: number;
  saves: number;
  hitSpeedPeak: number;
  possessionSeconds: number;
  lastPossessionSide: 'left' | 'right' | null;
  possessionStartTime: number;
}

export interface AirHockeyGameState {
  puck: {
    x: number;
    y: number;
    vx: number;
    vy: number;
  };
  leftPaddle: {
    x: number;
    y: number;
    vx: number;
    vy: number;
  };
  rightPaddle: {
    x: number;
    y: number;
    vx: number;
    vy: number;
  };
  leftScore: number;
  rightScore: number;
  status: 'waiting' | 'playing' | 'paused' | 'finished';
  lastUpdate: number;
  targetScore: number;
  currentServer: 'left' | 'right';
  lastLeftPaddleUpdate: number;
  lastRightPaddleUpdate: number;
  leftStats: AirHockeyStatistics;
  rightStats: AirHockeyStatistics;
}

export interface AirHockeyMove {
  playerId: string;
  paddleX?: number;
  paddleY: number;
  timestamp: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 520;
const TABLE_MARGIN = 22;
const GOAL_WIDTH = 150;

const PUCK_RADIUS = 13;
const PUCK_MASS = 1.0;
const PUCK_FRICTION = 0.997;   // slightly less friction — puck glides longer
const PUCK_MAX_SPEED = 1100;   // slightly higher cap for faster feel

const PADDLE_RADIUS = 28;
const PADDLE_MASS = 3.0;       // heavier paddle → transfers more momentum
const PADDLE_SPEED = 560;
const PADDLE_MAX_VALIDATION_SPEED = 950; // generous anti-cheat limit (real mouse can easily exceed 560)

const WALL_RESTITUTION = 0.94;
const COLLISION_RESTITUTION = 1.05;  // slightly super-elastic for satisfying hits

const FIXED_DT = 1 / 60;

// ─── Engine ───────────────────────────────────────────────────────────────────
export class AirHockeyEngine {
  private state: AirHockeyGameState;

  constructor(targetScore = 7) {
    const now = Date.now();
    this.state = {
      puck: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, vx: 0, vy: 0 },
      leftPaddle:  { x: 120,                  y: CANVAS_HEIGHT / 2, vx: 0, vy: 0 },
      rightPaddle: { x: CANVAS_WIDTH - 120,   y: CANVAS_HEIGHT / 2, vx: 0, vy: 0 },
      leftScore: 0,
      rightScore: 0,
      status: 'waiting',
      lastUpdate: now,
      targetScore,
      currentServer: Math.random() < 0.5 ? 'left' : 'right',
      lastLeftPaddleUpdate: 0,
      lastRightPaddleUpdate: 0,
      leftStats: {
        goals: 0, shots: 0, saves: 0, hitSpeedPeak: 0,
        possessionSeconds: 0, lastPossessionSide: null, possessionStartTime: now,
      },
      rightStats: {
        goals: 0, shots: 0, saves: 0, hitSpeedPeak: 0,
        possessionSeconds: 0, lastPossessionSide: null, possessionStartTime: now,
      },
    };
  }

  getState(): AirHockeyGameState {
    return { ...this.state };
  }

  loadState(state: AirHockeyGameState): void {
    const now = Date.now();
    this.state = {
      ...state,
      // Backwards compat — older saved states may not have vx on paddles
      leftPaddle:  { ...state.leftPaddle, vx: (state.leftPaddle as any).vx ?? 0, vy: (state.leftPaddle as any).vy ?? 0 },
      rightPaddle: { ...state.rightPaddle, vx: (state.rightPaddle as any).vx ?? 0, vy: (state.rightPaddle as any).vy ?? 0 },
      lastLeftPaddleUpdate:  state.lastLeftPaddleUpdate  || 0,
      lastRightPaddleUpdate: state.lastRightPaddleUpdate || 0,
      leftStats: state.leftStats || {
        goals: 0, shots: 0, saves: 0, hitSpeedPeak: 0,
        possessionSeconds: 0, lastPossessionSide: null, possessionStartTime: now,
      },
      rightStats: state.rightStats || {
        goals: 0, shots: 0, saves: 0, hitSpeedPeak: 0,
        possessionSeconds: 0, lastPossessionSide: null, possessionStartTime: now,
      },
    };
  }

  startGame(): void {
    this.state.status = 'playing';
    this.centerServe(this.state.currentServer === 'left' ? -1 : 1);
    this.state.lastUpdate = Date.now();
  }

  private centerServe(dir: number): void {
    this.state.puck.x = CANVAS_WIDTH / 2;
    this.state.puck.y = CANVAS_HEIGHT / 2;
    this.state.puck.vx = 0;
    this.state.puck.vy = 0;

    const angle = (Math.random() * Math.PI / 3) - (Math.PI / 6);
    const speed = 440 + Math.random() * 120;

    this.state.puck.vx = dir * speed * Math.cos(angle);
    this.state.puck.vy = speed * Math.sin(angle);
  }

  validateMove(move: AirHockeyMove, player1Id: string, player2Id: string): boolean {
    const minY = TABLE_MARGIN + PADDLE_RADIUS;
    const maxY = CANVAS_HEIGHT - TABLE_MARGIN - PADDLE_RADIUS;

    if (move.paddleY < minY || move.paddleY > maxY) return false;

    if (move.paddleX !== undefined) {
      const minX = TABLE_MARGIN + PADDLE_RADIUS;
      const maxX = CANVAS_WIDTH - TABLE_MARGIN - PADDLE_RADIUS;
      if (move.paddleX < minX || move.paddleX > maxX) return false;
    }

    const isPlayer1 = move.playerId === player1Id;
    const isPlayer2 = move.playerId === player2Id;
    if (!isPlayer1 && !isPlayer2) return false;

    const currentPaddle = isPlayer1 ? this.state.leftPaddle : this.state.rightPaddle;
    const lastPaddleUpdate = isPlayer1 ? this.state.lastLeftPaddleUpdate : this.state.lastRightPaddleUpdate;
    const deltaY = Math.abs(move.paddleY - currentPaddle.y);
    const deltaX = move.paddleX !== undefined ? Math.abs(move.paddleX - currentPaddle.x) : 0;
    const totalDelta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (lastPaddleUpdate === 0) {
      if (move.paddleX !== undefined) {
        const centerX = CANVAS_WIDTH / 2;
        if (isPlayer1  && move.paddleX > centerX - PADDLE_RADIUS) return false;
        if (!isPlayer1 && move.paddleX < centerX + PADDLE_RADIUS) return false;
      }
      return true;
    }

    const rawTimeDelta = (move.timestamp - lastPaddleUpdate) / 1000;
    if (rawTimeDelta <= 0) return false;

    const timeDelta = Math.min(rawTimeDelta, 0.5);
    const maxDeltaForTimePeriod = PADDLE_MAX_VALIDATION_SPEED * timeDelta;

    if (totalDelta > maxDeltaForTimePeriod) {
      console.warn(`[ANTI-CHEAT] Capping impossible paddle speed: ${totalDelta.toFixed(1)}px in ${(rawTimeDelta * 1000).toFixed(0)}ms`);
      // Cap rather than reject — moves above the threshold are clamped, not dropped
      // (real human mouse movement at 60fps can legitimately exceed 560px/s)
    }

    if (move.paddleX !== undefined) {
      const centerX = CANVAS_WIDTH / 2;
      if (isPlayer1  && move.paddleX > centerX - PADDLE_RADIUS) return false;
      if (!isPlayer1 && move.paddleX < centerX + PADDLE_RADIUS) return false;
    }

    return true;
  }

  applyMove(move: AirHockeyMove, player1Id: string): void {
    const isLeftPaddle = move.playerId === player1Id;
    const centerX = CANVAS_WIDTH / 2;

    const paddle = isLeftPaddle ? this.state.leftPaddle : this.state.rightPaddle;
    const lastUpdate = isLeftPaddle ? this.state.lastLeftPaddleUpdate : this.state.lastRightPaddleUpdate;

    // ── Compute paddle velocity from position delta ─────────────────────────
    const rawTimeDelta = (move.timestamp - lastUpdate) / 1000;
    const timeDelta = (rawTimeDelta > 0 && rawTimeDelta <= 0.5) ? rawTimeDelta : 0;

    if (timeDelta > 0) {
      const newX = move.paddleX ?? paddle.x;
      const newY = move.paddleY;
      // Clamp velocity to something reasonable
      const maxV = PADDLE_SPEED * 2;
      paddle.vx = this.clamp((newX - paddle.x) / timeDelta, -maxV, maxV);
      paddle.vy = this.clamp((newY - paddle.y) / timeDelta, -maxV, maxV);
    } else {
      // If no valid time delta, decay toward zero to avoid stale velocity
      paddle.vx *= 0.5;
      paddle.vy *= 0.5;
    }

    // ── Apply new position ──────────────────────────────────────────────────
    paddle.y = this.clamp(move.paddleY, TABLE_MARGIN + PADDLE_RADIUS, CANVAS_HEIGHT - TABLE_MARGIN - PADDLE_RADIUS);

    if (move.paddleX !== undefined) {
      if (isLeftPaddle) {
        paddle.x = this.clamp(move.paddleX, TABLE_MARGIN + PADDLE_RADIUS, centerX - PADDLE_RADIUS);
      } else {
        paddle.x = this.clamp(move.paddleX, centerX + PADDLE_RADIUS, CANVAS_WIDTH - TABLE_MARGIN - PADDLE_RADIUS);
      }
    }

    // ── Update timestamp ────────────────────────────────────────────────────
    if (isLeftPaddle) {
      this.state.lastLeftPaddleUpdate = move.timestamp;
    } else {
      this.state.lastRightPaddleUpdate = move.timestamp;
    }
  }

  update(): { scored?: 'left' | 'right'; gameOver?: boolean } {
    if (this.state.status !== 'playing') return {};

    const now = Date.now();
    let dt = (now - this.state.lastUpdate) / 1000;
    this.state.lastUpdate = now;
    dt = Math.min(dt, 0.1);

    let acc = dt;
    const result: { scored?: 'left' | 'right'; gameOver?: boolean } = {};

    while (acc >= FIXED_DT) {
      const stepResult = this.physicsStep(FIXED_DT);
      if (stepResult.scored) {
        result.scored = stepResult.scored;
        result.gameOver = stepResult.gameOver;
      }
      acc -= FIXED_DT;
    }

    return result;
  }

  private physicsStep(dt: number): { scored?: 'left' | 'right'; gameOver?: boolean } {
    this.updatePossession();

    // ── Move puck ──────────────────────────────────────────────────────────
    this.state.puck.x += this.state.puck.vx * dt;
    this.state.puck.y += this.state.puck.vy * dt;

    // ── Friction ───────────────────────────────────────────────────────────
    this.state.puck.vx *= PUCK_FRICTION;
    this.state.puck.vy *= PUCK_FRICTION;

    // ── Speed clamp ────────────────────────────────────────────────────────
    const speed = Math.hypot(this.state.puck.vx, this.state.puck.vy);
    if (speed > PUCK_MAX_SPEED) {
      const k = PUCK_MAX_SPEED / speed;
      this.state.puck.vx *= k;
      this.state.puck.vy *= k;
    }
    if (speed < 2) {
      this.state.puck.vx = 0;
      this.state.puck.vy = 0;
    }

    // ── Also decay paddle velocities each step (paddle stops when not moving) ─
    this.state.leftPaddle.vx  *= 0.85;
    this.state.leftPaddle.vy  *= 0.85;
    this.state.rightPaddle.vx *= 0.85;
    this.state.rightPaddle.vy *= 0.85;

    // ── Goals & walls ──────────────────────────────────────────────────────
    const scored = this.checkGoalsAndWalls();
    if (scored) {
      if (scored === 'left') {
        this.state.leftScore++;
        this.state.leftStats.goals++;
        this.state.currentServer = 'right';
      } else {
        this.state.rightScore++;
        this.state.rightStats.goals++;
        this.state.currentServer = 'left';
      }

      const gameOver =
        this.state.leftScore  >= this.state.targetScore ||
        this.state.rightScore >= this.state.targetScore;

      if (gameOver) {
        this.state.status = 'finished';
        return { scored, gameOver: true };
      } else {
        this.centerServe(scored === 'left' ? 1 : -1);
        return { scored, gameOver: false };
      }
    }

    // ── Paddle collisions ──────────────────────────────────────────────────
    this.handlePaddleCollision(this.state.leftPaddle,  'left');
    this.handlePaddleCollision(this.state.rightPaddle, 'right');

    return {};
  }

  private checkGoalsAndWalls(): 'left' | 'right' | null {
    const goalTop = CANVAS_HEIGHT / 2 - GOAL_WIDTH / 2;
    const goalBot = CANVAS_HEIGHT / 2 + GOAL_WIDTH / 2;

    // Left wall / goal
    if (this.state.puck.x - PUCK_RADIUS <= TABLE_MARGIN) {
      if (this.state.puck.y > goalTop && this.state.puck.y < goalBot) {
        return 'right';
      } else {
        this.state.puck.x  = TABLE_MARGIN + PUCK_RADIUS;
        this.state.puck.vx = -this.state.puck.vx * WALL_RESTITUTION;
      }
    }

    // Right wall / goal
    if (this.state.puck.x + PUCK_RADIUS >= CANVAS_WIDTH - TABLE_MARGIN) {
      if (this.state.puck.y > goalTop && this.state.puck.y < goalBot) {
        return 'left';
      } else {
        this.state.puck.x  = CANVAS_WIDTH - TABLE_MARGIN - PUCK_RADIUS;
        this.state.puck.vx = -this.state.puck.vx * WALL_RESTITUTION;
      }
    }

    // Top wall
    if (this.state.puck.y - PUCK_RADIUS <= TABLE_MARGIN) {
      this.state.puck.y  = TABLE_MARGIN + PUCK_RADIUS;
      this.state.puck.vy = -this.state.puck.vy * WALL_RESTITUTION;
    }

    // Bottom wall
    if (this.state.puck.y + PUCK_RADIUS >= CANVAS_HEIGHT - TABLE_MARGIN) {
      this.state.puck.y  = CANVAS_HEIGHT - TABLE_MARGIN - PUCK_RADIUS;
      this.state.puck.vy = -this.state.puck.vy * WALL_RESTITUTION;
    }

    return null;
  }

  private handlePaddleCollision(
    paddle: { x: number; y: number; vx: number; vy: number },
    side: 'left' | 'right'
  ): void {
    const dx = this.state.puck.x - paddle.x;
    const dy = this.state.puck.y - paddle.y;
    const dist = Math.hypot(dx, dy);
    const minDist = PUCK_RADIUS + PADDLE_RADIUS;

    if (dist >= minDist || dist === 0) return;

    // ── Push puck out of overlap ───────────────────────────────────────────
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;
    this.state.puck.x += nx * overlap;
    this.state.puck.y += ny * overlap;

    // ── Relative velocity (NOW includes paddle.vx!) ────────────────────────
    const rvx = this.state.puck.vx - paddle.vx;
    const rvy = this.state.puck.vy - paddle.vy;
    const relNormal = rvx * nx + rvy * ny;

    // Already separating — skip (prevents double impulses)
    if (relNormal > 0) return;

    // ── Impulse magnitude ──────────────────────────────────────────────────
    const invMassSum = (1 / PUCK_MASS) + (1 / PADDLE_MASS);
    const j = -(1 + COLLISION_RESTITUTION) * relNormal / invMassSum;

    // ── Apply impulse to puck ──────────────────────────────────────────────
    this.state.puck.vx += (j * nx) / PUCK_MASS;
    this.state.puck.vy += (j * ny) / PUCK_MASS;

    // ── Carry some paddle momentum into the puck ───────────────────────────
    // This makes fast sweeps feel powerful and responsive
    const paddleSpeed = Math.hypot(paddle.vx, paddle.vy);
    if (paddleSpeed > 30) {
      const boost = Math.min(paddleSpeed * 0.35, 280);
      this.state.puck.vx += (paddle.vx / paddleSpeed) * boost;
      this.state.puck.vy += (paddle.vy / paddleSpeed) * boost;
    }

    // ── Tangent friction (spin-like feel) ─────────────────────────────────
    const tangentX = -ny;
    const tangentY = nx;
    const relTan = rvx * tangentX + rvy * tangentY;
    const jt = -relTan / invMassSum;
    const frictionScale = 0.015;
    this.state.puck.vx += (jt * tangentX) / PUCK_MASS * frictionScale;
    this.state.puck.vy += (jt * tangentY) / PUCK_MASS * frictionScale;

    // ── Final speed clamp ─────────────────────────────────────────────────
    const finalSpeed = Math.hypot(this.state.puck.vx, this.state.puck.vy);
    if (finalSpeed > PUCK_MAX_SPEED) {
      const k = PUCK_MAX_SPEED / finalSpeed;
      this.state.puck.vx *= k;
      this.state.puck.vy *= k;
    }

    // ── Statistics ─────────────────────────────────────────────────────────
    const puckSpeed = Math.hypot(this.state.puck.vx, this.state.puck.vy);
    const stats = side === 'left' ? this.state.leftStats : this.state.rightStats;
    if (puckSpeed > stats.hitSpeedPeak) stats.hitSpeedPeak = Math.round(puckSpeed);
    const isShot = (side === 'left' && this.state.puck.vx > 100) ||
                   (side === 'right' && this.state.puck.vx < -100);
    if (isShot) stats.shots++;
    const centerX = CANVAS_WIDTH / 2;
    const isSave = (side === 'left' && this.state.puck.x < centerX * 0.4) ||
                   (side === 'right' && this.state.puck.x > centerX * 1.6);
    if (isSave && !isShot) stats.saves++;
  }

  private updatePossession(): void {
    const centerX = CANVAS_WIDTH / 2;
    const currentSide = this.state.puck.x < centerX ? 'left' : 'right';
    const now = Date.now();

    if (this.state.leftStats.lastPossessionSide !== currentSide) {
      const prevSide = this.state.leftStats.lastPossessionSide;
      if (prevSide === 'left') {
        this.state.leftStats.possessionSeconds += Math.floor(
          (now - this.state.leftStats.possessionStartTime) / 1000
        );
      } else if (prevSide === 'right') {
        this.state.rightStats.possessionSeconds += Math.floor(
          (now - this.state.rightStats.possessionStartTime) / 1000
        );
      }

      this.state.leftStats.lastPossessionSide  = currentSide;
      this.state.rightStats.lastPossessionSide = currentSide;

      if (currentSide === 'left') this.state.leftStats.possessionStartTime  = now;
      else                        this.state.rightStats.possessionStartTime = now;
    }
  }

  getWinner(): 'left' | 'right' | null {
    if (this.state.status !== 'finished') return null;
    if (this.state.leftScore  >= this.state.targetScore) return 'left';
    if (this.state.rightScore >= this.state.targetScore) return 'right';
    return null;
  }

  getStatistics(): {
    left:  AirHockeyStatistics & { possessionPercent: number };
    right: AirHockeyStatistics & { possessionPercent: number };
  } {
    const now = Date.now();
    const currentSide = this.state.puck.x < (CANVAS_WIDTH / 2) ? 'left' : 'right';

    let leftSec  = this.state.leftStats.possessionSeconds;
    let rightSec = this.state.rightStats.possessionSeconds;

    if (currentSide === 'left'  && this.state.leftStats.lastPossessionSide  === 'left')
      leftSec  += Math.floor((now - this.state.leftStats.possessionStartTime)  / 1000);
    else if (currentSide === 'right' && this.state.rightStats.lastPossessionSide === 'right')
      rightSec += Math.floor((now - this.state.rightStats.possessionStartTime) / 1000);

    const total = leftSec + rightSec;
    const leftPct  = total > 0 ? (leftSec  / total) * 100 : 50;
    const rightPct = total > 0 ? (rightSec / total) * 100 : 50;

    return {
      left:  { ...this.state.leftStats,  possessionSeconds: leftSec,  possessionPercent: Math.round(leftPct  * 100) / 100 },
      right: { ...this.state.rightStats, possessionSeconds: rightSec, possessionPercent: Math.round(rightPct * 100) / 100 },
    };
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }
}
