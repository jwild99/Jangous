// ─── Sound Manager ───────────────────────────────────────────────────────────
// All audio synthesis via Web Audio API. No external files.
// Volume, enable/disable, and per-event cooldowns all managed centrally.

class SoundManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled: boolean = true;
  private volume: number = 0.5;           // 0–1
  private cooldowns: Map<string, number> = new Map();
  private readonly MIN_GAP_MS = 80;        // default minimum gap between same event

  constructor() {
    if (typeof window === "undefined") return;
    const se = localStorage.getItem("soundEnabled");
    const sv = localStorage.getItem("soundVolume");
    this.enabled = se !== "false";
    this.volume  = sv !== null ? Math.max(0, Math.min(1, parseFloat(sv))) : 0.5;
  }

  // ── Context / Master chain ───────────────────────────────────────────────
  private ctx(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain   = this.audioContext.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.audioContext.destination);
    }
    return this.audioContext;
  }

  private dest(): AudioNode {
    this.ctx();                       // ensure masterGain exists
    return this.masterGain!;
  }

  // ── Settings API ─────────────────────────────────────────────────────────
  setEnabled(v: boolean) {
    this.enabled = v;
    localStorage.setItem("soundEnabled", String(v));
  }
  isEnabled() { return this.enabled; }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    localStorage.setItem("soundVolume", String(this.volume));
    if (this.masterGain) this.masterGain.gain.value = this.volume;
  }
  getVolume() { return this.volume; }

  // ── Cooldown guard ────────────────────────────────────────────────────────
  private canPlay(key: string, gapMs = this.MIN_GAP_MS): boolean {
    const now = Date.now();
    const last = this.cooldowns.get(key) ?? 0;
    if (now - last < gapMs) return false;
    this.cooldowns.set(key, now);
    return true;
  }

  private guard(key: string, gapMs = this.MIN_GAP_MS): boolean {
    return this.enabled && this.canPlay(key, gapMs);
  }

  // ── Primitives ────────────────────────────────────────────────────────────
  private osc(
    freq: number,
    type: OscillatorType,
    startT: number,
    dur: number,
    peakGain: number,
    attackT = 0.008,
  ) {
    const ctx  = this.ctx();
    const dest = this.dest();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, startT);
    gain.gain.linearRampToValueAtTime(peakGain, startT + attackT);
    gain.gain.exponentialRampToValueAtTime(0.001, startT + dur);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(startT);
    osc.stop(startT + dur + 0.01);
  }

  // ── Unified play() dispatcher ─────────────────────────────────────────────
  // Called by Feedback.ts or legacy code. Maps string keys to methods.
  play(event: string) {
    switch (event) {
      case "click":            return this.playClick();
      case "hover":            return this.playHover();
      case "tab_switch":       return this.playTabSwitch();
      case "modal_open":       return this.playModalOpen();
      case "modal_close":      return this.playModalClose();
      case "success":          return this.playSuccess();
      case "error":            return this.playError();
      case "shop_hover":       return this.playHover();
      case "shop_purchase":    return this.playPurchase();
      case "game_select":      return this.playGameSelect();
      case "match_join":       return this.playMatchStart();
      case "tournament_join":  return this.playTournamentJoin();
      case "match_found":      return this.playMatchFound();
      case "countdown":        return this.playCountdown();
      case "game_start":       return this.playMatchStart();
      case "win":              return this.playWin();
      case "loss":             return this.playLoss();
      case "draw":             return this.playDraw();
      case "tournament_win":   return this.playTournamentWin();
      case "rank_up":          return this.playLevelUp();
      case "rank_down":        return this.playRankDown();
      case "xp_gained":        return this.playXpGained();
      case "streak":           return this.playStreak();
      case "balance_up":       return this.playBalanceUp();
      case "balance_down":     return this.playBalanceDown();
      case "deposit_pending":  return this.playDepositPending();
      case "deposit_confirmed":return this.playDepositConfirmed();
      case "reward":           return this.playReward();
      case "level_up":         return this.playLevelUp();
      case "move":             return this.playMove();
      case "notification":     return this.playNotification();
      case "purchase":         return this.playPurchase();
      case "equip":            return this.playEquip();
      default:                 return this.playClick();
    }
  }

  // ── UI sounds ─────────────────────────────────────────────────────────────

  // Very subtle 2ms noise click — futuristic, premium feel
  playClick() {
    if (!this.guard("click", 60)) return;
    try {
      const ctx  = this.ctx();
      const now  = ctx.currentTime;
      this.osc(900, "sine", now, 0.055, 0.09);
      this.osc(1400, "sine", now, 0.03, 0.03);
    } catch {}
  }

  // Ultra-subtle hover blip (very quiet, fast)
  playHover() {
    if (!this.guard("hover", 120)) return;
    try {
      const ctx = this.ctx();
      this.osc(700, "sine", ctx.currentTime, 0.03, 0.025);
    } catch {}
  }

  // Short upward blip
  playTabSwitch() {
    if (!this.guard("tab_switch", 100)) return;
    try {
      const ctx = this.ctx();
      this.osc(560, "sine", ctx.currentTime, 0.05, 0.06);
    } catch {}
  }

  // Modal open — airy soft "whoosh" (quick upward sweep)
  playModalOpen() {
    if (!this.guard("modal_open", 200)) return;
    try {
      const ctx  = this.ctx();
      const dest = this.dest();
      const now  = ctx.currentTime;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.linearRampToValueAtTime(900, now + 0.12);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain); gain.connect(dest);
      osc.start(now); osc.stop(now + 0.2);
    } catch {}
  }

  // Modal close — airy soft downward sweep
  playModalClose() {
    if (!this.guard("modal_close", 200)) return;
    try {
      const ctx  = this.ctx();
      const dest = this.dest();
      const now  = ctx.currentTime;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.linearRampToValueAtTime(350, now + 0.12);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain); gain.connect(dest);
      osc.start(now); osc.stop(now + 0.16);
    } catch {}
  }

  // Successful action — bright short confirm
  playSuccess() {
    if (!this.guard("success", 200)) return;
    try {
      const ctx = this.ctx();
      const now = ctx.currentTime;
      this.osc(660, "sine", now, 0.08, 0.1);
      this.osc(880, "sine", now + 0.06, 0.14, 0.1);
    } catch {}
  }

  // Error — low double buzz
  playError() {
    if (!this.guard("error", 300)) return;
    try {
      const ctx = this.ctx();
      const now = ctx.currentTime;
      this.osc(220, "square", now, 0.12, 0.07);
      this.osc(180, "square", now + 0.12, 0.14, 0.06);
    } catch {}
  }

  // Game select — mid ping with shimmer
  playGameSelect() {
    if (!this.guard("game_select", 120)) return;
    try {
      const ctx = this.ctx();
      const now = ctx.currentTime;
      this.osc(660, "triangle", now, 0.12, 0.09);
      this.osc(990, "sine",     now + 0.07, 0.1, 0.04);
    } catch {}
  }

  // ── Match sounds ──────────────────────────────────────────────────────────

  // Match found — dramatic rising sweep then chord (longer than matchStart)
  playMatchFound() {
    if (!this.guard("match_found", 2000)) return;
    try {
      const ctx  = this.ctx();
      const dest = this.dest();
      const now  = ctx.currentTime;
      // Rising sweep
      const sweep = ctx.createOscillator();
      const sg    = ctx.createGain();
      sweep.type  = "sine";
      sweep.frequency.setValueAtTime(300, now);
      sweep.frequency.exponentialRampToValueAtTime(900, now + 0.25);
      sg.gain.setValueAtTime(0, now);
      sg.gain.linearRampToValueAtTime(0.12, now + 0.05);
      sg.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      sweep.connect(sg); sg.connect(dest);
      sweep.start(now); sweep.stop(now + 0.36);
      // Chord stab
      [523, 659, 784].forEach((f, i) => this.osc(f, "sine", now + 0.28 + i * 0.04, 0.5, 0.12));
    } catch {}
  }

  // Match start — quick ascending 3-beep
  playMatchStart() {
    if (!this.guard("match_start", 800)) return;
    try {
      const ctx = this.ctx();
      const now = ctx.currentTime;
      [440, 550, 660].forEach((f, i) =>
        this.osc(f, "square", now + i * 0.06, 0.09, 0.07)
      );
    } catch {}
  }

  // Countdown tick
  playCountdown() {
    if (!this.guard("countdown", 200)) return;
    try {
      const ctx = this.ctx();
      this.osc(440, "triangle", ctx.currentTime, 0.09, 0.09);
    } catch {}
  }

  // Move piece
  playMove() {
    if (!this.guard("move", 80)) return;
    try {
      const ctx = this.ctx();
      this.osc(600, "square", ctx.currentTime, 0.06, 0.055);
    } catch {}
  }

  // ── Outcome sounds ────────────────────────────────────────────────────────

  // Win — bright ascending major chord, satisfying
  playWin() {
    if (!this.guard("win", 1500)) return;
    try {
      const ctx = this.ctx();
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((f, i) =>
        this.osc(f, "sine", now + i * 0.09, 0.45, 0.14)
      );
      // Sparkle overtone
      this.osc(1567.98, "sine", now + 0.24, 0.4, 0.05);
    } catch {}
  }

  // Loss — soft descending, not harsh
  playLoss() {
    if (!this.guard("loss", 1500)) return;
    try {
      const ctx = this.ctx();
      const now = ctx.currentTime;
      [392.00, 329.63, 261.63].forEach((f, i) =>
        this.osc(f, "sine", now + i * 0.11, 0.55, 0.10)
      );
    } catch {}
  }

  // Draw — neutral two-note
  playDraw() {
    if (!this.guard("draw", 1500)) return;
    try {
      const ctx = this.ctx();
      const now = ctx.currentTime;
      this.osc(440, "sine", now, 0.3, 0.09);
      this.osc(440, "sine", now + 0.18, 0.3, 0.07);
    } catch {}
  }

  // Tournament win — cinematic multi-layer fanfare
  playTournamentWin() {
    if (!this.guard("tournament_win", 5000)) return;
    try {
      const ctx  = this.ctx();
      const dest = this.dest();
      const now  = ctx.currentTime;

      // Layer 1: ascending power chord arpeggio
      [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50].forEach((f, i) =>
        this.osc(f, "sine", now + i * 0.09, 1.2, 0.16)
      );

      // Layer 2: brass-like square wave chord stab at peak
      [523.25, 659.25, 783.99].forEach((f, i) => {
        const t = now + 0.65 + i * 0.02;
        this.osc(f, "square", t, 1.0, 0.07);
      });

      // Layer 3: shimmer at very top
      [1046.50, 1318.51, 1567.98].forEach((f, i) =>
        this.osc(f, "sine", now + 0.8 + i * 0.05, 1.0, 0.04)
      );

      // Layer 4: reverb-like tail — fade notes
      [523.25, 783.99].forEach((f, i) =>
        this.osc(f, "sine", now + 1.1 + i * 0.1, 1.5, 0.06)
      );
    } catch {}
  }

  // Tournament join — cinematic short riser
  playTournamentJoin() {
    if (!this.guard("tournament_join", 1500)) return;
    try {
      const ctx  = this.ctx();
      const dest = this.dest();
      const now  = ctx.currentTime;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain); gain.connect(dest);
      osc.start(now); osc.stop(now + 0.32);
      // Chord
      [523, 659].forEach((f, i) => this.osc(f, "sine", now + 0.18 + i * 0.06, 0.35, 0.11));
    } catch {}
  }

  // ── Progression sounds ────────────────────────────────────────────────────

  // Rank down — sad two-step
  playRankDown() {
    if (!this.guard("rank_down", 2000)) return;
    try {
      const ctx = this.ctx();
      const now = ctx.currentTime;
      this.osc(330, "sine", now, 0.25, 0.1);
      this.osc(261, "sine", now + 0.2, 0.35, 0.09);
    } catch {}
  }

  // XP gained — quick sparkle
  playXpGained() {
    if (!this.guard("xp_gained", 400)) return;
    try {
      const ctx = this.ctx();
      const now = ctx.currentTime;
      this.osc(880, "sine", now, 0.08, 0.07);
      this.osc(1108, "sine", now + 0.06, 0.1, 0.05);
    } catch {}
  }

  // Streak milestone — rising 3-sparkle
  playStreak() {
    if (!this.guard("streak", 1000)) return;
    try {
      const ctx = this.ctx();
      const now = ctx.currentTime;
      [660, 880, 1100].forEach((f, i) =>
        this.osc(f, "sine", now + i * 0.07, 0.22, 0.09)
      );
    } catch {}
  }

  // ── Financial sounds ──────────────────────────────────────────────────────

  // Balance increase — bright ascending coin ping
  playBalanceUp() {
    if (!this.guard("balance_up", 500)) return;
    try {
      const ctx = this.ctx();
      const now = ctx.currentTime;
      this.osc(880, "sine",  now, 0.1, 0.10);
      this.osc(1108, "sine", now + 0.07, 0.16, 0.08);
      this.osc(1320, "sine", now + 0.14, 0.2, 0.06);
    } catch {}
  }

  // Balance decrease — soft descending
  playBalanceDown() {
    if (!this.guard("balance_down", 500)) return;
    try {
      const ctx = this.ctx();
      const now = ctx.currentTime;
      this.osc(523, "sine", now, 0.12, 0.08);
      this.osc(392, "sine", now + 0.1, 0.16, 0.07);
    } catch {}
  }

  // Deposit pending — soft blip-blip
  playDepositPending() {
    if (!this.guard("deposit_pending", 1000)) return;
    try {
      const ctx = this.ctx();
      const now = ctx.currentTime;
      this.osc(660, "sine", now, 0.08, 0.06);
      this.osc(660, "sine", now + 0.15, 0.08, 0.05);
    } catch {}
  }

  // Deposit confirmed — rewarding full coin sound with shimmer
  playDepositConfirmed() {
    if (!this.guard("deposit_confirmed", 2000)) return;
    try {
      const ctx = this.ctx();
      const now = ctx.currentTime;
      // Coin-bag cascade
      [783.99, 987.77, 1174.66, 1396.91].forEach((f, i) =>
        this.osc(f, "sine", now + i * 0.08, 0.4, 0.13)
      );
      // Shimmer tail
      this.osc(2093, "sine", now + 0.36, 0.5, 0.04);
    } catch {}
  }

  // ── Others (legacy methods kept for back-compat) ──────────────────────────

  playNotification() {
    if (!this.guard("notification", 300)) return;
    try {
      const ctx = this.ctx();
      this.osc(1000, "sine", ctx.currentTime, 0.15, 0.07);
    } catch {}
  }

  // 4-note ascending arpeggio — shop purchase
  playPurchase() {
    if (!this.guard("purchase", 600)) return;
    try {
      const ctx = this.ctx();
      const now = ctx.currentTime;
      [523, 659, 784, 1047].forEach((f, i) =>
        this.osc(f, "sine", now + i * 0.09, 0.28, 0.11)
      );
    } catch {}
  }

  // Equip confirm — two-note
  playEquip() {
    if (!this.guard("equip", 400)) return;
    try {
      const ctx = this.ctx();
      const now = ctx.currentTime;
      [659, 880].forEach((f, i) => this.osc(f, "sine", now + i * 0.1, 0.22, 0.09));
    } catch {}
  }

  // Reward claim — D-major ascending sparkle
  playReward() {
    if (!this.guard("reward", 600)) return;
    try {
      const ctx = this.ctx();
      const now = ctx.currentTime;
      [587.33, 739.99, 880.00].forEach((f, i) =>
        this.osc(f, "sine", now + i * 0.10, 0.35, 0.12)
      );
      this.osc(1760, "sine", now + 0.28, 0.35, 0.035);
    } catch {}
  }

  // Level-up fanfare — dramatic ascending arpeggio
  playLevelUp() {
    if (!this.guard("level_up", 2000)) return;
    try {
      const ctx = this.ctx();
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.50].forEach((f, i) =>
        this.osc(f, i === 3 ? "triangle" : "sine", now + i * 0.12, 0.75, 0.16)
      );
      [1046.50, 1318.51].forEach((f, i) =>
        this.osc(f, "sine", now + 0.42 + i * 0.04, 1.0, 0.07)
      );
    } catch {}
  }

  // Background hum — kept for game ambience compatibility
  startBackgroundHum() {
    if (!this.enabled) return;
    try {
      const ctx  = this.ctx();
      const dest = this.dest();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 80;
      osc.type = "sine";
      gain.gain.value = 0.012;
      osc.connect(gain); gain.connect(dest);
      osc.start();
    } catch {}
  }
  stopBackgroundHum() {}   // no-op — let it fade naturally
}

export const soundManager = new SoundManager();
