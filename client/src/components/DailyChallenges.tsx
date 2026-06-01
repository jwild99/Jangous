import { useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Flame, Star, Zap, CheckCircle2, Sparkles, Gift, TrendingUp, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { soundManager } from "@/lib/soundManager";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { emitXPGained } from "@/lib/xpEvents";

// ─── Challenge definitions ────────────────────────────────────────────────────
export interface ChallengeDef {
  id: string;
  title: string;
  description: string;
  reward: string;
  xp: number;
  target: number;
  type: "weekly" | "daily";
  getProgress: (stats: any) => number;
}

export const CHALLENGES: ChallengeDef[] = [
  {
    id: "daily-play-1", type: "daily", title: "First Match",
    description: "Play at least 1 match today",
    reward: "+50 XP", xp: 50, target: 1,
    getProgress: (s) => Math.min(s.totalMatches || 0, 1),
  },
  {
    id: "daily-win-1", type: "daily", title: "Taste Victory",
    description: "Win 1 match",
    reward: "+75 XP", xp: 75, target: 1,
    getProgress: (s) => Math.min(s.wins || 0, 1),
  },
  {
    id: "daily-play-3", type: "daily", title: "On a Roll",
    description: "Play 3 matches today",
    reward: "+100 XP", xp: 100, target: 3,
    getProgress: (s) => Math.min(s.totalMatches || 0, 3),
  },
  {
    id: "weekly-play-10", type: "weekly", title: "Grind Week",
    description: "Play 10 total matches this week",
    reward: "+300 XP", xp: 300, target: 10,
    getProgress: (s) => Math.min(s.totalMatches || 0, 10),
  },
  {
    id: "weekly-win-5", type: "weekly", title: "Winning Streak",
    description: "Win 5 matches this week",
    reward: "+400 XP", xp: 400, target: 5,
    getProgress: (s) => Math.min(s.wins || 0, 5),
  },
  {
    id: "weekly-play-5g", type: "weekly", title: "Game Hopper",
    description: "Play 5 different game types",
    reward: "+250 XP", xp: 250, target: 5,
    getProgress: (s) => Math.min(Object.keys(s.gamesPlayed || {}).length, 5),
  },
];

const TYPE_ICONS  = { daily: Flame, weekly: Star };
const TYPE_COLORS = { daily: "text-orange-400", weekly: "text-purple-400" };
const TYPE_BG     = { daily: "bg-orange-400/10 border-orange-400/20", weekly: "bg-purple-400/10 border-purple-400/20" };
const TYPE_BAR    = {
  daily:  "linear-gradient(90deg,#fb923c,#f97316)",
  weekly: "linear-gradient(90deg,#a855f7,#9333ea)",
};

// ─── Portal XP burst ─────────────────────────────────────────────────────────
interface Burst { id: number; x: number; y: number; xp: number }
let burstCounter = 0;

function XPBurstPortal({ bursts, onDone }: { bursts: Burst[]; onDone: (id: number) => void }) {
  return createPortal(
    <>
      {bursts.map(b => (
        <XPBurst key={b.id} burst={b} onDone={onDone} />
      ))}
    </>,
    document.body
  );
}

const PARTICLE_COUNT = 10;

function XPBurst({ burst, onDone }: { burst: Burst; onDone: (id: number) => void }) {
  return (
    <div className="pointer-events-none" style={{ position: "fixed", left: 0, top: 0, zIndex: 9998 }}>
      {/* Particles */}
      {[...Array(PARTICLE_COUNT)].map((_, i) => {
        const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
        const dist  = 50 + Math.random() * 40;
        const dx    = Math.cos(angle) * dist;
        const dy    = Math.sin(angle) * dist;
        const size  = 4 + Math.random() * 4;
        const colors = ["#eab308","#f59e0b","#fbbf24","#fde047","#fb923c"];
        const color = colors[i % colors.length];
        return (
          <motion.div
            key={i}
            style={{
              position: "fixed",
              left: burst.x,
              top: burst.y,
              width: size,
              height: size,
              borderRadius: "50%",
              background: color,
              boxShadow: `0 0 6px ${color}`,
            }}
            initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            animate={{ x: dx, y: dy, scale: 0, opacity: 0 }}
            transition={{ duration: 0.65 + Math.random() * 0.2, ease: "easeOut" }}
          />
        );
      })}

      {/* Floating +XP label */}
      <motion.div
        style={{
          position: "fixed",
          left: burst.x,
          top: burst.y,
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          whiteSpace: "nowrap",
          textShadow: "0 0 12px rgba(234,179,8,0.9)",
          filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.8))",
        }}
        initial={{ opacity: 1, y: 0, scale: 0.8 }}
        animate={{ opacity: 0, y: -70, scale: 1.3 }}
        transition={{ duration: 1.3, ease: "easeOut" }}
        onAnimationComplete={() => onDone(burst.id)}
        className="flex items-center gap-1 font-black text-yellow-400 text-lg select-none"
      >
        <TrendingUp className="w-4 h-4" />+{burst.xp} XP
      </motion.div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface DailyChallengesProps {
  stats: any;
  className?: string;
}

export function DailyChallenges({ stats, className = "" }: DailyChallengesProps) {
  const { user } = useAuth();
  const [bursts, setBursts]     = useState<Burst[]>([]);
  const removeBurst = useCallback((id: number) => {
    setBursts(prev => prev.filter(b => b.id !== id));
  }, []);

  const { data: claims = [] } = useQuery<Array<{ challengeId: string }>>({
    queryKey: ["/api/challenges/claims"],
    staleTime: 5_000,
  });

  const claimedSet = new Set(claims.map(c => c.challengeId));

  const challenges = CHALLENGES.map(c => ({
    ...c,
    progress: c.getProgress(stats ?? {}),
    done: c.getProgress(stats ?? {}) >= c.target,
    claimed: claimedSet.has(c.id),
  }));

  const daily       = challenges.filter(c => c.type === "daily");
  const weekly      = challenges.filter(c => c.type === "weekly");
  const readyCount  = challenges.filter(c => c.done && !c.claimed).length;
  const claimedCount = challenges.filter(c => c.claimed).length;
  const totalCount  = challenges.length;

  const userId = (user as any)?.id as string | undefined;

  const spawnBurst = useCallback((x: number, y: number, xp: number) => {
    const id = burstCounter++;
    setBursts(prev => [...prev, { id, x, y, xp }]);
  }, []);

  return (
    <>
      <XPBurstPortal bursts={bursts} onDone={removeBurst} />
      <Card className={`card-depth border-white/10 bg-white/5 backdrop-blur-sm ${className}`}>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-400" />Challenges
          </CardTitle>
          <div className="flex items-center gap-2">
            {readyCount > 0 && (
              <Badge className="text-[10px] bg-yellow-500/20 border-yellow-500/40 text-yellow-300 animate-pulse">
                {readyCount} Ready to Claim
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] border-white/15 text-white/50">
              {claimedCount}/{totalCount} claimed
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <ChallengeGroup label="Daily"  challenges={daily}  type="daily"  userId={userId} spawnBurst={spawnBurst} />
          <ChallengeGroup label="Weekly" challenges={weekly} type="weekly" userId={userId} spawnBurst={spawnBurst} />
        </CardContent>
      </Card>
    </>
  );
}

// ─── Group ────────────────────────────────────────────────────────────────────
function ChallengeGroup({ label, challenges, type, userId, spawnBurst }: {
  label: string;
  challenges: any[];
  type: "daily" | "weekly";
  userId?: string;
  spawnBurst: (x: number, y: number, xp: number) => void;
}) {
  const Icon  = TYPE_ICONS[type];
  const color = TYPE_COLORS[type];
  const visible = challenges.filter(c => !c.claimed);
  if (visible.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{label}</span>
      </div>
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {visible.map((c, i) => (
            <ChallengeCard key={c.id} challenge={c} index={i} userId={userId} spawnBurst={spawnBurst} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Individual card ──────────────────────────────────────────────────────────
function ChallengeCard({ challenge, index, userId, spawnBurst }: {
  challenge: any;
  index: number;
  userId?: string;
  spawnBurst: (x: number, y: number, xp: number) => void;
}) {
  const { toast } = useToast();
  const btnRef    = useRef<HTMLButtonElement>(null);
  // Guard against double-click at the ref level — faster than waiting for a React re-render
  const claimingRef = useRef(false);

  const { title, description, reward, xp, target, progress, done, claimed, id, type } = challenge;
  const pct = Math.min(100, Math.round((progress / target) * 100));

  const claimMutation = useMutation({
    mutationFn: async () => {
      const res  = await apiRequest("POST", "/api/challenges/claim", { challengeId: id, xpAmount: xp });
      const data = await res.json() as { claim: any; xp: number; level: number };
      return data;
    },
    onMutate: async () => {
      // Optimistically add this challenge to the claimed list so the button
      // immediately turns into "Claimed" while the animation plays
      await queryClient.cancelQueries({ queryKey: ["/api/challenges/claims"] });
      const snapshot = queryClient.getQueryData<Array<{ challengeId: string }>>(["/api/challenges/claims"]);
      queryClient.setQueryData<Array<{ challengeId: string }>>(["/api/challenges/claims"], old =>
        [...(old ?? []), { challengeId: id }]
      );
      return { snapshot };
    },
    onSuccess: async (data, _, ctx) => {
      // ── 1. Particles ──────────────────────────────────────────────────────
      if (btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect();
        spawnBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, xp);
      }

      // ── 2. Sound ──────────────────────────────────────────────────────────
      soundManager.playReward();

      // ── 3. Level-up detection ─────────────────────────────────────────────
      const cachedUser = queryClient.getQueryData<any>(["/api/auth/user"]);
      const oldLevel   = cachedUser?.level ?? 1;
      const newLevel   = data.level;
      emitXPGained({ xp, oldLevel, newLevel });
      if (newLevel > oldLevel) {
        setTimeout(() => soundManager.playLevelUp(), 300);
      }

      // ── 4. Toast ──────────────────────────────────────────────────────────
      toast({
        title: `+${xp} XP Earned!`,
        description: newLevel > oldLevel
          ? `${title} complete — you reached Level ${newLevel}!`
          : `${title} complete. Keep it up!`,
        duration: 3000,
      });

      // ── 5. Sync server state ──────────────────────────────────────────────
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/challenges/claims"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] }),
        ...(userId ? [queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/stats`] })] : []),
      ]);
    },
    onError: (err: any, _, ctx: any) => {
      // Roll back optimistic update so the button comes back
      queryClient.setQueryData(["/api/challenges/claims"], ctx?.snapshot);

      const msg = (err?.message ?? "") as string;
      if (msg.startsWith("409")) {
        // Already claimed on the server — just re-fetch the real list
        queryClient.invalidateQueries({ queryKey: ["/api/challenges/claims"] });
      } else {
        // Genuine backend / network failure
        toast({
          title: "Could not claim reward",
          description: "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    },
    onSettled: () => {
      claimingRef.current = false;
    },
  });

  const handleClaim = () => {
    // Hard guard — blocks any double-fire before React state can update
    if (claimingRef.current) return;
    claimingRef.current = true;
    claimMutation.mutate();
  };

  // After optimistic update `claimed` becomes true → `ChallengeGroup` filters it out
  // so this card will animate away automatically via AnimatePresence
  const isReady = done && !claimed;

  let borderClass = TYPE_BG[type as "daily" | "weekly"];
  if (claimed) borderClass = "border-white/8 bg-white/3";
  if (isReady) borderClass = "border-yellow-500/40 bg-yellow-500/8";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.92, height: 0, marginBottom: 0, overflow: "hidden" }}
      transition={{ duration: 0.38, ease: "easeInOut" }}
      className={`relative rounded-xl border p-3 ${borderClass} transition-colors duration-300`}
      style={isReady ? { boxShadow: "0 0 22px -6px rgba(234,179,8,0.4)" } : undefined}
      data-testid={`challenge-${id}`}
    >
      <div className="flex items-start gap-2.5">
        {/* Status icon */}
        <div className="mt-0.5 shrink-0">
          {claimed
            ? <CheckCircle2 className="w-4 h-4 text-green-400" />
            : isReady
              ? <Gift className="w-4 h-4 text-yellow-400 animate-pulse" />
              : <Zap className={`w-4 h-4 ${TYPE_COLORS[type as "daily" | "weekly"]} opacity-70`} />
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <p className={`text-sm font-semibold ${claimed ? "text-white/35 line-through" : isReady ? "text-yellow-200" : "text-white"}`}>
              {title}
            </p>

            {/* Claim / badge */}
            {claimed ? (
              <Badge className="text-[10px] bg-green-500/15 border-green-500/30 text-green-400 shrink-0">
                <CheckCircle2 className="w-2.5 h-2.5 mr-1" />Claimed
              </Badge>
            ) : isReady ? (
              <motion.div whileTap={{ scale: 0.93 }}>
                <Button
                  ref={btnRef}
                  size="sm"
                  disabled={claimMutation.isPending}
                  onClick={handleClaim}
                  data-testid={`button-claim-${id}`}
                  className="shrink-0 text-[11px] font-bold gap-1.5"
                  style={{
                    background: claimMutation.isPending
                      ? "rgba(234,179,8,0.5)"
                      : "linear-gradient(135deg, #eab308, #f59e0b)",
                    color: "#0a0e1a",
                    boxShadow: claimMutation.isPending
                      ? "none"
                      : "0 0 18px -4px rgba(234,179,8,0.65)",
                    animation: claimMutation.isPending ? "none" : "claim-pulse 1.8s ease-in-out infinite",
                  }}
                >
                  {claimMutation.isPending
                    ? <><Loader2 className="w-3 h-3 animate-spin" />Claiming…</>
                    : <><Sparkles className="w-3 h-3" />Claim {reward}</>
                  }
                </Button>
              </motion.div>
            ) : (
              <Badge variant="outline" className="text-[10px] border-white/15 text-white/40 shrink-0">{reward}</Badge>
            )}
          </div>

          <p className={`text-xs mt-0.5 ${claimed ? "text-white/25" : "text-white/40"}`}>{description}</p>

          {/* Progress bar */}
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-[10px] text-white/35">
              <span>{progress} / {target}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, ease: "easeOut", delay: index * 0.05 }}
                style={{
                  background: claimed
                    ? "linear-gradient(90deg,#22c55e,#4ade80)"
                    : isReady
                      ? "linear-gradient(90deg,#eab308,#f59e0b)"
                      : TYPE_BAR[type as "daily" | "weekly"],
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
