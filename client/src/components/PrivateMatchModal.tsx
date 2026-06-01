import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Lock, Copy, Check, Gamepad2, Link2, Monitor, Smartphone } from "lucide-react";
import { ScalpsIcon } from "@/components/ScalpsIcon";
import { useLocation } from "wouter";
import { useDeviceType } from "@/hooks/useDeviceType";

const GAME_OPTIONS = [
  { value: "chess",                label: "Chess" },
  { value: "mini-golf",            label: "Mini Golf" },
  { value: "connect-4",            label: "Connect 4" },
  { value: "air-hockey",           label: "Air Hockey" },
  { value: "rock-paper-scissors",  label: "Rock Paper Scissors" },
  { value: "dots-and-boxes",       label: "Dots & Boxes" },
  { value: "8-ball",               label: "8-Ball Pool" },
  { value: "bowling",              label: "Bowling" },
  { value: "cup-king",             label: "Cup King" },
  { value: "stack-tower",          label: "Stack Tower" },
];

interface PrivateMatchModalProps {
  open: boolean;
  onClose: () => void;
}

export function PrivateMatchModal({ open, onClose }: PrivateMatchModalProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const deviceType = useDeviceType();
  const [gameType, setGameType] = useState("chess");
  const [wager, setWager] = useState("0");
  const [inviteCode, setInviteCode] = useState("");
  const [matchId, setMatchId] = useState("");
  const [copied, setCopied] = useState(false);

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/matches/private", { gameType, wager, deviceType }),
    onSuccess: (data: any) => {
      setInviteCode(data.inviteCode);
      setMatchId(data.matchId);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create private match", variant: "destructive" });
    },
  });

  const copyCode = () => {
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const copyLink = () => {
    const link = `${window.location.origin}/join/${inviteCode}`;
    navigator.clipboard.writeText(link).then(() => {
      toast({ title: "Link copied!", description: "Share this link with your friend" });
    });
  };

  const goToMatch = () => {
    setLocation(`/game/${matchId}`);
    onClose();
  };

  const handleClose = () => {
    setInviteCode("");
    setMatchId("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto" style={{ background: "linear-gradient(135deg, #0d1225, #1a0d2e)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Lock className="w-5 h-5 text-primary" />
            Private Match
          </DialogTitle>
          <DialogDescription className="text-white/50">
            Create a private room and share the invite code with a friend.
          </DialogDescription>
        </DialogHeader>

        {inviteCode ? (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/20 border border-primary/30 mb-3">
                <Lock className="w-7 h-7 text-primary" />
              </div>
              <p className="text-sm text-white/50 mb-1">Your invite code</p>
              <div className="text-3xl font-black font-mono text-white tracking-widest mb-4">{inviteCode}</div>
              <p className="text-xs text-white/30 mb-4">Share this code — your friend enters it at the lobby to join</p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Button variant="outline" className="gap-2 border-white/20 text-white/70" onClick={copyCode}
                  data-testid="button-copy-code">
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy Code"}
                </Button>
                <Button variant="outline" className="gap-2 border-white/20 text-white/70" onClick={copyLink}
                  data-testid="button-copy-link">
                  <Link2 className="w-4 h-4" /> Copy Link
                </Button>
              </div>
            </div>
            <Button className="w-full" onClick={goToMatch} data-testid="button-go-to-match">
              Go to Match Room
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wide">Game</p>
              <Select value={gameType} onValueChange={setGameType}>
                <SelectTrigger className="bg-white/5 border-white/15 text-white/90" data-testid="select-game-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GAME_OPTIONS.map(g => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wide">Wager (optional)</p>
              <div className="relative">
                <ScalpsIcon size="xs" className="absolute left-3 top-1/2 -translate-y-1/2 z-10" />
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={wager}
                  onChange={e => setWager(e.target.value)}
                  className="pl-8 bg-white/5 border-white/15 text-white/90"
                  placeholder="0 = free match"
                  data-testid="input-wager"
                />
              </div>
              {parseFloat(wager) > 0 && (
                <p className="text-[11px] text-white/40 mt-1.5 flex items-center gap-1">
                  <ScalpsIcon size="xs" /> {parseFloat(wager).toFixed(2)} S will be deducted. Your friend must match.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/8">
              <Gamepad2 className="w-4 h-4 text-primary/60 shrink-0" />
              <p className="text-xs text-white/50">The match will start when your friend joins with the code.</p>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/8">
              {deviceType === "mobile" ? <Smartphone className="w-4 h-4 text-blue-400 shrink-0" /> : <Monitor className="w-4 h-4 text-slate-400 shrink-0" />}
              <p className="text-xs text-white/50">This match will be {deviceType}-only. Your friend must join from a {deviceType} device.</p>
            </div>

            <Button
              className="w-full gap-2"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate()}
              data-testid="button-create-private"
            >
              <Lock className="w-4 h-4" />
              {createMutation.isPending ? "Creating…" : "Create Private Room"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
