import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Trophy, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { getXPForNextLevel, getXPProgress } from "@shared/achievementDefinitions";
import { onXPGained } from "@/lib/xpEvents";

interface LevelProgressBarProps {
  level: number;
  currentXP: number;
  compact?: boolean;
}

export function LevelProgressBar({ level, currentXP, compact = false }: LevelProgressBarProps) {
  const nextLevelXP = getXPForNextLevel(level);
  const progress    = getXPProgress(currentXP, level);
  const xpNeeded    = nextLevelXP - currentXP;
  const [glowing, setGlowing] = useState(false);
  const [xpPopup, setXpPopup] = useState<number | null>(null);
  const glowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return onXPGained(({ xp }) => {
      if (glowTimer.current) clearTimeout(glowTimer.current);
      setGlowing(true);
      setXpPopup(xp);
      glowTimer.current = setTimeout(() => {
        setGlowing(false);
        setXpPopup(null);
      }, 2400);
    });
  }, []);

  const getLevelColor = () => {
    if (level >= 50) return "text-primary";
    if (level >= 25) return "text-secondary";
    if (level >= 10) return "text-accent";
    return "text-foreground";
  };

  const getLevelBorder = () => {
    if (level >= 50) return "border-primary glow-primary";
    if (level >= 25) return "border-secondary glow-secondary";
    if (level >= 10) return "border-accent glow-accent";
    return "border-border";
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 relative" data-testid="level-progress-compact">
        <Badge variant="outline" className={`gap-1 ${getLevelBorder()}`}>
          <Star className="w-3 h-3" />
          Level {level}
        </Badge>
        <div className="flex-1 max-w-xs relative">
          <div
            className="rounded-full overflow-hidden transition-shadow duration-500"
            style={glowing ? { boxShadow: "0 0 12px rgba(234,179,8,0.7), 0 0 4px rgba(234,179,8,0.4)" } : undefined}
          >
            <Progress value={progress} className="h-2" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{xpNeeded} XP to level {level + 1}</p>
        </div>

        <AnimatePresence>
          {xpPopup !== null && (
            <motion.div
              key="xp-compact"
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 0, y: -22 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="absolute -top-6 right-0 flex items-center gap-0.5 text-yellow-400 font-black text-xs pointer-events-none select-none"
              style={{ textShadow: "0 0 8px rgba(234,179,8,0.9)" }}
            >
              <TrendingUp className="w-3 h-3" />+{xpPopup} XP
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-3 relative" data-testid="level-progress-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
            className={getLevelColor()}
          >
            <Trophy className="w-6 h-6" />
          </motion.div>
          <div>
            <h3 className="text-lg font-bold">
              Level <span className={`font-mono ${getLevelColor()}`} data-testid="text-level">{level}</span>
            </h3>
            <p className="text-sm text-muted-foreground">{currentXP.toLocaleString()} Total XP</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold font-mono" data-testid="text-xp-needed">
            {xpNeeded.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">XP to next level</p>
        </div>
      </div>

      <div className="space-y-2 relative">
        <AnimatePresence>
          {xpPopup !== null && (
            <motion.div
              key="xp-full"
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 0, y: -22 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.6, ease: "easeOut" }}
              className="absolute -top-7 right-0 flex items-center gap-1 text-yellow-400 font-black text-sm pointer-events-none select-none"
              style={{ textShadow: "0 0 10px rgba(234,179,8,0.9)" }}
            >
              <TrendingUp className="w-3.5 h-3.5" />+{xpPopup} XP
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className="h-3 bg-muted rounded-full overflow-hidden border border-border"
          animate={glowing
            ? { boxShadow: ["0 0 0px rgba(234,179,8,0)", "0 0 20px rgba(234,179,8,0.8)", "0 0 8px rgba(234,179,8,0.35)"] }
            : { boxShadow: "0 0 0px rgba(234,179,8,0)" }
          }
          transition={{ duration: 1.4 }}
        >
          <motion.div
            className="h-full bg-gradient-to-r from-primary via-secondary to-accent relative overflow-hidden"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{ x: ["-100%", "200%"] }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            />
          </motion.div>
        </motion.div>

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{progress.toFixed(1)}% complete</span>
          <span>Next: Level {level + 1}</span>
        </div>
      </div>
    </div>
  );
}
