import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppNavbar } from "@/components/AppNavbar";
import { PageHero } from "@/components/PageHero";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard, Plus, Shield, Lock, Star, Trash2, Pencil, Check, X, AlertTriangle,
} from "lucide-react";
import { SiVisa, SiMastercard, SiAmericanexpress } from "react-icons/si";
import { motion, AnimatePresence } from "framer-motion";
import {
  useStripe,
  useElements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  Elements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import type { SavedCard } from "@shared/schema";

const stripePromise = import.meta.env.VITE_STRIPE_PUBLIC_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)
  : null;

const STRIPE_ELEMENT_STYLE = {
  style: {
    base: {
      color: "#e2e8f0",
      fontSize: "15px",
      fontFamily: "'Space Grotesk', system-ui, sans-serif",
      "::placeholder": { color: "#475569" },
      iconColor: "#64748b",
    },
    invalid: { color: "#f87171", iconColor: "#f87171" },
  },
};

function brandIcon(brand: string) {
  const b = brand.toLowerCase();
  if (b === "visa") return <SiVisa className="w-8 h-5 text-blue-400" />;
  if (b === "mastercard") return <SiMastercard className="w-8 h-5 text-orange-400" />;
  if (b === "amex" || b === "american_express") return <SiAmericanexpress className="w-8 h-5 text-blue-300" />;
  return <CreditCard className="w-6 h-5 text-slate-400" />;
}

function brandLabel(brand: string) {
  const b = brand.toLowerCase();
  if (b === "visa") return "Visa";
  if (b === "mastercard") return "Mastercard";
  if (b === "amex" || b === "american_express") return "Amex";
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

function expiryStr(m: number, y: number) {
  return `${String(m).padStart(2, "0")}/${String(y).slice(-2)}`;
}

// Visual card widget
function CardVisual({ card }: { card: SavedCard }) {
  return (
    <div
      className="relative rounded-xl p-5 overflow-hidden select-none"
      style={{
        background: "linear-gradient(135deg, rgba(30,41,80,0.95) 0%, rgba(14,20,50,0.98) 100%)",
        border: "1px solid rgba(99,132,255,0.2)",
        boxShadow: "0 8px 32px rgba(0,0,50,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
        minWidth: 260,
      }}
    >
      {/* Ambient glow */}
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20 blur-2xl pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(99,132,255,0.6) 0%, transparent 70%)" }} />
      <div className="flex justify-between items-start mb-5">
        <div className="flex flex-col gap-1">
          <div className="flex gap-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/30" />
            ))}
          </div>
          <div className="text-xs text-white/40 font-mono tracking-widest">**** ****</div>
        </div>
        {brandIcon(card.brand)}
      </div>
      <div className="font-mono text-lg tracking-widest text-white/90 mb-4">
        **** **** **** {card.last4}
      </div>
      <div className="flex justify-between items-end">
        <div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Card Holder</div>
          <div className="text-sm text-white/80 font-medium truncate max-w-[140px]">
            {card.cardholderName || "Card holder"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Expires</div>
          <div className="text-sm text-white/80 font-mono">{expiryStr(card.expiryMonth, card.expiryYear)}</div>
        </div>
      </div>
    </div>
  );
}

// Add card form (uses Stripe Elements)
function AddCardForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [zip, setZip] = useState("");
  const [nickname, setNickname] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ number: "", expiry: "", cvc: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    if (!name.trim()) {
      toast({ title: "Cardholder name required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // 1. Create SetupIntent
      const siRes = await apiRequest("POST", "/api/stripe/setup-intent", {});
      const { clientSecret } = await siRes.json();

      // 2. Confirm card setup
      const cardElement = elements.getElement(CardNumberElement);
      if (!cardElement) throw new Error("Card element not mounted");

      const { setupIntent, error } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: name.trim(),
            address: zip ? { postal_code: zip } : undefined,
          },
        },
      });

      if (error) throw new Error(error.message);
      if (!setupIntent?.payment_method) throw new Error("No payment method returned");

      // 3. Save to our backend
      const saveRes = await apiRequest("POST", "/api/cards", {
        paymentMethodId: setupIntent.payment_method,
        nickname: nickname.trim() || null,
        billingZip: zip.trim() || null,
        isDefault,
      });

      if (!saveRes.ok) {
        const err = await saveRes.json();
        throw new Error(err.message || "Failed to save card");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      toast({ title: "Card added successfully", description: "Your card has been saved securely." });
      onSuccess();
    } catch (err: any) {
      toast({ title: "Failed to add card", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-2 mb-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
        <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
        <p className="text-xs text-emerald-400">Your payment details are encrypted and secured by Stripe</p>
      </div>

      <div className="space-y-2">
        <Label>Cardholder Name</Label>
        <Input
          placeholder="John Smith"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          data-testid="input-cardholder-name"
        />
      </div>

      <div className="space-y-2">
        <Label>Card Number</Label>
        <div className="rounded-md border border-input bg-background px-3 py-3 focus-within:ring-2 focus-within:ring-ring">
          <CardNumberElement options={STRIPE_ELEMENT_STYLE} onChange={e => setFieldErrors(f => ({ ...f, number: e.error?.message || "" }))} />
        </div>
        {fieldErrors.number && <p className="text-xs text-destructive">{fieldErrors.number}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Expiration Date</Label>
          <div className="rounded-md border border-input bg-background px-3 py-3 focus-within:ring-2 focus-within:ring-ring">
            <CardExpiryElement options={STRIPE_ELEMENT_STYLE} onChange={e => setFieldErrors(f => ({ ...f, expiry: e.error?.message || "" }))} />
          </div>
          {fieldErrors.expiry && <p className="text-xs text-destructive">{fieldErrors.expiry}</p>}
        </div>
        <div className="space-y-2">
          <Label>CVV</Label>
          <div className="rounded-md border border-input bg-background px-3 py-3 focus-within:ring-2 focus-within:ring-ring">
            <CardCvcElement options={STRIPE_ELEMENT_STYLE} onChange={e => setFieldErrors(f => ({ ...f, cvc: e.error?.message || "" }))} />
          </div>
          {fieldErrors.cvc && <p className="text-xs text-destructive">{fieldErrors.cvc}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Billing ZIP Code</Label>
        <Input
          placeholder="97214"
          value={zip}
          onChange={e => setZip(e.target.value.replace(/\D/g, "").slice(0, 10))}
          inputMode="numeric"
          data-testid="input-billing-zip"
        />
      </div>

      <div className="space-y-2">
        <Label>Card Nickname <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Input
          placeholder="Personal Visa, Gaming Card, etc."
          value={nickname}
          onChange={e => setNickname(e.target.value)}
          data-testid="input-card-nickname"
        />
      </div>

      <label className="flex items-center gap-3 cursor-pointer group">
        <div
          onClick={() => setIsDefault(v => !v)}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
            isDefault ? "bg-blue-600 border-blue-600" : "border-white/20 hover-elevate"
          }`}
          data-testid="checkbox-set-default"
        >
          {isDefault && <Check className="w-3 h-3 text-white" />}
        </div>
        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
          Set as default payment method
        </span>
      </label>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving || !stripe} className="flex-1" data-testid="button-save-card">
          {saving ? "Saving..." : "Save Card"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-add-card">
          Cancel
        </Button>
      </div>
    </form>
  );
}

// Edit card dialog
function EditCardDialog({
  card,
  open,
  onClose,
}: {
  card: SavedCard;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [nickname, setNickname] = useState(card.nickname || "");
  const [zip, setZip] = useState(card.billingZip || "");

  const editMutation = useMutation({
    mutationFn: async (data: { nickname: string; billingZip: string }) => {
      const res = await apiRequest("PATCH", `/api/cards/${card.id}`, data);
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      toast({ title: "Card updated successfully" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Failed to update", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="glass-override max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Card</DialogTitle>
          <DialogDescription>
            {brandLabel(card.brand)} **** {card.last4} &mdash; expires {expiryStr(card.expiryMonth, card.expiryYear)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Card Nickname <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              placeholder="Personal Visa, Gaming Card, etc."
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              data-testid="input-edit-nickname"
            />
          </div>
          <div className="space-y-2">
            <Label>Billing ZIP Code</Label>
            <Input
              placeholder="97214"
              value={zip}
              onChange={e => setZip(e.target.value.replace(/\D/g, "").slice(0, 10))}
              inputMode="numeric"
              data-testid="input-edit-zip"
            />
          </div>
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-400">
            Card number and CVV cannot be edited for security reasons.
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="button-edit-cancel">Cancel</Button>
          <Button
            onClick={() => editMutation.mutate({ nickname, billingZip: zip })}
            disabled={editMutation.isPending}
            data-testid="button-edit-save"
          >
            {editMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Delete confirmation dialog
function DeleteCardDialog({
  card,
  open,
  onClose,
}: {
  card: SavedCard;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/cards/${card.id}`, undefined);
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      toast({ title: "Card removed successfully" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Failed to remove card", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="glass-override max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Remove Card
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to remove the {brandLabel(card.brand)} card ending in {card.last4}?
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={onClose} data-testid="button-delete-cancel">Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            data-testid="button-confirm-remove-card"
          >
            {deleteMutation.isPending ? "Removing..." : "Remove Card"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Main page
export default function PaymentMethods() {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editCard, setEditCard] = useState<SavedCard | null>(null);
  const [deleteCard, setDeleteCard] = useState<SavedCard | null>(null);

  const { data: cards = [], isLoading } = useQuery<SavedCard[]>({
    queryKey: ["/api/cards"],
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (cardId: string) => {
      const res = await apiRequest("POST", `/api/cards/${cardId}/set-default`, {});
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      toast({ title: "Default card updated" });
    },
    onError: (e: any) => toast({ title: "Failed to update default", description: e.message, variant: "destructive" }),
  });

  const stripeNotConfigured = !stripePromise;

  return (
    <div className="min-h-screen glass-bg">
      <AppNavbar />
      <PageHero
        title="Payment Methods"
        subtitle="Manage your saved cards securely"
        motif="settings"
      />

      <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 space-y-6">

        {/* Security banner */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="card-depth glass-override border-emerald-500/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-400">Secured by Stripe</p>
                <p className="text-xs text-muted-foreground">
                  Your card details are encrypted and tokenized. Jango never stores raw card numbers.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stripe not configured warning */}
        {stripeNotConfigured && (
          <Card className="card-depth glass-override border-amber-500/20">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <p className="text-sm text-amber-400">
                Stripe is not configured. Card management requires Stripe API keys to be set up.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Saved cards list */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="card-depth glass-override">
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-400" />
                  Saved Cards
                </CardTitle>
                <CardDescription className="mt-1">
                  {cards.length === 0 ? "No cards saved yet" : `${cards.length} card${cards.length !== 1 ? "s" : ""} saved`}
                </CardDescription>
              </div>
              {!showAddForm && (
                <Button
                  onClick={() => setShowAddForm(true)}
                  disabled={stripeNotConfigured}
                  data-testid="button-add-new-card"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add New Card
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add card form */}
              <AnimatePresence>
                {showAddForm && (
                  <motion.div
                    key="add-form"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 mb-2">
                      <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Add New Card
                      </h3>
                      {stripePromise ? (
                        <Elements stripe={stripePromise}>
                          <AddCardForm
                            onSuccess={() => setShowAddForm(false)}
                            onCancel={() => setShowAddForm(false)}
                          />
                        </Elements>
                      ) : (
                        <p className="text-sm text-muted-foreground">Stripe not configured.</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Loading skeletons */}
              {isLoading && (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <div key={i} className="flex gap-4 p-4 rounded-xl border border-white/5">
                      <Skeleton className="w-44 h-24 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-8 w-40 mt-2" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!isLoading && cards.length === 0 && !showAddForm && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <CreditCard className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground mb-4">No saved cards yet</p>
                  <Button
                    onClick={() => setShowAddForm(true)}
                    disabled={stripeNotConfigured}
                    data-testid="button-add-first-card"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Your First Card
                  </Button>
                </div>
              )}

              {/* Card list */}
              <AnimatePresence>
                {cards.map((card, idx) => (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.05 }}
                    data-testid={`card-payment-method-${card.id}`}
                  >
                    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 flex flex-col sm:flex-row gap-4 hover-elevate transition-all">
                      {/* Visual card */}
                      <div className="sm:w-64 shrink-0">
                        <CardVisual card={card} />
                      </div>

                      {/* Info + actions */}
                      <div className="flex-1 flex flex-col justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-sm">
                              {card.nickname || `${brandLabel(card.brand)} **** ${card.last4}`}
                            </span>
                            {card.isDefault && (
                              <Badge variant="secondary" className="text-[10px] bg-blue-500/20 text-blue-300 border-blue-500/30" data-testid={`badge-default-${card.id}`}>
                                <Star className="w-2.5 h-2.5 mr-1" />
                                Default
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {brandLabel(card.brand)} &bull; Expires {expiryStr(card.expiryMonth, card.expiryYear)}
                          </p>
                          {card.billingZip && (
                            <p className="text-xs text-muted-foreground">ZIP: {card.billingZip}</p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {!card.isDefault && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDefaultMutation.mutate(card.id)}
                              disabled={setDefaultMutation.isPending}
                              data-testid={`button-set-default-${card.id}`}
                            >
                              <Star className="w-3 h-3 mr-1" />
                              Set Default
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditCard(card)}
                            data-testid={`button-edit-card-${card.id}`}
                          >
                            <Pencil className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDeleteCard(card)}
                            data-testid={`button-remove-card-${card.id}`}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Dialogs */}
      {editCard && (
        <EditCardDialog card={editCard} open={true} onClose={() => setEditCard(null)} />
      )}
      {deleteCard && (
        <DeleteCardDialog card={deleteCard} open={true} onClose={() => setDeleteCard(null)} />
      )}
    </div>
  );
}
