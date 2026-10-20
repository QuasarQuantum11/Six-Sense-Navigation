import mappedBuildings from "@/api/buildings.json";

export type ScheduledClass = {
  position: number;
  buildingName: string;
  dayOfWeek: string | null;
  startTime: string | null;
  classDates: string | null;
  subjectCode: string | null;
  room: string | null;
};

export function classBuilding(name: string) {
  const normalise = (value: string) => value.toLowerCase().replace(/\s*\(ltb\)/g, "").trim();
  return mappedBuildings.find(building => normalise(building.name) === normalise(name)) ?? null;
}
