export type WheelchairEdge = {
  highway?: string | null;
  wheelchairAccessible?: boolean | null;
  hasSteps?: boolean | null;
  maxspeed?: string | null;
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

function highwayValues(highway?: string | null): string[] {
  return (highway?.toLowerCase().match(/[a-z_]+/g) ?? []);
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

  const highways = highwayValues(edge.highway);
  if (edge.hasSteps || highways.includes("steps")) {
    return false;
  }

  // These are route candidates, not a certification of surface, slope or kerbs.
  // Campus service links often connect footpaths and must not all be discarded.
  const speeds = edge.maxspeed?.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const speedKmh = speeds.map(speed => /mph/i.test(edge.maxspeed ?? "") ? speed * 1.609344 : speed);
  return highways.length > 0 && highways.every(highway => {
    if (["footway", "path", "pedestrian", "cycleway", "living_street"].includes(highway)) return true;
    if (highway === "service") return !speedKmh.some(speed => speed > 20);
    if (["residential", "unclassified", "road"].includes(highway)) return edge.wheelchairAccessible === true;
    return false;
  });
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
