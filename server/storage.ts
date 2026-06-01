import {
  users,
  matches,
  transactions,
  gameSettings,
  chatMessages,
  directMessages,
  achievements,
  userAchievements,
  friendships,
  challengeInvites,
  favoriteGames,
  cryptoPayments,
  savedCards,
  type User,
  type UpsertUser,
  type Match,
  type InsertMatch,
  type MatchWithPlayers,
  type LeaderboardEntry,
  type UserStats,
  type GameType,
  type Transaction,
  type InsertTransaction,
  type GameSettings,
  type UpdateGameSettings,
  type ChatMessage,
  type InsertChatMessage,
  type DirectMessage,
  type InsertDirectMessage,
  type DirectMessageWithUser,
  type Achievement,
  type UserAchievement,
  type InsertUserAchievement,
  type Friendship,
  type FriendshipWithUsers,
  type InsertFriendship,
  type ChallengeInvite,
  type ChallengeInviteWithUsers,
  type InsertChallengeInvite,
  type FavoriteGame,
  type CryptoPayment,
  type InsertCryptoPayment,
  type SavedCard,
  type InsertSavedCard,
  challengeClaims,
  type ChallengeClaim,
  battlePassSeasons,
  userBattlePassProgress,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, or } from "drizzle-orm";
import crypto from "crypto";
import { pushNotification } from "./notificationStore";

// Column selection for user relations embedded in match queries.
// PostgreSQL limits json_build_object() to 100 arguments. The users table
// has ~105 columns; with 3 user joins Drizzle would generate ~630 arguments
// per user (210 per json_build_object call), far exceeding the limit.
// Selecting only the needed fields keeps each call to ≤46 args (23 cols × 2).
export const MATCH_PLAYER_COLUMNS = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  username: true,
  profileImageUrl: true,
  isBot: true,
  isAdmin: true,
  isVerifiedAccount: true,
  isBanned: true,
  reputation: true,
  nicknameColor: true,
} as const;

// Extended column set for leaderboard queries — includes per-game ELO ratings
// used to compute the "overall rating" display. Still 46 args per user (23×2).
const LEADERBOARD_PLAYER_COLUMNS = {
  ...MATCH_PLAYER_COLUMNS,
  chessRating: true,
  miniGolfRating: true,
  connect4Rating: true,
  airHockeyRating: true,
  blockBlastRating: true,
  rockPaperScissorsRating: true,
  dotsAndBoxesRating: true,
  eightBallRating: true,
  bowlingRating: true,
  cupKingRating: true,
  stackTowerRating: true,
  basketballRating: true,
  footballRating: true,
  racingRating: true,
} as const;

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getOrCreateBot(difficulty: string): Promise<User>;
  updateUserTheme(userId: string, theme: string): Promise<void>;
  updateUsername(userId: string, username: string): Promise<User>;
  updateProfilePicture(userId: string, profileImageUrl: string): Promise<User>;
  checkUsernameAvailable(username: string, currentUserId?: string): Promise<boolean>;
  getUserByUsername(username: string): Promise<User | undefined>;
  
  // Admin user operations
  getAllUsers(limit?: number, offset?: number): Promise<User[]>;
  updateUserAdminStatus(userId: string, isAdmin: boolean): Promise<User>;
  updateUserBalanceAdmin(userId: string, newBalance: string): Promise<User>;
  banUser(userId: string): Promise<User>;
  unbanUser(userId: string): Promise<User>;
  updateEmailVerification(userId: string, isVerified: boolean): Promise<User>;
  updateVerifiedAccountBadge(userId: string, isVerified: boolean): Promise<User>;
  updateLoginStreak(userId: string): Promise<{ user: User; reward: number; streakBroken: boolean }>;
  
  // Wallet operations
  updateUserBalance(userId: string, amount: string, type: string, matchId: string | null, description: string): Promise<User>;
  addFunds(userId: string, amount: number): Promise<User>;
  getUserTransactions(userId: string, limit?: number): Promise<Transaction[]>;
  updateStripeCustomerId(userId: string, stripeCustomerId: string): Promise<User>;

  // Saved card operations
  getSavedCards(userId: string): Promise<SavedCard[]>;
  getSavedCard(cardId: string): Promise<SavedCard | undefined>;
  createSavedCard(card: InsertSavedCard): Promise<SavedCard>;
  updateSavedCard(cardId: string, updates: Partial<Pick<SavedCard, "nickname" | "billingZip" | "expiryMonth" | "expiryYear" | "isDefault">>): Promise<SavedCard>;
  deleteSavedCard(cardId: string): Promise<void>;
  setDefaultCard(userId: string, cardId: string): Promise<void>;

  // Crypto payment operations
  createCryptoPayment(payment: InsertCryptoPayment): Promise<CryptoPayment>;
  getCryptoPayment(id: string): Promise<CryptoPayment | undefined>;
  getCryptoPaymentByExternalId(paymentId: string): Promise<CryptoPayment | undefined>;
  updateCryptoPaymentStatus(id: string, status: string, txHash?: string): Promise<CryptoPayment>;
  getUserCryptoPayments(userId: string, limit?: number): Promise<CryptoPayment[]>;

  // Payment event idempotency — prevents double-crediting from duplicate webhooks
  checkPaymentEventProcessed(provider: string, eventId: string): Promise<boolean>;
  recordPaymentEvent(provider: string, eventId: string, eventType: string, payload: unknown): Promise<void>;
  
  // Admin analytics
  getPlatformAnalytics(): Promise<{
    totalUsers: number;
    totalMatches: number;
    totalRevenue: string;
    totalRakedMatches: number;
    activeUsers24h: number;
    matchesLast24h: number;
  }>;
  getAllTransactions(filters?: {
    userId?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<Transaction[]>;
  getRevenueByGameType(startDate?: Date, endDate?: Date): Promise<Array<{
    gameType: string;
    totalRevenue: string;
    matchCount: number;
  }>>;
  
  // Game settings operations
  getGameSettings(): Promise<GameSettings>;
  updateGameSettings(settings: UpdateGameSettings): Promise<GameSettings>;

  // Match operations
  deleteMatch(matchId: string, userId: string): Promise<void>;
  createMatch(match: InsertMatch): Promise<Match>;
  createMatchWithBet(match: InsertMatch, betAmount?: string): Promise<Match>;
  findMatchingGame(gameType: GameType, betAmount: string, excludeUserId: string, deviceType?: string): Promise<MatchWithPlayers | undefined>;
  getAvailableBetAmounts(gameType: GameType): Promise<string[]>;
  createBotMatch(gameType: GameType, player1Id: string, difficulty: string): Promise<Match>;
  createPracticeMatch(gameType: GameType, player1Id: string): Promise<Match>;
  getMatch(id: string): Promise<MatchWithPlayers | undefined>;
  getAvailableMatches(): Promise<MatchWithPlayers[]>;
  getUserActiveMatches(userId: string): Promise<MatchWithPlayers[]>;
  getUserRecentMatches(userId: string, limit?: number): Promise<MatchWithPlayers[]>;
  joinMatch(matchId: string, userId: string, betAmount?: string): Promise<Match>;
  updateMatchState(matchId: string, state: any): Promise<Match>;
  completeMatch(matchId: string, winnerId: string | null, player1Score: number, player2Score: number): Promise<Match>;
  completeChessMatch(matchId: string, winnerId: string | null, pgnMoves: string, duration: number): Promise<Match>;
  completeConnect4Match(matchId: string, winnerId: string | null, moveSequence: string, duration: number): Promise<Match>;
  completeMiniGolfMatch(matchId: string, winnerId: string | null, player1Score: number, player2Score: number, gameState: any): Promise<Match>;
  forfeitMatch(matchId: string, forfeitedById: string): Promise<Match>;
  cancelMatch(matchId: string, userId: string): Promise<void>;

  // Stats and leaderboard
  getUserStats(userId: string): Promise<UserStats>;
  getLeaderboard(limit?: number): Promise<LeaderboardEntry[]>;
  getGameLeaderboard(gameType: GameType, limit?: number, since?: Date): Promise<LeaderboardEntry[]>;
  getMoneyLeaderboard(limit?: number): Promise<Array<{ userId: string; username: string; totalWinnings: string }>>;
  
  // Chat operations
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatMessages(channel: string, matchId?: string, limit?: number): Promise<Array<ChatMessage & { user: User | null }>>;
  
  // Direct message operations
  createDirectMessage(message: InsertDirectMessage): Promise<DirectMessage>;
  getDirectMessages(userId1: string, userId2: string, limit?: number): Promise<DirectMessageWithUser[]>;
  getDirectMessageConversations(userId: string): Promise<Array<{ friend: User; lastMessage: DirectMessageWithUser; unreadCount: number }>>;
  markDirectMessagesAsRead(userId: string, friendId: string): Promise<void>;
  getUnreadDirectMessageCount(userId: string): Promise<number>;
  
  // Friend operations
  sendFriendRequest(requesterId: string, addresseeId: string): Promise<Friendship>;
  acceptFriendRequest(friendshipId: string, userId: string): Promise<Friendship>;
  declineFriendRequest(friendshipId: string, userId: string): Promise<void>;
  removeFriend(friendshipId: string, userId: string): Promise<void>;
  getUserFriends(userId: string): Promise<FriendshipWithUsers[]>;
  getPendingFriendRequests(userId: string): Promise<FriendshipWithUsers[]>;
  checkFriendship(userId1: string, userId2: string): Promise<Friendship | undefined>;
  searchUsers(query: string, currentUserId: string, limit?: number): Promise<User[]>;
  
  // Challenge invite operations
  createChallengeInvite(invite: InsertChallengeInvite): Promise<ChallengeInvite>;
  acceptChallengeInvite(inviteId: string, userId: string, deviceType?: string): Promise<{ invite: ChallengeInvite; match: Match }>;
  declineChallengeInvite(inviteId: string, userId: string): Promise<void>;
  getPendingChallengeInvites(userId: string): Promise<ChallengeInviteWithUsers[]>;
  cleanupExpiredInvites(): Promise<void>;
  
  // Favorite games operations
  getFavoriteGames(userId: string): Promise<FavoriteGame[]>;
  addFavoriteGame(userId: string, gameType: string): Promise<FavoriteGame>;
  removeFavoriteGame(userId: string, gameType: string): Promise<void>;
  isFavoriteGame(userId: string, gameType: string): Promise<boolean>;
  
  // Challenge claim operations
  getChallengeClaims(userId: string): Promise<ChallengeClaim[]>;
  hasClaimedChallenge(userId: string, challengeId: string): Promise<boolean>;
  createChallengeClaim(userId: string, challengeId: string, xpAwarded: number): Promise<ChallengeClaim>;

  // Achievement and XP operations
  addXP(userId: string, amount: number): Promise<User>;
  addBattlePassXP(userId: string, amount: number): Promise<void>;
  getStreakXPMultiplier(loginStreak: number): number;
  updateUserLevel(userId: string, newLevel: number): Promise<User>;
  getAllAchievements(): Promise<Achievement[]>;
  getUserAchievements(userId: string): Promise<Array<UserAchievement & { achievement: Achievement }>>;
  awardAchievement(userId: string, achievementId: string, matchId?: string): Promise<UserAchievement | null>;
  hasAchievement(userId: string, achievementId: string): Promise<boolean>;
  
  // Match statistics operations
  saveMatchStatistics(matchId: string, userId: string, stats: {
    goals?: number;
    shots?: number;
    saves?: number;
    hitSpeedPeak?: number;
    possessionSeconds?: number;
    possessionPercent?: string;
    ratingBefore: number;
    ratingAfter: number;
    ratingChange: number;
  }): Promise<void>;
  getMatchStatistics(matchId: string): Promise<Array<any>>;
  getUserMatchStatistics(userId: string, gameType?: GameType, limit?: number): Promise<Array<any>>;
  
  // ELO/Rating operations
  updatePlayerRating(userId: string, gameType: GameType, newRating: number, ratingChange: number, matchId?: string | null): Promise<User>;
  updatePlacementMatches(userId: string, gameType: GameType): Promise<User>;
  updateRatedGamesPlayed(userId: string, gameType: GameType): Promise<User>;
  updateWinStreak(userId: string, gameType: GameType, isWin: boolean): Promise<User>;
  getRatingLeaderboard(gameType: GameType, limit?: number): Promise<Array<{
    userId: string;
    userName: string;
    profileImageUrl: string | null;
    rating: number;
    totalMatches: number;
    wins: number;
    winRate: number;
    winStreak: number;
  }>>;
  
  // Global stats operations
  getGlobalStats(): Promise<{
    totalMatches: number;
    totalWinnings: string;
    liveGamesCount: number;
  }>;
  getFairPlayLog(limit?: number, offset?: number): Promise<Array<MatchWithPlayers & { verificationHash: string }>>;
}

// Helper function to convert game type to camel-cased field prefix
function gameTypeToFieldPrefix(gameType: GameType): string {
  switch (gameType) {
    case 'chess':           return 'chess';
    case 'mini-golf':       return 'miniGolf';
    case 'connect-4':       return 'connect4';
    case 'air-hockey':      return 'airHockey';
    case 'block-blast':     return 'blockBlast';
    case 'rock-paper-scissors': return 'rockPaperScissors';
    case 'dots-and-boxes':  return 'dotsAndBoxes';
    case '8-ball':          return 'eightBall';
    case 'bowling':         return 'bowling';
    case 'cup-king':        return 'cupKing';
    case 'stack-tower':     return 'stackTower';
    case 'basketball':      return 'basketball';
    case 'football':        return 'football';
    case 'racing':          return 'racing';
    default:
      throw new Error(`Unknown game type: ${gameType}`);
  }
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // First check if user exists by email (since email should be the stable identifier)
    const [existingUserByEmail] = userData.email 
      ? await db.select().from(users).where(eq(users.email, userData.email!))
      : [undefined];
    
    // If user exists by email, use that user's ID and update their data
    if (existingUserByEmail) {
      const [user] = await db
        .update(users)
        .set({
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.email, userData.email!))
        .returning();
      return user;
    }
    
    // Check if user exists by ID
    const existingUserById = userData.id ? await this.getUser(userData.id) : undefined;
    
    // Insert or update based on ID
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        balance: existingUserById ? undefined : "100.00", // Give new users $100
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getOrCreateBot(difficulty: string): Promise<User> {
    const botName = `Bot-${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`;
    const botEmail = `bot-${difficulty}@duel.ai`;
    
    const [existingBot] = await db
      .select()
      .from(users)
      .where(eq(users.email, botEmail));
    
    if (existingBot) {
      return existingBot;
    }

    const [bot] = await db
      .insert(users)
      .values({
        email: botEmail,
        firstName: botName,
        lastName: "AI",
        isBot: true,
      })
      .returning();
    
    return bot;
  }

  async updateUserTheme(userId: string, theme: string): Promise<void> {
    await db
      .update(users)
      .set({ themePreference: theme })
      .where(eq(users.id, userId));
  }

  async updateUsername(userId: string, username: string): Promise<User> {
    // Check rate limit (30 days between username changes)
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.lastUsernameChangeAt) {
      const daysSinceLastChange = Math.floor(
        (Date.now() - new Date(user.lastUsernameChangeAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceLastChange < 30) {
        throw new Error(`You can only change your username once every 30 days. Try again in ${30 - daysSinceLastChange} days.`);
      }
    }

    // Validate username format (alphanumeric, underscores, 3-30 chars)
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      throw new Error("Username must be 3-30 characters and contain only letters, numbers, and underscores");
    }

    // Check availability
    const available = await this.checkUsernameAvailable(username, userId);
    if (!available) {
      throw new Error("Username is already taken");
    }

    // Update username and timestamp
    const [updatedUser] = await db
      .update(users)
      .set({ 
        username, 
        lastUsernameChangeAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();

    return updatedUser;
  }

  async updateProfilePicture(userId: string, profileImageUrl: string): Promise<User> {
    // Check rate limit (7 days between profile picture changes)
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.lastProfilePictureChangeAt) {
      const daysSinceLastChange = Math.floor(
        (Date.now() - new Date(user.lastProfilePictureChangeAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceLastChange < 7) {
        throw new Error(`You can only change your profile picture once every 7 days. Try again in ${7 - daysSinceLastChange} days.`);
      }
    }

    // Update profile picture and timestamp
    const [updatedUser] = await db
      .update(users)
      .set({ 
        profileImageUrl, 
        lastProfilePictureChangeAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();

    return updatedUser;
  }

  async updateUserPreferences(userId: string, updates: {
    languagePreference?: string;
    timezonePreference?: string;
    currencyDisplay?: string;
  }): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      throw new Error("User not found");
    }

    return updatedUser;
  }

  async updateSpendingLimits(userId: string, updates: {
    dailySpendingLimit?: string | null;
    weeklySpendingLimit?: string | null;
    monthlySpendingLimit?: string | null;
    maxWagerAmount?: string | null;
  }): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      throw new Error("User not found");
    }

    return updatedUser;
  }

  async setSelfExclusion(userId: string, durationDays: number): Promise<User> {
    const exclusionUntil = new Date();
    exclusionUntil.setDate(exclusionUntil.getDate() + durationDays);

    const [updatedUser] = await db
      .update(users)
      .set({ 
        selfExclusionUntil: exclusionUntil,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      throw new Error("User not found");
    }

    return updatedUser;
  }

  async setCoolOff(userId: string, durationHours: number): Promise<User> {
    const coolOffUntil = new Date();
    coolOffUntil.setHours(coolOffUntil.getHours() + durationHours);

    const [updatedUser] = await db
      .update(users)
      .set({ 
        coolOffUntil,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      throw new Error("User not found");
    }

    return updatedUser;
  }

  async updatePrivacySettings(userId: string, updates: {
    statsVisibility?: string;
    betaFeaturesEnabled?: boolean;
  }): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      throw new Error("User not found");
    }

    return updatedUser;
  }

  async getReferralCode(userId: string): Promise<string> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Generate referral code if it doesn't exist
    if (!user.referralCode) {
      return await this.generateReferralCode(userId);
    }

    return user.referralCode;
  }

  async generateReferralCode(userId: string): Promise<string> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Generate a unique referral code (8 characters, alphanumeric)
    let referralCode: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      // Generate code from username or random
      const base = user.username || user.email || 'user';
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      referralCode = `${base.substring(0, 4).toUpperCase()}${randomSuffix}`;

      // Check if code already exists
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.referralCode, referralCode))
        .limit(1);

      if (existing.length === 0) {
        break;
      }

      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      // Fallback to fully random code
      referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    }

    // Update user with new referral code
    const [updatedUser] = await db
      .update(users)
      .set({ 
        referralCode,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();

    return updatedUser.referralCode!;
  }

  async requestAccountClosure(userId: string, reason: string): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ 
        accountClosureRequested: true,
        accountClosureReason: reason,
        accountClosureRequestedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      throw new Error("User not found");
    }

    return updatedUser;
  }

  async checkUsernameAvailable(username: string, currentUserId?: string): Promise<boolean> {
    // Basic profanity filter (expand this list as needed)
    const profanityList = ['fuck', 'shit', 'damn', 'ass', 'bitch', 'bastard', 'cunt', 'dick', 'pussy', 'cock', 'nigger', 'nigga', 'fag', 'retard', 'whore', 'slut'];
    const lowerUsername = username.toLowerCase();
    
    for (const word of profanityList) {
      if (lowerUsername.includes(word)) {
        return false;
      }
    }

    // Check if username exists (excluding current user if provided)
    const existingUser = await this.getUserByUsername(username);
    
    if (!existingUser) {
      return true;
    }
    
    // If currentUserId is provided and it's the same as the existing user, it's available (user keeping their own username)
    return currentUserId ? existingUser.id === currentUserId : false;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user;
  }

  // Admin user operations
  async getAllUsers(limit: number = 100, offset: number = 0): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.isBot, false))
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async updateUserAdminStatus(userId: string, isAdmin: boolean): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ isAdmin, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    return user;
  }

  async updateUserBalanceAdmin(userId: string, newBalance: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    return user;
  }

  async banUser(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ isBanned: true, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    return user;
  }

  async unbanUser(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ isBanned: false, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    return user;
  }

  async updateEmailVerification(userId: string, isVerified: boolean): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ isEmailVerified: isVerified, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    return user;
  }

  async updateVerifiedAccountBadge(userId: string, isVerified: boolean): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ isVerifiedAccount: isVerified, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    return user;
  }

  async updateLoginStreak(userId: string): Promise<{ user: User; reward: number; streakBroken: boolean }> {
    return await db.transaction(async (tx) => {
      // Get user within transaction
      const [user] = await tx.select().from(users).where(eq(users.id, userId));
      if (!user) {
        throw new Error("User not found");
      }

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const lastLogin = user.lastLoginDate ? new Date(user.lastLoginDate) : null;
      const lastLoginDate = lastLogin ? new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate()) : null;

      let newStreak = user.loginStreak || 0;
      let reward = 0;
      let streakBroken = false;

      if (!lastLoginDate) {
        // First login ever
        newStreak = 1;
        reward = 5; // $5 for first login
      } else if (lastLoginDate.getTime() === today.getTime()) {
        // Already logged in today, no change
        return { user, reward: 0, streakBroken: false };
      } else {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (lastLoginDate.getTime() === yesterday.getTime()) {
          // Logged in yesterday, continue streak
          newStreak = (user.loginStreak || 0) + 1;
          
          // Reward based on streak milestones
          if (newStreak === 3) reward = 10; // $10 for 3-day streak
          else if (newStreak === 7) reward = 25; // $25 for 7-day streak
          else if (newStreak === 14) reward = 50; // $50 for 2-week streak
          else if (newStreak === 30) reward = 100; // $100 for 1-month streak
          else if (newStreak % 7 === 0) reward = 15; // $15 for every week thereafter
          else reward = 2; // $2 daily login reward
        } else {
          // Streak broken
          newStreak = 1;
          reward = 5; // $5 to start fresh
          streakBroken = true;
        }
      }

      // Update longest streak if needed
      const longestStreak = Math.max(user.longestStreak || 0, newStreak);

      // Update user with new streak data (within transaction)
      const [updatedUser] = await tx
        .update(users)
        .set({
          lastLoginDate: now,
          loginStreak: newStreak,
          longestStreak,
          updatedAt: now,
        })
        .where(eq(users.id, userId))
        .returning();

      // Award the reward if any (within same transaction)
      if (reward > 0 && updatedUser) {
        const rewardAmount = parseFloat(reward.toFixed(2));
        const currentBalance = parseFloat(updatedUser.balance);
        const newBalance = (currentBalance + rewardAmount).toFixed(2);

        // Update balance within transaction
        const [userWithReward] = await tx
          .update(users)
          .set({ balance: newBalance, updatedAt: now })
          .where(eq(users.id, userId))
          .returning();

        // Record transaction within same transaction
        await tx.insert(transactions).values({
          userId,
          type: "deposit",
          amount: reward.toFixed(2),
          balanceBefore: updatedUser.balance,
          balanceAfter: newBalance,
          matchId: null,
          description: streakBroken 
            ? `Fresh start bonus: ${newStreak} day streak` 
            : `Daily login reward: ${newStreak} day streak`,
        });

        return { user: userWithReward!, reward, streakBroken };
      }

      return { user: updatedUser!, reward, streakBroken };
    });
  }

  async getPlatformAnalytics(): Promise<{
    totalUsers: number;
    totalMatches: number;
    totalRevenue: string;
    totalRakedMatches: number;
    activeUsers24h: number;
    matchesLast24h: number;
  }> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Total users (excluding bots)
    const [totalUsersResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.isBot, false));

    // Total matches
    const [totalMatchesResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(matches);

    // Total revenue (sum of all rake amounts) and count of raked matches
    const [totalRevenueResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(rake_amount), 0)::text` })
      .from(matches)
      .where(eq(matches.status, "completed"));

    // Count of completed matches with rake (where rake_amount > 0)
    const [rakedMatchesResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(matches)
      .where(and(
        eq(matches.status, "completed"),
        sql`rake_amount > 0`
      ));

    // Active users in last 24h (users with matches or transactions)
    const [activeUsersResult] = await db
      .select({ count: sql<number>`count(DISTINCT player1_id)::int` })
      .from(matches)
      .where(sql`created_at >= ${yesterday}`);

    // Matches in last 24h
    const [matchesLast24hResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(matches)
      .where(sql`created_at >= ${yesterday}`);

    return {
      totalUsers: totalUsersResult?.count || 0,
      totalMatches: totalMatchesResult?.count || 0,
      totalRevenue: totalRevenueResult?.total || "0.00",
      totalRakedMatches: rakedMatchesResult?.count || 0,
      activeUsers24h: activeUsersResult?.count || 0,
      matchesLast24h: matchesLast24hResult?.count || 0,
    };
  }

  async getAllTransactions(filters?: {
    userId?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<Transaction[]> {
    const limit = filters?.limit || 100;
    const offset = filters?.offset || 0;
    
    let query: any = db.select().from(transactions);
    
    const conditions: any[] = [];
    
    if (filters?.userId) {
      conditions.push(eq(transactions.userId, filters.userId));
    }
    
    if (filters?.type) {
      conditions.push(eq(transactions.type, filters.type));
    }
    
    if (filters?.startDate) {
      conditions.push(sql`${transactions.createdAt} >= ${filters.startDate}`);
    }
    
    if (filters?.endDate) {
      conditions.push(sql`${transactions.createdAt} <= ${filters.endDate}`);
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const result = await query
      .orderBy(desc(transactions.createdAt))
      .limit(limit)
      .offset(offset);
    
    return result;
  }

  async getRevenueByGameType(startDate?: Date, endDate?: Date): Promise<Array<{
    gameType: string;
    totalRevenue: string;
    matchCount: number;
  }>> {
    let query = db
      .select({
        gameType: matches.gameType,
        totalRevenue: sql<string>`COALESCE(SUM(${matches.rakeAmount}), 0)::text`,
        matchCount: sql<number>`count(*)::int`,
      })
      .from(matches)
      .where(eq(matches.status, "completed"));
    
    const conditions: any[] = [eq(matches.status, "completed")];
    
    if (startDate) {
      conditions.push(sql`${matches.completedAt} >= ${startDate}`);
    }
    
    if (endDate) {
      conditions.push(sql`${matches.completedAt} <= ${endDate}`);
    }
    
    const result = await db
      .select({
        gameType: matches.gameType,
        totalRevenue: sql<string>`COALESCE(SUM(${matches.rakeAmount}), 0)::text`,
        matchCount: sql<number>`count(*)::int`,
      })
      .from(matches)
      .where(and(...conditions))
      .groupBy(matches.gameType);
    
    return result;
  }

  // Game settings operations
  async getGameSettings(): Promise<GameSettings> {
    const [settings] = await db.select().from(gameSettings).where(eq(gameSettings.id, "default"));
    
    // If settings don't exist, create default settings
    if (!settings) {
      const [newSettings] = await db.insert(gameSettings).values({
        id: "default",
        platformRake: "5.00",
        minBet: "5.00",
        maxBet: "1000.00",
        newUserBonus: "100.00",
        chessEnabled: true,
        miniGolfEnabled: true,
        connect4Enabled: true,
      }).returning();
      return newSettings;
    }
    
    return settings;
  }

  async updateGameSettings(settings: UpdateGameSettings): Promise<GameSettings> {
    const [updated] = await db
      .update(gameSettings)
      .set({
        ...settings,
        updatedAt: new Date(),
      })
      .where(eq(gameSettings.id, "default"))
      .returning();
    
    return updated;
  }

  // Wallet operations
  async updateUserBalance(
    userId: string, 
    amount: string, 
    type: string, 
    matchId: string | null, 
    description: string
  ): Promise<User> {
    // Run in transaction to ensure atomicity
    return await db.transaction(async (tx) => {
      // Lock the user row and get current balance
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .for("update");

      if (!user) {
        throw new Error("User not found");
      }

      const balanceBefore = user.balance || "0.00";
      const amountNum = parseFloat(amount);
      const balanceBeforeNum = parseFloat(balanceBefore);
      const balanceAfterNum = balanceBeforeNum + amountNum;
      
      // Prevent negative balances
      if (balanceAfterNum < 0) {
        throw new Error("Insufficient balance");
      }

      const balanceAfter = balanceAfterNum.toFixed(2);

      // Update user balance
      const [updatedUser] = await tx
        .update(users)
        .set({ balance: balanceAfter })
        .where(eq(users.id, userId))
        .returning();

      // Record transaction
      await tx.insert(transactions).values({
        userId,
        type,
        amount,
        balanceBefore,
        balanceAfter,
        matchId,
        description,
      });

      return updatedUser;
    });
  }

  async addFunds(userId: string, amount: number): Promise<User> {
    const amountStr = amount.toFixed(2);
    return this.updateUserBalance(
      userId,
      amountStr,
      "deposit",
      null,
      `Deposit of $${amountStr}`
    );
  }

  async getUserTransactions(userId: string, limit: number = 50): Promise<Transaction[]> {
    const result = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
    return result;
  }

  async updateStripeCustomerId(userId: string, stripeCustomerId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ stripeCustomerId, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    return user;
  }

  // Saved card operations
  async getSavedCards(userId: string): Promise<SavedCard[]> {
    return db.select().from(savedCards).where(eq(savedCards.userId, userId)).orderBy(desc(savedCards.isDefault), desc(savedCards.createdAt));
  }

  async getSavedCard(cardId: string): Promise<SavedCard | undefined> {
    const [card] = await db.select().from(savedCards).where(eq(savedCards.id, cardId));
    return card;
  }

  async createSavedCard(card: InsertSavedCard): Promise<SavedCard> {
    // If this is being set as default, unset all others first
    if (card.isDefault && card.userId) {
      await db.update(savedCards).set({ isDefault: false }).where(eq(savedCards.userId, card.userId));
    }
    const [newCard] = await db.insert(savedCards).values(card).returning();
    return newCard;
  }

  async updateSavedCard(cardId: string, updates: Partial<Pick<SavedCard, "nickname" | "billingZip" | "expiryMonth" | "expiryYear" | "isDefault">>): Promise<SavedCard> {
    const [card] = await db.update(savedCards).set(updates).where(eq(savedCards.id, cardId)).returning();
    if (!card) throw new Error("Card not found");
    return card;
  }

  async deleteSavedCard(cardId: string): Promise<void> {
    await db.delete(savedCards).where(eq(savedCards.id, cardId));
  }

  async setDefaultCard(userId: string, cardId: string): Promise<void> {
    // Unset all defaults for this user, then set the chosen one
    await db.update(savedCards).set({ isDefault: false }).where(eq(savedCards.userId, userId));
    await db.update(savedCards).set({ isDefault: true }).where(and(eq(savedCards.id, cardId), eq(savedCards.userId, userId)));
  }

  // Crypto payment operations
  async createCryptoPayment(payment: InsertCryptoPayment): Promise<CryptoPayment> {
    const [cryptoPayment] = await db.insert(cryptoPayments).values(payment).returning();
    return cryptoPayment;
  }

  async getCryptoPayment(id: string): Promise<CryptoPayment | undefined> {
    const [payment] = await db
      .select()
      .from(cryptoPayments)
      .where(eq(cryptoPayments.id, id));
    return payment;
  }

  async getCryptoPaymentByExternalId(paymentId: string): Promise<CryptoPayment | undefined> {
    const [payment] = await db
      .select()
      .from(cryptoPayments)
      .where(eq(cryptoPayments.paymentId, paymentId));
    return payment;
  }

  async updateCryptoPaymentStatus(id: string, status: string, txHash?: string): Promise<CryptoPayment> {
    const updateData: any = { status };
    if (txHash) {
      updateData.txHash = txHash;
    }
    if (status === "confirmed") {
      updateData.confirmedAt = new Date();
    }

    const [payment] = await db
      .update(cryptoPayments)
      .set(updateData)
      .where(eq(cryptoPayments.id, id))
      .returning();
    
    if (!payment) {
      throw new Error("Crypto payment not found");
    }
    
    return payment;
  }

  async getUserCryptoPayments(userId: string, limit: number = 50): Promise<CryptoPayment[]> {
    const payments = await db
      .select()
      .from(cryptoPayments)
      .where(eq(cryptoPayments.userId, userId))
      .orderBy(desc(cryptoPayments.createdAt))
      .limit(limit);
    return payments;
  }

  // In-memory set for payment event idempotency (survives for process lifetime)
  private _processedPaymentEvents = new Set<string>();

  async checkPaymentEventProcessed(provider: string, eventId: string): Promise<boolean> {
    return this._processedPaymentEvents.has(`${provider}:${eventId}`);
  }

  async recordPaymentEvent(provider: string, eventId: string, _eventType: string, _payload: unknown): Promise<void> {
    this._processedPaymentEvents.add(`${provider}:${eventId}`);
  }

  // Match operations
  async createMatch(matchData: InsertMatch): Promise<Match> {
    const [match] = await db.insert(matches).values(matchData).returning();
    return match;
  }

  async createMatchWithBet(matchData: InsertMatch, betAmount?: string): Promise<Match> {
    // If no bet, just create the match normally
    if (!betAmount || parseFloat(betAmount) <= 0) {
      return this.createMatch(matchData);
    }

    // Wrap bet deduction and match creation in a single transaction
    return await db.transaction(async (tx) => {
      const bet = parseFloat(betAmount);
      const userId = matchData.player1Id;

      // Lock user row and check balance
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .for("update");

      if (!user) {
        throw new Error("User not found");
      }

      const balance = parseFloat(user.balance || "0");
      if (balance < bet) {
        throw new Error("Insufficient balance");
      }

      // Deduct bet from balance
      const balanceAfter = (balance - bet).toFixed(2);
      await tx
        .update(users)
        .set({ balance: balanceAfter })
        .where(eq(users.id, userId));

      // Create match with pot amount
      const [match] = await tx
        .insert(matches)
        .values({
          ...matchData,
          potAmount: betAmount,
        })
        .returning();

      // Record transaction
      await tx.insert(transactions).values({
        userId,
        type: "bet_placed",
        amount: `-${bet}`,
        balanceBefore: user.balance!,
        balanceAfter,
        matchId: match.id,
        description: `Bet placed for ${matchData.gameType} match`,
      });

      return match;
    });
  }

  async findMatchingGame(gameType: GameType, betAmount: string, excludeUserId: string, deviceType?: string): Promise<MatchWithPlayers | undefined> {
    const potAmount = parseFloat(betAmount) > 0 ? betAmount : null;
    const device = deviceType || "desktop";

    const result = await db.query.matches.findFirst({
      where: and(
        eq(matches.gameType, gameType),
        eq(matches.status, "waiting"),
        potAmount !== null ? eq(matches.potAmount, potAmount) : sql`${matches.potAmount} IS NULL`,
        eq(matches.deviceType, device),
        sql`${matches.player1Id} != ${excludeUserId}`
      ),
      with: {
        player1: { columns: MATCH_PLAYER_COLUMNS },
        player2: { columns: MATCH_PLAYER_COLUMNS },
        winner: { columns: MATCH_PLAYER_COLUMNS },
      },
      orderBy: [desc(matches.createdAt)],
    });
    
    return result;
  }

  async getAvailableBetAmounts(gameType: GameType): Promise<string[]> {
    const result = await db
      .selectDistinct({ potAmount: matches.potAmount })
      .from(matches)
      .where(and(
        eq(matches.gameType, gameType),
        eq(matches.status, "waiting")
      ));
    
    return result
      .map(r => r.potAmount)
      .filter((amount): amount is string => amount !== null)
      .sort((a, b) => parseFloat(a) - parseFloat(b));
  }

  async createBotMatch(gameType: GameType, player1Id: string, difficulty: string): Promise<Match> {
    const bot = await this.getOrCreateBot(difficulty);
    
    const [match] = await db
      .insert(matches)
      .values({
        gameType,
        player1Id,
        player2Id: bot.id,
        status: "in-progress",
        isBotMatch: true,
        botDifficulty: difficulty,
        startedAt: new Date(),
      })
      .returning();
    
    return match;
  }

  async createPracticeMatch(gameType: GameType, player1Id: string): Promise<Match> {
    const [match] = await db
      .insert(matches)
      .values({
        gameType,
        player1Id,
        player2Id: null,
        status: "in-progress",
        isPractice: true,
        startedAt: new Date(),
      })
      .returning();
    
    return match;
  }

  async getMatch(id: string): Promise<MatchWithPlayers | undefined> {
    const result = await db.query.matches.findFirst({
      where: eq(matches.id, id),
      with: {
        player1: { columns: MATCH_PLAYER_COLUMNS },
        player2: { columns: MATCH_PLAYER_COLUMNS },
        winner: { columns: MATCH_PLAYER_COLUMNS },
      },
    });
    return result as MatchWithPlayers | undefined;
  }

  async getAvailableMatches(): Promise<MatchWithPlayers[]> {
    const result = await db.query.matches.findMany({
      where: eq(matches.status, "waiting"),
      with: {
        player1: { columns: MATCH_PLAYER_COLUMNS },
        player2: { columns: MATCH_PLAYER_COLUMNS },
        winner: { columns: MATCH_PLAYER_COLUMNS },
      },
      orderBy: [desc(matches.createdAt)],
      limit: 50,
    });
    return result as MatchWithPlayers[];
  }

  async getUserActiveMatches(userId: string): Promise<MatchWithPlayers[]> {
    const result = await db.query.matches.findMany({
      where: and(
        or(
          eq(matches.player1Id, userId),
          eq(matches.player2Id, userId)
        ),
        or(
          eq(matches.status, "waiting"),
          eq(matches.status, "in-progress")
        )
      ),
      with: {
        player1: { columns: MATCH_PLAYER_COLUMNS },
        player2: { columns: MATCH_PLAYER_COLUMNS },
        winner: { columns: MATCH_PLAYER_COLUMNS },
      },
      orderBy: [desc(matches.createdAt)],
    });
    return result as MatchWithPlayers[];
  }

  async getUserRecentMatches(userId: string, limit = 10): Promise<MatchWithPlayers[]> {
    const result = await db.query.matches.findMany({
      where: and(
        or(
          eq(matches.player1Id, userId),
          eq(matches.player2Id, userId)
        ),
        eq(matches.status, "completed"),
        eq(matches.isPractice, false)
      ),
      with: {
        player1: { columns: MATCH_PLAYER_COLUMNS },
        player2: { columns: MATCH_PLAYER_COLUMNS },
        winner: { columns: MATCH_PLAYER_COLUMNS },
      },
      orderBy: [desc(matches.completedAt)],
      limit,
    });
    return result as MatchWithPlayers[];
  }

  async joinMatch(matchId: string, userId: string, betAmount?: string): Promise<Match> {
    // Everything inside transaction to prevent race conditions
    return await db.transaction(async (tx) => {
      // Lock the match row and re-validate
      const [existingMatch] = await tx
        .select()
        .from(matches)
        .where(eq(matches.id, matchId))
        .for("update");

      if (!existingMatch) {
        throw new Error("Match not found");
      }

      if (existingMatch.status !== "waiting") {
        throw new Error("Match is not available");
      }

      if (existingMatch.player2Id) {
        throw new Error("Match is already full");
      }

      // If match has a pot, player2 must match the bet
      if (existingMatch.potAmount && parseFloat(existingMatch.potAmount) > 0) {
        if (!betAmount) {
          throw new Error("Bet amount required to join this match");
        }

        const player1Bet = parseFloat(existingMatch.potAmount);
        const player2Bet = parseFloat(betAmount);

        if (player2Bet !== player1Bet) {
          throw new Error(`You must bet ${player1Bet} to join this match`);
        }

        // Lock user row and check balance
        const [user] = await tx
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .for("update");

        if (!user) {
          throw new Error("User not found");
        }

        const balance = parseFloat(user.balance || "0");
        if (balance < player2Bet) {
          throw new Error("Insufficient balance");
        }

        // Deduct bet from player2's balance
        const balanceAfter = (balance - player2Bet).toFixed(2);
        await tx
          .update(users)
          .set({ balance: balanceAfter })
          .where(eq(users.id, userId));

        // Update pot amount (double it) and join match with defensive WHERE
        const totalPot = (player1Bet + player2Bet).toFixed(2);
        const [match] = await tx
          .update(matches)
          .set({
            player2Id: userId,
            status: "in-progress",
            startedAt: new Date(),
            potAmount: totalPot,
          })
          .where(and(
            eq(matches.id, matchId),
            eq(matches.status, "waiting"),
            sql`${matches.player2Id} IS NULL`
          ))
          .returning();

        if (!match) {
          throw new Error("Match was already joined by another player");
        }

        // Record transaction
        await tx.insert(transactions).values({
          userId,
          type: "bet_placed",
          amount: `-${player2Bet}`,
          balanceBefore: user.balance!,
          balanceAfter,
          matchId,
          description: `Bet placed for ${existingMatch.gameType} match`,
        });

        return match;
      }

      // No bet required, just join with defensive WHERE
      const [match] = await tx
        .update(matches)
        .set({
          player2Id: userId,
          status: "in-progress",
          startedAt: new Date(),
        })
        .where(and(
          eq(matches.id, matchId),
          eq(matches.status, "waiting"),
          sql`${matches.player2Id} IS NULL`
        ))
        .returning();

      if (!match) {
        throw new Error("Match was already joined by another player");
      }

      return match;
    });
  }

  async updateMatchState(matchId: string, state: any): Promise<Match> {
    const [match] = await db
      .update(matches)
      .set({ gameState: state })
      .where(eq(matches.id, matchId))
      .returning();
    return match;
  }

  async completeMatch(
    matchId: string,
    winnerId: string | null,
    player1Score: number,
    player2Score: number
  ): Promise<Match> {
    // Everything inside transaction to prevent duplicate payouts
    const completedMatch = await db.transaction(async (tx) => {
      // Lock match row and re-validate
      const [existingMatch] = await tx
        .select()
        .from(matches)
        .where(eq(matches.id, matchId))
        .for("update");

      if (!existingMatch) {
        throw new Error("Match not found");
      }

      if (existingMatch.status === "completed") {
        throw new Error("Match already completed");
      }

      // Calculate rake and winnings if there's a pot
      if (winnerId && existingMatch.potAmount && parseFloat(existingMatch.potAmount) > 0) {
        const pot = parseFloat(existingMatch.potAmount);
        const rake = pot * 0.03; // 3% platform rake
        const winnings = pot - rake;
        const rakeAmount = rake.toFixed(2);

        // Lock winner row and get balance
        const [winner] = await tx
          .select()
          .from(users)
          .where(eq(users.id, winnerId))
          .for("update");

        if (!winner) {
          throw new Error("Winner not found");
        }

        // Award winnings to winner
        const balanceAfter = (parseFloat(winner.balance!) + winnings).toFixed(2);
        await tx
          .update(users)
          .set({ balance: balanceAfter })
          .where(eq(users.id, winnerId));

        // Update match with defensive WHERE
        const [match] = await tx
          .update(matches)
          .set({
            status: "completed",
            winnerId,
            player1Score,
            player2Score,
            rakeAmount,
            completedAt: new Date(),
          })
          .where(and(
            eq(matches.id, matchId),
            eq(matches.status, "in-progress")
          ))
          .returning();

        if (!match) {
          throw new Error("Match was already completed");
        }

        // Record transaction
        await tx.insert(transactions).values({
          userId: winnerId,
          type: "bet_won",
          amount: winnings.toFixed(2),
          balanceBefore: winner.balance!,
          balanceAfter,
          matchId,
          description: `Won ${existingMatch.gameType} match`,
        });

        return match;
      }

      // No pot, just complete the match with defensive WHERE
      const [match] = await tx
        .update(matches)
        .set({
          status: "completed",
          winnerId,
          player1Score,
          player2Score,
          rakeAmount: "0.00",
          completedAt: new Date(),
        })
        .where(and(
          eq(matches.id, matchId),
          or(
            eq(matches.status, "in-progress"),
            eq(matches.status, "waiting")
          )
        ))
        .returning();

      if (!match) {
        throw new Error("Match was already completed");
      }

      return match;
    });

    // Award XP post-transaction (non-critical, failures are silently ignored)
    try {
      const XP_WIN = 150, XP_LOSS = 40, XP_DRAW = 75;
      const p1 = completedMatch.player1Id;
      const p2 = completedMatch.player2Id;
      if (p1) {
        const p1xp = !winnerId ? XP_DRAW : (winnerId === p1 ? XP_WIN : XP_LOSS);
        await this.addXP(p1, p1xp);
      }
      if (p2) {
        const p2xp = !winnerId ? XP_DRAW : (winnerId === p2 ? XP_WIN : XP_LOSS);
        await this.addXP(p2, p2xp);
      }
    } catch { /* non-critical */ }

    // Push match result notifications (non-critical)
    try {
      const gameLabel = completedMatch.gameType?.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) ?? "Match";
      const pot = completedMatch.potAmount ? parseFloat(completedMatch.potAmount) : 0;
      const p1 = completedMatch.player1Id;
      const p2 = completedMatch.player2Id;
      if (!winnerId) {
        // Draw
        if (p1) pushNotification(p1, { type: "challenge", title: `${gameLabel} — Draw`, body: "The match ended in a draw. No winnings this time.", linkTo: `/game/${completedMatch.id}` });
        if (p2) pushNotification(p2, { type: "challenge", title: `${gameLabel} — Draw`, body: "The match ended in a draw. No winnings this time.", linkTo: `/game/${completedMatch.id}` });
      } else {
        const loserId = p1 === winnerId ? p2 : p1;
        const winnings = pot > 0 ? (pot * 0.97).toFixed(2) : null;
        pushNotification(winnerId, { type: "deposit", title: `You won the ${gameLabel} match!`, body: winnings ? `+${winnings} Scalps added to your wallet.` : "Victory! Well played.", linkTo: `/game/${completedMatch.id}` });
        if (loserId) pushNotification(loserId, { type: "challenge", title: `${gameLabel} — Defeat`, body: "Better luck next time. Keep playing to improve your rank!", linkTo: `/game/${completedMatch.id}` });
      }
    } catch { /* non-critical */ }

    return completedMatch;
  }

  async completeChessMatch(
    matchId: string,
    winnerId: string | null,
    pgnMoves: string,
    duration: number
  ): Promise<Match> {
    // Everything inside transaction to prevent duplicate payouts
    return await db.transaction(async (tx) => {
      // Lock match row and re-validate
      const [existingMatch] = await tx
        .select()
        .from(matches)
        .where(eq(matches.id, matchId))
        .for("update");

      if (!existingMatch) {
        throw new Error("Match not found");
      }

      if (existingMatch.status === "completed") {
        throw new Error("Match already completed");
      }

      // Calculate rake and winnings if there's a pot
      if (winnerId && existingMatch.potAmount && parseFloat(existingMatch.potAmount) > 0) {
        const pot = parseFloat(existingMatch.potAmount);
        const rake = pot * 0.03; // 3% platform rake
        const winnings = pot - rake;
        const rakeAmount = rake.toFixed(2);

        // Lock winner row and get balance
        const [winner] = await tx
          .select()
          .from(users)
          .where(eq(users.id, winnerId))
          .for("update");

        if (!winner) {
          throw new Error("Winner not found");
        }

        // Award winnings to winner
        const balanceAfter = (parseFloat(winner.balance!) + winnings).toFixed(2);
        await tx
          .update(users)
          .set({ balance: balanceAfter })
          .where(eq(users.id, winnerId));

        // Update match with defensive WHERE and chess-specific fields
        const [match] = await tx
          .update(matches)
          .set({
            status: "completed",
            winnerId,
            pgnMoves,
            duration,
            rakeAmount,
            completedAt: new Date(),
          })
          .where(and(
            eq(matches.id, matchId),
            eq(matches.status, "in-progress")
          ))
          .returning();

        if (!match) {
          throw new Error("Match was already completed");
        }

        // Record transaction
        await tx.insert(transactions).values({
          userId: winnerId,
          type: "bet_won",
          amount: winnings.toFixed(2),
          balanceBefore: winner.balance!,
          balanceAfter,
          matchId,
          description: `Won chess match`,
        });

        return match;
      }

      // No pot, just complete the match with defensive WHERE and chess-specific fields
      const [match] = await tx
        .update(matches)
        .set({
          status: "completed",
          winnerId,
          pgnMoves,
          duration,
          rakeAmount: "0.00",
          completedAt: new Date(),
        })
        .where(and(
          eq(matches.id, matchId),
          or(
            eq(matches.status, "in-progress"),
            eq(matches.status, "waiting")
          )
        ))
        .returning();

      if (!match) {
        throw new Error("Match was already completed");
      }

      return match;
    });
  }

  async completeConnect4Match(
    matchId: string,
    winnerId: string | null,
    moveSequence: string,
    duration: number
  ): Promise<Match> {
    // Everything inside transaction to prevent duplicate payouts
    return await db.transaction(async (tx) => {
      // Lock match row and re-validate
      const [existingMatch] = await tx
        .select()
        .from(matches)
        .where(eq(matches.id, matchId))
        .for("update");

      if (!existingMatch) {
        throw new Error("Match not found");
      }

      if (existingMatch.status === "completed") {
        throw new Error("Match already completed");
      }

      // Calculate rake and winnings if there's a pot
      if (winnerId && existingMatch.potAmount && parseFloat(existingMatch.potAmount) > 0) {
        const pot = parseFloat(existingMatch.potAmount);
        const rake = pot * 0.03; // 3% platform rake
        const winnings = pot - rake;
        const rakeAmount = rake.toFixed(2);

        // Lock winner row and get balance
        const [winner] = await tx
          .select()
          .from(users)
          .where(eq(users.id, winnerId))
          .for("update");

        if (!winner) {
          throw new Error("Winner not found");
        }

        // Award winnings to winner
        const balanceAfter = (parseFloat(winner.balance!) + winnings).toFixed(2);
        await tx
          .update(users)
          .set({ balance: balanceAfter })
          .where(eq(users.id, winnerId));

        // Update match with defensive WHERE and Connect4-specific fields
        const [match] = await tx
          .update(matches)
          .set({
            status: "completed",
            winnerId,
            pgnMoves: moveSequence, // Store move sequence in pgnMoves field
            duration,
            rakeAmount,
            completedAt: new Date(),
          })
          .where(and(
            eq(matches.id, matchId),
            eq(matches.status, "in-progress")
          ))
          .returning();

        if (!match) {
          throw new Error("Match was already completed");
        }

        // Record transaction
        await tx.insert(transactions).values({
          userId: winnerId,
          type: "bet_won",
          amount: winnings.toFixed(2),
          balanceBefore: winner.balance!,
          balanceAfter,
          matchId,
          description: `Won Connect 4 match`,
        });

        return match;
      }

      // No pot, just complete the match with defensive WHERE and Connect4-specific fields
      const [match] = await tx
        .update(matches)
        .set({
          status: "completed",
          winnerId,
          pgnMoves: moveSequence, // Store move sequence in pgnMoves field
          duration,
          rakeAmount: "0.00",
          completedAt: new Date(),
        })
        .where(and(
          eq(matches.id, matchId),
          or(
            eq(matches.status, "in-progress"),
            eq(matches.status, "waiting")
          )
        ))
        .returning();

      if (!match) {
        throw new Error("Match was already completed");
      }

      return match;
    });
  }

  async completeMiniGolfMatch(
    matchId: string,
    winnerId: string | null,
    player1Score: number,
    player2Score: number,
    gameState: any
  ): Promise<Match> {
    // Everything inside transaction to prevent duplicate payouts
    return await db.transaction(async (tx) => {
      // Lock match row and re-validate
      const [existingMatch] = await tx
        .select()
        .from(matches)
        .where(eq(matches.id, matchId))
        .for("update");

      if (!existingMatch) {
        throw new Error("Match not found");
      }

      if (existingMatch.status === "completed") {
        throw new Error("Match already completed");
      }

      // Calculate rake and winnings if there's a pot
      if (winnerId && existingMatch.potAmount && parseFloat(existingMatch.potAmount) > 0) {
        const pot = parseFloat(existingMatch.potAmount);
        const rake = pot * 0.03; // 3% platform rake
        const winnings = pot - rake;
        const rakeAmount = rake.toFixed(2);

        // Lock winner row and get balance
        const [winner] = await tx
          .select()
          .from(users)
          .where(eq(users.id, winnerId))
          .for("update");

        if (!winner) {
          throw new Error("Winner not found");
        }

        // Award winnings to winner
        const balanceAfter = (parseFloat(winner.balance!) + winnings).toFixed(2);
        await tx
          .update(users)
          .set({ balance: balanceAfter })
          .where(eq(users.id, winnerId));

        // Update match with defensive WHERE and mini golf fields
        const [match] = await tx
          .update(matches)
          .set({
            status: "completed",
            winnerId,
            player1Score,
            player2Score,
            gameState,
            rakeAmount,
            completedAt: new Date(),
          })
          .where(and(
            eq(matches.id, matchId),
            eq(matches.status, "in-progress")
          ))
          .returning();

        if (!match) {
          throw new Error("Match was already completed");
        }

        // Record transaction
        await tx.insert(transactions).values({
          userId: winnerId,
          type: "bet_won",
          amount: winnings.toFixed(2),
          balanceBefore: winner.balance!,
          balanceAfter,
          matchId,
          description: `Won Mini Golf match`,
        });

        return match;
      }

      // No pot, just complete the match with defensive WHERE
      const [match] = await tx
        .update(matches)
        .set({
          status: "completed",
          winnerId,
          player1Score,
          player2Score,
          gameState,
          rakeAmount: "0.00",
          completedAt: new Date(),
        })
        .where(and(
          eq(matches.id, matchId),
          or(
            eq(matches.status, "in-progress"),
            eq(matches.status, "waiting")
          )
        ))
        .returning();

      if (!match) {
        throw new Error("Match was already completed");
      }

      return match;
    });
  }

  async forfeitMatch(matchId: string, forfeitedById: string): Promise<Match> {
    // Everything inside transaction to prevent duplicate payouts
    return await db.transaction(async (tx) => {
      // Lock match row and re-validate
      const [existingMatch] = await tx
        .select()
        .from(matches)
        .where(eq(matches.id, matchId))
        .for("update");

      if (!existingMatch) {
        throw new Error("Match not found");
      }

      if (existingMatch.status === "completed" || existingMatch.status === "cancelled") {
        throw new Error("Match already ended");
      }

      // Determine winner (the other player)
      let winnerId: string | null = null;
      if (existingMatch.player1Id === forfeitedById && existingMatch.player2Id) {
        winnerId = existingMatch.player2Id;
      } else if (existingMatch.player2Id === forfeitedById && existingMatch.player1Id) {
        winnerId = existingMatch.player1Id;
      }

      // Calculate rake and winnings if there's a pot
      if (winnerId && existingMatch.potAmount && parseFloat(existingMatch.potAmount) > 0) {
        const pot = parseFloat(existingMatch.potAmount);
        const rake = pot * 0.03; // 3% platform rake
        const winnings = pot - rake;
        const rakeAmount = rake.toFixed(2);

        // Lock winner row and get balance
        const [winner] = await tx
          .select()
          .from(users)
          .where(eq(users.id, winnerId))
          .for("update");

        if (!winner) {
          throw new Error("Winner not found");
        }

        // Award winnings to winner
        const balanceAfter = (parseFloat(winner.balance!) + winnings).toFixed(2);
        await tx
          .update(users)
          .set({ balance: balanceAfter })
          .where(eq(users.id, winnerId));

        // Update match with defensive WHERE
        const [match] = await tx
          .update(matches)
          .set({
            status: "completed",
            winnerId,
            forfeitedById,
            rakeAmount,
            completedAt: new Date(),
          })
          .where(and(
            eq(matches.id, matchId),
            or(
              eq(matches.status, "in-progress"),
              eq(matches.status, "waiting")
            )
          ))
          .returning();

        if (!match) {
          throw new Error("Match was already completed");
        }

        // Record transaction
        await tx.insert(transactions).values({
          userId: winnerId,
          type: "forfeit_gain",
          amount: winnings.toFixed(2),
          balanceBefore: winner.balance!,
          balanceAfter,
          matchId,
          description: `Won ${existingMatch.gameType} match by forfeit`,
        });

        return match;
      }

      // No pot, just forfeit the match with defensive WHERE
      const [match] = await tx
        .update(matches)
        .set({
          status: "completed",
          winnerId,
          forfeitedById,
          rakeAmount: "0.00",
          completedAt: new Date(),
        })
        .where(and(
          eq(matches.id, matchId),
          or(
            eq(matches.status, "in-progress"),
            eq(matches.status, "waiting")
          )
        ))
        .returning();

      if (!match) {
        throw new Error("Match was already completed");
      }

      return match;
    });
  }

  async deleteMatch(matchId: string, userId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Lock match row and validate
      const [existingMatch] = await tx
        .select()
        .from(matches)
        .where(eq(matches.id, matchId))
        .for("update");

      if (!existingMatch) {
        throw new Error("Match not found");
      }

      // Only allow deletion of bot or practice matches
      if (!existingMatch.isBotMatch && !existingMatch.isPractice) {
        throw new Error("Can only delete bot or practice matches");
      }

      // Only allow the player to delete their own matches
      if (existingMatch.player1Id !== userId) {
        throw new Error("You can only delete your own matches");
      }

      // Delete any associated transactions
      await tx
        .delete(transactions)
        .where(eq(transactions.matchId, matchId));

      // Delete the match
      await tx
        .delete(matches)
        .where(eq(matches.id, matchId));
    });
  }

  async cancelMatch(matchId: string, userId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Lock match row and validate
      const [existingMatch] = await tx
        .select()
        .from(matches)
        .where(eq(matches.id, matchId))
        .for("update");

      if (!existingMatch) {
        throw new Error("Match not found");
      }

      // Only allow player1 (creator) to cancel
      if (existingMatch.player1Id !== userId) {
        throw new Error("Only the match creator can cancel this match");
      }

      // Only allow canceling waiting matches
      if (existingMatch.status !== "waiting") {
        throw new Error("Can only cancel matches that are waiting for opponent");
      }

      // If there's a bet, refund it to player1
      if (existingMatch.potAmount && parseFloat(existingMatch.potAmount) > 0) {
        // For waiting matches, potAmount is the bet from player1 only (player2 hasn't joined yet)
        const betAmount = parseFloat(existingMatch.potAmount);

        // Lock player row and get balance
        const [player] = await tx
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .for("update");

        if (!player) {
          throw new Error("Player not found");
        }

        // Refund the bet
        const balanceAfter = (parseFloat(player.balance!) + betAmount).toFixed(2);
        await tx
          .update(users)
          .set({ balance: balanceAfter })
          .where(eq(users.id, userId));

        // Record refund transaction
        await tx.insert(transactions).values({
          userId,
          type: "deposit",
          amount: betAmount.toFixed(2),
          balanceBefore: player.balance!,
          balanceAfter,
          matchId,
          description: `Refund for cancelled ${existingMatch.gameType} match`,
        });
      }

      // Update match status to cancelled
      await tx
        .update(matches)
        .set({
          status: "cancelled",
          completedAt: new Date(),
        })
        .where(eq(matches.id, matchId));
    });
  }

  // Stats and leaderboard
  async getUserStats(userId: string): Promise<UserStats> {
    const allMatches = await db
      .select()
      .from(matches)
      .where(
        and(
          or(
            eq(matches.player1Id, userId),
            eq(matches.player2Id, userId)
          ),
          eq(matches.status, "completed"),
          eq(matches.isPractice, false)
        )
      );

    const totalMatches = allMatches.length;
    const wins = allMatches.filter(m => m.winnerId === userId).length;
    const losses = totalMatches - wins;
    const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

    const gamesPlayed: UserStats["gamesPlayed"] = {};
    allMatches.forEach(match => {
      const gameType = match.gameType as GameType;
      gamesPlayed[gameType] = (gamesPlayed[gameType] || 0) + 1;
    });

    // Calculate total earnings from winnings (bet_won + forfeit_gain)
    const userTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          or(
            eq(transactions.type, "bet_won"),
            eq(transactions.type, "forfeit_gain")
          )
        )
      );

    const totalEarnings = userTransactions.reduce((sum, t) => {
      return sum + parseFloat(t.amount);
    }, 0);

    // Fetch the user's per-game win streaks and compute the max
    const userRow = await db.select({
      chessWinStreak: users.chessWinStreak,
      miniGolfWinStreak: users.miniGolfWinStreak,
      connect4WinStreak: users.connect4WinStreak,
      airHockeyWinStreak: users.airHockeyWinStreak,
      blockBlastWinStreak: users.blockBlastWinStreak,
      rockPaperScissorsWinStreak: users.rockPaperScissorsWinStreak,
      dotsAndBoxesWinStreak: users.dotsAndBoxesWinStreak,
      eightBallWinStreak: users.eightBallWinStreak,
      bowlingWinStreak: users.bowlingWinStreak,
      basketballWinStreak: users.basketballWinStreak,
      footballWinStreak: users.footballWinStreak,
      racingWinStreak: users.racingWinStreak,
    }).from(users).where(eq(users.id, userId)).limit(1);
    const streakRow = userRow[0];
    const currentStreak = streakRow
      ? Math.max(0, streakRow.chessWinStreak ?? 0, streakRow.miniGolfWinStreak ?? 0,
          streakRow.connect4WinStreak ?? 0, streakRow.airHockeyWinStreak ?? 0,
          streakRow.blockBlastWinStreak ?? 0, streakRow.rockPaperScissorsWinStreak ?? 0,
          streakRow.dotsAndBoxesWinStreak ?? 0, streakRow.eightBallWinStreak ?? 0,
          streakRow.bowlingWinStreak ?? 0, streakRow.basketballWinStreak ?? 0,
          streakRow.footballWinStreak ?? 0, streakRow.racingWinStreak ?? 0)
      : 0;

    return {
      totalMatches,
      wins,
      losses,
      winRate,
      totalEarnings,
      currentStreak,
      gamesPlayed,
    };
  }

  async getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
    const completedMatches = await db.query.matches.findMany({
      where: and(
        eq(matches.status, "completed"),
        eq(matches.isPractice, false)
      ),
      with: {
        player1: { columns: LEADERBOARD_PLAYER_COLUMNS },
        player2: { columns: LEADERBOARD_PLAYER_COLUMNS },
        winner: { columns: LEADERBOARD_PLAYER_COLUMNS },
      },
    });

    // Aggregate stats by user
    const userStatsMap = new Map<string, {
      user: any;
      totalMatches: number;
      wins: number;
      losses: number;
    }>();

    completedMatches.forEach(match => {
      // Player 1
      if (match.player1) {
        const stats = userStatsMap.get(match.player1.id) || {
          user: match.player1,
          totalMatches: 0,
          wins: 0,
          losses: 0,
        };
        stats.totalMatches++;
        if (match.winnerId === match.player1.id) {
          stats.wins++;
        } else if (match.winnerId) {
          stats.losses++;
        }
        userStatsMap.set(match.player1.id, stats);
      }

      // Player 2
      if (match.player2) {
        const stats = userStatsMap.get(match.player2.id) || {
          user: match.player2,
          totalMatches: 0,
          wins: 0,
          losses: 0,
        };
        stats.totalMatches++;
        if (match.winnerId === match.player2.id) {
          stats.wins++;
        } else if (match.winnerId) {
          stats.losses++;
        }
        userStatsMap.set(match.player2.id, stats);
      }
    });

    // Convert to leaderboard entries and sort
    const entries: LeaderboardEntry[] = Array.from(userStatsMap.values())
      .map(stats => {
        const u = stats.user as any;
        const ratings = [
          u.chessRating, u.miniGolfRating, u.connect4Rating, u.airHockeyRating,
          u.blockBlastRating, u.rockPaperScissorsRating, u.dotsAndBoxesRating,
          u.eightBallRating, u.bowlingRating, u.cupKingRating, u.stackTowerRating,
          u.basketballRating, u.footballRating, u.racingRating,
        ].filter(Boolean) as number[];
        const overallRating = ratings.length > 0 ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length) : 1200;
        return {
          userId: stats.user.id,
          userName: stats.user.firstName || stats.user.email?.split('@')[0] || "Unknown",
          profileImageUrl: stats.user.profileImageUrl,
          totalMatches: stats.totalMatches,
          wins: stats.wins,
          losses: stats.losses,
          winRate: stats.totalMatches > 0 ? Math.round((stats.wins / stats.totalMatches) * 100) : 0,
          overallRating,
        };
      })
      .sort((a, b) => {
        // Sort by wins first, then by win rate
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.winRate - a.winRate;
      })
      .slice(0, limit);

    return entries;
  }

  async getGameLeaderboard(gameType: GameType, limit = 50, since?: Date): Promise<LeaderboardEntry[]> {
    const completedMatches = await db.query.matches.findMany({
      where: and(
        eq(matches.gameType, gameType),
        eq(matches.status, "completed"),
        eq(matches.isPractice, false),
        since ? sql`${matches.createdAt} >= ${since}` : undefined
      ),
      with: {
        player1: { columns: LEADERBOARD_PLAYER_COLUMNS },
        player2: { columns: LEADERBOARD_PLAYER_COLUMNS },
        winner: { columns: LEADERBOARD_PLAYER_COLUMNS },
      },
    });

    // Aggregate stats by user for this specific game
    const userStatsMap = new Map<string, {
      user: any;
      totalMatches: number;
      wins: number;
      losses: number;
    }>();

    completedMatches.forEach(match => {
      // Player 1
      if (match.player1) {
        const stats = userStatsMap.get(match.player1.id) || {
          user: match.player1,
          totalMatches: 0,
          wins: 0,
          losses: 0,
        };
        stats.totalMatches++;
        if (match.winnerId === match.player1.id) {
          stats.wins++;
        } else if (match.winnerId) {
          stats.losses++;
        }
        userStatsMap.set(match.player1.id, stats);
      }

      // Player 2
      if (match.player2) {
        const stats = userStatsMap.get(match.player2.id) || {
          user: match.player2,
          totalMatches: 0,
          wins: 0,
          losses: 0,
        };
        stats.totalMatches++;
        if (match.winnerId === match.player2.id) {
          stats.wins++;
        } else if (match.winnerId) {
          stats.losses++;
        }
        userStatsMap.set(match.player2.id, stats);
      }
    });

    // Convert to leaderboard entries and sort by win rate
    const entries: LeaderboardEntry[] = Array.from(userStatsMap.values())
      .filter(stats => stats.totalMatches >= 3) // Minimum 3 games to appear on leaderboard
      .map(stats => {
        const u = stats.user as any;
        const ratings = [
          u.chessRating, u.miniGolfRating, u.connect4Rating, u.airHockeyRating,
          u.blockBlastRating, u.rockPaperScissorsRating, u.dotsAndBoxesRating,
          u.eightBallRating, u.bowlingRating, u.cupKingRating, u.stackTowerRating,
          u.basketballRating, u.footballRating, u.racingRating,
        ].filter(Boolean) as number[];
        const overallRating = ratings.length > 0 ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length) : 1200;
        return {
          userId: stats.user.id,
          userName: stats.user.firstName || stats.user.email?.split('@')[0] || "Unknown",
          profileImageUrl: stats.user.profileImageUrl,
          totalMatches: stats.totalMatches,
          wins: stats.wins,
          losses: stats.losses,
          winRate: stats.totalMatches > 0 ? Math.round((stats.wins / stats.totalMatches) * 100) : 0,
          overallRating,
        };
      })
      .sort((a, b) => {
        // Sort by win rate first, then by total wins
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return b.wins - a.wins;
      })
      .slice(0, limit);

    return entries;
  }

  async getMoneyLeaderboard(limit = 50): Promise<Array<{ userId: string; username: string; totalWinnings: string }>> {
    // Query all winning transactions
    const winningTransactions = await db
      .select({
        userId: transactions.userId,
        amount: transactions.amount,
      })
      .from(transactions)
      .where(eq(transactions.type, "win"));

    // Aggregate winnings by user
    const userWinningsMap = new Map<string, number>();
    
    winningTransactions.forEach(tx => {
      const amount = parseFloat(tx.amount);
      const currentWinnings = userWinningsMap.get(tx.userId) || 0;
      userWinningsMap.set(tx.userId, currentWinnings + amount);
    });

    // Get user details and sort by winnings
    const leaderboard = await Promise.all(
      Array.from(userWinningsMap.entries()).map(async ([userId, totalWinnings]) => {
        const user = await this.getUser(userId);
        return {
          userId,
          username: user?.firstName || user?.email?.split('@')[0] || "Unknown",
          totalWinnings: totalWinnings.toFixed(2),
        };
      })
    );

    return leaderboard
      .sort((a, b) => parseFloat(b.totalWinnings) - parseFloat(a.totalWinnings))
      .slice(0, limit);
  }

  // Chat operations
  async createChatMessage(messageData: InsertChatMessage): Promise<ChatMessage> {
    const [message] = await db
      .insert(chatMessages)
      .values(messageData)
      .returning();
    return message;
  }

  async getChatMessages(channel: string, matchId?: string, limit = 100): Promise<Array<ChatMessage & { user: User | null }>> {
    const conditions = matchId 
      ? and(eq(chatMessages.channel, channel), eq(chatMessages.matchId, matchId))
      : eq(chatMessages.channel, channel);

    const messages = await db
      .select({
        id: chatMessages.id,
        userId: chatMessages.userId,
        matchId: chatMessages.matchId,
        channel: chatMessages.channel,
        message: chatMessages.message,
        createdAt: chatMessages.createdAt,
        user: users,
      })
      .from(chatMessages)
      .leftJoin(users, eq(chatMessages.userId, users.id))
      .where(conditions)
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    return messages.map(row => ({
      id: row.id,
      userId: row.userId,
      matchId: row.matchId,
      channel: row.channel,
      message: row.message,
      createdAt: row.createdAt,
      user: row.user,
    }));
  }

  // Direct message operations
  async createDirectMessage(messageData: InsertDirectMessage): Promise<DirectMessage> {
    const [message] = await db
      .insert(directMessages)
      .values(messageData)
      .returning();
    return message;
  }

  async getDirectMessages(userId1: string, userId2: string, limit = 100): Promise<DirectMessageWithUser[]> {
    const messages = await db
      .select({
        id: directMessages.id,
        senderId: directMessages.senderId,
        recipientId: directMessages.recipientId,
        message: directMessages.message,
        isRead: directMessages.isRead,
        createdAt: directMessages.createdAt,
        sender: {
          id: users.id,
          email: users.email,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(directMessages)
      .leftJoin(users, eq(directMessages.senderId, users.id))
      .where(
        or(
          and(eq(directMessages.senderId, userId1), eq(directMessages.recipientId, userId2)),
          and(eq(directMessages.senderId, userId2), eq(directMessages.recipientId, userId1))
        )
      )
      .orderBy(desc(directMessages.createdAt))
      .limit(limit);

    // Get recipient info for each message
    const messagesWithBothUsers = await Promise.all(
      messages.map(async (msg) => {
        const recipient = await this.getUser(msg.recipientId);
        return {
          id: msg.id,
          senderId: msg.senderId,
          recipientId: msg.recipientId,
          message: msg.message,
          isRead: msg.isRead,
          createdAt: msg.createdAt,
          sender: msg.sender as User,
          recipient: recipient as User,
        };
      })
    );

    return messagesWithBothUsers;
  }

  async getDirectMessageConversations(userId: string): Promise<Array<{ friend: User; lastMessage: DirectMessageWithUser; unreadCount: number }>> {
    // Get all friends
    const friends = await this.getUserFriends(userId);
    
    // For each friend, get the last message and unread count
    const conversations = await Promise.all(
      friends.map(async (friendship) => {
        const friendUser = friendship.requesterId === userId ? friendship.addressee : friendship.requester;
        
        // Get last message between users
        const messages = await this.getDirectMessages(userId, friendUser.id, 1);
        const lastMessage = messages[0];
        
        if (!lastMessage) {
          return null;
        }
        
        // Count unread messages from this friend
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(directMessages)
          .where(
            and(
              eq(directMessages.senderId, friendUser.id),
              eq(directMessages.recipientId, userId),
              eq(directMessages.isRead, false)
            )
          );
        
        return {
          friend: friendUser,
          lastMessage,
          unreadCount: count || 0,
        };
      })
    );
    
    // Filter out null values and sort by last message time
    return conversations
      .filter((conv): conv is { friend: User; lastMessage: DirectMessageWithUser; unreadCount: number } => conv !== null)
      .sort((a, b) => {
        const timeA = a.lastMessage.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
        const timeB = b.lastMessage.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
        return timeB - timeA;
      });
  }

  async markDirectMessagesAsRead(userId: string, friendId: string): Promise<void> {
    await db
      .update(directMessages)
      .set({ isRead: true })
      .where(
        and(
          eq(directMessages.senderId, friendId),
          eq(directMessages.recipientId, userId),
          eq(directMessages.isRead, false)
        )
      );
  }

  async getUnreadDirectMessageCount(userId: string): Promise<number> {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(directMessages)
      .where(
        and(
          eq(directMessages.recipientId, userId),
          eq(directMessages.isRead, false)
        )
      );
    
    return count || 0;
  }

  // Achievement and XP operations
  async addXP(userId: string, amount: number): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    const newXP = (user.xp || 0) + amount;
    // Auto-compute level from XP table
    const XP_LEVELS: Record<number, number> = {
      1: 0, 2: 100, 3: 250, 4: 450, 5: 700, 6: 1000, 7: 1350, 8: 1750, 9: 2200, 10: 2700,
      11: 3250, 12: 3850, 13: 4500, 14: 5200, 15: 5950, 16: 6750, 17: 7600, 18: 8500, 19: 9450, 20: 10450,
      21: 11500, 22: 12600, 23: 13750, 24: 14950, 25: 16200, 30: 22000, 35: 29000, 40: 37500,
      45: 47500, 50: 59000, 60: 85000, 70: 115000, 80: 150000, 90: 190000, 100: 250000,
    };
    const sortedLevels = Object.entries(XP_LEVELS)
      .map(([level, requiredXP]) => ({ level: parseInt(level), requiredXP }))
      .sort((a, b) => b.requiredXP - a.requiredXP);
    let newLevel = 1;
    for (const { level, requiredXP } of sortedLevels) {
      if (newXP >= requiredXP) { newLevel = level; break; }
    }

    const [updatedUser] = await db
      .update(users)
      .set({ xp: newXP, level: newLevel })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async addBattlePassXP(userId: string, amount: number): Promise<void> {
    const [season] = await db.select().from(battlePassSeasons).where(eq(battlePassSeasons.isActive, true)).limit(1);
    if (!season) return;
    const [progress] = await db.select().from(userBattlePassProgress)
      .where(and(eq(userBattlePassProgress.userId, userId), eq(userBattlePassProgress.seasonId, season.id)));
    if (!progress) {
      await db.insert(userBattlePassProgress).values({ userId, seasonId: season.id, currentXp: amount, claimedTiers: [], hasPremium: false });
    } else {
      await db.update(userBattlePassProgress)
        .set({ currentXp: (progress.currentXp || 0) + amount })
        .where(eq(userBattlePassProgress.id, progress.id));
    }
  }

  getStreakXPMultiplier(loginStreak: number): number {
    if (loginStreak <= 0) return 1;
    const day = Math.min(loginStreak, 7);
    return 1 + day * 0.1;
  }

  async getChallengeClaims(userId: string): Promise<ChallengeClaim[]> {
    return await db.select().from(challengeClaims).where(eq(challengeClaims.userId, userId));
  }

  async hasClaimedChallenge(userId: string, challengeId: string): Promise<boolean> {
    const [claim] = await db.select().from(challengeClaims)
      .where(and(eq(challengeClaims.userId, userId), eq(challengeClaims.challengeId, challengeId)))
      .limit(1);
    return !!claim;
  }

  async createChallengeClaim(userId: string, challengeId: string, xpAwarded: number): Promise<ChallengeClaim> {
    const [claim] = await db.insert(challengeClaims).values({ userId, challengeId, xpAwarded }).returning();
    await this.addXP(userId, xpAwarded);
    return claim;
  }

  async updateUserLevel(userId: string, newLevel: number): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ level: newLevel })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getAllAchievements(): Promise<Achievement[]> {
    return await db.select().from(achievements).orderBy(achievements.category, achievements.rarity);
  }

  async getUserAchievements(userId: string): Promise<Array<UserAchievement & { achievement: Achievement }>> {
    const results = await db
      .select({
        id: userAchievements.id,
        userId: userAchievements.userId,
        achievementId: userAchievements.achievementId,
        matchId: userAchievements.matchId,
        progress: userAchievements.progress,
        completedAt: userAchievements.completedAt,
        createdAt: userAchievements.createdAt,
        achievement: achievements,
      })
      .from(userAchievements)
      .leftJoin(achievements, eq(userAchievements.achievementId, achievements.id))
      .where(eq(userAchievements.userId, userId))
      .orderBy(desc(userAchievements.completedAt));

    return results.map(row => ({
      id: row.id,
      userId: row.userId,
      achievementId: row.achievementId,
      matchId: row.matchId,
      progress: row.progress,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      achievement: row.achievement!,
    }));
  }

  async awardAchievement(userId: string, achievementId: string, matchId?: string): Promise<UserAchievement | null> {
    // Check if user already has this achievement
    const hasIt = await this.hasAchievement(userId, achievementId);
    if (hasIt) {
      return null;
    }

    // Get achievement details for XP reward
    const [achievement] = await db
      .select()
      .from(achievements)
      .where(eq(achievements.id, achievementId))
      .limit(1);

    if (!achievement) {
      throw new Error("Achievement not found");
    }

    // Award the achievement
    const [userAchievement] = await db
      .insert(userAchievements)
      .values({
        userId,
        achievementId,
        matchId,
        completedAt: new Date(),
        progress: 100,
      })
      .returning();

    // Award XP
    if (achievement.xpReward > 0) {
      await this.addXP(userId, achievement.xpReward);
    }

    return userAchievement;
  }

  async hasAchievement(userId: string, achievementId: string): Promise<boolean> {
    const [result] = await db
      .select()
      .from(userAchievements)
      .where(
        and(
          eq(userAchievements.userId, userId),
          eq(userAchievements.achievementId, achievementId)
        )
      )
      .limit(1);

    return !!result;
  }

  // Friend operations
  async sendFriendRequest(requesterId: string, addresseeId: string): Promise<Friendship> {
    // Check if friendship already exists
    const existing = await this.checkFriendship(requesterId, addresseeId);
    if (existing) {
      throw new Error("Friendship request already exists");
    }

    // Check if users are trying to friend themselves
    if (requesterId === addresseeId) {
      throw new Error("Cannot send friend request to yourself");
    }

    const [friendship] = await db
      .insert(friendships)
      .values({
        requesterId,
        addresseeId,
        status: "pending",
      })
      .returning();

    return friendship;
  }

  async acceptFriendRequest(friendshipId: string, userId: string): Promise<Friendship> {
    const [friendship] = await db
      .select()
      .from(friendships)
      .where(eq(friendships.id, friendshipId))
      .limit(1);

    if (!friendship) {
      throw new Error("Friend request not found");
    }

    // Only the addressee can accept
    if (friendship.addresseeId !== userId) {
      throw new Error("Not authorized to accept this request");
    }

    if (friendship.status !== "pending") {
      throw new Error("Friend request is not pending");
    }

    const [updated] = await db
      .update(friendships)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(eq(friendships.id, friendshipId))
      .returning();

    return updated;
  }

  async declineFriendRequest(friendshipId: string, userId: string): Promise<void> {
    const [friendship] = await db
      .select()
      .from(friendships)
      .where(eq(friendships.id, friendshipId))
      .limit(1);

    if (!friendship) {
      throw new Error("Friend request not found");
    }

    // Only the addressee can decline
    if (friendship.addresseeId !== userId) {
      throw new Error("Not authorized to decline this request");
    }

    await db
      .update(friendships)
      .set({ status: "declined", updatedAt: new Date() })
      .where(eq(friendships.id, friendshipId));
  }

  async removeFriend(friendshipId: string, userId: string): Promise<void> {
    const [friendship] = await db
      .select()
      .from(friendships)
      .where(eq(friendships.id, friendshipId))
      .limit(1);

    if (!friendship) {
      throw new Error("Friendship not found");
    }

    // Either party can remove the friendship
    if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
      throw new Error("Not authorized to remove this friendship");
    }

    await db.delete(friendships).where(eq(friendships.id, friendshipId));
  }

  async getUserFriends(userId: string): Promise<FriendshipWithUsers[]> {
    const results = await db
      .select()
      .from(friendships)
      .leftJoin(users, or(
        eq(friendships.requesterId, users.id),
        eq(friendships.addresseeId, users.id)
      ))
      .where(
        and(
          or(
            eq(friendships.requesterId, userId),
            eq(friendships.addresseeId, userId)
          ),
          eq(friendships.status, "accepted")
        )
      )
      .orderBy(desc(friendships.createdAt));

    // Transform results to include both users
    const friendsWithUsers: FriendshipWithUsers[] = [];
    for (const result of results) {
      const friendship = result.friendships;
      
      // Get both users
      const [requester] = await db
        .select()
        .from(users)
        .where(eq(users.id, friendship.requesterId))
        .limit(1);
      
      const [addressee] = await db
        .select()
        .from(users)
        .where(eq(users.id, friendship.addresseeId))
        .limit(1);

      if (requester && addressee) {
        friendsWithUsers.push({
          ...friendship,
          requester,
          addressee,
        });
      }
    }

    return friendsWithUsers;
  }

  async getPendingFriendRequests(userId: string): Promise<FriendshipWithUsers[]> {
    const results = await db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.addresseeId, userId),
          eq(friendships.status, "pending")
        )
      )
      .orderBy(desc(friendships.createdAt));

    const requestsWithUsers: FriendshipWithUsers[] = [];
    for (const friendship of results) {
      const [requester] = await db
        .select()
        .from(users)
        .where(eq(users.id, friendship.requesterId))
        .limit(1);
      
      const [addressee] = await db
        .select()
        .from(users)
        .where(eq(users.id, friendship.addresseeId))
        .limit(1);

      if (requester && addressee) {
        requestsWithUsers.push({
          ...friendship,
          requester,
          addressee,
        });
      }
    }

    return requestsWithUsers;
  }

  async checkFriendship(userId1: string, userId2: string): Promise<Friendship | undefined> {
    const [friendship] = await db
      .select()
      .from(friendships)
      .where(
        or(
          and(
            eq(friendships.requesterId, userId1),
            eq(friendships.addresseeId, userId2)
          ),
          and(
            eq(friendships.requesterId, userId2),
            eq(friendships.addresseeId, userId1)
          )
        )
      )
      .limit(1);

    return friendship;
  }

  async searchUsers(query: string, currentUserId: string, limit: number = 20): Promise<User[]> {
    const results = await db
      .select()
      .from(users)
      .where(
        and(
          or(
            sql`${users.email} ILIKE ${'%' + query + '%'}`,
            sql`${users.firstName} ILIKE ${'%' + query + '%'}`,
            sql`${users.lastName} ILIKE ${'%' + query + '%'}`
          ),
          sql`${users.id} != ${currentUserId}`,
          eq(users.isBot, false),
          eq(users.isBanned, false)
        )
      )
      .limit(limit);

    return results;
  }

  // Challenge invite operations
  async createChallengeInvite(invite: InsertChallengeInvite): Promise<ChallengeInvite> {
    // Verify users are friends
    const friendship = await this.checkFriendship(invite.challengerId, invite.challengedId);
    if (!friendship || friendship.status !== "accepted") {
      throw new Error("Can only challenge friends");
    }

    // Set expiration to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const [challengeInvite] = await db
      .insert(challengeInvites)
      .values({
        ...invite,
        expiresAt,
      })
      .returning();

    return challengeInvite;
  }

  async acceptChallengeInvite(inviteId: string, userId: string, deviceType?: string): Promise<{ invite: ChallengeInvite; match: Match }> {
    const [invite] = await db
      .select()
      .from(challengeInvites)
      .where(eq(challengeInvites.id, inviteId))
      .limit(1);

    if (!invite) {
      throw new Error("Challenge invite not found");
    }

    // Only the challenged user can accept
    if (invite.challengedId !== userId) {
      throw new Error("Not authorized to accept this invite");
    }

    if (invite.status !== "pending") {
      throw new Error("Challenge invite is not pending");
    }

    if (new Date() > invite.expiresAt) {
      throw new Error("Challenge invite has expired");
    }

    const inviteDeviceType = invite.deviceType ?? "desktop";
    const acceptorDeviceType = deviceType ?? "desktop";
    if (inviteDeviceType !== acceptorDeviceType) {
      const label = inviteDeviceType === "mobile" ? "mobile" : "desktop";
      throw new Error(`This challenge is for ${label} players only. You cannot accept from a different device type.`);
    }

    // Create the match
    const match = await this.createMatchWithBet({
      gameType: invite.gameType,
      player1Id: invite.challengerId,
      player2Id: invite.challengedId,
      status: "in-progress",
      isPractice: false,
      isBotMatch: false,
    }, invite.betAmount.toString());

    // Update invite status
    const [updatedInvite] = await db
      .update(challengeInvites)
      .set({ status: "accepted", matchId: match.id })
      .where(eq(challengeInvites.id, inviteId))
      .returning();

    return { invite: updatedInvite, match };
  }

  async declineChallengeInvite(inviteId: string, userId: string): Promise<void> {
    const [invite] = await db
      .select()
      .from(challengeInvites)
      .where(eq(challengeInvites.id, inviteId))
      .limit(1);

    if (!invite) {
      throw new Error("Challenge invite not found");
    }

    // Only the challenged user can decline
    if (invite.challengedId !== userId) {
      throw new Error("Not authorized to decline this invite");
    }

    await db
      .update(challengeInvites)
      .set({ status: "declined" })
      .where(eq(challengeInvites.id, inviteId));
  }

  async getPendingChallengeInvites(userId: string): Promise<ChallengeInviteWithUsers[]> {
    const results = await db
      .select()
      .from(challengeInvites)
      .where(
        and(
          eq(challengeInvites.challengedId, userId),
          eq(challengeInvites.status, "pending"),
          sql`${challengeInvites.expiresAt} > NOW()`
        )
      )
      .orderBy(desc(challengeInvites.createdAt));

    const invitesWithUsers: ChallengeInviteWithUsers[] = [];
    for (const invite of results) {
      const [challenger] = await db
        .select()
        .from(users)
        .where(eq(users.id, invite.challengerId))
        .limit(1);
      
      const [challenged] = await db
        .select()
        .from(users)
        .where(eq(users.id, invite.challengedId))
        .limit(1);

      if (challenger && challenged) {
        invitesWithUsers.push({
          ...invite,
          challenger,
          challenged,
        });
      }
    }

    return invitesWithUsers;
  }

  async cleanupExpiredInvites(): Promise<void> {
    await db
      .update(challengeInvites)
      .set({ status: "expired" })
      .where(
        and(
          eq(challengeInvites.status, "pending"),
          sql`${challengeInvites.expiresAt} < NOW()`
        )
      );
  }

  // Favorite games operations
  async getFavoriteGames(userId: string): Promise<FavoriteGame[]> {
    const favorites = await db
      .select()
      .from(favoriteGames)
      .where(eq(favoriteGames.userId, userId))
      .orderBy(favoriteGames.createdAt);
    
    return favorites;
  }

  async addFavoriteGame(userId: string, gameType: string): Promise<FavoriteGame> {
    // Check if already favorited
    const existing = await db
      .select()
      .from(favoriteGames)
      .where(
        and(
          eq(favoriteGames.userId, userId),
          eq(favoriteGames.gameType, gameType)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      return existing[0];
    }

    const [favorite] = await db
      .insert(favoriteGames)
      .values({
        userId,
        gameType,
      })
      .returning();
    
    return favorite;
  }

  async removeFavoriteGame(userId: string, gameType: string): Promise<void> {
    await db
      .delete(favoriteGames)
      .where(
        and(
          eq(favoriteGames.userId, userId),
          eq(favoriteGames.gameType, gameType)
        )
      );
  }

  async isFavoriteGame(userId: string, gameType: string): Promise<boolean> {
    const [favorite] = await db
      .select()
      .from(favoriteGames)
      .where(
        and(
          eq(favoriteGames.userId, userId),
          eq(favoriteGames.gameType, gameType)
        )
      )
      .limit(1);
    
    return !!favorite;
  }

  // Global stats operations
  async getGlobalStats(): Promise<{
    totalMatches: number;
    totalWinnings: string;
    liveGamesCount: number;
  }> {
    // Total completed matches (excluding practice)
    const [matchStats] = await db
      .select({
        total: sql<number>`COUNT(*)`,
      })
      .from(matches)
      .where(
        and(
          eq(matches.status, "completed"),
          eq(matches.isPractice, false)
        )
      );

    // Total winnings paid out (sum of all win transactions)
    const [winningsStats] = await db
      .select({
        total: sql<string>`COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(eq(transactions.type, "win"));

    // Live games count (in-progress matches)
    const [liveGames] = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(matches)
      .where(eq(matches.status, "in-progress"));

    return {
      totalMatches: matchStats?.total || 0,
      totalWinnings: winningsStats?.total || "0",
      liveGamesCount: liveGames?.count || 0,
    };
  }

  async getFairPlayLog(limit: number = 50, offset: number = 0): Promise<Array<MatchWithPlayers & { verificationHash: string }>> {
    // Get completed matches with player details
    const completedMatches = await db
      .select()
      .from(matches)
      .where(
        and(
          eq(matches.status, "completed"),
          eq(matches.isPractice, false)
        )
      )
      .orderBy(desc(matches.completedAt))
      .limit(limit)
      .offset(offset);

    const matchesWithPlayers: Array<MatchWithPlayers & { verificationHash: string }> = [];

    for (const match of completedMatches) {
      const player1 = match.player1Id ? await this.getUser(match.player1Id) : null;
      const player2 = match.player2Id ? await this.getUser(match.player2Id) : null;
      const winner = match.winnerId ? await this.getUser(match.winnerId) : null;

      // Create cryptographic verification hash from match data
      // This proves the result is server-verified and deterministic (cannot be forged)
      const verificationData = `${match.id}:${match.gameType}:${match.winnerId}:${match.player1Score}:${match.player2Score}:${match.completedAt?.toISOString()}`;
      const verificationHash = crypto
        .createHash('sha256')
        .update(verificationData)
        .digest('hex')
        .slice(0, 16); // Take first 16 chars of SHA-256 hash for display

      matchesWithPlayers.push({
        ...match,
        player1: player1 || null,
        player2: player2 || null,
        winner: winner || null,
        verificationHash,
      });
    }

    return matchesWithPlayers;
  }

  // Match statistics operations
  async saveMatchStatistics(matchId: string, userId: string, stats: {
    goals?: number;
    shots?: number;
    saves?: number;
    hitSpeedPeak?: number;
    possessionSeconds?: number;
    possessionPercent?: string;
    ratingBefore: number;
    ratingAfter: number;
    ratingChange: number;
  }): Promise<void> {
    const { matchStatistics } = await import("@shared/schema");
    
    await db.insert(matchStatistics).values({
      matchId,
      userId,
      goals: stats.goals,
      shots: stats.shots,
      saves: stats.saves,
      hitSpeedPeak: stats.hitSpeedPeak,
      possessionSeconds: stats.possessionSeconds,
      possessionPercent: stats.possessionPercent,
      ratingBefore: stats.ratingBefore,
      ratingAfter: stats.ratingAfter,
      ratingChange: stats.ratingChange,
    });
  }

  async getMatchStatistics(matchId: string): Promise<Array<any>> {
    const { matchStatistics } = await import("@shared/schema");
    
    const stats = await db
      .select()
      .from(matchStatistics)
      .where(eq(matchStatistics.matchId, matchId));
    
    return stats;
  }

  async getUserMatchStatistics(userId: string, gameType?: GameType, limit: number = 50): Promise<Array<any>> {
    const { matchStatistics } = await import("@shared/schema");
    
    let query = db
      .select()
      .from(matchStatistics)
      .where(eq(matchStatistics.userId, userId))
      .orderBy(desc(matchStatistics.createdAt))
      .limit(limit);
    
    return await query;
  }

  // ELO/Rating operations
  async updatePlayerRating(userId: string, gameType: GameType, newRating: number, ratingChange: number, matchId?: string | null): Promise<User> {
    const prefix = gameTypeToFieldPrefix(gameType);
    const ratingField = `${prefix}Rating` as keyof User;

    // Fetch the previous rating so we can detect rank transitions.
    const [prev] = await db.select().from(users).where(eq(users.id, userId));
    const oldRating = (prev?.[ratingField] as number) ?? 1200;

    const [updatedUser] = await db
      .update(users)
      .set({ [ratingField]: newRating })
      .where(eq(users.id, userId))
      .returning();

    // Fire-and-forget rank progression hook (non-critical; failures don't roll back rating).
    if (oldRating !== newRating) {
      try {
        const { processRatingChange } = await import("./rankProgression");
        await processRatingChange(userId, gameType, oldRating, newRating, matchId ?? null);
      } catch (err) {
        console.error("[RANK] processRatingChange failed:", err);
      }
    }

    return updatedUser;
  }

  async updatePlacementMatches(userId: string, gameType: GameType): Promise<User> {
    const prefix = gameTypeToFieldPrefix(gameType);
    const placementField = `${prefix}PlacementMatches` as keyof User;
    
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");
    
    const currentPlacement = (user[placementField] as number) || 0;
    
    // Cap placement matches at 10
    const newPlacement = Math.min(currentPlacement + 1, 10);
    
    const [updatedUser] = await db
      .update(users)
      .set({ [placementField]: newPlacement })
      .where(eq(users.id, userId))
      .returning();
    
    return updatedUser;
  }

  async updateRatedGamesPlayed(userId: string, gameType: GameType): Promise<User> {
    const prefix = gameTypeToFieldPrefix(gameType);
    const ratedGamesField = `${prefix}RatedGamesPlayed` as keyof User;
    
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");
    
    const currentGames = (user[ratedGamesField] as number) || 0;
    
    const [updatedUser] = await db
      .update(users)
      .set({ [ratedGamesField]: currentGames + 1 })
      .where(eq(users.id, userId))
      .returning();
    
    return updatedUser;
  }

  async updateWinStreak(userId: string, gameType: GameType, isWin: boolean): Promise<User> {
    const prefix = gameTypeToFieldPrefix(gameType);
    const streakField = `${prefix}WinStreak` as keyof User;
    const longestStreakField = `${prefix}LongestWinStreak` as keyof User;
    
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");
    
    const currentStreak = (user[streakField] as number) || 0;
    const longestStreak = (user[longestStreakField] as number) || 0;
    
    let newStreak = isWin ? currentStreak + 1 : 0;
    let newLongestStreak = longestStreak;
    
    if (newStreak > longestStreak) {
      newLongestStreak = newStreak;
    }
    
    const [updatedUser] = await db
      .update(users)
      .set({
        [streakField]: newStreak,
        [longestStreakField]: newLongestStreak,
      })
      .where(eq(users.id, userId))
      .returning();
    
    return updatedUser;
  }

  async getRatingLeaderboard(gameType: GameType, limit: number = 50): Promise<Array<{
    userId: string;
    userName: string;
    profileImageUrl: string | null;
    rating: number;
    totalMatches: number;
    wins: number;
    winRate: number;
    winStreak: number;
  }>> {
    // Determine rating and placement match fields based on game type
    const prefix = gameTypeToFieldPrefix(gameType);
    const ratingField = `${prefix}Rating`;
    const placementField = `${prefix}PlacementMatches`;
    const streakField = `${prefix}WinStreak`;
    
    // Get all users who have completed placement matches
    const allUsers = await db
      .select()
      .from(users)
      .where(sql`${users[placementField as keyof typeof users]} >= 10`);
    
    // Get match stats for each user
    const userStats = await Promise.all(
      allUsers.map(async (user) => {
        const userMatches = await db
          .select()
          .from(matches)
          .where(
            and(
              eq(matches.gameType, gameType),
              eq(matches.status, "completed"),
              eq(matches.isPractice, false),
              or(
                eq(matches.player1Id, user.id),
                eq(matches.player2Id, user.id)
              )
            )
          );
        
        const totalMatches = userMatches.length;
        const wins = userMatches.filter(m => m.winnerId === user.id).length;
        const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
        
        return {
          userId: user.id,
          userName: user.username || user.firstName || user.email?.split('@')[0] || "Unknown",
          profileImageUrl: user.profileImageUrl,
          rating: user[ratingField as keyof typeof user] as number,
          totalMatches,
          wins,
          winRate,
          winStreak: user[streakField as keyof typeof user] as number,
        };
      })
    );
    
    // Sort by rating (descending)
    return userStats
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);
  }
}

export const storage = new DatabaseStorage();
