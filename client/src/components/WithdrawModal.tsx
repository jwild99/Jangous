import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowUpRight, CheckCircle2, AlertTriangle, Banknote, Clock, Shield,
} from "lucide-react";
import { ScalpsIcon } from "@/components/ScalpsIcon";

const QUICK_AMOUNTS = [10, 25, 50, 100];

interface WithdrawModalProps {
  open: boolean;
  onClose: () => void;
}

export function WithdrawModal({ open, onClose }: WithdrawModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [newBalance, setNewBalance] = useState<string | null>(null);

  const balance = parseFloat(user?.balance || "0");

  const withdrawMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/wallet/withdraw", { amount: parseFloat(amount) }),
    onSuccess: (data: any) => {
      setSubmitted(true);
      setNewBalance(data.newBalance);
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (err: any) => {
      toast({ title: "Withdrawal Failed", description: err.message || "Something went wrong", variant: "destructive" });
    },
  });

  const handleClose = () => {
    setAmount("");
    setSubmitted(false);
    setNewBalance(null);
    onClose();
  };

  const parsedAmount = parseFloat(amount) || 0;
  const isValid = parsedAmount >= 5 && parsedAmount <= balance;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" style={{ background: "linear-gradient(145deg, #080c1a 0%, #0d1230 60%, #0f0a1e 100%)", border: "1px solid rgba(99,102,241,0.28)", boxShadow: "0 0 0 1px rgba(99,102,241,0.08), 0 40px 80px -20px rgba(0,0,0,0.9), 0 0 50px -20px rgba(99,102,241,0.18)" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <ArrowUpRight className="w-5 h-5 text-primary" />
            Withdraw Funds
          </DialogTitle>
          <DialogDescription className="text-white/50">
            Request a withdrawal from your Scalps balance to your linked account.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-6 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/15 border border-green-500/25 mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Withdrawal Requested</h3>
              <p className="text-white/50 text-sm">
                <span className="text-white font-semibold font-mono">{parsedAmount.toFixed(2)} Scalps</span> has been queued for withdrawal.
              </p>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/8 text-left">
              <Clock className="w-4 h-4 text-white/40 shrink-0" />
              <p className="text-xs text-white/50">Funds typically arrive within <strong className="text-white/70">1–3 business days</strong> via bank transfer.</p>
            </div>
            {newBalance !== null && (
              <div className="flex items-center justify-center gap-2 py-2">
                <ScalpsIcon size="sm" />
                <span className="text-white/50 text-sm">New balance:</span>
                <span className="font-bold font-mono text-white">{parseFloat(newBalance).toFixed(2)} S</span>
              </div>
            )}
            <Button className="w-full" onClick={handleClose} data-testid="button-done-withdraw">Done</Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Current balance */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/8">
              <div className="flex items-center gap-2">
                <ScalpsIcon size="sm" />
                <div>
                  <p className="text-[11px] text-white/40">Available balance</p>
                  <p className="font-bold font-mono text-white">{balance.toFixed(2)} Scalps</p>
                </div>
              </div>
              <button
                onClick={() => setAmount(Math.max(0, balance).toFixed(2))}
                className="text-[10px] text-primary border border-primary/30 rounded px-2 py-0.5 hover:bg-primary/10 transition-colors"
              >
                Max
              </button>
            </div>

            {/* Quick amounts */}
            <div>
              <p className="text-xs text-white/40 mb-2">Quick select</p>
              <div className="grid grid-cols-4 gap-2">
                {QUICK_AMOUNTS.map(a => (
                  <button
                    key={a}
                    onClick={() => setAmount(String(a))}
                    disabled={a > balance}
                    className={`py-2 rounded-lg border text-sm font-semibold transition-all ${
                      parseFloat(amount) === a
                        ? "bg-primary border-primary text-white"
                        : a > balance
                        ? "border-white/8 text-white/20 cursor-not-allowed"
                        : "border-white/15 text-white/60 hover:border-white/30"
                    }`}
                    data-testid={`quick-withdraw-${a}`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount input */}
            <div>
              <p className="text-xs text-white/40 mb-2">Custom amount</p>
              <div className="relative">
                <ScalpsIcon size="xs" className="absolute left-3 top-1/2 -translate-y-1/2 z-10" />
                <Input
                  type="number"
                  min="5"
                  max={balance}
                  step="1"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="pl-8 bg-white/5 border-white/15 text-white text-lg font-bold font-mono h-12"
                  placeholder="0.00"
                  data-testid="input-withdraw-amount"
                />
              </div>
              <p className="text-[11px] text-white/30 mt-1.5">Minimum withdrawal: 5 Scalps ($5 USD)</p>
            </div>

            {/* Info */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-lg bg-white/4 border border-white/8">
                <div className="flex items-center gap-1.5 mb-1">
                  <Banknote className="w-3.5 h-3.5 text-white/30" />
                  <span className="text-[10px] text-white/40">Method</span>
                </div>
                <p className="text-xs font-semibold text-white/70">Bank Transfer</p>
              </div>
              <div className="p-3 rounded-lg bg-white/4 border border-white/8">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="w-3.5 h-3.5 text-white/30" />
                  <span className="text-[10px] text-white/40">Timeline</span>
                </div>
                <p className="text-xs font-semibold text-white/70">1–3 Business Days</p>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/8 border border-amber-500/15">
              <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200/60">Withdrawals are reviewed for security. Make sure your payment method is verified in Settings.</p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-white/15 text-white/60" onClick={handleClose}
                data-testid="button-cancel-withdraw">
                Cancel
              </Button>
              <Button
                className="flex-1 gap-2"
                disabled={!isValid || withdrawMutation.isPending}
                onClick={() => withdrawMutation.mutate()}
                data-testid="button-confirm-withdraw"
              >
                <ArrowUpRight className="w-4 h-4" />
                {withdrawMutation.isPending ? "Processing…" : `Withdraw ${parsedAmount > 0 ? parsedAmount.toFixed(2) + " S" : ""}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
