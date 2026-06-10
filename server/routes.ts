import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import passport from "passport";
import Stripe from "stripe";
import express from "express";
import path from "path";
import { storage, MATCH_PLAYER_COLUMNS } from "./storage";
import { db } from "./db";
import { setupAuth, isAuthenticated, getSession } from "./auth";
import { isAdmin } from "./adminAuth";
import { achievementService } from "./achievementService";
import { createMatchSchema, matches, shopItems, userInventory, userEquipped, users, transactions, playerReports, clans, clanMembers, clanInvites, clanJoinRequests, clanMessages, moderationActions, socialPosts, socialReactions, socialReplies, socialMutes, battlePassSeasons, battlePassTiers, userBattlePassProgress, auditLogs, disconnectPenalties, gameTypes, type GameType } from "@shared/schema";
import { eq, and, desc, or, ilike, ne, sql as drizzleSql } from "drizzle-orm";
import { auditLogger } from "./auditLogger";
import { reputationService } from "./reputationService";
import { wagerEngine } from "./wagerEngine";
import { reconnectManager } from "./reconnectManager";
import { antiCheat } from "./antiCheat";
import { matchmakingQueueService } from "./matchmakingQueue";
import { partyService } from "./partyService";
import { parties, partyMembers, partyMessages, tournamentBrackets } from "@shared/schema";
import { pushNotification as _pushNotification, getNotifications, markAllRead, markRead, hasNotifications } from "./notificationStore";
import { createWinPost, createBigWinPost, createRankUpPost, createGoatPost, createClanWarWinPost, seedExamplePosts, checkGoatChange, ensureSystemUser, SYSTEM_USER_ID } from "./socialAutoPost";
import { seedShopItems } from "./seedShopItems";
import { seedRankRewards } from "./seedRankRewards";
import { getRankProgressionForUser, getActiveRankSeason, getRankHistoryForUser } from "./rankProgression";
import { generateChessMove, generateConnect4Move, generateMiniGolfShot, generateRPSChoice, generateEightBallMove, generateBowlingMove, generateCupKingMove, generateStackTowerMove, generateBasketballMove, generateFootballMove } from "./botAI";
import { 
  makeMove as makeChessMove, 
  type GameState as ChessGameState, 
  type Position, 
  generatePGN,
  initializeGameState as initializeChessGameState
} from "@shared/chessEngine";
import {
  makeMove as makeConnect4Move,
  type GameState as Connect4GameState,
  initializeGameState as initializeConnect4GameState,
  getMoveSequence,
} from "@shared/connect4Engine";
import {
  processShot,
  advanceToNextHole,
  type MiniGolfGameState,
  type Vector2,
  initializeMatch as initializeMiniGolfMatch,
  calculateTotalScore,
  getHoleDefinition,
} from "@shared/miniGolfEngine";
import {
  AirHockeyEngine,
  type AirHockeyGameState,
  type AirHockeyMove,
} from "@shared/airhockeyEngine";
import {
  RockPaperScissorsEngine,
  type RPSGameState,
  type Choice,
} from "@shared/rockPaperScissorsEngine";
import {
  makeMove as makeDotsAndBoxesMove,
  type GameState as DotsAndBoxesGameState,
  type Line as DotsAndBoxesLine,
  initializeGameState as initializeDotsAndBoxesGameState,
} from "@shared/dotsAndBoxesEngine";

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve Tron game static files
  const tronPath = path.resolve(import.meta.dirname, "..", "public", "tron");
  app.use("/tron", express.static(tronPath));
  

  // Initialize Stripe (only if keys are provided) - referencing blueprint:javascript_stripe
  let stripe: Stripe | null = null;
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-09-30.clover",
    });
    console.log("[STRIPE] Stripe integration initialized");
  } else {
    console.warn("[STRIPE] Stripe keys not configured - deposit/withdrawal features disabled");
  }

  // Auth middleware
  await setupAuth(app);

  // Health check: verifies the server is up and the database is reachable.
  // Useful for Railway/host health checks and confirming DB wiring after deploy.
  app.get('/api/health', async (_req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      await db.execute(drizzleSql`select 1`);
      res.json({ status: "ok", database: "connected" });
    } catch (error) {
      console.error("[HEALTH] Database check failed:", error);
      res.status(503).json({ status: "error", database: "unreachable" });
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("[AUTH] Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Email verification status + trigger
  app.get("/api/auth/verification-status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json({ isEmailVerified: user?.isEmailVerified ?? false, email: user?.email ?? null });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch verification status" });
    }
  });

  // For Replit Auth, all users are verified by Replit — this marks them as verified immediately
  app.post("/api/auth/send-verification", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.updateEmailVerification(userId, true);
      res.json({ success: true, alreadyVerified: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to verify email" });
    }
  });

  // User preference routes
  app.get("/api/user/theme", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ themePreference: user.themePreference || "dark" });
    } catch (error) {
      console.error("Error fetching theme preference:", error);
      res.status(500).json({ message: "Failed to fetch theme preference" });
    }
  });

  app.get("/api/user/streak", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const streak = user.loginStreak || 0;
      const multiplier = storage.getStreakXPMultiplier(streak);
      res.json({
        loginStreak: streak,
        longestStreak: user.longestStreak || 0,
        lastLoginDate: user.lastLoginDate,
        xpMultiplier: multiplier,
        bonusPercent: Math.round((multiplier - 1) * 100),
      });
    } catch (error) {
      console.error("Error fetching login streak:", error);
      res.status(500).json({ message: "Failed to fetch login streak" });
    }
  });

  app.patch("/api/user/theme", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { themePreference } = req.body;

      if (themePreference !== "light" && themePreference !== "dark") {
        return res.status(400).json({ message: "Invalid theme preference. Must be 'light' or 'dark'" });
      }

      await storage.updateUserTheme(userId, themePreference);
      res.json({ success: true, themePreference });
    } catch (error) {
      console.error("Error updating theme preference:", error);
      res.status(500).json({ message: "Failed to update theme preference" });
    }
  });

  // Username update route
  app.patch("/api/user/username", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { username } = req.body;

      if (!username || typeof username !== 'string') {
        return res.status(400).json({ message: "Username is required" });
      }

      const updatedUser = await storage.updateUsername(userId, username.trim());
      res.json({ 
        success: true, 
        username: updatedUser.username,
        message: "Username updated successfully" 
      });
    } catch (error: any) {
      console.error("Error updating username:", error);
      res.status(400).json({ message: error.message || "Failed to update username" });
    }
  });

  // Check username availability
  app.get("/api/user/username/check", isAuthenticated, async (req: any, res) => {
    try {
      const { username } = req.query;
      const userId = req.user.claims.sub;

      if (!username || typeof username !== 'string') {
        return res.status(400).json({ message: "Username is required" });
      }

      const available = await storage.checkUsernameAvailable(username, userId);
      res.json({ available });
    } catch (error) {
      console.error("Error checking username availability:", error);
      res.status(500).json({ message: "Failed to check username availability" });
    }
  });

  // Profile picture update route
  app.patch("/api/user/profile-picture", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { profileImageUrl } = req.body;

      if (!profileImageUrl || typeof profileImageUrl !== 'string') {
        return res.status(400).json({ message: "Profile image URL is required" });
      }

      // Validate it's a data URL or valid URL
      if (!profileImageUrl.startsWith('data:image/') && !profileImageUrl.startsWith('http')) {
        return res.status(400).json({ message: "Invalid image format. Must be a data URL or HTTP(S) URL" });
      }

      const updatedUser = await storage.updateProfilePicture(userId, profileImageUrl);
      res.json({ 
        success: true, 
        profileImageUrl: updatedUser.profileImageUrl,
        message: "Profile picture updated successfully" 
      });
    } catch (error: any) {
      console.error("Error updating profile picture:", error);
      res.status(400).json({ message: error.message || "Failed to update profile picture" });
    }
  });

  // User preferences routes
  app.patch("/api/user/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { languagePreference, timezonePreference, currencyDisplay, displayName, bio, favoriteGame } = req.body;

      const updates: any = {};
      if (languagePreference) updates.languagePreference = languagePreference;
      if (timezonePreference) updates.timezonePreference = timezonePreference;
      if (currencyDisplay) updates.currencyDisplay = currencyDisplay;
      if (displayName !== undefined) updates.firstName = displayName;
      if (bio !== undefined) updates.bio = bio;
      if (favoriteGame !== undefined) updates.favoriteGame = favoriteGame;

      const updatedUser = await storage.updateUserPreferences(userId, updates);
      res.json({ success: true, user: updatedUser });
    } catch (error: any) {
      console.error("Error updating preferences:", error);
      res.status(400).json({ message: error.message || "Failed to update preferences" });
    }
  });

  // Notification preferences
  app.patch("/api/user/notification-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await db.execute(drizzleSql`UPDATE users SET notification_preferences = ${JSON.stringify(req.body)}::jsonb WHERE id = ${userId}`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to update notification preferences" });
    }
  });

  // Gameplay preferences
  app.patch("/api/user/gameplay-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await db.execute(drizzleSql`UPDATE users SET gameplay_preferences = ${JSON.stringify(req.body)}::jsonb WHERE id = ${userId}`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to update gameplay preferences" });
    }
  });

  // Responsible gaming settings routes
  app.patch("/api/user/spending-limits", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { dailySpendingLimit, weeklySpendingLimit, monthlySpendingLimit, maxWagerAmount } = req.body;

      const updates: any = {};
      if (dailySpendingLimit !== undefined) updates.dailySpendingLimit = dailySpendingLimit;
      if (weeklySpendingLimit !== undefined) updates.weeklySpendingLimit = weeklySpendingLimit;
      if (monthlySpendingLimit !== undefined) updates.monthlySpendingLimit = monthlySpendingLimit;
      if (maxWagerAmount !== undefined) updates.maxWagerAmount = maxWagerAmount;

      const updatedUser = await storage.updateSpendingLimits(userId, updates);
      res.json({ success: true, user: updatedUser });
    } catch (error: any) {
      console.error("Error updating spending limits:", error);
      res.status(400).json({ message: error.message || "Failed to update spending limits" });
    }
  });

  app.post("/api/user/self-exclusion", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { durationDays } = req.body;

      if (!durationDays || typeof durationDays !== 'number' || durationDays <= 0) {
        return res.status(400).json({ message: "Valid duration in days is required" });
      }

      const updatedUser = await storage.setSelfExclusion(userId, durationDays);
      res.json({ success: true, user: updatedUser });
    } catch (error: any) {
      console.error("Error setting self-exclusion:", error);
      res.status(400).json({ message: error.message || "Failed to set self-exclusion" });
    }
  });

  app.post("/api/user/cool-off", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { durationHours } = req.body;

      if (!durationHours || typeof durationHours !== 'number' || durationHours <= 0) {
        return res.status(400).json({ message: "Valid duration in hours is required" });
      }

      const updatedUser = await storage.setCoolOff(userId, durationHours);
      res.json({ success: true, user: updatedUser });
    } catch (error: any) {
      console.error("Error setting cool-off:", error);
      res.status(400).json({ message: error.message || "Failed to set cool-off timer" });
    }
  });

  // Privacy settings routes
  app.patch("/api/user/privacy", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { statsVisibility, betaFeaturesEnabled } = req.body;

      const updates: any = {};
      if (statsVisibility) updates.statsVisibility = statsVisibility;
      if (betaFeaturesEnabled !== undefined) updates.betaFeaturesEnabled = betaFeaturesEnabled;

      const updatedUser = await storage.updatePrivacySettings(userId, updates);
      res.json({ success: true, user: updatedUser });
    } catch (error: any) {
      console.error("Error updating privacy settings:", error);
      res.status(400).json({ message: error.message || "Failed to update privacy settings" });
    }
  });

  // Referral code routes
  app.get("/api/user/referral-code", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const referralCode = await storage.getReferralCode(userId);
      res.json({ referralCode });
    } catch (error: any) {
      console.error("Error getting referral code:", error);
      res.status(500).json({ message: error.message || "Failed to get referral code" });
    }
  });

  app.post("/api/user/referral-code/generate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const referralCode = await storage.generateReferralCode(userId);
      res.json({ success: true, referralCode });
    } catch (error: any) {
      console.error("Error generating referral code:", error);
      res.status(400).json({ message: error.message || "Failed to generate referral code" });
    }
  });

  // Account closure route
  app.post("/api/user/request-closure", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { reason } = req.body;

      if (!reason || typeof reason !== 'string') {
        return res.status(400).json({ message: "Closure reason is required" });
      }

      const updatedUser = await storage.requestAccountClosure(userId, reason);
      res.json({ success: true, message: "Account closure request submitted" });
    } catch (error: any) {
      console.error("Error requesting account closure:", error);
      res.status(400).json({ message: error.message || "Failed to request account closure" });
    }
  });

  // Get all achievements
  app.get("/api/achievements", async (req, res) => {
    try {
      const achievements = await storage.getAllAchievements();
      res.json(achievements);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  // Get user's achievements
  app.get("/api/user/achievements", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userAchievements = await storage.getUserAchievements(userId);
      res.json(userAchievements);
    } catch (error) {
      console.error("Error fetching user achievements:", error);
      res.status(500).json({ message: "Failed to fetch user achievements" });
    }
  });

  // ─── Public User Profile Routes ──────────────────────────────────────────

  // Public profile (sanitized - no balance or private data)
  app.get("/api/users/:userId", async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.isBanned) return res.status(404).json({ message: "User not found" });

      // Return sanitized public profile
      res.json({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        username: user.username,
        profileImageUrl: user.profileImageUrl,
        country: user.country,
        nicknameColor: user.nicknameColor,
        level: user.level,
        xp: user.xp,
        statsVisibility: user.statsVisibility,
        chessRating: user.chessRating,
        miniGolfRating: user.miniGolfRating,
        connect4Rating: user.connect4Rating,
        airHockeyRating: user.airHockeyRating,
        rockPaperScissorsRating: user.rockPaperScissorsRating,
        dotsAndBoxesRating: user.dotsAndBoxesRating,
        eightBallRating: user.eightBallRating,
        bowlingRating: user.bowlingRating,
        cupKingRating: user.cupKingRating,
        stackTowerRating: user.stackTowerRating,
        basketballRating: user.basketballRating,
        footballRating: user.footballRating,
        racingRating: user.racingRating,
        chessWinStreak: user.chessWinStreak,
        loginStreak: user.loginStreak,
        longestStreak: user.longestStreak,
        createdAt: user.createdAt,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  // Public user stats
  app.get("/api/users/:userId/stats", async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      if (!user || user.isBanned) return res.status(404).json({ message: "User not found" });
      if (user.statsVisibility === "private") {
        const requestingUserId = req.user?.claims?.sub;
        if (requestingUserId !== userId) return res.status(403).json({ message: "Stats are private" });
      }
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });

  // Public user achievements
  app.get("/api/users/:userId/achievements", async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      if (!user || user.isBanned) return res.status(404).json({ message: "User not found" });
      const achievements = await storage.getUserAchievements(userId);
      res.json(achievements);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user achievements" });
    }
  });

  // Public user recent matches
  app.get("/api/users/:userId/matches/recent", async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      if (!user || user.isBanned) return res.status(404).json({ message: "User not found" });
      if (user.statsVisibility === "private") {
        const requestingUserId = req.user?.claims?.sub;
        if (requestingUserId !== userId) return res.status(403).json({ message: "Stats are private" });
      }
      const matches = await storage.getUserRecentMatches(userId, 10);
      res.json(matches);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user matches" });
    }
  });

  app.get("/api/users/:userId/friends", async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      if (!user || user.isBanned) return res.status(404).json({ message: "User not found" });
      if (user.statsVisibility === "private") {
        const requestingUserId = req.user?.claims?.sub;
        if (requestingUserId !== userId) return res.json([]);
      }
      const friendships = await storage.getUserFriends(userId);
      const friendList = friendships
        .filter(f => f.status === "accepted")
        .map(f => {
          const friend = f.requesterId === userId ? f.addressee : f.requester;
          return {
            friendshipId: f.id,
            userId: friend?.id,
            userName: friend?.firstName || friend?.email?.split('@')[0] || "Unknown",
            profileImageUrl: friend?.profileImageUrl || null,
          };
        });
      res.json(friendList);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch friends" });
    }
  });

  // ─── In-Memory Notification System ───────────────────────────────────────

  const pushNotification = _pushNotification;

  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    res.json(getNotifications(userId));
  });

  app.post("/api/notifications/read-all", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    markAllRead(userId);
    res.json({ success: true });
  });

  app.post("/api/notifications/read/:id", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    markRead(userId, req.params.id);
    res.json({ success: true });
  });

  // Demo: seed a couple of welcome notifications for new users on first fetch
  app.post("/api/notifications/welcome", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    if (!hasNotifications(userId)) {
      pushNotification(userId, { type: "system", title: "Welcome to Jango.us!", body: "Your account is ready. Add funds and start competing." });
      pushNotification(userId, { type: "achievement", title: "Achievement Unlocked", body: "Create an account — you've joined the arena.", linkTo: "/dashboard" });
    }
    res.json({ success: true });
  });

  // Wallet routes
  app.get("/api/wallet/balance", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ balance: user.balance });
    } catch (error) {
      console.error("Error fetching balance:", error);
      res.status(500).json({ message: "Failed to fetch balance" });
    }
  });

  // Create Stripe payment intent for deposit - referencing blueprint:javascript_stripe
  app.post("/api/wallet/create-deposit-intent", isAuthenticated, async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ message: "Payment processing is currently unavailable" });
      }

      const userId = req.user.claims.sub;
      const { amount } = req.body;

      if (!amount || isNaN(amount) || amount <= 0 || amount > 10000) {
        return res.status(400).json({ message: "Invalid deposit amount (must be between $1 and $10,000)" });
      }

      // Check / auto-verify user — Replit Auth users are inherently verified
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.isEmailVerified) {
        // Auto-verify: all users log in via Replit Auth which already verifies email
        await storage.updateEmailVerification(userId, true);
      }

      // Create or get Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          name: user.username || undefined,
          metadata: { userId },
        });
        customerId = customer.id;
        await storage.updateStripeCustomerId(userId, customerId);
      }

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: user.currencyDisplay?.toLowerCase() || "usd",
        customer: customerId,
        metadata: {
          userId,
          type: "deposit",
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      console.error("[STRIPE] Error creating payment intent:", error);
      res.status(500).json({ message: error.message || "Failed to create payment intent" });
    }
  });

  // Stripe webhook for payment confirmations — MUST verify signature, no dev bypass
  app.post("/api/stripe/webhook", async (req, res) => {
    if (!stripe) {
      return res.status(503).send("Stripe not configured");
    }

    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      // Without a webhook secret we cannot safely verify events — refuse to process
      console.error('[STRIPE] STRIPE_WEBHOOK_SECRET not set — webhook processing disabled for security');
      return res.status(400).send("Webhook secret not configured");
    }

    if (!sig) {
      console.warn('[STRIPE] Webhook received without stripe-signature header — rejected');
      return res.status(400).send("Missing stripe-signature header");
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error('[STRIPE] Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook signature invalid: ${err.message}`);
    }

    try {
      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const { userId, type } = paymentIntent.metadata;

        if (type === 'deposit' && userId) {
          const amount = paymentIntent.amount / 100; // Convert from cents
          // Idempotency: use payment intent ID as deduplication key
          const alreadyProcessed = await storage.checkPaymentEventProcessed('stripe', paymentIntent.id);
          if (!alreadyProcessed) {
            await storage.addFunds(userId, amount);
            await storage.recordPaymentEvent('stripe', paymentIntent.id, event.type, paymentIntent);
            console.log(`[STRIPE] Deposit of $${amount} credited to user ${userId} (intent: ${paymentIntent.id})`);
          } else {
            console.log(`[STRIPE] Duplicate webhook for ${paymentIntent.id} — skipped`);
          }
        }
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('[STRIPE] Webhook processing error:', error.message);
      res.status(500).send("Internal error processing webhook");
    }
  });

  // ─── Saved Cards ──────────────────────────────────────────────────────────
  // Create a Stripe SetupIntent so the client can collect card details securely
  app.post("/api/stripe/setup-intent", isAuthenticated, async (req: any, res) => {
    if (!stripe) return res.status(503).json({ message: "Stripe not configured" });
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Ensure Stripe customer exists
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          name: user.username || undefined,
          metadata: { userId },
        });
        customerId = customer.id;
        await storage.updateStripeCustomerId(userId, customerId);
      }

      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ["card"],
        usage: "off_session",
        metadata: { userId },
      });

      res.json({ clientSecret: setupIntent.client_secret, customerId });
    } catch (error: any) {
      console.error("[STRIPE] Error creating setup intent:", error);
      res.status(500).json({ message: error.message || "Failed to create setup intent" });
    }
  });

  // List saved cards
  app.get("/api/cards", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const cards = await storage.getSavedCards(userId);
      res.json(cards);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Save a card after Stripe SetupIntent confirmed
  app.post("/api/cards", isAuthenticated, async (req: any, res) => {
    if (!stripe) return res.status(503).json({ message: "Stripe not configured" });
    try {
      const userId = req.user.claims.sub;
      const { paymentMethodId, nickname, billingZip, isDefault } = req.body;

      if (!paymentMethodId) return res.status(400).json({ message: "paymentMethodId is required" });

      // Retrieve payment method from Stripe to get card details
      const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
      if (!pm.card) return res.status(400).json({ message: "Not a card payment method" });

      // Attach to customer if not already
      const user = await storage.getUser(userId);
      if (user?.stripeCustomerId && pm.customer !== user.stripeCustomerId) {
        await stripe.paymentMethods.attach(paymentMethodId, { customer: user.stripeCustomerId });
      }

      const card = await storage.createSavedCard({
        userId,
        stripePaymentMethodId: paymentMethodId,
        brand: pm.card.brand || "visa",
        last4: pm.card.last4,
        expiryMonth: pm.card.exp_month,
        expiryYear: pm.card.exp_year,
        cardholderName: (pm.billing_details.name as string) || "",
        billingZip: billingZip || pm.billing_details.address?.postal_code || null,
        nickname: nickname || null,
        isDefault: isDefault ?? false,
      });

      res.json(card);
    } catch (error: any) {
      console.error("[STRIPE] Error saving card:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update card metadata (nickname, billingZip, expiry)
  app.patch("/api/cards/:cardId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { cardId } = req.params;
      const existing = await storage.getSavedCard(cardId);
      if (!existing || existing.userId !== userId) return res.status(404).json({ message: "Card not found" });

      const { nickname, billingZip, expiryMonth, expiryYear } = req.body;
      const updates: any = {};
      if (nickname !== undefined) updates.nickname = nickname;
      if (billingZip !== undefined) updates.billingZip = billingZip;
      if (expiryMonth !== undefined) updates.expiryMonth = expiryMonth;
      if (expiryYear !== undefined) updates.expiryYear = expiryYear;

      const card = await storage.updateSavedCard(cardId, updates);
      res.json(card);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Set default card
  app.post("/api/cards/:cardId/set-default", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { cardId } = req.params;
      const existing = await storage.getSavedCard(cardId);
      if (!existing || existing.userId !== userId) return res.status(404).json({ message: "Card not found" });
      await storage.setDefaultCard(userId, cardId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete saved card
  app.delete("/api/cards/:cardId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { cardId } = req.params;
      const existing = await storage.getSavedCard(cardId);
      if (!existing || existing.userId !== userId) return res.status(404).json({ message: "Card not found" });

      // Detach from Stripe if configured
      if (stripe && existing.stripePaymentMethodId) {
        try {
          await stripe.paymentMethods.detach(existing.stripePaymentMethodId);
        } catch {
          // Non-fatal – continue deletion
        }
      }

      await storage.deleteSavedCard(cardId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  // ──────────────────────────────────────────────────────────────────────────

  app.get("/api/wallet/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const transactions = await storage.getUserTransactions(userId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Crypto payment routes - Create crypto deposit
  app.post("/api/wallet/crypto/deposit", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { amount, currency } = req.body;

      // Validate amount
      const depositAmount = parseFloat(amount);
      if (!amount || isNaN(depositAmount) || depositAmount <= 0 || depositAmount > 10000) {
        return res.status(400).json({ message: "Invalid deposit amount (must be between $1 and $10,000)" });
      }

      // Validate currency
      const validCurrencies = ["btc", "eth", "sol"];
      if (!currency || !validCurrencies.includes(currency.toLowerCase())) {
        return res.status(400).json({ message: "Invalid cryptocurrency. Supported: BTC, ETH, SOL" });
      }

      // Check / auto-verify user — Replit Auth users are inherently verified
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.isEmailVerified) {
        // Auto-verify: all users log in via Replit Auth which already verifies email
        await storage.updateEmailVerification(userId, true);
      }

      // Generate deposit address (mock for now - in production would call NOWPayments API)
      const cryptoAddresses: Record<string, string> = {
        btc: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
        eth: "0x742d35Cc6634C0532925a3b844Bc9e7595f3b2D2",
        sol: "DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy",
      };

      // Get current crypto prices (mock - in production would call price API)
      const cryptoPrices: Record<string, number> = {
        btc: 42500,
        eth: 2250,
        sol: 105,
      };

      const cryptoCurrency = currency.toLowerCase();
      const cryptoPrice = cryptoPrices[cryptoCurrency];
      const amountCrypto = (depositAmount / cryptoPrice).toFixed(8);

      // Create pending crypto payment record
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes expiry
      const paymentId = `crypto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const cryptoPayment = await storage.createCryptoPayment({
        userId,
        type: "deposit",
        currency: cryptoCurrency,
        amountCrypto,
        amountUsd: depositAmount.toFixed(2),
        walletAddress: cryptoAddresses[cryptoCurrency],
        paymentId,
        status: "pending",
        expiresAt,
      });

      res.json({
        success: true,
        paymentId: cryptoPayment.id,
        walletAddress: cryptoAddresses[cryptoCurrency],
        amountCrypto,
        amountUsd: depositAmount,
        currency: cryptoCurrency.toUpperCase(),
        expiresAt: expiresAt.toISOString(),
        cryptoPrice,
      });
    } catch (error: any) {
      console.error("[CRYPTO] Error creating deposit:", error);
      res.status(500).json({ message: error.message || "Failed to create crypto deposit" });
    }
  });

  // Get crypto payment status
  app.get("/api/wallet/crypto/status/:paymentId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { paymentId } = req.params;

      const payment = await storage.getCryptoPayment(paymentId);
      if (!payment || payment.userId !== userId) {
        return res.status(404).json({ message: "Payment not found" });
      }

      res.json({
        id: payment.id,
        status: payment.status,
        currency: payment.currency,
        amountCrypto: payment.amountCrypto,
        amountUsd: payment.amountUsd,
        walletAddress: payment.walletAddress,
        txHash: payment.txHash,
        expiresAt: payment.expiresAt,
        confirmedAt: payment.confirmedAt,
      });
    } catch (error: any) {
      console.error("[CRYPTO] Error fetching payment status:", error);
      res.status(500).json({ message: "Failed to fetch payment status" });
    }
  });

  // Get user's crypto payment history
  app.get("/api/wallet/crypto/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const payments = await storage.getUserCryptoPayments(userId);
      res.json(payments);
    } catch (error: any) {
      console.error("[CRYPTO] Error fetching payment history:", error);
      res.status(500).json({ message: "Failed to fetch payment history" });
    }
  });

  // Crypto webhook for payment confirmations (called by NOWPayments or similar provider)
  // SECURITY: verify HMAC signature when NOWPAYMENTS_WEBHOOK_SECRET is set
  app.post("/api/crypto/webhook", async (req, res) => {
    try {
      // Signature verification when secret is configured
      const webhookSecret = process.env.NOWPAYMENTS_WEBHOOK_SECRET;
      if (webhookSecret) {
        const sig = req.headers['x-nowpayments-sig'] as string | undefined;
        if (!sig) {
          console.warn('[CRYPTO] Webhook missing x-nowpayments-sig header — rejected');
          return res.status(401).json({ message: "Missing webhook signature" });
        }
        // Verify HMAC-SHA512 signature
        const crypto = await import('crypto');
        const sortedBody = JSON.stringify(
          Object.keys(req.body).sort().reduce((acc: any, k) => { acc[k] = req.body[k]; return acc; }, {})
        );
        const expectedSig = crypto.createHmac('sha512', webhookSecret).update(sortedBody).digest('hex');
        if (sig !== expectedSig) {
          console.warn('[CRYPTO] Webhook signature mismatch — rejected');
          return res.status(401).json({ message: "Invalid webhook signature" });
        }
      }

      const { payment_id, payment_status } = req.body;

      if (!payment_id) {
        return res.status(400).json({ message: "Missing payment_id" });
      }

      const payment = await storage.getCryptoPaymentByExternalId(payment_id);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      // Idempotency: never re-process an already confirmed payment
      if (payment.status === "confirmed") {
        console.log(`[CRYPTO] Duplicate webhook for payment ${payment.id} — already confirmed, skipped`);
        return res.json({ received: true, note: "already processed" });
      }

      // Update payment status based on webhook
      let newStatus = payment.status;
      if (payment_status === "confirming" || payment_status === "partially_paid") {
        newStatus = "confirming";
      } else if (payment_status === "confirmed" || payment_status === "finished") {
        newStatus = "confirmed";
        // ONLY credit balance after real blockchain confirmation — never from frontend
        await storage.addFunds(payment.userId, parseFloat(payment.amountUsd));
        await storage.recordPaymentEvent('crypto', payment_id, payment_status, req.body);
        console.log(`[CRYPTO] Deposit of $${payment.amountUsd} credited to user ${payment.userId} (payment: ${payment.id})`);
      } else if (payment_status === "expired") {
        newStatus = "expired";
      } else if (payment_status === "failed" || payment_status === "refunded") {
        newStatus = "failed";
      }

      await storage.updateCryptoPaymentStatus(payment.id, newStatus);
      res.json({ received: true });
    } catch (error: any) {
      console.error("[CRYPTO] Webhook error:", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // Get current crypto prices
  app.get("/api/crypto/prices", async (req, res) => {
    try {
      // Mock prices - in production would call CoinGecko/CMC API
      const prices = {
        btc: { usd: 42500, change24h: 2.5 },
        eth: { usd: 2250, change24h: 1.8 },
        sol: { usd: 105, change24h: 4.2 },
      };
      res.json(prices);
    } catch (error: any) {
      console.error("[CRYPTO] Error fetching prices:", error);
      res.status(500).json({ message: "Failed to fetch crypto prices" });
    }
  });

  // Admin routes
  app.get("/api/admin/users", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const users = await storage.getAllUsers(limit, offset);
      res.json(users);
    } catch (error) {
      console.error("[ADMIN] Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch("/api/admin/users/:userId/admin-status", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { isAdmin: adminStatus } = req.body;

      if (typeof adminStatus !== "boolean") {
        return res.status(400).json({ message: "isAdmin must be a boolean" });
      }

      const user = await storage.updateUserAdminStatus(userId, adminStatus);
      res.json(user);
    } catch (error) {
      console.error("[ADMIN] Error updating admin status:", error);
      res.status(500).json({ message: "Failed to update admin status" });
    }
  });

  app.patch("/api/admin/users/:userId/balance", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { balance } = req.body;

      if (!balance || isNaN(parseFloat(balance))) {
        return res.status(400).json({ message: "Invalid balance value" });
      }

      const user = await storage.updateUserBalanceAdmin(userId, parseFloat(balance).toFixed(2));
      res.json(user);
    } catch (error) {
      console.error("[ADMIN] Error updating user balance:", error);
      res.status(500).json({ message: "Failed to update user balance" });
    }
  });

  app.post("/api/admin/users/:userId/ban", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.banUser(userId);
      res.json(user);
    } catch (error) {
      console.error("[ADMIN] Error banning user:", error);
      res.status(500).json({ message: "Failed to ban user" });
    }
  });

  app.post("/api/admin/users/:userId/unban", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.unbanUser(userId);
      res.json(user);
    } catch (error) {
      console.error("[ADMIN] Error unbanning user:", error);
      res.status(500).json({ message: "Failed to unban user" });
    }
  });

  app.patch("/api/admin/users/:userId/email-verification", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { isEmailVerified } = req.body;

      if (typeof isEmailVerified !== "boolean") {
        return res.status(400).json({ message: "isEmailVerified must be a boolean" });
      }

      const user = await storage.updateEmailVerification(userId, isEmailVerified);
      res.json(user);
    } catch (error) {
      console.error("[ADMIN] Error updating email verification:", error);
      res.status(500).json({ message: "Failed to update email verification" });
    }
  });

  app.patch("/api/admin/users/:userId/verified-account", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { isVerifiedAccount } = req.body;

      if (typeof isVerifiedAccount !== "boolean") {
        return res.status(400).json({ message: "isVerifiedAccount must be a boolean" });
      }

      const user = await storage.updateVerifiedAccountBadge(userId, isVerifiedAccount);
      res.json(user);
    } catch (error) {
      console.error("[ADMIN] Error updating verified account badge:", error);
      res.status(500).json({ message: "Failed to update verified account badge" });
    }
  });

  app.get("/api/admin/analytics", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const analytics = await storage.getPlatformAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("[ADMIN] Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  app.get("/api/admin/transactions", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId, type, startDate, endDate, limit, offset } = req.query;
      
      const filters: any = {};
      
      if (userId) filters.userId = userId as string;
      if (type) filters.type = type as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (limit) filters.limit = parseInt(limit as string);
      if (offset) filters.offset = parseInt(offset as string);
      
      const transactions = await storage.getAllTransactions(filters);
      res.json(transactions);
    } catch (error) {
      console.error("[ADMIN] Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.get("/api/admin/analytics/revenue-by-game", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      
      const revenue = await storage.getRevenueByGameType(start, end);
      res.json(revenue);
    } catch (error) {
      console.error("[ADMIN] Error fetching revenue by game:", error);
      res.status(500).json({ message: "Failed to fetch revenue by game" });
    }
  });

  // Game settings routes
  app.get("/api/admin/game-settings", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const settings = await storage.getGameSettings();
      res.json(settings);
    } catch (error) {
      console.error("[ADMIN] Error fetching game settings:", error);
      res.status(500).json({ message: "Failed to fetch game settings" });
    }
  });

  app.patch("/api/admin/game-settings", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { insertGameSettingsSchema } = await import("@shared/schema");
      const settings = insertGameSettingsSchema.parse(req.body);
      
      // Additional validation for sensible values
      const platformRake = parseFloat(settings.platformRake ?? "0");
      const minBet = parseFloat(settings.minBet ?? "0");
      const maxBet = parseFloat(settings.maxBet ?? "0");
      const newUserBonus = parseFloat(settings.newUserBonus ?? "0");
      
      if (platformRake < 0 || platformRake > 20) {
        return res.status(400).json({ message: "Platform rake must be between 0% and 20%" });
      }
      
      if (minBet <= 0) {
        return res.status(400).json({ message: "Minimum bet must be greater than 0" });
      }
      
      if (maxBet < minBet) {
        return res.status(400).json({ message: "Maximum bet must be greater than or equal to minimum bet" });
      }
      
      if (newUserBonus < 0) {
        return res.status(400).json({ message: "New user bonus cannot be negative" });
      }
      
      const updated = await storage.updateGameSettings(settings);
      res.json(updated);
    } catch (error: any) {
      console.error("[ADMIN] Error updating game settings:", error);
      
      // Return validation errors with details
      if (error.name === "ZodError") {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: "Failed to update game settings" });
    }
  });

  // Admin simulation endpoint - simulate bot games with betting to generate stats
  app.post("/api/admin/simulate-games", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { gameType, count, betAmount, difficulty, userId } = req.body;
      
      // Validate inputs
      if (!gameType || !count || !betAmount || !difficulty || !userId) {
        return res.status(400).json({ message: "Missing required fields: gameType, count, betAmount, difficulty, userId" });
      }
      
      // Parse and validate numeric inputs
      const numGames = Number(count);
      const bet = Number(betAmount);
      
      // Check for NaN and infinite values
      if (!Number.isFinite(numGames) || !Number.isFinite(bet)) {
        return res.status(400).json({ message: "Count and bet amount must be valid, finite numbers" });
      }
      
      // Ensure count is an integer
      if (!Number.isInteger(numGames)) {
        return res.status(400).json({ message: "Count must be a whole number" });
      }
      
      if (numGames <= 0 || numGames > 50) {
        return res.status(400).json({ message: "Count must be between 1 and 50" });
      }
      
      if (bet <= 0) {
        return res.status(400).json({ message: "Bet amount must be greater than 0" });
      }
      
      // Enforce reasonable maximum bet to prevent numeric overflow
      const MAX_BET = 1000000; // $1 million per game
      if (bet > MAX_BET) {
        return res.status(400).json({ message: `Bet amount cannot exceed $${MAX_BET.toLocaleString()}` });
      }
      
      // Validate game type
      const validGameTypes = ["chess", "mini-golf", "connect-4", "air-hockey", "rock-paper-scissors", "dots-and-boxes", "8-ball", "bowling", "cup-king", "stack-tower", "basketball", "football", "racing"];
      if (!validGameTypes.includes(gameType)) {
        return res.status(400).json({ message: "Invalid game type" });
      }
      
      // Validate difficulty
      const validDifficulties = ["easy", "medium", "hard"];
      if (!validDifficulties.includes(difficulty)) {
        return res.status(400).json({ message: "Invalid difficulty level" });
      }
      
      // Check if user exists and has enough balance
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Calculate total required and verify it's finite
      const totalRequired = bet * numGames;
      if (!Number.isFinite(totalRequired)) {
        return res.status(400).json({ message: "Total bet amount calculation overflow - please reduce bet amount or game count" });
      }
      
      // Verify user has sufficient balance for all games
      const currentBalance = parseFloat(user.balance || "0");
      if (currentBalance < totalRequired) {
        return res.status(400).json({ 
          message: `Insufficient balance. Required: $${totalRequired.toFixed(2)}, Available: $${currentBalance.toFixed(2)}` 
        });
      }
      
      const results = [];
      
      for (let i = 0; i < numGames; i++) {
        try {
          // Create bot match with bet
          const bot = await storage.getOrCreateBot(difficulty);
          const match = await storage.createMatchWithBet({
            gameType,
            player1Id: userId,
            player2Id: bot.id,
            status: "in-progress",
            isBotMatch: true,
            botDifficulty: difficulty,
          }, betAmount);
          
          // Simulate the game based on game type
          let winnerId: string | null = null;
          let player1Score = 0;
          let player2Score = 0;
          
          // Randomly determine winner (60% player, 40% bot for easy/medium, 50/50 for hard)
          const winChance = difficulty === "hard" ? 0.5 : difficulty === "medium" ? 0.6 : 0.7;
          const playerWins = Math.random() < winChance;
          winnerId = playerWins ? userId : bot.id;
          
          // Set scores based on game type
          if (gameType === "chess" || gameType === "connect-4") {
            player1Score = playerWins ? 1 : 0;
            player2Score = playerWins ? 0 : 1;
          } else if (gameType === "mini-golf") {
            player1Score = playerWins ? 12 : 15;
            player2Score = playerWins ? 15 : 12;
          } else if (gameType === "air-hockey") {
            player1Score = playerWins ? 7 : Math.floor(Math.random() * 7);
            player2Score = playerWins ? Math.floor(Math.random() * 7) : 7;
          } else if (gameType === "rock-paper-scissors") {
            player1Score = playerWins ? 3 : Math.floor(Math.random() * 3);
            player2Score = playerWins ? Math.floor(Math.random() * 3) : 3;
          } else if (gameType === "dots-and-boxes") {
            const totalBoxes = 16;
            if (playerWins) {
              player1Score = Math.floor(totalBoxes / 2) + 1 + Math.floor(Math.random() * 3);
              player2Score = totalBoxes - player1Score;
            } else {
              player2Score = Math.floor(totalBoxes / 2) + 1 + Math.floor(Math.random() * 3);
              player1Score = totalBoxes - player2Score;
            }
          } else if (gameType === "8-ball") {
            player1Score = playerWins ? 1 : 0;
            player2Score = playerWins ? 0 : 1;
          } else if (gameType === "bowling") {
            player1Score = playerWins ? 180 + Math.floor(Math.random() * 50) : 120 + Math.floor(Math.random() * 40);
            player2Score = playerWins ? 120 + Math.floor(Math.random() * 40) : 180 + Math.floor(Math.random() * 50);
          } else if (gameType === "cup-king") {
            player1Score = playerWins ? 6 : Math.floor(Math.random() * 6);
            player2Score = playerWins ? Math.floor(Math.random() * 6) : 6;
          } else if (gameType === "stack-tower") {
            player1Score = playerWins ? 15 + Math.floor(Math.random() * 10) : 8 + Math.floor(Math.random() * 7);
            player2Score = playerWins ? 8 + Math.floor(Math.random() * 7) : 15 + Math.floor(Math.random() * 10);
          } else if (gameType === "basketball") {
            player1Score = playerWins ? 12 + Math.floor(Math.random() * 8) : 4 + Math.floor(Math.random() * 8);
            player2Score = playerWins ? 4 + Math.floor(Math.random() * 8) : 12 + Math.floor(Math.random() * 8);
          } else if (gameType === "football") {
            player1Score = playerWins ? 14 + Math.floor(Math.random() * 3) * 7 : 0 + Math.floor(Math.random() * 2) * 7;
            player2Score = playerWins ? 0 + Math.floor(Math.random() * 2) * 7 : 14 + Math.floor(Math.random() * 3) * 7;
          } else if (gameType === "racing") {
            player1Score = playerWins ? 850 + Math.floor(Math.random() * 100) : 600 + Math.floor(Math.random() * 150);
            player2Score = playerWins ? 600 + Math.floor(Math.random() * 150) : 850 + Math.floor(Math.random() * 100);
          }
          
          // Complete the match
          const completedMatch = await storage.completeMatch(match.id, winnerId, player1Score, player2Score);
          
          // Check and award achievements
          await achievementService.checkAndAwardAchievements(completedMatch);
          
          results.push({
            matchId: completedMatch.id,
            gameType,
            winner: playerWins ? "player" : "bot",
            score: `${player1Score}-${player2Score}`,
          });
          
          // Small delay to avoid overwhelming the database
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error: any) {
          console.error(`[ADMIN] Error simulating game ${i + 1}:`, error);
          results.push({
            error: error.message,
            gameNumber: i + 1,
          });
        }
      }
      
      res.json({ 
        success: true,
        gamesSimulated: results.length,
        results,
      });
    } catch (error: any) {
      console.error("[ADMIN] Error simulating games:", error);
      res.status(500).json({ message: error.message || "Failed to simulate games" });
    }
  });

  // Admin Reports
  app.get("/api/admin/reports", isAuthenticated, isAdmin, async (_req: any, res) => {
    try {
      const reports = await db.execute(drizzleSql`
        SELECT
          pr.id, pr.reason, pr.details, pr.status, pr.created_at,
          r.id AS reporter_id, r.username AS reporter_username, r.first_name AS reporter_first_name,
          u.id AS reported_id, u.username AS reported_username, u.first_name AS reported_first_name, u.reputation AS reported_reputation,
          pr.match_id
        FROM player_reports pr
        LEFT JOIN users r ON r.id = pr.reporter_id
        LEFT JOIN users u ON u.id = pr.reported_user_id
        ORDER BY pr.created_at DESC
        LIMIT 200
      `);
      res.json(reports.rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch reports" });
    }
  });

  app.patch("/api/admin/reports/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    const { id } = req.params;
    const { status } = req.body; // "pending" | "reviewed" | "dismissed" | "actioned"
    if (!["pending", "reviewed", "dismissed", "actioned"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    try {
      await db.execute(drizzleSql`UPDATE player_reports SET status = ${status} WHERE id = ${id}::uuid`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to update report" });
    }
  });

  /** GET /api/admin/moderation — fetch moderation log */
  app.get("/api/admin/moderation", isAuthenticated, isAdmin, async (_req: any, res) => {
    try {
      const rows = await db.execute(drizzleSql`
        SELECT
          ma.id, ma.action_type, ma.reason, ma.duration_hours, ma.expires_at, ma.created_at,
          ma.related_report_id,
          adm.id AS admin_id, adm.username AS admin_username, adm.first_name AS admin_first_name,
          tgt.id AS target_id, tgt.username AS target_username, tgt.first_name AS target_first_name,
          tgt.reputation AS target_reputation, tgt.is_banned AS target_is_banned
        FROM moderation_actions ma
        LEFT JOIN users adm ON adm.id = ma.admin_id
        LEFT JOIN users tgt ON tgt.id = ma.target_user_id
        ORDER BY ma.created_at DESC
        LIMIT 200
      `);
      res.json(rows.rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch moderation log" });
    }
  });

  /** GET /api/admin/moderation/dashboard — aggregated stats for moderation dashboard */
  app.get("/api/admin/moderation/dashboard", isAuthenticated, isAdmin, async (_req: any, res) => {
    try {
      const [reportsByPlayer, highReputation, recentActions] = await Promise.all([
        db.execute(drizzleSql`
          SELECT
            u.id, u.username, u.first_name, u.reputation, u.is_banned,
            COUNT(pr.id)::int AS report_count,
            MAX(pr.created_at) AS last_reported_at
          FROM users u
          LEFT JOIN player_reports pr ON pr.reported_user_id = u.id
          GROUP BY u.id, u.username, u.first_name, u.reputation, u.is_banned
          HAVING COUNT(pr.id) > 0
          ORDER BY report_count DESC
          LIMIT 20
        `),
        db.execute(drizzleSql`
          SELECT id, username, first_name, reputation, is_banned
          FROM users
          WHERE reputation < 60
          ORDER BY reputation ASC
          LIMIT 20
        `),
        db.execute(drizzleSql`
          SELECT
            ma.id, ma.action_type, ma.reason, ma.created_at, ma.expires_at,
            adm.username AS admin_username, adm.first_name AS admin_first_name,
            tgt.username AS target_username, tgt.first_name AS target_first_name, tgt.reputation AS target_reputation
          FROM moderation_actions ma
          LEFT JOIN users adm ON adm.id = ma.admin_id
          LEFT JOIN users tgt ON tgt.id = ma.target_user_id
          ORDER BY ma.created_at DESC
          LIMIT 10
        `),
      ]);
      res.json({
        reportsByPlayer: reportsByPlayer.rows,
        lowReputationPlayers: highReputation.rows,
        recentActions: recentActions.rows,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch moderation dashboard" });
    }
  });

  /** POST /api/admin/moderation/action — take a moderation action */
  app.post("/api/admin/moderation/action", isAuthenticated, isAdmin, async (req: any, res) => {
    const adminId = req.user.claims.sub;
    const { targetUserId, actionType, reason, durationHours, relatedReportId } = req.body;

    if (!targetUserId || !actionType || !reason) {
      return res.status(400).json({ message: "targetUserId, actionType, and reason are required" });
    }

    const validActions = ["warning", "temp_ban", "wager_restriction", "chat_mute", "permanent_ban", "dismiss_report", "unban", "unmute", "unrestrict"];
    if (!validActions.includes(actionType)) {
      return res.status(400).json({ message: "Invalid action type" });
    }

    try {
      const expiresAt = durationHours
        ? new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString()
        : null;

      // Log the action
      await db.insert(moderationActions).values({
        adminId,
        targetUserId,
        relatedReportId: relatedReportId ?? null,
        actionType,
        reason,
        durationHours: durationHours ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      // Apply the action to the user record
      if (actionType === "permanent_ban") {
        await db.execute(drizzleSql`UPDATE users SET is_banned = true WHERE id = ${targetUserId}`);
      } else if (actionType === "temp_ban") {
        await db.execute(drizzleSql`UPDATE users SET temp_ban_until = ${expiresAt} WHERE id = ${targetUserId}`);
      } else if (actionType === "chat_mute") {
        await db.execute(drizzleSql`UPDATE users SET chat_muted_until = ${expiresAt} WHERE id = ${targetUserId}`);
      } else if (actionType === "wager_restriction") {
        await db.execute(drizzleSql`UPDATE users SET wager_restricted_until = ${expiresAt} WHERE id = ${targetUserId}`);
      } else if (actionType === "warning") {
        // Decrement reputation by 5 for a warning
        await db.execute(drizzleSql`UPDATE users SET reputation = GREATEST(0, reputation - 5) WHERE id = ${targetUserId}`);
      } else if (actionType === "unban") {
        await db.execute(drizzleSql`UPDATE users SET is_banned = false, temp_ban_until = NULL WHERE id = ${targetUserId}`);
      } else if (actionType === "unmute") {
        await db.execute(drizzleSql`UPDATE users SET chat_muted_until = NULL WHERE id = ${targetUserId}`);
      } else if (actionType === "unrestrict") {
        await db.execute(drizzleSql`UPDATE users SET wager_restricted_until = NULL WHERE id = ${targetUserId}`);
      }

      // Update related report status if provided
      if (relatedReportId) {
        await db.execute(drizzleSql`UPDATE player_reports SET status = 'actioned' WHERE id = ${relatedReportId}::uuid`);
      }

      // Notify the target user
      try {
        const notifType =
          actionType === "warning" ? "moderation_warning" as const :
          actionType === "permanent_ban" || actionType === "temp_ban" ? "moderation_ban" as const :
          actionType === "chat_mute" ? "moderation_mute" as const :
          actionType === "wager_restriction" ? "moderation_restrict" as const : "system" as const;

        const durationText = durationHours ? ` for ${durationHours}h` : " permanently";
        const actionLabels: Record<string, string> = {
          warning: "You received a warning",
          temp_ban: `Your account has been temporarily banned${durationText}`,
          permanent_ban: "Your account has been permanently banned",
          chat_mute: `You have been muted${durationText}`,
          wager_restriction: `Your wagering has been restricted${durationText}`,
          dismiss_report: "A report was dismissed",
          unban: "Your ban has been lifted",
          unmute: "Your mute has been lifted",
          unrestrict: "Your wager restriction has been lifted",
        };
        pushNotification(targetUserId, {
          type: notifType,
          title: actionLabels[actionType] ?? "Account action",
          body: `Reason: ${reason}`,
        });
      } catch { /* non-critical */ }

      res.json({ success: true });
    } catch (err: any) {
      console.error("[MODERATION] Error:", err);
      res.status(500).json({ message: err.message || "Failed to apply moderation action" });
    }
  });

  // Match routes
  app.post("/api/matches", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = createMatchSchema.parse(req.body);

      // ── RANKED ENFORCEMENT: ranked matches are always exactly 1 Scalp ─────
      const isRanked = req.body.matchMode === "ranked";
      let { betAmount } = req.body;
      if (isRanked) {
        betAmount = "1";
      }
      if (isRanked && betAmount !== "1") {
        return res.status(400).json({ message: "Ranked matches are locked at 1 Scalp." });
      }
      // ─────────────────────────────────────────────────────────────────────

      // If bet amount is provided, validate balance first
      if (betAmount && parseFloat(betAmount) > 0) {
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        
        const balance = parseFloat(user.balance || "0");
        const bet = parseFloat(betAmount);
        
        if (balance < bet) {
          return res.status(400).json({ message: "Insufficient balance" });
        }

        // Require email verification for high-value matches (>$50)
        if (bet > 50 && !user.isEmailVerified) {
          return res.status(403).json({ 
            message: "Email verification required for matches over $50",
            requiresVerification: true 
          });
        }
      }

      // Device type sent by the client (mobile | desktop)
      const deviceType: string = req.body.deviceType === "mobile" ? "mobile" : "desktop";

      // Try to find an existing match with the same game type, bet amount, and device type
      const matchingGame = await storage.findMatchingGame(
        data.gameType as GameType,
        betAmount || "0",
        userId,
        deviceType
      );

      if (matchingGame) {
        // Auto-join the existing match
        const joinedMatch = await storage.joinMatch(matchingGame.id, userId, betAmount);
        // Notify the match creator
        if (joinedMatch.player1Id && joinedMatch.player1Id !== userId) {
          try {
            const joinerUser = await storage.getUser(userId);
            const gameLabel = joinedMatch.gameType?.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) ?? "Match";
            pushNotification(joinedMatch.player1Id, {
              type: "challenge",
              title: `${gameLabel} — Opponent joined!`,
              body: `${joinerUser?.username ?? joinerUser?.firstName ?? "A player"} has joined your match. Get ready!`,
              linkTo: `/game/${joinedMatch.id}`,
            });
          } catch { /* non-critical */ }
        }
        return res.json({ 
          match: joinedMatch,
          autoMatched: true,
          message: "Matched with an existing player!"
        });
      }

      // No match found, create new match and get available bet amounts
      const match = await storage.createMatchWithBet({
        ...data,
        player1Id: userId,
        status: "waiting",
        deviceType,
      }, betAmount);

      // Get alternative bet amounts for this game type
      const availableBetAmounts = await storage.getAvailableBetAmounts(data.gameType as GameType);

      res.json({ 
        match,
        autoMatched: false,
        availableBetAmounts: availableBetAmounts.filter(amount => amount !== betAmount)
      });
    } catch (error: any) {
      console.error("Error creating match:", error);
      res.status(400).json({ message: error.message || "Failed to create match" });
    }
  });

  app.post("/api/matches/bot", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { gameType, difficulty = "medium" } = req.body;
      
      if (!gameType) {
        return res.status(400).json({ message: "Game type is required" });
      }

      const match = await storage.createBotMatch(gameType, userId, difficulty);
      res.json(match);
    } catch (error: any) {
      console.error("Error creating bot match:", error);
      res.status(400).json({ message: error.message || "Failed to create bot match" });
    }
  });

  app.post("/api/matches/practice", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { gameType } = req.body;
      
      if (!gameType) {
        return res.status(400).json({ message: "Game type is required" });
      }
      
      const match = await storage.createPracticeMatch(gameType, userId);
      res.json(match);
    } catch (error: any) {
      console.error("Error creating practice match:", error);
      res.status(400).json({ message: error.message || "Failed to create practice match" });
    }
  });

  app.get("/api/matches", isAuthenticated, async (req, res) => {
    try {
      const matches = await storage.getAvailableMatches();
      res.json(matches);
    } catch (error) {
      console.error("Error fetching matches:", error);
      res.status(500).json({ message: "Failed to fetch matches" });
    }
  });

  app.get("/api/matches/active", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const matches = await storage.getUserActiveMatches(userId);
      res.json(matches);
    } catch (error) {
      console.error("Error fetching active matches:", error);
      res.status(500).json({ message: "Failed to fetch active matches" });
    }
  });

  app.get("/api/matches/recent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const matches = await storage.getUserRecentMatches(userId, 10);
      res.json(matches);
    } catch (error) {
      console.error("Error fetching recent matches:", error);
      res.status(500).json({ message: "Failed to fetch recent matches" });
    }
  });

  app.get("/api/matches/:id", isAuthenticated, async (req, res) => {
    try {
      const match = await storage.getMatch(req.params.id);
      if (!match) {
        return res.status(404).json({ message: "Match not found" });
      }
      res.json(match);
    } catch (error) {
      console.error("Error fetching match:", error);
      res.status(500).json({ message: "Failed to fetch match" });
    }
  });

  app.get("/api/matches/:id/my-stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const allStats = await storage.getMatchStatistics(req.params.id);
      const myStats = allStats.find((s: any) => s.userId === userId) || null;
      res.json(myStats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch match statistics" });
    }
  });

  app.post("/api/matches/:id/join", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const matchId = req.params.id;
      const { betAmount, deviceType } = req.body;

      const existingMatch = await storage.getMatch(matchId);
      if (!existingMatch) {
        return res.status(404).json({ message: "Match not found" });
      }
      if (existingMatch.status !== "waiting") {
        return res.status(400).json({ message: "Match is not available" });
      }
      // Only block self-join for real PvP matches (not bot/practice)
      if (
        existingMatch.player1Id === userId &&
        !existingMatch.isBotMatch &&
        !existingMatch.isPractice
      ) {
        return res.status(400).json({ message: "Cannot join your own match" });
      }
      if (existingMatch.player2Id) {
        return res.status(400).json({ message: "Match is full" });
      }

      const matchDeviceType = existingMatch.deviceType ?? "desktop";
      const joinerDeviceType = deviceType ?? "desktop";
      if (matchDeviceType !== joinerDeviceType) {
        const label = matchDeviceType === "mobile" ? "mobile" : "desktop";
        return res.status(403).json({ error: "DEVICE_NOT_SUPPORTED", message: `This match is for ${label} players only` });
      }

      // Check if user has enough balance for bet
      if (existingMatch.potAmount && parseFloat(existingMatch.potAmount) > 0) {
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        
        const balance = parseFloat(user.balance || "0");
        const requiredBet = parseFloat(existingMatch.potAmount);
        
        if (balance < requiredBet) {
          return res.status(400).json({ message: "Insufficient balance" });
        }
      }

      const match = await storage.joinMatch(matchId, userId, betAmount);
      // Notify match creator that opponent joined
      if (match.player1Id && match.player1Id !== userId) {
        try {
          const joinerUser = await storage.getUser(userId);
          const gameLabel = match.gameType?.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) ?? "Match";
          pushNotification(match.player1Id, {
            type: "challenge",
            title: `${gameLabel} — Opponent joined!`,
            body: `${joinerUser?.username ?? joinerUser?.firstName ?? "A player"} accepted your challenge. Get ready!`,
            linkTo: `/game/${match.id}`,
          });
        } catch { /* non-critical */ }
      }
      res.json(match);
    } catch (error: any) {
      console.error("Error joining match:", error);
      res.status(400).json({ message: error.message || "Failed to join match" });
    }
  });

  app.post("/api/matches/:id/forfeit", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const matchId = req.params.id;

      const existingMatch = await storage.getMatch(matchId);
      if (!existingMatch) {
        return res.status(404).json({ message: "Match not found" });
      }
      
      // Only players in the match can forfeit
      if (existingMatch.player1Id !== userId && existingMatch.player2Id !== userId) {
        return res.status(403).json({ message: "You are not in this match" });
      }

      const match = await storage.forfeitMatch(matchId, userId);

      // Cancel any active reconnect timer for this player
      reconnectManager.cancelIfActive(matchId, userId);

      // Reputation: forfeiter loses 8 points via centralized service
      reputationService.apply({
        userId,
        event: "forfeit",
        reason: "Match forfeited by player",
        matchId,
      }).catch(() => {});

      // Audit log
      auditLogger.logMatchForfeit(userId, matchId, {
        winnerId: match.winnerId,
        potAmount: match.potAmount,
      }).catch(() => {});

      // Notify forfeiter
      try {
        pushNotification(userId, {
          type: "you_forfeited",
          title: "You forfeited the match",
          body: "Your reputation score has been reduced. Completing matches keeps your score healthy.",
          linkTo: `/game/${matchId}`,
        });
      } catch { /* non-critical */ }

      // Notify the winner (opponent)
      try {
        const winnerId = match.winnerId;
        if (winnerId && winnerId !== userId) {
          pushNotification(winnerId, {
            type: "opponent_forfeited",
            title: "Opponent forfeited!",
            body: "Your opponent left the match. You win by forfeit!",
            linkTo: `/game/${matchId}`,
          });
        }
      } catch { /* non-critical */ }

      res.json(match);
    } catch (error: any) {
      console.error("Error forfeiting match:", error);
      res.status(400).json({ message: error.message || "Failed to forfeit match" });
    }
  });

  app.delete("/api/matches/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const matchId = req.params.id;

      await storage.cancelMatch(matchId, userId);
      res.json({ message: "Match cancelled successfully" });
    } catch (error: any) {
      console.error("Error cancelling match:", error);
      res.status(400).json({ message: error.message || "Failed to cancel match" });
    }
  });

  app.post("/api/matches/:id/delete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const matchId = req.params.id;

      await storage.deleteMatch(matchId, userId);
      res.json({ message: "Match deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting match:", error);
      res.status(400).json({ message: error.message || "Failed to delete match" });
    }
  });

  app.post("/api/matches/:id/complete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const matchId = req.params.id;
      const { winnerId, player1Score, player2Score } = req.body;

      // Security: only participants may submit a result
      const existing = await storage.getMatch(matchId);
      if (!existing) return res.status(404).json({ message: "Match not found" });

      const isParticipant = existing.player1Id === userId || existing.player2Id === userId;
      const isAdminUser = (req.user as any)?.claims?.isAdmin || false;
      if (!isParticipant && !isAdminUser) {
        return res.status(403).json({ message: "Only match participants can submit results" });
      }

      // Cancel any active reconnect timers
      reconnectManager.cancelIfActive(matchId, existing.player1Id);
      if (existing.player2Id) reconnectManager.cancelIfActive(matchId, existing.player2Id);

      // Clear anti-cheat sessions
      antiCheat.clearSession(existing.player1Id, matchId);
      if (existing.player2Id) antiCheat.clearSession(existing.player2Id, matchId);

      const match = await storage.completeMatch(
        matchId,
        winnerId || null,
        player1Score || 0,
        player2Score || 0
      );

      // Audit log
      auditLogger.logMatchComplete(userId, matchId, {
        winnerId: winnerId || null,
        player1Score: player1Score || 0,
        player2Score: player2Score || 0,
        potAmount: match.potAmount,
      }).catch(() => {});

      // Reputation updates for both players
      if (winnerId) {
        const loserId = match.player1Id === winnerId ? match.player2Id : match.player1Id;
        reputationService.apply({ userId: winnerId, event: "win", matchId }).catch(() => {});
        if (loserId) reputationService.apply({ userId: loserId, event: "loss", matchId }).catch(() => {});
      }

      // Check and award achievements
      await achievementService.checkAndAwardAchievements(match);

      if (winnerId) {
        const score = `${player1Score || 0}-${player2Score || 0}`;
        createWinPost(winnerId, "", match.gameType, "0", score).catch(() => {});
      }

      checkAndUpdateGoat().catch(() => {});
      
      res.json(match);
    } catch (error: any) {
      console.error("Error completing match:", error);
      res.status(400).json({ message: error.message || "Failed to complete match" });
    }
  });

  // Reconnect to an active match
  app.post("/api/matches/:id/reconnect", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const matchId = req.params.id;

      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ message: "Match not found" });

      const isParticipant = match.player1Id === userId || match.player2Id === userId;
      if (!isParticipant) return res.status(403).json({ message: "You are not in this match" });

      if (match.status === "completed" || match.status === "cancelled") {
        return res.status(400).json({ message: "Match is no longer active" });
      }

      const wasReconnecting = await reconnectManager.onReconnect(matchId, userId);
      res.json({
        success: true,
        wasReconnecting,
        match: await storage.getMatch(matchId),
      });
    } catch (error: any) {
      console.error("Error reconnecting to match:", error);
      res.status(500).json({ message: "Failed to reconnect" });
    }
  });

  // Notify server of disconnect (called by client before tab close)
  app.post("/api/matches/:id/disconnect", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const matchId = req.params.id;

      const match = await storage.getMatch(matchId);
      if (!match || match.status !== "in-progress") {
        return res.json({ acknowledged: true });
      }

      const isParticipant = match.player1Id === userId || match.player2Id === userId;
      if (!isParticipant) return res.status(403).json({ message: "Not a participant" });

      const opponentId = match.player1Id === userId ? (match.player2Id ?? "") : match.player1Id;
      await reconnectManager.onDisconnect(matchId, userId, opponentId);

      res.json({ acknowledged: true, reconnectWindowMs: 5 * 60 * 1000 });
    } catch (error: any) {
      console.error("Error handling disconnect:", error);
      res.status(500).json({ message: "Failed to handle disconnect" });
    }
  });

  // Dispute a match result
  app.post("/api/matches/:id/dispute", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const matchId = req.params.id;
      const { reason } = req.body;

      const match = await storage.getMatch(matchId);
      if (!match) return res.status(404).json({ message: "Match not found" });

      const isParticipant = match.player1Id === userId || match.player2Id === userId;
      if (!isParticipant) return res.status(403).json({ message: "You are not in this match" });

      if (match.status === "disputed") {
        return res.status(400).json({ message: "Match already disputed" });
      }

      await db.update(matches).set({ status: "disputed" }).where(eq(matches.id, matchId));

      auditLogger.logMatchDispute(userId, matchId, {
        reason: reason ?? "No reason given",
        matchStatus: match.status,
        potAmount: match.potAmount,
      }).catch(() => {});

      pushNotification(userId, {
        type: "challenge",
        title: "Match Disputed",
        body: "Your dispute has been submitted. An admin will review the match.",
        linkTo: `/game/${matchId}`,
      });

      res.json({ success: true, message: "Dispute submitted for admin review" });
    } catch (error: any) {
      console.error("Error disputing match:", error);
      res.status(500).json({ message: "Failed to submit dispute" });
    }
  });

  // Bot move generation endpoint
  app.post("/api/matches/:id/bot-move", isAuthenticated, async (req: any, res) => {
    try {
      const matchId = req.params.id;
      const match = await storage.getMatch(matchId);
      
      if (!match) {
        return res.status(404).json({ message: "Match not found" });
      }
      
      if (!match.isBotMatch && !match.isPractice) {
        return res.status(400).json({ message: "Not a bot match" });
      }
      
      const gameState = match.gameState as any;
      let move: any = null;
      
      // Generate bot move based on game type
      if (match.gameType === "chess") {
        const board = gameState?.board;
        const currentTurn = gameState?.currentTurn || "white";
        
        if (!board) {
          return res.status(400).json({ message: "Invalid game state" });
        }
        
        move = generateChessMove(board, currentTurn, (match.botDifficulty || "medium") as "easy" | "medium" | "hard");
        
        if (move) {
          const newBoard = board.map((r: any[]) => [...r]);
          newBoard[move.to[0]][move.to[1]] = newBoard[move.from[0]][move.from[1]];
          newBoard[move.from[0]][move.from[1]] = null;
          
          const newTurn = currentTurn === "white" ? "black" : "white";
          
          // Check if this move captures the opponent's king (simple win detection for MVP)
          let hasWhiteKing = false;
          let hasBlackKing = false;
          let gameOver = false;
          
          for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
              const piece = newBoard[r][c];
              if (piece && piece.type === "king") {
                if (piece.color === "white") hasWhiteKing = true;
                if (piece.color === "black") hasBlackKing = true;
              }
            }
          }
          
          // If only one king remains, that color wins
          let winner = null;
          if (!hasWhiteKing) {
            winner = "black";
            const winnerId = match.player2Id;
            const completedMatch = await storage.completeMatch(matchId, winnerId, 0, 0);
            await achievementService.checkAndAwardAchievements(completedMatch);
            gameOver = true;
          } else if (!hasBlackKing) {
            winner = "white";
            const winnerId = match.player1Id;
            const completedMatch = await storage.completeMatch(matchId, winnerId, 0, 0);
            await achievementService.checkAndAwardAchievements(completedMatch);
            gameOver = true;
          } else {
            await storage.updateMatchState(matchId, {
              board: newBoard,
              currentTurn: newTurn,
            });
          }
          
          move.board = newBoard;
          move.currentTurn = newTurn;
          move.winner = winner;
          move.gameOver = gameOver;
        }
      } else if (match.gameType === "connect-4") {
        // Get current game state or initialize
        let c4GameState: Connect4GameState;
        if (gameState && gameState.board) {
          c4GameState = gameState as Connect4GameState;
        } else {
          c4GameState = initializeConnect4GameState();
        }
        
        // Generate bot move (returns column number)
        const col = generateConnect4Move(c4GameState.board, c4GameState.currentTurn, (match.botDifficulty || "medium") as "easy" | "medium" | "hard");
        
        if (col !== null) {
          // Use engine to make the move (validates and updates state)
          const newGameState = makeConnect4Move(c4GameState, col, c4GameState.currentTurn);
          
          if (newGameState) {
            // Check if game is over
            if (newGameState.isGameOver) {
              const winner = newGameState.winner;
              const winnerId = winner === "player1" ? match.player1Id : 
                              winner === "player2" ? match.player2Id : null;
              
              // Calculate duration
              const duration = match.startedAt ? 
                Math.floor((Date.now() - new Date(match.startedAt).getTime()) / 1000) : 0;
              
              // Get move sequence for persistence
              const moveSequence = getMoveSequence(newGameState);
              
              const completedMatch = await storage.completeConnect4Match(matchId, winnerId, moveSequence, duration);
              await achievementService.checkAndAwardAchievements(completedMatch);
            } else {
              // Update match state
              await storage.updateMatchState(matchId, newGameState);
            }
            
            move = {
              col,
              gameState: newGameState,
            };
          }
        }
      } else if (match.gameType === "mini-golf") {
      let mgState: MiniGolfGameState;
      if (gameState && gameState.currentHole) {
        mgState = gameState as MiniGolfGameState;
        if (!mgState.matchSeed) mgState = { ...mgState, matchSeed: matchId };
      } else {
        const holeCount = (match as any).miniGolfHoleCount || 3;
        mgState = initializeMiniGolfMatch(match.player1Id, match.player2Id || '', holeCount, 1, matchId);
      }
      const botPlayer = "player2";
      if (mgState.currentTurn !== botPlayer || mgState.isMatchComplete) {
        move = { gameState: mgState };
      } else if (mgState.player2.holeComplete) {
        if (mgState.player1.holeComplete) {
          console.log('[MiniGolf bot-move] Both holeComplete in guard, advancing hole', mgState.currentHole);
          let advGs = advanceToNextHole(mgState);
          await storage.updateMatchState(matchId, advGs);
          if (advGs.isMatchComplete) { const sc = calculateTotalScore(advGs); const wId = sc.winner === 'player1' ? match.player1Id : sc.winner === 'player2' ? (match.player2Id || null) : null; const cm = await storage.completeMiniGolfMatch(matchId, wId, sc.player1Total, sc.player2Total, advGs); await achievementService.checkAndAwardAchievements(cm); }
          const mc = matchConnections.get(matchId); if (mc) { const adMsg = JSON.stringify({ type: 'mini-golf-shot', matchId, gameState: advGs }); mc.forEach((c: any) => { if (c.readyState === WebSocket.OPEN) c.send(adMsg); }); }
          move = { gameState: advGs };
        } else { move = { gameState: mgState }; }
      } else if (mgState.player2.strokes >= 8) {
        move = { gameState: mgState };
      } else {
        const holeDef = getHoleDefinition(mgState.currentHole, mgState.matchSeed);
        const holePos = holeDef ? holeDef.cupPosition : { x: 380, y: 60 };
        const difficulty = (match.botDifficulty || "medium") as "easy" | "medium" | "hard";
        const velocity: Vector2 = generateMiniGolfShot(mgState as any, holePos, difficulty, holeDef);
        const afterShot = processShot(mgState, botPlayer, velocity);
        const bothComplete = afterShot.player1.holeComplete && afterShot.player2.holeComplete;
        let finalGS: MiniGolfGameState = bothComplete ? advanceToNextHole(afterShot) : afterShot;
        await storage.updateMatchState(matchId, finalGS);
        if (finalGS.isMatchComplete) {
          const scores = calculateTotalScore(finalGS);
          const winnerId = scores.winner === "player1" ? match.player1Id : scores.winner === "player2" ? (match.player2Id || null) : null;
          const completedMatch = await storage.completeMiniGolfMatch(matchId, winnerId, scores.player1Total, scores.player2Total, finalGS);
          await achievementService.checkAndAwardAchievements(completedMatch);
        }
        const mgConnections = matchConnections.get(matchId);
        if (mgConnections) {
          const msg = JSON.stringify({ type: "mini-golf-shot", matchId, gameState: finalGS });
          mgConnections.forEach((c: any) => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
        }
        move = { gameState: finalGS };
      }
    } else if (match.gameType === "basketball") {
        const { createBasketballState, shootBall, simulateBasketball } = await import("@shared/basketballEngine");
        let bkState: any = (gameState && gameState.phase) ? gameState : createBasketballState();

        if (bkState.phase === "over") {
          move = { gameState: bkState };
        } else {
          const difficulty = (match.botDifficulty || "medium") as "easy" | "medium" | "hard";
          const botMove = generateBasketballMove(bkState, difficulty);
          let newBkState = shootBall(bkState, botMove.angle, botMove.power);
          let iters = 0;
          while (newBkState.phase === "flight" && iters < 600) {
            newBkState = simulateBasketball(newBkState);
            iters++;
          }
          await storage.updateMatchState(matchId, newBkState);

          const bkConns = matchConnections.get(matchId);
          if (bkConns) {
            const msg = JSON.stringify({ type: "basketball-state", matchId, gameState: newBkState });
            bkConns.forEach((c: any) => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
          }

          if (newBkState.phase === "over" && newBkState.winner) {
            const winnerId = newBkState.winner === "player1" ? match.player1Id :
              newBkState.winner === "player2" ? match.player2Id : null;
            const completedMatch = await storage.completeMatch(matchId, winnerId, newBkState.player1Score, newBkState.player2Score);
            await achievementService.checkAndAwardAchievements(completedMatch);
          }
          move = { gameState: newBkState };
        }
      } else if (match.gameType === "football") {
        const {
          createFootballState, snapBall, throwToReceiver, simulateFootball
        } = await import("@shared/footballEngine");
        let ftState: any = (gameState && gameState.phase) ? gameState : createFootballState();

        const difficulty = (match.botDifficulty || "medium") as "easy" | "medium" | "hard";

        // Auto-snap if in play-setup phase
        if (ftState.phase === "play-setup" || ftState.phase === "snap") {
          if (ftState.phase === "play-setup") ftState = snapBall(ftState);
          // Pick and throw to best receiver
          const { receiverId } = generateFootballMove(ftState, difficulty);
          ftState = throwToReceiver(ftState, receiverId);
          // Simulate to completion
          let iters = 0;
          while (!["result", "td", "over"].includes(ftState.phase) && iters < 800) {
            ftState = simulateFootball(ftState);
            iters++;
          }
          // Simulate one more step to land on "over" if td
          if (ftState.phase === "td" || ftState.phase === "result") {
            let safe = 0;
            while (ftState.phase !== "over" && safe < 200) {
              ftState = simulateFootball(ftState);
              safe++;
            }
          }

          await storage.updateMatchState(matchId, ftState);
          const ftConns = matchConnections.get(matchId);
          if (ftConns) {
            const msg = JSON.stringify({ type: "football-state", matchId, gameState: ftState });
            ftConns.forEach((c: any) => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
          }
          if (ftState.phase === "over" && ftState.winner) {
            const winnerId = ftState.winner === "player1" ? match.player1Id :
              ftState.winner === "player2" ? match.player2Id : null;
            const completedMatch = await storage.completeMatch(matchId, winnerId, ftState.player1Score ?? 0, ftState.player2Score ?? 0);
            await achievementService.checkAndAwardAchievements(completedMatch);
          }
        }
        move = { gameState: ftState };
      } else if (match.gameType === "rock-paper-scissors") {
        // Get current game state or initialize
        let rpsGameState: RPSGameState;
        if (gameState && gameState.status) {
          rpsGameState = gameState as RPSGameState;
        } else {
          const engine = new RockPaperScissorsEngine(3);
          rpsGameState = engine.getState();
        }

        // Generate bot choice based on round history and difficulty
        const choice = generateRPSChoice(
          rpsGameState.roundHistory || [],
          match.botDifficulty || "medium"
        );

        // Create engine from state
        const engine = new RockPaperScissorsEngine(rpsGameState.totalRounds);
        engine.loadState(rpsGameState);

        // Set bot (player2) choice — also triggers reveal if player1 has already chosen
        const success = engine.setPlayerChoice("player2", choice);

        if (success) {
          const revealState = engine.getState();
          await storage.updateMatchState(matchId, revealState);

          // Broadcast the revealing state immediately
          const revealConnections = matchConnections.get(matchId);
          if (revealConnections && revealState.status === "revealing") {
            const revealMsg = JSON.stringify({
              type: "rps-state-update",
              matchId,
              gameState: revealState,
            });
            revealConnections.forEach((client: any) => {
              if (client.readyState === WebSocket.OPEN) client.send(revealMsg);
            });

            // After reveal delay, complete the round and broadcast
            setTimeout(async () => {
              try {
                const freshMatch = await storage.getMatch(matchId);
                if (!freshMatch) return;
                const freshState = freshMatch.gameState as RPSGameState;
                if (freshState.status !== "revealing") return;

                const eng2 = new RockPaperScissorsEngine(freshState.totalRounds);
                eng2.loadState(freshState);
                eng2.completeRound();
                const completedState = eng2.getState();
                await storage.updateMatchState(matchId, completedState);

                // If game finished, complete the match record
                if (completedState.status === "finished") {
                  const winnerId = completedState.winner === "player1" ? match.player1Id :
                                   completedState.winner === "player2" ? match.player2Id! : null;
                  const duration = match.startedAt
                    ? Math.floor((Date.now() - new Date(match.startedAt).getTime()) / 1000) : 0;
                  const completedMatch = await storage.completeMatch(matchId, winnerId, completedState.player1Score, completedState.player2Score);
                  await achievementService.checkAndAwardAchievements(completedMatch);
                }

                const conns2 = matchConnections.get(matchId);
                if (conns2) {
                  const msg2 = JSON.stringify({
                    type: "rps-state-update",
                    matchId,
                    gameState: completedState,
                  });
                  conns2.forEach((client: any) => {
                    if (client.readyState === WebSocket.OPEN) client.send(msg2);
                  });
                }
              } catch (err) {
                console.error("[RPS bot] completeRound error:", err);
              }
            }, 1500);
          }

          move = { choice, gameState: revealState };
        }
      } else if (match.gameType === "dots-and-boxes") {
        // Get current game state or initialize
        let dabGameState: DotsAndBoxesGameState;
        if (gameState && gameState.gridSize) {
          dabGameState = gameState as DotsAndBoxesGameState;
        } else {
          dabGameState = initializeDotsAndBoxesGameState(5);
        }
        
        // Import and use bot move generator
        const { getBotMove } = require("@shared/dotsAndBoxesEngine");
        const line: DotsAndBoxesLine = getBotMove(dabGameState, (match.botDifficulty || "medium") as "easy" | "medium" | "hard");
        
        if (line) {
          // Use engine to make the move
          const newGameState = makeDotsAndBoxesMove(dabGameState, line);
          
          if (newGameState) {
            // Check if game is over
            if (newGameState.isGameOver) {
              const winner = newGameState.winner;
              const winnerId = winner === "player1" ? match.player1Id : 
                              winner === "player2" ? match.player2Id : null;
              
              const duration = match.startedAt ? 
                Math.floor((Date.now() - new Date(match.startedAt).getTime()) / 1000) : 0;
              
              const completedMatch = await storage.completeMatch(
                matchId,
                winnerId,
                newGameState.player1Score,
                newGameState.player2Score
              );
              await achievementService.checkAndAwardAchievements(completedMatch);
            } else {
              // Update match state
              await storage.updateMatchState(matchId, newGameState);
            }
            
            move = {
              line,
              gameState: newGameState,
            };
          }
        }
      } else if (match.gameType === "8-ball") {
        // Get current game state or initialize
        const { createInitialState, executeShot, simulatePhysics } = await import('@shared/eightBallEngine');
        let eightBallState;
        if (gameState && gameState.balls) {
          eightBallState = gameState;
        } else {
          eightBallState = createInitialState();
        }
        
        // Generate bot move
        const botMove = generateEightBallMove(eightBallState, "player2", (match.botDifficulty || "medium") as "easy" | "medium" | "hard");
        
        if (botMove) {
          // Execute shot
          let newGameState = executeShot(eightBallState, botMove.angle, botMove.power);
          
          // Simulate physics until all balls stop
          let iterations = 0;
          const maxIterations = 500;
          while (newGameState.simulationRunning && iterations < maxIterations) {
            newGameState = simulatePhysics(newGameState);
            iterations++;
          }
          
          // Check if game is over
          if (newGameState.gameOver) {
            const winner = newGameState.winner;
            const winnerId = winner === "player1" ? match.player1Id : 
                            winner === "player2" ? match.player2Id : null;
            
            const duration = match.startedAt ? 
              Math.floor((Date.now() - new Date(match.startedAt).getTime()) / 1000) : 0;
            
            const player1Balls = newGameState.balls.filter((b: any) => 
              b.pocketed && b.type === newGameState.player1Group
            ).length;
            const player2Balls = newGameState.balls.filter((b: any) => 
              b.pocketed && b.type === newGameState.player2Group
            ).length;
            
            const completedMatch = await storage.completeMatch(
              matchId,
              winnerId,
              player1Balls,
              player2Balls
            );
            await achievementService.checkAndAwardAchievements(completedMatch);
          } else {
            // Update match state
            await storage.updateMatchState(matchId, newGameState);
          }
          
          move = {
            angle: botMove.angle,
            power: botMove.power,
            gameState: newGameState,
          };
        }
      } else if (match.gameType === "bowling") {
        // Get current game state or initialize
        const { createInitialState, executeBowl, simulatePhysics } = await import('@shared/bowlingEngine');
        let bowlingState;
        if (gameState && gameState.pins) {
          bowlingState = gameState;
        } else {
          bowlingState = createInitialState();
        }
        
        // Generate bot move
        const botMove = generateBowlingMove(bowlingState, (bowlingState as any).currentPlayer || "player2", (match.botDifficulty || "medium") as "easy" | "medium" | "hard");
        
        if (botMove) {
          // Execute bowl
          let newGameState = executeBowl(bowlingState, botMove.angle, botMove.speed);
          
          // Simulate physics until all balls/pins stop
          let iterations = 0;
          const maxIterations = 500;
          while (newGameState.simulationRunning && iterations < maxIterations) {
            newGameState = simulatePhysics(newGameState);
            iterations++;
          }
          
          // Check if game is over
          if (newGameState.gameOver) {
            const winner = newGameState.winner;
            const winnerId = winner === "player1" ? match.player1Id : 
                            winner === "player2" ? match.player2Id : null;
            
            const duration = match.startedAt ? 
              Math.floor((Date.now() - new Date(match.startedAt).getTime()) / 1000) : 0;
            
            const completedMatch = await storage.completeMatch(
              matchId,
              winnerId,
              newGameState.player1TotalScore,
              newGameState.player2TotalScore
            );
            await achievementService.checkAndAwardAchievements(completedMatch);
          } else {
            // Update match state
            await storage.updateMatchState(matchId, newGameState);
          }
          
          move = {
            angle: botMove.angle,
            speed: botMove.speed,
            gameState: newGameState,
          };
        }
      } else if (match.gameType === "cup-king") {
        // Get current game state or initialize
        const { initCupKingGame, applyCupKingMove, simulateCupKingPhysicsStep, getCupCounts } = await import('@shared/cupKingEngine');
        let cupKingState;
        if (gameState && gameState.player1Cups) {
          cupKingState = gameState;
        } else {
          cupKingState = initCupKingGame();
        }
        
        // Generate bot move
        const botMove = generateCupKingMove(cupKingState, (cupKingState as any).currentPlayer || "player2", (match.botDifficulty || "medium") as "easy" | "medium" | "hard");
        
        if (botMove) {
          // Apply move
          let newGameState = applyCupKingMove(cupKingState, botMove);
          
          // Simulate physics until ball stops
          let iterations = 0;
          const maxIterations = 500;
          while (newGameState.isSimulating && iterations < maxIterations) {
            const { state: simState, shouldContinue } = simulateCupKingPhysicsStep(newGameState);
            newGameState = simState;
            if (!shouldContinue) break;
            iterations++;
          }
          
          // Check if game is over
          if (newGameState.winner) {
            const winner = newGameState.winner;
            const winnerId = winner === 1 ? match.player1Id : 
                            winner === 2 ? match.player2Id : null;
            
            const duration = match.startedAt ? 
              Math.floor((Date.now() - new Date(match.startedAt).getTime()) / 1000) : 0;
            
            const cupCounts = getCupCounts(newGameState);
            
            const completedMatch = await storage.completeMatch(
              matchId,
              winnerId,
              cupCounts.player1,
              cupCounts.player2
            );
            await achievementService.checkAndAwardAchievements(completedMatch);
          } else {
            // Update match state
            await storage.updateMatchState(matchId, newGameState);
          }
          
          move = {
            angle: botMove.angle,
            power: botMove.power,
            gameState: newGameState,
          };
        }
      } else if (match.gameType === "stack-tower") {
        // Get current game state or initialize
        const { initStackTowerGame, applyStackTowerMove, updateStackTowerPhysics, getStackTowerStats } = await import('@shared/stackTowerEngine');
        let stackTowerState;
        if (gameState && gameState.player1) {
          stackTowerState = gameState;
        } else {
          stackTowerState = initStackTowerGame();
        }
        
        // Update physics to current state
        stackTowerState = updateStackTowerPhysics(stackTowerState);
        
        // Generate bot move
        const stCurrentPlayer = (stackTowerState as any).currentPlayer || "player2";
        const botMove = generateStackTowerMove(stackTowerState, stCurrentPlayer, (match.botDifficulty || "medium") as "easy" | "medium" | "hard");
        
        if (botMove) {
          // Apply move (drop block)
          const playerNum = stCurrentPlayer === "player1" ? 1 : 2;
          let newGameState = applyStackTowerMove(stackTowerState, playerNum as 1 | 2, { ...botMove, timestamp: Date.now() });
          
          // Continue updating physics
          newGameState = updateStackTowerPhysics(newGameState);
          
          // Check if game is over
          if (newGameState.gamePhase === "finished") {
            const winnerId = newGameState.winner === 1 ? match.player1Id : 
                            newGameState.winner === 2 ? match.player2Id : null;
            
            const duration = match.startedAt ? 
              Math.floor((Date.now() - new Date(match.startedAt).getTime()) / 1000) : 0;
            
            const completedMatch = await storage.completeMatch(
              matchId,
              winnerId,
              newGameState.player1.score,
              newGameState.player2.score
            );
            await achievementService.checkAndAwardAchievements(completedMatch);
          } else {
            // Update match state
            await storage.updateMatchState(matchId, newGameState);
          }
          
          move = {
            action: botMove.action,
            gameState: newGameState,
          };
        }
      }
      
      if (!move) {
        return res.status(500).json({ message: "Bot could not generate move" });
      }
      
      res.json({ move });
    } catch (error: any) {
      console.error("Error generating bot move:", error);
      res.status(500).json({ message: error.message || "Failed to generate bot move" });
    }
  });

  // Chess timeout check endpoint
  app.post("/api/matches/:id/check-timeout", isAuthenticated, async (req: any, res) => {
    try {
      const matchId = req.params.id;
      const match = await storage.getMatch(matchId);
      
      if (!match || match.gameType !== 'chess' || match.status !== 'in-progress') {
        return res.json({ timeout: false });
      }

      const gameState = match.gameState as ChessGameState;
      if (!gameState || !gameState.lastMoveTimestamp || !match.timeControl) {
        return res.json({ timeout: false });
      }

      const now = Date.now();
      const timeElapsedSinceLastMove = now - gameState.lastMoveTimestamp;
      
      // Calculate current player's remaining time
      const currentPlayerTime = gameState.currentTurn === "white" 
        ? (gameState.player1TimeRemaining ?? match.timeControl * 1000)
        : (gameState.player2TimeRemaining ?? match.timeControl * 1000);
      
      const currentRemainingTime = currentPlayerTime - timeElapsedSinceLastMove;
      
      // Timeout detected
      if (currentRemainingTime <= 0) {
        const losingColor = gameState.currentTurn;
        const winningColor = losingColor === "white" ? "black" : "white";
        const winnerId = winningColor === "white" ? match.player1Id : match.player2Id;
        
        // Update game state with timeout
        gameState.winner = winningColor;
        gameState.isCheckmate = true;
        if (losingColor === "white") {
          gameState.player1TimeRemaining = 0;
        } else {
          gameState.player2TimeRemaining = 0;
        }
        
        // Complete the match
        const player1 = await storage.getUser(match.player1Id);
        const player2 = match.player2Id ? await storage.getUser(match.player2Id) : null;
        const player1Name = player1?.firstName || player1?.email?.split('@')[0] || "Player 1";
        const player2Name = player2?.firstName || player2?.email?.split('@')[0] || "Player 2";
        
        const pgn = generatePGN(gameState, player1Name, player2Name);
        const duration = match.startedAt ? Math.floor((now - new Date(match.startedAt).getTime()) / 1000) : 0;
        
        await storage.completeChessMatch(matchId, winnerId || null, pgn, duration);
        
        return res.json({ timeout: true, winner: winningColor });
      }
      
      res.json({ timeout: false });
    } catch (error) {
      console.error("Error checking timeout:", error);
      res.status(500).json({ message: "Failed to check timeout" });
    }
  });

  // Stats and leaderboard routes
  app.get("/api/user/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });

  app.get("/api/leaderboard", async (req, res) => {
    try {
      const leaderboard = await storage.getLeaderboard(50);
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/leaderboard/:gameType", async (req, res) => {
    try {
      const gameType = req.params.gameType as GameType;
      const validTypes = ["chess", "mini-golf", "connect-4", "air-hockey", "rock-paper-scissors", "dots-and-boxes", "8-ball", "bowling", "cup-king", "stack-tower", "block-blast", "basketball", "football", "racing"];
      if (!validTypes.includes(gameType)) {
        return res.status(400).json({ message: "Invalid game type" });
      }
      const period = req.query.period as string | undefined;
      let since: Date | undefined;
      if (period === "weekly") since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      else if (period === "monthly") since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const leaderboard = await storage.getGameLeaderboard(gameType, 50, since);
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching game leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch game leaderboard" });
    }
  });

  app.get("/api/leaderboard/money/top", async (req, res) => {
    try {
      const leaderboard = await storage.getMoneyLeaderboard(50);
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching money leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch money leaderboard" });
    }
  });

  // Rating-based leaderboards (ELO/MMR)
  app.get("/api/leaderboard/rating/:gameType", async (req, res) => {
    try {
      const gameType = req.params.gameType as GameType;
      const validTypes = ["chess", "mini-golf", "connect-4", "air-hockey", "rock-paper-scissors", "dots-and-boxes", "8-ball", "bowling", "cup-king", "stack-tower", "block-blast", "basketball", "football", "racing"];
      if (!validTypes.includes(gameType)) {
        return res.status(400).json({ message: "Invalid game type" });
      }
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const leaderboard = await storage.getRatingLeaderboard(gameType, limit);
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching rating leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch rating leaderboard" });
    }
  });

  let lastGoatId: string | null = null;

  async function checkAndUpdateGoat() {
    lastGoatId = await checkGoatChange(lastGoatId);
  }

  // GOAT — the single highest-rated player globally
  app.get("/api/goat", async (req, res) => {
    try {
      const leaderboard = await storage.getLeaderboard(50);
      if (!leaderboard.length) return res.json(null);
      const sorted = [...leaderboard].sort((a, b) => ((b as unknown as Record<string, number>).overallRating ?? 0) - ((a as unknown as Record<string, number>).overallRating ?? 0));
      const goat = sorted[0] as any;
      lastGoatId = goat.id;
      res.json({ ...goat, isGoat: true });
    } catch (err) {
      console.error("Error fetching GOAT:", err);
      res.status(500).json({ message: "Failed to fetch GOAT" });
    }
  });

  // Match statistics routes
  app.get("/api/matches/:matchId/statistics", async (req, res) => {
    try {
      const matchId = req.params.matchId;
      const stats = await storage.getMatchStatistics(matchId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching match statistics:", error);
      res.status(500).json({ message: "Failed to fetch match statistics" });
    }
  });

  app.get("/api/user/match-statistics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const gameType = req.query.gameType as GameType | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const stats = await storage.getUserMatchStatistics(userId, gameType, limit);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user match statistics:", error);
      res.status(500).json({ message: "Failed to fetch user match statistics" });
    }
  });

  // Global stats routes
  app.get("/api/stats/global", async (req, res) => {
    try {
      const stats = await storage.getGlobalStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching global stats:", error);
      res.status(500).json({ message: "Failed to fetch global stats" });
    }
  });

  app.get("/api/stats/fair-play-log", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      const log = await storage.getFairPlayLog(limit, offset);
      res.json(log);
    } catch (error) {
      console.error("Error fetching fair play log:", error);
      res.status(500).json({ message: "Failed to fetch fair play log" });
    }
  });

  // Achievement and XP routes
  app.get("/api/achievements", async (req, res) => {
    try {
      const achievements = await storage.getAllAchievements();
      res.json(achievements);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  app.get("/api/achievements/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const userAchievements = await storage.getUserAchievements(userId);
      res.json(userAchievements);
    } catch (error) {
      console.error("Error fetching user achievements:", error);
      res.status(500).json({ message: "Failed to fetch user achievements" });
    }
  });

  app.get("/api/achievements/my", isAuthenticated, async (req: any, res) => {
    try {
      const userAchievements = await storage.getUserAchievements(req.user.claims.sub);
      res.json(userAchievements);
    } catch (error) {
      console.error("Error fetching my achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  // Favorite games routes
  app.get("/api/favorites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const favorites = await storage.getFavoriteGames(userId);
      res.json(favorites);
    } catch (error) {
      console.error("Error fetching favorite games:", error);
      res.status(500).json({ message: "Failed to fetch favorite games" });
    }
  });

  app.post("/api/favorites/:gameType", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { gameType } = req.params;
      
      if (!gameType) {
        return res.status(400).json({ message: "Game type is required" });
      }

      const favorite = await storage.addFavoriteGame(userId, gameType);
      res.json(favorite);
    } catch (error) {
      console.error("Error adding favorite game:", error);
      res.status(500).json({ message: "Failed to add favorite game" });
    }
  });

  app.delete("/api/favorites/:gameType", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { gameType } = req.params;
      
      if (!gameType) {
        return res.status(400).json({ message: "Game type is required" });
      }

      await storage.removeFavoriteGame(userId, gameType);
      res.json({ message: "Favorite removed" });
    } catch (error) {
      console.error("Error removing favorite game:", error);
      res.status(500).json({ message: "Failed to remove favorite game" });
    }
  });

  // Chat message routes
  app.get("/api/chat/:channel", isAuthenticated, async (req: any, res) => {
    try {
      const { channel } = req.params;
      const { matchId, limit } = req.query;
      
      const messages = await storage.getChatMessages(
        channel,
        matchId as string | undefined,
        limit ? parseInt(limit as string) : 100
      );
      
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  // Friend management routes
  app.post("/api/friends/request", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { addresseeId } = req.body;
      
      if (!addresseeId) {
        return res.status(400).json({ message: "Addressee ID is required" });
      }
      
      const friendship = await storage.sendFriendRequest(userId, addresseeId);
      res.json(friendship);
    } catch (error: any) {
      console.error("Error sending friend request:", error);
      res.status(400).json({ message: error.message || "Failed to send friend request" });
    }
  });

  app.post("/api/friends/accept/:friendshipId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { friendshipId } = req.params;
      
      const friendship = await storage.acceptFriendRequest(friendshipId, userId);
      res.json(friendship);
    } catch (error: any) {
      console.error("Error accepting friend request:", error);
      res.status(400).json({ message: error.message || "Failed to accept friend request" });
    }
  });

  app.post("/api/friends/decline/:friendshipId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { friendshipId } = req.params;
      
      await storage.declineFriendRequest(friendshipId, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error declining friend request:", error);
      res.status(400).json({ message: error.message || "Failed to decline friend request" });
    }
  });

  app.delete("/api/friends/:friendshipId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { friendshipId } = req.params;
      
      await storage.removeFriend(friendshipId, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error removing friend:", error);
      res.status(400).json({ message: error.message || "Failed to remove friend" });
    }
  });

  app.get("/api/friends", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const friends = await storage.getUserFriends(userId);
      res.json(friends);
    } catch (error) {
      console.error("Error fetching friends:", error);
      res.status(500).json({ message: "Failed to fetch friends" });
    }
  });

  app.get("/api/friends/requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requests = await storage.getPendingFriendRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching friend requests:", error);
      res.status(500).json({ message: "Failed to fetch friend requests" });
    }
  });

  app.get("/api/users/search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { query, limit } = req.query;
      
      if (!query || typeof query !== "string") {
        return res.status(400).json({ message: "Search query is required" });
      }
      
      const users = await storage.searchUsers(
        query,
        userId,
        limit ? parseInt(limit as string) : 20
      );
      res.json(users);
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ message: "Failed to search users" });
    }
  });

  // Challenge invite routes
  // Challenge claims — manual "Claim" button system
  app.get("/api/challenges/claims", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const claims = await storage.getChallengeClaims(userId);
      res.json(claims);
    } catch (err) {
      console.error("Error fetching challenge claims:", err);
      res.status(500).json({ message: "Failed to fetch claims" });
    }
  });

  app.post("/api/challenges/claim", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { challengeId, xpAmount } = req.body;
      if (!challengeId || typeof xpAmount !== "number" || xpAmount < 0) {
        return res.status(400).json({ message: "Invalid claim request" });
      }
      const alreadyClaimed = await storage.hasClaimedChallenge(userId, challengeId);
      if (alreadyClaimed) {
        return res.status(409).json({ message: "Challenge already claimed" });
      }
      const claim = await storage.createChallengeClaim(userId, challengeId, xpAmount);
      const updatedUser = await storage.getUser(userId);
      // Sync XP to Battle Pass progress
      await storage.addBattlePassXP(userId, xpAmount).catch(() => {});
      res.json({ claim, xp: updatedUser?.xp ?? 0, level: updatedUser?.level ?? 1 });
    } catch (err) {
      console.error("Error claiming challenge:", err);
      res.status(500).json({ message: "Failed to claim challenge" });
    }
  });

  app.post("/api/challenges/invite", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { challengedId, gameType, betAmount, deviceType } = req.body;
      
      if (!challengedId || !gameType) {
        return res.status(400).json({ message: "Challenged user and game type are required" });
      }
      
      const invite = await storage.createChallengeInvite({
        challengerId: userId,
        challengedId,
        gameType,
        betAmount: betAmount || "0.00",
        status: "pending",
        deviceType: deviceType === "mobile" ? "mobile" : "desktop",
        expiresAt: new Date(),
      });

      const challenger = await storage.getUser(userId);
      const challengerName = challenger?.username || challenger?.firstName || "Someone";
      _pushNotification(challengedId, {
        type: "challenge",
        title: "New Challenge!",
        body: `${challengerName} challenged you to ${gameType}${betAmount && betAmount !== "0.00" ? ` for ${betAmount} SCALPS` : ""}`,
        linkTo: "/",
      });
      
      res.json(invite);
    } catch (error: any) {
      console.error("Error creating challenge invite:", error);
      res.status(400).json({ message: error.message || "Failed to create challenge invite" });
    }
  });

  app.post("/api/challenges/accept/:inviteId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { inviteId } = req.params;
      const { deviceType } = req.body;
      
      const acceptorDeviceType = deviceType === "mobile" ? "mobile" : "desktop";
      const result = await storage.acceptChallengeInvite(inviteId, userId, acceptorDeviceType);
      res.json(result);
    } catch (error: any) {
      console.error("Error accepting challenge invite:", error);
      res.status(400).json({ message: error.message || "Failed to accept challenge invite" });
    }
  });

  app.post("/api/challenges/decline/:inviteId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { inviteId } = req.params;
      
      await storage.declineChallengeInvite(inviteId, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error declining challenge invite:", error);
      res.status(400).json({ message: error.message || "Failed to decline challenge invite" });
    }
  });

  app.get("/api/challenges/pending", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const invites = await storage.getPendingChallengeInvites(userId);
      res.json(invites);
    } catch (error) {
      console.error("Error fetching pending challenges:", error);
      res.status(500).json({ message: "Failed to fetch pending challenges" });
    }
  });

  // Direct message routes
  app.post("/api/messages/send", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { recipientId, message } = req.body;
      
      if (!recipientId || !message) {
        return res.status(400).json({ message: "Recipient and message are required" });
      }
      
      // Verify friendship before allowing message
      const friendship = await storage.checkFriendship(userId, recipientId);
      if (!friendship || friendship.status !== "accepted") {
        return res.status(403).json({ message: "You can only message friends" });
      }
      
      const directMessage = await storage.createDirectMessage({
        senderId: userId,
        recipientId,
        message: message.trim(),
      });
      
      res.json(directMessage);
    } catch (error: any) {
      console.error("Error sending direct message:", error);
      res.status(400).json({ message: error.message || "Failed to send message" });
    }
  });

  app.get("/api/messages/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await storage.getDirectMessageConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get("/api/messages/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const count = await storage.getUnreadDirectMessageCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  app.get("/api/messages/:friendId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { friendId } = req.params;
      const { limit } = req.query;
      
      // Verify friendship
      const friendship = await storage.checkFriendship(userId, friendId);
      if (!friendship || friendship.status !== "accepted") {
        return res.status(403).json({ message: "You can only view messages with friends" });
      }
      
      const messages = await storage.getDirectMessages(
        userId,
        friendId,
        limit ? parseInt(limit as string) : 100
      );
      
      res.json(messages);
    } catch (error) {
      console.error("Error fetching direct messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages/mark-read/:friendId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { friendId } = req.params;
      
      await storage.markDirectMessagesAsRead(userId, friendId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ message: "Failed to mark messages as read" });
    }
  });

  // ═══════════════════════════════════════════════════════════
  //  ITEM SHOP API
  // ═══════════════════════════════════════════════════════════

  /** GET /api/shop/items — list active shop items (optional ?category=) */
  app.get("/api/shop/items", async (req: any, res) => {
    try {
      const { category } = req.query;
      const where = category
        ? and(eq(shopItems.isActive, true), eq(shopItems.category, category as string))
        : eq(shopItems.isActive, true);
      const items = await db
        .select()
        .from(shopItems)
        .where(where)
        .orderBy(shopItems.sortOrder, shopItems.createdAt);
      res.json(items);
    } catch (err) {
      console.error("shop/items error:", err);
      res.status(500).json({ message: "Failed to load shop items" });
    }
  });

  /** GET /api/shop/featured — just featured items */
  app.get("/api/shop/featured", async (_req, res) => {
    try {
      const items = await db
        .select()
        .from(shopItems)
        .where(and(eq(shopItems.isActive, true), eq(shopItems.isFeatured, true)))
        .orderBy(shopItems.sortOrder);
      res.json(items);
    } catch (err) {
      res.status(500).json({ message: "Failed to load featured items" });
    }
  });

  /** GET /api/shop/daily — today's daily items */
  app.get("/api/shop/daily", async (_req, res) => {
    try {
      const items = await db
        .select()
        .from(shopItems)
        .where(and(eq(shopItems.isActive, true), eq(shopItems.isDailyItem, true)))
        .orderBy(shopItems.sortOrder);
      res.json(items);
    } catch (err) {
      res.status(500).json({ message: "Failed to load daily items" });
    }
  });

  /** GET /api/shop/inventory — current user's owned items with item details */
  app.get("/api/shop/inventory", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const rows = await db
        .select({
          inventoryId: userInventory.id,
          purchasedAt: userInventory.purchasedAt,
          item: shopItems,
        })
        .from(userInventory)
        .innerJoin(shopItems, eq(userInventory.itemId, shopItems.id))
        .where(eq(userInventory.userId, userId))
        .orderBy(desc(userInventory.purchasedAt));
      res.json(rows);
    } catch (err) {
      console.error("shop/inventory error:", err);
      res.status(500).json({ message: "Failed to load inventory" });
    }
  });

  // ─── Tutorial Progress ────────────────────────────────────────────────────

  app.get("/api/tutorial/progress", isAuthenticated, async (req: any, res) => {
    try {
      const { getTutorialProgress } = await import("./tutorialService");
      const rows = await getTutorialProgress(req.user.claims.sub);
      res.json(rows);
    } catch (err) {
      console.error("tutorial/progress error:", err);
      res.status(500).json({ message: "Failed to load tutorial progress" });
    }
  });

  app.get("/api/tutorial/status", isAuthenticated, async (req: any, res) => {
    try {
      const { getTutorialStatus } = await import("./tutorialService");
      const status = await getTutorialStatus(req.user.claims.sub);
      res.json(status);
    } catch (err) {
      console.error("tutorial/status error:", err);
      res.status(500).json({ message: "Failed to load tutorial status" });
    }
  });

  app.post("/api/tutorial/progress", isAuthenticated, async (req: any, res) => {
    try {
      const { tutorialId, currentStep, totalSteps } = req.body as { tutorialId?: string; currentStep?: number; totalSteps?: number };
      if (!tutorialId || typeof currentStep !== "number" || typeof totalSteps !== "number") {
        return res.status(400).json({ message: "tutorialId, currentStep, totalSteps required" });
      }
      const { saveStepProgress } = await import("./tutorialService");
      const row = await saveStepProgress(req.user.claims.sub, tutorialId, currentStep, totalSteps);
      res.json(row);
    } catch (err: any) {
      if (err?.code === "TUTORIAL_LOCKED") {
        return res.status(403).json({ message: err.message, code: "TUTORIAL_LOCKED" });
      }
      console.error("tutorial/progress save error:", err);
      res.status(500).json({ message: "Failed to save progress" });
    }
  });

  app.post("/api/tutorial/complete", isAuthenticated, async (req: any, res) => {
    try {
      const { tutorialId } = req.body as { tutorialId?: string };
      if (!tutorialId) return res.status(400).json({ message: "tutorialId required" });
      const { completeTutorial } = await import("./tutorialService");
      const result = await completeTutorial(req.user.claims.sub, tutorialId);
      res.json(result);
    } catch (err: any) {
      if (err?.code === "TUTORIAL_LOCKED") {
        return res.status(403).json({ message: err.message, code: "TUTORIAL_LOCKED" });
      }
      console.error("tutorial/complete error:", err);
      res.status(500).json({ message: "Failed to complete tutorial" });
    }
  });

  app.post("/api/tutorial/skip", isAuthenticated, async (req: any, res) => {
    try {
      const { tutorialId } = req.body as { tutorialId?: string };
      if (!tutorialId) return res.status(400).json({ message: "tutorialId required" });
      const { skipTutorial } = await import("./tutorialService");
      const row = await skipTutorial(req.user.claims.sub, tutorialId);
      res.json(row);
    } catch (err) {
      console.error("tutorial/skip error:", err);
      res.status(500).json({ message: "Failed to skip tutorial" });
    }
  });

  app.post("/api/tutorial/reset", isAuthenticated, async (req: any, res) => {
    try {
      const { tutorialId } = req.body as { tutorialId?: string };
      const { resetTutorial } = await import("./tutorialService");
      const result = await resetTutorial(req.user.claims.sub, tutorialId);
      res.json(result);
    } catch (err) {
      console.error("tutorial/reset error:", err);
      res.status(500).json({ message: "Failed to reset tutorial" });
    }
  });

  // ─── Tier Drill Scores ────────────────────────────────────────────────────

  app.post("/api/tutorial/drill-score", isAuthenticated, async (req: any, res) => {
    try {
      const { tutorialId, drillKind, metric, higherIsBetter, score } = req.body as {
        tutorialId?: string;
        drillKind?: string;
        metric?: string;
        higherIsBetter?: boolean;
        score?: number;
      };
      if (
        !tutorialId ||
        !drillKind ||
        !metric ||
        typeof higherIsBetter !== "boolean" ||
        typeof score !== "number"
      ) {
        return res.status(400).json({
          message: "tutorialId, drillKind, metric, higherIsBetter, score required",
        });
      }
      const { recordDrillScore } = await import("./tutorialService");
      const result = await recordDrillScore(req.user.claims.sub, {
        tutorialId,
        drillKind,
        metric,
        higherIsBetter,
        score,
      });
      res.json(result);
    } catch (err) {
      console.error("tutorial/drill-score error:", err);
      res.status(500).json({ message: "Failed to save drill score" });
    }
  });

  app.get("/api/tutorial/drill-leaderboard/:tutorialId", isAuthenticated, async (req: any, res) => {
    try {
      const { tutorialId } = req.params as { tutorialId: string };
      const { getDrillLeaderboard } = await import("./tutorialService");
      const rows = await getDrillLeaderboard(tutorialId, 10);
      res.json(rows);
    } catch (err) {
      console.error("tutorial/drill-leaderboard error:", err);
      res.status(500).json({ message: "Failed to load leaderboard" });
    }
  });

  // ─── Rank Progression ─────────────────────────────────────────────────────

  /** GET /api/rank/season — current active season metadata */
  app.get("/api/rank/season", isAuthenticated, async (_req: any, res) => {
    try {
      const season = await getActiveRankSeason();
      res.json(season);
    } catch (err) {
      console.error("rank/season error:", err);
      res.status(500).json({ message: "Failed to load season" });
    }
  });

  /** GET /api/rank/progression?gameType=chess — full rank breakdown + rewards */
  app.get("/api/rank/progression", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const raw = (req.query.gameType as string) || "chess";
      if (!(gameTypes as readonly string[]).includes(raw)) {
        return res.status(400).json({ message: "Invalid gameType" });
      }
      const progression = await getRankProgressionForUser(userId, raw as GameType);
      res.json(progression);
    } catch (err) {
      console.error("rank/progression error:", err);
      res.status(500).json({ message: "Failed to load rank progression" });
    }
  });

  /** GET /api/ranks/rewards?gameType=chess — reward catalog with unlocked/owned/equipped state + next-reward preview */
  app.get("/api/ranks/rewards", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const raw = (req.query.gameType as string) || "chess";
      if (!(gameTypes as readonly string[]).includes(raw)) {
        return res.status(400).json({ message: "Invalid gameType" });
      }
      const progression = await getRankProgressionForUser(userId, raw as GameType);
      res.json({
        gameType: raw,
        rating: progression.rating,
        currentTier: progression.currentTier,
        currentDivision: progression.currentDivision,
        label: progression.label,
        progressPct: progression.progressPct,
        pointsToNext: progression.pointsToNext,
        divisionMin: progression.divisionMin,
        divisionMax: progression.divisionMax,
        tierColor: progression.tierColor,
        tierGlow: progression.tierGlow,
        nextReward: progression.nextReward,
        pointsToNextReward: progression.pointsToNextReward,
        rewards: progression.rewards,
      });
    } catch (err) {
      console.error("ranks/rewards error:", err);
      res.status(500).json({ message: "Failed to load rank rewards" });
    }
  });

  /** GET /api/rank/history — most recent rank changes for current user (optional ?gameType=) */
  app.get("/api/rank/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const raw = (req.query.gameType as string | undefined) ?? undefined;
      const gameType = raw && (gameTypes as readonly string[]).includes(raw) ? (raw as GameType) : undefined;
      const history = await getRankHistoryForUser(userId, gameType);
      res.json(history);
    } catch (err) {
      console.error("rank/history error:", err);
      res.status(500).json({ message: "Failed to load rank history" });
    }
  });

  /** GET /api/rank/rewards-for-match/:matchId — rewards unlocked for the current user in a specific match */
  app.get("/api/rank/rewards-for-match/:matchId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { matchId } = req.params;
      // Source of truth = rank_history.granted_item_ids (only IDs that were actually NEW
      // grants at the time of the rank change, written atomically in processRatingChange).
      const result = await db.execute(drizzleSql`
        SELECT si.id, si.name, si.category, si.rarity, si.preview_data, si.description,
               rh.new_tier, rh.new_division, rh.new_rating, rh.old_rating
        FROM rank_history rh
        JOIN shop_items si ON si.id = ANY(rh.granted_item_ids)
        WHERE rh.user_id = ${userId}
          AND rh.match_id = ${matchId}
          AND rh.direction = 'up'
        ORDER BY rh.created_at ASC
      `);
      res.json(result.rows);
    } catch (err) {
      console.error("rank/rewards-for-match error:", err);
      res.status(500).json({ message: "Failed to load match rewards" });
    }
  });

  /** GET /api/shop/equipped — what the current user has equipped per category */
  app.get("/api/shop/equipped", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const rows = await db
        .select({
          category: userEquipped.category,
          item: shopItems,
          equippedAt: userEquipped.equippedAt,
        })
        .from(userEquipped)
        .innerJoin(shopItems, eq(userEquipped.itemId, shopItems.id))
        .where(eq(userEquipped.userId, userId));
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: "Failed to load equipped cosmetics" });
    }
  });

  /** POST /api/shop/purchase/:itemId — buy an item (atomic wallet debit) */
  app.post("/api/shop/purchase/:itemId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { itemId } = req.params;

      // 1. Fetch item
      const [item] = await db.select().from(shopItems).where(eq(shopItems.id, itemId));
      if (!item || !item.isActive) {
        return res.status(404).json({ message: "Item not found" });
      }

      // 2. Special handling: Battle Pass items activate the premium track
      if (item.category === "battle_pass") {
        const [season] = await db.select().from(battlePassSeasons).where(eq(battlePassSeasons.isActive, true)).limit(1);
        if (!season) return res.status(404).json({ message: "No active season" });
        let [progress] = await db.select().from(userBattlePassProgress)
          .where(and(eq(userBattlePassProgress.userId, userId), eq(userBattlePassProgress.seasonId, season.id)));
        if (progress?.hasPremium) return res.status(409).json({ message: "Battle Pass already active" });
        await storage.updateUserBalance(userId, `-${parseFloat(item.price as string).toFixed(2)}`, "battle_pass_purchase", null, `Shop: ${item.name}`);
        if (!progress) {
          await db.insert(userBattlePassProgress).values({ userId, seasonId: season.id, currentXp: 0, claimedTiers: [], hasPremium: true });
        } else {
          await db.update(userBattlePassProgress).set({ hasPremium: true }).where(eq(userBattlePassProgress.id, progress.id));
        }
        // Add to inventory so shop shows it as "owned"
        const [existingInv] = await db.select().from(userInventory).where(and(eq(userInventory.userId, userId), eq(userInventory.itemId, item.id)));
        if (!existingInv) {
          await db.insert(userInventory).values({ userId, itemId: item.id });
        }
        return res.json({ success: true, item, battlePassActivated: true });
      }

      // 3. Check not already owned
      const [existing] = await db
        .select()
        .from(userInventory)
        .where(and(eq(userInventory.userId, userId), eq(userInventory.itemId, itemId)));
      if (existing) {
        return res.status(409).json({ message: "Item already owned" });
      }

      // 3. Atomic wallet debit + inventory insert
      const price = parseFloat(item.price as string);

      // Fetch user balance
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const currentBalance = parseFloat(user.balance as string);
      if (currentBalance < price) {
        return res.status(402).json({ message: "Insufficient balance" });
      }
      const newBalance = (currentBalance - price).toFixed(2);
      await db.update(users)
        .set({ balance: newBalance })
        .where(eq(users.id, userId));

      await db.insert(userInventory).values({ userId, itemId });

      // 4. Record transaction
      await db.insert(transactions).values({
        userId,
        type: "shop_purchase",
        amount: (-price).toFixed(2),
        balanceBefore: currentBalance.toFixed(2),
        balanceAfter: newBalance,
        description: `Shop: ${item.name}`,
      });

      // 5. Push purchase notification
      try {
        pushNotification(userId, {
          type: "item_purchased",
          title: "Purchase Successful",
          body: `You acquired "${item.name}" for ${price.toFixed(2)} Scalps.`,
          linkTo: "/shop",
          meta: { itemId: item.id },
        });
      } catch { /* non-critical */ }

      res.json({ success: true, item });
    } catch (err) {
      console.error("shop/purchase error:", err);
      res.status(500).json({ message: "Purchase failed" });
    }
  });

  /** POST /api/shop/equip/:itemId — equip an owned item */
  app.post("/api/shop/equip/:itemId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { itemId } = req.params;

      // Verify ownership
      const [owned] = await db
        .select()
        .from(userInventory)
        .where(and(eq(userInventory.userId, userId), eq(userInventory.itemId, itemId)));
      if (!owned) {
        return res.status(403).json({ message: "Item not owned" });
      }

      const [item] = await db.select().from(shopItems).where(eq(shopItems.id, itemId));
      if (!item) return res.status(404).json({ message: "Item not found" });

      // Upsert: one equipped item per category per user
      await db
        .insert(userEquipped)
        .values({ userId, category: item.category, itemId })
        .onConflictDoUpdate({
          target: [userEquipped.userId, userEquipped.category],
          set: { itemId, equippedAt: new Date() },
        });

      res.json({ success: true });
    } catch (err) {
      console.error("shop/equip error:", err);
      res.status(500).json({ message: "Failed to equip item" });
    }
  });

  /** POST /api/shop/unequip/:category — unequip the item in a category */
  app.post("/api/shop/unequip/:category", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { category } = req.params;
      await db
        .delete(userEquipped)
        .where(and(eq(userEquipped.userId, userId), eq(userEquipped.category, category)));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to unequip item" });
    }
  });

  /** GET /api/shop/coins — return user's coins balance */
  app.get("/api/shop/coins", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({ coinsBalance: user.coinsBalance ?? 0 });
    } catch (err) {
      res.status(500).json({ message: "Failed to get coins balance" });
    }
  });

  /** POST /api/shop/buy-coins — purchase a coin pack (deducts real balance) */
  app.post("/api/shop/buy-coins", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { packId } = req.body as { packId: string };
      const COIN_PACKS: Record<string, { coins: number; price: number; label: string }> = {
        starter: { coins: 500,  price: 4.99,  label: "500 Coins" },
        popular: { coins: 1200, price: 9.99,  label: "1,200 Coins" },
        mega:    { coins: 3200, price: 24.99, label: "3,200 Coins" },
        elite:   { coins: 7000, price: 49.99, label: "7,000 Coins" },
      };
      const pack = COIN_PACKS[packId];
      if (!pack) return res.status(400).json({ message: "Invalid coin pack" });

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const currentBalance = parseFloat(user.balance as string);
      if (currentBalance < pack.price) {
        return res.status(402).json({ message: "Insufficient balance. Add funds first." });
      }

      const newBalance = (currentBalance - pack.price).toFixed(2);
      const newCoins = (user.coinsBalance ?? 0) + pack.coins;

      await db.update(users)
        .set({ balance: newBalance, coinsBalance: newCoins })
        .where(eq(users.id, userId));

      // Record transaction
      await db.insert(transactions).values({
        userId,
        type: "coin_purchase",
        amount: (-pack.price).toFixed(2),
        balanceBefore: currentBalance.toFixed(2),
        balanceAfter: newBalance,
        description: `Coin Pack: ${pack.label}`,
      });

      res.json({ success: true, coinsAdded: pack.coins, coinsBalance: newCoins });
    } catch (err) {
      console.error("buy-coins error:", err);
      res.status(500).json({ message: "Purchase failed" });
    }
  });

  /** POST /api/shop/purchase/:itemId — updated to support coin payment */
  // (coins payment variant — the original USD route stays for real-balance purchases)
  app.post("/api/shop/purchase-coins/:itemId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { itemId } = req.params;

      const [item] = await db.select().from(shopItems).where(eq(shopItems.id, itemId)).limit(1);
      if (!item || !item.isActive) return res.status(404).json({ message: "Item not found" });

      const existing = await db.select().from(userInventory)
        .where(and(eq(userInventory.userId, userId), eq(userInventory.itemId, itemId)))
        .limit(1);
      if (existing.length > 0) return res.status(409).json({ message: "Already owned" });

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const coinCost = item.coinPrice ?? 0;
      const currentCoins = user.coinsBalance ?? 0;
      if (currentCoins < coinCost) return res.status(402).json({ message: "Not enough coins" });

      await db.update(users)
        .set({ coinsBalance: currentCoins - coinCost })
        .where(eq(users.id, userId));

      await db.insert(userInventory).values({ userId, itemId });

      res.json({ success: true, item, coinsBalance: currentCoins - coinCost });
    } catch (err) {
      console.error("purchase-coins error:", err);
      res.status(500).json({ message: "Purchase failed" });
    }
  });

  // ─── Battle Pass Routes ──────────────────────────────────────────────────
  app.get("/api/battle-pass", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [season] = await db.select().from(battlePassSeasons).where(eq(battlePassSeasons.isActive, true)).limit(1);
      if (!season) return res.json(null);
      const tiers = await db.select().from(battlePassTiers).where(eq(battlePassTiers.seasonId, season.id)).orderBy(battlePassTiers.tier);
      const [progress] = await db.select().from(userBattlePassProgress).where(and(eq(userBattlePassProgress.userId, userId), eq(userBattlePassProgress.seasonId, season.id)));
      if (!progress) {
        await db.insert(userBattlePassProgress).values({ userId, seasonId: season.id, currentXp: 0, claimedTiers: [], hasPremium: false });
        return res.json({ season, tiers, progress: { currentXp: 0, claimedTiers: [], hasPremium: false } });
      }
      res.json({ season, tiers, progress });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/battle-pass/claim/:tier", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tierNum = parseInt(req.params.tier);
      const isPremiumClaim = req.body?.isPremium === true;
      // claimKey: free = tierNum, premium = tierNum + 1000
      const claimKey = isPremiumClaim ? tierNum + 1000 : tierNum;

      const [season] = await db.select().from(battlePassSeasons).where(eq(battlePassSeasons.isActive, true)).limit(1);
      if (!season) return res.status(404).json({ message: "No active season" });

      // Find the specific tier row (free or premium)
      const allTiers = await db.select().from(battlePassTiers)
        .where(and(eq(battlePassTiers.seasonId, season.id), eq(battlePassTiers.tier, tierNum)));
      const tier = allTiers.find(t => t.isPremium === isPremiumClaim);
      if (!tier) return res.status(404).json({ message: "Tier not found" });

      let [progress] = await db.select().from(userBattlePassProgress)
        .where(and(eq(userBattlePassProgress.userId, userId), eq(userBattlePassProgress.seasonId, season.id)));
      if (!progress) return res.status(400).json({ message: "No progress found" });
      if (progress.claimedTiers.includes(claimKey)) return res.status(409).json({ message: "Already claimed" });
      if (progress.currentXp < tier.xpRequired) return res.status(400).json({ message: "Not enough XP" });
      if (isPremiumClaim && !progress.hasPremium) return res.status(403).json({ message: "Premium battle pass required" });

      const newClaimed = [...progress.claimedTiers, claimKey];
      await db.update(userBattlePassProgress).set({ claimedTiers: newClaimed }).where(eq(userBattlePassProgress.id, progress.id));

      if (tier.rewardType === "scalps") {
        const amount = tier.rewardValue;
        await storage.updateUserBalance(userId, amount, "battle_pass_reward", null,
          `Battle Pass Tier ${tierNum} ${isPremiumClaim ? "Premium" : "Free"} reward`);
      }
      res.json({ success: true, tier: tierNum, isPremium: isPremiumClaim, reward: tier });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Battle Pass XP add (used when challenges are completed, matches finish, etc.)
  app.post("/api/battle-pass/add-xp", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { amount } = req.body;
      if (typeof amount !== "number" || amount <= 0) return res.status(400).json({ message: "Invalid amount" });
      await storage.addBattlePassXP(userId, amount);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Battle Pass premium purchase (500 Scalps)
  app.post("/api/battle-pass/purchase", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const PREMIUM_PRICE = "10.00";
      const [season] = await db.select().from(battlePassSeasons).where(eq(battlePassSeasons.isActive, true)).limit(1);
      if (!season) return res.status(404).json({ message: "No active season" });
      let [progress] = await db.select().from(userBattlePassProgress)
        .where(and(eq(userBattlePassProgress.userId, userId), eq(userBattlePassProgress.seasonId, season.id)));
      if (progress?.hasPremium) return res.status(409).json({ message: "Premium already active" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (parseFloat(user.balance) < parseFloat(PREMIUM_PRICE)) return res.status(402).json({ message: "Insufficient Scalps balance" });
      await storage.updateUserBalance(userId, `-${PREMIUM_PRICE}`, "battle_pass_purchase", null, "Battle Pass Premium Season Purchase");
      if (!progress) {
        await db.insert(userBattlePassProgress).values({ userId, seasonId: season.id, currentXp: 0, claimedTiers: [], hasPremium: true });
      } else {
        await db.update(userBattlePassProgress).set({ hasPremium: true }).where(eq(userBattlePassProgress.id, progress.id));
      }
      res.json({ success: true, season: season.name });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ─── Live Matches (Spectator) ─────────────────────────────────────────────
  // Recent completed matches for activity feed (public)
  app.get("/api/activity/recent", async (_req, res) => {
    try {
      const recent = await db.query.matches.findMany({
        where: and(eq(matches.status, "completed"), eq(matches.isPractice, false), eq(matches.isBotMatch, false)),
        with: {
          player1: { columns: MATCH_PLAYER_COLUMNS },
          player2: { columns: MATCH_PLAYER_COLUMNS },
          winner:  { columns: MATCH_PLAYER_COLUMNS },
        },
        orderBy: [desc(matches.createdAt)],
        limit: 8,
      });
      res.json(recent.map(m => ({
        matchId: m.id,
        gameType: m.gameType,
        potAmount: m.potAmount,
        winnerName: m.winner?.username ?? m.winner?.firstName ?? "A player",
        loserName: m.winnerId === m.player1Id
          ? (m.player2?.username ?? m.player2?.firstName ?? "Opponent")
          : (m.player1?.username ?? m.player1?.firstName ?? "Opponent"),
        completedAt: m.completedAt ?? m.createdAt,
      })));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/matches/live", async (req, res) => {
    try {
      const liveMatches = await db.query.matches.findMany({
        where: and(eq(matches.status, "in-progress"), eq(matches.isPractice, false), eq(matches.isBotMatch, false)),
        with: {
          player1: { columns: MATCH_PLAYER_COLUMNS },
          player2: { columns: MATCH_PLAYER_COLUMNS },
        },
        orderBy: [desc(matches.createdAt)],
        limit: 20,
      });
      const withSpectators = liveMatches.map(m => ({
        ...m,
        spectatorCount: spectatorConnections.get(m.id)?.size ?? 0,
      }));
      res.json(withSpectators);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ─── Betting Slip ─────────────────────────────────────────────────────────
  app.get("/api/wallet/bets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const bets = await db.select().from(transactions)
        .where(and(eq(transactions.userId, userId), eq(transactions.type, "bet_placed")))
        .orderBy(desc(transactions.createdAt)).limit(50);
      const betMatchIds = bets.map(b => b.matchId).filter(Boolean) as string[];
      const matchResults: Record<string, any> = {};
      if (betMatchIds.length > 0) {
        const winTxns = await db.select().from(transactions)
          .where(and(eq(transactions.userId, userId), eq(transactions.type, "win")));
        winTxns.forEach(t => { if (t.matchId) matchResults[t.matchId] = { status: "won", amount: t.amount }; });
        const lossTxns = await db.select().from(transactions)
          .where(and(eq(transactions.userId, userId), eq(transactions.type, "loss")));
        lossTxns.forEach(t => { if (t.matchId) matchResults[t.matchId] = { status: "lost", amount: t.amount }; });
      }
      const enriched = bets.map(b => ({
        ...b,
        outcome: b.matchId ? matchResults[b.matchId] : null,
      }));
      res.json(enriched);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ═══════════════════════════════════════════════════════════

  const httpServer = createServer(app);

  // WebSocket server for real-time game updates (noServer mode for manual upgrade handling)
  const wss = new WebSocketServer({ noServer: true });

  // Store active connections by match ID with user info
  interface AuthenticatedWebSocket extends WebSocket {
    userId?: string;
    matchId?: string;
    lastPaddleUpdate?: number; // For input throttling (anti-cheat)
    lastBlockBlastAction?: number; // For block blast rate limiting
  }
  const matchConnections = new Map<string, Set<AuthenticatedWebSocket>>();
  const spectatorConnections = new Map<string, Set<AuthenticatedWebSocket>>();

  // Track online users by their user ID
  const userConnections = new Map<string, Set<AuthenticatedWebSocket>>();

  // Live online player count
  app.get("/api/stats/online", (_req, res) => {
    res.json({ count: userConnections.size });
  });
  
  // Track disconnect timers for forfeit handling
  interface DisconnectTimer {
    timer: NodeJS.Timeout;
    userId: string;
    matchId: string;
  }
  const disconnectTimers = new Map<string, DisconnectTimer>();
  
  // Air Hockey game state management
  interface AirHockeyMatchState {
    engine: AirHockeyEngine;
    intervalId: NodeJS.Timeout | null;
  }
  const airHockeyMatches = new Map<string, AirHockeyMatchState>();

  // Block Blast PvP: server-side timer per active match (matchId -> { startTime, timerId })
  interface BlockBlastMatchTimer {
    startTime: number;       // epoch ms when game started
    timerId: NodeJS.Timeout; // fires when 90s elapses
  }
  const blockBlastTimers = new Map<string, BlockBlastMatchTimer>();

  // End a block blast match by time expiry
  async function endBlockBlastByTime(matchId: string) {
    blockBlastTimers.delete(matchId);
    try {
      const match = await storage.getMatch(matchId);
      if (!match || match.status !== 'in-progress') return;

      const gs = (match.gameState as any) || {};
      const p1Score = gs.player1Board?.score ?? 0;
      const p2Score = gs.player2Board?.score ?? 0;
      const winnerType = p1Score > p2Score ? 'player1' : p2Score > p1Score ? 'player2' : null;
      const winnerId = winnerType === 'player1' ? match.player1Id
                     : winnerType === 'player2' ? match.player2Id
                     : null;

      const finalGs = {
        ...gs,
        status: 'finished',
        timeRemaining: 0,
        winner: winnerType ?? 'tie',
      };
      await storage.updateMatchState(matchId, finalGs);
      const completedMatch = await storage.completeMatch(matchId, winnerId, p1Score, p2Score);
      await achievementService.checkAndAwardAchievements(completedMatch);

      const connections = matchConnections.get(matchId);
      if (connections) {
        const doneMsg = JSON.stringify({ type: 'matchComplete', matchId, winner: winnerId, gameState: finalGs });
        connections.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) client.send(doneMsg);
        });
      }
    } catch (err) {
      console.error('[Block Blast] endBlockBlastByTime error:', err);
    }
  }

  // Block Blast: server-side gravity intervals per match
  const blockBlastGravityIntervals = new Map<string, NodeJS.Timeout>();

  // Start server-side gravity for a PvP Block Blast match
  function startBlockBlastGravity(matchId: string) {
    if (blockBlastGravityIntervals.has(matchId)) return; // already running
    const intervalId = setInterval(async () => {
      if (!blockBlastTimers.has(matchId)) {
        // Match timer is gone — game ended, stop gravity
        clearInterval(intervalId);
        blockBlastGravityIntervals.delete(matchId);
        return;
      }
      try {
        const match = await storage.getMatch(matchId);
        if (!match || match.status !== 'in-progress' || match.gameType !== 'block-blast') {
          clearInterval(intervalId);
          blockBlastGravityIntervals.delete(matchId);
          return;
        }
        const gs = match.gameState as any;
        if (!gs?.player1Board || gs.status !== 'playing') return;

        const { spawnPiece, movePiece, clearLines, addGarbageRows, isGameOver } = await import('@shared/blockBlastEngine');

        // Apply gravity "down" to both players
        let changed = false;
        let newGs = { ...gs };

        for (const [boardKey, oppKey, pType] of [
          ['player1Board', 'player2Board', 'player1'],
          ['player2Board', 'player1Board', 'player2'],
        ] as const) {
          let board = { ...newGs[boardKey] };
          if (!board.currentPiece) {
            board = spawnPiece(board, pType);
          }
          const moved = movePiece(board, 'down', pType);
          if (moved.currentPiece === null) {
            // Piece locked
            const { board: clearedBoard, linesCleared } = clearLines(moved);
            let b = clearedBoard;
            let opp = { ...newGs[oppKey] };
            if (newGs.garbageEnabled && linesCleared >= 2) {
              opp = addGarbageRows(opp, Math.floor(linesCleared / 2));
            }
            if (b.garbageRows > 0) {
              b = addGarbageRows(b, b.garbageRows);
              b = { ...b, garbageRows: 0 };
            }
            b = spawnPiece(b, pType);
            const gameOver = isGameOver(b);
            newGs = {
              ...newGs,
              [boardKey]: b,
              [oppKey]: opp,
              status: gameOver ? 'finished' : 'playing',
              winner: gameOver ? (pType === 'player1' ? 'player2' : 'player1') : newGs.winner,
            };
          } else {
            newGs = { ...newGs, [boardKey]: moved };
          }
          changed = true;
        }

        if (!changed) return;

        // Update timeRemaining from server timer
        const timerInfo = blockBlastTimers.get(matchId);
        if (timerInfo) {
          newGs = { ...newGs, timeRemaining: Math.max(0, (90000 - (Date.now() - timerInfo.startTime)) / 1000) };
        }

        await storage.updateMatchState(matchId, newGs);

        const connections = matchConnections.get(matchId);
        if (!connections) return;

        if (newGs.status === 'finished') {
          clearInterval(intervalId);
          blockBlastGravityIntervals.delete(matchId);
          const timerEntry = blockBlastTimers.get(matchId);
          if (timerEntry) { clearTimeout(timerEntry.timerId); blockBlastTimers.delete(matchId); }
          const winnerType = newGs.winner;
          const match2 = await storage.getMatch(matchId);
          if (!match2) return;
          const winnerId = winnerType === 'player1' ? match2.player1Id
                         : winnerType === 'player2' ? match2.player2Id
                         : null;
          const completedMatch = await storage.completeMatch(matchId, winnerId, newGs.player1Board.score ?? 0, newGs.player2Board.score ?? 0);
          await achievementService.checkAndAwardAchievements(completedMatch);
          const doneMsg = JSON.stringify({ type: 'matchComplete', matchId, winner: winnerId, gameState: newGs });
          connections.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(doneMsg); });
        } else {
          const msg = JSON.stringify({ type: 'gameState', matchId, gameState: newGs });
          connections.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
        }
      } catch (err) {
        console.error('[Block Blast] gravity tick error:', err);
      }
    }, 1000);
    blockBlastGravityIntervals.set(matchId, intervalId);
  }

  // Constants for forfeit handling
  const DISCONNECT_GRACE_MS = 30000; // 30 seconds grace period
  
  // Air Hockey: Initialize and start game loop for a match
  async function startAirHockeyMatch(matchId: string) {
    const match = await storage.getMatch(matchId);
    if (!match || match.gameType !== 'air-hockey') return;
    
    // Initialize engine
    const engine = new AirHockeyEngine(7); // First to 7 wins
    engine.startGame();
    
    const matchState: AirHockeyMatchState = {
      engine,
      intervalId: null,
    };
    
    airHockeyMatches.set(matchId, matchState);
    await storage.updateMatchState(matchId, engine.getState());
    
    // Start physics loop (60 FPS physics, 25Hz network updates)
    let ticksSinceSave = 0;
    let ticksSinceBroadcast = 0;
    const SAVE_INTERVAL_TICKS = 30; // Save every 30 ticks (0.5 seconds at 60 FPS)
    const BROADCAST_INTERVAL_TICKS = 2; // Broadcast every 2 ticks (~30Hz at 60 FPS)
    
    const intervalId = setInterval(async () => {
      const state = airHockeyMatches.get(matchId);
      if (!state) {
        clearInterval(intervalId);
        return;
      }
      
      // Update physics (runs every tick at 60 FPS)
      const result = state.engine.update();
      const gameState = state.engine.getState();
      
      // Throttle database writes - save every 0.5 seconds instead of every frame
      ticksSinceSave++;
      if (ticksSinceSave >= SAVE_INTERVAL_TICKS) {
        ticksSinceSave = 0;
        // Non-blocking persistence
        storage.updateMatchState(matchId, gameState).catch(err => {
          console.error('[Air Hockey] Failed to save state:', err);
        });
      }
      
      // Check if game is finished
      if (gameState.status === 'finished') {
        const winner = state.engine.getWinner();
        const winnerId = winner === 'left' ? match.player1Id : match.player2Id;
        const player1Score = gameState.leftScore;
        const player2Score = gameState.rightScore;
        
        // Save final state
        await storage.updateMatchState(matchId, gameState);
        
        // Complete match with betting logic
        const completedMatch = await storage.completeMatch(matchId, winnerId, player1Score, player2Score);
        
        // Calculate and update ELO ratings (only for real PvP matches, not practice/bot)
        if (!match.isPractice && !match.isBotMatch && match.player2Id) {
          const { calculateEloChange } = await import("@shared/eloEngine");
          
          // Get both players
          const player1 = await storage.getUser(match.player1Id);
          const player2 = await storage.getUser(match.player2Id);
          
          if (player1 && player2) {
            const player1Rating = player1.airHockeyRating || 1200;
            const player2Rating = player2.airHockeyRating || 1200;
            
            // Use total rated games played for K-factor calculation (not placement matches)
            const player1GamesPlayed = player1.airHockeyRatedGamesPlayed || 0;
            const player2GamesPlayed = player2.airHockeyRatedGamesPlayed || 0;
            
            const player1Won = winnerId === match.player1Id;
            
            const eloResult = calculateEloChange(
              player1Rating,
              player2Rating,
              player1GamesPlayed,
              player2GamesPlayed,
              player1Won,
              0.5,
              0.5,
              player1.airHockeyWinStreak || 0,
              player2.airHockeyWinStreak || 0,
            );
            
            // Extract new ratings and changes
            const newPlayer1Rating = eloResult.player1NewRating;
            const newPlayer2Rating = eloResult.player2NewRating;
            const player1Change = eloResult.player1Change;
            const player2Change = eloResult.player2Change;
            
            await Promise.all([
              storage.updatePlayerRating(match.player1Id, 'air-hockey', newPlayer1Rating, player1Change, match.id),
              storage.updatePlayerRating(match.player2Id, 'air-hockey', newPlayer2Rating, player2Change, match.id),
              storage.updatePlacementMatches(match.player1Id, 'air-hockey'),
              storage.updatePlacementMatches(match.player2Id, 'air-hockey'),
              storage.updateRatedGamesPlayed(match.player1Id, 'air-hockey'),
              storage.updateRatedGamesPlayed(match.player2Id, 'air-hockey'),
              storage.updateWinStreak(match.player1Id, 'air-hockey', player1Won),
              storage.updateWinStreak(match.player2Id, 'air-hockey', !player1Won),
            ]);

            const { getRankTier } = await import("@shared/rankUtils");
            const oldP1Tier = getRankTier(player1Rating);
            const newP1Tier = getRankTier(newPlayer1Rating);
            const oldP2Tier = getRankTier(player2Rating);
            const newP2Tier = getRankTier(newPlayer2Rating);
            if (oldP1Tier !== newP1Tier && newPlayer1Rating > player1Rating) {
              createRankUpPost(match.player1Id, newP1Tier, "Air Hockey").catch(() => {});
            }
            if (oldP2Tier !== newP2Tier && newPlayer2Rating > player2Rating) {
              createRankUpPost(match.player2Id, newP2Tier, "Air Hockey").catch(() => {});
            }
            
            // Save match statistics for both players
            const leftStats = gameState.leftStats;
            const rightStats = gameState.rightStats;
            
            // Calculate possession percentage
            const totalPossession = leftStats.possessionSeconds + rightStats.possessionSeconds;
            const leftPossessionPercent = totalPossession > 0 
              ? (leftStats.possessionSeconds / totalPossession) * 100 
              : 50;
            const rightPossessionPercent = totalPossession > 0 
              ? (rightStats.possessionSeconds / totalPossession) * 100 
              : 50;
            
            const player1Stats = {
              goals: leftStats.goals,
              shots: leftStats.shots,
              saves: leftStats.saves,
              hitSpeedPeak: leftStats.hitSpeedPeak,
              possessionSeconds: leftStats.possessionSeconds,
              possessionPercent: leftPossessionPercent.toFixed(1),
              ratingBefore: player1Rating,
              ratingAfter: newPlayer1Rating,
              ratingChange: player1Change,
              upsetBonus: eloResult.player1Bonuses.upsetBonus,
              streakBonus: eloResult.player1Bonuses.streakBonus,
              streakMultiplier: eloResult.player1Bonuses.streakMultiplier,
              closeMatchProtection: eloResult.player1Bonuses.closeMatchProtection,
              wasUpset: eloResult.player1Bonuses.wasUpset,
              wasCloseMatch: eloResult.player1Bonuses.wasCloseMatch,
            };
            
            const player2Stats = {
              goals: rightStats.goals,
              shots: rightStats.shots,
              saves: rightStats.saves,
              hitSpeedPeak: rightStats.hitSpeedPeak,
              possessionSeconds: rightStats.possessionSeconds,
              possessionPercent: rightPossessionPercent.toFixed(1),
              ratingBefore: player2Rating,
              ratingAfter: newPlayer2Rating,
              ratingChange: player2Change,
              upsetBonus: eloResult.player2Bonuses.upsetBonus,
              streakBonus: eloResult.player2Bonuses.streakBonus,
              streakMultiplier: eloResult.player2Bonuses.streakMultiplier,
              closeMatchProtection: eloResult.player2Bonuses.closeMatchProtection,
              wasUpset: eloResult.player2Bonuses.wasUpset,
              wasCloseMatch: eloResult.player2Bonuses.wasCloseMatch,
            };
            
            await Promise.all([
              storage.saveMatchStatistics(matchId, match.player1Id, player1Stats),
              storage.saveMatchStatistics(matchId, match.player2Id, player2Stats),
            ]);
          }
        }
        
        // Check and award achievements
        const { achievementService } = await import("./achievementService");
        await achievementService.checkAndAwardAchievements(completedMatch);

        if (winnerId) {
          const score = `${player1Score}-${player2Score}`;
          createWinPost(winnerId, "", "Air Hockey", "0", score).catch(() => {});
        }

        checkAndUpdateGoat().catch(() => {});

        // Reputation: both players gain +1 for completing a match normally
        try {
          if (completedMatch.player1Id) {
            await db.execute(drizzleSql`UPDATE users SET reputation = LEAST(100, reputation + 1) WHERE id = ${completedMatch.player1Id}`);
          }
          if (completedMatch.player2Id) {
            await db.execute(drizzleSql`UPDATE users SET reputation = LEAST(100, reputation + 1) WHERE id = ${completedMatch.player2Id}`);
          }
        } catch { /* non-critical */ }
        
        // Broadcast match completion
        const connections = matchConnections.get(matchId);
        if (connections) {
          const message = JSON.stringify({
            type: 'match-complete',
            matchId,
            match: completedMatch,
          });
          connections.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(message);
            }
          });
        }
        
        clearInterval(intervalId);
        airHockeyMatches.delete(matchId);
      }
      
      // Throttle network broadcasts to ~30Hz (broadcast every 2 ticks)
      ticksSinceBroadcast++;
      if (ticksSinceBroadcast >= BROADCAST_INTERVAL_TICKS) {
        ticksSinceBroadcast = 0;
        
        // Broadcast state to all players with server timestamp for lag compensation
        const connections = matchConnections.get(matchId);
        if (connections) {
          const message = JSON.stringify({
            type: 'air-hockey-state',
            matchId,
            state: gameState,
            serverTimestamp: Date.now(), // Add timestamp for lag compensation
          });
          connections.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(message);
            }
          });
        }
      }
    }, 1000 / 60); // 60 FPS physics tick
    
    matchState.intervalId = intervalId;
  }
  
  // Helper function to process forfeit due to disconnect
  async function processDisconnectForfeit(matchId: string, disconnectedUserId: string) {
    try {
      const match = await storage.getMatch(matchId);
      
      // Only forfeit if match is still in progress
      if (!match || match.status !== 'in-progress') {
        console.log('[FORFEIT] Match not in progress, skipping forfeit:', matchId);
        return;
      }
      
      // Don't forfeit bot or practice matches
      if (match.isBotMatch || match.isPractice) {
        console.log('[FORFEIT] Bot/practice match, skipping forfeit:', matchId);
        return;
      }
      
      console.log('[FORFEIT] Processing disconnect forfeit for match:', matchId, 'user:', disconnectedUserId);
      
      // Call the forfeit API logic
      const updatedMatch = await storage.forfeitMatch(matchId, disconnectedUserId);

      // Reputation: disconnecting player loses 8 points
      try {
        await db.execute(drizzleSql`UPDATE users SET reputation = GREATEST(0, reputation - 8) WHERE id = ${disconnectedUserId}`);
        // Notify the disconnecting player
        pushNotification(disconnectedUserId, {
          type: "you_forfeited",
          title: "You forfeited (disconnect)",
          body: "Disconnecting from a match counts as a forfeit. Your reputation was reduced.",
          linkTo: `/game/${matchId}`,
        });
        // Notify the winner
        if (updatedMatch.winnerId && updatedMatch.winnerId !== disconnectedUserId) {
          pushNotification(updatedMatch.winnerId, {
            type: "opponent_forfeited",
            title: "Opponent disconnected — you win!",
            body: "Your opponent disconnected. The match has been awarded to you.",
            linkTo: `/game/${matchId}`,
          });
        }
      } catch { /* non-critical */ }
      
      // Notify all connected players in the match
      const connections = matchConnections.get(matchId);
      if (connections) {
        const message = JSON.stringify({
          type: 'match-forfeit',
          matchId: matchId,
          forfeitedById: disconnectedUserId,
          winnerId: updatedMatch.winnerId,
          reason: 'disconnect',
          match: updatedMatch
        });
        
        connections.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
      }
      
      console.log('[FORFEIT] Forfeit processed successfully');
    } catch (error) {
      console.error('[FORFEIT] Error processing disconnect forfeit:', error);
    }
  }

  // Get session middleware for WebSocket authentication
  const sessionParser = getSession();

  // Handle WebSocket upgrade with proper session authentication
  httpServer.on('upgrade', (request, socket, head) => {
    // Only handle our WebSocket path
    if (!request.url?.startsWith('/ws')) {
      return;
    }

    // Create a minimal response stub for express-session
    const res: any = {
      getHeader: () => null,
      setHeader: () => {},
      end: () => {}
    };

    // Parse session before upgrading the connection
    sessionParser(request as any, res, () => {
      // Initialize Passport to deserialize user from session
      passport.initialize()(request as any, res, () => {
        passport.session()(request as any, res, () => {
          const req = request as any;
          
          // Extract user from session
          if (req.user && req.user.claims && req.user.claims.sub) {
            // Upgrade the connection and attach user ID
            wss.handleUpgrade(request, socket, head, (ws: AuthenticatedWebSocket) => {
              ws.userId = req.user.claims.sub;
              console.log('[WS] Authenticated WebSocket connection for user:', ws.userId);
              wss.emit('connection', ws, request);
            });
          } else {
            // Reject unauthenticated connections
            console.log('[WS] Rejecting unauthenticated WebSocket connection');
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
          }
        });
      });
    });
  });

  wss.on('connection', (ws: AuthenticatedWebSocket, req: any) => {
    let currentMatchId: string | null = null;

    // Track user as online
    if (ws.userId) {
      if (!userConnections.has(ws.userId)) {
        userConnections.set(ws.userId, new Set());
      }
      userConnections.get(ws.userId)!.add(ws);
      
      // Broadcast online status to all users
      wss.clients.forEach((client: AuthenticatedWebSocket) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'user-status-change',
            userId: ws.userId,
            status: 'online'
          }));
        }
      });
    }

    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === 'join' && data.matchId) {
          // Validate that the user is part of this match
          const match = await storage.getMatch(data.matchId);
          if (!match) {
            console.log('[WS] Match not found:', data.matchId);
            ws.close(1008, 'Match not found');
            return;
          }
          
          // Use session-authenticated userId (set at WS upgrade); never trust data.userId
          const authenticatedUserId = ws.userId;
          if (!authenticatedUserId) {
            ws.close(1008, 'Not authenticated');
            return;
          }

          if (match.player1Id !== authenticatedUserId && match.player2Id !== authenticatedUserId) {
            console.log('[WS] User not authorized for match:', authenticatedUserId, data.matchId);
            ws.close(1008, 'Not authorized');
            return;
          }

          // Check if player has exited this match (prevent re-entry for non-PvP matches)
          const isPvPMatch = !match.isBotMatch && !match.isPractice && match.player2Id;
          const hasExited = match.exitedPlayerIds?.includes(authenticatedUserId);
          
          if (hasExited && !isPvPMatch) {
            console.log('[WS] User attempted to rejoin exited match:', authenticatedUserId, data.matchId);
            ws.close(1008, 'Cannot rejoin this match');
            return;
          }

          // Join a match room (ws.userId already set from session; set matchId)
          currentMatchId = data.matchId;
          ws.matchId = data.matchId;
          
          if (!matchConnections.has(data.matchId)) {
            matchConnections.set(data.matchId, new Set());
          }
          matchConnections.get(data.matchId)!.add(ws);
          
          // Cancel any pending forfeit timer for this user reconnecting
          const timerKey = `${data.matchId}-${authenticatedUserId}`;
          const existingTimer = disconnectTimers.get(timerKey);
          if (existingTimer) {
            console.log('[WS] User reconnected, canceling forfeit timer:', authenticatedUserId, data.matchId);
            clearTimeout(existingTimer.timer);
            disconnectTimers.delete(timerKey);
            
            // Notify other players that user reconnected
            const connections = matchConnections.get(data.matchId);
            if (connections) {
              const message = JSON.stringify({
                type: 'player-reconnected',
                matchId: data.matchId,
                userId: authenticatedUserId
              });
              
              connections.forEach((client) => {
                if (client.readyState === WebSocket.OPEN && client.userId !== authenticatedUserId) {
                  client.send(message);
                }
              });
            }
          }
          
          
          // Start Air Hockey match if not already started
          if (match.gameType === 'air-hockey' && !airHockeyMatches.has(data.matchId)) {
            startAirHockeyMatch(data.matchId);
          }

          // Initialize Block Blast PvP match when first player joins
          if (match.gameType === 'block-blast' && match.status === 'in-progress' && !match.isBotMatch && !match.isPractice && match.player2Id) {
            if (!match.gameState || !(match.gameState as any).player1Board) {
              // Initialize state into 'playing' with spawned pieces (skip client-side countdown)
              const { initializeGameState, spawnPiece } = await import('@shared/blockBlastEngine');
              let gs = initializeGameState(90, true);
              gs = { ...gs, status: 'playing', startTime: Date.now(), lastUpdate: Date.now() };
              gs = { ...gs, player1Board: spawnPiece(gs.player1Board, 'player1'), player2Board: spawnPiece(gs.player2Board, 'player2') };
              await storage.updateMatchState(data.matchId, gs);
              // Start server-side timer
              if (!blockBlastTimers.has(data.matchId)) {
                const timerId = setTimeout(() => endBlockBlastByTime(data.matchId), gs.gameDuration * 1000);
                blockBlastTimers.set(data.matchId, { startTime: gs.startTime, timerId });
              }
              // Start server-side gravity interval (~1 second per row)
              startBlockBlastGravity(data.matchId);
              // Broadcast initial state
              const initMsg = JSON.stringify({ type: 'gameState', matchId: data.matchId, gameState: gs });
              matchConnections.get(data.matchId)?.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(initMsg); });
            } else if (match.gameState && (match.gameState as any).status === 'playing') {
              // Match already initialized — reconstruct in-memory timer from persisted startTime if needed
              startBlockBlastGravity(data.matchId);
              if (!blockBlastTimers.has(data.matchId)) {
                const persistedStartTime = (match.gameState as any).startTime || Date.now();
                const elapsed = Date.now() - persistedStartTime;
                const remaining = Math.max(0, 90_000 - elapsed);
                if (remaining > 0) {
                  const timerId = setTimeout(() => endBlockBlastByTime(data.matchId), remaining);
                  blockBlastTimers.set(data.matchId, { startTime: persistedStartTime, timerId });
                } else {
                  // Already expired — end immediately
                  endBlockBlastByTime(data.matchId);
                }
              }
            }
          }
        } else if (data.type === 'spectate' && data.matchId) {
          // Join as spectator
          if (!spectatorConnections.has(data.matchId)) {
            spectatorConnections.set(data.matchId, new Set());
          }
          spectatorConnections.get(data.matchId)!.add(ws);
          (ws as any).spectatingMatchId = data.matchId;
          const spectatorCount = spectatorConnections.get(data.matchId)!.size;
          // Notify all connections (players + spectators) of updated count
          const allConns = [...Array.from(matchConnections.get(data.matchId) ?? []), ...Array.from(spectatorConnections.get(data.matchId) ?? [])];
          allConns.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify({ type: 'spectator-count', matchId: data.matchId, count: spectatorCount })); });
          // Send current game state to spectator if available
          try {
            const match = await storage.getMatch(data.matchId);
            if (match?.gameState) {
              ws.send(JSON.stringify({ type: 'game-state', matchId: data.matchId, gameState: match.gameState, gameType: match.gameType }));
            }
          } catch {}
        } else if (data.type === 'leave-spectate' && data.matchId) {
          const specSet = spectatorConnections.get(data.matchId);
          if (specSet) {
            specSet.delete(ws);
            const spectatorCount = specSet.size;
            const allConns = [...Array.from(matchConnections.get(data.matchId) ?? []), ...Array.from(spectatorConnections.get(data.matchId) ?? [])];
            allConns.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify({ type: 'spectator-count', matchId: data.matchId, count: spectatorCount })); });
          }
          (ws as any).spectatingMatchId = undefined;
        } else if (data.type === 'chess-move' && data.matchId) {
          // Chess move with validation
          if (!ws.userId || ws.matchId !== data.matchId) {
            console.log('[WS] Unauthorized chess move attempt');
            ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
            return;
          }

          try {
            const match = await storage.getMatch(data.matchId);
            if (!match || match.gameType !== 'chess') {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid match' }));
              return;
            }

            // Get current game state or initialize
            let gameState: ChessGameState;
            if (match.gameState && (match.gameState as any).board) {
              gameState = match.gameState as ChessGameState;
            } else {
              gameState = initializeChessGameState();
              // Initialize timestamp when game starts
              if (match.timeControl) {
                gameState.lastMoveTimestamp = Date.now();
                gameState.player1TimeRemaining = match.timeControl * 1000;
                gameState.player2TimeRemaining = match.timeControl * 1000;
              }
            }

            // Validate it's the player's turn
            const isPlayer1 = match.player1Id === ws.userId;
            const playerColor = isPlayer1 ? "white" : "black";
            if (gameState.currentTurn !== playerColor) {
              ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
              return;
            }

            // Validate and make move
            const from: Position = data.from;
            const to: Position = data.to;
            const promotionPiece = data.promotionPiece;

            const newState = makeChessMove(gameState, from, to, promotionPiece);
            if (!newState) {
              ws.send(JSON.stringify({ type: 'error', message: 'Illegal move' }));
              return;
            }

            // Server-side time tracking (SECURITY: Don't trust client timeElapsed)
            const now = Date.now();
            
            // Initialize time remaining from match if not in gameState
            if (newState.player1TimeRemaining === undefined && match.timeControl) {
              newState.player1TimeRemaining = match.timeControl * 1000;
            }
            if (newState.player2TimeRemaining === undefined && match.timeControl) {
              newState.player2TimeRemaining = match.timeControl * 1000;
            }
            
            // Calculate elapsed time server-side using last move timestamp
            if (gameState.lastMoveTimestamp && (newState.player1TimeRemaining !== undefined || newState.player2TimeRemaining !== undefined)) {
              const timeElapsedServerSide = now - gameState.lastMoveTimestamp;
              
              // Deduct time from the player who just moved
              const prevTurn = gameState.currentTurn;
              if (prevTurn === "white" && newState.player1TimeRemaining !== undefined) {
                newState.player1TimeRemaining = Math.max(0, newState.player1TimeRemaining - timeElapsedServerSide);
              } else if (prevTurn === "black" && newState.player2TimeRemaining !== undefined) {
                newState.player2TimeRemaining = Math.max(0, newState.player2TimeRemaining - timeElapsedServerSide);
              }
            }
            
            // Store current timestamp for next move
            newState.lastMoveTimestamp = now;

            // Check for timeout
            if ((newState.player1TimeRemaining !== undefined && newState.player1TimeRemaining <= 0) ||
                (newState.player2TimeRemaining !== undefined && newState.player2TimeRemaining <= 0)) {
              const timeoutPlayer = (newState.player1TimeRemaining ?? Infinity) <= 0 ? "player1" : "player2";
              const winner = timeoutPlayer === "player1" ? "player2" : "player1";
              newState.winner = winner === "player1" ? "white" : "black";
              newState.isCheckmate = true;
            }

            // Save updated state
            await storage.updateMatchState(data.matchId, newState);

            // Broadcast to all players
            const connections = matchConnections.get(data.matchId);
            if (connections) {
              const message = JSON.stringify({
                type: 'chess-move',
                matchId: data.matchId,
                gameState: newState,
                move: { from, to, promotionPiece },
              });

              connections.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(message);
                }
              });
            }

            // Complete match if game is over
            if (newState.isCheckmate || newState.isStalemate || newState.isDraw) {
              const player1 = await storage.getUser(match.player1Id);
              const player2 = match.player2Id ? await storage.getUser(match.player2Id) : null;
              const player1Name = player1?.firstName || player1?.email?.split('@')[0] || "Player 1";
              const player2Name = player2?.firstName || player2?.email?.split('@')[0] || "Player 2";
              
              const pgn = generatePGN(newState, player1Name, player2Name);
              const duration = match.startedAt ? Math.floor((Date.now() - new Date(match.startedAt).getTime()) / 1000) : 0;

              let winnerId: string | null = null;
              if (newState.winner === "white") {
                winnerId = match.player1Id;
              } else if (newState.winner === "black" && match.player2Id) {
                winnerId = match.player2Id;
              }

              await storage.completeChessMatch(data.matchId, winnerId, pgn, duration);
            }
          } catch (error) {
            console.error('[WS] Chess move error:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to process move' }));
          }
        } else if (data.type === 'connect4-move' && data.matchId) {
          // Connect 4 move handler with server-side validation
          try {
            if (!ws.userId || ws.matchId !== data.matchId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
              return;
            }

            const match = await storage.getMatch(data.matchId);
            if (!match || match.status !== 'in-progress') {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid match' }));
              return;
            }

            // Get current game state or initialize
            let c4GameState: Connect4GameState;
            if (match.gameState && (match.gameState as any).board) {
              c4GameState = match.gameState as Connect4GameState;
            } else {
              c4GameState = initializeConnect4GameState();
            }

            // Validate it's the player's turn
            const isPlayer1 = match.player1Id === ws.userId;
            const expectedPlayer = c4GameState.currentTurn;
            const actualPlayer = isPlayer1 ? "player1" : "player2";
            
            if (expectedPlayer !== actualPlayer) {
              ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
              return;
            }

            // Validate and make move using engine
            const column = data.column;
            const newGameState = makeConnect4Move(c4GameState, column, actualPlayer);
            
            if (!newGameState) {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid move' }));
              return;
            }

            // Save updated state
            await storage.updateMatchState(data.matchId, newGameState);

            // Broadcast to all players
            const connections = matchConnections.get(data.matchId);
            if (connections) {
              const message = JSON.stringify({
                type: 'connect4-move',
                matchId: data.matchId,
                gameState: newGameState,
              });

              connections.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(message);
                }
              });
            }

            // Complete match if game is over
            if (newGameState.isGameOver) {
              const winner = newGameState.winner;
              const winnerId = winner === "player1" ? match.player1Id : 
                              winner === "player2" ? match.player2Id : null;
              
              const duration = match.startedAt ? 
                Math.floor((Date.now() - new Date(match.startedAt).getTime()) / 1000) : 0;
              const moveSequence = getMoveSequence(newGameState);
              
              await storage.completeConnect4Match(data.matchId, winnerId, moveSequence, duration);
            }
          } catch (error) {
            console.error('[WS] Connect4 move error:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to process move' }));
          }
        } else if (data.type === 'dots-and-boxes-move' && data.matchId) {
          // Dots & Boxes move handler with server-side validation
          try {
            if (!ws.userId || ws.matchId !== data.matchId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
              return;
            }

            const match = await storage.getMatch(data.matchId);
            if (!match || match.status !== 'in-progress') {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid match' }));
              return;
            }

            // Get current game state or initialize
            let gameState: DotsAndBoxesGameState;
            if (match.gameState && (match.gameState as any).gridSize) {
              gameState = match.gameState as DotsAndBoxesGameState;
            } else {
              gameState = initializeDotsAndBoxesGameState(5); // 5x5 grid (4x4 boxes)
            }

            // Validate it's the player's turn (unless practice mode)
            const isPlayer1 = match.player1Id === ws.userId;
            const expectedPlayer = gameState.currentTurn;
            const actualPlayer = isPlayer1 ? "player1" : "player2";
            
            if (!match.isPractice && expectedPlayer !== actualPlayer) {
              ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
              return;
            }

            // Validate and make move using engine
            const line: DotsAndBoxesLine = data.line;
            const newGameState = makeDotsAndBoxesMove(gameState, line);
            
            if (!newGameState) {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid move' }));
              return;
            }

            // Save updated state
            await storage.updateMatchState(data.matchId, newGameState);

            // Broadcast to all players
            const connections = matchConnections.get(data.matchId);
            if (connections) {
              const message = JSON.stringify({
                type: 'gameState',
                matchId: data.matchId,
                gameState: newGameState,
              });

              connections.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(message);
                }
              });
            }

            // Complete match if game is over
            if (newGameState.isGameOver) {
              const winner = newGameState.winner;
              const winnerId = winner === "player1" ? match.player1Id : 
                              winner === "player2" ? match.player2Id : null;
              
              const duration = match.startedAt ? 
                Math.floor((Date.now() - new Date(match.startedAt).getTime()) / 1000) : 0;
              
              await storage.completeMatch(
                data.matchId,
                winnerId,
                newGameState.player1Score,
                newGameState.player2Score
              );

              // Broadcast match completion
              if (connections) {
                const completeMessage = JSON.stringify({
                  type: 'matchComplete',
                  matchId: data.matchId,
                  gameState: newGameState,
                });

                connections.forEach((client) => {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(completeMessage);
                  }
                });
              }
            }
          } catch (error) {
            console.error('[WS] Dots & Boxes move error:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to process move' }));
          }
        } else if (data.type === '8-ball-shot' && data.matchId) {
          // 8-Ball shot handler with server-side physics
          try {
            if (!ws.userId || ws.matchId !== data.matchId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
              return;
            }

            const match = await storage.getMatch(data.matchId);
            if (!match || match.status !== 'in-progress') {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid match' }));
              return;
            }

            // Get current game state or initialize
            const { createInitialState, executeShot, simulatePhysics } = await import('@shared/eightBallEngine');
            let gameState: ReturnType<typeof createInitialState>;
            if (match.gameState && (match.gameState as any).balls) {
              gameState = match.gameState as ReturnType<typeof createInitialState>;
            } else {
              gameState = createInitialState();
            }

            // Validate it's the player's turn
            const isPlayer1 = match.player1Id === ws.userId;
            const expectedPlayer = gameState.currentPlayer;
            const actualPlayer = isPlayer1 ? "player1" : "player2";
            
            if (!match.isPractice && expectedPlayer !== actualPlayer) {
              ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
              return;
            }

            // Execute shot
            const { angle, power } = data;
            let newGameState = executeShot(gameState, angle, power);
            
            // Simulate physics until all balls stop
            let iterations = 0;
            const maxIterations = 500;
            while (newGameState.simulationRunning && iterations < maxIterations) {
              newGameState = simulatePhysics(newGameState);
              iterations++;
            }

            // Save updated state
            await storage.updateMatchState(data.matchId, newGameState);

            // Broadcast to all players (type matches the '8-ball-move' handler in the client)
            const connections = matchConnections.get(data.matchId);
            if (connections) {
              const message = JSON.stringify({
                type: '8-ball-move',
                matchId: data.matchId,
                gameState: newGameState,
              });

              connections.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(message);
                }
              });
            }

            // Complete match if game is over
            if (newGameState.gameOver) {
              const winner = newGameState.winner;
              const winnerId = winner === "player1" ? match.player1Id : 
                              winner === "player2" ? match.player2Id : null;
              
              const duration = match.startedAt ? 
                Math.floor((Date.now() - new Date(match.startedAt).getTime()) / 1000) : 0;
              
              const player1Balls = newGameState.balls.filter((b: any) => 
                b.pocketed && b.type === newGameState.player1Group
              ).length;
              const player2Balls = newGameState.balls.filter((b: any) => 
                b.pocketed && b.type === newGameState.player2Group
              ).length;
              
              await storage.completeMatch(
                data.matchId,
                winnerId,
                player1Balls,
                player2Balls
              );

              // Broadcast match completion
              if (connections) {
                const completeMessage = JSON.stringify({
                  type: 'matchComplete',
                  matchId: data.matchId,
                  gameState: newGameState,
                });

                connections.forEach((client) => {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(completeMessage);
                  }
                });
              }
            }
          } catch (error) {
            console.error('[WS] 8-Ball shot error:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to process shot' }));
          }
        } else if (data.type === 'cup-king-throw' && data.matchId) {
          // Cup King throw handler with server-side physics
          try {
            if (!ws.userId || ws.matchId !== data.matchId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
              return;
            }

            const match = await storage.getMatch(data.matchId);
            if (!match || match.status !== 'in-progress') {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid match' }));
              return;
            }

            // Get current game state or initialize
            const { initCupKingGame, applyCupKingMove, simulateCupKingPhysicsStep, getCupCounts } = await import('@shared/cupKingEngine');
            let gameState: Awaited<ReturnType<typeof initCupKingGame>>;
            if (match.gameState && (match.gameState as any).player1Cups) {
              gameState = match.gameState as Awaited<ReturnType<typeof initCupKingGame>>;
            } else {
              gameState = initCupKingGame();
            }

            // Validate it's the player's turn
            const isPlayer1 = match.player1Id === ws.userId;
            const expectedPlayer = gameState.currentPlayer;
            const actualPlayer = isPlayer1 ? 1 : 2;
            
            if (!match.isPractice && expectedPlayer !== actualPlayer) {
              ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
              return;
            }

            // Apply move
            const { angle, power } = data;
            let newGameState = applyCupKingMove(gameState, { angle, power });
            
            // Simulate physics until ball stops
            let iterations = 0;
            const maxIterations = 500;
            while (newGameState.isSimulating && iterations < maxIterations) {
              const { state: simState, shouldContinue } = simulateCupKingPhysicsStep(newGameState);
              newGameState = simState;
              if (!shouldContinue) break;
              iterations++;
            }

            // Save updated state
            await storage.updateMatchState(data.matchId, newGameState);

            // Broadcast to all players
            const connections = matchConnections.get(data.matchId);
            if (connections) {
              const message = JSON.stringify({
                type: 'gameState',
                matchId: data.matchId,
                gameState: newGameState,
              });

              connections.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(message);
                }
              });
            }

            // Complete match if game is over
            if (newGameState.winner) {
              const winner = newGameState.winner;
              const winnerId = winner === 1 ? match.player1Id : 
                              winner === 2 ? match.player2Id : null;
              
              const duration = match.startedAt ? 
                Math.floor((Date.now() - new Date(match.startedAt).getTime()) / 1000) : 0;
              
              const cupCounts = getCupCounts(newGameState);
              
              await storage.completeMatch(
                data.matchId,
                winnerId,
                cupCounts.player1,
                cupCounts.player2
              );

              // Broadcast match completion
              if (connections) {
                const completeMessage = JSON.stringify({
                  type: 'matchComplete',
                  matchId: data.matchId,
                  gameState: newGameState,
                });

                connections.forEach((client) => {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(completeMessage);
                  }
                });
              }
            }
          } catch (error) {
            console.error('[WS] Cup King throw error:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to process throw' }));
          }
        } else if (data.type === 'stack-tower-drop' && data.matchId) {
          // Stack Tower drop handler
          try {
            if (!ws.userId || ws.matchId !== data.matchId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
              return;
            }

            const match = await storage.getMatch(data.matchId);
            if (!match || match.status !== 'in-progress') {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid match' }));
              return;
            }

            // Get current game state or initialize
            const { initStackTowerGame, applyStackTowerMove, updateStackTowerPhysics } = await import('@shared/stackTowerEngine');
            let gameState: ReturnType<typeof initStackTowerGame>;
            if (match.gameState && (match.gameState as any).player1) {
              gameState = match.gameState as ReturnType<typeof initStackTowerGame>;
            } else {
              gameState = initStackTowerGame();
            }

            // Validate player
            const isPlayer1 = match.player1Id === ws.userId;
            const playerNum = isPlayer1 ? 1 : 2;

            // Apply move (drop block)
            const move = { action: 'drop' as const, timestamp: Date.now() };
            let newGameState = applyStackTowerMove(gameState, playerNum, move);
            
            // Update physics
            newGameState = updateStackTowerPhysics(newGameState);

            // Save updated state
            await storage.updateMatchState(data.matchId, newGameState);

            // Broadcast to all players
            const connections = matchConnections.get(data.matchId);
            if (connections) {
              const message = JSON.stringify({
                type: 'gameState',
                matchId: data.matchId,
                gameState: newGameState,
              });

              connections.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(message);
                }
              });
            }

            // Complete match if game is over
            if (newGameState.gamePhase === 'finished') {
              const winnerId = newGameState.winner === 1 ? match.player1Id : 
                              newGameState.winner === 2 ? match.player2Id : null;
              
              const duration = match.startedAt ? 
                Math.floor((Date.now() - new Date(match.startedAt).getTime()) / 1000) : 0;
              
              await storage.completeMatch(
                data.matchId,
                winnerId,
                newGameState.player1.score,
                newGameState.player2.score
              );

              // Broadcast match completion
              if (connections) {
                const completeMessage = JSON.stringify({
                  type: 'matchComplete',
                  matchId: data.matchId,
                  gameState: newGameState,
                });

                connections.forEach((client) => {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(completeMessage);
                  }
                });
              }
            }
          } catch (error) {
            console.error('[WS] Stack Tower drop error:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to process drop' }));
          }
        } else if (data.type === 'block-blast-action' && data.matchId) {
          // Block Blast: process a discrete player action server-side (authoritative)
          try {
            if (!ws.userId || ws.matchId !== data.matchId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
              return;
            }

            const match = await storage.getMatch(data.matchId);
            if (!match || match.status !== 'in-progress' || match.gameType !== 'block-blast') {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid match' }));
              return;
            }

            const isPlayer1 = match.player1Id === ws.userId;
            const isPlayer2 = match.player2Id === ws.userId;
            if (!isPlayer1 && !isPlayer2) {
              ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
              return;
            }

            // Rate-limit: max 30 actions/sec per player (~33ms between actions)
            const now = Date.now();
            if (!ws.lastBlockBlastAction) ws.lastBlockBlastAction = 0;
            if (now - ws.lastBlockBlastAction < 33) return; // silently drop excess
            ws.lastBlockBlastAction = now;

            const validActions = ['left', 'right', 'down', 'rotate', 'hardDrop', 'hold'];
            const action = data.action;
            if (!validActions.includes(action)) {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid action' }));
              return;
            }

            // Load game state (must already be initialized by join handler; skip if not ready)
            const { spawnPiece, movePiece, rotatePiece, hardDrop: engineHardDrop, holdPiece, clearLines, addGarbageRows, isGameOver } = await import('@shared/blockBlastEngine');
            const gameState = (match.gameState && (match.gameState as any).player1Board)
              ? (match.gameState as any)
              : null;

            if (!gameState || gameState.status !== 'playing') {
              return; // State not yet initialized or game not in playing state
            }

            // Start server-side match timer if not already running
            const GAME_DURATION_MS = 90_000;
            if (!blockBlastTimers.has(data.matchId)) {
              const startTime = gameState.startTime || Date.now();
              const elapsed = Date.now() - startTime;
              const remaining = Math.max(0, GAME_DURATION_MS - elapsed);
              const timerId = setTimeout(() => endBlockBlastByTime(data.matchId), remaining);
              blockBlastTimers.set(data.matchId, { startTime, timerId });
            }

            // Compute current timeRemaining from server's authoritative start time
            const timerInfo = blockBlastTimers.get(data.matchId);
            const serverTimeRemaining = timerInfo
              ? Math.max(0, (GAME_DURATION_MS - (Date.now() - timerInfo.startTime)) / 1000)
              : gameState.timeRemaining;

            const playerType = isPlayer1 ? 'player1' : 'player2';
            const boardKey = isPlayer1 ? 'player1Board' : 'player2Board';
            const oppBoardKey = isPlayer1 ? 'player2Board' : 'player1Board';

            let board = { ...gameState[boardKey] };
            if (!board.currentPiece) {
              board = spawnPiece(board, playerType as 'player1' | 'player2');
            }

            // Apply the action
            if (action === 'rotate') {
              board = rotatePiece(board);
            } else if (action === 'hardDrop') {
              board = engineHardDrop(board, playerType as 'player1' | 'player2');
            } else if (action === 'hold') {
              board = holdPiece(board);
              if (!board.currentPiece) {
                board = spawnPiece(board, playerType as 'player1' | 'player2');
              }
            } else {
              // left, right, down
              board = movePiece(board, action as 'left' | 'right' | 'down', playerType as 'player1' | 'player2');
            }

            let newGameState = { ...gameState };

            // If piece locked: clear lines, apply garbage, spawn next, check game over
            if (board.currentPiece === null) {
              const { board: clearedBoard, linesCleared } = clearLines(board);
              board = clearedBoard;

              let oppBoard = { ...gameState[oppBoardKey] };
              if (gameState.garbageEnabled && linesCleared >= 2) {
                oppBoard = addGarbageRows(oppBoard, Math.floor(linesCleared / 2));
              }
              if (board.garbageRows > 0) {
                board = addGarbageRows(board, board.garbageRows);
                board = { ...board, garbageRows: 0 };
              }

              board = spawnPiece(board, playerType as 'player1' | 'player2');
              const gameOver = isGameOver(board);
              newGameState = {
                ...gameState,
                [boardKey]: board,
                [oppBoardKey]: oppBoard,
                timeRemaining: serverTimeRemaining,
                status: gameOver ? 'finished' : 'playing',
                winner: gameOver ? (playerType === 'player1' ? 'player2' : 'player1') : gameState.winner,
              };
            } else {
              newGameState = { ...gameState, [boardKey]: board, timeRemaining: serverTimeRemaining };
            }

            // If game finished due to piece-stack, cancel the time-based timer
            if (newGameState.status === 'finished') {
              const timer = blockBlastTimers.get(data.matchId);
              if (timer) {
                clearTimeout(timer.timerId);
                blockBlastTimers.delete(data.matchId);
              }
            }

            // Persist canonical state
            await storage.updateMatchState(data.matchId, newGameState);

            // Broadcast updated state to all connected players
            const connections = matchConnections.get(data.matchId);
            if (connections) {
              const msg = JSON.stringify({ type: 'gameState', matchId: data.matchId, gameState: newGameState });
              connections.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) client.send(msg);
              });
            }

            // If game finished, complete match server-side
            if (newGameState.status === 'finished') {
              const winner = newGameState.winner;
              const winnerId = winner === 'player1' ? match.player1Id
                             : winner === 'player2' ? match.player2Id
                             : null;
              const p1Score = newGameState.player1Board?.score ?? 0;
              const p2Score = newGameState.player2Board?.score ?? 0;
              try {
                const completedMatch = await storage.completeMatch(data.matchId, winnerId, p1Score, p2Score);
                await achievementService.checkAndAwardAchievements(completedMatch);
                if (connections) {
                  const doneMsg = JSON.stringify({ type: 'matchComplete', matchId: data.matchId, winner: winnerId, gameState: newGameState });
                  connections.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) client.send(doneMsg);
                  });
                }
              } catch (completeErr) {
                console.error('[WS] Block Blast complete error:', completeErr);
              }
            }
          } catch (error) {
            console.error('[WS] Block Blast action error:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to process block blast action' }));
          }
        } else if (data.type === 'mini-golf-shot' && data.matchId) {
          // Validate user is authenticated and part of this match
          if (!ws.userId || ws.matchId !== data.matchId) {
            console.log('[WS] Unauthorized shot attempt');
            ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
            return;
          }

          try {
            const match = await storage.getMatch(data.matchId);
            if (!match) {
              ws.send(JSON.stringify({ type: 'error', message: 'Match not found' }));
              return;
            }

            if (match.status !== 'in-progress') {
              ws.send(JSON.stringify({ type: 'error', message: 'Match is not in progress' }));
              return;
            }

            // Get current game state
            let gameState: MiniGolfGameState;
            if (match.gameState) {
              gameState = match.gameState as MiniGolfGameState;
              // Backfill matchSeed for matches created before procedural generation
              if (!gameState.matchSeed) gameState = { ...gameState, matchSeed: match.id };
            } else {
              // Initialize new game state with configured hole count; use match ID as procedural seed
              const holeCount = match.miniGolfHoleCount || 3;
              gameState = initializeMiniGolfMatch(match.player1Id, match.player2Id || '', holeCount, 1, match.id);
            }

            // Determine which player is taking the shot
            const player = match.player1Id === ws.userId ? 'player1' : 'player2';

            // Validate it's the player's turn (or practice mode)
            if (!match.isPractice && gameState.currentTurn !== player) {
              ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
              return;
            }

            // Process the shot with server-side physics
            const shotVelocity: Vector2 = data.velocity;
            const newGameState = processShot(gameState, player, shotVelocity);

            // Check if both players have completed the hole
            const bothPlayersComplete = newGameState.player1.holeComplete && newGameState.player2.holeComplete;

            // Advance to next hole if both complete (or practice mode after player completes)
        let finalGameState = newGameState;
        if (bothPlayersComplete || (match.isPractice && newGameState[player].holeComplete)) {
          finalGameState = advanceToNextHole(newGameState);
          console.log('[MiniGolf WS] Both done, advancing to hole', finalGameState.currentHole);
        } else if (match.isBotMatch && newGameState.player1.holeComplete && !newGameState.player2.holeComplete) {
          // Human done in bot match — run bot shots inline so the hole advances in this same request.
          // Eliminates the stall where client would need to call /api/bot-move after a WS round-trip.
          console.log('[MiniGolf WS] Human done, bot inline on hole', newGameState.currentHole);
          const bHD = getHoleDefinition(newGameState.currentHole, newGameState.matchSeed);
          const bCP = bHD ? bHD.cupPosition : { x: 380, y: 60 };
          const bDf = (match.botDifficulty || 'medium') as 'easy' | 'medium' | 'hard';
          let bGs = newGameState;
          let bIter = 0;
          while (!bGs.player2.holeComplete && bGs.player2.strokes < MAX_STROKES_PER_HOLE && bIter < 10) {
            const bV: Vector2 = generateMiniGolfShot(bGs as any, bCP, bDf, bHD);
            bGs = processShot(bGs, 'player2', bV);
            bIter++;
          }
          finalGameState = advanceToNextHole(bGs);
          console.log('[MiniGolf WS] Bot inline done, advancing to hole', finalGameState.currentHole);
        }

            // Save game state
            await storage.updateMatchState(match.id, finalGameState);

            // If match is complete, finalize it
            if (finalGameState.isMatchComplete) {
              const scores = calculateTotalScore(finalGameState);
              let winnerId: string | null = null;
              
              if (scores.winner === 'player1') {
                winnerId = match.player1Id;
              } else if (scores.winner === 'player2') {
                winnerId = match.player2Id || null;
              }

              const completedMatch = await storage.completeMiniGolfMatch(
                match.id,
                winnerId,
                scores.player1Total,
                scores.player2Total,
                finalGameState
              );
              
              await achievementService.checkAndAwardAchievements(completedMatch);
            }

            // Broadcast updated game state to all players
            const connections = matchConnections.get(data.matchId);
            if (connections) {
              const message = JSON.stringify({
                type: 'mini-golf-shot',
                matchId: data.matchId,
                gameState: finalGameState,
              });

              connections.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(message);
                }
              });
            }
          } catch (error) {
            console.error('[WS] Mini golf shot error:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to process shot' }));
          }
        } else if (data.type === 'air-hockey-paddle' && data.matchId) {
          // Air Hockey paddle position update
          if (!ws.userId || ws.matchId !== data.matchId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
            return;
          }

          try {
            const match = await storage.getMatch(data.matchId);
            if (!match || match.status !== 'in-progress') {
              return;
            }

            // Anti-cheat: Input throttling (max 60 messages/sec per player)
            const now = Date.now();
            if (!ws.lastPaddleUpdate) {
              ws.lastPaddleUpdate = 0;
            }
            const timeSinceLastUpdate = now - ws.lastPaddleUpdate;
            if (timeSinceLastUpdate < 16) { // ~60 FPS max
              // Silently drop excessive inputs to prevent spam
              return;
            }
            ws.lastPaddleUpdate = now;

            // Update paddle position using engine with validation
            const matchState = airHockeyMatches.get(data.matchId);
            if (matchState) {
              const move: AirHockeyMove = {
                playerId: ws.userId,
                paddleX: data.paddleX,
                paddleY: data.paddleY,
                timestamp: data.timestamp || Date.now(),
              };
              
              // Validate move before applying (anti-cheat checks)
              if (matchState.engine.validateMove(move, match.player1Id, match.player2Id!)) {
                matchState.engine.applyMove(move, match.player1Id);
              } else {
                console.warn(`[ANTI-CHEAT] Invalid move rejected for user ${ws.userId}`);
              }
            }
          } catch (error) {
            console.error('[WS] Air hockey paddle error:', error);
          }
        } else if (data.type === 'rps-choice' && data.matchId) {
          // Rock Paper Scissors choice submission
          if (!ws.userId || ws.matchId !== data.matchId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
            return;
          }

          try {
            const match = await storage.getMatch(data.matchId);
            if (!match || match.gameType !== 'rock-paper-scissors') {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid match' }));
              return;
            }

            // Get or initialize game state
            let gameState: RPSGameState;
            let engine: RockPaperScissorsEngine;
            
            if (match.gameState && (match.gameState as any).status) {
              gameState = match.gameState as RPSGameState;
              engine = new RockPaperScissorsEngine(gameState.totalRounds);
              engine.loadState(gameState);
            } else {
              // Initialize game with default best of 3 (already starts in "choosing" status)
              engine = new RockPaperScissorsEngine(3);
              gameState = engine.getState();
              // Persist initial state
              await storage.updateMatchState(data.matchId, gameState);
            }

            // Determine which player is making the choice
            const isPlayer1 = match.player1Id === ws.userId;
            const player = isPlayer1 ? "player1" : "player2";
            const choice = data.choice as Choice;

            // Validate choice
            if (!['rock', 'paper', 'scissors'].includes(choice)) {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid choice' }));
              return;
            }

            // Set player choice
            const success = engine.setPlayerChoice(player, choice);
            if (!success) {
              ws.send(JSON.stringify({ type: 'error', message: 'Choice not allowed in current game state' }));
              return;
            }

            const newState = engine.getState();

            // Auto-complete round if both players have chosen (handled in engine)
            if (newState.status === 'revealing') {
              // Delay round completion to allow reveal animation
              setTimeout(() => {
                engine.completeRound();
                const completedState = engine.getState();

                // Save state
                storage.updateMatchState(data.matchId, completedState);

                // If game finished, complete match
                if (completedState.status === 'finished') {
                  const winnerId = completedState.winner === 'player1' ? match.player1Id :
                                  completedState.winner === 'player2' ? match.player2Id! : null;

                  const duration = match.startedAt ? 
                    Math.floor((Date.now() - new Date(match.startedAt).getTime()) / 1000) : 0;

                  storage.completeMatch(
                    data.matchId,
                    winnerId,
                    completedState.player1Score,
                    completedState.player2Score
                  ).then(async (completedMatch) => {
                    await achievementService.checkAndAwardAchievements(completedMatch);
                  });
                }

                // Broadcast completed state
                const connections = matchConnections.get(data.matchId);
                if (connections) {
                  const message = JSON.stringify({
                    type: 'rps-state-update',
                    matchId: data.matchId,
                    gameState: completedState,
                  });

                  connections.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                      client.send(message);
                    }
                  });
                }
              }, 1500); // 1.5 second reveal delay
            }

            // Save updated state
            await storage.updateMatchState(data.matchId, newState);

            // Broadcast to all players
            const connections = matchConnections.get(data.matchId);
            if (connections) {
              const message = JSON.stringify({
                type: 'rps-state-update',
                matchId: data.matchId,
                gameState: newState,
              });

              connections.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(message);
                }
              });
            }
          } catch (error) {
            console.error('[WS] RPS choice error:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to process choice' }));
          }
        } else if (data.type === 'rps-next-round' && data.matchId) {
          // Start next round
          if (!ws.userId || ws.matchId !== data.matchId) {
            return;
          }

          try {
            const match = await storage.getMatch(data.matchId);
            if (!match || match.gameType !== 'rock-paper-scissors') {
              return;
            }

            let gameState: RPSGameState = match.gameState as RPSGameState;
            const engine = new RockPaperScissorsEngine(gameState.totalRounds);
            engine.loadState(gameState);

            // Safety net: if still in "revealing" (bot/practice matches), complete the round first
            if (gameState.status === "revealing") {
              engine.completeRound();
            }

            engine.nextRound();
            const newState = engine.getState();

            await storage.updateMatchState(data.matchId, newState);

            // Broadcast to all players
            const connections = matchConnections.get(data.matchId);
            if (connections) {
              const message = JSON.stringify({
                type: 'rps-state-update',
                matchId: data.matchId,
                gameState: newState,
              });

              connections.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(message);
                }
              });
            }
          } catch (error) {
            console.error('[WS] RPS next round error:', error);
          }
        } else if (data.type === 'basketball-shoot' && data.matchId) {
          // Basketball shot handler with server-side physics simulation
          try {
            if (!ws.userId || ws.matchId !== data.matchId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
              return;
            }
            const match = await storage.getMatch(data.matchId);
            if (!match || match.status !== 'in-progress') {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid match' }));
              return;
            }
            const { createBasketballState, shootBall, simulateBasketball } = await import('@shared/basketballEngine');
            let gameState: any = (match.gameState && (match.gameState as any).phase) ? match.gameState : createBasketballState();
            const isPlayer1 = match.player1Id === ws.userId;
            const expectedPlayer = gameState.currentPlayer;
            if (!match.isPractice && expectedPlayer !== (isPlayer1 ? 'player1' : 'player2')) {
              ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
              return;
            }
            // Apply shot
            let newState = shootBall(gameState, data.angle, data.power);
            // Simulate flight to completion (max 600 frames)
            let iters = 0;
            while (newState.phase === 'flight' && iters < 600) {
              newState = simulateBasketball(newState);
              iters++;
            }
            // Save state
            await storage.updateMatchState(data.matchId, newState);
            // Broadcast state to all players in match
            const connections = matchConnections.get(data.matchId);
            if (connections) {
              const msg = JSON.stringify({ type: 'basketball-state', matchId: data.matchId, gameState: newState });
              connections.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
            }
            // Complete match if game over
            if (newState.phase === 'over' && newState.winner) {
              const winnerId = newState.winner === 'player1' ? match.player1Id :
                newState.winner === 'player2' ? match.player2Id : null;
              await storage.completeMatch(data.matchId, winnerId, newState.player1Score, newState.player2Score);
              if (connections) {
                const doneMsg = JSON.stringify({ type: 'matchComplete', matchId: data.matchId, gameState: newState });
                connections.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(doneMsg); });
              }
            }
          } catch (error) {
            console.error('[WS] Basketball shoot error:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to process shot' }));
          }
        } else if (data.type === 'football-state' && data.matchId) {
          // Football state relay - active player sends state, server broadcasts to opponents
          try {
            if (!ws.userId || ws.matchId !== data.matchId) return;
            const match = await storage.getMatch(data.matchId);
            if (!match || match.status !== 'in-progress') return;
            const gameState = data.gameState;
            await storage.updateMatchState(data.matchId, gameState);
            const connections = matchConnections.get(data.matchId);
            if (connections) {
              const msg = JSON.stringify({ type: 'football-state', matchId: data.matchId, gameState });
              connections.forEach(c => {
                if (c.readyState === WebSocket.OPEN && c.userId !== ws.userId) c.send(msg);
              });
            }
            // Complete match if game over
            if (gameState.phase === 'over' && gameState.winner) {
              const winnerId = gameState.winner === 'player1' ? match.player1Id :
                gameState.winner === 'player2' ? match.player2Id : null;
              await storage.completeMatch(data.matchId, winnerId, gameState.player1Score ?? 0, gameState.player2Score ?? 0);
              if (connections) {
                const doneMsg = JSON.stringify({ type: 'matchComplete', matchId: data.matchId, gameState });
                connections.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(doneMsg); });
              }
            }
          } catch (error) {
            console.error('[WS] Football state relay error:', error);
          }
        } else if (data.type === 'racing-complete' && data.matchId) {
          // Racing: player submits their lap time; when both done, compare and complete match
          try {
            if (!ws.userId || ws.matchId !== data.matchId) return;
            const match = await storage.getMatch(data.matchId);
            if (!match || match.status !== 'in-progress') return;
            const isPlayer1 = match.player1Id === ws.userId;
            const existingState: any = (match.gameState as any) ?? {};
            const updatedState = {
              ...existingState,
              [isPlayer1 ? 'player1Time' : 'player2Time']: data.lapTime,
            };
            await storage.updateMatchState(data.matchId, updatedState);
            const connections = matchConnections.get(data.matchId);
            if (connections) {
              const stateMsg = JSON.stringify({ type: 'racing-state', matchId: data.matchId, gameState: updatedState });
              connections.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(stateMsg); });
            }
            // Complete if both players have finished
            if (updatedState.player1Time != null && updatedState.player2Time != null) {
              const p1Wins = updatedState.player1Time < updatedState.player2Time;
              const winnerId = p1Wins ? match.player1Id : match.player2Id;
              const p1Score = Math.round(1000 / (updatedState.player1Time / 1000 + 1));
              const p2Score = Math.round(1000 / (updatedState.player2Time / 1000 + 1));
              await storage.completeMatch(data.matchId, winnerId, p1Score, p2Score);
              if (connections) {
                const doneMsg = JSON.stringify({ type: 'matchComplete', matchId: data.matchId, gameState: updatedState });
                connections.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(doneMsg); });
              }
            }
          } catch (error) {
            console.error('[WS] Racing complete error:', error);
          }
        } else if (data.type === 'bowling-move' && data.matchId) {
          // Bowling: player throws ball, server runs full physics, broadcasts settled state
          try {
            if (!ws.userId || ws.matchId !== data.matchId) return;
            const match = await storage.getMatch(data.matchId);
            if (!match || match.status !== 'in-progress') return;
            const isPlayer1 = match.player1Id === ws.userId;
            const { createInitialState, executeBowl, simulatePhysics: simBowl } = await import('@shared/bowlingEngine');
            let gameState: any = (match.gameState as any)?.pins ? match.gameState : createInitialState();
            const expectedPlayer = gameState.currentPlayer;
            if (!match.isPractice && expectedPlayer !== (isPlayer1 ? 'player1' : 'player2')) {
              ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
              return;
            }
            const angle = typeof data.angle === 'number' ? data.angle : 0;
            const speed = typeof data.speed === 'number' ? data.speed : 70;
            const spin = typeof data.spin === 'number' ? data.spin : 0;
            let newState = executeBowl(gameState, angle, speed, spin);
            let iters = 0;
            while (newState.simulationRunning && iters < 600) {
              newState = simBowl(newState);
              iters++;
            }
            await storage.updateMatchState(data.matchId, newState);
            const connections = matchConnections.get(data.matchId);
            if (connections) {
              const msg = JSON.stringify({ type: 'bowling-move', matchId: data.matchId, gameState: newState });
              connections.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
            }
            if (newState.gameOver && newState.winner) {
              const winnerId = newState.winner === 'player1' ? match.player1Id :
                newState.winner === 'player2' ? match.player2Id : null;
              const completedMatch = await storage.completeMatch(data.matchId, winnerId, newState.player1TotalScore, newState.player2TotalScore);
              const { achievementService } = await import('./achievementService');
              await achievementService.checkAndAwardAchievements(completedMatch);
              if (connections) {
                const doneMsg = JSON.stringify({ type: 'matchComplete', matchId: data.matchId, gameState: newState });
                connections.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(doneMsg); });
              }
            }
          } catch (error) {
            console.error('[WS] Bowling move error:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to process bowl' }));
          }
        } else if (data.type === 'chat-message') {
          // Handle chat messages
          if (!ws.userId) {
            console.log('[WS] Unauthorized chat attempt');
            ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
            return;
          }

          try {
            // Validate match if it's match-specific chat
            if (data.matchId) {
              const match = await storage.getMatch(data.matchId);
              if (!match) {
                ws.send(JSON.stringify({ type: 'error', message: 'Match not found' }));
                return;
              }
              
              // Check if user is part of the match
              if (match.player1Id !== ws.userId && match.player2Id !== ws.userId) {
                ws.send(JSON.stringify({ type: 'error', message: 'Not authorized for this match' }));
                return;
              }
            }

            // Save chat message to database
            const chatMessage = await storage.createChatMessage({
              userId: ws.userId,
              matchId: data.matchId || null,
              channel: data.channel || 'global',
              message: data.message,
            });

            // Get user details for broadcasting
            const user = await storage.getUser(ws.userId);

            // Broadcast to appropriate channel
            const broadcastMessage = JSON.stringify({
              type: 'chat-message',
              message: {
                ...chatMessage,
                user: user || null,
              },
            });

            if (data.matchId && matchConnections.has(data.matchId)) {
              // Broadcast to match-specific chat
              const connections = matchConnections.get(data.matchId);
              connections?.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(broadcastMessage);
                }
              });
            } else {
              // Broadcast to global lobby chat
              wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(broadcastMessage);
                }
              });
            }
          } catch (error) {
            console.error('[WS] Chat message error:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to send message' }));
          }
        } else if (data.type === 'direct-message') {
          // Handle direct messages
          if (!ws.userId) {
            console.log('[WS] Unauthorized direct message attempt');
            ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
            return;
          }

          try {
            const { recipientId, message } = data;
            
            if (!recipientId || !message) {
              ws.send(JSON.stringify({ type: 'error', message: 'Recipient and message are required' }));
              return;
            }

            // Verify friendship
            const friendship = await storage.checkFriendship(ws.userId, recipientId);
            if (!friendship || friendship.status !== 'accepted') {
              ws.send(JSON.stringify({ type: 'error', message: 'You can only message friends' }));
              return;
            }

            // Save direct message to database
            const directMessage = await storage.createDirectMessage({
              senderId: ws.userId,
              recipientId,
              message: message.trim(),
            });

            // Get sender details for broadcasting
            const sender = await storage.getUser(ws.userId);
            const recipient = await storage.getUser(recipientId);

            // Prepare broadcast message
            const broadcastMessage = JSON.stringify({
              type: 'direct-message',
              message: {
                ...directMessage,
                sender,
                recipient,
              },
            });

            // Send to sender (confirmation)
            ws.send(broadcastMessage);

            // Send to recipient if they're online
            const recipientConnections = userConnections.get(recipientId);
            if (recipientConnections) {
              recipientConnections.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(broadcastMessage);
                }
              });
            }

            console.log('[WS] Direct message sent from', ws.userId, 'to', recipientId);
          } catch (error) {
            console.error('[WS] Direct message error:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to send direct message' }));
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', async () => {
      // Remove user from online tracking
      if (ws.userId && userConnections.has(ws.userId)) {
        userConnections.get(ws.userId)!.delete(ws);
        
        // If user has no more connections, mark as offline
        if (userConnections.get(ws.userId)!.size === 0) {
          userConnections.delete(ws.userId);
          
          // Broadcast offline status to all users
          wss.clients.forEach((client: AuthenticatedWebSocket) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'user-status-change',
                userId: ws.userId,
                status: 'offline'
              }));
            }
          });
        }
      }
      
      // Remove connection from match room
      if (currentMatchId && matchConnections.has(currentMatchId)) {
        matchConnections.get(currentMatchId)!.delete(ws);
        
        // Check if this was an in-progress match
        if (ws.userId && ws.matchId) {
          try {
            const match = await storage.getMatch(ws.matchId);
            
            if (match) {
              const isPvPMatch = !match.isBotMatch && !match.isPractice && match.player2Id;
              
              // For PvP matches: start forfeit timer
              if (match.status === 'in-progress' && isPvPMatch) {
                const timerKey = `${ws.matchId}-${ws.userId}`;
                
                console.log('[WS] Player disconnected from in-progress PvP match:', ws.userId, ws.matchId, 'starting forfeit timer');
                
                // Notify other players that someone disconnected
                const connections = matchConnections.get(ws.matchId);
                if (connections) {
                  const message = JSON.stringify({
                    type: 'player-disconnected',
                    matchId: ws.matchId,
                    userId: ws.userId,
                    gracePeriodMs: DISCONNECT_GRACE_MS
                  });
                  
                  connections.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                      client.send(message);
                    }
                  });
                }
                
                // Start forfeit timer
                const timer = setTimeout(async () => {
                  console.log('[WS] Grace period expired, processing forfeit for:', ws.userId, ws.matchId);
                  await processDisconnectForfeit(ws.matchId!, ws.userId!);
                  disconnectTimers.delete(timerKey);
                }, DISCONNECT_GRACE_MS);
                
                disconnectTimers.set(timerKey, {
                  timer,
                  userId: ws.userId,
                  matchId: ws.matchId
                });
              } 
              // For bot/practice matches: mark player as exited (no re-entry allowed)
              else if ((match.isBotMatch || match.isPractice) && (match.status === 'in-progress' || match.status === 'waiting')) {
                console.log('[WS] Player exited bot/practice match:', ws.userId, ws.matchId, 'marking as exited');
                
                // Update match to track exited player
                const exitedPlayerIds = match.exitedPlayerIds || [];
                if (!exitedPlayerIds.includes(ws.userId)) {
                  exitedPlayerIds.push(ws.userId);
                  
                  // Update via direct database query
                  await db.update(matches)
                    .set({ exitedPlayerIds })
                    .where(eq(matches.id, ws.matchId));
                }
              }
            }
          } catch (error) {
            console.error('[WS] Error handling disconnect:', error);
          }
        }
        
        // Clean up empty match rooms
        if (matchConnections.get(currentMatchId)!.size === 0) {
          matchConnections.delete(currentMatchId);
        }
      }
      // Clean up spectator connections on disconnect
      const spectatingMatchId = (ws as any).spectatingMatchId;
      if (spectatingMatchId) {
        const specSet = spectatorConnections.get(spectatingMatchId);
        if (specSet) {
          specSet.delete(ws);
          const spectatorCount = specSet.size;
          const allConns = [...Array.from(matchConnections.get(spectatingMatchId) ?? []), ...Array.from(spectatorConnections.get(spectatingMatchId) ?? [])];
          allConns.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify({ type: 'spectator-count', matchId: spectatingMatchId, count: spectatorCount })); });
        }
      }
    });
  });

  // ── Tournaments ────────────────────────────────────────────────────────────
  app.get("/api/tournaments", async (req: any, res) => {
    try {
      const result = await db.execute(drizzleSql`
        SELECT t.*, 
          u.first_name as creator_name,
          u.profile_image_url as creator_avatar,
          (SELECT COUNT(*) FROM tournament_participants tp WHERE tp.tournament_id = t.id) as joined_count
        FROM tournaments t
        LEFT JOIN users u ON t.created_by = u.id
        ORDER BY t.is_featured DESC, t.starts_at ASC
      `);
      res.json(result.rows);
    } catch (err) {
      console.error("GET /api/tournaments:", err);
      res.status(500).json({ message: "Failed to load tournaments" });
    }
  });

  app.post("/api/tournaments/:id/join", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { id } = req.params;
    try {
      const [tourn] = await db.execute(drizzleSql`SELECT * FROM tournaments WHERE id = ${id}`).then(r => r.rows) as any[];
      if (!tourn) return res.status(404).json({ message: "Tournament not found" });
      // Already registered → resume, do NOT block, do NOT charge again.
      // Check this BEFORE status/full so existing participants can always re-enter their tournament.
      const existing = await db.execute(drizzleSql`
        SELECT id FROM tournament_participants WHERE tournament_id = ${id} AND user_id = ${userId}
      `).then(r => r.rows);
      if (existing.length > 0) {
        const [userNow] = await db.execute(drizzleSql`SELECT balance FROM users WHERE id = ${userId}`).then(r => r.rows) as any[];
        return res.json({
          success: true,
          alreadyRegistered: true,
          prizePool: tourn.prize_pool,
          currentPlayers: tourn.current_players,
          maxPlayers: tourn.max_players,
          newBalance: userNow?.balance,
        });
      }

      if (tourn.status !== "open") return res.status(400).json({ message: "Tournament is not open" });

      // Check not full
      const joinedCount = Number(tourn.current_players ?? 0);
      if (joinedCount >= Number(tourn.max_players)) {
        return res.status(400).json({ message: "Tournament is full" });
      }

      const fee = parseFloat(tourn.entry_fee as string);
      if (fee > 0) {
        const [usr] = await db.execute(drizzleSql`SELECT balance FROM users WHERE id = ${userId}`).then(r => r.rows) as any[];
        if (!usr || parseFloat(usr.balance) < fee) {
          return res.status(400).json({ message: "Insufficient Scalps" });
        }
        // Deduct entry fee and record transaction
        await db.execute(drizzleSql`UPDATE users SET balance = balance - ${fee} WHERE id = ${userId}`);
        await db.execute(drizzleSql`
          INSERT INTO transactions (id, user_id, type, amount, balance_before, balance_after, description)
          SELECT gen_random_uuid(), ${userId}, 'tournament_entry', ${-fee}, balance + ${fee}, balance,
            ${'Tournament entry: ' + tourn.name}
          FROM users WHERE id = ${userId}
        `);
        // Add entry fee to prize pool
        await db.execute(drizzleSql`UPDATE tournaments SET prize_pool = prize_pool + ${fee} WHERE id = ${id}`);
      }

      await db.execute(drizzleSql`
        INSERT INTO tournament_participants (id, tournament_id, user_id)
        VALUES (gen_random_uuid(), ${id}, ${userId})
        ON CONFLICT (tournament_id, user_id) DO NOTHING
      `);
      await db.execute(drizzleSql`
        UPDATE tournaments SET current_players = (
          SELECT COUNT(*) FROM tournament_participants WHERE tournament_id = ${id}
        ) WHERE id = ${id}
      `);

      // Return updated tournament state
      const [updated] = await db.execute(drizzleSql`SELECT prize_pool, current_players, max_players FROM tournaments WHERE id = ${id}`).then(r => r.rows) as any[];
      const [userAfter] = await db.execute(drizzleSql`SELECT balance FROM users WHERE id = ${userId}`).then(r => r.rows) as any[];

      res.json({
        success: true,
        prizePool: updated?.prize_pool,
        currentPlayers: updated?.current_players,
        maxPlayers: updated?.max_players,
        newBalance: userAfter?.balance,
      });
    } catch (err) {
      console.error("POST /api/tournaments/:id/join:", err);
      res.status(500).json({ message: "Failed to join tournament" });
    }
  });

  // ── Rivals ─────────────────────────────────────────────────────────────────
  app.get("/api/rivals", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const result = await db.execute(drizzleSql`
        SELECT r.*,
          u1.first_name as player1_name, u1.profile_image_url as player1_avatar,
          u2.first_name as player2_name, u2.profile_image_url as player2_avatar
        FROM rivals r
        JOIN users u1 ON r.player1_id = u1.id
        JOIN users u2 ON r.player2_id = u2.id
        WHERE r.player1_id = ${userId} OR r.player2_id = ${userId}
        ORDER BY r.total_matches DESC
      `);
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ message: "Failed to load rivals" });
    }
  });

  // Auto-update rivals after match completion (called internally)
  async function updateRivals(player1Id: string, player2Id: string, winnerId: string | null, potAmount: number) {
    try {
      const [lo, hi] = [player1Id, player2Id].sort();
      const p1wins = winnerId === lo ? 1 : 0;
      const p2wins = winnerId === hi ? 1 : 0;
      await db.execute(drizzleSql`
        INSERT INTO rivals (id, player1_id, player2_id, total_matches, player1_wins, player2_wins, total_scalps_exchanged)
        VALUES (gen_random_uuid(), ${lo}, ${hi}, 1, ${p1wins}, ${p2wins}, ${potAmount})
        ON CONFLICT (player1_id, player2_id) DO UPDATE SET
          total_matches = rivals.total_matches + 1,
          player1_wins = rivals.player1_wins + ${p1wins},
          player2_wins = rivals.player2_wins + ${p2wins},
          total_scalps_exchanged = rivals.total_scalps_exchanged + ${potAmount}
      `);
    } catch (e) { /* non-critical */ }
  }
  (app as any)._updateRivals = updateRivals;

  // ── Player Reporting ────────────────────────────────────────────────────────
  app.post("/api/reports", isAuthenticated, async (req: any, res) => {
    const reporterId = req.user.claims.sub;
    const { reportedUserId, matchId, reason, details } = req.body;
    if (!reportedUserId || !reason) return res.status(400).json({ message: "reportedUserId and reason required" });
    if (reporterId === reportedUserId) return res.status(400).json({ message: "Cannot report yourself" });
    try {
      await db.execute(drizzleSql`
        INSERT INTO player_reports (id, reporter_id, reported_user_id, match_id, reason, details, status, created_at)
        VALUES (gen_random_uuid(), ${reporterId}, ${reportedUserId}, ${matchId || null}, ${reason}, ${details || null}, 'pending', NOW())
      `);
      // Decrease reported user's reputation slightly
      await db.execute(drizzleSql`
        UPDATE users SET reputation = GREATEST(0, reputation - 3) WHERE id = ${reportedUserId}
      `);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to submit report" });
    }
  });

  // ── Wallet Withdraw ─────────────────────────────────────────────────────────
  app.post("/api/wallet/withdraw", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { amount, method = "bank_transfer" } = req.body;
    const withdrawAmount = parseFloat(amount);
    if (!withdrawAmount || withdrawAmount <= 0) {
      return res.status(400).json({ message: "Invalid withdrawal amount" });
    }
    if (withdrawAmount < 5) {
      return res.status(400).json({ message: "Minimum withdrawal is 5 Scalps" });
    }
    try {
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const currentBalance = parseFloat(user.balance || "0");
      if (currentBalance < withdrawAmount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
      const newBalance = (currentBalance - withdrawAmount).toFixed(2);
      await db.execute(drizzleSql`UPDATE users SET balance = ${newBalance} WHERE id = ${userId}`);
      await db.execute(drizzleSql`
        INSERT INTO transactions (id, user_id, type, amount, balance_before, balance_after, description, created_at)
        VALUES (gen_random_uuid(), ${userId}, 'withdrawal', ${(-withdrawAmount).toFixed(2)}, ${user.balance}, ${newBalance}, ${`Withdrawal via ${method} - processing 1-3 business days`}, NOW())
      `);
      res.json({ success: true, newBalance, message: "Withdrawal requested. Funds typically arrive within 1-3 business days." });
    } catch (err) {
      console.error("Withdrawal error:", err);
      res.status(500).json({ message: "Failed to process withdrawal" });
    }
  });

  // ── Wallet Stats ────────────────────────────────────────────────────────────
  app.get("/api/wallet/stats", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const result = await db.execute(drizzleSql`
        SELECT
          COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0)::float AS total_deposited,
          COALESCE(SUM(CASE WHEN type = 'bet_won' THEN amount ELSE 0 END), 0)::float AS total_won,
          COALESCE(SUM(CASE WHEN type IN ('bet_placed','rake') THEN ABS(amount) ELSE 0 END), 0)::float AS total_wagered,
          COALESCE(SUM(CASE WHEN type = 'withdrawal' THEN ABS(amount) ELSE 0 END), 0)::float AS total_withdrawn,
          COUNT(*) AS total_transactions
        FROM transactions WHERE user_id = ${userId}
      `);
      const row = result.rows[0] as any;
      res.json({
        totalDeposited: parseFloat(row.total_deposited),
        totalWon: parseFloat(row.total_won),
        totalWagered: parseFloat(row.total_wagered),
        totalWithdrawn: parseFloat(row.total_withdrawn),
        netPL: parseFloat(row.total_won) - parseFloat(row.total_wagered),
        totalTransactions: parseInt(row.total_transactions),
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch wallet stats" });
    }
  });

  // ── Private Matches ─────────────────────────────────────────────────────────
  app.post("/api/matches/private", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { gameType, wager, deviceType } = req.body;
    if (!gameType) return res.status(400).json({ message: "gameType required" });
    try {
      const code = Math.random().toString(36).substring(2, 9).toUpperCase();
      const betAmount = parseFloat(wager || "0");
      const matchDeviceType = deviceType === "mobile" ? "mobile" : "desktop";
      if (betAmount > 0) {
        const user = await storage.getUser(userId);
        if (!user || parseFloat(user.balance) < betAmount) {
          return res.status(400).json({ message: "Insufficient balance" });
        }
        await storage.updateUserBalance(userId, `-${betAmount}`, "bet_placed", null, `Private match wager - ${gameType}`);
      }
      const result = await db.execute(drizzleSql`
        INSERT INTO matches (id, game_type, status, player1_id, pot_amount, rake_amount, is_private, invite_code, device_type, created_at)
        VALUES (gen_random_uuid(), ${gameType}, 'waiting', ${userId}, ${betAmount.toFixed(2)}, '0.00', true, ${code}, ${matchDeviceType}, NOW())
        RETURNING id, invite_code
      `);
      const match = result.rows[0] as any;
      res.json({ matchId: match.id, inviteCode: match.invite_code, code });
    } catch (err) {
      console.error("Private match error:", err);
      res.status(500).json({ message: "Failed to create private match" });
    }
  });

  app.get("/api/matches/private/:code", isAuthenticated, async (req: any, res) => {
    const { code } = req.params;
    try {
      const result = await db.execute(drizzleSql`
        SELECT m.*, 
          u1.first_name as player1_name, u1.profile_image_url as player1_avatar,
          m.device_type
        FROM matches m
        LEFT JOIN users u1 ON m.player1_id = u1.id
        WHERE m.invite_code = ${code.toUpperCase()} AND m.status = 'waiting'
        LIMIT 1
      `);
      if (!result.rows.length) return res.status(404).json({ message: "Invalid or expired invite code" });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ message: "Failed to find match" });
    }
  });

  // ── Activity Feed ────────────────────────────────────────────────────────────
  app.get("/api/users/:userId/activity", async (req: any, res) => {
    const { userId } = req.params;
    try {
      const [matchesResult, achResult] = await Promise.all([
        db.execute(drizzleSql`
          SELECT m.*, 
            u1.first_name as p1_name, u1.profile_image_url as p1_avatar,
            u2.first_name as p2_name, u2.profile_image_url as p2_avatar
          FROM matches m
          LEFT JOIN users u1 ON m.player1_id = u1.id
          LEFT JOIN users u2 ON m.player2_id = u2.id
          WHERE (m.player1_id = ${userId} OR m.player2_id = ${userId})
            AND m.status = 'completed'
          ORDER BY m.completed_at DESC LIMIT 10
        `),
        db.execute(drizzleSql`
          SELECT ua.*, a.name, a.description, a.icon, a.rarity
          FROM user_achievements ua
          JOIN achievements a ON ua.achievement_id = a.id
          WHERE ua.user_id = ${userId}
          ORDER BY ua.earned_at DESC LIMIT 5
        `),
      ]);
      const activities: any[] = [];
      for (const m of matchesResult.rows as any[]) {
        const isWin = m.winner_id === userId;
        activities.push({
          type: isWin ? "win" : "loss",
          gameType: m.game_type,
          opponent: m.player1_id === userId ? m.p2_name : m.p1_name,
          pot: m.pot_amount,
          at: m.completed_at,
        });
      }
      for (const a of achResult.rows as any[]) {
        activities.push({
          type: "achievement",
          name: a.name,
          icon: a.icon,
          rarity: a.rarity,
          at: a.earned_at,
        });
      }
      activities.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      res.json(activities.slice(0, 15));
    } catch (err) {
      res.status(500).json({ message: "Failed to load activity" });
    }
  });

  // ── Double or Nothing ───────────────────────────────────────────────────────
  app.post("/api/matches/:id/rematch-request", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { id } = req.params;
    const { doubleDown } = req.body;
    try {
      const [match] = await db.execute(drizzleSql`SELECT * FROM matches WHERE id = ${id}`).then(r => r.rows) as any[];
      if (!match) return res.status(404).json({ message: "Match not found" });
      const otherId = match.player1_id === userId ? match.player2_id : match.player1_id;
      res.json({ success: true, otherId, doubleDown });
    } catch (err) {
      res.status(500).json({ message: "Failed" });
    }
  });

  // ── Clan System ─────────────────────────────────────────────────────────────

  /** GET /api/user/clan — current user's clan (or null) */
  app.get("/api/user/clan", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const [membership] = await db.select({ clanId: clanMembers.clanId, role: clanMembers.role })
        .from(clanMembers).where(eq(clanMembers.userId, userId));
      if (!membership) return res.json(null);
      const [clan] = await db.select().from(clans).where(eq(clans.id, membership.clanId));
      res.json({ ...clan, myRole: membership.role });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** GET /api/clans — list/search clans */
  app.get("/api/clans", async (req: any, res) => {
    const { search, limit = "20", offset = "0" } = req.query;
    try {
      const where = search
        ? and(eq(clans.isPublic, true), or(ilike(clans.name, `%${search}%`), ilike(clans.tag, `%${search}%`)))
        : eq(clans.isPublic, true);
      const rows = await db.select().from(clans).where(where)
        .orderBy(desc(clans.seasonPoints)).limit(parseInt(limit as string)).offset(parseInt(offset as string));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** GET /api/clans/:id — clan details with leader info */
  app.get("/api/clans/:id", async (req: any, res) => {
    const { id } = req.params;
    try {
      const [clan] = await db.select().from(clans).where(eq(clans.id, id));
      if (!clan) return res.status(404).json({ message: "Clan not found" });
      const [leader] = await db.select({ id: users.id, username: users.username, firstName: users.firstName, profileImageUrl: users.profileImageUrl })
        .from(clanMembers).innerJoin(users, eq(clanMembers.userId, users.id))
        .where(and(eq(clanMembers.clanId, id), eq(clanMembers.role, "leader")));
      res.json({ ...clan, leader });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** POST /api/clans — create a clan */
  app.post("/api/clans", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      // Check user is not already in a clan
      const [existing] = await db.select({ id: clanMembers.id }).from(clanMembers).where(eq(clanMembers.userId, userId));
      if (existing) return res.status(400).json({ message: "You are already in a clan. Leave your current clan first." });

      const { name, tag, description, isPublic, requiresApproval, memberLimit } = req.body;
      if (!name?.trim() || !tag?.trim()) return res.status(400).json({ message: "Clan name and tag are required" });
      if (tag.length < 2 || tag.length > 5) return res.status(400).json({ message: "Tag must be 2-5 characters" });

      // Insert clan
      const [clan] = await db.insert(clans).values({
        name: name.trim(),
        tag: tag.trim().toUpperCase(),
        description: description?.trim() || null,
        createdByUserId: userId,
        isPublic: isPublic !== false,
        requiresApproval: !!requiresApproval,
        memberLimit: Math.min(100, Math.max(5, parseInt(memberLimit) || 50)),
      }).returning();

      // Add creator as leader
      await db.insert(clanMembers).values({ clanId: clan.id, userId, role: "leader" });

      res.status(201).json(clan);
    } catch (err: any) {
      if (err.message?.includes("unique")) return res.status(400).json({ message: "Clan name or tag already taken" });
      res.status(500).json({ message: err.message });
    }
  });

  /** PATCH /api/clans/:id — update clan settings (leader only) */
  app.patch("/api/clans/:id", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { id } = req.params;
    try {
      const [membership] = await db.select().from(clanMembers).where(and(eq(clanMembers.clanId, id), eq(clanMembers.userId, userId)));
      if (!membership || membership.role !== "leader") return res.status(403).json({ message: "Only the leader can edit clan settings" });
      const { name, tag, description, isPublic, requiresApproval, memberLimit } = req.body;
      const updates: any = { lastActiveAt: new Date() };
      if (name) updates.name = name.trim();
      if (tag) updates.tag = tag.trim().toUpperCase();
      if (description !== undefined) updates.description = description?.trim() || null;
      if (isPublic !== undefined) updates.isPublic = isPublic;
      if (requiresApproval !== undefined) updates.requiresApproval = requiresApproval;
      if (memberLimit) updates.memberLimit = Math.min(100, Math.max(5, parseInt(memberLimit)));
      const [updated] = await db.update(clans).set(updates).where(eq(clans.id, id)).returning();
      res.json(updated);
    } catch (err: any) {
      if (err.message?.includes("unique")) return res.status(400).json({ message: "Clan name or tag already taken" });
      res.status(500).json({ message: err.message });
    }
  });

  /** DELETE /api/clans/:id — disband clan (leader only) */
  app.delete("/api/clans/:id", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { id } = req.params;
    try {
      const [membership] = await db.select().from(clanMembers).where(and(eq(clanMembers.clanId, id), eq(clanMembers.userId, userId)));
      if (!membership || membership.role !== "leader") return res.status(403).json({ message: "Only the leader can disband the clan" });
      await db.delete(clans).where(eq(clans.id, id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** GET /api/clans/:id/members — list clan members with user info */
  app.get("/api/clans/:id/members", async (req: any, res) => {
    const { id } = req.params;
    try {
      const members = await db.select({
        id: clanMembers.id, role: clanMembers.role, joinedAt: clanMembers.joinedAt,
        matchesPlayedForClan: clanMembers.matchesPlayedForClan, matchesWonForClan: clanMembers.matchesWonForClan,
        contributedScalps: clanMembers.contributedScalps,
        userId: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName,
        profileImageUrl: users.profileImageUrl, rating: users.chessRating,
      }).from(clanMembers).innerJoin(users, eq(clanMembers.userId, users.id))
        .where(eq(clanMembers.clanId, id)).orderBy(desc(clanMembers.matchesWonForClan));
      res.json(members);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** POST /api/clans/:id/join — join a public clan or request to join */
  app.post("/api/clans/:id/join", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { id } = req.params;
    try {
      const [existing] = await db.select({ id: clanMembers.id }).from(clanMembers).where(eq(clanMembers.userId, userId));
      if (existing) return res.status(400).json({ message: "You are already in a clan" });

      const [clan] = await db.select().from(clans).where(eq(clans.id, id));
      if (!clan) return res.status(404).json({ message: "Clan not found" });
      if (clan.currentMemberCount >= clan.memberLimit) return res.status(400).json({ message: "Clan is full" });

      if (clan.requiresApproval) {
        // Check for existing request
        const [req2] = await db.select({ id: clanJoinRequests.id }).from(clanJoinRequests)
          .where(and(eq(clanJoinRequests.clanId, id), eq(clanJoinRequests.userId, userId), eq(clanJoinRequests.status, "pending")));
        if (req2) return res.status(400).json({ message: "Join request already pending" });
        await db.insert(clanJoinRequests).values({ clanId: id, userId });
        return res.json({ status: "requested" });
      }

      // Direct join
      await db.insert(clanMembers).values({ clanId: id, userId, role: "member" });
      await db.update(clans).set({ currentMemberCount: clan.currentMemberCount + 1 }).where(eq(clans.id, id));
      res.json({ status: "joined" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** POST /api/clans/:id/leave — leave a clan */
  app.post("/api/clans/:id/leave", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { id } = req.params;
    try {
      const [membership] = await db.select().from(clanMembers).where(and(eq(clanMembers.clanId, id), eq(clanMembers.userId, userId)));
      if (!membership) return res.status(400).json({ message: "You are not in this clan" });
      if (membership.role === "leader") {
        const members = await db.select({ userId: clanMembers.userId }).from(clanMembers).where(and(eq(clanMembers.clanId, id), ne(clanMembers.userId, userId)));
        if (members.length > 0) return res.status(400).json({ message: "Transfer leadership before leaving" });
        // If last member, disband
        await db.delete(clans).where(eq(clans.id, id));
        return res.json({ disbanded: true });
      }
      await db.delete(clanMembers).where(and(eq(clanMembers.clanId, id), eq(clanMembers.userId, userId)));
      await db.update(clans).set({ currentMemberCount: drizzleSql`GREATEST(1, current_member_count - 1)` }).where(eq(clans.id, id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** POST /api/clans/:id/invite — invite a player (leader/officer) */
  app.post("/api/clans/:id/invite", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { id } = req.params;
    const { targetUserId } = req.body;
    try {
      const [membership] = await db.select().from(clanMembers).where(and(eq(clanMembers.clanId, id), eq(clanMembers.userId, userId)));
      if (!membership || !["leader", "officer"].includes(membership.role)) return res.status(403).json({ message: "Only leaders and officers can invite" });
      const [targetMem] = await db.select({ id: clanMembers.id }).from(clanMembers).where(eq(clanMembers.userId, targetUserId));
      if (targetMem) return res.status(400).json({ message: "User is already in a clan" });
      await db.insert(clanInvites).values({ clanId: id, invitedUserId: targetUserId, invitedByUserId: userId });
      // Notify invited user
      pushNotification(targetUserId, { type: "challenge", title: "Clan Invite!", body: `You've been invited to join a clan. Check your invites.`, linkTo: "/clans" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** GET /api/user/clan-invites — get pending invites for current user */
  app.get("/api/user/clan-invites", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const invites = await db.select({
        id: clanInvites.id, status: clanInvites.status, createdAt: clanInvites.createdAt,
        clanId: clans.id, clanName: clans.name, clanTag: clans.tag, clanLogoUrl: clans.logoUrl,
        inviterUsername: users.username,
      }).from(clanInvites)
        .innerJoin(clans, eq(clanInvites.clanId, clans.id))
        .innerJoin(users, eq(clanInvites.invitedByUserId, users.id))
        .where(and(eq(clanInvites.invitedUserId, userId), eq(clanInvites.status, "pending")));
      res.json(invites);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** POST /api/clan-invites/:inviteId/respond — accept/decline an invite */
  app.post("/api/clan-invites/:inviteId/respond", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { inviteId } = req.params;
    const { action } = req.body; // "accept" | "decline"
    try {
      const [invite] = await db.select().from(clanInvites).where(and(eq(clanInvites.id, inviteId), eq(clanInvites.invitedUserId, userId)));
      if (!invite) return res.status(404).json({ message: "Invite not found" });
      if (invite.status !== "pending") return res.status(400).json({ message: "Invite already responded to" });

      if (action === "accept") {
        const [existing] = await db.select({ id: clanMembers.id }).from(clanMembers).where(eq(clanMembers.userId, userId));
        if (existing) return res.status(400).json({ message: "Already in a clan" });
        const [clan] = await db.select().from(clans).where(eq(clans.id, invite.clanId));
        if (!clan) return res.status(404).json({ message: "Clan no longer exists" });
        await db.insert(clanMembers).values({ clanId: invite.clanId, userId, role: "member" });
        await db.update(clans).set({ currentMemberCount: clan.currentMemberCount + 1 }).where(eq(clans.id, invite.clanId));
        await db.update(clanInvites).set({ status: "accepted" }).where(eq(clanInvites.id, inviteId));
        return res.json({ status: "joined" });
      }

      await db.update(clanInvites).set({ status: "declined" }).where(eq(clanInvites.id, inviteId));
      res.json({ status: "declined" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** GET /api/clans/:id/join-requests — get pending join requests (leader/officer) */
  app.get("/api/clans/:id/join-requests", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { id } = req.params;
    try {
      const [membership] = await db.select().from(clanMembers).where(and(eq(clanMembers.clanId, id), eq(clanMembers.userId, userId)));
      if (!membership || !["leader", "officer"].includes(membership.role)) return res.status(403).json({ message: "Access denied" });
      const requests = await db.select({
        id: clanJoinRequests.id, status: clanJoinRequests.status, createdAt: clanJoinRequests.createdAt,
        userId: users.id, username: users.username, firstName: users.firstName, profileImageUrl: users.profileImageUrl, rating: users.chessRating,
      }).from(clanJoinRequests).innerJoin(users, eq(clanJoinRequests.userId, users.id))
        .where(and(eq(clanJoinRequests.clanId, id), eq(clanJoinRequests.status, "pending")));
      res.json(requests);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** POST /api/clans/:id/join-requests/:reqId/respond — approve/decline join request */
  app.post("/api/clans/:id/join-requests/:reqId/respond", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { id, reqId } = req.params;
    const { action } = req.body; // "approve" | "decline"
    try {
      const [membership] = await db.select().from(clanMembers).where(and(eq(clanMembers.clanId, id), eq(clanMembers.userId, userId)));
      if (!membership || !["leader", "officer"].includes(membership.role)) return res.status(403).json({ message: "Access denied" });

      const [joinReq] = await db.select().from(clanJoinRequests).where(and(eq(clanJoinRequests.id, reqId), eq(clanJoinRequests.clanId, id)));
      if (!joinReq) return res.status(404).json({ message: "Request not found" });

      if (action === "approve") {
        const [clan] = await db.select().from(clans).where(eq(clans.id, id));
        if (!clan) return res.status(404).json({ message: "Clan not found" });
        if (clan.currentMemberCount >= clan.memberLimit) return res.status(400).json({ message: "Clan is full" });
        await db.insert(clanMembers).values({ clanId: id, userId: joinReq.userId, role: "member" });
        await db.update(clans).set({ currentMemberCount: clan.currentMemberCount + 1 }).where(eq(clans.id, id));
        pushNotification(joinReq.userId, { type: "challenge", title: "Join request approved!", body: `You have joined the clan. Welcome aboard!`, linkTo: `/clans/${id}` });
      }
      await db.update(clanJoinRequests).set({ status: action === "approve" ? "approved" : "declined" }).where(eq(clanJoinRequests.id, reqId));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** PATCH /api/clans/:id/members/:memberId/role — change member role (leader only) */
  app.patch("/api/clans/:id/members/:memberId/role", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { id, memberId } = req.params;
    const { role } = req.body;
    if (!["officer", "member"].includes(role)) return res.status(400).json({ message: "Invalid role" });
    try {
      const [myMembership] = await db.select().from(clanMembers).where(and(eq(clanMembers.clanId, id), eq(clanMembers.userId, userId)));
      if (!myMembership || myMembership.role !== "leader") return res.status(403).json({ message: "Only the leader can change roles" });
      await db.update(clanMembers).set({ role }).where(and(eq(clanMembers.clanId, id), eq(clanMembers.userId, memberId)));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** DELETE /api/clans/:id/members/:memberId — remove a member (leader/officer) */
  app.delete("/api/clans/:id/members/:memberId", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { id, memberId } = req.params;
    try {
      const [myMembership] = await db.select().from(clanMembers).where(and(eq(clanMembers.clanId, id), eq(clanMembers.userId, userId)));
      if (!myMembership || !["leader", "officer"].includes(myMembership.role)) return res.status(403).json({ message: "Access denied" });
      const [targetMem] = await db.select().from(clanMembers).where(and(eq(clanMembers.clanId, id), eq(clanMembers.userId, memberId)));
      if (!targetMem) return res.status(404).json({ message: "Member not found" });
      if (targetMem.role === "leader") return res.status(400).json({ message: "Cannot remove the leader" });
      if (myMembership.role === "officer" && targetMem.role === "officer") return res.status(403).json({ message: "Officers cannot remove other officers" });
      await db.delete(clanMembers).where(and(eq(clanMembers.clanId, id), eq(clanMembers.userId, memberId)));
      await db.update(clans).set({ currentMemberCount: drizzleSql`GREATEST(1, current_member_count - 1)` }).where(eq(clans.id, id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** GET /api/clans/:id/messages — clan chat (members only) */
  app.get("/api/clans/:id/messages", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { id } = req.params;
    try {
      const [membership] = await db.select({ id: clanMembers.id }).from(clanMembers).where(and(eq(clanMembers.clanId, id), eq(clanMembers.userId, userId)));
      if (!membership) return res.status(403).json({ message: "Not a clan member" });
      const messages = await db.select({
        id: clanMessages.id, content: clanMessages.content, createdAt: clanMessages.createdAt,
        userId: users.id, username: users.username, firstName: users.firstName, profileImageUrl: users.profileImageUrl,
      }).from(clanMessages).innerJoin(users, eq(clanMessages.userId, users.id))
        .where(eq(clanMessages.clanId, id)).orderBy(desc(clanMessages.createdAt)).limit(100);
      res.json(messages.reverse());
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** POST /api/clans/:id/messages — send clan chat message */
  app.post("/api/clans/:id/messages", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { id } = req.params;
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: "Message cannot be empty" });
    if (content.length > 500) return res.status(400).json({ message: "Message too long (max 500 chars)" });
    try {
      const [membership] = await db.select({ id: clanMembers.id }).from(clanMembers).where(and(eq(clanMembers.clanId, id), eq(clanMembers.userId, userId)));
      if (!membership) return res.status(403).json({ message: "Not a clan member" });
      const [msg] = await db.insert(clanMessages).values({ clanId: id, userId, content: content.trim() }).returning();
      res.json(msg);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** POST /api/clans/:id/transfer — transfer leadership */
  app.post("/api/clans/:id/transfer", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { id } = req.params;
    const { newLeaderId } = req.body;
    try {
      const [myMembership] = await db.select().from(clanMembers).where(and(eq(clanMembers.clanId, id), eq(clanMembers.userId, userId)));
      if (!myMembership || myMembership.role !== "leader") return res.status(403).json({ message: "Only leader can transfer" });
      await db.update(clanMembers).set({ role: "member" }).where(and(eq(clanMembers.clanId, id), eq(clanMembers.userId, userId)));
      await db.update(clanMembers).set({ role: "leader" }).where(and(eq(clanMembers.clanId, id), eq(clanMembers.userId, newLeaderId)));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/clans/:id/challenge-complete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const clanId = req.params.id;
      const { won } = req.body;

      const [member] = await db.select().from(clanMembers)
        .where(and(eq(clanMembers.clanId, clanId), eq(clanMembers.userId, userId)));
      if (!member || (member.role !== "leader" && member.role !== "officer")) {
        return res.status(403).json({ message: "Only leaders/officers can report challenge results" });
      }

      const [clan] = await db.select().from(clans).where(eq(clans.id, clanId));
      if (!clan) return res.status(404).json({ message: "Clan not found" });

      if (won) {
        createClanWarWinPost(clan.name, userId).catch(() => {});

        const members = await db.select().from(clanMembers).where(eq(clanMembers.clanId, clanId));
        for (const m of members) {
          _pushNotification(m.userId, {
            type: "clan_challenge_won",
            title: "Clan War Victory!",
            body: `${clan.name} won the clan war!`,
            linkTo: "/clans",
          });
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error completing clan challenge:", error);
      res.status(500).json({ message: "Failed to complete clan challenge" });
    }
  });

  // ─── Social Feed Routes ─────────────────────────────────────────────────────

  /** GET /api/social/posts — paginated feed */
  app.get("/api/social/posts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const offset = parseInt(req.query.offset as string) || 0;

      const mutedUsers = await db.select().from(socialMutes).where(eq(socialMutes.userId, userId));
      const mutedUserIds = new Set(mutedUsers.map(m => m.mutedUserId));

      const allPosts = await db.select().from(socialPosts)
        .orderBy(desc(socialPosts.createdAt))
        .limit(limit + mutedUserIds.size * 2)
        .offset(offset);

      const posts = allPosts.filter(p =>
        !mutedUserIds.has(p.authorId) && (!p.subjectUserId || !mutedUserIds.has(p.subjectUserId))
      ).slice(0, limit);

      const postsWithDetails = await Promise.all(posts.map(async (post) => {
        const [author] = await db.select().from(users).where(eq(users.id, post.authorId));
        const reactions = await db.select().from(socialReactions).where(eq(socialReactions.postId, post.id));
        const replies = await db.select().from(socialReplies)
          .where(eq(socialReplies.postId, post.id))
          .orderBy(socialReplies.createdAt);

        const repliesWithAuthors = await Promise.all(replies.map(async (reply) => {
          const [replyAuthor] = await db.select().from(users).where(eq(users.id, reply.authorId));
          return { ...reply, author: replyAuthor };
        }));

        const reactionCounts: Record<string, number> = { like: 0, fire: 0, crown: 0, skull: 0, clap: 0 };
        const userReactions: string[] = [];
        reactions.forEach(r => {
          reactionCounts[r.reactionType] = (reactionCounts[r.reactionType] || 0) + 1;
          if (r.userId === userId) userReactions.push(r.reactionType);
        });

        const safeAuthor = author ? {
          id: author.id, firstName: author.firstName, lastName: author.lastName,
          username: author.username, profileImageUrl: author.profileImageUrl,
          nicknameColor: author.nicknameColor,
          chessRating: author.chessRating, level: author.level,
        } : null;

        const safeReplies = repliesWithAuthors.map(r => ({
          ...r,
          author: r.author ? {
            id: r.author.id, firstName: r.author.firstName, lastName: r.author.lastName,
            username: r.author.username, profileImageUrl: r.author.profileImageUrl,
            nicknameColor: r.author.nicknameColor,
          } : null,
        }));

        let subjectUser = null;
        if (post.subjectUserId) {
          const [su] = await db.select().from(users).where(eq(users.id, post.subjectUserId));
          subjectUser = su ? {
            id: su.id, firstName: su.firstName, lastName: su.lastName,
            username: su.username, profileImageUrl: su.profileImageUrl,
            nicknameColor: su.nicknameColor,
          } : null;
        }

        return {
          ...post,
          author: safeAuthor,
          subjectUser,
          reactions,
          replies: safeReplies,
          reactionCounts,
          userReactions,
        };
      }));

      res.json(postsWithDetails);
    } catch (error: any) {
      console.error("[SOCIAL] Error fetching posts:", error);
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });

  /** GET /api/social/posts/trending — top 3 most reacted posts */
  app.get("/api/social/posts/trending", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recentPosts = await db.select().from(socialPosts)
        .orderBy(desc(socialPosts.createdAt))
        .limit(50);

      const postsWithCounts = await Promise.all(recentPosts.map(async (post) => {
        const reactions = await db.select().from(socialReactions).where(eq(socialReactions.postId, post.id));
        const repliesCount = await db.select().from(socialReplies).where(eq(socialReplies.postId, post.id));
        const [author] = await db.select().from(users).where(eq(users.id, post.authorId));
        return {
          ...post,
          author: author ? {
            id: author.id, firstName: author.firstName, username: author.username,
            profileImageUrl: author.profileImageUrl, nicknameColor: author.nicknameColor,
          } : null,
          totalEngagement: reactions.length + repliesCount.length,
          reactionCount: reactions.length,
        };
      }));

      const trending = postsWithCounts
        .sort((a, b) => b.totalEngagement - a.totalEngagement)
        .slice(0, 3);

      res.json(trending);
    } catch (error: any) {
      console.error("[SOCIAL] Error fetching trending:", error);
      res.status(500).json({ message: "Failed to fetch trending posts" });
    }
  });

  /** POST /api/social/posts — create a new post */
  app.post("/api/social/posts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { content, type } = req.body;

      if (!content || typeof content !== "string" || content.trim().length === 0) {
        return res.status(400).json({ message: "Content is required" });
      }
      if (content.length > 1000) {
        return res.status(400).json({ message: "Content too long (max 1000 chars)" });
      }

      const validTypes = ["general", "win", "challenge", "achievement", "clan"];
      const postType = validTypes.includes(type) ? type : "general";

      const [post] = await db.insert(socialPosts).values({
        authorId: userId,
        type: postType,
        content: content.trim(),
      }).returning();

      const [author] = await db.select().from(users).where(eq(users.id, userId));

      res.json({
        ...post,
        author: author ? {
          id: author.id, firstName: author.firstName, lastName: author.lastName,
          username: author.username, profileImageUrl: author.profileImageUrl,
          nicknameColor: author.nicknameColor,
          chessRating: author.chessRating, level: author.level,
        } : null,
        reactions: [],
        replies: [],
        reactionCounts: { like: 0, fire: 0, crown: 0, skull: 0, clap: 0 },
        userReactions: [],
      });
    } catch (error: any) {
      console.error("[SOCIAL] Error creating post:", error);
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  /** POST /api/social/posts/:id/react — toggle a reaction */
  app.post("/api/social/posts/:id/react", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { reactionType } = req.body;

      const validReactions = ["like", "fire", "crown", "skull", "clap"];
      if (!validReactions.includes(reactionType)) {
        return res.status(400).json({ message: "Invalid reaction type" });
      }

      const [post] = await db.select().from(socialPosts).where(eq(socialPosts.id, id));
      if (!post) return res.status(404).json({ message: "Post not found" });

      const [existing] = await db.select().from(socialReactions)
        .where(and(
          eq(socialReactions.postId, id),
          eq(socialReactions.userId, userId),
          eq(socialReactions.reactionType, reactionType),
        ));

      if (existing) {
        await db.delete(socialReactions).where(eq(socialReactions.id, existing.id));
        res.json({ action: "removed", reactionType });
      } else {
        await db.insert(socialReactions).values({
          postId: id,
          userId,
          reactionType,
        });

        if (post.authorId !== userId) {
          _pushNotification(post.authorId, {
            type: "social_reaction",
            title: "New Reaction",
            body: `Someone reacted to your post with ${reactionType}`,
            linkTo: "/social",
          });
        }

        res.json({ action: "added", reactionType });
      }
    } catch (error: any) {
      console.error("[SOCIAL] Error toggling reaction:", error);
      res.status(500).json({ message: "Failed to react" });
    }
  });

  /** POST /api/social/posts/:id/reply — add a reply */
  app.post("/api/social/posts/:id/reply", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { content } = req.body;

      if (!content || typeof content !== "string" || content.trim().length === 0) {
        return res.status(400).json({ message: "Content is required" });
      }
      if (content.length > 500) {
        return res.status(400).json({ message: "Reply too long (max 500 chars)" });
      }

      const [post] = await db.select().from(socialPosts).where(eq(socialPosts.id, id));
      if (!post) return res.status(404).json({ message: "Post not found" });

      const [reply] = await db.insert(socialReplies).values({
        postId: id,
        authorId: userId,
        content: content.trim(),
      }).returning();

      const [author] = await db.select().from(users).where(eq(users.id, userId));
      const safeAuthor = author ? {
        id: author.id, firstName: author.firstName, lastName: author.lastName,
        username: author.username, profileImageUrl: author.profileImageUrl,
        nicknameColor: author.nicknameColor,
      } : null;

      if (post.authorId !== userId) {
        _pushNotification(post.authorId, {
          type: "social_reply",
          title: "New Reply",
          body: `Someone replied to your post`,
          linkTo: "/social",
        });
      }

      res.json({ ...reply, author: safeAuthor });
    } catch (error: any) {
      console.error("[SOCIAL] Error adding reply:", error);
      res.status(500).json({ message: "Failed to add reply" });
    }
  });

  /** POST /api/social/posts/:id/report — report a post */
  app.post("/api/social/posts/:id/report", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { reason } = req.body;

      const [post] = await db.select().from(socialPosts).where(eq(socialPosts.id, id));
      if (!post) return res.status(404).json({ message: "Post not found" });

      if (post.authorId === userId) {
        return res.status(400).json({ message: "Cannot report your own post" });
      }

      const [existingReport] = await db.select().from(playerReports)
        .where(and(
          eq(playerReports.reporterId, userId),
          eq(playerReports.reportedUserId, post.authorId),
          eq(playerReports.details, `Reported social post (ID: ${id})`),
        ));

      if (existingReport) {
        return res.status(409).json({ message: "You already reported this post" });
      }

      await db.insert(playerReports).values({
        reporterId: userId,
        reportedUserId: post.authorId,
        reason: reason || "inappropriate_content",
        details: `Reported social post (ID: ${id})`,
        status: "pending",
      });

      res.json({ success: true, message: "Post reported" });
    } catch (error: any) {
      console.error("[SOCIAL] Error reporting post:", error);
      res.status(500).json({ message: "Failed to report post" });
    }
  });

  /** POST /api/social/posts/:id/mute — mute a player (from post context) */
  app.post("/api/social/posts/:id/mute", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const [post] = await db.select().from(socialPosts).where(eq(socialPosts.id, id));
      if (!post) return res.status(404).json({ message: "Post not found" });

      const targetUserId = post.subjectUserId || post.authorId;
      if (targetUserId === userId) {
        return res.status(400).json({ message: "Cannot mute yourself" });
      }
      if (targetUserId === SYSTEM_USER_ID) {
        return res.status(400).json({ message: "Cannot mute the platform" });
      }

      const [existing] = await db.select().from(socialMutes)
        .where(and(eq(socialMutes.userId, userId), eq(socialMutes.mutedUserId, targetUserId)));
      if (!existing) {
        await db.insert(socialMutes).values({ userId, mutedUserId: targetUserId });
      }

      res.json({ success: true, message: "Player muted", mutedUserId: targetUserId });
    } catch (error: any) {
      console.error("[SOCIAL] Error muting player:", error);
      res.status(500).json({ message: "Failed to mute player" });
    }
  });

  app.delete("/api/social/mutes/:mutedUserId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { mutedUserId } = req.params;
      await db.delete(socialMutes)
        .where(and(eq(socialMutes.userId, userId), eq(socialMutes.mutedUserId, mutedUserId)));
      res.json({ success: true, message: "Player unmuted" });
    } catch (error: any) {
      console.error("[SOCIAL] Error unmuting player:", error);
      res.status(500).json({ message: "Failed to unmute player" });
    }
  });

  // ─── Matchmaking Queue Routes ─────────────────────────────────────────────

  app.post("/api/matchmaking/queue", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { gameType, deviceType = "desktop" } = req.body;
      const isRanked = req.body.matchMode === "ranked";
      // Ranked matches are always exactly 1 Scalp — enforce server-side
      const betAmount = isRanked ? "1" : (req.body.betAmount ?? "0");

      if (!gameType) return res.status(400).json({ message: "gameType is required" });

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (user.isBanned) return res.status(403).json({ message: "Account banned" });

      const betNum = parseFloat(betAmount);
      if (betNum > 0 && parseFloat(user.balance ?? "0") < betNum) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      const mmr = (user as any).overallRating ?? 1000;

      const entryId = await matchmakingQueueService.enqueue({
        userId,
        gameType,
        betAmount,
        mmr,
        deviceType,
      });

      const matchResult = await matchmakingQueueService.findMatch({
        userId,
        gameType,
        betAmount,
        mmr,
        deviceType,
      });

      if (matchResult) {
        const match = await storage.createMatchWithBet({
          gameType: matchResult.gameType,
          player1Id: matchResult.player1Id,
          status: "waiting",
          deviceType,
        }, betAmount);

        const joinedMatch = await storage.joinMatch(match.id, matchResult.player2Id, betAmount);

        pushNotification(matchResult.player1Id, {
          type: "challenge",
          title: "Match found!",
          body: "An opponent was found. Get ready!",
          linkTo: `/game/${joinedMatch.id}`,
        });
        pushNotification(matchResult.player2Id, {
          type: "challenge",
          title: "Match found!",
          body: "An opponent was found. Get ready!",
          linkTo: `/game/${joinedMatch.id}`,
        });

        return res.json({ status: "matched", match: joinedMatch });
      }

      const status = await matchmakingQueueService.getStatus(userId);
      res.json({ status: "queued", entryId, ...status });
    } catch (error: any) {
      console.error("[Matchmaking] Error joining queue:", error);
      res.status(500).json({ message: error.message || "Failed to join queue" });
    }
  });

  app.delete("/api/matchmaking/queue", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await matchmakingQueueService.dequeue(userId);
      res.json({ success: true, message: "Left matchmaking queue" });
    } catch (error: any) {
      console.error("[Matchmaking] Error leaving queue:", error);
      res.status(500).json({ message: "Failed to leave queue" });
    }
  });

  app.get("/api/matchmaking/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const status = await matchmakingQueueService.getStatus(userId);
      res.json(status);
    } catch (error: any) {
      console.error("[Matchmaking] Error fetching status:", error);
      res.status(500).json({ message: "Failed to fetch queue status" });
    }
  });

  app.get("/api/matchmaking/depth", async (req, res) => {
    try {
      const gameType = req.query.gameType as string | undefined;
      const depth = await matchmakingQueueService.getQueueDepth(gameType);
      res.json({ depth });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch queue depth" });
    }
  });

  // ─── Admin Audit Logs ─────────────────────────────────────────────────────

  app.get("/api/admin/audit-logs", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { severity, limit = "100", actorId, targetId, matchId } = req.query;
      const lim = Math.min(parseInt(limit as string) || 100, 500);
      const conditions: any[] = [];

      if (severity) conditions.push(eq(auditLogs.severity, severity as string));
      if (actorId) conditions.push(eq(auditLogs.actorId, actorId as string));
      if (targetId) conditions.push(eq(auditLogs.targetId, targetId as string));
      if (matchId) conditions.push(eq(auditLogs.matchId, matchId as string));

      const query = conditions.length > 0
        ? db.select().from(auditLogs).where(and(...conditions)).orderBy(desc(auditLogs.createdAt)).limit(lim)
        : db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(lim);

      const logs = await query;
      res.json(logs);
    } catch (error: any) {
      console.error("[Admin] Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  app.get("/api/admin/reconnect-sessions", isAuthenticated, isAdmin, async (_req: any, res) => {
    try {
      const sessions = reconnectManager.activeSessions();
      res.json({ sessions, count: sessions.length });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch reconnect sessions" });
    }
  });

  app.get("/api/admin/disconnect-penalties", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId, limit = "50" } = req.query;
      const lim = Math.min(parseInt(limit as string) || 50, 200);

      const rows = userId
        ? await db.select().from(disconnectPenalties).where(eq(disconnectPenalties.userId, userId as string)).orderBy(desc(disconnectPenalties.createdAt)).limit(lim)
        : await db.select().from(disconnectPenalties).orderBy(desc(disconnectPenalties.createdAt)).limit(lim);

      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch disconnect penalties" });
    }
  });

  app.get("/api/admin/matchmaking-queue", isAuthenticated, isAdmin, async (_req: any, res) => {
    try {
      const { matchmakingQueue: mmQueue } = await import("@shared/schema");
      const entries = await db.select().from(mmQueue).orderBy(mmQueue.joinedAt);
      const depth = await matchmakingQueueService.getQueueDepth();
      res.json({ entries, depth });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch matchmaking queue" });
    }
  });

  // Admin: set player reputation
  app.patch("/api/admin/users/:userId/reputation", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const { userId } = req.params;
      const { score, reason } = req.body;

      if (typeof score !== "number" || score < 0 || score > 100) {
        return res.status(400).json({ message: "Score must be 0-100" });
      }

      await reputationService.adminSet(adminId, userId, score, reason || "Admin adjustment");
      res.json({ success: true, score });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to update reputation" });
    }
  });

  // Get a player's disconnect history
  app.get("/api/users/:userId/disconnect-history", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const history = await reconnectManager.getDisconnectHistory(userId);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch disconnect history" });
    }
  });

  // ─── Party System Routes ──────────────────────────────────────────────────

  app.post("/api/parties", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, maxSize = 4, isPrivate = true } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "Party name is required" });

      const existing = await partyService.getUserParty(userId);
      if (existing && existing.status !== "disbanded") {
        return res.status(400).json({ message: "You are already in a party", partyId: existing.id });
      }

      const party = await partyService.createParty(userId, name.trim(), maxSize, isPrivate);
      res.json(party);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to create party" });
    }
  });

  app.get("/api/parties/mine", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const party = await partyService.getUserParty(userId);
      res.json(party ?? null);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch party" });
    }
  });

  app.get("/api/parties/:id", isAuthenticated, async (req: any, res) => {
    try {
      const party = await partyService.getParty(req.params.id);
      if (!party) return res.status(404).json({ message: "Party not found" });
      res.json(party);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch party" });
    }
  });

  app.post("/api/parties/join/code/:code", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { code } = req.params;

      const existing = await partyService.getUserParty(userId);
      if (existing && existing.status !== "disbanded") {
        return res.status(400).json({ message: "Leave your current party first" });
      }

      const found = await partyService.getPartyByCode(code.toUpperCase());
      if (!found) return res.status(404).json({ message: "Invalid invite code" });
      if (found.status === "disbanded") return res.status(400).json({ message: "Party no longer exists" });

      const party = await partyService.joinParty(found.id, userId);
      res.json(party);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to join party" });
    }
  });

  app.post("/api/parties/:id/join", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const party = await partyService.joinParty(req.params.id, userId);
      res.json(party);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to join party" });
    }
  });

  app.delete("/api/parties/:id/leave", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = await partyService.leaveParty(req.params.id, userId);
      res.json({ success: true, disbanded: result.disbanded });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to leave party" });
    }
  });

  app.post("/api/parties/:id/kick/:targetUserId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await partyService.kickMember(req.params.id, userId, req.params.targetUserId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to kick member" });
    }
  });

  app.patch("/api/parties/:id/ready", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { isReady } = req.body;
      await partyService.setReady(req.params.id, userId, !!isReady);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update ready state" });
    }
  });

  app.patch("/api/parties/:id/game", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { gameType, betAmount = "0" } = req.body;
      if (!gameType) return res.status(400).json({ message: "gameType is required" });
      await partyService.setGame(req.params.id, userId, gameType, betAmount);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to set game" });
    }
  });

  app.post("/api/parties/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ message: "Message content required" });
      const msg = await partyService.sendMessage(req.params.id, userId, content.trim().slice(0, 500));
      res.json(msg);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.get("/api/parties/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const party = await partyService.getParty(req.params.id);
      if (!party) return res.status(404).json({ message: "Party not found" });
      res.json(party.messages);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // ─── Tournament Admin + Bracket Routes ────────────────────────────────────

  app.post("/api/admin/tournaments", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { name, gameType, bracketSize = 8, entryFee = "0", prizePool = "0", startsAt, description = "", isFeatured = false } = req.body;
      if (!name || !gameType || !startsAt) return res.status(400).json({ message: "name, gameType, and startsAt are required" });

      const adminId = req.user.claims.sub;
      const [tourn] = await db.execute(drizzleSql`
        INSERT INTO tournaments (id, name, game_type, bracket_size, max_players, entry_fee, prize_pool, status, starts_at, description, is_featured, created_by, current_players)
        VALUES (gen_random_uuid(), ${name}, ${gameType}, ${bracketSize}, ${bracketSize}, ${entryFee}, ${prizePool}, 'open', ${startsAt}, ${description}, ${isFeatured}, ${adminId}, 0)
        RETURNING *
      `).then(r => r.rows);
      res.json(tourn);
    } catch (err: any) {
      console.error("[Admin] Create tournament:", err);
      res.status(500).json({ message: err.message || "Failed to create tournament" });
    }
  });

  app.patch("/api/admin/tournaments/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { name, startsAt, status, isFeatured, entryFee, prizePool } = req.body;
      await db.execute(drizzleSql`
        UPDATE tournaments SET
          name = COALESCE(${name ?? null}, name),
          starts_at = COALESCE(${startsAt ?? null}, starts_at),
          status = COALESCE(${status ?? null}, status),
          is_featured = COALESCE(${isFeatured ?? null}, is_featured),
          entry_fee = COALESCE(${entryFee ?? null}, entry_fee),
          prize_pool = COALESCE(${prizePool ?? null}, prize_pool)
        WHERE id = ${id}
      `);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update tournament" });
    }
  });

  app.get("/api/tournaments/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const [tourn] = await db.execute(drizzleSql`
        SELECT t.*, 
          (SELECT COUNT(*) FROM tournament_participants tp WHERE tp.tournament_id = t.id) as joined_count
        FROM tournaments t WHERE t.id = ${id}
      `).then(r => r.rows);
      if (!tourn) return res.status(404).json({ message: "Tournament not found" });

      const participants = await db.execute(drizzleSql`
        SELECT tp.*, u.first_name, u.last_name, u.username, u.profile_image_url,
               u.chess_rating, u.overall_rating
        FROM tournament_participants tp
        JOIN users u ON tp.user_id = u.id
        WHERE tp.tournament_id = ${id}
        ORDER BY tp.seed ASC NULLS LAST
      `).then(r => r.rows);

      const brackets = await db.select().from(tournamentBrackets)
        .where(eq(tournamentBrackets.tournamentId, id))
        .orderBy(tournamentBrackets.round, tournamentBrackets.matchSlot);

      res.json({ ...tourn, participants, brackets });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch tournament" });
    }
  });

  app.post("/api/admin/tournaments/:id/start", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const [tourn] = await db.execute(drizzleSql`SELECT * FROM tournaments WHERE id = ${id}`).then(r => r.rows) as any[];
      if (!tourn) return res.status(404).json({ message: "Tournament not found" });
      if (tourn.status !== "open") return res.status(400).json({ message: "Tournament already started or completed" });

      const participants = await db.execute(drizzleSql`
        SELECT user_id FROM tournament_participants WHERE tournament_id = ${id} ORDER BY RANDOM()
      `).then(r => r.rows) as any[];

      if (participants.length < 2) return res.status(400).json({ message: "Need at least 2 participants to start" });

      const shuffled = participants.map((p: any) => p.user_id);
      const slots: any[] = [];
      const totalRounds = Math.ceil(Math.log2(shuffled.length));

      for (let slot = 0; slot < Math.ceil(shuffled.length / 2); slot++) {
        const p1 = shuffled[slot * 2] ?? null;
        const p2 = shuffled[slot * 2 + 1] ?? null;
        slots.push({
          tournamentId: id,
          round: 1,
          matchSlot: slot,
          player1Id: p1,
          player2Id: p2,
          status: p1 && p2 ? "pending" : "bye",
        });
      }

      for (let round = 2; round <= totalRounds; round++) {
        const prevSlots = Math.ceil(slots.filter(s => s.round === round - 1).length / 2);
        for (let slot = 0; slot < prevSlots; slot++) {
          slots.push({ tournamentId: id, round, matchSlot: slot, player1Id: null, player2Id: null, status: "pending" });
        }
      }

      if (slots.length > 0) {
        await db.insert(tournamentBrackets).values(slots);
      }

      await db.execute(drizzleSql`UPDATE tournaments SET status = 'in-progress' WHERE id = ${id}`);

      for (const p of participants) {
        pushNotification(p.user_id, {
          type: "challenge",
          title: `${tourn.name} has started!`,
          body: "Check the bracket to see your first match.",
          linkTo: `/tournaments`,
        });
      }

      res.json({ success: true, rounds: totalRounds, slots: slots.length });
    } catch (err: any) {
      console.error("[Admin] Start tournament:", err);
      res.status(500).json({ message: err.message || "Failed to start tournament" });
    }
  });

  app.post("/api/tournaments/:id/bracket/:bracketId/complete", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id, bracketId } = req.params;
      const { winnerId } = req.body;
      if (!winnerId) return res.status(400).json({ message: "winnerId is required" });

      const [bracket] = await db.select().from(tournamentBrackets).where(eq(tournamentBrackets.id, bracketId));
      if (!bracket) return res.status(404).json({ message: "Bracket slot not found" });

      await db.update(tournamentBrackets).set({
        winnerId,
        status: "completed",
        completedAt: new Date(),
      }).where(eq(tournamentBrackets.id, bracketId));

      const nextRound = bracket.round + 1;
      const nextSlot = Math.floor(bracket.matchSlot / 2);
      const isFirstPlayer = bracket.matchSlot % 2 === 0;

      const [nextBracket] = await db.select().from(tournamentBrackets)
        .where(and(
          eq(tournamentBrackets.tournamentId, id),
          eq(tournamentBrackets.round, nextRound),
          eq(tournamentBrackets.matchSlot, nextSlot),
        ));

      if (nextBracket) {
        await db.update(tournamentBrackets).set(
          isFirstPlayer ? { player1Id: winnerId } : { player2Id: winnerId }
        ).where(eq(tournamentBrackets.id, nextBracket.id));
      } else {
        await db.execute(drizzleSql`UPDATE tournaments SET status = 'completed', winner_id = ${winnerId} WHERE id = ${id}`);
        const [tourn] = await db.execute(drizzleSql`SELECT name FROM tournaments WHERE id = ${id}`).then(r => r.rows) as any[];
        pushNotification(winnerId, {
          type: "deposit",
          title: "Tournament Champion!",
          body: `You won the ${tourn?.name ?? "tournament"}! Prize distributed to your wallet.`,
          linkTo: `/tournaments`,
        });
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to complete bracket match" });
    }
  });

  // Recent big wins feed (public)
  app.get("/api/wins/recent", async (req, res) => {
    try {
      const result = await db.execute(drizzleSql`
        SELECT t.id, t.user_id, t.amount, t.created_at, t.match_id,
               u.username, u.first_name, u.profile_image_url,
               m.game_type
        FROM transactions t
        JOIN users u ON t.user_id = u.id
        LEFT JOIN matches m ON t.match_id = m.id
        WHERE t.type = 'bet_won' AND t.amount::numeric >= 5
        ORDER BY t.created_at DESC
        LIMIT 20
      `);
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch recent wins" });
    }
  });

  ensureSystemUser().then(() => seedExamplePosts()).catch(() => {});
  seedShopItems().then(() => seedRankRewards()).catch((err) => {
    console.error("[SEED] error during shop/rank seeding:", err);
  });

  return httpServer;
}
