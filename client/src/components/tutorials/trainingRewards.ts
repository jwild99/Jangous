import type { LucideIcon } from "lucide-react";
import { Gem, Crown, Sparkles, Star, Trophy } from "lucide-react";
import {
  TRAINING_REWARDS as SHARED_TRAINING_REWARDS,
  TRAINING_MASTER_ID as SHARED_TRAINING_MASTER_ID,
  getTrainingReward,
  type TrainingRarity,
  type TrainingReward,
} from "@shared/trainingRewards";
import type { TrainingTier } from "@shared/gameTrainingPaths";

export type Rarity = TrainingRarity;

export interface RarityStyle {
  label: string;
  icon: LucideIcon;
  textClass: string;
  ringClass: string;
  glowClass: string;
  gradientFrom: string;
  gradientTo: string;
  badgeBgClass: string;
  badgeTextClass: string;
}

export const RARITY_STYLES: Record<Rarity, RarityStyle> = {
  common: {
    label: "Common",
    icon: Star,
    textClass: "text-slate-300",
    ringClass: "ring-1 ring-slate-400/30",
    glowClass: "shadow-[0_0_32px_-12px_rgba(148,163,184,0.45)]",
    gradientFrom: "from-slate-500/15",
    gradientTo: "to-slate-700/5",
    badgeBgClass: "bg-slate-500/15 border border-slate-400/30",
    badgeTextClass: "text-slate-200",
  },
  rare: {
    label: "Rare",
    icon: Gem,
    textClass: "text-cyan-300",
    ringClass: "ring-1 ring-cyan-400/40",
    glowClass: "shadow-[0_0_42px_-10px_rgba(34,211,238,0.55)]",
    gradientFrom: "from-cyan-500/15",
    gradientTo: "to-blue-700/5",
    badgeBgClass: "bg-cyan-500/15 border border-cyan-400/35",
    badgeTextClass: "text-cyan-200",
  },
  epic: {
    label: "Epic",
    icon: Sparkles,
    textClass: "text-fuchsia-300",
    ringClass: "ring-1 ring-fuchsia-400/45",
    glowClass: "shadow-[0_0_48px_-8px_rgba(217,70,239,0.6)]",
    gradientFrom: "from-fuchsia-500/20",
    gradientTo: "to-purple-700/5",
    badgeBgClass: "bg-fuchsia-500/15 border border-fuchsia-400/40",
    badgeTextClass: "text-fuchsia-200",
  },
  legendary: {
    label: "Legendary",
    icon: Crown,
    textClass: "text-amber-300",
    ringClass: "ring-1 ring-amber-400/50",
    glowClass: "shadow-[0_0_52px_-6px_rgba(251,191,36,0.65)]",
    gradientFrom: "from-amber-500/20",
    gradientTo: "to-orange-700/5",
    badgeBgClass: "bg-amber-500/15 border border-amber-400/40",
    badgeTextClass: "text-amber-200",
  },
  mythic: {
    label: "Mythic",
    icon: Trophy,
    textClass: "text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-fuchsia-300 to-cyan-300",
    ringClass: "ring-2 ring-fuchsia-400/60",
    glowClass: "shadow-[0_0_64px_-4px_rgba(232,121,249,0.7)]",
    gradientFrom: "from-fuchsia-500/25",
    gradientTo: "to-amber-500/10",
    badgeBgClass: "bg-gradient-to-r from-amber-500/20 via-fuchsia-500/20 to-cyan-500/20 border border-fuchsia-400/50",
    badgeTextClass: "text-white",
  },
};

export interface TrainingRewardMeta {
  rarity: Rarity;
  xp: number;
  coins: number;
  stars: number;
}

/** Server-authoritative reward map (re-exported from shared). */
export const TRAINING_REWARDS: Record<string, TrainingRewardMeta> = SHARED_TRAINING_REWARDS;

export function getRewardMeta(tutorialId: string): TrainingRewardMeta {
  return getTrainingReward(tutorialId);
}

export function getRarityStyle(rarity: Rarity): RarityStyle {
  return RARITY_STYLES[rarity];
}

export const TRAINING_MASTER_ID = SHARED_TRAINING_MASTER_ID;

export type { TrainingReward };

/** Helper for tier display name. */
export function tierFromTutorialId(id: string): TrainingTier | null {
  if (id.endsWith("-intermediate")) return "intermediate";
  if (id.endsWith("-advanced")) return "advanced";
  if (id.endsWith("-master")) return "master";
  if (id.startsWith("game-")) return "beginner";
  return null;
}
