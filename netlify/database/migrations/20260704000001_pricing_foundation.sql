-- Phase 1: Pricing foundation (renumbered to 20260704000001 to satisfy Netlify's
-- chronological ordering — an earlier manual/agent migration advanced the DB's
-- applied-version marker past 20260703000002). All additive + IF NOT EXISTS.
ALTER TABLE registration_schedules ADD COLUMN IF NOT EXISTS price_per_player numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS amount_due     numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS amount_paid    numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS payment_status varchar(20) NOT NULL DEFAULT 'unpaid';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS priced_at      timestamp;
CREATE INDEX IF NOT EXISTS idx_registrations_payment_status ON registrations(payment_status);
