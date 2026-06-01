import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Lightbulb, Sparkles, ThumbsUp, Frown } from "lucide-react";

export type CoachEventType = "success" | "miss" | "idle" | "hint" | "streak" | "intro";

export interface CoachEvent {
  type: CoachEventType;
  /** Optional context — `stepId` is used for struggle detection. `message` overrides the default pool. */
  context?: {
    stepId?: string;
    message?: string;
    /** Hint text the coach should offer once the player has struggled enough on this step. */
    hint?: string;
    /** Required misses on a single step before the coach auto-offers the hint. Defaults to 3. */
    struggleThreshold?: number;
  };
}

interface CoachLine {
  text: string;
  tone: "positive" | "negative" | "neutral" | "hint";
}

interface CoachContextValue {
  emitCoachEvent: (event: CoachEvent) => void;
  /** Internal: current line shown by `<TrainingCoach />`. Consumers should use `emitCoachEvent`. */
  current: CoachLine | null;
}

const CoachCtx = createContext<CoachContextValue | null>(null);

const LINE_POOLS: Record<CoachEventType, string[]> = {
  intro: [
    "I'm Coach Jango — I'll call out tips as you play.",
    "Welcome in. I'll keep an eye on your form.",
    "Ready when you are. I'll chime in when it matters.",
  ],
  success: [
    "Perfect shot!",
    "Great timing!",
    "That's the read.",
    "Clean execution.",
    "You're locked in.",
    "Big play.",
  ],
  miss: [
    "Shake it off — next one's yours.",
    "Close. Reset and try again.",
    "Happens. Watch the setup this time.",
    "Almost — adjust and re-fire.",
  ],
  idle: [
    "Take your time, but trust your read.",
    "Whenever you're ready.",
    "No rush — pick your spot.",
  ],
  hint: [
    "Try this:",
    "Quick tip:",
    "Here's an angle:",
  ],
  streak: [
    "You're on fire!",
    "Don't slow down — keep cooking.",
    "Three in a row — that's championship form.",
  ],
};

function pickLine(type: CoachEventType, override?: string): CoachLine {
  const tone: CoachLine["tone"] =
    type === "success" || type === "streak" ? "positive" :
    type === "miss" ? "negative" :
    type === "hint" ? "hint" : "neutral";
  if (override) return { text: override, tone };
  const pool = LINE_POOLS[type];
  return { text: pool[Math.floor(Math.random() * pool.length)], tone };
}

export function CoachProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<CoachLine | null>(null);
  // Track misses per stepId so the coach can auto-offer a hint.
  const struggleRef = useRef<Map<string, number>>(new Map());
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showLine = useCallback((line: CoachLine, holdMs = 3200) => {
    setCurrent(line);
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => setCurrent(null), holdMs);
  }, []);

  const emitCoachEvent = useCallback((event: CoachEvent) => {
    const stepId = event.context?.stepId;
    if (event.type === "miss" && stepId) {
      const next = (struggleRef.current.get(stepId) ?? 0) + 1;
      struggleRef.current.set(stepId, next);
      const threshold = event.context?.struggleThreshold ?? 3;
      if (next >= threshold && event.context?.hint) {
        showLine(pickLine("hint", event.context.hint), 5000);
        struggleRef.current.set(stepId, 0); // reset so it can fire again later
        return;
      }
    }
    if (event.type === "success" && stepId) {
      struggleRef.current.set(stepId, 0);
    }
    showLine(pickLine(event.type, event.context?.message));
  }, [showLine]);

  // Idle nudge: if no event in 25s, drop a gentle nudge.
  useEffect(() => {
    const reset = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        showLine(pickLine("idle"));
      }, 25000);
    };
    reset();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, [current, showLine]);

  const value = useMemo<CoachContextValue>(() => ({ emitCoachEvent, current }), [emitCoachEvent, current]);

  return <CoachCtx.Provider value={value}>{children}</CoachCtx.Provider>;
}

export function useCoach(): CoachContextValue {
  const ctx = useContext(CoachCtx);
  if (!ctx) {
    // Safe no-op fallback so trainings rendered outside the shell don't crash.
    return { emitCoachEvent: () => {}, current: null };
  }
  return ctx;
}

/** Convenience: matches the spec name `emitCoachEvent`. */
export function useEmitCoachEvent() {
  return useCoach().emitCoachEvent;
}

const TONE_STYLES: Record<CoachLine["tone"], { bubble: string; ring: string; icon: ReactNode }> = {
  positive: {
    bubble: "bg-emerald-500/15 border-emerald-500/40 text-emerald-100",
    ring: "from-emerald-400/40 to-emerald-500/10",
    icon: <ThumbsUp className="w-3.5 h-3.5" />,
  },
  negative: {
    bubble: "bg-rose-500/15 border-rose-500/40 text-rose-100",
    ring: "from-rose-400/40 to-rose-500/10",
    icon: <Frown className="w-3.5 h-3.5" />,
  },
  hint: {
    bubble: "bg-amber-500/15 border-amber-500/40 text-amber-100",
    ring: "from-amber-400/40 to-amber-500/10",
    icon: <Lightbulb className="w-3.5 h-3.5" />,
  },
  neutral: {
    bubble: "bg-primary/15 border-primary/40 text-primary-foreground",
    ring: "from-primary/40 to-primary/10",
    icon: <Sparkles className="w-3.5 h-3.5" />,
  },
};

/** Floating coach avatar + speech bubble. Pulls its current line from `CoachProvider`. */
export function TrainingCoach() {
  const { current } = useCoach();
  return (
    <div
      className="pointer-events-none absolute bottom-3 left-3 md:bottom-4 md:left-4 flex items-end gap-2 z-20 max-w-[80%]"
      data-testid="training-coach"
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 16 }}
        className="relative w-10 h-10 rounded-full bg-gradient-to-br from-primary/40 to-fuchsia-500/30 border border-primary/50 flex items-center justify-center shrink-0 shadow-lg"
      >
        <Bot className="w-5 h-5 text-primary-foreground" />
        <motion.div
          className="absolute inset-0 rounded-full border border-primary/40"
          animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        />
      </motion.div>
      <AnimatePresence>
        {current && (
          <motion.div
            key={current.text}
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className={`relative rounded-xl border backdrop-blur px-3 py-2 text-xs md:text-sm font-medium shadow-xl ${TONE_STYLES[current.tone].bubble}`}
            data-testid="text-coach-line"
          >
            <div className="flex items-start gap-1.5">
              <span className="mt-0.5">{TONE_STYLES[current.tone].icon}</span>
              <span>{current.text}</span>
            </div>
            <div className={`absolute -inset-px -z-10 rounded-xl bg-gradient-to-br ${TONE_STYLES[current.tone].ring} blur-md`} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
