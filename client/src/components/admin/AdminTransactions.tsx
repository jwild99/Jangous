import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Filter, X, TrendingUp, TrendingDown, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { Transaction } from "@shared/schema";

export default function AdminTransactions() {
  const [userId, setUserId] = useState("");
  const [type, setType] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize] = useState(50);
  const [activeFilters, setActiveFilters] = useState<any>({});

  const queryKey = ["/api/admin/transactions", activeFilters, page, pageSize];

  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeFilters.userId) params.append("userId", activeFilters.userId);
      if (activeFilters.type) params.append("type", activeFilters.type);
      if (activeFilters.startDate) params.append("startDate", activeFilters.startDate);
      if (activeFilters.endDate) params.append("endDate", activeFilters.endDate);
      params.append("limit", pageSize.toString());
      params.append("offset", (page * pageSize).toString());
      
      const response = await fetch(`/api/admin/transactions?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch transactions");
      return response.json();
    },
  });

  const handleApplyFilters = () => {
    const filters: any = {};
    if (userId) filters.userId = userId;
    if (type && type !== "all") filters.type = type;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    setActiveFilters(filters);
    setPage(0);
  };

  const handleClearFilters = () => {
    setUserId("");
    setType("all");
    setStartDate("");
    setEndDate("");
    setActiveFilters({});
    setPage(0);
  };

  const getTransactionIcon = (transactionType: string) => {
    if (transactionType.includes("won") || transactionType === "deposit" || transactionType === "forfeit_gain") {
      return <TrendingUp className="w-4 h-4 text-chart-3" />;
    } else if (transactionType.includes("lost") || transactionType === "withdrawal" || transactionType.includes("bet_placed")) {
      return <TrendingDown className="w-4 h-4 text-destructive" />;
    }
    return <ArrowRight className="w-4 h-4 text-muted-foreground" />;
  };

  const getTransactionColor = (transactionType: string) => {
    if (transactionType.includes("won") || transactionType === "deposit" || transactionType === "forfeit_gain") {
      return "text-chart-3";
    } else if (transactionType.includes("lost") || transactionType === "withdrawal" || transactionType.includes("bet_placed")) {
      return "text-destructive";
    }
    return "text-foreground";
  };

  const formatTransactionType = (type: string) => {
    return type.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Transaction History</h2>
        <p className="text-muted-foreground">View and filter all platform transactions</p>
      </div>

      <Card className="card-depth">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
          <CardDescription>Filter transactions by user, type, and date range</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="user-id">User ID</Label>
              <Input
                id="user-id"
                placeholder="Enter user ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                data-testid="input-filter-user-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Transaction Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="type" data-testid="select-filter-type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="withdrawal">Withdrawal</SelectItem>
                  <SelectItem value="bet_placed">Bet Placed</SelectItem>
                  <SelectItem value="bet_won">Bet Won</SelectItem>
                  <SelectItem value="bet_lost">Bet Lost</SelectItem>
                  <SelectItem value="rake">Rake</SelectItem>
                  <SelectItem value="forfeit_gain">Forfeit Gain</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-filter-start-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-filter-end-date"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleApplyFilters} data-testid="button-apply-filters">
              <Filter className="w-4 h-4 mr-2" />
              Apply Filters
            </Button>
            <Button variant="outline" onClick={handleClearFilters} data-testid="button-clear-filters">
              <X className="w-4 h-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="card-depth">
        <CardHeader>
          <CardTitle>All Transactions ({transactions?.length || 0})</CardTitle>
          <CardDescription>Platform-wide transaction history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance Before</TableHead>
                  <TableHead className="text-right">Balance After</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No transactions found
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions?.map((transaction) => (
                    <TableRow key={transaction.id} data-testid={`transaction-row-${transaction.id}`}>
                      <TableCell className="text-sm">
                        {new Date(transaction.createdAt || "").toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {transaction.userId.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          {getTransactionIcon(transaction.type)}
                          {formatTransactionType(transaction.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${getTransactionColor(transaction.type)}`}>
                        ${transaction.amount}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">
                        ${transaction.balanceBefore}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        ${transaction.balanceAfter}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {transaction.description || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {transactions && transactions.length > 0 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, page * pageSize + transactions.length)} transactions
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  data-testid="button-previous-page"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={!transactions || transactions.length < pageSize}
                  data-testid="button-next-page"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
