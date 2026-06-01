import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertTriangle, Shield, Ban, VolumeX, DollarSign, CheckCircle, Clock, User, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { format } from "date-fns";

interface DashboardData {
  reportsByPlayer: {
    id: string;
    username: string;
    first_name: string;
    reputation: number;
    is_banned: boolean;
    report_count: number;
    last_reported_at: string;
  }[];
  lowReputationPlayers: {
    id: string;
    username: string;
    first_name: string;
    reputation: number;
    is_banned: boolean;
  }[];
  recentActions: {
    id: string;
    action_type: string;
    reason: string;
    created_at: string;
    expires_at: string | null;
    admin_username: string;
    admin_first_name: string;
    target_username: string;
    target_first_name: string;
    target_reputation: number;
  }[];
}

interface ModerationLogEntry {
  id: string;
  action_type: string;
  reason: string;
  duration_hours: number | null;
  expires_at: string | null;
  created_at: string;
  admin_id: string;
  admin_username: string;
  admin_first_name: string;
  target_id: string;
  target_username: string;
  target_first_name: string;
  target_reputation: number;
  target_is_banned: boolean;
}

interface ActionModalState {
  open: boolean;
  userId: string;
  userName: string;
  relatedReportId?: string;
}

const ACTION_CONFIG: Record<string, { label: string; icon: typeof Shield; color: string; hasDuration: boolean }> = {
  warning: { label: "Issue Warning", icon: AlertTriangle, color: "text-yellow-400", hasDuration: false },
  temp_ban: { label: "Temp Matchmaking Ban", icon: Ban, color: "text-orange-400", hasDuration: true },
  wager_restriction: { label: "Wager Restriction", icon: DollarSign, color: "text-blue-400", hasDuration: true },
  chat_mute: { label: "Chat Mute", icon: VolumeX, color: "text-purple-400", hasDuration: true },
  permanent_ban: { label: "Permanent Ban", icon: Ban, color: "text-red-400", hasDuration: false },
  dismiss_report: { label: "Dismiss Report", icon: CheckCircle, color: "text-green-400", hasDuration: false },
  unban: { label: "Lift Ban", icon: Shield, color: "text-green-400", hasDuration: false },
  unmute: { label: "Lift Mute", icon: Shield, color: "text-green-400", hasDuration: false },
  unrestrict: { label: "Lift Restriction", icon: Shield, color: "text-green-400", hasDuration: false },
};

function ReputationBadge({ score }: { score: number }) {
  const tier =
    score >= 80 ? { label: "Excellent", color: "text-green-400 border-green-500/30" } :
    score >= 60 ? { label: "Good", color: "text-blue-400 border-blue-500/30" } :
    score >= 40 ? { label: "Warning", color: "text-yellow-400 border-yellow-500/30" } :
    { label: "Restricted", color: "text-red-400 border-red-500/30" };
  return (
    <Badge variant="outline" className={`text-[10px] ${tier.color}`}>
      {score}/100 · {tier.label}
    </Badge>
  );
}

function ActionTypeLabel({ type }: { type: string }) {
  const config = ACTION_CONFIG[type];
  if (!config) return <span className="text-white/60 text-xs">{type}</span>;
  const Icon = config.icon;
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function ModerationActionModal({ state, onClose }: { state: ActionModalState; onClose: () => void }) {
  const { toast } = useToast();
  const [actionType, setActionType] = useState("warning");
  const [reason, setReason] = useState("");
  const [durationHours, setDurationHours] = useState("24");

  const mutation = useMutation({
    mutationFn: (body: object) => apiRequest("POST", "/api/admin/moderation/action", body),
    onSuccess: () => {
      toast({ title: "Action applied", description: `Moderation action applied to ${state.userName}.` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation"] });
      setReason("");
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to apply action", variant: "destructive" });
    },
  });

  const config = ACTION_CONFIG[actionType];
  const hasDuration = config?.hasDuration;

  const handleSubmit = () => {
    if (!reason.trim()) {
      toast({ title: "Reason required", description: "Please provide a reason for this action.", variant: "destructive" });
      return;
    }
    mutation.mutate({
      targetUserId: state.userId,
      actionType,
      reason: reason.trim(),
      durationHours: hasDuration ? parseInt(durationHours) : undefined,
      relatedReportId: state.relatedReportId,
    });
  };

  return (
    <Dialog open={state.open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Moderate: {state.userName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/60 mb-1 block">Action Type</label>
            <Select value={actionType} onValueChange={setActionType}>
              <SelectTrigger data-testid="select-action-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACTION_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key} data-testid={`option-action-${key}`}>
                    {cfg.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasDuration && (
            <div>
              <label className="text-xs text-white/60 mb-1 block">Duration (hours)</label>
              <Select value={durationHours} onValueChange={setDurationHours}>
                <SelectTrigger data-testid="select-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 6, 12, 24, 48, 72, 168, 720].map(h => (
                    <SelectItem key={h} value={String(h)} data-testid={`option-duration-${h}`}>
                      {h < 24 ? `${h}h` : h < 168 ? `${h / 24}d` : h === 168 ? "7 days" : "30 days"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="text-xs text-white/60 mb-1 block">Reason</label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Describe the reason for this moderation action..."
              className="min-h-[80px]"
              data-testid="input-mod-reason"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose} data-testid="button-cancel-mod">Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={mutation.isPending}
              className="bg-red-500/20 border border-red-500/30 text-red-300"
              data-testid="button-apply-mod"
            >
              {mutation.isPending ? "Applying..." : "Apply Action"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ModerationDashboard() {
  const [modal, setModal] = useState<ActionModalState>({ open: false, userId: "", userName: "" });
  const [logSearch, setLogSearch] = useState("");

  const { data: dashboard, isLoading: dashLoading } = useQuery<DashboardData>({
    queryKey: ["/api/admin/moderation/dashboard"],
  });

  const { data: log, isLoading: logLoading } = useQuery<ModerationLogEntry[]>({
    queryKey: ["/api/admin/moderation"],
  });

  const openModal = (userId: string, userName: string, relatedReportId?: string) => {
    setModal({ open: true, userId, userName, relatedReportId });
  };

  const filteredLog = (log || []).filter(e =>
    !logSearch ||
    (e.target_username || e.target_first_name || "").toLowerCase().includes(logSearch.toLowerCase()) ||
    e.action_type.includes(logSearch.toLowerCase()) ||
    e.reason.toLowerCase().includes(logSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <ModerationActionModal state={modal} onClose={() => setModal(s => ({ ...s, open: false }))} />

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1" data-testid="mod-tabs">
          <TabsTrigger value="overview" data-testid="tab-mod-overview">Overview</TabsTrigger>
          <TabsTrigger value="flagged" data-testid="tab-mod-flagged">Flagged Players</TabsTrigger>
          <TabsTrigger value="log" data-testid="tab-mod-log">Action Log</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {dashLoading ? (
            <p className="text-white/40 text-sm">Loading...</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="card-depth">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      Most Reported
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold text-white">
                    {dashboard?.reportsByPlayer?.[0]?.report_count ?? 0}
                    <p className="text-xs text-white/40 font-normal mt-0.5">
                      {dashboard?.reportsByPlayer?.[0]
                        ? `${dashboard.reportsByPlayer[0].first_name || dashboard.reportsByPlayer[0].username}`
                        : "—"}
                    </p>
                  </CardContent>
                </Card>
                <Card className="card-depth">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Shield className="w-4 h-4 text-red-400" />
                      Low Reputation Players
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold text-white">
                    {dashboard?.lowReputationPlayers?.length ?? 0}
                  </CardContent>
                </Card>
                <Card className="card-depth">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-400" />
                      Recent Actions (24h)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold text-white">
                    {(dashboard?.recentActions ?? []).filter(a => {
                      const d = new Date(a.created_at);
                      return Date.now() - d.getTime() < 86400000;
                    }).length}
                  </CardContent>
                </Card>
              </div>

              {/* Recent Actions */}
              <Card className="card-depth">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Recent Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(dashboard?.recentActions ?? []).length === 0 ? (
                    <p className="text-white/40 text-sm">No recent moderation actions.</p>
                  ) : (
                    dashboard!.recentActions.map(a => (
                      <div key={a.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-white/5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <ActionTypeLabel type={a.action_type} />
                            <span className="text-white/80 text-xs font-medium truncate">
                              {a.target_first_name || a.target_username}
                            </span>
                            <ReputationBadge score={a.target_reputation} />
                          </div>
                          <p className="text-white/50 text-xs mt-1 truncate">{a.reason}</p>
                          <p className="text-white/30 text-[10px] mt-0.5">
                            by {a.admin_first_name || a.admin_username} · {format(new Date(a.created_at), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* FLAGGED PLAYERS */}
        <TabsContent value="flagged" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Most reported */}
            <Card className="card-depth">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  Most Reported Players
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {dashLoading ? (
                  <p className="text-white/40 text-sm">Loading...</p>
                ) : (dashboard?.reportsByPlayer ?? []).length === 0 ? (
                  <p className="text-white/40 text-sm">No reported players.</p>
                ) : (
                  dashboard!.reportsByPlayer.map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/5" data-testid={`row-reported-${p.id}`}>
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs">{(p.first_name || p.username || "?")[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white text-sm font-medium truncate">{p.first_name || p.username}</span>
                          {p.is_banned && <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/30">Banned</Badge>}
                          <ReputationBadge score={p.reputation} />
                        </div>
                        <p className="text-white/40 text-xs">{p.report_count} report{p.report_count !== 1 ? "s" : ""}</p>
                      </div>
                      <div className="flex gap-1">
                        <Link href={`/profile/${p.id}`}>
                          <Button size="icon" variant="ghost" className="w-7 h-7" data-testid={`button-view-${p.id}`}>
                            <Eye className="w-3 h-3" />
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 px-2 border-red-500/25 text-red-400/80"
                          onClick={() => openModal(p.id, p.first_name || p.username)}
                          data-testid={`button-moderate-${p.id}`}
                        >
                          Action
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Low reputation */}
            <Card className="card-depth">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-red-400" />
                  Low Reputation Players
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {dashLoading ? (
                  <p className="text-white/40 text-sm">Loading...</p>
                ) : (dashboard?.lowReputationPlayers ?? []).length === 0 ? (
                  <p className="text-white/40 text-sm">No low-reputation players.</p>
                ) : (
                  dashboard!.lowReputationPlayers.map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/5" data-testid={`row-low-rep-${p.id}`}>
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs">{(p.first_name || p.username || "?")[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white text-sm font-medium">{p.first_name || p.username}</span>
                          {p.is_banned && <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/30">Banned</Badge>}
                        </div>
                        <ReputationBadge score={p.reputation} />
                      </div>
                      <div className="flex gap-1">
                        <Link href={`/profile/${p.id}`}>
                          <Button size="icon" variant="ghost" className="w-7 h-7" data-testid={`button-view-rep-${p.id}`}>
                            <Eye className="w-3 h-3" />
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 px-2 border-red-500/25 text-red-400/80"
                          onClick={() => openModal(p.id, p.first_name || p.username)}
                          data-testid={`button-moderate-rep-${p.id}`}
                        >
                          Action
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ACTION LOG */}
        <TabsContent value="log" className="space-y-4 mt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search by player, action, or reason..."
              value={logSearch}
              onChange={e => setLogSearch(e.target.value)}
              className="max-w-sm"
              data-testid="input-log-search"
            />
          </div>
          <Card className="card-depth">
            <CardContent className="pt-4 space-y-2">
              {logLoading ? (
                <p className="text-white/40 text-sm">Loading...</p>
              ) : filteredLog.length === 0 ? (
                <p className="text-white/40 text-sm">No moderation actions found.</p>
              ) : (
                filteredLog.map(entry => (
                  <div key={entry.id} className="p-3 rounded-lg bg-white/5 space-y-1" data-testid={`row-log-${entry.id}`}>
                    <div className="flex items-center gap-2 flex-wrap justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <ActionTypeLabel type={entry.action_type} />
                        <span className="text-white/80 text-xs font-medium">
                          {entry.target_first_name || entry.target_username}
                        </span>
                        <ReputationBadge score={entry.target_reputation} />
                        {entry.target_is_banned && (
                          <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/30">Banned</Badge>
                        )}
                      </div>
                      <span className="text-white/30 text-[10px]">
                        {format(new Date(entry.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p className="text-white/60 text-xs">{entry.reason}</p>
                    {entry.duration_hours && (
                      <p className="text-white/30 text-[10px]">
                        Duration: {entry.duration_hours}h
                        {entry.expires_at ? ` · Expires ${format(new Date(entry.expires_at), "MMM d, h:mm a")}` : ""}
                      </p>
                    )}
                    <p className="text-white/30 text-[10px]">
                      By: {entry.admin_first_name || entry.admin_username}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
