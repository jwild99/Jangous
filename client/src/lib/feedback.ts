// ─── Unified Feedback System ──────────────────────────────────────────────────
// Single entry point for all sound + haptic feedback.
// Usage: Feedback.play("win")  or  Feedback.haptic("success")
//
// This ensures all feedback routes through one place so global
// enable/disable and volume control work everywhere automatically.

import { soundManager } from "./soundManager";
import { hapticManager } from "./hapticManager";

// Map of feedback event → { sound key, haptic method name }
type HapticMethod = keyof typeof hapticManager;

interface FeedbackDef {
  sound: string;
  haptic?: HapticMethod;
}

const FEEDBACK_MAP: Record<string, FeedbackDef> = {
  // ── UI ─────────────────────────────────────────────────────
  button_click:       { sound: "click",         haptic: "light" },
  hover:              { sound: "hover" },
  tab_switch:         { sound: "tab_switch",    haptic: "light" },
  modal_open:         { sound: "modal_open" },
  modal_close:        { sound: "modal_close" },
  success:            { sound: "success",       haptic: "success" },
  error:              { sound: "error",         haptic: "error" },
  warning:            { sound: "error",         haptic: "warning" },
  game_select:        { sound: "game_select",   haptic: "light" },

  // ── Match ───────────────────────────────────────────────────
  match_join:         { sound: "match_join",    haptic: "matchStart" },
  match_found:        { sound: "match_found",   haptic: "matchStart" },
  countdown:          { sound: "countdown",     haptic: "light" },
  game_start:         { sound: "game_start",    haptic: "matchStart" },
  move:               { sound: "move",          haptic: "pieceMove" },

  // ── Outcomes ────────────────────────────────────────────────
  win:                { sound: "win",           haptic: "success" },
  loss:               { sound: "loss",          haptic: "error" },
  draw:               { sound: "draw",          haptic: "medium" },
  tournament_join:    { sound: "tournament_join", haptic: "medium" },
  tournament_win:     { sound: "tournament_win",  haptic: "tournamentWin" },

  // ── Progression ─────────────────────────────────────────────
  rank_up:            { sound: "rank_up",       haptic: "rankUp" },
  rank_down:          { sound: "rank_down",     haptic: "error" },
  xp_gained:          { sound: "xp_gained",     haptic: "light" },
  streak:             { sound: "streak",        haptic: "streak" },
  reward:             { sound: "reward",        haptic: "success" },
  level_up:           { sound: "level_up",      haptic: "rankUp" },

  // ── Financial ───────────────────────────────────────────────
  balance_up:         { sound: "balance_up",    haptic: "balancePulse" },
  balance_down:       { sound: "balance_down",  haptic: "light" },
  deposit_pending:    { sound: "deposit_pending" },
  deposit_confirmed:  { sound: "deposit_confirmed", haptic: "shopPurchase" },
  withdrawal:         { sound: "success",       haptic: "medium" },

  // ── Shop ────────────────────────────────────────────────────
  shop_hover:         { sound: "hover" },
  shop_purchase:      { sound: "purchase",      haptic: "shopPurchase" },
  equip:              { sound: "equip",         haptic: "medium" },

  // ── Notifications ────────────────────────────────────────────
  notification:       { sound: "notification",  haptic: "notification" },

  // ── Tournament Flow ──────────────────────────────────────────
  advance_round:      { sound: "rank_up",       haptic: "rankUp" },
  eliminated:         { sound: "loss",          haptic: "error" },
  tournament_start:   { sound: "game_start",    haptic: "matchStart" },
  bracket_reveal:     { sound: "modal_open",    haptic: "medium" },

  // ── Match Confirm ────────────────────────────────────────────
  match_confirm:      { sound: "match_join",    haptic: "matchStart" },
  run_it_back:        { sound: "match_join",    haptic: "matchStart" },
  double_or_nothing:  { sound: "rank_up",       haptic: "streak" },
};

const Feedback = {
  /**
   * Play sound + haptic for a named event.
   * e.g. Feedback.play("win") — triggers both sound and vibration.
   */
  play(event: string) {
    const def = FEEDBACK_MAP[event];
    if (!def) {
      soundManager.play(event);
      return;
    }
    soundManager.play(def.sound);
    if (def.haptic) {
      const fn = (hapticManager as any)[def.haptic];
      if (typeof fn === "function") fn.call(hapticManager);
    }
  },

  /**
   * Trigger only the haptic for an event (no sound).
   */
  haptic(event: string) {
    const def = FEEDBACK_MAP[event];
    const method = def?.haptic;
    if (method) {
      const fn = (hapticManager as any)[method];
      if (typeof fn === "function") fn.call(hapticManager);
    }
  },

  /**
   * Trigger only the sound for an event (no haptic).
   */
  sound(event: string) {
    const def = FEEDBACK_MAP[event];
    soundManager.play(def?.sound ?? event);
  },

  // ── Convenience shorthands ────────────────────────────────────────────────
  click()          { this.play("button_click"); },
  hover()          { this.play("hover"); },
  win()            { this.play("win"); },
  loss()           { this.play("loss"); },
  draw()           { this.play("draw"); },
  error()          { this.play("error"); },
  success()        { this.play("success"); },
  tournamentWin()  { this.play("tournament_win"); },
  depositDone()    { this.play("deposit_confirmed"); },
  balanceUp()      { this.play("balance_up"); },
  balanceDown()    { this.play("balance_down"); },
  rankUp()         { this.play("rank_up"); },
  levelUp()        { this.play("level_up"); },
  reward()         { this.play("reward"); },
  streak()         { this.play("streak"); },
};

export { Feedback };
export default Feedback;
