import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { AppNavbar } from "@/components/AppNavbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Crown, Users, Copy, Check, LogOut, Send, Zap, ChevronRight,
  Shield, Swords, Clock, UserX, Gamepad2, DollarSign, Share2, Plus,
} from "lucide-react";
import { ScalpsIcon } from "@/components/ScalpsIcon";

const GAME_OPTIONS = [
  { value: "chess", label: "Chess" },
  { value: "mini-golf", label: "Mini Golf" },
  { value: "connect-4", label: "Connect 4" },
  { value: "air-hockey", label: "Air Hockey" },
  { value: "rock-paper-scissors", label: "Rock Paper Scissors" },
  { value: "8-ball", label: "8-Ball Pool" },
  { value: "bowling", label: "Bowling" },
  { value: "dots-and-boxes", label: "Dots & Boxes" },
  { value: "block-blast", label: "Block Blast" },
  { value: "cup-king", label: "Cup King" },
  { value: "stack-tower", label: "Stack Tower" },
];

const BET_OPTIONS = ["0", "5", "10", "25", "50", "100"];

interface PartyMemberDisplay {
  id: string;
  userId: string;
  role: string;
  isReady: boolean;
  joinedAt: string;
  user: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    reputation: number;
  };
}

interface PartyMessageDisplay {
  id: string;
  partyId: string;
  authorId: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    username: string | null;
    firstName: string | null;
    profileImageUrl: string | null;
  };
}

interface PartyData {
  id: string;
  name: string;
  leaderId: string;
  inviteCode: string;
  gameType: string | null;
  betAmount: string;
  status: string;
  maxSize: number;
  members: PartyMemberDisplay[];
  messages: PartyMessageDisplay[];
}

function memberName(m: PartyMemberDisplay): string {
  return m.user.username ?? m.user.firstName ?? "Player";
}

function authorName(a: PartyMessageDisplay["author"]): string {
  return a.username ?? a.firstName ?? "Player";
}

// ─── Create Party Modal ───────────────────────────────────────────────────────
function CreatePartyModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [maxSize, setMaxSize] = useState("4");

  const create = useMutation({
    mutationFn: () => apiRequest("POST", "/api/parties", { name, maxSize: parseInt(maxSize) }),
    onSuccess: async (res) => {
      const data = await res.json();
      toast({ title: "Party created!" });
      onCreated(data.id);
    },
    onError: async (err: any) => {
      const data = await err.response?.json?.() ?? {};
      if (data.partyId) { onCreated(data.partyId); return; }
      toast({ title: "Failed to create party", description: data.message, variant: "destructive" });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <Card className="card-depth bg-card/90 backdrop-blur border border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Create Party
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Party Name</label>
              <Input
                data-testid="input-party-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Friday Night Crew"
                maxLength={50}
                onKeyDown={e => e.key === "Enter" && name.trim() && create.mutate()}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Max Size</label>
              <Select value={maxSize} onValueChange={setMaxSize}>
                <SelectTrigger data-testid="select-max-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 6, 8].map(n => (
                    <SelectItem key={n} value={String(n)}>{n} players</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={onClose} className="flex-1" data-testid="button-cancel-party">Cancel</Button>
              <Button
                onClick={() => create.mutate()}
                disabled={!name.trim() || create.isPending}
                className="flex-1"
                data-testid="button-create-party"
              >
                {create.isPending ? "Creating…" : "Create Party"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ─── Join by Code Modal ───────────────────────────────────────────────────────
function JoinByCodeModal({ onClose, onJoined }: { onClose: () => void; onJoined: (id: string) => void }) {
  const { toast } = useToast();
  const [code, setCode] = useState("");

  const join = useMutation({
    mutationFn: () => apiRequest("POST", `/api/parties/join/code/${code.trim().toUpperCase()}`),
    onSuccess: async (res) => {
      const data = await res.json();
      toast({ title: "Joined party!" });
      onJoined(data.id);
    },
    onError: async (err: any) => {
      const data = await err.response?.json?.() ?? {};
      toast({ title: "Failed to join", description: data.message, variant: "destructive" });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm"
      >
        <Card className="card-depth bg-card/90 backdrop-blur border border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="w-4 h-4 text-violet-400" />
              Join by Invite Code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              data-testid="input-invite-code"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="8-character code"
              maxLength={8}
              className="text-center text-lg font-mono tracking-widest"
              onKeyDown={e => e.key === "Enter" && code.length === 8 && join.mutate()}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="flex-1" data-testid="button-cancel-join">Cancel</Button>
              <Button
                onClick={() => join.mutate()}
                disabled={code.length < 4 || join.isPending}
                className="flex-1"
                data-testid="button-join-code"
              >
                {join.isPending ? "Joining…" : "Join"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ─── Party Lobby ──────────────────────────────────────────────────────────────
function PartyLobby({ partyId }: { partyId: string }) {
  const { user } = useAuth();
  const userId = (user as any)?.id;
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const { data: party, isLoading } = useQuery<PartyData>({
    queryKey: ["/api/parties", partyId],
    queryFn: async () => {
      const res = await fetch(`/api/parties/${partyId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load party");
      return res.json();
    },
    refetchInterval: 2000,
  });

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [party?.messages.length]);

  const isLeader = party?.leaderId === userId;
  const myMember = party?.members.find(m => m.userId === userId);
  const allReady = party?.members.length ? party.members.every(m => m.isReady || m.role === "leader") : false;

  const toggleReady = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/parties/${partyId}/ready`, { isReady: !myMember?.isReady }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/parties", partyId] }),
  });

  const setGame = useMutation({
    mutationFn: (data: { gameType: string; betAmount: string }) =>
      apiRequest("PATCH", `/api/parties/${partyId}/game`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/parties", partyId] }),
  });

  const kickMember = useMutation({
    mutationFn: (targetUserId: string) =>
      apiRequest("POST", `/api/parties/${partyId}/kick/${targetUserId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parties", partyId] });
      toast({ title: "Member removed" });
    },
  });

  const leave = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/parties/${partyId}/leave`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parties/mine"] });
      setLocation("/");
      toast({ title: "Left party" });
    },
  });

  const sendMsg = useMutation({
    mutationFn: () => apiRequest("POST", `/api/parties/${partyId}/messages`, { content: message }),
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/parties", partyId] });
    },
  });

  const startGame = useMutation({
    mutationFn: () => apiRequest("POST", "/api/matches", {
      gameType: party?.gameType,
      betAmount: party?.betAmount ?? "0",
    }),
    onSuccess: async (res) => {
      const data = await res.json();
      const matchId = data.match?.id ?? data.id;
      setLocation(`/game/${matchId}`);
    },
    onError: () => toast({ title: "Failed to start game", variant: "destructive" }),
  });

  const copyCode = () => {
    navigator.clipboard.writeText(party?.inviteCode ?? "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const shareLink = () => {
    const url = `${window.location.origin}/party/join/${party?.inviteCode}`;
    if (navigator.share) {
      navigator.share({ title: "Join my Jango.us party!", url });
    } else {
      navigator.clipboard.writeText(url).then(() => toast({ title: "Link copied!" }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!party) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Party not found or disbanded.</p>
        <Button onClick={() => setLocation("/")} data-testid="button-go-home">Go Home</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 pb-24 md:pb-4 grid grid-cols-1 md:grid-cols-[1fr_340px] gap-4">
      {/* Left: Members + Controls */}
      <div className="flex flex-col gap-4">
        {/* Header */}
        <Card className="card-depth bg-card/80 border border-white/10">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <h1 className="text-lg font-bold flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  {party.name}
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {party.members.length}/{party.maxSize} members
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-muted/40 rounded-md px-3 py-1.5 border border-white/10">
                  <span className="font-mono text-sm font-bold tracking-widest text-blue-300">{party.inviteCode}</span>
                  <Button size="icon" variant="ghost" onClick={copyCode} className="h-6 w-6" data-testid="button-copy-code">
                    {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
                <Button size="icon" variant="outline" onClick={shareLink} data-testid="button-share-party">
                  <Share2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => leave.mutate()}
                  disabled={leave.isPending}
                  data-testid="button-leave-party"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1" />
                  Leave
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Members List */}
        <Card className="card-depth bg-card/80 border border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Members</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {party.members.map(m => (
              <motion.div
                key={m.userId}
                layout
                className="flex items-center gap-3 p-2.5 rounded-md bg-muted/30 hover-elevate"
              >
                <div className="relative">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={m.user.profileImageUrl ?? ""} />
                    <AvatarFallback className="text-xs">{memberName(m)[0]}</AvatarFallback>
                  </Avatar>
                  {m.role === "leader" && (
                    <Crown className="w-3.5 h-3.5 text-yellow-400 absolute -top-1 -right-1" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{memberName(m)}</p>
                  <p className="text-xs text-muted-foreground">{m.role === "leader" ? "Leader" : "Member"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-xs ${m.isReady || m.role === "leader" ? "border-green-500/40 text-green-400" : "border-yellow-500/40 text-yellow-400"}`}
                    data-testid={`status-ready-${m.userId}`}
                  >
                    {m.isReady || m.role === "leader" ? "Ready" : "Not Ready"}
                  </Badge>
                  {isLeader && m.userId !== userId && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => kickMember.mutate(m.userId)}
                      className="h-7 w-7 text-muted-foreground"
                      data-testid={`button-kick-${m.userId}`}
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
            {party.members.length < party.maxSize && (
              <div className="border border-dashed border-white/10 rounded-md p-3 text-center text-xs text-muted-foreground">
                Waiting for more players… ({party.maxSize - party.members.length} spots open)
              </div>
            )}
          </CardContent>
        </Card>

        {/* Game Selection — leader only */}
        {isLeader && (
          <Card className="card-depth bg-card/80 border border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Gamepad2 className="w-4 h-4" />
                Game Selection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select
                value={party.gameType ?? ""}
                onValueChange={v => setGame.mutate({ gameType: v, betAmount: party.betAmount ?? "0" })}
              >
                <SelectTrigger data-testid="select-game-type">
                  <SelectValue placeholder="Choose a game…" />
                </SelectTrigger>
                <SelectContent>
                  {GAME_OPTIONS.map(g => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> Wager per player (Scalps)
                </label>
                <Select
                  value={party.betAmount ?? "0"}
                  onValueChange={v => party.gameType && setGame.mutate({ gameType: party.gameType!, betAmount: v })}
                >
                  <SelectTrigger data-testid="select-bet-amount">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BET_OPTIONS.map(b => (
                      <SelectItem key={b} value={b}>{b === "0" ? "No wager" : `${b} Scalps`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current game shown to non-leaders */}
        {!isLeader && party.gameType && (
          <Card className="card-depth bg-muted/30 border border-white/10">
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <Gamepad2 className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-sm font-medium">
                  {GAME_OPTIONS.find(g => g.value === party.gameType)?.label ?? party.gameType}
                </p>
                <p className="text-xs text-muted-foreground">
                  {party.betAmount && parseFloat(party.betAmount) > 0 ? `${party.betAmount} Scalps per player` : "No wager"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!isLeader && (
            <Button
              onClick={() => toggleReady.mutate()}
              disabled={toggleReady.isPending}
              variant={myMember?.isReady ? "outline" : "default"}
              className="flex-1"
              data-testid="button-toggle-ready"
            >
              {myMember?.isReady ? "Not Ready" : "Ready Up"}
            </Button>
          )}
          {isLeader && party.gameType && (
            <Button
              onClick={() => startGame.mutate()}
              disabled={!allReady || startGame.isPending || party.members.length < 2}
              className="flex-1 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500"
              data-testid="button-start-game"
            >
              <Swords className="w-4 h-4 mr-2" />
              {allReady ? "Start Game!" : `Waiting for ready (${party.members.filter(m => m.isReady || m.role === "leader").length}/${party.members.length})`}
            </Button>
          )}
        </div>
      </div>

      {/* Right: Party Chat */}
      <Card className="card-depth bg-card/80 border border-white/10 flex flex-col h-[50vh] md:h-[600px]">
        <CardHeader className="pb-2 border-b border-white/10">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Party Chat</CardTitle>
        </CardHeader>
        <div
          ref={chatRef}
          className="flex-1 overflow-y-auto p-3 space-y-2"
          data-testid="party-chat-messages"
        >
          {party.messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">No messages yet. Say hi!</p>
          )}
          {party.messages.map(msg => (
            <div key={msg.id} className={`flex gap-2 ${msg.authorId === userId ? "flex-row-reverse" : ""}`}>
              <Avatar className="h-6 w-6 flex-shrink-0">
                <AvatarImage src={msg.author.profileImageUrl ?? ""} />
                <AvatarFallback className="text-xs">{authorName(msg.author)[0]}</AvatarFallback>
              </Avatar>
              <div className={`max-w-[75%] ${msg.authorId === userId ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                <span className="text-xs text-muted-foreground">{authorName(msg.author)}</span>
                <div className={`rounded-md px-2.5 py-1.5 text-sm ${msg.authorId === userId ? "bg-blue-600/30 border border-blue-500/20" : "bg-muted/40 border border-white/5"}`}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-white/10 flex gap-2">
          <Input
            data-testid="input-party-message"
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Type a message…"
            maxLength={500}
            onKeyDown={e => {
              if (e.key === "Enter" && message.trim() && !sendMsg.isPending) {
                sendMsg.mutate();
              }
            }}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={() => message.trim() && sendMsg.mutate()}
            disabled={!message.trim() || sendMsg.isPending}
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ─── Party Hub (create / join) ────────────────────────────────────────────────
function PartyHub() {
  const [, setLocation] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const { data: myParty } = useQuery<PartyData | null>({
    queryKey: ["/api/parties/mine"],
    queryFn: async () => {
      const res = await fetch("/api/parties/mine", { credentials: "include" });
      if (!res.ok) return null;
      const d = await res.json();
      return d;
    },
  });

  useEffect(() => {
    if (myParty?.id && myParty.status !== "disbanded") {
      setLocation(`/party/${myParty.id}`);
    }
  }, [myParty]);

  return (
    <div className="max-w-lg mx-auto p-6 flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
          <Users className="w-6 h-6 text-blue-400" />
          Party
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Play together with friends</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <motion.div whileHover={{ scale: 1.01 }}>
          <Card
            className="bg-card/80 border border-white/10 cursor-pointer hover-elevate"
            onClick={() => setShowCreate(true)}
            data-testid="card-create-party"
          >
            <CardContent className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-md bg-blue-500/20 flex items-center justify-center">
                <Plus className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Create a Party</p>
                <p className="text-xs text-muted-foreground">Invite friends and pick your game</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div whileHover={{ scale: 1.01 }}>
          <Card
            className="bg-card/80 border border-white/10 cursor-pointer hover-elevate"
            onClick={() => setShowJoin(true)}
            data-testid="card-join-party"
          >
            <CardContent className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-md bg-violet-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-violet-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Join by Code</p>
                <p className="text-xs text-muted-foreground">Enter an 8-character invite code</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {showCreate && (
        <CreatePartyModal
          onClose={() => setShowCreate(false)}
          onCreated={id => { setShowCreate(false); setLocation(`/party/${id}`); }}
        />
      )}
      {showJoin && (
        <JoinByCodeModal
          onClose={() => setShowJoin(false)}
          onJoined={id => { setShowJoin(false); setLocation(`/party/${id}`); }}
        />
      )}
    </div>
  );
}

// ─── Page Entry ───────────────────────────────────────────────────────────────
export default function PartyPage() {
  const { id } = useParams<{ id?: string }>();

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <main className="container mx-auto py-6 px-4 pb-24 md:pb-6">
        {id ? <PartyLobby partyId={id} /> : <PartyHub />}
      </main>
    </div>
  );
}
