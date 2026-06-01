import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

interface CoinParticle {
  id: number; x: number; startY: number; endX: number; endY: number;
  delay: number; rotate: number; scale: number;
}

interface CoinWinAnimationProps {
  show: boolean;
  amount: number;
  isWin: boolean;
  onDone?: () => void;
}

const SCALPS_GRADIENT = "linear-gradient(135deg, #FF2D8A, #FF7A00)";

function ScalpsCoin({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <polygon points="16,2 20,8 27,9 22,14 24,21 16,18 8,21 10,14 5,9 12,8" fill="url(#cg)" stroke="#FF7A0088" strokeWidth="1" />
      <defs><linearGradient id="cg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#FF2D8A" /><stop offset="100%" stopColor="#FF7A00" /></linearGradient></defs>
      <text x="16" y="19" textAnchor="middle" fontSize="10" fontWeight="bold" fill="white">S</text>
    </svg>
  );
}

export function CoinWinAnimation({ show, amount, isWin, onDone }: CoinWinAnimationProps) {
  const coinsRef = useRef<CoinParticle[]>([]);
  const navbarRef = useRef<DOMRect | null>(null);

  useEffect(() => {
    if (!show) return;
    const navEl = document.querySelector("[data-testid='nav-balance-btn']");
    if (navEl) navbarRef.current = navEl.getBoundingClientRect();

    const count = isWin ? Math.min(Math.floor(amount / 2) + 8, 24) : 6;
    coinsRef.current = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 30 + Math.random() * (window.innerWidth - 60),
      startY: isWin ? -40 : 80,
      endX: navbarRef.current ? navbarRef.current.x + navbarRef.current.width / 2 : window.innerWidth * 0.85,
      endY: navbarRef.current ? navbarRef.current.y : 60,
      delay: i * 0.06,
      rotate: (Math.random() - 0.5) * 720,
      scale: 0.7 + Math.random() * 0.6,
    }));

    const timer = setTimeout(() => onDone?.(), (count * 60) + 1200);
    return () => clearTimeout(timer);
  }, [show]);

  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 pointer-events-none z-[9000] overflow-hidden">
      {/* Win/Loss amount text */}
      <motion.div
        className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none"
        initial={{ opacity: 0, scale: 0.4, y: 20 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.2, 1, 0.8], y: [20, 0, -20, -60] }}
        transition={{ duration: 1.8, times: [0, 0.2, 0.7, 1] }}
      >
        <div
          className="text-4xl font-black drop-shadow-lg px-6 py-3 rounded-2xl"
          style={{
            background: isWin ? SCALPS_GRADIENT : "linear-gradient(135deg,#ef4444,#991b1b)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: `drop-shadow(0 0 20px ${isWin ? "#FF7A00" : "#ef444488"})`,
            textShadow: "none",
          }}
        >
          {isWin ? `+${amount.toFixed(2)} S` : `-${amount.toFixed(2)} S`}
        </div>
        <div className="text-sm font-semibold text-white/80 mt-1">
          {isWin ? "Scalps Won!" : "Scalps Lost"}
        </div>
      </motion.div>

      {/* Coin particles (only for win) */}
      {isWin && coinsRef.current.map(coin => (
        <motion.div
          key={coin.id}
          className="absolute"
          style={{ left: coin.x, top: coin.startY, originX: 0.5, originY: 0.5 }}
          initial={{ opacity: 0, scale: coin.scale, rotate: 0, x: 0, y: 0 }}
          animate={{
            opacity: [0, 1, 1, 0.5, 0],
            scale: [coin.scale, coin.scale * 1.1, coin.scale * 0.7],
            rotate: coin.rotate,
            x: [0, (coin.endX - coin.x) * 0.3, coin.endX - coin.x],
            y: [0, 80 + Math.random() * 40, coin.endY - coin.startY],
          }}
          transition={{ duration: 1.0, delay: coin.delay, ease: "easeIn" }}
        >
          <ScalpsCoin size={22} />
        </motion.div>
      ))}

      {/* Lose shake: small minus indicator */}
      {!isWin && (
        <motion.div
          className="absolute right-4 top-16 text-red-400 font-bold text-lg"
          initial={{ opacity: 1, x: 0, y: 0 }}
          animate={{ opacity: [1, 1, 0], x: [0, -8, 8, -6, 6, 0], y: [0, -20, -40] }}
          transition={{ duration: 1.5 }}
        >
          -{amount.toFixed(2)} S
        </motion.div>
      )}
    </div>,
    document.body
  );
}
