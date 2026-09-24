import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export const verifySession = cache(async () => {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return session;
});

export async function requireAdmin() {
  const session = await getSession();

  if (!session || session.role !== "admin") {
    redirect("/admin/login");
  }

  return session;
}

export async function requireStudentOrAdmin(studentId: string) {
  const session = await verifySession();

  if (session.role !== "admin" && session.userId !== studentId) {
    redirect("/");
  }

  return session;
}
