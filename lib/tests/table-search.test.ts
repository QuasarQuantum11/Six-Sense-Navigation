import { PgDialect } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { escapeLike, parseSearch, searchCondition } from "../table-search";

describe("parseSearch", () => {
  it("trims the text and treats blank input as no search", () => {
    expect(parseSearch({ q: "  dana  " })).toBe("dana");
    expect(parseSearch({ q: "   " })).toBeNull();
    expect(parseSearch({ q: "" })).toBeNull();
    expect(parseSearch({})).toBeNull();
  });

  it("uses the first value and caps the length", () => {
    expect(parseSearch({ q: ["a", "b"] })).toBe("a");
    expect(parseSearch({ q: "x".repeat(500) })).toHaveLength(100);
  });
});

describe("escapeLike", () => {
  it("makes wildcard characters literal", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
    expect(escapeLike("plain")).toBe("plain");
  });
});

describe("searchCondition", () => {
  const dialect = new PgDialect();

  it("returns nothing when there is no search", () => {
    expect(searchCondition(null, [sql`a`])).toBeUndefined();
  });

  it("ORs a case-insensitive contains match across the columns, with the term bound as a parameter", () => {
    const condition = searchCondition("it's 100%", [sql`username`, sql`email`])!;
    const query = dialect.sqlToQuery(condition);
    expect(query.sql).toBe("(username ilike $1 or email ilike $2)");
    expect(query.params).toEqual(["%it's 100\\%%", "%it's 100\\%%"]);
  });
});
