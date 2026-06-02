import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import type { MatchWithPlayers, GameType, FavoriteGame, LeaderboardEntry, ShopItem } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";
import CreateMatchDialog from "@/components/CreateMatchDialog";
import JoinMatchConfirmDialog from "@/components/JoinMatchConfirmDialog";
import { Link, useLocation } from "wouter";
import { gameIcons } from "@/components/GameIcons";
import { AppNavbar } from "@/components/AppNavbar";
import { ScalpsIcon } from "@/components/ScalpsIcon";
import { soundManager } from "@/lib/soundManager";
import { useDeviceType } from "@/hooks/useDeviceType";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Plus, Users, Star, Gamepad2, Search, X, Trophy, Zap, Flame,
  Play, ChevronRight, Sword, Crown, BarChart3, Hash, Lock,
  Activity, Swords, ShoppingBag, ArrowLeft, ChevronDown, ChevronUp,
  Wifi, Bot, TrendingUp, TrendingDown, Minus, Clock, AlertCircle,
  DollarSign, Target, Sparkles, Timer, Smartphone, Monitor,
  BookOpen, ArrowRight,
} from "lucide-react";
import { JoinPrivateMatchModal } from "@/components/JoinPrivateMatchModal";
import { PrivateMatchModal } from "@/components/PrivateMatchModal";
import { RankBadge, GoatBadge } from "@/components/RankBadge";
import { getRankConfig, getRatingProgress, getPointsToNextTier, RANK_TIERS, GOAT_CONFIG } from "@shared/rankUtils";
import { DailyChallenges, CHALLENGES } from "@/components/DailyChallenges";
import { StreakModule } from "@/components/StreakModule";
import { SessionPnLWidget } from "@/components/SessionPnLWidget";
import { RecentWinsTicker } from "@/components/RecentWinsTicker";
import { GameSceneBackground } from "@/components/GameSceneBackground";
import { PageDepthBackground } from "@/components/PageDepthBackground";
import { Magnetic3D } from "@/components/Magnetic3D";

// ─── Game catalog ─────────────────────────────────────────────────────────────
const GAME_CATALOG: Array<{
  id: GameType; name: string; category: string; difficulty: "Easy" | "Medium" | "Hard";
  desc: string; players: string; avgWager: number; accentColor: string;
}> = [
  { id: "chess",               name: "Chess",            category: "Strategy", difficulty: "Hard",   desc: "Classic strategy, 6 min clock",         players: "2", avgWager: 8,  accentColor: "#6366f1" },
  { id: "mini-golf",           name: "Mini Golf",        category: "Arcade",   difficulty: "Medium", desc: "9-hole course, lowest score wins",       players: "2", avgWager: 5,  accentColor: "#22c55e" },
  { id: "connect-4",           name: "Connect 4",        category: "Strategy", difficulty: "Easy",   desc: "First to four in a row wins",           players: "2", avgWager: 3,  accentColor: "#3b82f6" },
  { id: "air-hockey",          name: "Air Hockey",       category: "Arcade",   difficulty: "Medium", desc: "Real-time physics, first to 7 wins",    players: "2", avgWager: 4,  accentColor: "#06b6d4" },
  { id: "rock-paper-scissors", name: "RPS",              category: "Quick",    difficulty: "Easy",   desc: "Best-of-5 rounds, instant play",        players: "2", avgWager: 2,  accentColor: "#f43f5e" },
  { id: "dots-and-boxes",      name: "Dots & Boxes",     category: "Strategy", difficulty: "Medium", desc: "Claim the most boxes to win",           players: "2", avgWager: 3,  accentColor: "#8b5cf6" },
  { id: "8-ball",              name: "8-Ball Pool",      category: "Arcade",   difficulty: "Hard",   desc: "Classic billiards with physics",        players: "2", avgWager: 10, accentColor: "#f59e0b" },
  { id: "bowling",             name: "Bowling",          category: "Arcade",   difficulty: "Medium", desc: "10 frames, physics-based pins",         players: "2", avgWager: 5,  accentColor: "#FF7A00" },
  { id: "cup-king",            name: "Cup King",         category: "Arcade",   difficulty: "Easy",   desc: "Ball-in-cup dexterity challenge",       players: "2", avgWager: 4,  accentColor: "#10b981" },
  { id: "stack-tower",         name: "Stack Tower",      category: "Quick",    difficulty: "Easy",   desc: "Stack blocks, highest tower wins",      players: "2", avgWager: 2,  accentColor: "#ec4899" },
  { id: "block-blast",         name: "Block Blast",      category: "Quick",    difficulty: "Medium", desc: "Tetris-style, beat your opponent",      players: "2", avgWager: 3,  accentColor: "#FF2D8A" },
  { id: "tron",                name: "Tron",             category: "Arcade",   difficulty: "Hard",   desc: "Neon light-cycle survival on The Grid", players: "1", avgWager: 0,  accentColor: "#22d3ee" },
  { id: "basketball",          name: "Basketball",       category: "Sports",   difficulty: "Medium", desc: "5-shot showdown — highest score wins",  players: "2", avgWager: 5,  accentColor: "#f97316" },
  { id: "football",            name: "Football",         category: "Sports",   difficulty: "Hard",   desc: "Retro QB — score more TDs per drive",   players: "2", avgWager: 8,  accentColor: "#84cc16" },
  { id: "racing",              name: "Racing",           category: "Sports",   difficulty: "Medium", desc: "Top-down time trial — best lap wins",   players: "2", avgWager: 6,  accentColor: "#f43f5e" },
];

const DIFF_COLOR: Record<string, string> = { Easy: "text-green-400", Medium: "text-amber-400", Hard: "text-red-400" };
const WAGER_PRESETS = [2, 5, 10, 25, 50, 100];
type AnyUser = Record<string, any>;
type PlayMode = "casual" | "ranked" | "tournament" | "private" | "bot";

const RATED_GAMES: GameType[] = [
  "chess", "mini-golf", "connect-4", "air-hockey", "rock-paper-scissors",
  "dots-and-boxes", "8-ball", "bowling", "cup-king", "stack-tower", "block-blast",
  "basketball", "football", "racing",
];

const GAME_RATING_KEY: Record<GameType, string> = {
  chess: "chessRating", "mini-golf": "miniGolfRating", "connect-4": "connect4Rating",
  "air-hockey": "airHockeyRating", "rock-paper-scissors": "rockPaperScissorsRating",
  "dots-and-boxes": "dotsAndBoxesRating", "8-ball": "eightBallRating",
  bowling: "bowlingRating", "cup-king": "cupKingRating",
  "stack-tower": "stackTowerRating", "block-blast": "blockBlastRating",
  tron: "tronRating",
  basketball: "basketballRating", football: "footballRating", racing: "racingRating",
};

const GAME_FULL_NAME: Record<GameType, string> = {
  chess: "Chess", "mini-golf": "Mini Golf", "connect-4": "Connect 4",
  "air-hockey": "Air Hockey", "rock-paper-scissors": "Rock Paper Scissors",
  "dots-and-boxes": "Dots & Boxes", "8-ball": "8-Ball Pool",
  bowling: "Bowling", "cup-king": "Cup King",
  "stack-tower": "Stack Tower", "block-blast": "Block Blast",
  tron: "Tron",
  basketball: "Basketball", football: "Football", racing: "Racing",
};

// Featured game showcase (subset with best visual impact)
const FEATURED_GAME_IDS: GameType[] = ["chess", "8-ball", "air-hockey", "tron", "mini-golf", "block-blast"];

// ─── Animated counter ─────────────────────────────────────────────────────────
function AnimatedCounter({ value, className }: { value: string; className?: string }) {
  const [display, setDisplay] = useState("0");
  const rafRef = useRef<number>();
  const numericValue = parseFloat(value.replace(/,/g, "")) || 0;
  useEffect(() => {
    const end = numericValue;
    const duration = 900;
    const startTime = performance.now();
    const isFloat = value.includes(".");
    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = end * eased;
      setDisplay(isFloat ? current.toFixed(2) : Math.round(current).toLocaleString());
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [numericValue]);
  return <span className={className}>{display}</span>;
}

function displayName(player: any): string {
  return player?.username ?? player?.firstName ?? player?.email?.split("@")[0] ?? "Player";
}

const PLAY_MODES: Array<{
  id: PlayMode; label: string; desc: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; glow: string;
}> = [
  { id: "casual",     label: "Casual",       desc: "Quick play, no rating at stake",               icon: Play,   color: "#22C55E", glow: "rgba(34,197,94,0.4)" },
  { id: "ranked",     label: "Ranked",       desc: "ELO ladder, win to climb the tiers",           icon: Sword,  color: "#FF7A00", glow: "rgba(255,122,0,0.4)" },
  { id: "bot",        label: "vs Bot",       desc: "Practice solo against an AI opponent",         icon: Bot,    color: "#06B6D4", glow: "rgba(6,182,212,0.4)" },
  { id: "tournament", label: "Tournament",   desc: "Bracket competition with prize pools",          icon: Trophy, color: "#F59E0B", glow: "rgba(245,158,11,0.4)" },
  { id: "private",    label: "Private",      desc: "Play with friends using an invite code",        icon: Lock,   color: "#A78BFA", glow: "rgba(167,139,250,0.4)" },
];

// ─── Multi-Step Play Modal ─────────────────────────────────────────────────────
interface PlayModalProps {
  open: boolean; onClose: () => void; balance: number; favSet: Set<GameType>;
  onLaunchMatch: (game: GameType, wager: number, mode: PlayMode) => void;
  onLaunchBotMatch: (game: GameType, difficulty: "easy" | "medium" | "hard") => void;
  onCreatePrivate: () => void; onJoinPrivate: () => void;
  initialMode?: PlayMode | null;
  initialGame?: GameType | null;
  initialDifficulty?: "easy" | "medium" | "hard";
}

function PlayModal({ open, onClose, balance, favSet, onLaunchMatch, onLaunchBotMatch, onCreatePrivate, onJoinPrivate, initialMode, initialGame, initialDifficulty }: PlayModalProps) {
  const initStep = initialGame ? 2 : initialMode ? 1 : 0;
  const [step, setStep] = useState(initStep);
  const [mode, setMode] = useState<PlayMode | null>(initialMode ?? null);
  const [game, setGame] = useState<GameType | null>(initialGame ?? null);
  const [wager, setWager] = useState(5);
  const [gameSearch, setGameSearch] = useState("");
  const [gameFilter, setGameFilter] = useState("All");
  const [botDifficulty, setBotDifficulty] = useState<"easy" | "medium" | "hard">(initialDifficulty ?? "medium");
  // Tournament sub-flow that lives INSIDE the same modal (overrides step rendering when set).
  const [tournamentView, setTournamentView] = useState<"list" | "confirm" | "success" | null>(null);
  const [selectedTournament, setSelectedTournament] = useState<any | null>(null);
  const [joinedSnapshot, setJoinedSnapshot] = useState<{ prizePool?: string; currentPlayers?: number; newBalance?: string; alreadyRegistered?: boolean } | null>(null);
  const [, navigate] = useLocation();
  const { toast: playToast } = useToast();

  // Re-sync modal state whenever it opens with new URL-seeded values
  useEffect(() => {
    if (open) {
      setStep(initialGame ? 2 : initialMode ? 1 : 0);
      setMode(initialMode ?? null);
      setGame(initialGame ?? null);
      setBotDifficulty(initialDifficulty ?? "medium");
      setGameSearch("");
      setGameFilter("All");
      setTournamentView(null);
      setSelectedTournament(null);
      setJoinedSnapshot(null);
    }
  }, [open, initialMode, initialGame, initialDifficulty]);

  function reset() { setStep(initStep); setMode(initialMode ?? null); setGame(initialGame ?? null); setWager(5); setGameSearch(""); setGameFilter("All"); setBotDifficulty(initialDifficulty ?? "medium"); setTournamentView(null); setSelectedTournament(null); setJoinedSnapshot(null); }
  function handleClose() { reset(); onClose(); }

  function pickMode(m: PlayMode) {
    setMode(m);
    if (m === "tournament") { setTournamentView("list"); return; }
    if (m === "private") { handleClose(); return; }
    setStep(1);
  }

  function handleHeaderBack() {
    if (tournamentView === "success") { setTournamentView("list"); setSelectedTournament(null); return; }
    if (tournamentView === "confirm") { setTournamentView("list"); return; }
    if (tournamentView === "list")    { setTournamentView(null); setMode(null); return; }
    setStep(s => s - 1);
  }

  // Tournament join mutation
  const joinTournamentMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/tournaments/${id}/join`);
      return await res.json();
    },
    onSuccess: (data) => {
      setJoinedSnapshot({
        prizePool: data?.prizePool,
        currentPlayers: Number(data?.currentPlayers ?? 0),
        newBalance: data?.newBalance,
        alreadyRegistered: !!data?.alreadyRegistered,
      });
      setTournamentView("success");
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments?status=open&limit=3"] });
      soundManager.playSuccess?.();
    },
    onError: (err: any) => {
      if (isUnauthorizedError(err)) {
        playToast({ title: "Please sign in", description: "You need to be signed in to join a tournament.", variant: "destructive" });
        return;
      }
      playToast({ title: "Couldn't join tournament", description: err?.message ?? "Please try again.", variant: "destructive" });
    },
  });

  function pickGame(g: GameType) {
    setGame(g); setStep(2);
  }

  function handleStart() {
    if (!game || !mode) return;
    if (mode === "bot") {
      onLaunchBotMatch(game, botDifficulty);
    } else {
      onLaunchMatch(game, wager, mode);
    }
    handleClose();
  }

  const filteredGames = useMemo(() => {
    let list = GAME_CATALOG;
    if (gameSearch) list = list.filter(g => g.name.toLowerCase().includes(gameSearch.toLowerCase()));
    if (gameFilter === "Favorites") list = list.filter(g => favSet.has(g.id));
    else if (gameFilter !== "All") list = list.filter(g => g.category === gameFilter);
    return list;
  }, [gameSearch, gameFilter, favSet, mode]);

  const selectedModeConfig = PLAY_MODES.find(m => m.id === mode);
  const selectedGameData = game ? GAME_CATALOG.find(g => g.id === game) : null;
  const GameIcon = game ? gameIcons[game as keyof typeof gameIcons] : null;
  const stepLabels = ["Mode", "Game", "Options"];

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[92vh] sm:max-h-[85vh] p-0 overflow-hidden border-0 modal-entrance [&>button]:hidden" style={{
        background: "linear-gradient(160deg, #0e1428 0%, #080c18 100%)",
        boxShadow: "0 0 80px -20px rgba(255,45,138,0.25), 0 25px 60px rgba(0,0,0,0.7)",
      }}>
        {/* ── Header ── single row at every width (incl. iPhone SE 320px) ── */}
        <div className="flex items-center gap-1.5 sm:gap-3 px-3 sm:px-6 pt-3.5 sm:pt-5 pb-3 sm:pb-4 border-b border-white/6 min-w-0">
          {(step > 0 || tournamentView) && (
            <button onClick={handleHeaderBack} className="shrink-0 text-muted-foreground hover-elevate p-1.5 rounded-lg" data-testid="button-play-back" aria-label="Go back">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <p className="flex-1 min-w-0 truncate text-[10px] sm:text-[11px] text-muted-foreground/70 uppercase tracking-widest font-medium">
            {tournamentView === "list"    ? "Live Tournaments" :
             tournamentView === "confirm" ? "Confirm Entry" :
             tournamentView === "success" ? "Registered" :
             step === 0 ? "How do you want to play?" :
             step === 1 ? "Pick your game" :
             `${selectedGameData?.name} · ${selectedModeConfig?.label}`}
          </p>
          {/* Step progress (hidden during tournament sub-flow). Icon-only dots on mobile, full chips on desktop. */}
          {!tournamentView && (
            <div className="shrink-0 flex items-center gap-1 sm:gap-3">
              {stepLabels.map((label, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-black transition-all duration-300 ${
                    i < step ? "bg-primary/80 text-white" : i === step ? "bg-primary text-white" : "bg-white/8 text-muted-foreground"
                  }`}>{i < step ? "✓" : i + 1}</div>
                  <span className={`text-[11px] font-medium hidden sm:block transition-colors ${i === step ? "text-foreground" : "text-muted-foreground/50"}`}>{label}</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={handleClose} className="shrink-0 text-muted-foreground hover-elevate p-1.5 rounded-lg" data-testid="button-play-close" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div
          className="px-4 sm:px-6 py-5 sm:py-6 min-h-[280px] sm:min-h-[340px] max-h-[calc(92vh-7.5rem)] sm:max-h-[72vh] overflow-y-auto"
          style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <AnimatePresence mode="wait">

            {/* Step 0 — Mode */}
            {!tournamentView && step === 0 && (
              <motion.div key="mode" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
                <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-2.5 sm:gap-3 mb-4">
                  {PLAY_MODES.map(m => {
                    const MIcon = m.icon;
                    return (
                      <button key={m.id} onClick={() => pickMode(m.id)} data-testid={`button-mode-${m.id}`}
                        className="relative flex flex-row min-[480px]:flex-col items-center min-[480px]:items-start gap-3 p-3.5 sm:p-5 min-h-[64px] min-[480px]:min-h-[140px] rounded-2xl border border-white/8 text-left group overflow-hidden hover-elevate transition-all duration-200"
                        style={{ background: `${m.color}08` }}
                      >
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                          style={{ background: `radial-gradient(ellipse 60% 60% at 20% 20%, ${m.glow.replace("0.4", "0.12")}, transparent 70%)` }} />
                        <div className="relative shrink-0 w-11 h-11 min-[480px]:w-12 min-[480px]:h-12 rounded-xl flex items-center justify-center"
                          style={{ background: `${m.color}18`, border: `1px solid ${m.color}35` }}>
                          <MIcon className="w-5 h-5 min-[480px]:w-6 min-[480px]:h-6" style={{ color: m.color } as React.CSSProperties} />
                        </div>
                        <div className="relative flex-1 min-w-0 pr-6 min-[480px]:pr-0">
                          <p className="font-black text-sm mb-0.5" style={{ color: m.color }}>{m.label}</p>
                          <p className="text-[12px] text-muted-foreground leading-snug line-clamp-2">{m.desc}</p>
                        </div>
                        <ChevronRight className="absolute top-1/2 -translate-y-1/2 min-[480px]:top-4 min-[480px]:translate-y-0 right-3 sm:right-4 w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground/70 transition-colors" />
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="flex-1 min-w-[140px] gap-2 border-white/8 text-xs"
                    onClick={() => { handleClose(); onCreatePrivate(); }} data-testid="button-create-private-quick">
                    <Plus className="w-3.5 h-3.5" />Create Private Room
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 min-w-[140px] gap-2 border-white/8 text-xs"
                    onClick={() => { handleClose(); onJoinPrivate(); }} data-testid="button-join-private-quick">
                    <Hash className="w-3.5 h-3.5" />Join with Code
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 1 — Game */}
            {!tournamentView && step === 1 && (
              <motion.div key="game" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
                <div className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input placeholder="Search games…" value={gameSearch} onChange={e => setGameSearch(e.target.value)}
                      className="pl-9 bg-white/4 border-white/8 h-9" data-testid="input-game-search" />
                    {gameSearch && <button onClick={() => setGameSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2" aria-label="Clear search" data-testid="button-clear-game-search"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>}
                  </div>
                  <div className="flex gap-1 overflow-x-auto">
                    {["All", "Strategy", "Arcade", "Quick", "Favorites"].map(f => (
                      <button key={f} onClick={() => setGameFilter(f)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border shrink-0 transition-colors ${
                          gameFilter === f ? "bg-primary/15 text-primary border-primary/30" : "border-white/8 text-muted-foreground hover-elevate"
                        }`}>{f}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {filteredGames.map(g => {
                    const GIcon = gameIcons[g.id as keyof typeof gameIcons];
                    return (
                      <button key={g.id} onClick={() => pickGame(g.id)} data-testid={`button-pick-game-${g.id}`}
                        className="flex items-center gap-3 p-3.5 rounded-xl border border-white/6 hover-elevate text-left group transition-all"
                        style={{ background: `${g.accentColor}06` }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: `${g.accentColor}15`, border: `1px solid ${g.accentColor}30` }}>
                          {GIcon ? <GIcon className="w-5 h-5" style={{ color: g.accentColor } as React.CSSProperties} />
                            : <Gamepad2 className="w-5 h-5 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-xs truncate">{g.name}</p>
                          <span className={`text-[10px] font-medium ${DIFF_COLOR[g.difficulty]}`}>{g.difficulty}</span>
                        </div>
                      </button>
                    );
                  })}
                  {filteredGames.length === 0 && (
                    <div className="col-span-full text-center py-10 text-muted-foreground">
                      <Gamepad2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No games found</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 2 — Options */}
            {!tournamentView && step === 2 && game && (
              <motion.div key="options" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
                {/* Game summary */}
                <div className="flex items-center gap-4 p-4 rounded-2xl mb-6"
                  style={{ background: `${selectedGameData?.accentColor}10`, border: `1px solid ${selectedGameData?.accentColor}25` }}>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: `${selectedGameData?.accentColor}18`, border: `1px solid ${selectedGameData?.accentColor}35` }}>
                    {GameIcon ? <GameIcon className="w-8 h-8" style={{ color: selectedGameData?.accentColor } as React.CSSProperties} />
                      : <Gamepad2 className="w-8 h-8 text-primary/60" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-lg">{selectedGameData?.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedGameData?.desc}</p>
                  </div>
                  <button onClick={() => setStep(1)} className="text-xs text-muted-foreground hover-elevate px-3 py-1.5 rounded-lg border border-white/8">Change</button>
                </div>

                {mode === "bot" ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl" style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Bot className="w-4 h-4 text-cyan-400" />
                        <span className="font-bold text-sm text-cyan-300">vs Bot Mode</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Practice against an AI opponent. No rating, wager, or leaderboard changes — just pure gameplay.</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-3 font-semibold uppercase tracking-widest">Bot Difficulty</p>
                      <div className="grid grid-cols-3 gap-3">
                        {([["easy", "#22C55E", "Random moves, beginner-friendly"], ["medium", "#F59E0B", "Strategic play, pattern-aware"], ["hard", "#EF4444", "Advanced AI, plays to win"]] as const).map(([diff, color, desc]) => (
                          <button key={diff} onClick={() => setBotDifficulty(diff)} data-testid={`button-bot-difficulty-${diff}`}
                            className={`flex flex-col gap-2 p-4 rounded-2xl border text-left transition-all ${
                              botDifficulty === diff ? "scale-105" : "border-white/8 hover-elevate"
                            }`}
                            style={botDifficulty === diff ? { background: `${color}15`, border: `1px solid ${color}40` } : { background: "rgba(255,255,255,0.02)" }}>
                            <Bot className="w-5 h-5" style={{ color: botDifficulty === diff ? color : "rgba(255,255,255,0.3)" }} />
                            <div>
                              <p className="font-black text-xs capitalize" style={{ color: botDifficulty === diff ? color : "rgba(255,255,255,0.7)" }}>{diff}</p>
                              <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{desc}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button className="w-full gap-2 font-black text-base h-12"
                      style={{ background: "linear-gradient(135deg, #06B6D4, #0284C7)", boxShadow: "0 0 30px -6px rgba(6,182,212,0.4)", color: "#fff" }}
                      onClick={handleStart} data-testid="button-start-bot">
                      <Bot className="w-5 h-5" />Play vs {botDifficulty.charAt(0).toUpperCase() + botDifficulty.slice(1)} Bot
                    </Button>
                  </div>
                ) : mode === "ranked" ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl" style={{ background: "rgba(255,122,0,0.08)", border: "1px solid rgba(255,122,0,0.2)" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Sword className="w-4 h-4 text-orange-400" />
                        <span className="font-bold text-sm text-orange-300">Ranked Match</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Your ELO rating changes based on this match result. Wins push you up the ladder — losses drop you down.</p>
                    </div>
                    <Button className="w-full gap-2 font-black text-base h-12"
                      style={{ background: "#FF7A00", color: "#0a0e1a", boxShadow: "0 0 30px -6px rgba(255,122,0,0.4)" }}
                      onClick={handleStart} data-testid="button-start-ranked">
                      <Sword className="w-5 h-5" />Queue for Ranked — {GAME_FULL_NAME[game]}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {selectedGameData && selectedGameData.players !== "1" && (
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-3 font-semibold uppercase tracking-widest">Wager Amount</p>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {WAGER_PRESETS.map(w => (
                            <button key={w} onClick={() => setWager(w)} data-testid={`wager-preset-${w}`}
                              className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-black transition-all ${
                                wager === w ? "border-primary bg-primary/15 text-primary scale-105" : "border-white/8 bg-white/2 text-muted-foreground hover-elevate"
                              }`}>
                              <ScalpsIcon size="xs" />
                              {w}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center justify-between mt-2.5 text-xs text-muted-foreground">
                          <span>Balance: <span className="font-bold text-foreground">{balance.toFixed(2)} S</span></span>
                          {wager > balance && <span className="text-red-400 font-semibold">Insufficient balance</span>}
                        </div>
                      </div>
                    )}
                    <Button className="w-full gap-2 font-black text-base h-12"
                      style={{ background: "linear-gradient(135deg, #FF2D8A, #FF7A00)", boxShadow: "0 0 30px -6px rgba(255,45,138,0.4)", color: "#fff" }}
                      onClick={handleStart} disabled={selectedGameData?.players !== "1" && wager > balance}
                      data-testid="button-start-match">
                      <Play className="w-5 h-5" />
                      {selectedGameData?.players === "1" ? "Start Game" : `Start Match · ${wager} Scalps`}
                    </Button>
                  </div>
                )}
              </motion.div>
            )}

            {/* Tournament sub-flow — Live list */}
            {tournamentView === "list" && (
              <motion.div key="tournament-list" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.35)" }}>
                    <Trophy className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="font-black text-base text-amber-300">Live Tournaments</p>
                    <p className="text-[11px] text-muted-foreground">Choose an open event and compete for the prize pool.</p>
                  </div>
                </div>
                <LiveTournamentSelection
                  onEnter={(t) => { setSelectedTournament(t); setTournamentView("confirm"); }}
                  onPlayCasual={() => { setTournamentView(null); setMode(null); setStep(0); }}
                  onViewAll={() => { handleClose(); navigate("/tournaments"); }}
                />
              </motion.div>
            )}

            {/* Tournament sub-flow — Confirm entry */}
            {tournamentView === "confirm" && selectedTournament && (
              <motion.div key="tournament-confirm" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
                {(() => {
                  const t = selectedTournament;
                  const entry = parseFloat(t.entry_fee ?? "0");
                  const prize = parseFloat(t.prize_pool ?? "0");
                  const current = Number(t.joined_count ?? t.current_players ?? 0);
                  const max = Number(t.max_players ?? 16);
                  const balanceAfter = Math.max(0, balance - entry);
                  const prizeAfter = prize + entry;
                  const insufficient = entry > balance;
                  const full = current >= max;
                  return (
                    <>
                      <div className="p-4 rounded-2xl mb-5 flex items-center gap-4" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(245,158,11,0.18)", border: "1px solid rgba(245,158,11,0.35)" }}>
                          <Trophy className="w-7 h-7 text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-base truncate">{t.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{String(t.game_type ?? "").replace(/-/g, " ")} · {max} player bracket</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 mb-5">
                        <ConfirmRow label="Entry fee"        value={entry > 0 ? `${entry.toFixed(0)} S` : "Free"} accent={entry > 0 ? "#f59e0b" : "#22c55e"} />
                        <ConfirmRow label="Your balance"     value={`${balance.toFixed(0)} S`} />
                        <ConfirmRow label="Balance after"    value={`${balanceAfter.toFixed(0)} S`} accent={insufficient ? "#ef4444" : undefined} />
                        <ConfirmRow label="Prize pool now"   value={`${prize.toFixed(0)} S`} />
                        <ConfirmRow label="Prize pool after" value={`${prizeAfter.toFixed(0)} S`} accent="#f59e0b" />
                        <ConfirmRow label="Players"          value={`${current} / ${max}`} accent={full ? "#ef4444" : undefined} />
                        <ConfirmRow label="Bracket size"     value={`${t.bracket_size ?? max}`} />
                        <ConfirmRow label="Starts"           value={t.starts_at ? new Date(t.starts_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "TBD"} />
                      </div>

                      {insufficient && <p className="text-xs text-red-400 mb-3 text-center">Not enough Scalps to enter this tournament.</p>}
                      {full && <p className="text-xs text-red-400 mb-3 text-center">This tournament is full.</p>}

                      <Button
                        className="w-full h-12 font-black gap-2"
                        style={{ background: "linear-gradient(135deg, #F59E0B, #FF7A00)", color: "#fff", boxShadow: "0 0 30px -6px rgba(245,158,11,0.5)" }}
                        disabled={insufficient || full || joinTournamentMutation.isPending}
                        onClick={() => joinTournamentMutation.mutate(t.id)}
                        data-testid="button-confirm-tournament-entry"
                      >
                        <Trophy className="w-4 h-4" />
                        {joinTournamentMutation.isPending ? "Joining…" : "Confirm & Enter"}
                      </Button>
                    </>
                  );
                })()}
              </motion.div>
            )}

            {/* Tournament sub-flow — Success */}
            {tournamentView === "success" && selectedTournament && (
              <motion.div key="tournament-success" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }} className="text-center py-6">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-5"
                  style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.25), rgba(255,122,0,0.18))", border: "2px solid rgba(245,158,11,0.5)", boxShadow: "0 0 40px -8px rgba(245,158,11,0.6)" }}
                >
                  <Trophy className="w-10 h-10 text-amber-300" />
                </motion.div>
                <p className="text-2xl font-black text-amber-300 mb-1" data-testid="text-tournament-joined">
                  {joinedSnapshot?.alreadyRegistered ? "Resume Tournament" : "You're In"}
                </p>
                <p className="text-sm text-muted-foreground mb-1">{selectedTournament.name}</p>
                {joinedSnapshot?.alreadyRegistered && (
                  <p className="text-xs text-emerald-300/80 mb-1">You're already registered — jump back in.</p>
                )}
                {joinedSnapshot && (
                  <p className="text-xs text-muted-foreground mb-6">
                    Prize pool: <span className="text-amber-400 font-bold">{parseFloat(String(joinedSnapshot.prizePool ?? "0")).toFixed(0)} S</span>
                    {" · "}{joinedSnapshot.currentPlayers ?? 0} players registered
                  </p>
                )}
                <div className="flex flex-col sm:flex-row gap-2 max-w-sm mx-auto">
                  <Button className="flex-1 gap-2" onClick={() => { const id = selectedTournament?.id; handleClose(); navigate(id ? `/tournaments?focus=${id}` : "/tournaments"); }} data-testid="button-view-bracket">
                    <Trophy className="w-4 h-4" /> {joinedSnapshot?.alreadyRegistered ? "Continue to Tournament" : "View Bracket"}
                  </Button>
                  <Button variant="outline" className="flex-1 border-white/10" onClick={() => { setTournamentView("list"); setSelectedTournament(null); }} data-testid="button-back-to-tournaments">
                    Back to Tournaments
                  </Button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── In-modal tournament list + confirmation helpers ─────────────────────────
function ConfirmRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="p-3 rounded-xl border border-white/8" style={{ background: "rgba(255,255,255,0.03)" }}>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-0.5">{label}</p>
      <p className="text-sm font-black" style={accent ? { color: accent } : undefined} data-testid={`confirm-row-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value}</p>
    </div>
  );
}

function LiveTournamentSelection({ onEnter, onPlayCasual, onViewAll }: { onEnter: (t: any) => void; onPlayCasual: () => void; onViewAll: () => void }) {
  const { data: list = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/tournaments"],
    staleTime: 30_000,
  });
  // Only show truly enterable tournaments — backend rejects anything that isn't "open".
  const visible = useMemo(() => list.filter((t: any) => String(t.status ?? "").toLowerCase() === "open"), [list]);

  if (isLoading) {
    return (
      <div className="space-y-2.5">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-24 rounded-xl border border-white/6 animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />
        ))}
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-10 gap-3" data-testid="tournament-list-empty">
        <Trophy className="w-12 h-12 text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground">No tournaments open right now</p>
        <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs pt-1">
          <Button size="sm" className="flex-1 gap-2" onClick={onPlayCasual} data-testid="button-empty-play-casual"><Play className="w-3.5 h-3.5" />Play Casual</Button>
          <Button size="sm" variant="outline" className="flex-1 gap-2 border-white/10" onClick={onViewAll} data-testid="button-empty-view-tournaments"><Trophy className="w-3.5 h-3.5" />View Tournament Page</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5" data-testid="tournament-list">
      {visible.map((t: any) => {
        const entry = parseFloat(t.entry_fee ?? "0");
        const prize = parseFloat(t.prize_pool ?? "0");
        const current = Number(t.joined_count ?? t.current_players ?? 0);
        const max = Number(t.max_players ?? 16);
        const pct = Math.min((current / max) * 100, 100);
        const isPremium = prize >= 50;
        const full = current >= max;
        const statusLabel = String(t.status ?? "open").replace(/_/g, " ");

        return (
          <div key={t.id}
            className="rounded-xl overflow-hidden border"
            style={{
              borderColor: isPremium ? "rgba(245,158,11,0.35)" : "rgba(255,255,255,0.08)",
              background: isPremium
                ? "linear-gradient(135deg, rgba(245,158,11,0.10) 0%, rgba(17,24,39,0.85) 60%)"
                : "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(17,24,39,0.85) 60%)",
            }}
            data-testid={`tournament-row-${t.id}`}
          >
            <div className="p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: isPremium ? "rgba(245,158,11,0.18)" : "rgba(99,102,241,0.15)", border: isPremium ? "1px solid rgba(245,158,11,0.35)" : "1px solid rgba(99,102,241,0.25)" }}>
                <Trophy className="w-5 h-5" style={{ color: isPremium ? "#f59e0b" : "#818cf8" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm truncate" data-testid={`tournament-row-name-${t.id}`}>{t.name}</p>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                    style={{ background: isPremium ? "rgba(245,158,11,0.18)" : "rgba(99,102,241,0.18)", color: isPremium ? "#fbbf24" : "#a5b4fc", border: isPremium ? "1px solid rgba(245,158,11,0.35)" : "1px solid rgba(99,102,241,0.3)" }}>
                    {statusLabel}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                  <span className="capitalize">{String(t.game_type ?? "").replace(/-/g, " ")}</span>
                  <span>•</span>
                  <span><span className="text-amber-400 font-bold">{prize.toFixed(0)} S</span> pool</span>
                  <span>•</span>
                  <span>{entry > 0 ? `${entry.toFixed(0)} S entry` : "Free entry"}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full" style={{ width: `${pct}%`, background: isPremium ? "linear-gradient(90deg, #f59e0b, #ff7a00)" : "linear-gradient(90deg, #6366f1, #818cf8)" }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{current}/{max}</span>
                  {t.starts_at && <TournamentCountdown startsAt={t.starts_at} />}
                </div>
              </div>
              <Button
                size="sm"
                className="shrink-0 gap-1 font-black"
                style={{ background: isPremium ? "linear-gradient(135deg, #F59E0B, #FF7A00)" : "linear-gradient(135deg, #6366f1, #818cf8)", color: "#fff" }}
                disabled={full}
                onClick={() => onEnter(t)}
                data-testid={`button-enter-tournament-${t.id}`}
              >
                {full ? "Full" : "Enter"}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Lobby Hero ───────────────────────────────────────────────────────────────
interface LobbyHeroProps {
  user: AnyUser | null;
  balance: number;
  onlineCount: number;
  liveCount: number;
  onPlay: () => void;
  onQueue: (game: GameType) => void;
  onCreatePrivate: () => void;
  onJoinPrivate: () => void;
}

function LobbyHero({ user, balance, onlineCount, liveCount, onPlay, onCreatePrivate, onJoinPrivate }: LobbyHeroProps) {
  const { phoneMode } = useTheme();
  const [featuredIdx, setFeaturedIdx] = useState(0);
  const [prevIdx, setPrevIdx] = useState<number | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [playHover, setPlayHover] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
  };

  const featuredIds = FEATURED_GAME_IDS;
  const featured = GAME_CATALOG.find(g => g.id === featuredIds[featuredIdx])!;

  useEffect(() => {
    const timer = setInterval(() => {
      setTransitioning(true);
      setTimeout(() => {
        setPrevIdx(featuredIdx);
        setFeaturedIdx(i => (i + 1) % featuredIds.length);
        setTransitioning(false);
      }, 400);
    }, 5000);
    return () => clearInterval(timer);
  }, [featuredIdx]);

  const FeaturedIcon = gameIcons[featured.id as keyof typeof gameIcons];
  const rankConfig = user ? getRankConfig(user.chessRating ?? 1200) : null;
  const name = user ? (user.username ?? user.firstName ?? "Player") : null;

  return (
    <div
      className="relative flex flex-col overflow-hidden"
      style={{ minHeight: phoneMode ? "auto" : "calc(100vh - 64px)" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setMousePos({ x: 0.5, y: 0.5 })}
    >
      {/* ── Game scene background ── */}
      <div className="absolute inset-0 pointer-events-none">
        <GameSceneBackground
          gameId={featured.id}
          accentColor={featured.accentColor}
          playHover={playHover}
          mouseX={mousePos.x}
          mouseY={mousePos.y}
        />
        {/* UI depth separator — vignette over scene */}
        <div className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse 100% 80% at 50% 50%, transparent 30%, rgba(4,2,12,0.55) 100%)" }} />
        {/* Bottom gradient to ground UI */}
        <div className="absolute bottom-0 left-0 right-0 h-40"
          style={{ background: "linear-gradient(to top, rgba(4,2,12,0.85), transparent)" }} />
      </div>

      {/* ── Top overlay chips ── */}
      <div className="relative z-10 flex items-start justify-between px-4 md:px-8 pt-5 gap-3 flex-wrap">
        {/* Player chip */}
        {user ? (
          <Link href={`/profile/${user.id}`}>
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-white/8 bg-black/40 backdrop-blur-md cursor-pointer hover-elevate">
              <Avatar className="w-7 h-7 shrink-0">
                <AvatarImage src={user.profileImageUrl ?? undefined} />
                <AvatarFallback className="text-[11px] font-black">{name?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="leading-tight">
                <p className="text-xs font-bold leading-none truncate max-w-[100px]">{name}</p>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Lv {user.level ?? 1}</p>
              </div>
              {rankConfig && (
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: rankConfig.color, boxShadow: `0 0 6px ${rankConfig.glow}` }} />
              )}
            </div>
          </Link>
        ) : (
          <div />
        )}

        {/* Balance + online pill */}
        <div className="flex items-center gap-2">
          {onlineCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/6 bg-black/40 backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[11px] text-muted-foreground font-medium">{onlineCount.toLocaleString()} online</span>
            </div>
          )}
          {user && (
            <Link href="/deposit">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/8 bg-black/40 backdrop-blur-md cursor-pointer hover-elevate" data-testid="lobby-balance">
                <ScalpsIcon size="sm" glow />
                <span className="font-black text-sm tabular-nums"><AnimatedCounter value={balance.toFixed(2)} /></span>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* ── Center content ── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 md:py-12">
        {/* Value prop headline */}
        <motion.div
          className="text-center mb-6"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-[11px] font-bold tracking-[0.35em] text-white/35 uppercase mb-2">
            Skill-Based Competition
          </p>
          <h1 className="text-3xl md:text-5xl font-black leading-tight tracking-tight text-white">
            Play Skill Games.<br />
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(135deg, #FF2D8A, #FF7A00)" }}>
              Win Real Money.
            </span>
          </h1>
          <p className="text-sm text-white/45 mt-2">Instant payouts · Real competition · 3% rake</p>
        </motion.div>

        {/* Featured game showcase */}
        <div className="flex flex-col items-center gap-4 mb-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={featured.id}
              initial={{ opacity: 0, scale: 0.85, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="flex flex-col items-center gap-3"
            >
              {/* Game icon with glow rings */}
              <Magnetic3D maxTilt={6} className="relative flex items-center justify-center">
                {/* Outer orbit ring */}
                <div
                  className="glow-ring"
                  style={{
                    width: "180%", height: "180%",
                    border: `1px solid ${featured.accentColor}30`,
                    boxShadow: `0 0 12px ${featured.accentColor}20`,
                  }}
                />
                {/* Inner orbit ring reversed */}
                <div
                  className="glow-ring glow-ring-rev"
                  style={{
                    width: "140%", height: "140%",
                    border: `1px dashed ${featured.accentColor}20`,
                  }}
                />
                <div
                  className="relative w-28 h-28 md:w-36 md:h-36 rounded-3xl flex items-center justify-center magnetic-shimmer"
                  style={{
                    background: `radial-gradient(ellipse at center, ${featured.accentColor}30, ${featured.accentColor}0a 70%)`,
                    border: `1.5px solid ${featured.accentColor}50`,
                    boxShadow: `0 0 60px -12px ${featured.accentColor}90, 0 0 120px -25px ${featured.accentColor}50, inset 0 1px 0 rgba(255,255,255,0.12)`,
                  }}
                >
                  {FeaturedIcon ? (
                    <FeaturedIcon
                      className="w-16 h-16 md:w-20 md:h-20"
                      style={{ color: featured.accentColor, filter: `drop-shadow(0 0 20px ${featured.accentColor}90)` } as React.CSSProperties}
                    />
                  ) : (
                    <Gamepad2 className="w-16 h-16 text-muted-foreground" />
                  )}
                </div>
              </Magnetic3D>

              {/* Game name + difficulty */}
              <div className="text-center">
                <p className="text-2xl md:text-3xl font-black tracking-tight" style={{
                  color: featured.accentColor,
                  textShadow: `0 0 30px ${featured.accentColor}60`,
                }}>{featured.name}</p>
                <p className="text-sm text-muted-foreground mt-1">{featured.desc}</p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Featured game dots */}
          <div className="flex items-center gap-1.5">
            {featuredIds.map((id, i) => (
              <button
                key={id}
                onClick={() => setFeaturedIdx(i)}
                aria-label={`Go to featured game ${i + 1}`}
                aria-current={i === featuredIdx ? "true" : undefined}
                data-testid={`button-featured-dot-${i}`}
                className={`rounded-full transition-all duration-300 ${
                  i === featuredIdx ? "w-5 h-1.5" : "w-1.5 h-1.5 bg-white/20 hover:bg-white/40"
                }`}
                style={i === featuredIdx ? { background: featured.accentColor } : {}}
              />
            ))}
          </div>
        </div>

        {/* ── PLAY BUTTON ── */}
        <div className="flex flex-col items-center gap-5">
          <button
            onClick={() => { soundManager.playClick(); onPlay(); }}
            data-testid="button-play"
            className="relative group"
            onMouseEnter={() => setPlayHover(true)}
            onMouseLeave={() => setPlayHover(false)}
          >
            {/* Outer pulse ring — intensifies on hover */}
            <motion.span
              className="absolute inset-0 rounded-full"
              animate={{ opacity: playHover ? 0.4 : 0.18, scale: playHover ? 1.12 : 1 }}
              transition={{ duration: 0.4 }}
              style={{ background: `radial-gradient(ellipse, ${featured.accentColor}, transparent)`, filter: "blur(4px)" }}
            />
            <span className="absolute inset-0 rounded-full animate-ping opacity-15"
              style={{ background: `radial-gradient(ellipse, ${featured.accentColor}, transparent)`, animationDuration: "2s" }} />
            {/* Button */}
            <motion.span
              className="relative flex items-center gap-3 px-12 py-4 md:px-16 md:py-5 rounded-full font-black text-xl md:text-2xl tracking-wide active:scale-95"
              animate={{ scale: playHover ? 1.06 : 1, boxShadow: playHover
                ? `0 0 80px -4px rgba(255,45,138,0.75), 0 0 40px -8px ${featured.accentColor}70, 0 8px 32px rgba(0,0,0,0.4)`
                : "0 0 50px -8px rgba(255,45,138,0.5), 0 8px 32px rgba(0,0,0,0.4)" }}
              transition={{ duration: 0.3 }}
              style={{
                background: "linear-gradient(135deg, #FF2D8A, #FF7A00)",
                color: "#fff",
              }}
            >
              <Play className="w-6 h-6 md:w-7 md:h-7 fill-white" />
              PLAY
            </motion.span>
          </button>

          {/* Quick mode buttons */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {PLAY_MODES.map(m => {
              const MIcon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    soundManager.playClick();
                    if (m.id === "tournament") { window.location.href = "/tournaments"; return; }
                    if (m.id === "private") { onCreatePrivate(); return; }
                    onPlay();
                  }}
                  data-testid={`button-quick-mode-${m.id}`}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border transition-all duration-150 hover:scale-105 active:scale-95"
                  style={{
                    background: `${m.color}12`,
                    borderColor: `${m.color}30`,
                    color: m.color,
                  }}
                >
                  <MIcon className="w-3.5 h-3.5" style={{ color: m.color } as React.CSSProperties} />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Bottom stats strip ── */}
      <div className="relative z-10 border-t border-white/6 bg-black/30 backdrop-blur-sm px-4 md:px-8 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-muted-foreground"><span className="font-bold text-foreground">{onlineCount > 0 ? onlineCount.toLocaleString() : "—"}</span> online now</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-muted-foreground"><span className="font-bold text-foreground">{liveCount}</span> live matches</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs text-muted-foreground">3% rake · instant payouts</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/leaderboard">
              <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover-elevate px-2.5 py-1.5 rounded-lg border border-white/6">
                <BarChart3 className="w-3.5 h-3.5" />Rankings
              </button>
            </Link>
            <button onClick={onJoinPrivate}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover-elevate px-2.5 py-1.5 rounded-lg border border-white/6"
              data-testid="link-join-private">
              <Hash className="w-3.5 h-3.5" />Join Code
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── GOAT Spotlight ───────────────────────────────────────────────────────────
function GoatSpotlight() {
  const { data: goat } = useQuery<any>({ queryKey: ["/api/goat"], staleTime: 120_000 });
  if (!goat) return null;
  return (
    <div className="rounded-xl border overflow-hidden relative" style={{
      borderColor: `${GOAT_CONFIG.border}`,
      background: `linear-gradient(135deg, ${GOAT_CONFIG.bg} 0%, rgba(10,14,26,0.95) 70%)`,
      boxShadow: `0 0 40px -12px ${GOAT_CONFIG.glow}`,
    }} data-testid="goat-spotlight">
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(ellipse 60% 80% at 100% 50%, rgba(255,45,138,0.08), transparent 70%)`,
      }} />
      <div className="relative p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <Crown className="w-3.5 h-3.5" style={{ color: GOAT_CONFIG.color }} />
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: GOAT_CONFIG.color }}>Current GOAT</span>
          <span className="text-[10px] text-muted-foreground ml-1">Global #1</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <Avatar className="w-10 h-10">
              <AvatarImage src={goat.profileImageUrl ?? undefined} />
              <AvatarFallback className="text-sm font-black">{(goat.userName ?? "?")[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center"
              style={{ background: GOAT_CONFIG.color, boxShadow: `0 0 8px ${GOAT_CONFIG.glow}` }}>
              <Crown className="w-2 h-2 text-black" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <Link href={`/profile/${goat.userId}`}>
              <p className="font-black text-sm truncate hover:underline">{goat.userName ?? "Unknown"}</p>
            </Link>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span><span className="font-bold text-foreground">{goat.wins ?? 0}</span> wins</span>
              <span className="text-white/20">·</span>
              <span><span className="font-bold text-foreground">{goat.winRate ?? 0}%</span> WR</span>
            </div>
          </div>
          <GoatBadge size="xs" />
        </div>
      </div>
    </div>
  );
}

// ─── Leaderboard Mini (Ego + Status System) ──────────────────────────────────
function LeaderboardMini() {
  const { user } = useAuth() as { user: AnyUser | null };
  const { data = [] } = useQuery<LeaderboardEntry[]>({ queryKey: ["/api/leaderboard"], staleTime: 60_000 });
  const top5 = (data as LeaderboardEntry[]).slice(0, 5);

  const MEDAL = ["text-amber-400", "text-slate-300", "text-amber-600", "text-muted-foreground", "text-muted-foreground"];
  const MEDAL_BG = ["bg-amber-400/10", "bg-slate-400/8", "bg-amber-700/8", "", ""];
  const TREND_THRESHOLD = [75, 60, 50];

  // Simulated position for current user in the full list
  const myRank = user ? (data as LeaderboardEntry[]).findIndex(e => e.userId === user.id) : -1;
  const ahead = myRank >= 0 && myRank < (data as LeaderboardEntry[]).length - 1
    ? (data as LeaderboardEntry[])[myRank + 1] : null;

  return (
    <div className="space-y-0.5">
      {top5.map((entry, i) => {
        const isMe = user && entry.userId === user.id;
        const trend = entry.winRate >= (TREND_THRESHOLD[i] ?? 45) ? "up" : entry.winRate < 35 ? "down" : "flat";
        const streak = entry.wins >= 20 ? Math.floor(entry.wins / 4) : entry.wins >= 10 ? Math.floor(entry.wins / 5) : 0;

        return (
          <Link key={entry.userId ?? i} href={`/profile/${entry.userId}`} className="no-underline block">
            <div className={`flex items-center gap-2.5 p-2.5 rounded-lg hover-elevate transition-all ${
              isMe ? "ring-1 ring-primary/30 bg-primary/5" : MEDAL_BG[i]
            }`} data-testid={`leaderboard-mini-row-${i}`}>
              {/* Rank + medal */}
              <div className="w-6 text-center shrink-0">
                {i === 0 ? (
                  <Crown className="w-4 h-4 text-amber-400 mx-auto drop-shadow-[0_0_6px_rgba(234,179,8,0.8)]" />
                ) : (
                  <span className={`text-xs font-black ${MEDAL[i]}`}>#{i + 1}</span>
                )}
              </div>

              {/* Avatar */}
              <Avatar className="w-7 h-7 shrink-0">
                <AvatarImage src={entry.profileImageUrl ?? undefined} />
                <AvatarFallback className="text-[10px]">{entry.userName?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
              </Avatar>

              {/* Name + streak */}
              <div className="flex-1 min-w-0 flex items-center gap-1.5">
                <span className={`text-xs font-semibold truncate ${isMe ? "text-primary" : ""}`}>
                  {entry.userName ?? "Player"}
                  {isMe && <span className="ml-1 text-[9px] text-primary/60">(you)</span>}
                </span>
                {streak >= 3 && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Flame className="w-2.5 h-2.5 text-orange-400" />
                    <span className="text-[9px] font-bold text-orange-400">{streak}</span>
                  </div>
                )}
              </div>

              {/* Trend + winrate */}
              <div className="flex items-center gap-1.5 shrink-0">
                {trend === "up" && <TrendingUp className="w-3 h-3 text-green-400" />}
                {trend === "down" && <TrendingDown className="w-3 h-3 text-red-400" />}
                {trend === "flat" && <Minus className="w-3 h-3 text-white/20" />}
                <div className="text-right">
                  <div className={`text-xs font-bold ${entry.winRate >= 60 ? "text-green-400" : entry.winRate >= 40 ? "text-white/80" : "text-white/40"}`}>
                    {entry.winRate}%
                  </div>
                  <div className="text-[9px] text-muted-foreground">{entry.wins}W</div>
                </div>
              </div>
            </div>
          </Link>
        );
      })}

      {/* "You are close to…" personalization */}
      {myRank > 4 && ahead && (
        <div className="px-2.5 py-2 rounded-lg bg-primary/5 border border-primary/15 mt-1">
          <p className="text-[10px] text-primary/70 font-medium">
            You are <span className="font-black text-primary">#{myRank + 1}</span> — {myRank - ((data as LeaderboardEntry[]).findIndex(e => e.userId === ahead.userId))} spots from passing <span className="font-bold">{ahead.userName}</span>
          </p>
        </div>
      )}

      {top5.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No rankings yet</p>}
      <Link href="/leaderboard">
        <Button variant="ghost" size="sm" className="w-full text-xs gap-1 mt-1">
          Full Leaderboard <ChevronRight className="w-3 h-3" />
        </Button>
      </Link>
    </div>
  );
}

// ─── Urgency Match Card ────────────────────────────────────────────────────────
function UrgencyMatchCard({ match, onJoin, index, userDeviceType }: { match: MatchWithPlayers; onJoin: (m: MatchWithPlayers) => void; index: number; userDeviceType: string }) {
  const p1 = match.player1;
  const pot = parseFloat(match.potAmount || "0");
  const wager = parseFloat((match as any).wagerAmount || "0");
  const GameIcon = gameIcons[match.gameType as keyof typeof gameIcons];
  const gameName = match.gameType.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  const gameData = GAME_CATALOG.find(g => g.id === match.gameType);
  const accent = gameData?.accentColor ?? "#FF2D8A";
  const [waitSeconds, setWaitSeconds] = useState(0);

  useEffect(() => {
    const createdAt = (match as any).createdAt ? new Date((match as any).createdAt).getTime() : Date.now();
    const update = () => setWaitSeconds(Math.floor((Date.now() - createdAt) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [match.id]);

  const matchDevice = (match as any).deviceType as string | undefined;
  const isDeviceMismatch = !!(matchDevice && userDeviceType && matchDevice !== userDeviceType);
  const isLastSpot = false; // 1v1 always has 1 slot left
  const isReadyNow = waitSeconds >= 10;
  const isHot = waitSeconds >= 30;

  const borderStyle = isHot
    ? { border: `1.5px solid ${accent}60`, boxShadow: `0 0 20px -4px ${accent}50` }
    : isReadyNow
    ? { border: `1.5px solid ${accent}35` }
    : { border: "1px solid rgba(255,255,255,0.06)" };

  const formatWait = (s: number) => s < 60 ? `${s}s waiting` : `${Math.floor(s / 60)}m waiting`;

  return (
    <motion.div
      className="relative flex items-center gap-3 p-4 rounded-xl cursor-pointer group transition-all hover-elevate"
      style={{ background: `${accent}07`, ...borderStyle }}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={() => onJoin(match)}
      data-testid={`urgency-match-${match.id}`}
    >
      {/* Animated top glow for hot matches */}
      {isHot && (
        <motion.div
          className="absolute top-0 left-0 right-0 h-px rounded-t-xl"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        />
      )}

      {/* Game icon */}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 icon-bounce-on-click"
        style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
        {GameIcon ? <GameIcon className="w-5 h-5" style={{ color: accent } as React.CSSProperties} />
          : <Gamepad2 className="w-5 h-5 text-muted-foreground" />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold truncate">{gameName}</p>
          {isHot && (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: `${accent}25`, color: accent, border: `1px solid ${accent}50` }}>
              HOT MATCH
            </span>
          )}
          {!isHot && isReadyNow && (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/25 shrink-0">
              READY NOW
            </span>
          )}
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/25 shrink-0">
            LAST SPOT
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-muted-foreground truncate">{displayName(p1)} waiting</span>
          <span className="text-white/20 text-[10px]">·</span>
          <div className="flex items-center gap-1">
            <Clock className="w-2.5 h-2.5 text-white/30" />
            <span className={`text-[10px] font-semibold ${isHot ? "text-orange-400" : "text-muted-foreground"}`}>
              {formatWait(waitSeconds)}
            </span>
          </div>
          <span className="text-white/20 text-[10px]">·</span>
          <span className="text-[10px] text-white/35">1/2 slots</span>
        </div>
      </div>

      {/* Wager + CTA */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        {/* Device badge */}
        {matchDevice === "mobile" && (
          <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/12 text-cyan-400 border border-cyan-500/25">
            <Smartphone className="w-2.5 h-2.5" />MOBILE
          </span>
        )}
        {matchDevice === "desktop" && (
          <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/12 text-violet-400 border border-violet-500/25">
            <Monitor className="w-2.5 h-2.5" />DESKTOP
          </span>
        )}
        {wager > 0 ? (
          <div className="flex items-center gap-1">
            <ScalpsIcon size="xs" />
            <span className="text-sm font-black text-amber-400">{wager.toFixed(0)}</span>
            <span className="text-[10px] text-amber-400/50">S</span>
          </div>
        ) : (
          <span className="text-[10px] text-green-400 font-semibold">Free</span>
        )}
        {isDeviceMismatch ? (
          <div
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-black border cursor-not-allowed"
            style={{ borderColor: "rgba(0,220,255,0.25)", color: "rgba(0,220,255,0.45)", background: "rgba(0,220,255,0.05)" }}
            onClick={e => e.stopPropagation()}
            title={matchDevice === "mobile" ? "Available on mobile devices only" : "Available on desktop only"}
          >
            <Smartphone className="w-3 h-3" />
            {matchDevice === "mobile" ? "MOBILE ONLY" : "DESKTOP ONLY"}
          </div>
        ) : (
          <motion.button
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-black text-white"
            style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={e => { e.stopPropagation(); onJoin(match); }}
          >
            <Swords className="w-3 h-3" />JOIN NOW
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Activity Feed ────────────────────────────────────────────────────────────
type ActivityItem = { matchId: string; gameType: string; potAmount: string; winnerName: string; loserName: string; completedAt: string };

function fmtAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const GAME_LABEL: Record<string, string> = {
  chess: "Chess", "mini-golf": "Mini Golf", "air-hockey": "Air Hockey",
  "8-ball": "Pool", "connect-4": "Connect 4", bowling: "Bowling",
  "rock-paper-scissors": "RPS", "block-blast": "Block Blast",
  "dots-and-boxes": "Dots", tron: "Tron",
  basketball: "Basketball", football: "Football", racing: "Racing",
};

function ActivityFeed() {
  const { data: activity = [], isLoading } = useQuery<ActivityItem[]>({
    queryKey: ["/api/activity/recent"],
    refetchInterval: 8_000,
    staleTime: 5_000,
  });

  // Cycle through items one at a time for live ticker feel
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (activity.length <= 1) return;
    const interval = setInterval(() => {
      setVisibleIndex(i => (i + 1) % activity.length);
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    }, 4500);
    return () => clearInterval(interval);
  }, [activity.length]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 h-7">
            <div className="w-1.5 h-1.5 rounded-full bg-white/10 shrink-0" />
            <div className="h-3 bg-white/5 rounded flex-1 animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
          </div>
        ))}
      </div>
    );
  }

  if (activity.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-3">No recent matches yet</p>;
  }

  // Show all items with staggered entrance, highlight the "newest" one
  return (
    <div className="space-y-1.5">
      {/* Live indicator + ticker spotlight */}
      <div className="flex items-center gap-2 mb-2">
        <span className="relative flex items-center">
          <span className={`w-1.5 h-1.5 rounded-full bg-green-400 transition-opacity duration-300 ${pulse ? "opacity-100" : "opacity-70"}`} />
          <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-40" />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-400/70">Live</span>
      </div>

      {/* Scrolling spotlight item */}
      <div className="relative overflow-hidden rounded-lg border border-white/6 bg-white/2 mb-2" style={{ minHeight: "40px" }}>
        <AnimatePresence mode="wait">
          {activity[visibleIndex] && (() => {
            const item = activity[visibleIndex];
            const game = GAME_LABEL[item.gameType] ?? item.gameType;
            const pot = parseFloat(item.potAmount ?? "0");
            return (
              <motion.div
                key={item.matchId + visibleIndex}
                className="flex items-center gap-2.5 px-3 py-2.5 text-xs"
                initial={{ x: 32, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -32, opacity: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                <span className="w-5 h-5 rounded flex items-center justify-center shrink-0 text-[10px] font-black"
                  style={{ background: "rgba(255,45,138,0.15)", color: "#FF2D8A" }}>
                  {game.slice(0, 2).toUpperCase()}
                </span>
                <span className="flex-1 text-white/75 leading-snug">
                  <span className="font-semibold text-white/90">{item.winnerName}</span>
                  {" beat "}
                  <span className="text-white/60">{item.loserName}</span>
                  {" in "}
                  <span className="text-white/55">{game}</span>
                  {pot > 0 && (
                    <span className="ml-1 text-amber-400 font-bold">+{(pot * 0.97 / 2).toFixed(2)}S</span>
                  )}
                </span>
                <span className="text-white/25 shrink-0 text-[10px]">{fmtAgo(item.completedAt)}</span>
              </motion.div>
            );
          })()}
        </AnimatePresence>
        {/* Dot indicators */}
        <div className="absolute bottom-1 right-2 flex gap-1">
          {activity.slice(0, Math.min(activity.length, 8)).map((_, i) => (
            <span key={i} className="w-1 h-1 rounded-full transition-all duration-300"
              style={{ background: i === visibleIndex % Math.min(activity.length, 8) ? "rgba(255,45,138,0.8)" : "rgba(255,255,255,0.15)" }} />
          ))}
        </div>
      </div>

      {/* Static list of remaining items */}
      {activity.slice(0, 5).map((item, i) => {
        const game = GAME_LABEL[item.gameType] ?? item.gameType;
        const pot = parseFloat(item.potAmount ?? "0");
        return (
          <motion.div
            key={item.matchId}
            className="flex items-start gap-2 text-xs"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
          >
            <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
              style={{ background: i === 0 ? "rgba(255,45,138,0.7)" : "rgba(255,255,255,0.18)" }} />
            <span className="flex-1 text-muted-foreground leading-snug">
              <span className="text-white/60">{item.winnerName}</span>
              {" won in "}{game}
              {pot > 0 && <span className="text-amber-400/70 ml-1">(+{(pot * 0.97 / 2).toFixed(2)}S)</span>}
            </span>
            <span className="text-muted-foreground/35 shrink-0 text-[10px]">{fmtAgo(item.completedAt)}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Tournament Countdown ─────────────────────────────────────────────────────
function TournamentCountdown({ startsAt }: { startsAt: string | null }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!startsAt) return;
    const target = new Date(startsAt).getTime();
    const tick = () => setSecs(Math.max(0, Math.floor((target - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startsAt]);
  if (!startsAt) return null;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (secs <= 0) return <span className="text-[10px] text-green-400 font-bold">STARTING NOW</span>;
  return (
    <div className="flex items-center gap-1">
      <Timer className="w-3 h-3 text-amber-400/70" />
      <span className="text-[10px] font-mono font-bold text-amber-400">
        {h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`}
      </span>
    </div>
  );
}

// ─── Tournament Event Cards ───────────────────────────────────────────────────
function TournamentPreview() {
  const { data: list = [] } = useQuery<any[]>({ queryKey: ["/api/tournaments?status=open&limit=3"], staleTime: 60_000 });

  if (list.length === 0) return (
    <div className="flex flex-col items-center py-10 text-muted-foreground gap-3">
      <Trophy className="w-10 h-10 opacity-20" />
      <p className="text-sm">No open tournaments right now</p>
      <Link href="/tournaments">
        <Button size="sm" variant="outline" className="border-white/10 gap-1">Browse All <ChevronRight className="w-3 h-3" /></Button>
      </Link>
    </div>
  );

  return (
    <div className="space-y-3">
      {list.map((t, idx) => {
        const prize = parseFloat(t.prize_pool ?? "0");
        const entry = parseFloat(t.entry_fee ?? "0");
        const current = Number(t.joined_count ?? t.current_players ?? 0);
        const max = Number(t.max_players ?? 16);
        const pct = Math.min((current / max) * 100, 100);
        const spotsLeft = max - current;
        const isPremium = prize >= 50;
        const isFilling = pct >= 70;

        return (
          <Link key={t.id} href="/tournaments">
            <motion.div
              className="relative rounded-xl overflow-hidden cursor-pointer hover-elevate"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
              style={{
                background: isPremium
                  ? "linear-gradient(135deg, rgba(245,158,11,0.10) 0%, rgba(17,24,39,0.95) 60%)"
                  : "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(17,24,39,0.95) 60%)",
                border: isPremium ? "1.5px solid rgba(245,158,11,0.3)" : "1px solid rgba(255,255,255,0.08)",
                boxShadow: isPremium ? "0 0 24px -8px rgba(245,158,11,0.35)" : "none",
              }}
              data-testid={`tournament-card-${t.id}`}
            >
              {/* Premium shimmer */}
              {isPremium && (
                <div className="absolute top-0 left-0 right-0 h-px"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.8), transparent)" }} />
              )}

              <div className="p-4 flex items-start gap-4">
                {/* Icon */}
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: isPremium ? "rgba(245,158,11,0.15)" : "rgba(99,102,241,0.12)", border: isPremium ? "1px solid rgba(245,158,11,0.3)" : "1px solid rgba(99,102,241,0.2)" }}>
                  <Trophy className="w-5 h-5" style={{ color: isPremium ? "#f59e0b" : "#818cf8" }} />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-bold text-sm leading-tight">{t.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <TournamentCountdown startsAt={t.starts_at ?? t.startsAt ?? null} />
                        {isFilling && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-red-500/12 text-red-400 border border-red-500/25">
                            {spotsLeft} SPOTS LEFT
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Prize pool — big text */}
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 justify-end">
                        <ScalpsIcon size="sm" />
                        <span className={`text-xl font-black ${isPremium ? "text-amber-400" : "text-primary"}`}
                          style={{ textShadow: isPremium ? "0 0 16px rgba(245,158,11,0.5)" : undefined }}>
                          {prize > 0 ? prize.toFixed(0) : "Free"}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">prize pool</p>
                      {entry > 0 && (
                        <p className="text-[10px] text-muted-foreground">{entry.toFixed(0)}S entry</p>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground">{current}/{max} players</span>
                      <span className="text-[10px] font-semibold" style={{ color: isPremium ? "#f59e0b" : "#818cf8" }}>{Math.round(pct)}% full</span>
                    </div>
                    <div className="h-1.5 bg-white/5 progress-glow">
                      <motion.div
                        className={`h-full ${isPremium ? "rank-bar-fill" : "xp-bar-fill"}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: idx * 0.1 }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* JOIN button */}
              <div className="px-4 pb-4">
                <button
                  className="w-full py-2 rounded-lg text-sm font-black transition-all"
                  style={{
                    background: isPremium ? "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.1))" : "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(99,102,241,0.1))",
                    border: isPremium ? "1px solid rgba(245,158,11,0.3)" : "1px solid rgba(99,102,241,0.25)",
                    color: isPremium ? "#f59e0b" : "#818cf8",
                  }}
                  data-testid={`join-tournament-${t.id}`}
                >
                  VIEW TOURNAMENT
                </button>
              </div>
            </motion.div>
          </Link>
        );
      })}
      <Link href="/tournaments">
        <Button variant="ghost" size="sm" className="w-full text-xs gap-1 text-muted-foreground">
          All Tournaments <ChevronRight className="w-3 h-3" />
        </Button>
      </Link>
    </div>
  );
}

// ─── Challenges Accordion ─────────────────────────────────────────────────────
function ChallengesAccordion({ userStats }: { userStats: any }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth() as { user: AnyUser | null };
  const { data: challengeClaims = [] } = useQuery<Array<{ challengeId: string }>>({ queryKey: ["/api/challenges/claims"], enabled: !!user, staleTime: 10_000 });
  const claimedIds = new Set(challengeClaims.map(c => c.challengeId));
  const rewardsReady = CHALLENGES.filter(c => c.getProgress(userStats ?? {}) >= c.target && !claimedIds.has(c.id)).length;

  return (
    <div className="rounded-xl border border-white/8 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 hover-elevate"
        data-testid="button-challenges-accordion"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-sm">Daily Challenges</span>
          {rewardsReady > 0 && (
            <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30">{rewardsReady} ready</Badge>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-white/6">
              <DailyChallenges stats={userStats} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Section card wrapper ─────────────────────────────────────────────────────
function SectionCard({ children, className = "", accent }: { children: React.ReactNode; className?: string; accent?: string }) {
  return (
    <div className={`card-depth ${className}`}>
      {/* Subtle rainbow top-edge accent */}
      <div className="h-px w-full opacity-50" style={{
        background: accent
          ? `linear-gradient(90deg, transparent, ${accent}80, transparent)`
          : "linear-gradient(90deg, transparent, rgba(255,45,138,0.5) 30%, rgba(99,102,241,0.4) 60%, rgba(6,182,212,0.4) 85%, transparent)",
      }} />
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, action, actionHref, color = "text-muted-foreground" }: {
  icon: React.ComponentType<{ className?: string }>; title: string; action?: string; actionHref?: string; color?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="icon-bounce-on-click"><Icon className={`w-4 h-4 ${color}`} /></span>
      <h3 className="font-bold text-sm flex-1">{title}</h3>
      {action && actionHref && (
        <Link href={actionHref}>
          <Button variant="ghost" size="sm" className="text-[11px] gap-1 text-muted-foreground h-auto py-1">
            {action} <ChevronRight className="w-3 h-3" />
          </Button>
        </Link>
      )}
    </div>
  );
}

const ARENA_ORIGINS_DISMISS_KEY = "jango.arenaOriginsTeaserDismissed";

function ArenaOriginsTeaser() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(ARENA_ORIGINS_DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem(ARENA_ORIGINS_DISMISS_KEY, "1");
    } catch {}
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-5 md:p-6 shadow-xl shadow-primary/10"
        data-testid="card-arena-origins-teaser"
      >
        <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)" }} />
        <div className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)" }} />

        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover-elevate active-elevate-2 z-10"
          data-testid="button-dismiss-arena-origins-teaser"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6 pr-8">
          <div className="w-12 h-12 rounded-xl border border-white/15 bg-white/5 backdrop-blur-xl flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-primary/80 mb-1">Arena Origins</p>
            <h3 className="text-lg md:text-xl font-bold font-display text-white leading-tight mb-1">
              Born from the love of the game.
            </h3>
            <p className="text-xs md:text-sm text-white/55 leading-relaxed max-w-xl">
              The story behind Jango &mdash; a real-time coliseum built for players who never stopped playing.
            </p>
          </div>

          <Button
            variant="outline"
            asChild
            className="backdrop-blur-xl bg-white/6 border-white/15 text-white/85 gap-2 shrink-0 w-full md:w-auto"
            data-testid="button-arena-origins-teaser"
          >
            <Link href="/arena-origins">
              Read the Origin Story
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Main Home Page ───────────────────────────────────────────────────────────
export default function Home() {
  const { user } = useAuth() as { user: AnyUser | null };
  const { toast } = useToast();
  const deviceType = useDeviceType();
  const [, setLocation] = useLocation();

  const [playModalOpen, setPlayModalOpen] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("bot") === "difficulty";
  });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinPrivateOpen, setJoinPrivateOpen] = useState(false);
  const [createPrivateOpen, setCreatePrivateOpen] = useState(false);
  const [preSelectedGame, setPreSelectedGame] = useState<GameType | null>(null);
  const [preSelectedWager, setPreSelectedWager] = useState<number | null>(null);
  const [joinConfirmOpen, setJoinConfirmOpen] = useState(false);
  const [matchToJoin, setMatchToJoin] = useState<MatchWithPlayers | null>(null);
  const [deviceMismatchOpen, setDeviceMismatchOpen] = useState(false);
  const [deviceMismatchMatch, setDeviceMismatchMatch] = useState<MatchWithPlayers | null>(null);
  const [insufficientFundsOpen, setInsufficientFundsOpen] = useState(false);

  const { data: balanceData } = useQuery<{ balance: string }>({ queryKey: ["/api/wallet/balance"] });
  const { data: onlineStats } = useQuery<{ count: number }>({ queryKey: ["/api/stats/online"], refetchInterval: 30_000 });
  const { data: liveMatchesData = [] } = useQuery<MatchWithPlayers[]>({ queryKey: ["/api/matches/live"], refetchInterval: 15_000 });
  const { data: matches, isLoading: matchesLoading } = useQuery<MatchWithPlayers[]>({ queryKey: ["/api/matches"] });
  const { data: favoriteGames = [] } = useQuery<FavoriteGame[]>({ queryKey: ["/api/favorites"], enabled: !!user });
  const { data: shopItems = [] } = useQuery<ShopItem[]>({ queryKey: ["/api/shop/items"], staleTime: 60_000, enabled: !!user });
  const { data: userStats } = useQuery<any>({ queryKey: [`/api/users/${user?.id}/stats`], enabled: !!user, staleTime: 30_000 });

  const balance = parseFloat(balanceData?.balance ?? "0");
  const favSet = useMemo(() => new Set(favoriteGames.map(f => f.gameType as GameType)), [favoriteGames]);
  const waitingMatches = useMemo(() => (matches ?? []).filter(m => m.status === "waiting").slice(0, 6), [matches]);
  const highStakesMatches = useMemo(() => (matches ?? []).filter(m => m.status === "waiting" && parseFloat(m.potAmount || "0") / 2 >= 10).slice(0, 4), [matches]);
  const onlineCount = onlineStats?.count ?? 0;
  const liveCount = liveMatchesData.length;

  const addFavoriteMutation = useMutation({
    mutationFn: (gameType: GameType) => apiRequest("POST", `/api/favorites/${gameType}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/favorites"] }),
    onError: (err: Error) => { if (!isUnauthorizedError(err)) toast({ title: "Failed to star game", variant: "destructive" }); },
  });
  const removeFavoriteMutation = useMutation({
    mutationFn: (gameType: GameType) => apiRequest("DELETE", `/api/favorites/${gameType}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/favorites"] }),
  });
  const joinMatchMutation = useMutation({
    mutationFn: (matchId: string) => apiRequest("POST", `/api/matches/${matchId}/join`, { deviceType }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      if (data?.matchId) window.location.href = `/game/${data.matchId}`;
      else toast({ title: "Joined!", description: "Good luck!" });
    },
    onError: (err: Error) => {
      const msg = err.message || "";
      const low = msg.toLowerCase();
      if (msg.includes("DEVICE_NOT_SUPPORTED") || low.includes("mobile players only") || low.includes("desktop players only")) {
        setDeviceMismatchMatch(matchToJoin);
        setDeviceMismatchOpen(true);
      } else if (low.includes("insufficient") || low.includes("not enough") || low.includes("INSUFFICIENT_FUNDS")) {
        setInsufficientFundsOpen(true);
      } else if (low.includes("own match") || low.includes("your own") || low.includes("created this")) {
        toast({ title: "That's your match", description: "You created this match. Wait for another player to join, or cancel it.", variant: "destructive" });
      } else if (low.includes("full") || low.includes("MATCH_FULL")) {
        toast({ title: "Match just filled", description: "Another player grabbed the last spot. Find another match.", variant: "destructive" });
      } else if (low.includes("expired") || low.includes("no longer available")) {
        toast({ title: "Match expired", description: "This match is no longer available. Try a different one.", variant: "destructive" });
      } else if (!isUnauthorizedError(err)) {
        toast({ title: "Could not join match", description: "Something went wrong. Please try again.", variant: "destructive" });
      }
    },
  });

  function handleJoin(m: MatchWithPlayers) {
    soundManager.playClick();
    const matchDevice = (m as any).deviceType as string | undefined;
    if (matchDevice && matchDevice !== deviceType) {
      setDeviceMismatchMatch(m);
      setDeviceMismatchOpen(true);
      return;
    }
    setMatchToJoin(m);
    setJoinConfirmOpen(true);
  }
  function confirmJoin() { if (!matchToJoin) return; joinMatchMutation.mutate(matchToJoin.id); setJoinConfirmOpen(false); }

  const botUrlParams = (() => {
    const p = new URLSearchParams(window.location.search);
    const botMode = p.get("bot");
    const game = p.get("game") as GameType | null;
    const difficulty = (p.get("difficulty") as "easy" | "medium" | "hard") || "medium";
    return { botMode, game, difficulty };
  })();

  const launchBotMatchMutation = useMutation({
    mutationFn: async ({ game, difficulty }: { game: GameType; difficulty: string }) => {
      const res = await apiRequest("POST", "/api/matches/bot", { gameType: game, difficulty });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.id) setLocation(`/game/${data.id}`);
      else toast({ title: "Bot Match Ready!", description: "Starting your game..." });
    },
    onError: (err: Error) => {
      if (!isUnauthorizedError(err)) toast({ title: "Failed to start bot match", description: err.message, variant: "destructive" });
    },
  });

  function handleLaunchBotMatch(game: GameType, difficulty: "easy" | "medium" | "hard") {
    soundManager.playClick();
    launchBotMatchMutation.mutate({ game, difficulty });
  }

  useEffect(() => {
    if (botUrlParams.botMode === "replay" && botUrlParams.game && user) {
      setLocation("/");
      launchBotMatchMutation.mutate({ game: botUrlParams.game, difficulty: botUrlParams.difficulty });
    }
  }, [user, botUrlParams.botMode]);

  function handleLaunchMatch(game: GameType, wager: number, mode: PlayMode) {
    soundManager.playClick();
    setPreSelectedGame(game);
    setPreSelectedWager(wager);
    setCreateDialogOpen(true);
  }
  function handleQueue(game: GameType) {
    soundManager.playClick();
    setPreSelectedGame(game);
    setCreateDialogOpen(true);
  }

  return (
    <div className="min-h-screen bg-background relative">
      <PageDepthBackground
        glowZones={[
          { x: "15%", y: "0%",  color: "255,45,138",  size: "55%", opacity: 0.06 },
          { x: "85%", y: "5%",  color: "59,130,246",  size: "45%", opacity: 0.05 },
          { x: "50%", y: "80%", color: "139,92,246",  size: "40%", opacity: 0.04 },
        ]}
        particleCount={28}
        gridLines={false}
      />
      <AppNavbar />

      {/* ── HERO ── */}
      <LobbyHero
        user={user}
        balance={balance}
        onlineCount={onlineCount}
        liveCount={liveCount}
        onPlay={() => setPlayModalOpen(true)}
        onQueue={handleQueue}
        onCreatePrivate={() => setCreatePrivateOpen(true)}
        onJoinPrivate={() => setJoinPrivateOpen(true)}
      />

      {/* ── LIVE WINS TICKER ── */}
      <div className="border-b border-white/5 bg-black/20 px-4 md:px-8 py-2">
        <div className="max-w-7xl mx-auto">
          <RecentWinsTicker />
        </div>
      </div>

      {/* ── PHONE SHOP STRIP (mobile only) ── */}
      {user && (
        <div className="md:hidden border-b border-white/[0.06]"
          style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.07) 0%, rgba(236,72,153,0.05) 100%)" }}>
          {/* Header row */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#a855f7,#ec4899)" }}>
                <ShoppingBag className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-bold">Item Shop</span>
              {shopItems.some(i => i.isFeatured) && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full text-white"
                  style={{ background: "linear-gradient(135deg,#a855f7,#ec4899)" }}>
                  FEATURED
                </span>
              )}
            </div>
            <Link href="/shop">
              <span className="text-[11px] text-violet-400 font-semibold cursor-pointer flex items-center gap-0.5"
                data-testid="phone-shop-strip-see-all">
                See all <ChevronRight className="w-3 h-3" />
              </span>
            </Link>
          </div>

          {/* Horizontal scroll items */}
          <div className="flex gap-2.5 overflow-x-auto px-4 pb-3 scrollbar-none">
            {(shopItems.length > 0
              ? [...shopItems].sort((a, b) => {
                  const order = { mythic: 0, legendary: 1, epic: 2, rare: 3, common: 4 };
                  return (order[a.rarity as keyof typeof order] ?? 5) - (order[b.rarity as keyof typeof order] ?? 5);
                }).slice(0, 10)
              : Array.from({ length: 5 })
            ).map((item, idx) => {
              if (!item) {
                return (
                  <div key={idx} className="shrink-0 w-24 h-28 rounded-xl bg-white/[0.04] animate-pulse" />
                );
              }
              const si = item as ShopItem;
              const RARITY_STYLES: Record<string, { border: string; glow: string; badge: string; label: string }> = {
                mythic:    { border: "rgba(255,45,138,0.45)", glow: "rgba(255,45,138,0.25)", badge: "#FF2D8A", label: "MYTHIC" },
                legendary: { border: "rgba(245,158,11,0.45)", glow: "rgba(245,158,11,0.20)", badge: "#F59E0B", label: "LEGEND" },
                epic:      { border: "rgba(236,72,153,0.40)", glow: "rgba(236,72,153,0.15)", badge: "#EC4899", label: "EPIC" },
                rare:      { border: "rgba(139,92,246,0.40)", glow: "rgba(139,92,246,0.15)", badge: "#8B5CF6", label: "RARE" },
                common:    { border: "rgba(59,130,246,0.25)", glow: "transparent",           badge: "#3B82F6", label: "COMMON" },
              };
              const rs = RARITY_STYLES[si.rarity] ?? RARITY_STYLES.common;
              const iconColor = si.iconColor ?? "#3B82F6";
              return (
                <Link key={si.id} href="/shop">
                  <div
                    className="shrink-0 w-24 flex flex-col rounded-xl overflow-hidden cursor-pointer hover-elevate active-elevate-2"
                    style={{ border: `1px solid ${rs.border}`, background: `linear-gradient(160deg, ${rs.glow} 0%, rgba(1,2,8,0.9) 100%)` }}
                    data-testid={`phone-shop-item-${si.id}`}
                  >
                    {/* Icon area */}
                    <div className="flex items-center justify-center h-16 relative"
                      style={{ background: si.previewGradient ?? `radial-gradient(ellipse at center, ${iconColor}20, transparent 70%)` }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: `${iconColor}22`, border: `1px solid ${iconColor}44`, boxShadow: `0 0 14px ${iconColor}55` }}>
                        <ShoppingBag className="w-5 h-5" style={{ color: iconColor }} />
                      </div>
                      {/* Rarity stripe at top */}
                      <div className="absolute top-0 left-0 right-0 h-0.5"
                        style={{ background: rs.badge }} />
                    </div>

                    {/* Info */}
                    <div className="px-1.5 py-1.5">
                      <p className="text-[10px] font-bold leading-tight truncate text-white">{si.name}</p>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[8px] font-black tracking-wider" style={{ color: rs.badge }}>
                          {rs.label}
                        </span>
                        <span className="text-[9px] font-bold text-amber-400">
                          {si.coinPrice > 0 ? `${si.coinPrice}` : `$${parseFloat(si.price).toFixed(0)}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}

            {/* CTA card at the end */}
            <Link href="/shop">
              <div
                className="shrink-0 w-20 h-[116px] flex flex-col items-center justify-center gap-1.5 rounded-xl cursor-pointer hover-elevate active-elevate-2"
                style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(236,72,153,0.10))", border: "1px solid rgba(139,92,246,0.3)" }}
                data-testid="phone-shop-strip-cta"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,#a855f7,#ec4899)" }}>
                  <ShoppingBag className="w-4 h-4 text-white" />
                </div>
                <span className="text-[9px] font-bold text-violet-300 text-center leading-tight">Visit<br />Shop</span>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* ── BELOW THE FOLD ── */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-6">

        {/* Arena Origins teaser — dismissible glass card */}
        {user && <ArenaOriginsTeaser />}

        {/* Daily Streak — full-width strip */}
        {user && <StreakModule />}

        {/* Session P&L — only shown when there's actual data */}
        {user && balance > 0 && <SessionPnLWidget currentBalance={balance} />}

        {/* ── OPEN MATCHES — Urgency Engine (full-width) ── */}
        <SectionCard>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-sm">Open Matches</h3>
              {waitingMatches.length > 0 && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
                  {waitingMatches.length} WAITING
                </span>
              )}
            </div>
            <Button size="sm" onClick={() => setPlayModalOpen(true)} className="gap-1.5 text-xs"
              style={{ background: "linear-gradient(135deg, #FF2D8A, #FF7A00)" }} data-testid="button-create-match">
              <Plus className="w-3.5 h-3.5" />Create Match
            </Button>
          </div>
          {matchesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-20 rounded-xl bg-white/4 animate-pulse" />)}
            </div>
          ) : waitingMatches.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {waitingMatches.map((m, idx) => <UrgencyMatchCard key={m.id} match={m} onJoin={handleJoin} index={idx} userDeviceType={deviceType} />)}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Gamepad2 className="w-10 h-10 opacity-20 mb-3" />
              <p className="text-sm mb-1">No open matches right now</p>
              <p className="text-xs text-muted-foreground/50 mb-4">Be the first — start a match and someone will join</p>
              <Button size="sm" onClick={() => setPlayModalOpen(true)} className="gap-2" data-testid="button-be-first"
                style={{ background: "linear-gradient(135deg, #FF2D8A, #FF7A00)" }}>
                <Play className="w-3.5 h-3.5" />Start a Match
              </Button>
            </div>
          )}
        </SectionCard>

        {/* ── HIGH STAKES — Gold section (only shown when there are high-wager matches) ── */}
        {highStakesMatches.length > 0 && (
          <div className="rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(239,68,68,0.06) 100%)",
              border: "1px solid rgba(245,158,11,0.22)",
              boxShadow: "0 0 40px -10px rgba(245,158,11,0.18)",
            }}>
            <div className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="relative w-7 h-7 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-lg bg-amber-500/20 animate-pulse" />
                    <Flame className="w-4 h-4 text-amber-400 relative z-10" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-amber-400 tracking-wide">HIGH STAKES</h3>
                    <p className="text-[10px] text-amber-400/50">Wagered matches — 10+ Scalps per player</p>
                  </div>
                </div>
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-[9px] font-black px-2 py-1 rounded-full text-red-400 border border-red-500/30"
                  style={{ background: "rgba(239,68,68,0.1)" }}
                >
                  LIVE WAGERS
                </motion.div>
              </div>

              {/* Match cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {highStakesMatches.map((m, idx) => {
                  const wager = parseFloat(m.potAmount || "0") / 2;
                  const GameIcon = gameIcons[m.gameType as keyof typeof gameIcons];
                  const gameData = GAME_CATALOG.find(g => g.id === m.gameType);
                  const accent = gameData?.accentColor ?? "#f59e0b";
                  const gameName = m.gameType.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
                  const p1 = m.player1;
                  const displayNameP1 = p1?.firstName || p1?.username || "Player";
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.06 }}
                      onClick={() => handleJoin(m)}
                      className="relative flex items-center gap-3 p-3.5 rounded-xl cursor-pointer hover-elevate group"
                      style={{
                        background: "rgba(245,158,11,0.05)",
                        border: `1px solid rgba(245,158,11,0.18)`,
                        boxShadow: `0 0 24px -8px rgba(245,158,11,0.25)`,
                      }}
                      data-testid={`high-stakes-match-${m.id}`}
                    >
                      {/* Pulsing top border */}
                      <motion.div
                        className="absolute top-0 left-0 right-0 h-px rounded-t-xl"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.8, repeat: Infinity, delay: idx * 0.3 }}
                        style={{ background: `linear-gradient(90deg, transparent, #f59e0b, transparent)` }}
                      />
                      {/* Game icon */}
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `${accent}18`, border: `1px solid ${accent}35` }}>
                        {GameIcon ? <GameIcon className="w-5 h-5" style={{ color: accent } as React.CSSProperties} />
                          : <Gamepad2 className="w-5 h-5 text-muted-foreground" />}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-bold truncate">{gameName}</span>
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full text-amber-400 border border-amber-500/30"
                            style={{ background: "rgba(245,158,11,0.12)" }}>
                            HIGH ROLLER
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{displayNameP1} is waiting</span>
                      </div>
                      {/* Wager */}
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <div className="flex items-center gap-1">
                          <ScalpsIcon size="xs" />
                          <span className="text-base font-black text-amber-400">{wager.toFixed(0)}</span>
                          <span className="text-[10px] text-amber-400/50">S</span>
                        </div>
                        <span className="text-[9px] text-muted-foreground">wager</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── TOURNAMENTS — Event System (full-width) ── */}
        <SectionCard accent="#f59e0b">
          <SectionHeader icon={Trophy} title="Tournament Events" action="View All" actionHref="/tournaments" color="text-amber-400" />
          <TournamentPreview />
        </SectionCard>

        {/* ── GAME GRID (full-width) ── */}
        <SectionCard>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-sm">All Games</h3>
              <span className="text-[9px] font-bold text-muted-foreground/50">{GAME_CATALOG.length} games</span>
            </div>
            <Button size="sm" onClick={() => setPlayModalOpen(true)} className="gap-2 text-xs"
              style={{ background: "linear-gradient(135deg, #FF2D8A, #FF7A00)" }} data-testid="button-quick-play">
              <Sparkles className="w-3.5 h-3.5" />Quick Play
            </Button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {GAME_CATALOG.map(g => {
              const GIcon = gameIcons[g.id as keyof typeof gameIcons];
              const isFav = favSet.has(g.id);
              return (
                <Magnetic3D key={g.id} maxTilt={5} className="magnetic-shimmer">
                <div
                  onClick={() => {
                    soundManager.playClick();
                    setPreSelectedGame(g.id);
                    setCreateDialogOpen(true);
                  }}
                  data-testid={`game-quick-${g.id}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { soundManager.playClick(); setPreSelectedGame(g.id); setCreateDialogOpen(true); } }}
                  className="relative flex flex-col items-center gap-2.5 p-3.5 rounded-xl card-depth group cursor-pointer"
                  style={{ background: `${g.accentColor}07` }}
                >
                  <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: `linear-gradient(90deg, transparent, ${g.accentColor}90, transparent)` }} />
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${g.accentColor}18`, border: `1px solid ${g.accentColor}35`, boxShadow: `0 0 16px -4px ${g.accentColor}50` }}>
                    {GIcon ? <GIcon className="w-5 h-5" style={{ color: g.accentColor } as React.CSSProperties} />
                      : <Gamepad2 className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div className="flex flex-col items-center gap-1 w-full min-w-0">
                    <p className="text-[11px] font-bold text-center leading-tight truncate w-full">{g.name}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: g.difficulty === "Hard" ? "#f43f5e" : g.difficulty === "Medium" ? "#f59e0b" : "#22c55e" }} />
                      <span className="text-[9px] text-muted-foreground/70 font-medium">{g.difficulty}</span>
                      {g.avgWager > 0 && (
                        <>
                          <span className="text-white/15 text-[9px]">·</span>
                          <span className="text-[9px] text-amber-400/70 font-semibold">{g.avgWager}S avg</span>
                        </>
                      )}
                    </div>
                  </div>
                  {/* PLAY NOW overlay on hover */}
                  <div className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    style={{ background: `${g.accentColor}18` }}>
                    <span className="text-[9px] font-black text-white/80 bg-black/40 px-2 py-1 rounded-md">PLAY</span>
                  </div>
                  <div
                    onClick={e => { e.stopPropagation(); soundManager.playClick(); isFav ? removeFavoriteMutation.mutate(g.id) : addFavoriteMutation.mutate(g.id); }}
                    role="button"
                    tabIndex={-1}
                    aria-label={isFav ? `Remove ${g.name} from favorites` : `Add ${g.name} to favorites`}
                    aria-pressed={isFav}
                    data-testid={`button-favorite-${g.id}`}
                    className={`absolute top-1.5 right-1.5 p-0.5 rounded cursor-pointer transition-opacity ${isFav ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                  >
                    <Star className={`w-3 h-3 ${isFav ? "text-amber-400 fill-amber-400" : "text-muted-foreground/40"}`} />
                  </div>
                </div>
                </Magnetic3D>
              );
            })}
          </div>
        </SectionCard>

        {/* ── LEADERBOARD + ACTIVITY (2-col) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard>
            <SectionHeader icon={BarChart3} title="Top Players" action="Full Rankings" actionHref="/leaderboard" color="text-primary" />
            <LeaderboardMini />
          </SectionCard>

          <SectionCard>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-green-400" />
              <h3 className="font-bold text-sm flex-1">Live Activity</h3>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </div>
            <ActivityFeed />
          </SectionCard>
        </div>

        {/* ── CHALLENGES + GOAT (2-col) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {user ? (
            <ChallengesAccordion userStats={userStats} />
          ) : (
            <SectionCard>
              <SectionHeader icon={Zap} title="Daily Challenges" color="text-amber-400" />
              <div className="flex flex-col items-center py-8 text-muted-foreground gap-2">
                <Zap className="w-8 h-8 opacity-20" />
                <p className="text-sm">Sign in to access daily challenges</p>
                <Link href="/auth"><Button size="sm" className="mt-2">Sign In</Button></Link>
              </div>
            </SectionCard>
          )}
          <GoatSpotlight />
        </div>

        {/* ── SHOP TEASER ── */}
        <div className="flex items-center justify-between p-5 rounded-xl hover-elevate"
          style={{ background: "linear-gradient(135deg, rgba(255,45,138,0.08), rgba(255,122,0,0.06))", border: "1.5px solid rgba(255,45,138,0.2)" }}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-pink-500/15 border border-pink-500/25"
              style={{ boxShadow: "0 0 20px -4px rgba(255,45,138,0.35)" }}>
              <ShoppingBag className="w-6 h-6 text-pink-400" />
            </div>
            <div>
              <p className="font-bold text-sm">Item Shop</p>
              <p className="text-xs text-muted-foreground">Exclusive cosmetics, avatar frames, and seasonal items</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] text-pink-400/70 font-semibold">32 items available</span>
                <span className="text-white/20 text-[10px]">·</span>
                <span className="text-[10px] text-amber-400/60 font-semibold">Legendary, Epic &amp; Rare tiers</span>
              </div>
            </div>
          </div>
          <Link href="/shop">
            <Button size="sm" className="gap-1 text-xs" style={{ background: "linear-gradient(135deg, #FF2D8A, #FF7A00)" }}
              data-testid="button-view-shop">
              Open Shop <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Modals ── */}
      <PlayModal
        open={playModalOpen}
        onClose={() => { setPlayModalOpen(false); setLocation("/"); }}
        balance={balance}
        favSet={favSet}
        onLaunchMatch={handleLaunchMatch}
        onLaunchBotMatch={handleLaunchBotMatch}
        onCreatePrivate={() => { setPlayModalOpen(false); setCreatePrivateOpen(true); }}
        onJoinPrivate={() => { setPlayModalOpen(false); setJoinPrivateOpen(true); }}
        initialMode={botUrlParams.botMode ? "bot" : null}
        initialGame={botUrlParams.botMode === "difficulty" ? botUrlParams.game : null}
        initialDifficulty={botUrlParams.botMode === "difficulty" ? botUrlParams.difficulty : undefined}
      />
      <CreateMatchDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        preSelectedGame={preSelectedGame}
        onPreSelectedGameChange={setPreSelectedGame}
      />
      <JoinMatchConfirmDialog
        open={joinConfirmOpen}
        onOpenChange={setJoinConfirmOpen}
        match={matchToJoin}
        userBalance={balanceData?.balance ?? "0"}
        onConfirm={confirmJoin}
        isJoining={joinMatchMutation.isPending}
      />
      <JoinPrivateMatchModal open={joinPrivateOpen} onClose={() => setJoinPrivateOpen(false)} />
      <PrivateMatchModal open={createPrivateOpen} onClose={() => setCreatePrivateOpen(false)} />

      {/* ── Insufficient Funds Modal ── */}
      <Dialog open={insufficientFundsOpen} onOpenChange={setInsufficientFundsOpen}>
        <DialogContent className="max-w-sm modal-entrance" data-testid="dialog-insufficient-funds">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-amber-400" />
              </div>
              Not Enough Scalps
            </DialogTitle>
            <DialogDescription>
              Your balance is too low to join this match
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/8 border border-amber-500/20">
              <DollarSign className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">Add Scalps to continue</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Top up your wallet to cover the wager and jump into the match.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-muted-foreground">Your balance</span>
              <span className="font-bold text-sm">{balance.toFixed(2)} S</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInsufficientFundsOpen(false)} data-testid="button-funds-cancel">
              Cancel
            </Button>
            <Button
              style={{ background: "linear-gradient(135deg,#FF2D8A,#FF7A00)", border: "none" }}
              onClick={() => { setInsufficientFundsOpen(false); setLocation("/wallet"); }}
              data-testid="button-add-funds"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Scalps
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Device Mismatch Modal ── */}
      <Dialog open={deviceMismatchOpen} onOpenChange={setDeviceMismatchOpen}>
        <DialogContent className="max-w-sm modal-entrance" data-testid="dialog-device-mismatch">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-cyan-400" />
              </div>
              Mobile Only Match
            </DialogTitle>
            <DialogDescription>
              This match can only be played on mobile devices
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-cyan-500/8 border border-cyan-500/20">
              <Smartphone className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">Join from your phone</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Open Jango on a mobile device to join this match. The game was created by a mobile player and is only available on mobile.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeviceMismatchOpen(false)} data-testid="button-mismatch-cancel">
              Got it
            </Button>
            <Button
              className="bg-cyan-500 text-white"
              onClick={() => { setDeviceMismatchOpen(false); navigator.clipboard?.writeText(window.location.href).then(() => toast({ title: "Link copied!", description: "Open this link on your mobile device." })); }}
              data-testid="button-mismatch-open-mobile"
            >
              <Smartphone className="w-3.5 h-3.5 mr-1.5" />
              Open on Mobile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
