/**
 * Player Title System
 * Auto-assigns titles based on per-game ratings and stats.
 */

const GAME_TITLES: Record<string, { base: string; elite: string; goat: string }> = {
  chess:               { base: "Chess Tactician",      elite: "Chess Master",         goat: "Chess Grand Master" },
  "mini-golf":         { base: "Mini Golf Contender",  elite: "Mini Golf Pro",        goat: "Mini Golf Legend" },
  "air-hockey":        { base: "Puck Handler",         elite: "Air Hockey Demon",     goat: "Air Hockey God" },
  "connect-4":         { base: "Four in a Row",        elite: "Connect 4 Specialist", goat: "Connect 4 Overlord" },
  "rock-paper-scissors": { base: "Finger Slinger",     elite: "RPS Warrior",          goat: "RPS Oracle" },
  "dots-and-boxes":    { base: "Dot Placer",           elite: "Box Claimer",          goat: "Grid Master" },
  "8-ball":            { base: "Billiards Player",     elite: "Pool Shark",           goat: "Pool Hall Legend" },
  bowling:             { base: "Lane Walker",          elite: "Pin Sniper",           goat: "Perfect Strike" },
  "cup-king":          { base: "Cup Tosser",           elite: "Cup King",             goat: "Cup Emperor" },
  "stack-tower":       { base: "Block Stacker",        elite: "Tower Architect",      goat: "Sky Builder" },
  "block-blast":       { base: "Block Buster",         elite: "Blast Master",         goat: "Neon Destroyer" },
  tron:                { base: "Grid Rider",           elite: "Tron Survivor",        goat: "Grid Immortal" },
  basketball:          { base: "Shooter",              elite: "Bucket Getter",        goat: "Hoops Legend" },
  football:            { base: "QB Rookie",            elite: "Field General",        goat: "Touchdown Machine" },
  racing:              { base: "Rookie Driver",        elite: "Speed Demon",          goat: "Racing Legend" },
};

const GAME_RATING_KEYS: Record<string, string> = {
  chess:               "chessRating",
  "mini-golf":         "miniGolfRating",
  "air-hockey":        "airHockeyRating",
  "connect-4":         "connect4Rating",
  "rock-paper-scissors": "rockPaperScissorsRating",
  "dots-and-boxes":    "dotsAndBoxesRating",
  "8-ball":            "eightBallRating",
  bowling:             "bowlingRating",
  "cup-king":          "cupKingRating",
  "stack-tower":       "stackTowerRating",
  "block-blast":       "blockBlastRating",
  tron:                "tronRating",
  basketball:          "basketballRating",
  football:            "footballRating",
  racing:              "racingRating",
};

export interface PlayerTitle {
  title: string;
  game: string;
  rating: number;
  tier: "goat" | "elite" | "base" | "unranked";
}

/**
 * Get the auto-assigned title for a user based on their highest game rating.
 */
export function getPlayerTitle(user: Record<string, any>): PlayerTitle {
  let bestGame = "";
  let bestRating = 0;

  for (const [game, ratingKey] of Object.entries(GAME_RATING_KEYS)) {
    const rating = user[ratingKey] ?? 1200;
    if (rating > bestRating) {
      bestRating = rating;
      bestGame = game;
    }
  }

  if (!bestGame || bestRating < 1100) {
    return { title: "Rising Contender", game: "", rating: bestRating, tier: "unranked" };
  }

  const titles = GAME_TITLES[bestGame];
  if (!titles) return { title: "Contender", game: bestGame, rating: bestRating, tier: "unranked" };

  let tier: PlayerTitle["tier"];
  let title: string;

  if (bestRating >= 2600) {
    tier = "goat"; title = titles.goat;
  } else if (bestRating >= 1800) {
    tier = "elite"; title = titles.elite;
  } else {
    tier = "base"; title = titles.base;
  }

  return { title, game: bestGame, rating: bestRating, tier };
}

/**
 * Title color based on tier.
 */
export function getTitleColor(tier: PlayerTitle["tier"]): string {
  switch (tier) {
    case "goat":    return "#f59e0b";
    case "elite":   return "#a78bfa";
    case "base":    return "#60a5fa";
    default:        return "#6b7280";
  }
}
