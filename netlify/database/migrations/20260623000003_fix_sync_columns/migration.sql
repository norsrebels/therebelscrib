-- 20260623000003_fix_sync_columns
-- URGENT FIX. The two prior migrations (20260623000001_add_sync_version_columns
-- and 20260623000002_add_sync_trigger) are byte-identical: BOTH contain the
-- BEFORE UPDATE trigger, and NEITHER adds the columns the trigger writes to.
-- The live trigger set_sync_fields() assigns NEW.updated_at and NEW.version, but
-- those columns do not exist on every target table, so every UPDATE fails at
-- runtime with: ERROR: record "new" has no field "version".
-- INSERTs are unaffected (the trigger is BEFORE UPDATE only), and no data is
-- corrupted (failed UPDATEs roll back) -- but edits/corrections are blocked.
--
-- This migration adds BOTH columns to all 10 triggered tables, idempotently,
-- which makes the already-live trigger valid. Safe to run more than once.

-- version: optimistic-concurrency token (trigger increments it on each UPDATE)
ALTER TABLE "players"        ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 0;
ALTER TABLE "assessments"    ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 0;
ALTER TABLE "settings"       ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 0;
ALTER TABLE "site_settings"  ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 0;
ALTER TABLE "tournaments"    ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 0;
ALTER TABLE "albums"         ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 0;
ALTER TABLE "announcements"  ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 0;
ALTER TABLE "vis_matches"    ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 0;
ALTER TABLE "vis_set_stats"  ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 0;
ALTER TABLE "player_stats"   ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 0;

-- updated_at: delta-polling cursor (trigger stamps it now() on each UPDATE).
-- No-op where it already exists; added where it was missing.
ALTER TABLE "players"        ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();
ALTER TABLE "assessments"    ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();
ALTER TABLE "settings"       ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();
ALTER TABLE "site_settings"  ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();
ALTER TABLE "tournaments"    ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();
ALTER TABLE "albums"         ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();
ALTER TABLE "announcements"  ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();
ALTER TABLE "vis_matches"    ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();
ALTER TABLE "vis_set_stats"  ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();
ALTER TABLE "player_stats"   ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();
