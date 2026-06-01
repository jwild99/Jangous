import { auditLogger } from "./auditLogger";
import { reputationService } from "./reputationService";

export type AntiCheatSeverity = "low" | "medium" | "high" | "critical";

export interface AntiCheatEvent {
  userId: string;
  matchId: string;
  type: string;
  severity: AntiCheatSeverity;
  details: Record<string, unknown>;
}

interface ActionRecord {
  timestamps: number[];
  suspicionScore: number;
}

class AntiCheat {
  private actionMap = new Map<string, ActionRecord>();
  private flaggedMatches = new Set<string>();

  private key(userId: string, matchId: string): string {
    return `${matchId}:${userId}`;
  }

  private getRecord(userId: string, matchId: string): ActionRecord {
    const k = this.key(userId, matchId);
    if (!this.actionMap.has(k)) {
      this.actionMap.set(k, { timestamps: [], suspicionScore: 0 });
    }
    return this.actionMap.get(k)!;
  }

  recordAction(userId: string, matchId: string): void {
    const record = this.getRecord(userId, matchId);
    const now = Date.now();
    record.timestamps.push(now);
    const cutoff = now - 5000;
    record.timestamps = record.timestamps.filter((t) => t > cutoff);
  }

  checkRateAbuse(userId: string, matchId: string, maxPerWindow: number): boolean {
    const record = this.getRecord(userId, matchId);
    const now = Date.now();
    const cutoff = now - 5000;
    const recent = record.timestamps.filter((t) => t > cutoff);
    if (recent.length > maxPerWindow) {
      record.suspicionScore += 10;
      return true;
    }
    return false;
  }

  validateMove(gameType: string, action: unknown, gameState: unknown): { valid: boolean; reason?: string } {
    if (!action || typeof action !== "object") {
      return { valid: false, reason: "Malformed action payload" };
    }

    switch (gameType) {
      case "chess":
        return this.validateChessMove(action as Record<string, unknown>, gameState as Record<string, unknown>);
      case "connect-4":
        return this.validateConnect4Move(action as Record<string, unknown>, gameState as Record<string, unknown>);
      case "dots-and-boxes":
        return this.validateDotsMove(action as Record<string, unknown>, gameState as Record<string, unknown>);
      default:
        return { valid: true };
    }
  }

  private validateChessMove(action: Record<string, unknown>, state: Record<string, unknown>): { valid: boolean; reason?: string } {
    const from = action.from as number[] | undefined;
    const to = action.to as number[] | undefined;
    if (!from || !to || from.length !== 2 || to.length !== 2) {
      return { valid: false, reason: "Invalid chess move coordinates" };
    }
    if (from.some((v) => v < 0 || v > 7) || to.some((v) => v < 0 || v > 7)) {
      return { valid: false, reason: "Chess coordinates out of bounds" };
    }
    return { valid: true };
  }

  private validateConnect4Move(action: Record<string, unknown>, state: Record<string, unknown>): { valid: boolean; reason?: string } {
    const col = action.column as number | undefined;
    if (col === undefined || col < 0 || col > 6) {
      return { valid: false, reason: "Invalid Connect-4 column" };
    }
    const board = (state as any)?.board as (string | null)[][] | undefined;
    if (board && board[0][col] !== null) {
      return { valid: false, reason: "Connect-4 column is full" };
    }
    return { valid: true };
  }

  private validateDotsMove(action: Record<string, unknown>, state: Record<string, unknown>): { valid: boolean; reason?: string } {
    if (action.row === undefined || action.col === undefined || action.direction === undefined) {
      return { valid: false, reason: "Invalid dots-and-boxes action" };
    }
    return { valid: true };
  }

  async flag(event: AntiCheatEvent): Promise<void> {
    const record = this.getRecord(event.userId, event.matchId);
    const increment = { low: 5, medium: 15, high: 30, critical: 60 }[event.severity];
    record.suspicionScore += increment;

    console.warn(`[AntiCheat] FLAGGED user=${event.userId} match=${event.matchId} type=${event.type} score=${record.suspicionScore}`);

    auditLogger.logAntiCheatFlag(event.userId, event.matchId, {
      type: event.type,
      severity: event.severity,
      suspicionScore: record.suspicionScore,
      ...event.details,
    }).catch(() => {});

    if (record.suspicionScore >= 60 && !this.flaggedMatches.has(event.matchId)) {
      this.flaggedMatches.add(event.matchId);
      console.error(`[AntiCheat] CRITICAL: Match ${event.matchId} flagged for review. Player ${event.userId} score: ${record.suspicionScore}`);

      if (event.severity === "critical") {
        reputationService.apply({
          userId: event.userId,
          event: "anti_cheat_flag",
          reason: `Anti-cheat critical: ${event.type}`,
          matchId: event.matchId,
        }).catch(() => {});
      }
    }
  }

  getSuspicionScore(userId: string, matchId: string): number {
    return this.getRecord(userId, matchId).suspicionScore;
  }

  isMatchFlagged(matchId: string): boolean {
    return this.flaggedMatches.has(matchId);
  }

  clearSession(userId: string, matchId: string): void {
    this.actionMap.delete(this.key(userId, matchId));
  }
}

export const antiCheat = new AntiCheat();
