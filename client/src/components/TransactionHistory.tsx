import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Transaction } from "@shared/schema";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Target,
  Trophy,
  Search,
  Filter,
  Receipt,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";

const transactionIcons = {
  "deposit": ArrowDownCircle,
  "withdrawal": ArrowUpCircle,
  "bet_placed": Target,
  "bet_won": Trophy,
  "bet_lost": TrendingDown,
  "rake": DollarSign,
  "forfeit_gain": TrendingUp,
};

const transactionLabels = {
  "deposit": "Deposit",
  "withdrawal": "Withdrawal",
  "bet_placed": "Bet Placed",
  "bet_won": "Match Won",
  "bet_lost": "Match Lost",
  "rake": "Platform Fee",
  "forfeit_gain": "Opponent Forfeit",
};

const TX_STATE: Record<string, {
  iconColor: string;
  amountColor: string;
  glowBg: string;
  borderColor: string;
  stripColor: string;
  label: string;
}> = {
  deposit:      { iconColor: "text-blue-400",   amountColor: "text-blue-400",   glowBg: "rgba(59,130,246,0.05)",  borderColor: "rgba(59,130,246,0.25)",  stripColor: "#3b82f6", label: "Deposit"         },
  withdrawal:   { iconColor: "text-red-400",    amountColor: "text-red-400",    glowBg: "rgba(239,68,68,0.05)",   borderColor: "rgba(239,68,68,0.22)",   stripColor: "#ef4444", label: "Withdrawal"      },
  bet_placed:   { iconColor: "text-orange-400", amountColor: "text-orange-400", glowBg: "rgba(249,115,22,0.04)",  borderColor: "rgba(249,115,22,0.2)",   stripColor: "#f97316", label: "Bet Placed"      },
  bet_won:      { iconColor: "text-green-400",  amountColor: "text-green-400",  glowBg: "rgba(34,197,94,0.07)",   borderColor: "rgba(34,197,94,0.3)",    stripColor: "#22c55e", label: "Match Won"       },
  bet_lost:     { iconColor: "text-red-400",    amountColor: "text-red-400",    glowBg: "rgba(239,68,68,0.05)",   borderColor: "rgba(239,68,68,0.22)",   stripColor: "#ef4444", label: "Match Lost"      },
  rake:         { iconColor: "text-white/30",   amountColor: "text-white/40",   glowBg: "rgba(255,255,255,0.01)", borderColor: "rgba(255,255,255,0.07)", stripColor: "#555",    label: "Platform Fee"    },
  forfeit_gain: { iconColor: "text-green-400",  amountColor: "text-green-400",  glowBg: "rgba(34,197,94,0.07)",   borderColor: "rgba(34,197,94,0.3)",    stripColor: "#22c55e", label: "Forfeit Win"     },
};

function TxRow({ tx, index }: { tx: Transaction; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = transactionIcons[tx.type as keyof typeof transactionIcons] || Receipt;
  const state = TX_STATE[tx.type] ?? TX_STATE.rake;
  const amount = parseFloat(tx.amount);
  const isPositive = ["deposit", "bet_won", "forfeit_gain"].includes(tx.type);
  const isNegative = ["withdrawal", "bet_placed", "bet_lost", "rake"].includes(tx.type);

  return (
    <motion.div
      key={tx.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.025, 0.35) }}
      className="relative rounded-lg overflow-hidden transition-all"
      style={{
        background: state.glowBg,
        border: `1px solid ${state.borderColor}`,
      }}
      data-testid={`transaction-${index}`}
    >
      {/* Left color strip */}
      <div
        className="absolute left-0 inset-y-0 w-0.5 rounded-l-lg"
        style={{ background: state.stripColor, opacity: 0.8 }}
      />

      <button
        className="w-full text-left"
        onClick={() => setExpanded(v => !v)}
        data-testid={`tx-expand-${index}`}
      >
        <div className="flex items-center gap-4 px-4 py-3.5">
          {/* Icon */}
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${state.stripColor}18` }}
          >
            <Icon className={`w-4.5 h-4.5 ${state.iconColor}`} style={{ width: "1.1rem", height: "1.1rem" }} />
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-semibold text-sm text-white/90">{state.label}</span>
              {tx.matchId && (
                <Link href={`/game/${tx.matchId}`} onClick={e => e.stopPropagation()}>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 border-white/15 text-white/40 cursor-pointer hover-elevate"
                    data-testid={`link-match-${index}`}
                  >
                    View Match
                  </Badge>
                </Link>
              )}
            </div>
            <div className="text-xs text-white/40 truncate">
              {tx.description || `${state.label} transaction`}
              {tx.createdAt && (
                <span className="ml-1.5 opacity-70">
                  · {formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>

          {/* Amount + expand icon */}
          <div className="text-right shrink-0 flex items-center gap-2">
            <div
              className={`text-base font-bold font-mono tabular-nums ${state.amountColor}`}
              data-testid={`amount-${index}`}
            >
              {isPositive ? "+" : isNegative ? "−" : ""}{Math.abs(amount).toFixed(2)}<span className="text-xs font-normal opacity-50 ml-0.5">S</span>
            </div>
            {expanded
              ? <ChevronUp className="w-3.5 h-3.5 text-white/25 shrink-0" />
              : <ChevronDown className="w-3.5 h-3.5 text-white/25 shrink-0" />
            }
          </div>
        </div>
      </button>

      {/* Expandable detail row */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div
              className="px-4 pb-3 pt-1 border-t flex items-center justify-between gap-4 text-[11px] text-white/40"
              style={{ borderColor: state.borderColor }}
            >
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-white/25 mb-0.5">Before</p>
                  <p className="font-mono font-semibold text-white/60">{parseFloat(tx.balanceBefore).toFixed(2)} S</p>
                </div>
                <div className="text-white/20">→</div>
                <div>
                  <p className="text-white/25 mb-0.5">After</p>
                  <p className={`font-mono font-semibold ${state.amountColor}`}>{parseFloat(tx.balanceAfter).toFixed(2)} S</p>
                </div>
              </div>
              {tx.createdAt && (
                <div className="text-right text-white/25 text-[10px]">
                  {new Date(tx.createdAt).toLocaleString("en-US", {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function TransactionHistory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([
    "deposit", "withdrawal", "bet_placed", "bet_won", "bet_lost", "rake", "forfeit_gain",
  ]);

  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/wallet/transactions"],
  });

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const filteredTransactions = transactions?.filter((tx) => {
    const matchesType = selectedTypes.includes(tx.type);
    const matchesSearch =
      !searchQuery ||
      tx.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      TX_STATE[tx.type]?.label?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const winCount   = transactions?.filter(t => t.type === "bet_won").length ?? 0;
  const lossCount  = transactions?.filter(t => t.type === "bet_lost").length ?? 0;
  const totalWon   = transactions?.filter(t => t.type === "bet_won").reduce((s, t) => s + parseFloat(t.amount), 0) ?? 0;

  return (
    <Card className="card-depth glass-override">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Transaction History
          </CardTitle>

          {/* Quick stats */}
          {!isLoading && transactions && transactions.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-white/40">
              <span className="text-green-400 font-semibold">{winCount}W</span>
              <span>/</span>
              <span className="text-red-400 font-semibold">{lossCount}L</span>
              {totalWon > 0 && (
                <span className="text-white/25">· +{totalWon.toFixed(2)} S won</span>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm"
                data-testid="input-search-transactions"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="default" data-testid="button-filter-transactions">
                  <Filter className="w-3.5 h-3.5 mr-1.5" />
                  Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Transaction Types</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {Object.entries(TX_STATE).map(([type, s]) => (
                  <DropdownMenuCheckboxItem
                    key={type}
                    checked={selectedTypes.includes(type)}
                    onCheckedChange={() => toggleType(type)}
                    data-testid={`filter-${type}`}
                  >
                    <span className={s.amountColor}>{s.label}</span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : !filteredTransactions || filteredTransactions.length === 0 ? (
          <div className="text-center py-12">
            <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="text-base font-semibold mb-1">
              {!transactions || transactions.length === 0 ? "No Transactions Yet" : "No Matching Transactions"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {!transactions || transactions.length === 0
                ? "Your transaction history will appear here"
                : "Try adjusting your search or filters"}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredTransactions.map((tx, index) => (
              <TxRow key={tx.id} tx={tx} index={index} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
