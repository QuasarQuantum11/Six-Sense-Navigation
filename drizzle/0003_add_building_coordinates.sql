-- Building coordinates were previously added by hand on some branches and
-- later lost, so IF NOT EXISTS keeps this safe wherever they already exist.
ALTER TABLE "buildings" ADD COLUMN IF NOT EXISTS "latitude" double precision;--> statement-breakpoint
ALTER TABLE "buildings" ADD COLUMN IF NOT EXISTS "longitude" double precision;
