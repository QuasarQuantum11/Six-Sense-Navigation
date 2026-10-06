"use server";

import { and, eq, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { students } from "@/lib/students/schema";
import { hashPassword } from "@/lib/auth/password";
import { verifySession } from "@/lib/auth/dal";
import { profileUpdateSchema } from "@/lib/auth/validation";
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
  const parsed = profileUpdateSchema.safeParse({ username, email, walkingSpeed, password });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message);
  }

  const input = parsed.data;

  const existing = await db
    .select({ id: students.id })
    .from(students)
    .where(
      and(
        ne(students.id, session.userId),
        or(
          eq(students.username, input.username),
          eq(students.email, input.email),
        ),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error("That username or email is already in use.");
  }

  const values: {
    username: string;
    email: string;
    walkingSpeed: WalkingSpeed;
    updatedAt: Date;
    passwordHash?: string;
  } = {
    username: input.username,
    email: input.email,
    walkingSpeed: input.walkingSpeed,
    updatedAt: new Date(),
  };

  if (input.password) {
    values.passwordHash = await hashPassword(input.password);
  }

  await db
    .update(students)
    .set(values)
    .where(eq(students.id, session.userId));

  revalidatePath("/profile");
}
