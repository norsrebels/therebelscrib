CREATE TABLE "announcements" (
	"id" serial PRIMARY KEY,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"tag" text DEFAULT 'Announcement' NOT NULL,
	"tag_color" text DEFAULT 'blue' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
