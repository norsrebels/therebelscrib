CREATE TABLE "settings" (
	"id" serial PRIMARY KEY,
	"key" text NOT NULL UNIQUE,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "scores" jsonb DEFAULT '{}';