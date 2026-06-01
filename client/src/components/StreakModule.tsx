import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Zap, Shield, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

interface StreakData {
  loginStreak: number;
  longestStreak: number;
  lastLoginDate: string | null;
  xpMultiplier: number;
  bonusPercent: number;
}

const DAY_REWARDS: Record<number, string> = {
  1: "+10% XP",
  2: "+20% XP",
  3: "+30% XP",
  4: "+40% XP",
  5: "+50% XP",
  6: "+60% XP",
  7: "BONUS LOOT",
};

function FlameIcon({ streak }: { streak: number }) {
  const intensity = Math.min(streak, 7);
  const glowColors = [
    "rgba(249,115,22,0.3)",
    "rgba(249,115,22,0.45)",
    "rgba(234,179,8,0.45)",
    "rgba(234,179,8,0.55)",
    "rgba(251,146,60,0.6)",
    "rgba(239,68,68,0.5)",
    "rgba(239,68,68,0.7)",
  ];
  const glowColor = glowColors[Math.max(0, intensity - 1)] || "rgba(249,115,22,0.3)";

  return (
    <motion.div
      animate={{ scale: [1, 1.06, 1] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      style={{ filter: streak > 0 ? `drop-shadow(0 0 ${6 + intensity * 3}px ${glowColor})` : "none" }}
    >
      <Flame
        className="w-6 h-6"
        style={{ color: streak >= 5 ? "#ef4444" : streak >= 3 ? "#eab308" : "#f97316" }}
      />
    </motion.div>
  );
}

export function StreakModule({ className = "" }: { className?: string }) {
  const { user } = useAuth();

  const { data: streak } = useQuery<StreakData>({
    queryKey: ["/api/user/streak"],
    enabled: !!user,
    staleTime: 60_000,
  });

  if (!user || !streak) return null;

  const day = streak.loginStreak;
  const bonus = streak.bonusPercent;
  const nextDay = Math.min(day + 1, 7);
  const nextReward = DAY_REWARDS[nextDay] ?? "+70% XP";

  return (
    <Card className={`card-depth border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Left: flame + streak info */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <FlameIcon streak={day} />
              {day >= 7 && (
                <motion.div
                  className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-yellow-400"
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white" data-testid="streak-day">
                  {day > 0 ? `Day ${day} Streak` : "Start Your Streak"}
                </span>
                {bonus > 0 && (
                  <Badge className="text-[10px] bg-orange-500/20 border-orange-500/40 text-orange-300 font-bold">
                    <Zap className="w-2.5 h-2.5 mr-0.5" />+{bonus}% XP
                  </Badge>
                )}
              </div>
              <p className="text-xs text-white/45 mt-0.5">
                {day > 0
                  ? "Play 1 match + wager 1 Scalp to maintain"
                  : "Play 1 match + wager 1 Scalp to begin"}
              </p>
            </div>
          </div>

          {/* Right: day track + next reward */}
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5,6,7].map(d => (
                <div
                  key={d}
                  className="relative"
                  title={DAY_REWARDS[d]}
                >
                  <motion.div
                    className={`w-5 h-5 rounded-sm flex items-center justify-center text-[9px] font-black transition-all ${
                      d <= day
                        ? "bg-gradient-to-br from-orange-500 to-yellow-400 text-black"
                        : d === day + 1
                        ? "bg-white/10 border border-orange-500/50 text-orange-400"
                        : "bg-white/5 text-white/20"
                    }`}
                    animate={d === day ? { scale: [1, 1.15, 1] } : {}}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    {d <= day ? <Flame className="w-2.5 h-2.5" /> : d}
                  </motion.div>
                </div>
              ))}
            </div>
            {day < 7 && (
              <div className="flex items-center gap-1 text-xs text-white/40">
                <ChevronRight className="w-3 h-3" />
                <span className="hidden sm:inline text-orange-400 font-semibold">{nextReward}</span>
              </div>
            )}
          </div>
        </div>

        {day === 0 && (
          <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-orange-500/8 border border-orange-500/20">
            <Shield className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <p className="text-xs text-orange-200/70">
              Streak bonuses apply to ALL XP earned — challenges, wins, and match play
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
