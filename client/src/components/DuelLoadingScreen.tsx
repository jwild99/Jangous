import { motion, AnimatePresence } from "framer-motion";
import { Swords, Zap, Trophy, Target, Sparkles } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { soundManager } from "@/lib/soundManager";

const loadingBlurbs = [
  "Shuffling the deck in your favor...",
  "Warming up the chess pieces...",
  "Rolling out the putting green...",
  "Calculating your odds of glory...",
  "Setting up your match arena...",
  "Sharpening your competitive edge...",
  "Preparing the battlefield...",
  "Syncing your winning streak...",
  "Polishing the trophy case...",
  "Connecting to your opponent...",
  "Loading the game rules...",
  "Calibrating the challenge level...",
  "Gathering the pieces...",
  "Ready... Set...",
  "Let the games begin...",
  "Fortune favors the skilled...",
  "May the best player win...",
  "Preparing your victory moment...",
  "Setting up fair play protocols...",
  "Initializing match systems...",
];

interface DuelLoadingScreenProps {
  message?: string;
  showIcon?: boolean;
  /** When true, shows a 3→2→1→GO countdown overlay before the loader */
  showCountdown?: boolean;
  /** Called when the countdown finishes (after "GO!") */
  onCountdownComplete?: () => void;
}

// ─── Countdown Overlay ───────────────────────────────────────────────────────

function CountdownOverlay({ onDone }: { onDone: () => void }) {
  const [tick, setTick] = useState<number | "GO" | null>(3);

  useEffect(() => {
    soundManager.playCountdown();

    const steps: Array<number | "GO" | null> = [3, 2, 1, "GO", null];
    let i = 0;

    const advance = () => {
      i++;
      if (i >= steps.length) {
        onDone();
        return;
      }
      const next = steps[i];
      setTick(next);
      if (typeof next === "number") soundManager.playCountdown();
      if (next === "GO") soundManager.playMatchStart?.();
      if (next !== null) {
        setTimeout(advance, next === "GO" ? 700 : 900);
      }
    };

    const timer = setTimeout(advance, 900);
    return () => clearTimeout(timer);
  }, [onDone]);

  if (tick === null) return null;

  const isGo = tick === "GO";

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <AnimatePresence mode="wait">
        <motion.div
          key={String(tick)}
          initial={{ scale: 1.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="text-center select-none"
        >
          <motion.p
            className={`font-black leading-none ${
              isGo
                ? "text-8xl md:text-[120px] text-green-400"
                : "text-9xl md:text-[160px] text-white"
            }`}
            style={{
              textShadow: isGo
                ? "0 0 60px #22c55e, 0 0 30px #22c55e"
                : "0 0 40px rgba(255,255,255,0.4)",
            }}
            animate={isGo ? { scale: [1, 1.12, 1] } : { scale: [1, 0.94, 1] }}
            transition={{ duration: 0.5 }}
          >
            {isGo ? "GO!" : tick}
          </motion.p>
          {isGo && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-green-300 text-xl font-semibold mt-3 tracking-widest uppercase"
            >
              Game On
            </motion.p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Main loader ─────────────────────────────────────────────────────────────

export default function DuelLoadingScreen({
  message,
  showIcon = true,
  showCountdown = false,
  onCountdownComplete,
}: DuelLoadingScreenProps) {
  const [currentBlurb, setCurrentBlurb] = useState(
    message || loadingBlurbs[Math.floor(Math.random() * loadingBlurbs.length)]
  );
  const [dots, setDots] = useState("");
  const [countingDown, setCountingDown] = useState(showCountdown);

  useEffect(() => {
    if (!message) {
      const blurbInterval = setInterval(() => {
        setCurrentBlurb(loadingBlurbs[Math.floor(Math.random() * loadingBlurbs.length)]);
      }, 3000);
      return () => clearInterval(blurbInterval);
    }
  }, [message]);

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(dotInterval);
  }, []);

  const IconComponent = useMemo(() => {
    const icons = [Swords, Zap, Trophy, Target, Sparkles];
    return icons[Math.floor(Math.random() * icons.length)];
  }, []);

  function handleCountdownDone() {
    setCountingDown(false);
    onCountdownComplete?.();
  }

  return (
    <>
      {/* Countdown overlay */}
      {countingDown && <CountdownOverlay onDone={handleCountdownDone} />}

      {/* Loader */}
      <div
        className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center"
        data-testid="loading-screen"
      >
        <div className="text-center space-y-8 max-w-md px-6">
          {showIcon && (
            <motion.div
              animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="flex justify-center"
            >
              <div className="relative">
                <IconComponent className="w-20 h-20 text-primary" />
                <motion.div
                  className="absolute inset-0"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <IconComponent className="w-20 h-20 text-primary blur-md" />
                </motion.div>
              </div>
            </motion.div>
          )}

          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-2xl font-bold font-display text-primary">
                Setting up your match{dots}
              </h2>
            </motion.div>

            <motion.p
              key={currentBlurb}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
              className="text-muted-foreground text-base"
              data-testid="text-loading-blurb"
            >
              {currentBlurb}
            </motion.p>
          </div>

          {/* Loading bar */}
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-primary/60"
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              style={{ width: "50%" }}
            />
          </div>

          {/* Particles */}
          <div className="relative h-32">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-primary/30 rounded-full"
                animate={{
                  y: [-20, -100],
                  x: [Math.sin(i) * 50, Math.sin(i + 1) * 70, Math.sin(i + 2) * 50],
                  opacity: [0, 1, 0],
                }}
                transition={{ duration: 3 + i * 0.5, repeat: Infinity, delay: i * 0.3, ease: "easeOut" }}
                style={{ left: `${20 + i * 15}%`, bottom: 0 }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
