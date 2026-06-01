// ─── Haptic Manager ───────────────────────────────────────────────────────────
// Uses navigator.vibrate() where supported. Gracefully no-ops on desktop.

class HapticManager {
  private enabled: boolean = true;

  constructor() {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("hapticEnabled");
    this.enabled = saved !== "false";
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    if (typeof window !== "undefined") localStorage.setItem("hapticEnabled", String(v));
  }
  isEnabled() { return this.enabled; }

  private vibrate(pattern: number | number[]) {
    if (!this.enabled) return;
    if (typeof window === "undefined" || !navigator.vibrate) return;
    try { navigator.vibrate(pattern); } catch {}
  }

  // ── Patterns ──────────────────────────────────────────────────────────────

  /** Light tap — button clicks, hovers */
  light()      { this.vibrate(10); }

  /** Alias for light — named for clarity in Feedback.ts */
  tap()        { this.light(); }

  /** Medium — confirms, moves, match actions */
  medium()     { this.vibrate(25); }

  /** Strong — errors, warnings */
  strong()     { this.vibrate(50); }

  /** Success pattern — wins, completions */
  success()    { this.vibrate([20, 30, 20]); }

  /** Error pattern — clear, not too harsh */
  error()      { this.vibrate([50, 30, 50]); }

  /** Warning — moderate alert */
  warning()    { this.vibrate([40, 20, 40]); }

  /** Match start — urgent triple */
  matchStart() { this.vibrate([30, 20, 30, 20, 60]); }

  /** Tournament win — full celebration */
  tournamentWin() { this.vibrate([40, 30, 40, 30, 80, 40, 80]); }

  /** Balance increase — soft reward pulse */
  balancePulse() { this.vibrate([15, 20, 15]); }

  /** Shop purchase — satisfying medium pulse */
  shopPurchase() { this.vibrate([20, 30, 20, 30, 20]); }

  /** Rank up — ascending feel */
  rankUp()     { this.vibrate([20, 10, 30, 10, 50]); }

  /** Streak — quick celebration */
  streak()     { this.vibrate([15, 15, 30]); }

  /** Ball hit */
  ballHit()    { this.vibrate([15, 30, 15]); }

  /** Piece move */
  pieceMove()  { this.vibrate([20, 40, 15]); }

  /** Notification */
  notification() { this.vibrate([30, 50, 30]); }
}

export const hapticManager = new HapticManager();
