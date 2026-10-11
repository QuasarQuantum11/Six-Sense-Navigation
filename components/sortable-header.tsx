import Link from "next/link";
import {
  nextSort,
  sortHref,
  type SearchParams,
  type SortState,
} from "@/lib/table-sort";

function SortArrows({ direction }: { direction: "asc" | "desc" | null }) {
  return (
    <svg
      width="12"
      height="16"
      viewBox="0 0 12 16"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <path
        d="M6 2 10 7H2z"
        fill="currentColor"
        opacity={direction === "asc" ? 1 : 0.3}
      />
      <path
        d="M6 14 2 9h8z"
        fill="currentColor"
        opacity={direction === "desc" ? 1 : 0.3}
      />
    </svg>
  );
}

// A column header that sorts the table: ascending, then descending, then back to
// the default order. It is a plain link, so it works without JavaScript and is
// reachable and operable from the keyboard.
export function SortableHeader<K extends string>({
  label,
  sortKey,
  sort,
  path,
  params,
}: {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  path: string;
  params: SearchParams;
}) {
  const direction = sort?.key === sortKey ? sort.direction : null;
  const upcoming = nextSort(sort, sortKey);
  const action = upcoming
    ? `sort ${upcoming.direction === "asc" ? "ascending" : "descending"}`
    : "clear sorting";

  return (
    <th
      scope="col"
      aria-sort={
        direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"
      }
      className="px-4 py-3 font-semibold text-primary"
    >
      <Link
        href={sortHref(path, params, upcoming)}
        replace
        scroll={false}
        className="-mx-2 inline-flex items-center gap-1.5 rounded px-2 py-1 hover:bg-white"
      >
        {label}
        <SortArrows direction={direction} />
        <span className="sr-only">, activate to {action}</span>
      </Link>
    </th>
  );
}
