import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Hand, Trophy, Target, Award, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TutorialShell, prettyTutorialTitle, TutorialShellStep } from "./TutorialShell";
import { useEmitCoachEvent } from "./TrainingCoach";
import { GhostDemo } from "./GhostDemo";
import { useIsMobile } from "@/hooks/use-mobile";

const TUTORIAL_ID = "game-rock-paper-scissors";

type Choice = "rock" | "paper" | "scissors";
const BEATS: Record<Choice, Choice> = { rock: "scissors", paper: "rock", scissors: "paper" };

function RpsBattle({ best: bestOf, onWin, onLoss }: { best: number; onWin: () => void; onLoss: () => void }) {
  const target = Math.ceil(bestOf / 2);
  const [score, setScore] = useState({ you: 0, bot: 0 });
  const [lastRound, setLastRound] = useState<null | { you: Choice; bot: Choice; result: "win" | "loss" | "draw" }>(null);
  const [winStreak, setWinStreak] = useState(0);
  const emit = useEmitCoachEvent();

  const play = (you: Choice) => {
    // Friendly bot: 70% of the time it picks something the user beats.
    const losing = (Object.keys(BEATS) as Choice[]).find((c) => BEATS[you] === c)!;
    const bot: Choice = Math.random() < 0.7 ? losing : (["rock", "paper", "scissors"][Math.floor(Math.random() * 3)] as Choice);
    let result: "win" | "loss" | "draw";
    if (you === bot) result = "draw";
    else if (BEATS[you] === bot) result = "win";
    else result = "loss";
    setLastRound({ you, bot, result });
    if (result === "win") {
      const nextStreak = winStreak + 1;
      setWinStreak(nextStreak);
      if (nextStreak >= 2) emit({ type: "streak", context: { stepId: "rps-practice" } });
      else emit({ type: "success", context: { stepId: "rps-practice" } });
    } else if (result === "loss") {
      setWinStreak(0);
      emit({
        type: "miss",
        context: {
          stepId: "rps-practice",
          hint: "Spot a pattern? If the bot just won with rock, paper is your safest counter.",
          struggleThreshold: 2,
        },
      });
    } else {
      emit({ type: "idle", context: { message: "Draw — read their next move and counter." } });
    }
    setScore((s) => {
      const next = {
        you: s.you + (result === "win" ? 1 : 0),
        bot: s.bot + (result === "loss" ? 1 : 0),
      };
      if (next.you >= target) setTimeout(onWin, 700);
      else if (next.bot >= target) setTimeout(onLoss, 700);
      return next;
    });
  };

  return (
    <div className="space-y-4" data-testid="rps-battle">
      <div className="flex items-center justify-around text-sm">
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">You</div>
          <div className="text-2xl font-bold text-emerald-400" data-testid="text-rps-score-you">{score.you}</div>
        </div>
        <div className="text-xs text-muted-foreground">First to {target}</div>
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Bot</div>
          <div className="text-2xl font-bold text-rose-400" data-testid="text-rps-score-bot">{score.bot}</div>
        </div>
      </div>

      {lastRound && (
        <motion.div
          key={`${score.you}-${score.bot}`}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`text-center rounded-lg border p-3 ${lastRound.result === "win" ? "bg-emerald-500/15 border-emerald-500/40" : lastRound.result === "loss" ? "bg-rose-500/15 border-rose-500/40" : "bg-amber-500/15 border-amber-500/40"}`}
        >
          <div className="flex items-center justify-center gap-4 text-3xl">
            <span>{lastRound.you === "rock" ? "✊" : lastRound.you === "paper" ? "✋" : "✌️"}</span>
            <span className="text-xs text-muted-foreground">vs</span>
            <span>{lastRound.bot === "rock" ? "✊" : lastRound.bot === "paper" ? "✋" : "✌️"}</span>
          </div>
          <div className="mt-1 text-sm font-semibold capitalize" data-testid="text-rps-round-result">
            {lastRound.result === "win" ? "Round won" : lastRound.result === "loss" ? "Round lost" : "Draw — replay"}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {(["rock", "paper", "scissors"] as Choice[]).map((c) => (
          <button
            key={c}
            onClick={() => play(c)}
            className="aspect-square rounded-xl border border-primary/30 bg-primary/5 hover-elevate active-elevate-2 flex flex-col items-center justify-center gap-1 capitalize text-sm font-medium"
            data-testid={`button-rps-${c}`}
          >
            <span className="text-3xl">{c === "rock" ? "✊" : c === "paper" ? "✋" : "✌️"}</span>
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

function RpsGhostDemo() {
  const [highlight, setHighlight] = useState<Choice | null>(null);
  const steps = [
    { at: 200, caption: "Bot opens with scissors ✌️", action: "scissors" as Choice },
    { at: 1200, caption: "Counter with rock ✊ — crushes scissors.", action: "rock" as Choice },
    { at: 2200, caption: "That's one round won. Read, then react." },
  ];
  return (
    <GhostDemo
      title="Coach Demo"
      description="Watch the read — bot throws, you counter."
      steps={steps}
      onStep={(s) => setHighlight((s.action as Choice) ?? null)}
      onFinish={() => setHighlight(null)}
    >
      <div className="grid grid-cols-3 gap-3">
        {(["rock", "paper", "scissors"] as Choice[]).map((c) => (
          <div
            key={c}
            className={`aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 capitalize text-sm font-medium transition-colors ${
              highlight === c ? "border-amber-400 bg-amber-400/20" : "border-primary/20 bg-primary/5"
            }`}
            data-testid={`ghost-rps-${c}`}
          >
            <span className="text-3xl">{c === "rock" ? "✊" : c === "paper" ? "✋" : "✌️"}</span>
            {c}
          </div>
        ))}
      </div>
    </GhostDemo>
  );
}

export function RockPaperScissorsTutorial({
  startStep = 0,
  onClose,
  onComplete,
  onContinueNext,
}: {
  startStep?: number;
  onClose: () => void;
  onComplete: () => void;
  onContinueNext?: (nextId: string) => void;
}) {
  const isMobile = useIsMobile();

  const steps: TutorialShellStep[] = [
    {
      id: "intro",
      title: "Rock Paper Scissors",
      body: "The simplest game on Jango — and a surprisingly deep mind game. Quick rounds, fast payouts.",
      icon: Sparkles,
      cta: "Start",
    },
    {
      id: "rules",
      title: "The Rules",
      body: "Rock crushes Scissors. Scissors cuts Paper. Paper covers Rock. Same pick = replay the round.",
      icon: Hand,
      hint: isMobile
        ? "Tap one of the three buttons each round to lock your choice."
        : "Click one of the three buttons each round to lock your choice.",
    },
    {
      id: "format",
      title: "Best of 3",
      body: "Matches on Jango are best-of-3 by default. First to 2 round wins takes the pot.",
      icon: Target,
      hint: "Watch your opponent's patterns. Three rocks in a row? They're due for a switch.",
      render: () => <RpsGhostDemo />,
    },
    {
      id: "practice",
      title: "Practice Match",
      body: "Beat the training bot in a best-of-3. Pick smart, build a read, and close it out.",
      icon: Zap,
      blocking: true,
      render: ({ advance }) => (
        <RpsBattle
          best={3}
          onWin={advance}
          onLoss={advance}
        />
      ),
    },
    {
      id: "payout",
      title: "Scalps & Payouts",
      body: "Every real RPS match shows the entry fee and winner payout before you confirm. Jango never auto-deducts.",
      icon: Trophy,
    },
    {
      id: "complete",
      title: "RPS Mastered",
      body: "You've got the basics. Claim your badge to unlock the next training.",
      icon: Award,
    },
  ];

  return (
    <TutorialShell
      tutorialId={TUTORIAL_ID}
      steps={steps}
      rewardName="RPS Rookie"
      rewardBlurb="Claim it now to unlock Connect 4 training."
      startStep={startStep}
      isMobile={isMobile}
      onClose={onClose}
      onComplete={onComplete}
      onContinueNext={onContinueNext}
      prettyTitle={prettyTutorialTitle}
    />
  );
}
