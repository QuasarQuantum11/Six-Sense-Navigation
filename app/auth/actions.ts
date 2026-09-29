"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { admins } from "@/lib/admins/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { isValidAdminInvite } from "@/lib/auth/admin-invite";
import {
  assertSessionConfigured,
  createSession,
  deleteSession,
  getSession,
} from "@/lib/auth/session";
import {
  type AuthActionState,
  adminSignupSchema,
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

    const [student] = await db
      .insert(students)
      .values({
        username,
        email,
        passwordHash: await hashPassword(password),
        walkingSpeed,
      })
      .onConflictDoNothing()
      .returning({ id: students.id, username: students.username });

    if (!student) {
      return { message: "That username or email is already registered." };
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

export async function adminSignup(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const result = adminSignupSchema.safeParse({
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
    inviteCode: formData.get("inviteCode"),
  });

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors };
  }

  const { username, email, password, inviteCode } = result.data;
  if (!isValidAdminInvite(inviteCode)) {
    return { errors: { inviteCode: ["Invalid invitation code."] } };
  }

  try {
    assertSessionConfigured();

    const [admin] = await db
      .insert(admins)
      .values({ username, email, passwordHash: await hashPassword(password) })
      .onConflictDoNothing()
      .returning({ id: admins.id, username: admins.username });

    if (!admin) {
      return { message: "That username or email is already registered." };
    }

    await createSession({
      userId: admin.id,
      username: admin.username,
      role: "admin",
    });
  } catch (error) {
    console.error("Admin sign-up failed", error);
    return { message: "Unable to create your account. Please try again." };
  }

  redirect("/admins/feedback");
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

  redirect(role === "admin" ? "/admins/feedback" : "/");
}

export async function logout(): Promise<void> {
  const session = await getSession();
  await deleteSession();
  redirect(session?.role === "admin" ? "/admin/login" : "/login");
}
