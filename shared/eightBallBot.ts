// 8-Ball Pool bot AI — shared between server and client so the client can
// run the same logic as a failsafe when server bot-move is unavailable.
//
// Easy:   picks a decent shot from top 60%, ±8° aim error, inconsistent power
// Medium: ghost-ball + pocket scoring from top 25%, ±4° aim error
// Hard:   best 1-3 shots with path obstruction + cut-angle scoring, ±1.5°

const POOL_TABLE_W = 800;
const POOL_TABLE_H = 400;
const POOL_BALL_R = 10;
const POOL_POCKETS = [
  { x: 0,                y: 0              },
  { x: POOL_TABLE_W / 2, y: 0              },
  { x: POOL_TABLE_W,     y: 0              },
  { x: 0,                y: POOL_TABLE_H   },
  { x: POOL_TABLE_W / 2, y: POOL_TABLE_H   },
  { x: POOL_TABLE_W,     y: POOL_TABLE_H   },
];

// True if segment (x1,y1)->(x2,y2) passes within `tol` of any non-pocketed,
// non-ignored ball — i.e. the path is obstructed.
function poolPathBlocked(
  x1: number, y1: number, x2: number, y2: number,
  balls: any[], ignoreIds: Set<number>, tol = POOL_BALL_R * 2,
): boolean {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1) return false;
  for (const b of balls) {
    if (b.pocketed || ignoreIds.has(b.id)) continue;
    const px = b.x - x1, py = b.y - y1;
    const t  = Math.max(0, Math.min(1, (px * dx + py * dy) / len2));
    const cx = x1 + t * dx, cy = y1 + t * dy;
    const d  = Math.hypot(b.x - cx, b.y - cy);
    if (d < tol) return true;
  }
  return false;
}

export function generateEightBallBotMove(
  gameState: any,
  botPlayer: "player1" | "player2",
  difficulty: "easy" | "medium" | "hard",
): { angle: number; power: number } | null {
  const balls: any[] = gameState.balls ?? [];
  const cue = balls.find((b: any) => b.type === "cue" && !b.pocketed);
  if (!cue) return null;

  const botGroup = botPlayer === "player1" ? gameState.player1Group : gameState.player2Group;
  const tableOpen = botGroup == null;

  const myGroupBalls = balls.filter((b: any) =>
    !b.pocketed && b.type !== "cue" && b.type !== "eight" &&
    (tableOpen || b.type === botGroup)
  );
  const eightBall = balls.find((b: any) => b.type === "eight" && !b.pocketed);
  const canShootEight = !tableOpen && botGroup &&
    balls.filter((b: any) => !b.pocketed && b.type === botGroup).length === 0;

  let targets: any[];
  if (myGroupBalls.length > 0) {
    targets = myGroupBalls;
  } else if (canShootEight && eightBall) {
    targets = [eightBall];
  } else {
    // No legal target (e.g. table open with all our group pocketed on break,
    // or we're stripes/solids but it's not yet our turn legally). Take a safe
    // defensive shot: gentle nudge toward table center to avoid scratching.
    const ang = Math.atan2(POOL_TABLE_H / 2 - cue.y, POOL_TABLE_W / 2 - cue.x);
    return { angle: ang + (Math.random() - 0.5) * 0.4, power: 32 };
  }

  type Shot = { angle: number; power: number; score: number; cutDeg: number };
  const candidates: Shot[] = [];

  for (const ball of targets) {
    for (const pocket of POOL_POCKETS) {
      const bpx = pocket.x - ball.x, bpy = pocket.y - ball.y;
      const bpLen = Math.hypot(bpx, bpy);
      if (bpLen < 1) continue;
      const bpnx = bpx / bpLen, bpny = bpy / bpLen;

      const ghostX = ball.x - bpnx * (POOL_BALL_R * 2);
      const ghostY = ball.y - bpny * (POOL_BALL_R * 2);

      const cgx = ghostX - cue.x, cgy = ghostY - cue.y;
      const cgLen = Math.hypot(cgx, cgy);
      if (cgLen < POOL_BALL_R) continue;
      const angle = Math.atan2(cgy, cgx);

      const cbx = ball.x - cue.x, cby = ball.y - cue.y;
      const cbLen = Math.hypot(cbx, cby);
      const cbnx = cbx / cbLen, cbny = cby / cbLen;
      const cosCut = Math.max(-1, Math.min(1, cbnx * bpnx + cbny * bpny));
      const cutRad = Math.acos(cosCut);
      const cutDeg = (cutRad * 180) / Math.PI;
      if (cutDeg > 80) continue;

      const ignore = new Set<number>([cue.id, ball.id]);
      const cuePathBlocked    = poolPathBlocked(cue.x, cue.y, ghostX, ghostY, balls, ignore, POOL_BALL_R * 1.9);
      const pocketPathBlocked = poolPathBlocked(ball.x, ball.y, pocket.x, pocket.y, balls, ignore, POOL_BALL_R * 1.9);

      let score = 100;
      score -= cgLen * 0.05;
      score -= bpLen * 0.04;
      score -= cutDeg * 0.9;
      if (cuePathBlocked) score -= 60;
      if (pocketPathBlocked) score -= 50;

      // Scratch risk: aim line points toward another pocket beyond target
      for (const p of POOL_POCKETS) {
        if (p === pocket) continue;
        const px = p.x - ghostX, py = p.y - ghostY;
        const proj = px * (cgx / cgLen) + py * (cgy / cgLen);
        if (proj < 0) continue;
        const perp = Math.abs(px * (-cgy / cgLen) + py * (cgx / cgLen));
        if (perp < 40 && proj < 250) score -= 15;
      }

      const travel = cgLen + bpLen;
      const basePower = 28 + (travel / (POOL_TABLE_W + POOL_TABLE_H)) * 55 + cutDeg * 0.25;
      const power = Math.max(28, Math.min(92, basePower));

      candidates.push({ angle, power, score, cutDeg });
    }
  }

  if (candidates.length === 0) {
    let nearest = targets[0];
    let bestD = Infinity;
    for (const t of targets) {
      const d = Math.hypot(t.x - cue.x, t.y - cue.y);
      if (d < bestD) { bestD = d; nearest = t; }
    }
    const ang = Math.atan2(nearest.y - cue.y, nearest.x - cue.x);
    return { angle: ang + (Math.random() - 0.5) * 0.2, power: 45 };
  }

  candidates.sort((a, b) => b.score - a.score);

  let pick: Shot;
  let aimErrRad: number;
  let powerErrPct: number;
  if (difficulty === "easy") {
    const poolSize = Math.max(1, Math.floor(candidates.length * 0.6));
    pick = candidates[Math.floor(Math.random() * poolSize)];
    aimErrRad   = (Math.random() - 0.5) * (8 * Math.PI / 180) * 2;
    powerErrPct = (Math.random() - 0.5) * 0.4;
  } else if (difficulty === "medium") {
    const poolSize = Math.max(1, Math.floor(candidates.length * 0.25));
    pick = candidates[Math.floor(Math.random() * poolSize)];
    aimErrRad   = (Math.random() - 0.5) * (4 * Math.PI / 180) * 2;
    powerErrPct = (Math.random() - 0.5) * 0.2;
  } else {
    pick = candidates[Math.floor(Math.random() * Math.min(3, candidates.length))];
    aimErrRad   = (Math.random() - 0.5) * (1.5 * Math.PI / 180) * 2;
    powerErrPct = (Math.random() - 0.5) * 0.1;
  }

  const finalPower = Math.max(25, Math.min(95, pick.power * (1 + powerErrPct)));
  return { angle: pick.angle + aimErrRad, power: finalPower };
}

export function eightBallThinkingTime(difficulty: "easy" | "medium" | "hard"): number {
  switch (difficulty) {
    case "easy": return 1200 + Math.random() * 1300;
    case "hard": return 400  + Math.random() * 600;
    default:     return 800  + Math.random() * 700;
  }
}
