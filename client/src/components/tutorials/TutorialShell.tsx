import { useState, useEffect, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, ChevronLeft, ChevronRight, X, CheckCircle2, Trophy } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { TrainingResultsScreen } from "./TrainingResultsScreen";
import { getRewardMeta } from "./trainingRewards";
import { CoachProvider, TrainingCoach, useEmitCoachEvent } from "./TrainingCoach";
import { flattenGameTiers, TIER_LABEL } from "@shared/gameTrainingPaths";

export interface TutorialShellStep {
  id: string;
  title: string;
  body: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  cta?: string;
  /** If true, the shell hides its own "Next" button. The custom content is
   * responsible for advancing via the `advance` callback. */
  blocking?: boolean;
  /** Optional renderer for in-step custom content (mini interactions, previews). */
  render?: (api: { advance: () => void; isMobile: boolean }) => ReactNode;
}

export interface TutorialShellProps {
  tutorialId: string;
  steps: TutorialShellStep[];
  rewardName: string;
  rewardBlurb?: string;
  startStep?: number;
  isMobile?: boolean;
  onClose: () => void;
  onComplete: () => void;
  /** If provided, used to launch the next tutorial directly from the reward screen. */
  onContinueNext?: (nextId: string) => void;
  /** Title lookup so the "Continue to {Title}" button can render properly. */
  prettyTitle: (id: string) => string;
}

export function TutorialShell({
  tutorialId,
  steps,
  rewardName,
  rewardBlurb,
  startStep = 0,
  isMobile = false,
  onClose,
  onComplete,
  onContinueNext,
  prettyTitle,
}: TutorialShellProps) {
  const totalSteps = steps.length;
  const [idx, setIdx] = useState(() => Math.max(0, Math.min(startStep, totalSteps - 1)));
  const [claimed, setClaimed] = useState<null | {
    next: string | null;
    xp: number;
    coins: number;
    masterGranted: boolean;
    masterXp: number;
    masterCoins: number;
  }>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const isFinal = idx === totalSteps - 1;
  const step = steps[idx];
  const Icon = step.icon;

  const saveProgress = useMutation({
    mutationFn: async (vars: { currentStep: number }) =>
      apiRequest("POST", "/api/tutorial/progress", { tutorialId, currentStep: vars.currentStep, totalSteps }),
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/tutorial/progress", { tutorialId, currentStep: totalSteps, totalSteps });
      return apiRequest("POST", "/api/tutorial/complete", { tutorialId });
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
      const xp = Number(data?.grantedXp ?? 0);
      const coins = Number(data?.grantedCoins ?? 0);
      const masterGranted = !!data?.masterGranted;
      const masterXp = Number(data?.masterGrantedXp ?? 0);
      const masterCoins = Number(data?.masterGrantedCoins ?? 0);
      if (data?.granted) {
        const bits: string[] = [];
        if (xp > 0) bits.push(`+${xp} XP`);
        if (coins > 0) bits.push(`+${coins} coins`);
        bits.push("badge added to inventory");
        toast({ title: `${rewardName} unlocked`, description: bits.join(" • ") });
      } else if (data?.reason === "already_completed") {
        toast({ title: "Tutorial replayed", description: "Rewards were already paid out." });
      } else {
        toast({ title: "Tutorial complete" });
      }
      if (masterGranted) {
        toast({
          title: "Training Master unlocked",
          description: `Every training complete — +${masterXp} XP, +${masterCoins} coins, Mythic badge + profile border.`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      const next: string | null = data?.status?.current ?? null;
      const resolvedNext = next && next !== tutorialId ? next : null;
      setClaimed({ next: resolvedNext, xp, coins, masterGranted, masterXp, masterCoins });
    },
  });

  const skip = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/tutorial/skip", { tutorialId }),
    onSuccess: () => {
      toast({ title: "Tutorial skipped", description: "You can replay it anytime from the Training Hub." });
      onClose();
    },
  });

  useEffect(() => {
    // Save the user's furthest reached step (1-based for human readability;
    // server clamps to <= totalSteps). On final step we record full count so
    // the user can claim reward without losing progress on a refresh.
    saveProgress.mutate({ currentStep: Math.min(idx + 1, totalSteps) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const advance = useCallback(() => {
    setIdx((i) => Math.min(i + 1, totalSteps - 1));
  }, [totalSteps]);
  const back = () => setIdx((i) => Math.max(0, i - 1));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") back();
      if (e.key === "ArrowRight" && !step.blocking && !isFinal) advance();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step.blocking, isFinal, onClose, advance]);

  return (
    <CoachProvider>
      <CoachStepNarrator stepId={step.id} isFirst={idx === 0} isFinal={isFinal} />
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        data-testid={`tutorial-${tutorialId}`}
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
          <Card className="relative overflow-hidden border-primary/40 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="absolute -inset-1 bg-gradient-to-br from-primary/20 via-transparent to-cyan-500/10 blur-2xl -z-10" />

            <div className="flex items-center justify-between p-4 border-b border-border/60 sticky top-0 bg-card/95 backdrop-blur z-10">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary font-semibold">
                <Sparkles className="w-3.5 h-3.5" /> Jango Training
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground" data-testid="text-step-count">Step {idx + 1} / {totalSteps}</span>
                <button onClick={onClose} className="text-muted-foreground p-1 rounded-md hover-elevate active-elevate-2" data-testid="button-tutorial-close" aria-label="Close training">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 md:p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-primary/5 border border-primary/40 flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
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

              {step.render && (
                <div className="mt-5">{step.render({ advance, isMobile })}</div>
              )}

              {isFinal && !claimed && (
                <div className="mt-5 p-5 rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-fuchsia-500/10 text-center" data-testid="panel-tutorial-reward">
                  <motion.div
                    initial={{ scale: 0.8, rotate: -8 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 180, damping: 12 }}
                  >
                    <Trophy className="w-10 h-10 text-amber-400 mx-auto mb-2" />
                  </motion.div>
                  <div className="font-bold text-lg">{rewardName} Badge</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {rewardBlurb ?? "Claim it now to unlock the next training."}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 p-4 border-t border-border/60 bg-muted/20 sticky bottom-0 backdrop-blur z-10">
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => skip.mutate()} data-testid="button-tutorial-skip">Skip</Button>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                <Button size="sm" variant="ghost" onClick={back} disabled={idx === 0} data-testid="button-step-back">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {isFinal ? (
                  !claimed && (
                    <Button size="sm" onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending} data-testid="button-final-claim">
                      <CheckCircle2 className="w-4 h-4 mr-1" /> {completeMutation.isPending ? "Claiming..." : "Claim Reward"}
                    </Button>
                  )
                ) : (
                  !step.blocking && (
                    <Button size="sm" onClick={advance} data-testid="button-step-next">
                      {step.cta ?? "Next"} <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  )
                )}
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-fuchsia-500"
                animate={{ width: `${((idx + 1) / totalSteps) * 100}%` }}
                transition={{ type: "spring", stiffness: 80, damping: 18 }}
              />
            </div>
            <TrainingCoach />
          </Card>
        </motion.div>
      </motion.div>

      {claimed && (() => {
        const meta = getRewardMeta(tutorialId);
        return (
          <TrainingResultsScreen
            key="results"
            rewardName={`${rewardName} Badge`}
            rarity={meta.rarity}
            xpEarned={claimed.xp}
            coinsEarned={claimed.coins}
            stars={meta.stars}
            masterGranted={claimed.masterGranted}
            masterXp={claimed.masterXp}
            masterCoins={claimed.masterCoins}
            nextTutorialId={claimed.next}
            nextTutorialTitle={claimed.next ? prettyTitle(claimed.next) : null}
            onContinueNext={
              claimed.next
                ? () => {
                    const nextId = claimed.next!;
                    if (onContinueNext) onContinueNext(nextId);
                    else { onComplete(); setLocation("/tutorial"); }
                  }
                : undefined
            }
            onBackToHub={() => { onComplete(); setLocation("/tutorial"); }}
            onEnterLobby={() => { onComplete(); setLocation("/"); }}
          />
        );
      })()}
    </AnimatePresence>
    </CoachProvider>
  );
}

/** Emits an intro line on mount and a contextual nudge whenever the step changes. */
function CoachStepNarrator({ stepId, isFirst, isFinal }: { stepId: string; isFirst: boolean; isFinal: boolean }) {
  const emit = useEmitCoachEvent();
  useEffect(() => {
    if (isFirst) {
      emit({ type: "intro" });
    } else if (isFinal) {
      emit({ type: "success", context: { message: "You made it — claim that badge." } });
    } else {
      emit({ type: "idle", context: { message: "Next step — I'm right here if you need a tip." } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId]);
  return null;
}

const TIER_PRETTY: Record<string, string> = Object.fromEntries(
  flattenGameTiers().map(t => [t.id, `${t.gameTitle}: ${TIER_LABEL[t.tier]}`]),
);

export const PRETTY_TUTORIAL_TITLES: Record<string, string> = {
  "platform-basics": "Jango Basics",
  ...TIER_PRETTY,
};

export const prettyTutorialTitle = (id: string) => PRETTY_TUTORIAL_TITLES[id] ?? id;
