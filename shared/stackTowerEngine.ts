export interface StackTowerBlock {
  x: number; // Center X position
  y: number; // Top Y position
  width: number; // Current width of the block
  speed: number; // Horizontal movement speed
  direction: 1 | -1; // 1 = moving right, -1 = moving left
  placed: boolean; // Whether the block has been dropped
}

export interface StackTowerPlayerState {
  blocks: StackTowerBlock[]; // All placed blocks (bottom to top)
  currentBlock: StackTowerBlock | null; // The block currently sliding
  score: number; // Number of successfully placed blocks
  isGameOver: boolean;
  perfectChain: number; // Current streak of perfect placements
  longestPerfectChain: number; // Best perfect streak
  perfectPlacements: number; // Total perfect placements
  totalBlockSize: number; // Sum of all block widths for averaging
}

export interface StackTowerGameState {
  player1: StackTowerPlayerState;
  player2: StackTowerPlayerState;
  winner: 1 | 2 | null;
  isDraw: boolean;
  startTime: number;
  gamePhase: "playing" | "finished";
}

export interface StackTowerMove {
  action: "drop"; // Player drops the current block
  timestamp: number;
}

// Game constants
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 800;
const INITIAL_BLOCK_WIDTH = 200;
const BLOCK_HEIGHT = 40;
const MIN_BLOCK_WIDTH = 20; // Minimum width before game over (10% of initial)
const BLOCK_SPEED = 3; // Pixels per frame
const PERFECT_THRESHOLD = 5; // Pixels difference for "perfect" placement
const GROUND_Y = CANVAS_HEIGHT - 100; // Starting Y position

/**
 * Initialize a new Stack Tower game
 */
export function initStackTowerGame(): StackTowerGameState {
  return {
    player1: createPlayerState(),
    player2: createPlayerState(),
    winner: null,
    isDraw: false,
    startTime: Date.now(),
    gamePhase: "playing",
  };
}

/**
 * Create initial player state
 */
function createPlayerState(): StackTowerPlayerState {
  // First block is placed at the bottom
  const firstBlock: StackTowerBlock = {
    x: CANVAS_WIDTH / 2,
    y: GROUND_Y,
    width: INITIAL_BLOCK_WIDTH,
    speed: 0,
    direction: 1,
    placed: true,
  };

  // Second block starts sliding
  const secondBlock: StackTowerBlock = {
    x: 50,
    y: GROUND_Y - BLOCK_HEIGHT,
    width: INITIAL_BLOCK_WIDTH,
    speed: BLOCK_SPEED,
    direction: 1,
    placed: false,
  };

  return {
    blocks: [firstBlock],
    currentBlock: secondBlock,
    score: 0,
    isGameOver: false,
    perfectChain: 0,
    longestPerfectChain: 0,
    perfectPlacements: 0,
    totalBlockSize: INITIAL_BLOCK_WIDTH,
  };
}

/**
 * Update physics for sliding blocks
 */
export function updateStackTowerPhysics(state: StackTowerGameState): StackTowerGameState {
  if (state.gamePhase !== "playing") {
    return state;
  }

  const newState = { ...state };

  // Update player 1's sliding block
  if (newState.player1.currentBlock && !newState.player1.isGameOver) {
    newState.player1 = updatePlayerPhysics(newState.player1);
  }

  // Update player 2's sliding block
  if (newState.player2.currentBlock && !newState.player2.isGameOver) {
    newState.player2 = updatePlayerPhysics(newState.player2);
  }

  // Check if both players are done
  if (newState.player1.isGameOver && newState.player2.isGameOver) {
    newState.gamePhase = "finished";
    
    // Determine winner
    if (newState.player1.score > newState.player2.score) {
      newState.winner = 1;
    } else if (newState.player2.score > newState.player1.score) {
      newState.winner = 2;
    } else {
      newState.isDraw = true;
    }
  }

  return newState;
}

/**
 * Update a single player's physics
 */
function updatePlayerPhysics(player: StackTowerPlayerState): StackTowerPlayerState {
  if (!player.currentBlock || player.currentBlock.placed) {
    return player;
  }

  const block = { ...player.currentBlock };

  // Move the block
  block.x += block.speed * block.direction;

  // Bounce off walls
  const halfWidth = block.width / 2;
  if (block.x - halfWidth <= 0) {
    block.x = halfWidth;
    block.direction = 1;
  } else if (block.x + halfWidth >= CANVAS_WIDTH) {
    block.x = CANVAS_WIDTH - halfWidth;
    block.direction = -1;
  }

  return {
    ...player,
    currentBlock: block,
  };
}

/**
 * Apply a player's move (drop block)
 */
export function applyStackTowerMove(
  state: StackTowerGameState,
  playerNum: 1 | 2,
  move: StackTowerMove
): StackTowerGameState {
  if (state.gamePhase !== "playing") {
    return state;
  }

  const playerKey = playerNum === 1 ? "player1" : "player2";
  const player = state[playerKey];

  if (player.isGameOver || !player.currentBlock || player.currentBlock.placed) {
    return state;
  }

  // Drop the current block
  const currentBlock = { ...player.currentBlock };
  const previousBlock = player.blocks[player.blocks.length - 1];

  // Calculate alignment
  const alignment = calculateAlignment(currentBlock, previousBlock);
  const overhang = Math.abs(alignment);

  // Check if block completely missed
  if (overhang >= currentBlock.width) {
    // Complete miss - game over
    return {
      ...state,
      [playerKey]: {
        ...player,
        isGameOver: true,
        currentBlock: null,
      },
    };
  }

  // Calculate new block width after cutting overhang
  const newWidth = currentBlock.width - overhang;

  // Check if block is too small
  if (newWidth < MIN_BLOCK_WIDTH) {
    return {
      ...state,
      [playerKey]: {
        ...player,
        isGameOver: true,
        currentBlock: null,
      },
    };
  }

  // Adjust block position based on alignment
  const newX = alignment > 0
    ? currentBlock.x - overhang / 2
    : currentBlock.x + overhang / 2;

  // Place the block
  const placedBlock: StackTowerBlock = {
    x: newX,
    y: currentBlock.y,
    width: newWidth,
    speed: 0,
    direction: 1,
    placed: true,
  };

  // Check if placement was perfect
  const isPerfect = overhang <= PERFECT_THRESHOLD;
  const newPerfectChain = isPerfect ? player.perfectChain + 1 : 0;
  const newLongestChain = Math.max(player.longestPerfectChain, newPerfectChain);

  // Create next block
  const nextBlock: StackTowerBlock = {
    x: 50,
    y: currentBlock.y - BLOCK_HEIGHT,
    width: newWidth,
    speed: BLOCK_SPEED + Math.floor(player.score / 10) * 0.5, // Speed increases every 10 blocks
    direction: 1,
    placed: false,
  };

  return {
    ...state,
    [playerKey]: {
      ...player,
      blocks: [...player.blocks, placedBlock],
      currentBlock: nextBlock,
      score: player.score + 1,
      perfectChain: newPerfectChain,
      longestPerfectChain: newLongestChain,
      perfectPlacements: player.perfectPlacements + (isPerfect ? 1 : 0),
      totalBlockSize: player.totalBlockSize + newWidth,
    },
  };
}

/**
 * Calculate horizontal alignment offset between current and previous block
 * Returns the overhang distance (positive = right overhang, negative = left overhang)
 */
function calculateAlignment(current: StackTowerBlock, previous: StackTowerBlock): number {
  const currentLeft = current.x - current.width / 2;
  const currentRight = current.x + current.width / 2;
  const prevLeft = previous.x - previous.width / 2;
  const prevRight = previous.x + previous.width / 2;

  // Calculate overhang on each side
  const leftOverhang = Math.max(0, prevLeft - currentLeft);
  const rightOverhang = Math.max(0, currentRight - prevRight);

  // Return the larger overhang (with sign indicating direction)
  if (rightOverhang > leftOverhang) {
    return rightOverhang;
  } else if (leftOverhang > rightOverhang) {
    return -leftOverhang;
  }
  return 0;
}

/**
 * Get game statistics for a player
 */
export function getStackTowerStats(player: StackTowerPlayerState) {
  const avgBlockSize = player.score > 0
    ? (player.totalBlockSize / (player.score + 1)) // +1 for initial block
    : 0;

  return {
    blocksPlaced: player.score,
    perfectPlacements: player.perfectPlacements,
    averageBlockSize: Math.round((avgBlockSize / INITIAL_BLOCK_WIDTH) * 100), // Percentage
    longestPerfectChain: player.longestPerfectChain,
  };
}

/**
 * Check if a player can make a move
 */
export function canMakeStackTowerMove(
  state: StackTowerGameState,
  playerNum: 1 | 2
): boolean {
  if (state.gamePhase !== "playing") {
    return false;
  }

  const player = playerNum === 1 ? state.player1 : state.player2;
  return !player.isGameOver && player.currentBlock !== null && !player.currentBlock.placed;
}

/**
 * Get current game status
 */
export function getStackTowerStatus(state: StackTowerGameState): {
  phase: string;
  winner: 1 | 2 | null;
  isDraw: boolean;
  player1Score: number;
  player2Score: number;
} {
  return {
    phase: state.gamePhase,
    winner: state.winner,
    isDraw: state.isDraw,
    player1Score: state.player1.score,
    player2Score: state.player2.score,
  };
}

// Export constants for use in UI
export const STACK_TOWER_CONSTANTS = {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  BLOCK_HEIGHT,
  INITIAL_BLOCK_WIDTH,
  GROUND_Y,
  PERFECT_THRESHOLD,
};
