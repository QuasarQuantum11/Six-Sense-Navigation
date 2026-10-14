export type CrowdMode = "real" | "demo";
export type CrowdLevel = "low" | "medium" | "high" | "unknown";
export type CrowdBuilding = { id: string; name: string; latitude: number; longitude: number };
export type CrowdParticipant = { studentId: string; consentedAt: Date; expiresAt: Date };
export type CrowdClass = {
  studentId: string; buildingId: string; dayOfWeek: string | null;
  startTime: string | null; duration: string | null;
  classDates: string | null; campus: string | null;
};
export type CrowdBuildingEstimate = CrowdBuilding & {
  level: CrowdLevel; radiusMeters: number;
  reason: "sample_estimate" | "insufficient_data";
};
export type CrowdResponse = {
  mode: CrowdMode; modelVersion: string; timeZone: string;
  at: string; generatedAt: string; sourceLabel: string;
  notices: string[]; buildings: CrowdBuildingEstimate[];
};
