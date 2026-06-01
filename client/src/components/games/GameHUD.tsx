import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Zap, Flame, Star, TrendingUp, Trophy,
  Coins, Swords, Target, Award, Crown, ChevronRight
} from "lucide-react";
import type { MatchWithPlayers } from "@shared/schema";
import { getXPForNextLevel, getXPProgress } from "@shared/achievementDefinitions";
import { onXPGained } from "@/lib/xpEvents";

// ─── Event feed types ────────────────────────────────────────────────────────

export type FeedEventKind =
  | "xp"
  | "goal"
  | "combo"
  | "perfect"
  | "streak"
  | "matchpoint"
  | "cosmetic"
  | "generic";

export interface FeedEvent {
  id: string;
  kind: FeedEventKind;
  label: string;
  sub?: string;
}

let feedListeners: Array<(e: FeedEvent) => void> = [];

export function emitFeedEvent(event: Omit<FeedEvent, "id">) {
  const e: FeedEvent = { ...event, id: `${Date.now()}-${Math.random()}` };
  feedListeners.forEach((fn) => fn(e));
}

export function useFeedEventEmitter() {
  return emitFeedEvent;
}

// ─── EventFeed component ─────────────────────────────────────────────────────

const KIND_STYLES: Record<FeedEventKind, { color: string; icon: React.ReactNode }> = {
  xp:         { color: "text-yellow-400", icon: <TrendingUp className="w-3 h-3" /> },
  goal:       { color: "text-cyan-400",   icon: <Target className="w-3 h-3" /> },
  combo:      { color: "text-orange-400", icon: <Zap className="w-3 h-3" /> },
  perfect:    { color: "text-emerald-400",icon: <Star className="w-3 h-3" /> },
  streak:     { color: "text-red-400",    icon: <Flame className="w-3 h-3" /> },
  matchpoint: { color: "text-violet-400", icon: <Swords className="w-3 h-3" /> },
  cosmetic:   { color: "text-pink-400",   icon: <Award className="w-3 h-3" /> },
  generic:    { color: "text-foreground", icon: <Crown className="w-3 h-3" /> },
};

export function EventFeed({ maxItems = 4 }: { maxItems?: number }) {
  const [items, setItems] = useState<FeedEvent[]>([]);

  useEffect(() => {
    const handler = (e: FeedEvent) => {
      setItems((prev) => [e, ...prev].slice(0, maxItems));
      setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== e.id));
      }, 3200);
    };
    feedListeners.push(handler);
    return () => { feedListeners = feedListeners.filter((f) => f !== handler); };
  }, [maxItems]);

  return (
    <div className="flex flex-col gap-1 pointer-events-none select-none min-w-[130px]">
      <AnimatePresence mode="popLayout">
        {items.map((item) => {
          const style = KIND_STYLES[item.kind];
          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, x: 24, scale: 0.85 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 32, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
              style={{
                background: "rgba(0,0,0,0.65)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span className={style.color}>{style.icon}</span>
              <span className={style.color}>{item.label}</span>
              {item.sub && <span className="text-muted-foreground font-normal">{item.sub}</span>}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ─── Mini XP bar for in-game HUD ─────────────────────────────────────────────

interface MiniXpBarProps {
  level: number;
  xp: number;
  side?: "left" | "right";
}

export function MiniXpBar({ level, xp, side = "left" }: MiniXpBarProps) {
  const progress = getXPProgress(xp, level);
  const nextLevel = getXPForNextLevel(level);
  const [glow, setGlow] = useState(false);
  const [popup, setPopup] = useState<number | null>(null);

  useEffect(() => {
    return onXPGained(({ xp: gained }) => {
      setGlow(true);
      setPopup(gained);
      emitFeedEvent({ kind: "xp", label: `+${gained} XP` });
      setTimeout(() => { setGlow(false); setPopup(null); }, 2200);
    });
  }, []);

  return (
    <div className="flex flex-col gap-0.5 w-full relative">
      <div className={`flex items-center justify-between gap-1 ${side === "right" ? "flex-row-reverse" : ""}`}>
        <span className="text-[9px] font-bold text-violet-400 uppercase tracking-widest leading-none">LVL {level}</span>
        <span className="text-[9px] text-muted-foreground/60 leading-none">{xp}/{nextLevel}</span>
      </div>
      <div
        className="relative h-1 progress-glow w-full"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <motion.div
          className="absolute inset-y-0 left-0"
          style={{
            background: glow
              ? "linear-gradient(90deg,#facc15,#fb923c)"
              : "linear-gradient(90deg,#a78bfa,#60a5fa)",
            borderRadius: "9999px",
            boxShadow: glow ? "0 0 8px #facc15, 0 0 14px #facc1566" : "0 0 6px rgba(167,139,250,0.5)",
          }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <AnimatePresence>
        {popup !== null && (
          <motion.div
            key="xp-popup"
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -18 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            className="absolute -top-5 right-0 text-[10px] font-black text-yellow-400 pointer-events-none"
            style={{ textShadow: "0 0 8px rgba(250,204,21,0.9)" }}
          >
            +{popup} XP
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── StreakBadge ──────────────────────────────────────────────────────────────

interface StreakBadgeProps {
  streak: number;
}

export function StreakBadge({ streak }: StreakBadgeProps) {
  if (streak < 2) return null;
  const heat = streak >= 7 ? "text-red-400" : streak >= 4 ? "text-orange-400" : "text-yellow-400";
  return (
    <motion.div
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
      className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${heat}`}
      style={{
        background: "rgba(0,0,0,0.5)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <Flame className="w-2.5 h-2.5" />
      {streak}
    </motion.div>
  );
}

// ─── CurrencyBadge ───────────────────────────────────────────────────────────

interface CurrencyBadgeProps {
  balance: number;
}

export function CurrencyBadge({ balance }: CurrencyBadgeProps) {
  return (
    <div
      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-amber-400"
      style={{
        background: "rgba(0,0,0,0.5)",
        border: "1px solid rgba(251,191,36,0.2)",
        backdropFilter: "blur(6px)",
      }}
    >
      <Coins className="w-3 h-3" />
      {balance.toLocaleString()}
    </div>
  );
}

// ─── ActiveTurnDot ────────────────────────────────────────────────────────────

function ActiveTurnDot({ color }: { color: string }) {
  return (
    <motion.div
      animate={{ scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }}
      transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
      className="w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: color, boxShadow: `0 0 6px ${color}` }}
    />
  );
}

// ─── PlayerCard (premium redesign) ───────────────────────────────────────────

interface PlayerCardProps {
  name: string;
  imageUrl?: string | null;
  level: number;
  xp: number;
  streak: number;
  side: "left" | "right";
  score?: number;
  isMe?: boolean;
  isActive?: boolean;
  subLabel?: string;
  accentColor?: string;   // hex or rgba
  glowColor?: string;     // rgba for shadow
}

export function PlayerChip(props: PlayerCardProps) {
  return <PlayerCard {...props} />;
}

export function PlayerCard({
  name,
  imageUrl,
  level,
  xp,
  streak,
  side,
  score,
  isMe,
  isActive,
  subLabel,
  accentColor,
  glowColor,
}: PlayerCardProps) {
  const initials = name?.slice(0, 2).toUpperCase() || "??";
  const isLeft = side === "left";

  const accent = accentColor ?? (isLeft ? "#ff2d8a" : "#3399ff");
  const glow   = glowColor   ?? (isLeft ? "rgba(255,45,138,0.25)" : "rgba(51,153,255,0.25)");

  return (
    <motion.div
      layout
      animate={isActive ? { boxShadow: [`0 0 0px ${glow}`, `0 0 18px ${glow}`, `0 0 0px ${glow}`] } : {}}
      transition={isActive ? { repeat: Infinity, duration: 2, ease: "easeInOut" } : {}}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl min-w-0 ${isLeft ? "flex-row" : "flex-row-reverse"}`}
      style={{
        background: isActive
          ? `linear-gradient(${isLeft ? "135deg" : "225deg"}, rgba(0,0,0,0.75) 0%, ${accent}18 100%)`
          : "rgba(0,0,0,0.45)",
        border: `1px solid ${isActive ? `${accent}55` : "rgba(255,255,255,0.07)"}`,
        backdropFilter: "blur(10px)",
        transition: "border-color 0.35s, background 0.35s",
      }}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div
          className="rounded-full p-[2px]"
          style={{
            background: isActive
              ? `linear-gradient(135deg, ${accent}, ${accent}44)`
              : "rgba(255,255,255,0.08)",
            boxShadow: isActive ? `0 0 12px ${glow}` : "none",
            transition: "box-shadow 0.35s",
          }}
        >
          <Avatar className="w-9 h-9 block">
            {imageUrl && <AvatarImage src={imageUrl} />}
            <AvatarFallback
              className="text-[11px] font-black"
              style={{
                background: `linear-gradient(135deg, ${accent}33 0%, rgba(0,0,0,0.6) 100%)`,
                color: accent,
              }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
        {isMe && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-1 ring-background"
            style={{ background: "#22c55e" }}
          />
        )}
      </div>

      {/* Name + info block */}
      <div className={`flex flex-col min-w-0 gap-0.5 ${isLeft ? "" : "items-end"}`}>
        {/* Row: name + streak + active dot */}
        <div className={`flex items-center gap-1.5 ${isLeft ? "" : "flex-row-reverse"}`}>
          {isActive && <ActiveTurnDot color={accent} />}
          <span
            className="text-xs font-black leading-none truncate max-w-[72px] tracking-tight"
            style={{ color: isActive ? "#ffffff" : "rgba(255,255,255,0.75)" }}
          >
            {name}
          </span>
          {streak >= 2 && <StreakBadge streak={streak} />}
        </div>

        {/* Sublabel */}
        {subLabel && (
          <span
            className="text-[9px] font-semibold leading-none tracking-wide"
            style={{ color: isActive ? accent : "rgba(255,255,255,0.35)" }}
          >
            {subLabel}
          </span>
        )}

        {/* XP bar */}
        <div className="w-[72px]">
          <MiniXpBar level={level} xp={xp} side={side} />
        </div>
      </div>

      {/* Score */}
      {score !== undefined && (
        <motion.div
          key={score}
          initial={{ scale: 1.5, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className="text-2xl font-black font-mono tabular-nums leading-none flex-shrink-0 min-w-[28px] text-center"
          style={{
            color: isActive ? "#ffffff" : "rgba(255,255,255,0.5)",
            textShadow: isActive ? `0 0 16px ${accent}` : "none",
            transition: "color 0.3s, text-shadow 0.3s",
          }}
        >
          {score}
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── GameHUD — main component ─────────────────────────────────────────────────

interface GameHUDProps {
  match: MatchWithPlayers;
  currentUserId?: string;
  leftScore?: number;
  rightScore?: number;
  leftLabel?: string;
  rightLabel?: string;
  centerContent?: React.ReactNode;
  extraBadges?: React.ReactNode;
  activePlayer?: "left" | "right" | null;
}

interface UserInfo {
  id: string;
  name: string;
  imageUrl?: string | null;
  level: number;
  xp: number;
  streak: number;
}

function usePlayerInfo(userId?: string): UserInfo | null {
  const { data } = useQuery<any>({
    queryKey: ["/api/auth/user"],
    enabled: !!userId,
  });
  if (!data) return null;
  return {
    id: data.id || userId || "",
    name: data.username || data.name || "Player",
    imageUrl: data.profileImageUrl,
    level: data.level || 1,
    xp: data.xp || 0,
    streak: data.loginStreak || 0,
  };
}

export function GameHUD({
  match,
  currentUserId,
  leftScore,
  rightScore,
  leftLabel,
  rightLabel,
  centerContent,
  extraBadges,
  activePlayer,
}: GameHUDProps) {
  const { data: balanceData } = useQuery<{ balance: string }>({
    queryKey: ["/api/wallet/balance"],
  });
  const myInfo = usePlayerInfo(currentUserId);
  const balance = parseFloat(balanceData?.balance || "0");

  const p1 = match.player1;
  const p2 = match.player2;
  const isP1 = currentUserId === p1?.id;

  const mePlayer   = isP1 ? p1 : p2;
  const themPlayer = isP1 ? p2 : p1;

  const meLabel   = mePlayer?.username   || mePlayer?.firstName   || "You";
  const themLabel = themPlayer?.username || themPlayer?.firstName || (match.isBotMatch ? "Bot" : "Opponent");

  const meScore   = isP1 ? leftScore   : rightScore;
  const themScore = isP1 ? rightScore  : leftScore;

  const meActive   = activePlayer === "left";
  const themActive = activePlayer === "right";

  const betAmt = parseFloat((match as any).betAmount || "0");
  const gameMode = match.isPractice ? "Practice" : match.isBotMatch ? "vs Bot" : "Ranked";

  return (
    <div
      className="w-full rounded-xl mb-2"
      style={{
        background: "linear-gradient(160deg, rgba(8,8,24,0.92) 0%, rgba(16,8,36,0.92) 100%)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 4px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {/* Thin accent top bar */}
      <div
        className="h-px w-full rounded-t-xl"
        style={{
          background: "linear-gradient(90deg, rgba(255,45,138,0.6) 0%, rgba(139,92,246,0.4) 50%, rgba(51,153,255,0.6) 100%)",
        }}
      />

      <div className="flex items-center gap-2 px-2 py-2">

        {/* ── Left player card ───────────────────────────────────── */}
        <PlayerCard
          name={meLabel}
          imageUrl={mePlayer?.profileImageUrl}
          level={myInfo?.level ?? 1}
          xp={myInfo?.xp ?? 0}
          streak={myInfo?.streak ?? 0}
          side="left"
          score={meScore}
          isMe
          isActive={meActive}
          subLabel={leftLabel}
          accentColor="#ff2d8a"
          glowColor="rgba(255,45,138,0.28)"
        />

        {/* ── Center ────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-1 flex-1 min-w-[60px] px-1">
          {centerContent ?? (
            <div className="flex flex-col items-center gap-0.5">
              {/* Game type */}
              <span
                className="text-[9px] font-black uppercase tracking-[0.2em] leading-none"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                {match.gameType?.replace(/-/g, " ")}
              </span>

              {/* Pot / mode badge */}
              {betAmt > 0 ? (
                <div
                  className="flex items-center gap-1 rounded-full px-2 py-0.5 mt-0.5"
                  style={{
                    background: "rgba(251,191,36,0.1)",
                    border: "1px solid rgba(251,191,36,0.25)",
                  }}
                >
                  <Coins className="w-2.5 h-2.5 text-amber-400" />
                  <span className="text-[9px] font-black text-amber-400 tabular-nums">
                    {(betAmt * 2).toLocaleString()} pot
                  </span>
                </div>
              ) : (
                <span
                  className="text-[9px] font-bold uppercase tracking-widest leading-none mt-0.5"
                  style={{ color: "rgba(139,92,246,0.7)" }}
                >
                  {gameMode}
                </span>
              )}
            </div>
          )}

          {/* Currency + extra badges */}
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            <CurrencyBadge balance={balance} />
            {extraBadges}
          </div>
        </div>

        {/* ── Right player card ──────────────────────────────────── */}
        <PlayerCard
          name={themLabel}
          imageUrl={themPlayer?.profileImageUrl}
          level={1}
          xp={0}
          streak={0}
          side="right"
          score={themScore}
          isActive={themActive}
          subLabel={rightLabel}
          accentColor="#3399ff"
          glowColor="rgba(51,153,255,0.28)"
        />

      </div>
    </div>
  );
}
