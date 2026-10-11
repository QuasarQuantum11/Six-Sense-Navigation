import Form from "next/form";
import Link from "next/link";
import { useId } from "react";
import { MAX_SEARCH_LENGTH, SEARCH_PARAM } from "@/lib/table-search";
import { PAGE_PARAM, carriedParams, type SearchParams } from "@/lib/table-sort";

// A search box for a table. It is a GET form, so it works without JavaScript and
// keeps the current sort, filter and page size; a new search starts from page 1.
export function TableSearch({
  path,
  params,
  query,
  label,
  hint,
}: {
  path: string;
  params: SearchParams;
  /** The search currently applied, if any. */
  query: string | null;
  /** Accessible name, e.g. "Search students". */
  label: string;
  /** Which fields are searched, e.g. "Searches username, email and ID." */
  hint: string;
}) {
  const inputId = useId();
  const hintId = useId();
  const carried = carriedParams(params, [SEARCH_PARAM, PAGE_PARAM]);

  const clearQuery = new URLSearchParams(carried).toString();
  const clearHref = clearQuery ? `${path}?${clearQuery}` : path;

  return (
    <Form action={path} role="search" className="flex flex-col gap-1">
      {carried.map(([name, value], index) => (
        <input key={`${name}-${index}`} type="hidden" name={name} value={value} />
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={inputId} className="sr-only">
          {label}
        </label>
        <input
          // Remounts when the applied search changes (e.g. after Clear) so the box updates.
          key={query ?? ""}
          id={inputId}
          type="search"
          name={SEARCH_PARAM}
          defaultValue={query ?? ""}
          maxLength={MAX_SEARCH_LENGTH}
          placeholder="Search…"
          aria-describedby={hintId}
          className="w-full min-w-0 rounded-md border-2 border-primary bg-white px-3 py-2 text-sm text-foreground sm:w-80"
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          Search
        </button>
        {query && (
          <Link
            href={clearHref}
            replace
            className="ml-3 text-sm font-semibold text-accent hover:text-accent-dark"
          >
            Clear search
          </Link>
        )}
      </div>
      <p id={hintId} className="text-xs text-muted">
        {hint}
      </p>
    </Form>
  );
}
