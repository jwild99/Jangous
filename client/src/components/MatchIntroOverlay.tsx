import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Swords } from "lucide-react";
import type { MatchWithPlayers } from "@shared/schema";
import { getBotOpponentName } from "@/lib/botMatchUtils";
import { soundManager } from "@/lib/soundManager";

const GAME_LABELS: Record<string, string> = {
  chess: "Chess",
  "mini-golf": "Mini Golf",
  "connect-4": "Connect 4",
  "air-hockey": "Air Hockey",
  "rock-paper-scissors": "Rock Paper Scissors",
  "dots-and-boxes": "Dots & Boxes",
  "8-ball": "8-Ball Pool",
  bowling: "Bowling",
  "cup-king": "Cup King",
  "stack-tower": "Stack Tower",
};

type Phase = "vs" | "3" | "2" | "1" | "go" | "done";

function PlayerCard({ name, avatar, side }: { name: string; avatar?: string | null; side: "left" | "right" }) {
  return (
    <motion.div
      className="flex flex-col items-center gap-3"
      initial={{ x: side === "left" ? -120 : 120, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", damping: 20, stiffness: 220, delay: 0.15 }}
    >
      <div
        className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-white/20 flex items-center justify-center text-2xl font-black text-white overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))",
          boxShadow: "0 0 28px rgba(255,255,255,0.12)",
        }}
      >
        {avatar
          ? <img src={avatar} alt={name} className="w-full h-full object-cover" />
          : <span>{name.slice(0, 2).toUpperCase()}</span>
        }
      </div>
      <p className="text-sm font-bold text-white/85 tracking-wide max-w-[120px] text-center truncate">{name}</p>
    </motion.div>
  );
}

interface MatchIntroOverlayProps {
  match: MatchWithPlayers;
  currentUserId?: string;
  onComplete: () => void;
}

export function MatchIntroOverlay({ match, currentUserId, onComplete }: MatchIntroOverlayProps) {
  const [phase, setPhase] = useState<Phase>("vs");
  const [show, setShow] = useState(true);

  const storageKey = `intro-shown-${match.id}`;

  // Only play once per match session
  const alreadyShown = typeof window !== "undefined" && sessionStorage.getItem(storageKey);

  useEffect(() => {
    if (alreadyShown) { onComplete(); return; }
    sessionStorage.setItem(storageKey, "1");

    const sequence: [Phase, number][] = [
      ["vs", 2000],
      ["3",   700],
      ["2",   700],
      ["1",   700],
      ["go",  600],
    ];

    let t = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const [p, delay] of sequence) {
      t += delay;
      timers.push(setTimeout(() => {
        setPhase(p);
        if (p === "3" || p === "2" || p === "1") soundManager.playMove();
        if (p === "go") soundManager.playReward();
      }, t));
    }

    // Fade out
    timers.push(setTimeout(() => { setShow(false); }, t + 700));
    timers.push(setTimeout(onComplete, t + 1100));

    return () => timers.forEach(clearTimeout);
  }, []);

  if (alreadyShown) return null;

  const p1 = match.player1;
  const p2 = match.player2;
  const p1Name = p1?.firstName ?? "Player 1";
  const p2Name = getBotOpponentName(match);
  const p1Avatar = (p1 as any)?.profileImageUrl ?? null;
  const p2Avatar = match.isBotMatch ? null : ((p2 as any)?.profileImageUrl ?? null);
  const gameLabel = GAME_LABELS[match.gameType] ?? match.gameType;

  const countdownDigit = phase === "3" || phase === "2" || phase === "1" ? phase : null;

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          key="match-intro"
          className="fixed inset-0 z-[9800] flex items-center justify-center overflow-hidden"
          style={{ background: "rgba(4,2,12,0.94)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.55 } }}
        >
          {/* Ambient glow blobs */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/3 left-1/4 w-72 h-72 rounded-full blur-3xl opacity-20"
              style={{ background: "radial-gradient(circle, #FF2D8A, transparent)" }} />
            <div className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full blur-3xl opacity-15"
              style={{ background: "radial-gradient(circle, #FF7A00, transparent)" }} />
          </div>

          {/* VS Phase */}
          <AnimatePresence mode="wait">
            {phase === "vs" && (
              <motion.div key="vs-phase"
                className="flex flex-col items-center gap-8 w-full max-w-sm px-4"
                initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                transition={{ duration: 0.35 }}>

                {/* Game label */}
                <motion.div
                  className="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.25em] text-white/60 border border-white/12"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                  initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  {gameLabel}
                </motion.div>

                {/* Players row */}
                <div className="flex items-center gap-6 w-full justify-center">
                  <PlayerCard name={p1Name} avatar={p1Avatar} side="left" />

                  <motion.div
                    className="flex flex-col items-center gap-1"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.5, type: "spring", stiffness: 300 }}>
                    <Swords className="w-7 h-7 text-white/30" />
                    <span className="text-2xl font-black"
                      style={{
                        background: "linear-gradient(135deg, #FF2D8A, #FF7A00)",
                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                        filter: "drop-shadow(0 0 12px rgba(255,45,138,0.5))",
                      }}>
                      VS
                    </span>
                  </motion.div>

                  <PlayerCard name={p2Name} avatar={p2Avatar} side="right" />
                </div>

                {/* Bet info */}
                {match.potAmount && parseFloat(match.potAmount) > 0 && (
                  <motion.div
                    className="px-5 py-2 rounded-xl text-sm text-white/60 border border-white/8"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
                    <span className="text-white/40">Wager: </span>
                    <span className="font-bold text-amber-400">{parseFloat(match.potAmount) / 2} Scalps each</span>
                  </motion.div>
                )}

                {/* Scanning bar */}
                <motion.div className="w-full h-px bg-white/8 relative overflow-hidden">
                  <motion.div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    animate={{ x: ["-100%", "300%"] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} />
                </motion.div>
              </motion.div>
            )}

            {/* Countdown phase */}
            {countdownDigit && (
              <motion.div key={`count-${countdownDigit}`}
                className="flex items-center justify-center"
                initial={{ scale: 1.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.3 }}>
                <span className="text-[120px] sm:text-[160px] font-black leading-none select-none"
                  style={{
                    background: "linear-gradient(135deg, #fff, rgba(255,255,255,0.6))",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    textShadow: "none",
                    filter: `drop-shadow(0 0 40px rgba(255,255,255,0.${countdownDigit === "1" ? "8" : "4"}))`,
                  }}>
                  {countdownDigit}
                </span>
              </motion.div>
            )}

            {/* GO! */}
            {phase === "go" && (
              <motion.div key="go"
                className="flex items-center justify-center"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: [0.5, 1.15, 1], opacity: 1 }}
                exit={{ scale: 1.3, opacity: 0 }}
                transition={{ duration: 0.4 }}>
                <span className="text-[80px] sm:text-[100px] font-black leading-none select-none"
                  style={{
                    background: "linear-gradient(135deg, #FF2D8A, #FF7A00)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    filter: "drop-shadow(0 0 30px rgba(255,122,0,0.7))",
                  }}>
                  GO!
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
