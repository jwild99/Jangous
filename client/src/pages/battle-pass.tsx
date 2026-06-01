import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { AppNavbar } from "@/components/AppNavbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { soundManager } from "@/lib/soundManager";
import { Link } from "wouter";
import { createPortal } from "react-dom";
import {
  Shield, Star, Zap, Trophy, Crown, Lock, CheckCircle2, Gift,
  Clock, Sparkles, Coins, Palette, ShoppingBag, ArrowRight, Eye,
  X, Flame,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────
interface BPTier {
  id: string; tier: number; xpRequired: number;
  rewardType: string; rewardValue: string; rewardDescription: string; isPremium: boolean;
}
interface BPSeason { id: string; name: string; startDate: string; endDate: string; isActive: boolean; }
interface BPProgress { currentXp: number; claimedTiers: number[]; hasPremium: boolean; }
interface BPData { season: BPSeason; tiers: BPTier[]; progress: BPProgress; }
interface TierGroup { tier: number; xpRequired: number; free: BPTier; premium: BPTier; }

// ─── Rarity system ──────────────────────────────────────────────────────────
interface Rarity {
  label: string; color: string; glow: string;
  border: string; bg: string; textClass: string; isGoat?: boolean;
}

function getRewardRarity(tier: number, isPremium: boolean, rewardType?: string): Rarity {
  // GOAT — only at tier 100 premium (or rewardType='goat')
  if (rewardType === "goat" || (tier === 100 && isPremium)) return {
    label: "GOAT", color: "#ef4444", isGoat: true,
    glow: "goat-glow",
    border: "border-red-500/60",
    bg: "goat-gradient-bg",
    textClass: "goat-text",
  };
  // Tier 100 free = Legendary
  if (tier === 100) return {
    label: "Legendary", color: "#f59e0b",
    glow: "shadow-[0_0_22px_rgba(245,158,11,0.45)]",
    border: "border-amber-500/50", bg: "bg-amber-500/10",
    textClass: "text-amber-400",
  };
  if (tier >= 90 || (tier >= 75 && isPremium)) return {
    label: isPremium ? "Legendary" : "Epic",
    color: isPremium ? "#f59e0b" : "#a855f7",
    glow: isPremium ? "shadow-[0_0_18px_rgba(245,158,11,0.38)]" : "shadow-[0_0_16px_rgba(168,85,247,0.38)]",
    border: isPremium ? "border-amber-500/40" : "border-purple-500/40",
    bg: isPremium ? "bg-amber-500/8" : "bg-purple-500/8",
    textClass: isPremium ? "text-amber-400" : "text-purple-400",
  };
  if (tier >= 75) return {
    label: "Epic", color: "#a855f7",
    glow: "shadow-[0_0_14px_rgba(168,85,247,0.32)]",
    border: "border-purple-500/35", bg: "bg-purple-500/7",
    textClass: "text-purple-400",
  };
  if (tier >= 50 && isPremium) return {
    label: "Epic", color: "#a855f7",
    glow: "shadow-[0_0_12px_rgba(168,85,247,0.28)]",
    border: "border-purple-500/30", bg: "bg-purple-500/6",
    textClass: "text-purple-400",
  };
  if (tier >= 50) return {
    label: "Rare", color: "#3b82f6",
    glow: "shadow-[0_0_10px_rgba(59,130,246,0.28)]",
    border: "border-blue-500/30", bg: "bg-blue-500/6",
    textClass: "text-blue-400",
  };
  if (tier >= 25 && isPremium) return {
    label: "Rare", color: "#3b82f6",
    glow: "shadow-[0_0_10px_rgba(59,130,246,0.25)]",
    border: "border-blue-500/28", bg: "bg-blue-500/5",
    textClass: "text-blue-400",
  };
  if (tier >= 25) return {
    label: "Uncommon", color: "#22c55e",
    glow: "", border: "border-green-500/25", bg: "bg-green-500/5",
    textClass: "text-green-400",
  };
  if (isPremium) return {
    label: "Uncommon", color: "#22c55e",
    glow: "", border: "border-green-500/22", bg: "bg-green-500/4",
    textClass: "text-green-400",
  };
  return {
    label: "Common", color: "#94a3b8",
    glow: "", border: "border-white/8", bg: "bg-white/3",
    textClass: "text-slate-400",
  };
}

const REWARD_ICON: Record<string, React.ElementType> = {
  scalps: Coins, badge: Shield, cosmetic: Palette, xp: Zap,
  title: Crown, frame: Star, effect: Sparkles, goat: Trophy,
};

function getRewardName(r: BPTier): string {
  if (r.rewardType === "scalps") return `${r.rewardValue} Scalps`;
  if (r.rewardType === "title") return r.rewardValue;
  if (r.rewardType === "goat") return "The Grid's Greatest";
  return r.rewardDescription.split(" ").slice(0, 5).join(" ");
}

function getDaysLeft(endDate: string) {
  return Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000));
}
function getCurrentTier(freeTiers: BPTier[], xp: number): number {
  let cur = 0;
  for (const t of freeTiers) { if (xp >= t.xpRequired) cur = t.tier; }
  return cur;
}

// ─── GOAT Claim Overlay ───────────────────────────────────────────────────
const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  angle: (i / 28) * 360,
  distance: 120 + Math.random() * 160,
  size: 3 + Math.random() * 5,
  delay: Math.random() * 0.4,
  color: ["#ef4444", "#f59e0b", "#a855f7", "#fb923c", "#fbbf24"][i % 5],
}));

function GoatClaimOverlay({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{ background: "rgba(0,0,0,0.88)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onDismiss}
    >
      {/* Radial burst */}
      <motion.div
        className="absolute w-96 h-96 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(239,68,68,0.35) 0%, rgba(245,158,11,0.2) 40%, transparent 70%)",
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 2.5, 2], opacity: [0, 0.9, 0.4] }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />

      {/* Particles */}
      {PARTICLES.map(p => {
        const rad = (p.angle * Math.PI) / 180;
        const tx = Math.cos(rad) * p.distance;
        const ty = Math.sin(rad) * p.distance;
        return (
          <motion.div
            key={p.id}
            className="absolute rounded-full pointer-events-none"
            style={{ width: p.size, height: p.size, background: p.color, boxShadow: `0 0 6px ${p.color}` }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
            animate={{ x: tx, y: ty, opacity: [0, 1, 0], scale: [0, 1.4, 0.5] }}
            transition={{ duration: 1.8, delay: p.delay, ease: "easeOut" }}
          />
        );
      })}

      {/* Main card */}
      <motion.div
        className="relative flex flex-col items-center gap-5 z-10"
        initial={{ scale: 0.4, opacity: 0, y: 60 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", damping: 16, stiffness: 220, delay: 0.3 }}
      >
        {/* Outer aura */}
        <div className="absolute -inset-16 rounded-full goat-gradient-bg opacity-20 blur-3xl goat-aura pointer-events-none" />

        {/* Trophy icon */}
        <motion.div
          className="relative w-28 h-28 rounded-3xl flex items-center justify-center goat-gradient-bg"
          style={{ padding: 3 }}
          animate={{ rotate: [0, 2, -2, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="w-full h-full rounded-[20px] flex items-center justify-center"
            style={{ background: "rgba(10,5,18,0.85)" }}>
            <Trophy className="w-14 h-14" style={{
              color: "#f59e0b",
              filter: "drop-shadow(0 0 18px rgba(239,68,68,0.8)) drop-shadow(0 0 36px rgba(245,158,11,0.6))",
            }} />
          </div>
        </motion.div>

        {/* Labels */}
        <div className="text-center">
          <motion.p
            className="text-[11px] font-black uppercase tracking-[0.3em] mb-2 goat-text"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            Rarity: GOAT
          </motion.p>
          <motion.h2
            className="text-4xl font-black text-white mb-1"
            style={{ textShadow: "0 0 30px rgba(239,68,68,0.7), 0 0 60px rgba(245,158,11,0.4)" }}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7, type: "spring", stiffness: 200 }}
          >
            GOAT UNLOCKED
          </motion.h2>
          <motion.p
            className="text-sm text-white/55"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
          >
            The Grid's Greatest — Season 1 Champion
          </motion.p>
        </div>

        <motion.p
          className="text-xs text-white/25 mt-2"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }}
        >
          Tap anywhere to continue
        </motion.p>
      </motion.div>
    </motion.div>,
    document.body
  );
}

// ─── Item Preview Modal ────────────────────────────────────────────────────
function RewardPreviewModal({
  reward, hasPremium, claimed, unlocked,
  onClose, onClaim, onGetPremium, claiming,
}: {
  reward: BPTier; hasPremium: boolean;
  claimed: boolean; unlocked: boolean;
  onClose: () => void; onClaim: () => void; onGetPremium: () => void;
  claiming: boolean;
}) {
  const rarity = getRewardRarity(reward.tier, reward.isPremium, reward.rewardType);
  const Icon = REWARD_ICON[reward.rewardType] ?? Gift;
  const isLocked = reward.isPremium && !hasPremium;
  const isClaimable = unlocked && !claimed && !isLocked;
  const isGoat = rarity.isGoat;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[9100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className={`relative w-full max-w-xs rounded-2xl overflow-hidden`}
        style={{
          background: "linear-gradient(160deg, rgba(12,8,22,0.98), rgba(18,12,32,0.98))",
          border: isGoat ? "2px solid transparent" : undefined,
        }}
        initial={{ scale: 0.85, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 16, opacity: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 280 }}
        onClick={e => e.stopPropagation()}
      >
        {/* GOAT: animated gradient border wrapper */}
        {isGoat && (
          <div className="absolute -inset-px rounded-2xl goat-gradient-bg pointer-events-none" style={{ zIndex: -1 }} />
        )}
        {!isGoat && (
          <div className={`absolute inset-0 rounded-2xl border ${rarity.border} pointer-events-none`} />
        )}

        {/* Rarity stripe */}
        <div className="h-1.5 w-full relative overflow-hidden"
          style={isGoat
            ? { background: "linear-gradient(90deg, #ef4444, #f59e0b, #a855f7, #ef4444)", backgroundSize: "300%", animation: "goat-gradient-shift 3s ease infinite" }
            : { background: `linear-gradient(90deg, ${rarity.color}80, ${rarity.color}, ${rarity.color}80)` }
          }
        />

        {/* Close */}
        <button onClick={onClose} aria-label="Close preview" data-testid="btn-close-preview"
          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/8 flex items-center justify-center hover-elevate z-10">
          <X className="w-3.5 h-3.5 text-white/60" />
        </button>

        {/* GOAT aura background */}
        {isGoat && (
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(circle at 50% 35%, rgba(239,68,68,0.12) 0%, rgba(245,158,11,0.07) 40%, transparent 70%)" }} />
        )}

        {/* Icon area */}
        <div className="relative flex items-center justify-center pt-8 pb-4">
          {!isGoat && rarity.glow && (
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: `radial-gradient(circle at 50% 50%, ${rarity.color}18, transparent 65%)` }} />
          )}
          {isGoat && (
            <div className="absolute inset-0 pointer-events-none goat-aura"
              style={{ background: "radial-gradient(circle at 50% 50%, rgba(239,68,68,0.2) 0%, rgba(245,158,11,0.12) 40%, transparent 70%)" }} />
          )}

          <motion.div
            className={`w-24 h-24 rounded-2xl flex items-center justify-center relative ${isGoat ? "goat-glow" : ""}`}
            style={isGoat ? {
              background: "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(245,158,11,0.15), rgba(168,85,247,0.1))",
              border: "2px solid rgba(239,68,68,0.4)",
              padding: 2,
            } : {
              background: `linear-gradient(135deg, ${rarity.color}22, ${rarity.color}0a)`,
              border: `1.5px solid ${rarity.color}40`,
              boxShadow: `0 0 28px ${rarity.color}30`,
            }}
            animate={isGoat
              ? { rotate: [0, 1.5, -1.5, 0] }
              : { scale: [1, 1.04, 1] }
            }
            transition={{ duration: isGoat ? 3 : 2.5, repeat: Infinity, ease: "easeInOut" }}
          >
            {isLocked
              ? <Lock className="w-10 h-10 text-white/30" />
              : <Icon className="w-10 h-10"
                  style={{
                    color: isGoat ? "#f59e0b" : rarity.color,
                    filter: isGoat
                      ? "drop-shadow(0 0 10px rgba(239,68,68,0.9)) drop-shadow(0 0 20px rgba(245,158,11,0.7))"
                      : `drop-shadow(0 0 8px ${rarity.color}80)`,
                  }}
                />
            }
          </motion.div>
        </div>

        {/* Info */}
        <div className="px-5 pb-2 text-center">
          <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
            {isGoat
              ? <span className="text-[11px] font-black uppercase tracking-widest goat-text">GOAT — Greatest of All Time</span>
              : <span className={`text-[10px] font-black uppercase tracking-widest ${rarity.textClass}`}>{rarity.label}</span>
            }
            {reward.isPremium && !isGoat && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                style={{ background: "rgba(255,45,138,0.15)", color: "#FF2D8A", border: "1px solid rgba(255,45,138,0.3)" }}>
                Premium
              </span>
            )}
            {isGoat && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)" }}>
                Tier 100 Only
              </span>
            )}
          </div>

          <h3 className="text-base font-black text-white mb-1 leading-tight">{getRewardName(reward)}</h3>
          <p className="text-[11px] text-white/45 mb-3 leading-snug">{reward.rewardDescription}</p>

          <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
            <div className="px-3 py-1 rounded-full bg-white/6 border border-white/10 text-[10px] text-white/50">
              Tier {reward.tier}
            </div>
            {!unlocked && (
              <div className="px-3 py-1 rounded-full bg-white/6 border border-white/10 text-[10px] text-white/50">
                Unlock at Tier {reward.tier}
              </div>
            )}
            {isGoat && (
              <div className="px-3 py-1 rounded-full text-[10px] font-bold goat-gradient-bg" style={{ color: "#fff" }}>
                Season 1 Exclusive
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="px-5 pb-5 flex flex-col gap-2">
          {isLocked ? (
            <>
              <div className="px-3 py-2 rounded-lg text-center text-[11px] text-white/45 border border-white/8 bg-white/4 mb-1">
                {isGoat
                  ? <span>The <span className="goat-text font-bold">GOAT</span> reward is part of the <span className="text-amber-400 font-semibold">Premium Track</span></span>
                  : <span>This reward is part of the <span className="text-amber-400 font-semibold">Premium Track</span></span>
                }
              </div>
              <Button className="w-full font-bold gap-2" onClick={() => { onClose(); onGetPremium(); }}
                style={isGoat
                  ? { background: "linear-gradient(135deg, #ef4444, #f59e0b, #a855f7)", border: "none" }
                  : { background: "linear-gradient(135deg, #FF2D8A, #FF7A00)", border: "none" }
                }
                data-testid="modal-get-battle-pass">
                <Crown className="w-4 h-4" /> Get Battle Pass — 10 Scalps
              </Button>
              <Button variant="ghost" className="w-full text-white/40 text-xs" onClick={onClose}>
                Maybe Later
              </Button>
            </>
          ) : claimed ? (
            <div className="flex items-center justify-center gap-2 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-300">Already Claimed</span>
            </div>
          ) : isClaimable ? (
            <Button className="w-full font-bold gap-2" onClick={() => { onClaim(); onClose(); }} disabled={claiming}
              style={isGoat
                ? { background: "linear-gradient(135deg, #ef4444, #f59e0b, #a855f7)", border: "none" }
                : { background: "linear-gradient(135deg, #FF2D8A, #FF7A00)", border: "none" }
              }
              data-testid="modal-claim-reward">
              <Gift className="w-4 h-4" />
              {claiming ? "Claiming…" : `Claim Tier ${reward.tier} Reward`}
            </Button>
          ) : (
            <div className="flex items-center justify-center gap-2 py-3 rounded-lg bg-white/5 border border-white/8">
              <Lock className="w-4 h-4 text-white/30" />
              <span className="text-sm text-white/40">Earn more XP to unlock</span>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

// ─── Reward Card ────────────────────────────────────────────────────────────
function RewardCard({
  reward, claimed, unlocked, hasPremium,
  onPreview, onClaim, claiming,
}: {
  reward: BPTier; claimed: boolean; unlocked: boolean;
  hasPremium: boolean; onPreview: (r: BPTier) => void;
  onClaim: (tier: number, isPremium: boolean) => void; claiming: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const isLocked = reward.isPremium && !hasPremium;
  const isClaimable = unlocked && !claimed && !isLocked;
  const rarity = getRewardRarity(reward.tier, reward.isPremium, reward.rewardType);
  const Icon = REWARD_ICON[reward.rewardType] ?? Gift;
  const isGoat = rarity.isGoat;

  return (
    <motion.div
      className={[
        "relative flex-1 flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer min-w-0 group transition-all duration-200",
        claimed ? "bg-white/4" : isClaimable ? "bg-white/8" : "bg-white/3",
        isLocked ? "opacity-60" : unlocked ? "" : "opacity-50",
        isGoat ? "goat-glow" : "",
      ].join(" ")}
      style={isGoat
        ? {
            background: "linear-gradient(135deg, rgba(239,68,68,0.12), rgba(245,158,11,0.08), rgba(168,85,247,0.06))",
            border: "1.5px solid rgba(239,68,68,0.4)",
          }
        : hovered
        ? {
            borderColor: `${rarity.color}40`,
            boxShadow: `0 0 12px ${rarity.color}22`,
            background: `${rarity.color}10`,
          }
        : {}
      }
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={() => onPreview(reward)}
      whileHover={{ scale: 1.012 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* GOAT premium overlay */}
      {isLocked && isGoat && (
        <div className="absolute inset-0 rounded-lg pointer-events-none"
          style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.05), rgba(245,158,11,0.04))" }} />
      )}

      {/* Icon */}
      <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 transition-all duration-200"
        style={isGoat ? {
          background: "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(245,158,11,0.15))",
        } : {
          background: hovered
            ? `${rarity.color}22`
            : unlocked && !isLocked ? `${rarity.color}15` : "rgba(255,255,255,0.05)",
        }}>
        {isLocked && !isGoat
          ? <Lock className="w-3.5 h-3.5 text-white/25" />
          : isLocked && isGoat
          ? <Lock className="w-3.5 h-3.5" style={{ color: "rgba(239,68,68,0.4)" }} />
          : <Icon className="w-3.5 h-3.5 transition-colors duration-200"
              style={{
                color: isGoat ? "#f59e0b" : unlocked ? rarity.color : "#475569",
                filter: isGoat
                  ? "drop-shadow(0 0 4px rgba(239,68,68,0.8))"
                  : hovered ? `drop-shadow(0 0 4px ${rarity.color}80)` : "none",
              }}
            />
        }
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold leading-tight truncate transition-colors duration-200"
          style={{ color: isGoat ? "#f59e0b" : hovered ? rarity.color : unlocked && !isLocked ? rarity.color : "#475569" }}>
          {getRewardName(reward)}
        </p>
        <div className="flex items-center gap-1">
          {isGoat
            ? <span className="text-[9px] font-black goat-text">GOAT</span>
            : <p className="text-[9px]" style={{ color: hovered ? `${rarity.color}80` : "#374151" }}>{rarity.label}</p>
          }
          {reward.isPremium && !hasPremium && !isGoat && (
            <span className="text-[8px] font-bold uppercase tracking-wide" style={{ color: "#FF2D8A80" }}>• Premium</span>
          )}
          {isGoat && !hasPremium && (
            <span className="text-[8px] font-bold uppercase tracking-wide" style={{ color: "rgba(239,68,68,0.5)" }}>• Premium</span>
          )}
        </div>
      </div>

      {/* Right indicators */}
      <div className="flex-shrink-0 flex items-center">
        {claimed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
        {isClaimable && !claiming && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
        {claiming && <div className="w-3 h-3 rounded-full border border-amber-400 border-t-transparent animate-spin" />}
        {!claimed && !isClaimable && (
          <Eye className="w-3 h-3 text-white/0 group-hover:text-white/30 transition-colors duration-200" />
        )}
      </div>
    </motion.div>
  );
}

// ─── Tier Row ─────────────────────────────────────────────────────────────
function TierRow({
  group, currentTier, progress, hasPremium, onPreview, onClaim, claimingTier,
}: {
  group: TierGroup; currentTier: number; progress: BPProgress;
  hasPremium: boolean; onPreview: (r: BPTier) => void;
  onClaim: (tier: number, isPremium: boolean) => void; claimingTier: string | null;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const isCurrent = group.tier === currentTier;
  const unlocked = currentTier >= group.tier;
  const freeClaimed = progress.claimedTiers.includes(group.tier);
  const premClaimed = progress.claimedTiers.includes(group.tier + 1000);
  const freeRarity = getRewardRarity(group.tier, false, group.free?.rewardType);
  const isGoatRow = group.tier === 100;

  useEffect(() => {
    if (isCurrent && rowRef.current) {
      setTimeout(() => rowRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 500);
    }
  }, [isCurrent]);

  return (
    <motion.div
      ref={rowRef}
      data-testid={`tier-row-${group.tier}`}
      className={[
        "relative flex items-center gap-2 px-1.5 py-1 rounded-xl transition-colors",
        isGoatRow
          ? "goat-glow"
          : isCurrent
          ? `bg-gradient-to-r ${freeRarity.bg} border ${freeRarity.border} ${freeRarity.glow}`
          : "hover-elevate",
      ].join(" ")}
      style={isGoatRow ? {
        background: "linear-gradient(135deg, rgba(239,68,68,0.1), rgba(245,158,11,0.06), rgba(168,85,247,0.06))",
        border: "1.5px solid rgba(239,68,68,0.35)",
        padding: "6px",
      } : {}}
    >
      {isGoatRow && (
        <div className="absolute inset-0 rounded-xl pointer-events-none goat-aura"
          style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(239,68,68,0.08) 0%, transparent 70%)" }} />
      )}

      <RewardCard
        reward={group.free} claimed={freeClaimed} unlocked={unlocked}
        hasPremium={hasPremium} onPreview={onPreview} onClaim={onClaim}
        claiming={claimingTier === `${group.tier}-free`}
      />

      {/* Tier badge */}
      <div className={[
        "w-9 flex-shrink-0 flex flex-col items-center justify-center rounded-lg py-1.5 z-10",
        isCurrent ? "bg-white/15 ring-1 ring-white/25" : "bg-white/5",
      ].join(" ")}>
        {isCurrent && <div className="w-1 h-1 rounded-full bg-amber-400 mb-0.5 animate-pulse" />}
        {isGoatRow
          ? <span className="text-[10px] font-black leading-none goat-text">100</span>
          : <span className="text-[10px] font-black leading-none" style={{ color: freeRarity.color }}>{group.tier}</span>
        }
        {isGoatRow && <span className="text-[7px] leading-none mt-0.5 font-black goat-text">GOAT</span>}
      </div>

      <RewardCard
        reward={group.premium} claimed={premClaimed} unlocked={unlocked}
        hasPremium={hasPremium} onPreview={onPreview} onClaim={onClaim}
        claiming={claimingTier === `${group.tier}-premium`}
      />
    </motion.div>
  );
}

// ─── Purchase Modal ────────────────────────────────────────────────────────
function PurchaseModal({ onConfirm, onClose, isPending }: {
  onConfirm: () => void; onClose: () => void; isPending: boolean;
}) {
  const perks = [
    { icon: Star,      text: "100 Exclusive Premium Tier Rewards",     color: "#FF2D8A" },
    { icon: Sparkles,  text: "Animated Avatar Frames & Effects",        color: "#a855f7" },
    { icon: Crown,     text: "20+ Unique Titles & Rare Badges",         color: "#f97316" },
    { icon: Palette,   text: "Rare Cosmetics, Cues & Paddle Skins",     color: "#60a5fa" },
    { icon: Trophy,    text: "Tier 100 GOAT Reward — Season Exclusive", color: "#ef4444" },
    { icon: Shield,    text: "Season 1 Champion Frame + Title",         color: "#4ade80" },
  ];
  return (
    <motion.div className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}>
      <motion.div className="w-full max-w-sm rounded-2xl overflow-hidden border border-white/10 modal-entrance"
        style={{ background: "linear-gradient(160deg, rgba(15,10,28,0.98), rgba(20,14,36,0.98))" }}
        initial={{ scale: 0.9, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}>
        <div className="h-1 w-full goat-gradient-bg" />
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center goat-gradient-bg">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Battle Pass Premium</h2>
              <p className="text-xs text-white/40">Season 1: The Grid</p>
            </div>
          </div>
          <div className="space-y-1.5 mb-5">
            {perks.map((p, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/5">
                <p.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: p.color }} />
                <span className="text-[12px] text-white/75">{p.text}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mb-4 px-3 py-3 rounded-xl border border-white/8"
            style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.08), rgba(245,158,11,0.08))" }}>
            <div>
              <p className="text-xs text-white/35 line-through">Worth 500+ Scalps in Cosmetics</p>
              <p className="text-base font-black text-white">Just 10 Scalps</p>
            </div>
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm goat-gradient-bg text-white">
              <Coins className="w-4 h-4" /> 10 Scalps
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={onClose} disabled={isPending}
              data-testid="btn-cancel-premium">Cancel</Button>
            <Button className="flex-1 font-bold" onClick={onConfirm} disabled={isPending}
              data-testid="btn-confirm-premium-purchase"
              style={{ background: "linear-gradient(135deg, #FF2D8A, #FF7A00)", border: "none" }}>
              {isPending ? "Purchasing…" : "Purchase — 10 Scalps"}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
import { PageDepthBackground } from "@/components/PageDepthBackground";

export default function BattlePassPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showPurchase, setShowPurchase] = useState(false);
  const [claimingTier, setClaimingTier] = useState<string | null>(null);
  const [justClaimed, setJustClaimed] = useState<number[]>([]);
  const [previewReward, setPreviewReward] = useState<BPTier | null>(null);
  const [showGoatOverlay, setShowGoatOverlay] = useState(false);

  const { data, isLoading } = useQuery<BPData>({
    queryKey: ["/api/battle-pass"],
    enabled: !!user,
  });

  const tierGroups = useMemo<TierGroup[]>(() => {
    if (!data?.tiers) return [];
    const map = new Map<number, Partial<TierGroup>>();
    for (const t of data.tiers) {
      const e = map.get(t.tier) ?? { tier: t.tier, xpRequired: t.xpRequired };
      if (t.isPremium) e.premium = t; else e.free = t;
      map.set(t.tier, e);
    }
    return Array.from(map.values())
      .filter(g => g.free && g.premium)
      .sort((a, b) => a.tier! - b.tier!) as TierGroup[];
  }, [data?.tiers]);

  const freeTiers = useMemo(() => (data?.tiers ?? []).filter(t => !t.isPremium), [data]);
  const currentTier = useMemo(() => getCurrentTier(freeTiers, data?.progress?.currentXp ?? 0), [freeTiers, data]);

  const { prevXP, nextXP } = useMemo(() => {
    const sorted = [...freeTiers].sort((a, b) => a.tier - b.tier);
    const prevT = [...sorted].reverse().find(t => t.tier <= currentTier);
    const nextT = sorted.find(t => t.tier > currentTier);
    return { prevXP: prevT?.xpRequired ?? 0, nextXP: nextT?.xpRequired ?? 132000 };
  }, [freeTiers, currentTier]);

  const xpPct = useMemo(() => {
    const cur = data?.progress?.currentXp ?? 0;
    const span = nextXP - prevXP;
    if (span <= 0) return 100;
    return Math.min(100, ((cur - prevXP) / span) * 100);
  }, [data, prevXP, nextXP]);

  const hasPremium = data?.progress?.hasPremium ?? false;
  const daysLeft = data?.season?.endDate ? getDaysLeft(data.season.endDate) : 0;
  const totalClaimed = data?.progress?.claimedTiers?.length ?? 0;
  const totalClaimable = tierGroups.filter(g => currentTier >= g.tier).length * (hasPremium ? 2 : 1);

  // Preview state
  const previewClaimed = useMemo(() => {
    if (!previewReward || !data) return false;
    if (previewReward.isPremium) return data.progress.claimedTiers.includes(previewReward.tier + 1000);
    return data.progress.claimedTiers.includes(previewReward.tier);
  }, [previewReward, data]);
  const previewUnlocked = previewReward ? currentTier >= previewReward.tier : false;

  const purchaseMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/battle-pass/purchase", {}),
    onSuccess: () => {
      soundManager.play("reward");
      toast({ title: "Battle Pass Active!", description: "Premium track unlocked. Claim your rewards!" });
      queryClient.invalidateQueries({ queryKey: ["/api/battle-pass"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      setShowPurchase(false);
    },
    onError: (e: any) => toast({ title: "Purchase failed", description: e.message, variant: "destructive" }),
  });

  const claimMutation = useMutation({
    mutationFn: ({ tier, isPremium }: { tier: number; isPremium: boolean }) =>
      apiRequest("POST", `/api/battle-pass/claim/${tier}`, { isPremium }),
    onSuccess: (_, { tier, isPremium }) => {
      soundManager.play("reward");
      setJustClaimed(prev => [...prev, tier]);
      // GOAT moment
      if (tier === 100 && isPremium) {
        setTimeout(() => setShowGoatOverlay(true), 600);
      } else {
        toast({ title: `Tier ${tier} Claimed!`, description: "Reward added to your account." });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/battle-pass"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      setTimeout(() => setJustClaimed(prev => prev.filter(t => t !== tier)), 2500);
    },
    onError: (e: any) => toast({ title: "Claim failed", description: e.message, variant: "destructive" }),
    onSettled: () => setClaimingTier(null),
  });

  function handleClaim(tierNum: number, isPremium: boolean) {
    setClaimingTier(`${tierNum}-${isPremium ? "premium" : "free"}`);
    claimMutation.mutate({ tier: tierNum, isPremium });
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <AppNavbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center p-8">
            <Crown className="w-12 h-12 mx-auto mb-4 text-white/20" />
            <p className="text-muted-foreground mb-4">Sign in to access Battle Pass</p>
            <Link href="/api/login"><Button>Sign In</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      <PageDepthBackground
        glowZones={[
          { x: "50%", y: "0%",  color: "255,45,138",  size: "70%", opacity: 0.08 },
          { x: "10%", y: "25%", color: "255,122,0",   size: "45%", opacity: 0.05 },
          { x: "90%", y: "35%", color: "168,85,247",  size: "40%", opacity: 0.05 },
          { x: "30%", y: "75%", color: "99,102,241",  size: "35%", opacity: 0.04 },
        ]}
        particleCount={25}
      />
      <AppNavbar />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/6">
        <div className="absolute inset-0 bg-gradient-to-b from-[#FF2D8A]/8 via-[#FF7A00]/3 to-transparent pointer-events-none" />
        <div className="absolute -top-10 left-1/4 w-80 h-48 rounded-full blur-3xl opacity-10 pointer-events-none"
          style={{ background: "radial-gradient(circle, #FF2D8A, transparent)" }} />
        <div className="absolute -top-10 right-1/4 w-80 h-48 rounded-full blur-3xl opacity-8 pointer-events-none"
          style={{ background: "radial-gradient(circle, #a855f7, transparent)" }} />

        <div className="relative max-w-4xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider"
                  style={{ background: "linear-gradient(90deg, #FF2D8A, #FF7A00)", color: "#fff" }}>SEASON 1</div>
                <span className="text-xs text-white/40 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {daysLeft > 0 ? `${daysLeft} days left` : "Season ended"}
                </span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight" data-testid="season-name">
                {data?.season?.name ?? "Season 1: The Grid"}
              </h1>
              <p className="text-sm text-white/35 mt-0.5">100 Tiers · 200 Unique Rewards · Tier 100 GOAT Reward</p>
            </div>

            {hasPremium ? (
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-emerald-500/30 flex-shrink-0"
                style={{ background: "rgba(74,222,128,0.08)" }}>
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <p className="text-sm font-bold text-emerald-300">Battle Pass Active</p>
                  <p className="text-[11px] text-white/35">Premium track unlocked</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <Button onClick={() => setShowPurchase(true)} className="gap-2 font-bold"
                  data-testid="btn-get-premium"
                  style={{ background: "linear-gradient(135deg, #FF2D8A, #FF7A00)", border: "none" }}>
                  <Crown className="w-4 h-4" /> Get Premium — 10 Scalps
                </Button>
                <p className="text-[10px] text-center text-white/25">Includes Tier 100 GOAT reward</p>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-4 gap-2">
            {[
              { label: "Current Tier",    val: String(currentTier), sub: "of 100",          testid: "current-tier" },
              { label: "Season XP",       val: (data?.progress?.currentXp ?? 0).toLocaleString(), sub: "XP earned", testid: "current-xp" },
              { label: "Rewards Claimed", val: String(totalClaimed), sub: `of ${totalClaimable}` },
              { label: "Season Ends",     val: String(daysLeft),    sub: "days left" },
            ].map(s => (
              <div key={s.label} className="rounded-xl px-3 py-2.5 bg-white/5 border border-white/7">
                <p className="text-[10px] text-white/35 truncate">{s.label}</p>
                <p className="text-xl font-black text-white leading-tight" data-testid={s.testid}>{s.val}</p>
                <p className="text-[9px] text-white/25">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* XP bar */}
          <div className="mt-3">
            <div className="flex justify-between mb-1 text-[11px] text-white/40">
              <span>Tier {currentTier} → Tier {Math.min(currentTier + 1, 100)}</span>
              <span>{(data?.progress?.currentXp ?? 0).toLocaleString()} / {nextXP.toLocaleString()} XP</span>
            </div>
            <div className="relative h-2.5 bg-white/8 progress-glow">
              <motion.div className="absolute inset-y-0 left-0 battle-pass-bar-fill"
                initial={{ width: "0%" }} animate={{ width: `${xpPct}%` }}
                transition={{ duration: 1.2, ease: "easeOut" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Non-premium hint banner */}
      {!hasPremium && !isLoading && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <motion.div
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl border"
            style={{
              background: "linear-gradient(135deg, rgba(239,68,68,0.06), rgba(245,158,11,0.04))",
              borderColor: "rgba(239,68,68,0.2)",
            }}
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-2.5">
              <Flame className="w-4 h-4 flex-shrink-0" style={{ color: "#ef4444" }} />
              <p className="text-xs text-white/60">
                <span className="font-semibold text-white/80">Click any reward to preview it.</span>
                {" "}Tier 100 includes the exclusive{" "}
                <span className="font-black goat-text">GOAT</span> reward — only{" "}
                <span className="font-bold" style={{ color: "#FF2D8A" }}>10 Scalps</span>.
              </p>
            </div>
            <Button size="sm" onClick={() => setShowPurchase(true)}
              className="gap-1.5 font-bold flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #ef4444, #f59e0b)", border: "none" }}>
              <Crown className="w-3.5 h-3.5" /> Unlock All
            </Button>
          </motion.div>
        </div>
      )}

      {/* Tier track */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* Column headers */}
        <div className="flex items-center gap-2 px-1.5 mb-2">
          <div className="flex-1 text-center">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Free Track</span>
          </div>
          <div className="w-9 flex-shrink-0" />
          <div className="flex-1 text-center flex items-center justify-center gap-1.5">
            <Crown className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Premium</span>
            {!hasPremium && (
              <Badge className="text-[8px] px-1.5 py-0 h-3.5 ml-1 no-default-active-elevate"
                style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
                LOCKED
              </Badge>
            )}
          </div>
        </div>

        {/* Rows */}
        {isLoading ? (
          <div className="space-y-1">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-white/4 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-0.5">
            {tierGroups.map(group => (
              <AnimatePresence key={group.tier} mode="wait">
                {justClaimed.includes(group.tier) ? (
                  <motion.div key={`flash-${group.tier}`}
                    className="flex items-center justify-center py-3 rounded-xl"
                    style={group.tier === 100
                      ? { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)" }
                      : { background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)" }
                    }
                    initial={{ scale: 1.04 }} animate={{ scale: 1 }} exit={{ opacity: 0 }}>
                    {group.tier === 100
                      ? <><Trophy className="w-4 h-4 mr-2" style={{ color: "#f59e0b" }} /><span className="text-sm font-bold goat-text">GOAT UNLOCKED!</span></>
                      : <><Sparkles className="w-4 h-4 text-emerald-400 mr-2" /><span className="text-sm font-bold text-emerald-300">Tier {group.tier} — UNLOCKED!</span></>
                    }
                  </motion.div>
                ) : (
                  <TierRow
                    key={`tier-${group.tier}`}
                    group={group} currentTier={currentTier}
                    progress={data!.progress}
                    hasPremium={hasPremium}
                    onPreview={setPreviewReward}
                    onClaim={handleClaim}
                    claimingTier={claimingTier}
                  />
                )}
              </AnimatePresence>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-10 flex flex-col items-center gap-3 py-6 border-t border-white/6">
          {!hasPremium && (
            <Button onClick={() => setShowPurchase(true)} size="lg" className="gap-2 font-bold px-8"
              style={{ background: "linear-gradient(135deg, #FF2D8A, #FF7A00)", border: "none" }}>
              <Crown className="w-5 h-5" />
              Get Premium — Only 10 Scalps
            </Button>
          )}
          <Link href="/shop">
            <Button variant="ghost" className="gap-2 text-sm text-white/40">
              <ShoppingBag className="w-4 h-4" />
              Also available in the Item Shop
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
          <p className="text-xs text-white/20 text-center max-w-xs">
            Earn XP via matches and daily challenges. Tier 100 rewards the exclusive GOAT cosmetic — the rarest item in the game.
          </p>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showPurchase && (
          <PurchaseModal
            onConfirm={() => purchaseMutation.mutate()}
            onClose={() => setShowPurchase(false)}
            isPending={purchaseMutation.isPending}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {previewReward && (
          <RewardPreviewModal
            reward={previewReward}
            hasPremium={hasPremium}
            claimed={previewClaimed}
            unlocked={previewUnlocked}
            onClose={() => setPreviewReward(null)}
            onClaim={() => handleClaim(previewReward.tier, previewReward.isPremium)}
            onGetPremium={() => setShowPurchase(true)}
            claiming={claimingTier === `${previewReward.tier}-${previewReward.isPremium ? "premium" : "free"}`}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGoatOverlay && (
          <GoatClaimOverlay onDismiss={() => setShowGoatOverlay(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
