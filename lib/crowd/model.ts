import { Temporal } from "@js-temporal/polyfill";
import { campusBounds } from "@/lib/buildings/validation";
import { classOccursOn, CROWD_TIME_ZONE, durationMinutes } from "./time";
import type { CrowdBuilding, CrowdClass, CrowdParticipant, CrowdResponse, CrowdMode } from "./types";

export const MODEL_VERSION = "timetable-activity-v1";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const peak = (differenceMinutes: number) => Math.max(0, 1 - Math.abs(differenceMinutes) / 15);

export function estimateCrowd(input: {
  mode: CrowdMode; at: Temporal.Instant; now: Date;
  buildings: CrowdBuilding[]; participants: CrowdParticipant[]; classes: CrowdClass[];
}): CrowdResponse {
  const { mode, at, now } = input;
  const evaluationNow = mode === "demo" ? at.epochMilliseconds : now.getTime();
  const members = new Set(input.participants.filter(p =>
    p.consentedAt.getTime() <= evaluationNow && p.expiresAt.getTime() > evaluationNow &&
    p.expiresAt.getTime() > at.epochMilliseconds,
  ).map(p => p.studentId));
  const buildings = input.buildings.filter(b => Number.isFinite(b.latitude) && Number.isFinite(b.longitude) &&
    b.latitude >= campusBounds.south && b.latitude <= campusBounds.north &&
    b.longitude >= campusBounds.west && b.longitude <= campusBounds.east);
  const located = new Set(buildings.map(b => b.id));
  const activities = new Map<string, Map<string, number>>();
  let invalidSchedule = false; let missingDeparture = false;
  const targetDay = at.toZonedDateTimeISO(CROWD_TIME_ZONE).toPlainDate();

  for (const row of input.classes) {
    if (!members.has(row.studentId) || !located.has(row.buildingId)) continue;
    if (row.campus?.trim() && !["cl", "clayton"].includes(row.campus.trim().toLowerCase())) continue;
    if (!row.dayOfWeek || !DAYS.includes(row.dayOfWeek) || !row.startTime || !/^\d{2}:\d{2}(?::00)?$/.test(row.startTime)) {
      invalidSchedule = true; continue;
    }
    const duration = durationMinutes(row.duration);
    if (duration === null) missingDeparture = true;
    let score = 0;
    // Neighbour days cover arrival before midnight and departures on the next day.
    for (const offset of [-1, 0, 1]) {
      const day = targetDay.add({ days: offset });
      if (DAYS[day.dayOfWeek - 1] !== row.dayOfWeek) continue;
      const occurs = classOccursOn(row.classDates, day);
      if (occurs === null) { invalidSchedule = true; continue; }
      if (!occurs) continue;
      try {
        const clock = Temporal.PlainTime.from(row.startTime, { overflow: "reject" });
        const start = day.toPlainDateTime(clock).toZonedDateTime(CROWD_TIME_ZONE, { disambiguation: "reject" }).toInstant();
        const minutes = (at.epochMilliseconds - start.epochMilliseconds) / 60_000;
        score = Math.max(score, peak(minutes), duration === null ? 0 : peak(minutes - duration));
      } catch { invalidSchedule = true; }
    }
    if (score > 0) {
      const contributors = activities.get(row.buildingId) ?? new Map<string, number>();
      contributors.set(row.studentId, Math.max(contributors.get(row.studentId) ?? 0, score));
      activities.set(row.buildingId, contributors);
    }
  }
  const notices = ["This models sample activity, not live counts or people per square metre. Grades and the 100 m display circles are provisional assumptions."];
  if (mode === "demo") notices.unshift("SIMULATED DATA: AI-assisted fictional timetables. No real student data is used.");
  if (members.size < 5) notices.push("Insufficient participating data to estimate crowd levels.");
  if (invalidSchedule) notices.push("Some invalid or unrecognised schedule fields were excluded.");
  if (missingDeparture) notices.push("Classes without a valid duration contribute arrival activity only.");
  return {
    mode, modelVersion: MODEL_VERSION, timeZone: CROWD_TIME_ZONE, at: at.toString(), generatedAt: now.toISOString(),
    sourceLabel: mode === "demo" ? "AI-assisted simulated timetables" : "Voluntarily shared timetable samples",
    notices,
    buildings: buildings.map(building => {
      const contributors = activities.get(building.id) ?? new Map<string, number>();
      const score = [...contributors.values()].reduce((total, value) => total + value, 0);
      const enough = members.size >= 5 && contributors.size >= 3;
      return { ...building, radiusMeters: 100, level: !enough ? "unknown" : score < 5 ? "low" : score < 10 ? "medium" : "high", reason: enough ? "sample_estimate" : "insufficient_data" };
    }),
  };
}
