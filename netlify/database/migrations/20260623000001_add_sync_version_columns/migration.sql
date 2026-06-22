-- Sync envelope, part 2 of 2: a BEFORE UPDATE trigger that stamps updated_at
-- and increments version on EVERY row update, regardless of what the app sends.
-- This makes `updated_at` trustworthy for delta-polling (?since=) and gives
-- every write an optimistic-concurrency token. Idempotent (safe to re-run).

CREATE OR REPLACE FUNCTION set_sync_fields() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  NEW.version    = COALESCE(OLD.version, 0) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_players       ON "players";
CREATE TRIGGER trg_sync_players       BEFORE UPDATE ON "players"       FOR EACH ROW EXECUTE FUNCTION set_sync_fields();
DROP TRIGGER IF EXISTS trg_sync_assessments   ON "assessments";
CREATE TRIGGER trg_sync_assessments   BEFORE UPDATE ON "assessments"   FOR EACH ROW EXECUTE FUNCTION set_sync_fields();
DROP TRIGGER IF EXISTS trg_sync_settings      ON "settings";
CREATE TRIGGER trg_sync_settings      BEFORE UPDATE ON "settings"      FOR EACH ROW EXECUTE FUNCTION set_sync_fields();
DROP TRIGGER IF EXISTS trg_sync_site_settings ON "site_settings";
CREATE TRIGGER trg_sync_site_settings BEFORE UPDATE ON "site_settings" FOR EACH ROW EXECUTE FUNCTION set_sync_fields();
DROP TRIGGER IF EXISTS trg_sync_tournaments   ON "tournaments";
CREATE TRIGGER trg_sync_tournaments   BEFORE UPDATE ON "tournaments"   FOR EACH ROW EXECUTE FUNCTION set_sync_fields();
DROP TRIGGER IF EXISTS trg_sync_albums        ON "albums";
CREATE TRIGGER trg_sync_albums        BEFORE UPDATE ON "albums"        FOR EACH ROW EXECUTE FUNCTION set_sync_fields();
DROP TRIGGER IF EXISTS trg_sync_announcements ON "announcements";
CREATE TRIGGER trg_sync_announcements BEFORE UPDATE ON "announcements" FOR EACH ROW EXECUTE FUNCTION set_sync_fields();
DROP TRIGGER IF EXISTS trg_sync_vis_matches   ON "vis_matches";
CREATE TRIGGER trg_sync_vis_matches   BEFORE UPDATE ON "vis_matches"   FOR EACH ROW EXECUTE FUNCTION set_sync_fields();
DROP TRIGGER IF EXISTS trg_sync_vis_set_stats ON "vis_set_stats";
CREATE TRIGGER trg_sync_vis_set_stats BEFORE UPDATE ON "vis_set_stats" FOR EACH ROW EXECUTE FUNCTION set_sync_fields();
DROP TRIGGER IF EXISTS trg_sync_player_stats  ON "player_stats";
CREATE TRIGGER trg_sync_player_stats  BEFORE UPDATE ON "player_stats"  FOR EACH ROW EXECUTE FUNCTION set_sync_fields();
