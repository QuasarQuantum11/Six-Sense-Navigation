import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";

vi.mock("server-only", () => ({}));

import { paginate } from "@/lib/pagination";
import { searchCondition } from "@/lib/table-search";
import { orderByFor, type SortState } from "@/lib/table-sort";
import { feedback } from "@/lib/feedback/schema";
import { students } from "@/lib/students/schema";
import { buildings, timetableBuildings, timetables } from "@/lib/timetables/schema";
import {
  createTestDatabase,
  resetTables,
  uuid,
  type TestDatabase,
} from "@/lib/test-utils/test-database";

// These exercise the sort, search and pagination helpers against real rows. The
// column maps below mirror the ones in each admin page (app/students/page.tsx,
// app/admin/feedback/page.tsx, app/admins/buildings/page.tsx).
const studentColumns = {
  username: sql`lower(${students.username})`,
  email: sql`lower(${students.email})`,
  profilePicture: sql`${students.profilePicture}`,
  walkingSpeed: sql`${students.walkingSpeed}`,
  createdAt: sql`${students.createdAt}`,
  id: sql`${students.id}`,
};
const feedbackColumns = {
  submittedBy: sql`lower(${students.username})`,
  message: sql`lower(${feedback.message})`,
  status: sql`${feedback.status}`,
  submitted: sql`${feedback.createdAt}`,
};
const buildingColumns = {
  name: sql`lower(${buildings.name})`,
  latitude: sql`${buildings.latitude}`,
  timetableEntries: sql`count(${timetableBuildings.id})`,
};

let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
let db: TestDatabase;

beforeAll(async () => {
  ({ client, db } = await createTestDatabase());
}, 30_000);

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetTables(client);
});

// ---------------------------------------------------------------- students

// number, username, walking speed, profile picture, email
const studentRows = [
  [1, "Alice", "normal", "a.png", "alice@uni.edu"],
  [2, "bob", "fast", null, "bob@uni.edu"],
  [3, "carol", "accessible", "c.png", "carol@uni.edu"],
  [4, "dana_admin", "normal", null, "dana_admin@uni.edu"],
  [5, "danaXadmin", "fast", null, "danaxadmin@uni.edu"],
  [6, "Zed", "normal", "z.png", "zed@uni.edu"],
  [7, "frank", "accessible", null, "frank@uni.edu"],
  [8, "grace", "fast", null, "grace@uni.edu"],
  [9, "heidi", "normal", null, "heidi@uni.edu"],
  [10, "ivan", "accessible", null, "ivan@uni.edu"],
  [11, "ju\\dy", "normal", null, "judy@uni.edu"],
  [12, "kate", "fast", null, "50%off@uni.edu"],
] as const;

async function seedStudents() {
  await db.insert(students).values(
    studentRows.map(([n, username, walkingSpeed, profilePicture, email]) => ({
      id: uuid(n),
      username,
      walkingSpeed,
      profilePicture,
      email,
      passwordHash: "x",
      createdAt: new Date(Date.UTC(2026, 8, n)), // oldest first
    })),
  );
}

const studentNumber = (id: string) => Number(id.slice(-12));

async function queryStudents(options: { sort?: SortState<keyof typeof studentColumns>; q?: string | null; page?: number; size?: 5 | 10 | 20 | 50 } = {}) {
  const match = searchCondition(options.q ?? null, [students.username, students.email, sql`${students.id}::text`]);
  const [{ total }] = await db.select({ total: count() }).from(students).where(match);
  const info = paginate(options.page ?? 1, options.size ?? 50, total);
  const rows = await db
    .select({ id: students.id, username: students.username, profilePicture: students.profilePicture })
    .from(students)
    .where(match)
    .orderBy(...orderByFor(studentColumns, options.sort ?? null, [asc(students.createdAt)]))
    .limit(info.pageSize)
    .offset(info.offset);
  return { rows, total, info };
}

describe("sorting students", () => {
  beforeEach(seedStudents);

  it("uses the default order (oldest first) when nothing is chosen", async () => {
    const { rows } = await queryStudents();

    expect(rows.map((row) => studentNumber(row.id))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("sorts usernames without regard to letter case", async () => {
    const asc = await queryStudents({ sort: { key: "username", direction: "asc" } });
    const desc = await queryStudents({ sort: { key: "username", direction: "desc" } });

    expect(asc.rows.slice(0, 3).map((row) => row.username)).toEqual(["Alice", "bob", "carol"]);
    expect(asc.rows.at(-1)?.username).toBe("Zed"); // would come first if capitals sorted before lowercase
    expect(desc.rows[0].username).toBe("Zed");
    expect(desc.rows.at(-1)?.username).toBe("Alice");
  });

  it("sorts walking speed from slowest to fastest, oldest first within a speed", async () => {
    const slowestFirst = await queryStudents({ sort: { key: "walkingSpeed", direction: "asc" } });
    const fastestFirst = await queryStudents({ sort: { key: "walkingSpeed", direction: "desc" } });

    expect(slowestFirst.rows.slice(0, 3).map((row) => studentNumber(row.id))).toEqual([3, 7, 10]); // accessible
    expect(fastestFirst.rows.slice(0, 4).map((row) => studentNumber(row.id))).toEqual([2, 5, 8, 12]); // fast
  });

  it("keeps students with no profile picture at the bottom, whichever way it sorts", async () => {
    const ascending = await queryStudents({ sort: { key: "profilePicture", direction: "asc" } });
    const descending = await queryStudents({ sort: { key: "profilePicture", direction: "desc" } });

    expect(ascending.rows.slice(0, 3).map((row) => row.profilePicture)).toEqual(["a.png", "c.png", "z.png"]);
    expect(descending.rows.slice(0, 3).map((row) => row.profilePicture)).toEqual(["z.png", "c.png", "a.png"]);
    for (const { rows } of [ascending, descending]) {
      expect(rows.slice(3).every((row) => row.profilePicture === null)).toBe(true);
    }
  });

  it("returns the same order every time for equal values", async () => {
    const first = await queryStudents({ sort: { key: "walkingSpeed", direction: "desc" } });
    const second = await queryStudents({ sort: { key: "walkingSpeed", direction: "desc" } });

    expect(second.rows.map((row) => row.id)).toEqual(first.rows.map((row) => row.id));
  });
});

describe("searching students", () => {
  beforeEach(seedStudents);

  const names = async (q: string | null) => (await queryStudents({ q })).rows.map((row) => row.username).sort();

  it("matches text anywhere in the username, email or ID, ignoring case", async () => {
    expect(await names("ALICE")).toEqual(["Alice"]); // username
    expect(await names("frank@UNI")).toEqual(["frank"]); // email
    expect(await names("000000000005")).toEqual(["danaXadmin"]); // ID
    expect(await names("dana")).toEqual(["dana_admin", "danaXadmin"].sort());
  });

  it("treats % and _ as ordinary characters, not wildcards", async () => {
    expect(await names("%")).toEqual(["kate"]);
    expect(await names("_")).toEqual(["dana_admin"]); // not danaXadmin
    expect(await names("dana_a")).toEqual(["dana_admin"]);
  });

  it("treats a backslash as an ordinary character too", async () => {
    expect(await names("\\")).toEqual(["ju\\dy"]);
  });

  it("is not affected by SQL in the search text", async () => {
    expect(await names("'; DROP TABLE students; --")).toEqual([]);
    expect(await names("' OR '1'='1")).toEqual([]);
    expect((await queryStudents()).total).toBe(12);
  });

  it("shows everyone when there is no search, and no one when nothing matches", async () => {
    expect((await names(null)).length).toBe(12);
    expect(await names("zzz-no-such-person")).toEqual([]);
  });
});

describe("pagination", () => {
  beforeEach(seedStudents);

  const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

  it("splits sorted results into pages with no gaps, repeats or reordering", async () => {
    const sort = { key: "walkingSpeed", direction: "asc" } as const;
    const everything = await queryStudents({ sort, size: 50 });

    const pages = [
      await queryStudents({ sort, size: 5, page: 1 }),
      await queryStudents({ sort, size: 5, page: 2 }),
      await queryStudents({ sort, size: 5, page: 3 }),
    ];

    expect(pages.map((page) => page.rows.length)).toEqual([5, 5, 2]);
    expect(pages.flatMap((page) => ids(page.rows))).toEqual(ids(everything.rows));
    expect(new Set(pages.flatMap((page) => ids(page.rows))).size).toBe(12);
    expect(pages.every((page) => page.total === 12 && page.info.totalPages === 3)).toBe(true);
  });

  it("shows the last page when a page past the end is requested", async () => {
    const result = await queryStudents({ size: 5, page: 99 });

    expect(result.info).toMatchObject({ page: 3, from: 11, to: 12 });
    expect(result.rows.map((row) => studentNumber(row.id))).toEqual([11, 12]);
  });

  it("counts and pages only the rows that match a search", async () => {
    const q = "a"; // in the username or email of many, but not all, students
    const expected = studentRows
      .filter(([n, username, , , email]) => [username, email, uuid(n)].some((value) => value.toLowerCase().includes(q)))
      .map(([n]) => n);

    const sort = { key: "createdAt", direction: "asc" } as const;
    const first = await queryStudents({ q, size: 5, page: 1, sort });
    expect(first.total).toBe(expected.length);
    expect(expected.length).toBeGreaterThan(5); // so the results really do span several pages
    expect(expected.length).toBeLessThan(12); // and the search really does filter

    const shown: number[] = [];
    for (let page = 1; page <= first.info.totalPages; page++) {
      const { rows } = await queryStudents({ q, size: 5, page, sort });
      shown.push(...rows.map((row) => studentNumber(row.id)));
    }
    expect(shown).toEqual(expected);
  });

  it("reports an empty page range when nothing matches", async () => {
    const result = await queryStudents({ q: "zzz-no-such-person" });

    expect(result).toMatchObject({ total: 0, rows: [] });
    expect(result.info).toMatchObject({ page: 1, totalPages: 1, from: 0, to: 0 });
  });
});

// ---------------------------------------------------------------- feedback

async function seedFeedback() {
  await seedStudents();
  const row = (k: number, status: "new" | "not_reviewed" | "in_review" | "resolved" | "dismissed", message: string, studentId: string | null) => ({
    id: uuid(100 + k),
    status,
    message,
    studentId,
    createdAt: new Date(Date.UTC(2026, 9, k)), // k-th of October; later is newer
  });
  await db.insert(feedback).values([
    row(1, "new", "Ramp is blocked", uuid(1)), // Alice
    row(2, "resolved", "Great map", uuid(2)), // bob
    row(3, "in_review", "Needs ramp on level 2", uuid(3)), // carol
    row(4, "new", "Anonymous: lift out of order", null), // guest
    row(5, "dismissed", "spam", uuid(1)), // Alice
    row(6, "not_reviewed", "more detail", uuid(2)), // bob
  ]);
}

const feedbackNumber = (id: string) => Number(id.slice(-3)) - 100;

async function queryFeedback(options: { sort?: SortState<keyof typeof feedbackColumns>; q?: string | null; newOnly?: boolean } = {}) {
  const match = searchCondition(options.q ?? null, [feedback.message, students.username]);
  const visible = and(options.newOnly ? eq(feedback.status, "new") : undefined, match);
  const [{ total }] = await db
    .select({ total: count() })
    .from(feedback)
    .leftJoin(students, eq(feedback.studentId, students.id))
    .where(visible);
  const rows = await db
    .select({ id: feedback.id, status: feedback.status, username: students.username })
    .from(feedback)
    .leftJoin(students, eq(feedback.studentId, students.id))
    .where(visible)
    .orderBy(...orderByFor(feedbackColumns, options.sort ?? null, [desc(feedback.createdAt)]));
  return { rows: rows.map((row) => ({ ...row, k: feedbackNumber(row.id) })), total };
}

describe("feedback table queries", () => {
  beforeEach(seedFeedback);

  it("shows newest first by default", async () => {
    expect((await queryFeedback()).rows.map((row) => row.k)).toEqual([6, 5, 4, 3, 2, 1]);
  });

  it("sorts status in workflow order, newest first within a status", async () => {
    const forwards = await queryFeedback({ sort: { key: "status", direction: "asc" } });
    const backwards = await queryFeedback({ sort: { key: "status", direction: "desc" } });

    expect(forwards.rows.map((row) => row.status)).toEqual(["new", "new", "not_reviewed", "in_review", "resolved", "dismissed"]);
    expect(forwards.rows.slice(0, 2).map((row) => row.k)).toEqual([4, 1]);
    expect(backwards.rows.map((row) => row.status)).toEqual(["dismissed", "resolved", "in_review", "not_reviewed", "new", "new"]);
  });

  it("sorts by who submitted it, with guests last in either direction", async () => {
    const forwards = await queryFeedback({ sort: { key: "submittedBy", direction: "asc" } });
    const backwards = await queryFeedback({ sort: { key: "submittedBy", direction: "desc" } });

    expect(forwards.rows.map((row) => row.username)).toEqual(["Alice", "Alice", "bob", "bob", "carol", null]);
    expect(backwards.rows.map((row) => row.username)).toEqual(["carol", "bob", "bob", "Alice", "Alice", null]);
  });

  it("searches the message and the student's username", async () => {
    expect((await queryFeedback({ q: "ramp" })).rows.map((row) => row.k).sort()).toEqual([1, 3]);
    expect((await queryFeedback({ q: "ALICE" })).rows.map((row) => row.k).sort()).toEqual([1, 5]); // by username
    expect((await queryFeedback({ q: "anonymous" })).rows.map((row) => row.k)).toEqual([4]); // guest, by message
  });

  it("does not match a guest's feedback on the word Guest", async () => {
    expect((await queryFeedback({ q: "guest" })).rows).toEqual([]);
  });

  it("combines the New-only filter with a search, and counts what is shown", async () => {
    const both = await queryFeedback({ newOnly: true, q: "ramp" });
    expect(both.rows.map((row) => row.k)).toEqual([1]); // carol's ramp feedback is not New
    expect(both.total).toBe(1);

    const onlyNew = await queryFeedback({ newOnly: true });
    expect(onlyNew.total).toBe(2);
    expect(onlyNew.rows.every((row) => row.status === "new")).toBe(true);
  });
});

// --------------------------------------------------------------- buildings

async function seedBuildings() {
  await db.insert(buildings).values([
    { id: uuid(31), name: "Library", latitude: -37.9133, longitude: 145.1344 },
    { id: uuid(32), name: "Alpha Hall" }, // no location
    { id: uuid(33), name: "Gatehouse", latitude: -37.91 }, // only half a location
    { id: uuid(34), name: "Zebra Lab", latitude: -37.911, longitude: 145.13 },
    { id: uuid(35), name: "Annex", latitude: -37.915, longitude: 145.131 },
  ]);
  await db.insert(students).values({ id: uuid(1), username: "owner", email: "owner@uni.edu", passwordHash: "x" });
  await db.insert(timetables).values({ id: uuid(21), studentId: uuid(1), name: "t" });
  const stops: [number, number][] = [[31, 3], [33, 2], [34, 1]]; // [building, how many entries]
  let position = 0;
  for (const [building, entries] of stops) {
    for (let i = 0; i < entries; i++) {
      await db.insert(timetableBuildings).values({ timetableId: uuid(21), buildingId: uuid(building), position: position++ });
    }
  }
}

async function queryBuildings(sort: SortState<keyof typeof buildingColumns> = null, q: string | null = null) {
  const match = searchCondition(q, [buildings.name]);
  const rows = await db
    .select({ name: buildings.name, entries: count(timetableBuildings.id) })
    .from(buildings)
    .leftJoin(timetableBuildings, eq(timetableBuildings.buildingId, buildings.id))
    .where(match)
    .groupBy(buildings.id)
    .orderBy(
      ...orderByFor(buildingColumns, sort, [
        sql`(${buildings.latitude} IS NULL OR ${buildings.longitude} IS NULL) DESC`,
        asc(buildings.name),
      ]),
    );
  return rows.map((row) => `${row.name}:${row.entries}`);
}

describe("buildings table queries", () => {
  beforeEach(seedBuildings);

  it("lists buildings without a full location first by default, then by name", async () => {
    expect(await queryBuildings()).toEqual(["Alpha Hall:0", "Gatehouse:2", "Annex:0", "Library:3", "Zebra Lab:1"]);
  });

  it("sorts by how many timetable entries use a building", async () => {
    expect(await queryBuildings({ key: "timetableEntries", direction: "desc" })).toEqual([
      "Library:3", "Gatehouse:2", "Zebra Lab:1", "Alpha Hall:0", "Annex:0",
    ]);
    expect(await queryBuildings({ key: "timetableEntries", direction: "asc" })).toEqual([
      "Alpha Hall:0", "Annex:0", "Zebra Lab:1", "Gatehouse:2", "Library:3",
    ]);
  });

  it("puts buildings with no latitude last, whichever way it sorts", async () => {
    const ascending = await queryBuildings({ key: "latitude", direction: "asc" });
    const descending = await queryBuildings({ key: "latitude", direction: "desc" });

    expect(ascending).toEqual(["Annex:0", "Library:3", "Zebra Lab:1", "Gatehouse:2", "Alpha Hall:0"]);
    expect(descending).toEqual(["Gatehouse:2", "Zebra Lab:1", "Library:3", "Annex:0", "Alpha Hall:0"]);
  });

  it("sorts names without regard to letter case", async () => {
    await db.insert(buildings).values({ id: uuid(36), name: "aardvark house" });

    expect((await queryBuildings({ key: "name", direction: "asc" }))[0]).toBe("aardvark house:0");
  });

  it("searches the name, and keeps each building's entry count correct", async () => {
    expect(await queryBuildings(null, "LIB")).toEqual(["Library:3"]);
    expect(await queryBuildings(null, "a")).toEqual(["Alpha Hall:0", "Gatehouse:2", "Annex:0", "Library:3", "Zebra Lab:1"]);
    expect(await queryBuildings(null, "no-such-building")).toEqual([]);
  });
});
