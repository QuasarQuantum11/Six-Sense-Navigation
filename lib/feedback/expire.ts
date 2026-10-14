import "server-only";

import { and, eq, lt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { feedback } from "@/lib/feedback/schema";
import { RECENT_FEEDBACK_DAYS } from "@/lib/feedback/status";

// Moves feedback that has sat in "new" for longer than the recent window to
// "not_reviewed". Age is measured from updatedAt, so an admin who deliberately
// sets an item back to "new" gets a fresh window. updatedAt is left alone so the
// automatic change doesn't look like admin or student activity.
export async function expireStaleFeedback(now: Date = new Date()) {
  const cutoff = new Date(
    now.getTime() - RECENT_FEEDBACK_DAYS * 24 * 60 * 60 * 1000,
  );

  const expired = await db
    .update(feedback)
    .set({ status: "not_reviewed" })
    .where(and(eq(feedback.status, "new"), lt(feedback.updatedAt, cutoff)))
    .returning({ id: feedback.id });

  return expired.length;
}
