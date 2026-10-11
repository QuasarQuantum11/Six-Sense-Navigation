import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SIZE, pageHref, pageItems, paginate, parsePage, parsePageSize } from "../pagination";
import { sortHref } from "../table-sort";

describe("parsePageSize / parsePage", () => {
  it("only accepts the offered page sizes", () => {
    for (const size of [5, 10, 20, 50]) expect(parsePageSize({ pageSize: String(size) })).toBe(size);
    expect(parsePageSize({ pageSize: "7" })).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePageSize({ pageSize: "abc" })).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePageSize({})).toBe(DEFAULT_PAGE_SIZE);
  });

  it("falls back to page 1 for anything that isn't a positive whole number", () => {
    expect(parsePage({ page: "3" })).toBe(3);
    for (const bad of ["0", "-2", "1.5", "x", ""]) expect(parsePage({ page: bad })).toBe(1);
    expect(parsePage({})).toBe(1);
  });
});

describe("paginate", () => {
  it("computes the range for a middle and the last page", () => {
    expect(paginate(2, 10, 25)).toMatchObject({ page: 2, totalPages: 3, offset: 10, from: 11, to: 20 });
    expect(paginate(3, 10, 25)).toMatchObject({ page: 3, offset: 20, from: 21, to: 25 });
  });

  it("clamps a page that is past the end", () => {
    expect(paginate(99, 10, 25).page).toBe(3);
  });

  it("handles an empty table", () => {
    expect(paginate(1, 10, 0)).toMatchObject({ page: 1, totalPages: 1, offset: 0, from: 0, to: 0 });
  });
});

describe("pageItems", () => {
  it("lists every page when there are few", () => {
    expect(pageItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("collapses the middle of a long range", () => {
    expect(pageItems(1, 20)).toEqual([1, 2, 3, 4, "gap", 20]);
    expect(pageItems(10, 20)).toEqual([1, "gap", 9, 10, 11, "gap", 20]);
    expect(pageItems(20, 20)).toEqual([1, "gap", 17, 18, 19, 20]);
  });
});

describe("pageHref", () => {
  it("omits default values and keeps other parameters", () => {
    expect(pageHref("/x", { sort: "name", dir: "asc" }, { page: 1, pageSize: 10 })).toBe("/x?sort=name&dir=asc");
    expect(pageHref("/x", { status: "new", page: "4" }, { page: 2, pageSize: 20 })).toBe("/x?status=new&pageSize=20&page=2");
  });
});

describe("changing the sort", () => {
  it("returns to the first page but keeps the page size", () => {
    expect(sortHref("/x", { page: "3", pageSize: "20" }, { key: "name", direction: "asc" })).toBe(
      "/x?pageSize=20&sort=name&dir=asc",
    );
  });
});
