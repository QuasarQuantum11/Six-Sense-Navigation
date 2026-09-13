CREATE TYPE "public"."walking_speed" AS ENUM('accessible', 'normal', 'fast');--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admins_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "walking_speed" "walking_speed" DEFAULT 'normal' NOT NULL;