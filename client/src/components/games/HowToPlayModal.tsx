import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Target, Mouse, Trophy, Zap } from "lucide-react";
import type { GameType } from "@shared/schema";

interface HowToPlayModalProps {
  gameType: GameType;
  isOpen: boolean;
  onClose: () => void;
}

interface GameGuide {
  summary: string;
  estimatedTime: string;
  objective: string;
  controls: string[];
  winCondition: string;
  tips: string[];
}

const GUIDES: Record<string, GameGuide> = {
  chess: {
    summary: "Classic strategy game — outmaneuver your opponent to checkmate their King.",
    estimatedTime: "10–30 min",
    objective: "Put the opponent's King in checkmate — a position it cannot escape.",
    controls: [
      "Click a piece to select it — legal moves are highlighted in green",
      "Click a highlighted square to move the piece there",
      "Drag pieces to move them (optional)",
    ],
    winCondition: "Checkmate the opponent's King. Stalemate results in a draw.",
    tips: [
      "Control the center of the board early",
      "Castle early to protect your King",
      "Develop all pieces before attacking",
    ],
  },
  "mini-golf": {
    summary: "Sink the ball in the fewest strokes possible across 9 holes.",
    estimatedTime: "5–15 min",
    objective: "Putt the ball into the hole using as few strokes as possible.",
    controls: [
      "Click and drag away from the ball to aim and set power",
      "Release to shoot — the further you drag, the more power",
      "Use the power meter as a guide",
    ],
    winCondition: "Lowest total stroke count after all holes wins.",
    tips: [
      "Watch out for walls — use them to your advantage",
      "Take your time aiming before each shot",
      "Aim just past the hole on downhill putts",
    ],
  },
  "connect-4": {
    summary: "Drop colored discs to get four in a row before your opponent.",
    estimatedTime: "2–5 min",
    objective: "Connect four of your colored discs in a row — horizontal, vertical, or diagonal.",
    controls: [
      "Click any column to drop your disc into it",
      "Hover over a column to preview where your disc will land",
      "Discs fall to the lowest open space in the column",
    ],
    winCondition: "First to connect four discs in a row wins. Board full = draw.",
    tips: [
      "Control the center columns — they create the most threats",
      "Watch for diagonal threats, they're easy to miss",
      "Block your opponent while building your own threat",
    ],
  },
  "air-hockey": {
    summary: "Score goals by shooting the puck past your opponent's paddle.",
    estimatedTime: "2–5 min",
    objective: "Score the most goals before time runs out.",
    controls: [
      "Move your paddle with the mouse or finger",
      "Stay on your side of the center line",
      "Hit the puck to send it toward the opponent's goal",
    ],
    winCondition: "Most goals when the timer ends — or first to reach the goal limit.",
    tips: [
      "Angled shots are harder to block than straight shots",
      "Use the walls to create unexpected angles",
      "Keep your paddle moving to stay in position",
    ],
  },
  "rock-paper-scissors": {
    summary: "Choose your gesture — Rock beats Scissors, Paper beats Rock, Scissors beats Paper.",
    estimatedTime: "1–3 min",
    objective: "Win the most rounds in a best-of-3 (or best-of-5) match.",
    controls: [
      "Click Rock, Paper, or Scissors to make your choice",
      "Both choices are revealed simultaneously",
      "Results are shown after each round",
    ],
    winCondition: "Win the majority of rounds to win the match.",
    tips: [
      "Look for patterns in your opponent's choices",
      "After a loss, most players switch to what would have beaten them",
      "Scissors is the least common choice statistically",
    ],
  },
  "dots-and-boxes": {
    summary: "Draw lines to complete boxes. Most boxes wins.",
    estimatedTime: "3–8 min",
    objective: "Complete more boxes than your opponent by drawing the final edge of each box.",
    controls: [
      "Click between two dots to draw a line segment",
      "Hover over a line to preview it before placing",
      "Completing a box earns a point and an extra turn",
    ],
    winCondition: "Player with the most completed boxes at the end wins.",
    tips: [
      "Avoid completing three sides of a box — your opponent will take it",
      "Create chains of boxes to sweep multiple squares in one turn",
      "Force the opponent to open boxes by giving them small sacrifices",
    ],
  },
  "8-ball": {
    summary: "Sink your group of balls then pocket the 8-ball to win.",
    estimatedTime: "5–15 min",
    objective: "Sink all of your balls (solids 1–7 or stripes 9–15), then pocket the 8-ball.",
    controls: [
      "Click and drag the cue stick to aim",
      "Pull back further for more power, release to shoot",
      "Aim line shows the predicted ball path",
    ],
    winCondition: "Pocket the 8-ball after clearing your group. Potting 8-ball early or on scratch = loss.",
    tips: [
      "Plan several shots ahead before you shoot",
      "Leave yourself good position after each shot",
      "Avoid leaving the cue ball near the pocket",
    ],
  },
  bowling: {
    summary: "Roll the ball to knock down all 10 pins. Score strikes and spares for bonus points.",
    estimatedTime: "5–10 min",
    objective: "Score as many points as possible over 10 frames by knocking down pins.",
    controls: [
      "Set your aim angle by clicking on the lane",
      "Adjust power with the power slider or drag mechanic",
      "Release to bowl — ball follows a predictable path",
    ],
    winCondition: "Highest score after 10 frames wins. Strike = all 10 pins on first roll. Spare = all remaining on second.",
    tips: [
      "Aim for the pocket (slightly right of center for right-handers)",
      "Strikes in a row multiply your bonus dramatically",
      "Spares are worth more than split attempts",
    ],
  },
  "cup-king": {
    summary: "Toss the ball into your opponent's cups to eliminate them. Last cup wins.",
    estimatedTime: "3–8 min",
    objective: "Sink the ball into all of your opponent's cups before they sink yours.",
    controls: [
      "Aim by moving your pointer left or right",
      "Hold to build power, release to throw",
      "The ball follows an arc — adjust for distance",
    ],
    winCondition: "Eliminate all of your opponent's cups first to win.",
    tips: [
      "Aim for the back cups first — they're harder to target later",
      "Watch the arc trajectory — it's consistent",
      "Don't rush — timing your release matters more than speed",
    ],
  },
  "stack-tower": {
    summary: "Drop blocks at the right moment. Overhang is trimmed — stack as high as you can.",
    estimatedTime: "2–5 min",
    objective: "Stack blocks as precisely as possible to build the tallest tower.",
    controls: [
      "Press Space, tap, or click to drop the moving block",
      "Time your drop so the block aligns with the one below",
      "The overhanging portion is removed after each drop",
    ],
    winCondition: "Build a higher tower than your opponent, or score more points from precise placements.",
    tips: [
      "Watch the rhythm — the block speed increases with height",
      "A perfect placement keeps the full block width",
      "Tiny misses compound — one bad drop makes the next harder",
    ],
  },
  "block-blast": {
    summary: "Head-to-head Tetris-style battle — clear lines to score points and send garbage rows to your opponent.",
    estimatedTime: "90 sec",
    objective: "Score more points than your opponent by clearing lines within the 90-second time limit.",
    controls: [
      "Arrow Left / Right to move the piece sideways",
      "Arrow Up or Z to rotate the piece",
      "Arrow Down to soft-drop (move down faster)",
      "Space to hard-drop the piece instantly to the bottom",
      "C to hold the current piece for later use",
    ],
    winCondition: "Player with the highest score when the timer runs out wins. Clearing 2+ lines at once sends garbage rows to your opponent.",
    tips: [
      "Hard-drop pieces quickly to maximize your scoring rate",
      "Keep your stack flat to set up multi-line clears",
      "Combos (consecutive line clears) multiply your score bonus",
    ],
  },
};

const FALLBACK_GUIDE: GameGuide = {
  summary: "Compete against your opponent to win the match.",
  estimatedTime: "Varies",
  objective: "Outperform your opponent according to the game rules.",
  controls: ["Use mouse or touch to interact with the game"],
  winCondition: "First to reach the win condition wins.",
  tips: ["Play carefully and think ahead"],
};

export function HowToPlayModal({ gameType, isOpen, onClose }: HowToPlayModalProps) {
  const guide = GUIDES[gameType] ?? FALLBACK_GUIDE;

  const GAME_NAMES: Partial<Record<string, string>> = {
    chess: "Chess",
    "mini-golf": "Mini Golf",
    "connect-4": "Connect 4",
    "air-hockey": "Air Hockey",
    "rock-paper-scissors": "Rock Paper Scissors",
    "dots-and-boxes": "Dots & Boxes",
    "8-ball": "8-Ball Pool",
    bowling: "Bowling",
    "cup-king": "Cup Pong",
    "stack-tower": "Tower Stack",
    "block-blast": "Block Blast",
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md glass-override border-border/40">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg">How to Play: {GAME_NAMES[gameType] ?? gameType}</DialogTitle>
            <Badge variant="outline" className="text-xs ml-2 flex-shrink-0">
              ~{guide.estimatedTime}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground pt-1">{guide.summary}</p>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Objective */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Target className="w-3.5 h-3.5 text-primary" />
              Objective
            </div>
            <p className="text-sm text-muted-foreground pl-5">{guide.objective}</p>
          </div>

          {/* Controls */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Mouse className="w-3.5 h-3.5 text-primary" />
              Controls
            </div>
            <ul className="space-y-1 pl-5">
              {guide.controls.map((ctrl, i) => (
                <li key={i} className="text-sm text-muted-foreground flex gap-2">
                  <span className="text-primary/60 flex-shrink-0 font-mono text-xs mt-0.5">{i + 1}.</span>
                  {ctrl}
                </li>
              ))}
            </ul>
          </div>

          {/* Win Condition */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Trophy className="w-3.5 h-3.5 text-primary" />
              Win Condition
            </div>
            <p className="text-sm text-muted-foreground pl-5">{guide.winCondition}</p>
          </div>

          {/* Tips */}
          <div className="space-y-1.5 rounded-lg bg-primary/5 border border-primary/10 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Zap className="w-3.5 h-3.5 text-primary" />
              Quick Tips
            </div>
            <ul className="space-y-1">
              {guide.tips.map((tip, i) => (
                <li key={i} className="text-sm text-muted-foreground flex gap-2">
                  <span className="text-primary flex-shrink-0">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
