import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { AppNavbar } from "@/components/AppNavbar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RankBadge } from "@/components/RankBadge";
import { getRankConfig, getRatingProgress, RANK_TIERS } from "@shared/rankUtils";
import { getPlayerTitle, getTitleColor } from "@shared/playerTitles";
import { motion } from "framer-motion";
import {
  Trophy, Sword, BarChart3, MessageCircle, UserPlus, Shield,
  Star, Calendar, Flame, Gamepad2, TrendingUp, Users, Flag,
  CheckCircle2, XCircle, ChevronRight, Zap,
} from "lucide-react";
import { AchievementBadge } from "@/components/AchievementBadge";
import { ReportPlayerModal } from "@/components/ReportPlayerModal";
import { PageDepthBackground } from "@/components/PageDepthBackground";
import { useState } from "react";
import type { MatchWithPlayers } from "@shared/schema";

function ReputationBadge({ score }: { score: number }) {
  const tier =
    score >= 80 ? { label: "Excellent", color: "text-green-400", bg: "bg-green-400/10 border-green-400/25" } :
    score >= 60 ? { label: "Good", color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/25" } :
    score >= 40 ? { label: "Warning", color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/25" } :
    { label: "Restricted", color: "text-red-400", bg: "bg-red-400/10 border-red-400/25" };
  return (
    <Badge variant="outline" className={`text-[10px] border ${tier.bg} ${tier.color} gap-1`} title={`Reputation: ${score}/100`}>
      <Shield className="w-3 h-3" />{tier.label} ({score}/100)
    </Badge>
  );
}

function ReputationBar({ score }: { score: number }) {
  const tier =
    score >= 80 ? { label: "Excellent", color: "bg-green-400", text: "text-green-400", desc: "Excellent sportsmanship" } :
    score >= 60 ? { label: "Good", color: "bg-blue-400", text: "text-blue-400", desc: "Good sportsmanship" } :
    score >= 40 ? { label: "Warning", color: "bg-amber-400", text: "text-amber-400", desc: "Sportsmanship needs improvement" } :
    { label: "Restricted", color: "bg-red-400", text: "text-red-400", desc: "Access may be restricted" };
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-semibold ${tier.text}`}>{tier.label}</span>
        <span className="text-xs text-white/40">{score}/100</span>
      </div>
      <div className="h-1.5 bg-white/10 progress-glow">
        <div className={`h-full xp-bar-fill transition-all`} style={{ width: `${score}%` }} />
      </div>
      <p className="text-[10px] text-white/40 mt-1">{tier.desc}</p>
    </div>
  );
}

function XpBar({ xp, level }: { xp: number; level: number }) {
  const xpPerLevel = 500;
  const currentLevelXp = xp % xpPerLevel;
  const pct = Math.min(100, (currentLevelXp / xpPerLevel) * 100);
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-white/35 flex items-center gap-1">
          <Zap className="w-3 h-3 text-primary/60" /> Level {level} XP
        </span>
        <span className="text-[10px] text-white/35 font-mono">{currentLevelXp}/{xpPerLevel}</span>
      </div>
      <div className="h-1.5 bg-white/8 progress-glow">
        <div
          className="h-full xp-bar-fill transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ActivityItem({ item }: { item: any }) {
  const date = item.at ? new Date(item.at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
  if (item.type === "win") return (
    <div className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
      <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/80">Won a match in <span className="font-semibold">{item.gameType}</span></p>
        {item.opponent && <p className="text-xs text-white/35">vs {item.opponent}</p>}
      </div>
      {item.pot > 0 && <span className="text-xs text-green-400 font-mono shrink-0">+{parseFloat(item.pot).toFixed(2)} S</span>}
      <span className="text-[10px] text-white/25 shrink-0">{date}</span>
    </div>
  );
  if (item.type === "loss") return (
    <div className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
      <XCircle className="w-4 h-4 text-red-400/60 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/50">Lost a match in <span className="font-semibold text-white/70">{item.gameType}</span></p>
        {item.opponent && <p className="text-xs text-white/30">vs {item.opponent}</p>}
      </div>
      <span className="text-[10px] text-white/25 shrink-0">{date}</span>
    </div>
  );
  if (item.type === "achievement") return (
    <div className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
      <Trophy className="w-4 h-4 text-yellow-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/80">Earned <span className="font-semibold">{item.name}</span></p>
      </div>
      <span className="text-[10px] text-white/25 shrink-0">{date}</span>
    </div>
  );
  return null;
}

const GAME_RATING_KEYS: Record<string, string> = {
  chess: "chessRating", "mini-golf": "miniGolfRating", "connect-4": "connect4Rating",
  "air-hockey": "airHockeyRating", "rock-paper-scissors": "rockPaperScissorsRating",
  "dots-and-boxes": "dotsAndBoxesRating", "8-ball": "eightBallRating",
  bowling: "bowlingRating", "cup-king": "cupKingRating", "stack-tower": "stackTowerRating",
};

const GAME_LABELS: Record<string, string> = {
  chess: "Chess", "mini-golf": "Mini Golf", "connect-4": "Connect 4",
  "air-hockey": "Air Hockey", "rock-paper-scissors": "RPS",
  "dots-and-boxes": "Dots & Boxes", "8-ball": "8-Ball", bowling: "Bowling",
  "cup-king": "Cup King", "stack-tower": "Stack Tower",
};

function StatTile({ label, value, color = "" }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="card-depth p-4 text-center magnetic-shimmer">
      <p className={`text-2xl font-bold stat-pop ${color || "text-white"}`}>{value}</p>
      <p className="text-xs text-white/40 mt-1">{label}</p>
    </div>
  );
}

function MatchRow({ match, userId }: { match: MatchWithPlayers; userId: string }) {
  const isWin = match.winnerId === userId;
  const opponent = match.player1Id === userId ? match.player2 : match.player1;
  const opponentName = opponent
    ? (opponent.firstName || opponent.email?.split("@")[0] || "Unknown")
    : "Opponent";
  const date = match.completedAt ? new Date(match.completedAt).toLocaleDateString() : "—";
  const pot = match.potAmount ? `${parseFloat(match.potAmount).toFixed(2)} S` : "0 S";
  const gameLabel = GAME_LABELS[match.gameType] ?? match.gameType;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/8 last:border-0">
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isWin ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
        {isWin ? "W" : "L"}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">
          {gameLabel} vs{" "}
          {opponent?.id ? (
            <Link href={`/profile/${opponent.id}`} className="hover:text-primary transition-colors">
              {opponentName}
            </Link>
          ) : opponentName}
        </p>
        <p className="text-[11px] text-white/35">{date}</p>
      </div>
      <span className="text-sm font-semibold text-white/70 shrink-0">{pot}</span>
    </div>
  );
}

function RatingBar({ gameType, rating }: { gameType: string; rating: number }) {
  const cfg = getRankConfig(rating);
  const progress = getRatingProgress(rating);
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-white/50">{GAME_LABELS[gameType] ?? gameType}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono text-white/70">{rating}</span>
          <RankBadge rating={rating} size="xs" showRating={false} />
        </div>
      </div>
      <div className="h-1.5 bg-white/10 progress-glow">
        <div
          className="h-full rank-bar-fill transition-all duration-700"
          style={{ width: `${progress}%`, boxShadow: `0 0 8px ${cfg.glow}` }}
        />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const { user: currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const [reportOpen, setReportOpen] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery<any>({
    queryKey: ["/api/users", userId],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}`);
      if (!res.ok) throw new Error("User not found");
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/users", userId, "stats"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/stats`);
      if (res.status === 403) return null;
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: recentMatches = [] } = useQuery<MatchWithPlayers[]>({
    queryKey: ["/api/users", userId, "matches", "recent"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/matches/recent`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: earnedAchievements = [] } = useQuery<any[]>({
    queryKey: ["/api/users", userId, "achievements"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/achievements`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: friends = [] } = useQuery<any[]>({
    queryKey: ["/api/users", userId, "friends"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/friends`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: activityFeed = [] } = useQuery<any[]>({
    queryKey: ["/api/users", userId, "activity"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/activity`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!userId,
  });

  const isOwnProfile = currentUser?.id === userId;

  if (profileLoading) {
    return (
      <div className="min-h-screen" style={{ background: "linear-gradient(135deg,#010208 0%,#0a0e1a 100%)" }}>
        <AppNavbar />
        <div className="max-w-3xl mx-auto px-4 py-10 space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl bg-white/5" />
          <div className="grid grid-cols-4 gap-3">
            {[0,1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl bg-white/5" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen" style={{ background: "linear-gradient(135deg,#010208 0%,#0a0e1a 100%)" }}>
        <AppNavbar />
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <p className="text-2xl font-bold text-white mb-2">Player Not Found</p>
          <p className="text-white/40 mb-6">This profile doesn&apos;t exist or has been removed.</p>
          <Link href="/"><Button>Back to Lobby</Button></Link>
        </div>
      </div>
    );
  }

  const displayName = profile.firstName
    ? `${profile.firstName}${profile.lastName ? ` ${profile.lastName}` : ""}`
    : profile.username || profile.email?.split("@")[0] || "Player";

  const topRating = Math.max(
    profile.chessRating ?? 1200,
    profile.miniGolfRating ?? 1200,
    profile.connect4Rating ?? 1200,
    profile.airHockeyRating ?? 1200,
    profile.rockPaperScissorsRating ?? 1200,
  );
  const rankCfg = getRankConfig(topRating);

  const ratingEntries = Object.entries(GAME_RATING_KEYS).map(([game, key]) => ({
    game, rating: profile[key] ?? 1200,
  })).sort((a, b) => b.rating - a.rating);

  return (
    <div className="min-h-screen relative" style={{ background: "linear-gradient(135deg,#010208 0%,#0a0e1a 50%,#0d1225 100%)" }}>
      <PageDepthBackground
        glowZones={[
          { x: "30%", y: "15%", color: "99,102,241",  size: "55%", opacity: 0.07 },
          { x: "80%", y: "40%", color: "139,92,246",  size: "40%", opacity: 0.05 },
          { x: "15%", y: "70%", color: "59,130,246",  size: "35%", opacity: 0.04 },
        ]}
        particleCount={20}
      />
      <AppNavbar />

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="card-depth p-6">
          <div className="flex flex-wrap items-start gap-5">
            <div className="relative">
              <Avatar className="w-20 h-20 ring-2" style={{ "--tw-ring-color": rankCfg.color } as any}>
                <AvatarImage src={profile.profileImageUrl || undefined} style={{ objectFit: "cover" }} />
                <AvatarFallback className="text-2xl font-bold">
                  {(profile.firstName?.[0] || profile.email?.[0] || "P").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-[#010208]"
                style={{ background: rankCfg.color }}
                title={`${rankCfg.label} rank`}
              >
                <span className="text-[9px] font-black text-black">{rankCfg.label[0]}</span>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-white truncate"
                  style={{ color: profile.nicknameColor || undefined }}>
                  {displayName}
                </h1>
                {isOwnProfile && (
                  <Badge variant="outline" className="text-[10px] border-primary/30 text-primary/70">You</Badge>
                )}
              </div>
              {profile.username && (
                <p className="text-white/40 text-sm mt-0.5">@{profile.username}</p>
              )}
              {(() => {
                const pt = getPlayerTitle(profile);
                if (pt.tier === "unranked") return null;
                return (
                  <p className="text-xs font-semibold mt-0.5" style={{ color: getTitleColor(pt.tier) }}>
                    {pt.title}
                  </p>
                );
              })()}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <RankBadge rating={topRating} size="md" showLabel showRating />
                <Badge variant="outline" className="text-[10px] border-white/15 text-white/40">
                  <Star className="w-3 h-3 mr-1" />Lv {profile.level || 1}
                </Badge>
                <Badge variant="outline" className="text-[10px] border-white/15 text-white/40">
                  <Flame className="w-3 h-3 mr-1" />{profile.loginStreak || 0} day streak
                </Badge>
                <ReputationBadge score={profile.reputation ?? 80} />
              </div>
              <XpBar xp={profile.xp ?? 0} level={profile.level ?? 1} />
            </div>

            {!isOwnProfile && currentUser && (
              <div className="flex flex-col gap-2 shrink-0">
                <Button size="sm" variant="outline" className="border-white/15 bg-white/5 gap-1.5"
                  onClick={() => setLocation("/social?tab=messages")} data-testid="button-message-player">
                  <MessageCircle className="w-3.5 h-3.5" />Message
                </Button>
                <Button size="sm" variant="outline" className="border-red-500/20 bg-red-500/5 text-red-400 gap-1.5"
                  onClick={() => setReportOpen(true)} data-testid="button-report-player">
                  <Flag className="w-3.5 h-3.5" />Report
                </Button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Stats row */}
        {stats && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile label="Matches Played" value={stats.totalMatches} />
            <StatTile label="Wins" value={stats.wins} color="text-green-400" />
            <StatTile label="Losses" value={stats.losses} color="text-red-400" />
            <StatTile label="Win Rate" value={`${stats.winRate}%`} color={stats.winRate >= 50 ? "text-green-400" : "text-white"} />
          </motion.div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Ratings per game */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <Card className="card-depth border-white/10 bg-white/5 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />Ratings by Game
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {ratingEntries.map(({ game, rating }) => (
                  <RatingBar key={game} gameType={game} rating={rating} />
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* Match history */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
            <Card className="card-depth border-white/10 bg-white/5 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sword className="w-4 h-4 text-primary" />Recent Matches
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentMatches.length === 0 ? (
                  <p className="text-sm text-white/30 text-center py-4">No matches yet</p>
                ) : (
                  recentMatches.slice(0, 8).map(m => (
                    <MatchRow key={m.id} match={m} userId={userId!} />
                  ))
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Achievements */}
        {earnedAchievements.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="card-depth border-white/10 bg-white/5 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-400" />
                  Achievements <Badge variant="secondary" className="ml-1">{earnedAchievements.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {earnedAchievements.map(ua => (
                    <AchievementBadge key={ua.achievementId} achievement={ua.achievement} userAchievement={ua} size="sm" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Friends section */}
        {friends.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
            <Card className="card-depth border-white/10 bg-white/5 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Friends <Badge variant="secondary" className="ml-1">{friends.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {friends.slice(0, 12).map((friend: any) => (
                    <Link key={friend.friendshipId} href={`/profile/${friend.userId}`}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors">
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarImage src={friend.profileImageUrl || undefined} style={{ objectFit: "cover" }} />
                        <AvatarFallback className="text-xs font-bold">
                          {(friend.userName?.[0] ?? "U").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium truncate text-white/80">{friend.userName}</span>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Activity Feed */}
        {activityFeed.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.23 }}>
            <Card className="card-depth border-white/10 bg-white/5 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activityFeed.slice(0, 8).map((item, i) => (
                  <ActivityItem key={i} item={item} />
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Rank tiers reference */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
          <Card className="card-depth border-white/10 bg-white/5 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />Rank Ladder
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {RANK_TIERS.map(tier => {
                  const isCurrent = getRankConfig(topRating).label === tier.label;
                  return (
                    <div key={tier.label}
                      className={`rounded-lg p-2 text-center border transition-all ${isCurrent ? "border-white/30" : "border-white/8 bg-white/3"}`}
                      style={isCurrent ? { borderColor: tier.border, background: tier.bg, boxShadow: `0 0 16px ${tier.glow}` } : {}}>
                      <div className="w-3 h-3 rounded-full mx-auto mb-1" style={{ background: tier.color }} />
                      <p className="text-[11px] font-semibold" style={{ color: tier.color }}>{tier.label}</p>
                      <p className="text-[9px] text-white/30">{tier.minRating}+</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Report Player Modal */}
      {userId && (
        <ReportPlayerModal
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          reportedUserId={userId}
          reportedName={profile?.firstName || profile?.username || "this player"}
        />
      )}
    </div>
  );
}
