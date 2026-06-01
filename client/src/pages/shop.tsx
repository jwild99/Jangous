import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { AppNavbar } from "@/components/AppNavbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { soundManager } from "@/lib/soundManager";
import { useAuth } from "@/hooks/useAuth";
import { PageDepthBackground } from "@/components/PageDepthBackground";
import { Magnetic3D } from "@/components/Magnetic3D";
import { ScalpsIcon, ScalpsAmount } from "@/components/ScalpsIcon";
import { formatScalps } from "@/lib/scalps";
import type { ShopItem } from "@shared/schema";
import {
  Star, Clock, CircleUser, Award, LayoutGrid, Smile, Palette,
  Sparkles, Check, ShoppingCart, Zap, Package, ChevronLeft,
  ChevronRight, Wind, CreditCard, Layers, Image, Flame,
  BadgeCheck, RefreshCw, Plus, Eye, ZoomIn, RotateCcw, X, Crown,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface InventoryRow { inventoryId: string; purchasedAt: string; item: ShopItem; }
interface EquippedRow  { category: string; item: ShopItem; equippedAt: string; }

// ─── Rarity Config ──────────────────────────────────────────────────────────

const RARITY: Record<string, {
  label: string; textClass: string; borderClass: string;
  glowClass: string; bgClass: string; animated: boolean; badgeColor: string;
}> = {
  common:    { label:"Common",    textClass:"text-slate-400",   borderClass:"border-slate-600/40",  glowClass:"",                                      bgClass:"bg-slate-500/8",   animated:false, badgeColor:"#94A3B8" },
  uncommon:  { label:"Uncommon",  textClass:"text-green-400",   borderClass:"border-green-500/30",  glowClass:"shadow-[0_0_10px_#22c55e22]",           bgClass:"bg-green-500/6",   animated:false, badgeColor:"#22c55e" },
  rare:      { label:"Rare",      textClass:"text-blue-400",    borderClass:"border-blue-500/40",   glowClass:"shadow-[0_0_14px_#3b82f630]",           bgClass:"bg-blue-500/6",    animated:false, badgeColor:"#3b82f6" },
  epic:      { label:"Epic",      textClass:"text-purple-400",  borderClass:"border-purple-500/40", glowClass:"shadow-[0_0_18px_#a855f740]",           bgClass:"bg-purple-500/8",  animated:false, badgeColor:"#a855f7" },
  legendary: { label:"Legendary", textClass:"text-amber-400",   borderClass:"border-amber-400/60",  glowClass:"shadow-[0_0_24px_#f59e0b60]",           bgClass:"bg-amber-500/10",  animated:true,  badgeColor:"#f59e0b" },
  mythic:    { label:"Mythic",    textClass:"text-red-400",     borderClass:"border-red-500/60",    glowClass:"shadow-[0_0_28px_#ef444460]",           bgClass:"bg-red-500/10",    animated:true,  badgeColor:"#ef4444" },
};
const r = (rarity: string) => RARITY[rarity] ?? RARITY.common;

// ─── Category Config ─────────────────────────────────────────────────────────

const TABS = [
  { key:"featured",          label:"Featured",    icon:Star },
  { key:"daily",             label:"Daily Deals", icon:Flame },
  { key:"avatar_frame",      label:"Frames",      icon:CircleUser },
  { key:"badge",             label:"Badges",      icon:Award },
  { key:"board_skin",        label:"Boards",      icon:LayoutGrid },
  { key:"emote",             label:"Emotes",      icon:Smile },
  { key:"theme",             label:"Themes",      icon:Palette },
  { key:"victory_animation", label:"Victory",     icon:Sparkles },
  { key:"banner",            label:"Banners",     icon:Image },
  { key:"trail",             label:"Trails",      icon:Wind },
  { key:"dice_skin",         label:"Dice",        icon:Layers },
  { key:"card_skin",         label:"Cards",       icon:CreditCard },
  { key:"inventory",         label:"My Items",    icon:Package },
] as const;

// ─── Rarity CSS (injected once) ──────────────────────────────────────────────

const RARITY_CSS = `
@keyframes legendaryPulse {
  0%,100% { box-shadow:0 0 18px #f59e0b60,0 0 6px #f59e0b30; border-color:#f59e0b99; }
  50%      { box-shadow:0 0 32px #f59e0b90,0 0 12px #f59e0b50; border-color:#f59e0bcc; }
}
@keyframes epicShimmer {
  0%,100% { box-shadow:0 0 14px #a855f740; }
  50%      { box-shadow:0 0 22px #a855f760; }
}
`;
function InjectCSS() {
  useEffect(() => {
    const id = "shop-rarity-css";
    if (!document.getElementById(id)) {
      const s = document.createElement("style"); s.id = id; s.textContent = RARITY_CSS; document.head.appendChild(s);
    }
  }, []);
  return null;
}

// ─── Category icon helper ─────────────────────────────────────────────────────

function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const props = { className: className ?? "w-12 h-12" };
  switch (category) {
    case "avatar_frame":      return <CircleUser {...props} />;
    case "badge":             return <Award {...props} />;
    case "board_skin":        return <LayoutGrid {...props} />;
    case "emote":             return <Smile {...props} />;
    case "theme":             return <Palette {...props} />;
    case "victory_animation": return <Sparkles {...props} />;
    case "banner":            return <Image {...props} />;
    case "trail":             return <Wind {...props} />;
    case "dice_skin":         return <Layers {...props} />;
    case "card_skin":         return <CreditCard {...props} />;
    default:                  return <Star {...props} />;
  }
}

// ─── Confetti ────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ["#FF2D8A","#FF7A00","#22C55E","#3B82F6","#A855F7","#EAB308","#F97316","#06B6D4"];

function ConfettiOverlay({ onDone }: { onDone: () => void }) {
  const pieces = useMemo(() => Array.from({ length: 90 }, (_, i) => ({
    id: i, x: Math.random() * 100,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    size: 5 + Math.random() * 9, delay: Math.random() * 0.6,
    dur: 2.2 + Math.random() * 1.4,
    rotEnd: (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 540),
    isRect: Math.random() > 0.45,
  })), []);

  return createPortal(
    <div className="fixed inset-0 pointer-events-none z-[300] overflow-hidden">
      {pieces.map(p => (
        <motion.div key={p.id}
          style={{ position:"absolute", left:`${p.x}vw`, top:-20, width:p.size, height:p.isRect ? p.size*0.4 : p.size, borderRadius:p.isRect ? 2 : "50%", background:p.color }}
          initial={{ y:0, rotate:0, opacity:1 }} animate={{ y:"115vh", rotate:p.rotEnd, opacity:[1,1,1,0] }}
          transition={{ duration:p.dur, delay:p.delay }}
          onAnimationComplete={p.id === 0 ? onDone : undefined} />
      ))}
    </div>, document.body
  );
}

// ─── Daily Countdown ─────────────────────────────────────────────────────────

function DailyCountdown() {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    const tick = () => {
      const midnight = new Date(); midnight.setUTCHours(24, 0, 0, 0);
      const diff = Math.max(0, midnight.getTime() - Date.now());
      const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`);
    };
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
  }, []);
  return <span className="font-mono text-amber-300 font-bold tabular-nums">{timeLeft}</span>;
}

// ─── Featured Carousel ───────────────────────────────────────────────────────

function FeaturedCarousel({ items, ownedIds, equippedIds, onBuy, onEquip, purchasingId, equippingId }: {
  items: ShopItem[]; ownedIds: Set<string>; equippedIds: Set<string>;
  onBuy: (item: ShopItem) => void; onEquip: (item: ShopItem) => void;
  purchasingId: string | null; equippingId: string | null;
}) {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restart = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setIdx(p => (p + 1) % items.length), 5000);
  }, [items.length]);
  useEffect(() => { restart(); return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, [restart]);
  if (!items.length) return null;

  const go = (n: number) => { setIdx((idx + n + items.length) % items.length); restart(); };
  const item = items[idx];
  const owned = ownedIds.has(item.id);
  const equipped = equippedIds.has(item.id);
  const rc = r(item.rarity as string);
  const price = parseFloat(item.price as string);

  return (
    <div className="relative w-full rounded-xl overflow-hidden mb-6 group" style={{ minHeight: 240 }}>
      <AnimatePresence mode="wait">
        <motion.div key={item.id} className="absolute inset-0 flex"
          initial={{ opacity:0, x:60 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-60 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}>
          <div className="absolute inset-0" style={{ background: item.previewGradient ?? "linear-gradient(135deg,#0d1225,#1a2040)" }} />
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0 opacity-30" style={{ background: `radial-gradient(ellipse 70% 80% at 70% 50%, ${item.iconColor ?? "#3b82f6"}44, transparent 70%)` }} />
          <div className="relative z-10 flex flex-col md:flex-row items-center md:items-stretch w-full p-6 md:p-10 gap-6">
            {/* Icon */}
            <div className="flex items-center justify-center flex-shrink-0">
              <div className="w-28 h-28 md:w-36 md:h-36 rounded-2xl flex items-center justify-center"
                style={{ background:`${item.iconColor ?? "#3b82f6"}22`, border:`2px solid ${item.iconColor ?? "#3b82f6"}44`, boxShadow:`0 0 40px ${item.iconColor ?? "#3b82f6"}44` }}>
                <CategoryIcon category={item.category} className="w-16 h-16 md:w-20 md:h-20" />
              </div>
            </div>
            {/* Info */}
            <div className="flex flex-col justify-center flex-1 text-center md:text-left"
              style={{ color: item.iconColor ?? "#fff" }}>
              <div className="flex items-center gap-2 mb-2 justify-center md:justify-start">
                <span className={`text-xs font-bold uppercase tracking-widest ${rc.textClass}`}>{rc.label}</span>
                <span className="text-white/30 text-xs">·</span>
                <span className="text-white/50 text-xs">{item.category.replace(/_/g," ")}</span>
              </div>
              <h2 className="text-2xl md:text-4xl font-black text-white mb-2 leading-tight">{item.name}</h2>
              <p className="text-white/70 text-sm md:text-base mb-4 max-w-sm">{item.description}</p>
              <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start">
                {!owned ? (
                  <Button size="lg" className="gap-2 font-bold" onClick={() => onBuy(item)} disabled={purchasingId === item.id} data-testid={`carousel-buy-${item.id}`}>
                    <ShoppingCart className="w-4 h-4" />
                    {purchasingId === item.id ? "Buying…" : price === 0 ? "Get Free" : (
                      <span className="flex items-center gap-1"><ScalpsIcon size="xs" /> {price} Scalps</span>
                    )}
                  </Button>
                ) : equipped ? (
                  <Badge className="gap-1.5 px-4 py-2 text-sm font-semibold bg-green-500/20 text-green-300 border-green-400/30"><Check className="w-4 h-4" /> Equipped</Badge>
                ) : (
                  <Button size="lg" variant="outline" className="gap-2" onClick={() => onEquip(item)} disabled={equippingId === item.id}>
                    <Zap className="w-4 h-4" />{equippingId === item.id ? "Equipping…" : "Equip Now"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
      <button onClick={() => go(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 border border-white/20 flex items-center justify-center hover-elevate opacity-0 group-hover:opacity-100" data-testid="carousel-prev"><ChevronLeft className="w-4 h-4 text-white" /></button>
      <button onClick={() => go(1)}  className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 border border-white/20 flex items-center justify-center hover-elevate opacity-0 group-hover:opacity-100" data-testid="carousel-next"><ChevronRight className="w-4 h-4 text-white" /></button>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
        {items.map((_, i) => (
          <button key={i} onClick={() => { setIdx(i); restart(); }} className={`rounded-full transition-all ${i === idx ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/40"}`} />
        ))}
      </div>
    </div>
  );
}

// ─── Item Card ───────────────────────────────────────────────────────────────

function ItemCard({ item, owned, equipped, onBuy, onEquip, onPreview, isPurchasing, isEquipping }: {
  item: ShopItem; owned: boolean; equipped: boolean;
  onBuy: () => void; onEquip: () => void; onPreview: () => void;
  isPurchasing: boolean; isEquipping: boolean;
}) {
  const rc = r(item.rarity as string);
  const isLegendary = item.rarity === "legendary";
  const isEpic = item.rarity === "epic";
  const isMythic = item.rarity === "mythic";
  const price = parseFloat(item.price as string);

  return (
    <Magnetic3D maxTilt={6} className="group" data-testid={`shop-card-${item.id}`}>
    <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.22 }}
      whileHover={{ y:-4, transition:{ duration:0.15 } }} className="h-full">
      <div className={`card-depth relative overflow-hidden rounded-lg border ${rc.borderClass} ${rc.bgClass} ${rc.glowClass} flex flex-col h-full transition-all duration-200`}
        style={(isLegendary || isMythic) ? { animation:"legendaryPulse 2.5s ease-in-out infinite" } : isEpic ? { animation:"epicShimmer 2s ease-in-out infinite" } : undefined}>
        {item.rarity !== "common" && <div className="h-0.5 w-full" style={{ background: item.previewGradient ?? item.iconColor ?? "#888" }} />}

        {/* Item Preview Area */}
        <div className="relative h-32 flex items-center justify-center overflow-hidden cursor-pointer"
          style={{ background: item.previewGradient ? `${item.previewGradient}, #0a0e1a` : "linear-gradient(135deg,#131b38,#0a0e1a)" }}
          onClick={onPreview}>
          <div className="absolute inset-0 opacity-25" style={{ background:`radial-gradient(circle at 50% 55%, ${item.iconColor ?? "#3b82f6"}88, transparent 65%)` }} />
          <motion.div style={{ color:item.iconColor ?? "#fff", filter:`drop-shadow(0 0 14px ${item.iconColor ?? "#fff"}aa)` }}
            animate={{ rotateY:[0,8,-8,0], scale:[1,1.05,1] }} transition={{ duration:4, repeat:Infinity, ease:"easeInOut" }}
            className="relative z-10">
            <CategoryIcon category={item.category} className="w-14 h-14" />
          </motion.div>
          {(isLegendary || isMythic) && <motion.div className="absolute inset-0 pointer-events-none" animate={{ opacity:[0.15,0.45,0.15] }} transition={{ duration:2, repeat:Infinity }} style={{ background:`radial-gradient(circle at 50% 50%, ${item.iconColor ?? "#f59e0b"}30, transparent 60%)` }} />}

          {/* Badges overlay */}
          <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
            {owned && <div className="w-5 h-5 rounded-full bg-green-500/20 border border-green-400/50 flex items-center justify-center"><Check className="w-3 h-3 text-green-400" /></div>}
          </div>
          <div className="absolute top-1.5 right-1.5 flex flex-col items-end gap-1">
            {item.isDailyItem && !owned && (
              <span className="text-[9px] font-bold bg-orange-500/90 text-white px-1.5 py-0.5 rounded uppercase tracking-wide">New Today</span>
            )}
            {item.isFeatured && !owned && !item.isDailyItem && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400/60" />}
          </div>

          {/* Preview hover overlay */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center bg-black/30">
            <div className="flex items-center gap-1.5 bg-black/60 rounded-full px-3 py-1.5 border border-white/20 text-white text-xs font-medium">
              <Eye className="w-3.5 h-3.5" /> Preview
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-2.5 flex flex-col flex-1 gap-1.5">
          <div className="flex items-start justify-between gap-1">
            <p className="font-semibold text-xs leading-tight text-foreground line-clamp-1 flex-1">{item.name}</p>
            <span className={`text-[10px] font-bold shrink-0 ${rc.textClass}`}>{rc.label}</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2 flex-1">{item.description}</p>

          {/* Preview + Buy row */}
          <div className="flex gap-1.5 mt-0.5">
            <Button size="sm" variant="outline" className="gap-1 text-[11px] h-7 px-2 shrink-0" onClick={onPreview} data-testid={`button-preview-${item.id}`}>
              <Eye className="w-3 h-3" />
            </Button>
            {!owned ? (
              <Button size="sm" className="flex-1 gap-1 text-[11px] h-7 px-2" onClick={onBuy} disabled={isPurchasing} data-testid={`button-buy-${item.id}`}>
                <ShoppingCart className="w-3 h-3" />
                {isPurchasing ? "…" : price === 0 ? "Free" : (
                  <span className="flex items-center gap-0.5"><ScalpsIcon size="xs" />{price}</span>
                )}
              </Button>
            ) : equipped ? (
              <div className="flex-1 flex items-center justify-center gap-1 h-7 rounded-md bg-green-500/10 border border-green-400/20">
                <Check className="w-3 h-3 text-green-400" /><span className="text-[11px] text-green-400 font-medium">Equipped</span>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="flex-1 gap-1 text-[11px] h-7 px-2" onClick={onEquip} disabled={isEquipping} data-testid={`button-equip-${item.id}`}>
                <Zap className="w-3 h-3" />{isEquipping ? "…" : "Equip"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
    </Magnetic3D>
  );
}

// ─── Showroom Canvas (particle effects) ──────────────────────────────────────

function ShowroomCanvas({ item }: { item: ShopItem }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef  = useRef<number>(0);
  const timeRef   = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    if (!ctx) return;

    const setSize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width  = rect.width  * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
    };
    setSize();

    const name  = (item.name ?? "").toLowerCase();
    const rarity = item.rarity as string;
    const primary = item.iconColor ?? "#3b82f6";

    const isFlame   = name.includes("inferno") || name.includes("fire") || name.includes("lava");
    const isGalaxy  = name.includes("galaxy")  || name.includes("space") || name.includes("cosmic");
    const isDiamond = name.includes("diamond") || name.includes("crystal");
    const isNeon    = name.includes("neon")    || name.includes("pulse") || name.includes("strike");
    const isGold    = name.includes("gold")    || name.includes("royal") || rarity === "legendary";

    type Particle = { x: number; y: number; vx: number; vy: number; life: number; size: number; color: string; type: string };
    const particles: Particle[] = [];

    function spawn(w: number, h: number) {
      const cx = w / 2, cy = h / 2;
      if (isFlame) {
        particles.push({ x: cx + (Math.random() - 0.5) * 60, y: cy + 45, vx: (Math.random() - 0.5) * 1.2, vy: -(1.5 + Math.random() * 2.2), life: 1, size: 7 + Math.random() * 9, color: `hsl(${10 + Math.random() * 30},100%,${50 + Math.random() * 25}%)`, type: "flame" });
      } else if (isGalaxy) {
        particles.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15, life: 1, size: 0.8 + Math.random() * 2.5, color: `hsl(${200 + Math.random() * 120},80%,${65 + Math.random() * 20}%)`, type: "star" });
      } else if (isDiamond) {
        const a = Math.random() * Math.PI * 2, rad = 40 + Math.random() * 70;
        particles.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad * 0.5, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, life: 1, size: 2 + Math.random() * 3, color: `hsl(${190 + Math.random() * 40},90%,${70 + Math.random() * 20}%)`, type: "sparkle" });
      } else if (isNeon) {
        const a = Math.random() * Math.PI * 2, rad = 55 + Math.random() * 30;
        particles.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad * 0.6, vx: Math.cos(a + Math.PI / 2) * 0.8, vy: Math.sin(a + Math.PI / 2) * 0.8, life: 1, size: 1.5 + Math.random() * 2.5, color: Math.random() > 0.5 ? "#FF2D8A" : "#FF7A00", type: "neon" });
      } else if (isGold || rarity === "legendary") {
        const a = Math.random() * Math.PI * 2, rad = 25 + Math.random() * 80;
        particles.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad * 0.5, vx: (Math.random() - 0.5) * 0.5, vy: -(0.3 + Math.random() * 0.7), life: 1, size: 2 + Math.random() * 3, color: `hsl(${40 + Math.random() * 20},100%,${55 + Math.random() * 20}%)`, type: "spark" });
      } else if (rarity === "epic") {
        const a = Math.random() * Math.PI * 2, rad = 50 + Math.random() * 45;
        particles.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad * 0.7, vx: (Math.random() - 0.5) * 0.4, vy: -(0.2 + Math.random() * 0.4), life: 1, size: 3 + Math.random() * 4, color: `hsl(${265 + Math.random() * 30},80%,65%)`, type: "orb" });
      } else {
        const a = Math.random() * Math.PI * 2, rad = 45 + Math.random() * 30;
        particles.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad * 0.6, vx: (Math.random() - 0.5) * 0.3, vy: -(0.1 + Math.random() * 0.3), life: 1, size: 1.5 + Math.random() * 2, color: primary, type: "glow" });
      }
    }

    function draw() {
      timeRef.current++;
      const t  = timeRef.current;
      const w  = canvas!.offsetWidth;
      const h  = canvas!.offsetHeight;
      const cx = w / 2, cy = h / 2;
      ctx.clearRect(0, 0, w, h);

      // Ambient glow
      const glowR = 110 + Math.sin(t * 0.02) * 20;
      const g = ctx.createRadialGradient(cx, cy + 10, 5, cx, cy + 10, glowR);
      g.addColorStop(0, `${primary}38`); g.addColorStop(1, "transparent");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

      // Ellipse platform shadow
      ctx.save(); ctx.translate(cx, cy + 80); ctx.scale(1, 0.28);
      const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, 100);
      pg.addColorStop(0, `${primary}28`); pg.addColorStop(1, "transparent");
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0, 0, 100, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Orbit rings
      if (rarity === "legendary" || rarity === "epic" || rarity === "mythic") {
        const oc = rarity === "legendary" ? "#F59E0B" : rarity === "mythic" ? "#EF4444" : "#A855F7";
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.008);
        ctx.strokeStyle = `${oc}28`; ctx.lineWidth = 1.5; ctx.setLineDash([8, 18]);
        ctx.beginPath(); ctx.ellipse(0, 0, 108, 38, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.rotate(t * 0.005 + Math.PI * 0.4);
        ctx.strokeStyle = `${oc}18`; ctx.lineWidth = 1; ctx.setLineDash([5, 22]);
        ctx.beginPath(); ctx.ellipse(0, 0, 88, 32, 0.2, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }

      // Spawn
      const rate = isFlame ? 3 : isGalaxy ? 2.5 : 1.8;
      for (let s = 0; s < rate; s++) { if (Math.random() < 0.85) spawn(w, h); }

      // Draw + update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.life -= 1 / 65;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        const alpha = Math.min(p.life * 3, 1) * p.life;
        ctx.save(); ctx.globalAlpha = Math.max(0, alpha);
        if (p.type === "flame") {
          const fg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          fg.addColorStop(0, "#fff8"); fg.addColorStop(0.3, p.color); fg.addColorStop(1, "transparent");
          ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        } else if (p.type === "sparkle" || p.type === "spark") {
          const ss = p.size * 1.8;
          ctx.strokeStyle = p.color; ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(p.x - ss, p.y); ctx.lineTo(p.x + ss, p.y);
          ctx.moveTo(p.x, p.y - ss); ctx.lineTo(p.x, p.y + ss);
          ctx.moveTo(p.x - ss * 0.7, p.y - ss * 0.7); ctx.lineTo(p.x + ss * 0.7, p.y + ss * 0.7);
          ctx.moveTo(p.x + ss * 0.7, p.y - ss * 0.7); ctx.lineTo(p.x - ss * 0.7, p.y + ss * 0.7);
          ctx.stroke();
        } else if (p.type === "star") {
          ctx.fillStyle = p.color; ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.4 + Math.sin(t * 0.05 + p.x) * 0.4), 0, Math.PI * 2); ctx.fill();
        } else {
          const pg2 = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.5);
          pg2.addColorStop(0, p.color); pg2.addColorStop(1, "transparent");
          ctx.fillStyle = pg2; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
      if (particles.length > 150) particles.splice(0, particles.length - 150);
      frameRef.current = requestAnimationFrame(draw);
    }

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [item]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

// ─── 3D Showroom Preview Modal ────────────────────────────────────────────────

function PreviewModal({ item, owned, equipped, onClose, onBuy, onEquip, purchasingId, equippingId }: {
  item: ShopItem | null; owned: boolean; equipped: boolean;
  onClose: () => void; onBuy: (item: ShopItem) => void; onEquip: (item: ShopItem) => void;
  purchasingId: string | null; equippingId: string | null;
}) {
  const rotRef  = useRef({ y: -20, x: 8, isDragging: false, lastX: 0, lastY: 0, pinchDist: 0 });
  const [rotation, setRotation] = useState({ y: -20, x: 8 });
  const [zoom, setZoom]         = useState(1);
  const zoomRef = useRef(1);
  const frameRef = useRef<number>(0);

  // Auto-rotate when not dragging
  useEffect(() => {
    if (!item) return;
    const rot = rotRef.current;
    function animate() {
      if (!rot.isDragging) rot.y += 0.45;
      setRotation({ y: rot.y, x: rot.x });
      frameRef.current = requestAnimationFrame(animate);
    }
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [item]);

  if (!item) return null;
  const rc    = r(item.rarity as string);
  const price = parseFloat(item.price as string);

  const startDrag = (x: number, y: number) => { rotRef.current.isDragging = true; rotRef.current.lastX = x; rotRef.current.lastY = y; };
  const moveDrag  = (x: number, y: number) => {
    if (!rotRef.current.isDragging) return;
    rotRef.current.y += (x - rotRef.current.lastX) * 0.9;
    rotRef.current.x  = Math.max(-35, Math.min(35, rotRef.current.x - (y - rotRef.current.lastY) * 0.35));
    rotRef.current.lastX = x; rotRef.current.lastY = y;
  };
  const endDrag = () => { rotRef.current.isDragging = false; };

  const handleWheel = (e: React.WheelEvent) => {
    zoomRef.current = Math.max(0.6, Math.min(2.2, zoomRef.current - e.deltaY * 0.001));
    setZoom(zoomRef.current);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) startDrag(e.touches[0].clientX, e.touches[0].clientY);
    else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      rotRef.current.pinchDist = Math.hypot(dx, dy);
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const delta = dist - rotRef.current.pinchDist;
      zoomRef.current = Math.max(0.6, Math.min(2.2, zoomRef.current + delta * 0.003));
      setZoom(zoomRef.current);
      rotRef.current.pinchDist = dist;
    }
  };

  // Derive item "type" display name from item name/category
  const itemTypeName = (() => {
    const n = (item.name ?? "").toLowerCase();
    if (n.includes("paddle")) return "Ping Pong Paddle";
    if (n.includes("cue"))    return "Pool Cue";
    const catLabels: Record<string, string> = {
      avatar_frame: "Avatar Frame", badge: "Badge", board_skin: "Game Equipment",
      emote: "Emote", theme: "Theme", victory_animation: "Victory FX",
      banner: "Banner", trail: "Trail", dice_skin: "Dice Skin", card_skin: "Card Skin",
    };
    return catLabels[item.category] ?? "Cosmetic Item";
  })();

  return createPortal(
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-lg"
        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={onClose}>

        <motion.div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col"
          style={{ background:"#0a0e1a", border:`1px solid ${item.iconColor ?? "#3b82f6"}33`, maxHeight:"92dvh" }}
          initial={{ y:80, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:80, opacity:0 }}
          transition={{ type:"spring", damping:26, stiffness:320 }} onClick={e => e.stopPropagation()}>

          {/* Close button */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold uppercase tracking-widest ${rc.textClass}`}>{rc.label}</span>
              <span className="text-muted-foreground text-xs">— {itemTypeName}</span>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors" data-testid="preview-close">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* 3D Showroom Stage */}
          <div className="relative h-72 shrink-0 select-none overflow-hidden cursor-grab active:cursor-grabbing"
            style={{ background: `radial-gradient(ellipse at 50% 80%, ${item.iconColor ?? "#3b82f6"}18 0%, transparent 65%), linear-gradient(180deg,#060a16 0%,#0e1428 100%)` }}
            onMouseDown={e => startDrag(e.clientX, e.clientY)}
            onMouseMove={e => moveDrag(e.clientX, e.clientY)}
            onMouseUp={endDrag} onMouseLeave={endDrag}
            onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={endDrag}
            onWheel={handleWheel}>

            {/* Canvas particle effects (behind icon) */}
            <ShowroomCanvas item={item} />

            {/* Ground grid lines */}
            <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none" style={{
              background: `linear-gradient(180deg, transparent, ${item.iconColor ?? "#3b82f6"}08)`,
              borderTop: `1px solid ${item.iconColor ?? "#3b82f6"}15`,
            }} />

            {/* 3D rotating item icon */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ perspective:"700px" }}>
              <div style={{
                transform:`rotateY(${rotation.y}deg) rotateX(${rotation.x}deg) scale(${zoom})`,
                transformStyle:"preserve-3d",
                transition:"none",
                filter:`drop-shadow(0 0 30px ${item.iconColor ?? "#fff"}bb) drop-shadow(0 20px 40px #00000088)`,
                color: item.iconColor ?? "#fff",
              }}>
                <CategoryIcon category={item.category} className="w-32 h-32" />
              </div>
            </div>

            {/* Rarity glow pulse */}
            {(item.rarity === "legendary" || item.rarity === "mythic" || item.rarity === "epic") && (
              <motion.div className="absolute inset-0 pointer-events-none"
                animate={{ opacity:[0.1,0.35,0.1] }} transition={{ duration:2.5, repeat:Infinity }}
                style={{ background:`radial-gradient(ellipse at 50% 50%, ${item.iconColor ?? rc.badgeColor}25, transparent 60%)` }} />
            )}

            {/* Drag hint */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
              <div className="flex items-center gap-1.5 bg-black/40 rounded-full px-3 py-1 text-[10px] text-white/50">
                <RotateCcw className="w-2.5 h-2.5" /> Drag to rotate  ·  <ZoomIn className="w-2.5 h-2.5" /> Scroll to zoom
              </div>
            </div>
          </div>

          {/* Item info */}
          <div className="px-5 py-4 flex flex-col gap-3 overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-black text-xl text-white leading-tight">{item.name}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{itemTypeName}</p>
              </div>
              <div className="shrink-0 text-right">
                {price === 0 ? (
                  <span className="text-green-400 font-bold text-lg">Free</span>
                ) : (
                  <div className="flex items-center gap-1">
                    <ScalpsIcon size="sm" />
                    <span className="font-black text-xl text-white">{price}</span>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">Scalps</p>
              </div>
            </div>

            {/* Rarity pill */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full border ${rc.textClass}`}
                style={{ borderColor:`${rc.badgeColor}40`, background:`${rc.badgeColor}12` }}>
                {item.rarity === "legendary" && <Crown className="w-3 h-3" />}
                {rc.label} Rarity
              </span>
              {item.isDailyItem && (
                <span className="text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 px-3 py-1 rounded-full">New Today</span>
              )}
              {item.isFeatured && (
                <span className="text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25 px-3 py-1 rounded-full flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-400" /> Featured
                </span>
              )}
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>

            {/* Action buttons */}
            <div className="flex gap-2 pb-2">
              {!owned ? (
                <Button className="flex-1 gap-2 h-10" onClick={() => onBuy(item)} disabled={purchasingId === item.id} data-testid={`preview-buy-${item.id}`}>
                  <ShoppingCart className="w-4 h-4" />
                  {purchasingId === item.id ? "Buying…" : price === 0 ? "Get Free" : `Buy for ${formatScalps(price)}`}
                </Button>
              ) : equipped ? (
                <div className="flex-1 flex items-center justify-center gap-2 h-10 rounded-md bg-green-500/10 border border-green-400/20 text-green-400 font-semibold text-sm">
                  <Check className="w-4 h-4" /> Equipped
                </div>
              ) : (
                <Button variant="outline" className="flex-1 gap-2 h-10" onClick={() => onEquip(item)} disabled={equippingId === item.id}>
                  <Zap className="w-4 h-4" />{equippingId === item.id ? "Equipping…" : "Equip Now"}
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

// ─── Purchase Success ─────────────────────────────────────────────────────────

function PurchaseSuccessOverlay({ item, onClose }: { item: ShopItem; onClose: () => void }) {
  return (
    <motion.div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={onClose}>
      <motion.div className="text-center p-8 max-w-xs mx-4"
        initial={{ scale:0.6, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0.8, opacity:0 }}
        transition={{ type:"spring", damping:18, stiffness:260 }} onClick={e => e.stopPropagation()}>
        <div className="relative flex items-center justify-center mb-5">
          {[1,2,3].map(i => (
            <motion.div key={i} className="absolute rounded-full border border-amber-400/20"
              initial={{ width:64, height:64, opacity:0.9 }} animate={{ width:64+i*55, height:64+i*55, opacity:0 }}
              transition={{ duration:0.9, delay:i*0.1 }} />
          ))}
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background:item.previewGradient ?? "linear-gradient(135deg,#FF7A00,#FF2D8A)", boxShadow:`0 0 30px ${item.iconColor ?? "#FF7A00"}66` }}>
            <BadgeCheck className="w-8 h-8 text-white" />
          </div>
        </div>
        <p className="text-xl font-black text-white mb-1">Unlocked!</p>
        <p className="text-base font-semibold mb-0.5" style={{ color:item.iconColor ?? "#FF7A00" }}>{item.name}</p>
        <p className="text-sm text-muted-foreground mb-5">Added to your collection</p>
        <Button size="sm" onClick={onClose} data-testid="button-purchase-close">Done</Button>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Shop Page ──────────────────────────────────────────────────────────

export default function ShopPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab]     = useState<string>("featured");
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [equippingId,  setEquippingId]  = useState<string | null>(null);
  const [purchasedItem, setPurchasedItem] = useState<ShopItem | null>(null);
  const [previewItem,   setPreviewItem]   = useState<ShopItem | null>(null);
  const [showConfetti,  setShowConfetti]  = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: allItems = [], isLoading } = useQuery<ShopItem[]>({
    queryKey: ["/api/shop/items"], staleTime: 60_000,
  });
  const { data: inventory = [] } = useQuery<InventoryRow[]>({
    queryKey: ["/api/shop/inventory"], enabled: !!user,
  });
  const { data: equipped = [] } = useQuery<EquippedRow[]>({
    queryKey: ["/api/shop/equipped"], enabled: !!user,
  });
  const { data: balanceData } = useQuery<{ balance: string }>({
    queryKey: ["/api/wallet/balance"], enabled: !!user,
  });

  // ── Derived ───────────────────────────────────────────────────────────────
  const ownedIds    = useMemo(() => new Set(inventory.map(r => r.item.id)), [inventory]);
  const equippedIds = useMemo(() => new Set(equipped.map(r => r.item.id)), [equipped]);
  const featuredItems = useMemo(() => allItems.filter(i => i.isFeatured),  [allItems]);
  const dailyItems    = useMemo(() => allItems.filter(i => i.isDailyItem), [allItems]);
  const balance       = parseFloat(balanceData?.balance ?? "0");

  const visibleItems = useMemo(() => {
    if (activeTab === "featured")  return featuredItems;
    if (activeTab === "daily")     return dailyItems;
    if (activeTab === "inventory") return [];
    return allItems.filter(i => i.category === activeTab);
  }, [activeTab, allItems, featuredItems, dailyItems]);

  // ── Purchase (Scalps = real balance) ─────────────────────────────────────
  const purchaseMutation = useMutation({
    mutationFn: async (itemId: string) => { const res = await apiRequest("POST", `/api/shop/purchase/${itemId}`, {}); return res.json(); },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      soundManager.playPurchase();
      setShowConfetti(true);
      setPurchasedItem(data.item ?? null);
    },
    onError: (err: any) => {
      soundManager.playError();
      const msg = err?.message ?? "Purchase failed";
      toast({
        title: "Purchase Failed",
        description: msg.includes("balance") ? "Not enough Scalps. Add more from the wallet button." : msg,
        variant: "destructive",
      });
    },
    onSettled: () => setPurchasingId(null),
  });

  // ── Equip ─────────────────────────────────────────────────────────────────
  const equipMutation = useMutation({
    mutationFn: (itemId: string) => apiRequest("POST", `/api/shop/equip/${itemId}`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/shop/equipped"] }); soundManager.playEquip(); toast({ title: "Equipped!" }); },
    onError:   () => { soundManager.playError(); toast({ title: "Failed to equip", variant: "destructive" }); },
    onSettled: () => setEquippingId(null),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleBuy(item: ShopItem) {
    soundManager.playClick();
    setPreviewItem(null);
    const price = parseFloat(item.price as string);
    if (price > 0 && balance < price) {
      toast({ title: "Not enough Scalps", description: `You need ${formatScalps(price)} — add Scalps from the wallet.`, variant: "destructive" });
      return;
    }
    setPurchasingId(item.id);
    purchaseMutation.mutate(item.id);
  }
  function handleEquip(item: ShopItem) {
    soundManager.playClick();
    setPreviewItem(null);
    setEquippingId(item.id);
    equipMutation.mutate(item.id);
  }
  function handleTabChange(key: string) {
    setActiveTab(key);
    soundManager.playTabSwitch();
  }

  return (
    <div className="min-h-screen bg-background relative">
      <PageDepthBackground
        glowZones={[
          { x: "20%", y: "0%",  color: "168,85,247",  size: "55%", opacity: 0.08 },
          { x: "80%", y: "8%",  color: "245,158,11",  size: "45%", opacity: 0.06 },
          { x: "50%", y: "85%", color: "59,130,246",  size: "40%", opacity: 0.04 },
        ]}
        particleCount={22}
      />
      <InjectCSS />
      <AppNavbar />

      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden border-b border-white/6">
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background:"radial-gradient(ellipse 90% 140% at 50% -5%, #FF2D8A, #FF7A00 45%, transparent 70%)" }} />
        <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Title */}
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <ScalpsIcon size="md" />
                <h1 className="text-2xl md:text-3xl font-black" data-testid="shop-title">Item Shop</h1>
              </div>
              <p className="text-muted-foreground text-sm">Spend Scalps on cosmetics — no pay-to-win, ever</p>
            </div>
            {/* Scalps balance */}
            {user && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5" data-testid="shop-scalps-balance">
                  <ScalpsIcon size="sm" glow />
                  <span className="font-bold tabular-nums">{balance.toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground">Scalps</span>
                </div>
                <Link href="/deposit">
                  <Button size="sm" variant="outline" className="gap-1 text-xs" data-testid="button-add-scalps">
                    <Plus className="w-3 h-3" />Add Scalps
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">

        {/* ── Scalps info banner ── */}
        <div className="mb-5 p-3 rounded-lg border border-white/8 bg-white/4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <ScalpsIcon size="xs" />
          <span><strong className="text-foreground">1 Scalp = 1 USD.</strong> Deposit real money → it becomes Scalps automatically. Use Scalps to wager on games or buy cosmetics.</span>
        </div>

        {/* ── Category Tabs ── */}
        <div className="overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 mb-5">
          <div className="flex gap-1.5 min-w-max">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => handleTabChange(key)} data-testid={`tab-${key}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${activeTab === key ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground border border-transparent hover-elevate"}`}>
                <Icon className="w-3.5 h-3.5 shrink-0" />{label}
                {key === "inventory" && inventory.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[9px] font-bold flex items-center justify-center">{inventory.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Featured Carousel ── */}
        {(activeTab === "featured" || activeTab === "daily") && featuredItems.length > 0 && (
          <FeaturedCarousel items={featuredItems.slice(0, 6)} ownedIds={ownedIds} equippedIds={equippedIds}
            onBuy={handleBuy} onEquip={handleEquip} purchasingId={purchasingId} equippingId={equippingId} />
        )}

        {/* ── Daily Deals Banner ── */}
        {activeTab === "daily" && (
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="font-semibold text-sm">Daily Deals</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <RefreshCw className="w-3 h-3" /><span>Resets in</span><DailyCountdown />
            </div>
          </div>
        )}

        {/* ── Countdown for featured ── */}
        {activeTab === "featured" && (
          <div className="flex items-center justify-end gap-1.5 mb-3 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" /><span>Shop refreshes in</span><DailyCountdown />
          </div>
        )}

        {/* ── Legendary Items Spotlight ── */}
        {activeTab === "featured" && (
          (() => {
            const legendaryItems = allItems.filter(i => i.rarity === "legendary" || i.rarity === "mythic");
            if (legendaryItems.length === 0) return null;
            return (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Crown className="w-4 h-4 text-amber-400 fill-amber-400/50" />
                  <span className="font-bold text-sm text-amber-400">Legendary Collection</span>
                  <div className="h-px flex-1 bg-amber-400/20" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {legendaryItems.map(item => (
                    <ItemCard key={item.id} item={item} owned={ownedIds.has(item.id)} equipped={equippedIds.has(item.id)}
                      onBuy={() => handleBuy(item)} onEquip={() => handleEquip(item)} onPreview={() => setPreviewItem(item)}
                      isPurchasing={purchasingId === item.id} isEquipping={equippingId === item.id} />
                  ))}
                </div>
              </div>
            );
          })()
        )}

        {/* ── Inventory Tab ── */}
        {activeTab === "inventory" && (
          inventory.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground" data-testid="empty-inventory">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No items yet</p>
              <p className="text-sm mt-1">Browse the shop and spend your Scalps.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3" data-testid="inventory-grid">
              {inventory.map(row => (
                <ItemCard key={row.inventoryId} item={row.item} owned equipped={equippedIds.has(row.item.id)}
                  onBuy={() => {}} onEquip={() => handleEquip(row.item)} onPreview={() => setPreviewItem(row.item)}
                  isPurchasing={false} isEquipping={equippingId === row.item.id} />
              ))}
            </div>
          )
        )}

        {/* ── Item Grid ── */}
        {activeTab !== "inventory" && (
          isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-48 rounded-lg bg-card/50 animate-pulse border border-white/6" />)}
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nothing here yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3" data-testid="shop-items-grid">
              {visibleItems.map(item => (
                <ItemCard key={item.id} item={item} owned={ownedIds.has(item.id)} equipped={equippedIds.has(item.id)}
                  onBuy={() => handleBuy(item)} onEquip={() => handleEquip(item)} onPreview={() => setPreviewItem(item)}
                  isPurchasing={purchasingId === item.id} isEquipping={equippingId === item.id} />
              ))}
            </div>
          )
        )}

        {/* ── Pricing Guide ── */}
        <div className="mt-10 pt-5 border-t border-white/6">
          <p className="text-xs text-muted-foreground text-center mb-3">Scalps Pricing Guide</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              { rarity:"common",    label:"Common",    price:"Free – 3 Scalps",  color:"text-slate-400" },
              { rarity:"uncommon",  label:"Uncommon",  price:"6 Scalps",         color:"text-green-400" },
              { rarity:"rare",      label:"Rare",      price:"15 Scalps",        color:"text-blue-400"  },
              { rarity:"epic",      label:"Epic",      price:"35 Scalps",        color:"text-purple-400" },
              { rarity:"legendary", label:"Legendary", price:"85 Scalps",        color:"text-amber-400" },
            ].map(({ label, price, color }) => (
              <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-white/8 text-xs">
                <ScalpsIcon size="xs" /><span className={`font-medium ${color}`}>{label}</span><span className="text-muted-foreground">— {price}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-4">All items are purely cosmetic · 1 Scalp = 1 USD · Scalps never expire</p>
        </div>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {previewItem && <PreviewModal item={previewItem} owned={ownedIds.has(previewItem.id)} equipped={equippedIds.has(previewItem.id)}
          onClose={() => setPreviewItem(null)} onBuy={handleBuy} onEquip={handleEquip} purchasingId={purchasingId} equippingId={equippingId} />}
      </AnimatePresence>
      <AnimatePresence>
        {purchasedItem && <PurchaseSuccessOverlay item={purchasedItem} onClose={() => setPurchasedItem(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showConfetti && <ConfettiOverlay onDone={() => setShowConfetti(false)} />}
      </AnimatePresence>
    </div>
  );
}
