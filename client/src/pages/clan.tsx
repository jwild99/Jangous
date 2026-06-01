import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useParams, useLocation } from "wouter";
import { AppNavbar } from "@/components/AppNavbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  Shield, Crown, Users, Trophy, BarChart3, MessageCircle, ChevronLeft,
  UserPlus, LogOut, Settings, Trash2, Send, Star, Check, X, AlertTriangle,
  Globe, Lock, Swords, Zap, TrendingUp, Target, Activity, Award
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

interface Clan {
  id: string; name: string; tag: string; description: string | null;
  logoUrl: string | null; bannerUrl: string | null;
  currentMemberCount: number; memberLimit: number; clanLevel: number;
  clanXp: number; totalScalpsWon: string; totalScalpsLost: string;
  totalMatchesPlayed: number; totalMatchesWon: number; totalMatchesLost: number;
  seasonPoints: number; isPublic: boolean; requiresApproval: boolean;
  createdAt: string; lastActiveAt: string;
  leader?: { id: string; username: string; firstName: string; profileImageUrl: string | null };
}

interface ClanMember {
  id: string; role: string; joinedAt: string;
  matchesPlayedForClan: number; matchesWonForClan: number;
  contributedScalps: string;
  userId: string; username: string; firstName: string; lastName: string;
  profileImageUrl: string | null; rating: number;
}

interface ClanMessage {
  id: string; content: string; createdAt: string;
  userId: string; username: string; firstName: string; profileImageUrl: string | null;
}

const ROLE_COLORS: Record<string, string> = {
  leader: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  officer: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  member: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

const XP_PER_LEVEL = 1000;

function XpBar({ xp, level }: { xp: number; level: number }) {
  const current = xp % XP_PER_LEVEL;
  const pct = Math.min((current / XP_PER_LEVEL) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <span>Level {level}</span>
        <span>{current} / {XP_PER_LEVEL} XP</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary to-blue-400"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, delay: 0.3 }}
        />
      </div>
    </div>
  );
}

function MemberCard({ member, myRole, clanId, currentUserId, rank }: {
  member: ClanMember; myRole?: string; clanId: string; currentUserId?: string; rank: number;
}) {
  const { toast } = useToast();
  const canManage = myRole === "leader" || (myRole === "officer" && member.role === "member");
  const isMe = member.userId === currentUserId;

  const kickMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/clans/${clanId}/members/${member.userId}`, {}),
    onSuccess: () => {
      toast({ title: "Member removed" });
      queryClient.invalidateQueries({ queryKey: [`/api/clans/${clanId}/members`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clans/${clanId}`] });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const promoteMutation = useMutation({
    mutationFn: (role: string) => apiRequest("PATCH", `/api/clans/${clanId}/members/${member.userId}/role`, { role }),
    onSuccess: () => {
      toast({ title: "Role updated" });
      queryClient.invalidateQueries({ queryKey: [`/api/clans/${clanId}/members`] });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const displayName = member.username ?? `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim();
  const winRate = member.matchesPlayedForClan > 0
    ? Math.round((member.matchesWonForClan / member.matchesPlayedForClan) * 100) : 0;

  const rankColor = rank === 1 ? "text-yellow-400" : rank === 2 ? "text-slate-300" : rank === 3 ? "text-amber-600" : "text-muted-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: rank * 0.04 }}
    >
      <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] hover-elevate"
        data-testid={`member-card-${member.userId}`}>
        {/* Rank */}
        <span className={`text-xs font-bold w-5 text-center shrink-0 ${rankColor}`}>
          {rank <= 3 ? ["1st","2nd","3rd"][rank-1] : `#${rank}`}
        </span>

        <Link href={`/profile/${member.userId}`}>
          <Avatar className="w-10 h-10 cursor-pointer ring-1 ring-white/10">
            <AvatarImage src={member.profileImageUrl ?? undefined} />
            <AvatarFallback className="text-xs">{displayName[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/profile/${member.userId}`}>
              <span className="text-sm font-semibold hover:underline cursor-pointer truncate">{displayName}</span>
            </Link>
            <Badge className={`text-[10px] border shrink-0 ${ROLE_COLORS[member.role]}`}>
              {member.role === "leader" && <Crown className="w-2.5 h-2.5 mr-0.5" />}
              {member.role}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex-1 max-w-[120px]">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                <span>Win rate</span>
                <span className={winRate >= 50 ? "text-green-400" : "text-red-400"}>{winRate}%</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-green-500/70" style={{ width: `${winRate}%` }} />
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {member.matchesWonForClan}W/{member.matchesPlayedForClan - member.matchesWonForClan}L
            </span>
            <span className="text-[10px] text-primary font-semibold">
              {parseFloat(member.contributedScalps).toFixed(0)}S
            </span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-sm font-bold">{member.rating ?? 1200}</p>
          <p className="text-[10px] text-muted-foreground">rating</p>
        </div>

        {canManage && !isMe && member.role !== "leader" && (
          <div className="flex gap-1 shrink-0">
            {myRole === "leader" && (
              <Button size="icon" variant="ghost"
                onClick={() => promoteMutation.mutate(member.role === "officer" ? "member" : "officer")}
                disabled={promoteMutation.isPending}
                title={member.role === "officer" ? "Demote to member" : "Promote to officer"}
                data-testid={`button-promote-${member.userId}`}>
                <Star className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button size="icon" variant="ghost" className="text-destructive"
              onClick={() => kickMutation.mutate()} disabled={kickMutation.isPending}
              title="Remove from clan" data-testid={`button-kick-${member.userId}`}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ClanChat({ clanId }: { clanId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useQuery<ClanMessage[]>({
    queryKey: [`/api/clans/${clanId}/messages`],
    refetchInterval: 8000,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => apiRequest("POST", `/api/clans/${clanId}/messages`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clans/${clanId}/messages`] });
      setMessage("");
    },
    onError: (err: any) => toast({ title: "Failed to send", description: err.message, variant: "destructive" }),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate(message.trim());
  };

  return (
    <div className="flex flex-col h-[520px]">
      <div className="flex-1 overflow-y-auto space-y-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] mb-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <MessageCircle className="w-10 h-10 opacity-20" />
            <p className="text-sm">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map(msg => {
            const displayName = msg.username ?? msg.firstName ?? "Unknown";
            const isMe = msg.userId === (user as any)?.id;
            return (
              <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}
                data-testid={`chat-message-${msg.id}`}>
                <Avatar className="w-7 h-7 shrink-0">
                  <AvatarImage src={msg.profileImageUrl ?? undefined} />
                  <AvatarFallback className="text-[10px]">{displayName[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                  {!isMe && <span className="text-[10px] text-muted-foreground px-1">{displayName}</span>}
                  <div className={`px-3 py-2 rounded-xl text-sm ${isMe ? "bg-primary text-primary-foreground" : "bg-white/[0.08]"}`}>
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 px-1">
                    {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2">
        <Input placeholder="Message your clan..." value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
          maxLength={500} data-testid="input-clan-message"
          className="bg-white/[0.05] border-white/10" />
        <Button size="icon" onClick={handleSend} disabled={sendMutation.isPending || !message.trim()}
          data-testid="button-send-clan-message">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function ActivityFeed({ clan, members }: { clan: Clan; members: ClanMember[] }) {
  const events = [
    ...members.slice(0, 5).map(m => ({
      type: "win",
      text: `${m.username ?? m.firstName} won ${m.matchesWonForClan} matches for the clan`,
      time: m.joinedAt,
      icon: Trophy,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
    })),
    ...(clan.clanLevel > 1 ? [{
      type: "level",
      text: `Clan reached Level ${clan.clanLevel}`,
      time: clan.lastActiveAt,
      icon: Zap,
      color: "text-primary",
      bg: "bg-primary/10",
    }] : []),
    ...members.slice(0, 3).map(m => ({
      type: "join",
      text: `${m.username ?? m.firstName} joined the clan`,
      time: m.joinedAt,
      icon: UserPlus,
      color: "text-green-400",
      bg: "bg-green-500/10",
    })),
  ].sort((a, b) => new Date(b.time ?? 0).getTime() - new Date(a.time ?? 0).getTime()).slice(0, 10);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <Activity className="w-10 h-10 opacity-20" />
        <p className="text-sm">No activity yet. Start competing!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((e, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <div className={`w-8 h-8 rounded-full ${e.bg} flex items-center justify-center shrink-0`}>
            <e.icon className={`w-4 h-4 ${e.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm">{e.text}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {formatDistanceToNow(new Date(e.time), { addSuffix: true })}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function EditClanModal({ clan, onSaved }: { clan: Clan; onSaved: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: clan.name, tag: clan.tag, description: clan.description ?? "",
    isPublic: clan.isPublic, requiresApproval: clan.requiresApproval, memberLimit: String(clan.memberLimit),
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof form) => apiRequest("PATCH", `/api/clans/${clan.id}`, data),
    onSuccess: () => {
      toast({ title: "Clan settings updated" });
      queryClient.invalidateQueries({ queryKey: [`/api/clans/${clan.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/clan"] });
      setOpen(false);
      onSaved();
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-edit-clan">
          <Settings className="w-3.5 h-3.5" /> Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Clan Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Clan Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={40} />
            </div>
            <div>
              <Label>Tag</Label>
              <Input value={form.tag} onChange={e => setForm(f => ({ ...f, tag: e.target.value.toUpperCase() }))} maxLength={5} />
            </div>
            <div>
              <Label>Member Limit</Label>
              <Input type="number" min="5" max="100" value={form.memberLimit}
                onChange={e => setForm(f => ({ ...f, memberLimit: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                maxLength={300} className="resize-none h-20" />
            </div>
          </div>
          <div className="space-y-3 rounded-lg bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Public Clan</span>
              <Switch checked={form.isPublic} onCheckedChange={v => setForm(f => ({ ...f, isPublic: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Require Approval</span>
              <Switch checked={form.requiresApproval} onCheckedChange={v => setForm(f => ({ ...f, requiresApproval: v }))} />
            </div>
          </div>
          <Button className="w-full" onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function JoinRequestsSection({ clanId }: { clanId: string }) {
  const { toast } = useToast();
  const { data: requests = [] } = useQuery<any[]>({
    queryKey: [`/api/clans/${clanId}/join-requests`],
    refetchInterval: 20000,
  });

  const respondMutation = useMutation({
    mutationFn: ({ reqId, action }: { reqId: string; action: string }) =>
      apiRequest("POST", `/api/clans/${clanId}/join-requests/${reqId}/respond`, { action }),
    onSuccess: (_, { action }) => {
      toast({ title: action === "approve" ? "Member added!" : "Request declined" });
      queryClient.invalidateQueries({ queryKey: [`/api/clans/${clanId}/join-requests`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clans/${clanId}/members`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clans/${clanId}`] });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  if (requests.length === 0) return null;

  return (
    <Card className="card-depth border-yellow-500/20 bg-yellow-500/5">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          Join Requests
          <Badge className="bg-yellow-500/20 text-yellow-400">{requests.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {requests.map(req => (
          <div key={req.id} className="flex items-center justify-between gap-3 bg-muted/20 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={req.profileImageUrl ?? undefined} />
                <AvatarFallback>{(req.username ?? req.firstName ?? "?")[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold">{req.username ?? req.firstName}</p>
                <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => respondMutation.mutate({ reqId: req.id, action: "approve" })}
                disabled={respondMutation.isPending} data-testid={`button-approve-request-${req.id}`}>
                <Check className="w-3 h-3 mr-1" /> Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => respondMutation.mutate({ reqId: req.id, action: "decline" })}
                disabled={respondMutation.isPending} data-testid={`button-decline-request-${req.id}`}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function ClanPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: clan, isLoading } = useQuery<Clan>({
    queryKey: [`/api/clans/${id}`],
    enabled: !!id,
  });

  const { data: members = [] } = useQuery<ClanMember[]>({
    queryKey: [`/api/clans/${id}/members`],
    enabled: !!id,
  });

  const { data: myClan } = useQuery<(Clan & { myRole?: string }) | null>({
    queryKey: ["/api/user/clan"],
    enabled: !!user,
  });

  const myMembership = members.find(m => m.userId === (user as any)?.id);
  const myRole = myMembership?.role ?? myClan?.myRole;
  const isInThisClan = myClan?.id === id;
  const canManage = isInThisClan && (myRole === "leader" || myRole === "officer");

  const joinMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/clans/${id}/join`, {}),
    onSuccess: (data: any) => {
      if (data.status === "requested") {
        toast({ title: "Join request sent!", description: "Wait for a leader to approve your request." });
      } else {
        toast({ title: "Joined clan!", description: "Welcome to the team!" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/user/clan"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clans"] });
      queryClient.invalidateQueries({ queryKey: [`/api/clans/${id}`] });
    },
    onError: (err: any) => toast({ title: "Failed to join", description: err.message, variant: "destructive" }),
  });

  const leaveMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/clans/${id}/leave`, {}),
    onSuccess: (data: any) => {
      if (data.disbanded) {
        toast({ title: "Clan disbanded", description: "You were the last member." });
        setLocation("/clans");
      } else {
        toast({ title: "Left clan" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/user/clan"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clans"] });
    },
    onError: (err: any) => toast({ title: "Failed to leave", description: err.message, variant: "destructive" }),
  });

  const disbandMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/clans/${id}`, {}),
    onSuccess: () => {
      toast({ title: "Clan disbanded" });
      queryClient.invalidateQueries({ queryKey: ["/api/user/clan"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clans"] });
      setLocation("/clans");
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppNavbar />
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
          <div className="h-56 bg-muted/20 rounded-2xl animate-pulse" />
          <div className="h-24 bg-muted/20 rounded-xl animate-pulse" />
          <div className="h-72 bg-muted/20 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!clan) {
    return (
      <div className="min-h-screen bg-background">
        <AppNavbar />
        <div className="max-w-5xl mx-auto px-4 py-20 text-center">
          <Shield className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <h2 className="text-xl font-bold">Clan not found</h2>
          <Link href="/clans"><Button className="mt-4">Browse Clans</Button></Link>
        </div>
      </div>
    );
  }

  const winRate = clan.totalMatchesPlayed > 0
    ? ((clan.totalMatchesWon / clan.totalMatchesPlayed) * 100).toFixed(1) : "0";

  const sortedMembers = [...members].sort((a, b) => b.matchesWonForClan - a.matchesWonForClan);
  const topEarner = sortedMembers[0];
  const avgRating = members.length > 0
    ? Math.round(members.reduce((s, m) => s + (m.rating ?? 1200), 0) / members.length) : 0;

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* Back */}
        <Link href="/clans">
          <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-4 h-4" /> All Clans
          </button>
        </Link>

        {/* ── HERO BANNER ────────────────────────────────────────── */}
        <div className="relative rounded-2xl overflow-hidden">
          {/* Banner background */}
          {clan.bannerUrl ? (
            <img src={clan.bannerUrl} alt="clan banner"
              className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#0e1033] via-[#0a0c22] to-[#050610]" />
          )}
          {/* Ambient glow orbs */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-20 -left-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 right-10 w-56 h-56 bg-blue-600/15 rounded-full blur-3xl" />
          </div>
          {/* Dark wash for text legibility */}
          <div className="absolute inset-0 bg-black/40" />

          {/* Content */}
          <div className="relative px-6 pt-8 pb-6 z-10">
            <div className="flex flex-col sm:flex-row gap-5 items-start">
              {/* Clan logo */}
              <div className="w-20 h-20 rounded-2xl border-2 border-white/20 bg-white/10 backdrop-blur-md
                flex items-center justify-center text-2xl font-black text-white shadow-xl shrink-0">
                {clan.logoUrl
                  ? <img src={clan.logoUrl} alt={clan.name} className="w-full h-full object-cover rounded-2xl" />
                  : clan.tag.slice(0, 2)}
              </div>

              {/* Name / info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-2xl font-black text-white tracking-tight">{clan.name}</h1>
                  <span className="text-sm font-mono text-white/60">[{clan.tag}]</span>
                  {!clan.isPublic && <Lock className="w-4 h-4 text-white/50" />}
                  <Badge className="bg-primary/30 text-primary-foreground border-primary/40 text-xs">
                    Level {clan.clanLevel}
                  </Badge>
                </div>

                {clan.description && (
                  <p className="text-sm text-white/70 mb-3 leading-relaxed max-w-xl">{clan.description}</p>
                )}

                <div className="flex flex-wrap gap-3 text-xs text-white/60">
                  <span className="flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5 text-yellow-400" />
                    Led by {clan.leader?.username ?? clan.leader?.firstName ?? "Unknown"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {clan.currentMemberCount}/{clan.memberLimit} members
                  </span>
                  <span className="flex items-center gap-1">
                    {clan.isPublic ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    {clan.isPublic ? "Public" : "Private"}{clan.requiresApproval ? " · Approval" : ""}
                  </span>
                </div>

                {/* XP bar */}
                <div className="mt-3 max-w-xs">
                  <XpBar xp={clan.clanXp} level={clan.clanLevel} />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 flex-wrap shrink-0">
                {isInThisClan && myRole === "leader" && (
                  <>
                    <EditClanModal clan={clan} onSaved={() => {}} />
                    <Button size="sm" variant="destructive" className="gap-1.5"
                      onClick={() => { if (confirm("Disband clan? This cannot be undone.")) disbandMutation.mutate(); }}
                      disabled={disbandMutation.isPending} data-testid="button-disband-clan">
                      <Trash2 className="w-3.5 h-3.5" /> Disband
                    </Button>
                  </>
                )}
                {isInThisClan && myRole !== "leader" && (
                  <Button size="sm" variant="outline" className="gap-1.5 border-white/20 text-white hover:bg-white/10"
                    onClick={() => { if (confirm("Leave this clan?")) leaveMutation.mutate(); }}
                    disabled={leaveMutation.isPending} data-testid="button-leave-clan">
                    <LogOut className="w-3.5 h-3.5" /> Leave
                  </Button>
                )}
                {!isInThisClan && !myClan && user && (
                  <Button size="sm" onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending}
                    data-testid="button-join-clan">
                    {joinMutation.isPending ? "Joining..." : clan.requiresApproval ? "Request to Join" : "Join Clan"}
                  </Button>
                )}
                {!isInThisClan && myClan && (
                  <Badge className="text-xs bg-white/10 text-white/60">Already in a clan</Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Join requests */}
        {canManage && <JoinRequestsSection clanId={id!} />}

        {/* ── STAT CARDS ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Season Points", value: clan.seasonPoints.toLocaleString(),
              icon: Star, color: "text-yellow-400", bg: "bg-yellow-500/10", glow: "shadow-yellow-500/10",
            },
            {
              label: "Total Matches", value: clan.totalMatchesPlayed,
              icon: Swords, color: "text-blue-400", bg: "bg-blue-500/10", glow: "shadow-blue-500/10",
            },
            {
              label: "Win Rate", value: `${winRate}%`,
              icon: Target, color: "text-green-400", bg: "bg-green-500/10", glow: "shadow-green-500/10",
            },
            {
              label: "Scalps Won", value: `${parseFloat(clan.totalScalpsWon).toFixed(0)} S`,
              icon: Trophy, color: "text-primary", bg: "bg-primary/10", glow: "shadow-primary/10",
            },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}>
              <Card className={`card-depth shadow-lg ${stat.glow}`}>
                <CardContent className="p-4 flex flex-col gap-2">
                  <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <p className="text-2xl font-black">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* ── TABS ───────────────────────────────────────────────── */}
        <Tabs defaultValue="overview">
          <TabsList className="flex flex-wrap h-auto p-1 gap-1 w-full sm:w-auto" data-testid="clan-tabs">
            <TabsTrigger value="overview" className="text-xs gap-1.5" data-testid="tab-overview">
              <Shield className="w-3.5 h-3.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="members" className="text-xs gap-1.5" data-testid="tab-members">
              <Users className="w-3.5 h-3.5" />
              Members
              <Badge className="text-[10px] ml-0.5">{clan.currentMemberCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs gap-1.5" data-testid="tab-activity">
              <Activity className="w-3.5 h-3.5" /> Activity
            </TabsTrigger>
            <TabsTrigger value="stats" className="text-xs gap-1.5" data-testid="tab-stats">
              <BarChart3 className="w-3.5 h-3.5" /> Stats
            </TabsTrigger>
            {isInThisClan && (
              <TabsTrigger value="chat" className="text-xs gap-1.5" data-testid="tab-chat">
                <MessageCircle className="w-3.5 h-3.5" /> Chat
              </TabsTrigger>
            )}
          </TabsList>

          {/* ── OVERVIEW ── */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Clan info */}
              <Card className="card-depth lg:col-span-1">
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" /> Clan Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2.5 text-sm">
                  {[
                    { label: "Founded", value: new Date(clan.createdAt).toLocaleDateString() },
                    { label: "Type", value: clan.isPublic ? "Public" : "Private" },
                    { label: "Level", value: `Level ${clan.clanLevel}` },
                    { label: "Avg Rating", value: avgRating.toLocaleString() },
                    { label: "Total XP", value: clan.clanXp.toLocaleString() },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between items-center">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium">{item.value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Top members panel */}
              <Card className="card-depth lg:col-span-2">
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Award className="w-4 h-4 text-yellow-400" /> Top Contributors
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  {sortedMembers.slice(0, 5).map((m, i) => {
                    const name = m.username ?? m.firstName;
                    const wr = m.matchesPlayedForClan > 0
                      ? Math.round((m.matchesWonForClan / m.matchesPlayedForClan) * 100) : 0;
                    return (
                      <Link key={m.userId} href={`/profile/${m.userId}`}>
                        <div className="flex items-center gap-3 hover-elevate rounded-lg p-2 cursor-pointer">
                          <span className={`text-xs font-bold w-6 text-center
                            ${i===0?"text-yellow-400":i===1?"text-slate-300":i===2?"text-amber-600":"text-muted-foreground"}`}>
                            #{i + 1}
                          </span>
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={m.profileImageUrl ?? undefined} />
                            <AvatarFallback className="text-xs">{name[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium flex-1 truncate">{name}</span>
                          <span className="text-xs text-muted-foreground">{m.matchesWonForClan}W</span>
                          <span className={`text-xs font-semibold ${wr>=50?"text-green-400":"text-red-400"}`}>{wr}%</span>
                        </div>
                      </Link>
                    );
                  })}
                  {sortedMembers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No members yet</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Achievements row */}
            <Card className="card-depth">
              <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-400" /> Clan Achievements
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Founded", desc: "Clan created", done: true, icon: Shield, color: "text-primary" },
                    { label: "First Victory", desc: "Win first match", done: clan.totalMatchesWon >= 1, icon: Swords, color: "text-blue-400" },
                    { label: "10 Wins", desc: "Win 10 matches", done: clan.totalMatchesWon >= 10, icon: Trophy, color: "text-yellow-400" },
                    { label: "Level 5", desc: "Reach Level 5", done: clan.clanLevel >= 5, icon: Zap, color: "text-purple-400" },
                    { label: "Full Roster", desc: "Reach 20+ members", done: clan.currentMemberCount >= 20, icon: Users, color: "text-green-400" },
                    { label: "100 Wins", desc: "Win 100 matches", done: clan.totalMatchesWon >= 100, icon: Award, color: "text-orange-400" },
                  ].map(ach => (
                    <div key={ach.label} className={`p-3 rounded-lg border flex items-start gap-2.5
                      ${ach.done ? "border-primary/20 bg-primary/5" : "border-white/5 bg-white/[0.02] opacity-50"}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                        ${ach.done ? "bg-primary/15" : "bg-white/5"}`}>
                        <ach.icon className={`w-4 h-4 ${ach.done ? ach.color : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold">{ach.label}</p>
                        <p className="text-[11px] text-muted-foreground">{ach.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── MEMBERS ── */}
          <TabsContent value="members" className="mt-4 space-y-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground">Ranked by wins for clan</p>
              <span className="text-xs text-muted-foreground">{clan.currentMemberCount}/{clan.memberLimit} spots filled</span>
            </div>
            {sortedMembers.map((m, i) => (
              <MemberCard key={m.userId} member={m} myRole={isInThisClan ? myRole : undefined}
                clanId={id!} currentUserId={(user as any)?.id} rank={i + 1} />
            ))}
            {members.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No members yet</p>
              </div>
            )}
          </TabsContent>

          {/* ── ACTIVITY ── */}
          <TabsContent value="activity" className="mt-4">
            <ActivityFeed clan={clan} members={members} />
          </TabsContent>

          {/* ── STATS ── */}
          <TabsContent value="stats" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Performance panel */}
              <Card className="card-depth">
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-400" /> Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  {[
                    { label: "Matches Won", value: clan.totalMatchesWon, total: clan.totalMatchesPlayed, color: "bg-green-500" },
                    { label: "Win Rate", value: parseFloat(winRate), total: 100, suffix: "%", color: "bg-blue-500" },
                  ].map(item => (
                    <div key={item.label} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-medium">{item.value}{item.suffix ?? ""}</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${item.color}`}
                          style={{ width: `${item.total > 0 ? Math.min((item.value / item.total) * 100, 100) : 0}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Total Losses</p>
                      <p className="text-lg font-bold text-red-400">{clan.totalMatchesLost}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Avg Skill</p>
                      <p className="text-lg font-bold">{avgRating}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Financials panel */}
              <Card className="card-depth">
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-yellow-400" /> Financials
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3 text-sm">
                  {[
                    { label: "Total Scalps Won", value: `${parseFloat(clan.totalScalpsWon).toFixed(2)} S`, color: "text-green-400" },
                    { label: "Total Scalps Lost", value: `${parseFloat(clan.totalScalpsLost).toFixed(2)} S`, color: "text-red-400" },
                    {
                      label: "Net Profit", color: parseFloat(clan.totalScalpsWon) - parseFloat(clan.totalScalpsLost) >= 0 ? "text-green-400" : "text-red-400",
                      value: `${(parseFloat(clan.totalScalpsWon) - parseFloat(clan.totalScalpsLost)).toFixed(2)} S`,
                    },
                    { label: "Season Points", value: clan.seasonPoints.toLocaleString(), color: "text-yellow-400" },
                    { label: "Top Earner", value: topEarner ? (topEarner.username ?? topEarner.firstName) : "—", color: "text-primary" },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between items-center">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className={`font-semibold ${item.color}`}>{item.value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── CHAT ── */}
          {isInThisClan && (
            <TabsContent value="chat" className="mt-4">
              <ClanChat clanId={id!} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
