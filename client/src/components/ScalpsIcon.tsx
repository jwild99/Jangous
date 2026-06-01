import { cn } from "@/lib/utils";

interface ScalpsIconProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
  glow?: boolean;
}

const SIZES = {
  xs: { outer: 14, inner: 9, font: 5 },
  sm: { outer: 18, inner: 11, font: 6.5 },
  md: { outer: 24, inner: 15, font: 9 },
  lg: { outer: 36, inner: 23, font: 13 },
};

/**
 * The Scalps currency icon — a hexagonal coin with stylised "S"
 * Brand gradient: Hot Pink #FF2D8A → Neon Orange #FF7A00
 */
export function ScalpsIcon({ className, size = "sm", glow = false }: ScalpsIconProps) {
  const { outer, inner, font } = SIZES[size];
  const id = `scalps-grad-${size}`;

  return (
    <svg
      width={outer}
      height={outer}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(className)}
      style={glow ? { filter: "drop-shadow(0 0 6px #FF7A0099)" } : undefined}
      aria-label="Scalps"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF2D8A" />
          <stop offset="100%" stopColor="#FF7A00" />
        </linearGradient>
      </defs>
      {/* Hexagon background */}
      <path
        d="M18 2 L32 10 L32 26 L18 34 L4 26 L4 10 Z"
        fill={`url(#${id})`}
      />
      {/* Inner highlight ring */}
      <path
        d="M18 5 L30 12 L30 24 L18 31 L6 24 L6 12 Z"
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="0.8"
      />
      {/* "S" letter */}
      <text
        x="18"
        y="24"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="900"
        fontSize="17"
        fill="white"
        style={{ userSelect: "none" }}
      >
        S
      </text>
    </svg>
  );
}

/** Inline Scalps amount display: [icon] [number] [label?] */
export function ScalpsAmount({
  amount,
  className,
  iconSize = "sm",
  showLabel = false,
  glow = false,
}: {
  amount: number | string;
  className?: string;
  iconSize?: "xs" | "sm" | "md" | "lg";
  showLabel?: boolean;
  glow?: boolean;
}) {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  const decimals = Number.isInteger(n) ? 0 : 2;
  const formatted = isNaN(n) ? "0" : n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <ScalpsIcon size={iconSize} glow={glow} />
      <span>{formatted}</span>
      {showLabel && <span className="text-muted-foreground text-xs ml-0.5">Scalps</span>}
    </span>
  );
}
