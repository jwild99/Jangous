import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Trophy, Lock, CheckCircle2, Shield, ArrowUp, ArrowDown, Sparkles, ChevronRight, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RANK_TIERS, allRankMilestones, type RankTier, type RankDivision } from "@shared/rankUtils";
import type { ShopItem } from "@shared/schema";

interface RewardRow {
  id: string;
  tier: string;
  division: RankDivision | null;
  ratingThreshold: number;
  item: ShopItem;
  unlocked: boolean;
  owned: boolean;
  equipped: boolean;
}

interface RewardsResponse {
  gameType: string;
  rating: number;
  currentTier: RankTier;
  currentDivision: RankDivision | null;
  label: string;
  progressPct: number;
  pointsToNext: number | null;
  divisionMin: number;
  divisionMax: number;
  tierColor: string;
  tierGlow: string;
  nextReward: RewardRow | null;
  pointsToNextReward: number | null;
  rewards: RewardRow[];
}

interface RankHistoryRow {
  id: string;
  gameType: string;
  oldRating: number;
  newRating: number;
  oldTier: string;
  newTier: string;
  oldDivision: string | null;
  newDivision: string | null;
  direction: "up" | "down";
  createdAt: string;
}

const GAME_OPTIONS: { value: string; label: string }[] = [
  { value: "chess", label: "Chess" },
  { value: "mini-golf", label: "Mini Golf" },
  { value: "connect-4", label: "Connect 4" },
  { value: "air-hockey", label: "Air Hockey" },
  { value: "8-ball", label: "8-Ball" },
  { value: "bowling", label: "Bowling" },
];

// Filter tabs in spec order. Category values match shop_items.category.
// "profile_cosmetic" maps to multiple — handled in filterFn.
const FILTERS: { value: string; label: string; match: (cat: string) => boolean }[] = [
  { value: "all",            label: "All",              match: () => true },
  { value: "badge",          label: "Badges",           match: c => c === "badge" },
  { value: "avatar_frame",   label: "Avatar Frames",    match: c => c === "avatar_frame" },
  { value: "banner",         label: "Banners",          match: c => c === "banner" },
  { value: "emote",          label: "Emotes",           match: c => c === "emote" },
  { value: "trail",          label: "Trails",           match: c => c === "trail" },
  { value: "victory_animation", label: "Victory Effects", match: c => c === "victory_animation" },
  { value: "board_skin",     label: "Table Effects",    match: c => c === "board_skin" },
  { value: "profile",        label: "Profile",          match: c => c === "theme" || c === "dice_skin" || c === "card_skin" },
];

function rankColorFor(tierLabel: string): string {
  const t = RANK_TIERS.find(r => r.label === tierLabel);
  if (t) return t.color;
  if (tierLabel === "GOAT") return "#FF2D8A";
  return "#94a3b8";
}

function rankGlowFor(tierLabel: string): string {
  const t = RANK_TIERS.find(r => r.label === tierLabel);
  if (t) return t.glow;
  if (tierLabel === "GOAT") return "rgba(255,45,138,0.6)";
  return "rgba(148,163,184,0.4)";
}

function tierLabelOf(r: { tier: string; division: RankDivision | null }) {
  return `${r.tier}${r.division ? " " + r.division : ""}`;
}

export default function RankProgressionPage() {
  const [gameType, setGameType] = useState<string>("chess");
  const [filter, setFilter] = useState<string>("all");
  const [previewReward, setPreviewReward] = useState<RewardRow | null>(null);
  const { toast } = useToast();

  const { data: progression, isLoading } = useQuery<RewardsResponse>({
    queryKey: ["/api/ranks/rewards", gameType],
    queryFn: async () => {
      const res = await fetch(`/api/ranks/rewards?gameType=${encodeURIComponent(gameType)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load rewards");
      return res.json();
    },
  });

  const { data: history } = useQuery<RankHistoryRow[]>({
    queryKey: ["/api/rank/history", gameType],
    queryFn: async () => {
      const res = await fetch(`/api/rank/history?gameType=${encodeURIComponent(gameType)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load history");
      return res.json();
    },
  });

  const equipMutation = useMutation({
    mutationFn: async (itemId: string) => apiRequest("POST", `/api/shop/equip/${itemId}`),
    onSuccess: () => {
      toast({ title: "Equipped!", description: "Your new cosmetic is live." });
      queryClient.invalidateQueries({ queryKey: ["/api/shop/equipped"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ranks/rewards", gameType] });
      setPreviewReward(null);
    },
    onError: () => toast({ title: "Couldn't equip", description: "Please try again.", variant: "destructive" }),
  });

  const milestones = useMemo(() => allRankMilestones(), []);

  const filteredRewards = useMemo(() => {
    if (!progression) return [];
    const f = FILTERS.find(x => x.value === filter) ?? FILTERS[0];
    return progression.rewards.filter(r => f.match(r.item.category));
  }, [progression, filter]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#02040a] via-[#040818] to-[#02040a] text-white">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-12 space-y-6 md:space-y-8" data-testid="page-rank-progression">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">Rank Progression</div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Climb the Ladder</h1>
            <p className="text-white/60 mt-2 max-w-xl text-sm md:text-base">Every division earns you a permanent cosmetic. Every tier earns you a flex.</p>
          </div>
          <Tabs value={gameType} onValueChange={setGameType} className="shrink-0 w-full md:w-auto">
            <TabsList className="bg-white/5 backdrop-blur-xl border border-white/10 w-full md:w-auto overflow-x-auto flex-nowrap justify-start">
              {GAME_OPTIONS.map(g => (
                <TabsTrigger key={g.value} value={g.value} data-testid={`tab-game-${g.value}`} className="shrink-0">
                  {g.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {isLoading && (
          <div className="h-48 rounded-2xl bg-white/[0.03] border border-white/10 animate-pulse" />
        )}

        {progression && (
          <>
            {/* Hero rank card */}
            <HeroRankCard progression={progression} />

            {/* Progress to next rank reward */}
            {progression.nextReward && (
              <NextRewardCard
                next={progression.nextReward}
                pointsToNext={progression.pointsToNextReward ?? 0}
                onPreview={() => setPreviewReward(progression.nextReward!)}
              />
            )}

            {/* Rank ladder */}
            <Card className="bg-white/[0.03] backdrop-blur-xl border-white/10 p-4 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-white/60" />
                <h2 className="text-lg font-semibold">Rank Ladder</h2>
              </div>
              <RankLadder milestones={milestones} currentRating={progression.rating} />
            </Card>

            {/* Rewards track */}
            <Card className="bg-white/[0.03] backdrop-blur-xl border-white/10 p-4 md:p-6">
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Trophy className="h-5 w-5 text-amber-400" />
                <h2 className="text-lg font-semibold">Reward Track</h2>
                <Badge variant="outline" className="ml-2 text-xs">Season 1: Genesis</Badge>
              </div>

              {/* Filter tabs */}
              <div className="mb-4 -mx-1 px-1 overflow-x-auto" data-testid="filter-tabs-wrap">
                <div className="flex gap-2 min-w-max">
                  {FILTERS.map(f => {
                    const count = progression.rewards.filter(r => f.match(r.item.category)).length;
                    const active = filter === f.value;
                    return (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => setFilter(f.value)}
                        data-testid={`filter-${f.value}`}
                        className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-all hover-elevate active-elevate-2 border ${
                          active
                            ? "bg-white/10 border-white/30 text-white"
                            : "bg-white/[0.02] border-white/10 text-white/60"
                        }`}
                      >
                        {f.label}
                        <span className="ml-1.5 text-[10px] opacity-60">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {filteredRewards.length === 0 ? (
                <div className="py-12 text-center text-white/40 text-sm" data-testid="text-no-rewards">
                  No rewards in this category yet — check back in a future season.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {filteredRewards.map(reward => (
                    <RewardCard
                      key={reward.id}
                      reward={reward}
                      onTap={() => setPreviewReward(reward)}
                    />
                  ))}
                </div>
              )}
            </Card>

            {/* Recent history */}
            {history && history.length > 0 && (
              <Card className="bg-white/[0.03] backdrop-blur-xl border-white/10 p-4 md:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-5 w-5 text-purple-400" />
                  <h2 className="text-lg font-semibold">Rank History</h2>
                </div>
                <div className="space-y-2">
                  {history.slice(0, 10).map(h => (
                    <HistoryRow key={h.id} row={h} />
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      <RewardPreviewModal
        reward={previewReward}
        onClose={() => setPreviewReward(null)}
        onEquip={(itemId) => equipMutation.mutate(itemId)}
        equipPending={equipMutation.isPending}
      />
    </div>
  );
}

// ─── Hero Rank Card ────────────────────────────────────────────────────────

function HeroRankCard({ progression }: { progression: RewardsResponse }) {
  const { currentDivision, rating, progressPct, pointsToNext, tierColor, tierGlow, label } = progression;

  return (
    <Card
      className="relative overflow-hidden border-white/10 backdrop-blur-xl p-6 md:p-8"
      style={{
        background: `radial-gradient(ellipse at 30% 20%, ${tierGlow}, transparent 60%), rgba(255,255,255,0.025)`,
      }}
      data-testid="card-hero-rank"
    >
      <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="shrink-0 relative mx-auto md:mx-0"
        >
          <div
            className="w-28 h-28 md:w-40 md:h-40 rounded-2xl flex items-center justify-center relative"
            style={{
              background: `linear-gradient(135deg, ${tierColor}33, ${tierColor}11)`,
              border: `2px solid ${tierColor}55`,
              boxShadow: `0 0 60px ${tierGlow}, inset 0 0 30px ${tierColor}22`,
            }}
            data-testid="emblem-current-rank"
          >
            <Trophy
              className="w-14 h-14 md:w-20 md:h-20"
              style={{ color: tierColor, filter: `drop-shadow(0 0 12px ${tierGlow})` }}
            />
          </div>
          {currentDivision && (
            <div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold tracking-wider"
              style={{
                background: tierColor,
                color: "#02040a",
                boxShadow: `0 4px 12px ${tierGlow}`,
              }}
              data-testid="badge-current-division"
            >
              {currentDivision}
            </div>
          )}
        </motion.div>

        <div className="flex-1 w-full">
          <div className="text-xs uppercase tracking-[0.2em] text-white/40">Current Rank</div>
          <div className="text-3xl md:text-5xl font-bold mt-1" style={{ color: tierColor, textShadow: `0 0 20px ${tierGlow}` }} data-testid="text-current-rank">
            {label}
          </div>
          <div className="text-white/60 text-sm mt-1" data-testid="text-current-rating">
            Rating: <span className="text-white font-semibold">{Math.round(rating)}</span>
            {pointsToNext !== null && <> · <span className="text-white/80">{pointsToNext}</span> to next</>}
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-white/60 mb-2">
              <span>{progression.divisionMin}</span>
              <span className="font-semibold text-white" data-testid="text-progress-pct">{progressPct}%</span>
              <span>{progression.divisionMax}</span>
            </div>
            <div className="relative h-3 rounded-full bg-white/5 overflow-hidden border border-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 1.4, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${tierColor}, ${tierColor}cc)`,
                  boxShadow: `0 0 20px ${tierGlow}`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Next Reward Card ──────────────────────────────────────────────────────

function NextRewardCard({
  next,
  pointsToNext,
  onPreview,
}: {
  next: RewardRow;
  pointsToNext: number;
  onPreview: () => void;
}) {
  const color = rankColorFor(next.tier);
  const glow = rankGlowFor(next.tier);
  const label = tierLabelOf(next);

  return (
    <button
      type="button"
      onClick={onPreview}
      data-testid="card-next-reward"
      className="w-full text-left rounded-2xl border backdrop-blur-xl p-4 md:p-5 flex items-center gap-4 hover-elevate active-elevate-2 transition-all"
      style={{
        borderColor: `${color}55`,
        background: `linear-gradient(135deg, ${color}18, rgba(255,255,255,0.02))`,
        boxShadow: `0 0 24px ${glow}`,
      }}
    >
      <div
        className="shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-xl relative overflow-hidden border"
        style={{
          background: next.item.previewGradient || `linear-gradient(135deg, ${color}, ${color}55)`,
          borderColor: `${color}66`,
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm bg-black/30">
          <Lock className="w-6 h-6 text-white/80" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">Progress to Next Reward</div>
        <div className="text-base md:text-lg font-semibold mt-0.5 truncate" data-testid="text-next-reward-name">
          {next.item.name}
        </div>
        <div className="text-xs md:text-sm text-white/60 mt-0.5">
          <span className="font-bold" style={{ color }} data-testid="text-points-to-next">{pointsToNext}</span> rating to unlock — reach{" "}
          <span className="font-semibold" style={{ color }}>{label}</span>
        </div>
      </div>
      <ChevronRight className="shrink-0 text-white/40" />
    </button>
  );
}

// ─── Rank Ladder ───────────────────────────────────────────────────────────

function RankLadder({
  milestones,
  currentRating,
}: {
  milestones: { tier: RankTier | "GOAT"; division: RankDivision | null; threshold: number }[];
  currentRating: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {milestones.map((m) => {
        const unlocked = currentRating >= m.threshold;
        const isCurrent = !milestones.find(n =>
          n.threshold > m.threshold && n.threshold <= currentRating
        ) && unlocked;
        const color = rankColorFor(m.tier);
        const glow = rankGlowFor(m.tier);
        const label = `${m.tier}${m.division ? " " + m.division : ""}`;
        return (
          <div
            key={`${m.tier}-${m.division}`}
            className="relative rounded-md px-3 py-2 text-xs font-semibold transition-all"
            style={{
              background: unlocked ? `${color}22` : "rgba(255,255,255,0.03)",
              border: isCurrent ? `2px solid ${color}` : `1px solid ${unlocked ? color + "55" : "rgba(255,255,255,0.08)"}`,
              color: unlocked ? color : "rgba(255,255,255,0.4)",
              boxShadow: isCurrent ? `0 0 18px ${glow}` : "none",
              minWidth: 78,
            }}
            data-testid={`ladder-${m.tier}-${m.division ?? "single"}`}
          >
            <div className="flex items-center gap-1">
              {unlocked ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <Lock className="w-3 h-3 shrink-0" />}
              <span>{label}</span>
            </div>
            <div className="text-[10px] opacity-60 mt-0.5">{m.threshold === 9999 ? "Top 1" : `${m.threshold}+`}</div>
            {isCurrent && (
              <div className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider" style={{ background: color, color: "#02040a" }}>
                YOU
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Reward Card ───────────────────────────────────────────────────────────

function RewardCard({
  reward,
  onTap,
}: {
  reward: RewardRow;
  onTap: () => void;
}) {
  const { item, unlocked, owned, equipped, tier, division, ratingThreshold } = reward;
  const color = rankColorFor(tier);
  const glow = rankGlowFor(tier);
  const label = tierLabelOf(reward);

  return (
    <button
      type="button"
      onClick={onTap}
      data-testid={`reward-card-${item.id}`}
      className="text-left rounded-xl overflow-hidden border transition-all hover-elevate active-elevate-2"
      style={{
        background: unlocked
          ? `linear-gradient(135deg, ${color}18, rgba(255,255,255,0.02))`
          : "rgba(255,255,255,0.02)",
        borderColor: equipped ? color : unlocked ? `${color}55` : "rgba(255,255,255,0.08)",
        boxShadow: equipped ? `0 0 24px ${glow}` : owned ? `0 0 12px ${glow}` : "none",
      }}
    >
      <div
        className="h-24 w-full relative"
        style={{
          background: item.previewGradient || `linear-gradient(135deg, ${color}, ${color}55)`,
          opacity: unlocked ? 1 : 0.35,
        }}
      >
        {!unlocked && (
          <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm bg-black/40">
            <Lock className="w-8 h-8 text-white/70" />
          </div>
        )}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider"
          style={{ background: "rgba(0,0,0,0.5)", color }}>
          {label}
        </div>
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider bg-black/50 text-white/80">
          {item.rarity}
        </div>
        {equipped && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider flex items-center gap-1"
            style={{ background: color, color: "#02040a" }}
            data-testid={`badge-equipped-${item.id}`}
          >
            <Star className="w-3 h-3" /> EQUIPPED
          </div>
        )}
      </div>

      <div className="p-3 md:p-4">
        <div className="text-sm font-semibold truncate" style={{ color: unlocked ? "#fff" : "rgba(255,255,255,0.5)" }} data-testid={`text-reward-name-${item.id}`}>
          {item.name}
        </div>
        <div className="text-xs text-white/50 mt-1 line-clamp-2 min-h-[2rem]">
          {item.description}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="text-[10px] uppercase tracking-wider text-white/40">
            {item.category.replace("_", " ")}
          </div>
          {owned ? (
            equipped ? (
              <Badge variant="outline" className="text-[10px] gap-1" style={{ color, borderColor: `${color}55` }}>
                <Star className="w-3 h-3" /> Equipped
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] gap-1" style={{ color, borderColor: `${color}55` }}>
                <CheckCircle2 className="w-3 h-3" /> Owned
              </Badge>
            )
          ) : unlocked ? (
            <Badge variant="outline" className="text-[10px] gap-1" style={{ color, borderColor: `${color}55` }}>
              <CheckCircle2 className="w-3 h-3" /> Unlocked
            </Badge>
          ) : (
            <div className="text-[10px] text-white/50">
              Unlock at <span className="font-semibold" style={{ color }}>{ratingThreshold}+</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Reward Preview Modal ──────────────────────────────────────────────────

function RewardPreviewModal({
  reward,
  onClose,
  onEquip,
  equipPending,
}: {
  reward: RewardRow | null;
  onClose: () => void;
  onEquip: (itemId: string) => void;
  equipPending: boolean;
}) {
  if (!reward) return null;
  const { item, unlocked, owned, equipped, tier, division, ratingThreshold } = reward;
  const color = rankColorFor(tier);
  const glow = rankGlowFor(tier);
  const label = tierLabelOf(reward);

  return (
    <Dialog open={!!reward} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="bg-[#070a18] border-white/10 max-w-md p-0 overflow-hidden"
        data-testid="modal-reward-preview"
      >
        {/* Large preview swatch */}
        <div
          className="relative h-48 w-full"
          style={{
            background: item.previewGradient || `linear-gradient(135deg, ${color}, ${color}55)`,
            opacity: unlocked ? 1 : 0.4,
          }}
        >
          {!unlocked && (
            <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm bg-black/50">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.5)", boxShadow: `0 0 30px ${glow}`, border: `1px solid ${color}55` }}
              >
                <Lock className="w-10 h-10 text-white/90" />
              </div>
            </div>
          )}
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded text-xs font-bold tracking-wider"
            style={{ background: "rgba(0,0,0,0.6)", color }}>
            {label}
          </div>
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded text-xs uppercase tracking-wider bg-black/60 text-white/90">
            {item.rarity}
          </div>
        </div>

        <div className="p-5 md:p-6 space-y-4">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-xl" style={{ color: unlocked ? "#fff" : "rgba(255,255,255,0.7)" }} data-testid="text-modal-name">
              {item.name}
            </DialogTitle>
            <DialogDescription className="text-white/60 text-sm leading-relaxed">
              {item.description}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md bg-white/[0.03] border border-white/10 px-3 py-2">
              <div className="text-white/40 uppercase tracking-wider text-[10px]">Category</div>
              <div className="text-white capitalize mt-0.5">{item.category.replace("_", " ")}</div>
            </div>
            <div className="rounded-md bg-white/[0.03] border border-white/10 px-3 py-2">
              <div className="text-white/40 uppercase tracking-wider text-[10px]">Required Rank</div>
              <div className="font-semibold mt-0.5" style={{ color }}>{label}</div>
            </div>
          </div>

          {!unlocked ? (
            <div
              className="rounded-md p-3 text-sm flex items-center gap-2 border"
              style={{ background: `${color}10`, borderColor: `${color}40`, color }}
              data-testid="text-unlock-hint"
            >
              <Lock className="w-4 h-4 shrink-0" />
              <span>Reach <span className="font-bold">{label}</span> ({ratingThreshold}+ rating) to unlock this item.</span>
            </div>
          ) : owned ? (
            equipped ? (
              <Button
                disabled
                size="lg"
                className="w-full"
                style={{ background: `${color}22`, color, border: `1px solid ${color}66` }}
                data-testid="button-already-equipped"
              >
                <Star className="w-4 h-4 mr-2" /> Currently Equipped
              </Button>
            ) : (
              <Button
                size="lg"
                className="w-full"
                style={{ background: color, color: "#02040a" }}
                disabled={equipPending}
                onClick={() => onEquip(item.id)}
                data-testid="button-equip-modal"
              >
                {equipPending ? "Equipping…" : "Equip"}
              </Button>
            )
          ) : (
            <div
              className="rounded-md p-3 text-sm flex items-center gap-2 border"
              style={{ background: `${color}10`, borderColor: `${color}40`, color }}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Unlocked! Play a ranked match to claim this reward.</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── History Row ───────────────────────────────────────────────────────────

function HistoryRow({ row }: { row: RankHistoryRow }) {
  const isUp = row.direction === "up";
  const color = isUp ? "#34d399" : "#f87171";
  const newColor = rankColorFor(row.newTier);
  const oldLabel = `${row.oldTier}${row.oldDivision ? " " + row.oldDivision : ""}`;
  const newLabel = `${row.newTier}${row.newDivision ? " " + row.newDivision : ""}`;
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-white/[0.02] border border-white/5" data-testid={`history-row-${row.id}`}>
      <div className="flex items-center gap-3">
        {isUp ? <ArrowUp className="w-4 h-4" style={{ color }} /> : <ArrowDown className="w-4 h-4" style={{ color }} />}
        <div>
          <div className="text-sm">
            <span className="text-white/60">{oldLabel}</span>
            <span className="mx-2 text-white/30">→</span>
            <span className="font-semibold" style={{ color: newColor }}>{newLabel}</span>
          </div>
          <div className="text-[11px] text-white/40 capitalize">{row.gameType.replace("-", " ")} · {new Date(row.createdAt).toLocaleDateString()}</div>
        </div>
      </div>
      <div className="text-xs font-mono" style={{ color }}>
        {isUp ? "+" : ""}{row.newRating - row.oldRating}
      </div>
    </div>
  );
}
