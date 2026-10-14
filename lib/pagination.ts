import { PAGE_PARAM, carriedParams, type SearchParams } from "@/lib/table-sort";

export const PAGE_SIZES = [5, 10, 20, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 10;
export const PAGE_SIZE_PARAM = "pageSize";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Rows per page from the URL; anything that isn't one of the offered sizes uses the default. */
export function parsePageSize(params: SearchParams): PageSize {
  const size = Number(first(params[PAGE_SIZE_PARAM]));
  return (PAGE_SIZES as readonly number[]).includes(size)
    ? (size as PageSize)
    : DEFAULT_PAGE_SIZE;
}

/** The requested page number (1-based); invalid values mean the first page. */
export function parsePage(params: SearchParams): number {
  const page = Number(first(params[PAGE_PARAM]));
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export type PageInfo = {
  page: number;
  pageSize: PageSize;
  totalPages: number;
  offset: number;
  /** 1-based position of the first and last row on this page (0 when empty). */
  from: number;
  to: number;
};

/** Clamps the requested page to what exists, so a stale link shows the last page instead of nothing. */
export function paginate(
  requestedPage: number,
  pageSize: PageSize,
  totalItems: number,
): PageInfo {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const offset = (page - 1) * pageSize;
  return {
    page,
    pageSize,
    totalPages,
    offset,
    from: totalItems === 0 ? 0 : offset + 1,
    to: Math.min(offset + pageSize, totalItems),
  };
}

export type PageItem = number | "gap";

/** Page numbers to show: first, last and the neighbours of the current page, with gaps between. */
export function pageItems(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const wanted = new Set([1, totalPages, page - 1, page, page + 1]);
  // Near either end, show a longer run so the bar keeps a steady width.
  if (page <= 3) [2, 3, 4].forEach((n) => wanted.add(n));
  if (page >= totalPages - 2) [totalPages - 3, totalPages - 2, totalPages - 1].forEach((n) => wanted.add(n));

  const numbers = [...wanted].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const items: PageItem[] = [];
  numbers.forEach((n, index) => {
    if (index > 0 && n - numbers[index - 1] > 1) items.push("gap");
    items.push(n);
  });
  return items;
}

/** Link to a page, keeping the other query parameters (sort, filters, search). */
export function pageHref(
  path: string,
  params: SearchParams,
  target: { page: number; pageSize: PageSize },
): string {
  const query = new URLSearchParams(carriedParams(params, [PAGE_PARAM, PAGE_SIZE_PARAM]));
  if (target.pageSize !== DEFAULT_PAGE_SIZE) query.set(PAGE_SIZE_PARAM, String(target.pageSize));
  if (target.page > 1) query.set(PAGE_PARAM, String(target.page));
  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
}
