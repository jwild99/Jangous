import { useEffect, useState } from "react";

function useWindowWidth() {
  const [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  useEffect(() => {
    const h = () => setWidth(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return width;
}

// Sparse stars — sky only, not overwhelming
const STARS: [number, number, number, number][] = [
  [55,14,1.0,0.55],[182,26,0.8,0.42],[338,10,1.2,0.65],[497,30,0.9,0.48],[655,18,1.3,0.6],
  [812,8,1.0,0.5],[974,24,0.9,0.44],[1130,16,1.1,0.56],[1285,28,1.0,0.52],[1405,12,0.8,0.4],
  [98,72,0.9,0.4],[248,88,1.1,0.52],[404,60,1.0,0.46],[561,92,0.8,0.38],[718,48,1.2,0.55],
  [878,80,0.9,0.42],[1040,68,1.0,0.48],[1200,86,0.8,0.38],[1358,74,1.1,0.5],[1430,52,0.7,0.36],
  [134,138,0.8,0.35],[295,122,1.0,0.46],[460,146,0.9,0.4],[622,128,0.8,0.36],[790,154,1.1,0.48],
  [958,132,0.8,0.36],[1116,150,0.9,0.42],[1282,120,0.8,0.34],[1420,142,0.7,0.32],[42,164,0.8,0.33],
];

export function GameWorldBackground() {
  const w = useWindowWidth();
  const isMobile = w < 640;

  return (
    <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <svg
        viewBox="0 0 1440 800"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* ── FILTERS ─────────────────────────────── */}
          <filter id="grain" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch" result="noise"/>
            <feColorMatrix type="saturate" values="0" in="noise" result="gray"/>
            <feBlend in="SourceGraphic" in2="gray" mode="soft-light" result="blended"/>
            <feComposite in="blended" in2="SourceGraphic" operator="in"/>
          </filter>
          <filter id="f-blur-sm" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5"/>
          </filter>
          <filter id="f-blur-md" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="7"/>
          </filter>
          <filter id="f-blur-lg" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="18"/>
          </filter>
          <filter id="f-blur-xl" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="40"/>
          </filter>
          <filter id="f-blur-xxl" x="-400%" y="-400%" width="900%" height="900%">
            <feGaussianBlur stdDeviation="80"/>
          </filter>
          <filter id="f-neon" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="f-brand-glow" x="-60%" y="-150%" width="220%" height="400%">
            <feGaussianBlur stdDeviation="4"  result="b1"/>
            <feGaussianBlur stdDeviation="18" result="b2"/>
            <feGaussianBlur stdDeviation="50" result="b3"/>
            <feGaussianBlur stdDeviation="100" result="b4"/>
            <feMerge>
              <feMergeNode in="b4"/>
              <feMergeNode in="b3"/>
              <feMergeNode in="b2"/>
              <feMergeNode in="b1"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="f-sign-glow" x="-30%" y="-60%" width="160%" height="220%">
            <feGaussianBlur stdDeviation="8" result="b1"/>
            <feGaussianBlur stdDeviation="24" result="b2"/>
            <feMerge>
              <feMergeNode in="b2"/>
              <feMergeNode in="b1"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="f-bulb" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          {/* Neon text glow — outer pink bloom */}
          <filter id="f-neon-pink" x="-80%" y="-200%" width="260%" height="500%">
            <feGaussianBlur stdDeviation="18" result="b"/>
            <feColorMatrix in="b" type="matrix"
              values="1.4 0   0 0 0.1   0 0 0 0 0   0.8 0 0.5 0 0.05   0 0 0 0.85 0"/>
          </filter>
          <filter id="f-neon-orange" x="-60%" y="-150%" width="220%" height="400%">
            <feGaussianBlur stdDeviation="8" result="b"/>
            <feColorMatrix in="b" type="matrix"
              values="1.6 0.3 0 0 0   0.3 0.15 0 0 0   0 0 0 0 0   0 0 0 0.9 0"/>
          </filter>
          <filter id="f-neon-core" x="-30%" y="-80%" width="160%" height="260%">
            <feGaussianBlur stdDeviation="2.5" result="b"/>
            <feMerge>
              <feMergeNode in="b"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          {/* ── SKY GRADIENTS ─────────────────────────── */}
          <linearGradient id="g-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#010208"/>
            <stop offset="18%"  stopColor="#030710"/>
            <stop offset="48%"  stopColor="#050d20"/>
            <stop offset="75%"  stopColor="#0a1530"/>
            <stop offset="100%" stopColor="#141e38"/>
          </linearGradient>

          {/* Central neon bloom — pink/magenta behind billboard */}
          <radialGradient id="g-bloom-center" cx="50%" cy="35%" r="42%">
            <stop offset="0%"  stopColor="#cc1177" stopOpacity="0.38"/>
            <stop offset="28%" stopColor="#881144" stopOpacity="0.18"/>
            <stop offset="60%" stopColor="#440822" stopOpacity="0.08"/>
            <stop offset="100%" stopColor="transparent" stopOpacity="0"/>
          </radialGradient>

          {/* Side cool purple ambient */}
          <radialGradient id="g-atm-left" cx="8%" cy="42%" r="32%">
            <stop offset="0%"  stopColor="#401880" stopOpacity="0.22"/>
            <stop offset="100%" stopColor="transparent" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="g-atm-right" cx="92%" cy="42%" r="28%">
            <stop offset="0%"  stopColor="#201060" stopOpacity="0.18"/>
            <stop offset="100%" stopColor="transparent" stopOpacity="0"/>
          </radialGradient>

          {/* Ground fog */}
          <linearGradient id="g-fog" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#06101e" stopOpacity="0"/>
            <stop offset="60%" stopColor="#06101e" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="#04090e" stopOpacity="0.96"/>
          </linearGradient>

          {/* Marquee face */}
          <linearGradient id="g-marquee-face" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#2e1006"/>
            <stop offset="50%" stopColor="#1e0a04"/>
            <stop offset="100%" stopColor="#160804"/>
          </linearGradient>

          {/* Metal beam */}
          <linearGradient id="g-beam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#1a1010"/>
            <stop offset="35%"  stopColor="#2e1a0c"/>
            <stop offset="65%"  stopColor="#221410"/>
            <stop offset="100%" stopColor="#0e0a08"/>
          </linearGradient>

          {/* Billboard text gradient */}
          <linearGradient id="g-brand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#f8e898"/>
            <stop offset="25%"  stopColor="#f0c050"/>
            <stop offset="60%"  stopColor="#e07818"/>
            <stop offset="100%" stopColor="#c05010"/>
          </linearGradient>
          <linearGradient id="g-brand-shadow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#e08028" stopOpacity="0.5"/>
            <stop offset="100%" stopColor="#602008" stopOpacity="0.15"/>
          </linearGradient>

          {/* Ground */}
          <linearGradient id="g-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#0b1524"/>
            <stop offset="100%" stopColor="#060c18"/>
          </linearGradient>

          {/* Window fills */}
          <radialGradient id="g-win-warm" cx="50%" cy="30%" r="65%">
            <stop offset="0%"  stopColor="#f0bc50" stopOpacity="0.85"/>
            <stop offset="100%" stopColor="#c07020" stopOpacity="0.2"/>
          </radialGradient>
          <radialGradient id="g-win-blue" cx="50%" cy="30%" r="65%">
            <stop offset="0%"  stopColor="#6090ff" stopOpacity="0.85"/>
            <stop offset="100%" stopColor="#2040a0" stopOpacity="0.2"/>
          </radialGradient>
        </defs>

        <g filter="url(#grain)">

          {/* ══ SKY BASE ════════════════════════════════════════════════ */}
          <rect width="1440" height="800" fill="url(#g-sky)"/>
          <rect width="1440" height="800" fill="url(#g-bloom-center)"/>
          <rect width="1440" height="800" fill="url(#g-atm-left)"/>
          <rect width="1440" height="800" fill="url(#g-atm-right)"/>

          {/* ══ STARS ════════════════════════════════════════════════════ */}
          {STARS.map(([x, y, r, op], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="white" opacity={op}/>
          ))}
          {/* A few slightly brighter hero stars */}
          {[[145,42,2.0],[432,22,1.8],[1010,32,1.8],[1295,18,2.0]].map(([x,y,r],i) => (
            <circle key={`hs-${i}`} cx={x} cy={y} r={r} fill="white" opacity="0.92"/>
          ))}

          {/* ══ WIDE NEON CORONA — pink/magenta billboard bloom ══════════ */}
          <ellipse cx="720" cy="300" rx="520" ry="280"
            fill="#990055" opacity="0.14" filter="url(#f-blur-xxl)"/>
          <ellipse cx="720" cy="280" rx="320" ry="165"
            fill="#cc1177" opacity="0.14" filter="url(#f-blur-xl)"/>
          <ellipse cx="720" cy="260" rx="190" ry="100"
            fill="#ff3399" opacity="0.10" filter="url(#f-blur-lg)"/>

          {/* ══════════════════════════════════════════════════════════════
              LEFT SKYLINE SILHOUETTE
              Dense building cluster, left side only — center stays clear
              ══════════════════════════════════════════════════════════════ */}

          {/* Far-depth ultra-dark spires */}
          <g filter="url(#f-blur-md)" opacity="0.45">
            <rect x="0"   y="155" width="52"  height="545" fill="#020406"/>
            <rect x="42"  y="195" width="36"  height="505" fill="#030508"/>
            <rect x="68"  y="225" width="24"  height="475" fill="#020406"/>
            <rect x="185" y="188" width="45"  height="512" fill="#020507"/>
            <rect x="220" y="218" width="28"  height="482" fill="#030608"/>
            <rect x="280" y="210" width="38"  height="490" fill="#020406"/>
            <rect x="310" y="248" width="20"  height="452" fill="#030508"/>
          </g>

          {/* Mid-depth buildings */}
          <g filter="url(#f-blur-sm)" opacity="0.78">
            {/* Leftmost cluster */}
            <rect x="-5"  y="228" width="72"  height="572" fill="#04070f" rx="1"/>
            <rect x="52"  y="256" width="44"  height="544" fill="#050810" rx="1"/>
            <rect x="88"  y="280" width="30"  height="520" fill="#040710" rx="1"/>
            {/* Left-mid */}
            <rect x="160" y="238" width="62"  height="562" fill="#050912" rx="1"/>
            <rect x="212" y="268" width="44"  height="532" fill="#040810" rx="1"/>
            <rect x="248" y="295" width="28"  height="505" fill="#050912" rx="1"/>
            {/* Stepped roofs for variety */}
            <rect x="160" y="218" width="28"  height="22"  fill="#060a14" rx="1"/>
            <rect x="185" y="205" width="18"  height="36"  fill="#050912" rx="1"/>
            <rect x="212" y="248" width="20"  height="22"  fill="#040810" rx="1"/>
          </g>

          {/* Window lights — left buildings */}
          <g opacity="0.38">
            {/* Column of warm windows */}
            {[268,296,324,352,380].map((y,i) => (
              <rect key={`lw-${i}`} x={56+((i%2)*16)} y={y} width="7" height="7" rx="1"
                fill={i%3===0?"#f0c060":"#3a6aff"} opacity="0.55"/>
            ))}
            {[282,310,338,366].map((y,i) => (
              <rect key={`lw2-${i}`} x={170+(i%3)*18} y={y} width="7" height="7" rx="1"
                fill={i%2===0?"#f0c060":"#3a6aff"} opacity="0.45"/>
            ))}
          </g>

          {/* Neon accent on leftmost tower top */}
          <rect x="18" y="226" width="32" height="4" rx="1"
            fill="#ff3355" opacity="0.38" filter="url(#f-neon)"/>

          {/* ══════════════════════════════════════════════════════════════
              RIGHT SKYLINE SILHOUETTE
              ══════════════════════════════════════════════════════════════ */}

          {/* Far-depth spires */}
          <g filter="url(#f-blur-md)" opacity="0.45">
            <rect x="1388" y="162" width="52"  height="538" fill="#020406"/>
            <rect x="1362" y="200" width="36"  height="500" fill="#030508"/>
            <rect x="1200" y="192" width="42"  height="508" fill="#020507"/>
            <rect x="1232" y="225" width="26"  height="475" fill="#030608"/>
            <rect x="1135" y="205" width="35"  height="495" fill="#020406"/>
            <rect x="1110" y="238" width="20"  height="462" fill="#030508"/>
          </g>

          {/* Mid-depth buildings */}
          <g filter="url(#f-blur-sm)" opacity="0.78">
            <rect x="1380" y="234" width="65"  height="566" fill="#04070f" rx="1"/>
            <rect x="1344" y="262" width="44"  height="538" fill="#050810" rx="1"/>
            <rect x="1310" y="282" width="32"  height="518" fill="#040710" rx="1"/>
            {/* Right-mid */}
            <rect x="1218" y="242" width="60"  height="558" fill="#050912" rx="1"/>
            <rect x="1180" y="272" width="44"  height="528" fill="#040810" rx="1"/>
            <rect x="1154" y="298" width="30"  height="502" fill="#050912" rx="1"/>
            {/* Stepped roofs */}
            <rect x="1252" y="220" width="26"  height="24"  fill="#060a14" rx="1"/>
            <rect x="1236" y="208" width="16"  height="36"  fill="#050912" rx="1"/>
            <rect x="1178" y="250" width="20"  height="24"  fill="#040810" rx="1"/>
          </g>

          {/* Window lights — right buildings */}
          <g opacity="0.38">
            {[275,303,331,359,387].map((y,i) => (
              <rect key={`rw-${i}`} x={1360-(i%2)*16} y={y} width="7" height="7" rx="1"
                fill={i%3===0?"#f0c060":"#3a6aff"} opacity="0.5"/>
            ))}
            {[286,314,342,370].map((y,i) => (
              <rect key={`rw2-${i}`} x={1232-(i%3)*16} y={y} width="7" height="7" rx="1"
                fill={i%2===0?"#3a6aff":"#f0c060"} opacity="0.42"/>
            ))}
          </g>

          {/* Neon on rightmost tower */}
          <rect x="1390" y="230" width="30" height="4" rx="1"
            fill="#4488ff" opacity="0.38" filter="url(#f-neon)"/>

          {/* ══════════════════════════════════════════════════════════════
              GROUND / PLAZA BASE
              Simple dark ground plane — no cobblestone noise
              ══════════════════════════════════════════════════════════════ */}
          <rect x="0" y="510" width="1440" height="290" fill="url(#g-ground)" opacity="0.98"/>

          {/* Subtle horizontal stripe reflections on ground */}
          <rect x="0" y="510" width="1440" height="2" fill="#1a2840" opacity="0.55"/>
          {/* Billboard glow reflected on ground */}
          <ellipse cx="720" cy="520" rx="280" ry="20"
            fill="#d07020" opacity="0.08" filter="url(#f-blur-lg)"/>
          <ellipse cx="720" cy="524" rx="180" ry="12"
            fill="#c06010" opacity="0.06" filter="url(#f-blur-md)"/>

          {/* Ground fog base — rising from bottom */}
          <rect x="0" y="488" width="1440" height="312" fill="url(#g-fog)" opacity="0.88"/>

          {/* Thin neon ground line — city edge */}
          <line x1="0" y1="512" x2="1440" y2="512" stroke="#1a2840" strokeWidth="1.5" opacity="0.5"/>

          {/* ══════════════════════════════════════════════════════════════
              JANGO.US BILLBOARD — THE MAIN HERO
              Cinematic neon landmark, centered
              ══════════════════════════════════════════════════════════════ */}

          {/* Large outer corona bloom — neon pink/magenta */}
          <ellipse cx="720" cy="285" rx="440" ry="200"
            fill="#aa0066" opacity="0.22" filter="url(#f-blur-xxl)"/>
          <ellipse cx="720" cy="285" rx="280" ry="130"
            fill="#cc1177" opacity="0.18" filter="url(#f-blur-xl)"/>

          {/* ── SUPPORT STRUCTURE ─────────────────────────── */}
          {/* Left main beam */}
          <rect x="583" y="328" width="18" height="188" rx="4" fill="url(#g-beam)" opacity="0.9"/>
          {/* Left beam shadow */}
          <rect x="597" y="328" width="4" height="188" rx="1" fill="#000" opacity="0.3"/>
          {/* Right main beam */}
          <rect x="839" y="328" width="18" height="188" rx="4" fill="url(#g-beam)" opacity="0.9"/>
          {/* Right beam shadow */}
          <rect x="839" y="328" width="4" height="188" rx="1" fill="#000" opacity="0.28"/>

          {/* Cross-beam connecting the two vertical beams */}
          <rect x="583" y="388" width="274" height="12" rx="3" fill="#1c1410" opacity="0.85"/>
          <rect x="583" y="388" width="274" height="3" rx="1" fill="#2e1e12" opacity="0.5"/>

          {/* Diagonal bracing — left */}
          <line x1="592" y1="340" x2="720" y2="393" stroke="#1a1210" strokeWidth="4" opacity="0.65"/>
          {/* Diagonal bracing — right */}
          <line x1="848" y1="340" x2="720" y2="393" stroke="#1a1210" strokeWidth="4" opacity="0.65"/>

          {/* Beam feet / base plates */}
          <rect x="572" y="510" width="42" height="12" rx="2" fill="#181210" opacity="0.88"/>
          <rect x="826" y="510" width="42" height="12" rx="2" fill="#181210" opacity="0.88"/>

          {/* Bolts on beam tops */}
          <circle cx="592" cy="336" r="5" fill="#100c08" opacity="0.9"/>
          <circle cx="592" cy="336" r="2.5" fill="#281a10" opacity="0.7"/>
          <circle cx="848" cy="336" r="5" fill="#100c08" opacity="0.9"/>
          <circle cx="848" cy="336" r="2.5" fill="#281a10" opacity="0.7"/>

          {/* ── BILLBOARD SIGN FACE ───────────────────────── */}

          {/* Deep outer glow halo behind the whole sign */}
          <rect x="410" y="145" width="620" height="192" rx="10"
            fill="#bb0066" opacity="0.3" filter="url(#f-blur-lg)"/>

          {/* Sign rear shadow / depth */}
          <rect x="446" y="163" width="554" height="164" rx="7"
            fill="#180a04" opacity="0.85"/>

          {/* Sign face */}
          <rect x="440" y="158" width="560" height="172" rx="6"
            fill="url(#g-marquee-face)"/>

          {/* Sign face subtle inner highlight (top edge) */}
          <rect x="440" y="158" width="560" height="6" rx="6"
            fill="#401808" opacity="0.6"/>

          {/* Sign outer border — warm amber */}
          <rect x="440" y="158" width="560" height="172" rx="6"
            fill="none" stroke="#c86820" strokeWidth="3" opacity="0.82"/>

          {/* Sign inner border — slightly thinner */}
          <rect x="450" y="166" width="540" height="156" rx="5"
            fill="none" stroke="#a04a10" strokeWidth="1.2" opacity="0.45"/>

          {/* ── MARQUEE BULB LIGHTS ───────────────────────── */}

          {/* TOP ROW bulbs */}
          {Array.from({length: 20}).map((_, i) => {
            const x = 456 + i * 27;
            const phase = (i % 3);
            const op = phase === 0 ? 0.95 : phase === 1 ? 0.75 : 0.58;
            return (
              <g key={`bt-${i}`}>
                <circle cx={x} cy={166} r={4.5}
                  fill="#ffdd60" opacity={op * 0.35} filter="url(#f-bulb)"/>
                <circle cx={x} cy={166} r={3}
                  fill="#ffee88" opacity={op}/>
                <circle cx={x - 0.8} cy={165} r={1.2}
                  fill="white" opacity={op * 0.7}/>
              </g>
            );
          })}

          {/* BOTTOM ROW bulbs */}
          {Array.from({length: 20}).map((_, i) => {
            const x = 456 + i * 27;
            const phase = ((i + 1) % 3);
            const op = phase === 0 ? 0.9 : phase === 1 ? 0.7 : 0.55;
            return (
              <g key={`bb-${i}`}>
                <circle cx={x} cy={322} r={4.5}
                  fill="#ffdd60" opacity={op * 0.35} filter="url(#f-bulb)"/>
                <circle cx={x} cy={322} r={3}
                  fill="#ffee88" opacity={op}/>
              </g>
            );
          })}

          {/* LEFT COLUMN bulbs */}
          {[182, 200, 218, 237, 255, 273, 292, 310].map((y, i) => {
            const phase = (i % 3);
            const op = phase === 0 ? 0.88 : phase === 1 ? 0.65 : 0.5;
            return (
              <g key={`bl-${i}`}>
                <circle cx={448} cy={y} r={4.5}
                  fill="#ffdd60" opacity={op * 0.3} filter="url(#f-bulb)"/>
                <circle cx={448} cy={y} r={3}
                  fill="#ffee88" opacity={op}/>
              </g>
            );
          })}

          {/* RIGHT COLUMN bulbs */}
          {[182, 200, 218, 237, 255, 273, 292, 310].map((y, i) => {
            const phase = ((i + 2) % 3);
            const op = phase === 0 ? 0.88 : phase === 1 ? 0.65 : 0.5;
            return (
              <g key={`br-${i}`}>
                <circle cx={992} cy={y} r={4.5}
                  fill="#ffdd60" opacity={op * 0.3} filter="url(#f-bulb)"/>
                <circle cx={992} cy={y} r={3}
                  fill="#ffee88" opacity={op}/>
              </g>
            );
          })}

          {/* ── JANGO NEON TEXT — layered glow treatment ────── */}

          {/* Wide ambient bloom behind the sign face */}
          <ellipse cx="720" cy="244" rx="260" ry="100"
            fill="#330011" opacity="0.55" filter="url(#f-blur-xxl)"/>

          {/* Layer 1: outermost pink bloom */}
          <text x="720" y="275" textAnchor="middle"
            fontSize={isMobile ? 52 : 68} fontWeight="900"
            fill="#FF2D8A"
            fontFamily="'Space Grotesk','Arial Black',sans-serif"
            letterSpacing={isMobile ? "6" : "10"}
            filter="url(#f-neon-pink)" opacity="0.7">
            JANGO
          </text>

          {/* Layer 2: orange mid-glow */}
          <text x="720" y="275" textAnchor="middle"
            fontSize={isMobile ? 52 : 68} fontWeight="900"
            fill="#FF7A00"
            fontFamily="'Space Grotesk','Arial Black',sans-serif"
            letterSpacing={isMobile ? "6" : "10"}
            filter="url(#f-neon-orange)" opacity="0.85">
            JANGO
          </text>

          {/* Layer 3: bright neon orange core */}
          <text x="720" y="275" textAnchor="middle"
            fontSize={isMobile ? 52 : 68} fontWeight="900"
            fill="#FFAA44"
            fontFamily="'Space Grotesk','Arial Black',sans-serif"
            letterSpacing={isMobile ? "6" : "10"}
            filter="url(#f-neon-core)" opacity="0.97">
            JANGO
          </text>

          {/* ── SUBTITLE ─────────────────────────────────── */}
          <text x="720" y="304" textAnchor="middle"
            fontSize="9.5" fontWeight="400"
            fill="#ff99cc" fontFamily="monospace" letterSpacing="7" opacity="0.5">
            SKILL · GAMING · DISTRICT
          </text>

          {/* Decorative neon rule lines */}
          <line x1="570" y1="312" x2="680" y2="312" stroke="#ff3399" strokeWidth="0.8" opacity="0.22"/>
          <line x1="760" y1="312" x2="870" y2="312" stroke="#ff3399" strokeWidth="0.8" opacity="0.22"/>

          {/* ── SIGN CAP / CROWN ─────────────────────────── */}
          {/* Shallow arched cap above sign */}
          <path d="M480,160 L960,160 L960,148 Q720,122 480,148 Z"
            fill="#200c04" opacity="0.82"/>
          <line x1="480" y1="148" x2="960" y2="148" stroke="#c87020" strokeWidth="1.5" opacity="0.4"/>
          {/* Cap rooftop amber rim */}
          <rect x="478" y="144" width="484" height="6" rx="2"
            fill="#c06818" opacity="0.22" filter="url(#f-neon)"/>
          {/* Small peak finial dots */}
          <circle cx="720" cy="138" r="4" fill="#ffdd60" opacity="0.55" filter="url(#f-bulb)"/>
          <circle cx="582" cy="146" r="3" fill="#ffcc40" opacity="0.42" filter="url(#f-bulb)"/>
          <circle cx="858" cy="146" r="3" fill="#ffcc40" opacity="0.42" filter="url(#f-bulb)"/>

          {/* ── SIGN BOTTOM TRIM ────────────────────────── */}
          {/* Small bracket lip below main sign */}
          <rect x="472" y="328" width="496" height="10" rx="2" fill="#1c0c06" opacity="0.9"/>
          <rect x="480" y="328" width="480" height="4" rx="1" fill="#c06010" opacity="0.18"/>

          {/* Sign side mounting flanges */}
          <rect x="436" y="170" width="10" height="145" rx="2" fill="#1a0e08" opacity="0.82"/>
          <rect x="994" y="170" width="10" height="145" rx="2" fill="#1a0e08" opacity="0.82"/>

          {/* ── CORONA HALO RINGS ────────────────────────── */}
          {/* Subtle concentric neon rings around sign center */}
          <ellipse cx="720" cy="244" rx="320" ry="115"
            fill="none" stroke="#ff3399" strokeWidth="1.5" opacity="0.07"/>
          <ellipse cx="720" cy="244" rx="258" ry="90"
            fill="none" stroke="#ff5599" strokeWidth="1" opacity="0.09"/>
          <ellipse cx="720" cy="244" rx="196" ry="68"
            fill="none" stroke="#ff88bb" strokeWidth="0.8" opacity="0.10"/>

          {/* ── DIAGONAL LIGHT SHAFTS ────────────────────── */}
          {/* Subtle upward crepuscular rays from the sign */}
          {!isMobile && [
            [-38, -180], [-15, -200], [0, -210], [18, -200], [40, -180]
          ].map(([dx, dy], i) => (
            <line key={`shaft-${i}`}
              x1={720} y1={244}
              x2={720 + dx * 8} y2={244 + dy}
              stroke="#c06818"
              strokeWidth={i === 2 ? 3 : 1.5}
              opacity={i === 2 ? 0.055 : 0.03}/>
          ))}

          {/* ══ FINAL OVERLAY ELEMENTS ══════════════════════════════════ */}

          {/* Subtle ambient corner vignette */}
          <defs>
            <radialGradient id="g-vignette" cx="50%" cy="50%" r="70%">
              <stop offset="60%" stopColor="transparent" stopOpacity="0"/>
              <stop offset="100%" stopColor="#010208" stopOpacity="0.55"/>
            </radialGradient>
          </defs>
          <rect width="1440" height="800" fill="url(#g-vignette)"/>

          {/* Center bottom gradient — so dashboard cards read cleanly */}
          <defs>
            <linearGradient id="g-card-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#050c18" stopOpacity="0"/>
              <stop offset="100%" stopColor="#050c18" stopOpacity="0.88"/>
            </linearGradient>
          </defs>
          <rect x="280" y="460" width="880" height="340" fill="url(#g-card-fade)" opacity="0.85"/>

        </g>
      </svg>
    </div>
  );
}
