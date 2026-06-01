import { db } from "./db";
import { users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { auditLogger } from "./auditLogger";

export type ReputationEvent =
  | "win"
  | "loss"
  | "forfeit"
  | "reconnect_timeout"
  | "report_upheld"
  | "report_false"
  | "daily_login"
  | "long_streak"
  | "good_conduct"
  | "anti_cheat_flag"
  | "admin_restore"
  | "admin_penalize";

const REPUTATION_DELTAS: Record<ReputationEvent, number> = {
  win: 2,
  loss: -1,
  forfeit: -8,
  reconnect_timeout: -5,
  report_upheld: -10,
  report_false: 1,
  daily_login: 1,
  long_streak: 3,
  good_conduct: 5,
  anti_cheat_flag: -20,
  admin_restore: 0,
  admin_penalize: 0,
};

export interface ReputationUpdate {
  userId: string;
  event: ReputationEvent;
  delta?: number;
  reason?: string;
  actorId?: string;
  matchId?: string;
}

class ReputationService {
  async apply(update: ReputationUpdate): Promise<{ before: number; after: number }> {
    const delta = update.delta ?? REPUTATION_DELTAS[update.event];

    const [user] = await db.select({ reputation: users.reputation }).from(users).where(eq(users.id, update.userId));
    const before = user?.reputation ?? 50;
    const raw = before + delta;
    const after = Math.min(100, Math.max(0, raw));

    if (after !== before) {
      await db
        .update(users)
        .set({ reputation: after })
        .where(eq(users.id, update.userId));
    }

    auditLogger.logReputationChange(update.userId, {
      event: update.event,
      delta,
      before,
      after,
      reason: update.reason ?? null,
      matchId: update.matchId ?? null,
    }).catch(() => {});

    return { before, after };
  }

  async applyBulk(updates: ReputationUpdate[]): Promise<void> {
    await Promise.all(updates.map((u) => this.apply(u)));
  }

  async getScore(userId: string): Promise<number> {
    const [user] = await db.select({ reputation: users.reputation }).from(users).where(eq(users.id, userId));
    return user?.reputation ?? 50;
  }

  async adminSet(adminId: string, targetId: string, score: number, reason: string): Promise<void> {
    const clamped = Math.min(100, Math.max(0, score));
    await db.update(users).set({ reputation: clamped }).where(eq(users.id, targetId));
    auditLogger.logAdminAction(adminId, targetId, { action: "reputation_set", score: clamped, reason }).catch(() => {});
  }

  getLabel(score: number): string {
    if (score >= 90) return "Exemplary";
    if (score >= 75) return "Trustworthy";
    if (score >= 55) return "Good Standing";
    if (score >= 40) return "Fair";
    if (score >= 25) return "Questionable";
    return "Poor";
  }

  getColor(score: number): string {
    if (score >= 75) return "text-green-400";
    if (score >= 50) return "text-blue-400";
    if (score >= 30) return "text-yellow-400";
    return "text-red-400";
  }
}

export const reputationService = new ReputationService();
