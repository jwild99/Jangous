import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Wallet, Trophy, Zap } from "lucide-react";
import { ScalpsIcon } from "@/components/ScalpsIcon";

interface WagerConfirmModalProps {
  gameType: string;
  betAmount: number;
  userBalance: number;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}

function gameLabel(type: string): string {
  return type.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function WagerConfirmModal({
  gameType,
  betAmount,
  userBalance,
  onConfirm,
  onCancel,
  isPending = false,
}: WagerConfirmModalProps) {
  const RAKE = 0.03;
  const potentialWin = betAmount * 2 * (1 - RAKE);
  const balanceAfterBet = userBalance - betAmount;
  const insufficient = userBalance < betAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        className="w-full max-w-sm"
      >
        <Card className="card-depth backdrop-blur shadow-2xl overflow-hidden" style={{ border: "1px solid rgba(99,102,241,0.28)", boxShadow: "0 0 0 1px rgba(99,102,241,0.08), 0 30px 60px -15px rgba(0,0,0,0.9), 0 0 40px -16px rgba(99,102,241,0.2)", background: "linear-gradient(145deg, #080c1a 0%, #0d1230 60%, #0f0a1e 100%)" }}>
          {/* Neon top edge */}
          <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent 5%, rgba(99,102,241,0.65) 40%, rgba(168,85,247,0.65) 60%, transparent 95%)" }} />
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              Confirm Wager
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Game + bet summary */}
            <div className="rounded-md bg-muted/40 border border-white/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Game</span>
                <span className="font-semibold text-sm">{gameLabel(gameType)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Your wager</span>
                <div className="flex items-center gap-1 font-bold text-yellow-400">
                  <ScalpsIcon className="w-3.5 h-3.5" />
                  <span>{betAmount.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-2">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5 text-green-400" />
                  Potential win
                </span>
                <div className="flex items-center gap-1 font-bold text-green-400">
                  <ScalpsIcon className="w-3.5 h-3.5" />
                  <span>{potentialWin.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Balance preview */}
            <div className="rounded-md bg-muted/20 border border-white/5 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Balance</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current</span>
                <span className="font-mono">{userBalance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">After bet</span>
                <span className={`font-mono ${insufficient ? "text-red-400" : "text-muted-foreground"}`}>
                  {balanceAfterBet.toFixed(2)}
                </span>
              </div>
            </div>

            {insufficient && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-2.5">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                Insufficient balance. Add funds to your wallet.
              </div>
            )}

            <p className="text-[11px] text-muted-foreground text-center">
              3% platform rake applies. By confirming you agree to the wager terms.
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onCancel}
                className="flex-1"
                data-testid="button-wager-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={onConfirm}
                disabled={insufficient || isPending}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
                data-testid="button-wager-confirm"
              >
                <Zap className="w-3.5 h-3.5 mr-1.5" />
                {isPending ? "Placing Bet…" : "Confirm Wager"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
