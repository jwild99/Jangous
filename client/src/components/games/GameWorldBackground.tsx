import { useMemo } from "react";

interface GameTheme {
  base: string;
  bg: string;
  glow1?: { x: number; y: number; r: number; color: string };
  glow2?: { x: number; y: number; r: number; color: string };
  glow3?: { x: number; y: number; r: number; color: string };
  grid?: boolean;
}

const THEMES: Record<string, GameTheme> = {
  "chess": {
    base: "#06091a",
    bg: "radial-gradient(ellipse 80% 60% at 50% 0%, #0f1c3a 0%, #06091a 70%)",
    glow1: { x: 50, y: 35, r: 45, color: "rgba(251,191,36,0.18)" },
    glow2: { x: 20, y: 65, r: 32, color: "rgba(59,130,246,0.10)" },
    glow3: { x: 80, y: 65, r: 32, color: "rgba(59,130,246,0.08)" },
  },
  "mini-golf": {
    base: "#030d06",
    bg: "radial-gradient(ellipse 80% 70% at 50% 100%, #06200f 0%, #030d06 70%)",
    glow1: { x: 50, y: 55, r: 50, color: "rgba(52,211,153,0.14)" },
    glow2: { x: 25, y: 25, r: 32, color: "rgba(16,185,129,0.07)" },
  },
  "connect-4": {
    base: "#020818",
    bg: "radial-gradient(ellipse 90% 70% at 50% 100%, #071830 0%, #020818 70%)",
    glow1: { x: 50, y: 65, r: 55, color: "rgba(6,182,212,0.14)" },
    glow2: { x: 18, y: 80, r: 32, color: "rgba(239,68,68,0.10)" },
    glow3: { x: 82, y: 80, r: 32, color: "rgba(234,179,8,0.10)" },
  },
  "air-hockey": {
    base: "#020b1a",
    bg: "radial-gradient(ellipse 100% 60% at 50% 50%, #052040 0%, #020b1a 70%)",
    glow1: { x: 50, y: 50, r: 60, color: "rgba(6,182,212,0.15)" },
    glow2: { x: 10, y: 50, r: 28, color: "rgba(139,92,246,0.09)" },
    glow3: { x: 90, y: 50, r: 28, color: "rgba(139,92,246,0.09)" },
  },
  "rock-paper-scissors": {
    base: "#080312",
    bg: "linear-gradient(135deg, #130428 0%, #080312 45%, #1a0408 100%)",
    glow1: { x: 18, y: 50, r: 46, color: "rgba(168,85,247,0.20)" },
    glow2: { x: 82, y: 50, r: 46, color: "rgba(239,68,68,0.17)" },
    glow3: { x: 50, y: 50, r: 28, color: "rgba(251,191,36,0.09)" },
  },
  "dots-and-boxes": {
    base: "#02091a",
    bg: "radial-gradient(ellipse 80% 70% at 50% 50%, #071828 0%, #02091a 70%)",
    glow1: { x: 50, y: 40, r: 50, color: "rgba(20,184,166,0.12)" },
    glow2: { x: 25, y: 70, r: 34, color: "rgba(139,92,246,0.09)" },
    glow3: { x: 75, y: 70, r: 34, color: "rgba(139,92,246,0.09)" },
    grid: true,
  },
  "8-ball": {
    base: "#031009",
    bg: "radial-gradient(ellipse 70% 60% at 50% 60%, #072015 0%, #031009 70%)",
    glow1: { x: 50, y: 60, r: 50, color: "rgba(16,185,129,0.12)" },
    glow2: { x: 50, y: 28, r: 30, color: "rgba(251,191,36,0.09)" },
  },
  "bowling": {
    base: "#07020f",
    bg: "linear-gradient(180deg, #0a0318 0%, #07020f 50%, #0a0318 100%)",
    glow1: { x: 50, y: 18, r: 42, color: "rgba(168,85,247,0.16)" },
    glow2: { x: 50, y: 82, r: 42, color: "rgba(6,182,212,0.11)" },
  },
  "cup-king": {
    base: "#0a050a",
    bg: "radial-gradient(ellipse 70% 70% at 50% 60%, #1a0a10 0%, #0a050a 70%)",
    glow1: { x: 50, y: 50, r: 48, color: "rgba(251,191,36,0.20)" },
    glow2: { x: 28, y: 28, r: 32, color: "rgba(168,85,247,0.12)" },
    glow3: { x: 72, y: 28, r: 32, color: "rgba(168,85,247,0.12)" },
  },
  "stack-tower": {
    base: "#020512",
    bg: "linear-gradient(180deg, #020512 0%, #041028 60%, #020512 100%)",
    glow1: { x: 50, y: 80, r: 42, color: "rgba(6,182,212,0.16)" },
    glow2: { x: 50, y: 18, r: 30, color: "rgba(139,92,246,0.09)" },
  },
  "block-blast": {
    base: "#0a0114",
    bg: "radial-gradient(ellipse 80% 80% at 50% 38%, #1a0228 0%, #0a0114 70%)",
    glow1: { x: 50, y: 32, r: 52, color: "rgba(236,72,153,0.16)" },
    glow2: { x: 18, y: 62, r: 30, color: "rgba(139,92,246,0.12)" },
    glow3: { x: 82, y: 62, r: 30, color: "rgba(6,182,212,0.09)" },
  },
  "tron": {
    base: "#000608",
    bg: "radial-gradient(ellipse 100% 100% at 50% 50%, #001520 0%, #000608 70%)",
    glow1: { x: 50, y: 50, r: 72, color: "rgba(6,182,212,0.20)" },
    grid: true,
  },
  "basketball": {
    base: "#0a0408",
    bg: "radial-gradient(ellipse 80% 70% at 50% 82%, #1a0908 0%, #0a0408 70%)",
    glow1: { x: 50, y: 72, r: 52, color: "rgba(249,115,22,0.16)" },
    glow2: { x: 22, y: 28, r: 30, color: "rgba(168,85,247,0.09)" },
    glow3: { x: 78, y: 28, r: 30, color: "rgba(168,85,247,0.09)" },
  },
  "football": {
    base: "#030b04",
    bg: "radial-gradient(ellipse 80% 60% at 50% 82%, #061808 0%, #030b04 70%)",
    glow1: { x: 50, y: 80, r: 56, color: "rgba(22,163,74,0.14)" },
    glow2: { x: 50, y: 18, r: 30, color: "rgba(248,250,252,0.04)" },
  },
  "racing": {
    base: "#060206",
    bg: "linear-gradient(180deg, #0a0208 0%, #060206 50%, #0a0208 100%)",
    glow1: { x: 50, y: 28, r: 42, color: "rgba(239,68,68,0.17)" },
    glow2: { x: 28, y: 72, r: 30, color: "rgba(249,115,22,0.12)" },
    glow3: { x: 72, y: 72, r: 30, color: "rgba(249,115,22,0.12)" },
  },
};

const DEFAULT_THEME: GameTheme = {
  base: "#05080f",
  bg: "radial-gradient(ellipse 80% 60% at 50% 40%, #0d1528 0%, #05080f 70%)",
  glow1: { x: 50, y: 40, r: 50, color: "rgba(99,102,241,0.14)" },
};

export default function GameWorldBackground({ gameType }: { gameType?: string }) {
  const theme = useMemo(() => THEMES[gameType ?? ""] ?? DEFAULT_THEME, [gameType]);

  const glowStyle = (g: NonNullable<GameTheme["glow1"]>): React.CSSProperties => ({
    position: "absolute",
    left: `${g.x}%`,
    top: `${g.y}%`,
    width: `${g.r * 2}%`,
    height: `${g.r * 2}%`,
    transform: "translate(-50%, -50%)",
    background: `radial-gradient(ellipse at center, ${g.color} 0%, transparent 70%)`,
    pointerEvents: "none",
  });

  return (
    <div
      className="fixed inset-0 pointer-events-none select-none"
      style={{ zIndex: -1, background: theme.base }}
      aria-hidden="true"
    >
      <div className="absolute inset-0" style={{ background: theme.bg }} />

      {theme.glow1 && (
        <div
          className="absolute animate-pulse"
          style={{ ...glowStyle(theme.glow1), animationDuration: "6s" }}
        />
      )}
      {theme.glow2 && (
        <div
          className="absolute animate-pulse"
          style={{ ...glowStyle(theme.glow2), animationDuration: "8s", animationDelay: "1s" }}
        />
      )}
      {theme.glow3 && (
        <div
          className="absolute animate-pulse"
          style={{ ...glowStyle(theme.glow3), animationDuration: "7s", animationDelay: "2.5s" }}
        />
      )}

      {theme.grid && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(6,182,212,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.05) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      )}

      <div
        className="absolute inset-x-0 bottom-0"
        style={{ height: "30%", background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 100%)" }}
      />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 110% 110% at 50% 50%, transparent 55%, rgba(0,0,0,0.35) 100%)" }}
      />
    </div>
  );
}
