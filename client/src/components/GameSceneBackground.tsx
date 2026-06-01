import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Pool Table Scene ─────────────────────────────────────────────────────────
function PoolScene({ playHover }: { playHover: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Felt surface */}
      <div className="absolute inset-0" style={{
        background: "linear-gradient(160deg, #0f3320 0%, #1a4a2a 40%, #0d2d1c 100%)",
      }} />
      {/* Felt texture via repeating radial dots */}
      <div className="absolute inset-0 opacity-[0.06]" style={{
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
        backgroundSize: "6px 6px",
      }} />
      {/* Table cushion edges */}
      <div className="absolute inset-0" style={{
        boxShadow: "inset 0 0 80px rgba(0,0,0,0.7), inset 0 0 200px rgba(0,0,0,0.4)",
      }} />
      {/* Spotlight from above */}
      <motion.div className="absolute inset-x-0 top-0 h-[70%]"
        animate={{ opacity: playHover ? 0.7 : 0.45, scaleX: playHover ? 1.15 : 1 }}
        transition={{ duration: 0.6 }}
        style={{
          background: "radial-gradient(ellipse 50% 60% at 50% -10%, rgba(255,255,220,0.18) 0%, transparent 70%)",
          transformOrigin: "top center",
        }} />
      {/* Table lines */}
      <div className="absolute left-[12%] right-[12%] top-[15%] bottom-[15%] rounded-lg border border-white/8" />
      <div className="absolute left-1/2 top-[15%] bottom-[15%] w-px bg-white/10 -translate-x-px" />
      {/* Center circle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-white/12" />
      {/* Corner pockets */}
      {[["12%","15%"],["88%","15%"],["12%","85%"],["88%","85%"]].map(([l, t], i) => (
        <div key={i} className="absolute w-5 h-5 rounded-full bg-black/60 border border-black/80"
          style={{ left: l, top: t, transform: "translate(-50%, -50%)" }} />
      ))}
      {/* Middle pockets */}
      {[["50%","15%"],["50%","85%"]].map(([l, t], i) => (
        <div key={i + 4} className="absolute w-4 h-4 rounded-full bg-black/60 border border-black/80"
          style={{ left: l, top: t, transform: "translate(-50%, -50%)" }} />
      ))}
      {/* Pool balls */}
      {[
        { cx: "30%", cy: "45%", c1: "#e63946", c2: "#c1121f", stripe: false },
        { cx: "70%", cy: "55%", c1: "#ffd700", c2: "#f59e0b", stripe: true },
        { cx: "55%", cy: "38%", c1: "#2d6a4f", c2: "#1a4035", stripe: false },
        { cx: "42%", cy: "62%", c1: "#e76f51", c2: "#d45b3e", stripe: true },
        { cx: "50%", cy: "50%", c1: "#111", c2: "#222", stripe: false },
        { cx: "65%", cy: "40%", c1: "#fff", c2: "#eee", stripe: false },
      ].map((b, i) => (
        <motion.div key={i}
          className="absolute rounded-full"
          style={{
            left: b.cx, top: b.cy,
            width: 28, height: 28,
            transform: "translate(-50%, -50%)",
            background: `radial-gradient(circle at 35% 35%, ${b.c1}, ${b.c2})`,
            boxShadow: `0 4px 12px rgba(0,0,0,0.6), inset 0 -2px 6px rgba(0,0,0,0.4), 0 0 8px rgba(0,0,0,0.3)`,
          }}
          animate={{ y: [0, -2, 0], rotate: [0, 8, 0] }}
          transition={{ duration: 3 + i * 0.7, repeat: Infinity, ease: "easeInOut" }}
        >
          {b.stripe && (
            <div className="absolute inset-x-0 top-[30%] h-[40%] rounded-full opacity-70"
              style={{ background: `linear-gradient(90deg, transparent 20%, ${b.c1} 20%, ${b.c1} 80%, transparent 80%)` }} />
          )}
        </motion.div>
      ))}
      {/* Cue stick */}
      <motion.div
        className="absolute"
        style={{
          left: "15%", top: "30%",
          width: 180, height: 8,
          transformOrigin: "right center",
          transform: "rotate(-22deg)",
          background: "linear-gradient(90deg, #8B6914, #d4a843, #8B6914, #5c4210)",
          borderRadius: 4,
          boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
        }}
        animate={{ x: [0, -4, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Moving light reflection */}
      <motion.div className="absolute inset-0 pointer-events-none"
        animate={{ backgroundPosition: ["0% 0%", "100% 100%"] }}
        transition={{ duration: 8, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
        style={{
          background: "radial-gradient(ellipse 20% 10% at 50% 50%, rgba(255,255,255,0.04), transparent 80%)",
          backgroundSize: "200% 200%",
        }} />
    </div>
  );
}

// ─── Air Hockey Scene ─────────────────────────────────────────────────────────
function AirHockeyScene({ playHover }: { playHover: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Dark surface */}
      <div className="absolute inset-0" style={{
        background: "linear-gradient(160deg, #000814 0%, #001d3d 50%, #000a1a 100%)",
      }} />
      {/* Glow pulses */}
      <motion.div className="absolute inset-0"
        animate={{ opacity: [0.3, 0.55, 0.3] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        style={{ background: "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(0,200,255,0.08), transparent 70%)" }} />
      {/* Table boundary */}
      <div className="absolute left-[8%] right-[8%] top-[12%] bottom-[12%] rounded-xl border-2"
        style={{ borderColor: "rgba(0,220,255,0.35)", boxShadow: "0 0 20px rgba(0,220,255,0.15), inset 0 0 30px rgba(0,220,255,0.05)" }} />
      {/* Center line */}
      <motion.div className="absolute left-[8%] right-[8%] top-1/2 h-[2px] -translate-y-px"
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 1.8, repeat: Infinity }}
        style={{ background: "linear-gradient(90deg, transparent, rgba(0,220,255,0.6), transparent)" }} />
      {/* Center circle */}
      <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-2"
        animate={{ borderColor: ["rgba(0,200,255,0.4)", "rgba(0,200,255,0.75)", "rgba(0,200,255,0.4)"] }}
        transition={{ duration: 2, repeat: Infinity }} />
      {/* Goal areas */}
      {[["50%","12%"], ["50%","88%"]].map(([l, t], i) => (
        <div key={i} className="absolute w-[20%] h-[8%] border-t-0 rounded-b-xl border-2"
          style={{
            left: l, top: t,
            transform: i === 0 ? "translate(-50%, 0) rotate(0deg)" : "translate(-50%, -100%)",
            borderColor: "rgba(0,220,255,0.3)",
            background: "rgba(0,220,255,0.04)",
          }} />
      ))}
      {/* Moving puck with glow trail */}
      <motion.div
        className="absolute rounded-full"
        animate={{
          x: ["-80px", "80px", "40px", "-60px", "-80px"],
          y: ["-30px", "50px", "-20px", "60px", "-30px"],
        }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        style={{
          left: "48%", top: "48%",
          width: 24, height: 24,
          background: "radial-gradient(circle at 35% 35%, rgba(0,240,255,0.9), rgba(0,180,255,0.6))",
          boxShadow: "0 0 20px rgba(0,220,255,0.8), 0 0 40px rgba(0,180,255,0.4)",
        }}>
        {/* Motion trail */}
        <motion.div className="absolute rounded-full"
          animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          style={{ inset: 0, background: "rgba(0,220,255,0.5)", borderRadius: "50%" }} />
      </motion.div>
      {/* Strikers */}
      {[{ l: "30%", t: "28%" }, { l: "70%", t: "72%" }].map((s, i) => (
        <motion.div key={i} className="absolute rounded-full border-2"
          style={{
            left: s.l, top: s.t,
            width: 36, height: 36,
            transform: "translate(-50%,-50%)",
            background: "radial-gradient(circle at 40% 40%, rgba(0,240,255,0.3), rgba(0,120,180,0.15))",
            borderColor: "rgba(0,220,255,0.6)",
            boxShadow: "0 0 12px rgba(0,220,255,0.4)",
          }}
          animate={{ y: [0, i === 0 ? -8 : 8, 0] }}
          transition={{ duration: 2.5 + i, repeat: Infinity, ease: "easeInOut" }} />
      ))}
      {/* Grid lines */}
      <div className="absolute left-[8%] right-[8%] top-[12%] bottom-[12%] opacity-[0.06]" style={{
        backgroundImage: "linear-gradient(rgba(0,220,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(0,220,255,0.8) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />
      {/* Spotlight intensity on hover */}
      <motion.div className="absolute inset-0 pointer-events-none"
        animate={{ opacity: playHover ? 0.5 : 0 }}
        transition={{ duration: 0.5 }}
        style={{ background: "radial-gradient(ellipse 40% 40% at 50% 50%, rgba(0,220,255,0.15), transparent 70%)" }} />
    </div>
  );
}

// ─── Mini Golf Scene ──────────────────────────────────────────────────────────
function MiniGolfScene({ playHover }: { playHover: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Sky background */}
      <div className="absolute inset-0" style={{
        background: "linear-gradient(180deg, #0a1628 0%, #0d2d1a 40%, #1a4a1a 100%)",
      }} />
      {/* Ground / course plane */}
      <div className="absolute bottom-0 left-0 right-0 h-[55%]"
        style={{ background: "linear-gradient(180deg, #1e5e1e 0%, #2d7a2d 30%, #1a5a1a 100%)" }} />
      {/* Grass texture */}
      <div className="absolute bottom-0 left-0 right-0 h-[55%] opacity-[0.08]" style={{
        backgroundImage: "repeating-linear-gradient(90deg, rgba(0,0,0,0.3) 0px, transparent 2px, transparent 18px, rgba(0,0,0,0.3) 20px)",
      }} />
      {/* Fairway - lighter strip */}
      <div className="absolute bottom-[8%] left-[15%] right-[20%] h-[25%]"
        style={{ background: "linear-gradient(90deg, transparent, rgba(100,200,80,0.15) 20%, rgba(100,200,80,0.15) 80%, transparent)" }} />
      {/* Hole */}
      <div className="absolute" style={{ left: "72%", bottom: "22%" }}>
        <div className="w-8 h-4 rounded-full bg-black/70 border border-black/80" />
      </div>
      {/* Flag pole */}
      <motion.div className="absolute" style={{ left: "calc(72% + 10px)", bottom: "21%" }}>
        <div className="w-0.5 h-20 bg-white/60 absolute bottom-0 left-0" />
        <motion.div
          className="absolute w-8 h-5 top-0 left-0.5"
          animate={{ skewX: [-8, 8, -8] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          style={{ background: "linear-gradient(135deg, #FF2D8A, #FF7A00)", transformOrigin: "left center" }}
        />
      </motion.div>
      {/* Rolling ball with physics animation */}
      <motion.div
        className="absolute rounded-full"
        animate={{
          x: [0, 60, 120, 180, 220, 260, 280, 290],
          y: [0, -8, -5, -10, -4, -2, 0, 2],
          rotate: [0, 180, 360, 540, 720, 900, 1080, 1200],
        }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeIn", repeatDelay: 1.5 }}
        style={{
          left: "15%", bottom: "calc(22% + 6px)",
          width: 16, height: 16,
          background: "radial-gradient(circle at 35% 35%, #ffffff, #dddddd)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}>
        {/* Dimple line */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-black/20" />
      </motion.div>
      {/* Wind particles */}
      {[...Array(8)].map((_, i) => (
        <motion.div key={i}
          className="absolute w-1 h-px rounded-full bg-white/20"
          style={{ left: `${10 + i * 12}%`, bottom: `${30 + (i % 3) * 8}%` }}
          animate={{ x: [0, 30, 0], opacity: [0, 0.4, 0] }}
          transition={{ duration: 2 + i * 0.3, delay: i * 0.4, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      {/* Trees / bushes in distance */}
      {[["8%","28%","40px","60px"], ["85%","30%","30px","50px"], ["78%","27%","25px","45px"]].map(([l, b, w, h], i) => (
        <div key={i} className="absolute rounded-t-full"
          style={{ left: l, bottom: b, width: w, height: h, background: "rgba(20,80,20,0.6)" }} />
      ))}
      {/* Sky ambient glow */}
      <div className="absolute inset-x-0 top-0 h-1/2"
        style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(34,197,94,0.06), transparent 70%)" }} />
      <motion.div className="absolute inset-0 pointer-events-none"
        animate={{ opacity: playHover ? 0.4 : 0 }}
        transition={{ duration: 0.5 }}
        style={{ background: "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(100,200,80,0.12), transparent 70%)" }} />
    </div>
  );
}

// ─── Chess Scene ──────────────────────────────────────────────────────────────
function ChessScene({ playHover }: { playHover: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, #0a0808 0%, #1a1210 50%, #0d0b0a 100%)" }} />
      {/* Marble chessboard in perspective */}
      <div className="absolute" style={{ bottom: "-10%", left: "5%", right: "5%", height: "65%", perspective: "600px" }}>
        <div className="w-full h-full" style={{ transform: "rotateX(50deg) scale(1.3)", transformOrigin: "bottom center" }}>
          {Array.from({ length: 8 }).map((_, row) =>
            Array.from({ length: 8 }).map((_, col) => (
              <div key={`${row}-${col}`}
                className="absolute"
                style={{
                  left: `${col * 12.5}%`, top: `${row * 12.5}%`,
                  width: "12.5%", height: "12.5%",
                  background: (row + col) % 2 === 0
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(0,0,0,0.35)",
                }} />
            ))
          )}
        </div>
      </div>
      {/* Piece silhouettes */}
      {[
        { l: "25%", b: "35%", h: 50, shape: "king" },
        { l: "75%", b: "35%", h: 44, shape: "queen" },
        { l: "40%", b: "28%", h: 35, shape: "rook" },
        { l: "60%", b: "28%", h: 35, shape: "bishop" },
      ].map((p, i) => (
        <motion.div key={i}
          className="absolute flex flex-col items-center justify-end"
          style={{ left: p.l, bottom: p.b, transform: "translate(-50%, 0)" }}
          animate={{ y: [0, -4, 0], opacity: [0.12, 0.2, 0.12] }}
          transition={{ duration: 3 + i * 0.8, repeat: Infinity, ease: "easeInOut" }}>
          <div style={{ width: 12, height: p.h, background: "rgba(255,255,255,0.15)", borderRadius: "3px 3px 0 0" }} />
          <div style={{ width: 20, height: 4, background: "rgba(255,255,255,0.1)" }} />
        </motion.div>
      ))}
      {/* Amber glow */}
      <div className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 50% 40% at 50% 60%, rgba(180,120,20,0.08), transparent 70%)" }} />
      <motion.div className="absolute inset-0 pointer-events-none"
        animate={{ opacity: playHover ? 0.5 : 0 }} transition={{ duration: 0.5 }}
        style={{ background: "radial-gradient(ellipse 40% 40% at 50% 50%, rgba(200,150,30,0.14), transparent 70%)" }} />
    </div>
  );
}

// ─── Connect 4 Scene ──────────────────────────────────────────────────────────
function Connect4Scene({ playHover }: { playHover: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, #040818 0%, #0a1230 50%, #06091e 100%)" }} />
      {/* Board */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: "min(80%, 480px)", aspectRatio: "7/6" }}>
        <div className="w-full h-full rounded-2xl border-2 border-blue-500/25 bg-blue-900/15 backdrop-blur-sm
          grid"
          style={{ gridTemplateColumns: "repeat(7, 1fr)", gridTemplateRows: "repeat(6, 1fr)", gap: "4px", padding: "8px" }}>
          {Array.from({ length: 42 }).map((_, i) => {
            const col = i % 7;
            const row = Math.floor(i / 7);
            const isRed = [5, 12, 13, 19, 20, 26, 27].includes(i);
            const isYellow = [11, 18, 25, 32, 33, 34].includes(i);
            return (
              <motion.div key={i} className="rounded-full"
                style={{
                  background: isRed ? "radial-gradient(circle at 35% 35%, #ff6b6b, #cc0000)"
                    : isYellow ? "radial-gradient(circle at 35% 35%, #ffd700, #cc9000)"
                    : "rgba(0,0,0,0.5)",
                  boxShadow: isRed ? "0 0 8px rgba(200,0,0,0.5)" : isYellow ? "0 0 8px rgba(200,180,0,0.5)" : "inset 0 2px 6px rgba(0,0,0,0.4)",
                }}
                animate={isRed || isYellow ? { opacity: [0.7, 1, 0.7] } : {}}
                transition={{ duration: 2 + (col * 0.2), repeat: Infinity, delay: row * 0.1 }}
              />
            );
          })}
        </div>
      </div>
      <motion.div className="absolute inset-0 pointer-events-none"
        animate={{ opacity: playHover ? 0.5 : 0 }} transition={{ duration: 0.5 }}
        style={{ background: "radial-gradient(ellipse 40% 40% at 50% 50%, rgba(59,130,246,0.15), transparent 70%)" }} />
    </div>
  );
}

// ─── Bowling Scene ────────────────────────────────────────────────────────────
function BowlingScene({ playHover }: { playHover: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, #1a0a00 0%, #2d1500 50%, #150a00 100%)" }} />
      {/* Lane in perspective */}
      <div className="absolute bottom-0 left-[20%] right-[20%] h-[70%]" style={{
        background: "linear-gradient(180deg, rgba(180,120,40,0.6) 0%, rgba(140,90,30,0.8) 100%)",
        clipPath: "polygon(10% 0%, 90% 0%, 100% 100%, 0% 100%)",
      }} />
      {/* Lane lines */}
      {[-2, -1, 0, 1, 2].map(offset => (
        <div key={offset} className="absolute bottom-0 h-[70%] w-px"
          style={{ left: `calc(50% + ${offset * 8}%)`, background: "rgba(255,255,255,0.08)" }} />
      ))}
      {/* Pins arrangement */}
      {[
        [0,0], [-1,1],[0,1],[1,1], [-2,2],[-1,2],[0,2],[1,2],[2,2], [-1.5,3],[-.5,3],[.5,3],[1.5,3]
      ].slice(0, 10).map(([x, y], i) => (
        <motion.div key={i}
          className="absolute rounded-full w-4 h-4"
          style={{
            left: `calc(50% + ${(x as number) * 14}px)`,
            bottom: `calc(55% - ${(y as number) * 18}px)`,
            transform: "translate(-50%, 50%)",
            background: "radial-gradient(circle at 35% 35%, #fff, #ccc)",
            boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
          }}
          animate={{ y: [0, -1, 0] }}
          transition={{ duration: 2 + i * 0.2, repeat: Infinity }} />
      ))}
      {/* Ball */}
      <motion.div
        className="absolute rounded-full"
        style={{ left: "47%", bottom: "12%", width: 32, height: 32,
          background: "radial-gradient(circle at 35% 35%, #3a1a5a, #1a0a3a)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.6)" }}
        animate={{ x: [0, 10, 100], y: [0, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity, repeatDelay: 2, ease: "easeIn" }}
      />
      {/* Spot lights */}
      <div className="absolute inset-x-0 top-0 h-2/3"
        style={{ background: "radial-gradient(ellipse 30% 50% at 50% -10%, rgba(255,200,100,0.12), transparent 70%)" }} />
      <motion.div className="absolute inset-0 pointer-events-none"
        animate={{ opacity: playHover ? 0.5 : 0 }} transition={{ duration: 0.5 }}
        style={{ background: "radial-gradient(ellipse 40% 40% at 50% 50%, rgba(255,150,50,0.1), transparent 70%)" }} />
    </div>
  );
}

// ─── Tron Scene ───────────────────────────────────────────────────────────────
function TronScene({ playHover }: { playHover: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Dark base */}
      <div className="absolute inset-0" style={{
        background: "linear-gradient(160deg, #000510 0%, #001535 50%, #000b20 100%)",
      }} />
      {/* Grid floor in perspective */}
      <div className="absolute bottom-0 left-0 right-0 h-[60%]" style={{ perspective: "400px" }}>
        <div className="absolute inset-0" style={{
          transform: "rotateX(52deg)",
          transformOrigin: "bottom center",
          backgroundImage: "linear-gradient(rgba(0,255,255,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,0.22) 1px, transparent 1px)",
          backgroundSize: "55px 55px",
        }} />
      </div>
      {/* Horizon glow line */}
      <div className="absolute" style={{
        bottom: "39%", left: "5%", right: "5%", height: "2px",
        background: "linear-gradient(90deg, transparent, rgba(0,255,255,0.9), transparent)",
        filter: "blur(2px)",
        boxShadow: "0 0 18px rgba(0,255,255,0.7), 0 0 50px rgba(0,200,255,0.4)",
      }} />
      {/* Moving light trails */}
      {[
        { color: "#00ffff", y: "61%", dur: 3.2, delay: 0 },
        { color: "#0088ff", y: "65%", dur: 4.0, delay: 1.2 },
        { color: "#00ccff", y: "59%", dur: 2.6, delay: 2.1 },
      ].map((trail, i) => (
        <motion.div key={i} className="absolute h-px"
          style={{
            top: trail.y, width: "35%",
            background: `linear-gradient(90deg, transparent, ${trail.color}dd, transparent)`,
            filter: "blur(1px)",
            boxShadow: `0 0 6px ${trail.color}`,
          }}
          animate={{ left: ["-35%", "100%"], opacity: [0, 1, 1, 0] }}
          transition={{ duration: trail.dur, delay: trail.delay, repeat: Infinity, ease: "linear" }}
        />
      ))}
      {/* Scanlines */}
      <div className="absolute inset-0 opacity-[0.025]" style={{
        backgroundImage: "repeating-linear-gradient(0deg, rgba(0,255,255,1) 0px, transparent 1px, transparent 3px)",
        backgroundSize: "100% 4px",
      }} />
      {/* Cyan ambient pulse */}
      <motion.div className="absolute inset-0"
        animate={{ opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        style={{ background: "radial-gradient(ellipse 60% 40% at 50% 75%, rgba(0,200,255,0.1), transparent 70%)" }}
      />
      {/* Speed streaks */}
      {[["12%","42%","110px"], ["78%","57%","80px"], ["28%","68%","140px"]].map(([l, t, w], i) => (
        <motion.div key={i} className="absolute h-px rounded-full"
          style={{ left: l, top: t, width: w, background: "linear-gradient(90deg, transparent, rgba(0,120,255,0.65), transparent)", filter: "blur(1px)" }}
          animate={{ opacity: [0, 0.8, 0], x: ["-15px", "15px"] }}
          transition={{ duration: 2.8 + i * 0.6, delay: i * 0.9, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      {/* Energy particles */}
      {[...Array(7)].map((_, i) => (
        <motion.div key={i} className="absolute w-1 h-1 rounded-full"
          style={{ left: `${12 + i * 12}%`, top: `${38 + (i % 3) * 9}%`, background: "#00ffff", boxShadow: "0 0 5px #00ffff" }}
          animate={{ opacity: [0, 1, 0], scale: [0.5, 1.8, 0.5], y: [0, -18, 0] }}
          transition={{ duration: 2.2 + i * 0.4, delay: i * 0.45, repeat: Infinity }}
        />
      ))}
      {/* Hover glow */}
      <motion.div className="absolute inset-0 pointer-events-none"
        animate={{ opacity: playHover ? 0.65 : 0 }} transition={{ duration: 0.5 }}
        style={{ background: "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(0,200,255,0.18), transparent 70%)" }} />
    </div>
  );
}

// ─── Block Blast Scene ────────────────────────────────────────────────────────
function BlockBlastScene({ playHover }: { playHover: boolean }) {
  const blocks = [
    { x: "14%", y: "22%", w: 38, c1: "#FF2D8A", c2: "#FF7A00", delay: 0,   dur: 4.0 },
    { x: "76%", y: "32%", w: 28, c1: "#7C3AED", c2: "#4F46E5", delay: 0.5, dur: 3.5 },
    { x: "42%", y: "14%", w: 46, c1: "#0EA5E9", c2: "#0284C7", delay: 1.0, dur: 5.0 },
    { x: "62%", y: "62%", w: 32, c1: "#F59E0B", c2: "#D97706", delay: 1.5, dur: 3.8 },
    { x: "24%", y: "58%", w: 42, c1: "#10B981", c2: "#059669", delay: 0.8, dur: 4.2 },
    { x: "82%", y: "72%", w: 24, c1: "#EC4899", c2: "#BE185D", delay: 2.0, dur: 3.2 },
    { x: "50%", y: "46%", w: 30, c1: "#8B5CF6", c2: "#6D28D9", delay: 0.3, dur: 4.8 },
    { x: "10%", y: "72%", w: 52, c1: "#F97316", c2: "#EA580C", delay: 1.2, dur: 3.6 },
  ];
  const fallingColors = ["#FF2D8A","#7C3AED","#0EA5E9","#F59E0B","#10B981","#EC4899","#8B5CF6","#F97316"];
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{
        background: "linear-gradient(160deg, #0d0018 0%, #150030 50%, #0a0020 100%)",
      }} />
      {/* Floating blocks */}
      {blocks.map((b, i) => (
        <motion.div key={i} className="absolute rounded-md"
          style={{
            left: b.x, top: b.y,
            width: b.w, height: b.w,
            transform: "translate(-50%, -50%)",
            background: `linear-gradient(135deg, ${b.c1}, ${b.c2})`,
            boxShadow: `0 0 ${Math.round(b.w * 0.55)}px ${b.c1}55, 0 4px 10px rgba(0,0,0,0.5)`,
            opacity: 0.55,
          }}
          animate={{ y: [0, -(12 + i * 2), 0], rotate: [0, i % 2 === 0 ? 9 : -9, 0], opacity: [0.4, 0.72, 0.4] }}
          transition={{ duration: b.dur, delay: b.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      {/* Falling mini blocks */}
      {[...Array(8)].map((_, i) => (
        <motion.div key={i} className="absolute w-3 h-3 rounded-sm"
          style={{ left: `${9 + i * 11}%`, background: fallingColors[i % fallingColors.length], boxShadow: `0 0 7px ${fallingColors[i % fallingColors.length]}80`, opacity: 0.5 }}
          animate={{ y: ["-25px", "115%"], opacity: [0, 0.65, 0], rotate: [0, 180] }}
          transition={{ duration: 4 + i * 0.5, delay: i * 0.6, repeat: Infinity, ease: "linear", repeatDelay: 0.8 }}
        />
      ))}
      {/* Corner accent glows */}
      <div className="absolute top-0 left-0 w-52 h-52 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,45,138,0.09), transparent 70%)", filter: "blur(20px)" }} />
      <div className="absolute bottom-0 right-0 w-52 h-52 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(124,58,237,0.1), transparent 70%)", filter: "blur(20px)" }} />
      {/* Central pulse */}
      <motion.div className="absolute inset-0"
        animate={{ opacity: [0.15, 0.3, 0.15] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        style={{ background: "radial-gradient(ellipse 55% 45% at 50% 50%, rgba(140,80,255,0.08), transparent 70%)" }} />
      {/* Hover glow */}
      <motion.div className="absolute inset-0 pointer-events-none"
        animate={{ opacity: playHover ? 0.5 : 0 }} transition={{ duration: 0.5 }}
        style={{ background: "radial-gradient(ellipse 45% 45% at 50% 50%, rgba(140,80,255,0.18), transparent 70%)" }} />
    </div>
  );
}

// ─── Generic Neon Scene ───────────────────────────────────────────────────────
function GenericScene({ accentColor, playHover }: { accentColor: string; playHover: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{
        background: `linear-gradient(160deg, #04020c 0%, #080420 50%, #030212 100%)`,
      }} />
      {/* Hex grid pattern */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: `linear-gradient(${accentColor}60 1px, transparent 1px), linear-gradient(90deg, ${accentColor}60 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
      }} />
      {/* Glowing orbs */}
      {[
        { l: "20%", t: "30%", s: 120 }, { l: "75%", t: "60%", s: 90 },
        { l: "50%", t: "20%", s: 150 }, { l: "35%", t: "70%", s: 80 },
      ].map((o, i) => (
        <motion.div key={i} className="absolute rounded-full"
          style={{
            left: o.l, top: o.t, width: o.s, height: o.s,
            transform: "translate(-50%, -50%)",
            background: `radial-gradient(circle, ${accentColor}18, transparent 70%)`,
            filter: "blur(20px)",
          }}
          animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.2, 1] }}
          transition={{ duration: 3 + i * 0.8, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      {/* Energy rings */}
      {[60, 120, 180].map((r, i) => (
        <motion.div key={i}
          className="absolute top-1/2 left-1/2 rounded-full border"
          style={{
            width: r, height: r,
            marginLeft: -r / 2, marginTop: -r / 2,
            borderColor: `${accentColor}20`,
          }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2.5 + i * 0.5, repeat: Infinity, delay: i * 0.4 }}
        />
      ))}
      <motion.div className="absolute inset-0 pointer-events-none"
        animate={{ opacity: playHover ? 0.6 : 0 }} transition={{ duration: 0.5 }}
        style={{ background: `radial-gradient(ellipse 40% 40% at 50% 50%, ${accentColor}18, transparent 70%)` }} />
    </div>
  );
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────
const SCENE_MAP: Record<string, (props: { playHover: boolean; accentColor: string }) => JSX.Element> = {
  "8-ball":      ({ playHover }) => <PoolScene playHover={playHover} />,
  "air-hockey":  ({ playHover }) => <AirHockeyScene playHover={playHover} />,
  "mini-golf":   ({ playHover }) => <MiniGolfScene playHover={playHover} />,
  "chess":       ({ playHover }) => <ChessScene playHover={playHover} />,
  "connect-4":   ({ playHover }) => <Connect4Scene playHover={playHover} />,
  "bowling":     ({ playHover }) => <BowlingScene playHover={playHover} />,
  "tron":        ({ playHover }) => <TronScene playHover={playHover} />,
  "block-blast": ({ playHover }) => <BlockBlastScene playHover={playHover} />,
};

export interface GameSceneBackgroundProps {
  gameId: string;
  accentColor: string;
  playHover: boolean;
  mouseX: number;
  mouseY: number;
}

export function GameSceneBackground({ gameId, accentColor, playHover, mouseX, mouseY }: GameSceneBackgroundProps) {
  const SceneFn = SCENE_MAP[gameId] ?? (({ playHover, accentColor }: { playHover: boolean; accentColor: string }) =>
    <GenericScene accentColor={accentColor} playHover={playHover} />
  );

  // Parallax offset based on mouse position
  const px = (mouseX - 0.5) * -18;
  const py = (mouseY - 0.5) * -12;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={gameId}
        className="absolute inset-0"
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: playHover ? 1.025 : 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ opacity: { duration: 0.65, ease: "easeInOut" }, scale: { duration: 0.5 } }}
      >
        {/* Parallax container */}
        <motion.div
          className="absolute inset-[-3%]"
          animate={{ x: px, y: py }}
          transition={{ type: "spring", stiffness: 80, damping: 25 }}
        >
          <SceneFn playHover={playHover} accentColor={accentColor} />
        </motion.div>

        {/* Depth blur layer — furthest back elements get more blur */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ backdropFilter: "blur(0.5px)" }} />

        {/* Light sweep on transition */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ x: "-120%", opacity: 0.6 }}
          animate={{ x: "120%", opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          style={{ background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.06) 50%, transparent 70%)" }}
        />
      </motion.div>
    </AnimatePresence>
  );
}
