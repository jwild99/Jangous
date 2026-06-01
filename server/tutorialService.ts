import { db } from "./db";
import { tutorialProgress, userInventory, shopItems, users, drillScores, type DrillScoreRow } from "@shared/schema";
import { and, eq, sql, desc } from "drizzle-orm";
import { pushNotification } from "./notificationStore";
import {
  CANONICAL_TUTORIAL_ORDER,
  ACTIVE_TUTORIAL_IDS,
  isActiveTutorial,
  computeUnlockStateFromCompleted,
  canonicalIndex,
} from "@shared/tutorialOrder";

import { flattenGameTiers } from "@shared/gameTrainingPaths";
import {
  TRAINING_REWARDS,
  TRAINING_MASTER_ID,
  TRAINING_MASTER_BADGE_ID,
  TRAINING_MASTER_BORDER_ID,
  getTrainingReward,
} from "@shared/trainingRewards";

export { ACTIVE_TUTORIAL_IDS, isActiveTutorial };

/**
 * Maps each tutorial ID to the badge granted on completion. Game-tier badges
 * are derived from the canonical config so a new tier registers automatically.
 * The platform-basics badge is the only hand-rolled mapping.
 */
export const TUTORIAL_BADGE_MAP: Record<string, string> = {
  "platform-basics": "tutorial-rookie-badge",
  ...Object.fromEntries(flattenGameTiers().map(t => [t.id, t.badgeId])),
};

/**
 * Pseudo-tutorials that aren't part of the canonical/active set but still
 * grant a reward (currently just `training-master`). These can be completed
 * server-side as a side-effect of completing every other training.
 */
const PSEUDO_TUTORIAL_IDS = new Set<string>([TRAINING_MASTER_ID]);

export async function getTutorialProgress(userId: string) {
  return db.select().from(tutorialProgress).where(eq(tutorialProgress.userId, userId));
}

/**
 * Aggregate unlock + progress state for the Tutorial Hub.
 */
export async function getTutorialStatus(userId: string) {
  const [progress, scores] = await Promise.all([
    getTutorialProgress(userId),
    getDrillScores(userId),
  ]);
  const completedSet = new Set<string>(
    progress.filter(p => p.status === "completed").map(p => p.tutorialId),
  );
  const { unlocked, current } = computeUnlockStateFromCompleted(completedSet);
  return {
    canonicalOrder: Array.from(CANONICAL_TUTORIAL_ORDER),
    active: Array.from(ACTIVE_TUTORIAL_IDS),
    completed: Array.from(completedSet),
    unlocked,
    current,
    progress,
    drillScores: scores,
  };
}

/** All drill PBs for a user, keyed implicitly by (userId, tutorialId). */
export async function getDrillScores(userId: string): Promise<DrillScoreRow[]> {
  return db.select().from(drillScores).where(eq(drillScores.userId, userId));
}

export interface RecordDrillScoreInput {
  tutorialId: string;
  drillKind: string;
  metric: string;
  higherIsBetter: boolean;
  score: number;
}

export interface RecordDrillScoreResult {
  row: DrillScoreRow;
  isNewBest: boolean;
}

/**
 * Upsert a drill score and keep the running personal best. The PB only moves
 * when the new score beats it (direction depends on the drill's metric); the
 * last score and attempt counter always update.
 */
export async function recordDrillScore(
  userId: string,
  input: RecordDrillScoreInput,
): Promise<RecordDrillScoreResult> {
  const { tutorialId, drillKind, metric, higherIsBetter, score } = input;
  if (!Number.isFinite(score)) {
    throw new Error("score must be a finite number");
  }
  if (!tutorialId || !drillKind || !metric) {
    throw new Error("tutorialId, drillKind, metric required");
  }
  const better = higherIsBetter
    ? sql`GREATEST(${drillScores.bestScore}, EXCLUDED.best_score)`
    : sql`LEAST(${drillScores.bestScore}, EXCLUDED.best_score)`;
  const [row] = await db
    .insert(drillScores)
    .values({
      userId,
      tutorialId,
      drillKind,
      metric,
      higherIsBetter,
      bestScore: score,
      lastScore: score,
      attempts: 1,
    })
    .onConflictDoUpdate({
      target: [drillScores.userId, drillScores.tutorialId],
      set: {
        bestScore: better,
        lastScore: sql`EXCLUDED.last_score`,
        attempts: sql`${drillScores.attempts} + 1`,
        // Drills can evolve metric/direction over time; trust the latest.
        drillKind: sql`EXCLUDED.drill_kind`,
        metric: sql`EXCLUDED.metric`,
        higherIsBetter: sql`EXCLUDED.higher_is_better`,
        updatedAt: new Date(),
      },
    })
    .returning();
  const isNewBest = higherIsBetter
    ? row.bestScore === score
    : row.bestScore === score;
  return { row, isNewBest };
}

/**
 * Top-N drill scores across all users for a given tutorial. Useful for the
 * optional leaderboard widget on the Training Hub.
 */
export async function getDrillLeaderboard(tutorialId: string, limit = 10) {
  const direction = await db
    .select({ higherIsBetter: drillScores.higherIsBetter })
    .from(drillScores)
    .where(eq(drillScores.tutorialId, tutorialId))
    .limit(1);
  if (direction.length === 0) return [] as Array<{ userId: string; bestScore: number; metric: string }>;
  const higherIsBetter = direction[0].higherIsBetter;
  const orderClause = higherIsBetter ? desc(drillScores.bestScore) : drillScores.bestScore;
  const rows = await db
    .select({
      userId: drillScores.userId,
      bestScore: drillScores.bestScore,
      metric: drillScores.metric,
    })
    .from(drillScores)
    .where(eq(drillScores.tutorialId, tutorialId))
    .orderBy(orderClause)
    .limit(limit);
  return rows;
}

/**
 * Returns true iff the user has completed every active tutorial that comes
 * strictly before `tutorialId` in the canonical sequence. Coming-soon items
 * (not in ACTIVE_TUTORIAL_IDS) are skipped because they have no completion
 * event to gate on.
 */
async function userHasUnlocked(userId: string, tutorialId: string): Promise<boolean> {
  if (!isActiveTutorial(tutorialId)) return false;
  const idx = canonicalIndex(tutorialId);
  if (idx < 0) return false;
  if (idx === 0) return true;
  const completed = await db
    .select({ tutorialId: tutorialProgress.tutorialId })
    .from(tutorialProgress)
    .where(
      and(
        eq(tutorialProgress.userId, userId),
        eq(tutorialProgress.status, "completed"),
      ),
    );
  const completedSet = new Set(completed.map(r => r.tutorialId));
  // Walk backwards to the previous active training; must be completed.
  for (let i = idx - 1; i >= 0; i--) {
    const prev = CANONICAL_TUTORIAL_ORDER[i];
    if (!ACTIVE_TUTORIAL_IDS.has(prev)) continue;
    return completedSet.has(prev);
  }
  // No prior active training → effectively first; unlocked.
  return true;
}

/**
 * Race-safe upsert of step progress. Never regresses currentStep, never
 * regresses completion status. Rejects locked trainings to prevent users
 * from bootstrapping progress on a tutorial whose predecessor isn't done.
 */
export async function saveStepProgress(
  userId: string,
  tutorialId: string,
  currentStep: number,
  totalSteps: number,
) {
  if (!isActiveTutorial(tutorialId)) {
    throw new Error(`Tutorial '${tutorialId}' is not active`);
  }
  if (currentStep < 0 || totalSteps < 1 || currentStep > totalSteps) {
    throw new Error("Invalid step values");
  }
  if (!(await userHasUnlocked(userId, tutorialId))) {
    const err = new Error("Tutorial is locked — complete the previous training first.");
    (err as any).code = "TUTORIAL_LOCKED";
    throw err;
  }

  // Single-statement upsert avoids read-then-insert races.
  const [row] = await db
    .insert(tutorialProgress)
    .values({
      userId,
      tutorialId,
      currentStep,
      totalSteps,
      status: "in_progress",
    })
    .onConflictDoUpdate({
      target: [tutorialProgress.userId, tutorialProgress.tutorialId],
      set: {
        // Never regress step counter; preserve completed state.
        currentStep: sql`GREATEST(${tutorialProgress.currentStep}, EXCLUDED.current_step)`,
        totalSteps: sql`GREATEST(${tutorialProgress.totalSteps}, EXCLUDED.total_steps)`,
        status: sql`CASE WHEN ${tutorialProgress.status} = 'completed' THEN 'completed' ELSE 'in_progress' END`,
      },
    })
    .returning();
  return row;
}

interface GrantedRewards {
  itemIds: string[];
  xp: number;
  coins: number;
}

/**
 * Atomically credit a single tutorial's reward (badge + XP + coins) using
 * the shared TRAINING_REWARDS map as the source of truth. Idempotent — the
 * tutorialProgress.rewardGranted flag guards against double-pay.
 *
 * Returns the rewards actually granted (empty/zero if already paid out).
 */
async function grantRewardForTutorial(
  tx: any,
  userId: string,
  tutorialId: string,
  badgeItemIds: string[],
): Promise<GrantedRewards> {
  const reward = getTrainingReward(tutorialId);
  const grantedItemIds: string[] = [];

  for (const itemId of badgeItemIds) {
    const inserted = await tx
      .insert(userInventory)
      .values({ userId, itemId })
      .onConflictDoNothing({ target: [userInventory.userId, userInventory.itemId] })
      .returning({ itemId: userInventory.itemId });
    if (inserted.length > 0) grantedItemIds.push(itemId);
  }

  if (reward.xp > 0 || reward.coins > 0) {
    await tx
      .update(users)
      .set({
        xp: sql`${users.xp} + ${reward.xp}`,
        coinsBalance: sql`${users.coinsBalance} + ${reward.coins}`,
      })
      .where(eq(users.id, userId));
  }

  return { itemIds: grantedItemIds, xp: reward.xp, coins: reward.coins };
}

/**
 * Returns true if every active canonical tutorial has been completed by the
 * user inside the given transaction. Used to decide whether the
 * `training-master` capstone should auto-fire.
 */
async function hasCompletedAllActive(tx: any, userId: string): Promise<boolean> {
  const rows = await tx
    .select({ tutorialId: tutorialProgress.tutorialId })
    .from(tutorialProgress)
    .where(
      and(
        eq(tutorialProgress.userId, userId),
        eq(tutorialProgress.status, "completed"),
      ),
    );
  const completed = new Set<string>(rows.map((r: any) => r.tutorialId));
  for (const id of Array.from(ACTIVE_TUTORIAL_IDS)) {
    if (!completed.has(id)) return false;
  }
  return true;
}

/**
 * Auto-fires the `training-master` capstone reward (mythic badge + profile
 * border + bonus XP/coins) the first time all active trainings are complete.
 * Idempotent — once tutorialProgress has the row in `completed` status it
 * won't pay out again.
 */
async function tryGrantTrainingMaster(
  tx: any,
  userId: string,
): Promise<GrantedRewards | null> {
  if (!(await hasCompletedAllActive(tx, userId))) return null;

  // Insert the capstone row; on conflict do nothing so RETURNING is empty
  // when the row already existed. This gives us a clean "first time?" signal
  // without timestamp gymnastics, and the unique (user, tutorial) index
  // serializes concurrent /complete callers.
  const inserted = await tx
    .insert(tutorialProgress)
    .values({
      userId,
      tutorialId: TRAINING_MASTER_ID,
      status: "completed",
      currentStep: 1,
      totalSteps: 1,
      rewardGranted: true,
      completedAt: new Date(),
    })
    .onConflictDoNothing({
      target: [tutorialProgress.userId, tutorialProgress.tutorialId],
    })
    .returning();

  if (inserted.length === 0) return null; // already granted previously

  return grantRewardForTutorial(tx, userId, TRAINING_MASTER_ID, [
    TRAINING_MASTER_BADGE_ID,
    TRAINING_MASTER_BORDER_ID,
  ]);
}

export interface CompleteTutorialResult {
  rewardItemId: string | null;
  granted: boolean;
  grantedItemIds: string[];
  grantedXp: number;
  grantedCoins: number;
  masterGranted: boolean;
  masterGrantedItemIds: string[];
  masterGrantedXp: number;
  masterGrantedCoins: number;
  reason: "already_completed" | "not_eligible" | "completed" | "inactive";
  status: Awaited<ReturnType<typeof getTutorialStatus>>;
}

/**
 * Complete a tutorial and grant its mapped rewards atomically + idempotently.
 *
 * Rewards now include the badge AND the per-tutorial XP/coins from the
 * shared TRAINING_REWARDS map. Once every active training is completed, the
 * "training-master" capstone auto-fires inside the same transaction.
 */
export async function completeTutorial(
  userId: string,
  tutorialId: string,
): Promise<CompleteTutorialResult> {
  if (!isActiveTutorial(tutorialId)) {
    return {
      rewardItemId: null,
      granted: false,
      grantedItemIds: [],
      grantedXp: 0,
      grantedCoins: 0,
      masterGranted: false,
      masterGrantedItemIds: [],
      masterGrantedXp: 0,
      masterGrantedCoins: 0,
      reason: "inactive",
      status: await getTutorialStatus(userId),
    };
  }

  if (!(await userHasUnlocked(userId, tutorialId))) {
    const err = new Error("Tutorial is locked — complete the previous training first.");
    (err as any).code = "TUTORIAL_LOCKED";
    throw err;
  }

  const itemId = TUTORIAL_BADGE_MAP[tutorialId] ?? null;
  const grantedRef: { value: GrantedRewards } = { value: { itemIds: [], xp: 0, coins: 0 } };
  const masterRef: { value: GrantedRewards | null } = { value: null };
  let reason: CompleteTutorialResult["reason"] = "completed";

  await db.transaction(async (tx) => {
    // Lock or insert progress row atomically.
    const [existing] = await tx
      .insert(tutorialProgress)
      .values({
        userId,
        tutorialId,
        currentStep: 0,
        totalSteps: 0,
        status: "in_progress",
      })
      .onConflictDoUpdate({
        // No-op update so the row is locked / returned (RETURNING requires update clause)
        target: [tutorialProgress.userId, tutorialProgress.tutorialId],
        set: { tutorialId: tutorialProgress.tutorialId },
      })
      .returning();

    if (existing.status === "completed") {
      reason = "already_completed";
      return;
    }

    // Completion gate: the client must have advanced through all steps via
    // saveStepProgress before claiming. Without this any authed user could
    // POST /complete and skip the flow.
    if (existing.totalSteps < 1 || existing.currentStep < existing.totalSteps) {
      reason = "not_eligible";
      return;
    }

    await tx
      .update(tutorialProgress)
      .set({
        status: "completed",
        completedAt: new Date(),
        rewardGranted: true,
      })
      .where(eq(tutorialProgress.id, existing.id));

    grantedRef.value = await grantRewardForTutorial(
      tx,
      userId,
      tutorialId,
      itemId ? [itemId] : [],
    );

    // Check the capstone inside the same transaction so we never grant it
    // twice across racing /complete calls.
    masterRef.value = await tryGrantTrainingMaster(tx, userId);
  });

  const granted = grantedRef.value;
  const masterGranted = masterRef.value;

  // Recompute level from the new XP total so the user's level keeps up with
  // training rewards (storage.addXP owns the XP→level table). We deliberately
  // do this outside the tx — level is a derived display, never a gate.
  const totalXpGranted = granted.xp + (masterGranted?.xp ?? 0);
  if (totalXpGranted > 0) {
    try {
      const { storage } = await import("./storage");
      await storage.addXP(userId, 0); // no-op delta; addXP recomputes level from current xp
    } catch (e) {
      console.warn("[tutorial] level recompute failed:", e);
    }
  }

  // Notifications (non-critical, fire-and-forget).
  const allGrantedIds = [
    ...granted.itemIds,
    ...(masterGranted?.itemIds ?? []),
  ];
  for (const id of allGrantedIds) {
    try {
      const [item] = await db.select().from(shopItems).where(eq(shopItems.id, id));
      if (item) {
        pushNotification(userId, {
          type: "achievement",
          title: "Tutorial Reward Unlocked",
          body: `${item.name} — earned for completing a training mission.`,
          linkTo: "/tutorial",
          meta: { itemId: item.id, tutorialId },
        });
      }
    } catch { /* non-critical */ }
  }

  if (masterGranted && (masterGranted.xp > 0 || masterGranted.coins > 0)) {
    try {
      pushNotification(userId, {
        type: "achievement",
        title: "Training Master Unlocked",
        body: `You completed every training. +${masterGranted.xp} XP, +${masterGranted.coins} coins, and the Mythic badge + profile border are yours.`,
        linkTo: "/tutorial",
        meta: { tutorialId: TRAINING_MASTER_ID },
      });
    } catch { /* non-critical */ }
  }

  return {
    rewardItemId: reason === "completed" ? itemId : null,
    granted: granted.itemIds.length > 0 || granted.xp > 0 || granted.coins > 0,
    grantedItemIds: granted.itemIds,
    grantedXp: granted.xp,
    grantedCoins: granted.coins,
    masterGranted: !!masterGranted,
    masterGrantedItemIds: masterGranted?.itemIds ?? [],
    masterGrantedXp: masterGranted?.xp ?? 0,
    masterGrantedCoins: masterGranted?.coins ?? 0,
    reason,
    status: await getTutorialStatus(userId),
  };
}

export async function skipTutorial(userId: string, tutorialId: string) {
  // Skip is allowed for any tutorial id (no reward granted), but writes only
  // happen for active ones to keep the table clean.
  if (!isActiveTutorial(tutorialId)) {
    return { ok: true, skipped: false as const };
  }
  const [row] = await db
    .insert(tutorialProgress)
    .values({
      userId,
      tutorialId,
      status: "skipped",
      currentStep: 0,
      totalSteps: 0,
    })
    .onConflictDoUpdate({
      target: [tutorialProgress.userId, tutorialProgress.tutorialId],
      set: {
        // Don't clobber a completed tutorial with skipped.
        status: sql`CASE WHEN ${tutorialProgress.status} = 'completed' THEN 'completed' ELSE 'skipped' END`,
      },
    })
    .returning();
  return row;
}

export async function resetTutorial(userId: string, tutorialId?: string) {
  if (tutorialId) {
    await db
      .delete(tutorialProgress)
      .where(and(eq(tutorialProgress.userId, userId), eq(tutorialProgress.tutorialId, tutorialId)));
  } else {
    await db.delete(tutorialProgress).where(eq(tutorialProgress.userId, userId));
  }
  return { ok: true };
}

// Re-export pseudo IDs for tests/consumers.
export { TRAINING_MASTER_ID, PSEUDO_TUTORIAL_IDS };
