import { sql } from "drizzle-orm";
import { 
  index, 
  uniqueIndex,
  jsonb, 
  pgTable, 
  timestamp, 
  varchar,
  integer,
  text,
  boolean,
  decimal,
  real,
  serial,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  username: varchar("username", { length: 30 }), // User-chosen display name (nullable, validated in app)
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isBot: boolean("is_bot").default(false),
  isAdmin: boolean("is_admin").default(false),
  isBanned: boolean("is_banned").default(false),
  isEmailVerified: boolean("is_email_verified").default(false), // For withdrawal/high-value match verification
  isVerifiedAccount: boolean("is_verified_account").default(false), // Badge for real-money verified accounts
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0.00").notNull(),
  coinsBalance: integer("coins_balance").default(0).notNull(),
  xp: integer("xp").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  themePreference: varchar("theme_preference", { length: 10 }).default("dark"),
  country: varchar("country", { length: 2 }), // ISO 3166-1 alpha-2 country code
  nicknameColor: varchar("nickname_color", { length: 7 }).default("#3B82F6"), // Hex color code
  lastUsernameChangeAt: timestamp("last_username_change_at"), // Rate limiting for username changes
  lastProfilePictureChangeAt: timestamp("last_profile_picture_change_at"), // Rate limiting for profile picture changes
  lastLoginDate: timestamp("last_login_date"),
  loginStreak: integer("login_streak").default(0).notNull(),
  longestStreak: integer("longest_streak").default(0).notNull(),
  reputation: integer("reputation").default(80).notNull(), // 0–100 sportsmanship score
  // ELO/MMR ratings per game type
  chessRating: integer("chess_rating").default(1200).notNull(),
  miniGolfRating: integer("mini_golf_rating").default(1200).notNull(),
  connect4Rating: integer("connect4_rating").default(1200).notNull(),
  airHockeyRating: integer("air_hockey_rating").default(1200).notNull(),
  blockBlastRating: integer("block_blast_rating").default(1200).notNull(),
  rockPaperScissorsRating: integer("rock_paper_scissors_rating").default(1200).notNull(),
  dotsAndBoxesRating: integer("dots_and_boxes_rating").default(1200).notNull(),
  eightBallRating: integer("eight_ball_rating").default(1200).notNull(),
  bowlingRating: integer("bowling_rating").default(1200).notNull(),
  cupKingRating: integer("cup_king_rating").default(1200).notNull(),
  stackTowerRating: integer("stack_tower_rating").default(1200).notNull(),
  basketballRating: integer("basketball_rating").default(1200).notNull(),
  footballRating: integer("football_rating").default(1200).notNull(),
  racingRating: integer("racing_rating").default(1200).notNull(),
  // Placement matches (hide rating until completed)
  chessPlacementMatches: integer("chess_placement_matches").default(0).notNull(),
  miniGolfPlacementMatches: integer("mini_golf_placement_matches").default(0).notNull(),
  connect4PlacementMatches: integer("connect4_placement_matches").default(0).notNull(),
  airHockeyPlacementMatches: integer("air_hockey_placement_matches").default(0).notNull(),
  blockBlastPlacementMatches: integer("block_blast_placement_matches").default(0).notNull(),
  rockPaperScissorsPlacementMatches: integer("rock_paper_scissors_placement_matches").default(0).notNull(),
  dotsAndBoxesPlacementMatches: integer("dots_and_boxes_placement_matches").default(0).notNull(),
  eightBallPlacementMatches: integer("eight_ball_placement_matches").default(0).notNull(),
  bowlingPlacementMatches: integer("bowling_placement_matches").default(0).notNull(),
  cupKingPlacementMatches: integer("cup_king_placement_matches").default(0).notNull(),
  stackTowerPlacementMatches: integer("stack_tower_placement_matches").default(0).notNull(),
  basketballPlacementMatches: integer("basketball_placement_matches").default(0).notNull(),
  footballPlacementMatches: integer("football_placement_matches").default(0).notNull(),
  racingPlacementMatches: integer("racing_placement_matches").default(0).notNull(),
  // Total rated games played (for K-factor calculation)
  chessRatedGamesPlayed: integer("chess_rated_games_played").default(0).notNull(),
  miniGolfRatedGamesPlayed: integer("mini_golf_rated_games_played").default(0).notNull(),
  connect4RatedGamesPlayed: integer("connect4_rated_games_played").default(0).notNull(),
  airHockeyRatedGamesPlayed: integer("air_hockey_rated_games_played").default(0).notNull(),
  blockBlastRatedGamesPlayed: integer("block_blast_rated_games_played").default(0).notNull(),
  rockPaperScissorsRatedGamesPlayed: integer("rock_paper_scissors_rated_games_played").default(0).notNull(),
  dotsAndBoxesRatedGamesPlayed: integer("dots_and_boxes_rated_games_played").default(0).notNull(),
  eightBallRatedGamesPlayed: integer("eight_ball_rated_games_played").default(0).notNull(),
  bowlingRatedGamesPlayed: integer("bowling_rated_games_played").default(0).notNull(),
  cupKingRatedGamesPlayed: integer("cup_king_rated_games_played").default(0).notNull(),
  stackTowerRatedGamesPlayed: integer("stack_tower_rated_games_played").default(0).notNull(),
  basketballRatedGamesPlayed: integer("basketball_rated_games_played").default(0).notNull(),
  footballRatedGamesPlayed: integer("football_rated_games_played").default(0).notNull(),
  racingRatedGamesPlayed: integer("racing_rated_games_played").default(0).notNull(),
  // Win streaks per game type
  chessWinStreak: integer("chess_win_streak").default(0).notNull(),
  miniGolfWinStreak: integer("mini_golf_win_streak").default(0).notNull(),
  connect4WinStreak: integer("connect4_win_streak").default(0).notNull(),
  airHockeyWinStreak: integer("air_hockey_win_streak").default(0).notNull(),
  blockBlastWinStreak: integer("block_blast_win_streak").default(0).notNull(),
  rockPaperScissorsWinStreak: integer("rock_paper_scissors_win_streak").default(0).notNull(),
  dotsAndBoxesWinStreak: integer("dots_and_boxes_win_streak").default(0).notNull(),
  eightBallWinStreak: integer("eight_ball_win_streak").default(0).notNull(),
  bowlingWinStreak: integer("bowling_win_streak").default(0).notNull(),
  cupKingWinStreak: integer("cup_king_win_streak").default(0).notNull(),
  stackTowerWinStreak: integer("stack_tower_win_streak").default(0).notNull(),
  basketballWinStreak: integer("basketball_win_streak").default(0).notNull(),
  footballWinStreak: integer("football_win_streak").default(0).notNull(),
  racingWinStreak: integer("racing_win_streak").default(0).notNull(),
  // Longest win streaks per game type
  chessLongestWinStreak: integer("chess_longest_win_streak").default(0).notNull(),
  miniGolfLongestWinStreak: integer("mini_golf_longest_win_streak").default(0).notNull(),
  connect4LongestWinStreak: integer("connect4_longest_win_streak").default(0).notNull(),
  airHockeyLongestWinStreak: integer("air_hockey_longest_win_streak").default(0).notNull(),
  blockBlastLongestWinStreak: integer("block_blast_longest_win_streak").default(0).notNull(),
  rockPaperScissorsLongestWinStreak: integer("rock_paper_scissors_longest_win_streak").default(0).notNull(),
  dotsAndBoxesLongestWinStreak: integer("dots_and_boxes_longest_win_streak").default(0).notNull(),
  eightBallLongestWinStreak: integer("eight_ball_longest_win_streak").default(0).notNull(),
  bowlingLongestWinStreak: integer("bowling_longest_win_streak").default(0).notNull(),
  cupKingLongestWinStreak: integer("cup_king_longest_win_streak").default(0).notNull(),
  stackTowerLongestWinStreak: integer("stack_tower_longest_win_streak").default(0).notNull(),
  basketballLongestWinStreak: integer("basketball_longest_win_streak").default(0).notNull(),
  footballLongestWinStreak: integer("football_longest_win_streak").default(0).notNull(),
  racingLongestWinStreak: integer("racing_longest_win_streak").default(0).notNull(),
  // User preferences
  languagePreference: varchar("language_preference", { length: 10 }).default("en").notNull(), // ISO 639-1 language code
  timezonePreference: varchar("timezone_preference", { length: 50 }).default("America/New_York").notNull(), // IANA timezone
  currencyDisplay: varchar("currency_display", { length: 10 }).default("USD").notNull(), // USD, BTC, ETH, etc.
  // Responsible gaming settings
  dailySpendingLimit: decimal("daily_spending_limit", { precision: 10, scale: 2 }), // null = no limit
  weeklySpendingLimit: decimal("weekly_spending_limit", { precision: 10, scale: 2 }), // null = no limit
  monthlySpendingLimit: decimal("monthly_spending_limit", { precision: 10, scale: 2 }), // null = no limit
  maxWagerAmount: decimal("max_wager_amount", { precision: 10, scale: 2 }), // null = no limit
  selfExclusionUntil: timestamp("self_exclusion_until"), // null = not self-excluded
  coolOffUntil: timestamp("cool_off_until"), // null = not in cool-off
  // Moderation fields
  chatMutedUntil: timestamp("chat_muted_until"), // null = not muted
  wagerRestrictedUntil: timestamp("wager_restricted_until"), // null = not restricted
  tempBanUntil: timestamp("temp_ban_until"), // null = not temp-banned
  // Privacy & advanced settings
  statsVisibility: varchar("stats_visibility", { length: 20 }).default("public").notNull(), // public, friends, private
  betaFeaturesEnabled: boolean("beta_features_enabled").default(false).notNull(),
  referralCode: varchar("referral_code", { length: 20 }).unique(), // Unique referral code for sharing
  referredBy: varchar("referred_by"), // Who referred this user (references users.id)
  // Profile extras
  bio: text("bio"),
  favoriteGame: varchar("favorite_game", { length: 50 }),
  notificationPreferences: jsonb("notification_preferences").default({}).notNull(),
  gameplayPreferences: jsonb("gameplay_preferences").default({}).notNull(),
  // Account closure
  accountClosureRequested: boolean("account_closure_requested").default(false).notNull(),
  accountClosureReason: text("account_closure_reason"),
  accountClosureRequestedAt: timestamp("account_closure_requested_at"),
  // Stripe integration for payments
  stripeCustomerId: varchar("stripe_customer_id").unique(), // Stripe customer ID for deposits/withdrawals
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Game types enum
export const gameTypes = ["mini-golf", "chess", "connect-4", "air-hockey", "block-blast", "rock-paper-scissors", "dots-and-boxes", "8-ball", "bowling", "cup-king", "stack-tower", "tron", "basketball", "football", "racing"] as const;
export type GameType = typeof gameTypes[number];

// Match statuses enum
export const matchStatuses = ["waiting", "in-progress", "completed", "cancelled", "reconnecting", "disputed"] as const;
export type MatchStatus = typeof matchStatuses[number];

// Matches table - stores game matches between players
export const matches = pgTable("matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameType: varchar("game_type", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("waiting"),
  player1Id: varchar("player1_id").notNull().references(() => users.id),
  player2Id: varchar("player2_id").references(() => users.id),
  winnerId: varchar("winner_id").references(() => users.id),
  player1Score: integer("player1_score").default(0),
  player2Score: integer("player2_score").default(0),
  gameState: jsonb("game_state"),
  isBotMatch: boolean("is_bot_match").default(false),
  botDifficulty: varchar("bot_difficulty", { length: 20 }),
  isPractice: boolean("is_practice").default(false),
  potAmount: decimal("pot_amount", { precision: 10, scale: 2 }).default("0.00").notNull(),
  rakeAmount: decimal("rake_amount", { precision: 10, scale: 2 }).default("0.00").notNull(),
  forfeitedById: varchar("forfeited_by_id").references(() => users.id),
  pgnMoves: text("pgn_moves"),
  duration: integer("duration"),
  player1TimeRemaining: integer("player1_time_remaining"),
  player2TimeRemaining: integer("player2_time_remaining"),
  timeControl: integer("time_control"),
  miniGolfHoleCount: integer("mini_golf_hole_count").default(3),
  exitedPlayerIds: text("exited_player_ids").array().default(sql`ARRAY[]::text[]`),
  isPrivate: boolean("is_private").default(false),
  inviteCode: varchar("invite_code", { length: 20 }),
  deviceType: varchar("device_type", { length: 10 }).default("desktop"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const matchesRelations = relations(matches, ({ one }) => ({
  player1: one(users, {
    fields: [matches.player1Id],
    references: [users.id],
    relationName: "player1Matches",
  }),
  player2: one(users, {
    fields: [matches.player2Id],
    references: [users.id],
    relationName: "player2Matches",
  }),
  winner: one(users, {
    fields: [matches.winnerId],
    references: [users.id],
    relationName: "wonMatches",
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  player1Matches: many(matches, { relationName: "player1Matches" }),
  player2Matches: many(matches, { relationName: "player2Matches" }),
  wonMatches: many(matches, { relationName: "wonMatches" }),
}));

// Transaction types enum
export const transactionTypes = ["deposit", "withdrawal", "bet_placed", "bet_won", "bet_lost", "rake", "forfeit_gain"] as const;
export type TransactionType = typeof transactionTypes[number];

// Transactions table - tracks all balance changes
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type", { length: 50 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  balanceBefore: decimal("balance_before", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
  matchId: varchar("match_id").references(() => matches.id),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  match: one(matches, {
    fields: [transactions.matchId],
    references: [matches.id],
  }),
}));

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

// Game Settings table - stores platform-wide configuration
export const gameSettings = pgTable("game_settings", {
  id: varchar("id").primaryKey().default("default"),
  platformRake: decimal("platform_rake", { precision: 5, scale: 2 }).default("3.00").notNull(),
  minBet: decimal("min_bet", { precision: 10, scale: 2 }).default("5.00").notNull(),
  maxBet: decimal("max_bet", { precision: 10, scale: 2 }).default("1000.00").notNull(),
  newUserBonus: decimal("new_user_bonus", { precision: 10, scale: 2 }).default("100.00").notNull(),
  chessEnabled: boolean("chess_enabled").default(true).notNull(),
  miniGolfEnabled: boolean("mini_golf_enabled").default(true).notNull(),
  connect4Enabled: boolean("connect4_enabled").default(true).notNull(),
  airHockeyEnabled: boolean("air_hockey_enabled").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type GameSettings = typeof gameSettings.$inferSelect;
export type InsertGameSettings = typeof gameSettings.$inferInsert;

export const insertGameSettingsSchema = createInsertSchema(gameSettings).omit({
  id: true,
  updatedAt: true,
});

export type UpdateGameSettings = z.infer<typeof insertGameSettingsSchema>;

// Chat messages table - stores chat messages for matches and global lobby
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  matchId: varchar("match_id").references(() => matches.id),
  channel: varchar("channel", { length: 50 }).notNull().default("global"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  user: one(users, {
    fields: [chatMessages.userId],
    references: [users.id],
  }),
  match: one(matches, {
    fields: [chatMessages.matchId],
    references: [matches.id],
  }),
}));

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export type CreateChatMessage = z.infer<typeof insertChatMessageSchema>;

// Direct messages table - stores private messages between friends
export const directMessages = pgTable("direct_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  recipientId: varchar("recipient_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const directMessagesRelations = relations(directMessages, ({ one }) => ({
  sender: one(users, {
    fields: [directMessages.senderId],
    references: [users.id],
    relationName: "sentDirectMessages",
  }),
  recipient: one(users, {
    fields: [directMessages.recipientId],
    references: [users.id],
    relationName: "receivedDirectMessages",
  }),
}));

export type DirectMessage = typeof directMessages.$inferSelect;
export type InsertDirectMessage = typeof directMessages.$inferInsert;

export const insertDirectMessageSchema = createInsertSchema(directMessages).omit({
  id: true,
  createdAt: true,
  isRead: true,
});

export type CreateDirectMessage = z.infer<typeof insertDirectMessageSchema>;

// Direct message with user details for UI
export type DirectMessageWithUser = DirectMessage & {
  sender: User;
  recipient: User;
};

// Friendship statuses enum
export const friendshipStatuses = ["pending", "accepted", "declined", "blocked"] as const;
export type FriendshipStatus = typeof friendshipStatuses[number];

// Friendships table - stores friend relationships between users
export const friendships = pgTable("friendships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id").notNull().references(() => users.id),
  addresseeId: varchar("addressee_id").notNull().references(() => users.id),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const friendshipsRelations = relations(friendships, ({ one }) => ({
  requester: one(users, {
    fields: [friendships.requesterId],
    references: [users.id],
    relationName: "sentFriendRequests",
  }),
  addressee: one(users, {
    fields: [friendships.addresseeId],
    references: [users.id],
    relationName: "receivedFriendRequests",
  }),
}));

export type Friendship = typeof friendships.$inferSelect;
export type InsertFriendship = typeof friendships.$inferInsert;

export const insertFriendshipSchema = createInsertSchema(friendships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateFriendship = z.infer<typeof insertFriendshipSchema>;

// Friendship with user details for UI
export type FriendshipWithUsers = Friendship & {
  requester: User;
  addressee: User;
};

// Challenge invites table - stores head-to-head game invites
export const challengeInvites = pgTable("challenge_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  challengerId: varchar("challenger_id").notNull().references(() => users.id),
  challengedId: varchar("challenged_id").notNull().references(() => users.id),
  gameType: varchar("game_type", { length: 50 }).notNull(),
  betAmount: decimal("bet_amount", { precision: 10, scale: 2 }).default("0.00").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  matchId: varchar("match_id").references(() => matches.id),
  deviceType: varchar("device_type", { length: 10 }).default("desktop"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const challengeInvitesRelations = relations(challengeInvites, ({ one }) => ({
  challenger: one(users, {
    fields: [challengeInvites.challengerId],
    references: [users.id],
    relationName: "sentChallenges",
  }),
  challenged: one(users, {
    fields: [challengeInvites.challengedId],
    references: [users.id],
    relationName: "receivedChallenges",
  }),
  match: one(matches, {
    fields: [challengeInvites.matchId],
    references: [matches.id],
  }),
}));

export type ChallengeInvite = typeof challengeInvites.$inferSelect;
export type InsertChallengeInvite = typeof challengeInvites.$inferInsert;

export const insertChallengeInviteSchema = createInsertSchema(challengeInvites).omit({
  id: true,
  createdAt: true,
});

export type CreateChallengeInvite = z.infer<typeof insertChallengeInviteSchema>;

// Challenge invite with user details for UI
export type ChallengeInviteWithUsers = ChallengeInvite & {
  challenger: User;
  challenged: User;
};

// Achievement categories enum
export const achievementCategories = ["combat", "skill", "milestone", "special"] as const;
export type AchievementCategory = typeof achievementCategories[number];

// Achievements table - defines all available achievements
export const achievements = pgTable("achievements", {
  id: varchar("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  gameType: varchar("game_type", { length: 50 }),
  icon: varchar("icon", { length: 50 }).notNull(),
  rarity: varchar("rarity", { length: 20 }).notNull().default("common"),
  xpReward: integer("xp_reward").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = typeof achievements.$inferInsert;

// User achievements table - tracks which achievements users have earned
export const userAchievements = pgTable("user_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  achievementId: varchar("achievement_id").notNull().references(() => achievements.id),
  matchId: varchar("match_id").references(() => matches.id),
  progress: integer("progress").default(0).notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, {
    fields: [userAchievements.userId],
    references: [users.id],
  }),
  achievement: one(achievements, {
    fields: [userAchievements.achievementId],
    references: [achievements.id],
  }),
  match: one(matches, {
    fields: [userAchievements.matchId],
    references: [matches.id],
  }),
}));

export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = typeof userAchievements.$inferInsert;

// Favorite games table - tracks which games users have starred
export const favoriteGames = pgTable("favorite_games", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  gameType: varchar("game_type", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const favoriteGamesRelations = relations(favoriteGames, ({ one }) => ({
  user: one(users, {
    fields: [favoriteGames.userId],
    references: [users.id],
  }),
}));

export type FavoriteGame = typeof favoriteGames.$inferSelect;
export type InsertFavoriteGame = typeof favoriteGames.$inferInsert;

// Match statistics table - detailed performance metrics per match
export const matchStatistics = pgTable("match_statistics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull().references(() => matches.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id),
  // Air Hockey specific stats
  goals: integer("goals").default(0),
  shots: integer("shots").default(0),
  saves: integer("saves").default(0),
  hitSpeedPeak: integer("hit_speed_peak").default(0), // Peak puck speed in px/s
  possessionSeconds: integer("possession_seconds").default(0),
  possessionPercent: decimal("possession_percent", { precision: 5, scale: 2 }).default("0.00"),
  // Chess specific stats
  moveCount: integer("move_count").default(0),
  capturedPieces: integer("captured_pieces").default(0),
  checksGiven: integer("checks_given").default(0),
  // Mini Golf specific stats
  strokes: integer("strokes").default(0),
  holesInOne: integer("holes_in_one").default(0),
  avgStrokesPerHole: decimal("avg_strokes_per_hole", { precision: 5, scale: 2 }),
  // Connect 4 specific stats
  movesPlayed: integer("moves_played").default(0),
  blockedOpponent: integer("blocked_opponent").default(0),
  // Stack Tower specific stats
  blocksPlaced: integer("blocks_placed").default(0),
  perfectPlacements: integer("perfect_placements").default(0),
  averageBlockSize: decimal("average_block_size", { precision: 5, scale: 2 }), // Percentage of full width
  longestPerfectChain: integer("longest_perfect_chain").default(0),
  // General stats
  ratingBefore: integer("rating_before"),
  ratingAfter: integer("rating_after"),
  ratingChange: integer("rating_change"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const matchStatisticsRelations = relations(matchStatistics, ({ one }) => ({
  match: one(matches, {
    fields: [matchStatistics.matchId],
    references: [matches.id],
  }),
  user: one(users, {
    fields: [matchStatistics.userId],
    references: [users.id],
  }),
}));

export type MatchStatistics = typeof matchStatistics.$inferSelect;
export type InsertMatchStatistics = typeof matchStatistics.$inferInsert;

export const insertMatchStatisticsSchema = createInsertSchema(matchStatistics).omit({
  id: true,
  createdAt: true,
});

export type CreateMatchStatistics = z.infer<typeof insertMatchStatisticsSchema>;

// Weekly leaderboards table - snapshots of top players each week
export const weeklyLeaderboards = pgTable("weekly_leaderboards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  gameType: varchar("game_type", { length: 50 }).notNull(),
  weekStartDate: timestamp("week_start_date").notNull(),
  weekEndDate: timestamp("week_end_date").notNull(),
  rank: integer("rank").notNull(),
  rating: integer("rating").notNull(),
  matchesPlayed: integer("matches_played").default(0).notNull(),
  wins: integer("wins").default(0).notNull(),
  losses: integer("losses").default(0).notNull(),
  winStreak: integer("win_streak").default(0).notNull(),
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const weeklyLeaderboardsRelations = relations(weeklyLeaderboards, ({ one }) => ({
  user: one(users, {
    fields: [weeklyLeaderboards.userId],
    references: [users.id],
  }),
}));

export type WeeklyLeaderboard = typeof weeklyLeaderboards.$inferSelect;
export type InsertWeeklyLeaderboard = typeof weeklyLeaderboards.$inferInsert;

// Crypto payment types
export const cryptoCurrencies = ["btc", "eth", "sol"] as const;
export type CryptoCurrency = typeof cryptoCurrencies[number];

export const cryptoPaymentStatuses = ["pending", "confirming", "confirmed", "expired", "failed"] as const;
export type CryptoPaymentStatus = typeof cryptoPaymentStatuses[number];

// Crypto payments table - tracks crypto deposits and withdrawals
export const cryptoPayments = pgTable("crypto_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type", { length: 20 }).notNull(), // 'deposit' or 'withdrawal'
  currency: varchar("currency", { length: 10 }).notNull(), // btc, eth, sol
  amountCrypto: varchar("amount_crypto", { length: 50 }).notNull(), // Amount in crypto
  amountUsd: decimal("amount_usd", { precision: 10, scale: 2 }).notNull(), // USD equivalent
  walletAddress: varchar("wallet_address", { length: 100 }), // For deposits: platform address, for withdrawals: user address
  txHash: varchar("tx_hash", { length: 100 }), // Blockchain transaction hash
  paymentId: varchar("payment_id", { length: 100 }), // External payment gateway ID (NOWPayments)
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  expiresAt: timestamp("expires_at"), // For pending payments
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cryptoPaymentsRelations = relations(cryptoPayments, ({ one }) => ({
  user: one(users, {
    fields: [cryptoPayments.userId],
    references: [users.id],
  }),
}));

export type CryptoPayment = typeof cryptoPayments.$inferSelect;
export type InsertCryptoPayment = typeof cryptoPayments.$inferInsert;

export const insertCryptoPaymentSchema = createInsertSchema(cryptoPayments).omit({
  id: true,
  createdAt: true,
});

export type CreateCryptoPayment = z.infer<typeof insertCryptoPaymentSchema>;

// ─── Saved Payment Cards ───────────────────────────────────────────────────
export const savedCards = pgTable("saved_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  stripePaymentMethodId: varchar("stripe_payment_method_id").notNull().unique(),
  brand: varchar("brand", { length: 20 }).notNull().default("visa"), // visa, mastercard, amex, etc.
  last4: varchar("last4", { length: 4 }).notNull(),
  expiryMonth: integer("expiry_month").notNull(),
  expiryYear: integer("expiry_year").notNull(),
  cardholderName: varchar("cardholder_name", { length: 120 }).notNull(),
  billingZip: varchar("billing_zip", { length: 20 }),
  nickname: varchar("nickname", { length: 60 }),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const savedCardsRelations = relations(savedCards, ({ one }) => ({
  user: one(users, {
    fields: [savedCards.userId],
    references: [users.id],
  }),
}));

export type SavedCard = typeof savedCards.$inferSelect;
export type InsertSavedCard = typeof savedCards.$inferInsert;

export const insertSavedCardSchema = createInsertSchema(savedCards).omit({
  id: true,
  createdAt: true,
});

// ─── Item Shop ────────────────────────────────────────────────────────────

export const shopItemCategories = [
  "avatar_frame",
  "badge",
  "board_skin",
  "emote",
  "theme",
  "victory_animation",
  "banner",
  "trail",
  "dice_skin",
  "card_skin",
] as const;
export type ShopItemCategory = typeof shopItemCategories[number];

export const shopItemRarities = ["common", "uncommon", "rare", "epic", "legendary"] as const;
export type ShopItemRarity = typeof shopItemRarities[number];

export const shopItems = pgTable("shop_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 80 }).notNull(),
  description: varchar("description", { length: 240 }).notNull(),
  category: varchar("category", { length: 40 }).notNull(),
  rarity: varchar("rarity", { length: 20 }).notNull().default("common"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  coinPrice: integer("coin_price").default(0).notNull(),
  iconColor: varchar("icon_color", { length: 7 }).default("#3B82F6"),
  previewGradient: varchar("preview_gradient", { length: 120 }),
  isActive: boolean("is_active").default(true).notNull(),
  isFeatured: boolean("is_featured").default(false).notNull(),
  isDailyItem: boolean("is_daily_item").default(false).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const shopItemsRelations = relations(shopItems, ({ many }) => ({
  inventory: many(userInventory),
}));

export type ShopItem = typeof shopItems.$inferSelect;
export type InsertShopItem = typeof shopItems.$inferInsert;

export const insertShopItemSchema = createInsertSchema(shopItems).omit({
  id: true,
  createdAt: true,
});

// ─── User Inventory ──────────────────────────────────────────────────────

export const userInventory = pgTable("user_inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  itemId: varchar("item_id").notNull().references(() => shopItems.id, { onDelete: "cascade" }),
  purchasedAt: timestamp("purchased_at").defaultNow(),
}, (t) => ({
  userItemUnique: uniqueIndex("user_inventory_user_item_unique").on(t.userId, t.itemId),
}));

export const userInventoryRelations = relations(userInventory, ({ one }) => ({
  user: one(users, { fields: [userInventory.userId], references: [users.id] }),
  item: one(shopItems, { fields: [userInventory.itemId], references: [shopItems.id] }),
}));

export type UserInventoryEntry = typeof userInventory.$inferSelect;
export type InsertUserInventory = typeof userInventory.$inferInsert;

// ─── User Equipped Cosmetics ─────────────────────────────────────────────

export const userEquipped = pgTable("user_equipped", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: varchar("category", { length: 40 }).notNull(),
  itemId: varchar("item_id").notNull().references(() => shopItems.id, { onDelete: "cascade" }),
  equippedAt: timestamp("equipped_at").defaultNow(),
});

export const userEquippedRelations = relations(userEquipped, ({ one }) => ({
  user: one(users, { fields: [userEquipped.userId], references: [users.id] }),
  item: one(shopItems, { fields: [userEquipped.itemId], references: [shopItems.id] }),
}));

export type UserEquipped = typeof userEquipped.$inferSelect;

// ─── Rank Progression: Seasons / Rewards / History ────────────────────────

export const rankSeasons = pgTable("rank_seasons", {
  id: varchar("id").primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  tagline: varchar("tagline", { length: 160 }),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
export type RankSeason = typeof rankSeasons.$inferSelect;

/**
 * rank_rewards links a specific (tier, division) milestone to a cosmetic item.
 * `tier` matches RankTier ("Bronze"|"Silver"|... |"Champion"|"GOAT").
 * `division` is one of "III"|"II"|"I" (or null for Champion/GOAT which have no divisions).
 */
export const rankRewards = pgTable("rank_rewards", {
  id: varchar("id").primaryKey(),
  seasonId: varchar("season_id").notNull().references(() => rankSeasons.id, { onDelete: "cascade" }),
  tier: varchar("tier", { length: 20 }).notNull(),
  division: varchar("division", { length: 4 }),
  ratingThreshold: integer("rating_threshold").notNull(),
  itemId: varchar("item_id").notNull().references(() => shopItems.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
export type RankReward = typeof rankRewards.$inferSelect;

/**
 * rank_history records every tier or division transition for a user, per game.
 */
export const rankHistory = pgTable("rank_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  seasonId: varchar("season_id").references(() => rankSeasons.id, { onDelete: "set null" }),
  gameType: varchar("game_type", { length: 30 }).notNull(),
  oldRating: integer("old_rating").notNull(),
  newRating: integer("new_rating").notNull(),
  oldTier: varchar("old_tier", { length: 20 }).notNull(),
  newTier: varchar("new_tier", { length: 20 }).notNull(),
  oldDivision: varchar("old_division", { length: 4 }),
  newDivision: varchar("new_division", { length: 4 }),
  direction: varchar("direction", { length: 10 }).notNull(), // "up" | "down"
  matchId: varchar("match_id").references(() => matches.id, { onDelete: "set null" }),
  /** Snapshot of item IDs that were newly granted as a result of this rank change (empty for rank-downs). */
  grantedItemIds: text("granted_item_ids").array().default(sql`ARRAY[]::text[]`).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
export type RankHistory = typeof rankHistory.$inferSelect;

// ─── Tutorial Progress ───────────────────────────────────────────────────

export const tutorialProgress = pgTable("tutorial_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tutorialId: text("tutorial_id").notNull(),
  status: text("status").notNull().default("in_progress"),
  currentStep: integer("current_step").notNull().default(0),
  totalSteps: integer("total_steps").notNull().default(0),
  rewardGranted: boolean("reward_granted").notNull().default(false),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (t) => ({
  userTutorialUnique: uniqueIndex("tutorial_progress_user_tutorial_unique").on(t.userId, t.tutorialId),
}));

export type TutorialProgressRow = typeof tutorialProgress.$inferSelect;

// ─── Tier Drill Scores ───────────────────────────────────────────────────
//
// Per-(user, tutorialId) personal-best store for the interactive tier drills
// (reaction time, perfect-tap streaks, cups-tracked, aim accuracy, mc first-try).
// Only one PB row per training tier — the metric is whatever the drill emits.

export const drillScores = pgTable("drill_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tutorialId: text("tutorial_id").notNull(),
  drillKind: text("drill_kind").notNull(),
  metric: text("metric").notNull(),
  higherIsBetter: boolean("higher_is_better").notNull(),
  bestScore: real("best_score").notNull(),
  lastScore: real("last_score").notNull(),
  attempts: integer("attempts").notNull().default(1),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  userTutorialUnique: uniqueIndex("drill_scores_user_tutorial_unique").on(t.userId, t.tutorialId),
}));

export type DrillScoreRow = typeof drillScores.$inferSelect;
export type InsertDrillScore = typeof drillScores.$inferInsert;

// ──────────────────────────────────────────────────────────────────────────

// ─── Player Reports ──────────────────────────────────────────────────────────
export const reportReasons = ["cheating", "stalling", "toxic_chat", "disconnecting", "inappropriate", "other"] as const;
export type ReportReason = typeof reportReasons[number];

export const playerReports = pgTable("player_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reporterId: varchar("reporter_id").notNull().references(() => users.id),
  reportedUserId: varchar("reported_user_id").notNull().references(() => users.id),
  matchId: varchar("match_id").references(() => matches.id),
  reason: varchar("reason", { length: 30 }).notNull(),
  details: text("details"),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type PlayerReport = typeof playerReports.$inferSelect;
export type InsertPlayerReport = typeof playerReports.$inferInsert;

// ─── Activity Feed ────────────────────────────────────────────────────────────
export const activityFeed = pgTable("activity_feed", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type", { length: 40 }).notNull(), // 'win', 'achievement', 'rank_up', 'friend_joined', 'streak'
  data: jsonb("data"),
  isPublic: boolean("is_public").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export type ActivityFeedEntry = typeof activityFeed.$inferSelect;

// ─── Clans ────────────────────────────────────────────────────────────────────
export const clanRoles = ["leader", "officer", "member"] as const;
export type ClanRole = typeof clanRoles[number];

export const clans = pgTable("clans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 40 }).notNull().unique(),
  tag: varchar("tag", { length: 5 }).notNull().unique(),
  description: text("description"),
  logoUrl: varchar("logo_url", { length: 500 }),
  bannerUrl: varchar("banner_url", { length: 500 }),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  isPublic: boolean("is_public").default(true).notNull(),
  requiresApproval: boolean("requires_approval").default(false).notNull(),
  memberLimit: integer("member_limit").default(50).notNull(),
  currentMemberCount: integer("current_member_count").default(1).notNull(),
  clanLevel: integer("clan_level").default(1).notNull(),
  clanXp: integer("clan_xp").default(0).notNull(),
  totalScalpsWon: decimal("total_scalps_won", { precision: 14, scale: 2 }).default("0").notNull(),
  totalScalpsLost: decimal("total_scalps_lost", { precision: 14, scale: 2 }).default("0").notNull(),
  totalMatchesPlayed: integer("total_matches_played").default(0).notNull(),
  totalMatchesWon: integer("total_matches_won").default(0).notNull(),
  totalMatchesLost: integer("total_matches_lost").default(0).notNull(),
  totalChallengesWon: integer("total_challenges_won").default(0).notNull(),
  totalChallengesLost: integer("total_challenges_lost").default(0).notNull(),
  seasonPoints: integer("season_points").default(0).notNull(),
  lastActiveAt: timestamp("last_active_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clansRelations = relations(clans, ({ one, many }) => ({
  createdBy: one(users, { fields: [clans.createdByUserId], references: [users.id] }),
  members: many(clanMembers),
  invites: many(clanInvites),
}));

export type Clan = typeof clans.$inferSelect;
export type InsertClan = typeof clans.$inferInsert;
export const insertClanSchema = createInsertSchema(clans).omit({ id: true, createdAt: true, lastActiveAt: true });

// ─── Clan Members ─────────────────────────────────────────────────────────────
export const clanMembers = pgTable("clan_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clanId: varchar("clan_id").notNull().references(() => clans.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 10 }).default("member").notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
  matchesPlayedForClan: integer("matches_played_for_clan").default(0).notNull(),
  matchesWonForClan: integer("matches_won_for_clan").default(0).notNull(),
  contributedScalps: decimal("contributed_scalps", { precision: 14, scale: 2 }).default("0").notNull(),
});

export const clanMembersRelations = relations(clanMembers, ({ one }) => ({
  clan: one(clans, { fields: [clanMembers.clanId], references: [clans.id] }),
  user: one(users, { fields: [clanMembers.userId], references: [users.id] }),
}));

export type ClanMember = typeof clanMembers.$inferSelect;
export type InsertClanMember = typeof clanMembers.$inferInsert;

// ─── Clan Invites ─────────────────────────────────────────────────────────────
export const clanInvites = pgTable("clan_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clanId: varchar("clan_id").notNull().references(() => clans.id, { onDelete: "cascade" }),
  invitedUserId: varchar("invited_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  invitedByUserId: varchar("invited_by_user_id").notNull().references(() => users.id),
  status: varchar("status", { length: 10 }).default("pending").notNull(), // pending | accepted | declined
  createdAt: timestamp("created_at").defaultNow(),
});

export const clanInvitesRelations = relations(clanInvites, ({ one }) => ({
  clan: one(clans, { fields: [clanInvites.clanId], references: [clans.id] }),
  invitedUser: one(users, { fields: [clanInvites.invitedUserId], references: [users.id] }),
  invitedBy: one(users, { fields: [clanInvites.invitedByUserId], references: [users.id] }),
}));

export type ClanInvite = typeof clanInvites.$inferSelect;
export type InsertClanInvite = typeof clanInvites.$inferInsert;

// ─── Clan Join Requests ───────────────────────────────────────────────────────
export const clanJoinRequests = pgTable("clan_join_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clanId: varchar("clan_id").notNull().references(() => clans.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 10 }).default("pending").notNull(), // pending | approved | declined
  createdAt: timestamp("created_at").defaultNow(),
});

export const clanJoinRequestsRelations = relations(clanJoinRequests, ({ one }) => ({
  clan: one(clans, { fields: [clanJoinRequests.clanId], references: [clans.id] }),
  user: one(users, { fields: [clanJoinRequests.userId], references: [users.id] }),
}));

export type ClanJoinRequest = typeof clanJoinRequests.$inferSelect;

// ─── Clan Chat Messages ────────────────────────────────────────────────────────
export const clanMessages = pgTable("clan_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clanId: varchar("clan_id").notNull().references(() => clans.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clanMessagesRelations = relations(clanMessages, ({ one }) => ({
  clan: one(clans, { fields: [clanMessages.clanId], references: [clans.id] }),
  user: one(users, { fields: [clanMessages.userId], references: [users.id] }),
}));

export type ClanMessage = typeof clanMessages.$inferSelect;
export type InsertClanMessage = typeof clanMessages.$inferInsert;

// Moderation actions log
export const moderationActionTypes = [
  "warning",
  "temp_ban",
  "wager_restriction",
  "chat_mute",
  "permanent_ban",
  "dismiss_report",
  "unban",
  "unmute",
  "unrestrict",
] as const;
export type ModerationActionType = typeof moderationActionTypes[number];

export const moderationActions = pgTable("moderation_actions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").notNull().references(() => users.id),
  targetUserId: varchar("target_user_id").notNull().references(() => users.id),
  relatedReportId: varchar("related_report_id"),
  actionType: varchar("action_type", { length: 30 }).notNull(),
  reason: text("reason").notNull(),
  durationHours: integer("duration_hours"), // null = permanent
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const moderationActionsRelations = relations(moderationActions, ({ one }) => ({
  admin: one(users, { fields: [moderationActions.adminId], references: [users.id] }),
  target: one(users, { fields: [moderationActions.targetUserId], references: [users.id] }),
}));

export type ModerationAction = typeof moderationActions.$inferSelect;
export type InsertModerationAction = typeof moderationActions.$inferInsert;

export const insertMatchSchema = createInsertSchema(matches).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
});

// Schema for creating a match from the client (player1Id added server-side)
export const createMatchSchema = insertMatchSchema.omit({
  player1Id: true,
});

export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type Match = typeof matches.$inferSelect;

// Subset of user fields embedded in match queries.
// Keeping this narrow avoids exceeding PostgreSQL's 100-argument limit in
// json_build_object() when Drizzle joins three user relations at once.
export type MatchPlayer = Pick<
  User,
  | "id"
  | "firstName"
  | "lastName"
  | "email"
  | "username"
  | "profileImageUrl"
  | "isBot"
  | "isAdmin"
  | "isVerifiedAccount"
  | "isBanned"
  | "reputation"
  | "nicknameColor"
>;

// Match with player details for UI
export type MatchWithPlayers = Match & {
  player1: MatchPlayer | null;
  player2: MatchPlayer | null;
  winner: MatchPlayer | null;
};

// Leaderboard stats type
export type LeaderboardEntry = {
  userId: string;
  userName: string;
  profileImageUrl: string | null;
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  overallRating?: number;
};

// Challenge claims — tracks which daily/weekly challenges a user has manually claimed
export const challengeClaims = pgTable("challenge_claims", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  challengeId: varchar("challenge_id", { length: 100 }).notNull(),
  xpAwarded: integer("xp_awarded").notNull(),
  claimedAt: timestamp("claimed_at").notNull().defaultNow(),
});
export type ChallengeClaim = typeof challengeClaims.$inferSelect;
export type InsertChallengeClaim = typeof challengeClaims.$inferInsert;

// User stats type
export type UserStats = {
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  totalEarnings: number;
  currentStreak: number;
  gamesPlayed: {
    [key in GameType]?: number;
  };
};

// ─── Social Posts ────────────────────────────────────────────────────────────
export const socialPostTypes = ["general", "win", "challenge", "achievement", "clan", "auto"] as const;
export type SocialPostType = typeof socialPostTypes[number];

export const socialPosts = pgTable("social_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorId: varchar("author_id").notNull().references(() => users.id),
  subjectUserId: varchar("subject_user_id").references(() => users.id),
  type: varchar("type", { length: 20 }).notNull().default("general"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const socialPostsRelations = relations(socialPosts, ({ one, many }) => ({
  author: one(users, { fields: [socialPosts.authorId], references: [users.id] }),
  reactions: many(socialReactions),
  replies: many(socialReplies),
}));

export type SocialPost = typeof socialPosts.$inferSelect;
export type InsertSocialPost = typeof socialPosts.$inferInsert;

export const insertSocialPostSchema = createInsertSchema(socialPosts).omit({
  id: true,
  createdAt: true,
});

export type CreateSocialPost = z.infer<typeof insertSocialPostSchema>;

// ─── Social Reactions ────────────────────────────────────────────────────────
export const socialReactionTypes = ["like", "fire", "crown", "skull", "clap"] as const;
export type SocialReactionType = typeof socialReactionTypes[number];

export const socialReactions = pgTable("social_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => socialPosts.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  reactionType: varchar("reaction_type", { length: 10 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const socialReactionsRelations = relations(socialReactions, ({ one }) => ({
  post: one(socialPosts, { fields: [socialReactions.postId], references: [socialPosts.id] }),
  user: one(users, { fields: [socialReactions.userId], references: [users.id] }),
}));

export type SocialReaction = typeof socialReactions.$inferSelect;
export type InsertSocialReaction = typeof socialReactions.$inferInsert;

// ─── Social Replies ──────────────────────────────────────────────────────────
export const socialReplies = pgTable("social_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => socialPosts.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const socialRepliesRelations = relations(socialReplies, ({ one }) => ({
  post: one(socialPosts, { fields: [socialReplies.postId], references: [socialPosts.id] }),
  author: one(users, { fields: [socialReplies.authorId], references: [users.id] }),
}));

export type SocialReply = typeof socialReplies.$inferSelect;
export type InsertSocialReply = typeof socialReplies.$inferInsert;

export const insertSocialReplySchema = createInsertSchema(socialReplies).omit({
  id: true,
  createdAt: true,
});

export type CreateSocialReply = z.infer<typeof insertSocialReplySchema>;

// ─── Social Mutes ─────────────────────────────────────────────────────────────
export const socialMutes = pgTable("social_mutes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  mutedUserId: varchar("muted_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export type SocialMute = typeof socialMutes.$inferSelect;

// ─── Battle Pass ─────────────────────────────────────────────────────────────
export const battlePassSeasons = pgTable("battle_pass_seasons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type BattlePassSeason = typeof battlePassSeasons.$inferSelect;

export const battlePassTiers = pgTable("battle_pass_tiers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  seasonId: varchar("season_id").notNull().references(() => battlePassSeasons.id),
  tier: integer("tier").notNull(),
  xpRequired: integer("xp_required").notNull(),
  rewardType: varchar("reward_type", { length: 30 }).notNull(),
  rewardValue: varchar("reward_value", { length: 100 }).notNull(),
  rewardDescription: text("reward_description").notNull(),
  isPremium: boolean("is_premium").default(false).notNull(),
});

export type BattlePassTier = typeof battlePassTiers.$inferSelect;

export const userBattlePassProgress = pgTable("user_battle_pass_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  seasonId: varchar("season_id").notNull().references(() => battlePassSeasons.id),
  currentXp: integer("current_xp").default(0).notNull(),
  claimedTiers: integer("claimed_tiers").array().default([]).notNull(),
  hasPremium: boolean("has_premium").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type UserBattlePassProgress = typeof userBattlePassProgress.$inferSelect;

// ─── Social post with full details for UI ────────────────────────────────────
export type SocialPostWithDetails = SocialPost & {
  author: User;
  reactions: SocialReaction[];
  replies: (SocialReply & { author: User })[];
  reactionCounts: Record<SocialReactionType, number>;
  userReactions: SocialReactionType[];
};

// ─── Audit Logs ───────────────────────────────────────────────────────────────
export const auditLogActions = [
  "match_complete", "match_forfeit", "match_dispute",
  "wallet_deposit", "wallet_withdrawal", "wallet_adjust",
  "ban_user", "unban_user", "warn_user", "mute_user",
  "reputation_change", "admin_action", "security_flag",
  "reconnect_timeout_forfeit", "anti_cheat_flag",
] as const;
export type AuditLogAction = typeof auditLogActions[number];

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorId: varchar("actor_id").references(() => users.id),
  targetId: varchar("target_id").references(() => users.id),
  matchId: varchar("match_id").references(() => matches.id),
  action: varchar("action", { length: 60 }).notNull(),
  severity: varchar("severity", { length: 10 }).notNull().default("info"),
  details: jsonb("details"),
  ipAddress: varchar("ip_address", { length: 60 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ─── Disconnect Penalties ─────────────────────────────────────────────────────
export const disconnectPenalties = pgTable("disconnect_penalties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  matchId: varchar("match_id").references(() => matches.id),
  reason: varchar("reason", { length: 30 }).notNull().default("timeout"),
  reputationLost: integer("reputation_lost").notNull().default(0),
  cooldownUntil: timestamp("cooldown_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DisconnectPenalty = typeof disconnectPenalties.$inferSelect;
export type InsertDisconnectPenalty = typeof disconnectPenalties.$inferInsert;

// ─── Matchmaking Queue ────────────────────────────────────────────────────────
export const matchmakingQueue = pgTable("matchmaking_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  gameType: varchar("game_type", { length: 50 }).notNull(),
  betAmount: decimal("bet_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  mmr: integer("mmr").notNull().default(1000),
  searchRadius: integer("search_radius").notNull().default(100),
  deviceType: varchar("device_type", { length: 10 }).default("desktop"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export type MatchmakingEntry = typeof matchmakingQueue.$inferSelect;
export type InsertMatchmakingEntry = typeof matchmakingQueue.$inferInsert;

// ─── Party System ─────────────────────────────────────────────────────────────
export const partyStatuses = ["waiting", "in-game", "disbanded"] as const;
export type PartyStatus = typeof partyStatuses[number];

export const parties = pgTable("parties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  leaderId: varchar("leader_id").notNull().references(() => users.id),
  inviteCode: varchar("invite_code", { length: 20 }).notNull().unique(),
  gameType: varchar("game_type", { length: 50 }),
  betAmount: decimal("bet_amount", { precision: 10, scale: 2 }).default("0.00"),
  status: varchar("status", { length: 20 }).notNull().default("waiting"),
  maxSize: integer("max_size").notNull().default(4),
  isPrivate: boolean("is_private").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Party = typeof parties.$inferSelect;
export type InsertParty = typeof parties.$inferInsert;

export const partyMembers = pgTable("party_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partyId: varchar("party_id").notNull().references(() => parties.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull().default("member"),
  isReady: boolean("is_ready").default(false).notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export type PartyMember = typeof partyMembers.$inferSelect;

export const partyMessages = pgTable("party_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partyId: varchar("party_id").notNull().references(() => parties.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PartyMessage = typeof partyMessages.$inferSelect;

// Party with members for UI
export type PartyWithMembers = Party & {
  members: (PartyMember & { user: Pick<User, "id" | "username" | "firstName" | "lastName" | "profileImageUrl" | "reputation"> })[];
  messages: (PartyMessage & { author: Pick<User, "id" | "username" | "firstName" | "profileImageUrl"> })[];
};

// ─── Tournament Brackets ──────────────────────────────────────────────────────
export const tournamentBrackets = pgTable("tournament_brackets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tournamentId: varchar("tournament_id").notNull(),
  round: integer("round").notNull(),
  matchSlot: integer("match_slot").notNull(),
  player1Id: varchar("player1_id").references(() => users.id),
  player2Id: varchar("player2_id").references(() => users.id),
  winnerId: varchar("winner_id").references(() => users.id),
  matchId: varchar("match_id").references(() => matches.id),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  scheduledAt: timestamp("scheduled_at"),
  completedAt: timestamp("completed_at"),
});

export type TournamentBracket = typeof tournamentBrackets.$inferSelect;
export type InsertTournamentBracket = typeof tournamentBrackets.$inferInsert;
