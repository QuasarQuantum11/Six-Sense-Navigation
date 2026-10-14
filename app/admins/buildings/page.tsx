import Link from "next/link";
import { asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { buildings, timetableBuildings } from "@/lib/timetables/schema";
import { requireAdmin } from "@/lib/auth/dal";
import { BackLink } from "@/components/back-link";
import { BuildingRowActions } from "@/components/buildings/building-row-actions";
import { SortableHeader } from "@/components/sortable-header";
import { Pagination } from "@/components/pagination";
import { TableSearch } from "@/components/table-search";
import { parseSearch, searchCondition } from "@/lib/table-search";
import { paginate, parsePage, parsePageSize } from "@/lib/pagination";
import { orderByFor, parseSort } from "@/lib/table-sort";

export const dynamic = "force-dynamic";

const PATH = "/admins/buildings";

// Buildings with no location sort last in either direction.
const sortColumns = {
  name: sql`lower(${buildings.name})`,
  latitude: sql`${buildings.latitude}`,
  longitude: sql`${buildings.longitude}`,
  timetableEntries: sql`count(${timetableBuildings.id})`,
  createdAt: sql`${buildings.createdAt}`,
};
const sortKeys = Object.keys(sortColumns) as (keyof typeof sortColumns)[];

function formatCoordinate(value: number | null) {
  return value === null ? null : value.toFixed(6);
}

export default async function BuildingsPage({
  searchParams,
}: PageProps<"/admins/buildings">) {
  await requireAdmin();

  const params = await searchParams;
  const sort = parseSort(params, sortKeys);

  // By default, buildings missing a location are listed first, since those still
  // need attention before they can appear in map search.
  const [totals] = await db
    .select({
      total: count(),
      located: count(
        sql`CASE WHEN ${buildings.latitude} IS NOT NULL AND ${buildings.longitude} IS NOT NULL THEN 1 END`,
      ),
    })
    .from(buildings);
  const query = parseSearch(params);
  const match = searchCondition(query, [buildings.name]);
  const [{ matching }] = await db
    .select({ matching: count() })
    .from(buildings)
    .where(match);
  const pageInfo = paginate(parsePage(params), parsePageSize(params), matching);

  const [pageBuildings, mergeTargets] = await Promise.all([
    db
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
      .where(match)
      .groupBy(buildings.id)
      .orderBy(
        ...orderByFor(sortColumns, sort, [
          sql`(${buildings.latitude} IS NULL OR ${buildings.longitude} IS NULL) DESC`,
          asc(buildings.name),
        ]),
      )
      .limit(pageInfo.pageSize)
      .offset(pageInfo.offset),
    // Merging can target any building, not just the ones on this page.
    db
      .select({
        id: buildings.id,
        name: buildings.name,
        latitude: buildings.latitude,
        longitude: buildings.longitude,
      })
      .from(buildings)
      .orderBy(asc(buildings.name)),
  ]);

  const header = (label: string, sortKey: (typeof sortKeys)[number]) => (
    <SortableHeader
      label={label}
      sortKey={sortKey}
      sort={sort}
      path={PATH}
      params={params}
    />
  );

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
          {totals.located} of {totals.total} buildings have a location.
          Buildings without one won&apos;t appear in map search.
        </p>

        <TableSearch
          path={PATH}
          params={params}
          query={query}
          label="Search buildings"
          hint="Searches the building name."
        />

        <div className="overflow-x-auto rounded-lg border-2 border-primary">
          <table className="w-full min-w-full text-left text-sm">
            <thead className="bg-panel">
              <tr>
                {header("Name", "name")}
                {header("Latitude", "latitude")}
                {header("Longitude", "longitude")}
                {header("Timetable entries", "timetableEntries")}
                {header("Created At", "createdAt")}
                <th className="px-4 py-3 font-semibold text-primary">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/20">
              {pageBuildings.map((building) => {
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
                    <td className="px-4 py-3">
                      <BuildingRowActions
                        building={building}
                        allBuildings={mergeTargets}
                      />
                    </td>
                  </tr>
                );
              })}
              {pageBuildings.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted">
                    {query ? `No buildings match “${query}”.` : "No buildings yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination path={PATH} params={params} info={pageInfo} totalItems={matching} />
      </main>
    </div>
  );
}
