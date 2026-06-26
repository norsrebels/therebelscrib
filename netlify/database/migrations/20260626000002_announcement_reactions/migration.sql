-- Emoji reactions on announcements. Mirrors photo_reactions structure.
-- One reaction per member per announcement (upsert on conflict).
CREATE TABLE IF NOT EXISTS announcement_reactions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  netlify_user_id text    NOT NULL,
  netlify_email   text    NOT NULL,
  announcement_id integer NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  reaction    varchar(10) NOT NULL DEFAULT '👏',
  created_at  timestamp   NOT NULL DEFAULT now(),
  UNIQUE(netlify_user_id, announcement_id)
);
CREATE INDEX IF NOT EXISTS idx_announcement_reactions_ann
  ON announcement_reactions(announcement_id);
