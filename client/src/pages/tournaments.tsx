import { useState, useEffect, useRef, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { AppNavbar } from "@/components/AppNavbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { ScalpsIcon, ScalpsAmount } from "@/components/ScalpsIcon";
import { formatScalps } from "@/lib/scalps";
import { soundManager } from "@/lib/soundManager";
import { Feedback } from "@/lib/feedback";
import { PageDepthBackground } from "@/components/PageDepthBackground";
import { Magnetic3D } from "@/components/Magnetic3D";
import {
  Trophy, Users, Clock, Zap, Star, ChevronRight,
  Flame, Crown, Shield, Target, Lock, CheckCircle, Plus, Play, X, Sparkles,
  DollarSign, Calendar, Gamepad2, Info, AlertCircle,
} from "lucide-react";
import { gameIcons } from "@/components/GameIcons";
import { Textarea } from "@/components/ui/textarea";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Tournament {
  id: string;
  name: string;
  game_type: string;
  bracket_size: number;
  entry_fee: string;
  prize_pool: string;
  status: "open" | "in-progress" | "completed";
  starts_at: string;
  max_players: number;
  current_players: number | string;
  joined_count?: number | string;
  description?: string;
  is_featured: boolean;
}

interface JoinResult {
  success: boolean;
  prizePool: string;
  currentPlayers: number;
  maxPlayers: number;
  newBalance: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTimeUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Starting soon";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function bracketLabel(size: number) {
  if (size <= 8) return "Quick — 8 Players";
  if (size <= 16) return "Standard — 16 Players";
  return "Large — 32 Players";
}

function bracketIcon(size: number) {
  if (size <= 8) return Zap;
  if (size <= 16) return Shield;
  return Crown;
}

// ─── Animated counter hook ───────────────────────────────────────────────────
function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(timer); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return val;
}

// ─── You're In! Success Modal ─────────────────────────────────────────────────
function YoureInModal({
  tournament,
  result,
  onClose,
}: {
  tournament: Tournament;
  result: JoinResult;
  onClose: () => void;
}) {
  const pool = parseFloat(result.prizePool ?? tournament.prize_pool);
  const fee = parseFloat(tournament.entry_fee);
  const animPool = useCountUp(pool, 1400);
  const GameIcon = gameIcons[tournament.game_type as keyof typeof gameIcons];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-card border-white/10 text-center overflow-hidden p-0">
        {/* Glow burst background */}
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              background: "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(99,102,241,0.18) 0%, transparent 70%)",
            }}
          />
        </div>

        <div className="relative p-7 flex flex-col items-center gap-4">
          {/* Floating icon burst */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{
              background: "radial-gradient(circle, rgba(99,102,241,0.25) 0%, rgba(99,102,241,0.05) 100%)",
              border: "1.5px solid rgba(99,102,241,0.4)",
              boxShadow: "0 0 40px rgba(99,102,241,0.3)",
            }}
          >
            <Trophy className="w-10 h-10 text-amber-400 drop-shadow-[0_0_12px_rgba(234,179,8,0.8)]" />
          </motion.div>

          {/* You're In text */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-1"
          >
            <h2 className="text-3xl font-black text-white tracking-tight">You're In!</h2>
            <p className="text-sm text-white/50">{tournament.name}</p>
          </motion.div>

          {/* Prize pool count-up */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="w-full rounded-xl p-4 space-y-1"
            style={{
              background: "rgba(16,185,129,0.08)",
              border: "1px solid rgba(16,185,129,0.2)",
            }}
          >
            <p className="text-xs text-white/40 uppercase tracking-widest">Total Prize Pool</p>
            <div className="flex items-center justify-center gap-2">
              <ScalpsIcon size="sm" />
              <span
                className="text-3xl font-black text-green-400 font-mono tabular-nums"
                data-testid="prize-pool-display"
              >
                {animPool.toFixed(0)}
              </span>
              <span className="text-lg font-bold text-green-400/60">S</span>
            </div>
            {fee > 0 && (
              <p className="text-xs text-white/30">
                {result.currentPlayers} players × {fee.toFixed(0)} S entry
              </p>
            )}
          </motion.div>

          {/* Player count */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="flex items-center gap-2 text-sm"
          >
            <Users className="w-4 h-4 text-white/40" />
            <span className="text-white/60">
              <span className="text-white font-bold">{result.currentPlayers}</span>
              /{result.maxPlayers} players registered
            </span>
          </motion.div>

          {/* Info line */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
            className="text-xs text-white/35 text-center"
          >
            Bracket generated when full · Round 1 starts automatically
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="w-full flex flex-col gap-2"
          >
            <Button
              onClick={onClose}
              className="w-full"
              data-testid="button-youre-in-close"
            >
              View Tournament
            </Button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tournament Status Badge ──────────────────────────────────────────────────
function TournamentStatusBadge({ t, spotsLeft, pct }: { t: Tournament; spotsLeft: number; pct: number }) {
  if (t.status === "in-progress") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
        Live
      </span>
    );
  }
  if (t.status === "completed") {
    return <span className="inline-flex text-[10px] font-bold text-white/30 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">Ended</span>;
  }
  if (spotsLeft > 0 && spotsLeft <= 3) {
    return (
      <motion.span
        animate={{ opacity: [1, 0.55, 1] }}
        transition={{ duration: 1.1, repeat: Infinity }}
        className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Last {spotsLeft} Spot{spotsLeft !== 1 ? "s" : ""}!
      </motion.span>
    );
  }
  if (pct >= 70) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/25 rounded-full px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
        Filling Fast
      </span>
    );
  }
  return null;
}

// ─── Tournament Entry Confirm Modal ──────────────────────────────────────────
function TournamentEntryConfirmModal({
  tournament,
  onClose,
  onConfirm,
}: {
  tournament: Tournament;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const fee = parseFloat(tournament.entry_fee);
  const pool = parseFloat(tournament.prize_pool);
  const newPool = pool + fee;
  const GameIcon = gameIcons[tournament.game_type as keyof typeof gameIcons];

  const { data: walletData } = useQuery<{ balance: string }>({
    queryKey: ["/api/wallet/balance"],
    staleTime: 5000,
  });
  const balance = parseFloat(walletData?.balance ?? "0");
  const balanceAfter = balance - fee;
  const canAfford = balance >= fee;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-card border-white/10 p-0 overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg,#FF2D8A,#FF7A00)" }} />
        <div className="p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
                {GameIcon ? <GameIcon className="w-5 h-5" /> : <Trophy className="w-4 h-4 text-amber-400" />}
              </div>
              Confirm Entry
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground leading-snug">
            You're entering <span className="text-foreground font-semibold">{tournament.name}</span>. Your entry fee will be deducted immediately.
          </p>

          {/* Fee row */}
          <div className="rounded-lg border border-white/10 bg-white/4 divide-y divide-white/8">
            <div className="flex items-center justify-between px-3 py-2.5 text-sm">
              <span className="text-muted-foreground">Entry fee</span>
              <span className="font-bold text-red-400 flex items-center gap-1"><ScalpsIcon size="xs" />−{fee.toFixed(0)} S</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 text-sm">
              <span className="text-muted-foreground">Prize pool grows to</span>
              <span className="font-bold text-green-400 flex items-center gap-1"><ScalpsIcon size="xs" />{newPool.toFixed(0)} S</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 text-sm">
              <span className="text-muted-foreground">Your balance after</span>
              <span className={`font-bold flex items-center gap-1 ${canAfford ? "text-foreground" : "text-red-400"}`}>
                <ScalpsIcon size="xs" />{balanceAfter.toFixed(0)} S
              </span>
            </div>
          </div>

          {/* Prize split */}
          <div className="space-y-1.5">
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest">Prize Split</p>
            <div className="flex gap-2">
              {[{ rank: "1st", pct: 65, color: "text-yellow-400" }, { rank: "2nd", pct: 25, color: "text-slate-300" }, { rank: "3rd", pct: 10, color: "text-orange-400" }].map(p => (
                <div key={p.rank} className="flex-1 rounded-md bg-white/4 border border-white/8 p-2 text-center">
                  <div className={`text-xs font-black ${p.color}`}>{p.rank}</div>
                  <div className="text-[11px] text-white/70 font-semibold mt-0.5">{(newPool * p.pct / 100).toFixed(0)} S</div>
                </div>
              ))}
            </div>
          </div>

          {!canAfford && (
            <p className="text-xs text-red-400 text-center">Insufficient balance. Please deposit more Scalps first.</p>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1" data-testid="button-cancel-entry">
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              disabled={!canAfford}
              className="flex-1 gap-1.5"
              data-testid="button-confirm-entry"
            >
              <Trophy className="w-3.5 h-3.5" />
              Enter — {fee.toFixed(0)} S
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const PRIZE_SPLIT = [0.65, 0.25, 0.1];

// ─── Featured Banner ──────────────────────────────────────────────────────────
function FeaturedBanner({ t, onJoin, joining, joined, onBracket }: {
  t: Tournament;
  onJoin: (t: Tournament) => void;
  joining: boolean;
  joined: boolean;
  onBracket?: (id: string) => void;
}) {
  const fee = parseFloat(t.entry_fee);
  const pool = parseFloat(t.prize_pool);
  const joinedCount = Number(t.joined_count ?? t.current_players);
  const pct = (joinedCount / t.max_players) * 100;
  const BracketIcon = bracketIcon(t.bracket_size);
  const GameIcon = gameIcons[t.game_type as keyof typeof gameIcons];

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl border border-white/10 mb-3"
      style={{ background: "linear-gradient(135deg, #0d1225 0%, #1a0d2e 50%, #0d1225 100%)" }}
      whileHover={{ scale: 1.005 }}
      data-testid={`featured-tournament-${t.id}`}
    >
      <div className="absolute inset-0 opacity-30 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 60% at 80% 40%, #FF2D8A44, #FF7A0022, transparent 70%)" }} />
      <div className="relative p-5 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-5">
        <div className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #FF2D8A22, #FF7A0033)", border: "1px solid #FF7A0044" }}>
          {GameIcon ? <GameIcon className="w-10 h-10" /> :
            <Trophy className="w-8 h-8 text-amber-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Featured</span>
            <Badge variant="outline" className="text-[10px] border-white/20 text-white/50 gap-1">
              <BracketIcon className="w-2.5 h-2.5" />{bracketLabel(t.bracket_size)}
            </Badge>
            <TournamentStatusBadge t={t} spotsLeft={t.max_players - joinedCount} pct={pct} />
          </div>
          <h3 className="text-xl md:text-2xl font-black text-white mb-1">{t.name}</h3>
          <p className="text-sm text-white/60 mb-3">{t.description}</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <div><span className="text-white/40 text-xs">Prize Pool</span><br />
              <span className="font-bold text-green-400 flex items-center gap-1"><ScalpsIcon size="xs" />{pool.toFixed(0)} Scalps</span></div>
            <div><span className="text-white/40 text-xs">Entry</span><br />
              <span className="font-bold">{fee === 0 ? "Free" : <><ScalpsIcon size="xs" className="inline" /> {fee.toFixed(0)} S</>}</span></div>
            <div><span className="text-white/40 text-xs">Starts in</span><br />
              <span className="font-bold text-primary">{formatTimeUntil(t.starts_at)}</span></div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg,#FF2D8A,#FF7A00)", width: `${pct}%` }}
                initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.3 }} />
            </div>
            <span className="text-xs text-white/50 shrink-0">{joinedCount}/{t.max_players}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          {(t.status === "in-progress" || t.status === "completed") && onBracket && (
            <Button size="sm" variant="outline" onClick={() => onBracket(t.id)} className="gap-1.5 border-white/20" data-testid={`btn-bracket-${t.id}`}>
              <Target className="w-3.5 h-3.5" />View Bracket
            </Button>
          )}
          {t.status === "open" && (
            <Button size="lg" className="gap-2" onClick={() => onJoin(t)} disabled={joining || joined}
              variant={joined ? "outline" : "default"} data-testid={`btn-join-${t.id}`}>
              {joined ? <><CheckCircle className="w-4 h-4" />Registered</> :
               joining ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Entering…</> :
               <><Trophy className="w-4 h-4" />{fee === 0 ? "Enter Free" : `Enter — ${formatScalps(fee)}`}</>}
            </Button>
          )}
          {t.status === "completed" && (
            <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-xs">Completed</Badge>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Tournament Card ──────────────────────────────────────────────────────────
function TournamentCard({ t, onJoin, joining, joined, onBracket }: {
  t: Tournament; onJoin: (t: Tournament) => void; joining: boolean; joined: boolean; onBracket?: (id: string) => void;
}) {
  const fee = parseFloat(t.entry_fee);
  const pool = parseFloat(t.prize_pool);
  const joinedCount = Number(t.joined_count ?? t.current_players);
  const pct = (joinedCount / t.max_players) * 100;
  const BracketIcon = bracketIcon(t.bracket_size);
  const GameIcon = gameIcons[t.game_type as keyof typeof gameIcons];
  const spotsLeft = t.max_players - joinedCount;

  return (
    <Magnetic3D maxTilt={5} data-testid={`tournament-card-${t.id}`}>
    <motion.div
      className="rounded-xl border border-white/8 bg-card/60 overflow-hidden flex flex-col hover-elevate h-full"
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
    >
      <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg,#FF2D8A,#FF7A00)" }} />
      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 border border-primary/20">
            {GameIcon ? <GameIcon className="w-6 h-6" /> :
              <Trophy className="w-5 h-5 text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm leading-tight line-clamp-1">{t.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <BracketIcon className="w-3 h-3 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">{t.game_type.replace(/-/g," ")}</span>
              <TournamentStatusBadge t={t} spotsLeft={spotsLeft} pct={pct} />
            </div>
          </div>
          {joined && <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-muted/40 rounded-lg p-2 text-center">
            <div className="text-muted-foreground text-[10px] mb-0.5">Prize Pool</div>
            <div className="font-bold text-green-400 flex items-center justify-center gap-0.5"><ScalpsIcon size="xs" />{pool.toFixed(0)}</div>
          </div>
          <div className="bg-muted/40 rounded-lg p-2 text-center">
            <div className="text-muted-foreground text-[10px] mb-0.5">Entry</div>
            <div className="font-bold">{fee === 0 ? "Free" : `${fee.toFixed(0)} S`}</div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />{joinedCount}/{t.max_players}
            </span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTimeUntil(t.starts_at)}</span>
          </div>
          <div className="h-1 rounded-full bg-muted/40 overflow-hidden progress-glow">
            <motion.div className="h-full rounded-full xp-bar-fill" style={{ width: `${pct}%` }}
              initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} />
          </div>
        </div>

        {/* Prizes */}
        <div className="flex gap-1.5 text-[10px]">
          {[{ rank: "1st", color: "text-yellow-400", pct: 65 }, { rank: "2nd", color: "text-slate-300", pct: 25 }, { rank: "3rd", color: "text-orange-500", pct: 10 }].map(p => (
            <div key={p.rank} className="flex-1 bg-muted/30 rounded p-1 text-center">
              <div className={`font-bold ${p.color}`}>{p.rank}</div>
              <div className="font-medium">{(pool * p.pct / 100).toFixed(0)} S</div>
            </div>
          ))}
        </div>

        {(t.status === "in-progress" || t.status === "completed") && onBracket ? (
          <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs" onClick={() => onBracket(t.id)} data-testid={`card-bracket-${t.id}`}>
            <Target className="w-3 h-3" />View Live Bracket
          </Button>
        ) : (
          <Button size="sm" className="w-full gap-1.5 text-xs" onClick={() => onJoin(t)} disabled={joining || joined}
            variant={joined ? "outline" : "default"} data-testid={`card-join-${t.id}`}>
            {joined ? <><CheckCircle className="w-3 h-3" />Registered</> :
             joining ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Entering…</> :
             fee === 0 ? <><Zap className="w-3 h-3" />Enter Free</> :
             <><Trophy className="w-3 h-3" />{formatScalps(fee)}</>}
          </Button>
        )}
      </div>
    </motion.div>
    </Magnetic3D>
  );
}

// ─── Live Tournament Bracket Modal ────────────────────────────────────────────
interface BracketSlot {
  id: string;
  round: number;
  match_slot: number;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  status: string;
}

interface TournamentDetail extends Tournament {
  participants: Array<{
    user_id: string;
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    profile_image_url: string | null;
  }>;
  brackets: BracketSlot[];
}

function userDisplayName(u: { username?: string | null; first_name?: string | null; last_name?: string | null } | undefined): string {
  if (!u) return "TBD";
  return u.username ?? u.first_name ?? "Player";
}

// ─── SVG Bracket Visualization ────────────────────────────────────────────────
const BCARD_H = 72;
const BCARD_W = 150;
const BCOL_GAP = 60;
const BROW_GAP = 8;

function computeBracketPositions(bracketSize: number): number[][] {
  const totalRounds = Math.log2(bracketSize);
  const positions: number[][] = [];
  const n1 = bracketSize / 2;
  positions.push(Array.from({ length: n1 }, (_, m) => m * (BCARD_H + BROW_GAP) + BCARD_H / 2));
  for (let r = 1; r < totalRounds; r++) {
    const prev = positions[r - 1];
    positions.push(Array.from({ length: prev.length / 2 }, (_, m) => (prev[2 * m] + prev[2 * m + 1]) / 2));
  }
  return positions;
}

function BracketMatchCard({
  slot, participants, currentUserId, isFinal,
}: {
  slot: BracketSlot | undefined;
  participants: TournamentDetail["participants"];
  currentUserId?: string;
  isFinal?: boolean;
}) {
  if (!slot) {
    return (
      <div className="w-full h-full rounded-md border border-dashed border-white/10 flex items-center justify-center">
        <span className="text-[10px] text-white/20">TBD</span>
      </div>
    );
  }

  const p1 = participants.find(p => p.user_id === slot.player1_id);
  const p2 = participants.find(p => p.user_id === slot.player2_id);
  const isLive = slot.status === "in-progress";
  const isDone = slot.status === "completed";

  const PlayerRow = ({ p, playerId }: { p: typeof p1; playerId: string | null }) => {
    const isWinner = !!(slot.winner_id && playerId === slot.winner_id);
    const isLoser = !!(slot.winner_id && playerId !== slot.winner_id && playerId);
    const isMe = playerId === currentUserId;
    return (
      <div className={`flex items-center gap-1.5 px-2 py-1 ${isLoser ? "opacity-35" : ""}`}>
        <Avatar className="h-4 w-4 shrink-0">
          <AvatarImage src={p?.profile_image_url ?? ""} />
          <AvatarFallback className="text-[7px]">{userDisplayName(p)[0]}</AvatarFallback>
        </Avatar>
        <span className={`text-[11px] truncate flex-1 font-medium ${isWinner ? "text-green-400" : isMe ? "text-primary" : "text-foreground/80"}`}>
          {userDisplayName(p)}
        </span>
        {isMe && !isWinner && <span className="text-[8px] font-black text-primary/70 bg-primary/10 px-1 rounded shrink-0">YOU</span>}
        {isWinner && <Trophy className="w-2.5 h-2.5 text-yellow-400 shrink-0" />}
      </div>
    );
  };

  return (
    <motion.div
      className="w-full h-full rounded-md border overflow-hidden relative"
      style={{
        borderColor: isLive ? "rgba(59,130,246,0.5)" : isDone ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)",
        background: isLive ? "rgba(59,130,246,0.06)" : isDone ? "rgba(34,197,94,0.04)" : "rgba(255,255,255,0.03)",
        boxShadow: isFinal && isDone ? "0 0 24px rgba(234,179,8,0.2)" : isLive ? "0 0 12px rgba(59,130,246,0.15)" : "none",
      }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      {isLive && (
        <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse z-10" />
      )}
      {isFinal && isDone && (
        <div className="absolute top-0 inset-x-0 h-0.5" style={{ background: "linear-gradient(90deg,#FF2D8A,#FF7A00)" }} />
      )}
      <PlayerRow p={p1} playerId={slot.player1_id} />
      <div className="border-t border-white/8" />
      <PlayerRow p={p2} playerId={slot.player2_id} />
    </motion.div>
  );
}

function BracketVisualization({
  data, currentUserId,
}: {
  data: TournamentDetail;
  currentUserId?: string;
}) {
  const bracketSize = Math.max(data.bracket_size || data.max_players, 4);
  const totalRounds = Math.log2(bracketSize);
  const positions = computeBracketPositions(bracketSize);

  const totalH = positions[0].length * (BCARD_H + BROW_GAP) - BROW_GAP + 8;
  const totalW = totalRounds * BCARD_W + (totalRounds - 1) * BCOL_GAP;

  const slotMap = new Map<string, BracketSlot>();
  data.brackets.forEach(b => slotMap.set(`${b.round}-${b.match_slot}`, b));

  const roundLabels = (ri: number) => {
    if (ri === totalRounds - 1) return "Final";
    if (ri === totalRounds - 2) return "Semi-Final";
    if (ri === totalRounds - 3) return "Quarter-Final";
    return `Round ${ri + 1}`;
  };

  return (
    <div className="overflow-x-auto pb-2">
      <div className="relative" style={{ width: totalW, height: totalH + 28 }}>
        {/* Round labels */}
        {Array.from({ length: totalRounds }, (_, ri) => (
          <div
            key={`label-${ri}`}
            className="absolute text-[10px] font-semibold text-white/40 uppercase tracking-wider text-center"
            style={{ left: ri * (BCARD_W + BCOL_GAP), width: BCARD_W, top: 0 }}
          >
            {roundLabels(ri)}
          </div>
        ))}

        {/* SVG connector lines */}
        <svg className="absolute pointer-events-none" style={{ left: 0, top: 20, width: totalW, height: totalH }}>
          {Array.from({ length: totalRounds - 1 }, (_, ri) => {
            const srcRound = positions[ri];
            const tgtRound = positions[ri + 1];
            const srcX = ri * (BCARD_W + BCOL_GAP) + BCARD_W;
            const midX = srcX + BCOL_GAP / 2;
            const tgtX = (ri + 1) * (BCARD_W + BCOL_GAP);
            return tgtRound.map((tgtY, m) => {
              const yTop = srcRound[2 * m];
              const yBot = srcRound[2 * m + 1];
              return (
                <g key={`conn-${ri}-${m}`}>
                  <path
                    d={`M ${srcX} ${yTop} H ${midX} V ${yBot} H ${srcX}`}
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth={1.5}
                    strokeLinejoin="round"
                  />
                  <path
                    d={`M ${midX} ${tgtY} H ${tgtX}`}
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth={1.5}
                  />
                </g>
              );
            });
          })}
        </svg>

        {/* Match cards */}
        {Array.from({ length: totalRounds }, (_, ri) =>
          positions[ri].map((centerY, mi) => {
            const round = ri + 1;
            const matchSlot = mi + 1;
            const slot = slotMap.get(`${round}-${matchSlot}`);
            return (
              <div
                key={`${round}-${matchSlot}`}
                className="absolute"
                style={{
                  left: ri * (BCARD_W + BCOL_GAP),
                  top: 20 + centerY - BCARD_H / 2,
                  width: BCARD_W,
                  height: BCARD_H,
                }}
              >
                <BracketMatchCard
                  slot={slot}
                  participants={data.participants}
                  currentUserId={currentUserId}
                  isFinal={round === totalRounds}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function LiveBracketModal({
  tournamentId,
  onClose,
  currentUserId,
}: {
  tournamentId: string;
  onClose: () => void;
  currentUserId?: string;
}) {
  const { data, isLoading } = useQuery<TournamentDetail>({
    queryKey: ["/api/tournaments", tournamentId],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${tournamentId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load bracket");
      return res.json();
    },
    refetchInterval: 8_000,
  });

  if (isLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-4xl bg-card border-white/10">
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!data) return null;

  const maxRound = data.brackets.length > 0 ? Math.max(...data.brackets.map(b => b.round)) : 0;
  const pool = parseFloat(data.prize_pool);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto bg-card border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            {data.name} — Live Bracket
            {data.status === "in-progress" && (
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Live
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Prize split */}
        <div className="flex gap-3 mb-4">
          {[{ label: "1st Place", pct: 65, color: "text-yellow-400", bg: "rgba(234,179,8,0.08)", border: "rgba(234,179,8,0.2)" },
            { label: "2nd Place", pct: 25, color: "text-slate-300", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)" },
            { label: "3rd Place", pct: 10, color: "text-orange-400", bg: "rgba(180,83,9,0.08)", border: "rgba(180,83,9,0.2)" }].map(p => (
            <div key={p.label} className="flex-1 rounded-lg p-2.5 text-center" style={{ background: p.bg, border: `1px solid ${p.border}` }}>
              <div className={`text-lg font-black font-mono ${p.color}`}>{(pool * p.pct / 100).toFixed(0)} S</div>
              <div className="text-[10px] text-white/40">{p.label}</div>
            </div>
          ))}
        </div>

        {data.status === "open" && (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Bracket generated when the tournament starts.</p>
            <p className="text-xs mt-1">
              {Number(data.joined_count ?? data.current_players)}/{data.max_players} players registered
            </p>
          </div>
        )}

        {maxRound > 0 && (
          <div className="mt-2">
            <BracketVisualization data={data} currentUserId={currentUserId} />
          </div>
        )}

        {/* Participants */}
        {data.participants.length > 0 && (
          <div className="border-t border-white/10 pt-4 mt-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Registered Players ({data.participants.length}/{data.max_players})
            </p>
            <div className="flex flex-wrap gap-2">
              {data.participants.map(p => {
                const isMe = p.user_id === currentUserId;
                return (
                  <div key={p.user_id} className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${isMe ? "bg-primary/10 border-primary/30" : "bg-muted/30 border-white/5"}`}>
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={p.profile_image_url ?? ""} />
                      <AvatarFallback className="text-[8px]">{userDisplayName(p)[0]}</AvatarFallback>
                    </Avatar>
                    <span className={`text-xs ${isMe ? "text-primary font-bold" : ""}`}>{userDisplayName(p)}</span>
                    {isMe && <span className="text-[8px] font-black text-primary/70">YOU</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Admin Create Tournament Modal ────────────────────────────────────────────
const GAME_OPTS = [
  "chess","mini-golf","connect-4","air-hockey","rock-paper-scissors","8-ball","bowling","dots-and-boxes","block-blast","cup-king","stack-tower",
];

// ─── Shared sub-components for the Event Builder ─────────────────────────────
function EBSectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.28)" }}>
        <Icon className="w-3.5 h-3.5 text-indigo-400" />
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{label}</span>
    </div>
  );
}

function EBField({ label, helper, error, children }: { label: string; helper?: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-white/60 block">{label}</label>
      {children}
      {helper && !error && <p className="text-[10px] text-white/25">{helper}</p>}
      {error && (
        <motion.p initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="text-[10px] text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" />{error}
        </motion.p>
      )}
    </div>
  );
}

function EBToggle({ value, onChange, testId }: { value: boolean; onChange: (v: boolean) => void; testId?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      data-testid={testId}
      className="relative w-9 h-5 rounded-full transition-all shrink-0 focus:outline-none"
      style={{ background: value ? "#6366f1" : "rgba(255,255,255,0.1)" }}
    >
      <span
        className="absolute w-3.5 h-3.5 rounded-full bg-white shadow transition-all top-[3px]"
        style={{ left: value ? "19px" : "3px" }}
      />
    </button>
  );
}

// ─── Admin Create Tournament Modal ─────────────────────────────────────────────
function AdminCreateTournamentModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const gameLabel = (g: string) => g.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const [form, setForm] = useState({
    name: "",
    description: "",
    isFeatured: false,
    gameType: "chess",
    bracketSize: "8",
    format: "single-elimination",
    entryFee: "0",
    minPlayers: "4",
    startsAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16),
    registrationClose: new Date(Date.now() + 20 * 3600 * 1000).toISOString().slice(0, 16),
    minRank: "__none",
    autoStart: false,
    refundIfNotFull: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  const RAKE = 0.03;
  const bracketNum = parseInt(form.bracketSize) || 8;
  const entryFeeNum = parseFloat(form.entryFee) || 0;
  const isFree = entryFeeNum === 0;
  const projectedPool = entryFeeNum * bracketNum;
  const platformFee = projectedPool * RAKE;
  const winnerReceives = projectedPool * (1 - RAKE);
  const timeUntilStart = new Date(form.startsAt).getTime() - Date.now();
  const countdownStr = timeUntilStart > 0
    ? (() => { const h = Math.floor(timeUntilStart / 3600000); const m = Math.floor((timeUntilStart % 3600000) / 60000); return h > 0 ? `${h}h ${m}m` : `${m}m`; })()
    : "Start time invalid";

  const set = (field: string, val: unknown) => {
    setForm(f => ({ ...f, [field]: val }));
    setErrors(e => { const n = { ...e }; delete n[field]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Tournament name is required";
    else if (form.name.trim().length < 3) e.name = "Name must be at least 3 characters";
    else if (form.name.trim().length > 50) e.name = "Name must be 50 characters or less";
    if (!form.gameType) e.gameType = "Please select a game";
    if (![4,8,16,32].includes(bracketNum)) e.bracketSize = "Must be 4, 8, 16, or 32 players";
    if (entryFeeNum < 0) e.entryFee = "Entry fee cannot be negative";
    if (timeUntilStart <= 0) e.startsAt = "Start time must be in the future";
    const minP = parseInt(form.minPlayers);
    if (minP > bracketNum) e.minPlayers = `Cannot exceed bracket size (${bracketNum})`;
    return e;
  };

  const create = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/tournaments", {
      name: form.name.trim(),
      gameType: form.gameType,
      bracketSize: bracketNum,
      entryFee: form.entryFee,
      prizePool: isFree ? "0" : String(projectedPool.toFixed(2)),
      startsAt: new Date(form.startsAt).toISOString(),
      description: form.description,
      isFeatured: form.isFeatured,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments"] });
      setSuccess(true);
      setTimeout(onClose, 2200);
    },
    onError: () => toast({ title: "Tournament could not be created. Please try again.", variant: "destructive" }),
  });

  const handleCreate = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    create.mutate();
  };

  const inputCls = (err?: string) =>
    `bg-white/5 border text-white placeholder:text-white/20 transition-all duration-200 focus-visible:ring-0 focus-visible:bg-white/8 ${err ? "border-red-500/60 focus-visible:border-red-500/80" : "border-white/10 focus-visible:border-indigo-400/60"}`;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-transparent border-0 shadow-none" style={{ maxHeight: "92vh" }} aria-describedby={undefined}>
        <DialogTitle className="sr-only">Create Tournament</DialogTitle>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-2xl overflow-hidden flex flex-col"
          style={{
            background: "linear-gradient(145deg, #080c1a 0%, #0d1230 55%, #0f0a1e 100%)",
            border: "1px solid rgba(99,102,241,0.28)",
            boxShadow: "0 0 0 1px rgba(99,102,241,0.08), 0 40px 80px -20px rgba(0,0,0,0.9), 0 0 60px -24px rgba(99,102,241,0.2)",
            maxHeight: "92vh",
          }}
        >
          {/* Neon top edge */}
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent 5%, rgba(99,102,241,0.7) 40%, rgba(168,85,247,0.7) 60%, transparent 95%)" }} />

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.28), rgba(168,85,247,0.28))", border: "1px solid rgba(99,102,241,0.35)" }}>
                <Trophy className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-xl font-black" style={{ background: "linear-gradient(90deg, #a5b4fc, #c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Create Tournament
                </h2>
                <p className="text-[11px] text-white/35 mt-0.5">Build a live competitive event for Jango players.</p>
              </div>
            </div>
            <button
              onClick={onClose}
              data-testid="button-close-create-tournament"
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-white/35 hover:text-white/80"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Success overlay */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4"
                style={{ background: "rgba(8,12,26,0.97)" }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 280 }}
                  className="w-20 h-20 rounded-2xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(168,85,247,0.2))", border: "1px solid rgba(99,102,241,0.4)", boxShadow: "0 0 50px -12px rgba(99,102,241,0.7)" }}
                >
                  <Trophy className="w-10 h-10 text-indigo-400" />
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="text-center">
                  <h3 className="text-2xl font-black text-white">Tournament Created</h3>
                  <p className="text-white/40 text-sm mt-1">{form.name} is live and ready for registration.</p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Body */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_264px]">

              {/* ── Left: form ── */}
              <div className="p-6 space-y-8" style={{ borderRight: "1px solid rgba(255,255,255,0.05)" }}>

                {/* A: Identity */}
                <section>
                  <EBSectionLabel icon={Star} label="Tournament Identity" />
                  <div className="space-y-4">
                    <EBField label="Tournament Name" helper='Keep it short and recognizable.' error={errors.name}>
                      <Input
                        data-testid="input-tournament-name"
                        value={form.name}
                        onChange={e => set("name", e.target.value)}
                        placeholder="Friday Night Chess Cup"
                        className={inputCls(errors.name)}
                        maxLength={50}
                      />
                    </EBField>
                    <EBField label="Description" helper="Optional — shown on the tournament card.">
                      <Textarea
                        data-testid="input-tournament-description"
                        value={form.description}
                        onChange={e => set("description", e.target.value)}
                        placeholder="Describe the event, rules, or prizes..."
                        className={`${inputCls()} resize-none text-sm`}
                        rows={2}
                      />
                    </EBField>
                    <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <EBToggle value={form.isFeatured} onChange={v => set("isFeatured", v)} testId="toggle-featured" />
                      <div>
                        <p className="text-xs font-semibold text-white/75">Feature this tournament</p>
                        <p className="text-[10px] text-white/30">Appears at the top of the tournament list.</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* B: Game + Format */}
                <section>
                  <EBSectionLabel icon={Gamepad2} label="Game + Format" />
                  <div className="space-y-4">
                    <EBField label="Game" error={errors.gameType}>
                      <Select value={form.gameType} onValueChange={v => set("gameType", v)}>
                        <SelectTrigger data-testid="select-tournament-game" className={inputCls(errors.gameType)}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GAME_OPTS.map(g => <SelectItem key={g} value={g}>{gameLabel(g)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </EBField>
                    <div className="grid grid-cols-2 gap-3">
                      <EBField label="Bracket Size" error={errors.bracketSize}>
                        <Select value={form.bracketSize} onValueChange={v => set("bracketSize", v)}>
                          <SelectTrigger data-testid="select-bracket-size" className={inputCls(errors.bracketSize)}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["4","8","16","32"].map(s => <SelectItem key={s} value={s}>{s} players</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </EBField>
                      <EBField label="Format">
                        <Select value={form.format} onValueChange={v => set("format", v)}>
                          <SelectTrigger className={inputCls()}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="single-elimination">Single Elim.</SelectItem>
                            <SelectItem value="double-elimination">Double Elim.</SelectItem>
                            <SelectItem value="round-robin">Round Robin</SelectItem>
                          </SelectContent>
                        </Select>
                      </EBField>
                    </div>
                    {/* Inline bracket preview (mobile-friendly) */}
                    <div className="rounded-xl p-3 lg:hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/25 mb-2">Bracket Preview ({bracketNum}p)</p>
                      <PremiumBracketPreview size={bracketNum} compact />
                    </div>
                  </div>
                </section>

                {/* C: Entry + Prize */}
                <section>
                  <EBSectionLabel icon={DollarSign} label="Entry + Prize Pool" />
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <EBField label="Entry Fee (Scalps)" helper={isFree ? "Free entry" : "Players pay this to enter"} error={errors.entryFee}>
                        <div className="relative">
                          <ScalpsIcon size="xs" className="absolute left-3 top-1/2 -translate-y-1/2 z-10" />
                          <Input
                            data-testid="input-entry-fee"
                            type="number" min="0"
                            value={form.entryFee}
                            onChange={e => set("entryFee", e.target.value)}
                            className={`pl-7 ${inputCls(errors.entryFee)}`}
                          />
                        </div>
                      </EBField>
                      <EBField label="Min Players to Start" error={errors.minPlayers}>
                        <Input
                          data-testid="input-min-players"
                          type="number" min="2" max={bracketNum}
                          value={form.minPlayers}
                          onChange={e => set("minPlayers", e.target.value)}
                          className={inputCls(errors.minPlayers)}
                        />
                      </EBField>
                    </div>

                    <AnimatePresence mode="wait">
                      {!isFree ? (
                        <motion.div key="breakdown" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                          className="rounded-xl p-4 space-y-2"
                          style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)" }}
                        >
                          <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400/60 mb-2">Prize Breakdown</p>
                          {([
                            ["Entry Fee", `${entryFeeNum.toFixed(2)} S`],
                            ["Players", `× ${bracketNum}`],
                            ["Projected Pool", `${projectedPool.toFixed(2)} S`],
                            ["Platform Fee (3%)", `−${platformFee.toFixed(2)} S`],
                          ] as [string,string][]).map(([lbl, val]) => (
                            <div key={lbl} className="flex justify-between text-[11px]">
                              <span className="text-white/35">{lbl}</span>
                              <span className="font-mono text-white/60">{val}</span>
                            </div>
                          ))}
                          <div className="flex justify-between items-center pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                            <span className="text-xs font-bold text-white/65">Winner Receives</span>
                            <span className="text-base font-black text-green-400">{winnerReceives.toFixed(2)} S</span>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div key="free" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="flex items-center gap-2 p-3 rounded-lg text-[11px] text-blue-300/65"
                          style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.18)" }}
                        >
                          <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          Free tournament — no entry fee required. Set prizes manually if desired.
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </section>

                {/* D: Schedule */}
                <section>
                  <EBSectionLabel icon={Calendar} label="Schedule" />
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <EBField label="Starts At" error={errors.startsAt}>
                        <Input
                          data-testid="input-starts-at"
                          type="datetime-local"
                          value={form.startsAt}
                          onChange={e => set("startsAt", e.target.value)}
                          className={inputCls(errors.startsAt)}
                        />
                      </EBField>
                      <EBField label="Registration Closes">
                        <Input
                          type="datetime-local"
                          value={form.registrationClose}
                          onChange={e => set("registrationClose", e.target.value)}
                          className={inputCls()}
                        />
                      </EBField>
                    </div>
                    {timeUntilStart > 0 && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <Clock className="w-3.5 h-3.5 text-white/25 shrink-0" />
                        <span className="text-[11px] text-white/35">Starts in <span className="font-bold text-white/60">{countdownStr}</span></span>
                        <span className="text-[10px] text-white/20 ml-auto">
                          UTC{new Date().getTimezoneOffset() / -60 >= 0 ? "+" : ""}{new Date().getTimezoneOffset() / -60}
                        </span>
                      </div>
                    )}
                  </div>
                </section>

                {/* E: Rules */}
                <section>
                  <EBSectionLabel icon={Shield} label="Rules + Requirements" />
                  <div className="space-y-4">
                    <EBField label="Minimum Rank Requirement" helper="Leave blank to allow all ranks.">
                      <Select value={form.minRank} onValueChange={v => set("minRank", v)}>
                        <SelectTrigger className={inputCls()}>
                          <SelectValue placeholder="No restriction" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">No restriction</SelectItem>
                          {["Bronze","Silver","Gold","Platinum","Diamond","Master","Grandmaster"].map(r => (
                            <SelectItem key={r} value={r.toLowerCase()}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </EBField>
                    <div className="space-y-2">
                      {([
                        { key: "autoStart", label: "Auto-start when full", desc: "Begin bracket automatically when max players join" },
                        { key: "refundIfNotFull", label: "Refund if minimum not met", desc: "Refund entry fees if minimum players don't register" },
                      ] as const).map(({ key, label, desc }) => (
                        <div key={key} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                          <EBToggle value={!!form[key]} onChange={v => set(key, v)} testId={`toggle-${key}`} />
                          <div>
                            <p className="text-[11px] font-semibold text-white/75">{label}</p>
                            <p className="text-[10px] text-white/30">{desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </div>

              {/* ── Right: Live Preview (desktop) ── */}
              <div className="hidden lg:flex flex-col gap-5 p-5">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/25">Live Preview</p>

                {/* Preview tournament card */}
                <div className="rounded-xl overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.07))", border: "1px solid rgba(99,102,241,0.22)" }}>
                  <div className="p-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {form.isFeatured && (
                      <div className="inline-flex items-center gap-1 mb-2 text-[9px] font-black text-amber-400 uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)" }}>
                        <Star className="w-2.5 h-2.5" />Featured
                      </div>
                    )}
                    <h3 className="text-sm font-black text-white leading-snug">
                      {form.name || <span className="text-white/20 font-normal italic text-xs">Tournament name...</span>}
                    </h3>
                    <p className="text-[10px] text-white/35 mt-0.5">{gameLabel(form.gameType)} · {bracketNum}p {form.format.replace(/-/g, " ")}</p>
                  </div>
                  <div className="p-3 space-y-2">
                    {([
                      ["Prize Pool", isFree ? "Free" : `${projectedPool.toFixed(0)} S`, isFree ? "text-blue-400" : "text-green-400"],
                      ["Entry Fee",  isFree ? "Free" : `${entryFeeNum.toFixed(2)} S`, "text-white/65"],
                      ["Players",    `${bracketNum} bracket`, "text-white/65"],
                      ["Starts in",  countdownStr, "text-white/65"],
                    ] as [string,string,string][]).map(([lbl, val, cls]) => (
                      <div key={lbl} className="flex justify-between text-[11px]">
                        <span className="text-white/30">{lbl}</span>
                        <span className={`font-semibold ${cls}`}>{val}</span>
                      </div>
                    ))}
                    <div className="pt-1">
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-blue-400" style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)" }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        Open for registration
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bracket preview */}
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/25 mb-2">Bracket ({bracketNum}p)</p>
                  <div className="rounded-xl p-3 overflow-x-auto" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <PremiumBracketPreview size={bracketNum} compact />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <Button variant="ghost" onClick={onClose} className="text-white/35" data-testid="button-cancel-tournament">
              Cancel
            </Button>
            {Object.keys(errors).length > 0 && (
              <span className="text-[11px] text-red-400 flex items-center gap-1 mr-auto ml-2">
                <AlertCircle className="w-3 h-3" />Fix errors above
              </span>
            )}
            <Button
              onClick={handleCreate}
              disabled={create.isPending || success}
              data-testid="button-create-tournament"
              className="gap-2 font-bold text-white border-0"
              style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", boxShadow: "0 0 20px -8px rgba(99,102,241,0.6)" }}
            >
              <Trophy className="w-4 h-4" />
              {create.isPending ? "Creating..." : success ? "Tournament Created" : "Create Tournament"}
            </Button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Premium Bracket Preview ──────────────────────────────────────────────────
function PremiumBracketPreview({ size, compact = false }: { size: number; compact?: boolean }) {
  const rounds = Math.log2(Math.max(size, 4));
  return (
    <div className="flex items-start gap-2 overflow-x-auto pb-1">
      {Array.from({ length: rounds }, (_, r) => {
        const matches = size / Math.pow(2, r + 1);
        const isLast = r === rounds - 1;
        const isSemi = r === rounds - 2;
        return (
          <div key={r} className="flex flex-col gap-2 shrink-0">
            <div className="text-[9px] text-center font-bold uppercase tracking-wider mb-1" style={{ color: isLast ? "#a5b4fc" : isSemi ? "rgba(165,180,252,0.5)" : "rgba(255,255,255,0.2)" }}>
              {isLast ? "Final" : isSemi ? "Semi" : `R${r + 1}`}
            </div>
            {Array.from({ length: matches }, (_, m) => (
              <div key={m} className={compact ? "w-14" : "w-20"}>
                <div className="h-5 rounded flex items-center px-1.5 gap-1" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${isLast ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.08)"}` }}>
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: "rgba(99,102,241,0.25)", border: "1px solid rgba(99,102,241,0.4)" }} />
                  <div className="h-1 rounded-full flex-1" style={{ background: "rgba(255,255,255,0.08)" }} />
                </div>
                <div className="h-1 my-0.5" style={{ background: "rgba(255,255,255,0.04)" }} />
                <div className="h-5 rounded flex items-center px-1.5 gap-1" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${isLast ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.08)"}` }}>
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: "rgba(99,102,241,0.25)", border: "1px solid rgba(99,102,241,0.4)" }} />
                  <div className="h-1 rounded-full flex-1" style={{ background: "rgba(255,255,255,0.08)" }} />
                </div>
              </div>
            ))}
          </div>
        );
      })}
      <div className="flex flex-col items-center justify-center shrink-0 gap-1 ml-1">
        <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#fbbf24" }}>Champ</div>
        <div className={`${compact ? "w-12" : "w-16"} h-11 rounded-lg flex items-center justify-center`} style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(99,102,241,0.1))", border: "1px solid rgba(245,158,11,0.35)", boxShadow: "0 0 14px -6px rgba(245,158,11,0.5)" }}>
          <Crown className="w-5 h-5 text-amber-400" />
        </div>
      </div>
    </div>
  );
}

// ─── Legacy Bracket Preview (used in bracket modal) ───────────────────────────
function BracketPreview({ size }: { size: number }) {
  return <PremiumBracketPreview size={size} />;
}

// ─── Main Tournaments Page ────────────────────────────────────────────────────
export default function TournamentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"all" | "quick" | "standard" | "large">("all");
  const [previewBracket, setPreviewBracket] = useState<number | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [bracketModal, setBracketModal] = useState<string | null>(null);
  const [showAdminCreate, setShowAdminCreate] = useState(false);
  const [youreInData, setYoureInData] = useState<{ tournament: Tournament; result: JoinResult } | null>(null);
  const [confirmTournament, setConfirmTournament] = useState<Tournament | null>(null);

  const isAdmin = (user as any)?.isAdmin === true;

  const { data: tournaments = [], isLoading } = useQuery<Tournament[]>({
    queryKey: ["/api/tournaments"], refetchInterval: 30_000,
  });

  const joinMutation = useMutation<JoinResult, Error, Tournament>({
    mutationFn: (t: Tournament) => apiRequest("POST", `/api/tournaments/${t.id}/join`, {}).then(r => r.json()),
    onSuccess: (result, t) => {
      setJoinedIds(prev => new Set([...Array.from(prev), t.id]));
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      Feedback.play("tournament_join");
      // alreadyRegistered → quiet "resume" toast, no celebration modal (avoids "You're In!" for repeat joins)
      if ((result as any)?.alreadyRegistered) {
        toast({ title: "Resuming Tournament", description: `You're already registered for ${t.name}.` });
        setBracketModal(t.id);
      } else {
        setYoureInData({ tournament: t, result });
      }
    },
    onError: (err: any) => {
      Feedback.play("error");
      const msg = err?.message ?? "Failed to join";
      const friendly =
        msg.includes("full") ? "This tournament is already full." :
        msg.includes("Insufficient") ? "You don't have enough Scalps to enter." :
        msg.includes("not open") ? "This tournament is no longer accepting entries." :
        msg;
      toast({ title: "Can't join", description: friendly, variant: "destructive" });
    },
    onSettled: () => setJoiningId(null),
  });

  function handleJoin(t: Tournament) {
    if (!user) { toast({ title: "Sign in required", variant: "destructive" }); return; }
    Feedback.play("button_click");
    const fee = parseFloat(t.entry_fee);
    if (fee > 0) {
      setConfirmTournament(t);
    } else {
      setJoiningId(t.id);
      joinMutation.mutate(t);
    }
  }

  function handleConfirmedJoin() {
    if (!confirmTournament) return;
    const t = confirmTournament;
    setConfirmTournament(null);
    Feedback.play("match_confirm");
    setJoiningId(t.id);
    joinMutation.mutate(t);
  }

  const featured = tournaments.filter(t => t.is_featured);
  const filtered = tournaments.filter(t => {
    if (activeTab === "all") return true;
    if (activeTab === "quick") return t.bracket_size <= 8;
    if (activeTab === "standard") return t.bracket_size > 8 && t.bracket_size <= 16;
    return t.bracket_size > 16;
  });

  const TABS = [
    { key: "all", label: "All", icon: Trophy },
    { key: "quick", label: "Quick (8p)", icon: Zap },
    { key: "standard", label: "Standard (16p)", icon: Shield },
    { key: "large", label: "Large (32p)", icon: Crown },
  ] as const;

  const totalPrizes = tournaments.reduce((s, t) => s + parseFloat(t.prize_pool), 0);

  return (
    <div className="min-h-screen bg-background relative">
      <PageDepthBackground
        glowZones={[
          { x: "50%", y: "0%",  color: "255,45,138",  size: "60%", opacity: 0.08 },
          { x: "85%", y: "15%", color: "245,158,11",  size: "45%", opacity: 0.06 },
          { x: "15%", y: "60%", color: "139,92,246",  size: "35%", opacity: 0.04 },
        ]}
        particleCount={25}
      />
      <AppNavbar />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/6">
        <div className="absolute inset-0 opacity-25 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 90% 120% at 50% -10%, #FF2D8A, #FF7A00 40%, transparent 70%)" }} />
        <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-7 h-7 text-amber-400" />
                <h1 className="text-3xl md:text-4xl font-black" data-testid="tournaments-title">Tournaments</h1>
              </div>
              <p className="text-muted-foreground">Compete in bracketed tournaments. Winner takes the prize pool.</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-center px-4 py-2 rounded-lg bg-white/5 border border-white/10">
                <div className="text-xl font-black text-green-400">{tournaments.filter(t => t.status === "open").length}</div>
                <div className="text-xs text-muted-foreground">Open</div>
              </div>
              <div className="text-center px-4 py-2 rounded-lg bg-white/5 border border-white/10">
                <div className="text-xl font-black text-amber-400 flex items-center gap-1">
                  <ScalpsIcon size="xs" />
                  {totalPrizes.toFixed(0)}
                </div>
                <div className="text-xs text-muted-foreground">Total Prizes</div>
              </div>
              {isAdmin && (
                <Button onClick={() => setShowAdminCreate(true)} data-testid="button-admin-create-tournament">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Create Tournament
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 pb-24 md:pb-8 space-y-8">

        {/* Featured */}
        {featured.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400/60" />
              <h2 className="font-bold text-lg">Featured Tournaments</h2>
            </div>
            <div className="space-y-3">
              {featured.map(t => (
                <FeaturedBanner
                  key={t.id}
                  t={t}
                  onJoin={handleJoin}
                  joining={joiningId === t.id}
                  joined={joinedIds.has(t.id)}
                  onBracket={setBracketModal}
                />
              ))}
            </div>
          </section>
        )}

        {/* Filter Tabs */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">All Tournaments</h2>
          </div>
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setActiveTab(key as typeof activeTab)}
                data-testid={`tab-tournament-${key}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors border
                  ${activeTab === key ? "bg-primary/15 text-primary border-primary/30" : "text-muted-foreground border-transparent hover-elevate"}`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-64 rounded-xl bg-card/40 animate-pulse border border-white/6" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl bg-amber-500/10 blur-xl scale-150" />
                <div className="relative w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Trophy className="w-8 h-8 text-amber-400/60" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-base">No tournaments live yet</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">Check back soon or start a match while you wait.</p>
              </div>
              <a href="/">
                <Button size="sm" variant="outline" className="gap-1.5" data-testid="button-play-match-empty-tournaments">
                  Play a Match
                </Button>
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filtered.map(t => (
                <TournamentCard
                  key={t.id}
                  t={t}
                  onJoin={handleJoin}
                  joining={joiningId === t.id}
                  joined={joinedIds.has(t.id)}
                  onBracket={setBracketModal}
                />
              ))}
            </div>
          )}
        </section>

        {/* Bracket Preview Section */}
        <section className="rounded-xl border border-white/8 bg-card/40 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-primary" />
            <h2 className="font-bold">Bracket Preview</h2>
          </div>
          <div className="flex gap-2 mb-4">
            {[8, 16, 32].map(s => (
              <button key={s} onClick={() => setPreviewBracket(previewBracket === s ? null : s)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors
                  ${previewBracket === s ? "bg-primary/15 border-primary/30 text-primary" : "border-white/10 text-muted-foreground hover-elevate"}`}>
                {s} players
              </button>
            ))}
          </div>
          <AnimatePresence>
            {previewBracket && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <BracketPreview size={previewBracket} />
              </motion.div>
            )}
          </AnimatePresence>
          {!previewBracket && <p className="text-sm text-muted-foreground">Select a bracket size above to preview the tournament structure.</p>}
        </section>

        {/* How it works */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { icon: Trophy, title: "Pay Entry", desc: "Spend Scalps to join. Entry fees are added directly to the prize pool." },
            { icon: Users, title: "Bracket Formed", desc: "Once full, the bracket is automatically generated and seeded." },
            { icon: Flame, title: "Win Matches", desc: "Defeat opponents in your game of choice to advance the bracket." },
            { icon: Crown, title: "Claim Prize", desc: "1st gets 65%, 2nd gets 25%, 3rd gets 10% of the prize pool." },
          ].map(({ icon: Icon, title, desc }, i) => (
            <div key={i} className="rounded-xl border border-white/8 bg-card/40 p-4">
              <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center mb-3">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div className="text-sm font-bold mb-1">{title}</div>
              <div className="text-xs text-muted-foreground">{desc}</div>
            </div>
          ))}
        </section>
      </div>

      {/* ─── Modals ─── */}
      {bracketModal && (
        <LiveBracketModal
          tournamentId={bracketModal}
          onClose={() => setBracketModal(null)}
          currentUserId={user?.id}
        />
      )}
      {showAdminCreate && <AdminCreateTournamentModal onClose={() => setShowAdminCreate(false)} />}
      {youreInData && (
        <YoureInModal
          tournament={youreInData.tournament}
          result={youreInData.result}
          onClose={() => setYoureInData(null)}
        />
      )}
      {confirmTournament && (
        <TournamentEntryConfirmModal
          tournament={confirmTournament}
          onClose={() => setConfirmTournament(null)}
          onConfirm={handleConfirmedJoin}
        />
      )}
    </div>
  );
}
