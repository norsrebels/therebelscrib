-- Store schedule date/time as plain TEXT instead of timestamp. The timestamp
-- columns were silently binding date-input strings to NULL (the "TBA" bug).
-- Text columns store exactly what is sent, with no casting or parsing — which
-- removes that entire failure mode. Date is kept as 'YYYY-MM-DD' and time as
-- 'HH:mm', exactly what the HTML date/time inputs produce, so lexical comparison
-- still sorts and range-filters correctly.
ALTER TABLE registration_schedules
  ALTER COLUMN date TYPE text USING to_char(date, 'YYYY-MM-DD'),
  ALTER COLUMN end_date TYPE text USING to_char(end_date, 'YYYY-MM-DD');

ALTER TABLE registration_schedules ADD COLUMN IF NOT EXISTS start_time text;
ALTER TABLE registration_schedules ADD COLUMN IF NOT EXISTS end_time text;
