import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { GameType } from "@shared/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Loader2, Users, Bot, Gamepad2, AlertCircle, Coins, Lock, Trophy,
  Info, Shield, Swords,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  ChessIcon, MiniGolfIcon, Connect4Icon, AirHockeyIcon, RockPaperScissorsIcon,
  DotsAndBoxesIcon, EightBallIcon, BowlingIcon, CupKingIcon, StackTowerIcon,
  BasketballIcon, FootballIcon, RacingIcon,
} from "@/components/GameIcons";
import { useDeviceType } from "@/hooks/useDeviceType";
import { WagerConfirmModal } from "@/components/WagerConfirmModal";

export const PLATFORM_CURRENCY = "SCALPS";
const RANKED_SCALPS = 1;
const QUICK_BET_AMOUNTS = ["5", "10", "25", "50", "100"];

const games: Array<{ type: GameType; name: string; description: string; icon: typeof ChessIcon }> = [
  { type: "chess",               name: "Chess",               description: "Strategic warfare on 64 squares",      icon: ChessIcon             },
  { type: "mini-golf",           name: "Mini Golf",           description: "Precision putting challenge",           icon: MiniGolfIcon          },
  { type: "connect-4",           name: "Connect 4",           description: "Four in a row competition",             icon: Connect4Icon          },
  { type: "air-hockey",          name: "Air Hockey",          description: "Fast-paced puck action",                icon: AirHockeyIcon         },
  { type: "rock-paper-scissors", name: "Rock Paper Scissors", description: "Best-of-3 tactical showdown",           icon: RockPaperScissorsIcon },
  { type: "dots-and-boxes",      name: "Dots & Boxes",        description: "Tactical box-claiming strategy",        icon: DotsAndBoxesIcon      },
  { type: "8-ball",              name: "8-Ball Pool",         description: "Classic billiards physics",             icon: EightBallIcon         },
  { type: "bowling",             name: "Bowling",             description: "Knock down pins strategically",         icon: BowlingIcon           },
  { type: "cup-king",            name: "Cup King",            description: "Beer pong precision challenge",         icon: CupKingIcon           },
  { type: "stack-tower",         name: "Stack Tower",         description: "Perfect block stacking duel",           icon: StackTowerIcon        },
  { type: "basketball",          name: "Basketball",          description: "5-shot showdown — most points wins",    icon: BasketballIcon        },
  { type: "football",            name: "Football",            description: "QB time — score more TDs per drive",    icon: FootballIcon          },
  { type: "racing",              name: "Racing",              description: "Top-down time trial — fastest wins",    icon: RacingIcon            },
];

type MatchType  = "player" | "bot" | "practice";
type MatchMode  = "casual" | "ranked";

interface ChallengeOpponent {
  id: string;
  firstName: string | null;
  lastName?: string | null;
  username?: string | null;
  profileImageUrl?: string | null;
}

interface CreateMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedGame?: GameType | null;
  onPreSelectedGameChange?: (game: GameType | null) => void;
  preSelectedOpponent?: ChallengeOpponent | null;
}

export default function CreateMatchDialog({
  open, onOpenChange, preSelectedGame, onPreSelectedGameChange, preSelectedOpponent,
}: CreateMatchDialogProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedGame,   setSelectedGame]   = useState<GameType | null>(preSelectedGame || null);
  const [matchType,      setMatchType]      = useState<MatchType>("player");
  const [matchMode,      setMatchMode]      = useState<MatchMode>("casual");
  const [botDifficulty,  setBotDifficulty]  = useState<"easy" | "medium" | "hard">("medium");
  const [betAmount,      setBetAmount]      = useState<string>("");
  const [holeCount,      setHoleCount]      = useState<3 | 5 | 7 | 9 | 18>(3);
  const [showWagerConfirm, setShowWagerConfirm] = useState(false);
  const [showAltBets,    setShowAltBets]    = useState(false);
  const [availableBets,  setAvailableBets]  = useState<string[]>([]);

  const deviceType = useDeviceType();

  const handleSelectGame = (game: GameType | null) => {
    setSelectedGame(game);
    onPreSelectedGameChange?.(game);
  };

  const resetForm = () => {
    handleSelectGame(null);
    setMatchType("player");
    setMatchMode("casual");
    setBotDifficulty("medium");
    setBetAmount("");
    setShowAltBets(false);
    setAvailableBets([]);
  };

  useEffect(() => {
    if (open) {
      setSelectedGame(preSelectedGame || null);
      if (preSelectedOpponent) setMatchType("player");
    } else {
      resetForm();
    }
  }, [open, preSelectedGame, preSelectedOpponent]);

  const { data: balanceData } = useQuery<{ balance: string }>({
    queryKey: ["/api/wallet/balance"],
    enabled: open,
  });

  const scalpsBalance = parseFloat(balanceData?.balance ?? "0");
  const isRanked      = matchType === "player" && matchMode === "ranked";
  const effectiveBet  = isRanked ? String(RANKED_SCALPS) : betAmount;
  const wager         = parseFloat(effectiveBet || "0");
  const winnings      = wager > 0 ? (wager * 2 * 0.97).toFixed(2) : null;

  const createMatchMutation = useMutation({
    mutationFn: async (gameType: GameType) => {
      const matchData: Record<string, unknown> = { gameType };
      if (gameType === "mini-golf") matchData.miniGolfHoleCount = holeCount;

      if (preSelectedOpponent) {
        const bet = parseFloat(effectiveBet) > 0 ? effectiveBet : undefined;
        const res = await apiRequest("POST", "/api/challenges/invite", {
          challengedId: preSelectedOpponent.id,
          gameType, betAmount: bet, deviceType,
          matchMode: isRanked ? "ranked" : "casual",
        });
        return { ...await res.json(), isChallenge: true };
      }

      if (matchType === "bot") {
        const res = await apiRequest("POST", "/api/matches/bot", { ...matchData, difficulty: botDifficulty });
        return await res.json();
      }

      if (matchType === "practice") {
        const res = await apiRequest("POST", "/api/matches/practice", matchData);
        return await res.json();
      }

      // vs Player: casual or ranked
      const bet = parseFloat(effectiveBet) > 0 ? effectiveBet : undefined;
      const res = await apiRequest("POST", "/api/matches", {
        ...matchData,
        betAmount: bet,
        deviceType,
        matchMode: isRanked ? "ranked" : "casual",
      });
      return await res.json();
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });

      if (response?.isChallenge) {
        queryClient.invalidateQueries({ queryKey: ["/api/challenges/pending"] });
        toast({ title: "Challenge Sent!", description: `Challenge sent to ${preSelectedOpponent?.username || preSelectedOpponent?.firstName || "player"}.` });
        onOpenChange(false); resetForm(); return;
      }

      if (matchType === "bot" || matchType === "practice") {
        toast({
          title: "Match Created!",
          description: matchType === "bot" ? "Starting game vs Bot..." : "Starting practice mode...",
        });
        const matchId = response?.id;
        onOpenChange(false); resetForm();
        if (matchId) setLocation(`/game/${matchId}`);
        return;
      }

      const match = response.match || response;

      if (response.autoMatched) {
        toast({ title: "Match Found!", description: response.message || "You've been matched with another player!" });
        onOpenChange(false); resetForm();
        if (match?.id) setLocation(`/game/${match.id}`);
      } else if (match?.id) {
        const betDesc = wager > 0 ? `${wager} ${PLATFORM_CURRENCY} wager placed. ` : "";
        const modeLabel = isRanked ? "Ranked" : (deviceType === "mobile" ? "mobile" : "desktop");
        toast({ title: "Match Created!", description: `${betDesc}Searching for ${modeLabel} players...` });
        onOpenChange(false); resetForm();
        setLocation(`/game/${match.id}`);
      } else if (response.availableBetAmounts?.length > 0) {
        setAvailableBets(response.availableBetAmounts);
        setShowAltBets(true);
        toast({ title: "No Match Found", description: `No ${isRanked ? "ranked" : ""} players waiting. Try a different amount.` });
      }
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: error.message || "Failed to create match", variant: "destructive" });
    },
  });

  const handleCreateMatch = () => {
    if (!selectedGame) return;

    if (matchType === "player" && !isRanked && parseFloat(betAmount) > 0) {
      const w = parseFloat(betAmount);
      if (w > scalpsBalance) {
        toast({ title: "Insufficient Balance", description: `You have ${scalpsBalance.toFixed(2)} ${PLATFORM_CURRENCY} but this wager requires ${w.toFixed(2)}.`, variant: "destructive" });
        return;
      }
      setShowWagerConfirm(true);
      return;
    }

    if (isRanked && RANKED_SCALPS > scalpsBalance) {
      toast({ title: "Insufficient Balance", description: `You need ${RANKED_SCALPS} ${PLATFORM_CURRENCY} to enter ranked.`, variant: "destructive" });
      return;
    }

    createMatchMutation.mutate(selectedGame);
  };

  const handleWagerConfirmed = () => {
    setShowWagerConfirm(false);
    if (selectedGame) createMatchMutation.mutate(selectedGame);
  };

  return (
    <div>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto relative"
          style={{
            background: "linear-gradient(145deg, #080c1a 0%, #0d1230 60%, #0f0a1e 100%)",
            border: "1px solid rgba(99,102,241,0.25)",
            boxShadow: "0 0 0 1px rgba(99,102,241,0.08), 0 40px 80px -20px rgba(0,0,0,0.9), 0 0 50px -20px rgba(99,102,241,0.15)",
          }}
          data-testid="dialog-create-match"
        >
          {/* Neon top edge */}
          <div className="absolute top-0 left-0 right-0 h-px z-10 pointer-events-none" style={{ background: "linear-gradient(90deg, transparent 5%, rgba(99,102,241,0.65) 40%, rgba(168,85,247,0.65) 60%, transparent 95%)" }} />
          <DialogHeader>
            <DialogTitle className="text-2xl font-display text-white">
              {preSelectedOpponent ? "Challenge Player" : "Create New Match"}
            </DialogTitle>
            <DialogDescription className="text-white/45">
              {preSelectedOpponent ? "Pick a game and wager to challenge" : "Choose a game and opponent type"}
            </DialogDescription>
          </DialogHeader>

          {/* Challenger info */}
          {preSelectedOpponent && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted" data-testid="challenge-opponent-info">
              <Avatar>
                <AvatarImage src={preSelectedOpponent.profileImageUrl || undefined} />
                <AvatarFallback>{(preSelectedOpponent.username?.[0] || preSelectedOpponent.firstName?.[0] || "?").toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{preSelectedOpponent.username || preSelectedOpponent.firstName || "Player"}</div>
                <div className="text-xs text-muted-foreground">Challenging to a match</div>
              </div>
            </div>
          )}

          {/* ── Match Type Tabs ─────────────────────────────────────────── */}
          {!preSelectedOpponent && (
            <div className="grid grid-cols-3 gap-2">
              {(["player", "bot", "practice"] as MatchType[]).map((type) => {
                const icons: Record<MatchType, React.ElementType> = { player: Users, bot: Bot, practice: Gamepad2 };
                const labels: Record<MatchType, string> = { player: "vs Player", bot: "vs Bot", practice: "Practice" };
                const noBotGames = ["racing", "air-hockey"];
                const botUnavailable = type === "bot" && selectedGame !== null && noBotGames.includes(selectedGame);
                const Icon = icons[type];
                return (
                  <Button
                    key={type}
                    variant={matchType === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => { if (!botUnavailable) setMatchType(type); }}
                    data-testid={`tab-${type}`}
                    disabled={botUnavailable}
                    title={botUnavailable ? "Bot mode not available for this game" : undefined}
                    className="flex items-center gap-1.5"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {labels[type]}
                  </Button>
                );
              })}
            </div>
          )}

          {/* ── Bot Difficulty ──────────────────────────────────────────── */}
          {matchType === "bot" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Bot Difficulty</label>
              <div className="grid grid-cols-3 gap-2">
                {(["easy", "medium", "hard"] as const).map((diff) => (
                  <Button key={diff} variant={botDifficulty === diff ? "default" : "outline"} size="sm"
                    onClick={() => setBotDifficulty(diff)} data-testid={`button-difficulty-${diff}`}>
                    {diff.charAt(0).toUpperCase() + diff.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* ── Hole Count (Mini Golf) ──────────────────────────────────── */}
          {selectedGame === "mini-golf" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Number of Holes</label>
              <div className="grid grid-cols-5 gap-2">
                {([3, 5, 7, 9, 18] as const).map((count) => (
                  <Button key={count} variant={holeCount === count ? "default" : "outline"} size="sm"
                    onClick={() => setHoleCount(count)} data-testid={`button-holes-${count}`}>
                    {count}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* ── Wager / Mode Section (vs Player only) ──────────────────── */}
          {matchType === "player" && (
            <Card className="card-depth p-5 space-y-4 bg-muted/30 border-primary/10">

              {/* Mode selector: Casual / Ranked */}
              <div className="space-y-2">
                <Label className="text-xs font-mono tracking-widest uppercase text-muted-foreground">Match Mode</Label>
                <div className="grid grid-cols-2 gap-2">
                  {/* Casual */}
                  <button
                    onClick={() => setMatchMode("casual")}
                    data-testid="button-mode-casual"
                    className={`relative flex flex-col gap-1 p-3 rounded-md border text-left transition-all ${
                      matchMode === "casual"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover-elevate"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Swords className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">Casual</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      Choose your own wager and play freely.
                    </p>
                    {matchMode === "casual" && (
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                    )}
                  </button>

                  {/* Ranked */}
                  <button
                    onClick={() => setMatchMode("ranked")}
                    data-testid="button-mode-ranked"
                    className={`relative flex flex-col gap-1 p-3 rounded-md border text-left transition-all ${
                      matchMode === "ranked"
                        ? "border-amber-500/70 bg-amber-500/10"
                        : "border-border bg-card hover-elevate"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-semibold">Ranked</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-auto">1 Scalp</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      Skill-based matchmaking. Locked at 1 Scalp.
                    </p>
                    {matchMode === "ranked" && (
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* ── RANKED UI: locked display ─────────────────────────── */}
              {isRanked && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 px-4 py-4 space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-sm font-semibold text-amber-300">Ranked Entry — Locked at 1 Scalp</span>
                  </div>
                  <p className="text-xs text-muted-foreground pl-6.5">
                    Every ranked match costs exactly 1 Scalp. This keeps competition standardized and skill-based.
                    You cannot raise or lower this amount.
                  </p>
                  <div className="pl-6.5 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Entry stake</span>
                      <div className="flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-amber-400" />
                        <span className="font-mono font-bold">1 {PLATFORM_CURRENCY}</span>
                        <Lock className="w-3 h-3 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Winner receives</span>
                      <span className="font-mono font-bold text-emerald-400">1.94 {PLATFORM_CURRENCY}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground/70">
                      <span className="flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        ELO matched opponents
                      </span>
                      <span className="font-mono">3% fee</span>
                    </div>
                  </div>
                  <div className="pl-6 flex items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">Your balance:</span>
                    <span className="text-[11px] font-mono font-semibold" data-testid="text-scalps-balance-ranked">
                      {scalpsBalance % 1 === 0 ? scalpsBalance.toFixed(0) : scalpsBalance.toFixed(2)} {PLATFORM_CURRENCY}
                    </span>
                    {RANKED_SCALPS > scalpsBalance && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Insufficient</Badge>
                    )}
                  </div>
                </div>
              )}

              {/* ── CASUAL UI: wager input ──────────────────────────────── */}
              {!isRanked && (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Label className="text-xs font-mono tracking-widest uppercase text-muted-foreground">Wager</Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Winner receives 97% of pot · 3% platform fee</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[11px] text-muted-foreground font-mono tracking-wide uppercase">Balance</div>
                      <div className="flex items-center gap-1 justify-end mt-0.5">
                        <Coins className="w-4 h-4 text-amber-400" />
                        <span className="text-lg font-bold font-mono text-foreground" data-testid="text-scalps-balance">
                          {scalpsBalance % 1 === 0 ? scalpsBalance.toFixed(0) : scalpsBalance.toFixed(2)}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">{PLATFORM_CURRENCY}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="relative">
                      <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-400" />
                      <Input
                        id="betAmount" type="number" placeholder="Enter wager in Scalps"
                        min="0" step="1" value={betAmount}
                        onChange={(e) => { setBetAmount(e.target.value); setShowAltBets(false); }}
                        className="pl-10 h-12 text-lg font-mono" data-testid="input-bet-amount"
                      />
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {QUICK_BET_AMOUNTS.map((amount) => (
                        <Button key={amount} variant={betAmount === amount ? "default" : "outline"} size="sm"
                          style={{ minHeight: 44 }}
                          onClick={() => { setBetAmount(amount); setShowAltBets(false); }}
                          disabled={scalpsBalance < parseFloat(amount)}
                          data-testid={`button-quick-bet-${amount}`} className="font-mono text-xs">
                          {amount}
                        </Button>
                      ))}
                    </div>

                    {winnings && (
                      <div className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-3 space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Wager</span>
                          <span className="font-mono font-semibold">{wager} {PLATFORM_CURRENCY}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Winner receives</span>
                          <span className="font-mono font-bold text-emerald-400">{winnings} {PLATFORM_CURRENCY}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground/70">
                          <span>Platform fee</span>
                          <span className="font-mono">3%</span>
                        </div>
                      </div>
                    )}

                    {showAltBets && availableBets.length > 0 && (
                      <Alert data-testid="alert-alternative-bets">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <p className="font-medium mb-2">No match found. Try one of these amounts with waiting players:</p>
                          <div className="flex flex-wrap gap-2">
                            {availableBets.map((amount) => (
                              <Button key={amount} variant="outline" size="sm"
                                onClick={() => { setBetAmount(amount); setShowAltBets(false); }}
                                data-testid={`button-alt-bet-${amount}`} className="font-mono">
                                {amount} {PLATFORM_CURRENCY}
                              </Button>
                            ))}
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </>
              )}
            </Card>
          )}

          {/* ── Game Selection ──────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Select Game</Label>
            <div className="max-h-[400px] overflow-y-auto pr-2 -mr-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {games.map((game) => {
                  const Icon = game.icon;
                  const isSelected = selectedGame === game.type;
                  return (
                    <Card key={game.type}
                      className={`card-depth p-4 cursor-pointer transition-all ${isSelected ? "ring-2 ring-primary" : "hover-elevate"}`}
                      onClick={() => handleSelectGame(game.type)}
                      data-testid={`game-option-${game.type}`}
                      role="button" aria-pressed={isSelected} tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelectGame(game.type); } }}
                    >
                      <div className="flex flex-col items-center text-center">
                        <div className={`w-16 h-16 rounded-lg flex items-center justify-center mb-3 ${isSelected ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                          <Icon className="w-8 h-8" />
                        </div>
                        <h4 className="font-semibold mb-1">{game.name}</h4>
                        <p className="text-sm text-muted-foreground">{game.description}</p>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Footer ─────────────────────────────────────────────────── */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { onOpenChange(false); resetForm(); }}
              disabled={createMatchMutation.isPending} data-testid="button-cancel-create">
              Cancel
            </Button>
            <Button onClick={handleCreateMatch} disabled={!selectedGame || createMatchMutation.isPending}
              data-testid="button-confirm-create">
              {createMatchMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</>
              ) : matchType === "bot" ? "Play vs Bot"
                : matchType === "practice" ? "Start Practice"
                : isRanked ? "Enter Ranked"
                : "Create Match"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {showWagerConfirm && selectedGame && (
        <WagerConfirmModal
          gameType={selectedGame}
          betAmount={parseFloat(betAmount || "0")}
          userBalance={scalpsBalance}
          onConfirm={handleWagerConfirmed}
          onCancel={() => setShowWagerConfirm(false)}
          isPending={createMatchMutation.isPending}
        />
      )}
    </div>
  );
}
