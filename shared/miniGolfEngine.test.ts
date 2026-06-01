import { describe, it, expect } from "vitest";
import {
  MAX_STROKES_PER_HOLE,
  initializeMatch,
  processShot,
  advanceToNextHole,
  calculateTotalScore,
  type MiniGolfGameState,
} from "./miniGolfEngine";

// Regression coverage for Task #20: the per-hole stroke cap that prevents an
// infinite bot loop when the bot can't (or refuses to) sink the ball.
describe("Mini Golf — per-hole stroke cap", () => {
  it("ends the hole for a bot that never sinks the ball after MAX_STROKES_PER_HOLE shots", () => {
    let state = initializeMatch("human-1", "bot-1", 3);

    // Simulate a bot that hits the ball with negligible velocity every turn.
    // Below MIN_VELOCITY (0.015), the ball stops instantly and never reaches
    // the cup — so without the stroke cap this loop would never terminate.
    const dudShot = { x: 0, y: 0 };

    for (let i = 0; i < MAX_STROKES_PER_HOLE; i++) {
      expect(state.player2.holeComplete).toBe(false);
      state = processShot(state, "player2", dudShot);
    }

    // After exactly MAX_STROKES_PER_HOLE failed shots, the engine must mark
    // the hole complete for this player so play can advance.
    expect(state.player2.strokes).toBe(MAX_STROKES_PER_HOLE);
    expect(state.player2.ball.isInHole).toBe(false);
    expect(state.player2.holeComplete).toBe(true);
  });

  it("does not allow strokes to exceed the cap even on extra calls", () => {
    let state = initializeMatch("p1", "p2", 3);
    for (let i = 0; i < MAX_STROKES_PER_HOLE + 5; i++) {
      state = processShot(state, "player1", { x: 0, y: 0 });
    }
    expect(state.player1.strokes).toBeLessThanOrEqual(MAX_STROKES_PER_HOLE);
    expect(state.player1.holeComplete).toBe(true);
  });
});

describe("Mini Golf — advanceToNextHole", () => {
  // Helper: drive both players to holeComplete=true via the stroke cap
  // without sinking the ball, then return the resulting state.
  function exhaustBothPlayers(state: MiniGolfGameState): MiniGolfGameState {
    let s = state;
    for (let i = 0; i < MAX_STROKES_PER_HOLE; i++) {
      s = processShot(s, "player1", { x: 0, y: 0 });
    }
    for (let i = 0; i < MAX_STROKES_PER_HOLE; i++) {
      s = processShot(s, "player2", { x: 0, y: 0 });
    }
    return s;
  }

  it("produces a clean next hole when not on the final hole (strokes reset, currentTurn=player1)", () => {
    let state = initializeMatch("p1", "p2", 3);
    state = exhaustBothPlayers(state);

    expect(state.player1.holeComplete).toBe(true);
    expect(state.player2.holeComplete).toBe(true);

    // Force currentTurn to player2 so the assertion below actually proves
    // advanceToNextHole resets the turn rather than just preserving it.
    state = { ...state, currentTurn: "player2" };

    const next = advanceToNextHole(state);

    expect(next.currentHole).toBe(2);
    expect(next.isMatchComplete).toBe(false);
    expect(next.winner).toBeNull();
    expect(next.player1.strokes).toBe(0);
    expect(next.player2.strokes).toBe(0);
    expect(next.player1.holeComplete).toBe(false);
    expect(next.player2.holeComplete).toBe(false);
    expect(next.player1.ball.isInHole).toBe(false);
    expect(next.player2.ball.isInHole).toBe(false);
    expect(next.currentTurn).toBe("player1");
    // The previous hole's strokes are recorded in perHoleStrokes.
    expect(next.perHoleStrokes[1]).toEqual({
      player1: MAX_STROKES_PER_HOLE,
      player2: MAX_STROKES_PER_HOLE,
    });
  });

  it("ends the match after the final hole instead of advancing to hole N+1", () => {
    // Total holes = 2 to keep the test short.
    let state = initializeMatch("p1", "p2", 2);

    // Hole 1 — both players exhaust the cap (equal scores so far).
    state = exhaustBothPlayers(state);
    state = advanceToNextHole(state);
    expect(state.currentHole).toBe(2);
    expect(state.isMatchComplete).toBe(false);

    // Hole 2 — player1 hits the cap, player2 sinks under-par. We can't
    // guarantee a sink without coupling to physics, so we instead simulate
    // player2 having taken fewer strokes by directly running fewer dud shots
    // and then manually marking holeComplete. This mimics the bot path where
    // a player legitimately finishes early; advanceToNextHole only cares
    // about the recorded stroke totals.
    for (let i = 0; i < MAX_STROKES_PER_HOLE; i++) {
      state = processShot(state, "player1", { x: 0, y: 0 });
    }
    state = {
      ...state,
      player2: { ...state.player2, strokes: 3, holeComplete: true },
    };

    expect(state.player1.holeComplete).toBe(true);
    expect(state.player2.holeComplete).toBe(true);
    expect(state.currentHole).toBe(2);

    const finished = advanceToNextHole(state);

    // After the final hole, match must be complete — NOT advanced to hole 3.
    expect(finished.isMatchComplete).toBe(true);
    expect(finished.currentHole).toBe(2);
    // Player 2 had fewer total strokes — they must be recorded as the winner
    // directly on the final state (not just derivable from the score calc).
    expect(finished.winner).toBe("player2");
    const totals = calculateTotalScore(finished);
    expect(totals.player2Total).toBeLessThan(totals.player1Total);
    expect(totals.winner).toBe("player2");
  });
});
