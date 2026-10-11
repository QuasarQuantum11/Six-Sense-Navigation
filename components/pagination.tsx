import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { PageSizeSelect } from "@/components/page-size-select";
import {
  PAGE_SIZE_PARAM,
  pageHref,
  pageItems,
  type PageInfo,
} from "@/lib/pagination";
import { PAGE_PARAM, carriedParams, type SearchParams } from "@/lib/table-sort";

const buttonClass =
  "flex h-9 min-w-9 items-center justify-center rounded-md border-2 border-primary px-2 text-sm font-semibold";

// Bottom-of-table controls: the visible range, a rows-per-page dropdown, and
// previous / numbered / next page links. Everything lives in the URL, so it keeps
// working with sorting and filters (which restart from page 1 when changed).
export function Pagination({
  path,
  params,
  info,
  totalItems,
}: {
  path: string;
  params: SearchParams;
  info: PageInfo;
  totalItems: number;
}) {
  const { page, pageSize, totalPages } = info;
  const hrefFor = (target: number) => pageHref(path, params, { page: target, pageSize });

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm">
      <p className="text-muted">
        Showing {info.from}–{info.to} of {totalItems}
      </p>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <PageSizeSelect
          path={path}
          pageSize={pageSize}
          carried={carriedParams(params, [PAGE_PARAM, PAGE_SIZE_PARAM])}
        />

        <ul className="flex items-center gap-1">
          <li>
            {page > 1 ? (
              <Link href={hrefFor(page - 1)} replace scroll={false} className={`${buttonClass} bg-white text-primary hover:bg-panel`}>
                <ChevronLeftIcon size={16} />
                <span className="sr-only">Previous page</span>
              </Link>
            ) : (
              <span aria-disabled="true" className={`${buttonClass} cursor-not-allowed bg-white text-primary opacity-40`}>
                <ChevronLeftIcon size={16} />
                <span className="sr-only">Previous page</span>
              </span>
            )}
          </li>

          {pageItems(page, totalPages).map((item, index) =>
            item === "gap" ? (
              <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-muted">
                …
              </li>
            ) : (
              <li key={item}>
                <Link
                  href={hrefFor(item)}
                  replace
                  scroll={false}
                  aria-label={`Page ${item}`}
                  aria-current={item === page ? "page" : undefined}
                  className={`${buttonClass} ${
                    item === page ? "bg-primary text-white" : "bg-white text-primary hover:bg-panel"
                  }`}
                >
                  {item}
                </Link>
              </li>
            ),
          )}

          <li>
            {page < totalPages ? (
              <Link href={hrefFor(page + 1)} replace scroll={false} className={`${buttonClass} bg-white text-primary hover:bg-panel`}>
                <ChevronRightIcon size={16} />
                <span className="sr-only">Next page</span>
              </Link>
            ) : (
              <span aria-disabled="true" className={`${buttonClass} cursor-not-allowed bg-white text-primary opacity-40`}>
                <ChevronRightIcon size={16} />
                <span className="sr-only">Next page</span>
              </span>
            )}
          </li>
        </ul>
      </div>
    </nav>
  );
}
