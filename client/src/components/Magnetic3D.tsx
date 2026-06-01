import { useRef, useState, useCallback } from "react";

interface Magnetic3DProps {
  children: React.ReactNode;
  maxTilt?: number;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

export function Magnetic3D({
  children,
  maxTilt = 5,
  className = "",
  style,
  disabled = false,
}: Magnetic3DProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });
  const [hovered, setHovered] = useState(false);
  const frameRef = useRef<number>(0);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top  + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width  / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      setTilt({ x: -dy * maxTilt, y: dx * maxTilt });
      setGlowPos({
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top)  / rect.height) * 100,
      });
    });
  }, [disabled, maxTilt]);

  const onMouseLeave = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    setTilt({ x: 0, y: 0 });
    setGlowPos({ x: 50, y: 50 });
    setHovered(false);
  }, []);

  const onMouseEnter = useCallback(() => {
    if (!disabled) setHovered(true);
  }, [disabled]);

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onMouseEnter={onMouseEnter}
      className={className}
      style={{
        ...style,
        transform: `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: hovered
          ? "transform 0.1s ease-out"
          : "transform 0.5s cubic-bezier(0.23,1,0.32,1)",
        willChange: "transform",
        /* Subtle cursor-following light shimmer */
        "--glow-x": `${glowPos.x}%`,
        "--glow-y": `${glowPos.y}%`,
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
