-- The expenses table is created by the earlier, self-healing migration
-- 20260707000001_create_expenses.sql. IF NOT EXISTS keeps this Drizzle-generated
-- migration (kept for schema snapshot lineage) from failing when the table already exists.
CREATE TABLE IF NOT EXISTS "expenses" (
	"id" serial PRIMARY KEY,
	"schedule_id" integer,
	"category" text DEFAULT 'Other' NOT NULL,
	"amount" numeric(10,2) DEFAULT '0' NOT NULL,
	"expense_date" date,
	"note" text,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
