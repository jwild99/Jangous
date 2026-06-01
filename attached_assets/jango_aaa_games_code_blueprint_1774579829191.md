
# Jango AAA Games Code Blueprint (TypeScript / React)

This is a **production-oriented blueprint + starter code pack** for the games shown in your lobby.
It is **not a claim that all 15 games are fully finished** inside one file.
It **is** a serious, detailed handoff your developer can use to build the system the right way:
- shared architecture
- shared bot framework
- shared game loop contracts
- shared FX/audio/UI systems
- per-game config/state/action definitions
- per-game scene/controller skeletons
- detailed implementation notes for AAA feel

The goal is to give your dev a real foundation instead of vague prompts.

---

# 0) Repo structure

```txt
jango/
  apps/
    web/
      src/
        games/
          registry.ts
          shared/
            audio.ts
            fx.ts
            gameShell.tsx
            matchmaking.ts
            walletRules.ts
            difficulty.ts
            ui/
              EventBanner.tsx
              TurnBadge.tsx
              Meter.tsx
              MatchHeader.tsx
          chess/
            config.ts
            types.ts
            engine.ts
            bot.ts
            ChessScene.tsx
          miniGolf/
            config.ts
            types.ts
            generation.ts
            physics.ts
            bot.ts
            MiniGolfScene.tsx
          connect4/
            config.ts
            types.ts
            engine.ts
            bot.ts
            Connect4Scene.tsx
          airHockey/
            config.ts
            types.ts
            physics.ts
            bot.ts
            AirHockeyScene.tsx
          rps/
            config.ts
            types.ts
            engine.ts
            bot.ts
            RpsScene.tsx
          dotsBoxes/
            config.ts
            types.ts
            engine.ts
            bot.ts
            DotsBoxesScene.tsx
          pool/
            config.ts
            types.ts
            physics.ts
            rules.ts
            bot.ts
            PoolScene.tsx
          bowling/
            config.ts
            types.ts
            physics.ts
            scoring.ts
            bot.ts
            BowlingScene.tsx
          cupKing/
            config.ts
            types.ts
            engine.ts
            bot.ts
            CupKingScene.tsx
          stackTower/
            config.ts
            types.ts
            engine.ts
            StackTowerScene.tsx
          blockBlast/
            config.ts
            types.ts
            engine.ts
            BlockBlastScene.tsx
          tron/
            config.ts
            types.ts
            engine.ts
            bot.ts
            TronScene.tsx
          basketball/
            config.ts
            types.ts
            physics.ts
            bot.ts
            BasketballScene.tsx
          football/
            config.ts
            types.ts
            engine.ts
            bot.ts
            FootballScene.tsx
          racing/
            config.ts
            types.ts
            physics.ts
            bot.ts
            RacingScene.tsx
```

---

# 1) Shared foundation

## `apps/web/src/games/shared/difficulty.ts`

```ts
export type BotDifficulty = "easy" | "medium" | "hard";

export interface DifficultyProfile {
  label: string;
  reactionMs: number;
  accuracy: number;      // 0..1
  mistakeRate: number;   // 0..1
  lookahead: number;     // game-specific meaning
  aggression: number;    // 0..1
}

export const DIFFICULTY_PROFILES: Record<BotDifficulty, DifficultyProfile> = {
  easy: {
    label: "Easy",
    reactionMs: 1200,
    accuracy: 0.45,
    mistakeRate: 0.35,
    lookahead: 1,
    aggression: 0.25,
  },
  medium: {
    label: "Medium",
    reactionMs: 700,
    accuracy: 0.72,
    mistakeRate: 0.12,
    lookahead: 2,
    aggression: 0.55,
  },
  hard: {
    label: "Hard",
    reactionMs: 350,
    accuracy: 0.9,
    mistakeRate: 0.03,
    lookahead: 4,
    aggression: 0.8,
  },
};
```

## `apps/web/src/games/shared/audio.ts`

```ts
export type SfxName =
  | "ui-click"
  | "ui-confirm"
  | "countdown"
  | "win"
  | "loss"
  | "draw"
  | "coin"
  | "impact-soft"
  | "impact-hard"
  | "swish"
  | "splash"
  | "gutter"
  | "pocket"
  | "cue-hit"
  | "pin-crash"
  | "strike"
  | "spare"
  | "goal"
  | "goal-horn"
  | "hover";

export class AudioManager {
  private cache = new Map<SfxName, HTMLAudioElement>();
  private muted = false;
  private sfxVolume = 0.9;
  private musicVolume = 0.45;

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  setSfxVolume(volume: number) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  preload(name: SfxName, url: string) {
    const audio = new Audio(url);
    audio.preload = "auto";
    this.cache.set(name, audio);
  }

  play(name: SfxName, playbackRate = 1) {
    if (this.muted) return;
    const src = this.cache.get(name);
    if (!src) return;

    const a = src.cloneNode(true) as HTMLAudioElement;
    a.volume = this.sfxVolume;
    a.playbackRate = playbackRate;
    void a.play().catch(() => {});
  }
}

export const audio = new AudioManager();
```

## `apps/web/src/games/shared/fx.ts`

```ts
export type BannerTone = "info" | "success" | "danger" | "warning";

export interface BannerEvent {
  id: string;
  text: string;
  tone: BannerTone;
  durationMs?: number;
}

type Listener = (event: BannerEvent) => void;

class FxBus {
  private listeners = new Set<Listener>();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: BannerEvent) {
    for (const listener of this.listeners) listener(event);
  }

  success(text: string, durationMs = 1400) {
    this.emit({ id: crypto.randomUUID(), text, tone: "success", durationMs });
  }

  danger(text: string, durationMs = 1600) {
    this.emit({ id: crypto.randomUUID(), text, tone: "danger", durationMs });
  }

  info(text: string, durationMs = 1200) {
    this.emit({ id: crypto.randomUUID(), text, tone: "info", durationMs });
  }

  warning(text: string, durationMs = 1400) {
    this.emit({ id: crypto.randomUUID(), text, tone: "warning", durationMs });
  }
}

export const fxBus = new FxBus();
```

## `apps/web/src/games/shared/gameShell.tsx`

```tsx
import React from "react";

interface GameShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  topRight?: React.ReactNode;
  footer?: React.ReactNode;
}

export function GameShell({
  title,
  subtitle,
  children,
  topRight,
  footer,
}: GameShellProps) {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle ? (
              <p className="text-sm text-white/60">{subtitle}</p>
            ) : null}
          </div>
          {topRight}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] shadow-2xl backdrop-blur">
          {children}
        </div>

        {footer ? <div className="mt-4">{footer}</div> : null}
      </div>
    </div>
  );
}
```

## `apps/web/src/games/shared/walletRules.ts`

```ts
export type MatchMode = "casual" | "ranked" | "tournament";

export interface WagerRuleResult {
  amountScalps: number;
  locked: boolean;
  reason?: string;
}

export function getWagerRule(mode: MatchMode, customAmount?: number): WagerRuleResult {
  if (mode === "ranked") {
    return {
      amountScalps: 1,
      locked: true,
      reason: "Ranked is always locked at 1 Scalp per game.",
    };
  }

  if (mode === "tournament") {
    return {
      amountScalps: 5,
      locked: true,
      reason: "Tournament entry is fixed by event settings.",
    };
  }

  return {
    amountScalps: customAmount ?? 1,
    locked: false,
  };
}
```

## `apps/web/src/games/registry.ts`

```ts
import type { BotDifficulty } from "./shared/difficulty";

export type GameId =
  | "chess"
  | "mini-golf"
  | "connect-4"
  | "air-hockey"
  | "rps"
  | "dots-boxes"
  | "pool"
  | "bowling"
  | "cup-king"
  | "stack-tower"
  | "block-blast"
  | "tron"
  | "basketball"
  | "football"
  | "racing";

export interface GameDefinition {
  id: GameId;
  name: string;
  description: string;
  supportsBots: boolean;
  botDifficulties?: BotDifficulty[];
  ranked: boolean;
  tournament: boolean;
}

export const GAME_REGISTRY: GameDefinition[] = [
  {
    id: "chess",
    name: "Chess",
    description: "Competitive board strategy with timers, move history, and premium polish.",
    supportsBots: true,
    botDifficulties: ["easy", "medium", "hard"],
    ranked: true,
    tournament: true,
  },
  {
    id: "mini-golf",
    name: "Mini Golf",
    description: "Replayable hazard-based putting with randomized hole variations.",
    supportsBots: true,
    botDifficulties: ["easy", "medium", "hard"],
    ranked: true,
    tournament: true,
  },
  {
    id: "connect-4",
    name: "Connect 4",
    description: "Fast tactical dropping game with minimax-based bots.",
    supportsBots: true,
    botDifficulties: ["easy", "medium", "hard"],
    ranked: true,
    tournament: true,
  },
  {
    id: "air-hockey",
    name: "Air Hockey",
    description: "Arcade puck battles with responsive physics and neon presentation.",
    supportsBots: true,
    botDifficulties: ["easy", "medium", "hard"],
    ranked: true,
    tournament: false,
  },
  {
    id: "rps",
    name: "Rock Paper Scissors",
    description: "Fast read-and-react duel with countdown reveal and streak energy.",
    supportsBots: true,
    botDifficulties: ["easy", "medium", "hard"],
    ranked: false,
    tournament: true,
  },
  {
    id: "dots-boxes",
    name: "Dots & Boxes",
    description: "Strategic line-drawing game with chain control and clear scoring.",
    supportsBots: true,
    botDifficulties: ["easy", "medium", "hard"],
    ranked: true,
    tournament: true,
  },
  {
    id: "pool",
    name: "8-Ball Pool",
    description: "Competitive cue sports with premium table visuals and reliable shot feel.",
    supportsBots: true,
    botDifficulties: ["easy", "medium", "hard"],
    ranked: true,
    tournament: true,
  },
  {
    id: "bowling",
    name: "Bowling",
    description: "Arcade bowling with position, aim, power, hook, and strike dopamine.",
    supportsBots: true,
    botDifficulties: ["easy", "medium", "hard"],
    ranked: false,
    tournament: true,
  },
  {
    id: "cup-king",
    name: "Cup King",
    description: "Precision tabletop skill game with bounce/sink payoff and strong feedback.",
    supportsBots: true,
    botDifficulties: ["easy", "medium", "hard"],
    ranked: false,
    tournament: true,
  },
  {
    id: "stack-tower",
    name: "Stack Tower",
    description: "Addictive perfect-drop tower stacking with combo rewards.",
    supportsBots: false,
    ranked: false,
    tournament: true,
  },
  {
    id: "block-blast",
    name: "Block Blast",
    description: "Combo-heavy block clearing with polished drag/drop feedback.",
    supportsBots: false,
    ranked: false,
    tournament: true,
  },
  {
    id: "tron",
    name: "Tron",
    description: "Neon light-cycle arena with sharp turns and strong bot pathing.",
    supportsBots: true,
    botDifficulties: ["easy", "medium", "hard"],
    ranked: true,
    tournament: true,
  },
  {
    id: "basketball",
    name: "Basketball",
    description: "Arcade shot-making with trajectory control, swishes, and arena energy.",
    supportsBots: true,
    botDifficulties: ["easy", "medium", "hard"],
    ranked: true,
    tournament: true,
  },
  {
    id: "football",
    name: "Football",
    description: "Readable football action with passes, catches, tackling, and strong flow.",
    supportsBots: true,
    botDifficulties: ["easy", "medium", "hard"],
    ranked: true,
    tournament: true,
  },
  {
    id: "racing",
    name: "Racing",
    description: "Responsive arcade racing with polished tracks, handling, and AI drivers.",
    supportsBots: true,
    botDifficulties: ["easy", "medium", "hard"],
    ranked: true,
    tournament: true,
  },
];
```

---

# 2) Chess

## `apps/web/src/games/chess/types.ts`

```ts
export type ChessColor = "white" | "black";
export type ChessPieceType = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";

export interface ChessPiece {
  id: string;
  color: ChessColor;
  type: ChessPieceType;
  file: number; // 0..7
  rank: number; // 0..7
  hasMoved: boolean;
}

export interface ChessMove {
  fromFile: number;
  fromRank: number;
  toFile: number;
  toRank: number;
  promotion?: ChessPieceType;
  san?: string;
  capturedPieceId?: string;
  castle?: "king" | "queen";
  enPassant?: boolean;
}

export interface ChessState {
  pieces: ChessPiece[];
  turn: ChessColor;
  selectedPieceId: string | null;
  legalMoves: ChessMove[];
  history: ChessMove[];
  capturedWhite: ChessPieceType[];
  capturedBlack: ChessPieceType[];
  check: ChessColor | null;
  winner: ChessColor | null;
  drawReason: string | null;
}
```

## `apps/web/src/games/chess/engine.ts`

```ts
import { ChessMove, ChessPiece, ChessState } from "./types";

export function createInitialChessState(): ChessState {
  // For production, build all pieces properly.
  return {
    pieces: [],
    turn: "white",
    selectedPieceId: null,
    legalMoves: [],
    history: [],
    capturedWhite: [],
    capturedBlack: [],
    check: null,
    winner: null,
    drawReason: null,
  };
}

export function getLegalMoves(state: ChessState, pieceId: string): ChessMove[] {
  // Plug in real move generation.
  return [];
}

export function applyMove(state: ChessState, move: ChessMove): ChessState {
  // Real engine should handle captures, castles, en passant, promotion, check, mate, draw.
  return {
    ...state,
    history: [...state.history, move],
    turn: state.turn === "white" ? "black" : "white",
    selectedPieceId: null,
    legalMoves: [],
  };
}
```

## `apps/web/src/games/chess/bot.ts`

```ts
import type { BotDifficulty } from "../shared/difficulty";
import { DIFFICULTY_PROFILES } from "../shared/difficulty";
import type { ChessMove, ChessState } from "./types";

function evaluateMaterial(state: ChessState): number {
  // placeholder
  return 0;
}

export function chooseChessBotMove(state: ChessState, difficulty: BotDifficulty): ChessMove | null {
  const profile = DIFFICULTY_PROFILES[difficulty];

  // Replace with real engine search.
  // Hard should use deeper evaluation, medium moderate, easy shallow/random.
  const candidateMoves: ChessMove[] = [];

  if (candidateMoves.length === 0) return null;

  if (difficulty === "easy") {
    return candidateMoves[Math.floor(Math.random() * candidateMoves.length)];
  }

  if (difficulty === "medium") {
    return candidateMoves[0];
  }

  return candidateMoves[0];
}
```

## `apps/web/src/games/chess/ChessScene.tsx`

```tsx
import React, { useMemo, useState } from "react";
import { GameShell } from "../shared/gameShell";
import { fxBus } from "../shared/fx";
import { audio } from "../shared/audio";
import { applyMove, createInitialChessState, getLegalMoves } from "./engine";
import { chooseChessBotMove } from "./bot";
import type { BotDifficulty } from "../shared/difficulty";

export function ChessScene({ botDifficulty }: { botDifficulty?: BotDifficulty }) {
  const [state, setState] = useState(createInitialChessState());

  const onSquareClick = (file: number, rank: number) => {
    // Select piece or apply move.
  };

  const doBotTurn = async () => {
    if (!botDifficulty) return;
    const move = chooseChessBotMove(state, botDifficulty);
    if (!move) return;
    await new Promise((r) => setTimeout(r, 500));
    setState((s) => applyMove(s, move));
    audio.play("ui-confirm");
  };

  return (
    <GameShell
      title="Chess"
      subtitle="Premium board strategy with bots, timers, and polished move feedback."
    >
      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
        <div className="aspect-square rounded-3xl border border-white/10 bg-black/30 p-3">
          {/* Render board, move highlights, last move, check glow, captured pieces */}
        </div>
        <aside className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          {/* Move list, timers, captured pieces, resign/draw/rematch */}
        </aside>
      </div>
    </GameShell>
  );
}
```

AAA notes:
- add board hover lift, legal dots, premove queue, last move glow
- low-time pulse on timers
- victory modal with score/rank wallet settlement

---

# 3) Mini Golf

## `apps/web/src/games/miniGolf/types.ts`

```ts
export type SurfaceType = "grass" | "sand" | "water" | "wall" | "hole";

export interface Vec2 {
  x: number;
  y: number;
}

export interface HazardZone {
  id: string;
  type: "sand" | "water";
  polygon: Vec2[];
}

export interface WallSegment {
  id: string;
  a: Vec2;
  b: Vec2;
}

export interface MiniGolfHole {
  id: string;
  par: number;
  start: Vec2;
  cup: Vec2;
  walls: WallSegment[];
  hazards: HazardZone[];
  theme: "night-drive" | "neon-lane" | "desert" | "classic";
}

export interface MiniGolfBall {
  position: Vec2;
  velocity: Vec2;
  radius: number;
  inHole: boolean;
}

export interface MiniGolfState {
  holeIndex: number;
  holes: MiniGolfHole[];
  ball: MiniGolfBall;
  strokes: number;
  totalScore: number;
  completed: boolean;
  pendingPenalty: number;
}
```

## `apps/web/src/games/miniGolf/generation.ts`

```ts
import type { MiniGolfHole, Vec2, WallSegment, HazardZone } from "./types";

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function makeRectWalls(x: number, y: number, w: number, h: number): WallSegment[] {
  return [
    { id: "top", a: { x, y }, b: { x: x + w, y } },
    { id: "right", a: { x: x + w, y }, b: { x: x + w, y: y + h } },
    { id: "bottom", a: { x: x + w, y: y + h }, b: { x, y: y + h } },
    { id: "left", a: { x, y: y + h }, b: { x, y } },
  ];
}

export function generateMiniGolfCourse(seed: number, holeCount = 9): MiniGolfHole[] {
  const holes: MiniGolfHole[] = [];

  for (let i = 0; i < holeCount; i++) {
    const width = 860;
    const height = 540;

    const start = { x: rand(100, 220), y: rand(260, 460) };
    const cup = { x: rand(620, 760), y: rand(100, 260) };

    const hazards: HazardZone[] = [];

    if (i % 2 === 0) {
      hazards.push({
        id: `sand-${i}`,
        type: "sand",
        polygon: [
          { x: 320, y: 290 },
          { x: 450, y: 280 },
          { x: 480, y: 380 },
          { x: 330, y: 390 },
        ],
      });
    }

    if (i % 3 === 0) {
      hazards.push({
        id: `water-${i}`,
        type: "water",
        polygon: [
          { x: 520, y: 130 },
          { x: 660, y: 140 },
          { x: 650, y: 220 },
          { x: 510, y: 210 },
        ],
      });
    }

    holes.push({
      id: `hole-${i + 1}`,
      par: i % 2 === 0 ? 3 : 2,
      start,
      cup,
      walls: makeRectWalls(40, 40, width, height),
      hazards,
      theme: i % 2 === 0 ? "night-drive" : "classic",
    });
  }

  return holes;
}
```

## `apps/web/src/games/miniGolf/physics.ts`

```ts
import type { MiniGolfBall, MiniGolfHole, Vec2 } from "./types";

function pointInPolygon(point: Vec2, polygon: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 0.00001) + xi;

    if (intersect) inside = !inside;
  }
  return inside;
}

export function stepMiniGolf(
  ball: MiniGolfBall,
  hole: MiniGolfHole,
  dt: number,
): { ball: MiniGolfBall; water: boolean; sand: boolean; sunk: boolean } {
  let water = false;
  let sand = false;

  const next = { ...ball, position: { ...ball.position }, velocity: { ...ball.velocity } };
  next.position.x += next.velocity.x * dt;
  next.position.y += next.velocity.y * dt;

  for (const hazard of hole.hazards) {
    if (pointInPolygon(next.position, hazard.polygon)) {
      if (hazard.type === "water") {
        water = true;
      } else if (hazard.type === "sand") {
        sand = true;
      }
    }
  }

  const friction = sand ? 0.88 : 0.96;
  next.velocity.x *= friction;
  next.velocity.y *= friction;

  const dx = hole.cup.x - next.position.x;
  const dy = hole.cup.y - next.position.y;
  const dist = Math.hypot(dx, dy);

  const sunk = dist < 14 && Math.hypot(next.velocity.x, next.velocity.y) < 1.8;

  if (sunk) {
    next.inHole = true;
    next.velocity.x = 0;
    next.velocity.y = 0;
  }

  return { ball: next, water, sand, sunk };
}
```

## `apps/web/src/games/miniGolf/bot.ts`

```ts
import type { BotDifficulty } from "../shared/difficulty";
import { DIFFICULTY_PROFILES } from "../shared/difficulty";
import type { MiniGolfHole, Vec2 } from "./types";

export interface MiniGolfBotShot {
  angleRad: number;
  power: number;
}

export function chooseMiniGolfBotShot(hole: MiniGolfHole, difficulty: BotDifficulty): MiniGolfBotShot {
  const profile = DIFFICULTY_PROFILES[difficulty];
  const dx = hole.cup.x - hole.start.x;
  const dy = hole.cup.y - hole.start.y;
  const baseAngle = Math.atan2(dy, dx);

  const angleError = (1 - profile.accuracy) * 0.6 * (Math.random() - 0.5);
  const power = Math.min(1, Math.max(0.25, 0.52 + Math.random() * 0.28 - profile.mistakeRate * 0.2));

  return {
    angleRad: baseAngle + angleError,
    power,
  };
}
```

## `apps/web/src/games/miniGolf/MiniGolfScene.tsx`

```tsx
import React, { useMemo, useState } from "react";
import { GameShell } from "../shared/gameShell";
import { audio } from "../shared/audio";
import { fxBus } from "../shared/fx";
import { generateMiniGolfCourse } from "./generation";
import { stepMiniGolf } from "./physics";
import type { BotDifficulty } from "../shared/difficulty";

export function MiniGolfScene({ botDifficulty }: { botDifficulty?: BotDifficulty }) {
  const holes = useMemo(() => generateMiniGolfCourse(1, 9), []);
  const [holeIndex, setHoleIndex] = useState(0);

  const onBallSunk = () => {
    audio.play("coin");
    fxBus.success("Hole Complete");
    setHoleIndex((i) => Math.min(i + 1, holes.length - 1));
  };

  return (
    <GameShell
      title="Mini Golf"
      subtitle="Randomized hazard golf with water, sand, bot support, and stronger replay value."
    >
      <div className="p-4">
        {/* Canvas or SVG course rendering */}
        {/* Scorecard */}
        {/* Shot meter / drag indicator */}
      </div>
    </GameShell>
  );
}
```

AAA notes:
- hole intro flyover
- splash effect for water, sand dust puffs
- move to next hole automatically with no soft locks
- validate generated holes before use

---

# 4) Connect 4

## `apps/web/src/games/connect4/types.ts`

```ts
export type Connect4Cell = 0 | 1 | 2;

export interface Connect4State {
  board: Connect4Cell[][];
  currentPlayer: 1 | 2;
  winner: 0 | 1 | 2;
  winningCells: Array<{ row: number; col: number }>;
  lastMove: { row: number; col: number } | null;
}
```

## `apps/web/src/games/connect4/engine.ts`

```ts
import type { Connect4Cell, Connect4State } from "./types";

export function createConnect4State(): Connect4State {
  return {
    board: Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => 0 as Connect4Cell)),
    currentPlayer: 1,
    winner: 0,
    winningCells: [],
    lastMove: null,
  };
}

export function getDropRow(board: Connect4Cell[][], col: number): number {
  for (let row = board.length - 1; row >= 0; row--) {
    if (board[row][col] === 0) return row;
  }
  return -1;
}

export function applyConnect4Move(state: Connect4State, col: number): Connect4State {
  const row = getDropRow(state.board, col);
  if (row === -1 || state.winner) return state;

  const board = state.board.map((r) => [...r]);
  board[row][col] = state.currentPlayer;

  return {
    ...state,
    board,
    currentPlayer: state.currentPlayer === 1 ? 2 : 1,
    lastMove: { row, col },
  };
}
```

## `apps/web/src/games/connect4/bot.ts`

```ts
import type { BotDifficulty } from "../shared/difficulty";
import { getDropRow } from "./engine";
import type { Connect4State } from "./types";

export function chooseConnect4BotMove(state: Connect4State, difficulty: BotDifficulty): number {
  const validCols = Array.from({ length: 7 }, (_, c) => c).filter((c) => getDropRow(state.board, c) !== -1);

  if (difficulty === "easy") {
    return validCols[Math.floor(Math.random() * validCols.length)];
  }

  // Replace with real minimax.
  return validCols[3] ?? validCols[0];
}
```

## `apps/web/src/games/connect4/Connect4Scene.tsx`

```tsx
import React, { useState } from "react";
import { GameShell } from "../shared/gameShell";
import { fxBus } from "../shared/fx";
import { audio } from "../shared/audio";
import { applyConnect4Move, createConnect4State } from "./engine";
import { chooseConnect4BotMove } from "./bot";
import type { BotDifficulty } from "../shared/difficulty";

export function Connect4Scene({ botDifficulty }: { botDifficulty?: BotDifficulty }) {
  const [state, setState] = useState(createConnect4State());

  const drop = (col: number) => {
    setState((s) => applyConnect4Move(s, col));
    audio.play("ui-confirm");
  };

  return (
    <GameShell title="Connect 4" subtitle="Premium drop strategy with bots and winning-line highlights.">
      <div className="p-6">
        {/* Render board with hover preview and animated chip drops */}
      </div>
    </GameShell>
  );
}
```

AAA notes:
- show pending column glow
- animate chip descent and winning cells pulse
- combo-like celebration on connect

---

# 5) Air Hockey

## `apps/web/src/games/airHockey/types.ts`

```ts
export interface Vec2 {
  x: number;
  y: number;
}

export interface Puck {
  position: Vec2;
  velocity: Vec2;
  radius: number;
}

export interface Mallet {
  position: Vec2;
  radius: number;
  speed: number;
}

export interface AirHockeyState {
  puck: Puck;
  player: Mallet;
  opponent: Mallet;
  playerScore: number;
  opponentScore: number;
  winner: "player" | "opponent" | null;
}
```

## `apps/web/src/games/airHockey/physics.ts`

```ts
import type { AirHockeyState } from "./types";

export function stepAirHockey(state: AirHockeyState, dt: number): AirHockeyState {
  const next = structuredClone(state);

  next.puck.position.x += next.puck.velocity.x * dt;
  next.puck.position.y += next.puck.velocity.y * dt;

  next.puck.velocity.x *= 0.995;
  next.puck.velocity.y *= 0.995;

  // Table wall collision
  if (next.puck.position.x < 40 || next.puck.position.x > 860) {
    next.puck.velocity.x *= -1;
  }
  if (next.puck.position.y < 40 || next.puck.position.y > 460) {
    next.puck.velocity.y *= -1;
  }

  return next;
}
```

## `apps/web/src/games/airHockey/bot.ts`

```ts
import type { BotDifficulty } from "../shared/difficulty";
import type { AirHockeyState } from "./types";

export function updateAirHockeyBot(state: AirHockeyState, difficulty: BotDifficulty, dt: number): AirHockeyState {
  const next = structuredClone(state);
  const targetX = difficulty === "hard" ? state.puck.position.x : 450;
  const moveFactor = difficulty === "easy" ? 0.04 : difficulty === "medium" ? 0.08 : 0.12;

  next.opponent.position.x += (targetX - next.opponent.position.x) * moveFactor;
  return next;
}
```

## `apps/web/src/games/airHockey/AirHockeyScene.tsx`

```tsx
import React from "react";
import { GameShell } from "../shared/gameShell";

export function AirHockeyScene() {
  return (
    <GameShell title="Air Hockey" subtitle="Responsive puck battles with neon arcade energy.">
      <div className="p-4">
        {/* Canvas render of table, puck, mallets, score, goal flashes */}
      </div>
    </GameShell>
  );
}
```

AAA notes:
- glowing table rails
- speed trails on fast puck
- goal horn and pulse overlay
- stronger hard-bot defensive positioning

---

# 6) Rock Paper Scissors

## `apps/web/src/games/rps/types.ts`

```ts
export type RpsChoice = "rock" | "paper" | "scissors";

export interface RpsRound {
  playerChoice: RpsChoice | null;
  opponentChoice: RpsChoice | null;
  winner: "player" | "opponent" | "draw" | null;
}

export interface RpsState {
  round: number;
  bestOf: 3 | 5 | 7;
  playerWins: number;
  opponentWins: number;
  current: RpsRound;
  matchWinner: "player" | "opponent" | null;
}
```

## `apps/web/src/games/rps/engine.ts`

```ts
import type { RpsChoice } from "./types";

export function resolveRps(player: RpsChoice, opponent: RpsChoice): "player" | "opponent" | "draw" {
  if (player === opponent) return "draw";
  if (
    (player === "rock" && opponent === "scissors") ||
    (player === "paper" && opponent === "rock") ||
    (player === "scissors" && opponent === "paper")
  ) return "player";
  return "opponent";
}
```

## `apps/web/src/games/rps/bot.ts`

```ts
import type { BotDifficulty } from "../shared/difficulty";
import type { RpsChoice } from "./types";

const CHOICES: RpsChoice[] = ["rock", "paper", "scissors"];

export function chooseRpsBotChoice(history: RpsChoice[], difficulty: BotDifficulty): RpsChoice {
  if (difficulty === "easy") {
    return CHOICES[Math.floor(Math.random() * CHOICES.length)];
  }

  if (difficulty === "medium") {
    return CHOICES[Math.floor(Math.random() * CHOICES.length)];
  }

  const last = history[history.length - 1];
  if (last === "rock") return "paper";
  if (last === "paper") return "scissors";
  if (last === "scissors") return "rock";
  return CHOICES[Math.floor(Math.random() * CHOICES.length)];
}
```

## `apps/web/src/games/rps/RpsScene.tsx`

```tsx
import React from "react";
import { GameShell } from "../shared/gameShell";

export function RpsScene() {
  return (
    <GameShell title="Rock Paper Scissors" subtitle="Countdown reveal, dramatic results, and streak energy.">
      <div className="p-6">
        {/* Countdown, animated hand reveal, match score, rematch */}
      </div>
    </GameShell>
  );
}
```

AAA notes:
- 3-2-1 countdown with tick sounds
- reveal slam and result banner
- best-of series with streak heat

---

# 7) Dots & Boxes

## `apps/web/src/games/dotsBoxes/types.ts`

```ts
export interface Edge {
  id: string;
  a: [number, number];
  b: [number, number];
  owner: 0 | 1 | 2;
}

export interface Box {
  id: string;
  top: string;
  right: string;
  bottom: string;
  left: string;
  owner: 0 | 1 | 2;
}

export interface DotsBoxesState {
  edges: Edge[];
  boxes: Box[];
  currentPlayer: 1 | 2;
  playerScore: number;
  opponentScore: number;
  winner: 0 | 1 | 2;
}
```

## `apps/web/src/games/dotsBoxes/engine.ts`

```ts
import type { DotsBoxesState } from "./types";

export function applyDotsBoxesMove(state: DotsBoxesState, edgeId: string): DotsBoxesState {
  // Fill edge, detect claimed boxes, preserve turn on box claim.
  return state;
}
```

## `apps/web/src/games/dotsBoxes/bot.ts`

```ts
import type { BotDifficulty } from "../shared/difficulty";
import type { DotsBoxesState } from "./types";

export function chooseDotsBoxesMove(state: DotsBoxesState, difficulty: BotDifficulty): string | null {
  // Hard should avoid giving away 3rd side / chain traps.
  return state.edges.find((e) => e.owner === 0)?.id ?? null;
}
```

## `apps/web/src/games/dotsBoxes/DotsBoxesScene.tsx`

```tsx
import React from "react";
import { GameShell } from "../shared/gameShell";

export function DotsBoxesScene() {
  return (
    <GameShell title="Dots & Boxes" subtitle="Strategic line control with box claims and turn momentum.">
      <div className="p-6">
        {/* SVG board with hover preview, chain callout, score */}
      </div>
    </GameShell>
  );
}
```

AAA notes:
- box claim fill animation
- chain popup on multi-box turn
- hard bot should understand sacrifice vs chain capture

---

# 8) 8-Ball Pool

## `apps/web/src/games/pool/types.ts`

```ts
export type BallType = "cue" | "solid" | "stripe" | "eight";

export interface Vec2 {
  x: number;
  y: number;
}

export interface PoolBall {
  id: string;
  type: BallType;
  number: number;
  position: Vec2;
  velocity: Vec2;
  radius: number;
  pocketed: boolean;
}

export interface Pocket {
  id: string;
  position: Vec2;
  radius: number;
}

export interface PoolTable {
  width: number;
  height: number;
  innerLeft: number;
  innerRight: number;
  innerTop: number;
  innerBottom: number;
  pockets: Pocket[];
}

export interface PoolState {
  balls: PoolBall[];
  currentPlayer: 1 | 2;
  assignedGroup: { 1: "solids" | "stripes" | null; 2: "solids" | "stripes" | null };
  winner: 0 | 1 | 2;
  foul: string | null;
  message: string | null;
  shotInProgress: boolean;
}
```

## `apps/web/src/games/pool/config.ts`

```ts
import type { PoolTable } from "./types";

export const POOL_TABLE: PoolTable = {
  width: 980,
  height: 560,
  innerLeft: 88,
  innerRight: 892,
  innerTop: 72,
  innerBottom: 488,
  pockets: [
    { id: "tl", position: { x: 88, y: 72 }, radius: 26 },
    { id: "tm", position: { x: 490, y: 64 }, radius: 24 },
    { id: "tr", position: { x: 892, y: 72 }, radius: 26 },
    { id: "bl", position: { x: 88, y: 488 }, radius: 26 },
    { id: "bm", position: { x: 490, y: 496 }, radius: 24 },
    { id: "br", position: { x: 892, y: 488 }, radius: 26 },
  ],
};
```

## `apps/web/src/games/pool/physics.ts`

```ts
import type { PoolBall, PoolState, Vec2 } from "./types";
import { POOL_TABLE } from "./config";

function length(v: Vec2) {
  return Math.hypot(v.x, v.y);
}

export function stepPool(state: PoolState, dt: number): PoolState {
  const next = structuredClone(state);

  for (const ball of next.balls) {
    if (ball.pocketed) continue;

    ball.position.x += ball.velocity.x * dt;
    ball.position.y += ball.velocity.y * dt;

    ball.velocity.x *= 0.992;
    ball.velocity.y *= 0.992;

    if (ball.position.x - ball.radius < POOL_TABLE.innerLeft) {
      ball.position.x = POOL_TABLE.innerLeft + ball.radius;
      ball.velocity.x *= -0.92;
    }
    if (ball.position.x + ball.radius > POOL_TABLE.innerRight) {
      ball.position.x = POOL_TABLE.innerRight - ball.radius;
      ball.velocity.x *= -0.92;
    }
    if (ball.position.y - ball.radius < POOL_TABLE.innerTop) {
      ball.position.y = POOL_TABLE.innerTop + ball.radius;
      ball.velocity.y *= -0.92;
    }
    if (ball.position.y + ball.radius > POOL_TABLE.innerBottom) {
      ball.position.y = POOL_TABLE.innerBottom - ball.radius;
      ball.velocity.y *= -0.92;
    }

    for (const pocket of POOL_TABLE.pockets) {
      const dx = pocket.position.x - ball.position.x;
      const dy = pocket.position.y - ball.position.y;
      if (Math.hypot(dx, dy) < pocket.radius) {
        ball.pocketed = true;
        ball.velocity.x = 0;
        ball.velocity.y = 0;
      }
    }
  }

  // TODO: ball-ball collisions with stable decomposition.
  return next;
}
```

## `apps/web/src/games/pool/rules.ts`

```ts
import type { PoolState } from "./types";

export function resolvePoolShot(state: PoolState): PoolState {
  // Detect first contact, scratches, group assignment, 8-ball rules, turn switching.
  return state;
}
```

## `apps/web/src/games/pool/bot.ts`

```ts
import type { BotDifficulty } from "../shared/difficulty";
import type { PoolState } from "./types";

export interface PoolBotShot {
  angle: number;
  power: number;
}

export function choosePoolBotShot(state: PoolState, difficulty: BotDifficulty): PoolBotShot | null {
  if (difficulty === "easy") {
    return { angle: Math.random() * Math.PI * 2, power: 0.45 };
  }
  if (difficulty === "medium") {
    return { angle: 0, power: 0.62 };
  }
  return { angle: 0, power: 0.78 };
}
```

## `apps/web/src/games/pool/PoolScene.tsx`

```tsx
import React, { useState } from "react";
import { GameShell } from "../shared/gameShell";
import { fxBus } from "../shared/fx";
import { audio } from "../shared/audio";
import type { BotDifficulty } from "../shared/difficulty";

export function PoolScene({ botDifficulty }: { botDifficulty?: BotDifficulty }) {
  const [shotPower, setShotPower] = useState(0);

  return (
    <GameShell
      title="8-Ball Pool"
      subtitle="Premium pool hall visuals, drag-to-shoot controls, and strong event feedback."
    >
      <div className="p-4">
        {/* Canvas table render */}
        {/* Top player panels */}
        {/* Drag shot controls - no giant bottom slider */}
        {/* Event banners: Scratch, Ball Sunk, You Sunk the 8, Nice Shot */}
      </div>
    </GameShell>
  );
}
```

AAA notes:
- balls must never enter the wood rail art
- pocket geometry should feel like real table mouths
- bar/lounge floor background with richer scene
- add pocket pulse, cue strike snap, dramatic 8-ball moment

---

# 9) Bowling

## `apps/web/src/games/bowling/types.ts`

```ts
export type BowlingPhase = "position" | "aim" | "power" | "effect" | "roll" | "resolve";

export interface BowlingBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  radius: number;
  rolling: boolean;
}

export interface BowlingPin {
  id: number;
  x: number;
  y: number;
  fallen: boolean;
  vx: number;
  vy: number;
}

export interface BowlingFrame {
  rolls: number[];
  marks: string[];
}

export interface BowlingState {
  phase: BowlingPhase;
  playerX: number;
  aim: number;
  power: number;
  effect: number;
  ball: BowlingBall;
  pins: BowlingPin[];
  frames: BowlingFrame[];
  currentFrame: number;
  rollInFrame: number;
  totalScore: number;
}
```

## `apps/web/src/games/bowling/scoring.ts`

```ts
import type { BowlingFrame } from "./types";

export function computeBowlingScore(frames: BowlingFrame[]): number {
  const rolls: number[] = [];
  frames.forEach((f) => rolls.push(...f.rolls));

  let score = 0;
  let i = 0;

  for (let frame = 0; frame < 10; frame++) {
    if ((rolls[i] ?? 0) === 10) {
      score += 10 + (rolls[i + 1] ?? 0) + (rolls[i + 2] ?? 0);
      i += 1;
    } else if ((rolls[i] ?? 0) + (rolls[i + 1] ?? 0) === 10) {
      score += 10 + (rolls[i + 2] ?? 0);
      i += 2;
    } else {
      score += (rolls[i] ?? 0) + (rolls[i + 1] ?? 0);
      i += 2;
    }
  }

  return score;
}
```

## `apps/web/src/games/bowling/physics.ts`

```ts
import type { BowlingBall, BowlingPin } from "./types";

export function stepBowling(ball: BowlingBall, pins: BowlingPin[], dt: number) {
  const nextBall = { ...ball };
  const nextPins = pins.map((p) => ({ ...p }));

  nextBall.x += nextBall.vx * dt;
  nextBall.y += nextBall.vy * dt;
  nextBall.vx += nextBall.spin * 0.02 * dt;
  nextBall.vx *= 0.997;
  nextBall.vy *= 0.996;

  for (const pin of nextPins) {
    if (pin.fallen) continue;
    const dx = pin.x - nextBall.x;
    const dy = pin.y - nextBall.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 22) {
      pin.fallen = true;
      pin.vx = nextBall.vx * 0.4;
      pin.vy = nextBall.vy * 0.4;
    }
  }

  return { ball: nextBall, pins: nextPins };
}
```

## `apps/web/src/games/bowling/bot.ts`

```ts
import type { BotDifficulty } from "../shared/difficulty";

export interface BowlingBotChoice {
  laneOffset: number;
  aim: number;
  power: number;
  effect: number;
}

export function chooseBowlingBotShot(difficulty: BotDifficulty): BowlingBotChoice {
  if (difficulty === "easy") {
    return { laneOffset: 0.12, aim: 0.1, power: 0.56, effect: 0.22 };
  }
  if (difficulty === "medium") {
    return { laneOffset: 0.04, aim: 0.03, power: 0.72, effect: 0.14 };
  }
  return { laneOffset: 0.01, aim: 0.01, power: 0.85, effect: 0.1 };
}
```

## `apps/web/src/games/bowling/BowlingScene.tsx`

```tsx
import React from "react";
import { GameShell } from "../shared/gameShell";

export function BowlingScene() {
  return (
    <GameShell
      title="Bowling"
      subtitle="Arcade bowling with position, aim, power, hook, strike dopamine, and alley atmosphere."
    >
      <div className="p-4">
        {/* Canvas lane */}
        {/* Overhead scoreboard */}
        {/* Left power meter / right effect meter */}
        {/* Third-person bowler */}
        {/* Strike / spare banners */}
      </div>
    </GameShell>
  );
}
```

AAA notes:
- big STRIKE text and cheer
- lane arrows, lane reflections, dark alley surroundings
- bowler visible on screen
- effect meter should control hook

---

# 10) Cup King

## `apps/web/src/games/cupKing/types.ts`

```ts
export interface CupKingShot {
  angle: number;
  power: number;
}

export interface CupKingState {
  cupsRemainingPlayer: number;
  cupsRemainingOpponent: number;
  ballInFlight: boolean;
  currentPlayer: 1 | 2;
  winner: 0 | 1 | 2;
}
```

## `apps/web/src/games/cupKing/engine.ts`

```ts
import type { CupKingState } from "./types";

export function resolveCupKingTurn(state: CupKingState, madeShot: boolean): CupKingState {
  const next = { ...state };

  if (madeShot) {
    if (state.currentPlayer === 1) next.cupsRemainingOpponent -= 1;
    else next.cupsRemainingPlayer -= 1;
  } else {
    next.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
  }

  if (next.cupsRemainingPlayer <= 0) next.winner = 2;
  if (next.cupsRemainingOpponent <= 0) next.winner = 1;

  return next;
}
```

## `apps/web/src/games/cupKing/bot.ts`

```ts
import type { BotDifficulty } from "../shared/difficulty";
import type { CupKingShot } from "./types";

export function chooseCupKingBotShot(difficulty: BotDifficulty): CupKingShot {
  if (difficulty === "easy") return { angle: 0.08, power: 0.5 };
  if (difficulty === "medium") return { angle: 0.03, power: 0.62 };
  return { angle: 0.01, power: 0.72 };
}
```

## `apps/web/src/games/cupKing/CupKingScene.tsx`

```tsx
import React from "react";
import { GameShell } from "../shared/gameShell";

export function CupKingScene() {
  return (
    <GameShell title="Cup King" subtitle="Precision tabletop competition with bounce, sink, and party-game polish.">
      <div className="p-4">
        {/* Table render, cups, ball, trajectory guide, crowd/bar vibe */}
      </div>
    </GameShell>
  );
}
```

AAA notes:
- wooden table/bar atmosphere
- cup highlight and splashy sink confirmation
- quick round pacing, strong rematch UX

---

# 11) Stack Tower

## `apps/web/src/games/stackTower/types.ts`

```ts
export interface TowerBlock {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  moving: boolean;
}

export interface StackTowerState {
  blocks: TowerBlock[];
  score: number;
  combo: number;
  gameOver: boolean;
}
```

## `apps/web/src/games/stackTower/engine.ts`

```ts
import type { StackTowerState, TowerBlock } from "./types";

export function placeStackTowerBlock(state: StackTowerState): StackTowerState {
  // Compare overlap with previous block, trim excess, handle combo/perfect placement.
  return state;
}
```

## `apps/web/src/games/stackTower/StackTowerScene.tsx`

```tsx
import React from "react";
import { GameShell } from "../shared/gameShell";

export function StackTowerScene() {
  return (
    <GameShell title="Stack Tower" subtitle="Addictive perfect-drop stacking with combo rewards and big misses.">
      <div className="p-4">
        {/* Vertical tower view, moving block, perfect timing FX */}
      </div>
    </GameShell>
  );
}
```

AAA notes:
- perfect placement flash and combo chime
- skyline background progression as tower rises
- good fail/collapse drama

---

# 12) Block Blast

## `apps/web/src/games/blockBlast/types.ts`

```ts
export type BlockCell = 0 | 1;

export interface PieceShape {
  id: string;
  cells: Array<{ x: number; y: number }>;
  color: string;
}

export interface BlockBlastState {
  board: BlockCell[][];
  rack: PieceShape[];
  score: number;
  combo: number;
  gameOver: boolean;
}
```

## `apps/web/src/games/blockBlast/engine.ts`

```ts
import type { BlockBlastState, PieceShape } from "./types";

export function canPlacePiece(board: number[][], piece: PieceShape, x: number, y: number): boolean {
  return true;
}

export function placePiece(state: BlockBlastState, pieceId: string, x: number, y: number): BlockBlastState {
  // Stamp piece, clear rows/cols, update combo and score.
  return state;
}
```

## `apps/web/src/games/blockBlast/BlockBlastScene.tsx`

```tsx
import React from "react";
import { GameShell } from "../shared/gameShell";

export function BlockBlastScene() {
  return (
    <GameShell title="Block Blast" subtitle="Juicy puzzle placement with combo clears and strong board readability.">
      <div className="p-4">
        {/* Board grid, draggable rack pieces, combo banner */}
      </div>
    </GameShell>
  );
}
```

AAA notes:
- clear line glow and pop
- strong drag preview shadow
- combo chain banners and premium puzzle shell

---

# 13) Tron

## `apps/web/src/games/tron/types.ts`

```ts
export interface TronBike {
  id: string;
  x: number;
  y: number;
  dir: "up" | "down" | "left" | "right";
  alive: boolean;
  trail: Array<{ x: number; y: number }>;
}

export interface TronState {
  bikes: TronBike[];
  winner: string | null;
  arenaWidth: number;
  arenaHeight: number;
}
```

## `apps/web/src/games/tron/engine.ts`

```ts
import type { TronState } from "./types";

export function stepTron(state: TronState): TronState {
  // Advance bikes, append trail, detect wall/trail collision.
  return state;
}
```

## `apps/web/src/games/tron/bot.ts`

```ts
import type { BotDifficulty } from "../shared/difficulty";
import type { TronState } from "./types";

export function chooseTronBotDirection(state: TronState, bikeId: string, difficulty: BotDifficulty) {
  // Hard should maximize safe space and trap opportunities.
  return "up" as const;
}
```

## `apps/web/src/games/tron/TronScene.tsx`

```tsx
import React from "react";
import { GameShell } from "../shared/gameShell";

export function TronScene() {
  return (
    <GameShell title="Tron" subtitle="Neon light-cycle duels with sharp turns, strong pacing, and premium glow.">
      <div className="p-4">
        {/* Canvas arena render, glowing trails, round banners */}
      </div>
    </GameShell>
  );
}
```

AAA notes:
- trail bloom effect
- impact burst on death
- speed-up overtime

---

# 14) Basketball

## `apps/web/src/games/basketball/types.ts`

```ts
export interface BasketballShot {
  angle: number;
  power: number;
}

export interface BasketballState {
  playerScore: number;
  opponentScore: number;
  shotClock: number;
  ballInAir: boolean;
  winner: 0 | 1 | 2;
}
```

## `apps/web/src/games/basketball/physics.ts`

```ts
import type { BasketballState } from "./types";

export function stepBasketball(state: BasketballState, dt: number): BasketballState {
  // Arc, rim collision, backboard collision, net trigger, score detection.
  return state;
}
```

## `apps/web/src/games/basketball/bot.ts`

```ts
import type { BotDifficulty } from "../shared/difficulty";
import type { BasketballShot } from "./types";

export function chooseBasketballBotShot(difficulty: BotDifficulty): BasketballShot {
  if (difficulty === "easy") return { angle: 0.72, power: 0.58 };
  if (difficulty === "medium") return { angle: 0.78, power: 0.64 };
  return { angle: 0.81, power: 0.68 };
}
```

## `apps/web/src/games/basketball/BasketballScene.tsx`

```tsx
import React from "react";
import { GameShell } from "../shared/gameShell";

export function BasketballScene() {
  return (
    <GameShell title="Basketball" subtitle="Arcade shot-making with swishes, rim physics, and arena energy.">
      <div className="p-4">
        {/* Court, hoop, shot meter, score, crowd-style big-shot FX */}
      </div>
    </GameShell>
  );
}
```

AAA notes:
- swish sound, rim clank, backboard hit
- heat-check banners
- premium court lighting

---

# 15) Football

## `apps/web/src/games/football/types.ts`

```ts
export interface FootballPlayer {
  id: string;
  x: number;
  y: number;
  role: "qb" | "wr" | "rb" | "def";
  team: 1 | 2;
}

export interface FootballState {
  down: number;
  distance: number;
  yardLine: number;
  possession: 1 | 2;
  playerScore: number;
  opponentScore: number;
  winner: 0 | 1 | 2;
}
```

## `apps/web/src/games/football/engine.ts`

```ts
import type { FootballState } from "./types";

export function resolveFootballPlay(state: FootballState, yardsGained: number, turnover = false): FootballState {
  const next = { ...state };

  if (turnover) {
    next.possession = state.possession === 1 ? 2 : 1;
    next.down = 1;
    next.distance = 10;
    return next;
  }

  next.yardLine += yardsGained;
  if (yardsGained >= next.distance) {
    next.down = 1;
    next.distance = 10;
  } else {
    next.down += 1;
    next.distance -= yardsGained;
  }

  return next;
}
```

## `apps/web/src/games/football/bot.ts`

```ts
import type { BotDifficulty } from "../shared/difficulty";

export function chooseFootballBotPlay(difficulty: BotDifficulty): "run" | "short-pass" | "deep-pass" {
  if (difficulty === "easy") return "run";
  if (difficulty === "medium") return Math.random() > 0.5 ? "run" : "short-pass";
  return Math.random() > 0.5 ? "short-pass" : "deep-pass";
}
```

## `apps/web/src/games/football/FootballScene.tsx`

```tsx
import React from "react";
import { GameShell } from "../shared/gameShell";

export function FootballScene() {
  return (
    <GameShell title="Football" subtitle="Readable football action with routes, catches, tackles, and game flow.">
      <div className="p-4">
        {/* Field, routes, pass meter, scoreboard, downs, possession */}
      </div>
    </GameShell>
  );
}
```

AAA notes:
- crowd swell
- touchdown celebration
- route preview lines
- clearer down and distance UI

---

# 16) Racing

## `apps/web/src/games/racing/types.ts`

```ts
export interface RacingCar {
  id: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  lap: number;
  checkpointIndex: number;
  finished: boolean;
}

export interface RacingState {
  cars: RacingCar[];
  totalLaps: number;
  countdown: number;
  winnerId: string | null;
}
```

## `apps/web/src/games/racing/physics.ts`

```ts
import type { RacingCar } from "./types";

export function stepRacingCar(car: RacingCar, input: { throttle: number; brake: number; steer: number }, dt: number): RacingCar {
  const next = { ...car };

  next.speed += input.throttle * 0.6 * dt;
  next.speed -= input.brake * 0.8 * dt;
  next.speed = Math.max(0, Math.min(18, next.speed));

  next.angle += input.steer * 0.05 * dt * (0.4 + next.speed * 0.06);
  next.x += Math.cos(next.angle) * next.speed * dt;
  next.y += Math.sin(next.angle) * next.speed * dt;

  return next;
}
```

## `apps/web/src/games/racing/bot.ts`

```ts
import type { BotDifficulty } from "../shared/difficulty";

export function chooseRacingBotInput(difficulty: BotDifficulty) {
  if (difficulty === "easy") return { throttle: 0.72, brake: 0.05, steer: 0.02 };
  if (difficulty === "medium") return { throttle: 0.84, brake: 0.03, steer: 0.01 };
  return { throttle: 0.94, brake: 0.01, steer: 0.005 };
}
```

## `apps/web/src/games/racing/RacingScene.tsx`

```tsx
import React from "react";
import { GameShell } from "../shared/gameShell";

export function RacingScene() {
  return (
    <GameShell title="Racing" subtitle="Responsive arcade racing with polished tracks, speed, and AI drivers.">
      <div className="p-4">
        {/* Track render, car models, lap UI, mini-map, position HUD */}
      </div>
    </GameShell>
  );
}
```

AAA notes:
- tire skid sounds
- boost / speed line feel
- podium and finish line drama
- hard bot should follow better racing line

---

# 17) Critical dev standards for AAA feel

## Every game needs:
1. **Clear startup state**
2. **Clear playing state**
3. **Clear scoring / turn / phase UI**
4. **Strong end-of-round feedback**
5. **Rematch button**
6. **No invisible state bugs**
7. **Consistent bot difficulty wiring**
8. **Desktop + mobile controls**
9. **Audio/VFX hooks**
10. **Wallet/ranked/casual/tournament rule enforcement**

## Bot integration contract

Use one standard contract:

```ts
export interface BotController<TState, TAction> {
  initialize?(state: TState): void;
  chooseAction(state: TState): Promise<TAction> | TAction;
  onActionApplied?(state: TState, action: TAction): void;
  onMatchEnd?(state: TState): void;
}
```

Then each game implements that with its own action shape.

---

# 18) Suggested implementation order

## Phase 1: Fix reliability first
- Pool break bug
- Pool bot actually taking turns
- Mini Golf next-hole progression
- Bot initialization across all games
- Ranked 1 Scalp lock
- Match result / settlement stability

## Phase 2: Core feel pass
- Pool physics and pocket geometry
- Bowling shot phase and strike dopamine
- Air hockey puck and mallet feel
- Racing handling feel
- Basketball arc/rim feel

## Phase 3: Visual premium pass
- Better backgrounds
- Better materials
- Better lighting
- Better shadows
- Better HUD hierarchy
- Consistent event banners

## Phase 4: Dopamine pass
- audio system
- big moments
- turn change cues
- reward banners
- win/loss animations
- combo/streak systems

---

# 19) Honest bottom line

A true fully finished AAA version of **every single game** is too large to deliver as one perfect code file in one pass.
This file gives your developer the **right architecture and real starter code** for all of them so they can build it correctly instead of patching random pieces.

If you want the strongest next step, have me do this one-by-one in order:

1. Pool full production file set
2. Bowling full production file set
3. Mini Golf full production file set
4. Air Hockey full production file set
5. Racing full production file set

That would give you the most complete usable code.
