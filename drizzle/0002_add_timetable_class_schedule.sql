-- navigation_edges/navigation_nodes were already created directly against the
-- shared Neon database (see scripts/navigation/import-graph.py) without a
-- committed migration, so this reconciles migration history the same way
-- 0001 reconciled the students/admins drift.
DO $$ BEGIN
	CREATE TYPE "public"."day_of_week" AS ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "navigation_edges" (
	"id" bigint PRIMARY KEY NOT NULL,
	"from_node" bigint NOT NULL,
	"to_node" bigint NOT NULL,
	"osmid" bigint,
	"highway" text,
	"lanes" text,
	"maxspeed" text,
	"name" text,
	"oneway" boolean,
	"ref" text,
	"reversed" boolean,
	"length" double precision NOT NULL,
	"weight" double precision,
	"geometry" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "navigation_nodes" (
	"id" bigint PRIMARY KEY NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"street_count" integer
);
--> statement-breakpoint
ALTER TABLE "timetable_buildings" ADD COLUMN IF NOT EXISTS "day_of_week" "day_of_week";--> statement-breakpoint
ALTER TABLE "timetable_buildings" ADD COLUMN IF NOT EXISTS "start_time" time;