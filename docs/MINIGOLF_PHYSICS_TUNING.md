# Mini Golf Physics Tuning Guide

This document explains how to tune the Mini Golf physics engine for different gameplay feels.

## Quick Reference

### Speed & Distance Control
**Parameter**: `maxShotSpeed` (default: 1400 px/s)
- **Increase** for longer drives and faster-paced gameplay
- **Decrease** for tighter control and precision-focused gameplay
- Typical range: 800-2000 px/s

### Ball Roll Duration
**Parameter**: `muRoll` (rolling resistance coefficient)
- **Lower values** (0.010-0.020) = balls roll longer, momentum-based gameplay
- **Higher values** (0.030-0.050) = balls stop sooner, more predictable
- Surface-specific tuning:
  - `fairway`: 0.022 (default) - standard grass
  - `concrete`: 0.010 - fast, slippery
  - `sand`: 0.090 - high resistance
  - `rough`: 0.040 - medium resistance

### Bounce & Rebound
**Parameters**: `material.restitution` and `restitutionWallDefault`
- **Increase** (0.5-0.7) for snappier, livelier rebounds
- **Decrease** (0.2-0.4) for softer, damped bounces
- Wall default: 0.45 (balanced)
- Surface-specific:
  - `concrete`: 0.55 (bouncy)
  - `fairway`: 0.30 (moderate)
  - `sand`: 0.00 (no bounce)

### Cup Forgiveness ("Lip Outs")
**Parameters**: `captureRadius` and `captureSpeed`
- **captureRadius** (default: 12px)
  - Increase (15-20px) for more forgiving cups (easier to sink)
  - Decrease (8-10px) for challenging cups (requires precision)
- **captureSpeed** (default: 40 px/s)
  - Increase (60-80 px/s) to allow faster balls to drop
  - Decrease (20-30 px/s) for realistic lip-outs on fast shots

### Slope Impact
**Parameter**: `slopeStrength` (default: 0.25)
- **Increase** (0.3-0.5) to make gradients matter more (strategic gameplay)
- **Decrease** (0.1-0.2) for subtle slope effects
- Slopes add gravity-based acceleration: `g * slopeStrength * slopeDirection`

## Advanced Tuning

### Timestep & Precision
**Parameter**: `dtFixed` (default: 1/60 = 0.0167s)
- Fixed at 60 FPS for deterministic server-side physics
- **Do not change** unless you need different simulation rates

### Dead Zone
**Parameter**: `deadSpeed` (default: 8 px/s)
- Velocity threshold below which ball snaps to zero
- Lower (4-6 px/s) for balls that settle more slowly
- Higher (10-15 px/s) for quicker stops

### Wall Energy Loss
**Parameter**: `wallDamping` (default: 0.98)
- Multiplier applied after wall collisions
- Lower (0.90-0.95) for more energy loss on impacts
- Higher (0.98-0.99) for more elastic collisions

### Tangential Spin
**Parameter**: `microSpin` (default: 0.04)
- Tangential velocity damping on wall hits (simulates spin)
- Range: 0.0 (no damping) to 0.1 (strong damping)

### Continuous Collision Detection
**Parameter**: `ccd` (default: true)
- **true**: Swept collision detection (prevents tunneling)
- **false**: Discrete collision (faster but less accurate)
- **Always keep true** for production

## Gameplay Presets

### Arcade Mode (Fast & Forgiving)
```typescript
{
  maxShotSpeed: 1800,
  muRoll: 0.018,  // rolls longer
  restitutionWallDefault: 0.55,  // bouncier
  captureRadius: 16,  // easier to sink
  captureSpeed: 60,
  slopeStrength: 0.2,  // gentler slopes
}
```

### Realistic Mode (Balanced)
```typescript
{
  maxShotSpeed: 1400,  // default
  muRoll: 0.022,
  restitutionWallDefault: 0.45,
  captureRadius: 12,
  captureSpeed: 40,
  slopeStrength: 0.25,
}
```

### Pro Mode (Precision & Challenge)
```typescript
{
  maxShotSpeed: 1200,  // tighter control
  muRoll: 0.028,  // stops sooner
  restitutionWallDefault: 0.35,  // softer bounces
  captureRadius: 10,  // precise cups
  captureSpeed: 30,  // realistic lip-outs
  slopeStrength: 0.35,  // slopes matter more
}
```

## Surface Material Tuning

Each surface has three properties you can adjust in `MATERIALS`:

### muRoll (Rolling Resistance)
Controls how quickly the ball loses momentum on this surface.

### restitution (Bounce Factor)
How much energy is retained when bouncing off obstacles on this surface.

### kDrag (Air Drag)
Quadratic drag coefficient. Higher values slow down fast-moving balls more.

Example custom surface:
```typescript
customGrass: {
  muRoll: 0.025,      // slightly slower than fairway
  restitution: 0.28,  // slightly less bouncy
  kDrag: 0.0020,      // slightly more drag
}
```

## Testing Your Changes

1. **Shot Distance**: Measure how far a max-power straight shot travels
2. **Roll Time**: Count frames/seconds until ball stops after a medium shot
3. **Wall Bounces**: Test 45° angle bounces and check energy retention
4. **Cup Capture**: Test shots at various speeds into the cup
5. **Slope Behavior**: Verify balls accelerate/decelerate on slopes as expected

## Physics Formula Reference

### Rolling Resistance
```
acceleration = -g * muRoll * normalized(velocity)
```

### Slope Acceleration
```
acceleration += g * slopeStrength * slopeVector
```

### Air Drag
```
drag = -kDrag * speed * velocity
```

### Wall Reflection
```
vn = proj(velocity, normal)  // normal component
vt = velocity - vn           // tangential component
bounced = -vn * (1 + restitution) + vt * (1 - microSpin)
final = bounced * wallDamping
```

## Tips

1. **Start with one parameter** - Change one thing at a time and test
2. **Record baselines** - Note default behavior before tuning
3. **Iterate in small steps** - Adjust by 10-20% increments
4. **Test all holes** - Ensure changes work across different layouts
5. **Consider player feedback** - Balance "feels good" with realism
