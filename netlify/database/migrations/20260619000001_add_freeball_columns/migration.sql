ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS freeball_dig integer NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS freeball_error integer NOT NULL DEFAULT 0;
