import { storage } from "./storage";
import type { Match, User } from "@shared/schema";
import { getXPForNextLevel, achievementDefinitions } from "@shared/achievementDefinitions";
import { pushNotification } from "./notificationStore";

/**
 * Service to track and award achievements based on match results
 */
export class AchievementService {
  /**
   * Awards base XP for completing a match (win or loss)
   */
  async awardMatchXP(userId: string, match: Match, didWin: boolean): Promise<void> {
    const baseXP = didWin ? 50 : 20; // Winners get more XP
    const user = await storage.getUser(userId);
    
    if (!user) return;

    // Award XP
    const updatedUser = await storage.addXP(userId, baseXP);
    
    // Check if user leveled up
    const currentLevel = user.level || 1;
    const nextLevelXP = getXPForNextLevel(currentLevel);
    
    if (updatedUser.xp >= nextLevelXP) {
      // Level up!
      const newLevel = currentLevel + 1;
      await storage.updateUserLevel(userId, newLevel);
      console.log(`[ACHIEVEMENT] User ${userId} leveled up to level ${newLevel}!`);
    }
  }

  /**
   * Checks and awards achievements after a match completes
   */
  async checkAndAwardAchievements(match: Match): Promise<void> {
    if (!match.winnerId || match.status !== "completed") {
      return;
    }

    // Don't award achievements for practice matches
    if (match.isPractice) {
      return;
    }

    const winner = await storage.getUser(match.winnerId);
    const loser = await storage.getUser(
      match.winnerId === match.player1Id ? match.player2Id! : match.player1Id
    );

    if (!winner) return;

    // Award match completion XP
    await this.awardMatchXP(match.winnerId, match, true);
    if (loser && !match.isBotMatch) {
      await this.awardMatchXP(loser.id, match, false);
    }

    // Check specific achievement criteria based on game type and match data
    await this.checkGameSpecificAchievements(match, winner);
    await this.checkProgressionAchievements(match, winner);
    await this.checkWinStreakAchievements(match, winner);
    await this.checkFinancialAchievements(match, winner);
  }

  /**
   * Check game-specific achievements (flawless victory, hole-in-one, etc)
   */
  private async checkGameSpecificAchievements(match: Match, winner: User): Promise<void> {
    const gameState = match.gameState as any;

    // Chess achievements
    if (match.gameType === "chess") {
      // Speed Demon - win in under 5 minutes (300 seconds)
      if (match.duration && match.duration < 300) {
        await this.tryAwardAchievement(winner.id, "chess-speed-demon", match.id);
      }
      
      // NOTE: chess-checkmate-master requires isCheckmate flag in game state
      // Deferred until chess engine tracks checkmate condition explicitly
    }

    // Mini Golf achievements
    if (match.gameType === "mini-golf") {
      // Hole in One - score a hole-in-one (winner must have scored it)
      if (gameState?.perHoleStrokes) {
        const playerKey = match.winnerId === match.player1Id ? "player1" : "player2";
        const hasHoleInOne = Object.values(gameState.perHoleStrokes).some(
          (hole: any) => hole && hole[playerKey] === 1
        );
        if (hasHoleInOne) {
          await this.tryAwardAchievement(winner.id, "golf-hole-in-one", match.id);
        }
      }

      // NOTE: golf-perfect-round requires per-hole par metadata in game state
      // Deferred until hole definitions include official par values
    }

    // Connect 4 achievements  
    if (match.gameType === "connect-4") {
      // Lightning Strike - win in 10 moves or less
      if (gameState?.moveHistory && gameState.moveHistory.length <= 10) {
        await this.tryAwardAchievement(winner.id, "connect4-quick-win", match.id);
      }
      
      // NOTE: connect4-flawless-victory requires opponent 3-in-a-row detection
      // Deferred until game state tracks opponent streaks explicitly
    }

    // Air Hockey achievements
    if (match.gameType === "air-hockey") {
      const winnerScore = match.winnerId === match.player1Id ? match.player1Score : match.player2Score;
      const loserScore = match.winnerId === match.player1Id ? match.player2Score : match.player1Score;

      // Shutout - win 7-0
      if (winnerScore === 7 && loserScore === 0) {
        await this.tryAwardAchievement(winner.id, "airhockey-shutout", match.id);
      }

      // Epic Comeback - win after being down 5-0 (requires goal history in game state)
      if (gameState?.goalHistory) {
        // Check if winner was ever down 0-5
        const playerKey = match.winnerId === match.player1Id ? "player1" : "player2";
        const opponentKey = playerKey === "player1" ? "player2" : "player1";
        
        let maxDeficit = 0;
        let playerScore = 0;
        let opponentScore = 0;
        
        for (const goal of gameState.goalHistory) {
          if (goal.scorer === playerKey) {
            playerScore++;
          } else {
            opponentScore++;
          }
          
          const deficit = opponentScore - playerScore;
          if (deficit > maxDeficit) {
            maxDeficit = deficit;
          }
        }
        
        if (maxDeficit >= 5) {
          await this.tryAwardAchievement(winner.id, "airhockey-comeback", match.id);
        }
        
        // Lightning Puck - score 3 goals in under 30 seconds
        if (gameState.goalHistory.length >= 3) {
          const winnerGoals = gameState.goalHistory.filter((g: any) => g.scorer === playerKey);
          
          // Check all sliding windows of 3 consecutive goals by winner
          for (let i = 0; i <= winnerGoals.length - 3; i++) {
            const firstGoal = winnerGoals[i];
            const thirdGoal = winnerGoals[i + 2];
            const timeDiff = thirdGoal.timestamp - firstGoal.timestamp;
            
            if (timeDiff <= 30000) { // 30 seconds in milliseconds
              await this.tryAwardAchievement(winner.id, "airhockey-lightning-puck", match.id);
              break;
            }
          }
        }
        
        // Goal Machine - score 5 consecutive goals without opponent scoring
        let consecutiveGoals = 0;
        let maxConsecutive = 0;
        
        for (const goal of gameState.goalHistory) {
          if (goal.scorer === playerKey) {
            consecutiveGoals++;
            maxConsecutive = Math.max(maxConsecutive, consecutiveGoals);
          } else {
            consecutiveGoals = 0;
          }
        }
        
        if (maxConsecutive >= 5) {
          await this.tryAwardAchievement(winner.id, "airhockey-goal-streak", match.id);
        }
      }
    }
  }

  /**
   * Check progression-based achievements (total wins, total matches)
   */
  private async checkProgressionAchievements(match: Match, winner: User): Promise<void> {
    const stats = await storage.getUserStats(winner.id);
    const totalWins = stats.wins;

    // First Blood - win your first match
    if (totalWins === 1) {
      await this.tryAwardAchievement(winner.id, "first-blood", match.id);
    }

    // Veteran - play 10 matches total
    if (stats.totalMatches >= 10) {
      await this.tryAwardAchievement(winner.id, "veteran-10", match.id);
    }

    // Seasoned Duelist - play 50 matches total
    if (stats.totalMatches >= 50) {
      await this.tryAwardAchievement(winner.id, "veteran-50", match.id);
    }

    // Champion - play 100 matches total
    if (stats.totalMatches >= 100) {
      await this.tryAwardAchievement(winner.id, "veteran-100", match.id);
    }
  }

  /**
   * Check win streak achievements
   */
  private async checkWinStreakAchievements(match: Match, winner: User): Promise<void> {
    // Get recent matches to calculate win streak
    const recentMatches = await storage.getUserRecentMatches(winner.id, 20);
    
    // Calculate current win streak (consecutive wins from most recent)
    let currentStreak = 0;
    for (const m of recentMatches) {
      if (m.winnerId === winner.id && m.status === "completed" && !m.isPractice) {
        currentStreak++;
      } else if (m.status === "completed" && !m.isPractice) {
        break; // Streak broken
      }
    }

    // On Fire - 3 wins in a row
    if (currentStreak >= 3) {
      await this.tryAwardAchievement(winner.id, "win-streak-3", match.id);
    }

    // Unstoppable - 5 wins in a row
    if (currentStreak >= 5) {
      await this.tryAwardAchievement(winner.id, "win-streak-5", match.id);
    }

    // Legendary - 10 wins in a row
    if (currentStreak >= 10) {
      await this.tryAwardAchievement(winner.id, "win-streak-10", match.id);
    }
  }

  /**
   * Check financial achievements (high roller, big spender)
   */
  private async checkFinancialAchievements(match: Match, winner: User): Promise<void> {
    // High Roller (Big Spender) - win a match with $100+ pot
    if (match.potAmount && parseFloat(match.potAmount) >= 100) {
      await this.tryAwardAchievement(winner.id, "big-spender", match.id);
    }
  }

  /**
   * Helper to try awarding an achievement (won't duplicate)
   */
  private async tryAwardAchievement(
    userId: string,
    achievementId: string,
    matchId: string
  ): Promise<void> {
    try {
      const result = await storage.awardAchievement(userId, achievementId, matchId);
      if (result) {
        console.log(`[ACHIEVEMENT] Awarded "${achievementId}" to user ${userId}`);
        const def = achievementDefinitions.find(a => a.id === achievementId);
        if (def) {
          pushNotification(userId, {
            type: "achievement",
            title: "Achievement Unlocked",
            body: def.name,
            linkTo: "/dashboard",
            meta: { achievementId, description: def.description, icon: def.icon, rarity: def.rarity },
          });
        }
      }
    } catch (error) {
      console.error(`[ACHIEVEMENT] Error awarding ${achievementId}:`, error);
    }
  }
}

export const achievementService = new AchievementService();
