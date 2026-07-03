ALTER TABLE "albums" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "flagged" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "flag_note" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "netlify_user_id" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "netlify_email" text;--> statement-breakpoint
ALTER TABLE "player_stats" ADD COLUMN IF NOT EXISTS "freeball_dig" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats" ADD COLUMN IF NOT EXISTS "freeball_error" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats" ADD COLUMN IF NOT EXISTS "opponent_id" varchar(100);--> statement-breakpoint
ALTER TABLE "player_stats" ADD COLUMN IF NOT EXISTS "match_date" text;--> statement-breakpoint
ALTER TABLE "player_stats" ADD COLUMN IF NOT EXISTS "match_venue" text;--> statement-breakpoint
ALTER TABLE "player_stats" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vis_matches" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vis_set_stats" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 0 NOT NULL;
