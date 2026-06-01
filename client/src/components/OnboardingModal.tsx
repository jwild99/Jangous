import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import {
  Gamepad2, Trophy, TrendingUp, ChevronRight, Star, Zap, Shield,
} from "lucide-react";
import { gameIcons } from "@/components/GameIcons";

const STORAGE_KEY = "jango_onboarding_v1";

const STEPS = [
  {
    id: 0,
    title: "Welcome to Jango",
    subtitle: "Compete in skill-based games, climb ranks, and win Scalps.",
    visual: "welcome",
    cta: "Let's go",
    skip: true,
  },
  {
    id: 1,
    title: "Choose Your Game",
    subtitle: "Pick a game, set your stake, and enter a match against a real opponent.",
    visual: "games",
    cta: "Got it",
    skip: true,
  },
  {
    id: 2,
    title: "Track Your Progress",
    subtitle: "Build your rank, unlock cosmetics, enter tournaments, and climb the leaderboard.",
    visual: "progress",
    cta: "Start Playing",
    skip: false,
  },
];

const PREVIEW_GAMES = ["chess", "8-ball", "air-hockey", "mini-golf", "tron", "bowling"];

function WelcomeVisual() {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500/40 via-purple-500/40 to-pink-500/40 blur-2xl scale-150" />
        <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-600/30 to-purple-600/30 border border-white/10 flex items-center justify-center">
          <Gamepad2 className="w-12 h-12 text-blue-400" />
        </div>
      </div>
      <div className="flex items-center gap-6 mt-2">
        {[
          { icon: Shield, label: "Skill-based", color: "text-blue-400" },
          { icon: Zap,    label: "Real-time",   color: "text-yellow-400" },
          { icon: Trophy, label: "Win Scalps",  color: "text-amber-400" },
        ].map(({ icon: Icon, label, color }) => (
          <div key={label} className="flex flex-col items-center gap-1.5">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center">
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <span className="text-[11px] text-white/50 font-medium">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GamesVisual() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive(i => (i + 1) % PREVIEW_GAMES.length), 900);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-wrap justify-center gap-2.5 py-4">
      {PREVIEW_GAMES.map((id, i) => {
        const Icon = gameIcons[id as keyof typeof gameIcons] || gameIcons.chess;
        const isActive = i === active;
        return (
          <motion.div
            key={id}
            animate={{ scale: isActive ? 1.1 : 1, opacity: isActive ? 1 : 0.45 }}
            transition={{ duration: 0.3 }}
            className="w-14 h-14 rounded-2xl border flex items-center justify-center"
            style={{
              background: isActive ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.03)",
              borderColor: isActive ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.08)",
              boxShadow: isActive ? "0 0 16px rgba(99,102,241,0.3)" : "none",
            }}
          >
            <Icon className="w-7 h-7" />
          </motion.div>
        );
      })}
    </div>
  );
}

function ProgressVisual() {
  const ranks = [
    { label: "Bronze",   color: "#cd7f32", w: "30%" },
    { label: "Silver",   color: "#9ca3af", w: "52%" },
    { label: "Gold",     color: "#f59e0b", w: "74%" },
    { label: "Platinum", color: "#60a5fa", w: "90%" },
  ];
  return (
    <div className="space-y-2.5 py-4 w-full max-w-xs mx-auto">
      {ranks.map(({ label, color, w }, i) => (
        <div key={label} className="flex items-center gap-3">
          <div className="w-16 text-right">
            <span className="text-xs font-semibold" style={{ color }}>{label}</span>
          </div>
          <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: color }}
              initial={{ width: 0 }}
              animate={{ width: w }}
              transition={{ delay: i * 0.15 + 0.3, duration: 0.6, ease: "easeOut" }}
            />
          </div>
          <Star className="w-3.5 h-3.5" style={{ color }} />
        </div>
      ))}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/8">
        <TrendingUp className="w-4 h-4 text-green-400" />
        <span className="text-xs text-white/50">Win matches to climb the leaderboard</span>
      </div>
    </div>
  );
}

export function OnboardingModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }

  function handleCta() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      dismiss();
      navigate("/");
    }
  }

  const current = STEPS[step];

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) dismiss(); }}>
      <DialogContent
        className="max-w-sm p-0 overflow-hidden border-white/10"
        style={{ background: "linear-gradient(160deg, #080c1a 0%, #0d1225 70%, #0a0e1a 100%)" }}
        data-testid="dialog-onboarding"
      >
        <DialogTitle className="sr-only">Welcome to Jango</DialogTitle>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 pt-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === step ? 20 : 6,
                height: 6,
                background: i === step ? "#6366f1" : "rgba(255,255,255,0.15)",
              }}
            />
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22 }}
            className="px-6 pt-4 pb-6 flex flex-col items-center text-center gap-3"
          >
            {current.visual === "welcome"  && <WelcomeVisual />}
            {current.visual === "games"    && <GamesVisual />}
            {current.visual === "progress" && <ProgressVisual />}

            <h2 className="text-xl font-bold text-white mt-1">{current.title}</h2>
            <p className="text-sm text-white/50 leading-relaxed max-w-[260px]">{current.subtitle}</p>

            <div className="flex flex-col items-center gap-2 w-full mt-2">
              <Button
                onClick={handleCta}
                className="w-full gap-1.5"
                data-testid={`button-onboarding-cta-${step}`}
              >
                {current.cta}
                <ChevronRight className="w-4 h-4" />
              </Button>
              {current.skip && (
                <button
                  onClick={dismiss}
                  className="text-xs text-white/30 hover:text-white/50 transition-colors py-1"
                  data-testid="button-onboarding-skip"
                >
                  Skip for now
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
