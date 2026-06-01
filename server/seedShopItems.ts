import { db } from "./db";
import { sql, like, and, notInArray, inArray, ne } from "drizzle-orm";
import { shopItems } from "@shared/schema";
import { GAME_TRAINING_PATHS, TIER_ORDER, TIER_LABEL, tierBadgeId, type TrainingTier } from "@shared/gameTrainingPaths";
import { TRAINING_MASTER_BADGE_ID, TRAINING_MASTER_BORDER_ID } from "@shared/trainingRewards";

const TIER_GRADIENT: Record<TrainingTier, string> = {
  beginner:     "linear-gradient(135deg,#475569,#64748b,#94a3b8)",
  intermediate: "linear-gradient(135deg,#0891b2,#06b6d4,#67e8f9)",
  advanced:     "linear-gradient(135deg,#9333ea,#c084fc,#e9d5ff)",
  master:       "linear-gradient(135deg,#b45309,#f59e0b,#fde68a)",
};
const TIER_COLOR: Record<TrainingTier, string> = {
  beginner:     "#94a3b8",
  intermediate: "#22d3ee",
  advanced:     "#c084fc",
  master:       "#f59e0b",
};
const TIER_RARITY_LABEL: Record<TrainingTier, string> = {
  beginner: "uncommon",
  intermediate: "rare",
  advanced: "epic",
  master: "legendary",
};

interface SeedItem {
  id: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
  price: string;
  coinPrice: number;
  iconColor: string;
  previewGradient: string;
  isFeatured: boolean;
  isDailyItem: boolean;
  isActive: boolean;
  sortOrder: number;
}

const ITEMS: SeedItem[] = [
  // LEGENDARY (25 Scalps)
  {
    id: "legendary-inferno-frame",
    name: "Inferno Avatar Frame",
    description: "Animated flame border that engulfs your avatar in living fire.",
    category: "avatar_frame", rarity: "legendary", price: "25.00", coinPrice: 0,
    iconColor: "#f97316",
    previewGradient: "linear-gradient(135deg, #7c2d12, #ea580c, #fbbf24)",
    isFeatured: true, isDailyItem: false, isActive: true, sortOrder: 1,
  },
  {
    id: "legendary-galaxy-frame",
    name: "Galaxy Avatar Frame",
    description: "A swirling cosmic border — stars and nebulae orbit your profile.",
    category: "avatar_frame", rarity: "legendary", price: "25.00", coinPrice: 0,
    iconColor: "#818cf8",
    previewGradient: "linear-gradient(135deg, #1e1b4b, #4c1d95, #0ea5e9)",
    isFeatured: true, isDailyItem: false, isActive: true, sortOrder: 2,
  },
  {
    id: "legendary-crown-badge",
    name: "Champions Crown",
    description: "The rarest badge. Worn only by Jango's all-time top players.",
    category: "badge", rarity: "legendary", price: "25.00", coinPrice: 0,
    iconColor: "#eab308",
    previewGradient: "linear-gradient(135deg, #451a03, #b45309, #fde047)",
    isFeatured: true, isDailyItem: false, isActive: true, sortOrder: 3,
  },
  {
    id: "legendary-gold-victory",
    name: "Gold Shower Victory",
    description: "Coins rain from the sky every time you win. Pure satisfaction.",
    category: "victory_animation", rarity: "legendary", price: "25.00", coinPrice: 0,
    iconColor: "#f59e0b",
    previewGradient: "linear-gradient(135deg, #451a03, #92400e, #fcd34d)",
    isFeatured: true, isDailyItem: false, isActive: true, sortOrder: 4,
  },
  {
    id: "legendary-diamond-trail",
    name: "Diamond Trail",
    description: "Leave a sparkling diamond trail as you move across the board.",
    category: "trail", rarity: "legendary", price: "25.00", coinPrice: 0,
    iconColor: "#bae6fd",
    previewGradient: "linear-gradient(135deg, #0c4a6e, #0284c7, #e0f2fe)",
    isFeatured: false, isDailyItem: false, isActive: true, sortOrder: 5,
  },
  {
    id: "legendary-goat-badge",
    name: "G.O.A.T. Badge",
    description: "Greatest Of All Time. Auto-awarded to the all-time #1 ranked player.",
    category: "badge", rarity: "legendary", price: "25.00", coinPrice: 0,
    iconColor: "#fbbf24",
    previewGradient: "linear-gradient(135deg, #451a03, #92400e, #fde047)",
    isFeatured: false, isDailyItem: false, isActive: true, sortOrder: 6,
  },

  // EPIC (20 Scalps)
  {
    id: "epic-neon-frame",
    name: "Neon Pulse Frame",
    description: "Electric neon glow that pulses between hot pink and electric blue.",
    category: "avatar_frame", rarity: "epic", price: "20.00", coinPrice: 0,
    iconColor: "#a855f7",
    previewGradient: "linear-gradient(135deg, #3b0764, #7c3aed, #ec4899)",
    isFeatured: true, isDailyItem: false, isActive: true, sortOrder: 10,
  },
  {
    id: "epic-high-roller-badge",
    name: "High Roller",
    description: "Exclusive badge for players who've wagered big and won bigger.",
    category: "badge", rarity: "epic", price: "20.00", coinPrice: 0,
    iconColor: "#c084fc",
    previewGradient: "linear-gradient(135deg, #3b0764, #7c3aed, #d946ef)",
    isFeatured: false, isDailyItem: false, isActive: true, sortOrder: 11,
  },
  {
    id: "epic-og-badge",
    name: "OG Badge",
    description: "Original Gangster. One of the first 1,000 players on the platform.",
    category: "badge", rarity: "epic", price: "20.00", coinPrice: 0,
    iconColor: "#818cf8",
    previewGradient: "linear-gradient(135deg, #1e1b4b, #3730a3, #a5b4fc)",
    isFeatured: false, isDailyItem: false, isActive: true, sortOrder: 12,
  },
  {
    id: "epic-lightning-victory",
    name: "Lightning Strike Victory",
    description: "Lightning bolts crack across the screen when you take down an opponent.",
    category: "victory_animation", rarity: "epic", price: "20.00", coinPrice: 0,
    iconColor: "#fbbf24",
    previewGradient: "linear-gradient(135deg, #1c1917, #44403c, #fef08a)",
    isFeatured: false, isDailyItem: false, isActive: true, sortOrder: 13,
  },
  {
    id: "epic-cyber-theme",
    name: "Cyberpunk Theme",
    description: "Turn the entire UI neon-yellow on black. Blade Runner vibes.",
    category: "theme", rarity: "epic", price: "20.00", coinPrice: 0,
    iconColor: "#fde047",
    previewGradient: "linear-gradient(135deg, #0c0a09, #3f3f46, #facc15)",
    isFeatured: false, isDailyItem: false, isActive: true, sortOrder: 14,
  },
  {
    id: "epic-animated-username",
    name: "Rainbow Username Glow",
    description: "Your username cycles through the full color spectrum in matches.",
    category: "badge", rarity: "epic", price: "20.00", coinPrice: 0,
    iconColor: "#f472b6",
    previewGradient: "linear-gradient(135deg, #4c1d95, #db2777, #f97316)",
    isFeatured: false, isDailyItem: false, isActive: true, sortOrder: 15,
  },
  {
    id: "epic-streamer-badge",
    name: "Streamer Mode Badge",
    description: "Show the world you are live — animated broadcasting badge.",
    category: "badge", rarity: "epic", price: "20.00", coinPrice: 0,
    iconColor: "#f43f5e",
    previewGradient: "linear-gradient(135deg, #4c0519, #be123c, #fda4af)",
    isFeatured: false, isDailyItem: false, isActive: true, sortOrder: 16,
  },
  {
    id: "epic-neon-hud",
    name: "Neon HUD Accent",
    description: "Replaces game HUD elements with a neon glowing variant.",
    category: "theme", rarity: "epic", price: "20.00", coinPrice: 0,
    iconColor: "#22d3ee",
    previewGradient: "linear-gradient(135deg, #042f2e, #0d9488, #67e8f9)",
    isFeatured: false, isDailyItem: false, isActive: true, sortOrder: 17,
  },

  // RARE (15 Scalps)
  {
    id: "rare-electric-frame",
    name: "Electric Blue Frame",
    description: "A sharp electric-blue glow ring that charges up your look.",
    category: "avatar_frame", rarity: "rare", price: "15.00", coinPrice: 0,
    iconColor: "#38bdf8",
    previewGradient: "linear-gradient(135deg, #0c4a6e, #0369a1, #7dd3fc)",
    isFeatured: false, isDailyItem: false, isActive: true, sortOrder: 20,
  },
  {
    id: "rare-top100-badge",
    name: "Top 100 Badge",
    description: "Recognition for consistently ranking in the platform top 100.",
    category: "badge", rarity: "rare", price: "15.00", coinPrice: 0,
    iconColor: "#60a5fa",
    previewGradient: "linear-gradient(135deg, #1e3a5f, #1d4ed8, #93c5fd)",
    isFeatured: false, isDailyItem: false, isActive: true, sortOrder: 21,
  },
  {
    id: "rare-confetti-victory",
    name: "Confetti Explosion",
    description: "A confetti cannon fires at the end of every match you win.",
    category: "victory_animation", rarity: "rare", price: "15.00", coinPrice: 0,
    iconColor: "#34d399",
    previewGradient: "linear-gradient(135deg, #064e3b, #059669, #a7f3d0)",
    isFeatured: false, isDailyItem: false, isActive: true, sortOrder: 22,
  },
  {
    id: "rare-ocean-board",
    name: "Ocean Board Skin",
    description: "Deep ocean waves wash across the game board surface.",
    category: "board_skin", rarity: "rare", price: "15.00", coinPrice: 0,
    iconColor: "#06b6d4",
    previewGradient: "linear-gradient(135deg, #083344, #0e7490, #67e8f9)",
    isFeatured: false, isDailyItem: false, isActive: true, sortOrder: 23,
  },
  {
    id: "rare-lava-banner",
    name: "Lava Flow Banner",
    description: "A smoldering lava banner glows across your profile header.",
    category: "banner", rarity: "rare", price: "15.00", coinPrice: 0,
    iconColor: "#ef4444",
    previewGradient: "linear-gradient(135deg, #450a0a, #b91c1c, #fca5a5)",
    isFeatured: false, isDailyItem: false, isActive: true, sortOrder: 24,
  },
  {
    id: "rare-entry-animation",
    name: "Shock Entry",
    description: "You burst into every match with a lightning bolt intro animation.",
    category: "victory_animation", rarity: "rare", price: "15.00", coinPrice: 0,
    iconColor: "#a3e635",
    previewGradient: "linear-gradient(135deg, #1a2e05, #4d7c0f, #d9f99d)",
    isFeatured: false, isDailyItem: false, isActive: true, sortOrder: 25,
  },
  {
    id: "rare-rival-badge",
    name: "Rival Badge",
    description: "Mark your top rival on the platform with this exclusive badge.",
    category: "badge", rarity: "rare", price: "15.00", coinPrice: 0,
    iconColor: "#f97316",
    previewGradient: "linear-gradient(135deg, #431407, #c2410c, #fed7aa)",
    isFeatured: false, isDailyItem: false, isActive: true, sortOrder: 26,
  },
  {
    id: "rare-golden-dice",
    name: "Gold Dice Skin",
    description: "Your dice turn gold when played. Roll in style.",
    category: "dice_skin", rarity: "rare", price: "15.00", coinPrice: 0,
    iconColor: "#f59e0b",
    previewGradient: "linear-gradient(135deg, #451a03, #b45309, #fde047)",
    isFeatured: false, isDailyItem: false, isActive: true, sortOrder: 27,
  },

  // UNCOMMON (10 Scalps)
  {
    id: "uncommon-green-frame",
    name: "Emerald Frame",
    description: "A clean emerald-green glow ring for your avatar.",
    category: "avatar_frame", rarity: "uncommon", price: "10.00", coinPrice: 0,
    iconColor: "#22c55e",
    previewGradient: "linear-gradient(135deg, #052e16, #166534, #86efac)",
    isFeatured: false, isDailyItem: false, isActive: true, sortOrder: 30,
  },
  {
    id: "uncommon-veteran-badge",
    name: "Veteran Badge",
    description: "Awarded to players with over 100 matches played.",
    category: "badge", rarity: "uncommon", price: "10.00", coinPrice: 0,
    iconColor: "#4ade80",
    previewGradient: "linear-gradient(135deg, #052e16, #15803d, #86efac)",
    isFeatured: false, isDailyItem: true, isActive: true, sortOrder: 31,
  },
  {
    id: "uncommon-forest-board",
    name: "Forest Board",
    description: "A lush green felt board with subtle wood-grain edges.",
    category: "board_skin", rarity: "uncommon", price: "10.00", coinPrice: 0,
    iconColor: "#16a34a",
    previewGradient: "linear-gradient(135deg, #052e16, #15803d, #86efac)",
    isFeatured: false, isDailyItem: false, isActive: true, sortOrder: 32,
  },
  {
    id: "uncommon-party-emote",
    name: "Party Emote",
    description: "Fire off a party popper mid-match to celebrate big plays.",
    category: "emote", rarity: "uncommon", price: "10.00", coinPrice: 0,
    iconColor: "#f9a8d4",
    previewGradient: "linear-gradient(135deg, #500724, #be185d, #fda4af)",
    isFeatured: false, isDailyItem: true, isActive: true, sortOrder: 33,
  },
  {
    id: "uncommon-steel-banner",
    name: "Steel Banner",
    description: "Industrial steel banner — simple, clean, intimidating.",
    category: "banner", rarity: "uncommon", price: "10.00", coinPrice: 0,
    iconColor: "#94a3b8",
    previewGradient: "linear-gradient(135deg, #0f172a, #334155, #cbd5e1)",
    isFeatured: false, isDailyItem: false, isActive: true, sortOrder: 34,
  },
  {
    id: "uncommon-holographic-card",
    name: "Holographic Card Skin",
    description: "Holographic shimmer effect on your in-game card backs.",
    category: "card_skin", rarity: "uncommon", price: "10.00", coinPrice: 0,
    iconColor: "#a78bfa",
    previewGradient: "linear-gradient(135deg, #2e1065, #7c3aed, #ddd6fe)",
    isFeatured: false, isDailyItem: false, isActive: true, sortOrder: 35,
  },

  // COMMON (5 Scalps)
  {
    id: "common-white-frame",
    name: "Clean White Frame",
    description: "Minimal white border ring. Classic and understated.",
    category: "avatar_frame", rarity: "common", price: "5.00", coinPrice: 0,
    iconColor: "#e2e8f0",
    previewGradient: "linear-gradient(135deg, #0f172a, #1e293b, #e2e8f0)",
    isFeatured: false, isDailyItem: true, isActive: true, sortOrder: 40,
  },
  {
    id: "common-thumbs-emote",
    name: "Thumbs Up Emote",
    description: "A simple thumbs up for good sportsmanship.",
    category: "emote", rarity: "common", price: "5.00", coinPrice: 0,
    iconColor: "#94a3b8",
    previewGradient: "linear-gradient(135deg, #0f172a, #1e293b, #475569)",
    isFeatured: false, isDailyItem: true, isActive: true, sortOrder: 41,
  },
  {
    id: "common-starter-badge",
    name: "Starter Badge",
    description: "Everyone starts somewhere. Your first badge on Jango.",
    category: "badge", rarity: "common", price: "5.00", coinPrice: 0,
    iconColor: "#64748b",
    previewGradient: "linear-gradient(135deg, #0f172a, #1e293b, #475569)",
    isFeatured: false, isDailyItem: false, isActive: true, sortOrder: 42,
  },
  {
    id: "common-dark-board",
    name: "Midnight Board",
    description: "Pure black felt. Simple and focused.",
    category: "board_skin", rarity: "common", price: "5.00", coinPrice: 0,
    iconColor: "#1e293b",
    previewGradient: "linear-gradient(135deg, #020617, #0f172a, #1e293b)",
    isFeatured: false, isDailyItem: false, isActive: true, sortOrder: 43,
  },
  // ─── Tutorial completion badges (hidden from shop, granted by training) ───
  ...[
    { id: "tutorial-rookie-badge",        name: "Arena Rookie",      gradient: "linear-gradient(135deg,#6366f1,#8b5cf6,#ec4899)", color: "#a855f7" },
    { id: "tutorial-minigolf-rookie",     name: "Mini Golf Rookie",  gradient: "linear-gradient(135deg,#16a34a,#22c55e,#86efac)", color: "#4ade80" },
    { id: "tutorial-connect4-rookie",     name: "Connect 4 Rookie",  gradient: "linear-gradient(135deg,#dc2626,#f59e0b,#fbbf24)", color: "#f97316" },
    { id: "tutorial-airhockey-rookie",    name: "Air Hockey Rookie", gradient: "linear-gradient(135deg,#0ea5e9,#38bdf8,#7dd3fc)", color: "#38bdf8" },
    { id: "tutorial-rps-rookie",          name: "RPS Rookie",        gradient: "linear-gradient(135deg,#7c3aed,#a78bfa,#c4b5fd)", color: "#a78bfa" },
    { id: "tutorial-grid-rookie",         name: "Grid Rookie",       gradient: "linear-gradient(135deg,#0891b2,#06b6d4,#67e8f9)", color: "#22d3ee" },
    { id: "tutorial-pool-rookie",         name: "Pool Rookie",       gradient: "linear-gradient(135deg,#065f46,#10b981,#6ee7b7)", color: "#10b981" },
    { id: "tutorial-bowling-rookie",      name: "Bowling Rookie",    gradient: "linear-gradient(135deg,#9333ea,#c084fc,#e9d5ff)", color: "#c084fc" },
    { id: "tutorial-cup-rookie",          name: "Cup Rookie",        gradient: "linear-gradient(135deg,#b45309,#f59e0b,#fde68a)", color: "#f59e0b" },
    { id: "tutorial-tower-rookie",        name: "Tower Rookie",      gradient: "linear-gradient(135deg,#374151,#6b7280,#d1d5db)", color: "#9ca3af" },
    { id: "tutorial-block-rookie",        name: "Block Rookie",      gradient: "linear-gradient(135deg,#db2777,#ec4899,#f9a8d4)", color: "#ec4899" },
  ].map((b, i) => ({
    id: b.id,
    name: b.name,
    description: `Earned by completing the ${b.name.replace(" Rookie", "").replace("Arena ", "")} training mission.`,
    category: "badge" as const,
    rarity: "uncommon" as const,
    price: "0.00",
    coinPrice: 0,
    iconColor: b.color,
    previewGradient: b.gradient,
    isFeatured: false,
    isDailyItem: false,
    isActive: false, // hidden from regular shop — granted only via tutorial completion
    sortOrder: 1000 + i,
  })),
  // ─── Training Master capstone reward (granted once all trainings done) ───
  {
    id: TRAINING_MASTER_BADGE_ID,
    name: "Mythic Training Master",
    description: "Awarded for completing every training mission on Jango. The rarest training badge.",
    category: "badge",
    rarity: "mythic",
    price: "0.00",
    coinPrice: 0,
    iconColor: "#e879f9",
    previewGradient: "linear-gradient(135deg,#fbbf24,#e879f9,#22d3ee)",
    isFeatured: false,
    isDailyItem: false,
    isActive: false,
    sortOrder: 1090,
  },
  {
    id: TRAINING_MASTER_BORDER_ID,
    name: "Training Master Profile Border",
    description: "An animated rainbow profile border, earned only by mastering every training ladder.",
    category: "avatar_frame",
    rarity: "mythic",
    price: "0.00",
    coinPrice: 0,
    iconColor: "#e879f9",
    previewGradient: "linear-gradient(135deg,#fbbf24,#e879f9,#22d3ee)",
    isFeatured: false,
    isDailyItem: false,
    isActive: false,
    sortOrder: 1091,
  },
  // ─── Generated per-game tier badges (Beginner→Master). Beginner IDs may
  // collide with the hand-curated rookie list above; ON CONFLICT DO NOTHING
  // ensures the hand-curated entry wins. Intermediate/Advanced/Master are new.
  ...GAME_TRAINING_PATHS.flatMap((game, gi) =>
    TIER_ORDER.map((tier, ti) => ({
      id: tierBadgeId(game.slug, tier),
      name: `${game.title} ${TIER_LABEL[tier]}`,
      description: `Earned by completing the ${game.title} ${TIER_LABEL[tier]} training.`,
      category: "badge" as const,
      rarity: TIER_RARITY_LABEL[tier],
      price: "0.00",
      coinPrice: 0,
      iconColor: TIER_COLOR[tier],
      previewGradient: TIER_GRADIENT[tier],
      isFeatured: false,
      isDailyItem: false,
      isActive: false, // hidden from regular shop — granted only via tutorial completion
      sortOrder: 1100 + gi * 10 + ti,
    })),
  ),
];

/**
 * Set of every `tutorial-*` shop_item ID that is *expected* to exist after
 * seeding. Any row matching `tutorial-%` that is NOT in this set is an
 * orphan left over from a previous seed version (e.g. renamed games, dropped
 * mascot badges) and is removed by `seedShopItems()` on every boot.
 */
function allowedTutorialBadgeIds(): Set<string> {
  return new Set(
    ITEMS
      .map(i => i.id)
      .filter(id => id.startsWith("tutorial-")),
  );
}

export async function seedShopItems() {
  try {
    for (const item of ITEMS) {
      await db.execute(sql`
        INSERT INTO shop_items (
          id, name, description, category, rarity, price, coin_price,
          icon_color, preview_gradient, is_featured, is_daily_item, is_active, sort_order
        )
        VALUES (
          ${item.id}, ${item.name}, ${item.description},
          ${item.category}, ${item.rarity}, ${item.price}, ${item.coinPrice},
          ${item.iconColor}, ${item.previewGradient},
          ${item.isFeatured}, ${item.isDailyItem}, ${item.isActive}, ${item.sortOrder}
        )
        ON CONFLICT (id) DO NOTHING
      `);
    }

    // Reconcile the Training Master capstone items: the original seed used
    // rarity="legendary" but they're meant to be mythic (the rarest tier).
    // ON CONFLICT DO NOTHING above won't fix already-seeded rows, so force
    // these two specific items to the canonical mythic rarity on every boot.
    await db
      .update(shopItems)
      .set({ rarity: "mythic" })
      .where(
        and(
          inArray(shopItems.id, [TRAINING_MASTER_BADGE_ID, TRAINING_MASTER_BORDER_ID]),
          ne(shopItems.rarity, "mythic"),
        ),
      );

    // Reconcile: delete any tutorial-* shop_items that are no longer part of
    // the canonical set. Scoped strictly to the `tutorial-` prefix so we
    // never touch hand-curated shop SKUs.
    const allowed = Array.from(allowedTutorialBadgeIds());
    const removed = await db
      .delete(shopItems)
      .where(
        and(
          like(shopItems.id, "tutorial-%"),
          notInArray(shopItems.id, allowed),
        ),
      )
      .returning({ id: shopItems.id });

    if (removed.length > 0) {
      console.log(
        `[SHOP] Removed ${removed.length} orphan tutorial badge(s): ${removed.map(r => r.id).join(", ")}`,
      );
    }
    console.log(`[SHOP] Seeded ${ITEMS.length} shop items.`);
  } catch (err) {
    console.error("[SHOP] seedShopItems error:", err);
  }
}
