import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Link } from "wouter";
import { AppNavbar } from "@/components/AppNavbar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, ChevronDown, Volume2, VolumeX } from "lucide-react";
import { soundManager } from "@/lib/soundManager";

import heroImg from "@assets/JangoCollegeKidsGamblingOnPhones_1779173611676.png";
import originImg from "@assets/JangoCollegeKidsPhones_1779173579742.png";
import riseImg from "@assets/JangoBackground_1779173594950.png";
import scalpsImg from "@assets/JangoBackground1_1779173583478.png";
import peakImg from "@assets/JangoBackground1_1779173601102.png";
import strangerImg from "@assets/JangoCollegeKidsGamblingOnPhones2_1779173606766.png";

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

// ─── Primitives ──────────────────────────────────────────────────────────────

function SectionEyebrow({ index, label, accent }: { index: string; label: string; accent: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[10px] font-mono font-black tracking-[0.3em] text-white/30">{index}</span>
      <span className="h-px w-8" style={{ background: `linear-gradient(90deg, rgba(${accent},0.6), transparent)` }} />
      <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: `rgb(${accent})` }}>{label}</span>
    </div>
  );
}

function SectionTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`text-3xl md:text-5xl lg:text-6xl font-black text-white leading-[1.05] tracking-tight ${className}`}>
      {children}
    </h2>
  );
}

function SectionBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-base md:text-lg text-white/70 leading-relaxed ${className}`}>{children}</p>;
}

function GlassCard({
  children,
  className = "",
  accent = "236,72,153",
}: {
  children: React.ReactNode;
  className?: string;
  accent?: string;
}) {
  return (
    <div
      className={`relative rounded-2xl backdrop-blur-xl overflow-hidden ${className}`}
      style={{
        background: "linear-gradient(145deg, rgba(15,12,22,0.82) 0%, rgba(10,8,18,0.72) 100%)",
        border: `1px solid rgba(${accent},0.20)`,
        boxShadow: `0 24px 48px -16px rgba(0,0,0,0.7), 0 0 60px -24px rgba(${accent},0.28)`,
      }}
    >
      {children}
    </div>
  );
}

// Scroll-reveal wrapper
function Reveal({
  children,
  delay = 0,
  y = 24,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Image with dark wash overlay
function BackgroundArt({
  src,
  alt,
  opacity = 0.55,
  scale = 1,
  position = "center",
}: {
  src: string;
  alt: string;
  opacity?: number;
  scale?: number;
  position?: string;
}) {
  return (
    <>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity, objectPosition: position, transform: `scale(${scale})` }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,5,15,0.85) 0%, rgba(8,5,15,0.55) 35%, rgba(8,5,15,0.75) 75%, rgba(8,5,15,0.95) 100%)",
        }}
      />
    </>
  );
}

// Abstract drifting motes for The Scalps section (no fabricated names)
function ScalpsMist() {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 22 }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-white/[0.08]"
          style={{
            top: `${(i * 13) % 92 + 4}%`,
            left: `${(i * 37) % 88 + 4}%`,
            width: `${4 + (i % 4) * 3}px`,
            height: `${4 + (i % 4) * 3}px`,
            filter: "blur(2px)",
          }}
          animate={{ x: [0, 18, 0], y: [0, -12, 0], opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 14 + i, repeat: Infinity, delay: i * 0.5, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// Soft floating particles for the closing myth section
function MythParticles() {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 18 }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute w-1 h-1 rounded-full bg-white/40"
          style={{ top: `${(i * 17) % 100}%`, left: `${(i * 23) % 100}%`, filter: "blur(0.5px)" }}
          animate={{ y: [0, -40, 0], opacity: [0, 1, 0] }}
          transition={{ duration: 6 + (i % 5), repeat: Infinity, delay: i * 0.4, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

// ─── Ambient soundtrack ──────────────────────────────────────────────────────
// Synthesized via Web Audio API (no external assets). A slow, low-volume pad of
// detuned sine voices with a gentle LFO sweep — cinematic, unobtrusive backdrop.

function computeAmbientTarget(volume: number) {
  const v = Math.max(0, Math.min(1, volume));
  const g = Math.max(0, Math.min(1, soundManager.getVolume()));
  return 0.18 * g * v;
}

function useAmbientSoundtrack(enabled: boolean, volume: number) {
  const nodesRef = useRef<{ ctx: AudioContext; master: GainNode; stops: Array<() => void> } | null>(null);

  // Apply volume changes in real time to the running master gain.
  useEffect(() => {
    const ref = nodesRef.current;
    if (!ref) return;
    try {
      const t = ref.ctx.currentTime;
      const target = computeAmbientTarget(volume);
      ref.master.gain.cancelScheduledValues(t);
      ref.master.gain.setValueAtTime(ref.master.gain.value, t);
      ref.master.gain.linearRampToValueAtTime(target, t + 0.08);
    } catch {}
  }, [volume]);

  // Pause/resume the audio context when the tab visibility changes so the
  // soundtrack actually stops when the user is on another tab.
  useEffect(() => {
    const onVis = () => {
      const ref = nodesRef.current;
      if (!ref) return;
      try {
        if (document.hidden) {
          if (ref.ctx.state === "running") ref.ctx.suspend().catch(() => {});
        } else {
          if (ref.ctx.state === "suspended") ref.ctx.resume().catch(() => {});
        }
      } catch {}
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (!soundManager.isEnabled()) return;

    let cancelled = false;
    try {
      const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);

      // Low-pass for warmth
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      lp.Q.value = 0.6;
      lp.connect(master);

      // Chord voices (Am9-ish drone) with slight detune
      const voices: Array<{ osc: OscillatorNode; gain: GainNode }> = [];
      const chord = [
        { f: 110.0,  type: "sine" as OscillatorType, g: 0.18, det: -6 },   // A2
        { f: 164.81, type: "sine" as OscillatorType, g: 0.14, det: 4 },    // E3
        { f: 220.0,  type: "sine" as OscillatorType, g: 0.12, det: -3 },   // A3
        { f: 329.63, type: "triangle" as OscillatorType, g: 0.08, det: 6 },// E4
        { f: 493.88, type: "sine" as OscillatorType, g: 0.05, det: -4 },   // B4
      ];
      chord.forEach(({ f, type, g, det }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = f;
        osc.detune.value = det;
        gain.gain.value = g;
        osc.connect(gain);
        gain.connect(lp);
        osc.start();
        voices.push({ osc, gain });
      });

      // Slow LFO modulating filter cutoff for breathing motion
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.06;
      lfoGain.gain.value = 250;
      lfo.connect(lfoGain);
      lfoGain.connect(lp.frequency);
      lfo.start();

      // Fade in — scale by global sound volume and per-page ambient volume
      const targetGain = computeAmbientTarget(volume);
      const now = ctx.currentTime;
      master.gain.setValueAtTime(0, now);
      master.gain.linearRampToValueAtTime(targetGain, now + 2.0);

      const stops: Array<() => void> = [
        () => {
          try {
            const t = ctx.currentTime;
            master.gain.cancelScheduledValues(t);
            master.gain.setValueAtTime(master.gain.value, t);
            master.gain.linearRampToValueAtTime(0, t + 0.8);
            const stopAt = t + 0.9;
            voices.forEach(({ osc }) => { try { osc.stop(stopAt); } catch {} });
            try { lfo.stop(stopAt); } catch {}
            setTimeout(() => { try { ctx.close(); } catch {} }, 1100);
          } catch {}
        },
      ];

      if (cancelled) {
        stops.forEach((fn) => fn());
        return;
      }
      nodesRef.current = { ctx, master, stops };

      // Resume context if suspended (autoplay policies)
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    } catch {
      // Audio unavailable — silently no-op
    }

    return () => {
      cancelled = true;
      const ref = nodesRef.current;
      nodesRef.current = null;
      if (ref) ref.stops.forEach((fn) => fn());
    };
  }, [enabled]);
}

function AmbientToggle() {
  const [on, setOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("arenaOriginsAmbient") === "true";
  });
  const [volume, setVolume] = useState<number>(() => {
    if (typeof window === "undefined") return 0.5;
    const raw = localStorage.getItem("arenaOriginsAmbientVolume");
    if (raw == null) return 0.5;
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return 0.5;
    return Math.max(0, Math.min(1, n));
  });
  const [sliderOpen, setSliderOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  // If the global sound system is muted, force-off and disable interaction
  const globallyMuted = typeof window !== "undefined" && !soundManager.isEnabled();
  const effectiveOn = on && !globallyMuted;

  useAmbientSoundtrack(effectiveOn, volume);

  const toggle = () => {
    if (globallyMuted) return;
    setOn((v) => {
      const next = !v;
      try { localStorage.setItem("arenaOriginsAmbient", String(next)); } catch {}
      return next;
    });
  };

  const onVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = parseInt(e.target.value, 10);
    const v = Math.max(0, Math.min(1, (Number.isFinite(pct) ? pct : 50) / 100));
    setVolume(v);
    try { localStorage.setItem("arenaOriginsAmbientVolume", String(v)); } catch {}
  };

  const openSlider = () => {
    if (globallyMuted) return;
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setSliderOpen(true);
  };
  const scheduleClose = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => setSliderOpen(false), 180);
  };

  useEffect(() => () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
  }, []);

  const pct = Math.round(volume * 100);

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={openSlider}
      onMouseLeave={scheduleClose}
      onFocus={openSlider}
      onBlur={scheduleClose}
    >
      <button
        type="button"
        onClick={toggle}
        aria-pressed={effectiveOn}
        aria-label={effectiveOn ? "Mute ambient soundtrack" : "Play ambient soundtrack"}
        title={
          globallyMuted
            ? "Sound is muted in settings"
            : effectiveOn
              ? "Mute ambient soundtrack"
              : "Play ambient soundtrack"
        }
        disabled={globallyMuted}
        data-testid="button-ambient-toggle"
        className="flex items-center justify-center w-10 h-10 rounded-full backdrop-blur-xl border border-white/15 bg-black/40 text-white/80 hover:text-white hover-elevate active-elevate-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {effectiveOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
      </button>

      <div
        className={`absolute top-1/2 -translate-y-1/2 right-full mr-2 flex items-center gap-2 px-3 h-10 rounded-full backdrop-blur-xl border border-white/15 bg-black/40 transition-opacity duration-150 ${
          sliderOpen && !globallyMuted ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        role="presentation"
      >
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={pct}
          onChange={onVolumeChange}
          disabled={globallyMuted}
          aria-label="Ambient soundtrack volume"
          title={globallyMuted ? "Sound is muted in settings" : `Volume ${pct}%`}
          data-testid="slider-ambient-volume"
          className="ambient-volume-slider w-28 h-1 cursor-pointer appearance-none rounded-full bg-white/20 outline-none disabled:cursor-not-allowed"
          style={{
            background: `linear-gradient(to right, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.85) ${pct}%, rgba(255,255,255,0.2) ${pct}%, rgba(255,255,255,0.2) 100%)`,
          }}
        />
        <span
          className="text-[10px] font-semibold tabular-nums text-white/70 w-7 text-right"
          data-testid="text-ambient-volume"
        >
          {pct}%
        </span>
      </div>
    </div>
  );
}

export default function ArenaOriginsPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const reduced = useReducedMotion();
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", reduced ? "0%" : "30%"]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, reduced ? 1 : 1.08]);
  const heroFade = useTransform(scrollYProgress, [0, 1], [1, reduced ? 1 : 0.2]);

  return (
    <div className="min-h-screen bg-[#08050f] text-white overflow-x-hidden">
      <AppNavbar />

      {/* Back link */}
      <div className="absolute top-20 left-4 md:left-8 z-30">
        <Link href="/">
          <button
            className="flex items-center gap-2 text-white/60 hover:text-white text-sm font-semibold transition-colors"
            data-testid="link-back-to-arena"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Arena
          </button>
        </Link>
      </div>

      {/* Ambient soundtrack toggle */}
      <div className="absolute top-20 right-4 md:right-8 z-30">
        <AmbientToggle />
      </div>

      {/* ───────────────── HERO ───────────────── */}
      <section ref={heroRef} className="relative h-screen min-h-[680px] flex items-center justify-center overflow-hidden">
        <motion.div className="absolute inset-0" style={{ y: heroY, scale: heroScale, opacity: heroFade }}>
          <img
            src={heroImg}
            alt="Jango at the table"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 0.85, objectPosition: "center 30%" }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(8,5,15,0.35) 0%, rgba(8,5,15,0.7) 55%, rgba(8,5,15,0.98) 100%)",
            }}
          />
          {/* Neon edge glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at 15% 20%, rgba(251,146,60,0.18), transparent 45%), radial-gradient(ellipse at 85% 80%, rgba(236,72,153,0.20), transparent 50%)",
            }}
          />
        </motion.div>

        <div className="relative z-10 text-center px-4 max-w-4xl">
          <Reveal delay={0.1} y={20}>
            <div className="text-[11px] md:text-xs font-mono font-black tracking-[0.5em] text-white/40 mb-6">
              ARENA ORIGINS
            </div>
          </Reveal>
          <Reveal delay={0.25} y={32}>
            <h1
              className="text-7xl md:text-9xl lg:text-[10rem] font-black tracking-tight leading-none mb-4"
              style={{
                background: "linear-gradient(180deg, #ffffff 0%, #fb923c 60%, #ec4899 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "drop-shadow(0 8px 32px rgba(236,72,153,0.35))",
              }}
              data-testid="text-hero-title"
            >
              JANGO
            </h1>
          </Reveal>
          <Reveal delay={0.45} y={20}>
            <div className="text-xl md:text-3xl font-black text-white/90 mb-6 tracking-wide">
              The King of the Table
            </div>
          </Reveal>
          <Reveal delay={0.6} y={20}>
            <p className="text-base md:text-xl text-white/65 max-w-2xl mx-auto leading-relaxed mb-10">
              In the back alleys, under neon lights, where every move matters… one name rose above them all.
            </p>
          </Reveal>
          <Reveal delay={0.8} y={16}>
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
              <motion.div
                animate={reduced ? {} : { boxShadow: ["0 0 0px rgba(236,72,153,0)", "0 0 32px rgba(236,72,153,0.5)", "0 0 0px rgba(236,72,153,0)"] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                className="rounded-md"
              >
                <Button
                  size="lg"
                  data-testid="button-enter-arena-hero"
                  className="font-black text-base px-8 h-12"
                  style={{
                    background: "linear-gradient(135deg, #fb923c, #ec4899)",
                    color: "#0a0712",
                    border: "none",
                  }}
                  onClick={() => {
                    document.getElementById("section-origin")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Enter the Arena <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </motion.div>
              <Button
                size="lg"
                variant="outline"
                data-testid="button-read-story"
                className="font-bold text-base px-7 h-12 backdrop-blur-md border-white/20 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                onClick={() => document.getElementById("section-origin")?.scrollIntoView({ behavior: "smooth" })}
              >
                Read the Story
              </Button>
            </div>
          </Reveal>
        </div>

        {/* Scroll indicator */}
        {!reduced && (
          <motion.div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40"
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDown className="w-6 h-6" />
          </motion.div>
        )}
      </section>

      {/* ───────────────── 01. ORIGIN — "The Beginning" ───────────────── */}
      <section id="section-origin" className="relative py-24 md:py-36 px-4 md:px-8">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-center">
          <Reveal>
            <div
              className="relative aspect-[4/5] rounded-2xl overflow-hidden"
              style={{
                boxShadow: "0 32px 80px -16px rgba(0,0,0,0.7), 0 0 80px -24px rgba(251,146,60,0.3)",
              }}
            >
              <img src={originImg} alt="A boy beside the dice stand" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 40%, rgba(8,5,15,0.6) 100%)" }} />
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <GlassCard accent="251,146,60" className="p-8 md:p-10">
              <SectionEyebrow index="01" label="Origin" accent="251,146,60" />
              <SectionTitle className="mb-6">The Beginning</SectionTitle>
              <SectionBody>
                In the back alleys of Marula City, where neon lights flickered over smoke-filled card rooms,
                a boy named Jango learned the art of chance before he could even spell his own name. His mother
                ran a small dice stand in the slums, and Jango would sit beside her, watching coins change hands,
                eyes reading every twitch and tremor of the desperate.
              </SectionBody>
            </GlassCard>
          </Reveal>
        </div>
      </section>

      {/* ───────────────── 02. RISE — "Little Lion" ───────────────── */}
      <section className="relative py-24 md:py-36 overflow-hidden">
        <motion.div
          className="absolute inset-0"
          initial={{ scale: 1 }}
          whileInView={{ scale: reduced ? 1 : 1.06 }}
          viewport={{ once: true }}
          transition={{ duration: 6, ease: "easeOut" }}
        >
          <BackgroundArt src={riseImg} alt="Underground circuits" opacity={0.5} />
        </motion.div>
        <div className="relative max-w-4xl mx-auto px-4 md:px-8">
          <Reveal>
            <SectionEyebrow index="02" label="Rise" accent="236,72,153" />
            <SectionTitle className="mb-8">Little Lion</SectionTitle>
          </Reveal>
          <div className="space-y-5 text-lg md:text-2xl text-white/80 leading-relaxed font-medium max-w-[58ch]">
            {[
              "By the time he was sixteen, Jango was a legend in the underground circuits.",
              "They called him \u201CLittle Lion\u201D\u2014young, fast, and fearless.",
              "He never smiled when he won, never cursed when he lost.",
              "Every game was a hunt, and Jango was always the predator.",
            ].map((line, i) => (
              <Reveal key={i} delay={0.1 + i * 0.15} y={16}>
                <p>{line}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────── 03. DOMINATION — "The Scalps" ───────────────── */}
      <section className="relative py-24 md:py-36 overflow-hidden">
        <BackgroundArt src={scalpsImg} alt="The collection" opacity={0.4} />
        <ScalpsMist />
        <div className="relative max-w-4xl mx-auto px-4 md:px-8">
          <Reveal>
            <SectionEyebrow index="03" label="Domination" accent="168,85,247" />
            <SectionTitle className="mb-8">The Scalps</SectionTitle>
          </Reveal>
          <Reveal delay={0.15}>
            <SectionBody className="mb-6 max-w-[60ch]">
              He started with dice, then cards, then anything people were foolish enough to wager on—racing
              birds, dominoes, digital chips. No matter the game, Jango didn’t just win; he destroyed. His
              opponents said he could see through cards, through people, straight into their fear.
            </SectionBody>
          </Reveal>
          <Reveal delay={0.3}>
            <SectionBody className="max-w-[60ch]">
              Soon, gamblers whispered his name with dread. He was known for “taking scalps,” a phrase that
              meant crushing an opponent so completely that they never played again. Jango kept a list of every
              player he’d beaten—his “collection.” He didn’t need trophies; the names were enough.
            </SectionBody>
          </Reveal>
        </div>
      </section>

      {/* ───────────────── 04. PEAK — "The King" ───────────────── */}
      <section className="relative py-32 md:py-44 overflow-hidden">
        <BackgroundArt src={peakImg} alt="The kingdom" opacity={0.55} />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(251,191,36,0.18) 0%, transparent 50%)",
          }}
        />
        <div className="relative max-w-4xl mx-auto px-4 md:px-8 text-center">
          <Reveal>
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="text-[10px] font-mono font-black tracking-[0.3em] text-white/40">04</span>
              <span className="h-px w-12" style={{ background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.7), transparent)" }} />
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "rgb(251,191,36)" }}>The Peak</span>
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <h2
              className="text-5xl md:text-8xl font-black tracking-tight mb-8"
              style={{
                background: "linear-gradient(180deg, #fef3c7 0%, #fbbf24 50%, #f97316 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "drop-shadow(0 4px 24px rgba(251,191,36,0.45))",
              }}
            >
              The King
            </h2>
          </Reveal>
          <Reveal delay={0.3}>
            <p className="text-lg md:text-2xl text-white/80 max-w-3xl mx-auto leading-relaxed font-medium">
              By twenty-five, he ruled the gambling halls from Cape Meridian to Lagos Prime. No one dared face
              him head-to-head. Even the old masters who had built their lives on the shuffle and roll stayed
              away.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ───────────────── 05. STRANGER — "The One Who Didn't Flinch" ───────────────── */}
      <section className="relative py-24 md:py-36 overflow-hidden">
        <BackgroundArt src={strangerImg} alt="The stranger" opacity={0.4} />
        {/* Heavy vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.95) 100%)",
          }}
        />
        <div className="relative max-w-4xl mx-auto px-4 md:px-8">
          <Reveal>
            <SectionEyebrow index="05" label="Turning Point" accent="148,163,184" />
            <SectionTitle className="mb-8">The One Who Didn't Flinch</SectionTitle>
          </Reveal>
          <Reveal delay={0.15}>
            <SectionBody className="mb-6 max-w-[60ch]">
              But Jango grew bored. One night, a stranger sat across from him—a silent man in a dark coat,
              his eyes hidden behind mirrored lenses. They played for hours. For the first time, Jango’s pulse
              quickened. The stranger never flinched, never blinked.
            </SectionBody>
          </Reveal>
          <Reveal delay={0.3}>
            <SectionBody className="mb-8 max-w-[60ch]">
              At dawn, Jango pushed his final chips forward. The stranger matched him, then smiled.
            </SectionBody>
          </Reveal>
          <Reveal delay={0.45}>
            <blockquote
              className="relative pl-6 md:pl-8 text-xl md:text-3xl font-bold text-white/95 italic leading-snug max-w-[44ch]"
              style={{ borderLeft: "2px solid rgba(236,72,153,0.7)" }}
            >
              “Every king,” he said softly, “needs someone to take his crown.”
            </blockquote>
          </Reveal>
        </div>
      </section>

      {/* ───────────────── 06. LOSS — "The Fall" ───────────────── */}
      <section className="relative py-32 md:py-48 bg-black">
        <div className="max-w-4xl mx-auto px-4 md:px-8 text-center">
          <Reveal>
            <div className="text-[10px] font-mono font-black tracking-[0.4em] text-white/30 mb-8">06 / THE FALL</div>
          </Reveal>
          <Reveal delay={0.4} y={12}>
            <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight max-w-[24ch] mx-auto">
              When the cards were turned, Jango’s heart froze. He’d lost.
            </h2>
          </Reveal>
        </div>
      </section>

      {/* ───────────────── 07. LEGACY — "The Laugh" ───────────────── */}
      <section className="relative py-24 md:py-36 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 30% 40%, rgba(251,146,60,0.12), transparent 55%), radial-gradient(ellipse at 70% 60%, rgba(236,72,153,0.12), transparent 55%), linear-gradient(180deg, #0a0712 0%, #120818 100%)",
          }}
        />
        <div className="relative max-w-4xl mx-auto px-4 md:px-8">
          <Reveal>
            <SectionEyebrow index="07" label="Legacy" accent="251,146,60" />
            <SectionTitle className="mb-8">The Laugh</SectionTitle>
          </Reveal>
          <Reveal delay={0.15}>
            <SectionBody className="mb-6 max-w-[60ch]">
              But instead of rage, he laughed—a deep, relieved laugh that echoed through the empty hall.
            </SectionBody>
          </Reveal>
          <Reveal delay={0.3}>
            <blockquote
              className="my-8 pl-6 md:pl-8 text-xl md:text-3xl font-bold text-white/95 italic leading-snug max-w-[44ch]"
              style={{ borderLeft: "2px solid rgba(251,146,60,0.7)" }}
            >
              “Keep the pot,” he said. “You’ve earned your place in my collection.”
            </blockquote>
          </Reveal>
          <Reveal delay={0.45}>
            <SectionBody className="max-w-[60ch]">
              He rose, left his fortune behind, and vanished into the morning mist.
            </SectionBody>
          </Reveal>
        </div>
      </section>

      {/* ───────────────── 08. MYTH — "The Game Never Ends" ───────────────── */}
      <section className="relative py-32 md:py-44 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(56,189,248,0.10), transparent 60%), linear-gradient(180deg, #08050f 0%, #050309 100%)",
          }}
        />
        <MythParticles />
        <div className="relative max-w-4xl mx-auto px-4 md:px-8 text-center">
          <Reveal>
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-[10px] font-mono font-black tracking-[0.3em] text-white/40">08</span>
              <span className="h-px w-12" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)" }} />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/60">The Myth</span>
            </div>
          </Reveal>
          <Reveal delay={0.2}>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-black text-white tracking-tight leading-tight mb-10">
              The Game Never Ends
            </h2>
          </Reveal>
          <Reveal delay={0.4}>
            <p className="text-lg md:text-2xl text-white/70 max-w-3xl mx-auto leading-relaxed font-medium">
              Some say Jango still plays, drifting from city to city, chasing the perfect game—not for money,
              not for pride, but for the thrill of finding a rival worthy of being his final scalp.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ───────────────── FINAL CTA ───────────────── */}
      <section className="relative py-32 md:py-44 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 30%, rgba(236,72,153,0.20), transparent 55%), radial-gradient(ellipse at 50% 80%, rgba(251,146,60,0.18), transparent 55%), linear-gradient(180deg, #08050f 0%, #1a0a1f 100%)",
          }}
        />
        <div className="relative max-w-4xl mx-auto px-4 md:px-8 text-center">
          <Reveal>
            <h2
              className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight leading-tight mb-6"
              style={{
                background: "linear-gradient(180deg, #ffffff 0%, #fb923c 70%, #ec4899 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "drop-shadow(0 4px 32px rgba(236,72,153,0.4))",
              }}
              data-testid="text-final-cta-title"
            >
              Your name isn’t in the collection yet.
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="text-lg md:text-2xl text-white/70 mb-10 font-bold tracking-wide">
              Play. Compete. Take scalps.
            </p>
          </Reveal>
          <Reveal delay={0.35}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/">
                <Button
                  size="lg"
                  data-testid="button-enter-arena-final"
                  className="font-black text-base px-8 h-12"
                  style={{
                    background: "linear-gradient(135deg, #fb923c, #ec4899)",
                    color: "#0a0712",
                    border: "none",
                  }}
                >
                  Enter the Arena <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
              <Link href="/">
                <Button
                  size="lg"
                  variant="outline"
                  data-testid="button-play-now-final"
                  className="font-bold text-base px-7 h-12 backdrop-blur-md border-white/20 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                >
                  Play Now
                </Button>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
