import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { AppNavbar } from "@/components/AppNavbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScalpsIcon } from "@/components/ScalpsIcon";
import { AnimatedBalance } from "@/components/AnimatedBalance";
import { WithdrawModal } from "@/components/WithdrawModal";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowDownLeft, ArrowUpRight, Plus, CreditCard, TrendingUp, TrendingDown,
  Wallet, Clock, CheckCircle2, DollarSign, History, Shield,
  BadgePercent, Zap, ChevronRight, RefreshCw, Swords, Eye, Download,
} from "lucide-react";
import type { Transaction } from "@shared/schema";
import { PageDepthBackground } from "@/components/PageDepthBackground";

const TX_META: Record<string, { label: string; color: string; sign: "+" | "-" | ""; icon: typeof Plus }> = {
  deposit:      { label: "Deposit",       color: "text-green-400",           sign: "+", icon: ArrowDownLeft  },
  withdrawal:   { label: "Withdrawal",    color: "text-red-400",             sign: "-", icon: ArrowUpRight   },
  bet_placed:   { label: "Wager",         color: "text-orange-400",          sign: "-", icon: ArrowUpRight   },
  bet_won:      { label: "Win",           color: "text-green-400",           sign: "+", icon: TrendingUp     },
  bet_lost:     { label: "Loss",          color: "text-red-400/70",          sign: "-", icon: TrendingDown   },
  rake:         { label: "Platform Fee",  color: "text-white/30",            sign: "-", icon: BadgePercent   },
  forfeit_gain: { label: "Forfeit Win",   color: "text-green-400",           sign: "+", icon: CheckCircle2   },
};

const FILTERS = ["All", "Deposits", "Winnings", "Wagers", "Withdrawals"] as const;
type Filter = typeof FILTERS[number];

function filterTx(txs: Transaction[], f: Filter): Transaction[] {
  if (f === "All") return txs;
  if (f === "Deposits")    return txs.filter(t => t.type === "deposit");
  if (f === "Winnings")    return txs.filter(t => ["bet_won", "forfeit_gain"].includes(t.type));
  if (f === "Wagers")      return txs.filter(t => ["bet_placed", "rake"].includes(t.type));
  if (f === "Withdrawals") return txs.filter(t => t.type === "withdrawal");
  return txs;
}

function BalanceCard({
  label, value, sub, icon: Icon, accent, data_testid,
}: {
  label: string; value: string; sub?: string; icon: typeof Plus; accent: string; data_testid?: string;
}) {
  return (
    <div className="card-depth p-4 magnetic-shimmer" data-testid={data_testid}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-xs text-white/40 font-medium">{label}</p>
        <div className={`rounded-lg p-1.5 bg-white/5 icon-bounce-on-click ${accent}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className={`text-2xl font-black font-mono stat-pop ${accent}`}>{value}</p>
      {sub && <p className="text-[10px] text-white/25 mt-1">{sub}</p>}
    </div>
  );
}

function TxRow({ tx }: { tx: Transaction }) {
  const meta = TX_META[tx.type] ?? { label: tx.type, color: "text-white/50", sign: "" as const, icon: Clock };
  const IconComp = meta.icon;
  const amount = Math.abs(parseFloat(tx.amount as string));
  const isPos = meta.sign === "+";
  const dt = tx.createdAt ? new Date(tx.createdAt) : null;
  const date = dt ? dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
  const time = dt ? dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "";

  const rowAccent = tx.type === "deposit" || tx.type === "bet_won" || tx.type === "forfeit_gain"
    ? "row-win"
    : tx.type === "bet_lost"
    ? "row-loss"
    : tx.type === "deposit"
    ? "row-deposit"
    : "";

  return (
    <div className={`flex items-center gap-3 py-3 border-b border-white/5 last:border-0 rounded-lg px-2 ${rowAccent}`} data-testid={`tx-row-${tx.id}`}>
      <div className={`rounded-full p-2 bg-white/5 shrink-0 ${meta.color}`}>
        <IconComp className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/85">{meta.label}</p>
        {tx.description && (
          <p className="text-[11px] text-white/30 truncate">{tx.description}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-bold font-mono ${isPos ? "text-green-400" : "text-red-400"}`}>
          {meta.sign}{amount.toFixed(2)}<span className="text-xs font-normal ml-0.5 opacity-60">S</span>
        </p>
        <p className="text-[10px] text-white/25">{date} · {time}</p>
      </div>
    </div>
  );
}

function EmptyTx({ filter }: { filter: Filter }) {
  return (
    <div className="py-14 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/4 border border-white/8 mb-4">
        <Wallet className="w-7 h-7 text-white/20" />
      </div>
      <p className="text-white/40 font-semibold mb-1">No transactions yet</p>
      <p className="text-white/25 text-xs">
        {filter !== "All" ? "Try a different filter" : "Make your first deposit to get started"}
      </p>
      {filter === "All" && (
        <Link href="/deposit">
          <Button size="sm" className="mt-4 gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Funds
          </Button>
        </Link>
      )}
    </div>
  );
}

function exportCsv(transactions: Transaction[], filter: Filter) {
  const meta = TX_META;
  const rows = [
    ["Date", "Type", "Amount (S)", "Description"],
    ...transactions.map(tx => {
      const label = meta[tx.type]?.label ?? tx.type;
      const sign = meta[tx.type]?.sign ?? "";
      const amount = `${sign}${Math.abs(parseFloat(tx.amount as string)).toFixed(2)}`;
      const date = tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "";
      const desc = (tx.description ?? "").replace(/,/g, ";");
      return [date, label, amount, desc];
    }),
  ];
  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `jango-transactions-${filter.toLowerCase()}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function WalletPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("All");
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const { data: transactions = [], isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/wallet/transactions"],
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalDeposited: number; totalWon: number; totalWagered: number;
    totalWithdrawn: number; netPL: number; totalTransactions: number;
  }>({
    queryKey: ["/api/wallet/stats"],
    enabled: !!user,
  });

  const { data: activeBets = [], isLoading: betsLoading } = useQuery<Array<{
    id: string; matchId: string | null; amount: string; type: string;
    createdAt: string | null; description: string | null;
    match?: { id: string; gameType: string; status: string; player1Score?: number | null; player2Score?: number | null; potAmount?: string | null };
  }>>({
    queryKey: ["/api/wallet/bets"],
    enabled: !!user,
    refetchInterval: 15_000,
  });

  const filtered = filterTx(transactions, filter);
  const bal = parseFloat(user?.balance ?? "0");
  const netPL = stats?.netPL ?? 0;
  const totalWon = stats?.totalWon ?? 0;
  const totalDeposited = stats?.totalDeposited ?? 0;

  // Compute streak — consecutive wins in recent history
  const winStreak = (() => {
    let streak = 0;
    for (const tx of transactions) {
      if (tx.type === "bet_won" || tx.type === "forfeit_gain") streak++;
      else if (tx.type === "bet_lost" || tx.type === "bet_placed") break;
    }
    return streak;
  })();

  return (
    <div className="min-h-screen relative" style={{ background: "linear-gradient(160deg, #010208 0%, #080d1c 40%, #0d1225 100%)" }}>
      <PageDepthBackground
        glowZones={[
          { x: "60%", y: "10%", color: "99,102,241",  size: "50%", opacity: 0.07 },
          { x: "10%", y: "50%", color: "255,45,138",  size: "40%", opacity: 0.05 },
          { x: "80%", y: "70%", color: "34,211,238",  size: "35%", opacity: 0.04 },
        ]}
        particleCount={18}
      />

      <AppNavbar />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* ── Hero Balance Card ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="card-depth-neon relative depth-glow-primary overflow-hidden"
            style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(255,45,138,0.06) 100%)", borderRadius: "1rem" }}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-xs text-white/35 uppercase tracking-widest mb-0.5">Total Balance</p>
                  <div className="flex items-baseline gap-2">
                    <AnimatedBalance value={bal} className="text-5xl font-black text-white font-mono" showGlow useScalps={false} />
                    <span className="text-lg text-white/40 font-semibold">Scalps</span>
                  </div>
                  <p className="text-xs text-white/25 mt-1">= ${bal.toFixed(2)} USD · All funds immediately available</p>
                </div>
                <div className="text-right">
                  {winStreak > 1 && (
                    <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/25 gap-1 mb-2">
                      <Zap className="w-3 h-3" />{winStreak} Win Streak
                    </Badge>
                  )}
                  <div className="flex items-center gap-1 justify-end">
                    <div className={`w-1.5 h-1.5 rounded-full ${bal > 0 ? "bg-green-400 animate-pulse" : "bg-white/20"}`} />
                    <span className="text-[10px] text-white/30">{bal > 0 ? "Funds available" : "No balance"}</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                <Link href="/deposit">
                  <Button className="gap-2 bg-primary hover:bg-primary/90" data-testid="button-deposit">
                    <Plus className="w-4 h-4" /> Add Funds
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="gap-2 border-white/20 text-white/80 bg-white/5"
                  onClick={() => setWithdrawOpen(true)}
                  disabled={bal < 5}
                  data-testid="button-withdraw"
                >
                  <ArrowUpRight className="w-4 h-4" /> Withdraw
                </Button>
                <Link href="/payment-methods">
                  <Button variant="outline" className="gap-2 border-white/15 text-white/50 bg-white/3"
                    data-testid="button-payment-methods">
                    <CreditCard className="w-4 h-4" /> Methods
                  </Button>
                </Link>
              </div>
            </div>

            {/* Balance breakdown strip */}
            <div className="border-t border-white/8 grid grid-cols-3 divide-x divide-white/8">
              {[
                { label: "Deposited", val: totalDeposited, color: "text-blue-400" },
                { label: "Won",       val: totalWon,       color: "text-green-400" },
                { label: "Withdrawn", val: stats?.totalWithdrawn ?? 0, color: "text-red-400/80" },
              ].map(({ label, val, color }) => (
                <div key={label} className="py-3 px-4 text-center">
                  <p className={`text-base font-bold font-mono ${color}`}>{val.toFixed(2)}</p>
                  <p className="text-[10px] text-white/30">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Stats Cards ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-white/35 uppercase tracking-widest">Performance</h2>
            <button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/wallet/stats"] });
                queryClient.invalidateQueries({ queryKey: ["/api/wallet/transactions"] });
              }}
              className="text-white/25 hover:text-white/50 transition-colors"
              aria-label="Refresh wallet stats and transactions"
              title="Refresh"
              data-testid="button-refresh-wallet"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          {statsLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[0,1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl bg-white/4" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <BalanceCard
                label="Net Profit / Loss"
                value={`${netPL >= 0 ? "+" : ""}${netPL.toFixed(2)} S`}
                sub={netPL >= 0 ? "You're in profit" : "Keep competing"}
                icon={netPL >= 0 ? TrendingUp : TrendingDown}
                accent={netPL >= 0 ? "text-green-400" : "text-red-400"}
                data_testid="stat-net-pl"
              />
              <BalanceCard
                label="Total Wagered"
                value={`${(stats?.totalWagered ?? 0).toFixed(2)} S`}
                sub={`${transactions.filter(t => t.type === "bet_placed").length} matches played`}
                icon={DollarSign}
                accent="text-orange-400"
                data_testid="stat-total-wagered"
              />
              <BalanceCard
                label="Biggest Win"
                value={`${Math.max(0, ...transactions.filter(t => t.type === "bet_won").map(t => parseFloat(t.amount as string))).toFixed(2)} S`}
                sub="All time"
                icon={TrendingUp}
                accent="text-emerald-400"
                data_testid="stat-biggest-win"
              />
              <BalanceCard
                label="Win Rate"
                value={(() => {
                  const won = transactions.filter(t => t.type === "bet_won").length;
                  const played = transactions.filter(t => t.type === "bet_placed").length;
                  return played > 0 ? `${Math.round((won / played) * 100)}%` : "—";
                })()}
                sub="Wins vs. bets placed"
                icon={Shield}
                accent="text-violet-400"
                data_testid="stat-win-rate"
              />
            </div>
          )}
        </motion.div>

        {/* ── Betting Slip (Active Wagers) ── */}
        {(activeBets.length > 0 || betsLoading) && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-white/35 uppercase tracking-widest flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5" /> Betting Slip
              </h2>
              <Badge variant="outline" className="border-white/12 text-white/30 text-[10px]">
                {activeBets.length} active
              </Badge>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
              {betsLoading ? (
                <div className="p-4 space-y-3">
                  {[0,1].map(i => <Skeleton key={i} className="h-14 rounded-xl bg-white/4" />)}
                </div>
              ) : activeBets.length === 0 ? null : (
                <div className="divide-y divide-white/5">
                  {activeBets.map(bet => {
                    const amt = parseFloat(bet.amount as string);
                    const gameName = bet.match?.gameType?.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) ?? "Match";
                    const status = bet.match?.status ?? "active";
                    const pot = bet.match?.potAmount ? parseFloat(bet.match.potAmount) : 0;
                    return (
                      <div key={bet.id} className="flex items-center gap-3 p-4" data-testid={`bet-row-${bet.id}`}>
                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-orange-500/15 flex items-center justify-center">
                          <Swords className="w-4 h-4 text-orange-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white/85">{gameName}</p>
                          <p className="text-[11px] text-white/35">{bet.description ?? `Wager placed · ${status}`}</p>
                          {pot > 0 && <p className="text-[10px] text-green-400/70 mt-0.5">Pot: {pot.toFixed(2)} S</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-orange-400 font-mono">-{amt.toFixed(2)} S</p>
                          {bet.match?.id && (
                            <Link href={`/spectate/${bet.match.id}`}>
                              <button className="text-[10px] text-blue-400/80 flex items-center gap-0.5 mt-0.5 hover:text-blue-300">
                                <Eye className="w-2.5 h-2.5" />Watch
                              </button>
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Transaction History ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-white/35 uppercase tracking-widest flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" /> Transactions
            </h2>
            <div className="flex items-center gap-2">
              {filtered.length > 0 && (
                <button
                  onClick={() => exportCsv(filtered, filter)}
                  className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors"
                  data-testid="button-export-csv"
                  title="Export as CSV"
                  aria-label="Export transactions as CSV"
                >
                  <Download className="w-3 h-3" />
                  Export
                </button>
              )}
              <Badge variant="outline" className="border-white/12 text-white/30 text-[10px]">
                {transactions.length} total
              </Badge>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1.5 mb-4 no-scrollbar">
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`shrink-0 text-[11px] px-3 py-1.5 rounded-full border font-medium transition-all whitespace-nowrap ${
                  filter === f
                    ? "bg-primary/90 border-primary text-white shadow-sm"
                    : "border-white/12 text-white/40 hover:border-white/25 hover:text-white/60"
                }`}
                data-testid={`filter-${f.toLowerCase()}`}
              >
                {f}
                {f !== "All" && (
                  <span className="ml-1.5 text-[9px] opacity-60">
                    {filterTx(transactions, f).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-white/8 bg-white/3 overflow-hidden">
            {txLoading ? (
              <div className="p-4 space-y-3">
                {[0,1,2,3,4].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-9 h-9 rounded-full bg-white/5" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-24 bg-white/5 rounded" />
                      <Skeleton className="h-2.5 w-36 bg-white/4 rounded" />
                    </div>
                    <Skeleton className="h-3 w-16 bg-white/5 rounded" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyTx filter={filter} />
            ) : (
              <div className="px-4">
                {filtered.map(tx => <TxRow key={tx.id} tx={tx} />)}
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Trust Banner ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          <div className="rounded-xl border border-white/6 bg-white/2 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              {[
                { icon: Shield, label: "Secure Funds", sub: "256-bit encrypted" },
                { icon: CheckCircle2, label: "Instant Deposits", sub: "Via Stripe" },
                { icon: Clock, label: "Fast Withdrawals", sub: "1–3 business days" },
              ].map(({ icon: Icon, label, sub }) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <Icon className="w-4 h-4 text-white/20 mb-0.5" />
                  <p className="text-xs font-semibold text-white/50">{label}</p>
                  <p className="text-[10px] text-white/25">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

      </div>

      <WithdrawModal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
    </div>
  );
}
