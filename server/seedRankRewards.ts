import { db } from "./db";
import { rankSeasons, rankRewards, shopItems } from "@shared/schema";
import { sql, eq } from "drizzle-orm";
import { RANK_TIERS, RANK_DIVISIONS, ratingThresholdFor, type RankTier, type RankDivision } from "@shared/rankUtils";

const SEASON_ID = "season-1-genesis";

interface SeedCosmetic {
  id: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
  iconColor: string;
  previewGradient: string;
}

interface RewardSpec {
  tier: RankTier | "GOAT";
  division: RankDivision | null;
  cosmetic: SeedCosmetic;
}

// Reward palette — drawn from each rank's color in rankUtils.
const TIER_COLORS: Record<RankTier | "GOAT", { primary: string; gradient: string }> = {
  Bronze:   { primary: "#cd7f32", gradient: "linear-gradient(135deg, #5b3a14, #a35a1f, #f0b56e)" },
  Silver:   { primary: "#a8b2c0", gradient: "linear-gradient(135deg, #2c3340, #6b7587, #d9dee6)" },
  Gold:     { primary: "#ffd700", gradient: "linear-gradient(135deg, #5e4a00, #b8910f, #ffe968)" },
  Platinum: { primary: "#7fffd4", gradient: "linear-gradient(135deg, #0f4d44, #2fb8a0, #aeffe6)" },
  Diamond:  { primary: "#00cfff", gradient: "linear-gradient(135deg, #062c4d, #0a7dbb, #8fe5ff)" },
  Champion: { primary: "#d97aff", gradient: "linear-gradient(135deg, #3a0066, #8a23c4, #f0a8ff)" },
  GOAT:     { primary: "#FF2D8A", gradient: "linear-gradient(135deg, #4a002a, #c4226e, #ffd86a)" },
};

// Per-division reward categories (sweep across categories so each tier gives variety).
// III = badge (entry-tier), II = avatar_frame (visible flair), I = victory_animation (rare flex)
const DIVISION_CATEGORY: Record<RankDivision, string> = {
  "III": "badge",
  "II":  "avatar_frame",
  "I":   "victory_animation",
};

const DIVISION_RARITY: Record<RankDivision, string> = {
  "III": "common",
  "II":  "uncommon",
  "I":   "rare",
};

// Tier-level rarity scale for the higher tiers — overrides division rarity.
const TIER_RARITY_FLOOR: Partial<Record<RankTier | "GOAT", string>> = {
  Platinum: "rare",
  Diamond:  "epic",
  Champion: "legendary",
  GOAT:     "legendary",
};

const TIER_FLAVOR: Record<RankTier | "GOAT", { III: string; II: string; I: string; soloName?: string; soloDesc?: string; soloCategory?: string }> = {
  Bronze: {
    III: "Beginner's mark — proof you've stepped onto the table.",
    II:  "A weathered bronze ring around your avatar — earned through grind.",
    I:   "Polished bronze sparks crown every win.",
  },
  Silver: {
    III: "Silver crest — you've climbed past the rookies.",
    II:  "A cool silver avatar frame with subtle chrome reflections.",
    I:   "Silver shockwave radiates from your victory pose.",
  },
  Gold: {
    III: "Gold crown badge — your name carries weight now.",
    II:  "Gilded gold frame with a slow shimmering glow.",
    I:   "Gold confetti burst when you take the win.",
  },
  Platinum: {
    III: "Platinum diamond crest — the elite-bound start here.",
    II:  "Mirror-platinum frame with a cyan halo.",
    I:   "Platinum prism — a refracting light show on victory.",
  },
  Diamond: {
    III: "Diamond shard badge — sharp, cold, and rare.",
    II:  "Diamond-cut avatar frame with a moving blue gleam.",
    I:   "Diamond rain — facets of light cascade across the screen.",
  },
  Champion: {
    III: "", II: "", I: "", // Champion has no divisions
    soloName: "Champion's Aura",
    soloDesc: "A magenta aura crowns your profile — only Champions hold this.",
    soloCategory: "avatar_frame",
  },
  GOAT: {
    III: "", II: "", I: "",
    soloName: "GOAT Crown",
    soloDesc: "The animated crown of the all-time #1. Untouchable.",
    soloCategory: "victory_animation",
  },
};

function buildRewardSpecs(): RewardSpec[] {
  const out: RewardSpec[] = [];
  for (const tier of RANK_TIERS) {
    if (tier.label === "Champion") {
      const f = TIER_FLAVOR.Champion;
      out.push({
        tier: "Champion",
        division: null,
        cosmetic: {
          id: `rank-champion`,
          name: f.soloName!,
          description: f.soloDesc!,
          category: f.soloCategory!,
          rarity: TIER_RARITY_FLOOR.Champion || "epic",
          iconColor: TIER_COLORS.Champion.primary,
          previewGradient: TIER_COLORS.Champion.gradient,
        },
      });
      continue;
    }
    for (const div of RANK_DIVISIONS) {
      const flavor = TIER_FLAVOR[tier.label];
      const category = DIVISION_CATEGORY[div];
      const rarity = TIER_RARITY_FLOOR[tier.label] || DIVISION_RARITY[div];
      out.push({
        tier: tier.label,
        division: div,
        cosmetic: {
          id: `rank-${tier.label.toLowerCase()}-${div.toLowerCase()}`,
          name: `${tier.label} ${div} ${categoryNameFor(category)}`,
          description: flavor[div],
          category,
          rarity,
          iconColor: TIER_COLORS[tier.label].primary,
          previewGradient: TIER_COLORS[tier.label].gradient,
        },
      });
    }
  }
  // GOAT — special, ratingThreshold 9999, granted manually for #1 global player.
  const fg = TIER_FLAVOR.GOAT;
  out.push({
    tier: "GOAT",
    division: null,
    cosmetic: {
      id: `rank-goat`,
      name: fg.soloName!,
      description: fg.soloDesc!,
      category: fg.soloCategory!,
      rarity: "legendary",
      iconColor: TIER_COLORS.GOAT.primary,
      previewGradient: TIER_COLORS.GOAT.gradient,
    },
  });
  return out;
}

function categoryNameFor(category: string): string {
  switch (category) {
    case "badge": return "Crest";
    case "avatar_frame": return "Frame";
    case "victory_animation": return "Victory";
    case "banner": return "Banner";
    case "trail": return "Trail";
    default: return "Reward";
  }
}

export async function seedRankRewards() {
  // 1. Ensure season exists.
  await db.insert(rankSeasons).values({
    id: SEASON_ID,
    name: "Season 1: Genesis",
    tagline: "The first climb. Earn every rank-bound reward.",
    startsAt: new Date("2026-01-01T00:00:00Z"),
    endsAt: null,
    isActive: true,
  }).onConflictDoNothing();

  const specs = buildRewardSpecs();

  // 2. Upsert all reward cosmetics into shop_items (price 0, not buyable in normal shop — flagged inactive there).
  for (const spec of specs) {
    const c = spec.cosmetic;
    await db.insert(shopItems).values({
      id: c.id,
      name: c.name,
      description: c.description,
      category: c.category,
      rarity: c.rarity,
      price: "0",
      coinPrice: 0,
      iconColor: c.iconColor,
      previewGradient: c.previewGradient,
      isActive: false, // hidden from regular shop catalog
      isFeatured: false,
      isDailyItem: false,
      sortOrder: 9999,
    }).onConflictDoUpdate({
      target: shopItems.id,
      set: {
        name: c.name,
        description: c.description,
        category: c.category,
        rarity: c.rarity,
        iconColor: c.iconColor,
        previewGradient: c.previewGradient,
      },
    });
  }

  // 3. Upsert rank_rewards rows linking thresholds → items.
  let sortOrder = 0;
  for (const spec of specs) {
    const threshold = ratingThresholdFor(spec.tier, spec.division);
    const rewardId = `${SEASON_ID}-${spec.cosmetic.id}`;
    await db.insert(rankRewards).values({
      id: rewardId,
      seasonId: SEASON_ID,
      tier: spec.tier,
      division: spec.division,
      ratingThreshold: threshold,
      itemId: spec.cosmetic.id,
      sortOrder: sortOrder++,
    }).onConflictDoUpdate({
      target: rankRewards.id,
      set: {
        ratingThreshold: threshold,
        itemId: spec.cosmetic.id,
        sortOrder: sortOrder,
      },
    });
  }

  console.log(`[RANK] Seeded ${specs.length} rank rewards across ${RANK_TIERS.length + 1} tiers.`);
}

export const ACTIVE_RANK_SEASON_ID = SEASON_ID;
