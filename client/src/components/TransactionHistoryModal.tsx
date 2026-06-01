import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  TrendingUp, 
  TrendingDown,
  Search,
  Filter,
  DollarSign,
  Wallet,
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

interface Transaction {
  id: string;
  type: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  matchId?: string;
  description?: string;
  createdAt: string;
}

interface TransactionHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TRANSACTION_TYPES = [
  { value: "all", label: "All Transactions" },
  { value: "win", label: "Wins" },
  { value: "loss", label: "Losses" },
  { value: "deposit", label: "Deposits" },
  { value: "bet", label: "Bets Placed" },
  { value: "refund", label: "Refunds" },
];

export default function TransactionHistoryModal({ 
  open, 
  onOpenChange 
}: TransactionHistoryModalProps) {
  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/wallet/transactions"],
    enabled: open,
  });

  // Filter transactions
  const filteredTransactions = transactions.filter((txn) => {
    const matchesType = filterType === "all" || txn.type === filterType;
    const matchesSearch = 
      txn.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "win":
        return <TrendingUp className="w-5 h-5 text-chart-3" />;
      case "loss":
      case "bet":
        return <TrendingDown className="w-5 h-5 text-chart-4" />;
      case "deposit":
        return <ArrowUpCircle className="w-5 h-5 text-chart-1" />;
      case "refund":
        return <ArrowDownCircle className="w-5 h-5 text-chart-2" />;
      default:
        return <DollarSign className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getTransactionColor = (type: string, amount: string) => {
    const amountNum = parseFloat(amount);
    if (type === "win" || type === "deposit" || type === "refund") {
      return "text-chart-3";
    }
    if (type === "loss" || type === "bet") {
      return "text-chart-4";
    }
    return amountNum >= 0 ? "text-chart-3" : "text-chart-4";
  };

  const formatAmount = (amount: string, type: string) => {
    const amountNum = parseFloat(amount);
    const prefix = type === "win" || type === "deposit" || type === "refund" ? "+" : "-";
    return `${prefix}${Math.abs(amountNum).toFixed(2)} S`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]" data-testid="dialog-transaction-history">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display">Transaction History</DialogTitle>
          <DialogDescription>
            View all your wallet activity and transactions
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="space-y-4">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-transactions"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              data-testid="button-filter-transactions"
            >
              <Filter className="w-4 h-4" />
            </Button>
          </div>

          {/* Type Filter Buttons */}
          <div className="flex gap-2 flex-wrap">
            {TRANSACTION_TYPES.map((type) => (
              <Button
                key={type.value}
                variant={filterType === type.value ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType(type.value)}
                data-testid={`button-filter-${type.value}`}
              >
                {type.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Transaction List */}
        <div className="space-y-2 overflow-y-auto max-h-96 pr-2">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading transactions...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              {searchQuery || filterType !== "all" ? (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/8 flex items-center justify-center">
                    <Search className="w-6 h-6 text-muted-foreground/40" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">No results</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Try a different filter or search term</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Wallet className="w-7 h-7 text-amber-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">No transactions yet</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">Deposits, wins, losses, and purchases will all show up here.</p>
                  </div>
                </>
              )}
            </div>
          ) : (
            filteredTransactions.map((txn, index) => (
              <motion.div
                key={txn.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="p-4 bg-card border rounded-lg hover-elevate"
                data-testid={`transaction-${txn.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1">
                      {getTransactionIcon(txn.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {txn.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(txn.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                      </div>
                      {txn.description && (
                        <p className="text-sm text-muted-foreground truncate">
                          {txn.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>Balance: {parseFloat(txn.balanceBefore).toFixed(2)} S</span>
                        <span>→</span>
                        <span>{parseFloat(txn.balanceAfter).toFixed(2)} S</span>
                      </div>
                    </div>
                  </div>
                  <div className={`font-mono font-bold text-lg ${getTransactionColor(txn.type, txn.amount)}`}>
                    {formatAmount(txn.amount, txn.type)}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Summary */}
        {filteredTransactions.length > 0 && (
          <div className="pt-4 border-t">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">
                Showing {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
              </span>
              <span className="text-muted-foreground">
                Total transactions: {transactions.length}
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
