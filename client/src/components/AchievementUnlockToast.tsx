import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Star, Zap, Crown, Shield, Target, Award, Flame, Swords } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Crown, Star, Zap, Trophy, Shield, Target, Award, Flame, Swords,
};

interface AchievementPopup {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  rarity?: string;
}

const RARITY_COLORS: Record<string, string> = {
  common: "#6366f1",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

export function AchievementUnlockToast() {
  const { user } = useAuth();
  const [queue, setQueue] = useState<AchievementPopup[]>([]);
  const seenIds = useRef<Set<string>>(new Set());

  const { data: notifications } = useQuery<any[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 15000,
    enabled: !!user,
  });

  useEffect(() => {
    if (!notifications) return;
    const newAchievements: AchievementPopup[] = [];
    for (const n of notifications) {
      if (n.type === "achievement" && !n.read && !seenIds.current.has(n.id)) {
        seenIds.current.add(n.id);
        newAchievements.push({
          id: n.id,
          title: n.meta?.achievementId ? n.body : n.title,
          description: n.meta?.description || n.body,
          icon: n.meta?.icon,
          rarity: n.meta?.rarity,
        });
      }
    }
    if (newAchievements.length > 0) {
      setQueue(prev => [...prev, ...newAchievements]);
    }
  }, [notifications]);

  const dismiss = (id: string) => {
    setQueue(prev => prev.filter(p => p.id !== id));
    fetch(`/api/notifications/read/${id}`, { method: "POST" }).catch(() => {});
  };

  if (!user || queue.length === 0) return null;

  const current = queue[0];
  const Icon = (current.icon && ICON_MAP[current.icon]) || Trophy;
  const color = RARITY_COLORS[current.rarity || "common"] || RARITY_COLORS.common;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={current.id}
        initial={{ opacity: 0, y: 80, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 80, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        onAnimationComplete={() => {
          setTimeout(() => dismiss(current.id), 4000);
        }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] pointer-events-auto"
        data-testid="achievement-unlock-toast"
      >
        <div
          className="flex items-center gap-4 px-5 py-4 rounded-2xl shadow-2xl border backdrop-blur-xl cursor-pointer"
          style={{
            background: `linear-gradient(135deg, rgba(10,14,26,0.95) 0%, rgba(20,30,56,0.95) 100%)`,
            borderColor: color + "40",
            boxShadow: `0 0 40px ${color}30, 0 8px 32px rgba(0,0,0,0.5)`,
          }}
          onClick={() => dismiss(current.id)}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: color + "20", boxShadow: `0 0 16px ${color}40` }}
          >
            <Icon className="w-6 h-6" style={{ color }} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color }}>
              Achievement Unlocked
            </p>
            <p className="text-white font-bold text-sm leading-tight">{current.title}</p>
            {current.description && (
              <p className="text-white/50 text-xs mt-0.5 leading-snug max-w-[220px] truncate">
                {current.description}
              </p>
            )}
          </div>
          {current.rarity && (
            <span
              className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 self-start"
              style={{ background: color + "20", color, border: `1px solid ${color}40` }}
            >
              {current.rarity}
            </span>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
