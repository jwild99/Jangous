import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Trophy, Users, Zap, Shield, Star, ChevronRight, ArrowRight, Sword, Crown, BookOpen } from "lucide-react";
import { Link } from "wouter";
import { ChessIcon, MiniGolfIcon, Connect4Icon, DotsAndBoxesIcon, AirHockeyIcon, RockPaperScissorsIcon, EightBallIcon, BowlingIcon, CupKingIcon, StackTowerIcon } from "@/components/GameIcons";
import { TransparencyModal } from "@/components/TransparencyModal";
import { JangoLogo } from "@/components/JangoLogo";
import { useState, useEffect, useRef } from "react";

/* ─── Particle Network ──────────────────────────────────────────────── */
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);
    const sets = [{ r: 59, g: 130, b: 246 }, { r: 139, g: 92, b: 246 }, { r: 236, g: 72, b: 153 }];
    const particles = Array.from({ length: 55 }, () => {
      const c = sets[Math.floor(Math.random() * sets.length)];
      return { x: Math.random() * canvas.width, y: Math.random() * canvas.height, vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28, size: Math.random() * 1.4 + 0.3, alpha: Math.random() * 0.3 + 0.04, ...c };
    });
    let id: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${p.alpha})`; ctx.fill();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) { ctx.beginPath(); ctx.strokeStyle = `rgba(59,130,246,${0.04 * (1 - dist / 110)})`; ctx.lineWidth = 0.5; ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y); ctx.stroke(); }
        }
      }
      id = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(id); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

/* ─── Floating product background widgets ────────────────────────────── */
function FloatingMatchCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotate: -4 }}
      animate={{ opacity: 1, y: 0, rotate: -4 }}
      transition={{ duration: 1.2, delay: 0.9 }}
      className="absolute left-[3%] top-[22%] w-52 pointer-events-none select-none hidden lg:block"
      style={{ filter: "blur(1px)" }}
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-3.5 shadow-xl opacity-40"
      >
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            MATCH FOUND
          </span>
          <span className="text-[9px] text-white/40">Chess · $5.00</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-blue-500/40 border border-blue-400/30 flex items-center justify-center">
            <ChessIcon className="w-3 h-3 text-blue-300" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-semibold text-white/80">GrandMaster_K</div>
            <div className="text-[9px] text-white/40">ELO 1847</div>
          </div>
        </div>
        <div className="text-center text-[9px] text-white/30 my-1.5 font-mono tracking-widest">VS</div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-violet-500/40 border border-violet-400/30 flex items-center justify-center">
            <ChessIcon className="w-3 h-3 text-violet-300" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-semibold text-white/80">NightRider_X</div>
            <div className="text-[9px] text-white/40">ELO 1802</div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function FloatingLeaderboard() {
  const entries = [
    { name: "ShadowAce",   score: "2,841", color: "text-amber-400"  },
    { name: "GrandMaster_K", score: "1,847", color: "text-slate-300" },
    { name: "NightRider_X",  score: "1,802", color: "text-slate-300" },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotate: 4 }}
      animate={{ opacity: 1, y: 0, rotate: 4 }}
      transition={{ duration: 1.2, delay: 1.1 }}
      className="absolute right-[3%] top-[18%] w-48 pointer-events-none select-none hidden lg:block"
      style={{ filter: "blur(0.8px)" }}
    >
      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-3.5 shadow-xl opacity-35"
      >
        <div className="flex items-center gap-1.5 mb-3">
          <Crown className="w-3 h-3 text-amber-400" />
          <span className="text-[10px] font-semibold text-white/60 tracking-wide">LEADERBOARD</span>
        </div>
        <div className="space-y-2">
          {entries.map((e, i) => (
            <div key={e.name} className="flex items-center gap-2">
              <span className={`text-[10px] font-bold font-mono w-3 ${i === 0 ? "text-amber-400" : "text-white/30"}`}>{i + 1}</span>
              <div className="flex-1">
                <div className="text-[10px] font-medium text-white/70">{e.name}</div>
              </div>
              <span className={`text-[10px] font-mono font-bold ${e.color}`}>{e.score}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function FloatingChallengeCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotate: 3 }}
      animate={{ opacity: 1, y: 0, rotate: 3 }}
      transition={{ duration: 1.2, delay: 1.3 }}
      className="absolute right-[4%] bottom-[22%] w-44 pointer-events-none select-none hidden xl:block"
      style={{ filter: "blur(1.2px)" }}
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="rounded-2xl border border-pink-500/20 bg-pink-500/5 backdrop-blur-xl p-3 shadow-xl opacity-35"
      >
        <div className="flex items-center gap-1.5 mb-2">
          <Sword className="w-3 h-3 text-pink-400" />
          <span className="text-[9px] font-semibold text-pink-300/70 tracking-wide">CHALLENGE</span>
        </div>
        <div className="text-[10px] text-white/60 mb-1"><span className="text-white/80 font-medium">BlitzKing</span> challenged you</div>
        <div className="text-[9px] text-white/40">8-Ball Pool · $10 wager</div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Difficulty config ──────────────────────────────────────────────── */
const difficultyConfig: Record<string, { color: string }> = {
  Beginner: { color: "text-emerald-400" },
  Easy:     { color: "text-emerald-400" },
  Medium:   { color: "text-amber-400"  },
  Advanced: { color: "text-rose-400"   },
};

/* ─── Main component ─────────────────────────────────────────────────── */
export default function Landing() {
  const [transparencyOpen, setTransparencyOpen] = useState(false);

  const games = [
    { name: "Chess",               icon: ChessIcon,             description: "Strategic warfare on 64 squares",               difficulty: "Advanced", border: "border-blue-500/30",   bg: "bg-blue-500/10",   iconBg: "bg-blue-500/20 border-blue-500/30",   iconColor: "text-blue-300"   },
    { name: "Mini Golf",           icon: MiniGolfIcon,          description: "Precision putting through challenging courses",  difficulty: "Medium",   border: "border-green-500/30",  bg: "bg-green-500/10",  iconBg: "bg-green-500/20 border-green-500/30",  iconColor: "text-green-300"  },
    { name: "Connect 4",           icon: Connect4Icon,          description: "Four in a row tactical competition",             difficulty: "Beginner", border: "border-yellow-500/30", bg: "bg-yellow-500/10", iconBg: "bg-yellow-500/20 border-yellow-500/30", iconColor: "text-yellow-300" },
    { name: "Air Hockey",          icon: AirHockeyIcon,         description: "Fast-paced puck action with real physics",       difficulty: "Medium",   border: "border-cyan-500/30",   bg: "bg-cyan-500/10",   iconBg: "bg-cyan-500/20 border-cyan-500/30",   iconColor: "text-cyan-300"   },
    { name: "Rock Paper Scissors", icon: RockPaperScissorsIcon, description: "Best-of-3 tactical showdown",                    difficulty: "Beginner", border: "border-purple-500/30", bg: "bg-purple-500/10", iconBg: "bg-purple-500/20 border-purple-500/30", iconColor: "text-purple-300" },
    { name: "Dots & Boxes",        icon: DotsAndBoxesIcon,      description: "Tactical box-claiming strategy game",            difficulty: "Beginner", border: "border-pink-500/30",   bg: "bg-pink-500/10",   iconBg: "bg-pink-500/20 border-pink-500/30",   iconColor: "text-pink-300"   },
    { name: "8-Ball Pool",         icon: EightBallIcon,         description: "Classic billiards with realistic physics",       difficulty: "Medium",   border: "border-slate-400/30",  bg: "bg-slate-400/10",  iconBg: "bg-slate-400/20 border-slate-400/30",  iconColor: "text-slate-300"  },
    { name: "Bowling",             icon: BowlingIcon,           description: "Knock down pins with strategic throws",          difficulty: "Medium",   border: "border-orange-500/30", bg: "bg-orange-500/10", iconBg: "bg-orange-500/20 border-orange-500/30", iconColor: "text-orange-300" },
    { name: "Cup King",            icon: CupKingIcon,           description: "Beer pong precision challenge",                  difficulty: "Medium",   border: "border-teal-500/30",   bg: "bg-teal-500/10",   iconBg: "bg-teal-500/20 border-teal-500/30",   iconColor: "text-teal-300"   },
    { name: "Stack Tower",         icon: StackTowerIcon,        description: "Perfect block stacking duel",                    difficulty: "Easy",     border: "border-lime-500/30",   bg: "bg-lime-500/10",   iconBg: "bg-lime-500/20 border-lime-500/30",   iconColor: "text-lime-300"   },
  ];

  const stats = [
    { label: "Players Online",  value: "1,247", icon: Users,  iconColor: "text-blue-400",    iconBg: "bg-blue-500/15 border-blue-400/20",    glow: "shadow-blue-500/15"    },
    { label: "Active Matches",  value: "342",   icon: Zap,    iconColor: "text-amber-400",   iconBg: "bg-amber-500/15 border-amber-400/20",   glow: "shadow-amber-500/15"   },
    { label: "Today's Winners", value: "891",   icon: Trophy, iconColor: "text-emerald-400", iconBg: "bg-emerald-500/15 border-emerald-400/20", glow: "shadow-emerald-500/15" },
  ];

  const features = [
    { icon: Zap,          title: "Real-Time Gameplay",   description: "Lag-free synchronous matches with instant move updates powered by WebSocket technology.",               color: "text-amber-400",   bg: "bg-amber-400/10",   border: "border-amber-400/20"   },
    { icon: Trophy,       title: "Skill-Based Matches",  description: "Pure player vs player competition. Every outcome is decided by your skill — no house advantage, ever.", color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
    { icon: Users,        title: "Global Leaderboards",  description: "Compete for top ELO rankings worldwide. Climb from Bronze all the way to Legend tier.",                 color: "text-blue-400",    bg: "bg-blue-400/10",    border: "border-blue-400/20"    },
    { icon: Shield,       title: "Fair Play Guaranteed", description: "Server-authoritative engines and anti-cheat validation ensure every match is completely fair.",          color: "text-purple-400",  bg: "bg-purple-400/10",  border: "border-purple-400/20"  },
    { icon: Star,         title: "ELO Rating System",    description: "Adaptive K-factor ratings per game with Bronze to Legend tiers and anti-smurf protection.",             color: "text-pink-400",    bg: "bg-pink-400/10",    border: "border-pink-400/20"    },
    { icon: ChevronRight, title: "Daily Rewards",        description: "Login streaks, achievement badges, and escalating bonuses keep the competition fresh every day.",       color: "text-cyan-400",    bg: "bg-cyan-400/10",    border: "border-cyan-400/20"    },
  ];

  return (
    <div className="min-h-screen glass-bg overflow-x-hidden">

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">

        {/* Layer 0 — deep base gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(232,45%,5%)] via-[hsl(230,38%,7%)] to-background" />

        {/* Layer 1 — animated glow clouds */}
        <motion.div
          className="absolute top-[-15%] left-[10%] w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.09) 0%, transparent 70%)" }}
          animate={{ scale: [1, 1.12, 1], x: [0, 30, 0], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-[5%] right-[5%] w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.09) 0%, transparent 70%)" }}
          animate={{ scale: [1, 1.08, 1], x: [0, -20, 0], opacity: [0.6, 0.95, 0.6] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        <motion.div
          className="absolute bottom-[5%] left-[20%] w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(236,72,153,0.07) 0%, transparent 70%)" }}
          animate={{ scale: [1, 1.15, 1], y: [0, -25, 0], opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        />
        <motion.div
          className="absolute bottom-[10%] right-[15%] w-[350px] h-[350px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)" }}
          animate={{ scale: [1, 1.1, 1], y: [0, 20, 0], opacity: [0.55, 0.9, 0.55] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 6 }}
        />

        {/* Layer 2 — light streak accents */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[30%] left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/8 to-transparent" />
          <div className="absolute top-[60%] left-0 w-full h-px bg-gradient-to-r from-transparent via-violet-500/6 to-transparent" />
        </div>

        {/* Layer 3 — particle network */}
        <div className="absolute inset-0 z-[2] opacity-55">
          <ParticleCanvas />
        </div>

        {/* Layer 3.5 — subtle grid */}
        <div className="absolute inset-0 z-[2] [background-image:linear-gradient(hsl(217_91%_60%_/_0.025)_1px,transparent_1px),linear-gradient(90deg,hsl(217_91%_60%_/_0.025)_1px,transparent_1px)] [background-size:80px_80px]" />

        {/* Layer 4 — center spotlight */}
        <div className="absolute inset-0 z-[2] bg-[radial-gradient(ellipse_70%_55%_at_50%_40%,hsl(217_91%_60%_/_0.055),transparent)]" />

        {/* Layer 5 — floating product UI (background, blurred) */}
        <div className="absolute inset-0 z-[3]">
          <FloatingMatchCard />
          <FloatingLeaderboard />
          <FloatingChallengeCard />
        </div>

        {/* Layer 6 — hero content */}
        <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-8 text-center py-28">

          {/* Brand lockup */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.05 }}
            className="flex flex-col items-center gap-2 mb-8"
          >
            <JangoLogo size="lg" />
            <span className="text-[11px] font-mono tracking-[0.3em] uppercase text-white/35">competitive gaming platform</span>
          </motion.div>

          {/* Live badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-sm font-medium mb-8 backdrop-blur-md"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/55 text-xs tracking-wide">Live &mdash; 1,247 players online now</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.28 }}
            className="text-5xl sm:text-7xl md:text-[82px] font-bold font-display leading-[1.04] tracking-tight mb-4"
          >
            <span className="block text-white">Bet on Skill,</span>
            <span className="block text-white/85">Not Luck.</span>
          </motion.h1>

          {/* Supporting text */}
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.42 }}
            className="text-base md:text-lg text-white/45 mb-10 tracking-wide font-medium"
          >
            Real players.&nbsp;&nbsp;Real competition.&nbsp;&nbsp;Pure skill.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.52 }}
            className="flex flex-col sm:flex-row gap-3 justify-center mb-14 flex-wrap"
          >
            <Button
              size="lg"
              className="text-base px-10 gap-2 shadow-xl shadow-primary/30 relative overflow-visible"
              onClick={() => (window.location.href = "/auth")}
              data-testid="button-start-playing"
            >
              Start Playing
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-base px-10 backdrop-blur-xl bg-white/6 border-white/15 text-white/80"
              onClick={() => document.getElementById("games")?.scrollIntoView({ behavior: "smooth" })}
              data-testid="button-view-games"
            >
              View Games
            </Button>
          </motion.div>

          {/* Apple Glass stat panels */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.62 }}
            className="flex flex-wrap gap-5 justify-center"
          >
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.65 + i * 0.09 }}
                  className={`flex flex-col items-center gap-2.5 px-7 py-5 rounded-2xl backdrop-blur-2xl bg-white/6 border border-white/10 shadow-2xl ${stat.glow} min-w-[120px]`}
                  data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${stat.iconBg}`}>
                    <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                  </div>
                  <span className="font-bold text-2xl font-mono text-white tracking-tight leading-none">{stat.value}</span>
                  <span className="text-[11px] text-white/40 font-medium tracking-widest uppercase">{stat.label}</span>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />
      </section>

      {/* ── DIVIDER ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center py-4 overflow-hidden px-8">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="mx-6 flex items-center gap-2 text-primary/60">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-mono tracking-widest uppercase">Arena</span>
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      </div>

      {/* ── GAMES GRID ───────────────────────────────────────────────── */}
      <section id="games" className="py-20 px-4 md:px-8 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_50%,hsl(217_91%_60%_/_0.04),transparent)] pointer-events-none" />

        <div className="max-w-6xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <p className="text-sm font-mono tracking-widest uppercase text-primary mb-3">Choose Your Game</p>
            <h2 className="text-4xl md:text-5xl font-bold font-display mb-4">The Arena</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">Ten battlefields, one goal &mdash; prove you&apos;re the best</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {games.map((game, index) => {
              const Icon = game.icon;
              const diff = difficultyConfig[game.difficulty] ?? difficultyConfig["Medium"];
              return (
                <motion.div
                  key={game.name}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: index * 0.05 }}
                  viewport={{ once: true }}
                >
                  <div
                    className={`group rounded-xl border ${game.border} ${game.bg} hover-elevate cursor-pointer p-5 flex flex-col gap-3 transition-shadow duration-300 overflow-hidden relative`}
                    data-testid={`game-card-${game.name.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {/* Top shimmer on hover */}
                    <div className={`absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${game.border.replace("border-", "bg-").replace("/30", "/60")}`} />
                    <div className="flex items-start justify-between gap-2">
                      <div className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${game.iconBg}`}>
                        <Icon className={`w-5 h-5 ${game.iconColor}`} />
                      </div>
                      <span className={`text-xs font-semibold ${diff.color} mt-1`}>{game.difficulty}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">{game.name}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{game.description}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <Button
              size="lg"
              className="gap-2 shadow-lg shadow-primary/25"
              onClick={() => (window.location.href = "/auth")}
              data-testid="button-join-now"
            >
              Join the Arena
              <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ── DIVIDER ──────────────────────────────────────────────────── */}
      <div className="px-8">
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* ── FEATURES ─────────────────────────────────────────────────── */}
      <section className="py-20 px-4 md:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_80%_50%,hsl(270_75%_65%_/_0.04),transparent)] pointer-events-none" />

        <div className="max-w-6xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <p className="text-sm font-mono tracking-widest uppercase text-primary mb-3">Why Jango</p>
            <h2 className="text-4xl md:text-5xl font-bold font-display mb-4">Built for Champions</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">Everything you need for serious competitive gaming &mdash; nothing you don&apos;t</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: index * 0.07 }}
                  viewport={{ once: true }}
                  className={`rounded-xl border ${feature.border} ${feature.bg} p-6 flex flex-col gap-4 relative overflow-hidden group hover-elevate`}
                  data-testid={`feature-${feature.title.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${feature.border} ${feature.bg}`}>
                    <Icon className={`w-6 h-6 ${feature.color}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── ARENA ORIGINS TEASER ─────────────────────────────────────── */}
      <section className="py-20 px-4 md:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[hsl(232,45%,5%)]/40 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_55%_at_50%_50%,hsl(217_91%_60%_/_0.06),transparent)] pointer-events-none" />

        <div className="max-w-4xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-8 md:p-12 shadow-2xl shadow-primary/10 relative overflow-hidden"
            data-testid="section-arena-origins-teaser"
          >
            <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)" }} />
            <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)" }} />

            <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8">
              <div className="w-14 h-14 rounded-xl border border-white/15 bg-white/5 backdrop-blur-xl flex items-center justify-center shrink-0">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono tracking-[0.3em] uppercase text-primary/80 mb-2">Arena Origins</p>
                <h2 className="text-2xl md:text-3xl font-bold font-display text-white mb-2 leading-tight">
                  Born from the love of the game.
                </h2>
                <p className="text-sm md:text-base text-white/55 leading-relaxed max-w-xl">
                  A real-time competitive coliseum &mdash; built for the players who never stopped playing.
                </p>
              </div>

              <Button
                size="lg"
                variant="outline"
                asChild
                className="backdrop-blur-xl bg-white/6 border-white/15 text-white/85 gap-2 shrink-0 w-full md:w-auto"
                data-testid="button-arena-origins-teaser"
              >
                <Link href="/arena-origins">
                  Read the Origin Story
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA BAND ─────────────────────────────────────────────────── */}
      <section className="py-20 px-4 md:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10" />
        <div className="absolute inset-0 [background-image:linear-gradient(hsl(217_91%_60%_/_0.06)_1px,transparent_1px),linear-gradient(90deg,hsl(217_91%_60%_/_0.06)_1px,transparent_1px)] [background-size:40px_40px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <div className="max-w-3xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold font-display mb-5">
              Ready to prove{" "}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                your skill?
              </span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
              Join thousands of players competing daily. Your legend starts today.
            </p>
            <Button
              size="lg"
              className="text-base px-12 gap-2 shadow-xl shadow-primary/30"
              onClick={() => (window.location.href = "/auth")}
              data-testid="button-cta-signup"
            >
              Create Free Account
              <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────── */}
      <footer className="border-t py-10 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 flex-wrap">
            <div>
              <div className="mb-1">
                <JangoLogo size="md" />
              </div>
              <p className="text-xs text-muted-foreground">Skill-based competitive gaming platform</p>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button variant="ghost" size="sm" asChild className="text-sm text-muted-foreground">
                <a href="/terms">Terms of Service</a>
              </Button>
              <Button variant="ghost" size="sm" asChild className="text-sm text-muted-foreground">
                <a href="/privacy">Privacy Policy</a>
              </Button>
              <Button variant="ghost" size="sm" asChild className="text-sm text-muted-foreground">
                <a href="/contact">Contact</a>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setTransparencyOpen(true)} className="text-sm text-muted-foreground" data-testid="button-transparency">
                <Shield className="w-4 h-4 mr-1.5" />
                Fair Play
              </Button>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} Jango.us. All rights reserved.</p>
            <p className="text-xs text-muted-foreground">Players must be 18+. Play responsibly.</p>
          </div>
        </div>
      </footer>

      <TransparencyModal open={transparencyOpen} onOpenChange={setTransparencyOpen} />
    </div>
  );
}
