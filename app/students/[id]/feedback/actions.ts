"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { feedback } from "@/lib/feedback/schema";
import { getSession } from "@/lib/auth/session";

export async function updateFeedback(feedbackId: string, message: string) {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error("Feedback message cannot be empty.");
  }

  const session = await getSession();
  if (!session) {
    throw new Error("You must be signed in to edit feedback.");
  }

  const existing = await db.query.feedback.findFirst({
    where: eq(feedback.id, feedbackId),
  });

  if (!existing) {
    throw new Error("Feedback not found.");
  }

  if (session.role !== "admin" && session.userId !== existing.studentId) {
    throw new Error("You are not allowed to edit this feedback.");
  }

  await db
    .update(feedback)
    .set({ message: trimmed, updatedAt: new Date() })
    .where(eq(feedback.id, feedbackId));

  if (existing.studentId) {
    revalidatePath(`/students/${existing.studentId}/feedback`);
  }
}
