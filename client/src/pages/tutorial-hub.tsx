import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import {
  Sparkles, CheckCircle2, PlayCircle, RotateCcw, Lock, Clock3, Trophy,
  Gamepad2, GraduationCap, Hourglass, Zap, Crown, ChevronDown, Award,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppNavbar } from "@/components/AppNavbar";
import { PlatformBasicsTutorial } from "@/components/tutorials/PlatformBasicsTutorial";
import { RockPaperScissorsTutorial } from "@/components/tutorials/RockPaperScissorsTutorial";
import { Connect4Tutorial } from "@/components/tutorials/Connect4Tutorial";
import { GameTierTutorial } from "@/components/tutorials/GameTierTutorial";
import { CANONICAL_TUTORIAL_ORDER, ACTIVE_TUTORIAL_IDS } from "@shared/tutorialOrder";
import {
  GAME_TRAINING_PATHS, TIER_ORDER, TIER_LABEL, TIER_ESTIMATE,
  tierTutorialId, type TrainingTier,
} from "@shared/gameTrainingPaths";
import type { TutorialProgressRow, DrillScoreRow } from "@shared/schema";
import { getRewardMeta, getRarityStyle, TRAINING_MASTER_ID, type Rarity } from "@/components/tutorials/trainingRewards";

interface TutorialMeta {
  id: string;
  title: string;
  blurb: string;
  group: "platform" | "game";
  difficulty: string;
  estMinutes: string;
  rewardLabel: string;
  /** For game tutorials: which game and tier this card belongs to. */
  gameSlug?: string;
  tier?: TrainingTier;
}

const PLATFORM_BASICS_META: TutorialMeta = {
  id: "platform-basics",
  title: "Jango Basics",
  blurb: "Welcome, Scalps, matches, ranks — the 2-minute crash course.",
  group: "platform",
  difficulty: "Beginner",
  estMinutes: "2–3 min",
  rewardLabel: "Arena Rookie badge",
};

/** Derived card metadata for every tier of every game. */
const TIER_META: Record<string, TutorialMeta> = (() => {
  const out: Record<string, TutorialMeta> = {};
  for (const game of GAME_TRAINING_PATHS) {
    for (const tier of TIER_ORDER) {
      const id = tierTutorialId(game.slug, tier);
      out[id] = {
        id,
        title: `${TIER_LABEL[tier]}`,
        blurb: game.tiers[tier].lessons[0]?.body.slice(0, 110) ?? game.blurb,
        group: "game",
        difficulty: TIER_LABEL[tier],
        estMinutes: TIER_ESTIMATE[tier],
        rewardLabel: `${game.title} ${TIER_LABEL[tier] === "Beginner" ? "Rookie" : TIER_LABEL[tier] === "Intermediate" ? "Adept" : TIER_LABEL[tier] === "Advanced" ? "Expert" : "Master"} badge`,
        gameSlug: game.slug,
        tier,
      };
    }
  }
  return out;
})();

interface TutorialStatus {
  canonicalOrder: string[];
  active: string[];
  completed: string[];
  unlocked: string[];
  current: string | null;
  progress: TutorialProgressRow[];
  drillScores?: DrillScoreRow[];
}

type CardState = "completed" | "current" | "locked" | "coming-soon";

export default function TutorialHubPage() {
  const { toast } = useToast();
  const [activeTutorial, setActiveTutorial] = useState<string | null>(null);
  const [expandedGames, setExpandedGames] = useState<Set<string>>(() => new Set());
  const reduceMotion = useReducedMotion();

  const { data: status } = useQuery<TutorialStatus>({
    queryKey: ["/api/tutorial/status"],
  });

  const activeSet = useMemo(() => new Set(status?.active ?? []), [status?.active]);
  const completedSet = useMemo(() => new Set(status?.completed ?? []), [status?.completed]);
  const unlockedSet = useMemo(() => new Set(status?.unlocked ?? []), [status?.unlocked]);
  const current = status?.current ?? null;

  const progressMap = useMemo(() => {
    const m = new Map<string, TutorialProgressRow>();
    for (const p of status?.progress ?? []) m.set(p.tutorialId, p);
    return m;
  }, [status?.progress]);

  const drillScoreMap = useMemo(() => {
    const m = new Map<string, DrillScoreRow>();
    for (const d of status?.drillScores ?? []) m.set(d.tutorialId, d);
    return m;
  }, [status?.drillScores]);

  const totalActive = useMemo(
    () => CANONICAL_TUTORIAL_ORDER.filter(id => ACTIVE_TUTORIAL_IDS.has(id)).length,
    [],
  );
  const completedActiveCount = useMemo(
    () => CANONICAL_TUTORIAL_ORDER.filter(id => ACTIVE_TUTORIAL_IDS.has(id) && completedSet.has(id)).length,
    [completedSet],
  );
  const totalCount = CANONICAL_TUTORIAL_ORDER.length;
  const totalXpEarned = useMemo(
    () => CANONICAL_TUTORIAL_ORDER
      .filter(id => completedSet.has(id))
      .reduce((sum, id) => sum + getRewardMeta(id).xp, 0),
    [completedSet],
  );
  const isTrainingMaster = completedActiveCount === totalActive && totalActive > 0;

  const resetMutation = useMutation({
    mutationFn: async (tutorialId: string) => apiRequest("POST", "/api/tutorial/reset", { tutorialId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/progress"] });
      toast({ title: "Reset", description: "Tutorial progress cleared." });
    },
  });

  const cardState = (id: string): CardState => {
    if (!activeSet.has(id)) return "coming-soon";
    if (completedSet.has(id)) return "completed";
    if (id === current) return "current";
    if (unlockedSet.has(id)) return "current";
    return "locked";
  };

  const handleStart = (t: TutorialMeta, state: CardState) => {
    if (state === "coming-soon") {
      toast({
        title: "Coming soon",
        description: `${t.title} training is on the way. For now, complete the trainings before it.`,
      });
      return;
    }
    if (state === "locked") {
      toast({
        title: "Locked",
        description: "Complete the previous training first.",
        variant: "destructive",
      });
      return;
    }
    setActiveTutorial(t.id);
  };

  const renderCard = (t: TutorialMeta) => {
    const state = cardState(t.id);
    const p = progressMap.get(t.id);
    const isComplete = state === "completed";
    const isCurrent = state === "current";
    const isLocked = state === "locked";
    const isComing = state === "coming-soon";
    const isInProgress = p?.status === "in_progress" && (p?.currentStep ?? 0) > 0;
    const progressPct = p && p.totalSteps > 0 ? Math.min(100, Math.round((p.currentStep / p.totalSteps) * 100)) : 0;

    const meta = getRewardMeta(t.id);
    const rs = getRarityStyle(meta.rarity);
    const RarityIcon = rs.icon;
    const isDimmed = isLocked || isComing;

    const cardGlow = isComplete
      ? `ring-1 ring-emerald-500/40 ${rs.glowClass}`
      : isCurrent
        ? `${rs.ringClass} ${rs.glowClass}`
        : isLocked
          ? "opacity-70 ring-1 ring-border/40"
          : "opacity-60 ring-1 ring-border/40";

    return (
      <Card
        key={t.id}
        className={`relative overflow-hidden hover-elevate transition-shadow ${cardGlow}`}
        data-testid={`card-tutorial-${t.id}`}
      >
        {!isDimmed && (
          <div className={`absolute inset-0 bg-gradient-to-br ${rs.gradientFrom} ${rs.gradientTo} pointer-events-none`} />
        )}

        {isCurrent && !isComplete && (
          <div className="absolute top-3 right-3 z-10">
            <Badge className="bg-primary/90 text-primary-foreground border-0">Up Next</Badge>
          </div>
        )}
        {isComplete && (
          <div className="absolute top-3 right-3 z-10">
            <Badge className="bg-emerald-500/90 text-white border-0 gap-1"><CheckCircle2 className="w-3 h-3" /> Done</Badge>
          </div>
        )}
        {isComing && (
          <div className="absolute top-3 right-3 z-10">
            <Badge variant="outline" className="gap-1 border-border/60 text-muted-foreground"><Hourglass className="w-3 h-3" /> Coming Soon</Badge>
          </div>
        )}

        <CardContent className="relative p-5 space-y-3 min-h-[44px]">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center border ${isDimmed ? "bg-muted/40 border-border/60" : "bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30"}`}>
              {isLocked ? (
                <Lock className="w-5 h-5 text-muted-foreground" />
              ) : t.group === "platform" ? (
                <GraduationCap className={`w-5 h-5 ${isComing ? "text-muted-foreground" : "text-primary"}`} />
              ) : (
                <Gamepad2 className={`w-5 h-5 ${isComing ? "text-muted-foreground" : "text-primary"}`} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate" data-testid={`text-tutorial-name-${t.id}`}>{t.title}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span>{t.difficulty}</span>
                <span>·</span>
                <span className="flex items-center gap-1"><Clock3 className="w-3 h-3" /> {t.estMinutes}</span>
              </div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground line-clamp-2">{t.blurb}</div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`gap-1 ${rs.badgeBgClass} ${rs.badgeTextClass} border-0`} data-testid={`badge-rarity-${t.id}`}>
              <RarityIcon className="w-3 h-3" />
              {rs.label}
            </Badge>
            <Badge variant="outline" className="gap-1 border-amber-400/30 text-amber-300 bg-amber-500/10">
              <Zap className="w-3 h-3" /> +{meta.xp} XP
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-muted-foreground">Reward:</span>
            <span className="font-medium truncate">{t.rewardLabel}</span>
          </div>

          {(() => {
            const pb = drillScoreMap.get(t.id);
            if (!pb) return null;
            return (
              <div
                className="flex items-center gap-2 text-xs"
                data-testid={`text-pb-${t.id}`}
              >
                <Award className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-muted-foreground">PB:</span>
                <span className="font-medium">
                  {pb.bestScore} {pb.metric}
                </span>
              </div>
            );
          })()}

          {isInProgress && !isComplete && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-1.5" />
            </div>
          )}
          {isLocked && (
            <div className="text-xs text-muted-foreground italic" data-testid={`text-tutorial-locked-hint-${t.id}`}>
              Complete previous training first.
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            {isComplete ? (
              <Button
                onClick={() => handleStart(t, state)}
                size="sm"
                variant="outline"
                className="flex-1"
                data-testid={`button-replay-tutorial-${t.id}`}
              >
                <RotateCcw className="w-4 h-4 mr-1.5" /> Replay
              </Button>
            ) : isCurrent ? (
              <Button
                onClick={() => handleStart(t, state)}
                size="sm"
                className="flex-1 animate-pulse"
                data-testid={`button-start-tutorial-${t.id}`}
              >
                <PlayCircle className="w-4 h-4 mr-1.5" />
                {isInProgress ? "Continue Training" : "Start Training"}
              </Button>
            ) : isLocked ? (
              <Button size="sm" variant="outline" className="flex-1" disabled data-testid={`button-tutorial-locked-${t.id}`}>
                <Lock className="w-4 h-4 mr-1.5" /> Locked
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="flex-1" disabled data-testid={`button-tutorial-coming-soon-${t.id}`}>
                <Hourglass className="w-4 h-4 mr-1.5" /> Coming Soon
              </Button>
            )}
            {isComplete && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => resetMutation.mutate(t.id)}
                title="Reset progress"
                data-testid={`button-reset-tutorial-${t.id}`}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const toggleGame = (slug: string) => {
    setExpandedGames(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  };

  // Auto-expand the game group that contains the user's current training.
  const autoExpandedSlug = useMemo(() => {
    if (!current) return null;
    return TIER_META[current]?.gameSlug ?? null;
  }, [current]);

  const isGameExpanded = (slug: string) =>
    expandedGames.has(slug) || slug === autoExpandedSlug;

  const platformDone = completedSet.has("platform-basics") ? 1 : 0;
  const platformBuilt = 1;
  const gameTutorialIds = useMemo(
    () => CANONICAL_TUTORIAL_ORDER.filter(id => id !== "platform-basics"),
    [],
  );
  const gameDone = gameTutorialIds.filter(id => completedSet.has(id)).length;
  const gameBuilt = gameTutorialIds.filter(id => activeSet.has(id)).length;

  const masterRarity: Rarity = "mythic";
  const masterStyle = getRarityStyle(masterRarity);
  const masterMeta = getRewardMeta(TRAINING_MASTER_ID);

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <AppNavbar />

      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
        <motion.div
          aria-hidden
          className="absolute -inset-32 opacity-40 pointer-events-none"
          style={{ background: "radial-gradient(circle at 30% 30%, rgba(139,92,246,0.30), transparent 55%)" }}
          animate={reduceMotion ? undefined : { x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden
          className="absolute -inset-32 opacity-30 pointer-events-none"
          style={{ background: "radial-gradient(circle at 70% 70%, rgba(56,189,248,0.25), transparent 55%)" }}
          animate={reduceMotion ? undefined : { x: [0, -30, 20, 0], y: [0, 20, -30, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-14">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">
            <Sparkles className="w-4 h-4" />
            Training Arena
          </div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-5xl font-bold mb-3"
            data-testid="text-hub-title"
          >
            Learn Jango. Then own it.
          </motion.h1>
          <p className="text-muted-foreground max-w-xl text-base md:text-lg">
            Beginner → Master training ladders for every game. Climb each ladder to unlock rarer rewards.
          </p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
            <div className="p-3 rounded-lg bg-card/60 backdrop-blur border border-border/60">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Trainings</div>
              <div className="text-2xl font-bold tabular-nums" data-testid="text-hub-progress">
                {completedActiveCount} <span className="text-muted-foreground text-base font-normal">/ {totalActive}</span>
              </div>
              <Progress value={totalActive ? (completedActiveCount / totalActive) * 100 : 0} className="h-1.5 mt-2" />
            </div>
            <div className="p-3 rounded-lg bg-card/60 backdrop-blur border border-amber-400/30">
              <div className="text-xs uppercase tracking-wider text-amber-300 mb-1 flex items-center gap-1.5">
                <Zap className="w-3 h-3" /> XP Earned
              </div>
              <div className="text-2xl font-bold tabular-nums text-amber-200" data-testid="text-hub-xp">
                {totalXpEarned.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-2">From {completedSet.size} mission{completedSet.size === 1 ? "" : "s"}</div>
            </div>
            <div className="p-3 rounded-lg bg-card/60 backdrop-blur border border-border/60">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Roadmap</div>
              <div className="text-2xl font-bold tabular-nums">
                {totalCount} <span className="text-muted-foreground text-base font-normal">missions</span>
              </div>
              <div className="text-xs text-muted-foreground mt-2">{GAME_TRAINING_PATHS.length} games · 4 tiers each</div>
            </div>
          </div>
        </div>
      </div>

      {/* Platform tutorials */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" /> Platform Basics
          </h2>
          <span className="text-xs text-muted-foreground" data-testid="text-section-progress-platform">
            {platformDone} / {platformBuilt} complete
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {renderCard(PLATFORM_BASICS_META)}
        </div>
      </div>

      {/* Game training ladders — collapsible per game */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 pb-8">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-primary" /> Game Training Ladders
          </h2>
          <span className="text-xs text-muted-foreground" data-testid="text-section-progress-games">
            {gameDone} / {gameBuilt} complete
          </span>
        </div>

        <div className="space-y-3">
          {GAME_TRAINING_PATHS.map((game) => {
            const tierIds = TIER_ORDER.map(t => tierTutorialId(game.slug, t));
            const tiers = tierIds.map(id => TIER_META[id]).filter(Boolean);
            const completed = tierIds.filter(id => completedSet.has(id)).length;
            const inProgress = tierIds.some(id => {
              const p = progressMap.get(id);
              return p?.status === "in_progress" && (p?.currentStep ?? 0) > 0;
            });
            const expanded = isGameExpanded(game.slug);
            const isMasteredGame = completed === TIER_ORDER.length;
            const containsCurrent = current ? tierIds.includes(current) : false;

            return (
              <Card key={game.slug} className="relative overflow-hidden" data-testid={`card-game-${game.slug}`}>
                <button
                  type="button"
                  onClick={() => toggleGame(game.slug)}
                  className="w-full text-left p-4 md:p-5 flex items-center gap-3 hover-elevate"
                  data-testid={`button-toggle-game-${game.slug}`}
                  aria-expanded={expanded}
                >
                  <div className={`w-11 h-11 rounded-lg flex items-center justify-center border ${isMasteredGame ? "bg-amber-500/15 border-amber-400/50" : "bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30"}`}>
                    {isMasteredGame ? (
                      <Crown className="w-5 h-5 text-amber-300" />
                    ) : (
                      <Gamepad2 className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold truncate" data-testid={`text-game-title-${game.slug}`}>
                        {game.title}
                      </div>
                      {containsCurrent && (
                        <Badge className="bg-primary/90 text-primary-foreground border-0 text-xs">Up Next</Badge>
                      )}
                      {isMasteredGame && (
                        <Badge className="bg-amber-500/20 text-amber-200 border border-amber-400/40 gap-1 text-xs">
                          <Crown className="w-3 h-3" /> Mastered
                        </Badge>
                      )}
                      {inProgress && !isMasteredGame && (
                        <Badge variant="outline" className="text-xs">In Progress</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{game.blurb}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden sm:flex items-center gap-1.5">
                      {TIER_ORDER.map((tier) => {
                        const id = tierTutorialId(game.slug, tier);
                        const done = completedSet.has(id);
                        const isCur = current === id;
                        return (
                          <span
                            key={tier}
                            className={`h-1.5 w-6 rounded-full ${done ? "bg-emerald-400" : isCur ? "bg-primary animate-pulse" : "bg-muted"}`}
                            title={`${TIER_LABEL[tier]}${done ? " — done" : isCur ? " — current" : ""}`}
                            data-testid={`pip-${game.slug}-${tier}`}
                          />
                        );
                      })}
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {completed}/{TIER_ORDER.length}
                    </span>
                    <motion.div
                      animate={{ rotate: expanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    </motion.div>
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 md:px-5 pb-4 md:pb-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 border-t border-border/40 pt-4">
                        {tiers.map(renderCard)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Training Master capstone */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 pb-12">
        <Card
          className={`relative overflow-hidden ${masterStyle.ringClass} ${isTrainingMaster ? masterStyle.glowClass : "opacity-80"}`}
          data-testid="card-training-master"
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${masterStyle.gradientFrom} ${masterStyle.gradientTo} pointer-events-none`} />
          {isTrainingMaster && (
            <motion.div
              aria-hidden
              className="absolute -inset-12 pointer-events-none opacity-50"
              style={{ background: "conic-gradient(from 0deg, rgba(217,70,239,0.25), rgba(34,211,238,0.2), rgba(251,191,36,0.25), rgba(217,70,239,0.25))" }}
              animate={reduceMotion ? undefined : { rotate: 360 }}
              transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
            />
          )}
          <CardContent className="relative p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-5">
            <div className="shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400/30 via-fuchsia-500/20 to-cyan-400/20 border border-fuchsia-400/40 flex items-center justify-center">
              <Crown className="w-8 h-8 text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]" />
            </div>
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-1.5 flex-wrap">
                <Badge className={`${masterStyle.badgeBgClass} ${masterStyle.badgeTextClass} border-0 gap-1`}>
                  <Trophy className="w-3 h-3" /> Mythic
                </Badge>
                <Badge variant="outline" className="gap-1 border-amber-400/30 text-amber-300 bg-amber-500/10">
                  <Zap className="w-3 h-3" /> +{masterMeta.xp.toLocaleString()} XP
                </Badge>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold">Training Master</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {isTrainingMaster
                  ? "You completed every training. Your exclusive animated badge and profile border are unlocked."
                  : `Master every game's full ladder to unlock an exclusive animated badge, profile border, and ${masterMeta.xp.toLocaleString()} XP.`}
              </p>
              <div className="mt-3">
                <Progress value={totalActive ? (completedActiveCount / totalActive) * 100 : 0} className="h-2" />
                <div className="text-xs text-muted-foreground mt-1 tabular-nums">
                  {completedActiveCount} / {totalActive} trainings complete
                </div>
              </div>
            </div>
            <div className="shrink-0">
              {isTrainingMaster ? (
                <Badge className="bg-emerald-500/90 text-white border-0 gap-1 text-sm py-1.5 px-3" data-testid="badge-training-master-unlocked">
                  <CheckCircle2 className="w-4 h-4" /> Unlocked
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-sm py-1.5 px-3" data-testid="badge-training-master-locked">
                  <Lock className="w-4 h-4" /> Locked
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {activeTutorial && (() => {
        const p = progressMap.get(activeTutorial);
        const resumeStep = p && p.status === "in_progress" ? Math.min(p.currentStep, Math.max(0, p.totalSteps - 1)) : 0;
        const handleClose = () => setActiveTutorial(null);
        const handleComplete = () => {
          setActiveTutorial(null);
          queryClient.invalidateQueries({ queryKey: ["/api/tutorial/status"] });
          queryClient.invalidateQueries({ queryKey: ["/api/tutorial/progress"] });
          queryClient.invalidateQueries({ queryKey: ["/api/shop/inventory"] });
        };
        const handleContinueNext = (nextId: string) => {
          queryClient.invalidateQueries({ queryKey: ["/api/tutorial/status"] });
          queryClient.invalidateQueries({ queryKey: ["/api/tutorial/progress"] });
          queryClient.invalidateQueries({ queryKey: ["/api/shop/inventory"] });
          setActiveTutorial(nextId);
        };

        if (activeTutorial === "platform-basics") {
          return (
            <PlatformBasicsTutorial
              startStep={resumeStep}
              onClose={handleClose}
              onComplete={handleComplete}
              onContinueNext={handleContinueNext}
            />
          );
        }
        // Bespoke beginner-tier components keep their richer interactive content.
        if (activeTutorial === "game-rock-paper-scissors") {
          return (
            <RockPaperScissorsTutorial
              startStep={resumeStep}
              onClose={handleClose}
              onComplete={handleComplete}
              onContinueNext={handleContinueNext}
            />
          );
        }
        if (activeTutorial === "game-connect-4") {
          return (
            <Connect4Tutorial
              startStep={resumeStep}
              onClose={handleClose}
              onComplete={handleComplete}
              onContinueNext={handleContinueNext}
            />
          );
        }
        // All other tier IDs route to the generic GameTierTutorial.
        const meta = TIER_META[activeTutorial];
        if (meta?.gameSlug && meta.tier) {
          return (
            <GameTierTutorial
              slug={meta.gameSlug}
              tier={meta.tier}
              startStep={resumeStep}
              onClose={handleClose}
              onComplete={handleComplete}
              onContinueNext={handleContinueNext}
            />
          );
        }
        return null;
      })()}
    </div>
  );
}
