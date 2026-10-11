import { sql, type SQL } from "drizzle-orm";

export type SortDirection = "asc" | "desc";
export type SortState<K extends string = string> = {
  key: K;
  direction: SortDirection;
} | null;
export type SearchParams = Record<string, string | string[] | undefined>;

const SORT_PARAM = "sort";
const DIRECTION_PARAM = "dir";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Reads the sort from the URL. Anything that isn't an allowed column and a valid
 * direction is ignored, so a hand-edited URL falls back to the default order.
 */
export function parseSort<K extends string>(
  params: SearchParams,
  allowed: readonly K[],
): SortState<K> {
  const key = first(params[SORT_PARAM]);
  const direction = first(params[DIRECTION_PARAM]);

  if (!key || !(allowed as readonly string[]).includes(key)) return null;
  if (direction !== "asc" && direction !== "desc") return null;

  return { key: key as K, direction };
}

/** Header click cycle: ascending, then descending, then back to the default. */
export function nextSort<K extends string>(
  current: SortState<K>,
  key: K,
): SortState<K> {
  if (!current || current.key !== key) return { key, direction: "asc" };
  if (current.direction === "asc") return { key, direction: "desc" };
  return null;
}

/** Builds a link for the given sort, keeping every other query parameter (e.g. a search). */
export function sortHref(
  path: string,
  params: SearchParams,
  next: SortState,
): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (name === SORT_PARAM || name === DIRECTION_PARAM) continue;
    const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
    for (const item of values) query.append(name, item);
  }
  if (next) {
    query.set(SORT_PARAM, next.key);
    query.set(DIRECTION_PARAM, next.direction);
  }

  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
}

/**
 * ORDER BY terms for a sort. The chosen column goes first (empty values last in
 * either direction), then the page's default order breaks ties so rows with equal
 * values don't shuffle between requests.
 */
export function orderByFor<K extends string>(
  columns: Record<K, SQL>,
  sort: SortState<K>,
  defaultOrder: SQL[],
): SQL[] {
  if (!sort) return defaultOrder;
  // `direction` is one of two validated literals, so inlining it is safe.
  const primary = sql`${columns[sort.key]} ${sql.raw(sort.direction)} NULLS LAST`;
  return [primary, ...defaultOrder];
}
