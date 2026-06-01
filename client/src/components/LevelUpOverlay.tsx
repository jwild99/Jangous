import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Star, Zap } from "lucide-react";
import { onXPGained } from "@/lib/xpEvents";

interface LevelUpState {
  visible: boolean;
  oldLevel: number;
  newLevel: number;
}

export function LevelUpOverlay() {
  const [state, setState] = useState<LevelUpState>({ visible: false, oldLevel: 1, newLevel: 1 });

  useEffect(() => {
    return onXPGained(({ oldLevel, newLevel }) => {
      if (newLevel > oldLevel) {
        setState({ visible: true, oldLevel, newLevel });
        const t = setTimeout(() => setState(s => ({ ...s, visible: false })), 4000);
        return () => clearTimeout(t);
      }
    });
  }, []);

  return createPortal(
    <AnimatePresence>
      {state.visible && (
        <motion.div
          key="level-up-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
        >
          {/* Background shimmer */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.18, 0] }}
            transition={{ duration: 1.5, times: [0, 0.3, 1] }}
            style={{ background: "radial-gradient(ellipse at center, rgba(234,179,8,0.4) 0%, transparent 70%)" }}
          />

          {/* Main card */}
          <motion.div
            initial={{ scale: 0.5, y: 40, opacity: 0 }}
            animate={{ scale: [0.5, 1.08, 1.0], y: [40, -8, 0], opacity: 1 }}
            exit={{ scale: 0.8, y: -30, opacity: 0 }}
            transition={{ duration: 0.55, ease: "easeOut", times: [0, 0.7, 1] }}
            className="relative flex flex-col items-center gap-3 px-10 py-8 rounded-2xl border border-yellow-400/40 text-center"
            style={{
              background: "linear-gradient(135deg, rgba(15,12,30,0.97) 0%, rgba(30,20,60,0.97) 100%)",
              boxShadow: "0 0 60px -8px rgba(234,179,8,0.7), 0 0 120px -20px rgba(168,85,247,0.4), inset 0 1px 0 rgba(234,179,8,0.2)",
            }}
          >
            {/* Spinning trophy */}
            <motion.div
              animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #eab308, #f59e0b)", boxShadow: "0 0 30px rgba(234,179,8,0.6)" }}
            >
              <Trophy className="w-8 h-8 text-black" />
            </motion.div>

            {/* "LEVEL UP" text */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <p className="text-xs font-bold tracking-[0.35em] text-yellow-400/80 uppercase mb-1">Level Up!</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl font-black text-white/40">{state.oldLevel}</span>
                <motion.div
                  animate={{ x: [0, 4, 0] }}
                  transition={{ repeat: 3, duration: 0.25, delay: 0.4 }}
                >
                  <Zap className="w-5 h-5 text-yellow-400" />
                </motion.div>
                <motion.span
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.35, type: "spring", stiffness: 300, damping: 15 }}
                  className="text-5xl font-black text-yellow-400"
                  style={{ textShadow: "0 0 20px rgba(234,179,8,0.8)" }}
                >
                  {state.newLevel}
                </motion.span>
              </div>
            </motion.div>

            {/* Star burst particles */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute"
                style={{ top: "50%", left: "50%" }}
                initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                animate={{
                  x: Math.cos((i / 6) * Math.PI * 2) * 80,
                  y: Math.sin((i / 6) * Math.PI * 2) * 80,
                  scale: [0, 1, 0],
                  opacity: [1, 1, 0],
                }}
                transition={{ duration: 0.9, delay: 0.2 + i * 0.04, ease: "easeOut" }}
              >
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              </motion.div>
            ))}

            {/* Dismiss hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              transition={{ delay: 1.5 }}
              className="text-[10px] text-white/40 tracking-widest uppercase mt-1"
            >
              New rank unlocked
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
