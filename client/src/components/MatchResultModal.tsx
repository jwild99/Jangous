import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { MatchWithPlayers } from "@shared/schema";
import { Trophy, X, Sparkles, Zap } from "lucide-react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ScalpsAmount } from "@/components/ScalpsIcon";

interface MatchResultModalProps {
  match: MatchWithPlayers;
  currentUserId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MatchResultModal({ 
  match, 
  currentUserId,
  open, 
  onOpenChange 
}: MatchResultModalProps) {
  const [, setLocation] = useLocation();
  const isWinner = match.winnerId === currentUserId;
  const winner = match.winner;
  const isDraw = match.status === "completed" && !match.winnerId;
  
  // Calculate rake breakdown (3% platform fee)
  const potAmount = parseFloat(match.potAmount || "0");
  const RAKE_PERCENTAGE = 0.03; // 3% platform rake
  const rakeFee = potAmount * RAKE_PERCENTAGE;
  const netWinnings = potAmount - rakeFee;
  
  const showPotBreakdown = !match.isPractice && potAmount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-match-result">
        <DialogHeader>
          <DialogTitle className="text-center text-3xl font-display mb-2">
            {isDraw ? "Draw!" : isWinner ? "Victory!" : "Defeat"}
          </DialogTitle>
          <DialogDescription className="text-center">
            Match completed
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          <div className="relative flex justify-center mb-6">
            {/* Animated sparkles for winners */}
            {isWinner && !isDraw && (
              <AnimatePresence>
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute"
                    initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
                    animate={{
                      scale: [0, 1, 0],
                      x: [0, Math.cos((i / 8) * Math.PI * 2) * 60],
                      y: [0, Math.sin((i / 8) * Math.PI * 2) * 60],
                      opacity: [0, 1, 0],
                    }}
                    transition={{
                      duration: 1.5,
                      delay: 0.3 + i * 0.1,
                      repeat: Infinity,
                      repeatDelay: 2,
                    }}
                  >
                    <Sparkles className="w-4 h-4 text-chart-3" />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ 
                scale: 1, 
                rotate: 0,
                ...(isWinner && !isDraw ? {
                  y: [0, -10, 0],
                } : {})
              }}
              transition={{ 
                type: "spring", 
                duration: 0.6,
                ...(isWinner && !isDraw ? {
                  y: {
                    repeat: Infinity,
                    duration: 2,
                    ease: "easeInOut",
                  }
                } : {})
              }}
              className="relative z-10"
            >
              {isDraw ? (
                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
                  <X className="w-12 h-12 text-muted-foreground" />
                </div>
              ) : (
                <div className={`w-24 h-24 rounded-full flex items-center justify-center ${
                  isWinner ? "bg-chart-3/20 ring-4 ring-chart-3/30" : "bg-chart-4/20"
                }`}>
                  <Trophy className={`w-12 h-12 ${isWinner ? "text-chart-3" : "text-chart-4"}`} />
                </div>
              )}
            </motion.div>
          </div>

          <div className="text-center mb-6">
            {!isDraw && winner && (
              <>
                <p className="text-muted-foreground mb-2">Winner</p>
                <p className="text-2xl font-bold" data-testid="text-winner-name">
                  {winner.firstName || winner.email?.split('@')[0] || "Unknown"}
                </p>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Player 1</div>
              <div className="font-semibold" data-testid="text-player1-score">
                {match.player1?.firstName || "Player 1"}
              </div>
              <div className="text-2xl font-bold font-mono">{match.player1Score || 0}</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Player 2</div>
              <div className="font-semibold" data-testid="text-player2-score">
                {match.player2?.firstName || "Player 2"}
              </div>
              <div className="text-2xl font-bold font-mono">{match.player2Score || 0}</div>
            </div>
          </div>

          {/* Pot Breakdown with Rake Fee */}
          {showPotBreakdown && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-6 p-4 bg-card border rounded-lg"
              data-testid="pot-breakdown"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Total Pot</span>
                  <ScalpsAmount amount={potAmount} className="font-semibold" iconSize="xs" showLabel />
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    Platform Fee (3%)
                    <Badge variant="outline" className="text-xs">Rake</Badge>
                  </span>
                  <span className="font-mono text-destructive">-{rakeFee.toFixed(2)} S</span>
                </div>
                <div className="border-t pt-2 flex justify-between items-center">
                  <span className="font-semibold">
                    {isWinner ? "Your Winnings" : "Winner Receives"}
                  </span>
                  <ScalpsAmount amount={netWinnings} className="font-bold text-xl text-chart-3" iconSize="sm" showLabel />
                </div>
              </div>
            </motion.div>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              onOpenChange(false);
              setLocation("/leaderboard");
            }}
            data-testid="button-view-leaderboard"
          >
            View Leaderboard
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              onOpenChange(false);
              setLocation("/");
            }}
            data-testid="button-return-lobby"
          >
            Return to Lobby
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
