import Link from "next/link";
import { asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { buildings, timetableBuildings } from "@/lib/timetables/schema";
import { requireAdmin } from "@/lib/auth/dal";
import { BackLink } from "@/components/back-link";

export const dynamic = "force-dynamic";

function formatCoordinate(value: number | null) {
  return value === null ? null : value.toFixed(6);
}

export default async function BuildingsPage() {
  await requireAdmin();

  // Buildings missing a location are listed first, since those still need
  // attention before they can appear in map search.
  const allBuildings = await db
    .select({
      id: buildings.id,
      name: buildings.name,
      latitude: buildings.latitude,
      longitude: buildings.longitude,
      createdAt: buildings.createdAt,
      timetableEntries: count(timetableBuildings.id),
    })
    .from(buildings)
    .leftJoin(timetableBuildings, eq(timetableBuildings.buildingId, buildings.id))
    .groupBy(buildings.id)
    .orderBy(
      sql`(${buildings.latitude} IS NULL OR ${buildings.longitude} IS NULL) DESC`,
      asc(buildings.name),
    );

  const locatedCount = allBuildings.filter(
    (building) => building.latitude !== null && building.longitude !== null,
  ).length;

  return (
    <div className="flex flex-1 flex-col items-center bg-white">
      <main className="flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-16 sm:px-16">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Buildings</h1>
          <BackLink href="/">← Back home</BackLink>
        </div>

        <Link
          href="/admins/buildings/new"
          className="self-start rounded-md bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-dark"
        >
          Add building
        </Link>

        <p className="text-sm text-muted">
          {locatedCount} of {allBuildings.length} buildings have a location.
          Buildings without one won&apos;t appear in map search.
        </p>

        <div className="overflow-x-auto rounded-lg border-2 border-primary">
          <table className="w-full min-w-full text-left text-sm">
            <thead className="bg-panel">
              <tr>
                <th className="px-4 py-3 font-semibold text-primary">Name</th>
                <th className="px-4 py-3 font-semibold text-primary">
                  Latitude
                </th>
                <th className="px-4 py-3 font-semibold text-primary">
                  Longitude
                </th>
                <th className="px-4 py-3 font-semibold text-primary">
                  Timetable entries
                </th>
                <th className="px-4 py-3 font-semibold text-primary">
                  Created At
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/20">
              {allBuildings.map((building) => {
                const latitude = formatCoordinate(building.latitude);
                const longitude = formatCoordinate(building.longitude);

                return (
                  <tr key={building.id}>
                    <td className="px-4 py-3 font-semibold text-accent">
                      {building.name}
                    </td>
                    {latitude && longitude ? (
                      <>
                        <td className="px-4 py-3 font-mono text-xs text-muted">
                          {latitude}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted">
                          {longitude}{" "}
                          <a
                            href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=19/${latitude}/${longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-2 font-sans text-accent underline hover:text-accent-dark"
                          >
                            View
                            <span className="sr-only">
                              {" "}
                              {building.name} on OpenStreetMap (opens in a new
                              tab)
                            </span>
                          </a>
                        </td>
                      </>
                    ) : (
                      <td colSpan={2} className="px-4 py-3 italic text-muted">
                        Not set
                      </td>
                    )}
                    <td className="px-4 py-3 text-muted">
                      {building.timetableEntries}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {new Date(building.createdAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
              {allBuildings.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted">
                    No buildings yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
