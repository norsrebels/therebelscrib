-- Upgrade registration_schedules.date / end_date from DATE to TIMESTAMP so the
-- event can carry a specific start/end time, not just a calendar day. Existing
-- date values are preserved as midnight on that date (USING clause), so no data
-- is lost — admins can edit each schedule afterward to add the actual time.
ALTER TABLE registration_schedules
  ALTER COLUMN date TYPE timestamp USING date::timestamp,
  ALTER COLUMN end_date TYPE timestamp USING end_date::timestamp;
