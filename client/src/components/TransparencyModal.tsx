import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Shield, Scale, FileText } from "lucide-react";

interface TransparencyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransparencyModal({ open, onOpenChange }: TransparencyModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="modal-transparency">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Skill-Based Gaming Platform
          </DialogTitle>
          <DialogDescription>
            Understanding how Jango.us works and why it's not gambling
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Key Distinction */}
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Skill-Based, Not Gambling
            </h3>
            <p className="text-sm text-muted-foreground">
              Jango.us is a competitive skill-based gaming platform where outcomes are determined by player
              ability, strategy, and knowledge—not chance or random events. Unlike gambling, success on
              Jango.us requires practice, learning, and mastery of game mechanics.
            </p>
          </div>

          {/* How It Works */}
          <div>
            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Fair Competition Principles
            </h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <Badge variant="outline" className="shrink-0">1</Badge>
                <div>
                  <p className="font-medium text-sm">Deterministic Outcomes</p>
                  <p className="text-sm text-muted-foreground">
                    All game results are based purely on player actions and decisions. Chess, Connect 4,
                    and Mini Golf have no randomness—the better player wins.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Badge variant="outline" className="shrink-0">2</Badge>
                <div>
                  <p className="font-medium text-sm">Equal Playing Field</p>
                  <p className="text-sm text-muted-foreground">
                    Both players have access to the same game state, rules, and opportunities. There are
                    no hidden advantages or house edges.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Badge variant="outline" className="shrink-0">3</Badge>
                <div>
                  <p className="font-medium text-sm">Server-Side Verification</p>
                  <p className="text-sm text-muted-foreground">
                    All moves and game outcomes are validated server-side with cryptographic hashing
                    (SHA-256) to ensure fairness and prevent cheating.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Badge variant="outline" className="shrink-0">4</Badge>
                <div>
                  <p className="font-medium text-sm">Transparent Platform Fee</p>
                  <p className="text-sm text-muted-foreground">
                    Jango.us charges a 3% platform fee on winnings. This is clearly disclosed before every
                    match—there are no hidden fees or changing odds.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Responsible Gaming */}
          <div>
            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Responsible Gaming Commitment
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Players must be 18+ to participate in wagered matches</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Practice modes available for learning without risking funds</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Deposit and withdrawal limits can be set on your account</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>All match fairness logs are stored and available for dispute review</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>We encourage players to only wager what they can afford to lose</span>
              </li>
            </ul>
          </div>

          {/* Legal Disclaimer */}
          <div className="bg-muted/50 border rounded-lg p-4 text-xs text-muted-foreground">
            <p className="font-semibold mb-2">Legal Disclaimer</p>
            <p>
              Jango.us operates as a peer-to-peer skill-based gaming platform. Players compete against each
              other, not against the house. The platform facilitates fair competition and charges a
              service fee. Users are responsible for understanding and complying with local laws regarding
              skill-based gaming in their jurisdiction. By using Jango.us, you confirm you are 18+ and
              accept our Terms of Service.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
