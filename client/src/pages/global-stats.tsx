import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Trophy, DollarSign, Zap, Shield, ChevronLeft, ChevronRight,
  Users, Flame, Crown, TrendingUp, Activity, CheckCircle2,
  Swords, BarChart3, ArrowUpRight, Star,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AppNavbar } from "@/components/AppNavbar";
import { formatDistanceToNow } from "date-fns";
import { gameIcons, gameLabels } from "@/components/GameIcons";
import type { MatchWithPlayers } from "@shared/schema";
import { ScalpsIcon } from "@/components/ScalpsIcon";
import { PageDepthBackground } from "@/components/PageDepthBackground";

// ─── Types ────────────────────────────────────────────────────────────────────
interface GlobalStatsData {
  totalMatches: number;
  totalWinnings: string;
  liveGamesCount: number;
}

interface FairPlayEntry extends MatchWithPlayers {
  verificationHash: string;
}

interface RecentActivity {
  matchId: string;
  gameType: string;
  potAmount: string;
  winnerName: string;
  loserName: string;
  completedAt: string;
}

interface BigWin {
  id: string;
  user_id: string;
  amount: string;
  created_at: string;
  match_id: string;
  username: string | null;
  first_name: string | null;
  profile_image_url: string | null;
  game_type: string | null;
}

interface OnlineStats {
  count: number;
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1400, enabled = true) {
  const [val, setVal] = useState(0);
  const frameRef = useRef<number>();
  useEffect(() => {
    if (!enabled || target === 0) { setVal(target); return; }
    let start = 0;
    const step = target / (duration / 16);
    const tick = () => {
      start += step;
      if (start >= target) { setVal(target); return; }
      setVal(Math.floor(start));
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration, enabled]);
  return val;
}

// ─── Glow CSS injected once ───────────────────────────────────────────────────
const STATS_CSS = `
@keyframes statPulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
  50%      { box-shadow: 0 0 0 8px rgba(99,102,241,0.08), 0 0 32px rgba(99,102,241,0.12); }
}
@keyframes goldPulseCard {
  0%,100% { box-shadow: 0 0 0 0 rgba(234,179,8,0), 0 0 20px rgba(234,179,8,0.15); }
  50%      { box-shadow: 0 0 0 6px rgba(234,179,8,0.06), 0 0 36px rgba(234,179,8,0.3); }
}
@keyframes activitySlide {
  from { opacity: 0; transform: translateX(16px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes energyFlow {
  0%   { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}
`;
function InjectStatsCSS() {
  useEffect(() => {
    const id = "global-stats-css";
    if (!document.getElementById(id)) {
      const s = document.createElement("style");
      s.id = id; s.textContent = STATS_CSS;
      document.head.appendChild(s);
    }
  }, []);
  return null;
}

// ─── Hero Metric Card ─────────────────────────────────────────────────────────
function HeroMetricCard({
  icon: Icon,
  label,
  value,
  sub,
  colorClass,
  glowColor,
  delay = 0,
  isLoading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  colorClass: string;
  glowColor: string;
  delay?: number;
  isLoading?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 180, damping: 22 }}
      className="card-depth relative overflow-hidden rounded-2xl p-5 flex flex-col gap-3 magnetic-shimmer hover-elevate"
      style={{
        background: `radial-gradient(ellipse 80% 70% at 0% 0%, ${glowColor}18 0%, transparent 60%)`,
        border: `1px solid ${glowColor}25`,
        animation: "statPulse 3s ease-in-out infinite",
      }}
      data-testid={`metric-card-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {/* Background radial */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(circle 120px at 90% 90%, ${glowColor}08 0%, transparent 70%)` }} />

      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center icon-bounce-on-click`}
          style={{ background: `${glowColor}15`, border: `1px solid ${glowColor}30` }}>
          <Icon className={`w-5 h-5 ${colorClass}`} />
        </div>
        {sub && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#34d399" }}>
            <TrendingUp className="w-2.5 h-2.5" />{sub}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      ) : (
        <div>
          <div className={`text-4xl font-black font-mono leading-none stat-pop ${colorClass}`}
            data-testid={`metric-value-${label.toLowerCase().replace(/\s+/g, "-")}`}>
            {value}
          </div>
          <p className="text-xs text-white/35 mt-1.5 font-medium">{label}</p>
        </div>
      )}
    </motion.div>
  );
}

// ─── Platform Energy Bar ──────────────────────────────────────────────────────
function PlatformEnergyBar({ liveGames, online }: { liveGames: number; online: number }) {
  const energy = Math.min(100, (liveGames * 15) + (online * 5));
  const label = energy >= 70 ? "HIGH" : energy >= 35 ? "ACTIVE" : energy >= 10 ? "MODERATE" : "LIVE";
  const color = energy >= 70 ? "#f97316" : energy >= 35 ? "#22c55e" : energy >= 10 ? "#3b82f6" : "#6366f1";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="rounded-2xl p-5"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
      data-testid="platform-energy-bar"
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-white/80">Platform Activity</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} />
          <span className="text-xs font-black uppercase tracking-widest" style={{ color }}>{label}</span>
        </div>
      </div>

      <div className="relative h-3 rounded-full bg-white/8 overflow-hidden mb-2">
        <motion.div
          className="h-full rounded-full relative overflow-hidden"
          style={{ background: `linear-gradient(90deg, ${color}80, ${color}, ${color}80)` }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(4, energy)}%` }}
          transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
        >
          {/* Shimmer */}
          <div className="absolute inset-0"
            style={{
              backgroundImage: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
              backgroundSize: "200% 100%",
              animation: "energyFlow 2s linear infinite",
            }} />
        </motion.div>
      </div>

      <div className="flex justify-between text-[10px] text-white/25 font-medium">
        <span>{liveGames} live game{liveGames !== 1 ? "s" : ""}</span>
        <span>{online} player{online !== 1 ? "s" : ""} online</span>
        <span>{energy}% capacity</span>
      </div>
    </motion.div>
  );
}

// ─── Live Activity Feed ───────────────────────────────────────────────────────
function LiveActivityFeed({ items }: { items: RecentActivity[] }) {
  const prevRef = useRef<string[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ids = items.map(i => i.matchId);
    const fresh = ids.filter(id => !prevRef.current.includes(id));
    if (fresh.length) setNewIds(new Set(fresh));
    prevRef.current = ids;
    const t = setTimeout(() => setNewIds(new Set()), 3000);
    return () => clearTimeout(t);
  }, [items]);

  return (
    <div
      className="rounded-2xl border border-white/8 overflow-hidden h-full"
      style={{ background: "rgba(255,255,255,0.02)" }}
      data-testid="live-activity-feed"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/6">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-xs font-bold text-white/70 uppercase tracking-widest">Live Feed</span>
        <div className="ml-auto text-[10px] text-white/25">auto-updates</div>
      </div>

      <div className="p-3 space-y-2 overflow-y-auto max-h-[420px]">
        <AnimatePresence>
          {items.length === 0 ? (
            <div className="text-center py-8 text-white/25 text-xs">
              <Activity className="w-6 h-6 mx-auto mb-2 opacity-40" />
              Waiting for matches…
            </div>
          ) : (
            items.map((item, i) => {
              const isNew = newIds.has(item.matchId);
              const game = item.gameType?.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) ?? "Match";
              const pot = parseFloat(item.potAmount || "0");
              const GameIcon = gameIcons[item.gameType as keyof typeof gameIcons];

              return (
                <motion.div
                  key={item.matchId}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ delay: i * 0.04, duration: 0.2 }}
                  className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg transition-all ${
                    isNew ? "ring-1 ring-green-500/30" : ""
                  }`}
                  style={{
                    background: isNew ? "rgba(16,185,129,0.06)" : "rgba(255,255,255,0.02)",
                  }}
                  data-testid={`activity-item-${item.matchId}`}
                >
                  {/* Game icon */}
                  <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 bg-primary/10">
                    {GameIcon ? <GameIcon className="w-4 h-4" /> : <Swords className="w-3.5 h-3.5 text-primary" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] leading-tight">
                      <span className="font-bold text-white/90">{item.winnerName}</span>
                      <span className="text-white/40"> beat </span>
                      <span className="text-white/70">{item.loserName}</span>
                    </p>
                    <p className="text-[10px] text-white/30 mt-0.5">{game}</p>
                  </div>

                  {pot > 0 && (
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <ScalpsIcon size="xs" />
                      <span className="text-[11px] font-black text-green-400 font-mono">{pot.toFixed(0)}</span>
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Big Wins Section ─────────────────────────────────────────────────────────
function BigWinsSection({ wins }: { wins: BigWin[] }) {
  if (!wins.length) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Crown className="w-4 h-4 text-amber-400 fill-amber-400/30" />
        <h2 className="font-bold text-base">Top Wins Today</h2>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-amber-400"
          style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.2)" }}>
          <Star className="w-2.5 h-2.5" />Biggest Payouts
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {wins.slice(0, 6).map((win, i) => {
          const amount = parseFloat(win.amount);
          const name = win.username ?? win.first_name ?? "Player";
          const GameIcon = win.game_type ? gameIcons[win.game_type as keyof typeof gameIcons] : null;
          const game = win.game_type ? gameLabels[win.game_type as keyof typeof gameLabels] ?? win.game_type : "Match";
          const initials = name.slice(0, 2).toUpperCase();
          const isTop = i === 0;

          return (
            <motion.div
              key={win.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, type: "spring", stiffness: 200, damping: 22 }}
              className="relative overflow-hidden rounded-xl p-4"
              style={{
                background: isTop
                  ? "linear-gradient(135deg, rgba(234,179,8,0.12) 0%, rgba(234,179,8,0.04) 100%)"
                  : "rgba(255,255,255,0.025)",
                border: isTop ? "1.5px solid rgba(234,179,8,0.3)" : "1px solid rgba(255,255,255,0.07)",
                animation: isTop ? "goldPulseCard 2.5s ease-in-out infinite" : undefined,
              }}
              data-testid={`big-win-card-${win.id}`}
            >
              {isTop && (
                <div className="absolute top-2 right-2">
                  <Crown className="w-4 h-4 text-amber-400 fill-amber-400/40" />
                </div>
              )}
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="w-9 h-9">
                  <AvatarFallback className="text-xs font-bold bg-primary/15 text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm truncate ${isTop ? "text-amber-300" : "text-white/90"}`}>{name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {GameIcon && <GameIcon className="w-3 h-3 text-white/30" />}
                    <span className="text-[10px] text-white/30 truncate">{game}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <ScalpsIcon size="sm" />
                <span
                  className={`text-2xl font-black font-mono ${isTop ? "text-amber-400" : "text-green-400"}`}
                  style={{ textShadow: isTop ? "0 0 20px rgba(234,179,8,0.5)" : undefined }}
                  data-testid={`big-win-amount-${win.id}`}
                >
                  {amount.toFixed(2)}
                </span>
              </div>
              <p className="text-[10px] text-white/25 mt-1">
                {win.created_at ? formatDistanceToNow(new Date(win.created_at), { addSuffix: true }) : ""}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Fair Play Cards ──────────────────────────────────────────────────────────
function FairPlayCards({
  log,
  isLoading,
  page,
  setPage,
  perPage,
}: {
  log: FairPlayEntry[] | undefined;
  isLoading: boolean;
  page: number;
  setPage: (p: number) => void;
  perPage: number;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="rounded-xl border border-white/7 bg-white/[0.02] p-4 space-y-2 animate-pulse">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>
        </div>
      ))}
    </div>
  );

  if (!log || log.length === 0) return (
    <div className="text-center py-12 rounded-2xl border border-white/7 bg-white/[0.02]">
      <Shield className="w-10 h-10 mx-auto mb-3 text-white/20" />
      <p className="text-sm text-white/35 font-medium">No verified matches yet</p>
      <p className="text-xs text-white/20 mt-1">Complete PvP matches to appear here</p>
    </div>
  );

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {log.map((match, i) => {
          const GameIcon = gameIcons[match.gameType as keyof typeof gameIcons];
          const p1 = match.player1?.firstName ?? match.player1?.email?.split("@")[0] ?? "Unknown";
          const p2 = match.player2?.firstName ?? match.player2?.email?.split("@")[0] ?? "Unknown";
          const winnerId = match.winnerId;
          const winnerName = winnerId === match.player1Id ? p1 : winnerId === match.player2Id ? p2 : null;
          const isOpen = expanded === match.id;
          const pot = parseFloat(match.potAmount ?? "0");
          const label = gameLabels[match.gameType as keyof typeof gameLabels] ?? match.gameType;

          return (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
              className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden"
              data-testid={`fair-play-card-${match.id}`}
            >
              <div
                className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
                onClick={() => setExpanded(isOpen ? null : match.id)}
              >
                {/* Game icon */}
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10 border border-primary/15">
                  {GameIcon ? <GameIcon className="w-5 h-5" /> : <Swords className="w-4 h-4 text-primary" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-white/85 truncate max-w-[80px]">{p1}</span>
                    <span className="text-[10px] text-white/30">vs</span>
                    <span className="text-[11px] font-bold text-white/85 truncate max-w-[80px]">{p2}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-white/30">{label}</span>
                    {pot > 0 && (
                      <span className="text-[10px] font-bold text-green-400 flex items-center gap-0.5">
                        <ScalpsIcon size="xs" />{pot.toFixed(0)}
                      </span>
                    )}
                    {match.completedAt && (
                      <span className="text-[10px] text-white/20">
                        {formatDistanceToNow(new Date(match.completedAt), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {winnerName ? (
                    <div className="px-2 py-0.5 rounded-md text-[10px] font-bold text-green-400"
                      style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                      {winnerName} wins
                    </div>
                  ) : (
                    <div className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white/40"
                      style={{ background: "rgba(255,255,255,0.05)" }}>
                      Draw
                    </div>
                  )}
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500/60" />
                </div>
              </div>

              {/* Expanded: hash + score */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3.5 pb-3.5 pt-1 border-t border-white/6 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-white/30">Score</span>
                        <span className="font-mono font-bold">
                          {match.player1Score ?? "—"} — {match.player2Score ?? "—"}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-[11px] text-white/30 shrink-0">Verification</span>
                        <code className="text-[10px] font-mono text-white/40 break-all text-right">
                          {match.verificationHash ?? "pending"}
                        </code>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-green-400/70">
                        <Shield className="w-3 h-3" />
                        Server-verified · tamper-proof
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/25">
          {page * perPage + 1}–{page * perPage + (log?.length ?? 0)} matches shown
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
            className="gap-1.5 border-white/15" data-testid="button-prev-page">
            <ChevronLeft className="w-4 h-4" />Prev
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={!log || log.length < perPage}
            className="gap-1.5 border-white/15" data-testid="button-next-page">
            Next<ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Game Distribution Chart ──────────────────────────────────────────────────
function GameDistributionChart({ log }: { log: FairPlayEntry[] | undefined }) {
  if (!log || log.length === 0) return null;

  const counts: Record<string, number> = {};
  for (const m of log) {
    counts[m.gameType] = (counts[m.gameType] ?? 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = sorted[0]?.[1] ?? 1;

  return (
    <div className="rounded-2xl border border-white/8 p-5"
      style={{ background: "rgba(255,255,255,0.02)" }}>
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-primary" />
        <h3 className="font-bold text-sm">Matches by Game</h3>
      </div>
      <div className="space-y-2.5">
        {sorted.map(([gameType, count], i) => {
          const pct = (count / max) * 100;
          const label = gameLabels[gameType as keyof typeof gameLabels] ?? gameType;
          const GameIcon = gameIcons[gameType as keyof typeof gameIcons];
          return (
            <div key={gameType} className="flex items-center gap-3">
              <div className="w-6 flex-shrink-0 flex items-center justify-center">
                {GameIcon ? <GameIcon className="w-3.5 h-3.5 text-white/40" /> : <Swords className="w-3.5 h-3.5 text-white/40" />}
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-white/60 font-medium">{label}</span>
                  <span className="text-white/35 font-mono">{count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: i === 0 ? "linear-gradient(90deg,#6366f1,#8b5cf6)" :
                                  i === 1 ? "linear-gradient(90deg,#3b82f6,#6366f1)" :
                                            "linear-gradient(90deg,#14b8a6,#3b82f6)",
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.7, delay: i * 0.08, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function GlobalStats() {
  const [page, setPage] = useState(0);
  const perPage = 20;

  const { data: stats, isLoading: statsLoading } = useQuery<GlobalStatsData>({
    queryKey: ["/api/stats/global"],
    refetchInterval: 30_000,
  });

  const { data: fairPlayLog, isLoading: logLoading } = useQuery<FairPlayEntry[]>({
    queryKey: ["/api/stats/fair-play-log", page],
    queryFn: async () => {
      const r = await fetch(`/api/stats/fair-play-log?limit=${perPage}&offset=${page * perPage}`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const { data: activityRaw = [] } = useQuery<RecentActivity[]>({
    queryKey: ["/api/activity/recent"],
    refetchInterval: 7_000,
  });

  const { data: bigWins = [] } = useQuery<BigWin[]>({
    queryKey: ["/api/wins/recent"],
    refetchInterval: 30_000,
  });

  const { data: onlineData } = useQuery<OnlineStats>({
    queryKey: ["/api/stats/online"],
    refetchInterval: 15_000,
  });

  const totalMatches = stats?.totalMatches ?? 0;
  const totalWinnings = parseFloat(stats?.totalWinnings ?? "0");
  const liveGames = stats?.liveGamesCount ?? 0;
  const online = onlineData?.count ?? 0;

  // Count-up animated values
  const animMatches  = useCountUp(totalMatches, 1200, !statsLoading);
  const animWinnings = useCountUp(Math.floor(totalWinnings), 1400, !statsLoading);
  const animLive     = useCountUp(liveGames, 800, !statsLoading);

  const HERO_CARDS = [
    {
      icon: Trophy,
      label: "Total Matches Played",
      value: animMatches.toLocaleString(),
      sub: "All time",
      colorClass: "text-primary",
      glowColor: "#6366f1",
      delay: 0,
    },
    {
      icon: DollarSign,
      label: "Total Winnings Paid Out",
      value: `$${animWinnings.toLocaleString()}`,
      sub: "To players",
      colorClass: "text-green-400",
      glowColor: "#22c55e",
      delay: 0.1,
    },
    {
      icon: Zap,
      label: "Live Games Right Now",
      value: animLive,
      sub: liveGames > 0 ? "In progress" : undefined,
      colorClass: "text-amber-400",
      glowColor: "#f59e0b",
      delay: 0.2,
    },
    {
      icon: Users,
      label: "Players Online",
      value: online,
      sub: online > 0 ? "Active now" : undefined,
      colorClass: "text-blue-400",
      glowColor: "#3b82f6",
      delay: 0.3,
    },
  ];

  return (
    <div className="min-h-screen glass-bg relative">
      <InjectStatsCSS />
      <PageDepthBackground
        glowZones={[
          { x: "50%", y: "5%",  color: "99,102,241",  size: "60%", opacity: 0.07 },
          { x: "85%", y: "25%", color: "139,92,246",  size: "40%", opacity: 0.05 },
          { x: "15%", y: "60%", color: "59,130,246",  size: "35%", opacity: 0.04 },
          { x: "60%", y: "80%", color: "255,45,138",  size: "30%", opacity: 0.03 },
        ]}
        particleCount={18}
      />
      <AppNavbar />

      {/* ── Page Hero ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-white/6">
        <div className="absolute inset-0 pointer-events-none opacity-20"
          style={{ background: "radial-gradient(ellipse 80% 120% at 50% -10%, #6366f1, #8b5cf6 40%, transparent 70%)" }} />
        <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-12">
          <div className="flex items-center gap-3 mb-1">
            <Activity className="w-7 h-7 text-primary" />
            <h1 className="text-3xl md:text-4xl font-black" data-testid="global-stats-title">Platform Stats</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Live system dashboard — match activity, winnings, and fair play verification
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-8">

        {/* ── Energy Bar ───────────────────────────────────────────── */}
        <PlatformEnergyBar liveGames={liveGames} online={online} />

        {/* ── Hero Metric Cards ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {HERO_CARDS.map(card => (
            <HeroMetricCard key={card.label} {...card} isLoading={statsLoading} />
          ))}
        </div>

        {/* ── Big Wins + Live Feed ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            {bigWins.length > 0
              ? <BigWinsSection wins={bigWins} />
              : (
                <div className="rounded-2xl border border-white/7 bg-white/[0.02] p-8 text-center">
                  <Crown className="w-10 h-10 mx-auto mb-3 text-amber-400/20" />
                  <p className="text-sm text-white/30 font-medium">Top Wins Today</p>
                  <p className="text-xs text-white/20 mt-1">No wins logged yet — be the first!</p>
                  <Link href="/">
                    <Button size="sm" className="mt-4 gap-1.5" data-testid="button-play-wins">
                      <Zap className="w-3.5 h-3.5" />Play Now
                    </Button>
                  </Link>
                </div>
              )
            }
          </div>
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <h2 className="font-bold text-base">Live Activity</h2>
            </div>
            <LiveActivityFeed items={activityRaw} />
          </div>
        </div>

        {/* ── Chart + Quick Stats ───────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <GameDistributionChart log={fairPlayLog} />

          {/* Quick stats grid */}
          <div className="rounded-2xl border border-white/8 p-5 space-y-4"
            style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-sm">Platform Summary</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Avg Pot Size", value: totalMatches > 0 ? `$${(totalWinnings / Math.max(totalMatches, 1)).toFixed(2)}` : "—", color: "text-green-400" },
                { label: "Platform Rake", value: "3%", color: "text-primary" },
                { label: "Games Tracked", value: String(new Set(fairPlayLog?.map(m => m.gameType) ?? []).size || "—"), color: "text-blue-400" },
                { label: "Season", value: "Season 1", color: "text-amber-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl p-3 text-center"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className={`text-xl font-black font-mono ${color}`}>{value}</div>
                  <div className="text-[10px] text-white/30 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
            <Link href="/leaderboard">
              <Button variant="outline" size="sm" className="w-full gap-1.5 border-white/15 mt-1"
                data-testid="button-view-leaderboard">
                <Trophy className="w-3.5 h-3.5" />View Leaderboard
              </Button>
            </Link>
          </div>
        </div>

        {/* ── Fair Play Log ─────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-400" />
              <h2 className="font-bold text-lg">Fair Play Log</h2>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold text-green-400"
              style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <CheckCircle2 className="w-3 h-3" />Server-verified · Cryptographic proof
            </div>
          </div>
          <p className="text-xs text-white/30 mb-4">
            Every match result is hashed server-side and stored immutably. Click any card to see the verification hash.
          </p>
          <FairPlayCards
            log={fairPlayLog}
            isLoading={logLoading}
            page={page}
            setPage={setPage}
            perPage={perPage}
          />
        </div>

        <p className="text-center text-xs text-white/15 pb-4">
          Jango.us · 3% platform rake · All results server-authoritative and tamper-proof
        </p>
      </div>
    </div>
  );
}
