import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { buildings, timetableBuildings, timetables } from "@/lib/timetables/schema";
import { crowdParticipation } from "./schema";
import type { CrowdBuilding, CrowdClass } from "./types";

export function isMissingCrowdTable(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    if ("code" in current && current.code === "42P01") return true;
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

export async function readRealCrowdData(now: Date, at: Date) {
  // One read-only snapshot prevents consent changes between membership and class queries.
  return db.transaction(async tx => {
    const participants = await tx.select({ studentId: crowdParticipation.studentId, consentedAt: crowdParticipation.consentedAt, expiresAt: crowdParticipation.expiresAt }).from(crowdParticipation)
      .innerJoin(timetables, and(eq(crowdParticipation.timetableId, timetables.id), eq(crowdParticipation.studentId, timetables.studentId)))
      .where(and(gt(crowdParticipation.expiresAt, now), gt(crowdParticipation.expiresAt, at)));
    const rows = await tx.select({
      studentId: crowdParticipation.studentId, buildingId: timetableBuildings.buildingId,
      dayOfWeek: timetableBuildings.dayOfWeek, startTime: timetableBuildings.startTime,
      duration: timetableBuildings.duration, classDates: timetableBuildings.classDates, campus: timetableBuildings.campus,
    }).from(crowdParticipation)
      .innerJoin(timetables, and(eq(crowdParticipation.timetableId, timetables.id), eq(crowdParticipation.studentId, timetables.studentId)))
      .innerJoin(timetableBuildings, eq(timetableBuildings.timetableId, crowdParticipation.timetableId))
      .where(and(gt(crowdParticipation.expiresAt, now), gt(crowdParticipation.expiresAt, at)));
    const places = await tx.select({ id: buildings.id, name: buildings.name, latitude: buildings.latitude, longitude: buildings.longitude }).from(buildings);
    return {
      participants,
      classes: rows as CrowdClass[],
      buildings: places.filter((place): place is CrowdBuilding => place.latitude !== null && place.longitude !== null),
    };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export type ParticipationStatus = {
  available: boolean; timetableId: string | null; expiresAt: string | null; checkedAt?: string; message?: string;
};

export async function readParticipation(studentId: string): Promise<ParticipationStatus> {
  try {
    const [record] = await db.select().from(crowdParticipation).where(eq(crowdParticipation.studentId, studentId));
    return { available: true, timetableId: record?.timetableId ?? null, expiresAt: record?.expiresAt.toISOString() ?? null, checkedAt: new Date().toISOString() };
  } catch (error) {
    return { available: false, timetableId: null, expiresAt: null,
      message: isMissingCrowdTable(error) ? "Crowd participation is not set up on this deployment yet. Your saved timetables are unchanged." : "Crowd participation is temporarily unavailable. Please try again." };
  }
}
