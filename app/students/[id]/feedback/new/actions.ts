"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { feedback } from "@/lib/feedback/schema";

export async function submitFeedback(studentId: string, formData: FormData) {
  const message = formData.get("message");
  if (typeof message !== "string" || !message.trim()) {
    throw new Error("Feedback message cannot be empty.");
  }

  await db.insert(feedback).values({ studentId, message: message.trim() });

  revalidatePath(`/students/${studentId}/feedback`);
  redirect(`/students/${studentId}/feedback`);
}
