-- Fixes the failing registration INSERT: the code writes to registrations.position
-- but that column was never added to the live table (schema/code drift). Also adds
-- facebook_url as an optional point-of-contact field. IF NOT EXISTS keeps this safe
-- to run regardless of any partial prior state.
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS position text;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS facebook_url text;
