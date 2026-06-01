export type RankTier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond" | "Champion";

export interface RankConfig {
  label: RankTier;
  color: string;
  glow: string;
  bg: string;
  border: string;
  minRating: number;
  maxRating: number;
  description: string;
  skillLevel: string;
}

/**
 * Tier ladder.
 * New players start at 1200 → Silver.
 *
 * Bronze    0   – 999
 * Silver    1000 – 1399
 * Gold      1400 – 1799
 * Platinum  1800 – 2199
 * Diamond   2200 – 2599
 * Champion  2600+
 */
export const RANK_TIERS: RankConfig[] = [
  {
    label: "Bronze",
    color: "#cd7f32", glow: "rgba(205,127,50,0.45)", bg: "rgba(205,127,50,0.12)", border: "rgba(205,127,50,0.35)",
    minRating: 0, maxRating: 999,
    description: "Beginner players learning the basics.",
    skillLevel: "Beginner",
  },
  {
    label: "Silver",
    color: "#a8b2c0", glow: "rgba(168,178,192,0.45)", bg: "rgba(168,178,192,0.12)", border: "rgba(168,178,192,0.35)",
    minRating: 1000, maxRating: 1399,
    description: "Average players with developing strategy.",
    skillLevel: "Developing",
  },
  {
    label: "Gold",
    color: "#ffd700", glow: "rgba(255,215,0,0.45)", bg: "rgba(255,215,0,0.12)", border: "rgba(255,215,0,0.35)",
    minRating: 1400, maxRating: 1799,
    description: "Strong players with solid consistency.",
    skillLevel: "Solid",
  },
  {
    label: "Platinum",
    color: "#7fffd4", glow: "rgba(127,255,212,0.45)", bg: "rgba(127,255,212,0.12)", border: "rgba(127,255,212,0.35)",
    minRating: 1800, maxRating: 2199,
    description: "Advanced players with sharp mechanics.",
    skillLevel: "Advanced",
  },
  {
    label: "Diamond",
    color: "#00cfff", glow: "rgba(0,207,255,0.45)", bg: "rgba(0,207,255,0.12)", border: "rgba(0,207,255,0.35)",
    minRating: 2200, maxRating: 2599,
    description: "Top-tier competitive players.",
    skillLevel: "Elite",
  },
  {
    label: "Champion",
    color: "#d97aff", glow: "rgba(217,122,255,0.45)", bg: "rgba(217,122,255,0.12)", border: "rgba(217,122,255,0.35)",
    minRating: 2600, maxRating: 9999,
    description: "The best of the best — elite competitors.",
    skillLevel: "Champion",
  },
];

/** Special GOAT config — not a tier, but a status granted to the single #1 global player. */
export const GOAT_CONFIG = {
  label: "GOAT",
  color: "#FF2D8A",
  glow: "rgba(255,45,138,0.6)",
  bg: "rgba(255,45,138,0.12)",
  border: "rgba(255,45,138,0.4)",
  secondaryColor: "#ffd700",
  description: "The single highest-rated player on the platform.",
  skillLevel: "Legendary",
};

export function getRankConfig(rating: number): RankConfig {
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (rating >= RANK_TIERS[i].minRating) return RANK_TIERS[i];
  }
  return RANK_TIERS[0];
}

export function getRankTier(rating: number): RankTier {
  return getRankConfig(rating).label;
}

export function getRatingProgress(rating: number): number {
  const cfg = getRankConfig(rating);
  if (cfg.maxRating === 9999) return 100;
  const range = cfg.maxRating - cfg.minRating + 1;
  return Math.min(100, Math.round(((rating - cfg.minRating) / range) * 100));
}

/** Points needed to reach the next tier boundary, or null if already Champion. */
export function getPointsToNextTier(rating: number): number | null {
  const cfg = getRankConfig(rating);
  if (cfg.maxRating === 9999) return null;
  return cfg.maxRating + 1 - rating;
}

/** Returns the next tier config, or null if already Champion. */
export function getNextTierConfig(rating: number): RankConfig | null {
  const cfg = getRankConfig(rating);
  const idx = RANK_TIERS.findIndex(t => t.label === cfg.label);
  return idx < RANK_TIERS.length - 1 ? RANK_TIERS[idx + 1] : null;
}

// ─── Divisions ────────────────────────────────────────────────────────────
//
// Each non-Champion tier is split into 3 equal divisions: III (lowest), II, I (highest).
// Champion has no divisions (single tier).

export type RankDivision = "III" | "II" | "I";
export const RANK_DIVISIONS: RankDivision[] = ["III", "II", "I"];

export interface DivisionInfo {
  tier: RankConfig;
  division: RankDivision | null; // null for Champion (no divisions)
  divisionMin: number;
  divisionMax: number;
  /** 0-100 percent through this division. */
  progressPct: number;
  /** Rating required to reach the next division (or next tier if at I). null if at Champion. */
  pointsToNext: number | null;
  /** Label: e.g. "Gold II", or "Champion" */
  label: string;
}

/** Divides a tier's [minRating..maxRating] equally into 3 sub-bands and returns the band. */
function divisionBounds(tier: RankConfig, division: RankDivision): { min: number; max: number } {
  // Champion has no divisions handled by caller.
  const span = tier.maxRating - tier.minRating + 1;
  const per = Math.floor(span / 3);
  const remainder = span - per * 3; // distribute extras into highest division (I)
  // III = bottom band, II = middle, I = top band (and gets remainder)
  if (division === "III") return { min: tier.minRating, max: tier.minRating + per - 1 };
  if (division === "II") return { min: tier.minRating + per, max: tier.minRating + per * 2 - 1 };
  // I — top band, absorbs remainder
  return { min: tier.minRating + per * 2, max: tier.minRating + per * 2 + per + remainder - 1 };
}

export function getDivisionInfo(rating: number): DivisionInfo {
  const tier = getRankConfig(rating);
  // Champion: no divisions
  if (tier.label === "Champion") {
    return {
      tier,
      division: null,
      divisionMin: tier.minRating,
      divisionMax: tier.maxRating,
      progressPct: 100,
      pointsToNext: null,
      label: "Champion",
    };
  }
  for (const div of RANK_DIVISIONS) {
    const { min, max } = divisionBounds(tier, div);
    if (rating >= min && rating <= max) {
      const span = max - min + 1;
      const pct = Math.max(0, Math.min(100, Math.round(((rating - min) / span) * 100)));
      // pointsToNext = rating needed to enter next division (or next tier).
      const pointsToNext = max + 1 - rating;
      return {
        tier,
        division: div,
        divisionMin: min,
        divisionMax: max,
        progressPct: pct,
        pointsToNext,
        label: `${tier.label} ${div}`,
      };
    }
  }
  // Fallback (shouldn't hit) — treat as bottom division of tier.
  const { min, max } = divisionBounds(tier, "III");
  return {
    tier,
    division: "III",
    divisionMin: min,
    divisionMax: max,
    progressPct: 0,
    pointsToNext: max + 1 - rating,
    label: `${tier.label} III`,
  };
}

/** Returns the next (tier, division) tuple after the current one, or null if at top. */
export function getNextDivisionLabel(rating: number): string | null {
  const info = getDivisionInfo(rating);
  if (!info.division) return null; // Champion
  if (info.division === "I") {
    const next = getNextTierConfig(rating);
    return next ? `${next.label} III` : null;
  }
  if (info.division === "II") return `${info.tier.label} I`;
  return `${info.tier.label} II`;
}

/** Returns the minimum rating threshold for a given (tier, division). */
export function ratingThresholdFor(tierLabel: RankTier | "GOAT", division: RankDivision | null): number {
  if (tierLabel === "GOAT") return 9999; // special; granted manually
  const tier = RANK_TIERS.find(t => t.label === tierLabel);
  if (!tier) return 0;
  if (tier.label === "Champion" || !division) return tier.minRating;
  return divisionBounds(tier, division).min;
}

/** All (tier, division) milestones in ascending order, including Champion (no division) and GOAT. */
export function allRankMilestones(): { tier: RankTier | "GOAT"; division: RankDivision | null; threshold: number }[] {
  const out: { tier: RankTier | "GOAT"; division: RankDivision | null; threshold: number }[] = [];
  for (const tier of RANK_TIERS) {
    if (tier.label === "Champion") {
      out.push({ tier: tier.label, division: null, threshold: tier.minRating });
      continue;
    }
    for (const div of RANK_DIVISIONS) {
      const { min } = divisionBounds(tier, div);
      out.push({ tier: tier.label, division: div, threshold: min });
    }
  }
  out.push({ tier: "GOAT", division: null, threshold: 9999 });
  return out;
}
