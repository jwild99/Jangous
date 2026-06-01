import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Crown, X } from "lucide-react";
import { createPortal } from "react-dom";
import { ScalpsIcon } from "@/components/ScalpsIcon";
import { soundManager } from "@/lib/soundManager";

// ── Shared color palette ───────────────────────────────────────────────────────
const COLORS = [
  "#FF2D8A", "#FF7A00", "#FFD700", "#00E5FF",
  "#7C3AED", "#10B981", "#F59E0B", "#EF4444",
  "#A855F7", "#22D3EE", "#FACC15", "#4ADE80",
];

// ── Confetti Canvas ────────────────────────────────────────────────────────────

interface Particle {
  x: number; y: number; vx: number; vy: number;
  color: string; size: number; rotation: number;
  rotationSpeed: number; gravity: number;
  life: number; maxLife: number; shape: "rect" | "circle";
}

function ConfettiCanvas({ active, burst = false }: { active: boolean; burst?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) { particlesRef.current = []; return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const handleResize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener("resize", handleResize);

    const spawn = () => {
      const count = burst ? 14 : 8;
      for (let i = 0; i < count; i++) {
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: burst ? canvas.height * 0.3 + (Math.random() - 0.5) * 200 : -10,
          vx: burst ? (Math.random() - 0.5) * 18 : (Math.random() - 0.5) * 6,
          vy: burst ? -(Math.random() * 14 + 4) : Math.random() * 3 + 2,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          size: Math.random() * 10 + 5,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 10,
          gravity: burst ? 0.25 : 0.12,
          life: 1,
          maxLife: burst ? 140 + Math.random() * 80 : 200 + Math.random() * 100,
          shape: Math.random() > 0.5 ? "rect" : "circle",
        });
      }
    };

    let frame = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;
      const maxSpawnFrames = burst ? 40 : 120;
      if (frame < maxSpawnFrames) spawn();

      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      particlesRef.current.forEach(p => {
        p.vy += p.gravity; p.x += p.vx; p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.life = Math.max(0, 1 - (frame / p.maxLife));
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      });

      if (frame < (burst ? 80 : 350) || particlesRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener("resize", handleResize); };
  }, [active, burst]);

  return (
    <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[200]"
      style={{ display: active ? "block" : "none" }} />
  );
}

// ── Animated count-up number ────────────────────────────────────────────────
function CountUp({ target, duration = 1800, prefix = "", suffix = "" }: {
  target: number; duration?: number; prefix?: string; suffix?: string;
}) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out expo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [target, duration]);
  return <>{prefix}{value.toLocaleString()}{suffix}</>;
}

// ── Standard Match Victory ─────────────────────────────────────────────────────

interface VictoryAnimationProps {
  show: boolean;
  winnerName?: string;
  scalpsWon?: number;
  onDismiss?: () => void;
}

export function VictoryAnimation({ show, winnerName, scalpsWon, onDismiss }: VictoryAnimationProps) {
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => onDismiss?.(), 5500);
    return () => clearTimeout(timer);
  }, [show, onDismiss]);

  return (
    <>
      <ConfettiCanvas active={show} />
      <AnimatePresence>
        {show && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-[150] pointer-events-none"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="flex flex-col items-center gap-4 pointer-events-auto cursor-pointer"
              onClick={onDismiss}
              initial={{ scale: 0.3, y: 60 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.3, y: 60, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <motion.div
                animate={{ rotate: [-8, 8, -8, 8, 0], scale: [1, 1.15, 1] }}
                transition={{ duration: 0.8, repeat: 1 }}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-2xl"
                style={{ boxShadow: "0 0 60px rgba(255,200,0,0.6), 0 0 120px rgba(255,100,0,0.3)" }}
              >
                <Crown className="w-12 h-12 text-white drop-shadow-lg" />
              </motion.div>

              <div className="text-center px-6 py-5 rounded-2xl"
                style={{ background: "rgba(0,0,0,0.88)", border: "1px solid rgba(255,215,0,0.3)", backdropFilter: "blur(24px)" }}>
                <motion.p
                  className="text-4xl font-black text-transparent bg-clip-text"
                  style={{ backgroundImage: "linear-gradient(135deg, #FFD700, #FF7A00, #FF2D8A)" }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 0.5, repeat: 3 }}
                >
                  VICTORY!
                </motion.p>
                {winnerName && <p className="text-white/80 text-base mt-1">{winnerName}</p>}
                {scalpsWon !== undefined && scalpsWon > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                    className="mt-3 px-4 py-2 rounded-lg flex items-center gap-2 justify-center"
                    style={{ background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.25)" }}
                  >
                    <ScalpsIcon size="sm" />
                    <p className="text-yellow-400 font-bold text-lg">+{scalpsWon.toFixed(2)} Scalps</p>
                  </motion.div>
                )}
                <p className="text-white/35 text-xs mt-3">Tap to dismiss</p>
              </div>

              {[...Array(3)].map((_, i) => (
                <motion.div key={i} className="absolute"
                  style={{ left: `${15 + i * 35}%`, top: "20%" }}
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: [0, 1.3, 1], rotate: 0, y: [0, -20, 0] }}
                  transition={{ delay: 0.3 + i * 0.15, duration: 0.6 }}>
                  <Trophy className="w-8 h-8 text-yellow-400 opacity-70" />
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Defeat Animation ───────────────────────────────────────────────────────────

export function DefeatAnimation({ show, onDismiss }: { show: boolean; onDismiss?: () => void }) {
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => onDismiss?.(), 4000);
    return () => clearTimeout(timer);
  }, [show, onDismiss]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div className="fixed inset-0 flex items-center justify-center z-[150] pointer-events-none"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            className="flex flex-col items-center gap-4 pointer-events-auto cursor-pointer"
            onClick={onDismiss}
            initial={{ scale: 0.3, y: 60 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.3, y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 250, damping: 20 }}>
            <div className="text-center px-6 py-5 rounded-2xl"
              style={{ background: "rgba(0,0,0,0.88)", border: "1px solid rgba(239,68,68,0.3)", backdropFilter: "blur(20px)" }}>
              <p className="text-4xl font-black text-red-400">DEFEAT</p>
              <p className="text-white/60 text-sm mt-1">Better luck next time</p>
              <p className="text-white/35 text-xs mt-3">Tap to dismiss</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Tournament Victory Overlay ─────────────────────────────────────────────────
// High-impact full-screen animation for tournament wins.
// Shows a slow-motion intro, then an explosive burst with confetti, count-up, and glow.

interface TournamentVictoryProps {
  show: boolean;
  winnerName?: string;
  prizeScalps?: number;
  tournamentName?: string;
  onDismiss?: () => void;
}

export function TournamentVictoryAnimation({
  show,
  winnerName,
  prizeScalps = 0,
  tournamentName,
  onDismiss,
}: TournamentVictoryProps) {
  const [phase, setPhase] = useState<"idle" | "slowmo" | "burst" | "full">("idle");
  const [confettiActive, setConfettiActive] = useState(false);

  useEffect(() => {
    if (!show) { setPhase("idle"); setConfettiActive(false); return; }

    // Phase 1 — slow-motion fade-in
    setPhase("slowmo");

    // Phase 2 — explosive burst
    const t1 = setTimeout(() => {
      setPhase("burst");
      setConfettiActive(true);
      try { soundManager.playPurchase(); } catch { /* no-op */ }
    }, 800);

    // Phase 3 — full display with count-up
    const t2 = setTimeout(() => setPhase("full"), 1400);

    // Auto-dismiss after 9 seconds
    const t3 = setTimeout(() => onDismiss?.(), 9000);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [show, onDismiss]);

  // Ring particles
  const rings = [0, 1, 2, 3];

  if (!show) return null;

  return createPortal(
    <AnimatePresence>
      {show && (
        <>
          <ConfettiCanvas active={confettiActive} burst />

          {/* Full-screen backdrop */}
          <motion.div
            className="fixed inset-0 z-[500] flex items-center justify-center"
            style={{ backdropFilter: "blur(6px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.6 } }}
          >
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/75" />

            {/* Ambient radial glow */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: phase === "burst" || phase === "full" ? 1 : 0 }}
              transition={{ duration: 0.5 }}
              style={{
                background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(234,179,8,0.18) 0%, rgba(99,102,241,0.08) 45%, transparent 70%)",
              }}
            />

            {/* Expanding rings on burst */}
            {(phase === "burst" || phase === "full") && rings.map(i => (
              <motion.div key={i}
                className="absolute rounded-full border border-yellow-400/20 pointer-events-none"
                style={{ width: 100, height: 100 }}
                animate={{ scale: [1, 6 + i * 3], opacity: [0.5, 0] }}
                transition={{ duration: 1.2, delay: i * 0.12, ease: "easeOut" }}
              />
            ))}

            {/* Main card */}
            <motion.div
              className="relative z-10 flex flex-col items-center gap-6 max-w-sm w-full mx-4 pointer-events-auto"
              onClick={onDismiss}
              initial={{ scale: 0.2, opacity: 0 }}
              animate={{
                scale: phase === "slowmo" ? 0.85 : 1,
                opacity: phase === "slowmo" ? 0.7 : 1,
              }}
              transition={{
                scale: { type: "spring", stiffness: phase === "slowmo" ? 60 : 280, damping: phase === "slowmo" ? 12 : 18 },
                opacity: { duration: 0.5 },
              }}
              exit={{ scale: 0.4, opacity: 0, transition: { duration: 0.5 } }}
            >
              {/* Crown + trophy icon */}
              <div className="relative flex items-center justify-center">
                {/* Outer pulsing glow */}
                <motion.div
                  className="absolute rounded-full"
                  style={{ width: 140, height: 140 }}
                  animate={{
                    boxShadow: [
                      "0 0 40px 8px rgba(234,179,8,0.3)",
                      "0 0 80px 20px rgba(234,179,8,0.6)",
                      "0 0 40px 8px rgba(234,179,8,0.3)",
                    ],
                  }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                />

                <motion.div
                  className="w-28 h-28 rounded-full flex items-center justify-center"
                  style={{
                    background: "radial-gradient(circle, #fde047 0%, #f59e0b 45%, #b45309 100%)",
                    boxShadow: "0 0 60px rgba(234,179,8,0.7), 0 8px 32px rgba(0,0,0,0.5)",
                  }}
                  animate={{
                    scale: phase === "burst" ? [1, 1.3, 1] : 1,
                    rotate: phase === "burst" ? [0, -15, 15, 0] : 0,
                  }}
                  transition={{ duration: 0.7 }}
                >
                  <Crown className="w-14 h-14 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]" />
                </motion.div>

                {/* Orbiting trophies */}
                {(phase === "full") && [0, 1, 2].map(i => (
                  <motion.div key={i}
                    className="absolute"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.12, type: "spring", stiffness: 300 }}
                    style={{
                      left: `${50 + 68 * Math.cos((i * 2 * Math.PI) / 3 - Math.PI / 2)}%`,
                      top:  `${50 + 68 * Math.sin((i * 2 * Math.PI) / 3 - Math.PI / 2)}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <Trophy className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
                  </motion.div>
                ))}
              </div>

              {/* Text block */}
              <div className="text-center rounded-2xl px-7 py-6 w-full cursor-pointer"
                style={{
                  background: "rgba(0,0,0,0.88)",
                  border: "1px solid rgba(234,179,8,0.3)",
                  backdropFilter: "blur(28px)",
                  boxShadow: "0 0 40px rgba(234,179,8,0.12), 0 20px 60px rgba(0,0,0,0.6)",
                }}>

                {/* Slow-motion flash */}
                <AnimatePresence>
                  {(phase === "slowmo" || phase === "burst") && (
                    <motion.div
                      className="absolute inset-0 rounded-2xl bg-yellow-400/10 pointer-events-none"
                      initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 1 }}
                    />
                  )}
                </AnimatePresence>

                {/* "TOURNAMENT WON" headline */}
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <p className="text-xs font-bold tracking-[0.3em] text-yellow-500/70 uppercase mb-1">
                    {tournamentName ?? "Tournament"}
                  </p>
                  <p
                    className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text leading-none"
                    style={{ backgroundImage: "linear-gradient(135deg, #FFD700 0%, #FF7A00 50%, #FF2D8A 100%)" }}
                  >
                    CHAMPION!
                  </p>
                </motion.div>

                {/* Winner name */}
                {winnerName && (
                  <motion.p
                    className="text-white/80 text-base font-semibold mt-3"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                  >
                    {winnerName}
                  </motion.p>
                )}

                {/* Prize amount with count-up */}
                {prizeScalps > 0 && phase === "full" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1, type: "spring", stiffness: 240 }}
                    className="mt-5 px-5 py-4 rounded-xl flex flex-col items-center gap-1"
                    style={{
                      background: "linear-gradient(135deg, rgba(234,179,8,0.15) 0%, rgba(249,115,22,0.10) 100%)",
                      border: "1px solid rgba(234,179,8,0.3)",
                    }}
                  >
                    <p className="text-[11px] font-semibold text-yellow-500/60 uppercase tracking-widest">Prize Won</p>
                    <div className="flex items-center gap-2">
                      <ScalpsIcon size="md" />
                      <p className="text-3xl font-black text-yellow-400 font-mono">
                        +<CountUp target={prizeScalps} duration={1600} />
                      </p>
                      <span className="text-yellow-400/70 text-sm font-bold">Scalps</span>
                    </div>
                    <p className="text-xs text-white/30 mt-0.5">Added to your wallet</p>
                  </motion.div>
                )}

                <motion.p
                  className="text-white/25 text-xs mt-4"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                >
                  Tap anywhere to dismiss
                </motion.p>
              </div>

              {/* Close button */}
              <motion.button
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/20 transition-all"
                onClick={(e) => { e.stopPropagation(); onDismiss?.(); }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
              >
                <X className="w-4 h-4" />
              </motion.button>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
