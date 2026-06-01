import { db } from "./db";
import { auditLogs, type AuditLogAction } from "@shared/schema";

export type AuditSeverity = "info" | "warn" | "critical";

export interface AuditEntry {
  actorId?: string | null;
  targetId?: string | null;
  matchId?: string | null;
  action: AuditLogAction | string;
  severity?: AuditSeverity;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}

class AuditLogger {
  async log(entry: AuditEntry): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        actorId: entry.actorId ?? null,
        targetId: entry.targetId ?? null,
        matchId: entry.matchId ?? null,
        action: entry.action,
        severity: entry.severity ?? "info",
        details: entry.details ?? null,
        ipAddress: entry.ipAddress ?? null,
      });
    } catch (err) {
      console.error("[AuditLogger] Failed to write audit log:", err);
    }
  }

  async logMatchComplete(actorId: string, matchId: string, details: Record<string, unknown>): Promise<void> {
    await this.log({ actorId, matchId, action: "match_complete", severity: "info", details });
  }

  async logMatchForfeit(actorId: string, matchId: string, details: Record<string, unknown>): Promise<void> {
    await this.log({ actorId, matchId, action: "match_forfeit", severity: "warn", details });
  }

  async logMatchDispute(actorId: string, matchId: string, details: Record<string, unknown>): Promise<void> {
    await this.log({ actorId, matchId, action: "match_dispute", severity: "warn", details });
  }

  async logWalletDeposit(actorId: string, details: Record<string, unknown>): Promise<void> {
    await this.log({ actorId, action: "wallet_deposit", severity: "info", details });
  }

  async logWalletAdjust(actorId: string, targetId: string, details: Record<string, unknown>): Promise<void> {
    await this.log({ actorId, targetId, action: "wallet_adjust", severity: "critical", details });
  }

  async logBan(actorId: string, targetId: string, details: Record<string, unknown>): Promise<void> {
    await this.log({ actorId, targetId, action: "ban_user", severity: "critical", details });
  }

  async logUnban(actorId: string, targetId: string, details: Record<string, unknown>): Promise<void> {
    await this.log({ actorId, targetId, action: "unban_user", severity: "warn", details });
  }

  async logReputationChange(targetId: string, details: Record<string, unknown>): Promise<void> {
    await this.log({ targetId, action: "reputation_change", severity: "info", details });
  }

  async logAdminAction(actorId: string, targetId: string | null, details: Record<string, unknown>): Promise<void> {
    await this.log({ actorId, targetId, action: "admin_action", severity: "warn", details });
  }

  async logSecurityFlag(targetId: string, matchId: string | null, details: Record<string, unknown>): Promise<void> {
    await this.log({ targetId, matchId, action: "security_flag", severity: "critical", details });
  }

  async logReconnectForfeit(targetId: string, matchId: string, details: Record<string, unknown>): Promise<void> {
    await this.log({ targetId, matchId, action: "reconnect_timeout_forfeit", severity: "warn", details });
  }

  async logAntiCheatFlag(targetId: string, matchId: string | null, details: Record<string, unknown>): Promise<void> {
    await this.log({ targetId, matchId, action: "anti_cheat_flag", severity: "critical", details });
  }

  async getRecentLogs(limit = 100, severity?: AuditSeverity): Promise<typeof auditLogs.$inferSelect[]> {
    try {
      const { eq, desc } = await import("drizzle-orm");
      if (severity) {
        return await db.select().from(auditLogs).where(eq(auditLogs.severity, severity)).orderBy(desc(auditLogs.createdAt)).limit(limit);
      }
      return await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
    } catch (err) {
      console.error("[AuditLogger] Failed to fetch logs:", err);
      return [];
    }
  }
}

export const auditLogger = new AuditLogger();
