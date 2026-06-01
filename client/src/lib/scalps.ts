/**
 * Scalps — Jango.us platform currency
 * 1 Scalp = 1 USD  (1:1 peg, no conversion needed)
 */

export function formatScalps(amount: number | string, opts?: { compact?: boolean; short?: boolean }): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(n)) return "0 Scalps";

  if (opts?.compact) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M S`;
    if (n >= 1_000)    return `${(n / 1_000).toFixed(1)}K S`;
    return `${Math.round(n)} S`;
  }

  const decimals = Number.isInteger(n) ? 0 : 2;
  const formatted = n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  if (opts?.short) return `${formatted} S`;
  return `${formatted} Scalps`;
}

/** Show pot breakdown: each player's contribution */
export function formatPot(potAmount: number): string {
  return formatScalps(potAmount);
}

/** After 3% rake */
export function netWinnings(potAmount: number): number {
  return potAmount * 0.97;
}

/** 1 Scalp = 1 USD */
export const SCALPS_PER_USD = 1;
export const USD_PER_SCALP  = 1;

export function usdToScalps(usd: number): number {
  return usd;
}

export function cryptoToScalps(cryptoAmount: number, cryptoUsdPrice: number): number {
  return cryptoAmount * cryptoUsdPrice;
}
