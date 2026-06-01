import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Trophy, Coins, Swords, Crown, Gamepad2, ShieldCheck, Target, Award, ChevronRight, ChevronLeft, X, CheckCircle2, PlayCircle, ArrowRight } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "wouter";
import { CoachProvider, TrainingCoach, useEmitCoachEvent } from "./TrainingCoach";

const TUTORIAL_ID = "platform-basics";
const QUICK_GAME_STEP_ID = "platform-quick-game";

interface Step {
  id: string;
  title: string;
  body: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  cta?: string;
  custom?: "match-confirm" | "quick-game" | "reward-preview" | "final";
}

const STEPS: Step[] = [
  {
    id: "welcome",
    title: "Welcome to Jango",
    body: "Skill games. Real competition. Every match matters. Let's get you ready for the Arena in under 3 minutes.",
    icon: Sparkles,
    cta: "Enter Training",
  },
  {
    id: "games",
    title: "Pick a Game",
    body: "Jango has 15+ skill games — Chess, 8-Ball, Mini Golf, Racing and more. Each has its own arena, controls, and rank.",
    icon: Gamepad2,
    hint: "Recommended for new players: Rock Paper Scissors, Connect 4, or Air Hockey.",
  },
  {
    id: "match-types",
    title: "Match Types",
    body: "Practice is risk-free. VS Bot helps you train. Ranked affects your division. Tournaments are bracketed events with bigger pots.",
    icon: Swords,
    hint: "Start with Practice. Climb to Ranked when you're ready.",
  },
  {
    id: "scalps",
    title: "Scalps Explained",
    body: "Scalps are the platform currency. They fund match pots, tournaments, and the item shop. You always see the entry fee and winner payout before joining.",
    icon: Coins,
    hint: "Jango never auto-deducts. You confirm every entry.",
  },
  {
    id: "match-confirm",
    title: "Match Confirmation",
    body: "Here's what a match entry looks like. Notice you can see the entry fee, total pot, and exactly what the winner takes home.",
    icon: ShieldCheck,
    custom: "match-confirm",
    cta: "Got it",
  },
  {
    id: "quick-game",
    title: "Your First Match",
    body: "Play a quick training round. Pick Rock, Paper, or Scissors. Win and you'll see the post-match flow.",
    icon: Target,
    custom: "quick-game",
  },
  {
    id: "post-match",
    title: "Post-Match Screen",
    body: "After every match you can Run It Back with the same opponent, switch games, or head back to the lobby.",
    icon: PlayCircle,
  },
  {
    id: "rank",
    title: "Ranks & Rewards",
    body: "Playing Ranked climbs you through divisions (Bronze III → Champion). Each milestone unlocks cosmetic rewards on the Rank Progression page.",
    icon: Crown,
    custom: "reward-preview",
  },
  {
    id: "complete",
    title: "Training Complete",
    body: "You've got the basics. Time to play for real — or try a game-specific tutorial.",
    icon: Award,
    custom: "final",
  },
];

export function PlatformBasicsTutorial(props: { startStep?: number; onClose: () => void; onComplete: () => void; onContinueNext?: (nextId: string) => void }) {
  return (
    <CoachProvider>
      <PlatformBasicsInner {...props} />
    </CoachProvider>
  );
}

function PlatformBasicsInner({ startStep = 0, onClose, onComplete, onContinueNext }: { startStep?: number; onClose: () => void; onComplete: () => void; onContinueNext?: (nextId: string) => void }) {
  const emit = useEmitCoachEvent();
  const [idx, setIdx] = useState(() => Math.max(0, Math.min(startStep, STEPS.length - 1)));
  const [rpsChoice, setRpsChoice] = useState<string | null>(null);
  const [rpsResult, setRpsResult] = useState<"win" | "loss" | "draw" | null>(null);
  const [claimedReward, setClaimedReward] = useState<null | { next: string | null; nextTitle: string | null }>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();

  const saveProgress = useMutation({
    mutationFn: async (vars: { currentStep: number }) =>
      apiRequest("POST", "/api/tutorial/progress", { tutorialId: TUTORIAL_ID, currentStep: vars.currentStep, totalSteps: STEPS.length }),
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      // Ensure the server sees the user at the final step BEFORE attempting
      // to claim the reward — server enforces currentStep >= totalSteps.
      await apiRequest("POST", "/api/tutorial/progress", {
        tutorialId: TUTORIAL_ID,
        currentStep: STEPS.length,
        totalSteps: STEPS.length,
      });
      return apiRequest("POST", "/api/tutorial/complete", { tutorialId: TUTORIAL_ID });
    },
    onError: (err: any) => {
      const msg = String(err?.message ?? "");
      if (msg.includes("TUTORIAL_LOCKED") || /403/.test(msg)) {
        toast({ title: "Locked", description: "Complete the previous training first.", variant: "destructive" });
      } else {
        toast({ title: "Couldn't claim reward", description: "Please try again.", variant: "destructive" });
      }
    },
    onSuccess: async (res) => {
      const data = await res.json().catch(() => ({} as any));
      if (data?.granted) {
        toast({ title: "Arena Rookie unlocked", description: "Badge added to your inventory." });
      } else if (data?.reason === "already_completed") {
        toast({ title: "Tutorial replayed", description: "You've already earned this badge." });
      } else {
        toast({ title: "Tutorial complete" });
      }
      // Refresh hub state immediately so unlocks are visible on return.
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/progress"] });
      const next: string | null = data?.status?.current ?? null;
      const nextIsSelf = next === TUTORIAL_ID;
      const resolvedNext = nextIsSelf ? null : next;
      setClaimedReward({ next: resolvedNext, nextTitle: resolvedNext ? prettyTutorialTitle(resolvedNext) : null });
    },
  });

  function prettyTutorialTitle(id: string): string {
    const map: Record<string, string> = {
      "platform-basics": "Jango Basics",
      "game-rock-paper-scissors": "Rock Paper Scissors",
      "game-connect-4": "Connect 4",
      "game-air-hockey": "Air Hockey",
      "game-mini-golf": "Mini Golf",
      "game-dots-and-boxes": "Dots & Boxes",
      "game-8-ball": "8-Ball Pool",
      "game-bowling": "Bowling",
      "game-chess": "Chess",
      "game-cup-king": "Cup King",
      "game-stack-tower": "Stack Tower",
      "game-block-blast": "Block Blast",
      "game-tron": "Tron",
    };
    return map[id] ?? id;
  }

  const step = STEPS[idx];
  const Icon = step.icon;

  // Save progress whenever step changes.
  useEffect(() => {
    saveProgress.mutate({ currentStep: idx + 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // Coach narration on step change.
  useEffect(() => {
    if (idx === 0) {
      emit({ type: "intro" });
    } else if (step.custom === "quick-game") {
      emit({ type: "idle", context: { stepId: QUICK_GAME_STEP_ID, message: "Pick a throw — I'll call out the read." } });
    } else if (idx === STEPS.length - 1) {
      emit({ type: "success", context: { message: "You made it — claim that badge." } });
    } else {
      emit({ type: "idle", context: { message: "Next step — ping me if you get stuck." } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const skip = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/tutorial/skip", { tutorialId: TUTORIAL_ID }),
    onSuccess: () => {
      toast({ title: "Tutorial skipped", description: "You can replay it anytime from the Tutorial Hub." });
      onClose();
    },
  });

  const advance = () => {
    if (idx === STEPS.length - 1) {
      completeMutation.mutate();
      return;
    }
    setIdx(idx + 1);
  };
  const back = () => idx > 0 && setIdx(idx - 1);

  // RPS quick game
  const playRPS = (choice: string) => {
    setRpsChoice(choice);
    // Tutorial bot is generous — user almost always wins.
    const tutorialBotPlays: Record<string, string> = { rock: "scissors", paper: "rock", scissors: "paper" };
    // Weighted: 70% lose-to-player (win), 15% draw, 15% beat-player (loss) so the
    // coach's miss/hint/struggle path is actually reachable during the quick game.
    const counter: Record<string, string> = { rock: "paper", paper: "scissors", scissors: "rock" };
    const roll = Math.random();
    const botPlay = roll < 0.7 ? tutorialBotPlays[choice] : roll < 0.85 ? choice : counter[choice];
    setTimeout(() => {
      let outcome: "win" | "loss" | "draw";
      if (botPlay === tutorialBotPlays[choice]) outcome = "win";
      else if (botPlay === choice) outcome = "draw";
      else outcome = "loss";
      setRpsResult(outcome);
      if (outcome === "win") {
        emit({ type: "success", context: { stepId: QUICK_GAME_STEP_ID, message: "Clean read — that's how a match starts." } });
      } else if (outcome === "loss") {
        emit({
          type: "miss",
          context: {
            stepId: QUICK_GAME_STEP_ID,
            hint: "Watch the cycle: rock loses to paper, paper loses to scissors, scissors loses to rock.",
            struggleThreshold: 1,
          },
        });
      } else {
        emit({ type: "idle", context: { stepId: QUICK_GAME_STEP_ID, message: "Draw — same pick replays. Switch it up." } });
      }
    }, 600);
  };

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") back();
      if (e.key === "ArrowRight" && step.custom !== "quick-game") advance();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [idx, step.custom]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        data-testid="platform-basics-tutorial"
      >
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
          className="relative w-full max-w-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <Card className="relative overflow-hidden border-primary/40 shadow-2xl">
            {/* Ambient glow */}
            <div className="absolute -inset-1 bg-gradient-to-br from-primary/20 via-transparent to-cyan-500/10 blur-2xl -z-10" />

            {/* Top bar */}
            <div className="flex items-center justify-between p-4 border-b border-border/60">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary font-semibold">
                <Sparkles className="w-3.5 h-3.5" /> Jango Training
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground" data-testid="text-step-count">Step {idx + 1} / {STEPS.length}</span>
                <button onClick={onClose} className="text-muted-foreground p-1 rounded-md hover-elevate active-elevate-2" data-testid="button-tutorial-close">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 md:p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-primary/5 border border-primary/40 flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl md:text-2xl font-bold mb-1.5" data-testid="text-step-title">{step.title}</h2>
                  <p className="text-sm md:text-base text-muted-foreground" data-testid="text-step-body">{step.body}</p>
                </div>
              </div>

              {step.hint && (
                <div className="mt-3 p-3 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary/90 flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{step.hint}</span>
                </div>
              )}

              {/* Custom step content */}
              {step.custom === "match-confirm" && (
                <div className="mt-5 p-4 rounded-xl border border-border bg-muted/40 space-y-2.5">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Game</span><span className="font-medium">Connect 4 · Ranked</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Entry Fee</span><span className="font-medium">10 Scalps</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Pot</span><span className="font-medium">20 Scalps</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Platform Rake</span><span className="font-medium">3%</span></div>
                  <div className="border-t border-border/60 pt-2.5 flex justify-between text-sm">
                    <span className="text-muted-foreground">Winner Receives</span>
                    <span className="font-bold text-emerald-400">19.40 Scalps</span>
                  </div>
                </div>
              )}

              {step.custom === "quick-game" && (
                <div className="mt-5 space-y-3">
                  {!rpsResult && (
                    <>
                      <div className="text-center text-xs text-muted-foreground">Choose your move</div>
                      <div className="grid grid-cols-3 gap-3">
                        {(["rock", "paper", "scissors"] as const).map(c => (
                          <button
                            key={c}
                            disabled={!!rpsChoice}
                            onClick={() => playRPS(c)}
                            className="aspect-square rounded-xl border border-primary/30 bg-primary/5 hover-elevate active-elevate-2 flex flex-col items-center justify-center gap-1 capitalize text-sm font-medium disabled:opacity-50"
                            data-testid={`button-rps-${c}`}
                          >
                            <span className="text-2xl">{c === "rock" ? "✊" : c === "paper" ? "✋" : "✌️"}</span>
                            {c}
                          </button>
                        ))}
                      </div>
                      {rpsChoice && <div className="text-center text-sm text-muted-foreground animate-pulse">Revealing...</div>}
                    </>
                  )}
                  {rpsResult && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`text-center py-4 rounded-xl border ${rpsResult === "win" ? "bg-emerald-500/15 border-emerald-500/40" : rpsResult === "loss" ? "bg-rose-500/15 border-rose-500/40" : "bg-amber-500/15 border-amber-500/40"}`}
                    >
                      <div className="text-3xl font-bold mb-1" data-testid="text-rps-result">
                        {rpsResult === "win" ? "Victory" : rpsResult === "loss" ? "Defeat" : "Draw"}
                      </div>
                      <div className="text-xs text-muted-foreground">Tutorial bot is going easy on you.</div>
                      <Button className="mt-3" onClick={() => { setRpsChoice(null); setRpsResult(null); advance(); }} data-testid="button-rps-continue">
                        Continue <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </motion.div>
                  )}
                </div>
              )}

              {step.custom === "reward-preview" && (
                <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
                  {[
                    { tier: "Bronze", color: "from-amber-700 to-amber-500" },
                    { tier: "Silver", color: "from-slate-400 to-slate-200" },
                    { tier: "Gold",   color: "from-yellow-500 to-amber-300" },
                    { tier: "Platinum", color: "from-cyan-400 to-teal-300" },
                    { tier: "Diamond", color: "from-sky-400 to-indigo-400" },
                    { tier: "Champion", color: "from-fuchsia-500 via-purple-500 to-pink-500" },
                  ].map(r => (
                    <div key={r.tier} className="rounded-lg border border-border/60 p-2">
                      <div className={`mx-auto w-8 h-8 rounded-full bg-gradient-to-br ${r.color} mb-1.5`} />
                      <div className="font-medium">{r.tier}</div>
                    </div>
                  ))}
                </div>
              )}

              {step.custom === "final" && (
                <div className="mt-5 p-5 rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-fuchsia-500/10 text-center" data-testid="panel-tutorial-reward">
                  <motion.div
                    initial={{ scale: 0.8, rotate: -8 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 180, damping: 12 }}
                  >
                    <Trophy className="w-10 h-10 text-amber-400 mx-auto mb-2" />
                  </motion.div>
                  <div className="font-bold text-lg">Arena Rookie Badge</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {claimedReward
                      ? "Badge added to your inventory — equip it anytime."
                      : "Claim it now to unlock the next training."}
                  </div>
                  {claimedReward && (
                    <div className="mt-3 text-xs text-emerald-400 flex items-center justify-center gap-1.5 font-medium" data-testid="text-tutorial-reward-claimed">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Reward claimed
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 p-4 border-t border-border/60 bg-muted/20">
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => skip.mutate()} data-testid="button-tutorial-skip">Skip</Button>
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="ghost" onClick={back} disabled={idx === 0} data-testid="button-step-back">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {step.custom !== "quick-game" && (
                  step.custom === "final" ? (
                    claimedReward ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { onComplete(); setLocation("/tutorial"); }}
                          data-testid="button-final-back-to-hub"
                        >
                          Back to Tutorial Hub
                        </Button>
                        {claimedReward.next && claimedReward.nextTitle ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              const nextId = claimedReward.next!;
                              if (onContinueNext) {
                                onContinueNext(nextId);
                              } else {
                                onComplete();
                                setLocation("/tutorial");
                              }
                            }}
                            data-testid="button-final-continue-next"
                          >
                            Continue to {claimedReward.nextTitle} <ArrowRight className="w-4 h-4 ml-1" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => { onComplete(); setLocation("/"); }}
                            data-testid="button-final-enter-lobby"
                          >
                            Enter Lobby <ArrowRight className="w-4 h-4 ml-1" />
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { onClose(); setLocation("/"); }} data-testid="button-final-lobby">Enter Lobby</Button>
                        <Button size="sm" onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending} data-testid="button-final-claim">
                          <CheckCircle2 className="w-4 h-4 mr-1" /> {completeMutation.isPending ? "Claiming..." : "Claim Reward"}
                        </Button>
                      </>
                    )
                  ) : (
                    <Button size="sm" onClick={advance} data-testid="button-step-next">
                      {step.cta ?? "Next"} <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  )
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-fuchsia-500"
                animate={{ width: `${((idx + 1) / STEPS.length) * 100}%` }}
                transition={{ type: "spring", stiffness: 80, damping: 18 }}
              />
            </div>
            <TrainingCoach />
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
