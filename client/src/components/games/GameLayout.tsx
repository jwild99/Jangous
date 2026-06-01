import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Keyboard, Bot, Trophy, Coins, Swords, Info } from "lucide-react";
import type { MatchWithPlayers } from "@shared/schema";

// ─── GameArenaWrapper ─────────────────────────────────────────────────────────
// Wraps a game canvas / board in a neon-accented glass panel with ambient glow.

interface GameArenaWrapperProps {
  accentColor?: string;
  accentRgb?: string;
  children: React.ReactNode;
  className?: string;
}

export function GameArenaWrapper({
  accentColor = "#6366f1",
  accentRgb = "99,102,241",
  children,
  className = "",
}: GameArenaWrapperProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`relative flex justify-center ${className}`}
    >
      {/* Ambient arena glow */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, rgba(${accentRgb},0.15) 0%, transparent 65%)`,
          filter: "blur(30px)",
          transform: "scale(1.2)",
        }}
      />
      {/* Arena border */}
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          border: `1px solid rgba(${accentRgb},0.28)`,
          boxShadow: `0 0 32px rgba(${accentRgb},0.14), 0 0 64px rgba(${accentRgb},0.06), inset 0 1px 0 rgba(255,255,255,0.04)`,
        }}
      >
        {children}
      </div>
    </motion.div>
  );
}

// ─── GameStatusPills ──────────────────────────────────────────────────────────

interface GameStatusPillsProps {
  controls?: string;
  winCondition?: string;
  isPractice?: boolean;
  botDifficulty?: string | null;
  betAmount?: number;
  extra?: React.ReactNode;
}

export function GameStatusPills({
  controls,
  winCondition,
  isPractice,
  botDifficulty,
  betAmount = 0,
  extra,
}: GameStatusPillsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap justify-center">
      {controls && (
        <Badge
          variant="outline"
          className="gap-1.5 border-white/10 bg-white/[0.03] text-white/50 text-[11px] hidden sm:flex"
        >
          <Keyboard className="w-3 h-3" />
          {controls}
        </Badge>
      )}
      {isPractice && botDifficulty ? (
        <Badge variant="outline" className="gap-1.5 border-violet-500/25 bg-violet-500/[0.06] text-violet-300/80 text-[11px]">
          <Bot className="w-3 h-3" />
          Bot · {botDifficulty}
        </Badge>
      ) : !isPractice ? (
        <Badge variant="outline" className="gap-1.5 border-blue-500/25 bg-blue-500/[0.06] text-blue-300/80 text-[11px]">
          <Swords className="w-3 h-3" />
          Ranked
        </Badge>
      ) : (
        <Badge variant="outline" className="gap-1.5 border-violet-500/25 bg-violet-500/[0.06] text-violet-300/80 text-[11px]">
          <Bot className="w-3 h-3" />
          Practice
        </Badge>
      )}
      {winCondition && (
        <Badge variant="outline" className="gap-1.5 border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300/80 text-[11px]">
          <Trophy className="w-3 h-3" />
          {winCondition}
        </Badge>
      )}
      {betAmount > 0 && (
        <Badge variant="outline" className="gap-1.5 border-amber-500/25 bg-amber-500/[0.06] text-amber-300/80 text-[11px]">
          <Coins className="w-3 h-3" />
          Pot: {(betAmount * 2 * 0.97).toFixed(2)} S
        </Badge>
      )}
      {extra}
    </div>
  );
}

// ─── GameControlsCard ─────────────────────────────────────────────────────────

interface HelpItem {
  label: string;
  value: string;
}

interface GameControlsCardProps {
  items: HelpItem[];
  className?: string;
}

export function GameControlsCard({ items, className = "" }: GameControlsCardProps) {
  if (items.length === 0) return null;
  return (
    <Card className={`w-full max-w-2xl ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <Info className="w-3.5 h-3.5 text-muted-foreground/60" />
          <span className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest">How to Play</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {items.map(({ label, value }) => (
            <div key={label} className="flex gap-2 text-sm">
              <span className="text-muted-foreground/70 font-medium shrink-0">{label}:</span>
              <span className="text-white/70">{value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── GameLayout ───────────────────────────────────────────────────────────────
// The main shared wrapper for all game screens.
// Provides: ambient background, status pills, consistent container.
// Children = entire game content (HUD + arena + controls).

interface GameLayoutProps {
  match: MatchWithPlayers;
  currentUserId?: string;
  accentColor?: string;
  accentRgb?: string;
  controls?: string;
  winCondition?: string;
  helpItems?: HelpItem[];
  extraPills?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  compact?: boolean; // for canvas-centered games (flex-col centered)
  showPills?: boolean; // false for games that already have their own HUD pills
}

export function GameLayout({
  match,
  accentColor = "#6366f1",
  accentRgb = "99,102,241",
  controls,
  winCondition,
  helpItems,
  extraPills,
  children,
  className = "",
  compact = false,
  showPills = true,
}: GameLayoutProps) {
  const isPractice = !!(match.isPractice || match.isBotMatch);
  const botDifficulty = match.botDifficulty ?? null;
  const betAmount = parseFloat((match as any).betAmount || "0");

  return (
    <div
      className={`relative min-h-screen w-full ${compact ? "flex flex-col items-center gap-4 px-2 py-4" : ""} ${className}`}
      style={{
        background: "radial-gradient(ellipse at 30% 15%, #0d1528 0%, #060911 55%, #030508 100%)",
      }}
    >
      {/* Ambient top glow (accent-colored) */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          width: "700px",
          height: "250px",
          background: `radial-gradient(ellipse at center top, rgba(${accentRgb},0.09) 0%, transparent 70%)`,
        }}
      />
      {/* Subtle ambient side glow */}
      <div
        className="absolute bottom-0 right-0 pointer-events-none opacity-40"
        style={{
          width: "400px",
          height: "400px",
          background: `radial-gradient(ellipse at center, rgba(${accentRgb},0.06) 0%, transparent 70%)`,
        }}
      />

      {/* Status pills — only when showPills=true */}
      {showPills && (
        <div className={compact ? "w-full flex justify-center" : "py-2 flex justify-center px-4"}>
          <GameStatusPills
            controls={controls}
            winCondition={winCondition}
            isPractice={isPractice}
            botDifficulty={botDifficulty}
            betAmount={betAmount}
            extra={extraPills}
          />
        </div>
      )}

      {/* Game content */}
      {children}

      {/* Controls card — shown at bottom when helpItems provided */}
      {helpItems && helpItems.length > 0 && (
        <div className={compact ? "w-full flex justify-center" : "px-4 pb-6 flex justify-center"}>
          <GameControlsCard items={helpItems} />
        </div>
      )}
    </div>
  );
}
