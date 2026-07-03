-- Phase 1: Pricing foundation.
-- Per-player pricing on schedules; each registration captures its own amount +
-- payment status at signup (so financial reports reflect what was ACTUALLY charged,
-- not today's price). All additive + IF NOT EXISTS — safe to run anytime on netlifydb.

-- Per-player price on each schedule (0 = free). numeric(10,2) for currency.
ALTER TABLE registration_schedules ADD COLUMN IF NOT EXISTS price_per_player numeric(10,2) NOT NULL DEFAULT 0;

-- Captured on each registration at the moment of signup:
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS amount_due     numeric(10,2) NOT NULL DEFAULT 0;   -- price_per_player x headcount
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS amount_paid    numeric(10,2) NOT NULL DEFAULT 0;   -- supports partially-paid
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS payment_status varchar(20) NOT NULL DEFAULT 'unpaid'; -- unpaid | paid | partially_paid
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS priced_at      timestamp;  -- when the amount_due was captured

-- Index for finance queries filtering by payment status.
CREATE INDEX IF NOT EXISTS idx_registrations_payment_status ON registrations(payment_status);
