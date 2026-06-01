import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Coins, Shield, Swords, Trophy, Clock, WifiOff, SkipForward } from "lucide-react";

interface MatchIntroAnimationProps {
  playerOneName: string;
  playerTwoName: string;
  playerOneImage?: string | null;
  playerTwoImage?: string | null;
  playerOneStake: number;
  playerTwoStake: number;
  isPractice?: boolean;
  isBotMatch?: boolean;
  gameLabel?: string;
  winCondition?: string;
  timeLimit?: string;
  disconnectPolicy?: string;
  onComplete: () => void;
}

const SKIP_KEY = "match-intro-views";
const SKIP_THRESHOLD = 3;

// Web Audio for coin sounds
function makeAudioCtx() {
  try { return new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { return null; }
}
let _ctx: AudioContext | null = null;
function getCtx() { return _ctx || (_ctx = makeAudioCtx()); }

function playCoinSound(delay = 0, freq = 880) {
  const ctx = getCtx(); if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + delay + 0.18);
  gain.gain.setValueAtTime(0, ctx.currentTime + delay);
  gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + delay + 0.02);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + delay + 0.22);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + 0.25);
}

function playLockInSound() {
  const ctx = getCtx(); if (!ctx) return;
  [0, 0.12, 0.22].forEach((d, i) => playCoinSound(d, [660, 880, 1100][i]));
}

// Animated number counter
function AnimatedNumber({ target, duration = 600 }: { target: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const from = display;
    const frame = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(from + (target - from) * eased));
      if (progress < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [target]);
  return <>{display.toLocaleString()}</>;
}

// Phase timing (ms)
const PHASE_P1_IN   = 400;
const PHASE_P2_IN   = 700;
const PHASE_FLY     = 1050;
const PHASE_POT     = 1350;
const PHASE_START   = 1900;
const PHASE_DONE    = 2700;

export default function MatchIntroAnimation({
  playerOneName,
  playerTwoName,
  playerOneImage,
  playerTwoImage,
  playerOneStake,
  playerTwoStake,
  isPractice,
  isBotMatch,
  gameLabel,
  winCondition,
  timeLimit,
  disconnectPolicy,
  onComplete,
}: MatchIntroAnimationProps) {
  const [phase, setPhase] = useState(0);
  const [skipped, setSkipped] = useState(false);

  const totalPot = playerOneStake + playerTwoStake;
  const isNoPot = totalPot === 0 || isPractice;

  // Track ceremony views in localStorage; show Skip after threshold
  const viewCount = (() => {
    try { return parseInt(localStorage.getItem(SKIP_KEY) || "0", 10) || 0; } catch { return 0; }
  })();
  const canSkip = viewCount >= SKIP_THRESHOLD;

  useEffect(() => {
    try { localStorage.setItem(SKIP_KEY, String(viewCount + 1)); } catch {}
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhase(1), PHASE_P1_IN));
    timers.push(setTimeout(() => { setPhase(2); playCoinSound(0, 880); }, PHASE_P2_IN));
    timers.push(setTimeout(() => { setPhase(3); }, PHASE_FLY));
    timers.push(setTimeout(() => { setPhase(4); playLockInSound(); }, PHASE_POT));
    timers.push(setTimeout(() => setPhase(5), PHASE_START));
    timers.push(setTimeout(() => onComplete(), PHASE_DONE));
    return () => timers.forEach(clearTimeout);
  }, []);

  const handleSkip = () => {
    if (skipped) return;
    setSkipped(true);
    onComplete();
  };

  const stakeLabel = isPractice ? "PRACTICE" : isBotMatch ? "vs BOT" : isNoPot ? "FREE" : null;
  const showRules = winCondition || timeLimit || disconnectPolicy;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(2,2,12,0.96)" }}
      >
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div style={{ position: "absolute", left: "20%", top: "50%", transform: "translateY(-50%)", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,45,138,0.08) 0%, transparent 70%)", filter: "blur(40px)" }} />
          <div style={{ position: "absolute", right: "20%", top: "50%", transform: "translateY(-50%)", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(51,153,255,0.08) 0%, transparent 70%)", filter: "blur(40px)" }} />
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(120,80,220,0.12) 0%, transparent 70%)", filter: "blur(30px)" }} />
        </div>

        <div className="relative flex flex-col items-center gap-8 w-full max-w-2xl px-6">

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col items-center gap-1"
          >
            <div className="flex items-center gap-2">
              <Swords className="w-5 h-5 text-violet-400" />
              <span className="text-xs font-bold tracking-[0.3em] text-violet-300 uppercase">Match Starting</span>
              <Swords className="w-5 h-5 text-violet-400 scale-x-[-1]" />
            </div>
            <div className="text-[11px] text-muted-foreground tracking-widest uppercase">
              {gameLabel ? `${gameLabel} \u2022 ` : ""}{isPractice ? "Practice Mode" : isBotMatch ? "vs Bot" : "Ranked Match"}
            </div>
          </motion.div>

          {/* Skip button — appears after first few ceremony views */}
          {canSkip && (
            <motion.button
              onClick={handleSkip}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              whileHover={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="absolute top-4 right-4 flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wider uppercase text-white/70 active-elevate-2"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              data-testid="button-skip-intro"
            >
              <SkipForward className="w-3 h-3" />
              Skip
            </motion.button>
          )}

          {/* Players + pot row */}
          <div className="flex items-center justify-between w-full gap-4">

            {/* Player 1 */}
            <motion.div
              initial={{ opacity: 0, x: -80 }}
              animate={{ opacity: phase >= 1 ? 1 : 0, x: phase >= 1 ? 0 : -80 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="flex flex-col items-center gap-3 flex-1"
            >
              <div className="relative">
                <Avatar className="w-16 h-16 ring-2 ring-pink-500/40" style={{ boxShadow: "0 0 20px rgba(255,45,138,0.35)" }}>
                  {playerOneImage && <AvatarImage src={playerOneImage} />}
                  <AvatarFallback className="text-lg font-bold text-pink-400 bg-pink-500/10">
                    {playerOneName?.slice(0, 2).toUpperCase() || "P1"}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
                  style={{ background: "rgba(255,45,138,0.9)" }}>
                  P1
                </div>
              </div>
              <div className="text-center">
                <div className="font-bold text-sm text-white">{playerOneName}</div>
                {!isNoPot && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: phase >= 3 ? 0 : 1, scale: phase >= 3 ? 0.4 : 1, x: phase >= 3 ? 80 : 0, y: phase >= 3 ? 20 : 0 }}
                    transition={{ duration: 0.38, ease: "easeIn" }}
                    className="flex items-center justify-center gap-1 mt-1 rounded-full px-3 py-1"
                    style={{ background: "rgba(255,45,138,0.15)", border: "1px solid rgba(255,45,138,0.3)" }}
                  >
                    <Coins className="w-3 h-3 text-amber-400" />
                    <span className="text-amber-400 font-bold text-sm">{playerOneStake.toLocaleString()}</span>
                    <span className="text-amber-400/60 text-xs">S</span>
                  </motion.div>
                )}
              </div>
            </motion.div>

            {/* Center pot */}
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{
                opacity: phase >= 1 ? 1 : 0,
                scale: phase >= 4 ? 1.08 : phase >= 1 ? 1 : 0.6,
              }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center gap-2"
            >
              {/* VS text (before pot locks) */}
              <AnimatePresence>
                {phase < 4 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.25 }}
                    className="text-3xl font-black text-muted-foreground/40"
                  >
                    VS
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Pot */}
              {!isNoPot && (
                <AnimatePresence>
                  {phase >= 4 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.35, type: "spring", bounce: 0.4 }}
                      className="flex flex-col items-center gap-1"
                    >
                      <div className="text-[10px] font-bold tracking-widest text-amber-400/70 uppercase">Total Pot</div>
                      <div
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl"
                        style={{
                          background: "rgba(0,0,0,0.7)",
                          border: "1.5px solid rgba(251,191,36,0.4)",
                          boxShadow: "0 0 30px rgba(251,191,36,0.2), inset 0 1px 0 rgba(255,255,255,0.05)",
                        }}
                      >
                        <Coins className="w-5 h-5 text-amber-400" />
                        <span className="text-2xl font-black text-amber-400 tabular-nums">
                          <AnimatedNumber target={totalPot} duration={500} />
                        </span>
                        <span className="text-amber-400/60 text-sm font-bold">S</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">Winner takes all</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}

              {isNoPot && (
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="flex items-center gap-2 px-4 py-2 rounded-xl"
                    style={{
                      background: "rgba(0,0,0,0.6)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <Shield className="w-4 h-4 text-violet-400" />
                    <span className="text-sm font-bold text-violet-300">{stakeLabel}</span>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Player 2 */}
            <motion.div
              initial={{ opacity: 0, x: 80 }}
              animate={{ opacity: phase >= 2 ? 1 : 0, x: phase >= 2 ? 0 : 80 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="flex flex-col items-center gap-3 flex-1"
            >
              <div className="relative">
                <Avatar className="w-16 h-16" style={{ boxShadow: "0 0 20px rgba(51,153,255,0.35)" }}>
                  {playerTwoImage && <AvatarImage src={playerTwoImage} />}
                  <AvatarFallback className="text-lg font-bold text-blue-400 bg-blue-500/10">
                    {playerTwoName?.slice(0, 2).toUpperCase() || "P2"}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
                  style={{ background: "rgba(51,153,255,0.9)" }}>
                  P2
                </div>
              </div>
              <div className="text-center">
                <div className="font-bold text-sm text-white">{playerTwoName}</div>
                {!isNoPot && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: phase >= 3 ? 0 : 1, scale: phase >= 3 ? 0.4 : 1, x: phase >= 3 ? -80 : 0, y: phase >= 3 ? 20 : 0 }}
                    transition={{ duration: 0.38, ease: "easeIn" }}
                    className="flex items-center justify-center gap-1 mt-1 rounded-full px-3 py-1"
                    style={{ background: "rgba(51,153,255,0.15)", border: "1px solid rgba(51,153,255,0.3)" }}
                  >
                    <Coins className="w-3 h-3 text-amber-400" />
                    <span className="text-amber-400 font-bold text-sm">{playerTwoStake.toLocaleString()}</span>
                    <span className="text-amber-400/60 text-xs">S</span>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>

          {/* "Match Start" banner */}
          <AnimatePresence>
            {phase >= 5 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.3, type: "spring", bounce: 0.35 }}
                className="flex flex-col items-center gap-1"
              >
                <div
                  className="px-8 py-2.5 rounded-xl text-center"
                  style={{
                    background: "linear-gradient(135deg, rgba(120,40,200,0.5) 0%, rgba(200,40,120,0.5) 100%)",
                    border: "1.5px solid rgba(255,255,255,0.15)",
                    boxShadow: "0 0 30px rgba(200,40,120,0.25)",
                  }}
                >
                  <div className="text-xl font-black tracking-widest text-white" style={{ textShadow: "0 0 20px rgba(255,255,255,0.5)" }}>
                    MATCH START
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Rules reminder card */}
          {showRules && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: phase >= 4 ? 1 : 0, y: phase >= 4 ? 0 : 8 }}
              transition={{ duration: 0.35 }}
              className="flex items-center gap-4 px-4 py-2.5 rounded-xl flex-wrap justify-center"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
              data-testid="card-match-rules"
            >
              {winCondition && (
                <div className="flex items-center gap-1.5 text-[11px] text-white/70">
                  <Trophy className="w-3.5 h-3.5 text-amber-400/80" />
                  <span className="font-medium">{winCondition}</span>
                </div>
              )}
              {timeLimit && (
                <div className="flex items-center gap-1.5 text-[11px] text-white/70">
                  <Clock className="w-3.5 h-3.5 text-cyan-400/80" />
                  <span className="font-medium">{timeLimit}</span>
                </div>
              )}
              {disconnectPolicy && (
                <div className="flex items-center gap-1.5 text-[11px] text-white/70">
                  <WifiOff className="w-3.5 h-3.5 text-pink-400/80" />
                  <span className="font-medium">{disconnectPolicy}</span>
                </div>
              )}
            </motion.div>
          )}

          {/* Loading dots */}
          {phase < 5 && (
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.2, 0.8, 0.2] }}
                  transition={{ duration: 0.9, delay: i * 0.18, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full bg-violet-400"
                />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
