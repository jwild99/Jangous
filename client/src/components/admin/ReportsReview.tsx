import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Flag, User, Clock, CheckCircle, XCircle, AlertTriangle, Search } from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface PlayerReport {
  id: string;
  reason: string;
  details: string | null;
  status: "pending" | "reviewed" | "dismissed" | "actioned";
  created_at: string;
  reporter_id: string;
  reporter_username: string | null;
  reporter_first_name: string | null;
  reported_id: string;
  reported_username: string | null;
  reported_first_name: string | null;
  reported_reputation: number | null;
  match_id: string | null;
}

const STATUS_CONFIG = {
  pending:   { label: "Pending",   color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  reviewed:  { label: "Reviewed",  color: "bg-blue-500/15   text-blue-400   border-blue-500/30"   },
  dismissed: { label: "Dismissed", color: "bg-gray-500/15   text-gray-400   border-gray-500/30"   },
  actioned:  { label: "Actioned",  color: "bg-green-500/15  text-green-400  border-green-500/30"  },
};

const REASON_LABELS: Record<string, string> = {
  cheating:        "Cheating / Hacking",
  toxic_behavior:  "Toxic Behavior",
  afk:             "AFK / Match Abandonment",
  harassment:      "Harassment",
  account_sharing: "Account Sharing / Boosting",
  other:           "Other",
};

export default function ReportsReview() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: reports = [], isLoading } = useQuery<PlayerReport[]>({
    queryKey: ["/api/admin/reports"],
    refetchInterval: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/reports/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reports"] });
      toast({ title: "Report updated" });
    },
    onError: () => toast({ title: "Failed to update report", variant: "destructive" }),
  });

  const filtered = reports.filter(r => {
    if (filter !== "all" && r.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (r.reported_username ?? "").toLowerCase().includes(q) ||
        (r.reporter_username ?? "").toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    all:       reports.length,
    pending:   reports.filter(r => r.status === "pending").length,
    reviewed:  reports.filter(r => r.status === "reviewed").length,
    dismissed: reports.filter(r => r.status === "dismissed").length,
    actioned:  reports.filter(r => r.status === "actioned").length,
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["pending", "reviewed", "dismissed", "actioned"] as const).map(s => (
          <Card
            key={s}
            className={`card-depth cursor-pointer hover-elevate ${filter === s ? "ring-1 ring-primary/40" : ""}`}
            onClick={() => setFilter(filter === s ? "all" : s)}
          >
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground capitalize">{s}</p>
              <p className="text-2xl font-bold mt-1">{counts[s]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by player or reason..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-reports-search"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40" data-testid="select-reports-filter">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({counts.all})</SelectItem>
            <SelectItem value="pending">Pending ({counts.pending})</SelectItem>
            <SelectItem value="reviewed">Reviewed ({counts.reviewed})</SelectItem>
            <SelectItem value="dismissed">Dismissed ({counts.dismissed})</SelectItem>
            <SelectItem value="actioned">Actioned ({counts.actioned})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Report list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-28 rounded-lg bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="card-depth">
          <CardContent className="py-16 flex flex-col items-center gap-3">
            <Flag className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">No reports found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const sc = STATUS_CONFIG[r.status];
            return (
              <Card key={r.id} className="card-depth" data-testid={`report-row-${r.id}`}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start gap-3 justify-between">
                    {/* Left: reporter / reported info */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={`text-[10px] border ${sc.color}`}>
                          {sc.label}
                        </Badge>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {REASON_LABELS[r.reason] ?? r.reason}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground text-xs">Reporter:</span>
                          <Link href={`/profile/${r.reporter_id}`}>
                            <span className="text-xs font-medium hover:underline cursor-pointer text-foreground">
                              {r.reporter_username ?? r.reporter_first_name ?? "Unknown"}
                            </span>
                          </Link>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                          <span className="text-muted-foreground text-xs">Reported:</span>
                          <Link href={`/profile/${r.reported_id}`}>
                            <span className="text-xs font-medium hover:underline cursor-pointer text-foreground">
                              {r.reported_username ?? r.reported_first_name ?? "Unknown"}
                            </span>
                          </Link>
                          {r.reported_reputation != null && (
                            <Badge
                              className={`text-[10px] ${
                                r.reported_reputation >= 60
                                  ? "bg-green-500/15 text-green-400"
                                  : r.reported_reputation >= 30
                                  ? "bg-yellow-500/15 text-yellow-400"
                                  : "bg-red-500/15 text-red-400"
                              }`}
                            >
                              Rep: {r.reported_reputation}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {r.details && (
                        <p className="text-xs text-muted-foreground bg-muted/20 rounded-md px-3 py-2 mt-1 max-w-xl">
                          {r.details}
                        </p>
                      )}

                      {r.match_id && (
                        <p className="text-[10px] text-muted-foreground/50">
                          Match: {r.match_id}
                        </p>
                      )}
                    </div>

                    {/* Right: actions */}
                    <div className="flex flex-col gap-2 shrink-0">
                      <Select
                        value={r.status}
                        onValueChange={status => updateMutation.mutate({ id: r.id, status })}
                        disabled={updateMutation.isPending}
                      >
                        <SelectTrigger className="w-36 h-8 text-xs" data-testid={`select-report-status-${r.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="reviewed">Reviewed</SelectItem>
                          <SelectItem value="dismissed">Dismissed</SelectItem>
                          <SelectItem value="actioned">Actioned</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
