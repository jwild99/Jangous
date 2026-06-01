import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Trophy, TrendingUp } from "lucide-react";

interface RecentWin {
  id: string;
  user_id: string;
  amount: string;
  created_at: string;
  match_id: string | null;
  username: string | null;
  first_name: string | null;
  profile_image_url: string | null;
  game_type: string | null;
}

function winnerName(w: RecentWin): string {
  return w.username ?? w.first_name ?? "Player";
}

function gameLabel(type: string | null): string {
  if (!type) return "a match";
  return type.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function RecentWinsTicker({ className = "" }: { className?: string }) {
  const { data: wins = [] } = useQuery<RecentWin[]>({
    queryKey: ["/api/wins/recent"],
    queryFn: async () => {
      const res = await fetch("/api/wins/recent");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (wins.length < 2) return;
    const t = setInterval(() => setIdx(i => (i + 1) % wins.length), 4000);
    return () => clearInterval(t);
  }, [wins.length]);

  if (!wins.length) return null;

  const current = wins[idx];

  return (
    <div
      className={`flex items-center gap-2 overflow-hidden ${className}`}
      data-testid="recent-wins-ticker"
    >
      <div className="flex items-center gap-1 text-yellow-400 flex-shrink-0">
        <TrendingUp className="w-3 h-3" />
        <span className="text-xs font-semibold uppercase tracking-wide">Live</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap"
          >
            <Trophy className="w-3 h-3 text-yellow-400 flex-shrink-0" />
            <span className="font-medium text-foreground truncate max-w-[100px]">
              {winnerName(current)}
            </span>
            <span>won</span>
            <span className="font-semibold text-green-400">
              +{parseFloat(current.amount).toFixed(2)}
            </span>
            <span className="hidden sm:inline">in {gameLabel(current.game_type)}</span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Full widget for home page sidebar ────────────────────────────────────────
export function RecentWinsWidget({ className = "" }: { className?: string }) {
  const { data: wins = [] } = useQuery<RecentWin[]>({
    queryKey: ["/api/wins/recent"],
    queryFn: async () => {
      const res = await fetch("/api/wins/recent");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 20_000,
  });

  return (
    <div className={`space-y-1 ${className}`} data-testid="recent-wins-widget">
      {wins.slice(0, 8).map(w => (
        <div key={w.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover-elevate">
          <Trophy className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium truncate block">{winnerName(w)}</span>
            <span className="text-xs text-muted-foreground">{gameLabel(w.game_type)}</span>
          </div>
          <span className="text-sm font-bold text-green-400 flex-shrink-0">
            +{parseFloat(w.amount).toFixed(2)}
          </span>
        </div>
      ))}
      {!wins.length && (
        <p className="text-xs text-muted-foreground px-2 py-4 text-center">No recent wins yet.</p>
      )}
    </div>
  );
}
