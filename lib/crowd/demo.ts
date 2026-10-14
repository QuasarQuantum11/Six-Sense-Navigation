import campusBuildings from "@/api/buildings.json";
import { DEMO_DATE, localInstant, PARTICIPATION_MS } from "./time";
import type { CrowdBuilding, CrowdClass, CrowdParticipant } from "./types";

export const demoProvenance = {
  label: "AI-assisted fictional timetable scenario",
  scenarioDate: DEMO_DATE,
  purpose: "Test model behaviour and map presentation; not validate real campus crowd predictions.",
  generationMethod: "Prepared by Codex from a fixed scenario: 24 fictional students, 12 at LTB, 8 at Campus Centre and 4 at Menzies at 10:00 on Wednesday; 1 hour classes.",
  usesRealStudentRecords: false,
};

export function demoDataset() {
  const buildings: CrowdBuilding[] = campusBuildings.filter(b => ["ltb", "campus-centre", "menzies"].includes(b.id)).map(b => ({ ...b }));
  const participants: CrowdParticipant[] = [];
  const classes: CrowdClass[] = [];
  const start = localInstant(DEMO_DATE, "00:00").epochMilliseconds;
  for (const [buildingId, count] of [["ltb", 12], ["campus-centre", 8], ["menzies", 4]] as const) {
    for (let index = 1; index <= count; index++) {
      const studentId = `fictional-${buildingId}-${index}`;
      participants.push({ studentId, consentedAt: new Date(start), expiresAt: new Date(start + PARTICIPATION_MS) });
      classes.push({ studentId, buildingId, dayOfWeek: "Wednesday", startTime: "10:00", duration: "1 hr", classDates: "7/10/2026", campus: "CL" });
    }
  }
  return { buildings, participants, classes };
}
