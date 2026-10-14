"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { feedback } from "@/lib/feedback/schema";
import { FEEDBACK_STATUSES, type FeedbackStatus } from "@/lib/feedback/status";
import { requireAdmin } from "@/lib/auth/dal";

const feedbackIdSchema = z.uuid();
const statusSchema = z.enum(FEEDBACK_STATUSES);

export type UpdateFeedbackStatusResult = { error?: string };

export async function updateFeedbackStatus(
  feedbackId: string,
  status: FeedbackStatus,
): Promise<UpdateFeedbackStatusResult> {
  // Server actions can be called directly, so check here as well as on the page.
  await requireAdmin();

  if (!feedbackIdSchema.safeParse(feedbackId).success) {
    return { error: "Feedback not found." };
  }

  const parsedStatus = statusSchema.safeParse(status);
  if (!parsedStatus.success) {
    return { error: "Invalid feedback status." };
  }

  const updated = await db
    .update(feedback)
    .set({ status: parsedStatus.data, updatedAt: new Date() })
    .where(eq(feedback.id, feedbackId))
    .returning({ id: feedback.id });

  // The student may have deleted it since the page loaded.
  if (updated.length === 0) {
    return { error: "Feedback not found. It may have been deleted." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/feedback");
  return {};
}
