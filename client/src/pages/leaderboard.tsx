import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Trophy, DollarSign, ChevronLeft, ChevronRight, Globe, Users, Flame, Calendar,
  Crown, TrendingUp, TrendingDown, Minus, Zap, Swords, Target, ArrowUpRight, ChevronUp,
} from "lucide-react";
import { getRankConfig, getRatingProgress } from "@shared/rankUtils";
import { RankBadge } from "@/components/RankBadge";
import {
  ChessIcon, MiniGolfIcon, Connect4Icon, AirHockeyIcon,
  RockPaperScissorsIcon, DotsAndBoxesIcon, EightBallIcon,
  BowlingIcon, CupKingIcon, StackTowerIcon,
  BasketballIcon, FootballIcon, RacingIcon,
} from "@/components/GameIcons";
import { GoldTrophy, SilverTrophy, BronzeTrophy } from "@/components/PremiumAssets";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { AppNavbar } from "@/components/AppNavbar";
import { PageHero } from "@/components/PageHero";
import { PageDepthBackground } from "@/components/PageDepthBackground";
import { Magnetic3D } from "@/components/Magnetic3D";
import type { LeaderboardEntry } from "@shared/schema";
import { ScalpsIcon } from "@/components/ScalpsIcon";

// ─── Tab config ──────────────────────────────────────────────────────────────
type TabId = "global" | "money" | "chess" | "mini-golf" | "connect-4" | "air-hockey"
  | "rock-paper-scissors" | "dots-and-boxes" | "8-ball" | "bowling" | "cup-king" | "stack-tower"
  | "basketball" | "football" | "racing";

type Period = "all" | "monthly" | "weekly";
type Scope = "global" | "friends";
type HotFilter = "none" | "hot" | "earners" | "rising";

const TABS: { id: TabId; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "global",               label: "All Games",           Icon: Trophy },
  { id: "money",                label: "Earnings",             Icon: DollarSign },
  { id: "chess",                label: "Chess",                Icon: ChessIcon },
  { id: "mini-golf",            label: "Mini Golf",            Icon: MiniGolfIcon },
  { id: "connect-4",            label: "Connect 4",            Icon: Connect4Icon },
  { id: "air-hockey",           label: "Air Hockey",           Icon: AirHockeyIcon },
  { id: "rock-paper-scissors",  label: "Rock Paper Scissors",  Icon: RockPaperScissorsIcon },
  { id: "dots-and-boxes",       label: "Dots & Boxes",         Icon: DotsAndBoxesIcon },
  { id: "8-ball",               label: "8-Ball Pool",          Icon: EightBallIcon },
  { id: "bowling",              label: "Bowling",              Icon: BowlingIcon },
  { id: "cup-king",             label: "Cup Pong",             Icon: CupKingIcon },
  { id: "stack-tower",          label: "Tower Stack",          Icon: StackTowerIcon },
  { id: "basketball",           label: "Basketball",           Icon: BasketballIcon },
  { id: "football",             label: "Football",             Icon: FootballIcon },
  { id: "racing",               label: "Racing",               Icon: RacingIcon },
];

interface MoneyEntry {
  userId: string;
  username: string;
  totalWinnings: string;
}

// ─── Injected CSS ─────────────────────────────────────────────────────────────
const LEADERBOARD_CSS = `
@keyframes goldPulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(234,179,8,0), 0 0 24px rgba(234,179,8,0.25), inset 0 0 20px rgba(234,179,8,0.05); }
  50%      { box-shadow: 0 0 0 6px rgba(234,179,8,0.08), 0 0 40px rgba(234,179,8,0.4), inset 0 0 30px rgba(234,179,8,0.08); }
}
@keyframes silverGlow {
  0%,100% { box-shadow: 0 0 16px rgba(148,163,184,0.2); }
  50%      { box-shadow: 0 0 28px rgba(148,163,184,0.35); }
}
@keyframes bronzeGlow {
  0%,100% { box-shadow: 0 0 14px rgba(180,83,9,0.2); }
  50%      { box-shadow: 0 0 24px rgba(180,83,9,0.32); }
}
@keyframes avatarRing1 {
  0%,100% { box-shadow: 0 0 0 2px #eab308, 0 0 16px rgba(234,179,8,0.6); }
  50%      { box-shadow: 0 0 0 3px #fde047, 0 0 28px rgba(253,224,71,0.8); }
}
@keyframes avatarRing2 {
  0%,100% { box-shadow: 0 0 0 2px #94a3b8, 0 0 12px rgba(148,163,184,0.4); }
  50%      { box-shadow: 0 0 0 2.5px #cbd5e1, 0 0 20px rgba(203,213,225,0.6); }
}
@keyframes avatarRing3 {
  0%,100% { box-shadow: 0 0 0 2px #c2410c, 0 0 10px rgba(194,65,12,0.4); }
  50%      { box-shadow: 0 0 0 2.5px #ea580c, 0 0 18px rgba(234,88,12,0.55); }
}
@keyframes rankGlow {
  0%,100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
  50%      { box-shadow: 0 0 0 6px rgba(99,102,241,0.12), 0 0 24px rgba(99,102,241,0.15); }
}
`;

function InjectLeaderboardCSS() {
  useEffect(() => {
    const id = "leaderboard-glow-css";
    if (!document.getElementById(id)) {
      const s = document.createElement("style");
      s.id = id; s.textContent = LEADERBOARD_CSS;
      document.head.appendChild(s);
    }
  }, []);
  return null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function RankCell({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div className="flex items-center justify-center w-11 h-11 rounded-full flex-shrink-0"
      style={{ background: "radial-gradient(circle, rgba(234,179,8,0.2) 0%, rgba(234,179,8,0.05) 100%)", border: "1.5px solid rgba(234,179,8,0.5)" }}>
      <Crown className="w-5 h-5 text-yellow-400 drop-shadow-[0_0_6px_rgba(234,179,8,0.9)]" />
    </div>
  );
  if (rank === 2) return (
    <div className="flex items-center justify-center w-11 h-11 rounded-full flex-shrink-0"
      style={{ background: "radial-gradient(circle, rgba(148,163,184,0.15) 0%, rgba(148,163,184,0.04) 100%)", border: "1.5px solid rgba(148,163,184,0.4)" }}>
      <SilverTrophy className="w-5 h-5" />
    </div>
  );
  if (rank === 3) return (
    <div className="flex items-center justify-center w-11 h-11 rounded-full flex-shrink-0"
      style={{ background: "radial-gradient(circle, rgba(180,83,9,0.15) 0%, rgba(180,83,9,0.04) 100%)", border: "1.5px solid rgba(180,83,9,0.4)" }}>
      <BronzeTrophy className="w-5 h-5" />
    </div>
  );
  return (
    <div className="flex items-center justify-center w-11 h-11 flex-shrink-0">
      <span className="text-sm font-mono font-bold text-white/35">#{rank}</span>
    </div>
  );
}

function RankedAvatar({ entry, rank }: { entry: { userName?: string | null; profileImageUrl?: string | null }; rank: number }) {
  const ringStyle: React.CSSProperties = rank === 1
    ? { animation: "avatarRing1 2s ease-in-out infinite" }
    : rank === 2
    ? { animation: "avatarRing2 2.5s ease-in-out infinite" }
    : rank === 3
    ? { animation: "avatarRing3 3s ease-in-out infinite" }
    : {};

  return (
    <div className="flex-shrink-0 w-10 h-10 rounded-full" style={ringStyle}>
      <Avatar className="w-10 h-10">
        <AvatarImage src={entry.profileImageUrl || undefined} style={{ objectFit: "cover" }} />
        <AvatarFallback className="text-xs font-bold">
          {(entry.userName?.[0] ?? "U").toUpperCase()}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}

function RankTrend({ rank, winRate }: { rank: number; winRate?: number }) {
  const rate = winRate ?? 50;
  if (rank <= 3 || rate >= 65) return (
    <div className="flex items-center gap-0.5 text-green-400 text-[10px] font-bold">
      <TrendingUp className="w-3 h-3" />
      <span className="hidden sm:inline">Up</span>
    </div>
  );
  if (rate < 35) return (
    <div className="flex items-center gap-0.5 text-red-400 text-[10px] font-bold">
      <TrendingDown className="w-3 h-3" />
      <span className="hidden sm:inline">Down</span>
    </div>
  );
  return (
    <div className="flex items-center gap-0.5 text-white/25 text-[10px]">
      <Minus className="w-3 h-3" />
    </div>
  );
}

function StreakBadge({ wins }: { wins: number }) {
  if (wins < 5) return null;
  const streak = wins >= 20 ? wins : Math.floor(wins / 3);
  if (streak < 3) return null;
  return (
    <div className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded-full"
      style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.25)" }}>
      <Flame className="w-2.5 h-2.5 text-orange-400" />
      <span className="text-[9px] font-bold text-orange-400">{streak}</span>
    </div>
  );
}

// ─── YOU ARE #X Hero ──────────────────────────────────────────────────────────
function UserRankHero({ data, userId }: { data: LeaderboardEntry[] | undefined; userId?: string }) {
  const [, navigate] = useLocation();
  if (!data || !userId) return null;
  const idx = data.findIndex(e => e.userId === userId);
  if (idx === -1) return null;

  const rank = idx + 1;
  const entry = data[idx];
  const total = data.length;
  const cfg = getRankConfig(entry.overallRating ?? 0);
  const pct = getRatingProgress(entry.overallRating ?? 0);

  // How many wins from Top 10?
  const top10 = data[9];
  const toTop10 = top10 && top10.userId !== userId
    ? Math.max(0, top10.wins - entry.wins + 1)
    : null;

  // Next target (player just above)
  const nextEntry = idx > 0 ? data[idx - 1] : null;
  const ratingGap = nextEntry && entry.overallRating && nextEntry.overallRating
    ? nextEntry.overallRating - entry.overallRating
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative overflow-hidden rounded-2xl p-5 md:p-6 mb-2"
      style={{
        background: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.07) 60%, rgba(14,165,233,0.05) 100%)",
        border: "1.5px solid rgba(99,102,241,0.25)",
        animation: "rankGlow 3s ease-in-out infinite",
      }}
      data-testid="user-rank-hero"
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 80% at 90% 50%, rgba(99,102,241,0.08) 0%, transparent 70%)" }} />

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Main rank display */}
        <div className="flex items-center gap-4 flex-1">
          <div>
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-0.5">Your Rank</p>
            <div className="flex items-baseline gap-2">
              <span
                className="text-5xl font-black text-white font-mono leading-none"
                data-testid="text-your-rank"
                style={{ textShadow: "0 0 30px rgba(99,102,241,0.5)" }}
              >
                #{rank}
              </span>
              <span className="text-sm text-white/30 font-medium">of {total}</span>
            </div>
            {toTop10 !== null && rank > 10 && (
              <p className="text-xs text-primary/80 mt-1">
                <span className="font-bold text-primary">{toTop10} win{toTop10 !== 1 ? "s" : ""}</span> from Top 10
              </p>
            )}
            {rank <= 10 && (
              <p className="text-xs text-green-400 mt-1 font-semibold">You are in the Top 10</p>
            )}
          </div>

          {/* Rating & progress */}
          {entry.overallRating != null && (
            <div className="flex-1 max-w-[180px] hidden sm:block">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                <span className="text-[11px] font-mono text-white/50">{entry.overallRating}</span>
              </div>
              <div className="h-1.5 bg-white/8 progress-glow">
                <motion.div
                  className="h-full rank-bar-fill"
                  style={{ boxShadow: `0 0 10px ${cfg.color}80` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                />
              </div>
              <p className="text-[10px] text-white/30 mt-1">{entry.winRate}% win rate · {entry.wins}W {entry.losses}L</p>
            </div>
          )}
        </div>

        {/* Next target / climb CTA */}
        {nextEntry && (
          <div className="flex items-center gap-3 rounded-xl px-4 py-3 shrink-0"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="text-center">
              <p className="text-[10px] text-white/35 uppercase tracking-widest mb-0.5">Next Target</p>
              <p className="text-sm font-bold text-white">#{rank - 1} {nextEntry.userName}</p>
              {ratingGap !== null && ratingGap > 0 && (
                <p className="text-[11px] text-primary/80 mt-0.5">
                  +{ratingGap} pts needed
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-primary/30 text-primary"
              onClick={() => navigate("/")}
              data-testid="button-challenge-next"
            >
              <Swords className="w-3 h-3" />
              Play
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Top-3 Podium Cards ───────────────────────────────────────────────────────
function PodiumCard({ entry, rank, isCurrentUser, metric }: {
  entry: LeaderboardEntry;
  rank: number;
  isCurrentUser: boolean;
  metric: "winRate" | "winnings";
}) {
  const cfg = getRankConfig(entry.overallRating ?? 0);
  const gradients = [
    "linear-gradient(160deg, rgba(234,179,8,0.15) 0%, rgba(234,179,8,0.04) 60%, transparent 100%)",
    "linear-gradient(160deg, rgba(148,163,184,0.12) 0%, rgba(148,163,184,0.03) 60%, transparent 100%)",
    "linear-gradient(160deg, rgba(180,83,9,0.12) 0%, rgba(180,83,9,0.03) 60%, transparent 100%)",
  ];
  const borders = ["rgba(234,179,8,0.35)", "rgba(148,163,184,0.25)", "rgba(180,83,9,0.28)"];
  const anims = ["goldPulse 2.5s ease-in-out infinite", "silverGlow 3s ease-in-out infinite", "bronzeGlow 3.5s ease-in-out infinite"];
  const labelColors = ["text-yellow-400", "text-slate-300", "text-orange-500"];
  const labels = ["1st Place", "2nd Place", "3rd Place"];
  const heights = ["h-28", "h-24", "h-22"];
  const idx = rank - 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.1, type: "spring", stiffness: 200, damping: 20 }}
      className={`relative rounded-2xl flex flex-col items-center justify-end pb-4 px-3 pt-4 ${heights[idx] ?? "h-24"} ${isCurrentUser ? "ring-1 ring-primary/60" : ""}`}
      style={{
        background: gradients[idx],
        border: `1.5px solid ${borders[idx]}`,
        animation: anims[idx],
        minWidth: 100,
        flex: 1,
      }}
      data-testid={`podium-card-${rank}`}
    >
      {rank === 1 && (
        <motion.div
          className="absolute -top-4 left-1/2 -translate-x-1/2"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <Crown className="w-7 h-7 text-yellow-400 drop-shadow-[0_0_10px_rgba(234,179,8,0.9)]" />
        </motion.div>
      )}

      <div className="flex-shrink-0 mb-2 rounded-full">
        <RankedAvatar entry={entry} rank={rank} />
      </div>

      <Link href={`/profile/${entry.userId}`} className="text-center">
        <p className={`text-xs font-bold text-white truncate max-w-[90px] ${isCurrentUser ? "text-primary" : ""}`}>
          {entry.userName}
        </p>
      </Link>

      {isCurrentUser && (
        <span className="text-[8px] font-black text-primary/80 bg-primary/10 px-1.5 rounded mt-0.5">YOU</span>
      )}

      <p className={`text-[10px] font-bold mt-0.5 ${labelColors[idx]}`}>{labels[idx]}</p>

      <div className="mt-1.5 text-center">
        {metric === "winRate" ? (
          <p className="text-base font-black text-white font-mono">{entry.winRate}%</p>
        ) : (
          <p className="text-base font-black text-green-400 font-mono">
            ${parseFloat((entry as any).totalWinnings || "0").toFixed(0)}
          </p>
        )}
      </div>

      {entry.overallRating && (
        <div className="mt-1">
          <RankBadge rating={entry.overallRating} size="sm" showLabel={false} />
        </div>
      )}
    </motion.div>
  );
}

// ─── Skeletons / Empty ────────────────────────────────────────────────────────
function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <Skeleton className="w-11 h-11 rounded-full flex-shrink-0" />
      <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-16 hidden sm:block" />
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

function EmptyState({ onPlay }: { onPlay?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {/* Animated ghost leaderboard rows */}
      <div className="w-full max-w-xs mb-6 space-y-2 opacity-25 pointer-events-none">
        {[80, 60, 45].map((w, i) => (
          <motion.div
            key={i}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5"
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }}
          >
            <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0" />
            <div className="h-2.5 rounded-full bg-white/15 flex-1" style={{ maxWidth: `${w}%` }} />
            <div className="h-5 w-10 rounded bg-white/10" />
          </motion.div>
        ))}
      </div>
      <Trophy className="w-10 h-10 text-white/15 mb-3" />
      <h3 className="text-base font-semibold mb-1 text-white/60">No Rankings Yet</h3>
      <p className="text-sm text-white/30 max-w-xs mb-4">Play 3 matches to get ranked and claim your spot on the board.</p>
      {onPlay && (
        <Button size="sm" onClick={onPlay} className="gap-1.5" data-testid="button-play-now-empty">
          <Zap className="w-3.5 h-3.5" />Play Now
        </Button>
      )}
    </div>
  );
}

// ─── Standard rows (ranks 4+) ─────────────────────────────────────────────────
function StandardRows({
  data,
  isLoading,
  userId,
  hotFilter,
}: {
  data: LeaderboardEntry[] | undefined;
  isLoading: boolean;
  userId?: string;
  hotFilter: HotFilter;
}) {
  const [, navigate] = useLocation();

  if (isLoading) return <div>{[...Array(7)].map((_, i) => <RowSkeleton key={i} />)}</div>;
  if (!data || data.length === 0) return <EmptyState onPlay={() => navigate("/")} />;

  let remaining = data.slice(3);

  // Apply hot filters (client-side simulation)
  if (hotFilter === "hot")    remaining = remaining.filter(e => e.wins >= 5 && e.winRate >= 55);
  if (hotFilter === "earners") remaining = [...remaining].sort((a, b) => (b.wins * 2) - (a.wins * 2));
  if (hotFilter === "rising")  remaining = remaining.filter(e => e.winRate >= 50 && e.totalMatches >= 3);

  if (!remaining.length) return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-white/30 text-sm">
      No players match this filter right now.
    </div>
  );

  return (
    <div className="space-y-1 pt-1">
      {remaining.map((entry, idx) => {
        const rank = data.indexOf(entry) + 1;
        const isMe = entry.userId === userId;
        const cfg = getRankConfig(entry.overallRating ?? 0);
        const pct = getRatingProgress(entry.overallRating ?? 0);

        return (
          <motion.div
            key={entry.userId}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.03, duration: 0.2 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group cursor-pointer ${
              isMe
                ? "bg-primary/8 ring-1 ring-primary/30"
                : "hover-elevate"
            }`}
            data-testid={`leaderboard-row-${rank}`}
          >
            <RankCell rank={rank} />
            <RankedAvatar entry={entry} rank={rank} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/profile/${entry.userId}`}
                  className="font-semibold text-sm text-white/90 truncate hover:text-primary transition-colors"
                  data-testid={`player-name-${rank}`}>
                  {entry.userName}
                </Link>
                {isMe && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">You</Badge>}
                {entry.overallRating && <RankBadge rating={entry.overallRating} size="sm" showLabel={false} />}
                <StreakBadge wins={entry.wins} />
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-white/30">{entry.totalMatches}M · {entry.wins}W · {entry.losses}L</span>
                {entry.overallRating != null && (
                  <div className="flex items-center gap-1.5 max-w-[100px]">
                    <div className="flex-1 h-0.5 rounded-full overflow-hidden bg-white/8 progress-glow">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cfg.color, opacity: 0.7 }} />
                    </div>
                    <span className="text-[9px] font-mono" style={{ color: cfg.color }}>{entry.overallRating}</span>
                  </div>
                )}
              </div>
            </div>

            <RankTrend rank={rank} winRate={entry.winRate} />

            <div className="flex flex-col items-end shrink-0 min-w-[52px]">
              <span
                className={`text-lg font-black font-mono leading-none ${
                  entry.winRate >= 60 ? "text-green-400" : entry.winRate >= 40 ? "text-primary" : "text-white/40"
                }`}
                data-testid={`winrate-${rank}`}
              >
                {entry.winRate}%
              </span>
              <span className="text-[10px] text-white/30">Win rate</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Money rows ───────────────────────────────────────────────────────────────
function MoneyRows({ data, isLoading, userId }: { data: MoneyEntry[] | undefined; isLoading: boolean; userId?: string }) {
  const [, navigate] = useLocation();
  if (isLoading) return <div>{[...Array(7)].map((_, i) => <RowSkeleton key={i} />)}</div>;
  if (!data || data.length === 0) return <EmptyState onPlay={() => navigate("/")} />;

  return (
    <div className="space-y-1 pt-1">
      {data.map((entry, idx) => {
        const rank = idx + 1;
        const isMe = entry.userId === userId;
        const amount = parseFloat(entry.totalWinnings || "0");
        return (
          <motion.div
            key={entry.userId}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.03, duration: 0.2 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              isMe ? "bg-primary/8 ring-1 ring-primary/30" : "hover-elevate"
            }`}
            data-testid={`money-row-${rank}`}
          >
            <RankCell rank={rank} />
            <RankedAvatar entry={{ userName: entry.username, profileImageUrl: null }} rank={rank} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Link href={`/profile/${entry.userId}`} className="font-semibold text-sm text-white/90 truncate hover:text-primary transition-colors">
                  {entry.username}
                </Link>
                {isMe && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">You</Badge>}
              </div>
              <div className="text-xs text-white/30 mt-0.5">Total earnings</div>
            </div>
            <div className="flex flex-col items-end shrink-0">
              <span className="text-lg font-black font-mono text-green-400" data-testid={`earnings-${rank}`}>
                ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-white/30">Won</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Live Activity Feed ───────────────────────────────────────────────────────
interface ActivityItem {
  matchId: string;
  player1Name: string;
  player2Name?: string;
  gameType: string;
  result?: string;
  potAmount?: string;
  createdAt?: string;
}

function LiveActivityFeed() {
  const { data: items = [] } = useQuery<ActivityItem[]>({
    queryKey: ["/api/activity/recent"],
    refetchInterval: 8_000,
  });

  if (!items.length) return null;

  return (
    <div
      className="rounded-xl border border-white/8 p-4 space-y-3"
      style={{ background: "rgba(255,255,255,0.02)" }}
      data-testid="live-activity-feed"
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-xs font-bold text-white/70 uppercase tracking-widest">Live Activity</span>
      </div>
      <div className="space-y-2">
        {items.slice(0, 6).map((item, i) => {
          const game = item.gameType?.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) ?? "Match";
          const amount = item.potAmount ? parseFloat(item.potAmount) : 0;
          return (
            <motion.div
              key={`${item.matchId}-${i}`}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.18 }}
              className="flex items-center gap-2 text-xs"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-primary/50 flex-shrink-0" />
              <span className="text-white/60 truncate">
                <span className="text-white/85 font-medium">{item.player1Name}</span>
                {item.player2Name && (
                  <> vs <span className="text-white/85 font-medium">{item.player2Name}</span></>
                )}
                {" — "}<span className="text-white/40">{game}</span>
              </span>
              {amount > 0 && (
                <span className="text-green-400 font-bold font-mono flex-shrink-0 flex items-center gap-0.5">
                  <ScalpsIcon size="xs" />{amount.toFixed(0)}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Leaderboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabId>("global");
  const [period, setPeriod] = useState<Period>("all");
  const [scope, setScope] = useState<Scope>("global");
  const [hotFilter, setHotFilter] = useState<HotFilter>("none");
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const activeTabConfig = TABS.find(t => t.id === activeTab)!;

  const leaderboardUrl = (() => {
    if (activeTab === "global") return `/api/leaderboard${period !== "all" ? `?period=${period}` : ""}`;
    if (activeTab === "money")  return "/api/leaderboard/money/top";
    return `/api/leaderboard/${activeTab}${period !== "all" ? `?period=${period}` : ""}`;
  })();

  const { data, isLoading } = useQuery<LeaderboardEntry[] | MoneyEntry[]>({
    queryKey: [leaderboardUrl, activeTab, period, scope],
  });

  const scrollTabs = (dir: "left" | "right") => {
    if (!tabScrollRef.current) return;
    tabScrollRef.current.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  };

  const top3 = activeTab !== "money" ? (data as LeaderboardEntry[] | undefined)?.slice(0, 3) ?? [] : [];
  const totalEntries = data?.length ?? 0;

  // Platform activity
  const { data: activityItems = [] } = useQuery<ActivityItem[]>({
    queryKey: ["/api/activity/recent"],
    refetchInterval: 8_000,
  });

  return (
    <div className="min-h-screen glass-bg relative">
      <PageDepthBackground
        glowZones={[
          { x: "50%", y: "0%",  color: "234,179,8",   size: "65%", opacity: 0.08 },
          { x: "10%", y: "20%", color: "59,130,246",  size: "40%", opacity: 0.05 },
          { x: "90%", y: "30%", color: "139,92,246",  size: "35%", opacity: 0.04 },
        ]}
        particleCount={22}
      />
      <InjectLeaderboardCSS />
      <AppNavbar />
      <PageHero
        title="Leaderboard"
        subtitle="Rankings across every game on the platform"
        motif="leaderboard"
      />

      <div className="max-w-5xl mx-auto px-4 md:px-8 -mt-2">
        <Link href="/rank-progression">
          <a
            data-testid="link-rank-progression"
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-primary/30 bg-primary/10 hover-elevate active-elevate-2"
          >
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-primary" />
              <div>
                <div className="text-sm font-semibold">Your Rank Progression & Rewards</div>
                <div className="text-xs text-muted-foreground">View tier ladder, unlock cosmetics, and track your climb</div>
              </div>
            </div>
            <span className="text-primary text-sm font-medium">Open →</span>
          </a>
        </Link>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 md:py-8 space-y-5">

        {/* ── YOU ARE #X Hero ─────────────────────────────────── */}
        {activeTab !== "money" && !isLoading && (
          <UserRankHero
            data={data as LeaderboardEntry[] | undefined}
            userId={user?.id}
          />
        )}

        {/* ── Season Banner ────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 rounded-xl"
          style={{
            background: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 100%)",
            border: "1px solid rgba(99,102,241,0.2)",
          }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(99,102,241,0.2)" }}>
              <Flame className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Season 1 — Active</p>
              <p className="text-xs text-white/35">Earn your rank · resets every 90 days</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Platform activity meter */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="text-[10px] text-white/30 uppercase tracking-widest">Platform</div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full"
                style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] font-bold text-green-400">
                  {activityItems.length > 3 ? "HIGH" : activityItems.length > 0 ? "ACTIVE" : "LIVE"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-white/30">
              <Calendar className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">90-day season</span>
            </div>
          </div>
        </div>

        {/* ── Two-column: tabs + activity feed ─────────────────── */}
        <div className="flex gap-5">
          <div className="flex-1 min-w-0 space-y-5">

            {/* Game Tab Selector */}
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-2.5">
              <div className="relative flex items-center gap-1">
                <Button size="icon" variant="ghost" className="flex-shrink-0"
                  onClick={() => scrollTabs("left")} data-testid="button-tabs-scroll-left">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div ref={tabScrollRef}
                  className="flex gap-1 overflow-x-auto scrollbar-none flex-1"
                  style={{ scrollbarWidth: "none" }}
                  data-testid="leaderboard-game-tabs">
                  {TABS.map(({ id, label, Icon }) => {
                    const isActive = activeTab === id;
                    return (
                      <button key={id} onClick={() => { setActiveTab(id); setHotFilter("none"); }}
                        data-testid={`tab-${id}`}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-[0_0_12px_rgba(99,102,241,0.4)] tab-active-line"
                            : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                        }`}>
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </button>
                    );
                  })}
                </div>
                <Button size="icon" variant="ghost" className="flex-shrink-0"
                  onClick={() => scrollTabs("right")} data-testid="button-tabs-scroll-right">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-wrap">
              {/* Period + Scope pills */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {(["all", "monthly", "weekly"] as Period[]).map(p => (
                    <button key={p} onClick={() => setPeriod(p)} data-testid={`filter-period-${p}`}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        period === p
                          ? "bg-white/10 text-white shadow-sm"
                          : "text-white/35 hover:text-white/60"
                      }`}>
                      {p === "all" ? "All Time" : p === "monthly" ? "Monthly" : "Weekly"}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {([{ key: "global" as Scope, label: "Global", Icon: Globe }, { key: "friends" as Scope, label: "Friends", Icon: Users }]).map(({ key, label, Icon }) => (
                    <button key={key} onClick={() => setScope(key)} data-testid={`filter-scope-${key}`}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        scope === key ? "bg-white/10 text-white" : "text-white/35 hover:text-white/60"
                      }`}>
                      <Icon className="w-3.5 h-3.5" />{label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hot filters — only for non-money tabs */}
              {activeTab !== "money" && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {([
                    { key: "none" as HotFilter, label: "All Players", icon: null },
                    { key: "hot" as HotFilter, label: "Hot Streak", icon: Flame },
                    { key: "earners" as HotFilter, label: "Big Earners", icon: TrendingUp },
                    { key: "rising" as HotFilter, label: "Rising", icon: ChevronUp },
                  ]).map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setHotFilter(key)}
                      data-testid={`filter-hot-${key}`}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${
                        hotFilter === key
                          ? key === "hot"
                            ? "bg-orange-500/20 border-orange-500/40 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.2)]"
                            : key === "earners"
                            ? "bg-green-500/20 border-green-500/40 text-green-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                            : key === "rising"
                            ? "bg-blue-500/20 border-blue-500/40 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                            : "bg-white/10 border-white/20 text-white"
                          : "border-white/8 text-white/35 hover:text-white/60 hover:border-white/15"
                      }`}
                    >
                      {Icon && <Icon className="w-2.5 h-2.5" />}
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeTab}-${period}-${hotFilter}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
              >
                {/* Top-3 Podium (non-money tabs) */}
                {activeTab !== "money" && !isLoading && top3.length >= 2 && hotFilter === "none" && (
                  <div className="mb-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-yellow-500/25 to-transparent" />
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full"
                        style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)" }}>
                        <Crown className="w-3 h-3 text-yellow-400" />
                        <span className="text-[11px] font-bold text-yellow-400/80 uppercase tracking-widest">Top Players</span>
                      </div>
                      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-yellow-500/25 to-transparent" />
                    </div>

                    {/* 2nd | 1st | 3rd */}
                    <div className="flex items-end gap-3 justify-center">
                      {top3[1] && (
                        <Magnetic3D maxTilt={4} className="flex-1 max-w-[140px]">
                          <PodiumCard entry={top3[1]} rank={2} isCurrentUser={top3[1].userId === user?.id} metric="winRate" />
                        </Magnetic3D>
                      )}
                      {top3[0] && (
                        <Magnetic3D maxTilt={5} className="flex-1 max-w-[160px] relative">
                          {/* Gold spotlight behind #1 */}
                          <div className="leaderboard-spotlight" aria-hidden="true" />
                          <PodiumCard entry={top3[0]} rank={1} isCurrentUser={top3[0].userId === user?.id} metric="winRate" />
                        </Magnetic3D>
                      )}
                      {top3[2] && (
                        <Magnetic3D maxTilt={4} className="flex-1 max-w-[130px]">
                          <PodiumCard entry={top3[2]} rank={3} isCurrentUser={top3[2].userId === user?.id} metric="winRate" />
                        </Magnetic3D>
                      )}
                    </div>
                  </div>
                )}

                {/* Main list */}
                <div className="rounded-2xl border border-white/8 overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.02)" }}>
                  {/* Header */}
                  <div className="px-5 pt-4 pb-3 border-b border-white/6 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <activeTabConfig.Icon className="w-4 h-4 text-primary" />
                      <span className="font-bold text-white text-sm">{activeTabConfig.label} Rankings</span>
                      {period !== "all" && (
                        <Badge variant="outline" className="text-[10px] border-white/15 text-white/40 capitalize">{period}</Badge>
                      )}
                      {hotFilter !== "none" && (
                        <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-400 capitalize">
                          {hotFilter === "hot" ? "Hot Streak" : hotFilter === "earners" ? "Big Earners" : "Rising"}
                        </Badge>
                      )}
                    </div>
                    {!isLoading && (
                      <span className="text-xs text-white/25">{totalEntries} player{totalEntries !== 1 ? "s" : ""}</span>
                    )}
                  </div>

                  {/* Column headers */}
                  <div className="flex items-center gap-3 px-5 py-2 text-[10px] text-white/20 font-semibold uppercase tracking-wider border-b border-white/4">
                    <div className="w-11 text-center">Rank</div>
                    <div className="w-10 flex-shrink-0" />
                    <div className="flex-1">Player</div>
                    <div className="hidden sm:block w-8 text-center">↑↓</div>
                    <div className="hidden sm:block w-20 text-right">W / L</div>
                    <div className="w-[58px] text-right">{activeTab === "money" ? "Earned" : "Win %"}</div>
                  </div>

                  {/* Rows */}
                  <div className="p-2">
                    {activeTab === "money" ? (
                      <MoneyRows data={data as MoneyEntry[] | undefined} isLoading={isLoading} userId={user?.id} />
                    ) : isLoading ? (
                      <div>{[...Array(7)].map((_, i) => <RowSkeleton key={i} />)}</div>
                    ) : !data || (data as LeaderboardEntry[]).length === 0 ? (
                      <EmptyState onPlay={() => navigate("/")} />
                    ) : (
                      <>
                        {/* Top-3 compact rows */}
                        {hotFilter === "none" && (data as LeaderboardEntry[]).slice(0, 3).map((entry, idx) => {
                          const rank = idx + 1;
                          const isMe = entry.userId === user?.id;
                          const cfg = getRankConfig(entry.overallRating ?? 0);
                          const pct = getRatingProgress(entry.overallRating ?? 0);
                          const topBg = rank === 1 ? "bg-yellow-500/[0.06]" : rank === 2 ? "bg-slate-400/[0.05]" : "bg-orange-700/[0.05]";

                          return (
                            <motion.div
                              key={entry.userId}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.05, duration: 0.2 }}
                              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl mb-1 group ${topBg} ${isMe ? "ring-1 ring-primary/30" : ""}`}
                              data-testid={`leaderboard-row-${rank}`}
                            >
                              <RankCell rank={rank} />
                              <RankedAvatar entry={entry} rank={rank} />

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Link href={`/profile/${entry.userId}`}
                                    className="font-bold text-sm text-white truncate hover:text-primary transition-colors"
                                    data-testid={`player-name-${rank}`}>
                                    {entry.userName}
                                  </Link>
                                  {isMe && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">You</Badge>}
                                  {entry.overallRating && <RankBadge rating={entry.overallRating} size="sm" showLabel={false} />}
                                  <StreakBadge wins={entry.wins} />
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-xs text-white/30">{entry.totalMatches}M · {entry.wins}W · {entry.losses}L</span>
                                  {entry.overallRating != null && (
                                    <div className="flex items-center gap-1.5 max-w-[100px]">
                                      <div className="flex-1 h-0.5 rounded-full overflow-hidden bg-white/8">
                                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cfg.color, opacity: 0.7 }} />
                                      </div>
                                      <span className="text-[9px] font-mono" style={{ color: cfg.color }}>{entry.overallRating}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <RankTrend rank={rank} winRate={entry.winRate} />

                              <div className="hidden sm:flex flex-col items-end shrink-0">
                                <span className="text-xs text-white/30">{entry.wins}W</span>
                                <span className="text-xs text-white/20">{entry.losses}L</span>
                              </div>

                              <div className="flex flex-col items-end shrink-0 min-w-[52px]">
                                <span
                                  className={`text-lg font-black font-mono leading-none ${
                                    entry.winRate >= 60 ? "text-green-400" : entry.winRate >= 40 ? "text-primary" : "text-white/40"
                                  }`}
                                  data-testid={`winrate-${rank}`}
                                >
                                  {entry.winRate}%
                                </span>
                                <span className="text-[10px] text-white/25">Win rate</span>
                              </div>
                            </motion.div>
                          );
                        })}

                        {/* Divider */}
                        {hotFilter === "none" && (data as LeaderboardEntry[]).length > 3 && (
                          <div className="flex items-center gap-3 my-2 px-4">
                            <div className="h-px flex-1 bg-white/6" />
                            <span className="text-[10px] text-white/20 font-semibold uppercase tracking-widest">All Players</span>
                            <div className="h-px flex-1 bg-white/6" />
                          </div>
                        )}

                        <StandardRows
                          data={data as LeaderboardEntry[] | undefined}
                          isLoading={false}
                          userId={user?.id}
                          hotFilter={hotFilter}
                        />
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── Right sidebar: Activity Feed ─────────── */}
          <div className="hidden lg:block w-64 shrink-0 space-y-4">
            <LiveActivityFeed />

            {/* Quick stats */}
            <div className="rounded-xl border border-white/8 p-4 space-y-3"
              style={{ background: "rgba(255,255,255,0.02)" }}>
              <p className="text-xs font-bold text-white/50 uppercase tracking-widest">Quick Stats</p>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Total Players</span>
                  <span className="font-bold text-white">{totalEntries}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Season</span>
                  <span className="font-bold text-primary">Season 1</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Resets In</span>
                  <span className="font-bold text-white/70">90 days</span>
                </div>
              </div>
              <Button size="sm" className="w-full mt-2 gap-1.5" onClick={() => navigate("/")} data-testid="button-play-from-leaderboard">
                <Zap className="w-3.5 h-3.5" />Play Now
              </Button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-white/20 pb-4">
          Rankings update in real time · Minimum 3 matches required to appear
        </p>
      </div>
    </div>
  );
}
