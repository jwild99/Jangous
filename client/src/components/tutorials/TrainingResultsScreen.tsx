import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Star, ArrowRight, Home, Sparkles, Zap, Coins, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getRarityStyle, type Rarity } from "./trainingRewards";

export interface TrainingResultsScreenProps {
  rewardName: string;
  rarity: Rarity;
  xpEarned: number;
  coinsEarned?: number;
  stars: number; // 0..3
  masterGranted?: boolean;
  masterXp?: number;
  masterCoins?: number;
  nextTutorialId: string | null;
  nextTutorialTitle: string | null;
  onContinueNext?: () => void;
  onBackToHub: () => void;
  onEnterLobby: () => void;
}

/**
 * Premium full-screen "results" celebration shown after a tutorial is claimed.
 * Confetti, XP counter, animated star rating, rarity-tinted reward card, and a
 * clear next-step CTA. Pure presentation — no network calls.
 */
export function TrainingResultsScreen({
  rewardName,
  rarity,
  xpEarned,
  coinsEarned = 0,
  stars,
  masterGranted = false,
  masterXp = 0,
  masterCoins = 0,
  nextTutorialId,
  nextTutorialTitle,
  onContinueNext,
  onBackToHub,
  onEnterLobby,
}: TrainingResultsScreenProps) {
  const rs = getRarityStyle(rarity);
  const RarityIcon = rs.icon;

  // Animated XP counter
  const [displayXp, setDisplayXp] = useState(0);
  useEffect(() => {
    const duration = 900;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayXp(Math.round(xpEarned * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [xpEarned]);

  // CSS confetti — generated once per mount, deterministic positions/colors.
  const confettiPieces = useMemo(() => {
    const colors = ["#22d3ee", "#a78bfa", "#f472b6", "#fbbf24", "#34d399"];
    return Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      duration: 1.6 + Math.random() * 1.2,
      color: colors[i % colors.length],
      rotate: Math.random() * 360,
      size: 6 + Math.random() * 6,
    }));
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        key="results-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden"
        data-testid="training-results-screen"
      >
        {/* Confetti layer */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {confettiPieces.map((p) => (
            <span
              key={p.id}
              className="absolute block rounded-sm"
              style={{
                left: `${p.left}%`,
                top: "-5%",
                width: p.size,
                height: p.size * 1.6,
                background: p.color,
                transform: `rotate(${p.rotate}deg)`,
                animation: `training-confetti ${p.duration}s ${p.delay}s ease-in forwards`,
                opacity: 0.85,
              }}
            />
          ))}
        </div>

        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(circle at 50% 35%, rgba(139,92,246,0.25), transparent 55%), radial-gradient(circle at 50% 80%, rgba(34,211,238,0.18), transparent 60%)",
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 140, damping: 18 }}
          className="relative w-full max-w-md"
        >
          <Card className={`relative overflow-hidden ${rs.ringClass} ${rs.glowClass}`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${rs.gradientFrom} ${rs.gradientTo} pointer-events-none`} />

            <div className="relative p-6 sm:p-8 text-center space-y-5">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.1 }}
                className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-amber-400/30 to-fuchsia-500/20 border border-amber-300/40 flex items-center justify-center"
              >
                <Trophy className="w-10 h-10 text-amber-300" />
              </motion.div>

              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-1.5">
                  Training Complete
                </div>
                <motion.h2
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-2xl sm:text-3xl font-bold"
                  data-testid="text-results-title"
                >
                  Nice work.
                </motion.h2>
              </div>

              {/* Stars */}
              <div className="flex items-center justify-center gap-2" data-testid="text-results-stars">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 220, damping: 12, delay: 0.35 + i * 0.12 }}
                  >
                    <Star
                      className={`w-8 h-8 ${i < stars ? "text-amber-300 fill-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" : "text-muted-foreground/30"}`}
                    />
                  </motion.div>
                ))}
              </div>

              {/* XP + coins counters */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex items-center justify-center gap-4 text-lg flex-wrap"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-300" />
                  <span className="font-bold tabular-nums" data-testid="text-results-xp">
                    +{displayXp} XP
                  </span>
                </div>
                {coinsEarned > 0 && (
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-yellow-400" />
                    <span className="font-bold tabular-nums" data-testid="text-results-coins">
                      +{coinsEarned.toLocaleString()}
                    </span>
                  </div>
                )}
              </motion.div>

              {masterGranted && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.7, type: "spring", stiffness: 180, damping: 14 }}
                  className="p-4 rounded-xl bg-gradient-to-r from-amber-500/20 via-fuchsia-500/20 to-cyan-500/20 border border-fuchsia-400/50 text-center space-y-1"
                  data-testid="panel-training-master-granted"
                >
                  <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-widest">
                    <Crown className="w-4 h-4 text-amber-300" />
                    <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-fuchsia-300 to-cyan-300">
                      Training Master
                    </span>
                  </div>
                  <div className="text-sm font-semibold">All trainings complete!</div>
                  <div className="text-xs text-muted-foreground">
                    +{masterXp.toLocaleString()} bonus XP • +{masterCoins.toLocaleString()} coins • Mythic badge + profile border
                  </div>
                </motion.div>
              )}

              {/* Reward card */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 }}
                className={`p-4 rounded-xl ${rs.badgeBgClass}`}
                data-testid="card-results-reward"
              >
                <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-widest mb-2">
                  <RarityIcon className={`w-3.5 h-3.5 ${rs.textClass}`} />
                  <span className={`font-semibold ${rs.textClass}`}>{rs.label}</span>
                </div>
                <div className={`font-bold text-base ${rs.badgeTextClass}`}>{rewardName}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Added to your inventory — equip it anytime.
                </div>
              </motion.div>

              {/* Next-up CTA */}
              {nextTutorialId && nextTutorialTitle && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="p-3 rounded-lg bg-primary/10 border border-primary/25 text-xs text-primary/90 flex items-center justify-center gap-2"
                  data-testid="text-results-next-unlocked"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    <span className="font-semibold">{nextTutorialTitle}</span> unlocked
                  </span>
                </motion.div>
              )}

              {/* Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="flex flex-col sm:flex-row gap-2 pt-1"
              >
                <Button
                  variant="outline"
                  onClick={onBackToHub}
                  className="flex-1"
                  data-testid="button-results-hub"
                >
                  <Home className="w-4 h-4 mr-1.5" /> Training Hub
                </Button>
                {nextTutorialId && onContinueNext ? (
                  <Button
                    onClick={onContinueNext}
                    className="flex-1"
                    data-testid="button-results-continue-next"
                  >
                    Continue <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                ) : (
                  <Button
                    onClick={onEnterLobby}
                    className="flex-1"
                    data-testid="button-results-lobby"
                  >
                    Enter Lobby <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                )}
              </motion.div>
            </div>
          </Card>
        </motion.div>

        <style>{`
          @keyframes training-confetti {
            0% { transform: translateY(-10vh) rotate(0deg); opacity: 0.95; }
            100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );
}
