// A building as returned by GET /api/buildings (only located buildings).
export type BuildingLocation = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

function normalise(text: string) {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

// Returns buildings whose name contains the query exactly (ignoring case and
// extra spaces). Names that start with the query come first; otherwise the
// input order (alphabetical from the API) is kept. A blank query returns all.
export function searchBuildings<T extends { name: string }>(
  buildings: T[],
  query: string,
): T[] {
  const needle = normalise(query);
  if (!needle) return buildings;

  const startsWith: T[] = [];
  const contains: T[] = [];
  for (const building of buildings) {
    const name = normalise(building.name);
    if (name.startsWith(needle)) startsWith.push(building);
    else if (name.includes(needle)) contains.push(building);
  }
  return [...startsWith, ...contains];
}
