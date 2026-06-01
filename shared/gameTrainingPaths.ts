/**
 * Master config for per-game Beginner → Master training paths.
 *
 * Each game has 4 tiers. The canonical tutorial order, active set, badge map,
 * reward rarity, pretty titles and hub grouping are all derived from this
 * single source so a new tier can be added without touching 6 files.
 *
 * Tier ID scheme (kept backwards compatible with the original single-tutorial
 * IDs that shipped earlier):
 *   Beginner     = `game-<slug>`             (no suffix — existing IDs)
 *   Intermediate = `game-<slug>-intermediate`
 *   Advanced     = `game-<slug>-advanced`
 *   Master       = `game-<slug>-master`
 */

export type TrainingTier = "beginner" | "intermediate" | "advanced" | "master";
export const TIER_ORDER: TrainingTier[] = ["beginner", "intermediate", "advanced", "master"];

export type TrainingRarity = "common" | "rare" | "epic" | "legendary" | "mythic";

/** Rarity per tier — escalates as the player climbs the ladder. */
export const TIER_RARITY: Record<TrainingTier, TrainingRarity> = {
  beginner: "common",
  intermediate: "rare",
  advanced: "epic",
  master: "legendary",
};

/** Display label per tier. */
export const TIER_LABEL: Record<TrainingTier, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  master: "Master",
};

/** Base XP per tier — display value used by the rewards screen. */
export const TIER_XP: Record<TrainingTier, number> = {
  beginner: 75,
  intermediate: 150,
  advanced: 300,
  master: 600,
};

/** Rough time estimate per tier (display only). */
export const TIER_ESTIMATE: Record<TrainingTier, string> = {
  beginner: "2–3 min",
  intermediate: "3–5 min",
  advanced: "4–6 min",
  master: "5–8 min",
};

/** A single tier-specific lesson card inside the TutorialShell. */
export interface TierLesson {
  title: string;
  body: string;
  hint?: string;
}

export interface TierContent {
  /** 2–4 lesson cards taught in the tier, in order. */
  lessons: TierLesson[];
  /** One-line summary shown on the final "claim reward" step. */
  summary: string;
}

export interface GameTrainingPath {
  /** Stable game slug used for badge IDs and routing. */
  slug: string;
  /** Pretty title shown across UI. */
  title: string;
  /** Short blurb describing the game on the hub. */
  blurb: string;
  /** Per-tier content. */
  tiers: Record<TrainingTier, TierContent>;
}

/**
 * Canonical list of games on the platform — each generates 4 tiers.
 * Order here defines the order games appear in the Training Hub AND the
 * canonical unlock chain (within a game, beginner gates intermediate, etc.).
 */
export const GAME_TRAINING_PATHS: GameTrainingPath[] = [
  {
    slug: "rock-paper-scissors",
    title: "Rock Paper Scissors",
    blurb: "Quick rounds. Mind games. The fastest way to learn the flow.",
    tiers: {
      beginner: {
        summary: "RPS basics down — you know the matchups and the best-of-3 format.",
        lessons: [
          { title: "The Three Throws", body: "Rock crushes Scissors. Scissors cuts Paper. Paper covers Rock. Same pick = replay.", hint: "Learn the cycle: R→S→P→R." },
          { title: "Best of 3", body: "Jango RPS matches are first-to-2 round wins. Quick to start, quick to settle." },
        ],
      },
      intermediate: {
        summary: "You can read short patterns and counter them.",
        lessons: [
          { title: "Pattern Reading", body: "Most players default to Rock first. Watch their first 3 throws — a habit usually appears by round 2.", hint: "Default-Rock counter: throw Paper round one against unknown opponents." },
          { title: "The Lose-Switch Tell", body: "After losing a round, players often switch to whatever just beat them. Throw the thing that beats *that*.", hint: "They lost to your Rock → expect Paper → throw Scissors." },
          { title: "Streak Breaking", body: "Three same throws in a row almost never happens consciously. Don't repeat a winning throw three times — opponents will catch on." },
        ],
      },
      advanced: {
        summary: "You can lead a read instead of reacting to one.",
        lessons: [
          { title: "Telegraphing on Purpose", body: "Pause a beat before throwing the same hand twice — humans expect a switch. Use the expectation against them.", hint: "Slow-throw the same hand to bait a counter-counter." },
          { title: "Conditional Strategies", body: "Decide your next two throws *before* the round, conditioned on the result. Pre-commit beats panic.", hint: "Win → repeat. Lose → throw what beats what beat me. Draw → throw what beats my last throw." },
          { title: "Tilt Recognition", body: "After a losing streak players speed up and reach for Rock. Slow yourself down — throw Paper and reset the match tempo." },
        ],
      },
      master: {
        summary: "Reaction speed sharp, instincts calibrated. You're a Pool/Tournament-ready threat.",
        lessons: [
          { title: "Mixed Strategy", body: "Against strong opponents, randomize. Pre-roll 5 throws in your head using a non-obvious seed (last digit of the clock × 3).", hint: "True randomness beats any read." },
          { title: "Closing Out", body: "On match point, never throw the thing you just won with. Strong opponents will counter it." },
          { title: "Master Drill", body: "Beat the reaction drill below to prove your throws are quick and clean." },
        ],
      },
    },
  },
  {
    slug: "connect-4",
    title: "Connect 4",
    blurb: "Drop discs, block lines, snap four together.",
    tiers: {
      beginner: {
        summary: "You know the board, the controls, and how to win and block.",
        lessons: [
          { title: "Drop Mechanics", body: "Click any column and your disc falls to the lowest free slot. Gravity is on your side." },
          { title: "Four in a Row", body: "Horizontal, vertical, OR diagonal. Diagonal wins are the most-missed.", hint: "Always scan diagonals before playing." },
        ],
      },
      intermediate: {
        summary: "You play the center, watch for double threats, and block on time.",
        lessons: [
          { title: "Own the Center", body: "Column 4 (center) is part of more potential lines than any other column. Take it on move one.", hint: "First move: always center." },
          { title: "Double Threats", body: "A 'fork' = two open three-in-a-rows that can't both be blocked. Build them, don't fall for them.", hint: "After every move, count open 3s on the board." },
          { title: "Even/Odd Threats", body: "On a 6-row board, Player 1's threats are odd-row, Player 2's are even-row. Steer your stacks accordingly." },
        ],
      },
      advanced: {
        summary: "You think 3+ moves ahead and force wins, not chance them.",
        lessons: [
          { title: "Claim Even Lock", body: "Player 2's best win path is forcing an even-row threat that Player 1 must complete. Learn to set or refuse the trap." },
          { title: "Zugzwang", body: "Sometimes every legal move loses. Build positions where your opponent runs out of safe drops first.", hint: "Count playable safe columns each turn." },
          { title: "Endgame Counting", body: "Past move 30 every drop is calculable. Slow down, count threats, and avoid speed mistakes." },
        ],
      },
      master: {
        summary: "Tournament-ready: opening theory, mid-game forks, clean endgames.",
        lessons: [
          { title: "Opening Lines", body: "Center → center → upper-center is the standard solved opening. Deviate only if your opponent does." },
          { title: "Trap Diagonals", body: "The strongest diagonals run from your home corner up to center. Stack them quietly while threatening verticals." },
          { title: "Master Drill", body: "Hit the reaction drill — your endgame mistakes always come from playing too fast." },
        ],
      },
    },
  },
  {
    slug: "air-hockey",
    title: "Air Hockey",
    blurb: "Defend the goal, then strike. Fast paddles, faster pucks.",
    tiers: {
      beginner: {
        summary: "You can move, defend, and take a basic shot.",
        lessons: [
          { title: "Paddle Control", body: "Drag your paddle anywhere on your half. The puck bounces off paddle edges and wall rails.", hint: "Keep your paddle moving — a still paddle is a dead paddle." },
          { title: "Defend First", body: "Park your paddle one paddle-width in front of your goal between shots. You can't score if you've already lost." },
          { title: "Basic Strike", body: "Hit the puck moving forward, not while stationary. Forward momentum = faster shot." },
        ],
      },
      intermediate: {
        summary: "You can block angles and bank shots off the rails.",
        lessons: [
          { title: "Angle Defense", body: "Mirror the puck's X position — don't chase it. If the puck is left-center, you should be left-center.", hint: "Watch the puck, not the opponent." },
          { title: "Bank Shots", body: "A puck hitting the side rail bounces equal-in / equal-out. Aim *off* the goal to score *into* it." },
          { title: "Reading Spin", body: "A spinning puck curves slightly on the rebound. If your opponent strikes hard with a wrist roll, expect a curve." },
        ],
      },
      advanced: {
        summary: "You can fake, double-bank, and force the opponent out of position.",
        lessons: [
          { title: "Drift Fakes", body: "Hover your paddle as if to shoot left, then drag right and strike. Sells the wrong angle to the opponent." },
          { title: "Double Banks", body: "Hit puck → side rail → back wall → goal. Slower puck, but unreadable trajectory.", hint: "Use double banks when the opponent has parked center." },
          { title: "Rebound Hunting", body: "Strong opponents push back. Position your paddle where their rebound will land *before* you shoot." },
        ],
      },
      master: {
        summary: "You control tempo, angles, and the opponent's eyes. Ranked-ready.",
        lessons: [
          { title: "Tempo Control", body: "Slow the puck down on purpose between scoring chances. Force opponents to commit first." },
          { title: "Cut-Shot", body: "Strike the puck while moving diagonally — the puck shears off at an unexpected angle. Hardest shot to block." },
          { title: "Master Drill", body: "Pass the reaction drill — air hockey punishes 100ms of lag in your hand." },
        ],
      },
    },
  },
  {
    slug: "mini-golf",
    title: "Mini Golf",
    blurb: "Aim, power, sink. Fewer strokes win.",
    tiers: {
      beginner: {
        summary: "You can line up a shot, set power, and putt cleanly.",
        lessons: [
          { title: "Aim & Power", body: "Drag back from the ball to set direction and power. Length of the drag = strength of the shot." },
          { title: "Reading the Green", body: "Slopes pull the ball downhill — always look at the contour before you putt.", hint: "Aim slightly uphill of the cup on sloped greens." },
        ],
      },
      intermediate: {
        summary: "You can bank off walls and play for a 2-stroke hole.",
        lessons: [
          { title: "Wall Banks", body: "Walls give clean equal-angle rebounds. Use them to cut around obstacles." },
          { title: "Stop Power", body: "Use 60–70% power on short greens — full power leaves you over the cup and in the rough.", hint: "Sink rate peaks at 'just enough to roll into the cup'." },
          { title: "Two Stroke Routing", body: "Plan your second shot *before* taking the first. Leave the ball where the next shot is easy." },
        ],
      },
      advanced: {
        summary: "You play angles, hazards, and risky aces with intent.",
        lessons: [
          { title: "Hole-in-One Lines", body: "Almost every par 2/3 hole has a single bank-shot ace line. Find it on lap 1, commit to it on lap 2." },
          { title: "Sand & Rough", body: "Sand kills 60% of your roll. Hit harder than feels right or go around it." },
          { title: "Speed Reads", body: "Faster greens need lighter putts. Test the speed on the apron before committing to power." },
        ],
      },
      master: {
        summary: "You ace difficult holes consistently and grind par on tough ones.",
        lessons: [
          { title: "Multi-Bank Aces", body: "Two-wall bank → cup. Reserved for tight holes where straight lines are blocked." },
          { title: "Wind & Ramps", body: "On ramped holes, extra power on the up-ramp = extra carry. Adjust by 15% per ramp." },
          { title: "Master Drill", body: "Quick reaction drill — putting tempo is built on consistent timing." },
        ],
      },
    },
  },
  {
    slug: "dots-and-boxes",
    title: "Dots & Boxes",
    blurb: "Lines, boxes, combos. Quick to learn, brutal to master.",
    tiers: {
      beginner: {
        summary: "You know the rules and can close a box.",
        lessons: [
          { title: "Drawing Lines", body: "Tap between two dots to draw a line. Closing the 4th side of a box claims it for you — and gives you another turn." },
          { title: "Avoid Third Sides", body: "Never draw the 3rd side of a box. It lets your opponent close it free." },
        ],
      },
      intermediate: {
        summary: "You can build chains and avoid donating boxes.",
        lessons: [
          { title: "The Chain", body: "A chain = a line of boxes that all flip to one player once the first is closed. Long chains decide the game." },
          { title: "Safe Moves", body: "A 'safe' move adds a 1st or 2nd side somewhere. Once safe moves run out, the player to move loses chains.", hint: "Count safe moves left every turn." },
        ],
      },
      advanced: {
        summary: "You use the Double-Cross to flip chain ownership.",
        lessons: [
          { title: "Double-Cross", body: "When a chain has 3+ boxes, decline the last 2 boxes — opponent gets them but must give you the next chain.", hint: "Sacrifice 2 to win 5." },
          { title: "Chain Parity", body: "If the total number of long chains is odd, Player 1 wins the chain race. Steer parity in your favor." },
        ],
      },
      master: {
        summary: "Chain counting + parity manipulation = tournament-grade play.",
        lessons: [
          { title: "Loop Theory", body: "Loops (closed chains) flip differently than open chains. Treat them as 'worth one less' in your count." },
          { title: "Sacrifice Timing", body: "Always force the opponent to open the *shortest* chain first. Save your longest for last." },
          { title: "Master Drill", body: "Reaction drill — endgame counting fails when you rush." },
        ],
      },
    },
  },
  {
    slug: "8-ball",
    title: "8-Ball Pool",
    blurb: "Cue control, ghost lines, group strategy.",
    tiers: {
      beginner: {
        summary: "You can aim, control power, and pocket a target ball.",
        lessons: [
          { title: "Cue & Aim", body: "Drag back from the cue ball to set direction and power. The ghost line shows where the cue will go after impact." },
          { title: "Groups", body: "First ball you legally pocket assigns your group — solids (1-7) or stripes (9-15). 8 goes last." },
        ],
      },
      intermediate: {
        summary: "You can plan position and use the rails on purpose.",
        lessons: [
          { title: "Position Play", body: "Don't just sink the ball — leave the cue ball where the next shot is easy. Plan two balls ahead.", hint: "Pick your next target *before* you shoot." },
          { title: "Bank Shots", body: "A ball hitting a rail bounces equal angle in / equal angle out. Use mental geometry for blocked targets." },
          { title: "Safety Play", body: "If no pocket is open, hide the cue behind your own group. Force the opponent into a foul." },
        ],
      },
      advanced: {
        summary: "Spin, English, and bank shots are tools you choose, not accidents.",
        lessons: [
          { title: "Top / Back Spin", body: "Hit the cue high to roll it forward after contact. Hit low to draw it back. Pure center = stop shot.", hint: "Top spin = follow. Low spin = draw." },
          { title: "English (Side Spin)", body: "Hitting the cue ball off-center curves its path and changes rail rebound angles. Use sparingly — it's hard to control." },
          { title: "Combos & Caroms", body: "A combo pockets ball A by hitting ball B into it. A carom uses your target to redirect the cue." },
        ],
      },
      master: {
        summary: "Break, run-out plans, and 8-ball calls are second nature.",
        lessons: [
          { title: "The Break", body: "Aim for the head ball, full power, center-cue hit. Spread is more important than pocketing on the break." },
          { title: "Run-Out Planning", body: "Before the run-out, map every ball's pocket. Identify the 'problem ball' and solve it first." },
          { title: "Master Drill", body: "Quick reaction drill — clean strokes need a quiet mind and steady hands." },
        ],
      },
    },
  },
  {
    slug: "bowling",
    title: "Bowling",
    blurb: "Aim, power, release. Strikes and spares explained.",
    tiers: {
      beginner: {
        summary: "You can aim, set power, and roll the ball down the lane.",
        lessons: [
          { title: "Aim & Roll", body: "Drag to set lane position, release to roll. Center pin = the headpin (#1)." },
          { title: "Strike vs Spare", body: "Strike = all 10 pins on the first ball (X). Spare = all 10 across two balls (/)." },
        ],
      },
      intermediate: {
        summary: "You can hit the pocket and pick up common spares.",
        lessons: [
          { title: "The Pocket", body: "Right-handers aim for the gap between pins 1 and 3. Left-handers aim 1–2. This is 'the pocket'.", hint: "Always strike the pocket, never the headpin straight." },
          { title: "Spare Conversions", body: "For corner pins (7 or 10), use the opposite-side arrow on the lane. Don't aim at the pin — aim at the arrow." },
          { title: "Speed Control", body: "Too fast = pins fly past each other. Too slow = pins don't carry. Medium-firm is the sweet spot." },
        ],
      },
      advanced: {
        summary: "You add hook, read the lane, and adjust to oil patterns.",
        lessons: [
          { title: "Hook Release", body: "Releasing with a slight wrist turn imparts side spin. The ball drifts then curves into the pocket for higher strike rates." },
          { title: "Oil Patterns", body: "Front of the lane is oily (slick), back is dry (grippy). Heavy hook works best when oil thins out near the pins." },
          { title: "Adjustment Math", body: "Missed pocket by 1 pin? Move feet 1 board the *same* direction as the miss; aim stays the same." },
        ],
      },
      master: {
        summary: "Tournament-ready: clean strikes, locked-in spares, lane-read first frame.",
        lessons: [
          { title: "Frame Strategy", body: "10th frame is worth up to 30 pins — never get cute on early frames. Strike the easy frames, fight for spares on hard ones." },
          { title: "Reading Carry", body: "If your pocket shots leave the 10-pin often, you're hitting too thin. Move your start position 1 board left." },
          { title: "Master Drill", body: "Quick reaction drill — release timing is everything." },
        ],
      },
    },
  },
  {
    slug: "chess",
    title: "Chess",
    blurb: "Pieces, captures, check, mate. No theory overload.",
    tiers: {
      beginner: {
        summary: "You know all 6 pieces, special moves, and how to deliver check.",
        lessons: [
          { title: "The Pieces", body: "Pawn forward / captures diagonal. Knight L-jumps. Bishop diagonals. Rook lines. Queen anywhere. King 1 square.", hint: "Memorize: B-N-R-Q-K (Bishop knight rook queen king) — value 3-3-5-9-∞." },
          { title: "Check & Mate", body: "Check = king attacked. Mate = king attacked, no legal escape. Stalemate = no legal move, not in check = draw." },
        ],
      },
      intermediate: {
        summary: "You can open soundly, see basic tactics, and avoid blunders.",
        lessons: [
          { title: "Opening Principles", body: "Control the center (e4/d4/c4). Develop knights before bishops. Castle early. Don't move the queen too soon." },
          { title: "Basic Tactics", body: "Fork: one piece attacks two. Pin: piece can't move without losing a bigger one. Skewer: opposite of pin.", hint: "Every move, ask: 'Is anything pinned or forkable?'" },
          { title: "Piece Activity", body: "An active piece is worth more than its value. A trapped rook is worth less than a knight." },
        ],
      },
      advanced: {
        summary: "You play structures, plan middlegames, and trade for endgames.",
        lessons: [
          { title: "Pawn Structures", body: "Isolated pawn = no neighbor, hard to defend. Passed pawn = no enemy in front, queens easily. Doubled = weak." },
          { title: "Middlegame Plans", body: "Activity → trades → favorable endgame. If your pieces are better, trade pawns. If pawns are better, trade pieces." },
          { title: "King Safety", body: "An open king = lost game. Don't push pawns in front of your castled king without a *very* good reason." },
        ],
      },
      master: {
        summary: "Endgame technique, calculation, and clock discipline — rated-game ready.",
        lessons: [
          { title: "Essential Endgames", body: "K+Q vs K mate. K+R vs K mate. Opposite-color bishop endings are usually drawn." },
          { title: "Calculation", body: "Calculate forcing moves first: checks, captures, threats. If nothing forcing exists, play position." },
          { title: "Master Drill", body: "Reaction drill — blitz chess is won on the clock as much as on the board." },
        ],
      },
    },
  },
  {
    slug: "cup-king",
    title: "Cup King",
    blurb: "Track the cup. Beat the shuffle.",
    tiers: {
      beginner: {
        summary: "You can follow the cup through a slow shuffle.",
        lessons: [
          { title: "Follow the Ball", body: "One cup hides a ball. Cups shuffle. Pick the cup with the ball." },
          { title: "Eye Discipline", body: "Don't blink. Lock your eyes on the chosen cup, not the dealer's hand." },
        ],
      },
      intermediate: {
        summary: "You can follow faster shuffles and ignore feints.",
        lessons: [
          { title: "Anchor Tracking", body: "Pick a unique feature on the cup (scratch, lighting) — track *that* instead of the cup itself." },
          { title: "Feint Filter", body: "Dealers often touch cups they don't move. Touch ≠ swap. Wait for actual swaps." },
          { title: "Speed Adjustments", body: "On faster shuffles, soft-focus on the whole table rather than one cup. Peripheral motion is easier to track." },
        ],
      },
      advanced: {
        summary: "You can track 8+ swap sequences without losing the cup.",
        lessons: [
          { title: "Chunk the Swaps", body: "Group every 2 swaps as a 'micro-sequence'. Three chunks = 6 swaps tracked easily." },
          { title: "Trust the System", body: "Doubt slows decisions. Pick a cup at the buzzer — your first instinct is right 70% of the time." },
        ],
      },
      master: {
        summary: "Insanely fast shuffles, multi-ball variants, no problem.",
        lessons: [
          { title: "Multi-Ball Mode", body: "Some rounds hide 2 balls. Track both — picking either wins, but missing both loses double." },
          { title: "Master Drill", body: "Reaction drill — eyes need to be as fast as your hands." },
        ],
      },
    },
  },
  {
    slug: "stack-tower",
    title: "Stack Tower",
    blurb: "Time it perfect. Don't slice your own tower.",
    tiers: {
      beginner: {
        summary: "You can drop blocks roughly aligned with the stack.",
        lessons: [
          { title: "The Drop", body: "Tap when the moving block is over the stack. Misalignment trims the overhanging slice off forever." },
          { title: "Watch the Width", body: "Each miss shrinks the block. Keep blocks wide by aiming for perfect alignment." },
        ],
      },
      intermediate: {
        summary: "You can chain near-perfect drops and recover from small misses.",
        lessons: [
          { title: "Perfect Bonus", body: "A pixel-perfect drop *restores* a tiny bit of width. Stack 3 perfects to grow the block back to full." },
          { title: "Rhythm", body: "Block speed scales. Lock to the rhythm rather than reacting — tap on the beat, not the visual." },
        ],
      },
      advanced: {
        summary: "You read direction changes and play long stacks consistently.",
        lessons: [
          { title: "Direction Flips", body: "Every level the block direction alternates. Pre-load your tap timing for the new direction." },
          { title: "Late Drop", body: "Better to drop slightly late than slightly early — late drops slice from the leading edge, easier to recover from." },
        ],
      },
      master: {
        summary: "200+ block runs no problem.",
        lessons: [
          { title: "Speed Plateau", body: "Past ~150 levels block speed caps. Treat it as a metronome — same tempo every drop." },
          { title: "Master Drill", body: "Reaction drill — tower stacking is a reaction game in disguise." },
        ],
      },
    },
  },
  {
    slug: "block-blast",
    title: "Block Blast",
    blurb: "Place, clear, combo. Chase the multiplier.",
    tiers: {
      beginner: {
        summary: "You can place pieces and clear rows.",
        lessons: [
          { title: "Place & Clear", body: "Drag a piece onto the grid. Filling a row OR column clears it. Cleared cells = points." },
          { title: "Preview Queue", body: "Always check the next 3 pieces before placing the current one. Plan slots in advance." },
        ],
      },
      intermediate: {
        summary: "You can chain 2–3 clears at once for combo multipliers.",
        lessons: [
          { title: "Combo Setup", body: "Hold the bottom-right corner empty. Drop one big piece to clear 2 rows + 1 column at once.", hint: "Multi-clear in one move = combo bonus." },
          { title: "Don't Cap Holes", body: "Never cover an unfilled cell with a row above it. Buried holes cost runs." },
        ],
      },
      advanced: {
        summary: "You play 'pre-clear' setups and survive bad piece runs.",
        lessons: [
          { title: "Reserve Space", body: "Always keep one column completely empty as a 'reset lane' for awkward pieces (L-shapes, T-shapes)." },
          { title: "Bad-Run Survival", body: "If the queue is all squares, fill bottom-up densely. Don't waste squares on partial rows." },
        ],
      },
      master: {
        summary: "Consistent 10k+ runs, no fear of long L-shape queues.",
        lessons: [
          { title: "Multi-Lane Combos", body: "Set up so a single I-piece (long bar) clears 3 rows or 3 columns at once. 3x multiplier." },
          { title: "Master Drill", body: "Reaction drill — quick pattern recognition wins survival mode." },
        ],
      },
    },
  },
  {
    slug: "tron",
    title: "Tron",
    blurb: "Trails kill. Survive the grid.",
    tiers: {
      beginner: {
        summary: "You can steer, avoid your own trail, and survive 30 seconds.",
        lessons: [
          { title: "Steer & Survive", body: "Arrow keys or swipe to turn. Hitting any trail — yours or the opponent's — ends you instantly." },
          { title: "Plan Turns Early", body: "You can't reverse. Always know your next turn 2 grid cells before you need it." },
        ],
      },
      intermediate: {
        summary: "You can claim territory and force opponents to crash.",
        lessons: [
          { title: "Territory Claims", body: "Box off a region of the grid for yourself before the opponent does. Bigger box = more time alive." },
          { title: "Cutoff Plays", body: "If your trail can cross *in front* of the opponent, you force them into your wall. Aggressive but high-reward." },
        ],
      },
      advanced: {
        summary: "You can play tight quarters and zig-zag walls efficiently.",
        lessons: [
          { title: "Zig-Zag Walls", body: "Tight zig-zags pack more wall into less space — buy yourself extra time inside small boxes." },
          { title: "Mirror Defense", body: "If the opponent mirrors your turns, fake a turn then reverse direction to break the symmetry." },
        ],
      },
      master: {
        summary: "Last-bike-standing in every match.",
        lessons: [
          { title: "Endgame Boxing", body: "Late game it's pure territory math. The bigger remaining box wins. Sacrifice attacks for clean walls." },
          { title: "Master Drill", body: "Reaction drill — Tron decisions are made in milliseconds." },
        ],
      },
    },
  },
];

/** Tutorial ID for a given game/tier (e.g. game-8-ball-advanced). */
export function tierTutorialId(slug: string, tier: TrainingTier): string {
  return tier === "beginner" ? `game-${slug}` : `game-${slug}-${tier}`;
}

/** Badge ID granted on tier completion. */
export function tierBadgeId(slug: string, tier: TrainingTier): string {
  const suffixMap: Record<TrainingTier, string> = {
    beginner: "rookie",
    intermediate: "adept",
    advanced: "expert",
    master: "master",
  };
  // Use compact 8-ball/cup-king style slug for badge ID
  const compact = slug
    .replace("rock-paper-scissors", "rps")
    .replace("connect-4", "connect4")
    .replace("air-hockey", "airhockey")
    .replace("mini-golf", "minigolf")
    .replace("dots-and-boxes", "grid")
    .replace("8-ball", "pool")
    .replace("cup-king", "cup")
    .replace("stack-tower", "tower")
    .replace("block-blast", "block")
    .replace("tron", "tron");
  return `tutorial-${compact}-${suffixMap[tier]}`;
}

export function getGamePath(slug: string): GameTrainingPath | undefined {
  return GAME_TRAINING_PATHS.find(p => p.slug === slug);
}

/** All (gameSlug, tier, tutorialId) triples in canonical play order. */
export interface FlatTierEntry {
  slug: string;
  tier: TrainingTier;
  id: string;
  title: string;
  gameTitle: string;
  blurb: string;
  badgeId: string;
}

export function flattenGameTiers(): FlatTierEntry[] {
  const out: FlatTierEntry[] = [];
  for (const game of GAME_TRAINING_PATHS) {
    for (const tier of TIER_ORDER) {
      out.push({
        slug: game.slug,
        tier,
        id: tierTutorialId(game.slug, tier),
        title: `${game.title}: ${TIER_LABEL[tier]}`,
        gameTitle: game.title,
        blurb: game.blurb,
        badgeId: tierBadgeId(game.slug, tier),
      });
    }
  }
  return out;
}
