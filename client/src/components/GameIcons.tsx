import React from "react";

type IconProps = React.SVGProps<SVGSVGElement>;

// ─── CHESS ──────────────────────────────────────────────────────────────────
export function ChessIcon({ className, ...props }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className={className} {...props}>
      <defs>
        <linearGradient id="ci-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a0818"/>
          <stop offset="100%" stopColor="#040610"/>
        </linearGradient>
        <linearGradient id="ci-piece" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8e4f8"/>
          <stop offset="50%" stopColor="#b8b0d8"/>
          <stop offset="100%" stopColor="#7870a8"/>
        </linearGradient>
        <linearGradient id="ci-crown" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe880"/>
          <stop offset="60%" stopColor="#d4a020"/>
          <stop offset="100%" stopColor="#9a6810"/>
        </linearGradient>
        <radialGradient id="ci-glow" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="#6030cc" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#6030cc" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="ci-spotlight" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.04"/>
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="48" height="48" fill="url(#ci-bg)" rx="4"/>
      {/* Board squares — very dark */}
      <rect x="0"  y="0"  width="24" height="24" fill="#0e0c20" rx="3"/>
      <rect x="24" y="0"  width="24" height="24" fill="#08061a" rx="3"/>
      <rect x="0"  y="24" width="24" height="24" fill="#08061a" rx="3"/>
      <rect x="24" y="24" width="24" height="24" fill="#0e0c20" rx="3"/>
      {/* Board border glow lines */}
      <line x1="24" y1="0" x2="24" y2="48" stroke="#6030cc" strokeWidth="0.5" opacity="0.25"/>
      <line x1="0" y1="24" x2="48" y2="24" stroke="#6030cc" strokeWidth="0.5" opacity="0.25"/>
      {/* Ambient glow pool under piece */}
      <ellipse cx="24" cy="46" rx="16" ry="5" fill="url(#ci-glow)"/>
      {/* Spotlight */}
      <rect x="0" y="0" width="48" height="48" fill="url(#ci-spotlight)" rx="4"/>
      {/* Base */}
      <rect x="11" y="40" width="26" height="5" rx="2" fill="url(#ci-piece)"/>
      <rect x="13" y="38" width="22" height="4" rx="1.5" fill="url(#ci-piece)"/>
      {/* Body */}
      <path d="M16,38 L17,26 Q24,20 31,26 L32,38 Z" fill="url(#ci-piece)"/>
      <path d="M18,37 L19,27 Q22,23 26,24 L25,37 Z" fill="white" opacity="0.10"/>
      {/* Body edge glow */}
      <path d="M16,38 L17,26 Q24,20 31,26 L32,38" fill="none" stroke="#9966ee" strokeWidth="0.5" opacity="0.5"/>
      {/* Neck */}
      <rect x="19" y="21" width="10" height="6" rx="2.5" fill="url(#ci-piece)"/>
      {/* Crown base */}
      <rect x="15" y="17" width="18" height="5" rx="2" fill="url(#ci-crown)"/>
      {/* Crown prongs */}
      <rect x="15" y="8" width="5" height="10" rx="2" fill="url(#ci-crown)"/>
      <rect x="21.5" y="6" width="5" height="12" rx="2" fill="url(#ci-crown)"/>
      <rect x="28" y="8" width="5" height="10" rx="2" fill="url(#ci-crown)"/>
      {/* Crown highlights */}
      <rect x="22" y="6" width="4" height="2.5" rx="1" fill="#fff8b0" opacity="0.8"/>
      <rect x="15.5" y="8" width="4" height="2" rx="1" fill="#fff8b0" opacity="0.6"/>
      <rect x="28" y="8" width="4" height="2" rx="1" fill="#fff8b0" opacity="0.6"/>
      {/* Crown glow */}
      <rect x="15" y="17" width="18" height="5" rx="2" fill="none" stroke="#ffe060" strokeWidth="0.5" opacity="0.6"/>
      {/* Cross finial */}
      <rect x="22" y="0" width="4" height="8" rx="1.5" fill="url(#ci-piece)"/>
      <rect x="19" y="3" width="10" height="3.5" rx="1.5" fill="url(#ci-piece)"/>
      <rect x="23" y="0" width="2" height="3" rx="1" fill="white" opacity="0.3"/>
    </svg>
  );
}

// ─── MINI GOLF ───────────────────────────────────────────────────────────────
export function MiniGolfIcon({ className, ...props }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className={className} {...props}>
      <defs>
        <linearGradient id="mg-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#060a0c"/>
          <stop offset="100%" stopColor="#030608"/>
        </linearGradient>
        <linearGradient id="mg-turf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d3a14"/>
          <stop offset="100%" stopColor="#071c0a"/>
        </linearGradient>
        <radialGradient id="mg-spotlight" cx="65%" cy="45%" r="38%">
          <stop offset="0%" stopColor="#1a5022" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#1a5022" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="mg-ball" cx="35%" cy="30%" r="55%">
          <stop offset="0%" stopColor="#ffffff"/>
          <stop offset="60%" stopColor="#d0d0d0"/>
          <stop offset="100%" stopColor="#999"/>
        </radialGradient>
        <radialGradient id="mg-ballglow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00ff88" stopOpacity="0.15"/>
          <stop offset="100%" stopColor="#00ff88" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="48" height="48" fill="url(#mg-bg)" rx="4"/>
      {/* Night sky — subtle stars */}
      {[[6,5,0.7,0.5],[15,9,0.6,0.35],[30,4,0.8,0.6],[42,8,0.5,0.4],[38,14,0.7,0.45]].map(([x,y,r,o],i)=>(
        <circle key={i} cx={x} cy={y} r={r} fill="white" opacity={o}/>
      ))}
      {/* Course turf */}
      <path d="M0,30 Q14,24 24,28 Q36,32 48,26 L48,48 L0,48 Z" fill="url(#mg-turf)"/>
      {/* Spotlight on hole area */}
      <ellipse cx="36" cy="36" rx="14" ry="12" fill="url(#mg-spotlight)"/>
      {/* Green turf edge highlight */}
      <path d="M0,30 Q14,24 24,28 Q36,32 48,26" fill="none" stroke="#1a7020" strokeWidth="0.8" opacity="0.5"/>
      {/* Flag pole */}
      <line x1="36" y1="10" x2="36" y2="36" stroke="#8899aa" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Flag — bright white with slight glow */}
      <path d="M36,10 L47,15 L36,20 Z" fill="#e0e8ff"/>
      <path d="M36,10 L47,15 L43,13 L38,11 Z" fill="white" opacity="0.4"/>
      {/* Glow on flag */}
      <path d="M36,10 L47,15 L36,20 Z" fill="none" stroke="#aabbff" strokeWidth="0.5" opacity="0.6"/>
      {/* Hole cup */}
      <ellipse cx="36" cy="36" rx="5" ry="1.8" fill="#020608"/>
      <ellipse cx="36" cy="36" rx="5" ry="1.8" fill="none" stroke="#1a7020" strokeWidth="1" opacity="0.8"/>
      {/* Ball glow */}
      <circle cx="10" cy="33" r="7" fill="url(#mg-ballglow)"/>
      {/* Golf ball */}
      <circle cx="10" cy="33" r="5" fill="url(#mg-ball)"/>
      {/* Dimples */}
      <circle cx="10" cy="31.5" r="0.9" fill="#aaa" opacity="0.3"/>
      <circle cx="8.2" cy="34" r="0.9" fill="#aaa" opacity="0.25"/>
      <circle cx="11.8" cy="34" r="0.9" fill="#aaa" opacity="0.25"/>
      {/* Trajectory — clean neon green dashed arc */}
      <path d="M15,31 Q23,17 31,31" fill="none" stroke="#00e060"
        strokeWidth="1.5" strokeDasharray="2.5 2" opacity="0.6"/>
      {/* Putter */}
      <line x1="4" y1="42" x2="11" y2="32" stroke="#607080" strokeWidth="1.8" strokeLinecap="round"/>
      <rect x="2.5" y="42" width="3" height="4.5" rx="1" fill="#778899"/>
    </svg>
  );
}

// ─── CONNECT 4 ───────────────────────────────────────────────────────────────
export function Connect4Icon({ className, ...props }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className={className} {...props}>
      <defs>
        <linearGradient id="c4-frame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a1840"/>
          <stop offset="100%" stopColor="#060e28"/>
        </linearGradient>
        <radialGradient id="c4-amber" cx="35%" cy="28%" r="60%">
          <stop offset="0%" stopColor="#ffcc44"/>
          <stop offset="100%" stopColor="#c07800"/>
        </radialGradient>
        <radialGradient id="c4-cyan" cx="35%" cy="28%" r="60%">
          <stop offset="0%" stopColor="#44ddff"/>
          <stop offset="100%" stopColor="#0088b0"/>
        </radialGradient>
        <radialGradient id="c4-glow-a" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffaa00" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#ffaa00" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="c4-glow-c" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00ccff" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#00ccff" stopOpacity="0"/>
        </radialGradient>
      </defs>
      {/* Frame */}
      <rect x="1" y="7" width="46" height="40" rx="4" fill="url(#c4-frame)"/>
      {/* Frame edge glow */}
      <rect x="1" y="7" width="46" height="40" rx="4" fill="none" stroke="#1a3080" strokeWidth="1" opacity="0.7"/>
      {/* Column dividers */}
      {[12.5,23.5,35.5].map((x,i)=>(
        <line key={i} x1={x} y1="7" x2={x} y2="47" stroke="#0a1840" strokeWidth="1.5" opacity="0.8"/>
      ))}
      {/* Top lip */}
      <rect x="1" y="4" width="46" height="5" rx="3" fill="#122060"/>
      <rect x="2" y="4" width="44" height="2" rx="1" fill="#2244aa" opacity="0.5"/>
      {/* Tokens */}
      {[
        {cx:6.5,  cy:13, t:"empty"},  {cx:17.5, cy:13, t:"empty"},
        {cx:29.5, cy:13, t:"empty"},  {cx:41.5, cy:13, t:"empty"},
        {cx:6.5,  cy:24, t:"empty"},  {cx:17.5, cy:24, t:"cyan"},
        {cx:29.5, cy:24, t:"empty"},  {cx:41.5, cy:24, t:"empty"},
        {cx:6.5,  cy:35, t:"amber"},  {cx:17.5, cy:35, t:"cyan"},
        {cx:29.5, cy:35, t:"amber"},  {cx:41.5, cy:35, t:"empty"},
        {cx:6.5,  cy:44, t:"cyan"},   {cx:17.5, cy:44, t:"amber"},
        {cx:29.5, cy:44, t:"cyan"},   {cx:41.5, cy:44, t:"amber"},
      ].map(({cx,cy,t},i)=>(
        <g key={i}>
          {t!=="empty" && (
            <circle cx={cx} cy={cy} r="7.5"
              fill={t==="amber" ? "url(#c4-glow-a)" : "url(#c4-glow-c)"}/>
          )}
          <circle cx={cx} cy={cy} r="5"
            fill={t==="empty" ? "#04091e" : t==="amber" ? "url(#c4-amber)" : "url(#c4-cyan)"}
            stroke={t==="empty" ? "#0e1e4a" : "none"} strokeWidth="1"/>
          {t!=="empty" && (
            <ellipse cx={cx-1.5} cy={cy-1.8} rx="2" ry="1.1" fill="white" opacity="0.25"/>
          )}
        </g>
      ))}
      {/* Winning line suggestion */}
      <line x1="6.5" y1="44" x2="29.5" y2="24" stroke="white" strokeWidth="1.5" opacity="0.12" strokeLinecap="round"/>
    </svg>
  );
}

// ─── AIR HOCKEY ──────────────────────────────────────────────────────────────
export function AirHockeyIcon({ className, ...props }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className={className} {...props}>
      <defs>
        <linearGradient id="ah-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#040c14"/>
          <stop offset="100%" stopColor="#020608"/>
        </linearGradient>
        <radialGradient id="ah-surface" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#00b8d4" stopOpacity="0.12"/>
          <stop offset="100%" stopColor="#004460" stopOpacity="0.03"/>
        </radialGradient>
        <radialGradient id="ah-redpad" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#ff5566"/>
          <stop offset="100%" stopColor="#cc1122"/>
        </radialGradient>
        <radialGradient id="ah-blupad" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#44aaff"/>
          <stop offset="100%" stopColor="#1155cc"/>
        </radialGradient>
        <radialGradient id="ah-puck" cx="35%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#484848"/>
          <stop offset="100%" stopColor="#101010"/>
        </radialGradient>
      </defs>
      {/* Table */}
      <rect x="1" y="5" width="46" height="38" rx="5" fill="url(#ah-bg)"/>
      <rect x="1" y="5" width="46" height="38" rx="5" fill="url(#ah-surface)"/>
      {/* Neon border */}
      <rect x="1" y="5" width="46" height="38" rx="5" fill="none" stroke="#00ccee" strokeWidth="1.8" opacity="0.55"/>
      {/* Center dashed line */}
      <line x1="24" y1="5" x2="24" y2="43" stroke="#00ccee" strokeWidth="1.2"
        strokeDasharray="4 3" opacity="0.3"/>
      {/* Center circle */}
      <circle cx="24" cy="24" r="7" fill="none" stroke="#00ccee" strokeWidth="1.2" opacity="0.2"/>
      <circle cx="24" cy="24" r="1.5" fill="#00ccee" opacity="0.45"/>
      {/* Goals */}
      <rect x="0" y="18" width="3" height="12" rx="1" fill="#00ccee" opacity="0.45"/>
      <rect x="45" y="18" width="3" height="12" rx="1" fill="#00ccee" opacity="0.45"/>
      <line x1="4" y1="18" x2="4" y2="30" stroke="#00ccee" strokeWidth="0.8" opacity="0.4"/>
      <line x1="44" y1="18" x2="44" y2="30" stroke="#00ccee" strokeWidth="0.8" opacity="0.4"/>
      {/* Red paddle */}
      <circle cx="10" cy="24" r="7" fill="#cc1122" opacity="0.15"/>
      <circle cx="10" cy="24" r="5.5" fill="url(#ah-redpad)"/>
      <circle cx="10" cy="24" r="2" fill="#aa0011"/>
      <ellipse cx="8.5" cy="22" rx="2" ry="1.1" fill="white" opacity="0.22"/>
      {/* Red paddle glow */}
      <circle cx="10" cy="24" r="5.5" fill="none" stroke="#ff4455" strokeWidth="0.5" opacity="0.6"/>
      {/* Blue paddle */}
      <circle cx="38" cy="24" r="7" fill="#1155cc" opacity="0.15"/>
      <circle cx="38" cy="24" r="5.5" fill="url(#ah-blupad)"/>
      <circle cx="38" cy="24" r="2" fill="#0a3a99"/>
      <ellipse cx="36.5" cy="22" rx="2" ry="1.1" fill="white" opacity="0.22"/>
      {/* Blue paddle glow */}
      <circle cx="38" cy="24" r="5.5" fill="none" stroke="#33aaff" strokeWidth="0.5" opacity="0.6"/>
      {/* Puck */}
      <circle cx="24" cy="20" r="3.5" fill="url(#ah-puck)"/>
      <ellipse cx="23" cy="19" rx="1.3" ry="0.8" fill="white" opacity="0.2"/>
      {/* Motion trail */}
      {[1,2,3].map(n=>(
        <circle key={n} cx={24-n*2.2} cy={20+n*1.5} r={3.5-n*0.7}
          fill="#222" opacity={0.15-n*0.04}/>
      ))}
      {/* Speed lines */}
      <line x1="20" y1="19" x2="15" y2="17" stroke="#00ccee" strokeWidth="0.8" opacity="0.3"/>
      <line x1="20" y1="21" x2="15" y2="22" stroke="#00ccee" strokeWidth="0.6" opacity="0.2"/>
    </svg>
  );
}

// ─── ROCK PAPER SCISSORS ─────────────────────────────────────────────────────
export function RockPaperScissorsIcon({ className, ...props }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className={className} {...props}>
      <defs>
        <radialGradient id="rps-bg" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#10081c"/>
          <stop offset="100%" stopColor="#050410"/>
        </radialGradient>
      </defs>
      {/* Background */}
      <rect x="0" y="0" width="48" height="48" fill="url(#rps-bg)" rx="4"/>
      {/* Three tactical sectors */}
      <path d="M24,24 L24,45 A21,21 0 0,1 5.8,33.5 Z" fill="#5518aa" opacity="0.75"/>
      <path d="M24,24 L24,45 A21,21 0 0,1 5.8,33.5 Z" fill="none" stroke="#8844ff" strokeWidth="0.8" opacity="0.5"/>
      <path d="M24,24 L42.2,33.5 A21,21 0 0,1 24,45 Z" fill="#0e3898" opacity="0.75"/>
      <path d="M24,24 L42.2,33.5 A21,21 0 0,1 24,45 Z" fill="none" stroke="#3366ff" strokeWidth="0.8" opacity="0.5"/>
      <path d="M24,24 L5.8,33.5 A21,21 0 0,1 42.2,33.5 Z" fill="#981030" opacity="0.75"/>
      <path d="M24,24 L5.8,33.5 A21,21 0 0,1 42.2,33.5 Z" fill="none" stroke="#ff3355" strokeWidth="0.8" opacity="0.5"/>
      {/* Sector divider lines */}
      <line x1="24" y1="24" x2="24" y2="45" stroke="#ffffff" strokeWidth="0.5" opacity="0.12"/>
      <line x1="24" y1="24" x2="42.2" y2="33.5" stroke="#ffffff" strokeWidth="0.5" opacity="0.12"/>
      <line x1="24" y1="24" x2="5.8" y2="33.5" stroke="#ffffff" strokeWidth="0.5" opacity="0.12"/>
      {/* Center hex — focal ring */}
      <circle cx="24" cy="24" r="6" fill="#08040e"/>
      <circle cx="24" cy="24" r="6" fill="none" stroke="#8844ff" strokeWidth="0.8" opacity="0.6"/>
      {/* Vs text */}
      <text x="24" y="27.5" textAnchor="middle" fontSize="6" fontWeight="900"
        fill="#cc88ff" fontFamily="monospace" opacity="0.9">VS</text>
      {/* Sector symbols — minimal & clean */}
      {/* Rock — fist dot bottom-left */}
      <circle cx="14" cy="37" r="4.5" fill="#7733cc" opacity="0.85"/>
      <circle cx="14" cy="37" r="4.5" fill="none" stroke="#aa66ff" strokeWidth="0.8"/>
      <rect x="11.5" y="34.5" width="5" height="4" rx="1.5" fill="#cc99ff" opacity="0.9"/>
      {/* Paper — corner bottom-right */}
      <rect x="28" y="32.5" width="6" height="8" rx="1.5" fill="#3355cc" opacity="0.9"/>
      <rect x="29" y="30.5" width="4" height="4" rx="1" fill="#2244bb" opacity="0.7"/>
      <rect x="29" y="32" width="1.2" height="5.5" rx="0.6" fill="#5577ee" opacity="0.9"/>
      <rect x="31" y="32" width="1.2" height="5.5" rx="0.6" fill="#5577ee" opacity="0.9"/>
      <rect x="33" y="32" width="1.2" height="5.5" rx="0.6" fill="#5577ee" opacity="0.9"/>
      {/* Scissors — top center */}
      <line x1="22" y1="5" x2="26" y2="18" stroke="#ff5566" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="26" y1="5" x2="22" y2="18" stroke="#ff5566" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="24" cy="16" r="2.5" fill="#cc1122"/>
      <circle cx="24" cy="16" r="1.2" fill="#ff6677"/>
      {/* Outer ring */}
      <circle cx="24" cy="24" r="22" fill="none" stroke="#3311aa" strokeWidth="0.8" opacity="0.25"/>
    </svg>
  );
}

// ─── DOTS & BOXES ────────────────────────────────────────────────────────────
export function DotsAndBoxesIcon({ className, ...props }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className={className} {...props}>
      <defs>
        <linearGradient id="db-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#080a14"/>
          <stop offset="100%" stopColor="#040608"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="48" height="48" fill="url(#db-bg)" rx="4"/>
      {/* Claimed box A — violet */}
      <rect x="8" y="8" width="15" height="15" rx="1.5" fill="#5520aa" opacity="0.3"/>
      <rect x="8" y="8" width="15" height="15" rx="1.5" fill="none" stroke="#8844ee" strokeWidth="2"/>
      {/* A glow */}
      <rect x="8" y="8" width="15" height="15" rx="1.5" fill="none" stroke="#aa66ff" strokeWidth="0.5" opacity="0.4"/>
      {/* Claimed box B — cyan */}
      <rect x="25" y="25" width="15" height="15" rx="1.5" fill="#006055" opacity="0.3"/>
      <rect x="25" y="25" width="15" height="15" rx="1.5" fill="none" stroke="#00bbaa" strokeWidth="2"/>
      <rect x="25" y="25" width="15" height="15" rx="1.5" fill="none" stroke="#44ddcc" strokeWidth="0.5" opacity="0.4"/>
      {/* Contested lines */}
      <line x1="23" y1="8"  x2="40" y2="8"  stroke="#304488" strokeWidth="1.8" strokeDasharray="3 2.5" opacity="0.5"/>
      <line x1="8"  y1="23" x2="8"  y2="40" stroke="#304488" strokeWidth="1.8" strokeDasharray="3 2.5" opacity="0.45"/>
      <line x1="25" y1="8"  x2="25" y2="23" stroke="#304488" strokeWidth="1.8" strokeDasharray="3 2.5" opacity="0.4"/>
      <line x1="23" y1="25" x2="40" y2="25" stroke="#304488" strokeWidth="1.8" strokeDasharray="3 2.5" opacity="0.4"/>
      {/* Solid owned lines */}
      <line x1="8"  y1="8"  x2="23" y2="8"  stroke="#8844ee" strokeWidth="2"/>
      <line x1="8"  y1="8"  x2="8"  y2="23" stroke="#8844ee" strokeWidth="2"/>
      <line x1="23" y1="8"  x2="23" y2="23" stroke="#8844ee" strokeWidth="2"/>
      <line x1="8"  y1="23" x2="23" y2="23" stroke="#8844ee" strokeWidth="2"/>
      <line x1="25" y1="25" x2="40" y2="25" stroke="#00bbaa" strokeWidth="2"/>
      <line x1="25" y1="25" x2="25" y2="40" stroke="#00bbaa" strokeWidth="2"/>
      <line x1="40" y1="25" x2="40" y2="40" stroke="#00bbaa" strokeWidth="2"/>
      <line x1="25" y1="40" x2="40" y2="40" stroke="#00bbaa" strokeWidth="2"/>
      {/* Grid nodes */}
      {[8,23,25,40].flatMap(x=>[8,23,25,40].map(y=>({x,y}))).map(({x,y},i)=>{
        const isA = x<=23&&y<=23, isB = x>=25&&y>=25;
        return (
          <circle key={i} cx={x} cy={y} r={isA||isB ? 3 : 2}
            fill={isA ? "#9966ff" : isB ? "#00ddcc" : "#3344aa"}
            stroke="#000" strokeWidth="0.5"/>
        );
      })}
      {/* Score labels */}
      <text x="15.5" y="19" textAnchor="middle" fontSize="6.5" fill="#cc99ff"
        fontWeight="bold" fontFamily="monospace" opacity="0.9">A</text>
      <text x="32.5" y="36" textAnchor="middle" fontSize="6.5" fill="#00eedd"
        fontWeight="bold" fontFamily="monospace" opacity="0.9">B</text>
    </svg>
  );
}

// ─── 8-BALL POOL ─────────────────────────────────────────────────────────────
export function EightBallIcon({ className, ...props }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className={className} {...props}>
      <defs>
        <radialGradient id="eb-felt" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#0e3820"/>
          <stop offset="100%" stopColor="#040e08"/>
        </radialGradient>
        <radialGradient id="eb-ball" cx="34%" cy="26%" r="60%">
          <stop offset="0%" stopColor="#3a3a3a"/>
          <stop offset="45%" stopColor="#0e0e0e"/>
          <stop offset="100%" stopColor="#020202"/>
        </radialGradient>
        <radialGradient id="eb-circle" cx="45%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#ffffff"/>
          <stop offset="100%" stopColor="#d4d4d4"/>
        </radialGradient>
        <radialGradient id="eb-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00ff88" stopOpacity="0.1"/>
          <stop offset="100%" stopColor="#00ff88" stopOpacity="0"/>
        </radialGradient>
      </defs>
      {/* Felt */}
      <rect x="0" y="0" width="48" height="48" fill="url(#eb-felt)" rx="4"/>
      {/* Felt texture grain */}
      {[6,14,22,30,38].map(y=>(
        <line key={y} x1="0" y1={y} x2="48" y2={y} stroke="#071808" strokeWidth="0.5" opacity="0.5"/>
      ))}
      {/* Table rail hint */}
      <rect x="0" y="0" width="48" height="48" rx="4" fill="none" stroke="#1a5030" strokeWidth="3"/>
      {/* Cue stick */}
      <rect x="-2" y="-2" width="22" height="4" rx="2"
        fill="#b89060" transform="rotate(36, 0, 0)"/>
      <rect x="-2" y="-2" width="5" height="4" rx="2"
        fill="#d4aa70" transform="rotate(36, 0, 0)" opacity="0.7"/>
      {/* Cue tip */}
      <circle cx="11" cy="13" r="2.2" fill="#6688bb"/>
      {/* Ambient glow under ball */}
      <circle cx="26" cy="27" r="18" fill="url(#eb-glow)"/>
      {/* Ball shadow */}
      <ellipse cx="27" cy="42" rx="13" ry="3.5" fill="#000" opacity="0.45"/>
      {/* Main ball */}
      <circle cx="26" cy="26" r="15" fill="url(#eb-ball)"/>
      {/* Ball rim glow */}
      <circle cx="26" cy="26" r="15" fill="none" stroke="#444" strokeWidth="0.5" opacity="0.7"/>
      {/* White circle */}
      <circle cx="26" cy="26" r="6.5" fill="url(#eb-circle)"/>
      {/* Number 8 */}
      <text x="26" y="29.5" textAnchor="middle" fontSize="9" fontWeight="900"
        fill="#0a0a0a" fontFamily="Arial, sans-serif">8</text>
      {/* Specular highlights */}
      <ellipse cx="19" cy="17" rx="5.5" ry="3.5" fill="white" opacity="0.13"/>
      <ellipse cx="18" cy="16" rx="2.5" ry="1.5" fill="white" opacity="0.16"/>
    </svg>
  );
}

// ─── BOWLING ──────────────────────────────────────────────────────────────────
export function BowlingIcon({ className, ...props }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className={className} {...props}>
      <defs>
        <linearGradient id="bw-lane" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#120e06"/>
          <stop offset="100%" stopColor="#070500"/>
        </linearGradient>
        <radialGradient id="bw-spotlight" cx="65%" cy="30%" r="50%">
          <stop offset="0%" stopColor="#ffeecc" stopOpacity="0.08"/>
          <stop offset="100%" stopColor="#ffeecc" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="bw-pin" cx="32%" cy="22%" r="65%">
          <stop offset="0%" stopColor="#f4f4f8"/>
          <stop offset="65%" stopColor="#e0e0e8"/>
          <stop offset="100%" stopColor="#aaaac0"/>
        </radialGradient>
        <radialGradient id="bw-ball" cx="32%" cy="26%" r="60%">
          <stop offset="0%" stopColor="#6644aa"/>
          <stop offset="50%" stopColor="#3a1e72"/>
          <stop offset="100%" stopColor="#16083a"/>
        </radialGradient>
        <radialGradient id="bw-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#cc44ff" stopOpacity="0.2"/>
          <stop offset="100%" stopColor="#cc44ff" stopOpacity="0"/>
        </radialGradient>
      </defs>
      {/* Dark lane */}
      <rect x="0" y="0" width="48" height="48" fill="url(#bw-lane)" rx="4"/>
      {/* Lane wood grain */}
      {[5,13,21,29,37,45].map(y=>(
        <line key={y} x1="0" y1={y} x2="48" y2={y} stroke="#1c1408" strokeWidth="0.6" opacity="0.6"/>
      ))}
      {/* Spotlight */}
      <rect x="0" y="0" width="48" height="48" rx="4" fill="url(#bw-spotlight)"/>
      {/* Ball glow */}
      <circle cx="12" cy="32" r="12" fill="url(#bw-glow)"/>
      {/* Ball shadow */}
      <ellipse cx="12" cy="42" rx="10" ry="3" fill="#000" opacity="0.45"/>
      {/* Bowling ball */}
      <circle cx="12" cy="32" r="10" fill="url(#bw-ball)"/>
      {/* Ball rim */}
      <circle cx="12" cy="32" r="10" fill="none" stroke="#8855cc" strokeWidth="0.6" opacity="0.5"/>
      {/* Finger holes */}
      <circle cx="9.5"  cy="29" r="1.6" fill="#0e0630" opacity="0.9"/>
      <circle cx="13.5" cy="27.5" r="1.6" fill="#0e0630" opacity="0.9"/>
      <circle cx="13"   cy="31.5" r="1.6" fill="#0e0630" opacity="0.9"/>
      {/* Ball highlight */}
      <ellipse cx="7" cy="25" rx="4" ry="2.2" fill="white" opacity="0.12"/>
      {/* Motion lines */}
      <line x1="21" y1="29" x2="26" y2="29" stroke="#6644aa" strokeWidth="2" opacity="0.4"/>
      <line x1="22" y1="33" x2="28" y2="33" stroke="#6644aa" strokeWidth="1.5" opacity="0.3"/>
      {/* Pin shadow */}
      <ellipse cx="34" cy="40" rx="6" ry="2" fill="#000" opacity="0.35"/>
      {/* Pin body */}
      <path d="M30,40 Q30,30 32,25 Q33,19 34,16 Q35,19 36,25 Q38,30 38,40 Z"
        fill="url(#bw-pin)"/>
      {/* Pin neck */}
      <ellipse cx="34" cy="22" rx="2.5" ry="1.5" fill="#e4e4ec"/>
      {/* Pin head */}
      <circle cx="34" cy="16" r="4.5" fill="url(#bw-pin)"/>
      {/* Red stripes → now deep magenta for premium look */}
      <path d="M31,35 Q34,33.5 37,35" fill="none" stroke="#cc2266" strokeWidth="2" strokeLinecap="round"/>
      <path d="M31.5,31 Q34,29.5 36.5,31" fill="none" stroke="#cc2266" strokeWidth="1.8" strokeLinecap="round"/>
      {/* Pin highlight */}
      <path d="M32,38 Q32.5,28 33.5,18" fill="none" stroke="white" strokeWidth="0.8"
        opacity="0.28" strokeLinecap="round"/>
      {/* Impact lines */}
      {[0,60,120,180,240,300].map(deg=>{
        const r=(deg*Math.PI)/180;
        return <line key={deg} x1={34} y1={18}
          x2={34+Math.cos(r)*9} y2={18+Math.sin(r)*9}
          stroke="#ffcc44" strokeWidth="0.8" opacity="0.14"/>;
      })}
    </svg>
  );
}

// ─── CUP KING ─────────────────────────────────────────────────────────────────
export function CupKingIcon({ className, ...props }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className={className} {...props}>
      <defs>
        <linearGradient id="ck-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#060812"/>
          <stop offset="100%" stopColor="#020408"/>
        </linearGradient>
        <linearGradient id="ck-cup" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00aa88"/>
          <stop offset="100%" stopColor="#006044"/>
        </linearGradient>
        <linearGradient id="ck-table" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e1408"/>
          <stop offset="100%" stopColor="#100a04"/>
        </linearGradient>
        <radialGradient id="ck-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00ffaa" stopOpacity="0.12"/>
          <stop offset="100%" stopColor="#00ffaa" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="48" height="48" fill="url(#ck-bg)" rx="4"/>
      {/* Table */}
      <rect x="0" y="38" width="48" height="10" rx="2" fill="url(#ck-table)"/>
      <rect x="0" y="38" width="48" height="1.5" fill="#2a1a0a" opacity="0.8"/>
      {/* Ambient glow behind cups */}
      <rect x="0" y="0" width="48" height="48" rx="4" fill="url(#ck-glow)"/>
      {/* Row 3 — back (3 cups) */}
      {[10,24,38].map(cx=>(
        <g key={cx}>
          <path d={`M${cx-5.5},22 L${cx-4.5},38 L${cx+4.5},38 L${cx+5.5},22 Z`} fill="url(#ck-cup)"/>
          <ellipse cx={cx} cy="22" rx="5.5" ry="1.8" fill="#00cc99"/>
          <ellipse cx={cx} cy="38" rx="4.5" ry="1.4" fill="#003d28" opacity="0.85"/>
          <ellipse cx={cx} cy="32" rx="4" ry="1.1" fill="#008866" opacity="0.5"/>
          <path d={`M${cx-4.5},24 L${cx-4},36`} stroke="white" strokeWidth="1" opacity="0.15" strokeLinecap="round"/>
          {/* Cup rim glow */}
          <ellipse cx={cx} cy="22" rx="5.5" ry="1.8" fill="none" stroke="#00ffaa" strokeWidth="0.6" opacity="0.5"/>
        </g>
      ))}
      {/* Row 2 — middle (2 cups) */}
      {[17,31].map(cx=>(
        <g key={cx}>
          <path d={`M${cx-5.5},12 L${cx-4.5},28 L${cx+4.5},28 L${cx+5.5},12 Z`} fill="url(#ck-cup)"/>
          <ellipse cx={cx} cy="12" rx="5.5" ry="1.8" fill="#00cc99"/>
          <ellipse cx={cx} cy="28" rx="4.5" ry="1.4" fill="#003d28" opacity="0.85"/>
          <ellipse cx={cx} cy="22" rx="4" ry="1.1" fill="#008866" opacity="0.5"/>
          <path d={`M${cx-4.5},14 L${cx-4},26`} stroke="white" strokeWidth="1" opacity="0.15" strokeLinecap="round"/>
          <ellipse cx={cx} cy="12" rx="5.5" ry="1.8" fill="none" stroke="#00ffaa" strokeWidth="0.6" opacity="0.5"/>
        </g>
      ))}
      {/* Row 1 — front (1 cup) */}
      {[24].map(cx=>(
        <g key={cx}>
          <path d={`M${cx-5.5},2 L${cx-4.5},18 L${cx+4.5},18 L${cx+5.5},2 Z`} fill="url(#ck-cup)"/>
          <ellipse cx={cx} cy="2" rx="5.5" ry="1.8" fill="#22ddaa"/>
          <ellipse cx={cx} cy="18" rx="4.5" ry="1.4" fill="#004a30" opacity="0.85"/>
          <ellipse cx={cx} cy="12" rx="4" ry="1.1" fill="#009977" opacity="0.5"/>
          <path d={`M${cx-4.5},4 L${cx-4},16`} stroke="white" strokeWidth="1.2" opacity="0.2" strokeLinecap="round"/>
          <ellipse cx={cx} cy="2" rx="5.5" ry="1.8" fill="none" stroke="#44ffcc" strokeWidth="0.7" opacity="0.6"/>
        </g>
      ))}
      {/* Ping pong ball */}
      <circle cx="6" cy="6" r="4" fill="#f0f0f0"/>
      <ellipse cx="4.8" cy="4.8" rx="1.6" ry="0.9" fill="white" opacity="0.5"/>
      {/* Ball arc */}
      <path d="M10,6 Q20,-4 24,2" fill="none" stroke="#88ffdd"
        strokeWidth="1.5" strokeDasharray="2.5 2" opacity="0.55"/>
    </svg>
  );
}

// ─── STACK TOWER ─────────────────────────────────────────────────────────────
export function StackTowerIcon({ className, ...props }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className={className} {...props}>
      <defs>
        <linearGradient id="st-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#040810"/>
          <stop offset="100%" stopColor="#020408"/>
        </linearGradient>
        <linearGradient id="st-b1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e3cc8"/>
          <stop offset="100%" stopColor="#101e80"/>
        </linearGradient>
        <linearGradient id="st-b2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1466aa"/>
          <stop offset="100%" stopColor="#0a3a66"/>
        </linearGradient>
        <linearGradient id="st-b3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0e88cc"/>
          <stop offset="100%" stopColor="#085088"/>
        </linearGradient>
        <linearGradient id="st-b4" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0aaae0"/>
          <stop offset="100%" stopColor="#066688"/>
        </linearGradient>
        <linearGradient id="st-falling" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22ddff"/>
          <stop offset="100%" stopColor="#0899bb"/>
        </linearGradient>
        <radialGradient id="st-glow" cx="50%" cy="100%" r="50%">
          <stop offset="0%" stopColor="#1188ff" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="#1188ff" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="48" height="48" fill="url(#st-bg)" rx="4"/>
      {/* Subtle grid */}
      {[8,16,24,32,40].map(y=>(
        <line key={`h${y}`} x1="0" y1={y} x2="48" y2={y} stroke="#081020" strokeWidth="0.5"/>
      ))}
      {[8,16,24,32,40].map(x=>(
        <line key={`v${x}`} x1={x} y1="0" x2={x} y2="48" stroke="#081020" strokeWidth="0.5"/>
      ))}
      {/* Glow pool at base */}
      <ellipse cx="20" cy="46" rx="18" ry="5" fill="url(#st-glow)"/>
      {/* Ground */}
      <rect x="4" y="44" width="34" height="3" rx="1.5" fill="#0a1428" opacity="0.9"/>
      {/* Block 1 — widest, deep blue */}
      <rect x="5" y="36" width="30" height="8" rx="2" fill="url(#st-b1)"/>
      <rect x="6" y="36" width="28" height="2" rx="1" fill="white" opacity="0.10"/>
      <rect x="5" y="36" width="30" height="8" rx="2" fill="none" stroke="#3366ff" strokeWidth="0.5" opacity="0.6"/>
      {/* Block 2 */}
      <rect x="8" y="28" width="24" height="8" rx="2" fill="url(#st-b2)"/>
      <rect x="9" y="28" width="22" height="2" rx="1" fill="white" opacity="0.10"/>
      <rect x="8" y="28" width="24" height="8" rx="2" fill="none" stroke="#2288cc" strokeWidth="0.5" opacity="0.6"/>
      {/* Block 3 */}
      <rect x="11" y="20" width="18" height="8" rx="2" fill="url(#st-b3)"/>
      <rect x="12" y="20" width="16" height="2" rx="1" fill="white" opacity="0.12"/>
      <rect x="11" y="20" width="18" height="8" rx="2" fill="none" stroke="#22aaee" strokeWidth="0.5" opacity="0.7"/>
      {/* Block 4 — top */}
      <rect x="14" y="12" width="12" height="8" rx="2" fill="url(#st-b4)"/>
      <rect x="15" y="12" width="10" height="2" rx="1" fill="white" opacity="0.14"/>
      <rect x="14" y="12" width="12" height="8" rx="2" fill="none" stroke="#22ccff" strokeWidth="0.6" opacity="0.7"/>
      {/* Falling block — bright cyan */}
      <rect x="30" y="4" width="14" height="8" rx="2" fill="url(#st-falling)" opacity="0.9"/>
      <rect x="31" y="4" width="12" height="2" rx="1" fill="white" opacity="0.18"/>
      <rect x="30" y="4" width="14" height="8" rx="2" fill="none" stroke="#55eeff" strokeWidth="0.7" opacity="0.8"/>
      {/* Target outline */}
      <rect x="14" y="4" width="16" height="8" rx="2" fill="none"
        stroke="#22ccff" strokeWidth="1.2" strokeDasharray="3 2" opacity="0.45"/>
      {/* Motion arrow */}
      <line x1="29" y1="8" x2="26" y2="8" stroke="#55eeff" strokeWidth="2" opacity="0.6"/>
      <path d="M27,5 L23,8 L27,11" fill="none" stroke="#55eeff" strokeWidth="1.5" opacity="0.6"/>
    </svg>
  );
}

// ─── BLOCK BLAST ─────────────────────────────────────────────────────────────
export function BlockBlastIcon({ className, ...props }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className={className} {...props}>
      <defs>
        <linearGradient id="bb-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#060a10"/>
          <stop offset="100%" stopColor="#030508"/>
        </linearGradient>
        <linearGradient id="bb-p1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2255cc"/>
          <stop offset="100%" stopColor="#112288"/>
        </linearGradient>
        <linearGradient id="bb-p2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5522cc"/>
          <stop offset="100%" stopColor="#331188"/>
        </linearGradient>
        <linearGradient id="bb-p3" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#cc2266"/>
          <stop offset="100%" stopColor="#880044"/>
        </linearGradient>
        <linearGradient id="bb-p4" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22aacc"/>
          <stop offset="100%" stopColor="#116688"/>
        </linearGradient>
        <radialGradient id="bb-blast" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.06"/>
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="48" height="48" fill="url(#bb-bg)" rx="4"/>
      {/* Grid lines */}
      {[0,12,24,36,48].map(x=>(
        <line key={`v${x}`} x1={x} y1="0" x2={x} y2="48" stroke="#0c1420" strokeWidth="0.8"/>
      ))}
      {[0,12,24,36,48].map(y=>(
        <line key={`h${y}`} x1="0" y1={y} x2="48" y2={y} stroke="#0c1420" strokeWidth="0.8"/>
      ))}
      {/* Blast glow */}
      <circle cx="24" cy="24" r="18" fill="url(#bb-blast)"/>
      {/* L-piece — blue */}
      <rect x="3" y="12" width="11" height="11" rx="1.5" fill="url(#bb-p1)"/>
      <rect x="3" y="23" width="11" height="11" rx="1.5" fill="url(#bb-p1)"/>
      <rect x="14" y="23" width="11" height="11" rx="1.5" fill="url(#bb-p1)"/>
      {/* Piece highlights */}
      <rect x="3" y="12" width="11" height="11" rx="1.5" fill="none" stroke="#4477ff" strokeWidth="0.8" opacity="0.7"/>
      <rect x="3" y="23" width="11" height="11" rx="1.5" fill="none" stroke="#4477ff" strokeWidth="0.8" opacity="0.7"/>
      <rect x="14" y="23" width="11" height="11" rx="1.5" fill="none" stroke="#4477ff" strokeWidth="0.8" opacity="0.7"/>
      <rect x="4" y="13" width="9" height="2" rx="0.5" fill="white" opacity="0.08"/>
      {/* T-piece — violet */}
      <rect x="26" y="3" width="11" height="11" rx="1.5" fill="url(#bb-p2)"/>
      <rect x="37" y="3" width="11" height="11" rx="1.5" fill="url(#bb-p2)"/>
      <rect x="26" y="14" width="11" height="11" rx="1.5" fill="url(#bb-p2)"/>
      <rect x="26" y="3" width="11" height="11" rx="1.5" fill="none" stroke="#7755ff" strokeWidth="0.8" opacity="0.7"/>
      <rect x="37" y="3" width="11" height="11" rx="1.5" fill="none" stroke="#7755ff" strokeWidth="0.8" opacity="0.7"/>
      <rect x="26" y="14" width="11" height="11" rx="1.5" fill="none" stroke="#7755ff" strokeWidth="0.8" opacity="0.7"/>
      {/* Z-piece — magenta */}
      <rect x="26" y="26" width="11" height="11" rx="1.5" fill="url(#bb-p3)"/>
      <rect x="37" y="26" width="11" height="11" rx="1.5" fill="url(#bb-p3)"/>
      <rect x="26" y="37" width="11" height="11" rx="1.5" fill="url(#bb-p3)"/>
      <rect x="26" y="26" width="11" height="11" rx="1.5" fill="none" stroke="#ff4488" strokeWidth="0.8" opacity="0.7"/>
      <rect x="37" y="26" width="11" height="11" rx="1.5" fill="none" stroke="#ff4488" strokeWidth="0.8" opacity="0.7"/>
      <rect x="26" y="37" width="11" height="11" rx="1.5" fill="none" stroke="#ff4488" strokeWidth="0.8" opacity="0.7"/>
      {/* I-piece — cyan */}
      <rect x="3" y="37" width="11" height="11" rx="1.5" fill="url(#bb-p4)"/>
      <rect x="14" y="37" width="11" height="11" rx="1.5" fill="url(#bb-p4)"/>
      <rect x="3" y="37" width="11" height="11" rx="1.5" fill="none" stroke="#44ccee" strokeWidth="0.8" opacity="0.7"/>
      <rect x="14" y="37" width="11" height="11" rx="1.5" fill="none" stroke="#44ccee" strokeWidth="0.8" opacity="0.7"/>
      {/* Clear line flash */}
      <rect x="0" y="34" width="48" height="2" rx="1" fill="white" opacity="0.05"/>
    </svg>
  );
}


// ─── TRON ───────────────────────────────────────────────────────────────────
export function TronIcon({ className, ...props }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className={className} {...props}>
      <defs>
        <linearGradient id="tr-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#020810"/>
          <stop offset="100%" stopColor="#010408"/>
        </linearGradient>
        <linearGradient id="tr-cycle" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#00ffff"/>
          <stop offset="100%" stopColor="#0088cc"/>
        </linearGradient>
        <linearGradient id="tr-trail" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#00ffff" stopOpacity="0"/>
          <stop offset="100%" stopColor="#00ffff" stopOpacity="0.8"/>
        </linearGradient>
        <radialGradient id="tr-glow" cx="70%" cy="50%" r="40%">
          <stop offset="0%" stopColor="#00ffff" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#00ffff" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="48" height="48" fill="url(#tr-bg)" rx="4"/>
      {/* Grid lines */}
      {[8,16,24,32,40].map(v=>(
        <line key={`gv${v}`} x1={v} y1="0" x2={v} y2="48" stroke="#00ffff" strokeWidth="0.3" opacity="0.12"/>
      ))}
      {[8,16,24,32,40].map(v=>(
        <line key={`gh${v}`} x1="0" y1={v} x2="48" y2={v} stroke="#00ffff" strokeWidth="0.3" opacity="0.12"/>
      ))}
      {/* Perspective grid floor */}
      <path d="M0,48 L24,28 L48,48 Z" fill="none" stroke="#00ffff" strokeWidth="0.4" opacity="0.15"/>
      <line x1="12" y1="48" x2="24" y2="28" stroke="#00ffff" strokeWidth="0.3" opacity="0.1"/>
      <line x1="36" y1="48" x2="24" y2="28" stroke="#00ffff" strokeWidth="0.3" opacity="0.1"/>
      {/* Light cycle trail - vertical then horizontal */}
      <line x1="14" y1="6" x2="14" y2="22" stroke="url(#tr-trail)" strokeWidth="2.5" opacity="0.7"/>
      <line x1="14" y1="22" x2="34" y2="22" stroke="#00ffff" strokeWidth="2.5" opacity="0.8"/>
      {/* Trail glow */}
      <line x1="14" y1="6" x2="14" y2="22" stroke="#00ffff" strokeWidth="6" opacity="0.08"/>
      <line x1="14" y1="22" x2="34" y2="22" stroke="#00ffff" strokeWidth="6" opacity="0.1"/>
      {/* Light cycle body */}
      <ellipse cx="34" cy="22" rx="4" ry="2.5" fill="url(#tr-cycle)"/>
      <ellipse cx="34" cy="22" rx="4" ry="2.5" fill="none" stroke="#00ffff" strokeWidth="0.8" opacity="0.9"/>
      <ellipse cx="33" cy="21" rx="1.5" ry="0.8" fill="white" opacity="0.4"/>
      {/* Cycle head glow */}
      <circle cx="34" cy="22" r="6" fill="url(#tr-glow)"/>
      {/* Opponent trail - orange */}
      <line x1="38" y1="42" x2="38" y2="30" stroke="#ff6600" strokeWidth="2.5" opacity="0.6"/>
      <line x1="38" y1="30" x2="22" y2="30" stroke="#ff6600" strokeWidth="2.5" opacity="0.5"/>
      <line x1="38" y1="42" x2="38" y2="30" stroke="#ff6600" strokeWidth="6" opacity="0.06"/>
      <line x1="38" y1="30" x2="22" y2="30" stroke="#ff6600" strokeWidth="6" opacity="0.06"/>
      {/* Opponent cycle */}
      <ellipse cx="22" cy="30" rx="3.5" ry="2" fill="#ff6600" opacity="0.8"/>
      <ellipse cx="22" cy="30" rx="3.5" ry="2" fill="none" stroke="#ff8800" strokeWidth="0.6" opacity="0.7"/>
      {/* Corner accent glows */}
      <circle cx="0" cy="0" r="12" fill="#00ffff" opacity="0.03"/>
      <circle cx="48" cy="48" r="12" fill="#ff6600" opacity="0.03"/>
      {/* Border glow */}
      <rect x="0" y="0" width="48" height="48" rx="4" fill="none" stroke="#00ffff" strokeWidth="0.8" opacity="0.2"/>
    </svg>
  );
}

// ─── BASKETBALL ──────────────────────────────────────────────────────────────
export function BasketballIcon({ className, ...props }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className={className} {...props}>
      <defs>
        <radialGradient id="bk-bg" cx="50%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#1a0e04"/>
          <stop offset="100%" stopColor="#080400"/>
        </radialGradient>
        <radialGradient id="bk-ball" cx="36%" cy="28%" r="62%">
          <stop offset="0%" stopColor="#ff8c30"/>
          <stop offset="55%" stopColor="#e06010"/>
          <stop offset="100%" stopColor="#7c2a00"/>
        </radialGradient>
        <radialGradient id="bk-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff7700" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#ff7700" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="48" height="48" rx="4" fill="url(#bk-bg)"/>
      {/* Court floor lines */}
      <rect x="0" y="34" width="48" height="14" rx="0" fill="#0f0904" opacity="0.7"/>
      <line x1="0" y1="34" x2="48" y2="34" stroke="#2a1a08" strokeWidth="0.8"/>
      {/* Backboard */}
      <rect x="16" y="4" width="16" height="10" rx="1" fill="#1e1510" stroke="#3a2a18" strokeWidth="0.7"/>
      {/* Hoop */}
      <ellipse cx="24" cy="15" rx="7" ry="2.2" fill="none" stroke="#cc4400" strokeWidth="1.8"/>
      {/* Net lines */}
      {[-5,-2,1,4,7].map((x,i) => (
        <line key={i} x1={24+x} y1={16} x2={24+x*0.6} y2={24} stroke="#cc8844" strokeWidth="0.6" opacity="0.5"/>
      ))}
      <path d="M17,16 Q18,20 19,24 M31,16 Q30,20 29,24" fill="none" stroke="#cc8844" strokeWidth="0.6" opacity="0.5"/>
      {/* Ball glow */}
      <circle cx="24" cy="32" r="11" fill="url(#bk-glow)"/>
      {/* Ball shadow */}
      <ellipse cx="24" cy="42" rx="9" ry="2.5" fill="#000" opacity="0.5"/>
      {/* Ball */}
      <circle cx="24" cy="31" r="10" fill="url(#bk-ball)"/>
      <circle cx="24" cy="31" r="10" fill="none" stroke="#ff6600" strokeWidth="0.5" opacity="0.4"/>
      {/* Seam lines */}
      <path d="M14,31 Q18,25 24,24 Q30,23 34,31" fill="none" stroke="#4a2000" strokeWidth="0.9" opacity="0.8"/>
      <path d="M14,31 Q18,37 24,38 Q30,39 34,31" fill="none" stroke="#4a2000" strokeWidth="0.9" opacity="0.8"/>
      <line x1="24" y1="21" x2="24" y2="41" stroke="#4a2000" strokeWidth="0.9" opacity="0.8"/>
      {/* Highlight */}
      <ellipse cx="19" cy="26" rx="4" ry="2.2" fill="white" opacity="0.15"/>
    </svg>
  );
}

// ─── FOOTBALL ────────────────────────────────────────────────────────────────
export function FootballIcon({ className, ...props }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className={className} {...props}>
      <defs>
        <radialGradient id="fb-bg" cx="50%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#061408"/>
          <stop offset="100%" stopColor="#020602"/>
        </radialGradient>
        <radialGradient id="fb-ball" cx="34%" cy="28%" r="62%">
          <stop offset="0%" stopColor="#c97430"/>
          <stop offset="55%" stopColor="#8b4a10"/>
          <stop offset="100%" stopColor="#3d1c04"/>
        </radialGradient>
        <radialGradient id="fb-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#84cc16" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="#84cc16" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="48" height="48" rx="4" fill="url(#fb-bg)"/>
      {/* Field lines */}
      {[12,24,36].map(x => (
        <line key={x} x1={x} y1="0" x2={x} y2="48" stroke="#0e2a12" strokeWidth="0.7"/>
      ))}
      {/* End zone */}
      <rect x="0" y="0" width="48" height="10" rx="0" fill="#0a2210" opacity="0.6"/>
      {/* Goal posts */}
      <line x1="24" y1="2" x2="24" y2="14" stroke="#e8c840" strokeWidth="1.2"/>
      <line x1="16" y1="7" x2="32" y2="7" stroke="#e8c840" strokeWidth="1.2"/>
      <line x1="16" y1="7" x2="16" y2="2" stroke="#e8c840" strokeWidth="1.2"/>
      <line x1="32" y1="7" x2="32" y2="2" stroke="#e8c840" strokeWidth="1.2"/>
      {/* Ball glow */}
      <circle cx="24" cy="32" r="12" fill="url(#fb-glow)"/>
      {/* Ball shadow */}
      <ellipse cx="26" cy="42" rx="9" ry="2.5" fill="#000" opacity="0.5"/>
      {/* Football shape */}
      <ellipse cx="24" cy="31" rx="12" ry="8" fill="url(#fb-ball)" transform="rotate(-20, 24, 31)"/>
      <ellipse cx="24" cy="31" rx="12" ry="8" fill="none" stroke="#c87020" strokeWidth="0.5" opacity="0.5" transform="rotate(-20, 24, 31)"/>
      {/* Lace */}
      <line x1="22" y1="27" x2="28" y2="33" stroke="white" strokeWidth="1.4" opacity="0.7" strokeLinecap="round"/>
      {[0,1,2,3].map(i => (
        <line key={i} x1={22.5+i*1.5} y1={27.5+i*1.5} x2={21+i*1.5} y2={28.5+i*1.5}
          stroke="white" strokeWidth="0.9" opacity="0.55" strokeLinecap="round"/>
      ))}
      {/* Seam lines */}
      <path d="M13,30 Q18,24 24,25 Q30,26 36,32" fill="none" stroke="#3a1800" strokeWidth="0.8" opacity="0.7" transform="rotate(-20, 24, 31)"/>
      {/* Highlight */}
      <ellipse cx="19" cy="26" rx="4" ry="2" fill="white" opacity="0.12" transform="rotate(-20, 19, 26)"/>
    </svg>
  );
}

// ─── RACING ──────────────────────────────────────────────────────────────────
export function RacingIcon({ className, ...props }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className={className} {...props}>
      <defs>
        <radialGradient id="rc-bg" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#0a0012"/>
          <stop offset="100%" stopColor="#04000a"/>
        </radialGradient>
        <linearGradient id="rc-car" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f43f5e"/>
          <stop offset="100%" stopColor="#7f1d2a"/>
        </linearGradient>
        <radialGradient id="rc-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="48" height="48" rx="4" fill="url(#rc-bg)"/>
      {/* Track outline */}
      <rect x="4" y="8" width="40" height="32" rx="12" fill="none" stroke="#1e1030" strokeWidth="8"/>
      <rect x="4" y="8" width="40" height="32" rx="12" fill="none" stroke="#f43f5e" strokeWidth="1" opacity="0.3"/>
      {/* Track dashes */}
      {[0,1,2,3].map(i => (
        <line key={i} x1={10+i*9} y1="24" x2={15+i*9} y2="24" stroke="#2a1a40" strokeWidth="1.5" opacity="0.6"/>
      ))}
      {/* Car glow */}
      <circle cx="28" cy="28" r="10" fill="url(#rc-glow)"/>
      {/* Car body */}
      <rect x="18" y="25" width="20" height="8" rx="3" fill="url(#rc-car)"/>
      {/* Cockpit */}
      <ellipse cx="28" cy="25" rx="5" ry="3" fill="#f43f5e"/>
      <ellipse cx="28" cy="24.5" rx="3.5" ry="2" fill="#1a0030" opacity="0.8"/>
      {/* Wheels */}
      <ellipse cx="21" cy="33" rx="3" ry="2" fill="#111" stroke="#555" strokeWidth="0.7"/>
      <ellipse cx="35" cy="33" rx="3" ry="2" fill="#111" stroke="#555" strokeWidth="0.7"/>
      <ellipse cx="21" cy="25" rx="3" ry="2" fill="#111" stroke="#555" strokeWidth="0.7"/>
      <ellipse cx="35" cy="25" rx="3" ry="2" fill="#111" stroke="#555" strokeWidth="0.7"/>
      {/* Speed lines */}
      <line x1="8" y1="27" x2="16" y2="27" stroke="#f43f5e" strokeWidth="1.2" opacity="0.5" strokeLinecap="round"/>
      <line x1="6" y1="30" x2="15" y2="30" stroke="#f43f5e" strokeWidth="0.8" opacity="0.35" strokeLinecap="round"/>
      {/* Exhaust */}
      <line x1="18" y1="28" x2="10" y2="27" stroke="#ff8800" strokeWidth="1.5" opacity="0.5" strokeLinecap="round"/>
      <line x1="18" y1="30" x2="8" y2="31" stroke="#ff5500" strokeWidth="1" opacity="0.3" strokeLinecap="round"/>
    </svg>
  );
}

// ─── ICON MAP & LABELS ───────────────────────────────────────────────────────
export const gameIcons = {
  "chess":              ChessIcon,
  "mini-golf":          MiniGolfIcon,
  "connect-4":          Connect4Icon,
  "air-hockey":         AirHockeyIcon,
  "rock-paper-scissors":RockPaperScissorsIcon,
  "dots-and-boxes":     DotsAndBoxesIcon,
  "8-ball":             EightBallIcon,
  "bowling":            BowlingIcon,
  "cup-king":           CupKingIcon,
  "stack-tower":        StackTowerIcon,
  "block-blast":        BlockBlastIcon,
  "tron":               TronIcon,
  "basketball":         BasketballIcon,
  "football":           FootballIcon,
  "racing":             RacingIcon,
} as const;

export const gameLabels: Record<string, string> = {
  "chess":               "Chess",
  "mini-golf":           "Mini Golf",
  "connect-4":           "Connect 4",
  "air-hockey":          "Air Hockey",
  "rock-paper-scissors": "Rock Paper Scissors",
  "dots-and-boxes":      "Dots & Boxes",
  "8-ball":              "8-Ball Pool",
  "bowling":             "Bowling",
  "cup-king":            "Cup King",
  "stack-tower":         "Stack Tower Duel",
  "block-blast":         "Block Blast",
  "tron":                "Tron",
  "basketball":          "Basketball",
  "football":            "Football",
  "racing":              "Racing",
};
