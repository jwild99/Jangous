CREATE TABLE "achievements" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"category" varchar(50) NOT NULL,
	"game_type" varchar(50),
	"icon" varchar(50) NOT NULL,
	"rarity" varchar(20) DEFAULT 'common' NOT NULL,
	"xp_reward" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "activity_feed" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar(40) NOT NULL,
	"data" jsonb,
	"is_public" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" varchar,
	"target_id" varchar,
	"match_id" varchar,
	"action" varchar(60) NOT NULL,
	"severity" varchar(10) DEFAULT 'info' NOT NULL,
	"details" jsonb,
	"ip_address" varchar(60),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "battle_pass_seasons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "battle_pass_tiers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" varchar NOT NULL,
	"tier" integer NOT NULL,
	"xp_required" integer NOT NULL,
	"reward_type" varchar(30) NOT NULL,
	"reward_value" varchar(100) NOT NULL,
	"reward_description" text NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenge_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"challenge_id" varchar(100) NOT NULL,
	"xp_awarded" integer NOT NULL,
	"claimed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenge_invites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenger_id" varchar NOT NULL,
	"challenged_id" varchar NOT NULL,
	"game_type" varchar(50) NOT NULL,
	"bet_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"match_id" varchar,
	"device_type" varchar(10) DEFAULT 'desktop',
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"match_id" varchar,
	"channel" varchar(50) DEFAULT 'global' NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clan_invites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clan_id" varchar NOT NULL,
	"invited_user_id" varchar NOT NULL,
	"invited_by_user_id" varchar NOT NULL,
	"status" varchar(10) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clan_join_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clan_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"status" varchar(10) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clan_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clan_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar(10) DEFAULT 'member' NOT NULL,
	"joined_at" timestamp DEFAULT now(),
	"matches_played_for_clan" integer DEFAULT 0 NOT NULL,
	"matches_won_for_clan" integer DEFAULT 0 NOT NULL,
	"contributed_scalps" numeric(14, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clan_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clan_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(40) NOT NULL,
	"tag" varchar(5) NOT NULL,
	"description" text,
	"logo_url" varchar(500),
	"banner_url" varchar(500),
	"created_by_user_id" varchar NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"member_limit" integer DEFAULT 50 NOT NULL,
	"current_member_count" integer DEFAULT 1 NOT NULL,
	"clan_level" integer DEFAULT 1 NOT NULL,
	"clan_xp" integer DEFAULT 0 NOT NULL,
	"total_scalps_won" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_scalps_lost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_matches_played" integer DEFAULT 0 NOT NULL,
	"total_matches_won" integer DEFAULT 0 NOT NULL,
	"total_matches_lost" integer DEFAULT 0 NOT NULL,
	"total_challenges_won" integer DEFAULT 0 NOT NULL,
	"total_challenges_lost" integer DEFAULT 0 NOT NULL,
	"season_points" integer DEFAULT 0 NOT NULL,
	"last_active_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "clans_name_unique" UNIQUE("name"),
	CONSTRAINT "clans_tag_unique" UNIQUE("tag")
);
--> statement-breakpoint
CREATE TABLE "crypto_payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar(20) NOT NULL,
	"currency" varchar(10) NOT NULL,
	"amount_crypto" varchar(50) NOT NULL,
	"amount_usd" numeric(10, 2) NOT NULL,
	"wallet_address" varchar(100),
	"tx_hash" varchar(100),
	"payment_id" varchar(100),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp,
	"confirmed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "direct_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" varchar NOT NULL,
	"recipient_id" varchar NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "disconnect_penalties" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"match_id" varchar,
	"reason" varchar(30) DEFAULT 'timeout' NOT NULL,
	"reputation_lost" integer DEFAULT 0 NOT NULL,
	"cooldown_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drill_scores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"tutorial_id" text NOT NULL,
	"drill_kind" text NOT NULL,
	"metric" text NOT NULL,
	"higher_is_better" boolean NOT NULL,
	"best_score" real NOT NULL,
	"last_score" real NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "favorite_games" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"game_type" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" varchar NOT NULL,
	"addressee_id" varchar NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "game_settings" (
	"id" varchar PRIMARY KEY DEFAULT 'default' NOT NULL,
	"platform_rake" numeric(5, 2) DEFAULT '3.00' NOT NULL,
	"min_bet" numeric(10, 2) DEFAULT '5.00' NOT NULL,
	"max_bet" numeric(10, 2) DEFAULT '1000.00' NOT NULL,
	"new_user_bonus" numeric(10, 2) DEFAULT '100.00' NOT NULL,
	"chess_enabled" boolean DEFAULT true NOT NULL,
	"mini_golf_enabled" boolean DEFAULT true NOT NULL,
	"connect4_enabled" boolean DEFAULT true NOT NULL,
	"air_hockey_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "match_statistics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"goals" integer DEFAULT 0,
	"shots" integer DEFAULT 0,
	"saves" integer DEFAULT 0,
	"hit_speed_peak" integer DEFAULT 0,
	"possession_seconds" integer DEFAULT 0,
	"possession_percent" numeric(5, 2) DEFAULT '0.00',
	"move_count" integer DEFAULT 0,
	"captured_pieces" integer DEFAULT 0,
	"checks_given" integer DEFAULT 0,
	"strokes" integer DEFAULT 0,
	"holes_in_one" integer DEFAULT 0,
	"avg_strokes_per_hole" numeric(5, 2),
	"moves_played" integer DEFAULT 0,
	"blocked_opponent" integer DEFAULT 0,
	"blocks_placed" integer DEFAULT 0,
	"perfect_placements" integer DEFAULT 0,
	"average_block_size" numeric(5, 2),
	"longest_perfect_chain" integer DEFAULT 0,
	"rating_before" integer,
	"rating_after" integer,
	"rating_change" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'waiting' NOT NULL,
	"player1_id" varchar NOT NULL,
	"player2_id" varchar,
	"winner_id" varchar,
	"player1_score" integer DEFAULT 0,
	"player2_score" integer DEFAULT 0,
	"game_state" jsonb,
	"is_bot_match" boolean DEFAULT false,
	"bot_difficulty" varchar(20),
	"is_practice" boolean DEFAULT false,
	"pot_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"rake_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"forfeited_by_id" varchar,
	"pgn_moves" text,
	"duration" integer,
	"player1_time_remaining" integer,
	"player2_time_remaining" integer,
	"time_control" integer,
	"mini_golf_hole_count" integer DEFAULT 3,
	"exited_player_ids" text[] DEFAULT ARRAY[]::text[],
	"is_private" boolean DEFAULT false,
	"invite_code" varchar(20),
	"device_type" varchar(10) DEFAULT 'desktop',
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "matchmaking_queue" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"game_type" varchar(50) NOT NULL,
	"bet_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"mmr" integer DEFAULT 1000 NOT NULL,
	"search_radius" integer DEFAULT 100 NOT NULL,
	"device_type" varchar(10) DEFAULT 'desktop',
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" varchar NOT NULL,
	"target_user_id" varchar NOT NULL,
	"related_report_id" varchar,
	"action_type" varchar(30) NOT NULL,
	"reason" text NOT NULL,
	"duration_hours" integer,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parties" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"leader_id" varchar NOT NULL,
	"invite_code" varchar(20) NOT NULL,
	"game_type" varchar(50),
	"bet_amount" numeric(10, 2) DEFAULT '0.00',
	"status" varchar(20) DEFAULT 'waiting' NOT NULL,
	"max_size" integer DEFAULT 4 NOT NULL,
	"is_private" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "parties_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "party_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"is_ready" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "party_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_id" varchar NOT NULL,
	"author_id" varchar NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" varchar NOT NULL,
	"reported_user_id" varchar NOT NULL,
	"match_id" varchar,
	"reason" varchar(30) NOT NULL,
	"details" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rank_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"season_id" varchar,
	"game_type" varchar(30) NOT NULL,
	"old_rating" integer NOT NULL,
	"new_rating" integer NOT NULL,
	"old_tier" varchar(20) NOT NULL,
	"new_tier" varchar(20) NOT NULL,
	"old_division" varchar(4),
	"new_division" varchar(4),
	"direction" varchar(10) NOT NULL,
	"match_id" varchar,
	"granted_item_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rank_rewards" (
	"id" varchar PRIMARY KEY NOT NULL,
	"season_id" varchar NOT NULL,
	"tier" varchar(20) NOT NULL,
	"division" varchar(4),
	"rating_threshold" integer NOT NULL,
	"item_id" varchar NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rank_seasons" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"tagline" varchar(160),
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "saved_cards" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"stripe_payment_method_id" varchar NOT NULL,
	"brand" varchar(20) DEFAULT 'visa' NOT NULL,
	"last4" varchar(4) NOT NULL,
	"expiry_month" integer NOT NULL,
	"expiry_year" integer NOT NULL,
	"cardholder_name" varchar(120) NOT NULL,
	"billing_zip" varchar(20),
	"nickname" varchar(60),
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "saved_cards_stripe_payment_method_id_unique" UNIQUE("stripe_payment_method_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"description" varchar(240) NOT NULL,
	"category" varchar(40) NOT NULL,
	"rarity" varchar(20) DEFAULT 'common' NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"coin_price" integer DEFAULT 0 NOT NULL,
	"icon_color" varchar(7) DEFAULT '#3B82F6',
	"preview_gradient" varchar(120),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_daily_item" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "social_mutes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"muted_user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" varchar NOT NULL,
	"subject_user_id" varchar,
	"type" varchar(20) DEFAULT 'general' NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "social_reactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"reaction_type" varchar(10) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "social_replies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" varchar NOT NULL,
	"author_id" varchar NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tournament_brackets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" varchar NOT NULL,
	"round" integer NOT NULL,
	"match_slot" integer NOT NULL,
	"player1_id" varchar,
	"player2_id" varchar,
	"winner_id" varchar,
	"match_id" varchar,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"scheduled_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar(50) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"balance_before" numeric(10, 2) NOT NULL,
	"balance_after" numeric(10, 2) NOT NULL,
	"match_id" varchar,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tutorial_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"tutorial_id" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"total_steps" integer DEFAULT 0 NOT NULL,
	"reward_granted" boolean DEFAULT false NOT NULL,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"achievement_id" varchar NOT NULL,
	"match_id" varchar,
	"progress" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_battle_pass_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"season_id" varchar NOT NULL,
	"current_xp" integer DEFAULT 0 NOT NULL,
	"claimed_tiers" integer[] DEFAULT '{}' NOT NULL,
	"has_premium" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_equipped" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"category" varchar(40) NOT NULL,
	"item_id" varchar NOT NULL,
	"equipped_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_inventory" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"item_id" varchar NOT NULL,
	"purchased_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"password_hash" varchar,
	"username" varchar(30),
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"is_bot" boolean DEFAULT false,
	"is_admin" boolean DEFAULT false,
	"is_banned" boolean DEFAULT false,
	"is_email_verified" boolean DEFAULT false,
	"is_verified_account" boolean DEFAULT false,
	"balance" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"coins_balance" integer DEFAULT 0 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"theme_preference" varchar(10) DEFAULT 'dark',
	"country" varchar(2),
	"nickname_color" varchar(7) DEFAULT '#3B82F6',
	"last_username_change_at" timestamp,
	"last_profile_picture_change_at" timestamp,
	"last_login_date" timestamp,
	"login_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"reputation" integer DEFAULT 80 NOT NULL,
	"chess_rating" integer DEFAULT 1200 NOT NULL,
	"mini_golf_rating" integer DEFAULT 1200 NOT NULL,
	"connect4_rating" integer DEFAULT 1200 NOT NULL,
	"air_hockey_rating" integer DEFAULT 1200 NOT NULL,
	"block_blast_rating" integer DEFAULT 1200 NOT NULL,
	"rock_paper_scissors_rating" integer DEFAULT 1200 NOT NULL,
	"dots_and_boxes_rating" integer DEFAULT 1200 NOT NULL,
	"eight_ball_rating" integer DEFAULT 1200 NOT NULL,
	"bowling_rating" integer DEFAULT 1200 NOT NULL,
	"cup_king_rating" integer DEFAULT 1200 NOT NULL,
	"stack_tower_rating" integer DEFAULT 1200 NOT NULL,
	"basketball_rating" integer DEFAULT 1200 NOT NULL,
	"football_rating" integer DEFAULT 1200 NOT NULL,
	"racing_rating" integer DEFAULT 1200 NOT NULL,
	"chess_placement_matches" integer DEFAULT 0 NOT NULL,
	"mini_golf_placement_matches" integer DEFAULT 0 NOT NULL,
	"connect4_placement_matches" integer DEFAULT 0 NOT NULL,
	"air_hockey_placement_matches" integer DEFAULT 0 NOT NULL,
	"block_blast_placement_matches" integer DEFAULT 0 NOT NULL,
	"rock_paper_scissors_placement_matches" integer DEFAULT 0 NOT NULL,
	"dots_and_boxes_placement_matches" integer DEFAULT 0 NOT NULL,
	"eight_ball_placement_matches" integer DEFAULT 0 NOT NULL,
	"bowling_placement_matches" integer DEFAULT 0 NOT NULL,
	"cup_king_placement_matches" integer DEFAULT 0 NOT NULL,
	"stack_tower_placement_matches" integer DEFAULT 0 NOT NULL,
	"basketball_placement_matches" integer DEFAULT 0 NOT NULL,
	"football_placement_matches" integer DEFAULT 0 NOT NULL,
	"racing_placement_matches" integer DEFAULT 0 NOT NULL,
	"chess_rated_games_played" integer DEFAULT 0 NOT NULL,
	"mini_golf_rated_games_played" integer DEFAULT 0 NOT NULL,
	"connect4_rated_games_played" integer DEFAULT 0 NOT NULL,
	"air_hockey_rated_games_played" integer DEFAULT 0 NOT NULL,
	"block_blast_rated_games_played" integer DEFAULT 0 NOT NULL,
	"rock_paper_scissors_rated_games_played" integer DEFAULT 0 NOT NULL,
	"dots_and_boxes_rated_games_played" integer DEFAULT 0 NOT NULL,
	"eight_ball_rated_games_played" integer DEFAULT 0 NOT NULL,
	"bowling_rated_games_played" integer DEFAULT 0 NOT NULL,
	"cup_king_rated_games_played" integer DEFAULT 0 NOT NULL,
	"stack_tower_rated_games_played" integer DEFAULT 0 NOT NULL,
	"basketball_rated_games_played" integer DEFAULT 0 NOT NULL,
	"football_rated_games_played" integer DEFAULT 0 NOT NULL,
	"racing_rated_games_played" integer DEFAULT 0 NOT NULL,
	"chess_win_streak" integer DEFAULT 0 NOT NULL,
	"mini_golf_win_streak" integer DEFAULT 0 NOT NULL,
	"connect4_win_streak" integer DEFAULT 0 NOT NULL,
	"air_hockey_win_streak" integer DEFAULT 0 NOT NULL,
	"block_blast_win_streak" integer DEFAULT 0 NOT NULL,
	"rock_paper_scissors_win_streak" integer DEFAULT 0 NOT NULL,
	"dots_and_boxes_win_streak" integer DEFAULT 0 NOT NULL,
	"eight_ball_win_streak" integer DEFAULT 0 NOT NULL,
	"bowling_win_streak" integer DEFAULT 0 NOT NULL,
	"cup_king_win_streak" integer DEFAULT 0 NOT NULL,
	"stack_tower_win_streak" integer DEFAULT 0 NOT NULL,
	"basketball_win_streak" integer DEFAULT 0 NOT NULL,
	"football_win_streak" integer DEFAULT 0 NOT NULL,
	"racing_win_streak" integer DEFAULT 0 NOT NULL,
	"chess_longest_win_streak" integer DEFAULT 0 NOT NULL,
	"mini_golf_longest_win_streak" integer DEFAULT 0 NOT NULL,
	"connect4_longest_win_streak" integer DEFAULT 0 NOT NULL,
	"air_hockey_longest_win_streak" integer DEFAULT 0 NOT NULL,
	"block_blast_longest_win_streak" integer DEFAULT 0 NOT NULL,
	"rock_paper_scissors_longest_win_streak" integer DEFAULT 0 NOT NULL,
	"dots_and_boxes_longest_win_streak" integer DEFAULT 0 NOT NULL,
	"eight_ball_longest_win_streak" integer DEFAULT 0 NOT NULL,
	"bowling_longest_win_streak" integer DEFAULT 0 NOT NULL,
	"cup_king_longest_win_streak" integer DEFAULT 0 NOT NULL,
	"stack_tower_longest_win_streak" integer DEFAULT 0 NOT NULL,
	"basketball_longest_win_streak" integer DEFAULT 0 NOT NULL,
	"football_longest_win_streak" integer DEFAULT 0 NOT NULL,
	"racing_longest_win_streak" integer DEFAULT 0 NOT NULL,
	"language_preference" varchar(10) DEFAULT 'en' NOT NULL,
	"timezone_preference" varchar(50) DEFAULT 'America/New_York' NOT NULL,
	"currency_display" varchar(10) DEFAULT 'USD' NOT NULL,
	"daily_spending_limit" numeric(10, 2),
	"weekly_spending_limit" numeric(10, 2),
	"monthly_spending_limit" numeric(10, 2),
	"max_wager_amount" numeric(10, 2),
	"self_exclusion_until" timestamp,
	"cool_off_until" timestamp,
	"chat_muted_until" timestamp,
	"wager_restricted_until" timestamp,
	"temp_ban_until" timestamp,
	"stats_visibility" varchar(20) DEFAULT 'public' NOT NULL,
	"beta_features_enabled" boolean DEFAULT false NOT NULL,
	"referral_code" varchar(20),
	"referred_by" varchar,
	"bio" text,
	"favorite_game" varchar(50),
	"notification_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"gameplay_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"account_closure_requested" boolean DEFAULT false NOT NULL,
	"account_closure_reason" text,
	"account_closure_requested_at" timestamp,
	"stripe_customer_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code"),
	CONSTRAINT "users_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "weekly_leaderboards" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"game_type" varchar(50) NOT NULL,
	"week_start_date" timestamp NOT NULL,
	"week_end_date" timestamp NOT NULL,
	"rank" integer NOT NULL,
	"rating" integer NOT NULL,
	"matches_played" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"win_streak" integer DEFAULT 0 NOT NULL,
	"total_earnings" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_target_id_users_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_pass_tiers" ADD CONSTRAINT "battle_pass_tiers_season_id_battle_pass_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."battle_pass_seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_claims" ADD CONSTRAINT "challenge_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_invites" ADD CONSTRAINT "challenge_invites_challenger_id_users_id_fk" FOREIGN KEY ("challenger_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_invites" ADD CONSTRAINT "challenge_invites_challenged_id_users_id_fk" FOREIGN KEY ("challenged_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_invites" ADD CONSTRAINT "challenge_invites_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_invites" ADD CONSTRAINT "clan_invites_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_invites" ADD CONSTRAINT "clan_invites_invited_user_id_users_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_invites" ADD CONSTRAINT "clan_invites_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_join_requests" ADD CONSTRAINT "clan_join_requests_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_join_requests" ADD CONSTRAINT "clan_join_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_members" ADD CONSTRAINT "clan_members_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_members" ADD CONSTRAINT "clan_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_messages" ADD CONSTRAINT "clan_messages_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clan_messages" ADD CONSTRAINT "clan_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clans" ADD CONSTRAINT "clans_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crypto_payments" ADD CONSTRAINT "crypto_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disconnect_penalties" ADD CONSTRAINT "disconnect_penalties_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disconnect_penalties" ADD CONSTRAINT "disconnect_penalties_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drill_scores" ADD CONSTRAINT "drill_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_games" ADD CONSTRAINT "favorite_games_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addressee_id_users_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_statistics" ADD CONSTRAINT "match_statistics_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_statistics" ADD CONSTRAINT "match_statistics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player1_id_users_id_fk" FOREIGN KEY ("player1_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player2_id_users_id_fk" FOREIGN KEY ("player2_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_id_users_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_forfeited_by_id_users_id_fk" FOREIGN KEY ("forfeited_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchmaking_queue" ADD CONSTRAINT "matchmaking_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parties" ADD CONSTRAINT "parties_leader_id_users_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_members" ADD CONSTRAINT "party_members_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_members" ADD CONSTRAINT "party_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_messages" ADD CONSTRAINT "party_messages_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_messages" ADD CONSTRAINT "party_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_reports" ADD CONSTRAINT "player_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_reports" ADD CONSTRAINT "player_reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_reports" ADD CONSTRAINT "player_reports_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rank_history" ADD CONSTRAINT "rank_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rank_history" ADD CONSTRAINT "rank_history_season_id_rank_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."rank_seasons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rank_history" ADD CONSTRAINT "rank_history_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rank_rewards" ADD CONSTRAINT "rank_rewards_season_id_rank_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."rank_seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rank_rewards" ADD CONSTRAINT "rank_rewards_item_id_shop_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."shop_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_cards" ADD CONSTRAINT "saved_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_mutes" ADD CONSTRAINT "social_mutes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_mutes" ADD CONSTRAINT "social_mutes_muted_user_id_users_id_fk" FOREIGN KEY ("muted_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_reactions" ADD CONSTRAINT "social_reactions_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_reactions" ADD CONSTRAINT "social_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_replies" ADD CONSTRAINT "social_replies_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_replies" ADD CONSTRAINT "social_replies_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_brackets" ADD CONSTRAINT "tournament_brackets_player1_id_users_id_fk" FOREIGN KEY ("player1_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_brackets" ADD CONSTRAINT "tournament_brackets_player2_id_users_id_fk" FOREIGN KEY ("player2_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_brackets" ADD CONSTRAINT "tournament_brackets_winner_id_users_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_brackets" ADD CONSTRAINT "tournament_brackets_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutorial_progress" ADD CONSTRAINT "tutorial_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_battle_pass_progress" ADD CONSTRAINT "user_battle_pass_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_battle_pass_progress" ADD CONSTRAINT "user_battle_pass_progress_season_id_battle_pass_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."battle_pass_seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_equipped" ADD CONSTRAINT "user_equipped_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_equipped" ADD CONSTRAINT "user_equipped_item_id_shop_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."shop_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_inventory" ADD CONSTRAINT "user_inventory_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_inventory" ADD CONSTRAINT "user_inventory_item_id_shop_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."shop_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_leaderboards" ADD CONSTRAINT "weekly_leaderboards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "drill_scores_user_tutorial_unique" ON "drill_scores" USING btree ("user_id","tutorial_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE UNIQUE INDEX "tutorial_progress_user_tutorial_unique" ON "tutorial_progress" USING btree ("user_id","tutorial_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_inventory_user_item_unique" ON "user_inventory" USING btree ("user_id","item_id");