import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Target, Brain, Crown, Award, Zap, Trophy, Lightbulb } from "lucide-react";
import { TutorialShell, prettyTutorialTitle, TutorialShellStep } from "./TutorialShell";
import { useIsMobile } from "@/hooks/use-mobile";
import { RenderDrill, getTierDrill, type DrillResult } from "./TierDrills";
import { GhostDemo, type GhostStep } from "./GhostDemo";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  GAME_TRAINING_PATHS,
  TIER_LABEL,
  tierTutorialId,
  type TierLesson,
  type TrainingTier,
} from "@shared/gameTrainingPaths";

interface GameTierTutorialProps {
  slug: string;
  tier: TrainingTier;
  startStep?: number;
  onClose: () => void;
  onComplete: () => void;
  onContinueNext?: (nextId: string) => void;
}

const TIER_INTRO_ICON: Record<TrainingTier, React.ComponentType<{ className?: string }>> = {
  beginner: Sparkles,
  intermediate: Target,
  advanced: Brain,
  master: Crown,
};

const TIER_REWARD_NAME: Record<TrainingTier, string> = {
  beginner: "Rookie",
  intermediate: "Adept",
  advanced: "Expert",
  master: "Master",
};

/**
 * Generic component that renders any (game, tier) pair using TutorialShell.
 *
 * Pulls all content (lessons, hints, summary, blurb, pretty title) from the
 * canonical config in `shared/gameTrainingPaths.ts`. Master-tier tutorials
 * automatically include the interactive ReactionDrill as a blocking step.
 */
export function GameTierTutorial({
  slug,
  tier,
  startStep = 0,
  onClose,
  onComplete,
  onContinueNext,
}: GameTierTutorialProps) {
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const scoreMutation = useMutation({
    mutationFn: async (vars: { tutorialId: string; result: DrillResult }) =>
      apiRequest("POST", "/api/tutorial/drill-score", {
        tutorialId: vars.tutorialId,
        drillKind: vars.result.drillKind,
        metric: vars.result.metric,
        higherIsBetter: vars.result.higherIsBetter,
        score: vars.result.score,
      }),
    onSuccess: async (res, vars) => {
      const data = await res.json().catch(() => ({} as any));
      if (data?.isNewBest) {
        toast({
          title: "New personal best!",
          description: `${vars.result.score} ${vars.result.metric}`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/status"] });
    },
  });

  const { steps, tutorialId, rewardName, blurb, gameTitle } = useMemo(() => {
    const game = GAME_TRAINING_PATHS.find(p => p.slug === slug);
    if (!game) {
      return {
        steps: [] as TutorialShellStep[],
        tutorialId: tierTutorialId(slug, tier),
        rewardName: TIER_REWARD_NAME[tier],
        blurb: "",
        gameTitle: slug,
      };
    }
    const content = game.tiers[tier];
    const id = tierTutorialId(slug, tier);
    const TierIcon = TIER_INTRO_ICON[tier];

    const introStep: TutorialShellStep = {
      id: "intro",
      title: `${game.title} — ${TIER_LABEL[tier]}`,
      body: `${game.blurb} This tier focuses on the skills that separate ${TIER_LABEL[tier].toLowerCase()} play from the rest.`,
      icon: TierIcon,
      cta: "Begin",
    };

    const lessonSteps: TutorialShellStep[] = content.lessons.map((lesson, i) => ({
      id: `lesson-${i + 1}`,
      title: lesson.title,
      body: lesson.body,
      icon: i % 2 === 0 ? Target : Zap,
      hint: lesson.hint,
    }));

    const demoLesson: TierLesson = content.lessons[0] ?? {
      title: `${TIER_LABEL[tier]} basics`,
      body: content.summary,
    };
    const ghostStep: TutorialShellStep = {
      id: "ghost-demo",
      title: `Canonical play: ${demoLesson.title}`,
      body: `Watch the correct move for this tier before you try it.`,
      icon: Lightbulb,
      render: () => (
        <TierGhostDemo
          gameTitle={game.title}
          tier={tier}
          lesson={demoLesson}
          summary={content.summary}
        />
      ),
    };

    const drill = getTierDrill(slug, tier);
    const drillStep: TutorialShellStep | null = drill
      ? {
          id: "drill",
          title: drill.title,
          body: drill.body,
          icon: tier === "master" ? Crown : tier === "advanced" ? Brain : Target,
          blocking: true,
          render: ({ advance }) => (
            <RenderDrill
              spec={drill.spec}
              onPass={(result) => {
                if (result) scoreMutation.mutate({ tutorialId: id, result });
                advance();
              }}
            />
          ),
        }
      : null;

    const finalStep: TutorialShellStep = {
      id: "complete",
      title: `${game.title} ${TIER_LABEL[tier]} — Cleared`,
      body: content.summary,
      icon: tier === "master" ? Trophy : Award,
    };

    const allSteps = [
      introStep,
      ghostStep,
      ...lessonSteps,
      ...(drillStep ? [drillStep] : []),
      finalStep,
    ];

    return {
      steps: allSteps,
      tutorialId: id,
      rewardName: `${game.title} ${TIER_REWARD_NAME[tier]}`,
      blurb: game.blurb,
      gameTitle: game.title,
    };
  }, [slug, tier]);

  if (steps.length === 0) {
    return null;
  }

  return (
    <TutorialShell
      tutorialId={tutorialId}
      steps={steps}
      rewardName={rewardName}
      rewardBlurb={`Claim it to unlock the next training in your ladder.`}
      startStep={startStep}
      isMobile={isMobile}
      onClose={onClose}
      onComplete={onComplete}
      onContinueNext={onContinueNext}
      prettyTitle={prettyTutorialTitle}
    />
  );
}

interface TierGhostDemoProps {
  gameTitle: string;
  tier: TrainingTier;
  lesson: TierLesson;
  summary: string;
}

/**
 * Canonical-move ghost demo shown inside every (game, tier) tutorial.
 *
 * Data-driven: pulls captions from the tier's first lesson + summary so each
 * of the 13 games × 4 tiers gets its own walkthrough without hand-authoring 52
 * unique demos. The visual surface is intentionally schematic — the goal is to
 * narrate the correct move, not re-implement each game's engine inside a tip.
 */
function TierGhostDemo({ gameTitle, tier, lesson, summary }: TierGhostDemoProps) {
  const [phase, setPhase] = useState<"setup" | "execute" | "result">("setup");
  const steps: GhostStep<"setup" | "execute" | "result">[] = [
    {
      at: 200,
      caption: `Read the board: ${lesson.body}`,
      action: "setup",
    },
    {
      at: 2200,
      caption: lesson.hint ?? `Apply it: this is the move that wins this tier.`,
      action: "execute",
    },
    {
      at: 4200,
      caption: `Result: ${summary}`,
      action: "result",
    },
  ];

  const phaseColor =
    phase === "setup"
      ? "border-primary/40 bg-primary/10"
      : phase === "execute"
      ? "border-fuchsia-400/50 bg-fuchsia-500/15"
      : "border-emerald-400/50 bg-emerald-500/15";

  return (
    <GhostDemo
      steps={steps}
      title={`${gameTitle} — ${TIER_LABEL[tier]} demo`}
      description={`A canonical correct move for ${TIER_LABEL[tier].toLowerCase()} play.`}
      onStep={(s) => s.action && setPhase(s.action)}
      onFinish={() => setPhase("setup")}
    >
      <div
        className={`relative h-32 rounded-md border ${phaseColor} flex items-center justify-center overflow-hidden transition-colors duration-300`}
        data-testid="ghost-tier-surface"
      >
        <div className="text-center px-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
            {phase === "setup" && "Read"}
            {phase === "execute" && "Execute"}
            {phase === "result" && "Result"}
          </div>
          <div className="text-sm font-semibold" data-testid="text-ghost-lesson-title">
            {lesson.title}
          </div>
        </div>
      </div>
    </GhostDemo>
  );
}
