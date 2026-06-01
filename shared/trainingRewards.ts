import {
  GAME_TRAINING_PATHS,
  TIER_ORDER,
  TIER_RARITY,
  TIER_XP,
  tierTutorialId,
} from "./gameTrainingPaths";

export type TrainingRarity = "common" | "rare" | "epic" | "legendary" | "mythic";

export interface TrainingReward {
  rarity: TrainingRarity;
  xp: number;
  coins: number;
  stars: number;
}

const TIER_COINS: Record<string, number> = {
  beginner: 50,
  intermediate: 100,
  advanced: 200,
  master: 400,
};

const TIER_REWARDS: Record<string, TrainingReward> = (() => {
  const out: Record<string, TrainingReward> = {};
  for (const game of GAME_TRAINING_PATHS) {
    for (const tier of TIER_ORDER) {
      out[tierTutorialId(game.slug, tier)] = {
        rarity: TIER_RARITY[tier] as TrainingRarity,
        xp: TIER_XP[tier],
        coins: TIER_COINS[tier],
        stars: 3,
      };
    }
  }
  return out;
})();

export const TRAINING_MASTER_ID = "training-master";

export const TRAINING_REWARDS: Record<string, TrainingReward> = {
  "platform-basics": { rarity: "rare", xp: 100, coins: 75, stars: 3 },
  ...TIER_REWARDS,
  [TRAINING_MASTER_ID]: { rarity: "mythic", xp: 1000, coins: 2500, stars: 3 },
};

export function getTrainingReward(tutorialId: string): TrainingReward {
  return TRAINING_REWARDS[tutorialId] ?? { rarity: "common", xp: 50, coins: 25, stars: 3 };
}

/** Shop item IDs granted exclusively by completing the full training ladder. */
export const TRAINING_MASTER_BADGE_ID = "training-master-badge";
export const TRAINING_MASTER_BORDER_ID = "training-master-border";
