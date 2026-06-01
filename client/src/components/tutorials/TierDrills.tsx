import { useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  X as XIcon,
  RotateCcw,
  Crosshair,
  Eye,
  Zap,
  Target,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReactionDrill } from "./ReactionDrill";
import { useEmitCoachEvent } from "./TrainingCoach";
import type { TrainingTier } from "@shared/gameTrainingPaths";

const MC_STEP_ID = "tier-mc-drill";
const TIMING_STEP_ID = "tier-timing-drill";
const CUPS_STEP_ID = "tier-cups-drill";
const AIM_STEP_ID = "tier-aim-drill";

/**
 * Per-drill numeric result emitted on completion.
 *
 *  - mc:       `score` = first-try correct answers (max = question count).
 *  - timing:   `score` = milliseconds to clear the perfect streak (lower = better).
 *  - cups:     `score` = rounds won out of total rounds (higher = better).
 *  - aim:      `score` = hit accuracy % (hits / tries × 100, higher = better).
 *  - reaction: `score` = seconds to clear all targets (lower = better, 2 decimals).
 *
 * The Training Hub uses `metric` for display and `higherIsBetter` to order
 * leaderboards.
 */
export interface DrillResult {
  drillKind: "mc" | "timing" | "cups" | "aim" | "reaction";
  score: number;
  metric: string;
  higherIsBetter: boolean;
}

export type DrillPass = (result?: DrillResult) => void;

/* ============================================================
 *  Multiple-Choice Drill
 *  Used for tactical / strategic decision puzzles (chess forks,
 *  connect-4 column choice, safe-move ID, counter-pick, etc).
 *  Player must answer every question correctly (wrong answers
 *  unlock a retry of the same question).
 * ============================================================ */

export interface MCQuestion {
  prompt: string;
  diagram?: ReactNode;
  options: { label: string; correct?: boolean }[];
  explanation?: string;
}

export function MultipleChoiceDrill({
  questions,
  onPass,
}: {
  questions: MCQuestion[];
  onPass: DrillPass;
}) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctRun, setCorrectRun] = useState(0);
  const firstTryRef = useRef(true);
  const firstTryCorrectRef = useRef(0);
  const passedRef = useRef(false);
  const emit = useEmitCoachEvent();
  const q = questions[idx];

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const right = !!q.options[i].correct;
    if (right && firstTryRef.current) firstTryCorrectRef.current += 1;
    if (!right) firstTryRef.current = false;
    if (right) {
      const nextRun = correctRun + 1;
      setCorrectRun(nextRun);
      if (nextRun >= 2) {
        emit({ type: "streak", context: { stepId: MC_STEP_ID, message: "Reads stacking up — that's the pattern." } });
      } else {
        emit({ type: "success", context: { stepId: MC_STEP_ID, message: "Good read." } });
      }
    } else {
      emit({
        type: "miss",
        context: {
          stepId: MC_STEP_ID,
          hint: q.explanation ?? "Re-read the prompt — the right answer is usually the one that punishes the opponent's habit.",
          struggleThreshold: 2,
        },
      });
    }
  };

  const handleNext = () => {
    const wasRight = q.options[picked!]?.correct;
    if (!wasRight) {
      setPicked(null);
      return;
    }
    if (idx + 1 >= questions.length) {
      if (!passedRef.current) {
        passedRef.current = true;
        emit({ type: "success", context: { stepId: MC_STEP_ID, message: "Drill cleared — those reads will travel." } });
        const score = firstTryCorrectRef.current;
        setTimeout(
          () =>
            onPass({
              drillKind: "mc",
              score,
              metric: `/${questions.length} first try`,
              higherIsBetter: true,
            }),
          500,
        );
      }
      return;
    }
    setIdx(idx + 1);
    setPicked(null);
    firstTryRef.current = true;
  };

  return (
    <div className="space-y-3" data-testid="drill-multiple-choice">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5 text-primary" /> Drill{" "}
          {Math.min(idx + 1, questions.length)} / {questions.length}
        </span>
        <span className="flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 text-emerald-400" /> {correctRun}
        </span>
      </div>

      <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-fuchsia-500/5 p-4 space-y-3">
        {q.diagram && <div className="flex justify-center">{q.diagram}</div>}
        <div className="text-sm font-semibold" data-testid="text-mc-prompt">
          {q.prompt}
        </div>
        <div className="grid gap-2">
          {q.options.map((opt, i) => {
            const isPicked = picked === i;
            const showRight = picked !== null && opt.correct;
            const showWrong = isPicked && !opt.correct;
            return (
              <button
                key={i}
                onClick={() => pick(i)}
                disabled={picked !== null}
                className={cn(
                  "text-left text-sm rounded-md border px-3 py-2 transition-colors",
                  picked === null && "hover-elevate active-elevate-2 border-border/60 bg-card/40",
                  showRight && "border-emerald-400/60 bg-emerald-500/15 text-emerald-200",
                  showWrong && "border-rose-400/60 bg-rose-500/15 text-rose-200",
                  picked !== null && !showRight && !showWrong && "border-border/40 bg-card/20 opacity-60",
                )}
                data-testid={`button-mc-option-${i}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {picked !== null && (
          <div className="flex items-start gap-2 text-xs">
            {q.options[picked].correct ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <XIcon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-semibold">
                {q.options[picked].correct ? "Right." : "Not quite — pick the right answer."}
              </div>
              {q.explanation && (
                <div className="text-muted-foreground" data-testid="text-mc-explanation">
                  {q.explanation}
                </div>
              )}
            </div>
          </div>
        )}

        {picked !== null && (
          <Button
            size="sm"
            onClick={handleNext}
            className="w-full"
            data-testid="button-mc-next"
          >
            {q.options[picked].correct
              ? idx + 1 >= questions.length
                ? "Finish Drill"
                : "Next Drill"
              : "Try Again"}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ============================================================
 *  Timing Window Drill
 *  Moving cursor sweeps a bar; player taps when the cursor is
 *  inside the centre window. Streak-based (resets on a miss).
 * ============================================================ */

export function TimingWindowDrill({
  requiredPerfects,
  sweepMs = 1400,
  windowPct = 18,
  onPass,
}: {
  requiredPerfects: number;
  sweepMs?: number;
  windowPct?: number;
  onPass: DrillPass;
}) {
  const [perfects, setPerfects] = useState(0);
  const [pos, setPos] = useState(0);
  const [running, setRunning] = useState(false);
  const [feedback, setFeedback] = useState<null | "perfect" | "miss">(null);
  const startRef = useRef<number>(0);
  const attemptStartRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const passedRef = useRef(false);
  const emit = useEmitCoachEvent();

  useEffect(() => {
    if (!running) return;
    const tick = (t: number) => {
      if (!startRef.current) startRef.current = t;
      const cycle = sweepMs * 2;
      const dt = (t - startRef.current) % cycle;
      const p = dt < sweepMs ? (dt / sweepMs) * 100 : (1 - (dt - sweepMs) / sweepMs) * 100;
      setPos(p);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running, sweepMs]);

  useEffect(() => {
    if (perfects >= requiredPerfects && !passedRef.current) {
      passedRef.current = true;
      setRunning(false);
      const elapsedMs = attemptStartRef.current
        ? Date.now() - attemptStartRef.current
        : 0;
      setTimeout(
        () =>
          onPass({
            drillKind: "timing",
            score: elapsedMs,
            metric: "ms to clear",
            higherIsBetter: false,
          }),
        700,
      );
    }
  }, [perfects, requiredPerfects, onPass]);

  const start = () => {
    passedRef.current = false;
    setPerfects(0);
    setFeedback(null);
    startRef.current = 0;
    attemptStartRef.current = Date.now();
    setRunning(true);
  };

  const tap = () => {
    if (!running) return;
    const distance = Math.abs(pos - 50);
    if (distance <= windowPct / 2) {
      const next = perfects + 1;
      setPerfects(next);
      setFeedback("perfect");
      if (next >= requiredPerfects) {
        emit({ type: "success", context: { stepId: TIMING_STEP_ID, message: "Streak locked — that's the rhythm." } });
      } else if (next >= 2) {
        emit({ type: "streak", context: { stepId: TIMING_STEP_ID } });
      } else {
        emit({ type: "success", context: { stepId: TIMING_STEP_ID } });
      }
    } else {
      setPerfects(0);
      setFeedback("miss");
      emit({
        type: "miss",
        context: {
          stepId: TIMING_STEP_ID,
          hint: "Don't chase the cursor — tap a beat before it hits centre to absorb your reaction lag.",
          struggleThreshold: 2,
        },
      });
    }
    setTimeout(() => setFeedback(null), 260);
  };

  const cleared = perfects >= requiredPerfects;

  return (
    <div className="space-y-3" data-testid="drill-timing">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" /> Perfect streak {perfects} /{" "}
          {requiredPerfects}
        </span>
        <span>Hit inside the green band</span>
      </div>

      <div className="relative h-20 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-fuchsia-500/5 overflow-hidden">
        <div
          className="absolute inset-y-0 bg-emerald-500/25 border-x border-emerald-400/50"
          style={{ left: `${50 - windowPct / 2}%`, width: `${windowPct}%` }}
        />
        {running && (
          <div
            className="absolute top-1 bottom-1 w-1 rounded bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]"
            style={{ left: `calc(${pos}% - 2px)` }}
            data-testid="timing-cursor"
          />
        )}
        <AnimatePresence>
          {feedback && (
            <motion.div
              key={`${feedback}-${perfects}`}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className={cn(
                "absolute inset-0 flex items-center justify-center text-base font-bold",
                feedback === "perfect" ? "text-emerald-300" : "text-rose-300",
              )}
            >
              {feedback === "perfect" ? "Perfect!" : "Reset"}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!running ? (
        <Button
          size="sm"
          onClick={start}
          className="w-full"
          disabled={cleared}
          data-testid="button-timing-start"
        >
          <Zap className="w-4 h-4 mr-1" />
          {cleared ? "Cleared" : perfects > 0 ? "Restart" : "Start"}
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={tap}
          className="w-full"
          data-testid="button-timing-tap"
        >
          Tap on target
        </Button>
      )}
    </div>
  );
}

/* ============================================================
 *  Cup Track Drill
 *  Classic shell game. Watch ball, follow shuffles, pick cup.
 *  Used for Cup King intermediate / advanced / master.
 * ============================================================ */

export function CupTrackDrill({
  cups,
  swaps,
  swapMs,
  rounds,
  onPass,
}: {
  cups: number;
  swaps: number;
  swapMs: number;
  rounds: number;
  onPass: DrillPass;
}) {
  const winsNeeded = Math.ceil(rounds * 0.66);
  const [phase, setPhase] = useState<"idle" | "reveal" | "shuffle" | "pick" | "done">(
    "idle",
  );
  const [order, setOrder] = useState<number[]>(() =>
    Array.from({ length: cups }, (_, i) => i),
  );
  const [ballId, setBallId] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [won, setWon] = useState(0);
  const [round, setRound] = useState(0);
  const passedRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const emit = useEmitCoachEvent();

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };
  useEffect(() => () => clearTimers(), []);

  const doShuffle = (curr: number[], n: number) => {
    if (n >= swaps) {
      setPhase("pick");
      return;
    }
    setPhase("shuffle");
    let a = Math.floor(Math.random() * cups);
    let b = Math.floor(Math.random() * cups);
    while (b === a) b = Math.floor(Math.random() * cups);
    const next = curr.slice();
    [next[a], next[b]] = [next[b], next[a]];
    setOrder(next);
    timersRef.current.push(setTimeout(() => doShuffle(next, n + 1), swapMs));
  };

  const startRound = () => {
    const start = Array.from({ length: cups }, (_, i) => i);
    const ball = Math.floor(Math.random() * cups);
    setOrder(start);
    setBallId(ball);
    setPicked(null);
    setPhase("reveal");
    timersRef.current.push(setTimeout(() => doShuffle(start, 0), 900));
  };

  const startAll = () => {
    passedRef.current = false;
    setRound(0);
    setWon(0);
    startRound();
  };

  const pick = (slot: number) => {
    if (phase !== "pick" || picked !== null) return;
    setPicked(slot);
    const right = order[slot] === ballId;
    const nextWon = right ? won + 1 : won;
    setWon(nextWon);
    if (right) {
      emit({ type: "success", context: { stepId: CUPS_STEP_ID, message: "Tracked it — eyes never left the ball." } });
    } else {
      emit({
        type: "miss",
        context: {
          stepId: CUPS_STEP_ID,
          hint: "Lock onto the cup, not the ball — your eyes track motion better than position.",
          struggleThreshold: 2,
        },
      });
    }
    timersRef.current.push(
      setTimeout(() => {
        if (round + 1 >= rounds) {
          setPhase("done");
          if (nextWon >= winsNeeded && !passedRef.current) {
            passedRef.current = true;
            emit({ type: "success", context: { stepId: CUPS_STEP_ID, message: "Drill cleared — that's a tracking eye." } });
            timersRef.current.push(
              setTimeout(
                () =>
                  onPass({
                    drillKind: "cups",
                    score: nextWon,
                    metric: `/${rounds} rounds`,
                    higherIsBetter: true,
                  }),
                900,
              ),
            );
          }
        } else {
          setRound(round + 1);
          startRound();
        }
      }, 1000),
    );
  };

  const cupWidth = 100 / cups;
  const passed = won >= winsNeeded && phase === "done";

  return (
    <div className="space-y-3" data-testid="drill-cup-track">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-primary" /> Round{" "}
          {Math.min(round + 1, rounds)} / {rounds}
        </span>
        <span>
          Wins {won} • need {winsNeeded}
        </span>
      </div>

      <div className="relative h-48 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-fuchsia-500/5 overflow-hidden">
        {phase === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <Eye className="w-7 h-7 text-primary" />
            <div className="text-sm font-semibold">Watch the ball. Don't blink.</div>
            <div className="text-xs text-muted-foreground">
              {cups} cups • {swaps} swaps • get {winsNeeded} of {rounds} right.
            </div>
            <Button
              size="sm"
              onClick={startAll}
              className="mt-1"
              data-testid="button-cups-start"
            >
              Start
            </Button>
          </div>
        )}
        {phase === "done" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <div
              className={cn(
                "text-lg font-bold",
                passed ? "text-emerald-300" : "text-rose-300",
              )}
              data-testid="text-cups-result"
            >
              {passed ? "Tracked!" : "Tracking lost"}
            </div>
            <div className="text-xs text-muted-foreground">
              {won} / {rounds} correct
            </div>
            {!passed && (
              <Button
                size="sm"
                onClick={startAll}
                data-testid="button-cups-retry"
              >
                <RotateCcw className="w-4 h-4 mr-1" /> Try Again
              </Button>
            )}
          </div>
        )}
        {(phase === "reveal" || phase === "shuffle" || phase === "pick") && (
          <>
            {order.map((cupId, slot) => {
              const isBall = cupId === ballId;
              return (
                <div
                  key={cupId}
                  className="absolute bottom-5 transition-all duration-300 ease-in-out"
                  style={{
                    left: `${slot * cupWidth + cupWidth / 2}%`,
                    transform: "translateX(-50%)",
                    width: `${Math.min(cupWidth * 0.7, 18)}%`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => pick(slot)}
                    disabled={phase !== "pick"}
                    className={cn(
                      "relative w-full aspect-[2/3] rounded-t-full bg-gradient-to-b from-rose-500 to-rose-700 border-2 border-rose-300/70",
                      phase === "pick" && "hover-elevate active-elevate-2 cursor-pointer",
                      picked === slot &&
                        (order[slot] === ballId
                          ? "ring-2 ring-emerald-400"
                          : "ring-2 ring-rose-400"),
                    )}
                    data-testid={`button-cup-${slot}`}
                    aria-label={`Cup ${slot + 1}`}
                  >
                    {phase === "reveal" && isBall && (
                      <span className="absolute inset-x-0 -bottom-3 mx-auto h-3 w-3 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]" />
                    )}
                    {phase === "pick" &&
                      picked === slot &&
                      order[slot] === ballId && (
                        <span className="absolute inset-x-0 -bottom-3 mx-auto h-3 w-3 rounded-full bg-amber-400" />
                      )}
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================
 *  Aim Bank Drill
 *  Drag inside an SVG arena to aim a shot. Trajectory reflects
 *  off the four walls (and any obstacles), up to N bounces. Used
 *  for air-hockey / mini-golf / 8-ball bank-shot trainers.
 * ============================================================ */

export interface BankConfig {
  start: { x: number; y: number };
  target: { x: number; y: number; r: number };
  obstacles?: { x: number; y: number; w: number; h: number }[];
  /** Number of wall/obstacle bounces required between start and target. */
  maxBounces: number;
  rounds: number;
}

const ARENA_W = 320;
const ARENA_H = 200;

export function AimBankDrill({
  config,
  onPass,
}: {
  config: BankConfig;
  onPass: DrillPass;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [aim, setAim] = useState<{ x: number; y: number } | null>(null);
  const [hits, setHits] = useState(0);
  const [tries, setTries] = useState(0);
  const [path, setPath] = useState<{ x: number; y: number }[] | null>(null);
  const [bouncesUsed, setBouncesUsed] = useState(0);
  const [result, setResult] = useState<"hit" | "miss" | "direct" | null>(null);
  const passedRef = useRef(false);
  const emit = useEmitCoachEvent();

  const triesRef = useRef(0);
  useEffect(() => { triesRef.current = tries; }, [tries]);

  useEffect(() => {
    if (hits >= config.rounds && !passedRef.current) {
      passedRef.current = true;
      emit({ type: "success", context: { stepId: AIM_STEP_ID, message: "Bank lines dialled in — that angle reads will travel." } });
      const finalTries = Math.max(triesRef.current, hits);
      const accuracy = finalTries > 0 ? Math.round((hits / finalTries) * 100) : 0;
      setTimeout(
        () =>
          onPass({
            drillKind: "aim",
            score: accuracy,
            metric: "% accuracy",
            higherIsBetter: true,
          }),
        900,
      );
    }
  }, [hits, config.rounds, onPass, emit]);

  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (path) return;
    const rect = svgRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * ARENA_W;
    const y = ((e.clientY - rect.top) / rect.height) * ARENA_H;
    setAim({ x, y });
  };

  const shoot = () => {
    if (!aim || path) return;
    const traj = computeTrajectory(
      config.start,
      aim,
      Math.max(config.maxBounces, 0) + 2,
      ARENA_W,
      ARENA_H,
      config.obstacles ?? [],
      config.target,
    );
    setPath(traj.points);
    setBouncesUsed(traj.bouncesBeforeTarget ?? traj.bounces);
    setTries((t) => t + 1);
    let outcome: "hit" | "miss" | "direct" = "miss";
    if (traj.hit) {
      if (
        config.maxBounces > 0 &&
        (traj.bouncesBeforeTarget ?? 0) < config.maxBounces
      ) {
        outcome = "direct";
      } else {
        outcome = "hit";
        setHits((h) => h + 1);
      }
    }
    setResult(outcome);
    if (outcome === "hit") {
      emit({ type: "success", context: { stepId: AIM_STEP_ID, message: "Clean bank — that's the angle." } });
    } else if (outcome === "direct") {
      emit({
        type: "miss",
        context: {
          stepId: AIM_STEP_ID,
          hint: `This drill wants ${config.maxBounces} bank${config.maxBounces > 1 ? "s" : ""} — aim at the wall, not the target.`,
          struggleThreshold: 1,
        },
      });
    } else {
      emit({
        type: "miss",
        context: {
          stepId: AIM_STEP_ID,
          hint: "Picture the mirror image of the target on the other side of the wall — aim at that.",
          struggleThreshold: 2,
        },
      });
    }
    setTimeout(() => {
      setPath(null);
      setResult(null);
      setAim(null);
    }, 1200);
  };

  const aimPreview = useMemo(() => {
    if (!aim || path) return null;
    return computeTrajectory(
      config.start,
      aim,
      Math.max(config.maxBounces, 0) + 2,
      ARENA_W,
      ARENA_H,
      config.obstacles ?? [],
      config.target,
    ).points;
  }, [aim, path, config]);

  const pointsAttr = (pts: { x: number; y: number }[]) =>
    pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <div className="space-y-3" data-testid="drill-aim-bank">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Crosshair className="w-3.5 h-3.5 text-primary" /> Hits {hits} /{" "}
          {config.rounds}
        </span>
        <span>
          {config.maxBounces > 0
            ? `Use ${config.maxBounces} bank${config.maxBounces > 1 ? "s" : ""}`
            : "Direct line"}
        </span>
      </div>

      <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-emerald-900/30 to-teal-900/20 overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${ARENA_W} ${ARENA_H}`}
          className="w-full h-44 select-none touch-none cursor-crosshair"
          onPointerMove={handleMove}
          onPointerDown={handleMove}
          data-testid="svg-aim"
        >
          <rect
            x={0}
            y={0}
            width={ARENA_W}
            height={ARENA_H}
            fill="none"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={1}
          />
          {(config.obstacles ?? []).map((o, i) => (
            <rect
              key={i}
              x={o.x}
              y={o.y}
              width={o.w}
              height={o.h}
              fill="rgba(255,255,255,0.18)"
              stroke="rgba(255,255,255,0.45)"
              strokeWidth={1.5}
            />
          ))}
          <circle
            cx={config.target.x}
            cy={config.target.y}
            r={config.target.r}
            fill="rgba(244,63,94,0.35)"
            stroke="rgb(244,63,94)"
            strokeWidth={2}
          />
          <circle
            cx={config.target.x}
            cy={config.target.y}
            r={config.target.r * 0.4}
            fill="rgb(244,63,94)"
          />
          {aimPreview && (
            <polyline
              points={pointsAttr(aimPreview)}
              fill="none"
              stroke="rgba(251,191,36,0.45)"
              strokeDasharray="4 3"
              strokeWidth={2}
            />
          )}
          {path && (
            <polyline
              points={pointsAttr(path)}
              fill="none"
              stroke={
                result === "hit"
                  ? "rgb(52,211,153)"
                  : result === "direct"
                    ? "rgb(251,191,36)"
                    : "rgb(244,63,94)"
              }
              strokeWidth={3}
            />
          )}
          <circle
            cx={config.start.x}
            cy={config.start.y}
            r={7}
            fill="white"
            stroke="rgba(255,255,255,0.7)"
            strokeWidth={2}
          />
        </svg>
      </div>

      <div className="flex items-center gap-2">
        <div className="text-xs flex-1" data-testid="text-aim-status">
          {result === "hit" ? (
            <span className="text-emerald-300">
              Hit with {bouncesUsed} bank{bouncesUsed === 1 ? "" : "s"}.
            </span>
          ) : result === "direct" ? (
            <span className="text-amber-300">
              Hit, but {config.maxBounces} bank
              {config.maxBounces > 1 ? "s" : ""} required.
            </span>
          ) : result === "miss" ? (
            <span className="text-rose-300">Miss — adjust your angle.</span>
          ) : (
            <span className="text-muted-foreground">
              Tap the green field to aim, then Fire.
            </span>
          )}
        </div>
        <Button
          size="sm"
          onClick={shoot}
          disabled={!aim || !!path}
          data-testid="button-aim-fire"
        >
          <Crosshair className="w-4 h-4 mr-1" /> Fire
        </Button>
      </div>
    </div>
  );
}

interface TrajResult {
  points: { x: number; y: number }[];
  bounces: number;
  hit: boolean;
  bouncesBeforeTarget: number | null;
}

export function computeTrajectory(
  start: { x: number; y: number },
  aim: { x: number; y: number },
  maxBounces: number,
  W: number,
  H: number,
  obstacles: { x: number; y: number; w: number; h: number }[],
  target: { x: number; y: number; r: number },
): TrajResult {
  const points = [{ x: start.x, y: start.y }];
  let dx = aim.x - start.x;
  let dy = aim.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  let x = start.x;
  let y = start.y;
  let bounces = 0;
  let hit = false;
  let bouncesBeforeTarget: number | null = null;
  const stepSize = 1.5;
  const maxSteps = 3000;
  for (let i = 0; i < maxSteps; i++) {
    const prevX = x;
    const prevY = y;
    x += dx * stepSize;
    y += dy * stepSize;

    // Check target hit on this segment
    if (!hit && segmentHitsCircle(prevX, prevY, x, y, target.x, target.y, target.r)) {
      hit = true;
      bouncesBeforeTarget = bounces;
      points.push({ x: target.x, y: target.y });
      break;
    }

    let bounced = false;
    if (x <= 0) {
      x = 0;
      dx = -dx;
      bounced = true;
    } else if (x >= W) {
      x = W;
      dx = -dx;
      bounced = true;
    }
    if (y <= 0) {
      y = 0;
      dy = -dy;
      bounced = true;
    } else if (y >= H) {
      y = H;
      dy = -dy;
      bounced = true;
    }

    for (const o of obstacles) {
      if (x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h) {
        const dL = x - o.x;
        const dR = o.x + o.w - x;
        const dT = y - o.y;
        const dB = o.y + o.h - y;
        const m = Math.min(dL, dR, dT, dB);
        if (m === dL) {
          x = o.x - 0.5;
          dx = -Math.abs(dx);
        } else if (m === dR) {
          x = o.x + o.w + 0.5;
          dx = Math.abs(dx);
        } else if (m === dT) {
          y = o.y - 0.5;
          dy = -Math.abs(dy);
        } else {
          y = o.y + o.h + 0.5;
          dy = Math.abs(dy);
        }
        bounced = true;
        break;
      }
    }

    if (bounced) {
      bounces++;
      points.push({ x, y });
      if (bounces > maxBounces + 1) break;
    }
  }
  if (!hit) points.push({ x, y });
  return { points, bounces, hit, bouncesBeforeTarget };
}

function segmentHitsCircle(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  r: number,
): boolean {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = cx - x1;
  const wy = cy - y1;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(wx, wy) <= r;
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(cx - x2, cy - y2) <= r;
  const t = c1 / c2;
  const px = x1 + t * vx;
  const py = y1 + t * vy;
  return Math.hypot(cx - px, cy - py) <= r;
}

/* ============================================================
 *  Per-(game, tier) drill registry
 * ============================================================ */

export type DrillSpec =
  | { kind: "mc"; questions: MCQuestion[] }
  | {
      kind: "timing";
      requiredPerfects: number;
      sweepMs?: number;
      windowPct?: number;
    }
  | { kind: "aim"; config: BankConfig }
  | { kind: "cups"; cups: number; swaps: number; swapMs: number; rounds: number }
  | { kind: "reaction"; targetCount: number };

export interface TierDrillDefinition {
  /** Title shown in the tutorial shell for the drill step. */
  title: string;
  /** Short description shown above the drill UI. */
  body: string;
  spec: DrillSpec;
}

/** Render the drill specified by a DrillSpec. */
export function RenderDrill({
  spec,
  onPass,
}: {
  spec: DrillSpec;
  onPass: DrillPass;
}) {
  switch (spec.kind) {
    case "mc":
      return <MultipleChoiceDrill questions={spec.questions} onPass={onPass} />;
    case "timing":
      return (
        <TimingWindowDrill
          requiredPerfects={spec.requiredPerfects}
          sweepMs={spec.sweepMs}
          windowPct={spec.windowPct}
          onPass={onPass}
        />
      );
    case "aim":
      return <AimBankDrill config={spec.config} onPass={onPass} />;
    case "cups":
      return (
        <CupTrackDrill
          cups={spec.cups}
          swaps={spec.swaps}
          swapMs={spec.swapMs}
          rounds={spec.rounds}
          onPass={onPass}
        />
      );
    case "reaction":
      return <ReactionDrill onPass={onPass} targetCount={spec.targetCount} />;
  }
}

/* ----- compact helpers to build MCQuestion arrays inline -----
 *  Convention: pass [correctIndex, prompt, ...options]
 */
function mc(
  prompt: string,
  correctIndex: number,
  options: string[],
  explanation?: string,
): MCQuestion {
  return {
    prompt,
    explanation,
    options: options.map((label, i) => ({ label, correct: i === correctIndex })),
  };
}

/** Lookup for (gameSlug, tier) → drill (only intermediate/advanced/master). */
export const TIER_DRILLS: Record<string, Partial<Record<TrainingTier, TierDrillDefinition>>> = {
  "rock-paper-scissors": {
    intermediate: {
      title: "Pattern-Read Drill",
      body: "Read the opponent's tendency, then pick the throw that beats their next move.",
      spec: {
        kind: "mc",
        questions: [
          mc(
            "Opponent has thrown Rock, Rock, Paper. They favour Rock. What's your safest pick?",
            1,
            ["Rock", "Paper", "Scissors"],
            "Paper covers Rock — their default tendency.",
          ),
          mc(
            "You just beat them with Scissors. Most players switch to whatever just beat them. They're likely to throw…",
            2,
            ["Paper", "Rock", "Scissors"],
            "Lose-switch tell: expect Scissors → counter with Rock.",
          ),
          mc(
            "It's round one against an unknown opponent. The statistically safest first throw is…",
            1,
            ["Rock", "Paper", "Scissors"],
            "Most players default to Rock first — Paper covers it.",
          ),
        ],
      },
    },
    advanced: {
      title: "Conditional Read Drill",
      body: "Lock in your pre-committed strategy: respond to win, loss, and draw on autopilot.",
      spec: {
        kind: "mc",
        questions: [
          mc(
            "You won last round with Paper. Standard 'win-stay' play says…",
            0,
            ["Throw Paper again", "Throw Scissors", "Throw Rock"],
            "Win-stay: repeat the winning throw, baiting the lose-switch counter.",
          ),
          mc(
            "You lost last round when your Rock fell to Paper. Lose-switch logic says throw…",
            2,
            ["Rock", "Paper", "Scissors"],
            "They beat you with Paper → expect them to repeat Paper → Scissors cuts Paper.",
          ),
          mc(
            "Drawn round: you both threw Scissors. The smart follow-up is…",
            1,
            ["Scissors", "Rock", "Paper"],
            "Draw-switch: throw what beats your own last throw → Rock crushes Scissors.",
          ),
        ],
      },
    },
    master: {
      title: "Reaction Drill",
      body: "Hit five targets as fast as you can. Master-tier RPS rewards quick fingers.",
      spec: { kind: "reaction", targetCount: 5 },
    },
  },

  "connect-4": {
    intermediate: {
      title: "Threat Spotter",
      body: "Choose the column that creates a fork or blocks one. Centre control matters.",
      spec: {
        kind: "mc",
        questions: [
          mc(
            "It's move one. Which column gives the most potential lines?",
            3,
            ["Column 1", "Column 2", "Column 3", "Column 4 (centre)"],
            "Centre touches every possible win type — always take it on move one.",
          ),
          mc(
            "Opponent has three discs in a row horizontally with both ends open. Your priority is…",
            1,
            ["Build your own row", "Block one of the open ends", "Play centre"],
            "Open three on both sides = unblockable next turn unless you block now.",
          ),
          mc(
            "You can complete a horizontal three OR start a diagonal three. Better long-term move is…",
            1,
            ["Horizontal three", "Diagonal three", "Doesn't matter"],
            "Diagonals are the most-missed wins — they trap opponents who only scan rows and columns.",
          ),
        ],
      },
    },
    advanced: {
      title: "Even/Odd Lock Drill",
      body: "Recognise parity and zugzwang positions where every legal drop loses.",
      spec: {
        kind: "mc",
        questions: [
          mc(
            "You are Player 1. Standard parity theory says your threats should land on…",
            0,
            ["Odd rows (1, 3, 5)", "Even rows (2, 4, 6)", "Either"],
            "Player 1 wins with odd-row threats; Player 2 wins with even-row threats.",
          ),
          mc(
            "Every safe column has been used; every drop opens a three-in-a-row for the opponent. This is…",
            2,
            ["Stalemate", "Just bad luck", "Zugzwang — you've been forced into a losing tempo"],
            "Zugzwang is the goal of advanced Connect 4 play: leave the opponent with no safe move.",
          ),
        ],
      },
    },
    master: {
      title: "Forced-Win Calculation",
      body: "Master Connect 4 wins on calculation. Find the move that forces mate.",
      spec: {
        kind: "mc",
        questions: [
          mc(
            "Opening: you played centre, opponent played centre on top. The solved continuation is…",
            1,
            ["Adjacent column", "Centre again (upper-centre)", "Edge column"],
            "Stack centre → opponent stacks centre → you stack centre. Owning the centre column = solved win.",
          ),
          mc(
            "You have two open threes that can't both be blocked. This is called a…",
            1,
            ["Trap", "Fork (double threat)", "Skewer"],
            "Forks are how Connect 4 is actually won at the master level.",
          ),
          mc(
            "Endgame: you have a winning even-row threat. To cash it, you must…",
            2,
            [
              "Immediately drop into the threat column",
              "Build a second threat first",
              "Force the opponent to fill the odd row below it",
            ],
            "Even-row threats only cash when the opponent is forced to play the disc underneath.",
          ),
        ],
      },
    },
  },

  "air-hockey": {
    intermediate: {
      title: "Bank-Shot Trainer",
      body: "The opponent parked centre. Bank the puck off the side rail into the goal.",
      spec: {
        kind: "aim",
        config: {
          start: { x: 160, y: 180 },
          target: { x: 260, y: 30, r: 18 },
          obstacles: [{ x: 130, y: 70, w: 80, h: 30 }],
          maxBounces: 1,
          rounds: 3,
        },
      },
    },
    advanced: {
      title: "Double-Bank Drill",
      body: "Two walls, one goal. Slower puck but an unreadable line.",
      spec: {
        kind: "aim",
        config: {
          start: { x: 160, y: 180 },
          target: { x: 160, y: 30, r: 18 },
          obstacles: [{ x: 100, y: 80, w: 120, h: 40 }],
          maxBounces: 2,
          rounds: 3,
        },
      },
    },
    master: {
      title: "Block-and-Counter Drill",
      body: "Air hockey punishes slow hands. Tag five rebound targets cleanly.",
      spec: { kind: "reaction", targetCount: 7 },
    },
  },

  "mini-golf": {
    intermediate: {
      title: "Wall-Bank Putt",
      body: "Obstacle in the line. Bank the ball off the side wall to reach the cup.",
      spec: {
        kind: "aim",
        config: {
          start: { x: 60, y: 170 },
          target: { x: 270, y: 40, r: 14 },
          obstacles: [{ x: 110, y: 70, w: 80, h: 60 }],
          maxBounces: 1,
          rounds: 3,
        },
      },
    },
    advanced: {
      title: "Hazard Routing",
      body: "Two walls in the way. Find the multi-bank ace line.",
      spec: {
        kind: "aim",
        config: {
          start: { x: 60, y: 170 },
          target: { x: 270, y: 170, r: 14 },
          obstacles: [
            { x: 100, y: 40, w: 30, h: 130 },
            { x: 190, y: 30, w: 30, h: 130 },
          ],
          maxBounces: 2,
          rounds: 3,
        },
      },
    },
    master: {
      title: "Multi-Bank Ace",
      body: "Tight green, no straight lines. Land the cup with a double bank.",
      spec: {
        kind: "aim",
        config: {
          start: { x: 40, y: 100 },
          target: { x: 280, y: 100, r: 12 },
          obstacles: [
            { x: 100, y: 0, w: 30, h: 80 },
            { x: 100, y: 120, w: 30, h: 80 },
            { x: 190, y: 0, w: 30, h: 80 },
            { x: 190, y: 120, w: 30, h: 80 },
          ],
          maxBounces: 2,
          rounds: 3,
        },
      },
    },
  },

  "dots-and-boxes": {
    intermediate: {
      title: "Safe-Move Scanner",
      body: "Spot the move that doesn't hand the opponent a free box.",
      spec: {
        kind: "mc",
        questions: [
          mc(
            "A box has 3 of 4 sides drawn. You should…",
            2,
            ["Close the 4th side (gain a box)", "Draw elsewhere", "Close it only if it leads to a chain you keep"],
            "If closing it starts a chain you can run, take it. Otherwise the opponent will close it next turn.",
          ),
          mc(
            "A box has 2 of 4 sides. Drawing the 3rd side is…",
            1,
            ["Safe — they can't close it yet", "Dangerous — they close on their next turn", "Required by the rules"],
            "Never draw the 3rd side of a box unless you're committing to give it up.",
          ),
          mc(
            "The board has 6 chains: lengths 2, 3, 3, 4, 5, 7. The long-chain count is odd. Player 1 should…",
            0,
            [
              "Keep parity — play to give the last short chain away",
              "Break parity",
              "Parity doesn't matter",
            ],
            "Odd long-chain count favours Player 1 with the double-cross strategy.",
          ),
        ],
      },
    },
    advanced: {
      title: "Double-Cross Drill",
      body: "Sacrifice two boxes to win five. Choose the right moment.",
      spec: {
        kind: "mc",
        questions: [
          mc(
            "A 5-box chain opens for you. Standard double-cross says…",
            1,
            [
              "Take all 5 boxes",
              "Take 3, then draw the line that gives the last 2 to the opponent",
              "Refuse the chain entirely",
            ],
            "Take all but the last 2. Forces the opponent to open the next chain.",
          ),
          mc(
            "The chain only has 2 boxes. Should you double-cross?",
            1,
            ["Yes — always double-cross", "No — take both, double-cross needs 3+ boxes", "Refuse the chain"],
            "Double-crossing a 2-chain costs the same boxes you'd give up. Just take them.",
          ),
        ],
      },
    },
    master: {
      title: "Loop Theory Reaction",
      body: "Chain counting fails when you rush. Hit six targets to prove your hands match your head.",
      spec: { kind: "reaction", targetCount: 6 },
    },
  },

  "8-ball": {
    intermediate: {
      title: "Position-Play Bank",
      body: "Solid blocks the direct line to the pocket. Bank the cue off the rail.",
      spec: {
        kind: "aim",
        config: {
          start: { x: 160, y: 180 },
          target: { x: 290, y: 30, r: 16 },
          obstacles: [{ x: 200, y: 90, w: 30, h: 30 }],
          maxBounces: 1,
          rounds: 3,
        },
      },
    },
    advanced: {
      title: "Combo & Bank Trainer",
      body: "Two balls in the way. Find the double-bank line into the corner pocket.",
      spec: {
        kind: "aim",
        config: {
          start: { x: 160, y: 180 },
          target: { x: 30, y: 30, r: 16 },
          obstacles: [
            { x: 80, y: 70, w: 30, h: 30 },
            { x: 180, y: 110, w: 30, h: 30 },
          ],
          maxBounces: 2,
          rounds: 3,
        },
      },
    },
    master: {
      title: "Run-Out Calculation",
      body: "Run-out planning is mental geometry. Identify the right play.",
      spec: {
        kind: "mc",
        questions: [
          mc(
            "Your last solid is frozen against the 8-ball. Standard run-out priority is…",
            1,
            [
              "Pocket easy balls first, save the 8 for last",
              "Solve the frozen 'problem ball' before any other shot",
              "Play safe and stall",
            ],
            "Always solve the problem ball before you commit — otherwise it strands you on the 8.",
          ),
          mc(
            "On the break, the highest-percentage cue contact and aim is…",
            2,
            [
              "Off-centre soft hit, aim head ball",
              "Centre cue, soft, aim second ball",
              "Centre cue, full power, aim head ball",
            ],
            "Full power, centre cue, head ball gives the cleanest spread.",
          ),
          mc(
            "You want the cue to stop dead on contact. Strike the cue ball…",
            1,
            ["High (top spin)", "Dead centre (stop shot)", "Low (draw)"],
            "Centre-cue = stop shot. High = follow, low = draw.",
          ),
        ],
      },
    },
  },

  bowling: {
    intermediate: {
      title: "Pocket Timing",
      body: "Release too early or late and the ball drifts off the pocket. Hit the centre window.",
      spec: { kind: "timing", requiredPerfects: 3, sweepMs: 1500 },
    },
    advanced: {
      title: "Hook Release Trainer",
      body: "Hook shots need tighter timing. Three perfect releases in a row.",
      spec: { kind: "timing", requiredPerfects: 4, sweepMs: 1200, windowPct: 14 },
    },
    master: {
      title: "Tournament Tempo",
      body: "Five perfect releases. No misses. Real frames are this strict.",
      spec: { kind: "timing", requiredPerfects: 5, sweepMs: 900, windowPct: 12 },
    },
  },

  chess: {
    intermediate: {
      title: "Tactics Drill",
      body: "Spot the fork, the pin, and the safe development move.",
      spec: {
        kind: "mc",
        questions: [
          mc(
            "A knight attacks the enemy king AND queen at once. This is a…",
            1,
            ["Pin", "Fork", "Skewer"],
            "Fork = one piece, two targets. Knight forks on the king + queen are devastating.",
          ),
          mc(
            "Sound opening principles say you should develop…",
            1,
            ["Bishops before knights", "Knights before bishops", "Queen first to attack"],
            "Knights have fewer good squares — commit them first; bishops want a clearer diagonal.",
          ),
          mc(
            "A bishop attacks your queen, but moving the queen exposes a rook behind it. This is a…",
            2,
            ["Fork", "Pin", "Skewer"],
            "Skewer = bigger piece in front, forced to move, smaller piece behind is captured.",
          ),
        ],
      },
    },
    advanced: {
      title: "Positional Calls",
      body: "Pawn structure and king safety decide middlegames. Pick the right plan.",
      spec: {
        kind: "mc",
        questions: [
          mc(
            "You have an isolated d-pawn. The correct general plan is…",
            1,
            [
              "Trade it off as soon as possible",
              "Use the open files and active piece play it gives you",
              "Defend it passively",
            ],
            "Isolated pawns are weak in the endgame but strong in the middlegame — keep pieces on.",
          ),
          mc(
            "Your opponent's king is exposed in the centre. You should…",
            0,
            ["Open lines and attack quickly", "Trade queens to reach an endgame", "Castle queenside yourself"],
            "Exposed king = attack now. Trades let them consolidate.",
          ),
          mc(
            "You're up material in a complex middlegame. To convert, you generally want to…",
            2,
            ["Sharpen the position", "Keep all pieces on", "Trade pieces, keep pawns"],
            "Material edge converts in endgames. Trade pieces to reach one.",
          ),
        ],
      },
    },
    master: {
      title: "Mate-in-One Calculation",
      body: "Master chess punishes slow clocks. Pick the forcing move every time.",
      spec: {
        kind: "mc",
        questions: [
          mc(
            "Calculation order for any candidate move is always…",
            0,
            [
              "Checks → Captures → Threats → Positional",
              "Positional → Captures → Checks",
              "Whatever feels right",
            ],
            "Forcing moves first. If nothing forces, then you play position.",
          ),
          mc(
            "King + Queen vs lone King: the technique is…",
            1,
            [
              "Drive king to centre",
              "Box the king with the queen, then bring your king in for mate on the edge",
              "Stalemate is unavoidable",
            ],
            "Always box, never stalemate. Bring your king in close before delivering mate on an edge.",
          ),
          mc(
            "Bishops of opposite colour with one pawn each is usually…",
            2,
            ["A win for the side with the better king", "A win for the active side", "A draw"],
            "Opposite-colour bishop endings are notoriously drawn — pieces can't attack the same squares.",
          ),
        ],
      },
    },
  },

  "cup-king": {
    intermediate: {
      title: "Three-Cup Tracking",
      body: "Three cups, six swaps. Anchor a feature and track it through.",
      spec: { kind: "cups", cups: 3, swaps: 6, swapMs: 700, rounds: 3 },
    },
    advanced: {
      title: "Four-Cup Shuffle",
      body: "Four cups, ten swaps, faster pace. Chunk the swaps mentally.",
      spec: { kind: "cups", cups: 4, swaps: 10, swapMs: 500, rounds: 3 },
    },
    master: {
      title: "Master Shuffle",
      body: "Four cups, fourteen swaps, lightning pace. Soft-focus the whole table.",
      spec: { kind: "cups", cups: 4, swaps: 14, swapMs: 380, rounds: 3 },
    },
  },

  "stack-tower": {
    intermediate: {
      title: "Drop Window",
      body: "Tap when the block is dead-centre on the stack. Three perfects in a row.",
      spec: { kind: "timing", requiredPerfects: 3, sweepMs: 1300 },
    },
    advanced: {
      title: "Faster Stack",
      body: "Blocks scale up in speed past level 50. Stay perfect.",
      spec: { kind: "timing", requiredPerfects: 4, sweepMs: 1000, windowPct: 14 },
    },
    master: {
      title: "Speed Plateau",
      body: "Past 150 levels the block speed caps. Hold the metronome.",
      spec: { kind: "timing", requiredPerfects: 5, sweepMs: 750, windowPct: 11 },
    },
  },

  "block-blast": {
    intermediate: {
      title: "Combo Setup",
      body: "Recognise the placement that triggers the highest-value clear.",
      spec: {
        kind: "mc",
        questions: [
          mc(
            "Bottom row is 9/10 filled. The hole is on the right edge. You have an L-piece, a 1x3, and a square. Best placement?",
            1,
            [
              "L-piece across the row",
              "1x3 dropped into the hole + 2 cells of the next row",
              "Square in the corner",
            ],
            "1x3 vertically fills the hole AND starts the next row — sets up a follow-up combo.",
          ),
          mc(
            "Two rows are 8/10 filled with the same two empty columns. You have an I-piece (long bar) vertical. Placement?",
            0,
            ["Drop it down the empty column — clears both rows + a column", "Save it for later", "Place it horizontally on top"],
            "Single I-piece clears 2 rows + 1 column simultaneously = triple-combo multiplier.",
          ),
        ],
      },
    },
    advanced: {
      title: "Reserve-Lane Decisions",
      body: "Awkward pieces ruin runs. Pick the right reserve play.",
      spec: {
        kind: "mc",
        questions: [
          mc(
            "Your queue is square, square, T-piece. Bottom right is empty. You should…",
            1,
            [
              "Play both squares stacked in the bottom right",
              "Keep the bottom right column empty as a reset lane for the T-piece",
              "Stack squares vertically anywhere",
            ],
            "Reserve a column for awkward shapes — the T-piece needs that empty space to fit.",
          ),
          mc(
            "You can clear a row right now OR set up a 3-row I-piece combo next turn. The combo is worth…",
            1,
            ["Less than a single clear (greed kills runs)", "Far more — single clears almost never beat combos", "About the same"],
            "Combo multipliers stack — a 3-row clear scores 6–9× a single row clear.",
          ),
        ],
      },
    },
    master: {
      title: "Survival Reaction",
      body: "Survival mode is recognition speed. Tag seven targets in a row.",
      spec: { kind: "reaction", targetCount: 7 },
    },
  },

  tron: {
    intermediate: {
      title: "Cutoff Picker",
      body: "Tron is mostly geometry. Choose the territory-claim move that pays.",
      spec: {
        kind: "mc",
        questions: [
          mc(
            "You and the opponent are both heading right. You're slightly ahead. The high-percentage play is…",
            0,
            [
              "Cut down across in front of them to box them in",
              "Keep going straight",
              "Reverse direction (impossible) — turn into a wall",
            ],
            "Cutoff plays end games — being ahead is the prerequisite for the cut.",
          ),
          mc(
            "You're trapped inside a small box, opponent outside. To survive longest, fill it with…",
            1,
            ["A spiral inward", "Tight zig-zags", "A single diagonal"],
            "Zig-zags pack more wall into less space — buy yourself extra survival time.",
          ),
        ],
      },
    },
    advanced: {
      title: "Endgame Territory",
      body: "Late game is pure box math. The bigger remaining region wins.",
      spec: {
        kind: "mc",
        questions: [
          mc(
            "Both bikes are walled in. Yours has 28 free cells, theirs has 25. Optimal play is…",
            1,
            ["Attack their wall", "Fill your space as efficiently as possible — you win on count", "Crash on purpose"],
            "Bigger box wins on cell count. Don't risk the lead — pure efficiency fills.",
          ),
          mc(
            "Opponent perfectly mirrors your turns. To break symmetry you should…",
            0,
            ["Fake a turn, then reverse direction one cell later", "Keep mirroring back", "Slow down"],
            "Mirror defence falls to a 1-cell fake. The mirror reacts, you reverse, gap appears.",
          ),
        ],
      },
    },
    master: {
      title: "Millisecond Reflex",
      body: "Tron decisions are tens of milliseconds. Six clean targets, no misses.",
      spec: { kind: "reaction", targetCount: 6 },
    },
  },
};

export function getTierDrill(slug: string, tier: TrainingTier): TierDrillDefinition | null {
  if (tier === "beginner") return null;
  return TIER_DRILLS[slug]?.[tier] ?? null;
}

/* Re-exports for ergonomic imports. */
export { ReactionDrill, Target };
