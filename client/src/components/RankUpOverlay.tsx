import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { onRankUp, type RankUpPayload } from "@/lib/rankEvents";
import { soundManager } from "@/lib/soundManager";
import { TrendingUp } from "lucide-react";

const RANK_PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  angle: (i / 20) * 360,
  dist: 80 + Math.random() * 100,
  delay: Math.random() * 0.3,
}));

export function RankUpOverlay() {
  const [state, setState] = useState<{ visible: boolean; data: RankUpPayload | null }>({
    visible: false, data: null,
  });

  useEffect(() => {
    return onRankUp((data) => {
      soundManager.playWin();
      setState({ visible: true, data });
      const t = setTimeout(() => setState(s => ({ ...s, visible: false })), 4500);
      return () => clearTimeout(t);
    });
  }, []);

  return createPortal(
    <AnimatePresence>
      {state.visible && state.data && (
        <motion.div
          key="rank-up"
          className="fixed inset-0 z-[9500] flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          {/* Background shimmer */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.22, 0] }}
            transition={{ duration: 2, times: [0, 0.25, 1] }}
            style={{ background: `radial-gradient(ellipse at center, ${state.data.newColor}40 0%, transparent 65%)` }}
          />

          {/* Particles */}
          {RANK_PARTICLES.map(p => {
            const rad = (p.angle * Math.PI) / 180;
            return (
              <motion.div key={p.id}
                className="absolute w-1.5 h-1.5 rounded-full"
                style={{ background: state.data!.newColor }}
                initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                animate={{
                  x: Math.cos(rad) * p.dist,
                  y: Math.sin(rad) * p.dist,
                  opacity: [0, 1, 0],
                  scale: [0, 1.5, 0],
                }}
                transition={{ duration: 1.6, delay: p.delay, ease: "easeOut" }}
              />
            );
          })}

          {/* Main content */}
          <motion.div
            className="relative flex flex-col items-center gap-4"
            initial={{ scale: 0.5, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.85, y: -20, opacity: 0 }}
            transition={{ type: "spring", damping: 18, stiffness: 250, delay: 0.1 }}
          >
            <motion.p
              className="text-[11px] font-black uppercase tracking-[0.3em] text-white/50"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
              Rank Promoted
            </motion.p>

            {/* Rank transition */}
            <div className="flex items-center gap-5">
              {/* Old rank */}
              <motion.div className="flex flex-col items-center gap-1"
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 0.45, x: 0 }} transition={{ delay: 0.2 }}>
                <div className="w-14 h-14 rounded-full border-2 flex items-center justify-center text-lg font-black"
                  style={{ borderColor: state.data.oldColor + "60", color: state.data.oldColor + "80",
                    background: state.data.oldColor + "15" }}>
                  {state.data.oldRank.slice(0, 2)}
                </div>
                <span className="text-[10px] text-white/35">{state.data.oldRank}</span>
              </motion.div>

              {/* Arrow */}
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4, type: "spring" }}>
                <TrendingUp className="w-6 h-6" style={{ color: state.data.newColor }} />
              </motion.div>

              {/* New rank */}
              <motion.div className="flex flex-col items-center gap-1"
                initial={{ opacity: 0, x: 20, scale: 0.6 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ delay: 0.5, type: "spring", stiffness: 300 }}>
                <motion.div
                  className="w-20 h-20 rounded-full border-2 flex items-center justify-center text-xl font-black"
                  style={{ borderColor: state.data.newColor, color: state.data.newColor,
                    background: state.data.newColor + "20",
                    boxShadow: `0 0 30px ${state.data.newColor}50, 0 0 60px ${state.data.newColor}25` }}
                  animate={{ boxShadow: [
                    `0 0 20px ${state.data.newColor}40`,
                    `0 0 45px ${state.data.newColor}70`,
                    `0 0 20px ${state.data.newColor}40`,
                  ] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>
                  {state.data.newRank.slice(0, 2)}
                </motion.div>
                <span className="text-xs font-bold" style={{ color: state.data.newColor }}>{state.data.newRank}</span>
              </motion.div>
            </div>

            {/* RANK UP text */}
            <motion.h2
              className="text-4xl font-black text-white tracking-tight"
              style={{ textShadow: `0 0 30px ${state.data.newColor}70, 0 0 60px ${state.data.newColor}35` }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.65, type: "spring", stiffness: 260 }}>
              RANK UP
            </motion.h2>

            <motion.p className="text-xs text-white/35"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
              {state.data.newRating} MMR · {state.data.newRank} Rank
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
