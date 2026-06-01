import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Sparkles, Zap, Trophy, Swords } from "lucide-react";
import { motion } from "framer-motion";
import type { MatchWithPlayers } from "@shared/schema";
import { ScalpsIcon } from "@/components/ScalpsIcon";
import { formatScalps } from "@/lib/scalps";

interface JoinMatchConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: MatchWithPlayers | null;
  userBalance: string;
  onConfirm: () => void;
  isJoining: boolean;
}

export default function JoinMatchConfirmDialog({
  open,
  onOpenChange,
  match,
  userBalance,
  onConfirm,
  isJoining,
}: JoinMatchConfirmDialogProps) {
  if (!match) return null;

  const betAmount = parseFloat(match.potAmount || "0");
  const balance = parseFloat(userBalance || "0");
  const isFree = betAmount === 0;
  const hasInsufficientBalance = !isFree && balance < betAmount;
  const potTotal = betAmount * 2;
  const rake = potTotal * 0.03;
  const winnings = potTotal - rake;
  const balanceAfter = balance - betAmount;

  const gameLabel = (match.gameType || "match")
    .replace(/-/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm p-0 overflow-hidden border-white/10 bg-card"
        data-testid="dialog-join-confirm"
      >
        {/* Top accent line */}
        <div
          className="h-1 w-full"
          style={{ background: isFree ? "linear-gradient(90deg,#10b981,#06b6d4)" : "linear-gradient(90deg,#FF2D8A,#FF7A00)" }}
        />

        <div className="p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-base">
              <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                {isFree
                  ? <Sparkles className="w-4 h-4 text-green-400" />
                  : <Swords className="w-4 h-4 text-primary" />}
              </div>
              {isFree ? "Join Free Match" : "Confirm Wager"}
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground leading-snug">
            {isFree
              ? `Join a free ${gameLabel} match. No Scalps required — compete for XP and rank.`
              : `You're entering a wagered ${gameLabel} match. Both players put up ${formatScalps(betAmount)}.`}
          </p>

          {isFree ? (
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center justify-center gap-3 p-5 rounded-xl border border-green-500/20"
              style={{ background: "rgba(16,185,129,0.07)" }}
            >
              <Sparkles className="w-6 h-6 text-green-400" />
              <div className="text-center">
                <p className="text-base font-black text-green-400">FREE MATCH</p>
                <p className="text-xs text-muted-foreground mt-0.5">No wager — play for XP and rank</p>
              </div>
            </motion.div>
          ) : (
            <>
              {/* Breakdown table */}
              <div className="rounded-xl border border-white/10 bg-white/3 divide-y divide-white/8 overflow-hidden">
                <div className="flex items-center justify-between px-3.5 py-2.5 text-sm">
                  <span className="text-muted-foreground">Your wager</span>
                  <span className="font-bold text-red-400 flex items-center gap-1">
                    <ScalpsIcon size="xs" />−{betAmount.toFixed(0)} S
                  </span>
                </div>
                <div className="flex items-center justify-between px-3.5 py-2.5 text-sm">
                  <span className="text-muted-foreground">Total pot</span>
                  <span className="font-bold flex items-center gap-1">
                    <ScalpsIcon size="xs" />{potTotal.toFixed(0)} S
                  </span>
                </div>
                <div className="flex items-center justify-between px-3.5 py-2.5 text-sm">
                  <span className="text-muted-foreground">Platform rake (3%)</span>
                  <span className="text-white/40 flex items-center gap-1">
                    <ScalpsIcon size="xs" />−{rake.toFixed(1)} S
                  </span>
                </div>
                <div className="flex items-center justify-between px-3.5 py-2.5 text-sm bg-green-500/5">
                  <span className="text-green-400 font-semibold">Winner receives</span>
                  <span className="font-black text-green-400 flex items-center gap-1">
                    <ScalpsIcon size="xs" />{winnings.toFixed(1)} S
                  </span>
                </div>
              </div>

              {/* Balance after */}
              <div className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-white/4 border border-white/8 text-sm">
                <span className="text-muted-foreground">Your balance after</span>
                <span className={`font-bold flex items-center gap-1 ${hasInsufficientBalance ? "text-red-400" : "text-foreground"}`}>
                  <ScalpsIcon size="xs" />{balanceAfter.toFixed(0)} S
                </span>
              </div>

              {hasInsufficientBalance && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/8 border border-red-500/20 text-xs text-red-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Not enough Scalps. You need at least {formatScalps(betAmount)} to join. Top up in the wallet.</span>
                </div>
              )}
            </>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isJoining}
              className="flex-1"
              data-testid="button-cancel-join"
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              disabled={isJoining || hasInsufficientBalance}
              className="flex-1 gap-1.5"
              data-testid="button-confirm-join"
            >
              {isJoining ? (
                <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Joining…</>
              ) : isFree ? (
                <><Zap className="w-3.5 h-3.5" />Join Free</>
              ) : (
                <><Trophy className="w-3.5 h-3.5" />Wager {formatScalps(betAmount)}</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
