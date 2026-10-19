-- Feedback still "new" after the review window is moved to "not_reviewed".
-- IF NOT EXISTS keeps this safe to re-run.
ALTER TYPE "public"."feedback_status" ADD VALUE IF NOT EXISTS 'not_reviewed' BEFORE 'in_review';
