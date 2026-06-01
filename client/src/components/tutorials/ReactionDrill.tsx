import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Zap, Target, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEmitCoachEvent } from "./TrainingCoach";
import type { DrillPass } from "./TierDrills";

const REACTION_STEP_ID = "reaction-drill";

/**
 * Shared "Master tier" interactive drill. Player must tap 5 targets that
 * appear in random positions as fast as possible. Calls `onPass` when the
 * round completes — pass/fail is informational, the gate just requires
 * playing the round.
 */
export function ReactionDrill({
  onPass,
  targetCount = 5,
  accent = "text-primary",
}: {
  onPass: DrillPass;
  targetCount?: number;
  accent?: string;
}) {
  const [hits, setHits] = useState(0);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const lastTapRef = useRef<number>(0);
  const passedRef = useRef(false);
  const emit = useEmitCoachEvent();

  useEffect(() => {
    if (running && hits >= targetCount && !finishedAt) {
      const end = Date.now();
      setFinishedAt(end);
      setRunning(false);
      const totalSec = startedAt ? (end - startedAt) / 1000 : 0;
      const message =
        totalSec < 3
          ? "Lightning hands — that's tournament tempo."
          : totalSec < 5
            ? "Sharp reactions. That speed will hold up in ranked."
            : "Round cleared — work on smoothing the tracking next.";
      emit({ type: "success", context: { stepId: REACTION_STEP_ID, message } });
      if (!passedRef.current) {
        passedRef.current = true;
        const seconds = Number(totalSec.toFixed(2));
        // Give the player a beat to see their final time.
        setTimeout(
          () =>
            onPass({
              drillKind: "reaction",
              score: seconds,
              metric: "s to clear",
              higherIsBetter: false,
            }),
          900,
        );
      }
    }
  }, [hits, running, targetCount, finishedAt, onPass, startedAt, emit]);

  const start = () => {
    passedRef.current = false;
    setHits(0);
    setFinishedAt(null);
    const now = Date.now();
    setStartedAt(now);
    lastTapRef.current = now;
    setRunning(true);
    setPos({ x: Math.floor(Math.random() * 80) + 10, y: Math.floor(Math.random() * 60) + 20 });
  };

  const tap = () => {
    if (!running) return;
    const now = Date.now();
    const gap = now - lastTapRef.current;
    lastTapRef.current = now;
    const nextHits = hits + 1;
    setHits(nextHits);
    setPos({ x: Math.floor(Math.random() * 80) + 10, y: Math.floor(Math.random() * 60) + 20 });
    // Mid-round feedback: streak on a fast chain, miss with hint on a slow one.
    if (nextHits < targetCount) {
      if (gap > 1500) {
        emit({
          type: "miss",
          context: {
            stepId: REACTION_STEP_ID,
            hint: "Keep your eyes on the arena — predict where the next target will pop, don't react to it cold.",
            struggleThreshold: 2,
          },
        });
      } else if (gap < 500 && nextHits >= 2) {
        emit({ type: "streak", context: { stepId: REACTION_STEP_ID } });
      } else {
        emit({ type: "success", context: { stepId: REACTION_STEP_ID } });
      }
    }
  };

  const elapsed = finishedAt && startedAt ? ((finishedAt - startedAt) / 1000).toFixed(2) : null;
  const rating = elapsed
    ? Number(elapsed) < 3
      ? "Lightning"
      : Number(elapsed) < 5
        ? "Sharp"
        : Number(elapsed) < 8
          ? "Steady"
          : "Practice"
    : null;

  return (
    <div className="space-y-3" data-testid="reaction-drill">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Target className={`w-3.5 h-3.5 ${accent}`} /> Hits {hits} / {targetCount}
        </span>
        {elapsed && (
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="tabular-nums font-semibold" data-testid="text-drill-time">{elapsed}s</span>
            <span className="text-amber-300">· {rating}</span>
          </span>
        )}
      </div>

      <div
        className="relative h-44 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-fuchsia-500/5 overflow-hidden"
        data-testid="drill-arena"
      >
        {!running && hits === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-4">
            <div className="text-sm font-semibold">Tap 5 targets as fast as you can</div>
            <div className="text-xs text-muted-foreground">Speed is the whole point of Master tier.</div>
            <Button size="sm" onClick={start} className="mt-2" data-testid="button-drill-start">
              <Zap className="w-4 h-4 mr-1" /> Start Drill
            </Button>
          </div>
        )}

        {running && (
          <motion.button
            key={`target-${hits}`}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
            onClick={tap}
            className="absolute w-12 h-12 rounded-full bg-amber-400 border-2 border-amber-200 shadow-[0_0_24px_rgba(251,191,36,0.7)] hover-elevate active-elevate-2"
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%, -50%)" }}
            data-testid="button-drill-target"
            aria-label="Hit target"
          />
        )}

        {!running && hits >= targetCount && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-4">
            <motion.div
              initial={{ scale: 0.5, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 14 }}
            >
              <Zap className="w-10 h-10 text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.7)]" />
            </motion.div>
            <div className="text-lg font-bold">{rating}!</div>
            <div className="text-xs text-muted-foreground tabular-nums">Cleared in {elapsed}s</div>
            <Button size="sm" variant="outline" onClick={start} data-testid="button-drill-restart">
              <RotateCcw className="w-4 h-4 mr-1" /> Try Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
