import { db } from "./db";
import { matches, disconnectPenalties } from "@shared/schema";
import { eq } from "drizzle-orm";
import { auditLogger } from "./auditLogger";
import { reputationService } from "./reputationService";
import { storage } from "./storage";

const RECONNECT_TIMEOUT_MS = 5 * 60 * 1000;
const COOLDOWN_MINUTES = 10;

interface ReconnectSession {
  userId: string;
  matchId: string;
  opponentId: string;
  disconnectedAt: number;
  timerId: ReturnType<typeof setTimeout>;
}

class ReconnectManager {
  private sessions = new Map<string, ReconnectSession>();

  private sessionKey(matchId: string, userId: string): string {
    return `${matchId}:${userId}`;
  }

  async onDisconnect(matchId: string, userId: string, opponentId: string): Promise<void> {
    const key = this.sessionKey(matchId, userId);
    if (this.sessions.has(key)) return;

    console.log(`[ReconnectManager] Player ${userId} disconnected from match ${matchId}. Starting forfeit timer.`);

    await db
      .update(matches)
      .set({ status: "reconnecting" })
      .where(eq(matches.id, matchId));

    const timerId = setTimeout(() => this.triggerForfeit(matchId, userId, opponentId), RECONNECT_TIMEOUT_MS);

    this.sessions.set(key, {
      userId,
      matchId,
      opponentId,
      disconnectedAt: Date.now(),
      timerId,
    });
  }

  async onReconnect(matchId: string, userId: string): Promise<boolean> {
    const key = this.sessionKey(matchId, userId);
    const session = this.sessions.get(key);
    if (!session) return false;

    clearTimeout(session.timerId);
    this.sessions.delete(key);

    await db
      .update(matches)
      .set({ status: "in-progress" })
      .where(eq(matches.id, matchId));

    const elapsed = Math.round((Date.now() - session.disconnectedAt) / 1000);
    console.log(`[ReconnectManager] Player ${userId} reconnected to match ${matchId} after ${elapsed}s`);
    return true;
  }

  private async triggerForfeit(matchId: string, userId: string, opponentId: string): Promise<void> {
    const key = this.sessionKey(matchId, userId);
    this.sessions.delete(key);

    console.log(`[ReconnectManager] Forfeit timer expired for player ${userId} in match ${matchId}`);

    try {
      const match = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
      if (!match[0] || match[0].status === "completed" || match[0].status === "cancelled") return;

      await storage.forfeitMatch(matchId, userId);

      await reputationService.apply({
        userId,
        event: "reconnect_timeout",
        reason: "Disconnect forfeit timeout",
        matchId,
      });

      const cooldownUntil = new Date(Date.now() + COOLDOWN_MINUTES * 60 * 1000);
      await db.insert(disconnectPenalties).values({
        userId,
        matchId,
        reason: "timeout",
        reputationLost: 5,
        cooldownUntil,
      });

      await auditLogger.logReconnectForfeit(userId, matchId, {
        opponentId,
        timeoutMs: RECONNECT_TIMEOUT_MS,
      });

      const { pushNotification } = await import("./notificationStore");
      pushNotification(opponentId, {
        type: "opponent_forfeited",
        title: "Opponent timed out!",
        body: "Your opponent failed to reconnect. You win by default.",
        linkTo: `/game/${matchId}`,
      });
      pushNotification(userId, {
        type: "you_forfeited",
        title: "You were forfeited",
        body: "You did not reconnect in time. Match forfeited and reputation reduced.",
        linkTo: `/game/${matchId}`,
      });
    } catch (err) {
      console.error("[ReconnectManager] Forfeit trigger failed:", err);
    }
  }

  cancelIfActive(matchId: string, userId: string): void {
    const key = this.sessionKey(matchId, userId);
    const session = this.sessions.get(key);
    if (session) {
      clearTimeout(session.timerId);
      this.sessions.delete(key);
    }
  }

  isDisconnected(matchId: string, userId: string): boolean {
    return this.sessions.has(this.sessionKey(matchId, userId));
  }

  getTimeRemaining(matchId: string, userId: string): number {
    const session = this.sessions.get(this.sessionKey(matchId, userId));
    if (!session) return 0;
    const elapsed = Date.now() - session.disconnectedAt;
    return Math.max(0, RECONNECT_TIMEOUT_MS - elapsed);
  }

  activeSessions(): Array<{ matchId: string; userId: string; timeRemaining: number }> {
    return Array.from(this.sessions.values()).map((s) => ({
      matchId: s.matchId,
      userId: s.userId,
      timeRemaining: Math.max(0, RECONNECT_TIMEOUT_MS - (Date.now() - s.disconnectedAt)),
    }));
  }

  async getDisconnectHistory(userId: string, limit = 10): Promise<typeof disconnectPenalties.$inferSelect[]> {
    const { desc } = await import("drizzle-orm");
    return db
      .select()
      .from(disconnectPenalties)
      .where(eq(disconnectPenalties.userId, userId))
      .orderBy(desc(disconnectPenalties.createdAt))
      .limit(limit);
  }
}

export const reconnectManager = new ReconnectManager();
