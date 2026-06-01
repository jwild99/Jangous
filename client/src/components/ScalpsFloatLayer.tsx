import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { onScalpsChange } from "@/lib/scalpsEvents";
import { ScalpsIcon } from "@/components/ScalpsIcon";

interface FloatItem {
  id: number;
  delta: number;
  x: number;
}

let nextId = 0;

export function ScalpsFloatLayer() {
  const [items, setItems] = useState<FloatItem[]>([]);

  const addFloat = useCallback(({ delta }: { delta: number; newBalance: number }) => {
    if (!delta || Math.abs(delta) < 0.01) return;
    const id = nextId++;
    const x = 88 + (Math.random() - 0.5) * 8;
    setItems(prev => [...prev, { id, delta, x }]);
    setTimeout(() => setItems(prev => prev.filter(i => i.id !== id)), 1800);
  }, []);

  useEffect(() => {
    return onScalpsChange(addFloat);
  }, [addFloat]);

  return (
    <div className="fixed inset-0 z-[9300] pointer-events-none overflow-hidden">
      <AnimatePresence>
        {items.map(item => {
          const isGain = item.delta > 0;
          const color = isGain ? "#22c55e" : "#f87171";
          const glow = isGain ? "rgba(34,197,94,0.7)" : "rgba(248,113,113,0.7)";
          return (
            <motion.div
              key={item.id}
              className="absolute top-16 flex items-center gap-1 font-black text-sm select-none"
              style={{ right: `${100 - item.x}%`, transform: "translateX(50%)" }}
              initial={{ y: 0, opacity: 1, scale: 0.8 }}
              animate={{ y: -64, opacity: 0, scale: 1.1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.6, ease: "easeOut" }}
            >
              <ScalpsIcon size="xs" />
              <span style={{
                color,
                textShadow: `0 0 12px ${glow}, 0 1px 3px rgba(0,0,0,0.8)`,
              }}>
                {isGain ? "+" : ""}{item.delta.toFixed(2)} S
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
