-- Migration: communities, community_members, tournament_communities, chat_messages

CREATE TABLE IF NOT EXISTS "communities" (
  "id" serial PRIMARY KEY,
  "slug" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "community_members" (
  "id" serial PRIMARY KEY,
  "community_id" integer NOT NULL REFERENCES "communities"("id") ON DELETE CASCADE,
  "netlify_user_id" text NOT NULL,
  "netlify_email" text NOT NULL,
  "display_name" text NOT NULL DEFAULT '',
  "joined_at" timestamp DEFAULT now()
);

-- Prevent duplicate membership
CREATE UNIQUE INDEX IF NOT EXISTS "community_members_unique"
  ON "community_members"("community_id", "netlify_user_id");

-- Many-to-many: tournament schedules <-> communities
CREATE TABLE IF NOT EXISTS "tournament_communities" (
  "id" serial PRIMARY KEY,
  "tournament_external_id" text NOT NULL REFERENCES "tournaments"("external_id") ON DELETE CASCADE,
  "community_id" integer NOT NULL REFERENCES "communities"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "tournament_communities_unique"
  ON "tournament_communities"("tournament_external_id", "community_id");

-- Chat messages (global + community-scoped)
CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" serial PRIMARY KEY,
  "scope" text NOT NULL DEFAULT 'global',
  "community_id" integer REFERENCES "communities"("id") ON DELETE CASCADE,
  "netlify_user_id" text NOT NULL,
  "netlify_email" text NOT NULL,
  "sender_name" text NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamp DEFAULT now()
);

-- Index for fetching messages by scope/community efficiently
CREATE INDEX IF NOT EXISTS "chat_messages_scope_idx"
  ON "chat_messages"("scope", "community_id", "created_at" DESC);
