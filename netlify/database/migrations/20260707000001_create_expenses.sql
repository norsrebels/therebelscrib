-- Expenses table: soft-archive via archived_at (NULL = active; a time = archived/kept).
-- Fully idempotent + self-healing so re-runs and branches built on top of an older,
-- partially-created expenses table succeed:
--   1. Create the table if it is missing (fresh databases).
--   2. Backfill any missing columns if the table already exists but predates them
--      (this is what was failing: an older expenses table had no archived_at column,
--      so CREATE INDEX ON expenses(archived_at) errored with 42703).
--   3. Add the FK to registration_schedules only if it is not already present.
--   4. Create the indexes.

-- 1) Table (fresh case) — inline FK keeps expenses if their schedule is removed.
CREATE TABLE IF NOT EXISTS expenses (
  id serial PRIMARY KEY,
  schedule_id integer REFERENCES registration_schedules(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'Other',
  amount numeric(10,2) NOT NULL DEFAULT 0,
  expense_date date,
  note text,
  is_recurring boolean NOT NULL DEFAULT false,
  archived_at timestamp,
  created_by text,
  created_at timestamp NOT NULL DEFAULT now()
);

-- 2) Backfill columns for pre-existing (older) expenses tables.
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS schedule_id integer;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Other';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS amount numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_date date;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS archived_at timestamp;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();

-- 3) Foreign key to schedules (SET NULL keeps expenses if a schedule is deleted).
--    ADD CONSTRAINT has no IF NOT EXISTS, so guard it so re-runs don't error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_expenses_schedule'
  ) THEN
    ALTER TABLE expenses
      ADD CONSTRAINT fk_expenses_schedule
      FOREIGN KEY (schedule_id) REFERENCES registration_schedules(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4) Indexes.
CREATE INDEX IF NOT EXISTS idx_expenses_schedule ON expenses(schedule_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_archived ON expenses(archived_at);
