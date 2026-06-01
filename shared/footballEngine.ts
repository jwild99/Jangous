// Football Game Engine — Retro Bowl Style

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  role: "receiver" | "defender" | "qb";
  routePhase: number;
  id: number;
  caught?: boolean;
}

export interface FootballBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  altitude: number;   // vertical arc (visual only)
  vAlt: number;
  inFlight: boolean;
  targetReceiverId?: number;
}

export interface FootballState {
  phase: "play-setup" | "snap" | "throwing" | "flight" | "result" | "td" | "over";
  qb: Player;
  receivers: Player[];
  defenders: Player[];
  ball: FootballBall;
  player1Score: number;
  player2Score: number;
  currentPlayer: "player1" | "player2";
  down: number;           // 1-4
  yardsToGo: number;
  lineOfScrimmage: number; // x on field (0=own endzone, 100=opp endzone)
  firstDownLine: number;
  possession: "player1" | "player2";
  resultMessage?: string;
  playsThisDrive: number;
  driveComplete: boolean;
  winner?: "player1" | "player2" | "draw";
  p1DrivesDone: number;
  p2DrivesDone: number;
}

export const FOOTBALL_CONSTANTS = {
  FIELD_W: 500,
  FIELD_H: 280,
  ENDZONE_W: 50,
  QB_X: 80,
  QB_Y: 140,
  PLAYER_R: 10,
  BALL_R: 7,
  DRIVES_EACH: 1,   // each player gets 1 possession
  GRAVITY_ALT: 0.35,
} as const;

function makeReceivers(los: number): Player[] {
  const { FIELD_H } = FOOTBALL_CONSTANTS;
  return [
    { x: los + 10, y: FIELD_H * 0.25, vx: 0, vy: 0, role: "receiver", routePhase: 0, id: 1 },
    { x: los + 10, y: FIELD_H * 0.5,  vx: 0, vy: 0, role: "receiver", routePhase: 0, id: 2 },
    { x: los + 10, y: FIELD_H * 0.75, vx: 0, vy: 0, role: "receiver", routePhase: 0, id: 3 },
  ];
}

function makeDefenders(los: number): Player[] {
  const { FIELD_H } = FOOTBALL_CONSTANTS;
  return [
    { x: los + 60, y: FIELD_H * 0.2,  vx: 0, vy: 0, role: "defender", routePhase: 0, id: 10 },
    { x: los + 80, y: FIELD_H * 0.5,  vx: 0, vy: 0, role: "defender", routePhase: 0, id: 11 },
    { x: los + 60, y: FIELD_H * 0.8,  vx: 0, vy: 0, role: "defender", routePhase: 0, id: 12 },
  ];
}

export function createFootballState(): FootballState {
  const los = 65;
  return {
    phase: "play-setup",
    qb: { x: FOOTBALL_CONSTANTS.QB_X, y: FOOTBALL_CONSTANTS.QB_Y, vx: 0, vy: 0, role: "qb", routePhase: 0, id: 0 },
    receivers: makeReceivers(los),
    defenders: makeDefenders(los),
    ball: { x: FOOTBALL_CONSTANTS.QB_X, y: FOOTBALL_CONSTANTS.QB_Y, vx: 0, vy: 0, altitude: 0, vAlt: 0, inFlight: false },
    player1Score: 0,
    player2Score: 0,
    currentPlayer: "player1",
    down: 1,
    yardsToGo: 10,
    lineOfScrimmage: los,
    firstDownLine: los + 50,
    possession: "player1",
    playsThisDrive: 0,
    driveComplete: false,
    p1DrivesDone: 0,
    p2DrivesDone: 0,
  };
}

export function snapBall(state: FootballState): FootballState {
  if (state.phase !== "play-setup") return state;
  return {
    ...state,
    phase: "snap",
    receivers: state.receivers.map(r => ({ ...r, routePhase: 0 })),
    defenders: state.defenders.map(d => ({ ...d, routePhase: 0 })),
  };
}

export function throwToReceiver(state: FootballState, receiverId: number): FootballState {
  if (state.phase !== "snap") return state;
  const target = state.receivers.find(r => r.id === receiverId);
  if (!target) return state;

  const dx = target.x - state.qb.x;
  const dy = target.y - state.qb.y;
  const dist = Math.sqrt(dx*dx + dy*dy);
  const speed = 7.5;
  const t = dist / speed;

  return {
    ...state,
    phase: "flight",
    ball: {
      x: state.qb.x,
      y: state.qb.y,
      vx: dx / t,
      vy: dy / t,
      altitude: 0,
      vAlt: 6,
      inFlight: true,
      targetReceiverId: receiverId,
    },
  };
}

export function simulateFootball(state: FootballState): FootballState {
  if (state.phase === "snap") {
    // Move receivers along routes
    const newReceivers = state.receivers.map(r => {
      const phase = r.routePhase + 1;
      let vx = 2.2;
      let vy = 0;
      // Route patterns per receiver
      if (r.id === 1) { vy = phase < 20 ? 0 : -1.5; }
      if (r.id === 2) { vx = 2.5; vy = 0; }
      if (r.id === 3) { vy = phase < 20 ? 0 : 1.5; }
      return { ...r, x: r.x + vx, y: r.y + vy, routePhase: phase };
    });
    const newDefenders = state.defenders.map(d => {
      // Defenders drift toward receivers
      const nearestR = state.receivers.reduce((best, r) => {
        const db = Math.sqrt((best.x-d.x)**2 + (best.y-d.y)**2);
        const dr = Math.sqrt((r.x-d.x)**2 + (r.y-d.y)**2);
        return dr < db ? r : best;
      });
      const dx = nearestR.x - d.x;
      const dy = nearestR.y - d.y;
      const dist = Math.sqrt(dx*dx+dy*dy);
      return dist > 2 ? { ...d, x: d.x + (dx/dist)*1.5, y: d.y + (dy/dist)*1.5, routePhase: d.routePhase+1 } : d;
    });
    return { ...state, receivers: newReceivers, defenders: newDefenders };
  }

  if (state.phase !== "flight") return state;

  const { FIELD_W, ENDZONE_W, GRAVITY_ALT } = FOOTBALL_CONSTANTS;
  let { x, y, vx, vy, altitude, vAlt } = state.ball;

  // Move receivers/defenders during flight too
  const newReceivers = state.receivers.map(r => ({ ...r, x: r.x + (r.id === 2 ? 2.5 : 2), routePhase: r.routePhase + 1 }));
  const newDefenders = state.defenders.map(d => {
    const target = state.receivers.find(r => r.id === state.ball.targetReceiverId);
    if (!target) return d;
    const dx = target.x - d.x; const dy = target.y - d.y;
    const dist = Math.sqrt(dx*dx+dy*dy);
    return dist > 2 ? { ...d, x: d.x + (dx/dist)*2.2, y: d.y + (dy/dist)*2.2 } : d;
  });

  altitude = Math.max(0, altitude + vAlt);
  vAlt -= GRAVITY_ALT;
  x += vx; y += vy;

  // Check catch
  const targetR = newReceivers.find(r => r.id === state.ball.targetReceiverId);
  if (targetR) {
    const dx = x - targetR.x; const dy = y - targetR.y;
    if (Math.sqrt(dx*dx+dy*dy) < 22 && altitude < 20) {
      // Check if defender intercepts
      const intercepted = newDefenders.some(d => {
        const ddx = x - d.x; const ddy = y - d.y;
        return Math.sqrt(ddx*ddx+ddy*ddy) < 20;
      });

      if (intercepted) {
        return handlePlayResult(state, "incomplete", newReceivers, newDefenders, state.lineOfScrimmage);
      }

      // Catch! — yards gained
      const yardsGained = Math.round((targetR.x - state.lineOfScrimmage) / 5);
      const newLos = Math.min(state.lineOfScrimmage + yardsGained * 5, FIELD_W - ENDZONE_W);

      // Touchdown check
      if (newLos >= FIELD_W - ENDZONE_W) {
        return scoreTouchdown(state, newReceivers, newDefenders);
      }
      return handlePlayResult(state, "catch", newReceivers, newDefenders, newLos, yardsGained);
    }
  }

  // Incomplete (ball out of bounds or on ground)
  if (x > FIELD_W || y < 0 || y > FOOTBALL_CONSTANTS.FIELD_H || altitude <= 0 && vAlt < 0) {
    return handlePlayResult(state, "incomplete", newReceivers, newDefenders, state.lineOfScrimmage);
  }

  return {
    ...state,
    ball: { ...state.ball, x, y, altitude, vAlt, vx, vy },
    receivers: newReceivers,
    defenders: newDefenders,
  };
}

function scoreTouchdown(state: FootballState, receivers: Player[], defenders: Player[]): FootballState {
  const isP1 = state.currentPlayer === "player1";
  const newP1Score = isP1 ? state.player1Score + 7 : state.player1Score;
  const newP2Score = !isP1 ? state.player2Score + 7 : state.player2Score;
  const p1Done = isP1 ? state.p1DrivesDone + 1 : state.p1DrivesDone;
  const p2Done = !isP1 ? state.p2DrivesDone + 1 : state.p2DrivesDone;
  const bothDone = p1Done >= FOOTBALL_CONSTANTS.DRIVES_EACH && p2Done >= FOOTBALL_CONSTANTS.DRIVES_EACH;
  
  let winner: "player1" | "player2" | "draw" | undefined;
  if (bothDone) {
    if (newP1Score > newP2Score) winner = "player1";
    else if (newP2Score > newP1Score) winner = "player2";
    else winner = "draw";
  }

  return {
    ...state,
    player1Score: newP1Score,
    player2Score: newP2Score,
    phase: bothDone ? "over" : "td",
    ball: { ...state.ball, inFlight: false },
    receivers,
    defenders,
    driveComplete: true,
    resultMessage: "TOUCHDOWN! +7",
    p1DrivesDone: p1Done,
    p2DrivesDone: p2Done,
    winner,
  };
}

function handlePlayResult(
  state: FootballState,
  result: "catch" | "incomplete",
  receivers: Player[],
  defenders: Player[],
  newLos: number,
  yardsGained = 0
): FootballState {
  const isP1 = state.currentPlayer === "player1";
  const newDown = result === "catch" && yardsGained >= 10 / 5 ? 1 : state.down + 1;
  const newYardsToGo = result === "catch" && yardsGained > 0 ? Math.max(10 - yardsGained * 5, 10) : state.yardsToGo;

  // Turnover on downs
  if (newDown > 4) {
    const p1Done = isP1 ? state.p1DrivesDone + 1 : state.p1DrivesDone;
    const p2Done = !isP1 ? state.p2DrivesDone + 1 : state.p2DrivesDone;
    const bothDone = p1Done >= FOOTBALL_CONSTANTS.DRIVES_EACH && p2Done >= FOOTBALL_CONSTANTS.DRIVES_EACH;
    const nextPlayer = isP1 ? "player2" : "player1";

    let winner: "player1" | "player2" | "draw" | undefined;
    if (bothDone) {
      if (state.player1Score > state.player2Score) winner = "player1";
      else if (state.player2Score > state.player1Score) winner = "player2";
      else winner = "draw";
    }

    const newLos2 = 65;
    return {
      ...state,
      phase: bothDone ? "over" : "result",
      ball: { ...state.ball, inFlight: false },
      receivers: makeReceivers(newLos2),
      defenders: makeDefenders(newLos2),
      down: 1,
      yardsToGo: 10,
      lineOfScrimmage: newLos2,
      firstDownLine: newLos2 + 50,
      currentPlayer: bothDone ? state.currentPlayer : nextPlayer,
      driveComplete: true,
      resultMessage: "Turnover on Downs!",
      p1DrivesDone: p1Done,
      p2DrivesDone: p2Done,
      winner,
    };
  }

  const nextLos = result === "catch" ? newLos : state.lineOfScrimmage;
  return {
    ...state,
    phase: "result",
    ball: { ...state.ball, inFlight: false },
    receivers: makeReceivers(nextLos),
    defenders: makeDefenders(nextLos),
    down: newDown === 1 ? 1 : newDown,
    yardsToGo: newDown === 1 ? 10 : newYardsToGo,
    lineOfScrimmage: nextLos,
    firstDownLine: nextLos + (newDown === 1 ? 50 : newYardsToGo),
    resultMessage: result === "catch" ? `Catch! +${yardsGained} yds` : "Incomplete Pass",
    playsThisDrive: state.playsThisDrive + 1,
  };
}

export function startNewPlay(state: FootballState): FootballState {
  if (state.phase !== "result") return state;
  return {
    ...state,
    phase: "play-setup",
    ball: { x: state.qb.x, y: state.qb.y, vx: 0, vy: 0, altitude: 0, vAlt: 0, inFlight: false },
    resultMessage: undefined,
  };
}

export function startNextDrive(state: FootballState): FootballState {
  const isP1 = state.currentPlayer === "player1";
  const nextPlayer: "player1" | "player2" = isP1 ? "player2" : "player1";
  const los = 65;
  return {
    ...state,
    phase: "play-setup",
    currentPlayer: nextPlayer,
    ball: { x: FOOTBALL_CONSTANTS.QB_X, y: FOOTBALL_CONSTANTS.QB_Y, vx: 0, vy: 0, altitude: 0, vAlt: 0, inFlight: false },
    receivers: makeReceivers(los),
    defenders: makeDefenders(los),
    down: 1,
    yardsToGo: 10,
    lineOfScrimmage: los,
    firstDownLine: los + 50,
    driveComplete: false,
    resultMessage: undefined,
    playsThisDrive: 0,
  };
}
