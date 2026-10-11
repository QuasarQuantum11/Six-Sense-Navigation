import { ilike, or, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import type { SearchParams } from "@/lib/table-sort";

export const SEARCH_PARAM = "q";
export const MAX_SEARCH_LENGTH = 100;

/** The search text from the URL, trimmed and length-limited; null when empty. */
export function parseSearch(params: SearchParams): string | null {
  const raw = params[SEARCH_PARAM];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, MAX_SEARCH_LENGTH);
  return value ? value : null;
}

/** Escapes LIKE wildcards so "50%" or "a_b" is matched literally rather than as a pattern. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => "\\" + char);
}

/**
 * A case-insensitive "contains" match of `term` against any of `columns`
 * (undefined when there is no term, which drizzle's and()/where() ignore).
 * The term is always sent as a bound parameter, never spliced into the SQL.
 */
export function searchCondition(
  term: string | null,
  columns: SQLWrapper[],
): SQL | undefined {
  if (!term) return undefined;
  const pattern = `%${escapeLike(term)}%`;
  // Wrapping in sql`` lets plain columns and expressions (like id::text) be treated alike.
  return or(...columns.map((column) => ilike(sql`${column}`, pattern)));
}
