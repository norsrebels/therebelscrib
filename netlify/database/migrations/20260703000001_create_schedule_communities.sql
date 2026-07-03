-- Roll-forward fix: ensure the schedule_communities join table exists.
--
-- The schedule ↔ community tagging half of the community feature relies on this
-- table. Its columns were bundled into 20260702000002_community_colors_schedule_tags
-- alongside the community color columns. On production the color columns applied
-- (color saving works) but the join table never materialized, so saving a
-- schedule's community tags fails at the first step:
--   DELETE FROM schedule_communities WHERE schedule_id = $1
-- because the table does not exist.
--
-- Rolling forward is always safe. Everything below is additive and guarded with
-- IF NOT EXISTS, so this is a no-op wherever the table already exists (e.g. the
-- preview branch) and creates it wherever it is missing (production).

CREATE TABLE IF NOT EXISTS schedule_communities (
  id serial PRIMARY KEY,
  schedule_id  integer NOT NULL REFERENCES registration_schedules(id) ON DELETE CASCADE,
  community_id integer NOT NULL REFERENCES communities(id)            ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_schedule_communities_schedule  ON schedule_communities(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_communities_community ON schedule_communities(community_id);

-- Prevent duplicate tags of the same community on the same schedule
-- (the INSERT path relies on this for its ON CONFLICT clause).
CREATE UNIQUE INDEX IF NOT EXISTS uq_schedule_community ON schedule_communities(schedule_id, community_id);
