import { db } from "./db";
import { rankRewards, rankHistory, userInventory, userEquipped, shopItems, users, rankSeasons, type GameType } from "@shared/schema";
import { and, eq, desc, lte, asc, sql } from "drizzle-orm";
import { getDivisionInfo, getRankConfig, type RankDivision } from "@shared/rankUtils";
import { ACTIVE_RANK_SEASON_ID } from "./seedRankRewards";
import { pushNotification } from "./notificationStore";

/**
 * Detects rank/division transitions for a user after a rating change.
 * Grants any newly-unlocked rewards atomically. Writes a rank_history row
 * only when tier OR division actually changes (not for every rating tick).
 */
export async function processRatingChange(
  userId: string,
  gameType: GameType,
  oldRating: number,
  newRating: number,
  matchId: string | null = null,
): Promise<{ rankChanged: boolean; rewardsUnlocked: string[] }> {
  const oldInfo = getDivisionInfo(oldRating);
  const newInfo = getDivisionInfo(newRating);

  const tierChanged = oldInfo.tier.label !== newInfo.tier.label;
  const divisionChanged = oldInfo.division !== newInfo.division;
  const rewardsUnlocked: string[] = [];

  if (!tierChanged && !divisionChanged) {
    return { rankChanged: false, rewardsUnlocked: [] };
  }

  const direction = newRating > oldRating ? "up" : "down";

  // Run history insert + reward grants in a single transaction for atomicity.
  const grantedItemIds: string[] = [];
  try {
    await db.transaction(async (tx) => {
      // 1. Grant rewards FIRST (only when moving up) so we can snapshot the granted IDs into history.
      if (direction === "up") {
        // GOAT (9999) is excluded — awarded manually for #1 global only.
        const eligibleRewards = await tx
          .select()
          .from(rankRewards)
          .where(and(
            eq(rankRewards.seasonId, ACTIVE_RANK_SEASON_ID),
            lte(rankRewards.ratingThreshold, Math.floor(newRating)),
          ))
          .orderBy(asc(rankRewards.ratingThreshold));

        for (const reward of eligibleRewards) {
          if (reward.ratingThreshold <= Math.floor(oldRating)) continue;
          if (reward.ratingThreshold >= 9999) continue; // GOAT — manual only
          // Idempotent: relies on unique index user_inventory_user_item_unique.
          // We treat a NEW grant as one returned from the insert. If user already owned the item
          // (e.g. previously purchased from shop), nothing is returned — we deliberately do NOT
          // record it as a fresh unlock for this match.
          const inserted = await tx
            .insert(userInventory)
            .values({ userId, itemId: reward.itemId })
            .onConflictDoNothing({ target: [userInventory.userId, userInventory.itemId] })
            .returning({ itemId: userInventory.itemId });
          if (inserted.length > 0) {
            grantedItemIds.push(reward.itemId);
            rewardsUnlocked.push(reward.itemId);
          }
        }
      }

      // 2. Record the rank-change history row with the granted item snapshot.
      await tx.insert(rankHistory).values({
        userId,
        seasonId: ACTIVE_RANK_SEASON_ID,
        gameType,
        oldRating: Math.round(oldRating),
        newRating: Math.round(newRating),
        oldTier: oldInfo.tier.label,
        newTier: newInfo.tier.label,
        oldDivision: oldInfo.division,
        newDivision: newInfo.division,
        direction,
        matchId: matchId ?? null,
        grantedItemIds,
      });
    });
  } catch (err) {
    console.error("[RANK] failed to record rank change / grant rewards:", err);
    return { rankChanged: true, rewardsUnlocked: [] };
  }

  // Fire notifications outside the transaction (non-critical).
  for (const itemId of grantedItemIds) {
    try {
      const [item] = await db.select().from(shopItems).where(eq(shopItems.id, itemId));
      if (item) {
        pushNotification(userId, {
          type: "rank_reward_unlocked",
          title: "Rank Reward Unlocked",
          body: `${item.name} — earned for reaching ${newInfo.tier.label}${newInfo.division ? " " + newInfo.division : ""}.`,
          linkTo: "/rank-progression",
          meta: { itemId: item.id, tier: newInfo.tier.label, division: newInfo.division },
        });
      }
    } catch { /* non-critical */ }
  }

  return { rankChanged: true, rewardsUnlocked };
}

/**
 * Returns the full rank-progression snapshot for a user + game.
 */
export async function getRankProgressionForUser(userId: string, gameType: GameType) {
  // Fetch user rating for game.
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) throw new Error("User not found");

  const ratingField = `${gameTypeFieldPrefix(gameType)}Rating` as keyof typeof u;
  const rating = (u[ratingField] as number) ?? 1200;
  const info = getDivisionInfo(rating);

  // Fetch reward catalog for the active season, joined with shop items.
  const rewardsCatalog = await db
    .select({
      reward: rankRewards,
      item: shopItems,
    })
    .from(rankRewards)
    .innerJoin(shopItems, eq(rankRewards.itemId, shopItems.id))
    .where(eq(rankRewards.seasonId, ACTIVE_RANK_SEASON_ID))
    .orderBy(asc(rankRewards.ratingThreshold));

  // Fetch which items the user already owns (filtered to reward items).
  const ownedRows = await db
    .select({ itemId: userInventory.itemId })
    .from(userInventory)
    .where(eq(userInventory.userId, userId));
  const ownedSet = new Set(ownedRows.map(r => r.itemId));

  // Fetch currently equipped item ids.
  const equippedRows = await db
    .select({ itemId: userEquipped.itemId })
    .from(userEquipped)
    .where(eq(userEquipped.userId, userId));
  const equippedSet = new Set(equippedRows.map(r => r.itemId));

  const rewards = rewardsCatalog.map(row => ({
    id: row.reward.id,
    tier: row.reward.tier,
    division: row.reward.division as RankDivision | null,
    ratingThreshold: row.reward.ratingThreshold,
    item: row.item,
    unlocked: rating >= row.reward.ratingThreshold,
    owned: ownedSet.has(row.item.id),
    equipped: equippedSet.has(row.item.id),
  }));

  // Next reward = first locked reward (excluding GOAT 9999, manual-only) above current rating.
  const nextReward = rewards.find(r => !r.unlocked && r.ratingThreshold < 9999) ?? null;
  const pointsToNextReward = nextReward ? Math.max(0, nextReward.ratingThreshold - Math.floor(rating)) : null;

  return {
    rating,
    currentTier: info.tier.label,
    currentDivision: info.division,
    label: info.label,
    progressPct: info.progressPct,
    pointsToNext: info.pointsToNext,
    divisionMin: info.divisionMin,
    divisionMax: info.divisionMax,
    tierColor: info.tier.color,
    tierGlow: info.tier.glow,
    rewards,
    nextReward,
    pointsToNextReward,
  };
}

/** Fetch the active season metadata. */
export async function getActiveRankSeason() {
  const [season] = await db.select().from(rankSeasons).where(eq(rankSeasons.id, ACTIVE_RANK_SEASON_ID));
  return season ?? null;
}

/** User's recent rank history (most recent first), optionally filtered by game. */
export async function getRankHistoryForUser(userId: string, gameType?: GameType, limit = 25) {
  const where = gameType
    ? and(eq(rankHistory.userId, userId), eq(rankHistory.gameType, gameType))
    : eq(rankHistory.userId, userId);
  return db
    .select()
    .from(rankHistory)
    .where(where)
    .orderBy(desc(rankHistory.createdAt))
    .limit(limit);
}

// Mirror of the private helper in storage.ts (kept local to avoid import cycle).
// MUST stay in sync with `gameTypeToFieldPrefix` in server/storage.ts.
function gameTypeFieldPrefix(gameType: GameType): string {
  switch (gameType) {
    case "chess":               return "chess";
    case "mini-golf":           return "miniGolf";
    case "connect-4":           return "connect4";
    case "air-hockey":          return "airHockey";
    case "block-blast":         return "blockBlast";
    case "rock-paper-scissors": return "rockPaperScissors";
    case "dots-and-boxes":      return "dotsAndBoxes";
    case "8-ball":              return "eightBall";
    case "bowling":             return "bowling";
    case "cup-king":            return "cupKing";
    case "stack-tower":         return "stackTower";
    case "basketball":          return "basketball";
    case "football":            return "football";
    case "racing":              return "racing";
    default:                    return gameType as string;
  }
}
