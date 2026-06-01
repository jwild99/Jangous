import { motion } from "framer-motion";
import { Flame, Zap, Star } from "lucide-react";
import { Card } from "@/components/ui/card";

interface HotStreakMeterProps {
  currentStreak: number;
  streakType: "win" | "loss" | "none";
}

export function HotStreakMeter({ currentStreak, streakType }: HotStreakMeterProps) {
  if (currentStreak < 3 || streakType !== "win") {
    return null;
  }

  // Determine glow intensity based on streak
  const getStreakLevel = () => {
    if (currentStreak >= 10) return "legendary";
    if (currentStreak >= 5) return "epic";
    return "hot";
  };

  const level = getStreakLevel();
  
  const getStreakColor = () => {
    switch (level) {
      case "legendary":
        return "from-primary via-secondary to-accent";
      case "epic":
        return "from-secondary to-primary";
      default:
        return "from-destructive to-primary";
    }
  };

  const getStreakIcon = () => {
    switch (level) {
      case "legendary":
        return <Star className="w-6 h-6" />;
      case "epic":
        return <Zap className="w-6 h-6" />;
      default:
        return <Flame className="w-6 h-6" />;
    }
  };

  const getStreakText = () => {
    switch (level) {
      case "legendary":
        return "LEGENDARY STREAK!";
      case "epic":
        return "UNSTOPPABLE!";
      default:
        return "ON FIRE!";
    }
  };

  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ 
        type: "spring",
        stiffness: 260,
        damping: 20
      }}
      data-testid="hot-streak-meter"
    >
      <Card 
        className={`relative overflow-hidden border-2 ${
          level === "legendary" 
            ? "border-primary glow-primary" 
            : level === "epic"
            ? "border-secondary glow-secondary"
            : "border-destructive glow-destructive"
        }`}
      >
        {/* Animated background gradient */}
        <div className="absolute inset-0 opacity-20">
          <motion.div
            className={`absolute inset-0 bg-gradient-to-r ${getStreakColor()}`}
            animate={{
              x: ["-100%", "100%"],
            }}
            transition={{
              repeat: Infinity,
              duration: 2,
              ease: "linear",
            }}
          />
        </div>

        {/* Content */}
        <div className="relative p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 1.5,
                }}
                className={level === "legendary" ? "text-primary" : level === "epic" ? "text-secondary" : "text-destructive"}
              >
                {getStreakIcon()}
              </motion.div>
              <div>
                <h3 className="text-2xl font-bold font-mono" data-testid="text-streak-title">
                  {getStreakText()}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {currentStreak} wins in a row
                </p>
              </div>
            </div>

            {/* Streak number with glow */}
            <motion.div
              className={`text-5xl font-black font-mono ${
                level === "legendary"
                  ? "text-primary glow-primary"
                  : level === "epic"
                  ? "text-secondary glow-secondary"
                  : "text-destructive glow-destructive"
              }`}
              animate={{
                scale: [1, 1.05, 1],
              }}
              transition={{
                repeat: Infinity,
                duration: 2,
              }}
              data-testid="text-streak-count"
            >
              {currentStreak}
            </motion.div>
          </div>

          {/* Progress bar showing streak tiers */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Hot (3+)</span>
              <span>Epic (5+)</span>
              <span>Legendary (10+)</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className={`h-full bg-gradient-to-r ${getStreakColor()}`}
                initial={{ width: 0 }}
                animate={{ 
                  width: `${Math.min((currentStreak / 10) * 100, 100)}%` 
                }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Next milestone */}
          {currentStreak < 10 && (
            <p className="text-xs text-muted-foreground mt-3 text-center">
              {10 - currentStreak} more wins for Legendary status
            </p>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
