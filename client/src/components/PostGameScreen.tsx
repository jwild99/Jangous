import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TrendingUp, Home, RotateCcw, ArrowUp, ArrowDown, ChevronRight, Sparkles, Zap, X, Bot, TrendingDown, Gamepad2, Dumbbell, Swords, Shield, Flame, Crown, Gift } from "lucide-react";
import { ScalpsIcon } from "@/components/ScalpsIcon";
import { VictoryTrophy, DefeatIcon, DrawIcon } from "@/components/PremiumAssets";
import { getRankConfig, getRatingProgress, getRankTier } from "@shared/rankUtils";
import type { MatchWithPlayers } from "@shared/schema";
import { useLocation } from "wouter";
import { soundManager } from "@/lib/soundManager";
import { Feedback } from "@/lib/feedback";
import { emitRankUp } from "@/lib/rankEvents";

interface PostGameScreenProps {
  match: MatchWithPlayers;
  currentUserId?: string;
  onRematch?: () => void;
  isOpen: boolean;
  onClose: () => void;
}

// Sounds are delegated through the Feedback facade (volume + haptics included)
function playRankUpSound()   { Feedback.play("rank_up"); }
function playRankDownSound() { Feedback.play("rank_down"); }
function playRatingChangeSound(positive: boolean) {
  Feedback.play(positive ? "xp_gained" : "move");
}
function playDrawSound() { Feedback.play("draw"); }

// ─── Animated number counter ─────────────────────────────────
function AnimatedMMRCounter({ value, delay = 0 }: { value: number; delay?: number }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const unsub = rounded.on("change", setDisplay);
    const controls = animate(mv, value, {
      duration: 1.2,
      delay,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => { controls.stop(); unsub(); };
  }, [value, delay]);

  const isPositive = value >= 0;
  return (
    <span className={isPositive ? "text-green-400" : "text-red-400"}>
      {isPositive ? "+" : ""}{display}
    </span>
  );
}

// ─── MMR bonus panel ─────────────────────────────────────────
function MMRBonusPanel({ myStats }: { myStats: any }) {
  const ratingChange = myStats?.ratingChange ?? null;
  const ratingAfter = myStats?.ratingAfter ?? null;
  const upsetBonus = myStats?.upsetBonus ?? 0;
  const streakBonus = myStats?.streakBonus ?? 0;
  const streakMult = myStats?.streakMultiplier ?? 1.0;
  const closeMatch = myStats?.closeMatchProtection ?? 0;
  const wasUpset = myStats?.wasUpset ?? false;
  const wasCloseMatch = myStats?.wasCloseMatch ?? false;

  if (ratingChange == null) return null;

  const hasBonuses = upsetBonus > 0 || streakBonus > 0 || closeMatch > 0;
  const isPositive = ratingChange >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.45, type: "spring", stiffness: 280 }}
      className="mt-3 flex flex-col items-center gap-2"
      data-testid="mmr-bonus-panel"
    >
      {/* Main MMR pill */}
      <div
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xl font-black"
        style={{
          background: isPositive ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
          border: `1px solid ${isPositive ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
          boxShadow: isPositive ? "0 0 20px -6px rgba(34,197,94,0.4)" : "0 0 20px -6px rgba(239,68,68,0.3)",
        }}
        data-testid="text-rating-change"
      >
        {isPositive ? <ArrowUp className="w-4 h-4 text-green-400" /> : <ArrowDown className="w-4 h-4 text-red-400" />}
        <AnimatedMMRCounter value={ratingChange} delay={0.5} />
        <span className="text-base font-bold opacity-60">MMR</span>
        {ratingAfter != null && (
          <span className="text-xs text-white/30 font-normal ml-1">→ {ratingAfter}</span>
        )}
      </div>

      {/* Bonus breakdown pills */}
      {hasBonuses && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="flex flex-wrap items-center justify-center gap-1.5"
        >
          {wasUpset && upsetBonus > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1.1, type: "spring" }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black text-amber-400 border border-amber-500/30"
              style={{ background: "rgba(245,158,11,0.10)" }}
            >
              <Swords className="w-2.5 h-2.5" />UPSET +{upsetBonus}
            </motion.span>
          )}
          {streakBonus > 0 && streakMult > 1 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1.18, type: "spring" }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black text-violet-400 border border-violet-500/30"
              style={{ background: "rgba(139,92,246,0.10)" }}
            >
              <Flame className="w-2.5 h-2.5" />STREAK x{streakMult.toFixed(2)} +{streakBonus}
            </motion.span>
          )}
          {wasCloseMatch && closeMatch > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1.26, type: "spring" }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black text-blue-400 border border-blue-500/30"
              style={{ background: "rgba(59,130,246,0.10)" }}
            >
              <Shield className="w-2.5 h-2.5" />CLOSE MATCH -{closeMatch} saved
            </motion.span>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Rank reward unlocked reveal ─────────────────────────────
const RARITY_COLOR: Record<string, { fg: string; bg: string; border: string; glow: string }> = {
  common:    { fg: "#a8b2c0", bg: "rgba(168,178,192,0.10)", border: "rgba(168,178,192,0.30)", glow: "rgba(168,178,192,0.30)" },
  rare:      { fg: "#60a5fa", bg: "rgba(96,165,250,0.10)",  border: "rgba(96,165,250,0.30)",  glow: "rgba(96,165,250,0.40)" },
  epic:      { fg: "#c084fc", bg: "rgba(192,132,252,0.10)", border: "rgba(192,132,252,0.35)", glow: "rgba(192,132,252,0.45)" },
  legendary: { fg: "#fbbf24", bg: "rgba(251,191,36,0.10)",  border: "rgba(251,191,36,0.40)",  glow: "rgba(251,191,36,0.55)" },
  mythic:    { fg: "#f472b6", bg: "rgba(244,114,182,0.10)", border: "rgba(244,114,182,0.40)", glow: "rgba(244,114,182,0.55)" },
};

function RewardUnlockedPanel({ matchId }: { matchId: string }) {
  const [, setLocation] = useLocation();
  const { data: rewards = [] } = useQuery<any[]>({
    queryKey: ["/api/rank/rewards-for-match", matchId],
    enabled: !!matchId,
    staleTime: 60_000,
  });

  if (!rewards.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.85, type: "spring", stiffness: 220 }}
      className="mt-4 mx-4"
      data-testid="panel-rank-rewards-unlocked"
    >
      <div className="flex items-center justify-center gap-1.5 mb-2">
        <Crown className="w-3.5 h-3.5 text-amber-300" />
        <span className="text-[11px] font-black tracking-widest text-amber-300/90 uppercase">
          Rank Reward{rewards.length > 1 ? "s" : ""} Unlocked
        </span>
        <Crown className="w-3.5 h-3.5 text-amber-300" />
      </div>
      <div className="grid gap-2">
        {rewards.map((r: any, i: number) => {
          const rarityKey = (r.rarity ?? "common").toLowerCase();
          const rc = RARITY_COLOR[rarityKey] ?? RARITY_COLOR.common;
          return (
            <motion.button
              key={r.id + i}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.9 + i * 0.08, type: "spring", stiffness: 240 }}
              onClick={() => setLocation("/rank-progression")}
              className="relative w-full flex items-center gap-3 p-3 rounded-xl text-left hover-elevate active-elevate-2"
              style={{
                background: rc.bg,
                border: `1px solid ${rc.border}`,
                boxShadow: `0 0 24px -6px ${rc.glow}`,
              }}
              data-testid={`reward-card-${r.id}`}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${rc.fg}22`, border: `1px solid ${rc.border}` }}>
                <Gift className="w-5 h-5" style={{ color: rc.fg }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black truncate" style={{ color: rc.fg }}>
                  {r.name}
                </p>
                <p className="text-[10px] text-white/50 truncate uppercase tracking-wider">
                  {String(r.category ?? "").replace(/_/g, " ")} · {rarityKey}
                </p>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="text-[9px] text-white/40 uppercase tracking-widest">Reached</span>
                <span className="text-[11px] font-black" style={{ color: rc.fg }}>
                  {r.new_tier}{r.new_division ? ` ${r.new_division}` : ""}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30" />
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Animated rank progress bar ──────────────────────────────
function RankProgressBar({
  ratingBefore,
  ratingAfter,
  delay = 0,
}: {
  ratingBefore: number;
  ratingAfter: number;
  delay?: number;
}) {
  const [width, setWidth] = useState(getRatingProgress(ratingBefore));
  const cfgBefore = getRankConfig(ratingBefore);
  const cfgAfter = getRankConfig(ratingAfter);
  const promoted = cfgAfter.minRating > cfgBefore.minRating;
  const demoted = cfgAfter.minRating < cfgBefore.minRating;

  // After mount, animate to the final position
  useEffect(() => {
    const timer = setTimeout(() => {
      setWidth(getRatingProgress(ratingAfter));
    }, delay * 1000 + 300);
    return () => clearTimeout(timer);
  }, [ratingAfter, delay]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[11px] mb-1.5">
        <span style={{ color: cfgAfter.color }} className="font-semibold">{cfgAfter.label}</span>
        <span className="text-white/40">{ratingAfter} MMR</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${width}%`,
            background: `linear-gradient(90deg, ${cfgAfter.color}80, ${cfgAfter.color})`,
            boxShadow: `0 0 8px ${cfgAfter.glow}`,
          }}
        />
      </div>
      {cfgAfter.maxRating !== 9999 && (
        <div className="flex items-center justify-end text-[10px] text-white/30 mt-1">
          {cfgAfter.maxRating + 1 - ratingAfter} to next tier
        </div>
      )}
    </div>
  );
}

// ─── Rank change section ─────────────────────────────────────
function RankUpdateSection({
  ratingBefore,
  ratingAfter,
  ratingChange,
}: {
  ratingBefore: number;
  ratingAfter: number;
  ratingChange: number;
}) {
  const cfgBefore = getRankConfig(ratingBefore);
  const cfgAfter = getRankConfig(ratingAfter);
  const tierBefore = getRankTier(ratingBefore);
  const tierAfter = getRankTier(ratingAfter);
  const promoted = cfgAfter.minRating > cfgBefore.minRating;
  const demoted = cfgAfter.minRating < cfgBefore.minRating;
  const soundFired = useRef(false);

  useEffect(() => {
    if (soundFired.current) return;
    soundFired.current = true;
    if (promoted) {
      setTimeout(playRankUpSound, 600);
      setTimeout(() => emitRankUp({
        oldRank: cfgBefore.label,
        newRank: cfgAfter.label,
        oldRating: ratingBefore,
        newRating: ratingAfter,
        oldColor: cfgBefore.color,
        newColor: cfgAfter.color,
      }), 1200);
    } else if (demoted) {
      setTimeout(playRankDownSound, 400);
    } else {
      setTimeout(() => playRatingChangeSound(ratingChange >= 0), 400);
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55, duration: 0.35 }}
      className="rounded-xl p-4 space-y-3"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* Rank promotion banner */}
      {promoted && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.7, type: "spring", stiffness: 300 }}
          className="flex items-center justify-center gap-2 py-2 rounded-lg"
          style={{
            background: `linear-gradient(135deg, ${cfgAfter.bg}, rgba(0,0,0,0))`,
            border: `1px solid ${cfgAfter.border}`,
          }}
        >
          <Sparkles className="w-4 h-4" style={{ color: cfgAfter.color }} />
          <span className="text-sm font-bold" style={{ color: cfgAfter.color }}>
            RANK UP — {tierBefore} → {tierAfter}
          </span>
          <Sparkles className="w-4 h-4" style={{ color: cfgAfter.color }} />
        </motion.div>
      )}

      {demoted && (
        <div
          className="flex items-center justify-center gap-2 py-2 rounded-lg"
          style={{
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.18)",
          }}
        >
          <ArrowDown className="w-4 h-4 text-red-400" />
          <span className="text-sm font-semibold text-red-400">
            Rank down — {tierBefore} → {tierAfter}
          </span>
        </div>
      )}

      {/* Tier badges side-by-side when rank changed */}
      {(promoted || demoted) && (
        <div className="flex items-center justify-center gap-3">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-white/40">Before</span>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
              style={{ color: cfgBefore.color, background: cfgBefore.bg, borderColor: cfgBefore.border }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: cfgBefore.color }} />
              {tierBefore}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-white/30 mt-4" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-white/40">After</span>
            <motion.span
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.75, type: "spring" }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
              style={{
                color: cfgAfter.color,
                background: cfgAfter.bg,
                borderColor: cfgAfter.border,
                boxShadow: promoted ? `0 0 14px ${cfgAfter.glow}` : "none",
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: cfgAfter.color }} />
              {tierAfter}
            </motion.span>
          </div>
        </div>
      )}

      {/* MMR progress bar */}
      <RankProgressBar ratingBefore={ratingBefore} ratingAfter={ratingAfter} delay={0.55} />
    </motion.div>
  );
}

// ─── Double or Nothing Modal ──────────────────────────────────
function DoubleOrNothingModal({
  open, potAmount, isWin,
  onDouble, onSameWager, onExit,
}: {
  open: boolean; potAmount: number; isWin: boolean;
  onDouble: () => void; onSameWager: () => void; onExit: () => void;
}) {
  const [countdown, setCountdown] = useState(10);
  const [accepted, setAccepted] = useState<"double" | "same" | null>(null);

  useEffect(() => {
    if (!open) { setCountdown(10); setAccepted(null); return; }
    const t = setInterval(() => setCountdown(prev => {
      if (prev <= 1) { clearInterval(t); onExit(); return 0; }
      return prev - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [open]);

  if (!open) return null;

  const doubleAmt = potAmount * 2;
  const potentialWin = doubleAmt * 0.97;

  return (
    <div className="fixed inset-0 z-[9500] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <motion.div
        className="w-full max-w-sm rounded-2xl border border-white/15 overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0d1225 0%, #1a0830 100%)" }}
        initial={{ scale: 0.8, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 280 }}
      >
        {/* Countdown bar */}
        <div className="h-1 bg-white/10 overflow-hidden">
          <motion.div className="h-full"
            style={{ background: "linear-gradient(90deg,#FF2D8A,#FF7A00)" }}
            initial={{ width: "100%" }}
            animate={{ width: `${(countdown / 10) * 100}%` }}
            transition={{ duration: 1, ease: "linear" }} />
        </div>

        <div className="p-6 text-center">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 0.6, repeat: Infinity }}
            className="text-4xl font-black mb-1"
            style={{ background: "linear-gradient(135deg,#FF2D8A,#FF7A00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
          >
            RUN IT BACK
          </motion.div>
          <p className="text-white/50 text-sm mb-4">Auto-exits in <span className="text-white font-bold">{countdown}s</span></p>

          <div className="grid grid-cols-3 gap-2 mb-5 text-center text-xs">
            <div className="rounded-lg bg-white/5 border border-white/10 p-2.5">
              <div className="text-white/40 mb-0.5">Current Pot</div>
              <div className="font-bold flex items-center justify-center gap-0.5"><ScalpsIcon size="xs" />{potAmount.toFixed(0)} S</div>
            </div>
            <div className="rounded-lg bg-primary/15 border border-primary/30 p-2.5">
              <div className="text-primary/80 mb-0.5">If Double</div>
              <div className="font-black text-primary flex items-center justify-center gap-0.5"><ScalpsIcon size="xs" />{doubleAmt.toFixed(0)} S</div>
            </div>
            <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-2.5">
              <div className="text-green-400/80 mb-0.5">Win Gets</div>
              <div className="font-bold text-green-400 flex items-center justify-center gap-0.5"><ScalpsIcon size="xs" />{potentialWin.toFixed(0)} S</div>
            </div>
          </div>

          <div className="space-y-2">
            <Button className="w-full gap-2 font-bold text-base h-12" onClick={() => { setAccepted("double"); onDouble(); }}
              disabled={!!accepted} data-testid="btn-double-or-nothing">
              <Zap className="w-5 h-5" />Double or Nothing ({doubleAmt.toFixed(0)} S)
            </Button>
            <Button variant="outline" className="w-full gap-2" onClick={() => { setAccepted("same"); onSameWager(); }}
              disabled={!!accepted} data-testid="btn-same-wager">
              <RotateCcw className="w-4 h-4" />Same Wager ({potAmount.toFixed(0)} S)
            </Button>
            <Button variant="ghost" className="w-full gap-2 text-muted-foreground" onClick={onExit}
              disabled={!!accepted} data-testid="btn-exit-rematch">
              <X className="w-4 h-4" />Exit
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────
export default function PostGameScreen({
  match,
  currentUserId,
  onRematch,
  isOpen,
  onClose,
}: PostGameScreenProps) {
  const [, setLocation] = useLocation();
  const [showRunItBack, setShowRunItBack] = useState(false);
  const [runItBackShown, setRunItBackShown] = useState(false);

  // Auto-show "Run It Back" after 2.5s for wagered matches
  useEffect(() => {
    if (!isOpen || runItBackShown) return;
    const pot = parseFloat(match.potAmount || "0");
    if (pot <= 0) return;
    const t = setTimeout(() => {
      setShowRunItBack(true);
      setRunItBackShown(true);
    }, 2500);
    return () => clearTimeout(t);
  }, [isOpen, match.potAmount, runItBackShown]);

  const isPlayer1 = match.player1Id === currentUserId;
  const player = isPlayer1 ? match.player1 : match.player2;
  const opponent = isPlayer1 ? match.player2 : match.player1;

  const { data: myStats } = useQuery<any>({
    queryKey: ["/api/matches", match.id, "my-stats"],
    queryFn: async () => {
      const res = await fetch(`/api/matches/${match.id}/my-stats`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isOpen && match.status === "completed",
    staleTime: 30000,
  });

  const playerScore = isPlayer1 ? (match.player1Score || 0) : (match.player2Score || 0);
  const opponentScore = isPlayer1 ? (match.player2Score || 0) : (match.player1Score || 0);

  const isWin = playerScore > opponentScore;
  const isDraw = playerScore === opponentScore;

  // Win / loss / draw sounds fire once on open
  const drawSoundFired = useRef(false);
  const winSoundFired  = useRef(false);
  const lossSoundFired = useRef(false);

  useEffect(() => {
    if (!isOpen || drawSoundFired.current || !isDraw) return;
    drawSoundFired.current = true;
    setTimeout(playDrawSound, 400);
  }, [isOpen, isDraw]);

  useEffect(() => {
    if (!isOpen || winSoundFired.current || !isWin) return;
    winSoundFired.current = true;
    setTimeout(() => Feedback.win(), 350);
  }, [isOpen, isWin]);

  useEffect(() => {
    if (!isOpen || lossSoundFired.current || isWin || isDraw) return;
    lossSoundFired.current = true;
    setTimeout(() => Feedback.loss(), 350);
  }, [isOpen, isWin, isDraw]);

  const potAmount = parseFloat(match.potAmount || "0");
  const winAmount = potAmount * 0.97;
  const lossAmount = potAmount / 2;

  // Derived rank change data
  const ratingChange = myStats?.ratingChange ?? null;
  const ratingAfter = myStats?.ratingAfter ?? null;
  const ratingBefore = ratingAfter != null && ratingChange != null
    ? ratingAfter - ratingChange
    : null;
  const showRankSection = ratingAfter != null && ratingBefore != null;

  const getPlayerDisplayName = (u: typeof player) =>
    u?.firstName || u?.username || u?.email?.split("@")[0] || "Player";
  const getPlayerInitials = (u: typeof player) => {
    const name = u?.firstName || u?.username || u?.email?.split("@")[0] || "?";
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <Card className="card-depth border-primary/30 overflow-hidden">
              {/* ── Result header ── */}
              <div
                className={`p-8 text-center relative overflow-hidden ${
                  isWin
                    ? "bg-gradient-to-b from-green-950/30 to-background"
                    : isDraw
                    ? "bg-gradient-to-b from-blue-950/30 to-background"
                    : "bg-gradient-to-b from-red-950/30 to-background"
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent opacity-20" />

                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="relative z-10 mb-4"
                >
                  {isWin
                    ? <VictoryTrophy className="w-20 h-20 mx-auto" />
                    : isDraw
                    ? <DrawIcon className="w-16 h-16 mx-auto" />
                    : <DefeatIcon className="w-16 h-16 mx-auto" />}
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className={`text-3xl font-bold font-display mb-2 ${
                    isWin ? "text-green-400" : isDraw ? "text-blue-400" : "text-red-400"
                  }`}
                  data-testid="text-postgame-result"
                >
                  {isWin ? "VICTORY!" : isDraw ? "DRAW!" : "DEFEAT!"}
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="text-muted-foreground text-sm"
                >
                  {match.gameType === "chess" && "Checkmate!"}
                  {match.gameType === "mini-golf" && "Game Over!"}
                  {match.gameType === "connect-4" && "Four in a Row!"}
                  {match.gameType === "air-hockey" && "Puck in the Goal!"}
                  {match.gameType === "rock-paper-scissors" && "Best of Series!"}
                  {match.gameType === "dots-and-boxes" && "All Boxes Claimed!"}
                  {match.gameType === "8-ball" && "Game Over!"}
                  {match.gameType === "bowling" && "Strike!"}
                  {match.gameType === "cup-king" && "Beer Pong Victory!"}
                  {match.gameType === "stack-tower" && "Tower Complete!"}
                </motion.p>

                {/* MMR bonus panel — animated counter + bonus pills */}
                <MMRBonusPanel myStats={myStats} />

                {/* Rank reward(s) unlocked from this match */}
                {isWin && match.id && <RewardUnlockedPanel matchId={match.id} />}
              </div>

              <CardContent className="p-6 space-y-5">
                {/* ── Rank update section ── */}
                {showRankSection && (
                  <RankUpdateSection
                    ratingBefore={ratingBefore!}
                    ratingAfter={ratingAfter!}
                    ratingChange={ratingChange!}
                  />
                )}

                {/* ── Player vs Opponent ── */}
                <div className="grid grid-cols-2 gap-4">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-center p-4 rounded-lg bg-primary/5 border border-primary/20"
                  >
                    <Avatar className="w-12 h-12 mx-auto mb-2">
                      <AvatarImage src={player?.profileImageUrl || undefined} />
                      <AvatarFallback>{getPlayerInitials(player)}</AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-semibold mb-2 truncate" data-testid="text-player-name">
                      {getPlayerDisplayName(player)}
                    </p>
                    <div className="text-2xl font-bold text-primary mb-1" data-testid="text-player-score">
                      {playerScore}
                    </div>
                    {potAmount > 0 && (
                      <div className={`text-xs font-semibold ${isWin ? "text-green-400" : isDraw ? "text-muted-foreground" : "text-red-400"}`}>
                        {isWin ? `+${winAmount.toFixed(2)} S` : isDraw ? "Draw" : `-${lossAmount.toFixed(2)} S`}
                      </div>
                    )}
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-center p-4 rounded-lg bg-secondary/5 border border-secondary/20"
                  >
                    <Avatar className="w-12 h-12 mx-auto mb-2">
                      <AvatarImage src={opponent?.profileImageUrl || undefined} />
                      <AvatarFallback>{getPlayerInitials(opponent)}</AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-semibold mb-2 truncate" data-testid="text-opponent-name">
                      {getPlayerDisplayName(opponent)}
                    </p>
                    <div className="text-2xl font-bold text-secondary mb-1" data-testid="text-opponent-score">
                      {opponentScore}
                    </div>
                    {potAmount > 0 && (
                      <div className={`text-xs font-semibold ${!isWin && !isDraw ? "text-green-400" : isDraw ? "text-muted-foreground" : "text-red-400"}`}>
                        {!isWin && !isDraw ? `+${winAmount.toFixed(2)} S` : isDraw ? "Draw" : `-${lossAmount.toFixed(2)} S`}
                      </div>
                    )}
                  </motion.div>
                </div>

                {/* ── Stats row ── */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="grid grid-cols-3 gap-3"
                >
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Game</p>
                    <Badge variant="outline" className="text-xs">
                      {match.gameType.replace("-", " ").toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Duration</p>
                    <p className="font-semibold text-sm">
                      {match.duration ? `${Math.round(match.duration / 60)}m` : "<1m"}
                    </p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Pot</p>
                    <p className="font-semibold text-sm">{potAmount.toFixed(2)} S</p>
                  </div>
                </motion.div>

                {/* ── Buttons ── */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="grid grid-cols-2 gap-3 pt-4 border-t border-border"
                >
                  {match.isBotMatch ? (
                    <>
                      <Button className="gap-2 col-span-2"
                        style={{ background: "linear-gradient(135deg,#06B6D4,#0284C7)", border: "none" }}
                        onClick={() => setLocation(`/?bot=replay&game=${match.gameType}&difficulty=${match.botDifficulty ?? "medium"}`)}
                        data-testid="button-play-again-bot">
                        <Bot className="w-4 h-4" />Play Again vs Bot
                      </Button>
                      <Button onClick={() => setLocation("/")} variant="outline" className="gap-2" data-testid="button-lobby">
                        <Home className="w-4 h-4" />Home
                      </Button>
                      <Button onClick={() => setLocation(`/?bot=difficulty&game=${match.gameType}`)} variant="outline" className="gap-2" data-testid="button-change-difficulty">
                        <RotateCcw className="w-4 h-4" />Change Difficulty
                      </Button>
                    </>
                  ) : isWin ? (
                    <>
                      {parseFloat(match.potAmount || "0") > 0 && (
                        <Button className="gap-2 col-span-2"
                          style={{ background: "linear-gradient(135deg,#FF2D8A,#FF7A00)", border: "none" }}
                          onClick={() => setShowRunItBack(true)} data-testid="button-run-it-back">
                          <Zap className="w-4 h-4" />Run It Back
                        </Button>
                      )}
                      <Button
                        onClick={() => setLocation(`/?increaseStakes=1&game=${match.gameType}`)}
                        variant="outline" className="gap-2" data-testid="button-increase-stakes">
                        <TrendingUp className="w-4 h-4" />Increase Stakes
                      </Button>
                      <Button
                        onClick={() => setLocation("/")}
                        variant="outline" className="gap-2" data-testid="button-lobby">
                        <Home className="w-4 h-4" />Home
                      </Button>
                    </>
                  ) : isDraw ? (
                    <>
                      {onRematch && (
                        <Button onClick={onRematch} variant="outline" className="gap-2" data-testid="button-rematch">
                          <RotateCcw className="w-4 h-4" />Rematch
                        </Button>
                      )}
                      <Button onClick={() => setLocation("/")} variant="outline" className="gap-2" data-testid="button-lobby">
                        <Home className="w-4 h-4" />Home
                      </Button>
                    </>
                  ) : (
                    <>
                      {parseFloat(match.potAmount || "0") > 0 && (
                        <Button className="gap-2 col-span-2"
                          style={{ background: "linear-gradient(135deg,#FF2D8A,#FF7A00)", border: "none" }}
                          onClick={() => setShowRunItBack(true)} data-testid="button-run-it-back">
                          <Zap className="w-4 h-4" />Run It Back
                        </Button>
                      )}
                      <Button
                        onClick={() => setLocation(`/?lowerStakes=1&game=${match.gameType}`)}
                        variant="outline" className="gap-2" data-testid="button-lower-stakes">
                        <TrendingDown className="w-4 h-4" />Lower Stakes
                      </Button>
                      <Button
                        onClick={() => setLocation(`/?bot=practice&game=${match.gameType}`)}
                        variant="outline" className="gap-2" data-testid="button-practice">
                        <Dumbbell className="w-4 h-4" />Practice
                      </Button>
                      <Button
                        onClick={() => setLocation("/?switchGame=1")}
                        variant="outline" className="gap-2" data-testid="button-switch-game">
                        <Gamepad2 className="w-4 h-4" />Switch Game
                      </Button>
                      <Button
                        onClick={() => setLocation("/")}
                        variant="outline" className="gap-2" data-testid="button-lobby">
                        <Home className="w-4 h-4" />Home
                      </Button>
                    </>
                  )}
                </motion.div>

                {/* ── Motivational note ── */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="text-center pt-1"
                >
                  <p className="text-xs text-muted-foreground">
                    {isWin ? (
                      <><TrendingUp className="w-3 h-3 inline mr-1" />Great match! Keep the streak going!</>
                    ) : isDraw ? (
                      <>Evenly matched — try pushing the stakes.</>
                    ) : (() => {
                      const scoreGap = Math.abs(playerScore - opponentScore);
                      const pot = parseFloat(match.potAmount || "0");
                      const myLosses = myStats?.recentLosses ?? 0;
                      if (myLosses >= 3) return <>Switch game or practice — try a fresh challenge.</>;
                      if (pot > 5 || (ratingBefore != null && ratingAfter != null && ratingBefore - ratingAfter > 20)) return <><TrendingDown className="w-3 h-3 inline mr-1" />Skill gap detected — try lower stakes.</>;
                      if (scoreGap <= 2) return <>Close match — you were right there.</>;
                      return <><TrendingDown className="w-3 h-3 inline mr-1" />Learn and come back stronger.</>;
                    })()}
                  </p>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* ── Double or Nothing ── */}
    <DoubleOrNothingModal
      open={showRunItBack}
      potAmount={parseFloat(match.potAmount || "0")}
      isWin={isWin}
      onDouble={() => {
        setShowRunItBack(false);
        Feedback.play("match_join");
        if (onRematch) onRematch();
        else setLocation("/");
      }}
      onSameWager={() => {
        setShowRunItBack(false);
        Feedback.play("button_click");
        if (onRematch) onRematch();
        else setLocation("/");
      }}
      onExit={() => {
        setShowRunItBack(false);
      }}
    />
  </>
  );
}
