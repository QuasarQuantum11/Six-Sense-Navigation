"use server";

import { eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { students } from "@/lib/students/schema";
import { hashPassword } from "@/lib/auth/password";
import { verifySession } from "@/lib/auth/dal";
import { walkingSpeedSchema } from "@/lib/auth/validation";
import type { WalkingSpeed } from "@/lib/navigation/walking";

export async function updateProfile(
  username: string,
  email: string,
  walkingSpeed: WalkingSpeed,
  password?: string,
) {
  const session = await verifySession();

  if (session.role !== "student") {
    throw new Error("Only student profiles can be edited.");
  }

  // Server actions can be called directly, so don't trust the form's value.
  const parsedWalkingSpeed = walkingSpeedSchema.safeParse(walkingSpeed);
  if (!parsedWalkingSpeed.success) {
    throw new Error("Choose a valid walking speed.");
  }

  const trimmedUsername = username.trim();
  const trimmedEmail = email.trim().toLowerCase();

  if (!trimmedUsername || !trimmedEmail) {
    throw new Error("Username and email cannot be empty.");
  }

  const existing = await db
    .select({ id: students.id })
    .from(students)
    .where(
      or(
        eq(students.username, trimmedUsername),
        eq(students.email, trimmedEmail),
      ),
    )
    .limit(1);

  if (existing.length > 0 && existing[0].id !== session.userId) {
    throw new Error("That username or email is already in use.");
  }

  const values: {
    username: string;
    email: string;
    walkingSpeed: WalkingSpeed;
    updatedAt: Date;
    passwordHash?: string;
  } = {
    username: trimmedUsername,
    email: trimmedEmail,
    walkingSpeed: parsedWalkingSpeed.data,
    updatedAt: new Date(),
  };

  if (password?.trim()) {
    values.passwordHash = await hashPassword(password.trim());
  }

  await db
    .update(students)
    .set(values)
    .where(eq(students.id, session.userId));

  revalidatePath("/profile");
}
