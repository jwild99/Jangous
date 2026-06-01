import { db } from "./db";
import { users, transactions, matches } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { auditLogger } from "./auditLogger";

export interface WagerResult {
  matchId: string;
  winnerId: string;
  loserId: string;
  pot: number;
  rake: number;
  winnings: number;
}

export interface RefundResult {
  matchId: string;
  refundedPlayers: string[];
  amountEach: number;
}

const RAKE_RATE = 0.03;

class WagerEngine {
  private readonly settlementLocks = new Set<string>();

  private async lockMatch(matchId: string): Promise<boolean> {
    if (this.settlementLocks.has(matchId)) return false;
    this.settlementLocks.add(matchId);
    return true;
  }

  private releaseMatch(matchId: string): void {
    this.settlementLocks.delete(matchId);
  }

  async settle(matchId: string, winnerId: string): Promise<WagerResult | null> {
    if (!await this.lockMatch(matchId)) {
      console.warn(`[WagerEngine] Match ${matchId} already settling — duplicate suppressed`);
      return null;
    }

    try {
      return await db.transaction(async (tx) => {
        const [match] = await tx
          .select()
          .from(matches)
          .where(eq(matches.id, matchId))
          .for("update");

        if (!match) throw new Error("Match not found");
        if (match.status === "completed") {
          console.warn(`[WagerEngine] Match ${matchId} already completed — skipping`);
          return null;
        }

        const pot = parseFloat(match.potAmount ?? "0");
        if (pot <= 0) return null;

        const rake = parseFloat((pot * RAKE_RATE).toFixed(2));
        const winnings = parseFloat((pot - rake).toFixed(2));

        const [winner] = await tx
          .select()
          .from(users)
          .where(eq(users.id, winnerId))
          .for("update");

        if (!winner) throw new Error("Winner not found");

        const balanceBefore = parseFloat(winner.balance ?? "0");
        const balanceAfter = parseFloat((balanceBefore + winnings).toFixed(2));

        await tx
          .update(users)
          .set({ balance: balanceAfter.toFixed(2) })
          .where(eq(users.id, winnerId));

        await tx.insert(transactions).values({
          userId: winnerId,
          type: "bet_won",
          amount: winnings.toFixed(2),
          balanceBefore: balanceBefore.toFixed(2),
          balanceAfter: balanceAfter.toFixed(2),
          matchId,
          description: `Won ${match.gameType} match (rake: ${rake.toFixed(2)})`,
        });

        await tx
          .update(matches)
          .set({ rakeAmount: rake.toFixed(2) })
          .where(eq(matches.id, matchId));

        const loserId = match.player1Id === winnerId ? (match.player2Id ?? "") : match.player1Id;

        auditLogger.logMatchComplete(winnerId, matchId, {
          winnerId,
          loserId,
          pot,
          rake,
          winnings,
        }).catch(() => {});

        return { matchId, winnerId, loserId, pot, rake, winnings };
      });
    } finally {
      this.releaseMatch(matchId);
    }
  }

  async refund(matchId: string, reason: string): Promise<RefundResult | null> {
    if (!await this.lockMatch(matchId)) {
      console.warn(`[WagerEngine] Match ${matchId} refund already in progress`);
      return null;
    }

    try {
      return await db.transaction(async (tx) => {
        const [match] = await tx
          .select()
          .from(matches)
          .where(eq(matches.id, matchId))
          .for("update");

        if (!match) throw new Error("Match not found");
        if (match.status === "completed") return null;

        const pot = parseFloat(match.potAmount ?? "0");
        if (pot <= 0) return { matchId, refundedPlayers: [], amountEach: 0 };

        const playerIds = [match.player1Id, match.player2Id].filter(Boolean) as string[];
        const amountEach = parseFloat((pot / playerIds.length).toFixed(2));

        for (const playerId of playerIds) {
          const [player] = await tx
            .select()
            .from(users)
            .where(eq(users.id, playerId))
            .for("update");

          if (!player) continue;

          const balanceBefore = parseFloat(player.balance ?? "0");
          const balanceAfter = parseFloat((balanceBefore + amountEach).toFixed(2));

          await tx
            .update(users)
            .set({ balance: balanceAfter.toFixed(2) })
            .where(eq(users.id, playerId));

          await tx.insert(transactions).values({
            userId: playerId,
            type: "bet_lost",
            amount: amountEach.toFixed(2),
            balanceBefore: balanceBefore.toFixed(2),
            balanceAfter: balanceAfter.toFixed(2),
            matchId,
            description: `Match refund: ${reason}`,
          });
        }

        return { matchId, refundedPlayers: playerIds, amountEach };
      });
    } finally {
      this.releaseMatch(matchId);
    }
  }

  calculateRake(pot: number): { rake: number; winnings: number } {
    const rake = parseFloat((pot * RAKE_RATE).toFixed(2));
    const winnings = parseFloat((pot - rake).toFixed(2));
    return { rake, winnings };
  }

  isLocked(matchId: string): boolean {
    return this.settlementLocks.has(matchId);
  }
}

export const wagerEngine = new WagerEngine();
