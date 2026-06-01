import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Sparkles, Grid3x3, Trophy, Target, Award, Zap, ArrowDown } from "lucide-react";
import { TutorialShell, prettyTutorialTitle, TutorialShellStep } from "./TutorialShell";
import { useEmitCoachEvent } from "./TrainingCoach";
import { GhostDemo, type GhostStep } from "./GhostDemo";
import { useIsMobile } from "@/hooks/use-mobile";

const TUTORIAL_ID = "game-connect-4";

type Cell = 0 | 1 | 2; // 0 empty, 1 player, 2 bot

const ROWS = 6;
const COLS = 7;

function makeBoard(): Cell[][] {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => 0 as Cell));
}

function dropPiece(board: Cell[][], col: number, player: Cell): { board: Cell[][]; row: number } | null {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === 0) {
      const next = board.map((row) => row.slice()) as Cell[][];
      next[r][col] = player;
      return { board: next, row: r };
    }
  }
  return null;
}

function checkWin(board: Cell[][], player: Cell): boolean {
  const dirs: Array<[number, number]> = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] !== player) continue;
      for (const [dr, dc] of dirs) {
        let ok = true;
        for (let k = 0; k < 4; k++) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || board[rr][cc] !== player) {
            ok = false;
            break;
          }
        }
        if (ok) return true;
      }
    }
  }
  return false;
}

function botPickColumn(board: Cell[][]): number {
  // Friendly tutorial bot: block obvious player wins; otherwise pick a centerish column.
  // 1. Try to take any immediate win (rare here but handles it).
  for (let c = 0; c < COLS; c++) {
    const drop = dropPiece(board, c, 2);
    if (drop && checkWin(drop.board, 2)) return c;
  }
  // 2. Block the player's immediate win.
  for (let c = 0; c < COLS; c++) {
    const drop = dropPiece(board, c, 1);
    if (drop && checkWin(drop.board, 1)) return c;
  }
  // 3. Otherwise prefer a column with available space, biased to the center.
  const order = [3, 2, 4, 1, 5, 0, 6];
  for (const c of order) {
    if (board[0][c] === 0) return c;
  }
  return 0;
}

function Connect4Mini({
  onWin,
  onLoss,
  hintColumn,
}: {
  onWin: () => void;
  onLoss: () => void;
  hintColumn?: number;
}) {
  const [board, setBoard] = useState<Cell[][]>(() => makeBoard());
  const [turn, setTurn] = useState<"you" | "bot">("you");
  const [status, setStatus] = useState<"playing" | "won" | "lost" | "draw">("playing");
  const emit = useEmitCoachEvent();

  const isFull = useMemo(() => board[0].every((c) => c !== 0), [board]);

  const play = (col: number) => {
    if (status !== "playing" || turn !== "you") return;
    const next = dropPiece(board, col, 1);
    if (!next) return;
    if (checkWin(next.board, 1)) {
      setBoard(next.board);
      setStatus("won");
      emit({ type: "success", context: { stepId: "c4-practice", message: "Four in a row — clinical." } });
      setTimeout(onWin, 800);
      return;
    }
    // Did the player just miss blocking the bot's three-in-a-row?
    const botCouldWinNow = (() => {
      for (let c = 0; c < COLS; c++) {
        const d = dropPiece(next.board, c, 2);
        if (d && checkWin(d.board, 2)) return true;
      }
      return false;
    })();
    if (botCouldWinNow) {
      emit({
        type: "miss",
        context: {
          stepId: "c4-practice",
          hint: "Watch the bot's three-in-a-row — block it before stacking your own line.",
          struggleThreshold: 2,
        },
      });
    } else {
      emit({ type: "idle", context: { message: "Good build. Keep the center under control." } });
    }
    setBoard(next.board);
    setTurn("bot");
    setTimeout(() => {
      const botCol = botPickColumn(next.board);
      const botDrop = dropPiece(next.board, botCol, 2);
      if (!botDrop) {
        setStatus("draw");
        setTimeout(onWin, 800);
        return;
      }
      if (checkWin(botDrop.board, 2)) {
        setBoard(botDrop.board);
        setStatus("lost");
        emit({
          type: "miss",
          context: {
            stepId: "c4-practice",
            hint: "Bot closed a line. Always scan all four directions before committing.",
            struggleThreshold: 1,
          },
        });
        setTimeout(onLoss, 800);
        return;
      }
      const full = botDrop.board[0].every((c) => c !== 0);
      setBoard(botDrop.board);
      if (full) {
        setStatus("draw");
        setTimeout(onWin, 800);
      } else {
        setTurn("you");
      }
    }, 500);
  };

  return (
    <div className="space-y-3" data-testid="connect4-board">
      <div className="text-center text-xs text-muted-foreground">
        {status === "playing" && (turn === "you" ? "Your turn — drop a disc into any column." : "Bot is thinking…")}
        {status === "won" && <span className="text-emerald-400 font-semibold">Four in a row! Nice.</span>}
        {status === "lost" && <span className="text-rose-400 font-semibold">Bot got four — moving on.</span>}
        {status === "draw" && <span className="text-amber-400 font-semibold">Draw — board's full.</span>}
      </div>
      <div className="grid grid-cols-7 gap-1 p-2 rounded-xl bg-blue-950/70 border border-blue-500/30">
        {Array.from({ length: COLS }).map((_, c) => (
          <button
            key={`col-${c}`}
            onClick={() => play(c)}
            disabled={status !== "playing" || turn !== "you" || board[0][c] !== 0}
            className="flex flex-col gap-1 items-stretch hover-elevate rounded-md p-0.5 disabled:opacity-60 relative"
            data-testid={`button-c4-col-${c}`}
            aria-label={`Drop in column ${c + 1}`}
          >
            {hintColumn === c && status === "playing" && turn === "you" && (
              <ArrowDown className="absolute -top-4 left-1/2 -translate-x-1/2 w-4 h-4 text-amber-400 animate-bounce" />
            )}
            {Array.from({ length: ROWS }).map((_, r) => {
              const v = board[r][c];
              return (
                <motion.div
                  key={`cell-${r}-${c}`}
                  className={`aspect-square rounded-full border ${v === 1 ? "bg-amber-400 border-amber-300" : v === 2 ? "bg-rose-500 border-rose-400" : "bg-blue-950 border-blue-900"}`}
                  initial={v ? { y: -8, opacity: 0 } : false}
                  animate={{ y: 0, opacity: 1 }}
                />
              );
            })}
          </button>
        ))}
      </div>
      {isFull && status === "playing" && (
        <div className="text-center text-xs text-muted-foreground">Board full.</div>
      )}
    </div>
  );
}

function Connect4GhostDemo() {
  // Replays a tiny sequence: bot has 3 in row 5 cols 1-3; player must drop col 4 to block.
  const start: Cell[][] = makeBoard();
  start[5][1] = 2; start[5][2] = 2; start[5][3] = 2;
  start[4][3] = 1; start[4][2] = 1;
  const [board, setBoard] = useState<Cell[][]>(start);
  const [highlightCol, setHighlightCol] = useState<number | null>(null);

  const reset = () => {
    const b: Cell[][] = makeBoard();
    b[5][1] = 2; b[5][2] = 2; b[5][3] = 2;
    b[4][3] = 1; b[4][2] = 1;
    setBoard(b);
    setHighlightCol(null);
  };

  type C4Action = { kind: "highlight" | "drop"; col: number; player?: Cell };
  const ghostSteps: GhostStep<C4Action>[] = [
    { at: 300, caption: "Bot has three in a row across the bottom.", action: { kind: "highlight", col: 4 } },
    { at: 1500, caption: "Drop in column 4 to block the win.", action: { kind: "drop", col: 4, player: 1 } },
    { at: 2600, caption: "Line blocked. Now you can build your own." },
  ];

  return (
    <GhostDemo
      title="Coach Demo"
      description="Spotting the block — bot is one move from winning."
      steps={ghostSteps}
      onStep={(s) => {
        const a = s.action as { kind: string; col: number; player?: Cell } | undefined;
        if (!a) return;
        if (a.kind === "highlight") setHighlightCol(a.col);
        if (a.kind === "drop") {
          setBoard((b) => dropPiece(b, a.col, a.player ?? 1)?.board ?? b);
        }
      }}
      onFinish={reset}
    >
      <div className="grid grid-cols-7 gap-1 p-2 rounded-xl bg-blue-950/70 border border-blue-500/30">
        {Array.from({ length: COLS }).map((_, c) => (
          <div
            key={`g-col-${c}`}
            className={`flex flex-col gap-1 items-stretch rounded-md p-0.5 relative ${highlightCol === c ? "ring-2 ring-amber-400" : ""}`}
            data-testid={`ghost-c4-col-${c}`}
          >
            {highlightCol === c && (
              <ArrowDown className="absolute -top-4 left-1/2 -translate-x-1/2 w-4 h-4 text-amber-400 animate-bounce" />
            )}
            {Array.from({ length: ROWS }).map((_, r) => {
              const v = board[r][c];
              return (
                <div
                  key={`g-cell-${r}-${c}`}
                  className={`aspect-square rounded-full border ${v === 1 ? "bg-amber-400 border-amber-300" : v === 2 ? "bg-rose-500 border-rose-400" : "bg-blue-950 border-blue-900"}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </GhostDemo>
  );
}

export function Connect4Tutorial({
  startStep = 0,
  onClose,
  onComplete,
  onContinueNext,
}: {
  startStep?: number;
  onClose: () => void;
  onComplete: () => void;
  onContinueNext?: (nextId: string) => void;
}) {
  const isMobile = useIsMobile();

  const steps: TutorialShellStep[] = [
    {
      id: "intro",
      title: "Connect 4",
      body: "Drop discs from the top. First player to line up four in a row — horizontal, vertical, or diagonal — wins the pot.",
      icon: Sparkles,
      cta: "Start",
    },
    {
      id: "controls",
      title: "How to Move",
      body: isMobile
        ? "Tap any column to drop your disc into the lowest free slot in that column."
        : "Click any column to drop your disc into the lowest free slot in that column.",
      icon: Grid3x3,
      hint: "Center columns are the most valuable — they connect more lines.",
    },
    {
      id: "win",
      title: "Winning Lines",
      body: "Four discs in a row in any direction wins. Watch for diagonals — they're the most-missed wins.",
      icon: Target,
      hint: "Always check what your opponent is one move away from before playing your own line.",
      render: () => <Connect4GhostDemo />,
    },
    {
      id: "practice",
      title: "Beat the Bot",
      body: "Play a quick game against the training bot. Try to build a connect-4 of your own.",
      icon: Zap,
      blocking: true,
      render: ({ advance }) => (
        <Connect4Mini onWin={advance} onLoss={advance} hintColumn={3} />
      ),
    },
    {
      id: "payout",
      title: "Pots & Rake",
      body: "Connect 4 follows the same payout model as every Jango game: confirmed entry, transparent pot, 3% platform rake.",
      icon: Trophy,
    },
    {
      id: "complete",
      title: "Connect 4 Mastered",
      body: "You've got the basics down. Claim your badge to unlock the next training.",
      icon: Award,
    },
  ];

  return (
    <TutorialShell
      tutorialId={TUTORIAL_ID}
      steps={steps}
      rewardName="Connect 4 Rookie"
      rewardBlurb="Claim it now to unlock the next training."
      startStep={startStep}
      isMobile={isMobile}
      onClose={onClose}
      onComplete={onComplete}
      onContinueNext={onContinueNext}
      prettyTitle={prettyTutorialTitle}
    />
  );
}
