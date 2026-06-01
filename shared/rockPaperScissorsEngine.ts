/**
 * Rock Paper Scissors Game Engine
 * Competitive best-of-N rounds with simultaneous reveal
 */

export type Choice = "rock" | "paper" | "scissors";
export type RoundResult = "player1" | "player2" | "tie";

export interface PlayerChoice {
  playerId: string;
  choice: Choice | null;
  ready: boolean;
}

export interface Round {
  roundNumber: number;
  player1Choice: Choice | null;
  player2Choice: Choice | null;
  result: RoundResult | null;
  revealed: boolean;
}

export interface RPSGameState {
  totalRounds: number; // Best of 3, 5, or 7
  currentRound: number;
  player1Score: number;
  player2Score: number;
  player1Choice: Choice | null;
  player2Choice: Choice | null;
  bothPlayersReady: boolean;
  roundHistory: Round[];
  status: "waiting" | "countdown" | "choosing" | "revealing" | "roundComplete" | "finished";
  countdownValue: number; // 3, 2, 1, 0
  winner: "player1" | "player2" | "tie" | null;
  revealTime: number | null; // Timestamp when choices are revealed
  lastUpdate: number;
}

// Determine winner of a single round
export function determineRoundWinner(choice1: Choice, choice2: Choice): RoundResult {
  if (choice1 === choice2) return "tie";
  
  if (
    (choice1 === "rock" && choice2 === "scissors") ||
    (choice1 === "paper" && choice2 === "rock") ||
    (choice1 === "scissors" && choice2 === "paper")
  ) {
    return "player1";
  }
  
  return "player2";
}

// Initialize game state
export function initializeGameState(totalRounds: number = 3): RPSGameState {
  return {
    totalRounds,
    currentRound: 1,
    player1Score: 0,
    player2Score: 0,
    player1Choice: null,
    player2Choice: null,
    bothPlayersReady: false,
    roundHistory: [],
    status: "choosing", // Start directly in choosing status so players can make choices immediately
    countdownValue: 0,
    winner: null,
    revealTime: null,
    lastUpdate: Date.now(),
  };
}

// Check if game is complete
export function isGameComplete(state: RPSGameState): boolean {
  const roundsToWin = Math.ceil(state.totalRounds / 2);
  return state.player1Score >= roundsToWin || state.player2Score >= roundsToWin;
}

// Determine overall game winner
export function determineGameWinner(state: RPSGameState): "player1" | "player2" | "tie" {
  if (state.player1Score > state.player2Score) {
    return "player1";
  } else if (state.player2Score > state.player1Score) {
    return "player2";
  }
  return "tie";
}

export class RockPaperScissorsEngine {
  private state: RPSGameState;

  constructor(totalRounds: number = 3) {
    this.state = initializeGameState(totalRounds);
  }

  getState(): RPSGameState {
    return { ...this.state };
  }

  // Load state from external source (for hydration from database)
  loadState(state: RPSGameState): void {
    this.state = { ...state };
  }

  startCountdown(): void {
    this.state.status = "countdown";
    this.state.countdownValue = 3;
  }

  updateCountdown(): void {
    if (this.state.status !== "countdown") return;
    
    this.state.countdownValue--;
    if (this.state.countdownValue === 0) {
      this.startRound();
    }
  }

  startRound(): void {
    this.state.status = "choosing";
    this.state.player1Choice = null;
    this.state.player2Choice = null;
    this.state.bothPlayersReady = false;
    this.state.revealTime = null;
  }

  setPlayerChoice(player: "player1" | "player2", choice: Choice): boolean {
    if (this.state.status !== "choosing") return false;

    if (player === "player1") {
      this.state.player1Choice = choice;
    } else {
      this.state.player2Choice = choice;
    }

    // Check if both players have chosen
    if (this.state.player1Choice !== null && this.state.player2Choice !== null) {
      this.state.bothPlayersReady = true;
      this.revealChoices();
    }

    this.state.lastUpdate = Date.now();
    return true;
  }

  revealChoices(): void {
    if (!this.state.bothPlayersReady) return;

    this.state.status = "revealing";
    this.state.revealTime = Date.now();

    // Determine round winner
    const result = determineRoundWinner(
      this.state.player1Choice!,
      this.state.player2Choice!
    );

    // Update scores
    if (result === "player1") {
      this.state.player1Score++;
    } else if (result === "player2") {
      this.state.player2Score++;
    }

    // Add to round history
    this.state.roundHistory.push({
      roundNumber: this.state.currentRound,
      player1Choice: this.state.player1Choice,
      player2Choice: this.state.player2Choice,
      result,
      revealed: true,
    });

    // Transition to round complete after a short delay (handled by client or server timer)
  }

  completeRound(): void {
    if (this.state.status !== "revealing") return;

    this.state.status = "roundComplete";

    // Check if game is complete
    if (isGameComplete(this.state)) {
      this.endGame();
    } else {
      this.state.currentRound++;
    }
  }

  nextRound(): void {
    if (this.state.status !== "roundComplete") return;
    this.startRound();
  }

  endGame(): void {
    this.state.status = "finished";
    this.state.winner = determineGameWinner(this.state);
  }

  getWinner(): "player1" | "player2" | "tie" | null {
    return this.state.winner;
  }

  getPlayer1Score(): number {
    return this.state.player1Score;
  }

  getPlayer2Score(): number {
    return this.state.player2Score;
  }

  getCurrentRound(): number {
    return this.state.currentRound;
  }

  getTotalRounds(): number {
    return this.state.totalRounds;
  }

  getRoundHistory(): Round[] {
    return [...this.state.roundHistory];
  }

  // For bot matches
  getRandomChoice(): Choice {
    const choices: Choice[] = ["rock", "paper", "scissors"];
    return choices[Math.floor(Math.random() * choices.length)];
  }

  // Strategic bot choice (tries to counter player's most frequent choice)
  getStrategicChoice(opponentHistory: Choice[]): Choice {
    if (opponentHistory.length === 0) {
      return this.getRandomChoice();
    }

    // Count opponent's choices
    const counts = { rock: 0, paper: 0, scissors: 0 };
    opponentHistory.forEach(choice => {
      counts[choice]++;
    });

    // Find most frequent choice
    let mostFrequent: Choice = "rock";
    let maxCount = 0;
    (Object.keys(counts) as Choice[]).forEach(choice => {
      if (counts[choice] > maxCount) {
        maxCount = counts[choice];
        mostFrequent = choice;
      }
    });

    // Counter the most frequent choice
    const counters = {
      rock: "paper",
      paper: "scissors",
      scissors: "rock",
    } as const;

    // 70% counter, 30% random (for unpredictability)
    return Math.random() < 0.7 ? counters[mostFrequent] : this.getRandomChoice();
  }
}
