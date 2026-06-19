ALTER TABLE "players" ADD COLUMN "jersey_number" integer;--> statement-breakpoint
CREATE TABLE "stat_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"username" varchar(50) NOT NULL UNIQUE,
	"password_hash" varchar(255) NOT NULL,
	"role" varchar(20) DEFAULT 'statistician' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"lockout_until" timestamp,
	"last_login_at" timestamp,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "player_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"match_id" varchar(100) NOT NULL,
	"player_id" integer NOT NULL,
	"team_id" varchar(100) NOT NULL,
	"set_number" integer DEFAULT 0 NOT NULL,
	"attack_kill" integer DEFAULT 0 NOT NULL,
	"attack_error" integer DEFAULT 0 NOT NULL,
	"attack_attempt" integer DEFAULT 0 NOT NULL,
	"serve_ace" integer DEFAULT 0 NOT NULL,
	"serve_error" integer DEFAULT 0 NOT NULL,
	"serve_attempt" integer DEFAULT 0 NOT NULL,
	"reception_perfect" integer DEFAULT 0 NOT NULL,
	"reception_good" integer DEFAULT 0 NOT NULL,
	"reception_ok" integer DEFAULT 0 NOT NULL,
	"reception_error" integer DEFAULT 0 NOT NULL,
	"set_assist" integer DEFAULT 0 NOT NULL,
	"set_attempt" integer DEFAULT 0 NOT NULL,
	"set_ball_handling_error" integer DEFAULT 0 NOT NULL,
	"block_solo" integer DEFAULT 0 NOT NULL,
	"block_assist" integer DEFAULT 0 NOT NULL,
	"block_error" integer DEFAULT 0 NOT NULL,
	"dig" integer DEFAULT 0 NOT NULL,
	"dig_error" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"stat_user_id" uuid,
	"username" varchar(50) NOT NULL,
	"user_role" varchar(20) NOT NULL,
	"action" varchar(50) NOT NULL,
	"entity_type" varchar(30),
	"entity_id" varchar(100),
	"match_id" varchar(100),
	"field_name" varchar(50),
	"old_value" text,
	"new_value" text,
	"ip_address" varchar(45),
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_player_id_players_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id");
