import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Target, TrendingUp, TrendingDown, Zap } from "lucide-react";
import { motion } from "framer-motion";

interface PlayerStatsHUDProps {
  wins: number;
  losses: number;
  totalMatches: number;
  currentStreak: number;
  streakType: "win" | "loss" | "none";
  earnings?: number;
  compact?: boolean;
}

export function PlayerStatsHUD({
  wins,
  losses,
  totalMatches,
  currentStreak,
  streakType,
  earnings,
  compact = false,
}: PlayerStatsHUDProps) {
  const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0;
  const isPositiveStreak = streakType === "win" && currentStreak > 0;
  const isNegativeStreak = streakType === "loss" && currentStreak > 0;

  if (compact) {
    return (
      <div className="flex items-center gap-3 flex-wrap" data-testid="stats-hud-compact">
        <Badge variant="secondary" className="gap-1">
          <Trophy className="w-3 h-3" />
          {wins}W - {losses}L
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Target className="w-3 h-3" />
          {winRate.toFixed(1)}%
        </Badge>
        {currentStreak > 0 && (
          <Badge
            variant={isPositiveStreak ? "default" : "destructive"}
            className={isPositiveStreak ? "glow-success" : "glow-destructive"}
          >
            <Zap className="w-3 h-3 mr-1" />
            {currentStreak} {streakType}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="stats-hud-full">
      {/* Win/Loss Record */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="card-depth p-4 magnetic-shimmer">
          <div className="flex items-center gap-2 mb-2">
            <span className="icon-bounce-on-click"><Trophy className="w-4 h-4 text-primary" /></span>
            <h4 className="text-sm font-semibold text-muted-foreground">Record</h4>
          </div>
          <p className="text-2xl font-bold font-mono stat-pop" data-testid="text-record">
            {wins}W - {losses}L
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {totalMatches} total match{totalMatches !== 1 ? "es" : ""}
          </p>
        </div>
      </motion.div>

      {/* Win Rate */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="card-depth p-4 magnetic-shimmer">
          <div className="flex items-center gap-2 mb-2">
            <span className="icon-bounce-on-click"><Target className="w-4 h-4 text-primary" /></span>
            <h4 className="text-sm font-semibold text-muted-foreground">Win Rate</h4>
          </div>
          <p className="text-2xl font-bold font-mono stat-pop" data-testid="text-winrate">
            {winRate.toFixed(1)}%
          </p>
          <div className="w-full bg-muted/40 progress-glow mt-2">
            <div
              className="xp-bar-fill h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${winRate}%` }}
            />
          </div>
        </div>
      </motion.div>

      {/* Current Streak */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div
          className={`card-depth p-4 magnetic-shimmer ${
            isPositiveStreak
              ? "glow-success"
              : isNegativeStreak
              ? "glow-destructive"
              : ""
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="icon-bounce-on-click">
              {isPositiveStreak ? (
                <TrendingUp className="w-4 h-4 text-[hsl(var(--success))]" />
              ) : isNegativeStreak ? (
                <TrendingDown className="w-4 h-4 text-destructive" />
              ) : (
                <Zap className="w-4 h-4 text-muted-foreground" />
              )}
            </span>
            <h4 className="text-sm font-semibold text-muted-foreground">Streak</h4>
          </div>
          <p className="text-2xl font-bold font-mono stat-pop" data-testid="text-streak">
            {currentStreak > 0 ? currentStreak : "-"}
          </p>
          <p className="text-xs text-muted-foreground mt-1 capitalize">
            {currentStreak > 0 ? `${streakType} streak` : "No active streak"}
          </p>
        </div>
      </motion.div>

      {/* Earnings (if provided) */}
      {earnings !== undefined && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="card-depth p-4 magnetic-shimmer glow-success">
            <div className="flex items-center gap-2 mb-2">
              <span className="icon-bounce-on-click"><Trophy className="w-4 h-4 text-[hsl(var(--success))]" /></span>
              <h4 className="text-sm font-semibold text-muted-foreground">Earnings</h4>
            </div>
            <p
              className="text-2xl font-bold font-mono stat-pop text-[hsl(var(--success))]"
              data-testid="text-earnings"
            >
              {earnings.toFixed(2)} S
            </p>
            <p className="text-xs text-muted-foreground mt-1">Total winnings</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
