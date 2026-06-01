import React from "react";

type SvgProps = React.SVGProps<SVGSVGElement>;

// ─── GOLD TROPHY (1st place / Victory) ───────────────────────────────────────
// Ornate metallic trophy with cup, handles, base, engraving, star burst
export function GoldTrophy({ className, ...props }: SvgProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className={className} {...props}>
      <defs>
        <linearGradient id="gt-cup" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#fff4a0"/>
          <stop offset="25%"  stopColor="#f5d040"/>
          <stop offset="60%"  stopColor="#c88010"/>
          <stop offset="100%" stopColor="#8c5500"/>
        </linearGradient>
        <linearGradient id="gt-base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#e8c030"/>
          <stop offset="50%"  stopColor="#a86010"/>
          <stop offset="100%" stopColor="#704000"/>
        </linearGradient>
        <linearGradient id="gt-stem" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#c89020"/>
          <stop offset="45%"  stopColor="#f5d840"/>
          <stop offset="100%" stopColor="#a07010"/>
        </linearGradient>
        <radialGradient id="gt-glow" cx="50%" cy="40%" r="55%">
          <stop offset="0%"   stopColor="#ffe060" stopOpacity="0.7"/>
          <stop offset="100%" stopColor="#c88010" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="gt-shine" cx="35%" cy="22%" r="45%">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.55"/>
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
        </radialGradient>
      </defs>

      {/* Outer glow */}
      <circle cx="32" cy="28" r="28" fill="url(#gt-glow)"/>

      {/* Star burst behind trophy */}
      {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const r1 = i % 2 === 0 ? 24 : 16;
        return (
          <line key={deg}
            x1={32} y1={28}
            x2={32 + Math.cos(rad) * r1} y2={28 + Math.sin(rad) * r1}
            stroke="#f0c020" strokeWidth={i % 2 === 0 ? 1.5 : 0.8} opacity={i % 2 === 0 ? 0.22 : 0.12}/>
        );
      })}

      {/* Left handle */}
      <path d="M14,20 Q6,20 6,30 Q6,40 14,42"
        fill="none" stroke="url(#gt-cup)" strokeWidth="5" strokeLinecap="round"/>
      <path d="M14,20 Q6,20 6,30 Q6,40 14,42"
        fill="none" stroke="#fff4a0" strokeWidth="1.5" opacity="0.3" strokeLinecap="round"/>

      {/* Right handle */}
      <path d="M50,20 Q58,20 58,30 Q58,40 50,42"
        fill="none" stroke="url(#gt-cup)" strokeWidth="5" strokeLinecap="round"/>
      <path d="M50,20 Q58,20 58,30 Q58,40 50,42"
        fill="none" stroke="#fff4a0" strokeWidth="1.5" opacity="0.3" strokeLinecap="round"/>

      {/* Cup body */}
      <path d="M14,10 Q14,6 18,6 L46,6 Q50,6 50,10 L50,36 Q50,44 32,48 Q14,44 14,36 Z"
        fill="url(#gt-cup)"/>
      {/* Cup rim */}
      <path d="M14,10 Q14,6 18,6 L46,6 Q50,6 50,10 L50,14 Q50,14 32,16 Q14,14 14,10 Z"
        fill="#ffe080" opacity="0.5"/>
      {/* Cup shine overlay */}
      <ellipse cx="28" cy="22" rx="10" ry="14" fill="url(#gt-shine)"/>
      {/* Inner shadow at cup sides */}
      <path d="M16,12 L16,36 Q16,42 32,46" fill="none" stroke="#704000" strokeWidth="1.5" opacity="0.3"/>
      <path d="M48,12 L48,36 Q48,42 32,46" fill="none" stroke="#704000" strokeWidth="1.5" opacity="0.25"/>

      {/* Engraving — star on cup face */}
      <path d="M32,20 L33.8,25.5 L39.5,25.5 L34.9,28.8 L36.7,34.3 L32,31 L27.3,34.3 L29.1,28.8 L24.5,25.5 L30.2,25.5 Z"
        fill="#c88010" opacity="0.7"/>
      <path d="M32,20 L33.8,25.5 L39.5,25.5 L34.9,28.8 L36.7,34.3 L32,31 L27.3,34.3 L29.1,28.8 L24.5,25.5 L30.2,25.5 Z"
        fill="none" stroke="#ffe060" strokeWidth="0.8" opacity="0.6"/>

      {/* Stem */}
      <rect x="27" y="48" width="10" height="7" rx="1.5" fill="url(#gt-stem)"/>
      <rect x="28" y="48" width="8" height="2" rx="1" fill="#fff4a0" opacity="0.25"/>

      {/* Base — three tiers */}
      <rect x="20" y="55" width="24" height="4" rx="2" fill="url(#gt-base)"/>
      <rect x="17" y="57" width="30" height="5" rx="2" fill="url(#gt-base)"/>
      <rect x="14" y="60" width="36" height="4" rx="2" fill="url(#gt-base)"/>
      {/* Base highlight */}
      <rect x="15" y="60" width="34" height="1.5" rx="0.8" fill="#f0d060" opacity="0.3"/>
    </svg>
  );
}

// ─── SILVER TROPHY (2nd place) ────────────────────────────────────────────────
export function SilverTrophy({ className, ...props }: SvgProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" className={className} {...props}>
      <defs>
        <linearGradient id="st-cup2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#e8e8f0"/>
          <stop offset="30%"  stopColor="#c0c0d0"/>
          <stop offset="70%"  stopColor="#8090a8"/>
          <stop offset="100%" stopColor="#505870"/>
        </linearGradient>
        <linearGradient id="st-base2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#c8c8d8"/>
          <stop offset="100%" stopColor="#606878"/>
        </linearGradient>
        <radialGradient id="st-shine2" cx="35%" cy="25%" r="45%">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="st-glow2" cx="50%" cy="40%" r="50%">
          <stop offset="0%"   stopColor="#d0d8e8" stopOpacity="0.45"/>
          <stop offset="100%" stopColor="#90a0c0" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="28" cy="24" r="24" fill="url(#st-glow2)"/>
      {/* Left handle */}
      <path d="M12,17 Q5,17 5,26 Q5,35 12,37"
        fill="none" stroke="url(#st-cup2)" strokeWidth="4.5" strokeLinecap="round"/>
      {/* Right handle */}
      <path d="M44,17 Q51,17 51,26 Q51,35 44,37"
        fill="none" stroke="url(#st-cup2)" strokeWidth="4.5" strokeLinecap="round"/>
      {/* Cup */}
      <path d="M12,8 Q12,5 16,5 L40,5 Q44,5 44,8 L44,32 Q44,40 28,43 Q12,40 12,32 Z"
        fill="url(#st-cup2)"/>
      {/* Rim */}
      <path d="M12,8 Q12,5 16,5 L40,5 Q44,5 44,8 L44,12 Q44,12 28,14 Q12,12 12,8 Z"
        fill="#e8e8f0" opacity="0.45"/>
      <ellipse cx="24" cy="18" rx="9" ry="12" fill="url(#st-shine2)"/>
      {/* Number 2 on cup */}
      <text x="28" y="32" textAnchor="middle" fontSize="14" fontWeight="900"
        fill="#607090" opacity="0.8" fontFamily="Arial, sans-serif">2</text>
      {/* Stem */}
      <rect x="24" y="43" width="8" height="6" rx="1" fill="url(#st-cup2)"/>
      {/* Base */}
      <rect x="18" y="49" width="20" height="3.5" rx="1.5" fill="url(#st-base2)"/>
      <rect x="15" y="51" width="26" height="4" rx="2" fill="url(#st-base2)"/>
      <rect x="15" y="51" width="26" height="1.5" rx="0.8" fill="#d8d8e8" opacity="0.3"/>
    </svg>
  );
}

// ─── BRONZE TROPHY (3rd place) ────────────────────────────────────────────────
export function BronzeTrophy({ className, ...props }: SvgProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" className={className} {...props}>
      <defs>
        <linearGradient id="bt-cup" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#f0b880"/>
          <stop offset="35%"  stopColor="#c87840"/>
          <stop offset="75%"  stopColor="#905030"/>
          <stop offset="100%" stopColor="#603820"/>
        </linearGradient>
        <linearGradient id="bt-base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#d08850"/>
          <stop offset="100%" stopColor="#704030"/>
        </linearGradient>
        <radialGradient id="bt-shine" cx="32%" cy="22%" r="48%">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="bt-glow" cx="50%" cy="40%" r="50%">
          <stop offset="0%"   stopColor="#e09050" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#a06030" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="26" cy="22" r="22" fill="url(#bt-glow)"/>
      {/* Left handle */}
      <path d="M11,16 Q5,16 5,24 Q5,32 11,34"
        fill="none" stroke="url(#bt-cup)" strokeWidth="4" strokeLinecap="round"/>
      {/* Right handle */}
      <path d="M41,16 Q47,16 47,24 Q47,32 41,34"
        fill="none" stroke="url(#bt-cup)" strokeWidth="4" strokeLinecap="round"/>
      {/* Cup */}
      <path d="M11,7 Q11,4 15,4 L37,4 Q41,4 41,7 L41,30 Q41,37 26,40 Q11,37 11,30 Z"
        fill="url(#bt-cup)"/>
      {/* Rim */}
      <path d="M11,7 Q11,4 15,4 L37,4 Q41,4 41,7 L41,11 Q41,11 26,13 Q11,11 11,7 Z"
        fill="#f0b880" opacity="0.45"/>
      <ellipse cx="22" cy="16" rx="8" ry="11" fill="url(#bt-shine)"/>
      {/* Number 3 */}
      <text x="26" y="30" textAnchor="middle" fontSize="13" fontWeight="900"
        fill="#704030" opacity="0.75" fontFamily="Arial, sans-serif">3</text>
      {/* Stem */}
      <rect x="22" y="40" width="8" height="5" rx="1" fill="url(#bt-cup)"/>
      {/* Base */}
      <rect x="16" y="45" width="20" height="3" rx="1.5" fill="url(#bt-base)"/>
      <rect x="13" y="47" width="26" height="4" rx="2" fill="url(#bt-base)"/>
      <rect x="13" y="47" width="26" height="1.5" rx="0.8" fill="#f0b880" opacity="0.25"/>
    </svg>
  );
}

// ─── VICTORY TROPHY (PostGame win) ────────────────────────────────────────────
// Large ornate — same as gold but with green winner glow variant
export function VictoryTrophy({ className, ...props }: SvgProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" className={className} {...props}>
      <defs>
        <linearGradient id="vt-cup" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#fff4a0"/>
          <stop offset="25%"  stopColor="#f0d030"/>
          <stop offset="65%"  stopColor="#c07808"/>
          <stop offset="100%" stopColor="#7a4800"/>
        </linearGradient>
        <linearGradient id="vt-base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#e8c020"/>
          <stop offset="100%" stopColor="#6c3c00"/>
        </linearGradient>
        <radialGradient id="vt-glow" cx="50%" cy="42%" r="55%">
          <stop offset="0%"   stopColor="#88ff88" stopOpacity="0.35"/>
          <stop offset="50%"  stopColor="#ffe040" stopOpacity="0.15"/>
          <stop offset="100%" stopColor="transparent" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="vt-shine" cx="32%" cy="20%" r="50%">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
        </radialGradient>
      </defs>
      {/* Win glow */}
      <circle cx="40" cy="35" r="36" fill="url(#vt-glow)"/>
      {/* Star burst */}
      {[0,22.5,45,67.5,90,112.5,135,157.5,180,202.5,225,247.5,270,292.5,315,337.5].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const long = deg % 45 === 0;
        return (
          <line key={deg}
            x1={40} y1={32}
            x2={40 + Math.cos(rad) * (long ? 38 : 28)} y2={32 + Math.sin(rad) * (long ? 38 : 28)}
            stroke={long ? "#ffe060" : "#88ff88"} strokeWidth={long ? 2 : 1}
            opacity={long ? 0.2 : 0.1}/>
        );
      })}
      {/* Handles */}
      <path d="M18,24 Q8,24 8,38 Q8,52 18,54"
        fill="none" stroke="url(#vt-cup)" strokeWidth="6.5" strokeLinecap="round"/>
      <path d="M62,24 Q72,24 72,38 Q72,52 62,54"
        fill="none" stroke="url(#vt-cup)" strokeWidth="6.5" strokeLinecap="round"/>
      {/* Handle shine */}
      <path d="M19,26 Q9,26 9,38 Q9,50 19,52"
        fill="none" stroke="#fff4a0" strokeWidth="1.5" opacity="0.25" strokeLinecap="round"/>
      {/* Cup body */}
      <path d="M18,12 Q18,7 24,7 L56,7 Q62,7 62,12 L62,46 Q62,58 40,62 Q18,58 18,46 Z"
        fill="url(#vt-cup)"/>
      {/* Cup rim */}
      <path d="M18,12 Q18,7 24,7 L56,7 Q62,7 62,12 L62,18 Q62,18 40,20 Q18,18 18,12 Z"
        fill="#fff4a0" opacity="0.4"/>
      <ellipse cx="34" cy="28" rx="13" ry="18" fill="url(#vt-shine)"/>
      {/* Left inner shadow */}
      <path d="M20,15 L20,46 Q20,54 40,59" fill="none" stroke="#7a4800" strokeWidth="2" opacity="0.25"/>
      {/* Star engraving */}
      <path d="M40,25 L42.4,32 L50,32 L44,36.5 L46.5,43.5 L40,39 L33.5,43.5 L36,36.5 L30,32 L37.6,32 Z"
        fill="#c07808" opacity="0.8"/>
      <path d="M40,25 L42.4,32 L50,32 L44,36.5 L46.5,43.5 L40,39 L33.5,43.5 L36,36.5 L30,32 L37.6,32 Z"
        fill="none" stroke="#ffe060" strokeWidth="1" opacity="0.65"/>
      {/* Stem */}
      <rect x="33" y="62" width="14" height="8" rx="2" fill="#c07808"/>
      <rect x="34" y="62" width="12" height="3" rx="1" fill="#fff4a0" opacity="0.2"/>
      {/* Base */}
      <rect x="24" y="70" width="32" height="4.5" rx="2" fill="url(#vt-base)"/>
      <rect x="20" y="73" width="40" height="5.5" rx="2.5" fill="url(#vt-base)"/>
      <rect x="16" y="76" width="48" height="4" rx="2" fill="url(#vt-base)"/>
      <rect x="17" y="76" width="46" height="1.5" rx="0.8" fill="#f0d040" opacity="0.28"/>
    </svg>
  );
}

// ─── DEFEAT ICON (PostGame loss) ──────────────────────────────────────────────
// Cracked shield — broken pride, dark red tones
export function DefeatIcon({ className, ...props }: SvgProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className={className} {...props}>
      <defs>
        <linearGradient id="di-shield" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#551018"/>
          <stop offset="55%"  stopColor="#380810"/>
          <stop offset="100%" stopColor="#200408"/>
        </linearGradient>
        <radialGradient id="di-glow" cx="50%" cy="45%" r="50%">
          <stop offset="0%"   stopColor="#cc1122" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#cc1122" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="di-crack" cx="50%" cy="40%" r="50%">
          <stop offset="0%"   stopColor="#ff4444" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#cc1122" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#di-glow)"/>
      {/* Shield silhouette */}
      <path d="M10,14 L32,8 L54,14 L54,38 Q54,54 32,60 Q10,54 10,38 Z"
        fill="url(#di-shield)"/>
      {/* Shield border */}
      <path d="M10,14 L32,8 L54,14 L54,38 Q54,54 32,60 Q10,54 10,38 Z"
        fill="none" stroke="#880010" strokeWidth="2"/>
      {/* Inner shield */}
      <path d="M16,18 L32,13 L48,18 L48,37 Q48,50 32,56 Q16,50 16,37 Z"
        fill="#300808" opacity="0.7"/>
      {/* Crack lines */}
      <path d="M32,14 L28,28 L34,32 L26,50" fill="none" stroke="#cc2233" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M28,28 L20,22" fill="none" stroke="#aa1122" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M34,32 L44,28" fill="none" stroke="#aa1122" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M26,44 L18,46" fill="none" stroke="#881111" strokeWidth="1.2" strokeLinecap="round"/>
      {/* Crack glow */}
      <path d="M32,14 L28,28 L34,32 L26,50" fill="none" stroke="#ff4455" strokeWidth="1"
        opacity="0.4" strokeLinecap="round"/>
      {/* X mark in shield */}
      <line x1="22" y1="22" x2="42" y2="42" stroke="#cc1122" strokeWidth="3" opacity="0.35"
        strokeLinecap="round"/>
      <line x1="42" y1="22" x2="22" y2="42" stroke="#cc1122" strokeWidth="3" opacity="0.35"
        strokeLinecap="round"/>
    </svg>
  );
}

// ─── DRAW ICON (PostGame draw) ────────────────────────────────────────────────
// Balanced crossed swords — symmetrical, electric blue/white
export function DrawIcon({ className, ...props }: SvgProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className={className} {...props}>
      <defs>
        <linearGradient id="dr-blade1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#c0d8ff"/>
          <stop offset="55%"  stopColor="#6088cc"/>
          <stop offset="100%" stopColor="#304890"/>
        </linearGradient>
        <linearGradient id="dr-blade2" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#c0d8ff"/>
          <stop offset="55%"  stopColor="#6088cc"/>
          <stop offset="100%" stopColor="#304890"/>
        </linearGradient>
        <radialGradient id="dr-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#4488ff" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#4488ff" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#dr-glow)"/>
      {/* Left sword (angled top-left to bottom-right) */}
      <path d="M10,10 L42,42" stroke="url(#dr-blade1)" strokeWidth="5" strokeLinecap="round"/>
      <path d="M10,10 L42,42" stroke="#c0d8ff" strokeWidth="1.5" opacity="0.35" strokeLinecap="round"/>
      {/* Right sword (angled top-right to bottom-left) */}
      <path d="M54,10 L22,42" stroke="url(#dr-blade2)" strokeWidth="5" strokeLinecap="round"/>
      <path d="M54,10 L22,42" stroke="#c0d8ff" strokeWidth="1.5" opacity="0.35" strokeLinecap="round"/>
      {/* Crossguards */}
      <rect x="24" y="27" width="16" height="5" rx="2.5"
        fill="#2244aa" stroke="#4488ff" strokeWidth="1" transform="rotate(-45, 32, 29.5)"/>
      <rect x="24" y="27" width="16" height="5" rx="2.5"
        fill="#2244aa" stroke="#4488ff" strokeWidth="1" transform="rotate(45, 32, 29.5)"/>
      {/* Clash spark at center */}
      <circle cx="32" cy="32" r="4" fill="#88aaff" opacity="0.6"/>
      <circle cx="32" cy="32" r="2" fill="white" opacity="0.7"/>
      {/* Spark lines */}
      {[0,60,120,180,240,300].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <line key={deg}
            x1={32 + Math.cos(rad) * 4} y1={32 + Math.sin(rad) * 4}
            x2={32 + Math.cos(rad) * 9} y2={32 + Math.sin(rad) * 9}
            stroke="#aaccff" strokeWidth="1.5" opacity="0.65" strokeLinecap="round"/>
        );
      })}
      {/* Hilts */}
      <circle cx="10" cy="10" r="4" fill="#2244aa" stroke="#4488ff" strokeWidth="1"/>
      <circle cx="54" cy="10" r="4" fill="#2244aa" stroke="#4488ff" strokeWidth="1"/>
      <circle cx="42" cy="42" r="3" fill="#2244aa" stroke="#4488ff" strokeWidth="1"/>
      <circle cx="22" cy="42" r="3" fill="#2244aa" stroke="#4488ff" strokeWidth="1"/>
    </svg>
  );
}

// ─── LEGENDARY MEDAL (achievement tier) ───────────────────────────────────────
// Octagonal gold medallion with crown, engravings, star center, ribbon
export function LegendaryMedal({ size = 48, className, ...props }: SvgProps & { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width={size} height={size} className={className} {...props}>
      <defs>
        <linearGradient id="lm-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#fff4a0"/>
          <stop offset="28%"  stopColor="#f0c830"/>
          <stop offset="60%"  stopColor="#c07808"/>
          <stop offset="100%" stopColor="#7a4800"/>
        </linearGradient>
        <linearGradient id="lm-inner" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#ffe060"/>
          <stop offset="100%" stopColor="#b06000"/>
        </linearGradient>
        <radialGradient id="lm-shine" cx="30%" cy="22%" r="50%">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="lm-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#ffd040" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#ffd040" stopOpacity="0"/>
        </radialGradient>
      </defs>
      {/* Ribbon (top) */}
      <rect x="20" y="0" width="8" height="10" rx="2" fill="#cc1122"/>
      <rect x="21" y="0" width="2" height="10" fill="#ff4455" opacity="0.4"/>
      {/* Outer glow */}
      <circle cx="24" cy="28" r="19" fill="url(#lm-glow)"/>
      {/* Octagon body */}
      <polygon points="14,11 34,11 42,19 42,37 34,45 14,45 6,37 6,19"
        fill="url(#lm-body)"/>
      {/* Inner octagon ring */}
      <polygon points="16,14 32,14 39,21 39,35 32,42 16,42 9,35 9,21"
        fill="none" stroke="#c07808" strokeWidth="1.5"/>
      {/* Inner face */}
      <polygon points="17,16 31,16 38,23 38,33 31,40 17,40 10,33 10,23"
        fill="url(#lm-inner)"/>
      {/* Shine */}
      <ellipse cx="20" cy="22" rx="7" ry="9" fill="url(#lm-shine)"/>
      {/* Star center */}
      <path d="M24,18 L25.8,23.5 L31.5,23.5 L26.9,26.8 L28.7,32.3 L24,29 L19.3,32.3 L21.1,26.8 L16.5,23.5 L22.2,23.5 Z"
        fill="#c07808" opacity="0.7"/>
      <path d="M24,18 L25.8,23.5 L31.5,23.5 L26.9,26.8 L28.7,32.3 L24,29 L19.3,32.3 L21.1,26.8 L16.5,23.5 L22.2,23.5 Z"
        fill="none" stroke="#ffe060" strokeWidth="0.8" opacity="0.8"/>
      {/* Corner ornament dots */}
      {[
        [11,15],[37,15],[11,41],[37,41],[24,11],[24,45],
      ].map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r="1.8" fill="#ffe060" opacity="0.55"/>
      ))}
    </svg>
  );
}

// ─── EPIC MEDAL ───────────────────────────────────────────────────────────────
// Hexagonal purple crystal medallion with faceted look
export function EpicMedal({ size = 48, className, ...props }: SvgProps & { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width={size} height={size} className={className} {...props}>
      <defs>
        <linearGradient id="em-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#e090ff"/>
          <stop offset="35%"  stopColor="#9040d0"/>
          <stop offset="75%"  stopColor="#5018a0"/>
          <stop offset="100%" stopColor="#280868"/>
        </linearGradient>
        <linearGradient id="em-facet" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#c070ff" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#7030c0" stopOpacity="0.2"/>
        </linearGradient>
        <radialGradient id="em-shine" cx="28%" cy="20%" r="50%">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.55"/>
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="em-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#9040e0" stopOpacity="0.55"/>
          <stop offset="100%" stopColor="#9040e0" stopOpacity="0"/>
        </radialGradient>
      </defs>
      {/* Ribbon */}
      <rect x="20" y="0" width="8" height="10" rx="2" fill="#6020a0"/>
      <rect x="21" y="0" width="2" height="10" fill="#a040e0" opacity="0.4"/>
      {/* Glow */}
      <circle cx="24" cy="28" r="19" fill="url(#em-glow)"/>
      {/* Hex body */}
      <polygon points="24,10 40,19 40,37 24,46 8,37 8,19"
        fill="url(#em-body)"/>
      {/* Facet lines — crystal cut */}
      <line x1="24" y1="10" x2="24" y2="28" stroke="#e0a0ff" strokeWidth="1" opacity="0.35"/>
      <line x1="40" y1="19" x2="24" y2="28" stroke="#c080ff" strokeWidth="1" opacity="0.25"/>
      <line x1="40" y1="37" x2="24" y2="28" stroke="#c080ff" strokeWidth="1" opacity="0.25"/>
      <line x1="24" y1="46" x2="24" y2="28" stroke="#b060ff" strokeWidth="1" opacity="0.2"/>
      <line x1="8"  y1="37" x2="24" y2="28" stroke="#c080ff" strokeWidth="1" opacity="0.25"/>
      <line x1="8"  y1="19" x2="24" y2="28" stroke="#e0a0ff" strokeWidth="1" opacity="0.3"/>
      {/* Top-left facet fill */}
      <polygon points="24,10 8,19 24,28" fill="url(#em-facet)"/>
      {/* Center gem */}
      <circle cx="24" cy="28" r="7" fill="#4018a0"/>
      <circle cx="24" cy="28" r="7" fill="none" stroke="#c080ff" strokeWidth="1.5"/>
      <ellipse cx="22" cy="25" rx="3" ry="4" fill="url(#em-shine)"/>
      {/* Lightning bolt */}
      <path d="M26,22 L22,28 L25,28 L21,34" fill="none" stroke="#e0a0ff"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── RARE MEDAL ───────────────────────────────────────────────────────────────
// Diamond-shaped cyan/blue metallic badge
export function RareMedal({ size = 48, className, ...props }: SvgProps & { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width={size} height={size} className={className} {...props}>
      <defs>
        <linearGradient id="rm-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#80e8ff"/>
          <stop offset="35%"  stopColor="#2090c8"/>
          <stop offset="75%"  stopColor="#0850a0"/>
          <stop offset="100%" stopColor="#042060"/>
        </linearGradient>
        <radialGradient id="rm-shine" cx="30%" cy="20%" r="50%">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.55"/>
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="rm-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#00c8e8" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#00c8e8" stopOpacity="0"/>
        </radialGradient>
      </defs>
      {/* Ribbon */}
      <rect x="20" y="0" width="8" height="10" rx="2" fill="#005880"/>
      <rect x="21" y="0" width="2" height="10" fill="#00b8d8" opacity="0.4"/>
      {/* Glow */}
      <circle cx="24" cy="28" r="19" fill="url(#rm-glow)"/>
      {/* Pentagon shield */}
      <polygon points="24,10 42,22 36,44 12,44 6,22"
        fill="url(#rm-body)"/>
      {/* Inner border */}
      <polygon points="24,14 38,24 33,41 15,41 10,24"
        fill="none" stroke="#40b8e8" strokeWidth="1.5"/>
      {/* Center inner */}
      <polygon points="24,17 36,26 32,38 16,38 12,26"
        fill="#042060" opacity="0.6"/>
      {/* Shine */}
      <ellipse cx="20" cy="22" rx="7" ry="9" fill="url(#rm-shine)"/>
      {/* Target rings */}
      <circle cx="24" cy="29" r="8" fill="none" stroke="#40b8e8" strokeWidth="1" opacity="0.6"/>
      <circle cx="24" cy="29" r="4" fill="none" stroke="#80d8f8" strokeWidth="1" opacity="0.7"/>
      <circle cx="24" cy="29" r="2" fill="#80d8f8" opacity="0.8"/>
      <circle cx="24" cy="29" r="1" fill="white" opacity="0.6"/>
    </svg>
  );
}

// ─── COMMON MEDAL ─────────────────────────────────────────────────────────────
// Round silver coin — simple, clean, still premium
export function CommonMedal({ size = 48, className, ...props }: SvgProps & { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width={size} height={size} className={className} {...props}>
      <defs>
        <linearGradient id="cm-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#d8d8e8"/>
          <stop offset="40%"  stopColor="#9898b0"/>
          <stop offset="75%"  stopColor="#606880"/>
          <stop offset="100%" stopColor="#404858"/>
        </linearGradient>
        <radialGradient id="cm-shine" cx="30%" cy="22%" r="50%">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="cm-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#a0a8c0" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#a0a8c0" stopOpacity="0"/>
        </radialGradient>
      </defs>
      {/* Ribbon */}
      <rect x="20" y="0" width="8" height="10" rx="2" fill="#4a5060"/>
      <rect x="21" y="0" width="2" height="10" fill="#8090a0" opacity="0.4"/>
      {/* Glow */}
      <circle cx="24" cy="28" r="18" fill="url(#cm-glow)"/>
      {/* Coin body */}
      <circle cx="24" cy="28" r="17" fill="url(#cm-body)"/>
      {/* Rim */}
      <circle cx="24" cy="28" r="17" fill="none" stroke="#c8c8d8" strokeWidth="1.5"/>
      {/* Shine */}
      <ellipse cx="19" cy="22" rx="7" ry="9" fill="url(#cm-shine)"/>
      {/* Center ridge ring */}
      <circle cx="24" cy="28" r="12" fill="none" stroke="#b0b0c0" strokeWidth="1" opacity="0.6"/>
      {/* Shield/star shape */}
      <path d="M24,20 Q28,20 30,24 L30,32 Q30,36 24,38 Q18,36 18,32 L18,24 Q20,20 24,20 Z"
        fill="#606878" opacity="0.5"/>
      <path d="M24,20 Q28,20 30,24 L30,32 Q30,36 24,38 Q18,36 18,32 L18,24 Q20,20 24,20 Z"
        fill="none" stroke="#c8c8d8" strokeWidth="1" opacity="0.6"/>
    </svg>
  );
}

// ─── GOLD COIN (reward/wallet) ────────────────────────────────────────────────
export function GoldCoin({ className, ...props }: SvgProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className={className} {...props}>
      <defs>
        <linearGradient id="gc-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#fff080"/>
          <stop offset="40%"  stopColor="#e8b020"/>
          <stop offset="85%"  stopColor="#b87010"/>
          <stop offset="100%" stopColor="#7a4800"/>
        </linearGradient>
        <radialGradient id="gc-shine" cx="30%" cy="20%" r="50%">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.55"/>
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="14" fill="url(#gc-body)"/>
      <circle cx="16" cy="16" r="14" fill="none" stroke="#c8880a" strokeWidth="1"/>
      <circle cx="16" cy="16" r="10" fill="none" stroke="#c8880a" strokeWidth="0.8" opacity="0.5"/>
      <ellipse cx="12" cy="11" rx="5" ry="7" fill="url(#gc-shine)"/>
      <text x="16" y="20" textAnchor="middle" fontSize="10" fontWeight="900"
        fill="#7a4800" opacity="0.85" fontFamily="serif">$</text>
    </svg>
  );
}

// ─── STREAK FLAME (hot streak) ────────────────────────────────────────────────
export function StreakFlame({ className, ...props }: SvgProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" className={className} {...props}>
      <defs>
        <linearGradient id="sf-fire" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%"   stopColor="#ff2200"/>
          <stop offset="35%"  stopColor="#ff6600"/>
          <stop offset="65%"  stopColor="#ffaa00"/>
          <stop offset="100%" stopColor="#ffee80"/>
        </linearGradient>
        <radialGradient id="sf-core" cx="50%" cy="70%" r="55%">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.7"/>
          <stop offset="100%" stopColor="#ffaa00" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="sf-glow" cx="50%" cy="80%" r="50%">
          <stop offset="0%"   stopColor="#ff4400" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#ff4400" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <ellipse cx="16" cy="44" rx="12" ry="5" fill="url(#sf-glow)"/>
      {/* Outer flame */}
      <path d="M16,2 Q8,8 6,18 Q4,26 6,30 Q3,24 8,22 Q5,32 8,36 Q10,40 16,42 Q22,40 24,36 Q27,32 24,22 Q29,24 26,30 Q28,26 26,18 Q24,8 16,2 Z"
        fill="url(#sf-fire)"/>
      {/* Inner bright core */}
      <path d="M16,18 Q12,22 12,30 Q12,36 16,38 Q20,36 20,30 Q20,22 16,18 Z"
        fill="url(#sf-core)"/>
    </svg>
  );
}
