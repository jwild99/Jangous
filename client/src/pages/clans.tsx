import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { AppNavbar } from "@/components/AppNavbar";
import { PageDepthBackground } from "@/components/PageDepthBackground";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Search, Plus, Users, Trophy, Shield, Crown, Swords, Star, Lock, Globe, Bell } from "lucide-react";
import { motion } from "framer-motion";

interface Clan {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  logoUrl: string | null;
  currentMemberCount: number;
  memberLimit: number;
  clanLevel: number;
  totalMatchesWon: number;
  totalMatchesPlayed: number;
  seasonPoints: number;
  totalScalpsWon: string;
  isPublic: boolean;
  requiresApproval: boolean;
  createdAt: string;
}

function ClanCard({ clan, myClanId }: { clan: Clan; myClanId?: string }) {
  const winRate = clan.totalMatchesPlayed > 0
    ? Math.round((clan.totalMatchesWon / clan.totalMatchesPlayed) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Link href={`/clans/${clan.id}`}>
        <Card className="hover-elevate cursor-pointer h-full card-depth" data-testid={`clan-card-${clan.id}`}>
          <CardContent className="p-4 flex flex-col gap-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center text-lg font-bold text-primary shrink-0">
                  {clan.logoUrl ? (
                    <img src={clan.logoUrl} alt={clan.name} className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    clan.tag.slice(0, 2)
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm">{clan.name}</span>
                    {!clan.isPublic && <Lock className="w-3 h-3 text-muted-foreground" />}
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">[{clan.tag}]</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">
                  Lv {clan.clanLevel}
                </Badge>
                {clan.requiresApproval && (
                  <Badge className="text-[10px] bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                    Approval
                  </Badge>
                )}
              </div>
            </div>

            {/* Description */}
            {clan.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{clan.description}</p>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/5">
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">Members</p>
                <p className="text-sm font-bold">{clan.currentMemberCount}<span className="text-[10px] text-muted-foreground">/{clan.memberLimit}</span></p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">Win Rate</p>
                <p className="text-sm font-bold text-green-400">{winRate}%</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">Season Pts</p>
                <p className="text-sm font-bold text-yellow-400">{clan.seasonPoints.toLocaleString()}</p>
              </div>
            </div>

            {/* Join button */}
            {myClanId !== clan.id && (
              <Button size="sm" variant="outline" className="w-full text-xs mt-1" data-testid={`button-join-${clan.id}`}>
                {clan.requiresApproval ? "Request to Join" : "Join Clan"}
              </Button>
            )}
            {myClanId === clan.id && (
              <Button size="sm" className="w-full text-xs mt-1" variant="secondary">
                <Crown className="w-3 h-3 mr-1" /> My Clan
              </Button>
            )}
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

function CreateClanModal({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", tag: "", description: "", isPublic: true, requiresApproval: false, memberLimit: "50",
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => apiRequest("POST", "/api/clans", data),
    onSuccess: () => {
      toast({ title: "Clan created!", description: "You are now the leader of your new clan." });
      queryClient.invalidateQueries({ queryKey: ["/api/clans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/clan"] });
      setOpen(false);
      onCreated();
    },
    onError: (err: any) => toast({ title: "Failed to create clan", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-create-clan">
          <Plus className="w-4 h-4" /> Create Clan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md modal-entrance" data-testid="dialog-create-clan">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" /> Create a Clan
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="clan-name">Clan Name *</Label>
              <Input id="clan-name" placeholder="e.g. Neon Wolves" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                maxLength={40} data-testid="input-clan-name" />
            </div>
            <div>
              <Label htmlFor="clan-tag">Tag (2-5 chars) *</Label>
              <Input id="clan-tag" placeholder="NW" value={form.tag}
                onChange={e => setForm(f => ({ ...f, tag: e.target.value.toUpperCase() }))}
                maxLength={5} data-testid="input-clan-tag" />
            </div>
            <div>
              <Label htmlFor="clan-limit">Member Limit</Label>
              <Input id="clan-limit" type="number" min="5" max="100" value={form.memberLimit}
                onChange={e => setForm(f => ({ ...f, memberLimit: e.target.value }))}
                data-testid="input-clan-limit" />
            </div>
            <div className="col-span-2">
              <Label htmlFor="clan-desc">Description</Label>
              <Textarea id="clan-desc" placeholder="Tell players about your clan..." value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                maxLength={300} className="resize-none h-20" data-testid="input-clan-description" />
            </div>
          </div>

          <div className="space-y-3 rounded-lg bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Public Clan</p>
                <p className="text-xs text-muted-foreground">Anyone can find and join</p>
              </div>
              <Switch checked={form.isPublic} onCheckedChange={v => setForm(f => ({ ...f, isPublic: v }))}
                data-testid="switch-clan-public" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Require Approval</p>
                <p className="text-xs text-muted-foreground">Approve join requests manually</p>
              </div>
              <Switch checked={form.requiresApproval} onCheckedChange={v => setForm(f => ({ ...f, requiresApproval: v }))}
                data-testid="switch-clan-approval" />
            </div>
          </div>

          <Button className="w-full" onClick={() => createMutation.mutate(form)}
            disabled={createMutation.isPending || !form.name.trim() || form.tag.length < 2}
            data-testid="button-submit-create-clan">
            {createMutation.isPending ? "Creating..." : "Create Clan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PendingInvites() {
  const { toast } = useToast();
  const { data: invites = [] } = useQuery<any[]>({ queryKey: ["/api/user/clan-invites"] });

  const respondMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      apiRequest("POST", `/api/clan-invites/${id}/respond`, { action }),
    onSuccess: (_, { action }) => {
      toast({ title: action === "accept" ? "Joined clan!" : "Invite declined" });
      queryClient.invalidateQueries({ queryKey: ["/api/user/clan-invites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/clan"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clans"] });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  if (invites.length === 0) return null;

  return (
    <Card className="card-depth border-primary/20 bg-primary/5">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" /> Pending Clan Invites
          <Badge className="ml-1">{invites.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {invites.map(inv => (
          <div key={inv.id} className="flex items-center justify-between gap-3 bg-muted/20 rounded-lg p-3">
            <div>
              <p className="text-sm font-semibold">[{inv.clanTag}] {inv.clanName}</p>
              <p className="text-xs text-muted-foreground">Invited by {inv.inviterUsername}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => respondMutation.mutate({ id: inv.id, action: "accept" })}
                disabled={respondMutation.isPending} data-testid={`button-accept-invite-${inv.id}`}>
                Accept
              </Button>
              <Button size="sm" variant="outline" onClick={() => respondMutation.mutate({ id: inv.id, action: "decline" })}
                disabled={respondMutation.isPending} data-testid={`button-decline-invite-${inv.id}`}>
                Decline
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function ClansPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { data: clans = [], isLoading } = useQuery<Clan[]>({
    queryKey: ["/api/clans", debouncedSearch],
    queryFn: () => fetch(`/api/clans?search=${encodeURIComponent(debouncedSearch)}&limit=24`).then(r => r.json()),
  });

  const { data: myClan } = useQuery<(Clan & { myRole: string }) | null>({
    queryKey: ["/api/user/clan"],
    enabled: !!user,
  });

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((window as any)._clanSearchTimer);
    (window as any)._clanSearchTimer = setTimeout(() => setDebouncedSearch(val), 300);
  };

  return (
    <div className="min-h-screen glass-bg relative">
      <PageDepthBackground
        glowZones={[
          { x: "20%", y: "5%",  color: "99,102,241",  size: "50%", opacity: 0.07 },
          { x: "80%", y: "15%", color: "139,92,246",  size: "40%", opacity: 0.05 },
          { x: "50%", y: "70%", color: "59,130,246",  size: "35%", opacity: 0.04 },
        ]}
        particleCount={15}
      />
      <AppNavbar />
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" /> Clans
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Join a team, compete together, dominate the leaderboard</p>
          </div>
          <div className="flex gap-2">
            {user && !myClan && <CreateClanModal onCreated={() => queryClient.invalidateQueries({ queryKey: ["/api/clans"] })} />}
            {myClan && (
              <Link href={`/clans/${myClan.id}`}>
                <Button variant="outline" className="gap-2">
                  <Crown className="w-4 h-4 text-yellow-400" /> My Clan
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Pending invites */}
        {user && <PendingInvites />}

        {/* My clan banner */}
        {myClan && (
          <Card className="card-depth bg-primary/5 border-primary/20">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold">
                {myClan.tag.slice(0, 2)}
              </div>
              <div className="flex-1">
                <p className="font-bold">[{myClan.tag}] {myClan.name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  Your role: {myClan.myRole} · {myClan.currentMemberCount} members
                </p>
              </div>
              <Link href={`/clans/${myClan.id}`}>
                <Button size="sm">View Clan</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search clans by name or tag..." value={search}
            onChange={e => handleSearch(e.target.value)} className="pl-9"
            data-testid="input-clan-search" />
        </div>

        {/* Clan grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-48 rounded-xl bg-muted/20 animate-pulse" />)}
          </div>
        ) : clans.length === 0 ? (
          <div className="text-center py-20">
            <Shield className="w-14 h-14 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-lg font-semibold text-muted-foreground">No clans found</p>
            <p className="text-sm text-muted-foreground/60 mt-1 mb-6">
              {search ? "Try a different search term" : "Be the first to create a clan!"}
            </p>
            {user && !myClan && !search && (
              <CreateClanModal onCreated={() => queryClient.invalidateQueries({ queryKey: ["/api/clans"] })} />
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clans.map(clan => (
              <ClanCard key={clan.id} clan={clan} myClanId={myClan?.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
