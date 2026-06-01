import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Flame, X, ChevronRight, Trophy } from "lucide-react";

type Tournament = { id: string; name: string; status: string; gameType?: string; prizePool?: string };

export function LiveTournamentBanner() {
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try { return localStorage.getItem("jango_dismissed_banner"); } catch { return null; }
  });

  const { data: tournaments = [] } = useQuery<Tournament[]>({
    queryKey: ["/api/tournaments"],
    refetchInterval: 30_000,
  });

  const liveTournament = tournaments.find(t => t.status === "live" || t.status === "in_progress");

  useEffect(() => {
    if (liveTournament && dismissed && dismissed !== liveTournament.id) {
      setDismissed(null);
    }
  }, [liveTournament?.id]);

  const handleDismiss = () => {
    if (!liveTournament) return;
    try { localStorage.setItem("jango_dismissed_banner", liveTournament.id); } catch {}
    setDismissed(liveTournament.id);
  };

  const visible = !!(liveTournament && dismissed !== liveTournament.id);

  return (
    <AnimatePresence>
      {visible && liveTournament && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="overflow-hidden relative z-40"
          data-testid="live-tournament-banner"
        >
          <Link href="/tournaments">
            <div
              className="relative flex items-center justify-between px-4 py-2 cursor-pointer group"
              style={{
                background: "linear-gradient(90deg, rgba(239,68,68,0.18) 0%, rgba(245,158,11,0.12) 50%, rgba(239,68,68,0.10) 100%)",
                borderBottom: "1px solid rgba(239,68,68,0.25)",
              }}
            >
              {/* Animated scan line */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                style={{ background: "linear-gradient(90deg, transparent, rgba(239,68,68,0.08), transparent)", width: "40%" }}
              />

              <div className="flex items-center gap-2.5">
                {/* Pulse dot */}
                <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
                  <div className="absolute w-5 h-5 rounded-full bg-red-500/30 animate-ping" />
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                </div>

                <div className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span className="text-xs font-black text-red-400 tracking-wider">LIVE NOW</span>
                  <span className="text-white/20 text-xs">—</span>
                  <span className="text-xs font-semibold text-white/90 truncate max-w-[160px] sm:max-w-none">
                    {liveTournament.name}
                  </span>
                  {liveTournament.prizePool && parseFloat(liveTournament.prizePool) > 0 && (
                    <span className="hidden sm:inline text-[10px] text-amber-400 font-bold bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded-full">
                      {parseFloat(liveTournament.prizePool).toFixed(0)} S Prize
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="hidden sm:flex items-center gap-1 text-[10px] text-white/50 group-hover:text-white/80 transition-colors">
                  Watch live <ChevronRight className="w-3 h-3" />
                </span>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDismiss(); }}
                  className="p-0.5 rounded text-white/30 hover:text-white/70 transition-colors"
                  data-testid="button-dismiss-live-banner"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
