-- MASTER MIGRATION — Sprint 4 + 5 + 7 + 8 combined
-- Path: netlify/database/migrations/20260620000001_master_migration/migration.sql
-- Run this single file instead of individual sprint migrations

-- ─── Sprint 4: freeball, audit flags, match context ──────────────────────────
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS freeball_dig integer NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS freeball_error integer NOT NULL DEFAULT 0;

ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS flag_note text;

ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS opponent_id varchar(100);
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS match_date text;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS match_venue text;

-- ─── Sprint 5: match locks ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_locks (
  match_id varchar(100) PRIMARY KEY,
  locked_by varchar(50) NOT NULL,
  locked_at timestamp NOT NULL DEFAULT now(),
  notes text
);
CREATE INDEX IF NOT EXISTS idx_match_locks_match_id ON match_locks(match_id);

-- ─── Sprint 7: Netlify Identity columns, drop stat_users ─────────────────────
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS netlify_user_id text;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS netlify_email text;

-- NOTE: Only drop stat_users AFTER confirming NI login works end-to-end
-- DROP TABLE IF EXISTS stat_users CASCADE;

-- ─── Sprint 8: Member engagement tables ──────────────────────────────────────

-- Photo reactions (one reaction type per user per photo)
CREATE TABLE IF NOT EXISTS photo_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  netlify_user_id text NOT NULL,
  netlify_email text NOT NULL,
  image_id text NOT NULL,
  reaction varchar(10) NOT NULL DEFAULT '👏',
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(netlify_user_id, image_id)
);
CREATE INDEX IF NOT EXISTS idx_photo_reactions_image ON photo_reactions(image_id);

-- Photo comments
CREATE TABLE IF NOT EXISTS photo_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  netlify_user_id text NOT NULL,
  netlify_email text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  image_id text NOT NULL,
  body text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_photo_comments_image ON photo_comments(image_id);

-- Match predictions (before game starts)
CREATE TABLE IF NOT EXISTS match_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  netlify_user_id text NOT NULL,
  netlify_email text NOT NULL,
  match_id varchar(100) NOT NULL,
  predicted_winner_id varchar(100) NOT NULL,
  predicted_winner_name text NOT NULL,
  was_correct boolean,
  resolved_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(netlify_user_id, match_id)
);
CREATE INDEX IF NOT EXISTS idx_match_predictions_match ON match_predictions(match_id);

-- Match ratings (after game ends)
CREATE TABLE IF NOT EXISTS match_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  netlify_user_id text NOT NULL,
  netlify_email text NOT NULL,
  match_id varchar(100) NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(netlify_user_id, match_id)
);

-- Player ratings (per match)
CREATE TABLE IF NOT EXISTS player_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  netlify_user_id text NOT NULL,
  netlify_email text NOT NULL,
  player_id integer NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  match_id varchar(100),
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  note text,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(netlify_user_id, player_id, match_id)
);
CREATE INDEX IF NOT EXISTS idx_player_ratings_player ON player_ratings(player_id);

-- Polls created by admin
CREATE TABLE IF NOT EXISTS polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  closes_at timestamp,
  created_by text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Poll responses (one per user per poll)
CREATE TABLE IF NOT EXISTS poll_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  netlify_user_id text NOT NULL,
  netlify_email text NOT NULL,
  answer_index integer NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(poll_id, netlify_user_id)
);
CREATE INDEX IF NOT EXISTS idx_poll_responses_poll ON poll_responses(poll_id);

-- Member profiles (display name, avatar, fan level)
CREATE TABLE IF NOT EXISTS member_profiles (
  netlify_user_id text PRIMARY KEY,
  netlify_email text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  avatar_url text,
  fan_level text NOT NULL DEFAULT 'Rookie',
  total_reactions integer NOT NULL DEFAULT 0,
  total_predictions integer NOT NULL DEFAULT 0,
  correct_predictions integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
