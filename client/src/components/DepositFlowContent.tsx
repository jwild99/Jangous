import { useState, useEffect, useRef } from "react";
import { soundManager } from "@/lib/soundManager";
import { useQuery } from "@tanstack/react-query";
import type { SavedCard, CryptoPayment } from "@shared/schema";
import { SiMastercard, SiAmericanexpress } from "react-icons/si";
import {
  useStripe,
  Elements,
  PaymentElement,
  useElements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ScalpsIcon } from "@/components/ScalpsIcon";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, DollarSign, Loader2, Copy, Check, Clock,
  Shield, Zap, ChevronRight, Wallet, Gamepad2, Home, CreditCard, Lock,
  Mail, RefreshCw, History, Bitcoin, AlertCircle, Radio, XCircle, RotateCcw,
} from "lucide-react";
import { SiBitcoin, SiEthereum, SiSolana, SiVenmo, SiVisa } from "react-icons/si";

const stripePromise = import.meta.env.VITE_STRIPE_PUBLIC_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)
  : null;

const STRIPE_ENABLED = !!import.meta.env.VITE_STRIPE_PUBLIC_KEY;

export function playChaChingSound() {
  // Route through soundManager so master volume + enable state are respected
  soundManager.playDepositConfirmed();
}

export interface CryptoDepositInfo {
  paymentId: string;
  walletAddress: string;
  amountCrypto: string;
  amountUsd: number;
  currency: string;
  expiresAt: string;
  cryptoPrice: number;
}

export type DepositFlow =
  | { type: "home" }
  | { type: "crypto-amount"; crypto: "btc" | "eth" | "sol" }
  | { type: "crypto-address"; info: CryptoDepositInfo }
  | { type: "crypto-awaiting"; paymentId: string; info: CryptoDepositInfo }
  | { type: "visa-amount" }
  | { type: "visa-card"; clientSecret: string; amount: string }
  | { type: "visa-select-card"; clientSecret: string; amount: string }
  | { type: "applepay-amount" }
  | { type: "applepay-pay"; clientSecret: string; amount: string }
  | { type: "venmo-amount" }
  | { type: "venmo-pay"; clientSecret: string; amount: string }
  | { type: "verify-email"; returnTo: DepositFlow }
  | { type: "history" }
  | { type: "success"; amount: string };

export const CRYPTO_CONFIGS = {
  btc: {
    name: "Bitcoin", symbol: "BTC", Icon: SiBitcoin,
    color: "#f97316", glow: "rgba(249,115,22,0.35)",
    network: "Bitcoin Network (BTC)",
  },
  eth: {
    name: "Ethereum", symbol: "ETH", Icon: SiEthereum,
    color: "#818cf8", glow: "rgba(129,140,248,0.35)",
    network: "Ethereum Mainnet (ERC-20)",
  },
  sol: {
    name: "Solana", symbol: "SOL", Icon: SiSolana,
    color: "#a855f7", glow: "rgba(168,85,247,0.35)",
    network: "Solana Network (SOL)",
  },
} as const;

export const CARD_CONFIGS = {
  applepay: {
    name: "Apple Pay", description: "Instant via Stripe",
    glow: "rgba(255,255,255,0.2)",
    renderIcon: () => <div className="font-bold text-white text-lg tracking-tight">Pay</div>,
  },
  venmo: {
    name: "Venmo", description: "Instant via Stripe",
    glow: "rgba(61,149,206,0.35)",
    renderIcon: () => <SiVenmo className="w-9 h-9 text-[#3d95ce]" />,
  },
  visa: {
    name: "Visa / MC", description: "Debit or Credit",
    glow: "rgba(100,120,255,0.3)",
    renderIcon: () => <SiVisa className="w-11 h-auto text-white" />,
  },
} as const;

export const QUICK_AMOUNTS = [10, 25, 50, 100];

const STRIPE_ELEMENT_STYLE = {
  style: {
    base: {
      color: "#ffffff",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: "15px",
      fontWeight: "400",
      letterSpacing: "0.02em",
      "::placeholder": { color: "rgba(255,255,255,0.28)" },
    },
    invalid: { color: "#f87171" },
  },
};

export function GlassCard({
  children, glow, className = "", onClick, selected, disabled,
}: {
  children: React.ReactNode; glow?: string; className?: string;
  onClick?: () => void; selected?: boolean; disabled?: boolean;
}) {
  return (
    <motion.div
      whileHover={!disabled ? { y: -4, scale: 1.03 } : {}}
      whileTap={!disabled ? { scale: 0.97 } : {}}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      onClick={!disabled ? onClick : undefined}
      className={`relative rounded-xl border backdrop-blur-sm overflow-hidden ${
        disabled
          ? "border-white/5 bg-white/[0.02] cursor-default opacity-60"
          : selected
            ? "border-white/40 bg-white/10 cursor-pointer"
            : "border-white/10 bg-white/5 hover:border-white/20 cursor-pointer"
      } ${className}`}
      style={{ boxShadow: glow && selected && !disabled ? `0 0 32px ${glow}, 0 4px 20px rgba(0,0,0,0.3)` : "0 4px 20px rgba(0,0,0,0.2)" }}
    >
      {children}
    </motion.div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-px flex-1 bg-white/10" />
      <span className="text-xs font-semibold tracking-widest text-white/40 uppercase">{children}</span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}

function StepHeader({ icon, title, subtitle, onBack }: {
  icon: React.ReactNode; title: string; subtitle?: string; onBack: () => void;
}) {
  return (
    <>
      <Button variant="ghost" onClick={onBack} className="text-white/60 px-0 mb-1" data-testid="button-back">
        <ArrowLeft className="w-4 h-4 mr-2" />Back
      </Button>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <p className="font-bold text-white leading-tight">{title}</p>
          {subtitle && <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </>
  );
}

function AmountPanel({
  amount, setAmount, onSubmit, isLoading, buttonLabel = "Continue",
}: {
  amount: string; setAmount: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void; isLoading: boolean; buttonLabel?: string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-white/60 text-xs">Deposit Amount (USD)</Label>
          <div className="flex items-center gap-1 text-[11px] text-white/40">
            <ScalpsIcon size="xs" /><span>1 USD = 1 Scalp</span>
          </div>
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-base">$</span>
          <Input
            type="number" step="0.01" min="1" max="10000" placeholder="0.00"
            value={amount} onChange={(e) => setAmount(e.target.value)}
            className="pl-7 bg-white/5 border-white/15 text-white placeholder:text-white/25 h-12 rounded-xl"
            data-testid="input-amount" required
          />
        </div>
        <div className="grid grid-cols-4 gap-2 mt-2">
          {QUICK_AMOUNTS.map((q) => (
            <Button key={q} type="button" variant="outline" size="sm"
              onClick={() => setAmount(String(q))}
              className="border-white/15 bg-white/5 text-white/60 text-xs"
              data-testid={`button-quick-${q}`}>
              ${q}
            </Button>
          ))}
        </div>
      </div>

      {amount && parseFloat(amount) > 0 && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-white/40">Adding</span>
            <span className="text-white font-medium">${parseFloat(amount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/40">You receive</span>
            <span className="flex items-center gap-1 text-amber-300 font-bold text-sm">
              <ScalpsIcon size="xs" />{parseFloat(amount).toFixed(2)} Scalps
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Processing fee</span>
            <span className="text-green-400">$0.00</span>
          </div>
        </motion.div>
      )}

      <Button type="submit" className="w-full rounded-xl" size="lg"
        disabled={isLoading || !amount || parseFloat(amount) <= 0}
        data-testid="button-continue">
        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Setting up...</> :
          <><ChevronRight className="w-4 h-4 mr-2" />{buttonLabel}</>}
      </Button>
    </form>
  );
}

// Structured result from createIntent — typed, never swallows errors
type IntentResult =
  | { ok: true; clientSecret: string }
  | { ok: false; requiresVerification: true }
  | { ok: false; requiresVerification: false; error: string };

async function createIntent(amount: number): Promise<IntentResult> {
  try {
    const res = await apiRequest("POST", "/api/wallet/create-deposit-intent", { amount });
    const data = await res.json();
    if (!res.ok) {
      if (data.requiresVerification) return { ok: false, requiresVerification: true };
      return { ok: false, requiresVerification: false, error: data.message || "Payment setup failed" };
    }
    return { ok: true, clientSecret: data.clientSecret };
  } catch {
    return { ok: false, requiresVerification: false, error: "Could not connect to payment service. Try again." };
  }
}

function StripeAmountStep({
  icon, title, subtitle, buttonLabel, onBack, onNext, onVerificationRequired,
}: {
  icon: React.ReactNode; title: string; subtitle: string; buttonLabel: string;
  onBack: () => void;
  onNext: (clientSecret: string, amount: string) => void;
  onVerificationRequired: () => void;
}) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!val || val < 1) return toast({ title: "Minimum deposit is $1.00", variant: "destructive" });
    if (val > 10000) return toast({ title: "Maximum deposit is $10,000", variant: "destructive" });
    setIsLoading(true);
    const result = await createIntent(val);
    setIsLoading(false);
    if (!result.ok) {
      if (result.requiresVerification) return onVerificationRequired();
      return toast({ title: "Payment unavailable", description: result.error, variant: "destructive" });
    }
    onNext(result.clientSecret, amount);
  };

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-1">
      <StepHeader icon={icon} title={title} subtitle={subtitle} onBack={onBack} />
      <AmountPanel amount={amount} setAmount={setAmount} onSubmit={handleSubmit}
        isLoading={isLoading} buttonLabel={buttonLabel} />
    </motion.div>
  );
}

function StripePayForm({ amount, onSuccess, onBack }: { amount: string; onSuccess: () => void; onBack: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setIsProcessing(true);
    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: `${window.location.origin}/deposit?success=1&amount=${amount}` },
        redirect: "if_required",
      });
      if (error) {
        toast({ title: "Payment Failed", description: error.message, variant: "destructive" });
      } else {
        // Balance will be updated by Stripe webhook — just show success UI
        await queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
        onSuccess();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setIsProcessing(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button type="submit" disabled={!stripe || isProcessing} className="w-full" size="lg" data-testid="button-confirm-payment">
        {isProcessing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> :
          <><DollarSign className="w-4 h-4 mr-2" />Confirm ${amount}</>}
      </Button>
    </form>
  );
}

function VisaCardFormInner({ clientSecret, amount, onSuccess, onBack }: {
  clientSecret: string; amount: string; onSuccess: () => void; onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [cardholderName, setCardholderName] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardError, setCardError] = useState("");
  const [expiryError, setExpiryError] = useState("");
  const [cvcError, setCvcError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    if (!cardholderName.trim()) {
      return toast({ title: "Please enter the cardholder name.", variant: "destructive" });
    }
    const cardNumber = elements.getElement(CardNumberElement);
    if (!cardNumber) return;
    setIsProcessing(true);
    try {
      const { error } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardNumber,
          billing_details: {
            name: cardholderName,
            address: { postal_code: zipCode },
          },
        },
      });
      if (error) {
        toast({ title: "Payment Failed", description: error.message, variant: "destructive" });
      } else {
        // Balance credited by Stripe webhook — just refresh and show confirmation
        await queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
        onSuccess();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setIsProcessing(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-1">
      <StepHeader
        icon={<SiVisa className="w-9 h-auto text-white" />}
        title="Card Details"
        subtitle={`Depositing $${parseFloat(amount).toFixed(2)} via card`}
        onBack={onBack}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label className="text-white/60 text-xs mb-1.5 block">Cardholder Name <span className="text-red-400">*</span></Label>
          <Input
            placeholder="John Smith"
            value={cardholderName}
            onChange={(e) => setCardholderName(e.target.value)}
            className="bg-white/5 border-white/15 text-white placeholder:text-white/28 h-11 rounded-xl"
            data-testid="input-cardholder-name"
            required
          />
        </div>

        <div>
          <Label className="text-white/60 text-xs mb-1.5 block">Card Number <span className="text-red-400">*</span></Label>
          <div className="h-11 rounded-xl border border-white/15 bg-white/5 px-3 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-white/25 shrink-0" />
            <div className="flex-1">
              <CardNumberElement options={STRIPE_ELEMENT_STYLE} onChange={(e) => setCardError(e.error?.message || "")} />
            </div>
          </div>
          {cardError && <p className="text-xs text-red-400 mt-1">{cardError}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-white/60 text-xs mb-1.5 block">Expiry <span className="text-red-400">*</span></Label>
            <div className="h-11 rounded-xl border border-white/15 bg-white/5 px-3 flex items-center">
              <div className="flex-1">
                <CardExpiryElement options={STRIPE_ELEMENT_STYLE} onChange={(e) => setExpiryError(e.error?.message || "")} />
              </div>
            </div>
            {expiryError && <p className="text-xs text-red-400 mt-1">{expiryError}</p>}
          </div>
          <div>
            <Label className="text-white/60 text-xs mb-1.5 block">CVV <span className="text-red-400">*</span></Label>
            <div className="h-11 rounded-xl border border-white/15 bg-white/5 px-3 flex items-center gap-2">
              <div className="flex-1">
                <CardCvcElement options={STRIPE_ELEMENT_STYLE} onChange={(e) => setCvcError(e.error?.message || "")} />
              </div>
              <Lock className="w-3.5 h-3.5 text-white/20 shrink-0" />
            </div>
            {cvcError && <p className="text-xs text-red-400 mt-1">{cvcError}</p>}
          </div>
        </div>

        <div>
          <Label className="text-white/60 text-xs mb-1.5 block">Billing ZIP Code</Label>
          <Input
            placeholder="97214"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
            className="bg-white/5 border-white/15 text-white placeholder:text-white/28 h-11 rounded-xl"
            inputMode="numeric"
            data-testid="input-zip-code"
          />
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-white/40">Deposit amount</span>
            <span className="text-white font-semibold">${parseFloat(amount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Processing fee</span>
            <span className="text-green-400">$0.00</span>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/3 px-3 py-2.5">
          <Lock className="w-3.5 h-3.5 text-white/30 mt-0.5 shrink-0" />
          <p className="text-xs text-white/35">Payment details are encrypted with 256-bit SSL and never stored on our servers.</p>
        </div>

        <Button type="submit" disabled={!stripe || isProcessing || !cardholderName.trim()}
          className="w-full rounded-xl" size="lg" data-testid="button-pay-visa">
          {isProcessing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> :
            <><Lock className="w-4 h-4 mr-2" />Pay ${parseFloat(amount).toFixed(2)} Securely</>}
        </Button>
      </form>
    </motion.div>
  );
}

function VisaCardStep({ clientSecret, amount, onBack, onSuccess }: {
  clientSecret: string; amount: string; onBack: () => void; onSuccess: () => void;
}) {
  if (!stripePromise) return null;
  return (
    <Elements stripe={stripePromise}>
      <VisaCardFormInner clientSecret={clientSecret} amount={amount} onBack={onBack} onSuccess={onSuccess} />
    </Elements>
  );
}

function ApplePayPayStep({ clientSecret, amount, onBack, onSuccess }: {
  clientSecret: string; amount: string; onBack: () => void; onSuccess: () => void;
}) {
  if (!stripePromise) return null;
  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-1">
      <StepHeader
        icon={<div className="font-bold text-white text-xl">Pay</div>}
        title="Apple Pay"
        subtitle={`Depositing $${parseFloat(amount).toFixed(2)}`}
        onBack={onBack}
      />
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4">
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "night" } }}>
          <StripePayForm amount={amount} onSuccess={onSuccess} onBack={onBack} />
        </Elements>
      </div>
      <div className="flex items-center gap-2 justify-center text-xs text-white/25">
        <Shield className="w-3 h-3" /><span>Secured by Stripe and Apple Pay.</span>
      </div>
    </motion.div>
  );
}

function VenmoPayStep({ clientSecret, amount, onBack, onSuccess }: {
  clientSecret: string; amount: string; onBack: () => void; onSuccess: () => void;
}) {
  if (!stripePromise) return null;
  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-1">
      <StepHeader
        icon={<SiVenmo className="w-7 h-7 text-[#3d95ce]" />}
        title="Venmo"
        subtitle={`Depositing $${parseFloat(amount).toFixed(2)}`}
        onBack={onBack}
      />
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-2">
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "night" } }}>
          <StripePayForm amount={amount} onSuccess={onSuccess} onBack={onBack} />
        </Elements>
      </div>
      <div className="flex items-center gap-2 justify-center text-xs text-white/25">
        <Shield className="w-3 h-3" /><span>Secured by Stripe and Venmo.</span>
      </div>
    </motion.div>
  );
}

function CryptoAmountStep({ crypto, onBack, onNext, onVerificationRequired }: {
  crypto: "btc" | "eth" | "sol";
  onBack: () => void;
  onNext: (info: CryptoDepositInfo) => void;
  onVerificationRequired: () => void;
}) {
  const cfg = CRYPTO_CONFIGS[crypto];
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!val || val < 1) return toast({ title: "Minimum deposit is $1.00", variant: "destructive" });
    if (val > 10000) return toast({ title: "Maximum deposit is $10,000", variant: "destructive" });
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/wallet/crypto/deposit", { amount: val, currency: crypto });
      const data = await res.json();
      if (!res.ok) {
        if (data.requiresVerification) return onVerificationRequired();
        throw new Error(data.message || "Could not generate deposit address. Please try again.");
      }
      onNext(data);
    } catch (err: any) {
      toast({ title: "Deposit error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-1">
      <StepHeader
        icon={<cfg.Icon className="w-6 h-6" style={{ color: cfg.color }} />}
        title={`${cfg.name} Deposit`}
        subtitle={cfg.network}
        onBack={onBack}
      />
      <AmountPanel amount={amount} setAmount={setAmount} onSubmit={handleSubmit}
        isLoading={isLoading} buttonLabel="Generate Deposit Address" />
    </motion.div>
  );
}

function CryptoAddressStep({ info, onBack, onMonitor }: {
  info: CryptoDepositInfo;
  onBack: () => void;
  onMonitor: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const key = info.currency.toLowerCase() as "btc" | "eth" | "sol";
  const cfg = CRYPTO_CONFIGS[key] ?? CRYPTO_CONFIGS.btc;

  useEffect(() => {
    const update = () => {
      const diff = new Date(info.expiresAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Expired"); return; }
      setTimeLeft(`${Math.floor(diff / 60000)}:${String(Math.floor((diff % 60000) / 1000)).padStart(2, "0")}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [info.expiresAt]);

  const handleCopy = () => {
    navigator.clipboard.writeText(info.walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(info.walletAddress)}&bgcolor=0a0e1a&color=ffffff&margin=10`;

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
      <StepHeader
        icon={<cfg.Icon className="w-6 h-6" style={{ color: cfg.color }} />}
        title={`Send ${cfg.symbol}`}
        subtitle={`Exactly ${info.amountCrypto} ${cfg.symbol} · ≈ $${info.amountUsd.toFixed(2)}`}
        onBack={onBack}
      />

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex gap-3 items-start">
          <div className="rounded-lg overflow-hidden border border-white/10 shrink-0">
            <img src={qrUrl} alt="QR Code" className="w-24 h-24" data-testid="img-qr-code" />
          </div>
          <div className="space-y-2 flex-1 min-w-0">
            <div>
              <p className="text-xs text-white/35 mb-0.5">Amount to send</p>
              <p className="font-mono font-bold text-base text-white">{info.amountCrypto} {cfg.symbol}</p>
            </div>
            <div>
              <p className="text-xs text-white/35 mb-0.5">Network</p>
              <Badge variant="outline" className="text-[10px] border-white/15 text-white/50">{cfg.network}</Badge>
            </div>
          </div>
        </div>
        <div>
          <p className="text-xs text-white/35 mb-1">Deposit Address</p>
          <div className="flex gap-2">
            <div className="flex-1 rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 font-mono text-xs text-white/70 truncate" data-testid="text-wallet-address">
              {info.walletAddress}
            </div>
            <Button variant="outline" size="icon" onClick={handleCopy}
              className="shrink-0 border-white/15 bg-white/5" data-testid="button-copy-address">
              <AnimatePresence mode="wait">
                {copied
                  ? <motion.div key="c" initial={{ scale: 0 }} animate={{ scale: 1 }}><Check className="w-4 h-4 text-green-400" /></motion.div>
                  : <motion.div key="u" initial={{ scale: 0 }} animate={{ scale: 1 }}><Copy className="w-4 h-4" /></motion.div>}
              </AnimatePresence>
            </Button>
          </div>
          {copied && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-green-400 mt-1">Address copied!</motion.p>}
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2.5">
        <Clock className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
        <span className="text-xs text-white/50">Expires in <span className="font-mono font-bold text-yellow-400">{timeLeft}</span></span>
      </div>

      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 space-y-1 text-xs text-white/50">
        <p className="font-semibold text-amber-400">Important</p>
        <p>Only send {cfg.symbol} on the {cfg.network} to this address.</p>
        <p>Sending the wrong asset or using the wrong network may result in permanent loss.</p>
      </div>

      {/* SECURITY: No self-crediting. User sends crypto externally then monitors confirmation. */}
      <Button className="w-full rounded-xl" size="lg" onClick={onMonitor} data-testid="button-monitor-payment">
        <Radio className="w-4 h-4 mr-2 animate-pulse" />
        I&apos;ve Sent the Funds — Monitor Payment
      </Button>
      <p className="text-xs text-white/25 text-center -mt-1">
        Your balance updates automatically after blockchain confirmation.
      </p>
    </motion.div>
  );
}

// ── Crypto Awaiting Confirmation ────────────────────────────────────────────
// SECURITY: Balance is ONLY credited by backend webhook after real blockchain confirmation.
// This screen polls status; it never triggers balance updates directly.

type CryptoStatus = "pending" | "confirming" | "confirmed" | "failed" | "expired";

const STATUS_STEPS = [
  { key: "address",     label: "Address Generated",        icon: Check },
  { key: "waiting",     label: "Waiting for Payment",      icon: Clock },
  { key: "confirming",  label: "Confirming on Blockchain", icon: Radio },
  { key: "confirmed",   label: "Funds Added",              icon: Check },
] as const;

function statusToStep(status: CryptoStatus): number {
  if (status === "confirmed") return 3;
  if (status === "confirming") return 2;
  return 1; // pending → waiting
}

function CryptoAwaitingStep({ paymentId, info, onBack, onConfirmed, onExpiredOrFailed }: {
  paymentId: string;
  info: CryptoDepositInfo;
  onBack: () => void;
  onConfirmed: (amount: string) => void;
  onExpiredOrFailed: (reason: "expired" | "failed") => void;
}) {
  const key = info.currency.toLowerCase() as "btc" | "eth" | "sol";
  const cfg = CRYPTO_CONFIGS[key] ?? CRYPTO_CONFIGS.btc;
  const [status, setStatus] = useState<CryptoStatus>("pending");
  const [timeLeft, setTimeLeft] = useState("");
  const [pollCount, setPollCount] = useState(0);
  const didConfirm = useRef(false);

  // Countdown timer
  useEffect(() => {
    const update = () => {
      const diff = new Date(info.expiresAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Expired"); return; }
      setTimeLeft(`${Math.floor(diff / 60000)}:${String(Math.floor((diff % 60000) / 1000)).padStart(2, "0")}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [info.expiresAt]);

  // Poll status every 12 seconds — only reads, never writes
  useEffect(() => {
    if (didConfirm.current) return;

    const poll = async () => {
      try {
        const res = await apiRequest("GET", `/api/wallet/crypto/status/${paymentId}`);
        if (!res.ok) return;
        const data = await res.json();
        const newStatus: CryptoStatus = data.status;
        setStatus(newStatus);
        setPollCount(c => c + 1);

        if (newStatus === "confirmed" && !didConfirm.current) {
          didConfirm.current = true;
          // Refresh balance — webhook already credited it server-side
          await queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
          await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          await queryClient.invalidateQueries({ queryKey: ["/api/wallet/crypto/history"] });
          playChaChingSound();
          onConfirmed(info.amountUsd.toFixed(2));
        } else if (newStatus === "expired") {
          onExpiredOrFailed("expired");
        } else if (newStatus === "failed") {
          onExpiredOrFailed("failed");
        }
      } catch (_) {}
    };

    poll(); // immediate first poll
    const id = setInterval(poll, 12000);
    return () => clearInterval(id);
  }, [paymentId]);

  const activeStep = statusToStep(status);

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-5">
      <StepHeader
        icon={<cfg.Icon className="w-6 h-6" style={{ color: cfg.color }} />}
        title="Awaiting Confirmation"
        subtitle={`${info.amountCrypto} ${cfg.symbol} · ≈ $${info.amountUsd.toFixed(2)}`}
        onBack={onBack}
      />

      {/* Progress Steps */}
      <div className="space-y-2">
        {STATUS_STEPS.map((step, i) => {
          const isDone = i < activeStep;
          const isActive = i === activeStep;
          const Icon = step.icon;
          return (
            <div key={step.key} className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-all ${
              isDone
                ? "border-green-500/30 bg-green-500/5"
                : isActive
                  ? "border-primary/40 bg-primary/5"
                  : "border-white/5 bg-white/[0.02] opacity-40"
            }`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                isDone ? "bg-green-500/20" : isActive ? "bg-primary/20" : "bg-white/5"
              }`}>
                {isDone ? (
                  <Check className="w-3.5 h-3.5 text-green-400" />
                ) : isActive ? (
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                ) : (
                  <Icon className="w-3.5 h-3.5 text-white/20" />
                )}
              </div>
              <span className={`text-sm font-medium ${
                isDone ? "text-green-400" : isActive ? "text-white" : "text-white/25"
              }`}>{step.label}</span>
              {isActive && i === 1 && (
                <span className="ml-auto text-[10px] text-white/30 font-mono">{pollCount > 0 ? `Checked ${pollCount}x` : "Checking..."}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-white/40">Sending</span>
          <span className="font-mono text-white">{info.amountCrypto} {cfg.symbol}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">To address</span>
          <span className="font-mono text-white/60 text-xs truncate max-w-[160px]">{info.walletAddress}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Expires</span>
          <span className={`font-mono text-xs ${timeLeft === "Expired" ? "text-red-400" : "text-yellow-400"}`}>{timeLeft}</span>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/3 px-3 py-2.5">
        <Shield className="w-3.5 h-3.5 text-white/25 mt-0.5 shrink-0" />
        <p className="text-xs text-white/30">
          Your balance updates automatically after the blockchain confirms your transaction. This typically takes 10–30 minutes. You can close this page — your deposit is tracked.
        </p>
      </div>
    </motion.div>
  );
}

// ── Deposit Expired / Failed ────────────────────────────────────────────────
function DepositFailedStep({ reason, onRetry, onHome }: {
  reason: "expired" | "failed"; onRetry: () => void; onHome: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-5 py-4">
      <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center"
        style={{ background: "radial-gradient(circle, rgba(239,68,68,0.2) 0%, transparent 70%)" }}>
        <XCircle className="w-8 h-8 text-red-400" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-white">
          {reason === "expired" ? "Deposit Expired" : "Deposit Failed"}
        </h3>
        <p className="text-white/40 text-sm mt-1">
          {reason === "expired"
            ? "The deposit window closed before a payment was received."
            : "Something went wrong with this deposit."}
        </p>
      </div>
      <div className="space-y-2">
        <Button className="w-full rounded-xl" onClick={onRetry} data-testid="button-retry-deposit">
          <RotateCcw className="w-4 h-4 mr-2" />Try Again
        </Button>
        <Button variant="outline" className="w-full rounded-xl border-white/15 bg-white/5 text-white" onClick={onHome} data-testid="button-back-home">
          <Home className="w-4 h-4 mr-2" />Back to Home
        </Button>
      </div>
    </motion.div>
  );
}

// ── Email Verification Gate ─────────────────────────────────────────────────
function EmailVerificationStep({ email, returnTo, onBack, onVerified }: {
  email?: string;
  returnTo: DepositFlow;
  onBack: () => void;
  onVerified: () => void;
}) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendVerification = async () => {
    setSending(true);
    try {
      const res = await apiRequest("POST", "/api/auth/send-verification", {});
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to verify");
      setSent(true);
      if (data.alreadyVerified) {
        toast({ title: "Email verified!", description: "You can now add funds." });
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        onVerified();
      } else {
        toast({ title: "Verification email sent!", description: `Check ${email || "your inbox"}.` });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSending(false); }
  };

  const handleCheck = async () => {
    setChecking(true);
    try {
      const res = await apiRequest("GET", "/api/auth/verification-status");
      const data = await res.json();
      if (data.isEmailVerified) {
        toast({ title: "Email verified!" });
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        onVerified();
      } else {
        toast({ title: "Not verified yet", description: "Click the link in your email, then try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not check status. Try again.", variant: "destructive" });
    } finally { setChecking(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-6">
      <StepHeader icon={<Mail className="w-5 h-5 text-primary" />} title="Verify Your Email" subtitle="Required before adding funds" onBack={onBack} />
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3 text-center">
        <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center"
          style={{ background: "radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)" }}>
          <Mail className="w-7 h-7 text-primary" />
        </div>
        <div>
          <p className="text-white font-semibold">Email verification required</p>
          <p className="text-white/40 text-sm mt-1">Verify your account email to add funds securely.</p>
          {email && <p className="text-primary/80 text-sm font-mono mt-2 truncate">{email}</p>}
        </div>
      </div>
      <div className="space-y-3">
        <Button className="w-full rounded-xl" size="lg" onClick={handleSendVerification}
          disabled={sending || sent} data-testid="button-send-verification">
          {sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</>
            : sent ? <><Check className="w-4 h-4 mr-2 text-green-400" />Verification sent</>
            : <><Mail className="w-4 h-4 mr-2" />Verify My Email</>}
        </Button>
        {sent && (
          <Button variant="outline" className="w-full rounded-xl border-white/15 bg-white/5 text-white"
            size="lg" onClick={handleCheck} disabled={checking} data-testid="button-check-verification">
            {checking ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Checking...</>
              : <><RefreshCw className="w-4 h-4 mr-2" />I Verified — Try Again</>}
          </Button>
        )}
      </div>
      <div className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/3 px-3 py-2.5">
        <Shield className="w-3.5 h-3.5 text-white/30 mt-0.5 shrink-0" />
        <p className="text-xs text-white/30">Email verification protects your account and is required for all deposits.</p>
      </div>
    </motion.div>
  );
}

// ── Deposit History ─────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  pending:    { label: "Pending",    color: "text-yellow-400" },
  confirming: { label: "Confirming", color: "text-blue-400" },
  confirmed:  { label: "Confirmed",  color: "text-green-400" },
  expired:    { label: "Expired",    color: "text-white/30" },
  failed:     { label: "Failed",     color: "text-red-400" },
};

function DepositHistoryStep({ onBack }: { onBack: () => void }) {
  const { data: history = [], isLoading } = useQuery<CryptoPayment[]>({
    queryKey: ["/api/wallet/crypto/history"],
  });

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-1">
      <StepHeader
        icon={<History className="w-5 h-5 text-white/60" />}
        title="Deposit History"
        subtitle="Your recent crypto deposits"
        onBack={onBack}
      />
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
      ) : history.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <Bitcoin className="w-8 h-8 text-white/15 mx-auto" />
          <p className="text-white/30 text-sm">No deposits yet</p>
        </div>
      ) : (
        <div className="space-y-2 pt-1">
          {history.map((p) => {
            const cfg = CRYPTO_CONFIGS[p.currency as keyof typeof CRYPTO_CONFIGS];
            const statusStyle = STATUS_STYLES[p.status] ?? { label: p.status, color: "text-white/40" };
            return (
              <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center gap-3">
                {cfg && <cfg.Icon className="w-5 h-5 shrink-0" style={{ color: cfg.color }} />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white">{p.amountCrypto} {p.currency.toUpperCase()}</span>
                    <span className={`text-xs font-semibold ${statusStyle.color}`}>{statusStyle.label}</span>
                  </div>
                  <p className="text-xs text-white/35 mt-0.5">
                    ≈ ${parseFloat(p.amountUsd).toFixed(2)} · {new Date(p.createdAt!).toLocaleDateString()}
                  </p>
                  {p.txHash && (
                    <p className="text-[10px] font-mono text-white/20 mt-0.5 truncate">tx: {p.txHash}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ── Success Screen ──────────────────────────────────────────────────────────
export function SuccessScreen({ amount, onPlayNow, onClose }: {
  amount: string; onPlayNow?: () => void; onClose?: () => void;
}) {
  const particles = Array.from({ length: 12 }, (_, i) => i);
  return (
    <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
      className="text-center space-y-6 relative overflow-hidden py-4">
      {particles.map((i) => (
        <motion.div key={i} className="absolute w-2 h-2 rounded-full pointer-events-none"
          style={{ left: `${10 + (i * 7) % 82}%`, top: "30%",
            background: ["#f97316","#818cf8","#a855f7","#22c55e","#facc15"][i % 5] }}
          animate={{ y: [-10, -70-(i%4)*25], x: [(i%3-1)*18,(i%3-1)*50], opacity:[0,1,0], scale:[0,1.4,0] }}
          transition={{ duration: 1.1, delay: i*0.06, ease: "easeOut" }} />
      ))}
      <motion.div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center"
        style={{ background: "radial-gradient(circle, rgba(34,197,94,0.25) 0%, transparent 70%)", boxShadow: "0 0 50px rgba(34,197,94,0.35)" }}
        animate={{ boxShadow: ["0 0 30px rgba(34,197,94,0.25)","0 0 70px rgba(34,197,94,0.55)","0 0 30px rgba(34,197,94,0.25)"] }}
        transition={{ duration: 2, repeat: Infinity }}>
        <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}>
          <Check className="w-10 h-10 text-green-400" />
        </motion.div>
      </motion.div>
      <div>
        <motion.h3 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="text-2xl font-bold text-white">Deposit Confirmed!</motion.h3>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="text-white/40 text-sm mt-1">Your funds have been verified and credited.</motion.p>
      </div>
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, type: "spring" }}
        className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5 mx-auto max-w-[240px]">
        <p className="text-xs text-white/35 mb-1">Amount Added</p>
        <p className="text-3xl font-bold text-green-400">+${parseFloat(amount).toFixed(2)}</p>
        <p className="text-xs text-white/35 mt-1">Balance updated</p>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}
        className="flex flex-col gap-2">
        {onPlayNow && (
          <Button size="lg" onClick={onPlayNow} className="gap-2" data-testid="button-play-now">
            <Gamepad2 className="w-4 h-4" />Play Now
          </Button>
        )}
        {onClose && (
          <Button size="lg" variant="outline" onClick={onClose}
            className="gap-2 border-white/20 bg-white/5" data-testid="button-close-deposit">
            <Home className="w-4 h-4" />Back to Lobby
          </Button>
        )}
      </motion.div>
    </motion.div>
  );
}

function depositBrandIcon(brand: string, cls = "w-7 h-5") {
  const b = brand.toLowerCase();
  if (b === "visa") return <SiVisa className={`${cls} text-blue-400`} />;
  if (b === "mastercard") return <SiMastercard className={`${cls} text-orange-400`} />;
  if (b === "amex" || b === "american_express") return <SiAmericanexpress className={`${cls} text-blue-300`} />;
  return <CreditCard className={`${cls} text-slate-400`} />;
}

function VisaSavedCardsStep({
  clientSecret, amount, onBack, onNewCard, onSuccess,
}: {
  clientSecret: string; amount: string;
  onBack: () => void; onNewCard: () => void; onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [charging, setCharging] = useState<string | null>(null);

  const { data: cards = [], isLoading } = useQuery<SavedCard[]>({ queryKey: ["/api/cards"] });

  async function handleUseCard(card: SavedCard) {
    if (!stripePromise) return;
    setCharging(card.id);
    try {
      const stripe = await stripePromise;
      if (!stripe) throw new Error("Stripe not available");
      const { error } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: card.stripePaymentMethodId,
      });
      if (error) throw new Error(error.message);
      // Webhook credits balance — just refresh
      await queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      onSuccess();
    } catch (err: any) {
      toast({ title: "Payment failed", description: err.message, variant: "destructive" });
    } finally { setCharging(null); }
  }

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-1">
      <StepHeader
        icon={<SiVisa className="w-9 h-auto text-white" />}
        title="Choose Payment Method"
        subtitle={`Depositing $${parseFloat(amount).toFixed(2)}`}
        onBack={onBack}
      />
      <div className="space-y-3 pt-1">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
        ) : (
          <>
            {cards.map(card => (
              <div key={card.id}
                className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4 hover-elevate transition-all">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {depositBrandIcon(card.brand)}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white">
                        {card.nickname || `${card.brand.charAt(0).toUpperCase() + card.brand.slice(1)} ****${card.last4}`}
                      </span>
                      {card.isDefault && (
                        <Badge variant="secondary" className="text-[9px] bg-blue-500/20 text-blue-300 border-blue-500/30 py-0">Default</Badge>
                      )}
                    </div>
                    <p className="text-xs text-white/40">
                      **** **** **** {card.last4} &bull; {String(card.expiryMonth).padStart(2,"0")}/{String(card.expiryYear).slice(-2)}
                    </p>
                  </div>
                </div>
                <Button size="sm" onClick={() => handleUseCard(card)} disabled={charging !== null}
                  data-testid={`button-use-saved-card-${card.id}`}>
                  {charging === card.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Use Card"}
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-4 rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4 cursor-pointer hover-elevate transition-all"
              onClick={onNewCard} data-testid="button-use-new-card">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4 text-white/60" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white/80">Use a different card</p>
                <p className="text-xs text-white/40">Enter new card details</p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30" />
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── Main Orchestrator ───────────────────────────────────────────────────────
interface DepositFlowContentProps {
  onPlayNow?: () => void;
  onClose?: () => void;
}

export function DepositFlowContent({ onPlayNow, onClose }: DepositFlowContentProps) {
  const [flow, setFlow] = useState<DepositFlow>({ type: "home" });
  const [failedReason, setFailedReason] = useState<"expired" | "failed">("expired");
  const { data: savedCards = [] } = useQuery<SavedCard[]>({ queryKey: ["/api/cards"] });
  const { data: verificationData } = useQuery<{ isEmailVerified: boolean; email: string | null }>({
    queryKey: ["/api/auth/verification-status"],
  });

  const handleSuccess = (amount: string) => {
    playChaChingSound();
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
    queryClient.invalidateQueries({ queryKey: ["/api/wallet/crypto/history"] });
    setFlow({ type: "success", amount });
  };

  const handleVerificationRequired = (returnTo: DepositFlow) => {
    setFlow({ type: "verify-email", returnTo });
  };

  return (
    <AnimatePresence mode="wait">

      {/* ── Success ─────────────────────────────────────────────────────── */}
      {flow.type === "success" && (
        <motion.div key="success">
          <SuccessScreen amount={flow.amount} onPlayNow={onPlayNow} onClose={onClose} />
        </motion.div>
      )}

      {/* ── Email Verification ───────────────────────────────────────────── */}
      {flow.type === "verify-email" && (
        <motion.div key="verify-email">
          <EmailVerificationStep
            email={verificationData?.email ?? undefined}
            returnTo={flow.returnTo}
            onBack={() => setFlow(flow.returnTo)}
            onVerified={() => setFlow(flow.returnTo)}
          />
        </motion.div>
      )}

      {/* ── Deposit History ──────────────────────────────────────────────── */}
      {flow.type === "history" && (
        <motion.div key="history">
          <DepositHistoryStep onBack={() => setFlow({ type: "home" })} />
        </motion.div>
      )}

      {/* ── Home ────────────────────────────────────────────────────────── */}
      {flow.type === "home" && (
        <motion.div key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-white">Add Funds</h2>
              <p className="text-sm text-white/40 mt-0.5">Choose a payment method below.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setFlow({ type: "history" })}
              className="text-white/40 shrink-0" data-testid="button-deposit-history">
              <History className="w-4 h-4 mr-1.5" />History
            </Button>
          </div>

          {/* Crypto */}
          <div>
            <SectionLabel>Crypto Deposits</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {(["btc", "eth", "sol"] as const).map((id) => {
                const cfg = CRYPTO_CONFIGS[id];
                return (
                  <GlassCard key={id} glow={cfg.glow} onClick={() => setFlow({ type: "crypto-amount", crypto: id })}
                    data-testid={`card-crypto-${id}`}>
                    <div className="p-4 flex flex-col items-center gap-2 text-center">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ background: `radial-gradient(circle, ${cfg.glow} 0%, transparent 80%)` }}>
                        <cfg.Icon className="w-6 h-6" style={{ color: cfg.color }} />
                      </div>
                      <div>
                        <p className="font-bold text-white text-xs">{cfg.name}</p>
                        <p className="text-[10px] text-white/35">{cfg.symbol}</p>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          </div>

          {/* Card / App Payments — show "Coming Soon" when Stripe not configured */}
          <div>
            <SectionLabel>Card &amp; App Payments</SectionLabel>
            {!STRIPE_ENABLED ? (
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5 flex flex-col items-center gap-3 text-center">
                <div className="flex gap-4 opacity-30">
                  <div className="font-bold text-white text-xl">Pay</div>
                  <SiVenmo className="w-8 h-8 text-[#3d95ce]" />
                  <SiVisa className="w-10 h-auto text-white" />
                </div>
                <div>
                  <p className="text-white/50 font-medium text-sm">Card &amp; App Payments</p>
                  <Badge variant="outline" className="mt-1.5 text-[10px] border-white/20 text-white/30">Coming Soon</Badge>
                </div>
                <p className="text-xs text-white/25 max-w-[200px]">
                  Visa, Mastercard, Apple Pay and Venmo are coming. Use crypto to deposit now.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {(["applepay", "venmo", "visa"] as const).map((id) => {
                  const cfg = CARD_CONFIGS[id];
                  const target = id === "applepay" ? "applepay-amount" : id === "venmo" ? "venmo-amount" : "visa-amount";
                  return (
                    <GlassCard key={id} glow={cfg.glow} onClick={() => setFlow({ type: target as DepositFlow["type"] } as any)}
                      data-testid={`card-payment-${id}`}>
                      <div className="p-4 flex flex-col items-center gap-2 text-center">
                        <div className="w-10 h-10 flex items-center justify-center">{cfg.renderIcon()}</div>
                        <div>
                          <p className="font-bold text-white text-xs">{cfg.name}</p>
                          <p className="text-[10px] text-white/35">{cfg.description}</p>
                        </div>
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            )}
          </div>

          {/* Trust badges strip */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Shield,      label: "Secure",      sub: "256-bit SSL",        color: "text-green-400",  bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.2)"  },
              { icon: Zap,         label: "Instant",     sub: "Auto-credited",      color: "text-blue-400",   bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.2)" },
              { icon: Lock,        label: "Protected",   sub: "No chargebacks",     color: "text-violet-400", bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.2)" },
            ].map(({ icon: Icon, label, sub, color, bg, border }) => (
              <div key={label}
                className="flex flex-col items-center gap-1.5 rounded-xl py-3 px-2 text-center"
                style={{ background: bg, border: `1px solid ${border}` }}>
                <Icon className={`w-4 h-4 ${color}`} />
                <div>
                  <p className={`text-[11px] font-bold ${color}`}>{label}</p>
                  <p className="text-[9px] text-white/30 mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/3 px-3 py-2.5">
            <Shield className="w-3.5 h-3.5 text-white/25 shrink-0" />
            <p className="text-xs text-white/30">All deposits are verified on the blockchain or by Stripe before funds are credited. Min $1.00 · Max $10,000.</p>
          </div>
        </motion.div>
      )}

      {/* ── Crypto Amount ────────────────────────────────────────────────── */}
      {flow.type === "crypto-amount" && (
        <motion.div key="crypto-amount">
          <CryptoAmountStep
            crypto={flow.crypto}
            onBack={() => setFlow({ type: "home" })}
            onNext={(info) => setFlow({ type: "crypto-address", info })}
            onVerificationRequired={() => handleVerificationRequired({ type: "crypto-amount", crypto: flow.crypto })}
          />
        </motion.div>
      )}

      {/* ── Crypto Address ───────────────────────────────────────────────── */}
      {flow.type === "crypto-address" && (
        <motion.div key="crypto-address">
          <CryptoAddressStep
            info={flow.info}
            onBack={() => setFlow({ type: "crypto-amount", crypto: flow.info.currency.toLowerCase() as "btc" | "eth" | "sol" })}
            onMonitor={() => setFlow({ type: "crypto-awaiting", paymentId: flow.info.paymentId, info: flow.info })}
          />
        </motion.div>
      )}

      {/* ── Crypto Awaiting Confirmation ─────────────────────────────────── */}
      {/* SECURITY: This step only READS status — never credits balance directly */}
      {flow.type === "crypto-awaiting" && (
        <motion.div key="crypto-awaiting">
          <CryptoAwaitingStep
            paymentId={flow.paymentId}
            info={flow.info}
            onBack={() => setFlow({ type: "crypto-address", info: flow.info })}
            onConfirmed={handleSuccess}
            onExpiredOrFailed={(reason) => {
              setFailedReason(reason);
              setFlow({ type: "home" });
            }}
          />
        </motion.div>
      )}

      {/* ── Visa Amount ──────────────────────────────────────────────────── */}
      {flow.type === "visa-amount" && (
        <motion.div key="visa-amount">
          <StripeAmountStep
            icon={<SiVisa className="w-9 h-auto text-white" />}
            title="Visa / Mastercard" subtitle="Debit or credit card"
            buttonLabel={savedCards.length > 0 ? "Choose Card" : "Enter Card Details"}
            onBack={() => setFlow({ type: "home" })}
            onVerificationRequired={() => handleVerificationRequired({ type: "visa-amount" })}
            onNext={(cs, amt) =>
              savedCards.length > 0
                ? setFlow({ type: "visa-select-card", clientSecret: cs, amount: amt })
                : setFlow({ type: "visa-card", clientSecret: cs, amount: amt })
            }
          />
        </motion.div>
      )}

      {/* ── Visa Saved Cards ─────────────────────────────────────────────── */}
      {flow.type === "visa-select-card" && (
        <motion.div key="visa-select-card">
          <VisaSavedCardsStep
            clientSecret={flow.clientSecret}
            amount={flow.amount}
            onBack={() => setFlow({ type: "visa-amount" })}
            onNewCard={() => setFlow({ type: "visa-card", clientSecret: flow.clientSecret, amount: flow.amount })}
            onSuccess={() => handleSuccess(flow.amount)}
          />
        </motion.div>
      )}

      {/* ── Visa Card Form ───────────────────────────────────────────────── */}
      {flow.type === "visa-card" && (
        <motion.div key="visa-card">
          <VisaCardStep
            clientSecret={flow.clientSecret}
            amount={flow.amount}
            onBack={() =>
              savedCards.length > 0
                ? setFlow({ type: "visa-select-card", clientSecret: flow.clientSecret, amount: flow.amount })
                : setFlow({ type: "visa-amount" })
            }
            onSuccess={() => handleSuccess(flow.amount)}
          />
        </motion.div>
      )}

      {/* ── Apple Pay Amount ─────────────────────────────────────────────── */}
      {flow.type === "applepay-amount" && (
        <motion.div key="applepay-amount">
          <StripeAmountStep
            icon={<div className="font-bold text-white text-xl">Pay</div>}
            title="Apple Pay" subtitle="Instant payment"
            buttonLabel="Continue to Apple Pay"
            onBack={() => setFlow({ type: "home" })}
            onVerificationRequired={() => handleVerificationRequired({ type: "applepay-amount" })}
            onNext={(cs, amt) => setFlow({ type: "applepay-pay", clientSecret: cs, amount: amt })}
          />
        </motion.div>
      )}

      {/* ── Apple Pay ────────────────────────────────────────────────────── */}
      {flow.type === "applepay-pay" && (
        <motion.div key="applepay-pay">
          <ApplePayPayStep
            clientSecret={flow.clientSecret}
            amount={flow.amount}
            onBack={() => setFlow({ type: "applepay-amount" })}
            onSuccess={() => handleSuccess(flow.amount)}
          />
        </motion.div>
      )}

      {/* ── Venmo Amount ─────────────────────────────────────────────────── */}
      {flow.type === "venmo-amount" && (
        <motion.div key="venmo-amount">
          <StripeAmountStep
            icon={<SiVenmo className="w-7 h-7 text-[#3d95ce]" />}
            title="Venmo" subtitle="Pay via Venmo"
            buttonLabel="Continue to Venmo"
            onBack={() => setFlow({ type: "home" })}
            onVerificationRequired={() => handleVerificationRequired({ type: "venmo-amount" })}
            onNext={(cs, amt) => setFlow({ type: "venmo-pay", clientSecret: cs, amount: amt })}
          />
        </motion.div>
      )}

      {/* ── Venmo Pay ────────────────────────────────────────────────────── */}
      {flow.type === "venmo-pay" && (
        <motion.div key="venmo-pay">
          <VenmoPayStep
            clientSecret={flow.clientSecret}
            amount={flow.amount}
            onBack={() => setFlow({ type: "venmo-amount" })}
            onSuccess={() => handleSuccess(flow.amount)}
          />
        </motion.div>
      )}

    </AnimatePresence>
  );
}
