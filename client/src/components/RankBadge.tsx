import { getRankConfig, GOAT_CONFIG } from "@shared/rankUtils";
import type { RankTier } from "@shared/rankUtils";

interface RankBadgeProps {
  rating: number;
  showLabel?: boolean;
  showRating?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  isGoat?: boolean;
  championRank?: number;
}

const SIZE_CLASSES = {
  xs: { badge: "px-1.5 py-0.5 text-[10px] gap-1", dot: "w-1.5 h-1.5" },
  sm: { badge: "px-2 py-0.5 text-xs gap-1",       dot: "w-2 h-2" },
  md: { badge: "px-2.5 py-1 text-sm gap-1.5",     dot: "w-2.5 h-2.5" },
  lg: { badge: "px-3 py-1.5 text-base gap-2",     dot: "w-3 h-3" },
};

const TIER_SYMBOLS: Record<RankTier, string> = {
  Bronze:   "I",
  Silver:   "II",
  Gold:     "III",
  Platinum: "IV",
  Diamond:  "V",
  Champion: "VI",
};

export function RankBadge({
  rating, showLabel = true, showRating = false,
  size = "sm", className = "", isGoat = false, championRank,
}: RankBadgeProps) {
  const cfg = getRankConfig(rating);
  const { badge, dot } = SIZE_CLASSES[size];

  if (isGoat) {
    return (
      <span
        className={`inline-flex items-center rounded-full font-bold border ${badge} ${className}`}
        style={{
          color: GOAT_CONFIG.color,
          background: GOAT_CONFIG.bg,
          borderColor: GOAT_CONFIG.border,
          boxShadow: `0 0 14px ${GOAT_CONFIG.glow}, 0 0 28px ${GOAT_CONFIG.glow}`,
        }}
        data-testid="rank-badge-goat"
      >
        <span
          className={`rounded-full shrink-0 ${dot}`}
          style={{
            background: `linear-gradient(135deg, ${GOAT_CONFIG.color}, ${GOAT_CONFIG.secondaryColor})`,
            boxShadow: `0 0 8px ${GOAT_CONFIG.glow}`,
          }}
        />
        {showLabel && <span>GOAT</span>}
        {showRating && <span className="opacity-70">· {rating}</span>}
      </span>
    );
  }

  const label = (cfg.label === "Champion" && championRank != null)
    ? `#${championRank}`
    : cfg.label;

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold border ${badge} ${className}`}
      style={{
        color: cfg.color,
        background: cfg.bg,
        borderColor: cfg.border,
        boxShadow: `0 0 10px ${cfg.glow}`,
      }}
      data-testid={`rank-badge-${cfg.label.toLowerCase()}`}
    >
      <span
        className={`rounded-full shrink-0 ${dot}`}
        style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.glow}` }}
      />
      {showLabel && <span>{cfg.label === "Champion" && championRank != null ? `Champion ${label}` : cfg.label}</span>}
      {showRating && <span className="opacity-70">· {rating}</span>}
    </span>
  );
}

export function GoatBadge({ size = "sm", className = "" }: { size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  const { badge, dot } = SIZE_CLASSES[size];
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold border ${badge} ${className}`}
      style={{
        color: GOAT_CONFIG.color,
        background: GOAT_CONFIG.bg,
        borderColor: GOAT_CONFIG.border,
        boxShadow: `0 0 14px ${GOAT_CONFIG.glow}, 0 0 28px ${GOAT_CONFIG.glow}`,
        animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
      }}
      data-testid="rank-badge-goat"
    >
      <span
        className={`rounded-full shrink-0 ${dot}`}
        style={{
          background: `linear-gradient(135deg, ${GOAT_CONFIG.color}, ${GOAT_CONFIG.secondaryColor})`,
          boxShadow: `0 0 8px ${GOAT_CONFIG.glow}`,
        }}
      />
      <span>GOAT</span>
    </span>
  );
}

export function RankSymbol({ rating, size = "md" }: { rating: number; size?: "sm" | "md" | "lg" }) {
  const cfg = getRankConfig(rating);
  const sizeMap = { sm: "text-xs", md: "text-sm", lg: "text-base" };
  return (
    <span className={`font-bold tracking-wider ${sizeMap[size]}`} style={{ color: cfg.color }}>
      {TIER_SYMBOLS[cfg.label]}
    </span>
  );
}
