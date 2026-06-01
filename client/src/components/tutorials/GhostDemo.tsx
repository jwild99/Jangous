import { useEffect, useRef, useState, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A single step in a ghost demo: at `at` ms after start, perform `action`. */
export interface GhostStep<TAction = unknown> {
  /** Milliseconds from demo start when this step should fire. */
  at: number;
  /** Human-readable caption shown in the overlay while the step is active. */
  caption?: string;
  /** Optional payload the host can use (e.g. column index, choice name). */
  action?: TAction;
}

export interface GhostDemoProps<TAction = unknown> {
  /** Recorded sequence of actions to replay. */
  steps: GhostStep<TAction>[];
  /** Called for each step when it fires. Use this to highlight a cell, move a marker, etc. */
  onStep?: (step: GhostStep<TAction>, index: number) => void;
  /** Called when the full sequence finishes (or is dismissed). */
  onFinish?: () => void;
  /** If true, the demo starts automatically on mount. Otherwise the user clicks the Play button. */
  autoPlay?: boolean;
  /** Top-level heading shown inside the overlay. */
  title?: string;
  /** Persistent caption shown above the per-step caption. */
  description?: string;
  /** Optional children rendered inside the overlay, e.g. a visual replay surface. */
  children?: ReactNode;
}

/** Reusable overlay that replays a recorded sequence on the active mini-game. */
export function GhostDemo<TAction = unknown>({
  steps,
  onStep,
  onFinish,
  autoPlay = false,
  title = "Ghost Demo",
  description,
  children,
}: GhostDemoProps<TAction>) {
  const [playing, setPlaying] = useState(autoPlay);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  useEffect(() => {
    if (!playing) return;
    setActiveIdx(-1);
    clearTimers();
    steps.forEach((step, i) => {
      const t = setTimeout(() => {
        setActiveIdx(i);
        onStep?.(step, i);
      }, step.at);
      timersRef.current.push(t);
    });
    const totalMs = steps.length ? steps[steps.length - 1].at + 900 : 0;
    const finish = setTimeout(() => {
      setPlaying(false);
      setActiveIdx(-1);
      onFinish?.();
    }, totalMs);
    timersRef.current.push(finish);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const handleDismiss = () => {
    clearTimers();
    setPlaying(false);
    setActiveIdx(-1);
    onFinish?.();
  };

  const activeCaption = activeIdx >= 0 ? steps[activeIdx]?.caption : undefined;

  return (
    <div className="relative rounded-lg border border-primary/30 bg-primary/5 p-3" data-testid="ghost-demo">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-primary font-semibold">
          <Sparkles className="w-3.5 h-3.5" /> {title}
        </div>
        {playing ? (
          <Button size="sm" variant="ghost" onClick={handleDismiss} data-testid="button-ghost-stop">
            <X className="w-3.5 h-3.5 mr-1" /> Stop
          </Button>
        ) : (
          <Button size="sm" onClick={() => setPlaying(true)} data-testid="button-ghost-play">
            <Play className="w-3.5 h-3.5 mr-1" /> Show me
          </Button>
        )}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground mb-2">{description}</p>
      )}
      {children}
      <AnimatePresence>
        {playing && activeCaption && (
          <motion.div
            key={`caption-${activeIdx}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-2 rounded-md bg-background/80 border border-primary/30 px-2 py-1.5 text-xs"
            data-testid="text-ghost-caption"
          >
            {activeCaption}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
