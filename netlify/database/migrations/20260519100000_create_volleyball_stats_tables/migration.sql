CREATE TABLE IF NOT EXISTS "vis_matches" (
  "id" serial PRIMARY KEY NOT NULL,
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

CREATE TABLE IF NOT EXISTS "vis_match_players" (
  "id" serial PRIMARY KEY NOT NULL,
  "match_id" integer NOT NULL,
  "jersey_number" integer NOT NULL,
  "player_name" text NOT NULL,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "vis_set_stats" (
  "id" serial PRIMARY KEY NOT NULL,
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

DO $$ BEGIN
  ALTER TABLE "vis_match_players"
    ADD CONSTRAINT "vis_match_players_match_id_vis_matches_id_fkey"
    FOREIGN KEY ("match_id") REFERENCES "vis_matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "vis_set_stats"
    ADD CONSTRAINT "vis_set_stats_match_id_vis_matches_id_fkey"
    FOREIGN KEY ("match_id") REFERENCES "vis_matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "vis_set_stats"
    ADD CONSTRAINT "vis_set_stats_player_id_vis_match_players_id_fkey"
    FOREIGN KEY ("player_id") REFERENCES "vis_match_players"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "vis_set_stats_match_player_set_uniq"
  ON "vis_set_stats" ("match_id", "player_id", "set_number");
