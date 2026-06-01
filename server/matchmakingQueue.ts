import { db } from "./db";
import { matchmakingQueue, users, type GameType } from "@shared/schema";
import { eq, and, lte, gte, sql } from "drizzle-orm";

const QUEUE_TTL_MINUTES = 10;
const INITIAL_RADIUS = 100;
const MAX_RADIUS = 600;
const RADIUS_EXPAND_RATE = 50;
const EXPAND_INTERVAL_MS = 15_000;

export interface QueueEntry {
  userId: string;
  gameType: GameType;
  betAmount: string;
  mmr: number;
  deviceType?: string;
}

export interface MatchResult {
  player1Id: string;
  player2Id: string;
  gameType: GameType;
  betAmount: string;
}

class MatchmakingQueue {
  private expandTimers = new Map<string, ReturnType<typeof setInterval>>();

  async enqueue(entry: QueueEntry): Promise<string> {
    await this.dequeue(entry.userId);

    const expiresAt = new Date(Date.now() + QUEUE_TTL_MINUTES * 60 * 1000);

    const [row] = await db
      .insert(matchmakingQueue)
      .values({
        userId: entry.userId,
        gameType: entry.gameType,
        betAmount: entry.betAmount,
        mmr: entry.mmr,
        searchRadius: INITIAL_RADIUS,
        deviceType: entry.deviceType ?? "desktop",
        expiresAt,
      })
      .returning();

    this.startRadiusExpansion(row.id, entry.userId);
    return row.id;
  }

  async dequeue(userId: string): Promise<void> {
    const existing = await db
      .select({ id: matchmakingQueue.id })
      .from(matchmakingQueue)
      .where(eq(matchmakingQueue.userId, userId));

    for (const row of existing) {
      this.stopRadiusExpansion(row.id);
    }

    await db.delete(matchmakingQueue).where(eq(matchmakingQueue.userId, userId));
  }

  async findMatch(entry: QueueEntry): Promise<MatchResult | null> {
    const [myEntry] = await db
      .select()
      .from(matchmakingQueue)
      .where(eq(matchmakingQueue.userId, entry.userId));

    const radius = myEntry?.searchRadius ?? INITIAL_RADIUS;
    const now = new Date();

    const candidates = await db
      .select()
      .from(matchmakingQueue)
      .where(
        and(
          sql`${matchmakingQueue.userId} != ${entry.userId}`,
          eq(matchmakingQueue.gameType, entry.gameType),
          eq(matchmakingQueue.betAmount, entry.betAmount),
          gte(matchmakingQueue.mmr, entry.mmr - radius),
          lte(matchmakingQueue.mmr, entry.mmr + radius),
          gte(matchmakingQueue.expiresAt, now),
        )
      )
      .orderBy(
        sql`ABS(${matchmakingQueue.mmr} - ${entry.mmr})`
      )
      .limit(1);

    if (!candidates.length) return null;

    const opponent = candidates[0];

    await this.dequeue(entry.userId);
    await this.dequeue(opponent.userId);

    return {
      player1Id: entry.userId,
      player2Id: opponent.userId,
      gameType: entry.gameType as GameType,
      betAmount: entry.betAmount,
    };
  }

  async getStatus(userId: string): Promise<{
    inQueue: boolean;
    position?: number;
    waitTime?: number;
    searchRadius?: number;
  }> {
    const [row] = await db
      .select()
      .from(matchmakingQueue)
      .where(eq(matchmakingQueue.userId, userId));

    if (!row) return { inQueue: false };

    const waitMs = Date.now() - new Date(row.joinedAt).getTime();

    const allAhead = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(matchmakingQueue)
      .where(
        and(
          eq(matchmakingQueue.gameType, row.gameType),
          eq(matchmakingQueue.betAmount, row.betAmount),
          lte(matchmakingQueue.joinedAt, row.joinedAt),
          sql`${matchmakingQueue.userId} != ${userId}`,
        )
      );

    return {
      inQueue: true,
      position: Number(allAhead[0]?.count ?? 0) + 1,
      waitTime: Math.round(waitMs / 1000),
      searchRadius: row.searchRadius,
    };
  }

  async purgeExpired(): Promise<number> {
    const result = await db
      .delete(matchmakingQueue)
      .where(lte(matchmakingQueue.expiresAt, new Date()))
      .returning({ id: matchmakingQueue.id });

    return result.length;
  }

  async getQueueDepth(gameType?: string): Promise<number> {
    const conditions = gameType
      ? and(eq(matchmakingQueue.gameType, gameType), gte(matchmakingQueue.expiresAt, new Date()))
      : gte(matchmakingQueue.expiresAt, new Date());

    const [row] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(matchmakingQueue)
      .where(conditions);

    return Number(row?.count ?? 0);
  }

  private startRadiusExpansion(entryId: string, userId: string): void {
    const timer = setInterval(async () => {
      try {
        const [row] = await db
          .select({ searchRadius: matchmakingQueue.searchRadius })
          .from(matchmakingQueue)
          .where(eq(matchmakingQueue.id, entryId));

        if (!row) {
          this.stopRadiusExpansion(entryId);
          return;
        }

        const newRadius = Math.min(row.searchRadius + RADIUS_EXPAND_RATE, MAX_RADIUS);
        await db
          .update(matchmakingQueue)
          .set({ searchRadius: newRadius })
          .where(eq(matchmakingQueue.id, entryId));
      } catch {
        this.stopRadiusExpansion(entryId);
      }
    }, EXPAND_INTERVAL_MS);

    this.expandTimers.set(entryId, timer);
  }

  private stopRadiusExpansion(entryId: string): void {
    const timer = this.expandTimers.get(entryId);
    if (timer) {
      clearInterval(timer);
      this.expandTimers.delete(entryId);
    }
  }
}

export const matchmakingQueueService = new MatchmakingQueue();

setInterval(() => {
  matchmakingQueueService.purgeExpired().catch(() => {});
}, 60_000);
