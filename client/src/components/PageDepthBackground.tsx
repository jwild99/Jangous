import { AmbientParticles } from "./AmbientParticles";

interface GlowZone {
  x: string; y: string;
  color: string;
  size?: string;
  opacity?: number;
}

interface PageDepthBackgroundProps {
  glowZones?: GlowZone[];
  particles?: boolean;
  particleCount?: number;
  grain?: boolean;
  gridLines?: boolean;
  className?: string;
}

const DEFAULT_GLOW: GlowZone[] = [
  { x: "15%",  y: "0%",   color: "59,130,246",  size: "60%",  opacity: 0.07 },
  { x: "85%",  y: "5%",   color: "139,92,246",  size: "50%",  opacity: 0.06 },
  { x: "50%",  y: "90%",  color: "59,130,246",  size: "40%",  opacity: 0.04 },
];

export function PageDepthBackground({
  glowZones  = DEFAULT_GLOW,
  particles  = true,
  particleCount = 30,
  grain      = true,
  gridLines  = false,
  className  = "",
}: PageDepthBackgroundProps) {
  return (
    <div
      className={`fixed inset-0 pointer-events-none overflow-hidden ${className}`}
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      {/* Layer 0: Radial glow zones */}
      {glowZones.map((z, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: z.x, top: z.y,
            width:  z.size ?? "55%",
            height: z.size ?? "55%",
            transform: "translate(-50%, -50%)",
            background: `radial-gradient(ellipse at center, rgba(${z.color},${z.opacity ?? 0.07}) 0%, transparent 70%)`,
            filter: "blur(1px)",
          }}
        />
      ))}

      {/* Layer 1: Subtle CSS grain overlay */}
      {grain && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "200px 200px",
            opacity: 0.6,
            mixBlendMode: "overlay",
          }}
        />
      )}

      {/* Layer 2: Optional hologram grid lines */}
      {gridLines && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(59,130,246,0.025) 1px, transparent 1px),
              linear-gradient(90deg, rgba(59,130,246,0.025) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />
      )}

      {/* Layer 3: Ambient floating particles */}
      {particles && (
        <AmbientParticles count={particleCount} />
      )}
    </div>
  );
}
