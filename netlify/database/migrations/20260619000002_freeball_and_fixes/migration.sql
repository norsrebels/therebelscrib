-- Add freeball columns to player_stats
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS freeball_dig integer NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS freeball_error integer NOT NULL DEFAULT 0;

-- Add flagged columns to audit_log
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS flag_note text;

-- Add match context columns to player_stats
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS opponent_id varchar(100);
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS match_date text;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS venue text;
