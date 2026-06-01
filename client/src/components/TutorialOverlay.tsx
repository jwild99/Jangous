import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TutorialStep {
  id: string;
  title: string;
  text: string;
  /** CSS selector of the element to spotlight. If omitted, overlay is centered with no spotlight. */
  targetSelector?: string;
  /** "click" requires the user to click the target. "confirm" shows a Continue button. "watch" auto-advances after delay (ms in `autoAdvanceMs`). */
  mode?: "click" | "confirm" | "watch";
  actionLabel?: string;
  autoAdvanceMs?: number;
}

interface Props {
  open: boolean;
  steps: TutorialStep[];
  startStep?: number;
  onClose: () => void;
  onStepChange?: (step: number) => void;
  onComplete: () => void;
  title?: string;
}

export function TutorialOverlay({
  open, steps, startStep = 0, onClose, onStepChange, onComplete, title = "Training",
}: Props) {
  const [idx, setIdx] = useState(startStep);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = steps[idx];

  // Track target element rect (re-measure on scroll/resize).
  useEffect(() => {
    if (!open || !step?.targetSelector) {
      setTargetRect(null);
      return;
    }
    const update = () => {
      const el = document.querySelector(step.targetSelector!) as HTMLElement | null;
      if (el) {
        // Make sure it's in view
        try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch {}
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };
    update();
    const interval = setInterval(update, 250); // re-measure for animated/late-mounting targets
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, step?.targetSelector, idx]);

  const advance = useCallback(() => {
    if (idx >= steps.length - 1) {
      onComplete();
      return;
    }
    const next = idx + 1;
    setIdx(next);
    onStepChange?.(next);
  }, [idx, steps.length, onComplete, onStepChange]);

  const back = useCallback(() => {
    if (idx > 0) {
      const next = idx - 1;
      setIdx(next);
      onStepChange?.(next);
    }
  }, [idx, onStepChange]);

  // Click-mode: listen for clicks on the target.
  useEffect(() => {
    if (!open || step?.mode !== "click" || !step.targetSelector) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(step.targetSelector!)) {
        // Slight delay so the click visual lands
        setTimeout(() => advance(), 220);
      }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [open, step?.mode, step?.targetSelector, advance]);

  // Watch mode: auto-advance.
  useEffect(() => {
    if (!open || step?.mode !== "watch") return;
    const t = setTimeout(() => advance(), step.autoAdvanceMs ?? 2500);
    return () => clearTimeout(t);
  }, [open, idx, step?.mode, step?.autoAdvanceMs, advance]);

  // Keyboard nav.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && step?.mode !== "click") advance();
      if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, advance, back, onClose, step?.mode]);

  if (!open || !step) return null;

  // Compute tooltip position.
  const tooltipStyle = computeTooltipStyle(targetRect);

  // Spotlight rect with padding.
  const PAD = 8;
  const spotlight = targetRect
    ? {
        top: targetRect.top - PAD,
        left: targetRect.left - PAD,
        width: targetRect.width + PAD * 2,
        height: targetRect.height + PAD * 2,
      }
    : null;

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9998] pointer-events-none"
        data-testid="tutorial-overlay"
      >
        {/* Dark mask with cutout via 4 rectangles. */}
        {spotlight ? (
          <>
            {/* top */}
            <div className="absolute left-0 top-0 right-0 bg-black/70 pointer-events-auto" style={{ height: Math.max(0, spotlight.top) }} onClick={onClose} />
            {/* bottom */}
            <div className="absolute left-0 right-0 bottom-0 bg-black/70 pointer-events-auto" style={{ top: spotlight.top + spotlight.height }} onClick={onClose} />
            {/* left */}
            <div className="absolute left-0 bg-black/70 pointer-events-auto" style={{ top: spotlight.top, width: Math.max(0, spotlight.left), height: spotlight.height }} onClick={onClose} />
            {/* right */}
            <div className="absolute bg-black/70 pointer-events-auto" style={{ top: spotlight.top, left: spotlight.left + spotlight.width, right: 0, height: spotlight.height }} onClick={onClose} />
            {/* spotlight ring */}
            <motion.div
              key={`spot-${idx}`}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute rounded-xl ring-2 ring-primary pointer-events-none"
              style={{
                top: spotlight.top,
                left: spotlight.left,
                width: spotlight.width,
                height: spotlight.height,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.7), 0 0 40px 4px rgba(139,92,246,0.6)",
              }}
            />
          </>
        ) : (
          <div className="absolute inset-0 bg-black/75 pointer-events-auto" onClick={onClose} />
        )}

        {/* Tooltip */}
        <motion.div
          ref={tooltipRef}
          key={`tooltip-${idx}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute pointer-events-auto max-w-sm w-[min(92vw,22rem)] rounded-xl border border-primary/40 bg-background/95 backdrop-blur shadow-2xl p-4"
          style={tooltipStyle}
          data-testid="tutorial-tooltip"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              {title}
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover-elevate active-elevate-2 rounded-md p-1"
              data-testid="button-tutorial-close"
              aria-label="Close tutorial"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="text-base font-bold mb-1" data-testid="text-tutorial-title">{step.title}</div>
          <div className="text-sm text-muted-foreground mb-3" data-testid="text-tutorial-body">{step.text}</div>
          {step.mode === "click" && (
            <div className="text-xs text-primary mb-3 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {step.actionLabel ?? "Click the highlighted element to continue"}
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">Step {idx + 1} of {steps.length}</div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="ghost" onClick={back} disabled={idx === 0} data-testid="button-tutorial-back">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {step.mode !== "click" && (
                <Button size="sm" onClick={advance} data-testid="button-tutorial-next">
                  {idx === steps.length - 1 ? (<><CheckCircle2 className="w-4 h-4 mr-1" /> Finish</>) : (<>Next <ChevronRight className="w-4 h-4 ml-1" /></>)}
                </Button>
              )}
            </div>
          </div>
          {/* progress bar */}
          <div className="mt-3 h-1 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={false}
              animate={{ width: `${((idx + 1) / steps.length) * 100}%` }}
              transition={{ type: "spring", stiffness: 80, damping: 18 }}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function computeTooltipStyle(rect: DOMRect | null): React.CSSProperties {
  if (typeof window === "undefined") return {};
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tooltipW = Math.min(352, vw * 0.92);
  if (!rect) {
    return {
      top: vh / 2 - 120,
      left: vw / 2 - tooltipW / 2,
    };
  }
  const margin = 16;
  const below = rect.bottom + margin;
  const above = rect.top - margin - 200;
  let top: number;
  if (below + 220 < vh) top = below;
  else if (above > 0) top = above;
  else top = Math.max(16, vh / 2 - 120);

  let left = rect.left + rect.width / 2 - tooltipW / 2;
  left = Math.max(12, Math.min(left, vw - tooltipW - 12));

  return { top, left, width: tooltipW };
}
