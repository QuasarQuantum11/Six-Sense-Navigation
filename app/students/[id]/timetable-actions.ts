"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import {
  buildings,
  dayOfWeek,
  timetableBuildings,
  timetables,
} from "@/lib/timetables/schema";
import { requireStudentOrAdmin } from "@/lib/auth/dal";

export type TimetableEntryInput = {
  day: string;
  time: string;
  location: string;
};

const validDays = new Set<string>(dayOfWeek.enumValues);

export async function saveTimetable(
  studentId: string,
  name: string,
  entries: TimetableEntryInput[],
) {
  await requireStudentOrAdmin(studentId);

  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Timetable name cannot be empty.");
  }

  const validEntries = entries
    .map((entry) => ({
      day: entry.day,
      time: entry.time,
      location: entry.location.trim(),
    }))
    .filter(
      (entry) =>
        validDays.has(entry.day) && entry.time && entry.location.length > 0,
    );

  if (validEntries.length === 0) {
    throw new Error("Please add at least one class before saving.");
  }

  await db.transaction(async (tx) => {
    const [timetable] = await tx
      .insert(timetables)
      .values({ studentId, name: trimmedName })
      .returning();

    for (let index = 0; index < validEntries.length; index += 1) {
      const entry = validEntries[index];

      await tx
        .insert(buildings)
        .values({ name: entry.location })
        .onConflictDoNothing({ target: buildings.name });

      const building = await tx.query.buildings.findFirst({
        where: eq(buildings.name, entry.location),
      });

      if (!building) {
        throw new Error(`Could not resolve building "${entry.location}".`);
      }

      await tx.insert(timetableBuildings).values({
        timetableId: timetable.id,
        buildingId: building.id,
        position: index + 1,
        dayOfWeek: entry.day as (typeof dayOfWeek.enumValues)[number],
        startTime: entry.time,
      });
    }
  });

  revalidatePath(`/students/${studentId}`);
}

export async function deleteTimetable(studentId: string, timetableId: string) {
  await requireStudentOrAdmin(studentId);

  const existing = await db.query.timetables.findFirst({
    where: eq(timetables.id, timetableId),
  });

  if (!existing || existing.studentId !== studentId) {
    throw new Error("Timetable not found.");
  }

  await db.delete(timetables).where(eq(timetables.id, timetableId));

  revalidatePath(`/students/${studentId}`);
}
