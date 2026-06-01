import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { ScalpsIcon } from "@/components/ScalpsIcon";
import { emitScalpsChange } from "@/lib/scalpsEvents";

interface AnimatedBalanceProps {
  value: number;
  prefix?: string;
  className?: string;
  showGlow?: boolean;
  showConfetti?: boolean;
  useScalps?: boolean;
}

export function AnimatedBalance({ 
  value, 
  prefix,
  className = "", 
  showGlow = true,
  showConfetti = true,
  useScalps = true,
}: AnimatedBalanceProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<"up" | "down" | null>(null);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current === value) return;

    const startValue = prevValueRef.current;
    const isIncreasing = value > startValue;
    const diff = value - startValue;
    
    if (showConfetti && isIncreasing && diff > 10) {
      const confettiConfig = {
        particleCount: Math.min(diff * 2, 150),
        spread: 60,
        origin: { y: 0.3, x: 0.9 },
        colors: ["#FF2D8A", "#FF7A00", "#00FF85", "#FFD700"],
        scalar: 1.2,
        gravity: 1,
        ticks: 200,
      };
      confetti(confettiConfig);
      if (diff > 50) {
        setTimeout(() => confetti({ ...confettiConfig, particleCount: 100, spread: 80 }), 250);
      }
    }
    
    emitScalpsChange({ delta: diff, newBalance: value });
    setDirection(isIncreasing ? "up" : "down");
    setIsAnimating(true);

    const duration = 500;
    const steps = 30;
    const increment = diff / steps;
    const stepDuration = duration / steps;

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayValue(value);
        clearInterval(timer);
        setTimeout(() => { setIsAnimating(false); setDirection(null); }, 100);
        prevValueRef.current = value;
      } else {
        setDisplayValue(startValue + increment * currentStep);
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [value, showConfetti]);

  const glowClass = showGlow && !isAnimating ? "animate-breathe-glow" : "";
  const flashClass = isAnimating
    ? direction === "up" ? "animate-number-flash-green" : "animate-number-flash-red"
    : "";

  const formatted = displayValue.toFixed(2);

  return (
    <motion.span
      className={`font-mono font-bold inline-flex items-center gap-1 ${glowClass} ${flashClass} ${className}`}
      data-testid="animated-balance"
    >
      {useScalps ? (
        <>
          <ScalpsIcon size="xs" />
          <span>{formatted}</span>
        </>
      ) : (
        <>{prefix ?? "$"}{formatted}</>
      )}
    </motion.span>
  );
}
