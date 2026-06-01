import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Hash, Search, Gamepad2, ArrowRight, X, CheckCircle2, Monitor, Smartphone } from "lucide-react";
import { ScalpsIcon } from "@/components/ScalpsIcon";
import { useDeviceType } from "@/hooks/useDeviceType";

const GAME_LABELS: Record<string, string> = {
  chess: "Chess", "mini-golf": "Mini Golf", "connect-4": "Connect 4",
  "air-hockey": "Air Hockey", "rock-paper-scissors": "Rock Paper Scissors",
  "dots-and-boxes": "Dots & Boxes", "8-ball": "8-Ball Pool",
  bowling: "Bowling", "cup-king": "Cup King", "stack-tower": "Stack Tower",
};

interface JoinPrivateMatchModalProps {
  open: boolean;
  onClose: () => void;
}

export function JoinPrivateMatchModal({ open, onClose }: JoinPrivateMatchModalProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const deviceType = useDeviceType();
  const [code, setCode] = useState("");
  const [lookupCode, setLookupCode] = useState("");
  const [joining, setJoining] = useState(false);

  const { data: matchPreview, isLoading: previewLoading, error: previewError } = useQuery<any>({
    queryKey: ["/api/matches/private", lookupCode],
    queryFn: async () => {
      const res = await fetch(`/api/matches/private/${lookupCode}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Invalid code");
      }
      return res.json();
    },
    enabled: lookupCode.length >= 6,
    retry: false,
  });

  const joinMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/matches/${matchPreview.id}/join`, { deviceType }),
    onSuccess: () => {
      setLocation(`/game/${matchPreview.id}`);
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Couldn't join", description: err.message || "Failed to join match", variant: "destructive" });
    },
  });

  const handleCodeInput = (val: string) => {
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    setCode(clean);
    if (clean.length >= 6) {
      setLookupCode(clean);
    } else {
      setLookupCode("");
    }
  };

  const handleClose = () => {
    setCode("");
    setLookupCode("");
    onClose();
  };

  const wager = matchPreview ? parseFloat(matchPreview.pot_amount || "0") : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto" style={{ background: "linear-gradient(135deg, #0d1225, #1a0d2e)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Hash className="w-5 h-5 text-primary" />
            Join Private Match
          </DialogTitle>
          <DialogDescription className="text-white/50">
            Enter the invite code shared by your friend.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-xs text-white/40 mb-2 font-medium uppercase tracking-wide">Invite Code</p>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                value={code}
                onChange={e => handleCodeInput(e.target.value)}
                placeholder="Enter code (e.g. A1B2C3D)"
                className="pl-9 bg-white/5 border-white/15 text-white/90 text-center text-xl font-mono font-black tracking-[0.3em] uppercase placeholder:text-white/20 placeholder:text-sm placeholder:tracking-normal placeholder:font-normal h-14"
                maxLength={8}
                data-testid="input-invite-code"
              />
              {code && (
                <button onClick={() => { setCode(""); setLookupCode(""); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-white/30" />
                </button>
              )}
            </div>
          </div>

          {/* Match Preview */}
          {code.length >= 6 && (
            <div className="rounded-xl border border-white/10 overflow-hidden">
              {previewLoading && (
                <div className="p-4 text-center">
                  <div className="w-5 h-5 border-2 border-primary/50 border-t-primary rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs text-white/40">Looking up match…</p>
                </div>
              )}
              {previewError && !previewLoading && (
                <div className="p-4 text-center">
                  <X className="w-6 h-6 text-red-400 mx-auto mb-1.5" />
                  <p className="text-sm font-semibold text-red-400">Invalid or expired code</p>
                  <p className="text-xs text-white/30 mt-1">Double-check the code and try again</p>
                </div>
              )}
              {matchPreview && !previewError && (
                <div className="p-4 bg-white/4">
                  <div className="flex items-center gap-1.5 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-green-400 font-semibold">Match found!</span>
                  </div>
                  {(() => {
                    const matchDevice = matchPreview.device_type ?? "desktop";
                    const isMismatch = matchDevice !== deviceType;
                    return isMismatch ? (
                      <div className="flex items-center gap-2 p-2.5 mb-3 rounded-lg bg-red-500/10 border border-red-500/30">
                        {matchDevice === "mobile" ? <Smartphone className="w-4 h-4 text-red-400 shrink-0" /> : <Monitor className="w-4 h-4 text-red-400 shrink-0" />}
                        <p className="text-xs text-red-400">This match is for {matchDevice} players only</p>
                      </div>
                    ) : null;
                  })()}
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg bg-white/5 p-2.5">
                      <p className="text-[10px] text-white/35 mb-1">Game</p>
                      <div className="flex items-center justify-center gap-1">
                        <Gamepad2 className="w-3.5 h-3.5 text-primary/60" />
                        <span className="text-xs font-bold text-white/80">{GAME_LABELS[matchPreview.game_type] ?? matchPreview.game_type}</span>
                      </div>
                    </div>
                    <div className="rounded-lg bg-white/5 p-2.5">
                      <p className="text-[10px] text-white/35 mb-1">Wager</p>
                      <div className="flex items-center justify-center gap-1">
                        <ScalpsIcon size="xs" />
                        <span className="text-xs font-bold text-white/80">{wager > 0 ? `${wager.toFixed(2)} S each` : "Free play"}</span>
                      </div>
                    </div>
                  </div>
                  {matchPreview.player1_name && (
                    <div className="mt-2 text-center">
                      <p className="text-[11px] text-white/35">Hosted by <span className="text-white/60 font-semibold">{matchPreview.player1_name}</span></p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 border-white/15 text-white/60" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              className="flex-1 gap-2"
              disabled={!matchPreview || previewLoading || joinMutation.isPending || (matchPreview && (matchPreview.device_type ?? "desktop") !== deviceType)}
              onClick={() => joinMutation.mutate()}
              data-testid="button-join-private"
            >
              {joinMutation.isPending
                ? "Joining…"
                : <><ArrowRight className="w-4 h-4" /> Join Match</>
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
