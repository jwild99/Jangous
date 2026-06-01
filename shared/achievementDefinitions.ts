import type { InsertAchievement } from "./schema";

// Achievement definitions with criteria and rewards
export const achievementDefinitions: InsertAchievement[] = [
  // Chess Achievements
  {
    id: "chess-checkmate-master",
    name: "Checkmate Master",
    description: "Win a chess match by checkmate",
    category: "combat",
    gameType: "chess",
    icon: "Crown",
    rarity: "common",
    xpReward: 50,
  },
  {
    id: "chess-speed-demon",
    name: "Speed Demon",
    description: "Win a chess match in under 5 minutes",
    category: "skill",
    gameType: "chess",
    icon: "Zap",
    rarity: "rare",
    xpReward: 100,
  },
  {
    id: "chess-tactician",
    name: "Tactical Genius",
    description: "Win a chess match without losing any pieces",
    category: "skill",
    gameType: "chess",
    icon: "Brain",
    rarity: "epic",
    xpReward: 200,
  },

  // Mini Golf Achievements
  {
    id: "golf-hole-in-one",
    name: "Sniper",
    description: "Score a hole-in-one in Mini Golf",
    category: "skill",
    gameType: "mini-golf",
    icon: "Target",
    rarity: "epic",
    xpReward: 150,
  },
  {
    id: "golf-perfect-round",
    name: "Perfect Round",
    description: "Complete all holes with par or better",
    category: "skill",
    gameType: "mini-golf",
    icon: "Award",
    rarity: "rare",
    xpReward: 100,
  },
  {
    id: "golf-comeback-king",
    name: "Comeback King",
    description: "Win after being down by 5+ strokes",
    category: "combat",
    gameType: "mini-golf",
    icon: "TrendingUp",
    rarity: "rare",
    xpReward: 125,
  },

  // Connect 4 Achievements
  {
    id: "connect4-flawless-victory",
    name: "Flawless Victory",
    description: "Win Connect 4 without opponent getting 3 in a row",
    category: "combat",
    gameType: "connect-4",
    icon: "Shield",
    rarity: "epic",
    xpReward: 150,
  },
  {
    id: "connect4-quick-win",
    name: "Lightning Strike",
    description: "Win Connect 4 in 10 moves or less",
    category: "skill",
    gameType: "connect-4",
    icon: "Zap",
    rarity: "rare",
    xpReward: 100,
  },
  {
    id: "connect4-trap-master",
    name: "Trap Master",
    description: "Create a double-threat winning position",
    category: "skill",
    gameType: "connect-4",
    icon: "Network",
    rarity: "rare",
    xpReward: 75,
  },

  // Air Hockey Achievements
  {
    id: "airhockey-clean-sheet",
    name: "Clean Sheet",
    description: "Win an Air Hockey match without conceding a goal",
    category: "combat",
    gameType: "air-hockey",
    icon: "Shield",
    rarity: "epic",
    xpReward: 150,
  },
  {
    id: "airhockey-comeback-win",
    name: "Comeback King",
    description: "Win after being down by 2 or more goals",
    category: "combat",
    gameType: "air-hockey",
    icon: "TrendingUp",
    rarity: "rare",
    xpReward: 125,
  },
  {
    id: "airhockey-hat-trick",
    name: "Hat Trick",
    description: "Score 3 or more goals in a single match",
    category: "skill",
    gameType: "air-hockey",
    icon: "Flame",
    rarity: "rare",
    xpReward: 100,
  },
  {
    id: "airhockey-sharpshooter",
    name: "Sharpshooter",
    description: "Achieve 80% or higher shot accuracy (min 5 shots)",
    category: "skill",
    gameType: "air-hockey",
    icon: "Target",
    rarity: "epic",
    xpReward: 175,
  },
  {
    id: "airhockey-wall",
    name: "The Wall",
    description: "Save 90% or more shots on goal (min 5 saves)",
    category: "skill",
    gameType: "air-hockey",
    icon: "ShieldCheck",
    rarity: "epic",
    xpReward: 200,
  },
  {
    id: "airhockey-speed-demon",
    name: "Rocket Shot",
    description: "Record a hit speed of 900 px/s or higher",
    category: "skill",
    gameType: "air-hockey",
    icon: "Zap",
    rarity: "rare",
    xpReward: 100,
  },
  {
    id: "airhockey-domination",
    name: "Total Domination",
    description: "Win with 70%+ possession time",
    category: "combat",
    gameType: "air-hockey",
    icon: "Crown",
    rarity: "rare",
    xpReward: 125,
  },

  // General/Milestone Achievements
  {
    id: "first-blood",
    name: "First Blood",
    description: "Win your first match",
    category: "milestone",
    gameType: null,
    icon: "Sword",
    rarity: "common",
    xpReward: 25,
  },
  {
    id: "win-streak-3",
    name: "On Fire",
    description: "Win 3 matches in a row",
    category: "milestone",
    gameType: null,
    icon: "Flame",
    rarity: "rare",
    xpReward: 100,
  },
  {
    id: "win-streak-5",
    name: "Unstoppable",
    description: "Win 5 matches in a row",
    category: "milestone",
    gameType: null,
    icon: "Sparkles",
    rarity: "epic",
    xpReward: 250,
  },
  {
    id: "win-streak-10",
    name: "Legendary",
    description: "Win 10 matches in a row",
    category: "special",
    gameType: null,
    icon: "Star",
    rarity: "legendary",
    xpReward: 500,
  },
  {
    id: "veteran-10",
    name: "Veteran",
    description: "Complete 10 matches",
    category: "milestone",
    gameType: null,
    icon: "Medal",
    rarity: "common",
    xpReward: 50,
  },
  {
    id: "veteran-50",
    name: "Seasoned Player",
    description: "Complete 50 matches",
    category: "milestone",
    gameType: null,
    icon: "Trophy",
    rarity: "rare",
    xpReward: 200,
  },
  {
    id: "veteran-100",
    name: "Champion",
    description: "Complete 100 matches",
    category: "milestone",
    gameType: null,
    icon: "Crown",
    rarity: "epic",
    xpReward: 400,
  },
  {
    id: "big-spender",
    name: "High Roller",
    description: "Win a match with a bet of $100 or more",
    category: "special",
    gameType: null,
    icon: "DollarSign",
    rarity: "rare",
    xpReward: 150,
  },
  {
    id: "perfect-week",
    name: "Perfect Week",
    description: "Win every match played in a 7-day period (min 5 matches)",
    category: "special",
    gameType: null,
    icon: "Calendar",
    rarity: "legendary",
    xpReward: 1000,
  },
  {
    id: "jack-of-all-trades",
    name: "Jack of All Trades",
    description: "Win at least one match in each game type",
    category: "milestone",
    gameType: null,
    icon: "Boxes",
    rarity: "rare",
    xpReward: 150,
  },
];

// XP level thresholds (level -> XP required)
export const XP_LEVELS: Record<number, number> = {
  1: 0,
  2: 100,
  3: 250,
  4: 450,
  5: 700,
  6: 1000,
  7: 1350,
  8: 1750,
  9: 2200,
  10: 2700,
  11: 3250,
  12: 3850,
  13: 4500,
  14: 5200,
  15: 5950,
  16: 6750,
  17: 7600,
  18: 8500,
  19: 9450,
  20: 10450,
  21: 11500,
  22: 12600,
  23: 13750,
  24: 14950,
  25: 16200,
  30: 22000,
  35: 29000,
  40: 37500,
  45: 47500,
  50: 59000,
  60: 85000,
  70: 115000,
  80: 150000,
  90: 190000,
  100: 250000,
};

// Calculate level from XP
export function getLevelFromXP(xp: number): number {
  const levels = Object.entries(XP_LEVELS)
    .map(([level, requiredXP]) => ({ level: parseInt(level), requiredXP }))
    .sort((a, b) => b.requiredXP - a.requiredXP);
  
  for (const { level, requiredXP } of levels) {
    if (xp >= requiredXP) {
      return level;
    }
  }
  
  return 1;
}

// Get XP required for next level
export function getXPForNextLevel(currentLevel: number): number {
  const nextLevel = currentLevel + 1;
  return XP_LEVELS[nextLevel] || XP_LEVELS[100];
}

// Get XP progress percentage to next level
export function getXPProgress(currentXP: number, currentLevel: number): number {
  const currentLevelXP = XP_LEVELS[currentLevel] || 0;
  const nextLevelXP = getXPForNextLevel(currentLevel);
  const xpIntoLevel = currentXP - currentLevelXP;
  const xpNeededForLevel = nextLevelXP - currentLevelXP;
  
  return (xpIntoLevel / xpNeededForLevel) * 100;
}

// Base XP rewards for match actions
export const XP_REWARDS = {
  MATCH_COMPLETE: 10,
  MATCH_WIN: 50,
  MATCH_LOSS: 15,
  QUICK_WIN: 25, // Bonus for winning quickly
  COMEBACK_WIN: 30, // Bonus for winning from behind
};

// Achievement check functions
export type AchievementCheckContext = {
  matchId: string;
  userId: string;
  gameType: string;
  won: boolean;
  gameState: any;
  finalScore: { player1: number; player2: number };
  duration?: number;
  potAmount?: string;
};

export type AchievementCheck = {
  achievementId: string;
  check: (context: AchievementCheckContext) => boolean;
};

export const achievementChecks: AchievementCheck[] = [
  {
    achievementId: "chess-checkmate-master",
    check: (ctx) => ctx.gameType === "chess" && ctx.won && ctx.gameState?.isCheckmate,
  },
  {
    achievementId: "chess-speed-demon",
    check: (ctx) => 
      ctx.gameType === "chess" && 
      ctx.won && 
      ctx.duration && 
      ctx.duration < 300000, // 5 minutes
  },
  {
    achievementId: "golf-hole-in-one",
    check: (ctx) => {
      if (ctx.gameType !== "mini-golf" || !ctx.gameState?.perHoleStrokes) return false;
      const playerKey = ctx.won ? "player1" : "player2";
      return Object.values(ctx.gameState.perHoleStrokes).some(
        (hole: any) => hole[playerKey] === 1
      );
    },
  },
  {
    achievementId: "connect4-flawless-victory",
    check: (ctx) => {
      if (ctx.gameType !== "connect-4" || !ctx.won) return false;
      // Check if opponent never got 3 in a row
      // This would require analyzing the game state - simplified for now
      return ctx.won;
    },
  },
  {
    achievementId: "connect4-quick-win",
    check: (ctx) => {
      if (ctx.gameType !== "connect-4" || !ctx.won) return false;
      const moveCount = ctx.gameState?.moveHistory?.length || 0;
      return moveCount <= 10;
    },
  },
  {
    achievementId: "big-spender",
    check: (ctx) => {
      const potAmount = parseFloat(ctx.potAmount || "0");
      return ctx.won && potAmount >= 100;
    },
  },
  // Air Hockey Achievements
  {
    achievementId: "airhockey-clean-sheet",
    check: (ctx) => {
      if (ctx.gameType !== "air-hockey" || !ctx.won) return false;
      // Check if opponent scored 0 goals
      const opponentScore = ctx.finalScore.player1 === 0 ? ctx.finalScore.player1 : ctx.finalScore.player2;
      return opponentScore === 0;
    },
  },
  {
    achievementId: "airhockey-comeback-win",
    check: (ctx) => {
      if (ctx.gameType !== "air-hockey" || !ctx.won || !ctx.gameState?.statistics) return false;
      // Check if player was ever down by 2+ goals
      const stats = ctx.gameState.statistics;
      return stats.comebackWin === true;
    },
  },
  {
    achievementId: "airhockey-hat-trick",
    check: (ctx) => {
      if (ctx.gameType !== "air-hockey" || !ctx.gameState?.statistics) return false;
      const playerStats = ctx.won ? ctx.gameState.statistics.left : ctx.gameState.statistics.right;
      return playerStats.goals >= 3;
    },
  },
  {
    achievementId: "airhockey-sharpshooter",
    check: (ctx) => {
      if (ctx.gameType !== "air-hockey" || !ctx.gameState?.statistics) return false;
      const playerStats = ctx.won ? ctx.gameState.statistics.left : ctx.gameState.statistics.right;
      if (playerStats.shots < 5) return false;
      const accuracy = (playerStats.goals / playerStats.shots) * 100;
      return accuracy >= 80;
    },
  },
  {
    achievementId: "airhockey-wall",
    check: (ctx) => {
      if (ctx.gameType !== "air-hockey" || !ctx.gameState?.statistics) return false;
      const playerStats = ctx.won ? ctx.gameState.statistics.left : ctx.gameState.statistics.right;
      if (playerStats.saves < 5) return false;
      const opponentStats = ctx.won ? ctx.gameState.statistics.right : ctx.gameState.statistics.left;
      const totalShotsOnGoal = opponentStats.shots;
      if (totalShotsOnGoal === 0) return false;
      const saveRate = (playerStats.saves / totalShotsOnGoal) * 100;
      return saveRate >= 90;
    },
  },
  {
    achievementId: "airhockey-speed-demon",
    check: (ctx) => {
      if (ctx.gameType !== "air-hockey" || !ctx.gameState?.statistics) return false;
      const playerStats = ctx.won ? ctx.gameState.statistics.left : ctx.gameState.statistics.right;
      return playerStats.hitSpeedPeak >= 900;
    },
  },
  {
    achievementId: "airhockey-domination",
    check: (ctx) => {
      if (ctx.gameType !== "air-hockey" || !ctx.won || !ctx.gameState?.statistics) return false;
      const playerStats = ctx.won ? ctx.gameState.statistics.left : ctx.gameState.statistics.right;
      return playerStats.possessionPercent >= 70;
    },
  },
];
