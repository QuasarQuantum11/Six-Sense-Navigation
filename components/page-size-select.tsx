"use client";

import Form from "next/form";
import { useId } from "react";
import { PAGE_SIZES, PAGE_SIZE_PARAM, type PageSize } from "@/lib/pagination";

// Rows-per-page dropdown. A GET form, so changing it reloads the table with the
// new size (and back on page 1, because the page parameter isn't carried over).
// `carried` holds the other query parameters, e.g. the current sort or filter.
export function PageSizeSelect({
  path,
  pageSize,
  carried,
}: {
  path: string;
  pageSize: PageSize;
  carried: [string, string][];
}) {
  const id = useId();

  return (
    <Form action={path} className="flex items-center gap-2">
      {carried.map(([name, value], index) => (
        <input key={`${name}-${index}`} type="hidden" name={name} value={value} />
      ))}
      <label htmlFor={id} className="text-muted">
        Rows per page
      </label>
      <select
        id={id}
        name={PAGE_SIZE_PARAM}
        defaultValue={pageSize}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="rounded-md border-2 border-primary bg-white px-2 py-1 text-sm text-foreground"
      >
        {PAGE_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
      {/* Without JavaScript the dropdown can't submit itself. */}
      <noscript>
        <button type="submit" className="rounded-md bg-primary px-3 py-1 text-sm font-semibold text-white">
          Apply
        </button>
      </noscript>
    </Form>
  );
}
