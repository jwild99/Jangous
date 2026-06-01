import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import type { MatchWithPlayers } from "@shared/schema";
import { HowToPlayModal } from "./HowToPlayModal";

interface GameHelpButtonProps {
  match: MatchWithPlayers;
}

/**
 * A floating "How to Play" button rendered on top of every game.
 * Positioned fixed top-right so it doesn't affect game layouts.
 */
export function GameHelpButton({ match }: GameHelpButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="fixed top-3 right-3 z-50">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs rounded-full bg-background/70 backdrop-blur border border-border/40 shadow-md"
          onClick={() => setOpen(true)}
          data-testid="button-how-to-play"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">How to Play</span>
        </Button>
      </div>

      <HowToPlayModal
        gameType={match.gameType as any}
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
