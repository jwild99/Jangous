import { useEffect, useRef } from "react";

interface Particle {
  x: number; y: number; vx: number; vy: number;
  radius: number; opacity: number; opacityDir: number;
  color: string;
}

const COLORS = [
  "rgba(59,130,246,",   // electric blue
  "rgba(139,92,246,",   // cyber purple
  "rgba(255,45,138,",   // hot pink
  "rgba(6,182,212,",    // cyan
];

export function AmbientParticles({
  count = 35,
  className = "",
}: {
  count?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  const particles = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    particles.current = Array.from({ length: count }, () => {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      return {
        x:          Math.random() * canvas.width,
        y:          Math.random() * canvas.height,
        vx:         (Math.random() - 0.5) * 0.18,
        vy:         (Math.random() - 0.5) * 0.18,
        radius:     Math.random() * 1.8 + 0.6,
        opacity:    Math.random() * 0.25 + 0.04,
        opacityDir: Math.random() > 0.5 ? 1 : -1,
        color,
      };
    });

    function draw() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.opacity += p.opacityDir * 0.0008;
        if (p.opacity > 0.3 || p.opacity < 0.03) p.opacityDir *= -1;
        if (p.x < -4) p.x = canvas.width + 4;
        if (p.x > canvas.width + 4) p.x = -4;
        if (p.y < -4) p.y = canvas.height + 4;
        if (p.y > canvas.height + 4) p.y = -4;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.opacity.toFixed(2)})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, [count]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      style={{ willChange: "transform" }}
      aria-hidden="true"
    />
  );
}
