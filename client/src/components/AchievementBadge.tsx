import { motion } from "framer-motion";
import {
  Crown, Trophy, Medal, Sword, Shield, Target, Zap, Flame,
  Sparkles, Star, Brain, Network, TrendingUp, Award, DollarSign,
  Calendar, Boxes, type LucideIcon
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LegendaryMedal, EpicMedal, RareMedal, CommonMedal } from "@/components/PremiumAssets";
import type { Achievement, UserAchievement } from "@shared/schema";

const iconMap: Record<string, LucideIcon> = {
  Crown, Trophy, Medal, Sword, Shield, Target, Zap, Flame,
  Sparkles, Star, Brain, Network, TrendingUp, Award, DollarSign,
  Calendar, Boxes,
};

interface AchievementBadgeProps {
  achievement: Achievement;
  userAchievement?: UserAchievement;
  size?: "sm" | "md" | "lg";
  showDetails?: boolean;
}

// Rarity config helper
function rarityConfig(rarity: string) {
  switch (rarity) {
    case "legendary":
      return {
        gradient: "from-amber-400 via-yellow-400 to-orange-500",
        border: "border-amber-400 shadow-amber-400/40",
        text: "text-amber-400",
        badge: "bg-amber-500/15 text-amber-400 border-amber-500/40",
        glow: "rgba(251,191,36,0.45)",
        labelColor: "text-amber-400",
      };
    case "epic":
      return {
        gradient: "from-purple-500 via-fuchsia-500 to-pink-500",
        border: "border-purple-500 shadow-purple-500/40",
        text: "text-purple-400",
        badge: "bg-purple-500/15 text-purple-400 border-purple-500/40",
        glow: "rgba(168,85,247,0.45)",
        labelColor: "text-purple-400",
      };
    case "rare":
      return {
        gradient: "from-cyan-400 via-blue-500 to-indigo-600",
        border: "border-cyan-400 shadow-cyan-400/40",
        text: "text-cyan-400",
        badge: "bg-cyan-500/15 text-cyan-400 border-cyan-500/40",
        glow: "rgba(34,211,238,0.45)",
        labelColor: "text-cyan-400",
      };
    default:
      return {
        gradient: "from-slate-500 to-slate-400",
        border: "border-slate-500",
        text: "text-slate-400",
        badge: "bg-slate-500/15 text-slate-400 border-slate-500/40",
        glow: "rgba(148,163,184,0.3)",
        labelColor: "text-slate-400",
      };
  }
}

// Medal SVG based on rarity
function TierMedal({ rarity, size }: { rarity: string; size: "sm" | "md" | "lg" }) {
  const px = size === "lg" ? 64 : size === "md" ? 48 : 32;
  const svgProps = { width: px, height: px };
  switch (rarity) {
    case "legendary": return <LegendaryMedal {...svgProps}/>;
    case "epic":      return <EpicMedal      {...svgProps}/>;
    case "rare":      return <RareMedal      {...svgProps}/>;
    default:          return <CommonMedal    {...svgProps}/>;
  }
}

export function AchievementBadge({
  achievement,
  userAchievement,
  size = "md",
  showDetails = false,
}: AchievementBadgeProps) {
  const Icon = iconMap[achievement.icon] || Trophy;
  const isUnlocked = !!userAchievement?.completedAt;
  const cfg = rarityConfig(achievement.rarity);

  // Container sizing
  const containerSize = size === "lg" ? "w-20 h-20" : size === "sm" ? "w-14 h-14" : "w-16 h-16";
  const iconSize     = size === "lg" ? "w-8 h-8"   : size === "sm" ? "w-5 h-5"   : "w-6 h-6";
  const textSize     = size === "lg" ? "text-base"  : size === "sm" ? "text-xs"   : "text-sm";

  if (!showDetails) {
    return (
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        whileHover={{ scale: 1.08 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        data-testid={`achievement-badge-${achievement.id}`}
        className="relative"
      >
        {/* Medal artwork */}
        <div className={`${containerSize} flex items-center justify-center relative
          ${!isUnlocked ? "opacity-40 grayscale" : ""}`}
          title={achievement.name}
        >
          <TierMedal rarity={isUnlocked ? achievement.rarity : "common"} size={size}/>

          {/* Lucide icon overlay centered on medal face */}
          {isUnlocked && (
            <div className="absolute inset-0 flex items-end justify-center pb-[22%]">
              <Icon className={`${iconSize} ${cfg.text} drop-shadow`} style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.8))" }}/>
            </div>
          )}

          {/* Sparkle corner for non-common unlocked */}
          {isUnlocked && achievement.rarity !== "common" && (
            <motion.div
              className="absolute -top-1 -right-1"
              animate={{ rotate: [0, 360], scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 2.5 }}
            >
              <Sparkles className={`w-4 h-4 ${cfg.text}`}/>
            </motion.div>
          )}
        </div>

        {/* Ambient glow pulse for unlocked legendary/epic */}
        {isUnlocked && (achievement.rarity === "legendary" || achievement.rarity === "epic") && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            animate={{ opacity: [0, 0.4, 0] }}
            transition={{ repeat: Infinity, duration: 2.8 }}
            style={{ boxShadow: `0 0 20px 6px ${cfg.glow}` }}
          />
        )}
      </motion.div>
    );
  }

  // ── Detail card view ─────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      data-testid={`achievement-card-${achievement.id}`}
    >
      <Card
        className={`card-depth border-2 overflow-hidden hover-elevate magnetic-shimmer
          ${isUnlocked ? `${cfg.border} shadow-lg` : "border-muted opacity-65"}
          ${!isUnlocked ? "grayscale" : ""}`}
      >
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3">

            {/* Medal / Badge artwork */}
            <div className="relative shrink-0">
              <motion.div
                animate={isUnlocked ? {
                  boxShadow: [
                    `0 0 0px rgba(0,0,0,0)`,
                    `0 0 18px ${cfg.glow}`,
                    `0 0 0px rgba(0,0,0,0)`,
                  ],
                } : {}}
                transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                className="rounded-lg"
              >
                <TierMedal rarity={isUnlocked ? achievement.rarity : "common"} size="md"/>
              </motion.div>

              {/* Icon overlaid on medal */}
              <div className="absolute inset-0 flex items-end justify-center pb-[24%]">
                <Icon className={`w-5 h-5 ${isUnlocked ? cfg.text : "text-muted-foreground"}`}
                  style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.9))" }}/>
              </div>

              {isUnlocked && achievement.rarity !== "common" && (
                <motion.div
                  className="absolute -top-1 -right-1"
                  animate={{ rotate: [0, 360], scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <Sparkles className={`w-5 h-5 ${cfg.text}`}/>
                </motion.div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <h4 className="font-bold leading-tight" data-testid="text-achievement-name">
                  {achievement.name}
                </h4>
                <Badge variant="outline"
                  className={`text-xs uppercase font-semibold shrink-0
                    ${isUnlocked ? cfg.badge : "border-muted text-muted-foreground"}`}
                >
                  {achievement.rarity}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 leading-snug">
                {achievement.description}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {achievement.gameType && (
                <Badge variant="secondary" className="text-xs">
                  {achievement.gameType}
                </Badge>
              )}
              <span className={`font-semibold ${isUnlocked ? cfg.text : "text-muted-foreground"}`}>
                +{achievement.xpReward} XP
              </span>
            </div>
            {userAchievement?.completedAt && (
              <span className="text-xs text-muted-foreground">
                {new Date(userAchievement.completedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {!isUnlocked && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                Locked — complete the challenge to unlock
              </p>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
