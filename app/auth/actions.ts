"use server";

import { eq, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { admins } from "@/lib/admins/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  assertSessionConfigured,
  createSession,
  deleteSession,
} from "@/lib/auth/session";
import {
  type AuthActionState,
  loginSchema,
  signupSchema,
} from "@/lib/auth/validation";
import { db } from "@/lib/db/client";
import { students } from "@/lib/students/schema";

export async function signup(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const result = signupSchema.safeParse({
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
    walkingSpeed: formData.get("walkingSpeed"),
  });

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors };
  }

  const { username, email, password, walkingSpeed } = result.data;

  try {
    assertSessionConfigured();

    const existing = await db
      .select({ id: students.id })
      .from(students)
      .where(or(eq(students.username, username), eq(students.email, email)))
      .limit(1);

    if (existing.length > 0) {
      return { message: "That username or email is already registered." };
    }

    const [student] = await db
      .insert(students)
      .values({
        username,
        email,
        passwordHash: await hashPassword(password),
        walkingSpeed,
      })
      .returning({ id: students.id, username: students.username });

    if (!student) {
      return { message: "Unable to create your account. Please try again." };
    }

    await createSession({
      userId: student.id,
      username: student.username,
      role: "student",
    });
  } catch (error) {
    console.error("Sign-up failed", error);
    return { message: "Unable to create your account. Please try again." };
  }

  redirect("/");
}

export async function login(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const result = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors };
  }

  const { email, password, role } = result.data;

  try {
    assertSessionConfigured();

    const account =
      role === "admin"
        ? await db.query.admins.findFirst({ where: eq(admins.email, email) })
        : await db.query.students.findFirst({ where: eq(students.email, email) });

    if (!account || !(await verifyPassword(password, account.passwordHash))) {
      return { message: "Invalid email, password or account type." };
    }

    await createSession({
      userId: account.id,
      username: account.username,
      role,
    });
  } catch (error) {
    console.error("Login failed", error);
    return { message: "Unable to log in right now. Please try again." };
  }

  redirect(role === "admin" ? "/admins" : "/");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
