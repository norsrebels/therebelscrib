CREATE TABLE "assessments" (
	"id" serial PRIMARY KEY,
	"player_id" integer NOT NULL,
	"serving" integer DEFAULT 0 NOT NULL,
	"serving_variations" integer DEFAULT 0 NOT NULL,
	"passing" integer DEFAULT 0 NOT NULL,
	"setting" integer DEFAULT 0 NOT NULL,
	"attacking" integer DEFAULT 0 NOT NULL,
	"back_row_attack" integer DEFAULT 0 NOT NULL,
	"blocking" integer DEFAULT 0 NOT NULL,
	"defensive_coverage" integer DEFAULT 0 NOT NULL,
	"transition_play" integer DEFAULT 0 NOT NULL,
	"tip_off_speed_shots" integer DEFAULT 0 NOT NULL,
	"first_ball_contact" integer DEFAULT 0 NOT NULL,
	"blocking_strategy" integer DEFAULT 0 NOT NULL,
	"shot_placement_awareness" integer DEFAULT 0 NOT NULL,
	"rotation_discipline" integer DEFAULT 0 NOT NULL,
	"court_vision" integer DEFAULT 0 NOT NULL,
	"speed_agility" integer DEFAULT 0 NOT NULL,
	"jumping_ability" integer DEFAULT 0 NOT NULL,
	"explosiveness" integer DEFAULT 0 NOT NULL,
	"flexibility" integer DEFAULT 0 NOT NULL,
	"lateral_quickness" integer DEFAULT 0 NOT NULL,
	"endurance_strength" integer DEFAULT 0 NOT NULL,
	"game_iq" integer DEFAULT 0 NOT NULL,
	"adaptability" integer DEFAULT 0 NOT NULL,
	"composure" integer DEFAULT 0 NOT NULL,
	"pressure_handling" integer DEFAULT 0 NOT NULL,
	"emotional_control" integer DEFAULT 0 NOT NULL,
	"communication" integer DEFAULT 0 NOT NULL,
	"teamwork_discipline" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY,
	"nickname" text NOT NULL,
	"position" text DEFAULT '' NOT NULL,
	"overall_score" integer DEFAULT 0 NOT NULL,
	"player_level" text DEFAULT 'Developmental' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_player_id_players_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE;