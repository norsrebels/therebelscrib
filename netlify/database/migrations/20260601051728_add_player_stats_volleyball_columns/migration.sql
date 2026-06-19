ALTER TABLE "player_stats" ADD COLUMN IF NOT EXISTS "block_rebound" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats" ADD COLUMN IF NOT EXISTS "dig_attempt" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats" ADD COLUMN IF NOT EXISTS "receive_attempt" integer DEFAULT 0 NOT NULL;