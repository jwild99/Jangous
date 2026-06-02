import { motion } from "framer-motion";
import { Link } from "wouter";
import { Home, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      {/* Ambient glow blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,45,138,0.07) 0%, transparent 70%)" }} />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)" }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex flex-col items-center text-center px-6"
      >
        {/* 404 glow number */}
        <div className="relative mb-6">
          <p
            className="text-[120px] md:text-[160px] font-black leading-none select-none"
            style={{
              background: "linear-gradient(135deg, #FF2D8A 20%, #FF7A00 80%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 40px rgba(255,45,138,0.4))",
            }}
          >
            404
          </p>
          {/* Glow underneath */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-8 rounded-full blur-2xl opacity-40"
            style={{ background: "linear-gradient(90deg, #FF2D8A, #FF7A00)" }} />
        </div>

        <h1 className="text-2xl md:text-3xl font-black mb-3 text-foreground">
          Page Not Found
        </h1>
        <p className="text-muted-foreground text-sm md:text-base mb-10 max-w-sm">
          This arena doesn't exist. Head back to the lobby and find your next match.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/">
            <Button size="lg" className="gap-2 px-8" data-testid="button-go-home"
              style={{ background: "linear-gradient(135deg, #FF2D8A, #FF7A00)" }}>
              <Home className="w-4 h-4" />
              Back to Lobby
            </Button>
          </Link>
          <Link href="/auth">
            <Button size="lg" variant="outline" className="gap-2 px-8 border-white/10" data-testid="button-sign-in">
              <Swords className="w-4 h-4" />
              Sign In
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
