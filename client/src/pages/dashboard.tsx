import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { UserStats, MatchWithPlayers, GameType } from "@shared/schema";
import { AppNavbar } from "@/components/AppNavbar";
import { PageHero } from "@/components/PageHero";
import { 
  Trophy, 
  Clock, 
  Trash2, 
  XCircle, 
  Award,
  Crown,
  Zap,
  Brain,
  Target,
  TrendingUp,
  Shield,
  Network,
  Sword,
  Flame,
  Sparkles,
  Star,
  Medal,
  DollarSign,
  Calendar,
  Boxes,
  type LucideIcon
} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import UserStatsCard from "@/components/UserStatsCard";
import TransactionHistory from "@/components/TransactionHistory";
import { PlayerStatsHUD } from "@/components/PlayerStatsHUD";
import { AnimatedBalance } from "@/components/AnimatedBalance";
import { HotStreakMeter } from "@/components/HotStreakMeter";
import { LevelProgressBar } from "@/components/LevelProgressBar";
import { AchievementBadge } from "@/components/AchievementBadge";
import { DailyChallenges } from "@/components/DailyChallenges";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { gameIcons, gameLabels } from "@/components/GameIcons";
import { getXPForNextLevel, getXPProgress } from "@shared/achievementDefinitions";
import { getRankConfig, getRatingProgress, getPointsToNextTier, RANK_TIERS, GOAT_CONFIG } from "@shared/rankUtils";
import { GoatBadge } from "@/components/RankBadge";
import { ChevronRight, ChevronDown } from "lucide-react";

type Achievement = {
  id: string;
  name: string;
  description: string;
  category: string;
  gameType: string | null;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  xpReward: number;
};

type UserAchievementResponse = {
  userId: string;
  achievementId: string;
  completedAt: string;
  matchId: string | null;
};

// Icon mapping for achievement icons
const achievementIconMap: Record<string, LucideIcon> = {
  Crown,
  Zap,
  Brain,
  Target,
  Award,
  TrendingUp,
  Shield,
  Network,
  Sword,
  Flame,
  Sparkles,
  Star,
  Medal,
  Trophy,
  DollarSign,
  Calendar,
  Boxes,
};

const RANK_GAME_OPTS: Array<{ key: string; label: string; ratingField: string }> = [
  { key: "overall",          label: "Overall",     ratingField: "" },
  { key: "chess",            label: "Chess",        ratingField: "chessRating" },
  { key: "mini-golf",        label: "Mini Golf",    ratingField: "miniGolfRating" },
  { key: "connect-4",        label: "Connect 4",    ratingField: "connect4Rating" },
  { key: "air-hockey",       label: "Air Hockey",   ratingField: "airHockeyRating" },
  { key: "8-ball",           label: "8-Ball",       ratingField: "eightBallRating" },
  { key: "bowling",          label: "Bowling",      ratingField: "bowlingRating" },
  { key: "block-blast",      label: "Block Blast",  ratingField: "blockBlastRating" },
  { key: "stack-tower",      label: "Stack Tower",  ratingField: "stackTowerRating" },
  { key: "basketball",       label: "Basketball",   ratingField: "basketballRating" },
  { key: "football",         label: "Football",     ratingField: "footballRating" },
  { key: "racing",           label: "Racing",       ratingField: "racingRating" },
];

const TIER_DESCRIPTIONS: Record<string, string> = {
  Bronze:   "Beginner players learning the basics.",
  Silver:   "Average players with developing strategy.",
  Gold:     "Strong players with solid consistency.",
  Platinum: "Advanced players with sharp mechanics.",
  Diamond:  "Top-tier competitive players.",
  Champion: "The best of the best — elite competitors.",
};

function RankSection({ user }: { user: Record<string, any> | null }) {
  const [selectedGame, setSelectedGame] = useState("overall");
  const [showLadder, setShowLadder] = useState(true);
  const { data: goat } = useQuery<any>({ queryKey: ["/api/goat"], staleTime: 60_000 });

  const ratingForGame = (gameKey: string): number => {
    if (!user) return 1200;
    if (gameKey === "overall") {
      const fields = RANK_GAME_OPTS.filter(g => g.ratingField).map(g => (user[g.ratingField] ?? 1200) as number);
      return fields.length > 0 ? Math.round(fields.reduce((a, b) => a + b, 0) / fields.length) : 1200;
    }
    const opt = RANK_GAME_OPTS.find(g => g.key === gameKey);
    return opt ? (user[opt.ratingField] ?? 1200) : 1200;
  };

  const rating = ratingForGame(selectedGame);
  const cfg = getRankConfig(rating);
  const progress = getRatingProgress(rating);
  const ptsToNext = getPointsToNextTier(rating);
  const nextTier = RANK_TIERS.find(t => t.minRating > cfg.maxRating);
  const isGoat = goat && user && goat.userId === user.id;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-8">
      <div
        className="rounded-xl border relative overflow-hidden"
        style={{
          borderColor: isGoat ? GOAT_CONFIG.border : cfg.border,
          background: `linear-gradient(135deg, ${isGoat ? GOAT_CONFIG.bg : cfg.bg} 0%, rgba(10,14,26,0.95) 60%)`,
          boxShadow: `0 0 60px -16px ${isGoat ? GOAT_CONFIG.glow : cfg.glow}`,
        }}
        data-testid="rank-section"
      >
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse 50% 80% at 95% 50%, ${(isGoat ? GOAT_CONFIG.glow : cfg.glow).replace("0.45","0.07").replace("0.6","0.07")}, transparent 70%)`,
        }} />

        <div className="relative p-5 md:p-6">
          {/* Section header */}
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" style={{ color: isGoat ? GOAT_CONFIG.color : cfg.color }} />
              <h2 className="font-black text-sm uppercase tracking-widest" style={{ color: isGoat ? GOAT_CONFIG.color : cfg.color }}>
                Rank System
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground" onClick={() => setShowLadder(v => !v)}>
                Rank Ladder <ChevronDown className={`w-3 h-3 transition-transform ${showLadder ? "rotate-180" : ""}`} />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: current rank + game selector */}
            <div className="space-y-4">
              {/* Rank card */}
              <div
                className="card-depth rounded-xl border p-5 text-center magnetic-shimmer"
                style={{
                  background: isGoat ? GOAT_CONFIG.bg : cfg.bg,
                  borderColor: isGoat ? GOAT_CONFIG.border : cfg.border,
                  boxShadow: `0 0 30px -8px ${isGoat ? GOAT_CONFIG.glow : cfg.glow}`,
                }}
              >
                {isGoat ? (
                  <>
                    <GoatBadge size="md" className="mb-2 mx-auto" />
                    <div className="text-4xl font-black tabular-nums mb-1 stat-pop" style={{ color: GOAT_CONFIG.color }}>{rating.toLocaleString()}</div>
                    <div className="text-sm font-bold mb-1" style={{ color: GOAT_CONFIG.color }}>Global #1 — GOAT</div>
                    <div className="text-xs text-muted-foreground">You hold the highest rating on the platform</div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: cfg.color, boxShadow: `0 0 10px ${cfg.glow}` }} />
                      <span className="text-xl font-black" style={{ color: cfg.color }}>{cfg.label}</span>
                    </div>
                    {/* Top X% percentile display */}
                    {(() => {
                      const pctMap: Record<string, string> = {
                        Bronze: "Top 60%", Silver: "Top 40%", Gold: "Top 25%",
                        Platinum: "Top 15%", Diamond: "Top 8%", Champion: "Top 3%",
                      };
                      const pct = pctMap[cfg.label];
                      return pct ? (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full mb-1 text-[10px] font-bold"
                          style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
                          {pct} of players
                        </div>
                      ) : null;
                    })()}
                    <div className="text-4xl font-black tabular-nums mb-1 stat-pop" data-testid="dashboard-rating">{rating.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground mb-3">Rating · {RANK_GAME_OPTS.find(g => g.key === selectedGame)?.label ?? "Overall"}</div>
                    {ptsToNext !== null && nextTier ? (
                      <>
                        <div className="flex justify-between text-[11px] text-muted-foreground mb-1.5">
                          <span>{cfg.label}</span>
                          <span>{ptsToNext} pts to {nextTier.label}</span>
                        </div>
                        <div className="h-2.5 bg-white/8 progress-glow">
                          <motion.div
                            className="h-full rank-bar-fill"
                            style={{ boxShadow: `0 0 10px ${cfg.glow}` }}
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                          />
                        </div>
                        <div className="text-[10px] text-muted-foreground text-right mt-1">{progress}% to {nextTier.label}</div>
                      </>
                    ) : (
                      <Badge style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>Max Rank — Champion</Badge>
                    )}
                  </>
                )}
              </div>

              {/* Game selector */}
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1.5">View by game</p>
                <div className="flex flex-wrap gap-1.5">
                  {RANK_GAME_OPTS.map(opt => {
                    const r = ratingForGame(opt.key);
                    const c = getRankConfig(r);
                    const isActive = selectedGame === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => setSelectedGame(opt.key)}
                        data-testid={`rank-game-${opt.key}`}
                        className={`px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-colors ${isActive ? "text-white" : "border-white/10 bg-white/3 text-muted-foreground hover-elevate"}`}
                        style={isActive ? { background: c.bg, borderColor: c.border, color: c.color } : {}}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rank progression explanation */}
              <div className="space-y-1.5 text-[11px] text-muted-foreground">
                <p className="font-semibold text-foreground text-xs mb-1">How ranking works</p>
                <div className="flex items-start gap-1.5"><TrendingUp className="w-3 h-3 text-green-400 shrink-0 mt-0.5" /><span>Win rated matches to gain rating points.</span></div>
                <div className="flex items-start gap-1.5"><Target className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" /><span>Rating adjusts based on your opponent's skill level.</span></div>
                <div className="flex items-start gap-1.5"><Crown className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" /><span>Beat stronger opponents to earn more rating.</span></div>
                <div className="flex items-start gap-1.5"><Shield className="w-3 h-3 text-purple-400 shrink-0 mt-0.5" /><span>Season resets may adjust ranks. Top finishers get rewards.</span></div>
              </div>
            </div>

            {/* Right: full rank ladder */}
            {showLadder && (
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-2">Rank Ladder</p>
                <div className="space-y-1.5">
                  {RANK_TIERS.map(tier => {
                    const isCurrent = cfg.label === tier.label;
                    return (
                      <Tooltip key={tier.label}>
                        <TooltipTrigger asChild>
                          <div
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-default hover-elevate ${isCurrent ? "ring-1" : "border-white/6 bg-white/2"}`}
                            style={isCurrent ? {
                              borderColor: tier.border,
                              background: tier.bg,
                              boxShadow: `0 0 20px -6px ${tier.glow}`,
                            } : {}}
                          >
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: tier.color, boxShadow: isCurrent ? `0 0 10px ${tier.glow}` : "none" }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold" style={isCurrent ? { color: tier.color } : {}}>{tier.label}</span>
                                {isCurrent && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: tier.bg, color: tier.color, border: `1px solid ${tier.border}` }}>YOU</span>}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {tier.maxRating === 9999 ? `${tier.minRating.toLocaleString()}+` : `${tier.minRating.toLocaleString()} – ${tier.maxRating.toLocaleString()}`} rating
                              </div>
                            </div>
                            <div className="text-[10px] text-muted-foreground text-right">{tier.skillLevel}</div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-[180px] text-[11px]">
                          <p className="font-bold mb-0.5">{tier.label}</p>
                          <p>{TIER_DESCRIPTIONS[tier.label]}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}

                  {/* GOAT entry */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-default ${isGoat ? "ring-1" : "border-white/6 bg-white/2"}`}
                        style={isGoat ? {
                          borderColor: GOAT_CONFIG.border,
                          background: GOAT_CONFIG.bg,
                          boxShadow: `0 0 20px -6px ${GOAT_CONFIG.glow}`,
                        } : {}}
                      >
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{
                            background: `linear-gradient(135deg, ${GOAT_CONFIG.color}, ${GOAT_CONFIG.secondaryColor})`,
                            boxShadow: isGoat ? `0 0 10px ${GOAT_CONFIG.glow}` : "none",
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold" style={isGoat ? { color: GOAT_CONFIG.color } : {}}>GOAT</span>
                            {isGoat && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: GOAT_CONFIG.bg, color: GOAT_CONFIG.color, border: `1px solid ${GOAT_CONFIG.border}` }}>YOU</span>}
                          </div>
                          <div className="text-[10px] text-muted-foreground">Global #1 only · 1 player</div>
                        </div>
                        <div className="text-[10px] text-muted-foreground text-right">Legendary</div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-[180px] text-[11px]">
                      <p className="font-bold mb-0.5">GOAT</p>
                      <p>The single highest-rated player on the entire platform. One player at a time.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Current GOAT info */}
                {goat && (
                  <div className="mt-3 px-3 py-2.5 rounded-lg border border-white/6 bg-white/2 text-[11px]">
                    <div className="flex items-center gap-2">
                      <Crown className="w-3 h-3 shrink-0" style={{ color: GOAT_CONFIG.color }} />
                      <span className="text-muted-foreground">Current GOAT: </span>
                      <span className="font-bold">{goat.userName ?? "Unknown"}</span>
                      <span className="text-muted-foreground ml-auto">{goat.wins ?? 0}W · {goat.winRate ?? 0}% WR</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Battle Pass Dashboard Widget ────────────────────────────────────────
function BattlePassWidget() {
  const { user } = useAuth();
  const { data } = useQuery<{
    season: { name: string; endDate: string };
    tiers: Array<{ tier: number; xpRequired: number; isPremium: boolean }>;
    progress: { currentXp: number; claimedTiers: number[]; hasPremium: boolean };
  }>({
    queryKey: ["/api/battle-pass"],
    enabled: !!user,
  });

  const freeTiers = useMemo(() => (data?.tiers ?? []).filter(t => !t.isPremium).sort((a, b) => a.tier - b.tier), [data]);
  const currentTier = useMemo(() => {
    const xp = data?.progress?.currentXp ?? 0;
    let cur = 0;
    for (const t of freeTiers) { if (xp >= t.xpRequired) cur = t.tier; }
    return cur;
  }, [freeTiers, data]);

  const nextTierData = freeTiers.find(t => t.tier === currentTier + 1);
  const curTierData  = freeTiers.find(t => t.tier === currentTier);
  const prevXP = curTierData?.xpRequired ?? 0;
  const nextXP = nextTierData?.xpRequired ?? 132000;
  const curXP  = data?.progress?.currentXp ?? 0;
  const span   = nextXP - prevXP;
  const pct    = span <= 0 ? 100 : Math.min(100, ((curXP - prevXP) / span) * 100);
  const hasPremium = data?.progress?.hasPremium ?? false;
  const claimable  = (data?.progress?.claimedTiers?.length ?? 0);

  if (!user) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }} className="mb-8">
      <Card className="glass-override overflow-hidden">
        <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg, #FF2D8A, #FF7A00, #a855f7)" }} />
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Left: Season info + tier */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg, rgba(255,45,138,0.2), rgba(255,122,0,0.15))" }}>
                <Crown className="w-5 h-5" style={{ color: "#FF7A00" }} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-bold text-white">Battle Pass</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                    style={{ background: "linear-gradient(90deg, #FF2D8A33, #FF7A0033)", color: "#FF7A00", border: "1px solid rgba(255,122,0,0.3)" }}>
                    SEASON 1
                  </span>
                  {hasPremium && (
                    <Badge className="text-[9px] px-1.5 h-4 no-default-active-elevate"
                      style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}>
                      PREMIUM
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-white/40">{data?.season?.name ?? "The Grid"}</p>
              </div>
            </div>

            {/* Center: tier + XP progress */}
            <div className="flex-1 min-w-0 max-w-xs">
              <div className="flex justify-between text-[11px] text-white/40 mb-1">
                <span>Tier {currentTier} / 100</span>
                <span>{curXP.toLocaleString()} XP</span>
              </div>
              <div className="relative h-2 bg-white/8 progress-glow">
                <motion.div className="absolute inset-y-0 left-0 battle-pass-bar-fill"
                  style={{ width: `${pct}%` }}
                  initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1 }} />
              </div>
              <p className="text-[10px] text-white/25 mt-0.5">
                {claimable} rewards claimed
              </p>
            </div>

            {/* Right: CTA */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {!hasPremium && (
                <Link href="/battle-pass">
                  <Button size="sm" style={{ background: "linear-gradient(135deg, #FF2D8A, #FF7A00)", border: "none" }}
                    className="gap-1.5 text-xs font-bold" data-testid="dashboard-get-premium">
                    <Crown className="w-3.5 h-3.5" /> Get Premium
                  </Button>
                </Link>
              )}
              <Link href="/battle-pass">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-white/50"
                  data-testid="dashboard-view-battle-pass">
                  View Pass <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

import { PageDepthBackground } from "@/components/PageDepthBackground";

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useQuery<UserStats>({
    queryKey: ["/api/user/stats"],
  });

  const { data: recentMatches, isLoading: matchesLoading } = useQuery<MatchWithPlayers[]>({
    queryKey: ["/api/matches/recent"],
  });

  const { data: allAchievements, isLoading: achievementsLoading } = useQuery<Achievement[]>({
    queryKey: ["/api/achievements"],
  });

  const { data: userAchievements, isLoading: userAchievementsLoading } = useQuery<UserAchievementResponse[]>({
    queryKey: ["/api/user/achievements"],
    enabled: !!user,
  });

  const deleteMatchMutation = useMutation({
    mutationFn: async (matchId: string) => {
      return await apiRequest("POST", `/api/matches/${matchId}/delete`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matches/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      toast({
        title: "Match Deleted",
        description: "The match has been removed from your history",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete match",
        variant: "destructive",
      });
    },
  });

  const forfeitMatchMutation = useMutation({
    mutationFn: async (matchId: string) => {
      return await apiRequest("POST", `/api/matches/${matchId}/forfeit`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matches/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      toast({
        title: "Match Forfeited",
        description: "You have forfeited the match. Your opponent wins.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to forfeit match",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen glass-bg relative">
      <PageDepthBackground
        glowZones={[
          { x: "25%", y: "8%",  color: "99,102,241",  size: "55%", opacity: 0.07 },
          { x: "80%", y: "20%", color: "139,92,246",  size: "40%", opacity: 0.05 },
          { x: "60%", y: "60%", color: "59,130,246",  size: "45%", opacity: 0.04 },
          { x: "10%", y: "75%", color: "255,45,138",  size: "35%", opacity: 0.03 },
        ]}
        particleCount={20}
      />
      <AppNavbar />
      <PageHero
        title="Dashboard"
        subtitle="Your gaming performance and history"
        motif="stats"
      />

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-8">
        {/* Stats Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          {statsLoading ? (
            <Card className="glass-override">
              <CardContent className="p-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="text-center">
                      <Skeleton className="h-10 w-20 mx-auto mb-2" />
                      <Skeleton className="h-4 w-24 mx-auto" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : stats ? (
            <PlayerStatsHUD
              wins={stats.wins}
              losses={stats.losses}
              totalMatches={stats.totalMatches}
              currentStreak={stats.currentStreak ?? 0}
              streakType={(stats.currentStreak ?? 0) > 0 ? "win" : "none"}
              earnings={stats.totalEarnings}
            />
          ) : null}
        </motion.div>

        {/* Rank System */}
        <RankSection user={user as Record<string, any> | null} />

        {/* Daily & Weekly Challenges */}
        {stats && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mb-8">
            <DailyChallenges stats={stats} />
          </motion.div>
        )}

        {/* Battle Pass widget */}
        <BattlePassWidget />

        {/* XP & Achievements Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 space-y-4"
        >
          {/* Level Progress */}
          {user && (
            <Card className="glass-override card-depth">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  Level & Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <LevelProgressBar
                  level={user.level || 1}
                  currentXP={user.xp || 0}
                  compact={false}
                />
              </CardContent>
            </Card>
          )}

          {/* Achievements Grid */}
          <Card className="glass-override card-depth">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              {achievementsLoading || userAchievementsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : allAchievements && userAchievements ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {allAchievements.map((achievement) => {
                    const userAchievement = userAchievements.find(
                      (ua) => ua.achievementId === achievement.id
                    );
                    
                    return (
                      <AchievementBadge
                        key={achievement.id}
                        achievement={achievement as any}
                        userAchievement={userAchievement as any}
                        size="md"
                        showDetails={false}
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">
                  No achievements available
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Transaction History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <TransactionHistory />
        </motion.div>

        {/* Recent Matches */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass-override card-depth">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Recent Matches
              </CardTitle>
            </CardHeader>
            <CardContent>
              {matchesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4">
                      <Skeleton className="w-10 h-10 rounded-lg" />
                      <div className="flex-1">
                        <Skeleton className="h-5 w-32 mb-2" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                      <Skeleton className="h-6 w-16" />
                    </div>
                  ))}
                </div>
              ) : !recentMatches || recentMatches.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Match History</h3>
                  <p className="text-muted-foreground mb-4">
                    Start playing to build your match history!
                  </p>
                  <Link href="/">
                    <Button data-testid="button-start-playing-dashboard">
                      Start Playing
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentMatches.map((match, index) => {
                    const GameIcon = gameIcons[match.gameType as GameType] || gameIcons.chess;
                    const gameLabel = gameLabels[match.gameType as GameType] || match.gameType;
                    const isWinner = match.winnerId === user?.id;
                    const isCompleted = match.status === "completed";
                    const isInProgress = match.status === "in-progress";
                    const opponent = match.player1Id === user?.id ? match.player2 : match.player1;
                    const isBotOrPractice = match.isBotMatch || match.isPractice;

                    const rowGlow = isCompleted
                      ? isWinner
                        ? { border: "rgba(34,197,94,0.30)", bg: "rgba(34,197,94,0.055)", strip: "#22c55e" }
                        : { border: "rgba(239,68,68,0.22)", bg: "rgba(239,68,68,0.045)", strip: "#ef4444" }
                      : isInProgress
                        ? { border: "rgba(251,191,36,0.28)", bg: "rgba(251,191,36,0.04)", strip: "#fbbf24" }
                        : { border: "rgba(255,255,255,0.07)", bg: "transparent", strip: "transparent" };

                    return (
                      <motion.div
                        key={match.id}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.045 }}
                        className="relative rounded-lg overflow-hidden transition-all"
                        style={{ background: rowGlow.bg, border: `1px solid ${rowGlow.border}` }}
                        data-testid={`recent-match-${index}`}
                      >
                        {/* Emotion color strip */}
                        <div className="absolute left-0 inset-y-0 w-0.5" style={{ background: rowGlow.strip, opacity: 0.85 }} />

                        <div className="flex items-center gap-3 px-4 py-3.5">
                          {/* Game Icon */}
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: isCompleted && isWinner ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.05)" }}
                          >
                            <GameIcon className="w-4.5 h-4.5" style={{ width:"1.1rem", height:"1.1rem", color: isCompleted && isWinner ? "#22c55e" : "rgba(255,255,255,0.55)" }} />
                          </div>

                          {/* Match Info */}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold mb-0.5 flex items-center gap-1.5 flex-wrap">
                              {gameLabel}
                              {match.isPractice && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Practice</Badge>}
                              {match.isBotMatch && <Badge variant="outline" className="text-[10px] px-1.5 py-0">vs Bot</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {match.isPractice ? "Practice Mode"
                                : match.isBotMatch ? `vs Bot (${match.botDifficulty})`
                                : <>
                                    vs{" "}
                                    {opponent?.id ? (
                                      <Link href={`/profile/${opponent.id}`} className="hover:text-primary transition-colors font-medium">
                                        {opponent.firstName || opponent.email?.split('@')[0] || "Unknown"}
                                      </Link>
                                    ) : (opponent?.firstName || opponent?.email?.split('@')[0] || "Unknown")}
                                  </>}
                              {match.completedAt && (
                                <span className="ml-1.5 opacity-60">
                                  · {formatDistanceToNow(new Date(match.completedAt), { addSuffix: true })}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Result badge + actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            {isCompleted && (
                              <motion.div
                                initial={{ scale: 0.7, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: index * 0.045 + 0.15, type: "spring", stiffness: 260 }}
                              >
                                {isWinner ? (
                                  <div
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold"
                                    style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
                                    data-testid={`result-${index}`}
                                  >
                                    <Trophy className="w-3 h-3" />
                                    VICTORY
                                  </div>
                                ) : (
                                  <div
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold"
                                    style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}
                                    data-testid={`result-${index}`}
                                  >
                                    DEFEAT
                                  </div>
                                )}
                              </motion.div>
                            )}
                            {isInProgress && (
                              <div
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold"
                                style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                LIVE
                              </div>
                            )}

                            {/* Play Again */}
                            {isCompleted && (
                              <Link href={`/?game=${match.gameType}`}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs text-white/40 hover:text-white/70 gap-1 px-2"
                                  data-testid={`button-play-again-${index}`}
                                >
                                  Play Again
                                </Button>
                              </Link>
                            )}

                            {/* Forfeit for in-progress PvP */}
                            {isInProgress && !isBotOrPractice && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => forfeitMatchMutation.mutate(match.id)}
                                    disabled={forfeitMatchMutation.isPending}
                                    data-testid={`button-forfeit-match-${index}`}
                                    className="text-destructive"
                                    aria-label="Forfeit match"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Forfeit Match</p>
                                  <p className="text-xs text-muted-foreground">Opponent wins and receives pot</p>
                                </TooltipContent>
                              </Tooltip>
                            )}

                            {/* Delete for bot/practice */}
                            {isBotOrPractice && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deleteMatchMutation.mutate(match.id)}
                                    disabled={deleteMatchMutation.isPending}
                                    data-testid={`button-delete-match-${index}`}
                                    className="text-destructive"
                                    aria-label="Delete match"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Delete Match</p></TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
