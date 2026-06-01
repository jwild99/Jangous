// Mini Golf Physics Engine - Realistic physics with multiple surface types
// Uses continuous motion equations with real units scaled to pixels

export interface Vector2 {
  x: number;
  y: number;
}

// Enhanced ball with angular momentum
export interface PhysicsBall {
  position: Vector2;
  velocity: Vector2;
  acceleration: Vector2;
  angularVelocity: number; // rotation speed in radians/s
  rotation: number; // current rotation angle in radians
  radius: number; // ball radius in pixels (default: 3)
  mass: number; // ball mass in arbitrary units (default: 1)
}

// Surface material properties
export interface SurfaceMaterial {
  name: string;
  frictionCoefficient: number; // 0 = no friction, 1 = max friction
  restitution: number; // 0 = no bounce, 1 = perfect bounce
  rollingResistance: number; // additional drag for rolling
  color: string; // visual representation
}

// Predefined surface materials
export const SURFACE_MATERIALS: Record<string, SurfaceMaterial> = {
  grass: {
    name: "Grass",
    frictionCoefficient: 0.4,
    restitution: 0.3,
    rollingResistance: 0.02,
    color: "#4ade80",
  },
  concrete: {
    name: "Concrete",
    frictionCoefficient: 0.15,
    restitution: 0.7,
    rollingResistance: 0.005,
    color: "#9ca3af",
  },
  sand: {
    name: "Sand",
    frictionCoefficient: 0.8,
    restitution: 0.05,
    rollingResistance: 0.15,
    color: "#fbbf24",
  },
  rough: {
    name: "Rough",
    frictionCoefficient: 0.6,
    restitution: 0.2,
    rollingResistance: 0.05,
    color: "#78716c",
  },
  ice: {
    name: "Ice",
    frictionCoefficient: 0.05,
    restitution: 0.8,
    rollingResistance: 0.001,
    color: "#bfdbfe",
  },
};

// Physics constants (real units scaled to pixels)
export class PhysicsConstants {
  static readonly GRAVITY = 980; // pixels/s² (9.8 m/s² scaled 100x)
  static readonly AIR_RESISTANCE = 0.001; // air drag coefficient
  static readonly MIN_VELOCITY = 0.5; // pixels/s - below this, ball stops
  static readonly TIMESTEP = 0.016; // 60 FPS (1/60 second)
  static readonly MAX_VELOCITY = 2000; // pixels/s - safety limit
  static readonly BALL_RADIUS = 3; // pixels
  static readonly BALL_MASS = 1; // arbitrary units
}

// Vector math utilities
export class VectorMath {
  static add(v1: Vector2, v2: Vector2): Vector2 {
    return { x: v1.x + v2.x, y: v1.y + v2.y };
  }

  static subtract(v1: Vector2, v2: Vector2): Vector2 {
    return { x: v1.x - v2.x, y: v1.y - v2.y };
  }

  static scale(v: Vector2, scalar: number): Vector2 {
    return { x: v.x * scalar, y: v.y * scalar };
  }

  static magnitude(v: Vector2): number {
    return Math.sqrt(v.x * v.x + v.y * v.y);
  }

  static normalize(v: Vector2): Vector2 {
    const mag = VectorMath.magnitude(v);
    if (mag === 0) return { x: 0, y: 0 };
    return { x: v.x / mag, y: v.y / mag };
  }

  static dot(v1: Vector2, v2: Vector2): number {
    return v1.x * v2.x + v1.y * v2.y;
  }

  static distance(p1: Vector2, p2: Vector2): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  static reflect(v: Vector2, normal: Vector2): Vector2 {
    const dot = VectorMath.dot(v, normal);
    return {
      x: v.x - 2 * dot * normal.x,
      y: v.y - 2 * dot * normal.y,
    };
  }

  static rotate(v: Vector2, angle: number): Vector2 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: v.x * cos - v.y * sin,
      y: v.x * sin + v.y * cos,
    };
  }
}

// Main Physics Engine
export class PhysicsEngine {
  private currentSurface: SurfaceMaterial = SURFACE_MATERIALS.grass;

  constructor(private defaultSurface: string = "grass") {
    this.currentSurface = SURFACE_MATERIALS[defaultSurface] || SURFACE_MATERIALS.grass;
  }

  // Create a new ball with default properties
  createBall(position: Vector2, velocity: Vector2 = { x: 0, y: 0 }): PhysicsBall {
    return {
      position: { ...position },
      velocity: { ...velocity },
      acceleration: { x: 0, y: 0 },
      angularVelocity: 0,
      rotation: 0,
      radius: PhysicsConstants.BALL_RADIUS,
      mass: PhysicsConstants.BALL_MASS,
    };
  }

  // Set the current surface material
  setSurface(surfaceName: string): void {
    this.currentSurface = SURFACE_MATERIALS[surfaceName] || SURFACE_MATERIALS.grass;
  }

  // Update ball physics for one timestep
  updateBall(ball: PhysicsBall, dt: number = PhysicsConstants.TIMESTEP): void {
    const speed = VectorMath.magnitude(ball.velocity);

    // Check if ball should stop
    if (speed < PhysicsConstants.MIN_VELOCITY) {
      ball.velocity = { x: 0, y: 0 };
      ball.acceleration = { x: 0, y: 0 };
      ball.angularVelocity = 0;
      return;
    }

    // Apply friction force (F = μ * N, where N = m * g)
    const frictionMagnitude =
      this.currentSurface.frictionCoefficient *
      PhysicsConstants.GRAVITY *
      ball.mass;

    const velocityDirection = VectorMath.normalize(ball.velocity);
    const frictionForce = VectorMath.scale(velocityDirection, -frictionMagnitude);

    // Apply rolling resistance (proportional to velocity)
    const rollingResistance = VectorMath.scale(
      ball.velocity,
      -this.currentSurface.rollingResistance
    );

    // Apply air resistance (F = -k * v²)
    const airResistance = VectorMath.scale(
      ball.velocity,
      -PhysicsConstants.AIR_RESISTANCE * speed
    );

    // Calculate total acceleration (F = ma, so a = F/m)
    ball.acceleration = VectorMath.scale(
      VectorMath.add(VectorMath.add(frictionForce, rollingResistance), airResistance),
      1 / ball.mass
    );

    // Update velocity (v = v0 + a*dt)
    ball.velocity = VectorMath.add(ball.velocity, VectorMath.scale(ball.acceleration, dt));

    // Clamp velocity to max
    const newSpeed = VectorMath.magnitude(ball.velocity);
    if (newSpeed > PhysicsConstants.MAX_VELOCITY) {
      ball.velocity = VectorMath.scale(
        VectorMath.normalize(ball.velocity),
        PhysicsConstants.MAX_VELOCITY
      );
    }

    // Update position (s = s0 + v*dt + 0.5*a*dt²)
    const velocityDisplacement = VectorMath.scale(ball.velocity, dt);
    const accelerationDisplacement = VectorMath.scale(
      ball.acceleration,
      0.5 * dt * dt
    );
    ball.position = VectorMath.add(
      ball.position,
      VectorMath.add(velocityDisplacement, accelerationDisplacement)
    );

    // Update angular velocity and rotation (ball rolls)
    // ω = v / r (rolling without slipping)
    ball.angularVelocity = newSpeed / ball.radius;
    ball.rotation += ball.angularVelocity * dt;
    ball.rotation = ball.rotation % (2 * Math.PI); // Keep rotation in [0, 2π]
  }

  // Handle wall collision with proper reflection and energy loss
  handleWallCollision(
    ball: PhysicsBall,
    wallStart: Vector2,
    wallEnd: Vector2
  ): boolean {
    // Get closest point on wall to ball
    const closestPoint = this.closestPointOnSegment(ball.position, wallStart, wallEnd);
    const distToWall = VectorMath.distance(ball.position, closestPoint);

    if (distToWall < ball.radius) {
      // Calculate wall normal
      const wallVector = VectorMath.subtract(wallEnd, wallStart);
      const wallNormal = VectorMath.normalize({
        x: -wallVector.y,
        y: wallVector.x,
      });

      // Ensure normal points away from wall
      const ballToWall = VectorMath.subtract(closestPoint, ball.position);
      if (VectorMath.dot(wallNormal, ballToWall) > 0) {
        wallNormal.x = -wallNormal.x;
        wallNormal.y = -wallNormal.y;
      }

      // Reflect velocity with restitution
      const reflectedVelocity = VectorMath.reflect(ball.velocity, wallNormal);
      ball.velocity = VectorMath.scale(reflectedVelocity, this.currentSurface.restitution);

      // Push ball away from wall to prevent clipping
      const penetration = ball.radius - distToWall;
      const pushDirection = VectorMath.normalize(
        VectorMath.subtract(ball.position, closestPoint)
      );
      ball.position = VectorMath.add(
        ball.position,
        VectorMath.scale(pushDirection, penetration + 0.1)
      );

      return true;
    }

    return false;
  }

  // Handle boundary collisions (edges of playing field)
  handleBoundaryCollision(
    ball: PhysicsBall,
    width: number,
    height: number
  ): void {
    let collided = false;

    // Left/right boundaries
    if (ball.position.x - ball.radius < 0) {
      ball.position.x = ball.radius;
      ball.velocity.x = -ball.velocity.x * this.currentSurface.restitution;
      collided = true;
    } else if (ball.position.x + ball.radius > width) {
      ball.position.x = width - ball.radius;
      ball.velocity.x = -ball.velocity.x * this.currentSurface.restitution;
      collided = true;
    }

    // Top/bottom boundaries
    if (ball.position.y - ball.radius < 0) {
      ball.position.y = ball.radius;
      ball.velocity.y = -ball.velocity.y * this.currentSurface.restitution;
      collided = true;
    } else if (ball.position.y + ball.radius > height) {
      ball.position.y = height - ball.radius;
      ball.velocity.y = -ball.velocity.y * this.currentSurface.restitution;
      collided = true;
    }

    // Apply energy loss on collision
    if (collided) {
      const speed = VectorMath.magnitude(ball.velocity);
      ball.velocity = VectorMath.scale(ball.velocity, 0.9); // 10% energy loss
    }
  }

  // Get closest point on line segment to a point
  private closestPointOnSegment(p: Vector2, a: Vector2, b: Vector2): Vector2 {
    const ap = VectorMath.subtract(p, a);
    const ab = VectorMath.subtract(b, a);
    const ab2 = VectorMath.dot(ab, ab);
    const ap_ab = VectorMath.dot(ap, ab);
    const t = Math.max(0, Math.min(1, ap_ab / ab2));
    return VectorMath.add(a, VectorMath.scale(ab, t));
  }

  // Calculate estimated travel distance for aiming
  estimateTravelDistance(initialVelocity: Vector2): number {
    // Use kinematic equation: v² = v₀² + 2as
    // At rest: 0 = v₀² - 2*friction*g*s
    // s = v₀² / (2*friction*g)
    const v0 = VectorMath.magnitude(initialVelocity);
    const deceleration =
      this.currentSurface.frictionCoefficient * PhysicsConstants.GRAVITY +
      this.currentSurface.rollingResistance * v0;

    if (deceleration === 0) return 10000; // Infinite distance (no friction)

    return (v0 * v0) / (2 * deceleration);
  }

  // Get current surface info
  getCurrentSurface(): SurfaceMaterial {
    return this.currentSurface;
  }
}

// Power control helper
export class PowerControl {
  // Convert pixel distance from ball to power (velocity magnitude)
  static pixelDistanceToPower(distance: number, maxPower: number = 100): number {
    // Clamp distance to reasonable range
    const clampedDistance = Math.min(distance, 200);
    // Linear scaling: 0-200 pixels = 0-maxPower
    return (clampedDistance / 200) * maxPower;
  }

  // Convert power to initial velocity magnitude
  static powerToVelocity(power: number): number {
    // Scale power (0-100) to velocity in pixels/s
    // Max power = 100 -> 800 pixels/s
    return power * 8;
  }

  // Get velocity vector from angle and power
  static getVelocityVector(angle: number, power: number): Vector2 {
    const speed = PowerControl.powerToVelocity(power);
    return {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed,
    };
  }
}
