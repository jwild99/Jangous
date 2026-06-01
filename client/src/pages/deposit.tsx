import { useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { playChaChingSound, DepositFlowContent } from "@/components/DepositFlowContent";

export default function Deposit() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "1") {
      playChaChingSound();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      window.history.replaceState({}, "", "/deposit");
    }
  }, []);

  return (
    <div
      className="min-h-screen relative"
      style={{
        background: "linear-gradient(135deg, #010208 0%, #0a0e1a 50%, #0d1225 100%)",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 20% 20%, rgba(99,102,241,0.08) 0%, transparent 70%), radial-gradient(ellipse 50% 35% at 80% 80%, rgba(168,85,247,0.06) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 container max-w-xl mx-auto px-4 py-8">
        <Link href="/dashboard">
          <Button variant="ghost" className="mb-6 text-white/60" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <DepositFlowContent
            onPlayNow={() => setLocation("/")}
            onClose={() => setLocation("/dashboard")}
          />
        </motion.div>
      </div>
    </div>
  );
}
