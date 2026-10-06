import { and, asc, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { buildings } from "@/lib/timetables/schema";
import type { BuildingLocation } from "@/lib/buildings/search";

// Public (guest) endpoint for map search: only what's needed to find and pan
// to a building. Buildings without a location can't be shown on the map, so
// they're left out until an admin adds one.
export async function GET() {
  try {
    const locatedBuildings = await db
      .select({
        id: buildings.id,
        name: buildings.name,
        latitude: buildings.latitude,
        longitude: buildings.longitude,
      })
      .from(buildings)
      .where(and(isNotNull(buildings.latitude), isNotNull(buildings.longitude)))
      .orderBy(asc(buildings.name));

    // The WHERE clause guarantees both coordinates are set.
    return Response.json({
      buildings: locatedBuildings as BuildingLocation[],
    });
  } catch {
    console.error("Failed to load buildings:");
    return Response.json(
      { error: "Buildings could not be loaded." },
      { status: 500 },
    );
  }
}
