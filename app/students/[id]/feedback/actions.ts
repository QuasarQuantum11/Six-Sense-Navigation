"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { feedback } from "@/lib/feedback/schema";
import { getSession } from "@/lib/auth/session";

async function authorizeFeedbackAccess(feedbackId: string) {
  const session = await getSession();
  if (!session) {
    throw new Error("You must be signed in to do this.");
  }

  const existing = await db.query.feedback.findFirst({
    where: eq(feedback.id, feedbackId),
  });

  if (!existing) {
    throw new Error("Feedback not found.");
  }

  if (session.role !== "admin" && session.userId !== existing.studentId) {
    throw new Error("You are not allowed to modify this feedback.");
  }

  return existing;
}

export async function updateFeedback(feedbackId: string, message: string) {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error("Feedback message cannot be empty.");
  }

  const existing = await authorizeFeedbackAccess(feedbackId);

  await db
    .update(feedback)
    .set({ message: trimmed, updatedAt: new Date() })
    .where(eq(feedback.id, feedbackId));

  if (existing.studentId) {
    revalidatePath(`/students/${existing.studentId}/feedback`);
  }
}

export async function deleteFeedback(feedbackId: string) {
  const existing = await authorizeFeedbackAccess(feedbackId);

  await db.delete(feedback).where(eq(feedback.id, feedbackId));

  if (existing.studentId) {
    revalidatePath(`/students/${existing.studentId}/feedback`);
  }
}
