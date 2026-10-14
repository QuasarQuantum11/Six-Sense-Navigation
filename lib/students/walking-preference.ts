import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { students } from "@/lib/students/schema";
import type { WalkingSpeed } from "@/lib/navigation/walking";

export type WalkingPreference = {
  walkingSpeed: WalkingSpeed;
  personalised: boolean;
};

export async function getWalkingPreference(): Promise<WalkingPreference> {
  const session = await getSession();
  if (session?.role !== "student") {
    return { walkingSpeed: "normal", personalised: false };
  }

  const student = await db.query.students.findFirst({
    where: eq(students.id, session.userId),
    columns: { walkingSpeed: true },
  });

  return student
    ? { walkingSpeed: student.walkingSpeed, personalised: true }
    : { walkingSpeed: "normal", personalised: false };
}