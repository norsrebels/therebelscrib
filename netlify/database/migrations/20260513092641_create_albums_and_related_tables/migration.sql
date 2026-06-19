CREATE TABLE "album_images" (
	"id" serial PRIMARY KEY,
	"album_id" integer NOT NULL,
	"image_id" text NOT NULL,
	"image_url" text NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "albums" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"cover_image_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" serial PRIMARY KEY,
	"key" text NOT NULL UNIQUE,
	"value" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" serial PRIMARY KEY,
	"external_id" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "album_images" ADD CONSTRAINT "album_images_album_id_albums_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE;