import { useId } from "react";

interface JangoLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * JANGO neon sign logo.
 *
 * Brand colors (strict):
 *   Border  — Hot Pink    #FF2D8A
 *   Text    — Neon Orange #FF7A00
 *   BG      — Near-black  #050508
 *
 * Neon effect built as layered SVG filters:
 *   1. Wide atmospheric bloom   (soft outer glow)
 *   2. Medium emission pass     (immediate glow radius)
 *   3. Crisp source merge       (sharp tube + micro-halo)
 *
 * Filter IDs are namespaced per instance via React's useId()
 * so multiple logo instances on one page don't collide.
 */
export function JangoLogo({ size = "md", className = "" }: JangoLogoProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  /* ── viewBox & display size ─────────────────────────── */
  const VW = 240;
  const VH = 66;

  const displayW =
    size === "sm" ? 110 :
    size === "lg" ? 224 :
    152;
  const displayH = Math.round(displayW * (VH / VW));

  /* ── Brand palette ──────────────────────────────────── */
  const PINK        = "#FF2D8A";   // hot pink — border tube
  const PINK_BRIGHT = "#FF6FBA";   // brighter highlight on tube face
  const ORANGE      = "#FF7A00";   // neon orange — text
  const ORANGE_HOT  = "#FFAA44";   // bright hot core of letters
  const BG          = "#050508";   // near-black interior

  /* ── Filter ID references ───────────────────────────── */
  const F = {
    borderBloom  : `${uid}a`,
    borderEmit   : `${uid}b`,
    textBloom    : `${uid}c`,
    textEmit     : `${uid}d`,
    textCore     : `${uid}e`,
    cornerGlow   : `${uid}f`,
  };

  /* ── Geometry helpers ───────────────────────────────── */
  const PAD = 5;                      // border inset from edge
  const RX  = 7;                      // corner radius
  const TX  = VW / 2;                 // text anchor x (centered)
  const TY  = 48;                     // text baseline y
  const FONT_SIZE = 42;
  const FONT = "Impact, 'Arial Black', Arial, sans-serif";
  const SPACING = "2";

  const corners: [number, number][] = [
    [PAD + RX,         PAD + RX],
    [VW - PAD - RX,    PAD + RX],
    [PAD + RX,         VH - PAD - RX],
    [VW - PAD - RX,    VH - PAD - RX],
  ];

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      width={displayW}
      height={displayH}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="JANGO"
      role="img"
      data-testid="brand-logo"
    >
      <defs>
        {/* ── BORDER FILTERS ──────────────────────────── */}

        {/* Wide atmospheric bloom behind the border */}
        <filter id={F.borderBloom} x="-40%" y="-150%" width="180%" height="400%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="wide"/>
          <feComponentTransfer in="wide" result="tinted">
            <feFuncR type="linear" slope="1.1"/>
            <feFuncG type="linear" slope="0.1"/>
            <feFuncB type="linear" slope="0.6"/>
          </feComponentTransfer>
          <feComposite in="tinted" in2="tinted" operator="over"/>
        </filter>

        {/* Crisp emission — medium glow merged with source */}
        <filter id={F.borderEmit} x="-30%" y="-120%" width="160%" height="340%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        {/* ── TEXT FILTERS ────────────────────────────── */}

        {/* Wide atmospheric bloom around letters */}
        <filter id={F.textBloom} x="-40%" y="-150%" width="180%" height="400%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="wide"/>
          <feComponentTransfer in="wide" result="orange">
            <feFuncR type="linear" slope="1.4"/>
            <feFuncG type="linear" slope="0.45"/>
            <feFuncB type="linear" slope="0"/>
          </feComponentTransfer>
        </filter>

        {/* Medium emission radius */}
        <filter id={F.textEmit} x="-25%" y="-100%" width="150%" height="300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        {/* Crisp core — micro-halo only, merged with original */}
        <filter id={F.textCore} x="-10%" y="-50%" width="120%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="micro"/>
          <feMerge>
            <feMergeNode in="micro"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        {/* Corner dot glow */}
        <filter id={F.cornerGlow} x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5"/>
        </filter>
      </defs>

      {/* ── 1. Dark background ──────────────────────── */}
      <rect
        x="0" y="0" width={VW} height={VH} rx={RX + 2}
        fill={BG}
      />

      {/* ── 2. Border — wide atmospheric bloom ─────── */}
      <rect
        x={PAD} y={PAD}
        width={VW - PAD * 2} height={VH - PAD * 2}
        rx={RX} fill="none"
        stroke={PINK} strokeWidth="2.5"
        filter={`url(#${F.borderBloom})`}
        opacity="0.75"
      />

      {/* ── 3. Border — crisp emission pass ────────── */}
      <rect
        x={PAD} y={PAD}
        width={VW - PAD * 2} height={VH - PAD * 2}
        rx={RX} fill="none"
        stroke={PINK_BRIGHT} strokeWidth="1.4"
        filter={`url(#${F.borderEmit})`}
        opacity="0.95"
      />

      {/* ── 4. Border — razor-sharp tube face ──────── */}
      <rect
        x={PAD} y={PAD}
        width={VW - PAD * 2} height={VH - PAD * 2}
        rx={RX} fill="none"
        stroke="#FFB0D8" strokeWidth="0.7"
        opacity="0.9"
      />

      {/* ── 5. Corner connector dots ────────────────── */}
      {corners.map(([cx, cy], i) => (
        <g key={i}>
          {/* glow halo */}
          <circle cx={cx} cy={cy} r="4"
            fill={PINK}
            filter={`url(#${F.cornerGlow})`}
            opacity="0.9"
          />
          {/* crisp dot */}
          <circle cx={cx} cy={cy} r="2.2"
            fill={PINK_BRIGHT}
            opacity="1"
          />
          {/* bright center */}
          <circle cx={cx} cy={cy} r="1"
            fill="#FFD0EE"
            opacity="0.95"
          />
        </g>
      ))}

      {/* ── 6. Text — wide atmospheric bloom ────────── */}
      <text
        x={TX} y={TY} textAnchor="middle"
        fontSize={FONT_SIZE} fontFamily={FONT}
        fontWeight="900" letterSpacing={SPACING}
        fill={ORANGE}
        filter={`url(#${F.textBloom})`}
        opacity="0.7"
      >
        JANGO
      </text>

      {/* ── 7. Text — medium emission ───────────────── */}
      <text
        x={TX} y={TY} textAnchor="middle"
        fontSize={FONT_SIZE} fontFamily={FONT}
        fontWeight="900" letterSpacing={SPACING}
        fill={ORANGE}
        filter={`url(#${F.textEmit})`}
        opacity="0.85"
      >
        JANGO
      </text>

      {/* ── 8. Text — crisp core with micro-halo ────── */}
      <text
        x={TX} y={TY} textAnchor="middle"
        fontSize={FONT_SIZE} fontFamily={FONT}
        fontWeight="900" letterSpacing={SPACING}
        fill={ORANGE_HOT}
        filter={`url(#${F.textCore})`}
        opacity="0.98"
      >
        JANGO
      </text>
    </svg>
  );
}
