import { PgDialect } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { nextSort, orderByFor, parseSort, sortHref } from "../table-sort";

const KEYS = ["name", "created"] as const;

describe("parseSort", () => {
  it("accepts an allowed column with a valid direction", () => {
    expect(parseSort({ sort: "name", dir: "desc" }, KEYS)).toEqual({ key: "name", direction: "desc" });
  });

  it("ignores unknown columns, bad directions and missing values", () => {
    expect(parseSort({ sort: "password", dir: "asc" }, KEYS)).toBeNull();
    expect(parseSort({ sort: "name", dir: "sideways" }, KEYS)).toBeNull();
    expect(parseSort({ sort: "name" }, KEYS)).toBeNull();
    expect(parseSort({}, KEYS)).toBeNull();
  });

  it("uses the first value when a parameter is repeated", () => {
    expect(parseSort({ sort: ["created", "name"], dir: ["asc"] }, KEYS)).toEqual({ key: "created", direction: "asc" });
  });
});

describe("nextSort", () => {
  it("cycles ascending, descending, then back to the default", () => {
    const asc = nextSort(null, "name");
    expect(asc).toEqual({ key: "name", direction: "asc" });
    const desc = nextSort(asc, "name");
    expect(desc).toEqual({ key: "name", direction: "desc" });
    expect(nextSort(desc, "name")).toBeNull();
  });

  it("starts ascending when a different column is clicked", () => {
    expect(nextSort({ key: "name", direction: "desc" }, "created")).toEqual({ key: "created", direction: "asc" });
  });
});

describe("sortHref", () => {
  it("sets the sort and keeps other parameters", () => {
    expect(sortHref("/admin/feedback", { q: "ramp", sort: "old", dir: "asc" }, { key: "status", direction: "desc" })).toBe(
      "/admin/feedback?q=ramp&sort=status&dir=desc",
    );
  });

  it("drops the sort parameters when cleared, leaving a clean path", () => {
    expect(sortHref("/admin/feedback", { sort: "status", dir: "desc" }, null)).toBe("/admin/feedback");
    expect(sortHref("/admin/feedback", { q: ["a", "b"] }, null)).toBe("/admin/feedback?q=a&q=b");
  });
});

describe("orderByFor", () => {
  const dialect = new PgDialect();
  const columns = { name: sql`lower(name)`, created: sql`created_at` };
  const render = (terms: ReturnType<typeof orderByFor>) => terms.map((t) => dialect.sqlToQuery(t).sql);

  it("returns the default order when nothing is sorted", () => {
    expect(render(orderByFor(columns, null, [sql`created_at desc`]))).toEqual(["created_at desc"]);
  });

  it("puts the chosen column first, empty values last, then the default as a tiebreaker", () => {
    expect(render(orderByFor(columns, { key: "name", direction: "desc" }, [sql`created_at desc`]))).toEqual([
      "lower(name) desc NULLS LAST",
      "created_at desc",
    ]);
  });
});
