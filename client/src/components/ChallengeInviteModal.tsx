import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Swords, Monitor, Smartphone } from "lucide-react";
import type { User, GameType } from "@shared/schema";
import { useDeviceType } from "@/hooks/useDeviceType";

interface ChallengeFriend {
  id: string;
  firstName: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  profileImageUrl?: string | null;
}

interface ChallengeInviteModalProps {
  open: boolean;
  onClose: () => void;
  friend: ChallengeFriend | null;
}

const GAME_TYPES: { value: GameType; label: string }[] = [
  { value: "chess", label: "Chess" },
  { value: "mini-golf", label: "Mini Golf" },
  { value: "connect-4", label: "Connect 4" },
];

export function ChallengeInviteModal({ open, onClose, friend }: ChallengeInviteModalProps) {
  const { toast } = useToast();
  const deviceType = useDeviceType();
  const [gameType, setGameType] = useState<GameType>("chess");
  const [betAmount, setBetAmount] = useState("10");

  const createChallengeMutation = useMutation({
    mutationFn: async () => {
      if (!friend) throw new Error("No friend selected");
      
      const response = await apiRequest("POST", "/api/challenges/invite", {
        challengedId: friend.id,
        gameType,
        betAmount,
        deviceType,
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Challenge sent!" });
      queryClient.invalidateQueries({ queryKey: ["/api/challenges/pending"] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send challenge",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createChallengeMutation.mutate();
  };

  if (!friend) return null;

  const getUserInitials = () => {
    return `${friend.firstName?.[0] || ''}${(friend.lastName)?.[0] || ''}`.toUpperCase() || friend.username?.[0]?.toUpperCase() || '?';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="modal-challenge-invite">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swords className="w-5 h-5" />
            Challenge Friend
          </DialogTitle>
          <DialogDescription>
            Send a head-to-head game challenge
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 p-4 rounded-lg bg-muted">
          <Avatar>
            <AvatarFallback>{getUserInitials()}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">
              {friend.firstName} {friend.lastName}
            </div>
            <div className="text-sm text-muted-foreground">{friend.username || friend.email || ""}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="game-type">Game Type</Label>
            <Select value={gameType} onValueChange={(value) => setGameType(value as GameType)}>
              <SelectTrigger id="game-type" data-testid="select-game-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GAME_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bet-amount">Bet Amount (Scalps)</Label>
            <Input
              id="bet-amount"
              type="number"
              min="0"
              step="0.01"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              placeholder="0.00"
              data-testid="input-bet-amount"
            />
            <p className="text-sm text-muted-foreground">
              Set to 0 for a friendly match with no stakes
            </p>
          </div>

          <div className="bg-muted p-3 rounded-lg space-y-1">
            <div className="text-sm font-medium">Challenge Details:</div>
            <div className="text-sm text-muted-foreground">
              • Game: {GAME_TYPES.find((t) => t.value === gameType)?.label}
            </div>
            <div className="text-sm text-muted-foreground">
              • Stake: {parseFloat(betAmount || "0").toFixed(2)} Scalps each
            </div>
            {parseFloat(betAmount || "0") > 0 && (
              <div className="text-sm text-muted-foreground">
                • Winner takes: {(parseFloat(betAmount) * 2 * 0.97).toFixed(2)} Scalps (3% rake)
              </div>
            )}
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              • Device: {deviceType === "mobile" ? <Smartphone className="w-3 h-3 inline" /> : <Monitor className="w-3 h-3 inline" />} {deviceType === "mobile" ? "Mobile" : "Desktop"} only
            </div>
            <div className="text-sm text-muted-foreground">
              • Expires in 10 minutes
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={createChallengeMutation.isPending}
              data-testid="button-send-challenge"
            >
              {createChallengeMutation.isPending ? "Sending..." : "Send Challenge"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
