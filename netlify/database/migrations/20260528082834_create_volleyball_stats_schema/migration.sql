CREATE TABLE IF NOT EXISTS "album_images" (
	"id" serial PRIMARY KEY,
	"album_id" integer NOT NULL,
	"image_id" text NOT NULL,
	"image_url" text NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "albums" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"cover_image_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "announcements" (
	"id" serial PRIMARY KEY,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"tag" text DEFAULT 'Announcement' NOT NULL,
	"tag_color" text DEFAULT 'blue' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessments" (
	"id" serial PRIMARY KEY,
	"player_id" integer NOT NULL,
	"serving" integer DEFAULT 0 NOT NULL,
	"serving_variations" integer DEFAULT 0 NOT NULL,
	"passing" integer DEFAULT 0 NOT NULL,
	"setting" integer DEFAULT 0 NOT NULL,
	"attacking" integer DEFAULT 0 NOT NULL,
	"back_row_attack" integer DEFAULT 0 NOT NULL,
	"blocking" integer DEFAULT 0 NOT NULL,
	"defensive_coverage" integer DEFAULT 0 NOT NULL,
	"transition_play" integer DEFAULT 0 NOT NULL,
	"tip_off_speed_shots" integer DEFAULT 0 NOT NULL,
	"first_ball_contact" integer DEFAULT 0 NOT NULL,
	"blocking_strategy" integer DEFAULT 0 NOT NULL,
	"shot_placement_awareness" integer DEFAULT 0 NOT NULL,
	"rotation_discipline" integer DEFAULT 0 NOT NULL,
	"court_vision" integer DEFAULT 0 NOT NULL,
	"speed_agility" integer DEFAULT 0 NOT NULL,
	"jumping_ability" integer DEFAULT 0 NOT NULL,
	"explosiveness" integer DEFAULT 0 NOT NULL,
	"flexibility" integer DEFAULT 0 NOT NULL,
	"lateral_quickness" integer DEFAULT 0 NOT NULL,
	"endurance_strength" integer DEFAULT 0 NOT NULL,
	"game_iq" integer DEFAULT 0 NOT NULL,
	"adaptability" integer DEFAULT 0 NOT NULL,
	"composure" integer DEFAULT 0 NOT NULL,
	"pressure_handling" integer DEFAULT 0 NOT NULL,
	"emotional_control" integer DEFAULT 0 NOT NULL,
	"communication" integer DEFAULT 0 NOT NULL,
	"teamwork_discipline" integer DEFAULT 0 NOT NULL,
	"scores" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
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
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "player_stats" (
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
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "players" (
	"id" serial PRIMARY KEY,
	"nickname" text NOT NULL,
	"position" text DEFAULT '' NOT NULL,
	"overall_score" integer DEFAULT 0 NOT NULL,
	"player_level" text DEFAULT 'Developmental' NOT NULL,
	"profile_picture" text,
	"jersey_number" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settings" (
	"id" serial PRIMARY KEY,
	"key" text NOT NULL UNIQUE,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "site_settings" (
	"id" serial PRIMARY KEY,
	"key" text NOT NULL UNIQUE,
	"value" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stat_users" (
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
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tournaments" (
	"id" serial PRIMARY KEY,
	"external_id" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vis_match_players" (
	"id" serial PRIMARY KEY,
	"match_id" integer NOT NULL,
	"jersey_number" integer NOT NULL,
	"player_name" text NOT NULL,
	"global_player_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vis_matches" (
	"id" serial PRIMARY KEY,
	"match_date" text NOT NULL,
	"team_name" text DEFAULT 'The Rebels' NOT NULL,
	"opponent_name" text NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"password_hash" text NOT NULL,
	"total_sets" integer DEFAULT 1 NOT NULL,
	"tournament_id" text,
	"tournament_match_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vis_set_stats" (
	"id" serial PRIMARY KEY,
	"match_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"set_number" integer NOT NULL,
	"spike_kill" integer DEFAULT 0 NOT NULL,
	"spike_error" integer DEFAULT 0 NOT NULL,
	"spike_attempt" integer DEFAULT 0 NOT NULL,
	"block_kill" integer DEFAULT 0 NOT NULL,
	"block_error" integer DEFAULT 0 NOT NULL,
	"block_rebound" integer DEFAULT 0 NOT NULL,
	"serve_ace" integer DEFAULT 0 NOT NULL,
	"serve_error" integer DEFAULT 0 NOT NULL,
	"serve_attempt" integer DEFAULT 0 NOT NULL,
	"dig_excellent" integer DEFAULT 0 NOT NULL,
	"dig_fault" integer DEFAULT 0 NOT NULL,
	"dig_attempt" integer DEFAULT 0 NOT NULL,
	"set_excellent" integer DEFAULT 0 NOT NULL,
	"set_fault" integer DEFAULT 0 NOT NULL,
	"set_attempt" integer DEFAULT 0 NOT NULL,
	"receive_excellent" integer DEFAULT 0 NOT NULL,
	"receive_error" integer DEFAULT 0 NOT NULL,
	"receive_attempt" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'album_images_album_id_albums_id_fkey') THEN
    ALTER TABLE "album_images" ADD CONSTRAINT "album_images_album_id_albums_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assessments_player_id_players_id_fkey') THEN
    ALTER TABLE "assessments" ADD CONSTRAINT "assessments_player_id_players_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'player_stats_player_id_players_id_fkey') THEN
    ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_player_id_players_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id");
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vis_match_players_match_id_vis_matches_id_fkey') THEN
    ALTER TABLE "vis_match_players" ADD CONSTRAINT "vis_match_players_match_id_vis_matches_id_fkey" FOREIGN KEY ("match_id") REFERENCES "vis_matches"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vis_match_players_global_player_id_players_id_fkey') THEN
    ALTER TABLE "vis_match_players" ADD CONSTRAINT "vis_match_players_global_player_id_players_id_fkey" FOREIGN KEY ("global_player_id") REFERENCES "players"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vis_set_stats_match_id_vis_matches_id_fkey') THEN
    ALTER TABLE "vis_set_stats" ADD CONSTRAINT "vis_set_stats_match_id_vis_matches_id_fkey" FOREIGN KEY ("match_id") REFERENCES "vis_matches"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vis_set_stats_player_id_vis_match_players_id_fkey') THEN
    ALTER TABLE "vis_set_stats" ADD CONSTRAINT "vis_set_stats_player_id_vis_match_players_id_fkey" FOREIGN KEY ("player_id") REFERENCES "vis_match_players"("id") ON DELETE CASCADE;
  END IF;
END $$;
