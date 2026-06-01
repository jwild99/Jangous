/**
 * ELO Rating System
 * Calculates rating changes based on match outcomes, including bonus modifiers.
 */

export interface EloResult {
  player1NewRating: number;
  player2NewRating: number;
  player1Change: number;
  player2Change: number;
  player1Bonuses: EloBonuses;
  player2Bonuses: EloBonuses;
}

export interface EloBonuses {
  baseChange: number;
  upsetBonus: number;
  streakMultiplier: number;
  streakBonus: number;
  closeMatchProtection: number;
  wasUpset: boolean;
  wasCloseMatch: boolean;
}

/**
 * Calculate K-factor based on games played and current rating.
 * K = 40  → new/placement players  (< 20 games)
 * K = 25  → normal players          (20–50 games)
 * K = 15  → high-rank, established  (> 50 games)
 */
function getKFactor(gamesPlayed: number): number {
  if (gamesPlayed < 20) return 40;
  if (gamesPlayed < 50) return 25;
  return 15;
}

/**
 * Anti-smurf multiplier.
 * Detects suspiciously high win-rates on fresh accounts and
 * boosts their K-factor so they climb faster (less disruption at lower ranks).
 */
function getSmurfMultiplier(gamesPlayed: number, winRate: number): number {
  if (gamesPlayed < 20 && winRate > 0.70) return 1.5;
  if (gamesPlayed < 10 && winRate > 0.60) return 1.25;
  return 1.0;
}

/**
 * Expected win probability for player A against player B.
 * Formula: E_A = 1 / (1 + 10^((R_B - R_A) / 400))
 */
function getExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Upset bonus: rewarded when a lower-rated player beats a higher-rated one.
 * Scales from +5 to +30 based on the rating gap.
 */
function computeUpsetBonus(winnerRating: number, loserRating: number): number {
  const gap = loserRating - winnerRating;
  if (gap <= 0) return 0;
  if (gap < 100)  return 5;
  if (gap < 200)  return 10;
  if (gap < 400)  return 18;
  if (gap < 600)  return 25;
  return 30;
}

/**
 * Win streak multiplier: rewards consecutive wins.
 */
function computeStreakMultiplier(winStreak: number): number {
  if (winStreak >= 5) return 1.20;
  if (winStreak >= 3) return 1.10;
  if (winStreak >= 2) return 1.05;
  return 1.0;
}

/**
 * Loss streak dampener: reduces MMR loss after consecutive losses.
 */
function computeLossStreakDampener(lossStreak: number): number {
  if (lossStreak >= 3) return 0.80;
  return 1.0;
}

/**
 * Calculate new ELO ratings after a match, including bonus modifiers.
 *
 * @param player1Rating        Current MMR of player 1
 * @param player2Rating        Current MMR of player 2
 * @param player1GamesPlayed   Total rated games played by player 1
 * @param player2GamesPlayed   Total rated games played by player 2
 * @param player1Won           Whether player 1 won
 * @param player1WinRate       Lifetime win-rate for player 1 (0–1)
 * @param player2WinRate       Lifetime win-rate for player 2 (0–1)
 * @param player1WinStreak     Current consecutive win streak for player 1
 * @param player2WinStreak     Current consecutive win streak for player 2
 * @param player1LossStreak    Current consecutive loss streak for player 1
 * @param player2LossStreak    Current consecutive loss streak for player 2
 */
export function calculateEloChange(
  player1Rating: number,
  player2Rating: number,
  player1GamesPlayed: number,
  player2GamesPlayed: number,
  player1Won: boolean,
  player1WinRate = 0.5,
  player2WinRate = 0.5,
  player1WinStreak = 0,
  player2WinStreak = 0,
  player1LossStreak = 0,
  player2LossStreak = 0,
): EloResult {
  const k1 = getKFactor(player1GamesPlayed) * getSmurfMultiplier(player1GamesPlayed, player1WinRate);
  const k2 = getKFactor(player2GamesPlayed) * getSmurfMultiplier(player2GamesPlayed, player2WinRate);

  const expected1 = getExpectedScore(player1Rating, player2Rating);
  const expected2 = getExpectedScore(player2Rating, player1Rating);

  const actual1 = player1Won ? 1 : 0;
  const actual2 = player1Won ? 0 : 1;

  const baseChange1 = Math.round(k1 * (actual1 - expected1));
  const baseChange2 = Math.round(k2 * (actual2 - expected2));

  // ── Bonus modifiers ────────────────────────────────────────────────────────

  // Upset bonus (winner only)
  const p1UpsetBonus = player1Won ? computeUpsetBonus(player1Rating, player2Rating) : 0;
  const p2UpsetBonus = !player1Won ? computeUpsetBonus(player2Rating, player1Rating) : 0;

  // Win streak multiplier (winner only) — applied to the positive base change
  const p1StreakMult  = player1Won ? computeStreakMultiplier(player1WinStreak) : 1.0;
  const p2StreakMult  = !player1Won ? computeStreakMultiplier(player2WinStreak) : 1.0;

  const p1StreakBonus = player1Won ? Math.round(baseChange1 * (p1StreakMult - 1)) : 0;
  const p2StreakBonus = !player1Won ? Math.round(baseChange2 * (p2StreakMult - 1)) : 0;

  // Close-match protection (loser only) — dampen the loss if it was close (expected was ~50%)
  const wasClose = Math.abs(expected1 - 0.5) < 0.10;
  const p1CloseProt = (!player1Won && wasClose) ? Math.abs(Math.round(baseChange1 * 0.35)) : 0;
  const p2CloseProt = (player1Won && wasClose)  ? Math.abs(Math.round(baseChange2 * 0.35)) : 0;

  // Loss streak dampener (loser only)
  const p1LossDamp = !player1Won ? computeLossStreakDampener(player1LossStreak) : 1.0;
  const p2LossDamp = player1Won  ? computeLossStreakDampener(player2LossStreak) : 1.0;

  // Compose final change
  let change1 = baseChange1;
  let change2 = baseChange2;

  if (player1Won) {
    change1 = Math.round(baseChange1 * p1StreakMult) + p1UpsetBonus;
  } else {
    change1 = Math.round((baseChange1 + p1CloseProt) * p1LossDamp);
  }

  if (!player1Won) {
    change2 = Math.round(baseChange2 * p2StreakMult) + p2UpsetBonus;
  } else {
    change2 = Math.round((baseChange2 + p2CloseProt) * p2LossDamp);
  }

  // Floor at 100 — rating can't drop below minimum
  const newRating1 = Math.max(100, player1Rating + change1);
  const newRating2 = Math.max(100, player2Rating + change2);

  const player1Bonuses: EloBonuses = {
    baseChange: baseChange1,
    upsetBonus: p1UpsetBonus,
    streakMultiplier: p1StreakMult,
    streakBonus: p1StreakBonus,
    closeMatchProtection: p1CloseProt,
    wasUpset: p1UpsetBonus > 0,
    wasCloseMatch: wasClose && !player1Won,
  };

  const player2Bonuses: EloBonuses = {
    baseChange: baseChange2,
    upsetBonus: p2UpsetBonus,
    streakMultiplier: p2StreakMult,
    streakBonus: p2StreakBonus,
    closeMatchProtection: p2CloseProt,
    wasUpset: p2UpsetBonus > 0,
    wasCloseMatch: wasClose && player1Won,
  };

  return {
    player1NewRating: newRating1,
    player2NewRating: newRating2,
    player1Change: change1,
    player2Change: change2,
    player1Bonuses,
    player2Bonuses,
  };
}

/**
 * Tier name from rating — mirrors RANK_TIERS in rankUtils.ts.
 */
export function getRatingTier(rating: number): string {
  if (rating < 1000) return "Bronze";
  if (rating < 1400) return "Silver";
  if (rating < 1800) return "Gold";
  if (rating < 2200) return "Platinum";
  if (rating < 2600) return "Diamond";
  return "Champion";
}

/** Players must complete 5 placement matches before a rank is shown. */
export const PLACEMENT_MATCH_COUNT = 5;

export function hasCompletedPlacement(placementMatches: number): boolean {
  return placementMatches >= PLACEMENT_MATCH_COUNT;
}

export function getPlacementProgress(placementMatches: number): number {
  return Math.min(100, (placementMatches / PLACEMENT_MATCH_COUNT) * 100);
}
