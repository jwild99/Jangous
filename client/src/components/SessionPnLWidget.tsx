import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Activity, Flame, Target } from "lucide-react";
import { ScalpsIcon } from "@/components/ScalpsIcon";

const SESSION_KEY = "jango_session_start_balance";
const SESSION_TIME_KEY = "jango_session_start_time";

function getSessionStart(currentBalance: number): number {
  const stored = localStorage.getItem(SESSION_KEY);
  const storedTime = localStorage.getItem(SESSION_TIME_KEY);
  const now = Date.now();
  // Session resets after 6 hours of inactivity
  if (stored && storedTime && now - parseInt(storedTime) < 6 * 60 * 60 * 1000) {
    return parseFloat(stored);
  }
  // New session
  localStorage.setItem(SESSION_KEY, String(currentBalance));
  localStorage.setItem(SESSION_TIME_KEY, String(now));
  return currentBalance;
}

interface Transaction {
  id: number;
  type: string;
  amount: string;
  createdAt: string;
}

interface SessionPnLWidgetProps {
  currentBalance: number;
}

function PnLStat({
  label,
  value,
  icon: Icon,
  delay,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  delay: number;
}) {
  const isPos = value > 0;
  const isNeg = value < 0;
  const color = isPos ? "#22c55e" : isNeg ? "#f87171" : "rgba(255,255,255,0.4)";
  const bg = isPos ? "rgba(34,197,94,0.08)" : isNeg ? "rgba(248,113,113,0.08)" : "rgba(255,255,255,0.04)";
  const border = isPos ? "rgba(34,197,94,0.2)" : isNeg ? "rgba(248,113,113,0.2)" : "rgba(255,255,255,0.08)";

  return (
    <motion.div
      className="flex-1 rounded-xl p-3 flex flex-col gap-1.5 min-w-0"
      style={{ background: bg, border: `1px solid ${border}` }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="w-3 h-3" style={{ color }} />
        <span className="text-[10px] text-white/40 font-medium uppercase tracking-wide truncate">{label}</span>
      </div>
      <div className="flex items-center gap-1">
        {isPos ? (
          <TrendingUp className="w-3 h-3 shrink-0" style={{ color }} />
        ) : isNeg ? (
          <TrendingDown className="w-3 h-3 shrink-0" style={{ color }} />
        ) : (
          <Minus className="w-3 h-3 shrink-0" style={{ color }} />
        )}
        <span className="text-sm font-black" style={{ color }}>
          {isPos ? "+" : ""}{value.toFixed(2)}
        </span>
        <ScalpsIcon size="xs" />
      </div>
    </motion.div>
  );
}

export function SessionPnLWidget({ currentBalance }: SessionPnLWidgetProps) {
  const sessionStartRef = useRef<number | null>(null);

  // Init session start on first render with actual balance
  if (sessionStartRef.current === null && currentBalance > 0) {
    sessionStartRef.current = getSessionStart(currentBalance);
  }

  const sessionStart = sessionStartRef.current ?? currentBalance;

  const { data: txns = [] } = useQuery<Transaction[]>({
    queryKey: ["/api/wallet/transactions"],
    staleTime: 30_000,
  });

  const { todayPnL, weeklyPnL, bestWin } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;

    let todayPnL = 0;
    let weeklyPnL = 0;
    let bestWin = 0;

    for (const t of txns) {
      const ts = new Date(t.createdAt).getTime();
      const amt = parseFloat(t.amount || "0");
      const isWin = t.type === "win";
      const isLoss = t.type === "loss";
      if (!isWin && !isLoss) continue;
      const net = isWin ? amt : -amt;
      if (ts >= todayStart) todayPnL += net;
      if (ts >= weekStart) weeklyPnL += net;
      if (isWin && amt > bestWin) bestWin = amt;
    }

    return { todayPnL, weeklyPnL, bestWin };
  }, [txns]);

  const sessionPnL = currentBalance - sessionStart;

  // All zero? Don't clutter the UI
  if (Math.abs(sessionPnL) < 0.01 && Math.abs(todayPnL) < 0.01 && Math.abs(weeklyPnL) < 0.01) {
    return null;
  }

  return (
    <motion.div
      className="rounded-2xl p-4"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-3.5 h-3.5 text-primary/60" />
        <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">Session Performance</span>
      </div>
      <div className="flex gap-2 flex-wrap">
        <PnLStat label="Session" value={sessionPnL} icon={Activity} delay={0.05} />
        <PnLStat label="Today" value={todayPnL} icon={Target} delay={0.1} />
        <PnLStat label="This Week" value={weeklyPnL} icon={Flame} delay={0.15} />
        {bestWin > 0 && (
          <motion.div
            className="flex-1 rounded-xl p-3 flex flex-col gap-1.5 min-w-0"
            style={{ background: "rgba(250,204,21,0.07)", border: "1px solid rgba(250,204,21,0.18)" }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-1.5">
              <Flame className="w-3 h-3 text-yellow-400" />
              <span className="text-[10px] text-white/40 font-medium uppercase tracking-wide">Best Win</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-yellow-400 shrink-0" />
              <span className="text-sm font-black text-yellow-400">+{bestWin.toFixed(2)}</span>
              <ScalpsIcon size="xs" />
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
