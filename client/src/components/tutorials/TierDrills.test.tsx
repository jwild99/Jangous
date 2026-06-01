// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, act, cleanup } from "@testing-library/react";
import {
  TIER_DRILLS,
  RenderDrill,
  computeTrajectory,
  type DrillSpec,
  type DrillResult,
  type TierDrillDefinition,
  type BankConfig,
} from "./TierDrills";
import type { TrainingTier } from "@shared/gameTrainingPaths";

const ARENA_W = 320;
const ARENA_H = 200;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Seeded LCG so cup-shuffle randomness is reproducible. */
function makePRNG(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** Pre-generate a long sequence so the test-side mirror and the
 *  component see the same Math.random values in the same order. */
function makeRandomSequence(seed: number, len = 4000): number[] {
  const prng = makePRNG(seed);
  const out: number[] = [];
  for (let i = 0; i < len; i++) out.push(prng());
  return out;
}

/* ------------------------------------------------------------------ */
/* mc                                                                  */
/* ------------------------------------------------------------------ */

async function driveMC(
  spec: Extract<DrillSpec, { kind: "mc" }>,
  onPass: (result?: DrillResult) => void,
) {
  const { getByTestId } = render(<RenderDrill spec={spec} onPass={onPass} />);
  for (let q = 0; q < spec.questions.length; q++) {
    const correctIdx = spec.questions[q].options.findIndex((o) => o.correct);
    expect(correctIdx, `q${q} must have a correct option`).toBeGreaterThanOrEqual(0);
    await act(async () => {
      fireEvent.click(getByTestId(`button-mc-option-${correctIdx}`));
    });
    await act(async () => {
      fireEvent.click(getByTestId("button-mc-next"));
    });
  }
  await act(async () => {
    await vi.advanceTimersByTimeAsync(700);
  });
}

/* ------------------------------------------------------------------ */
/* timing                                                              */
/* ------------------------------------------------------------------ */

async function driveTiming(
  spec: Extract<DrillSpec, { kind: "timing" }>,
  onPass: (result?: DrillResult) => void,
) {
  const sweepMs = spec.sweepMs ?? 1400;
  const rafQueue: Array<(t: number) => void> = [];
  vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});

  const { getByTestId } = render(<RenderDrill spec={spec} onPass={onPass} />);
  await act(async () => {
    fireEvent.click(getByTestId("button-timing-start"));
  });

  // First tick fixes startRef at a non-zero base time. `useRef(0)` plus the
  // `if (!startRef.current)` check means a zero base would keep resetting.
  const baseT = 1000;
  await act(async () => {
    const cb = rafQueue.shift();
    if (cb) cb(baseT);
  });

  for (let p = 0; p < spec.requiredPerfects; p++) {
    // Drive cursor to dead-centre (pos = 50%).
    await act(async () => {
      const cb = rafQueue.shift();
      if (cb) cb(baseT + sweepMs / 2);
    });
    await act(async () => {
      fireEvent.click(getByTestId("button-timing-tap"));
    });
  }

  await act(async () => {
    await vi.advanceTimersByTimeAsync(800);
  });
}

/* ------------------------------------------------------------------ */
/* cups                                                                */
/* ------------------------------------------------------------------ */

/** Mirrors CupTrackDrill.startRound + doShuffle so we know which slot
 *  ends up holding the original ball, consuming randoms from the SAME
 *  sequence the component will. */
function predictBallSlot(
  cups: number,
  swaps: number,
  pop: () => number,
): number {
  const order = Array.from({ length: cups }, (_, i) => i);
  const ballId = Math.floor(pop() * cups);
  for (let n = 0; n < swaps; n++) {
    let a = Math.floor(pop() * cups);
    let b = Math.floor(pop() * cups);
    while (b === a) b = Math.floor(pop() * cups);
    [order[a], order[b]] = [order[b], order[a]];
  }
  return order.indexOf(ballId);
}

async function driveCups(
  spec: Extract<DrillSpec, { kind: "cups" }>,
  onPass: (result?: DrillResult) => void,
) {
  const seq = makeRandomSequence(0xc0ffee);

  // Pre-compute the correct slot per round using a parallel index that
  // walks the same sequence the component will consume.
  let mirrorI = 0;
  const correctSlots: number[] = [];
  for (let r = 0; r < spec.rounds; r++) {
    correctSlots.push(
      predictBallSlot(spec.cups, spec.swaps, () => seq[mirrorI++]),
    );
  }

  let componentI = 0;
  vi.spyOn(Math, "random").mockImplementation(() => seq[componentI++]);

  const { getByTestId } = render(<RenderDrill spec={spec} onPass={onPass} />);
  await act(async () => {
    fireEvent.click(getByTestId("button-cups-start"));
  });

  for (let r = 0; r < spec.rounds; r++) {
    // startRound schedules doShuffle after 900ms; each swap costs swapMs.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900 + spec.swaps * spec.swapMs + 50);
    });
    await act(async () => {
      fireEvent.click(getByTestId(`button-cup-${correctSlots[r]}`));
    });
    // 1000ms gap before the next round starts (or done state).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
  }

  // onPass scheduled at +900ms after the final pick handler.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
}

/* ------------------------------------------------------------------ */
/* aim                                                                 */
/* ------------------------------------------------------------------ */

/** Search a fan of aim points until we find one whose trajectory hits
 *  the target after at least `maxBounces` bounces. */
export function findSolvingAim(config: BankConfig): { x: number; y: number } | null {
  const obstacles = config.obstacles ?? [];
  const probeR = 60;
  for (let deg = 0; deg < 360; deg += 1) {
    const rad = (deg * Math.PI) / 180;
    const aim = {
      x: config.start.x + Math.cos(rad) * probeR,
      y: config.start.y + Math.sin(rad) * probeR,
    };
    if (aim.x <= 1 || aim.x >= ARENA_W - 1) continue;
    if (aim.y <= 1 || aim.y >= ARENA_H - 1) continue;
    const traj = computeTrajectory(
      config.start,
      aim,
      Math.max(config.maxBounces, 0) + 2,
      ARENA_W,
      ARENA_H,
      obstacles,
      config.target,
    );
    if (traj.hit && (traj.bouncesBeforeTarget ?? 0) >= config.maxBounces) {
      return aim;
    }
  }
  return null;
}

async function driveAim(
  spec: Extract<DrillSpec, { kind: "aim" }>,
  onPass: (result?: DrillResult) => void,
) {
  const aim = findSolvingAim(spec.config);
  expect(aim, "aim drill must be solvable").not.toBeNull();

  const { getByTestId } = render(<RenderDrill spec={spec} onPass={onPass} />);
  const svg = getByTestId("svg-aim") as unknown as SVGSVGElement;
  vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    right: ARENA_W,
    bottom: ARENA_H,
    width: ARENA_W,
    height: ARENA_H,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);

  for (let r = 0; r < spec.config.rounds; r++) {
    await act(async () => {
      fireEvent.pointerMove(svg, { clientX: aim!.x, clientY: aim!.y });
    });
    await act(async () => {
      fireEvent.click(getByTestId("button-aim-fire"));
    });
    // shoot() schedules a 1200ms reset that clears path/aim for the next round.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1300);
    });
  }

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
}

/* ------------------------------------------------------------------ */
/* reaction                                                            */
/* ------------------------------------------------------------------ */

async function driveReaction(
  spec: Extract<DrillSpec, { kind: "reaction" }>,
  onPass: (result?: DrillResult) => void,
) {
  const { getByTestId } = render(<RenderDrill spec={spec} onPass={onPass} />);
  await act(async () => {
    fireEvent.click(getByTestId("button-drill-start"));
  });
  for (let i = 0; i < spec.targetCount; i++) {
    await act(async () => {
      fireEvent.click(getByTestId("button-drill-target"));
    });
  }
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
}

/* ------------------------------------------------------------------ */
/* dispatcher                                                          */
/* ------------------------------------------------------------------ */

async function driveSpec(
  spec: DrillSpec,
  onPass: (result?: DrillResult) => void,
) {
  switch (spec.kind) {
    case "mc":
      return driveMC(spec, onPass);
    case "timing":
      return driveTiming(spec, onPass);
    case "cups":
      return driveCups(spec, onPass);
    case "aim":
      return driveAim(spec, onPass);
    case "reaction":
      return driveReaction(spec, onPass);
  }
}

/* ------------------------------------------------------------------ */
/* registry walk                                                       */
/* ------------------------------------------------------------------ */

const TIERS: TrainingTier[] = ["intermediate", "advanced", "master"];

describe("TIER_DRILLS — every (game, tier) drill is reachable & passable", () => {
  for (const [slug, tiers] of Object.entries(TIER_DRILLS)) {
    for (const tier of TIERS) {
      const def: TierDrillDefinition | undefined = tiers[tier];
      if (!def) continue;
      it(`${slug} / ${tier} (${def.spec.kind}) drives onPass`, async () => {
        vi.useFakeTimers();
        const onPass = vi.fn();
        await driveSpec(def.spec, onPass);
        expect(
          onPass,
          `${slug}/${tier} (${def.spec.kind}) never reached onPass`,
        ).toHaveBeenCalledTimes(1);
        const result = onPass.mock.calls[0][0] as DrillResult | undefined;
        expect(result?.drillKind).toBe(def.spec.kind);
      });
    }
  }
});

/* ------------------------------------------------------------------ */
/* mc registry sanity                                                  */
/* ------------------------------------------------------------------ */

describe("MC drills — every question has exactly one correct option", () => {
  for (const [slug, tiers] of Object.entries(TIER_DRILLS)) {
    for (const tier of TIERS) {
      const def = tiers[tier];
      if (!def || def.spec.kind !== "mc") continue;
      it(`${slug}/${tier}`, () => {
        for (const q of def.spec.questions) {
          const correct = q.options.filter((o) => o.correct).length;
          expect(correct, `prompt "${q.prompt}"`).toBe(1);
        }
      });
    }
  }
});

/* ------------------------------------------------------------------ */
/* trajectory reflection math                                          */
/* ------------------------------------------------------------------ */

describe("computeTrajectory — reflection math", () => {
  it("inverts the vertical component when bouncing off the top wall", () => {
    // Aim straight up from centre, target sits below the bouncer.
    const traj = computeTrajectory(
      { x: 160, y: 150 },
      { x: 160, y: 0 },
      4,
      ARENA_W,
      ARENA_H,
      [],
      { x: 160, y: 180, r: 8 },
    );
    expect(traj.hit).toBe(true);
    // Up to the top wall, then back down: exactly one bounce.
    expect(traj.bouncesBeforeTarget).toBe(1);
  });

  it("inverts the horizontal component when bouncing off the right wall", () => {
    // Shoot from the left towards the right wall; target sits back near the left.
    const traj = computeTrajectory(
      { x: 80, y: 100 },
      { x: ARENA_W, y: 100 },
      4,
      ARENA_W,
      ARENA_H,
      [],
      { x: 40, y: 100, r: 8 },
    );
    expect(traj.hit).toBe(true);
    expect(traj.bouncesBeforeTarget).toBe(1);
  });

  it("solves every 1-bank aim drill in the registry", () => {
    const oneBankConfigs = collectAimConfigs(1);
    expect(oneBankConfigs.length).toBeGreaterThan(0);
    for (const { label, config } of oneBankConfigs) {
      const aim = findSolvingAim(config);
      expect(aim, `${label} — no solving 1-bank aim found`).not.toBeNull();
      const traj = computeTrajectory(
        config.start,
        aim!,
        config.maxBounces + 2,
        ARENA_W,
        ARENA_H,
        config.obstacles ?? [],
        config.target,
      );
      expect(traj.hit, label).toBe(true);
      expect(traj.bouncesBeforeTarget ?? 0).toBeGreaterThanOrEqual(1);
    }
  });

  it("solves every 2-bank aim drill in the registry", () => {
    const twoBankConfigs = collectAimConfigs(2);
    expect(twoBankConfigs.length).toBeGreaterThan(0);
    for (const { label, config } of twoBankConfigs) {
      const aim = findSolvingAim(config);
      expect(aim, `${label} — no solving 2-bank aim found`).not.toBeNull();
      const traj = computeTrajectory(
        config.start,
        aim!,
        config.maxBounces + 2,
        ARENA_W,
        ARENA_H,
        config.obstacles ?? [],
        config.target,
      );
      expect(traj.hit, label).toBe(true);
      expect(traj.bouncesBeforeTarget ?? 0).toBeGreaterThanOrEqual(2);
    }
  });
});

function collectAimConfigs(
  bounces: number,
): { label: string; config: BankConfig }[] {
  const out: { label: string; config: BankConfig }[] = [];
  for (const [slug, tiers] of Object.entries(TIER_DRILLS)) {
    for (const tier of TIERS) {
      const def = tiers[tier];
      if (!def || def.spec.kind !== "aim") continue;
      if (def.spec.config.maxBounces !== bounces) continue;
      out.push({ label: `${slug}/${tier}`, config: def.spec.config });
    }
  }
  return out;
}
