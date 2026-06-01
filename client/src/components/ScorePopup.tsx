import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ScorePopupVariant = "score" | "bonus" | "combo" | "miss" | "info";

export interface ScorePopupItem {
  id: string;
  text: string;
  variant?: ScorePopupVariant;
  x?: number;
  y?: number;
}

// ─── Single floating popup ───────────────────────────────────────────────────

const VARIANT_STYLES: Record<ScorePopupVariant, string> = {
  score:  "text-white  font-bold  text-base",
  bonus:  "text-amber-300  font-bold  text-lg",
  combo:  "text-purple-300 font-black text-xl",
  miss:   "text-red-400    font-semibold text-sm",
  info:   "text-sky-300    font-medium  text-sm",
};

function FloatingPopup({ item, onDone }: { item: ScorePopupItem; onDone: () => void }) {
  const style = VARIANT_STYLES[item.variant ?? "score"];

  return (
    <motion.div
      key={item.id}
      className={`pointer-events-none select-none drop-shadow-md ${style}`}
      style={{
        position: "fixed",
        left: item.x ?? "50%",
        top: item.y ?? "40%",
        transform: "translate(-50%, -50%)",
        zIndex: 9999,
        textShadow: "0 1px 6px rgba(0,0,0,0.8)",
      }}
      initial={{ opacity: 0, y: 0, scale: 0.8 }}
      animate={{ opacity: [0, 1, 1, 0], y: -60, scale: [0.8, 1.1, 1, 1] }}
      transition={{ duration: 1.1, times: [0, 0.12, 0.7, 1], ease: "easeOut" }}
      onAnimationComplete={onDone}
    >
      {item.text}
    </motion.div>
  );
}

// ─── ScorePopupHost — mount once near the game canvas ────────────────────────

interface ScorePopupHostProps {
  items: ScorePopupItem[];
  onRemove: (id: string) => void;
}

export function ScorePopupHost({ items, onRemove }: ScorePopupHostProps) {
  return createPortal(
    <AnimatePresence>
      {items.map(item => (
        <FloatingPopup key={item.id} item={item} onDone={() => onRemove(item.id)} />
      ))}
    </AnimatePresence>,
    document.body
  );
}

// ─── useScorePopups — hook for managing popup state ──────────────────────────

import { useState, useCallback } from "react";

let _popupIdSeq = 0;

export function useScorePopups() {
  const [items, setItems] = useState<ScorePopupItem[]>([]);

  const addPopup = useCallback((
    text: string,
    opts: { variant?: ScorePopupVariant; x?: number; y?: number } = {}
  ) => {
    const id = `sp-${++_popupIdSeq}`;
    setItems(prev => [...prev, { id, text, ...opts }]);
  }, []);

  const removePopup = useCallback((id: string) => {
    setItems(prev => prev.filter(p => p.id !== id));
  }, []);

  return { items, addPopup, removePopup };
}
