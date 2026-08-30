-- This migration reconciles schema changes that already exist in the shared
-- Neon database with a clean database created only from migration 0000.
DO $$ BEGIN
	CREATE TYPE "public"."feedback_status" AS ENUM('new', 'in_review', 'resolved', 'dismissed');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."walking_speed" AS ENUM('accessible', 'normal', 'fast');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admins_username_unique" UNIQUE("username")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid,
	"message" text NOT NULL,
	"status" "feedback_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "email" text;--> statement-breakpoint
UPDATE "students"
SET "email" = lower("username") || '@placeholder.six-sense.invalid'
WHERE "email" IS NULL;--> statement-breakpoint
ALTER TABLE "students" ALTER COLUMN "email" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "walking_speed" "walking_speed" DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "email" text;--> statement-breakpoint
UPDATE "admins"
SET "email" = lower("username") || '@placeholder.six-sense.invalid'
WHERE "email" IS NULL;--> statement-breakpoint
ALTER TABLE "admins" ALTER COLUMN "email" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "feedback" ADD CONSTRAINT "feedback_student_id_students_id_fk"
	FOREIGN KEY ("student_id") REFERENCES "public"."students"("id")
	ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "students" ADD CONSTRAINT "students_email_unique" UNIQUE("email");
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "admins" ADD CONSTRAINT "admins_email_unique" UNIQUE("email");
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
