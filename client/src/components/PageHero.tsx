import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useTheme } from "@/contexts/ThemeContext";

interface PageHeroProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  motif?: "chess" | "leaderboard" | "stats" | "settings" | "admin" | "messages";
  children?: ReactNode;
}

const MOTIFS: Record<string, ReactNode> = {
  chess: (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="ph-chess-glow" cx="20%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(217 91% 60%)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
        <filter id="ph-blur-sm"><feGaussianBlur stdDeviation="2" /></filter>
      </defs>
      <rect width="800" height="220" fill="url(#ph-chess-glow)" />
      {/* Chess grid pattern */}
      {Array.from({ length: 8 }, (_, row) =>
        Array.from({ length: 12 }, (_, col) => (
          (row + col) % 2 === 0 ? (
            <rect
              key={`${row}-${col}`}
              x={col * 24 - 40}
              y={row * 24 + 20}
              width={22}
              height={22}
              fill="rgba(59,130,246,0.06)"
              rx="1"
            />
          ) : null
        ))
      )}
      {/* Chess pieces silhouette (king) */}
      <g transform="translate(660,20)" opacity="0.08" fill="white" filter="url(#ph-blur-sm)">
        <rect x="30" y="80" width="4" height="40" />
        <rect x="26" y="76" width="12" height="8" />
        <rect x="28" y="68" width="8" height="12" />
        <rect x="32" y="60" width="2" height="12" />
        <rect x="27" y="66" width="10" height="4" />
        <rect x="20" y="116" width="24" height="12" rx="2" />
      </g>
      {/* Neon line accents */}
      <line x1="0" y1="195" x2="250" y2="195" stroke="rgba(59,130,246,0.15)" strokeWidth="1" />
      <line x1="550" y1="195" x2="800" y2="195" stroke="rgba(139,92,246,0.12)" strokeWidth="1" />
      <circle cx="720" cy="60" r="50" fill="none" stroke="rgba(59,130,246,0.06)" strokeWidth="1.5" />
    </svg>
  ),
  leaderboard: (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="ph-lb-glow" cx="50%" cy="0%" r="70%">
          <stop offset="0%" stopColor="hsl(45 100% 60%)" stopOpacity="0.1" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="220" fill="url(#ph-lb-glow)" />
      {/* Trophy cups decorative */}
      <g opacity="0.07" fill="hsl(45,100%,60%)" transform="translate(640,30)">
        <rect x="20" y="40" width="60" height="50" rx="30" />
        <rect x="30" y="86" width="40" height="10" />
        <rect x="15" y="93" width="70" height="6" rx="3" />
        <rect x="25" y="96" width="50" height="20" rx="2" />
      </g>
      {/* Podium bars */}
      <rect x="160" y="140" width="60" height="60" rx="4" fill="rgba(59,130,246,0.07)" />
      <rect x="230" y="110" width="60" height="90" rx="4" fill="rgba(139,92,246,0.06)" />
      <rect x="300" y="150" width="60" height="50" rx="4" fill="rgba(59,130,246,0.05)" />
      {/* Stars */}
      {[100, 200, 580, 700].map((x, i) => (
        <circle key={i} cx={x} cy={20 + i * 15} r="1.5" fill="rgba(255,255,255,0.25)" />
      ))}
      <line x1="0" y1="200" x2="800" y2="200" stroke="rgba(139,92,246,0.12)" strokeWidth="1" />
    </svg>
  ),
  stats: (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="ph-stats-glow" cx="80%" cy="30%" r="50%">
          <stop offset="0%" stopColor="hsl(160 84% 39%)" stopOpacity="0.1" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="220" fill="url(#ph-stats-glow)" />
      {/* Chart bars */}
      {[120, 160, 90, 140, 180, 110, 155].map((h, i) => (
        <rect
          key={i}
          x={500 + i * 38}
          y={210 - h}
          width={26}
          height={h}
          rx="3"
          fill={`rgba(${i % 2 === 0 ? "59,130,246" : "139,92,246"},0.08)`}
        />
      ))}
      {/* Line chart */}
      <polyline
        points="80,160 160,130 240,150 320,100 400,120 480,80 560,90"
        fill="none"
        stroke="rgba(59,130,246,0.15)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Data points */}
      {[[80,160],[160,130],[240,150],[320,100],[400,120],[480,80],[560,90]].map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r="3" fill="rgba(59,130,246,0.2)" />
      ))}
      <line x1="0" y1="200" x2="800" y2="200" stroke="rgba(59,130,246,0.12)" strokeWidth="1" />
    </svg>
  ),
  settings: (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="ph-set-glow" cx="15%" cy="50%" r="40%">
          <stop offset="0%" stopColor="hsl(217 91% 60%)" stopOpacity="0.09" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="220" fill="url(#ph-set-glow)" />
      {/* Gear circles */}
      <circle cx="680" cy="80" r="55" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" strokeDasharray="25 12" />
      <circle cx="680" cy="80" r="30" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8" strokeDasharray="14 8" />
      <circle cx="680" cy="80" r="12" fill="rgba(255,255,255,0.04)" />
      {/* Small gear */}
      <circle cx="610" cy="140" r="28" fill="none" stroke="rgba(59,130,246,0.07)" strokeWidth="8" strokeDasharray="12 6" />
      <circle cx="610" cy="140" r="12" fill="rgba(59,130,246,0.04)" />
      {/* Horizontal rule */}
      <line x1="0" y1="200" x2="800" y2="200" stroke="rgba(59,130,246,0.1)" strokeWidth="1" />
    </svg>
  ),
  admin: (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="ph-adm-glow" cx="50%" cy="0%" r="60%">
          <stop offset="0%" stopColor="hsl(330 80% 60%)" stopOpacity="0.1" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="220" fill="url(#ph-adm-glow)" />
      {/* Shield icon decorative */}
      <g opacity="0.07" fill="white" transform="translate(640,20)">
        <path d="M60 10 L100 25 L100 70 Q100 100 60 120 Q20 100 20 70 L20 25 Z" />
      </g>
      {/* Grid dots (data representation) */}
      {Array.from({ length: 5 }, (_, row) =>
        Array.from({ length: 10 }, (_, col) => (
          <circle
            key={`${row}-${col}`}
            cx={80 + col * 60}
            cy={50 + row * 35}
            r="2"
            fill="rgba(255,255,255,0.06)"
          />
        ))
      )}
      <line x1="0" y1="200" x2="800" y2="200" stroke="rgba(330,0,60,0.12)" strokeWidth="1" />
    </svg>
  ),
  messages: (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="ph-msg-glow" cx="70%" cy="40%" r="50%">
          <stop offset="0%" stopColor="hsl(270 75% 60%)" stopOpacity="0.1" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="220" fill="url(#ph-msg-glow)" />
      {/* Chat bubble decorative */}
      <rect x="560" y="40" width="160" height="60" rx="16" fill="rgba(139,92,246,0.07)" />
      <path d="M 575 100 L 565 120 L 600 100 Z" fill="rgba(139,92,246,0.07)" />
      <rect x="580" y="110" width="120" height="50" rx="12" fill="rgba(59,130,246,0.06)" />
      <path d="M 685 160 L 695 180 L 660 160 Z" fill="rgba(59,130,246,0.06)" />
      {/* Lines inside bubbles */}
      <rect x="576" y="58" width="80" height="4" rx="2" fill="rgba(255,255,255,0.08)" />
      <rect x="576" y="68" width="50" height="4" rx="2" fill="rgba(255,255,255,0.06)" />
      <rect x="590" y="122" width="70" height="4" rx="2" fill="rgba(255,255,255,0.08)" />
      <line x1="0" y1="200" x2="800" y2="200" stroke="rgba(139,92,246,0.12)" strokeWidth="1" />
    </svg>
  ),
};

export function PageHero({ title, subtitle, icon, motif = "chess", children }: PageHeroProps) {
  const { phoneMode } = useTheme();

  if (phoneMode) {
    return (
      <div className="px-4 pt-3 pb-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          {icon && (
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold leading-tight">{title}</h1>
            {subtitle && <p className="text-[11px] text-muted-foreground leading-tight">{subtitle}</p>}
          </div>
        </div>
        {children && <div className="mt-2">{children}</div>}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden" style={{ minHeight: "180px" }}>
      {/* Thematic background motif */}
      <div className="absolute inset-0 z-0">
        {MOTIFS[motif]}
        {/* Dark gradient wash at bottom for content legibility */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(9,11,20,0.5) 0%, rgba(9,11,20,0.85) 100%)",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-1">
            {icon && (
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shadow-lg shadow-primary/20">
                {icon}
              </div>
            )}
            <h1 className="text-3xl md:text-4xl font-bold font-display">{title}</h1>
          </div>
          {subtitle && (
            <p className="text-muted-foreground mt-1 ml-[52px]" style={icon ? {} : { marginLeft: 0 }}>
              {subtitle}
            </p>
          )}
          {children && <div className="mt-4">{children}</div>}
        </motion.div>
      </div>
    </div>
  );
}
