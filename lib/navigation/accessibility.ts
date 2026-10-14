export type WheelchairEdge = {
  highway?: string | null;
  wheelchairAccessible?: boolean | null;
  hasSteps?: boolean | null;
};

const roadHighways = new Set([
  "motorway",
  "motorway_link",
  "trunk",
  "trunk_link",
  "primary",
  "primary_link",
  "secondary",
  "secondary_link",
  "tertiary",
  "tertiary_link",
  "residential",
  "service",
  "unclassified",
  "road",
]);

export function isRoadHighway(highway?: string | null): boolean {
  if (!highway) {
    return false;
  }

  const normalized = highway.toLowerCase();
  return roadHighways.has(normalized) || normalized.includes("road");
}

export function isWheelchairAccessibleEdge(
  edge: WheelchairEdge | null | undefined,
): boolean {
  if (!edge) {
    return false;
  }

  if (edge.wheelchairAccessible === false) {
    return false;
  }

  if (edge.hasSteps) {
    return false;
  }

  if (isRoadHighway(edge.highway)) {
    return false;
  }

  return true;
}

export function getWheelchairRouteCost(
  edge: WheelchairEdge | null | undefined,
  baseDistance: number,
): number {
  if (!isWheelchairAccessibleEdge(edge)) {
    return Number.POSITIVE_INFINITY;
  }

  return baseDistance;
}
