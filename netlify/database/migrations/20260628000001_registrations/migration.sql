-- Player Registration system. A "registration_schedule" is the signup window for
-- an event (distinct from the live-scoring "tournaments" table — this is about
-- collecting signups, not running brackets). Each schedule can define its own
-- dynamic custom fields (admin-configurable), supports individual/team/group
-- registration types, and a confirmed/cancelled/waitlisted review workflow.

CREATE TABLE IF NOT EXISTS registration_schedules (
  id           serial PRIMARY KEY,
  name         text NOT NULL,
  sport        text NOT NULL DEFAULT 'Volleyball',
  date         date,
  end_date     date,                       -- optional, for multi-day events
  venue        text,
  description  text,
  status       varchar(20) NOT NULL DEFAULT 'active',   -- active | closed | archived
  capacity     integer,                    -- optional max registrations, null = unlimited
  custom_fields jsonb NOT NULL DEFAULT '[]', -- [{id, name, type, options[], required, defaultValue}]
  linked_tournament_external_id text,      -- optional link to the live-scoring tournaments table
  created_at   timestamp NOT NULL DEFAULT now(),
  updated_at   timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reg_schedules_date ON registration_schedules(date);
CREATE INDEX IF NOT EXISTS idx_reg_schedules_status ON registration_schedules(status);

CREATE TABLE IF NOT EXISTS registrations (
  id              serial PRIMARY KEY,
  schedule_id     integer NOT NULL REFERENCES registration_schedules(id) ON DELETE CASCADE,
  reg_type        varchar(20) NOT NULL,     -- individual | team | group
  name            text,                     -- individual name
  team_name       text,                     -- team/group name
  roster          jsonb NOT NULL DEFAULT '[]', -- array of member name strings
  contact_number  text,
  email           text,
  custom_answers  jsonb NOT NULL DEFAULT '{}', -- {customFieldId: value}
  status          varchar(20) NOT NULL DEFAULT 'pending', -- pending | confirmed | cancelled | waitlisted
  netlify_user_id text,                     -- set if submitted by a logged-in member
  created_at      timestamp NOT NULL DEFAULT now(),
  updated_at      timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_registrations_schedule ON registrations(schedule_id);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);
CREATE INDEX IF NOT EXISTS idx_registrations_created ON registrations(created_at DESC);
