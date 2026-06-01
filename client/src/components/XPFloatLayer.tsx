import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { onXPGained } from "@/lib/xpEvents";
import { Zap } from "lucide-react";

interface FloatItem {
  id: number;
  xp: number;
  x: number;
}

let nextId = 0;

export function XPFloatLayer() {
  const [items, setItems] = useState<FloatItem[]>([]);

  const addFloat = useCallback(({ xp }: { xp: number }) => {
    if (!xp || xp <= 0) return;
    const id = nextId++;
    // Slight horizontal variation so multiple pops don't stack perfectly
    const x = 48 + (Math.random() - 0.5) * 14;
    setItems(prev => [...prev, { id, xp, x }]);
    setTimeout(() => setItems(prev => prev.filter(i => i.id !== id)), 2000);
  }, []);

  useEffect(() => {
    return onXPGained(addFloat);
  }, [addFloat]);

  return (
    <div className="fixed inset-0 z-[9200] pointer-events-none overflow-hidden">
      <AnimatePresence>
        {items.map(item => (
          <motion.div
            key={item.id}
            className="absolute bottom-24 flex items-center gap-1 font-black text-sm select-none"
            style={{ left: `${item.x}%`, transform: "translateX(-50%)" }}
            initial={{ y: 0, opacity: 1, scale: 0.8 }}
            animate={{ y: -72, opacity: 0, scale: 1.1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.8, ease: "easeOut" }}
          >
            <Zap className="w-3.5 h-3.5" style={{ color: "#eab308", filter: "drop-shadow(0 0 4px rgba(234,179,8,0.8))" }} />
            <span style={{
              color: "#eab308",
              textShadow: "0 0 12px rgba(234,179,8,0.7), 0 1px 3px rgba(0,0,0,0.8)",
            }}>
              +{item.xp.toLocaleString()} XP
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
