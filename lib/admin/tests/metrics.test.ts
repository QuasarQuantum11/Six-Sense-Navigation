import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", async () => ({
  db: (await import("@/lib/test-utils/test-database")).currentDatabaseProxy,
}));

import { getDashboardMetrics } from "../metrics";
import { feedback } from "@/lib/feedback/schema";
import { students } from "@/lib/students/schema";
import { buildings, timetableBuildings, timetables } from "@/lib/timetables/schema";
import {
  createTestDatabase,
  resetTables,
  setCurrentDatabase,
  uuid,
  type TestDatabase,
} from "@/lib/test-utils/test-database";

// Wednesday 14 October 2026, 16:00 in Melbourne (AEDT, UTC+11).
const NOW = new Date("2026-10-14T05:00:00Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(NOW.getTime() - ms);

let client: Awaited<ReturnType<typeof createTestDatabase>>["client"];
let db: TestDatabase;

beforeAll(async () => {
  ({ client, db } = await createTestDatabase());
  setCurrentDatabase(db);
}, 30_000);

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetTables(client);
});

async function addStudent(n: number, createdAt: Date) {
  await db.insert(students).values({
    id: uuid(n),
    username: `student${n}`,
    email: `student${n}@example.com`,
    passwordHash: "x",
    createdAt,
  });
  return uuid(n);
}

describe("an empty system", () => {
  it("reports zeros, a full run of empty days, and no feedback", async () => {
    const metrics = await getDashboardMetrics(NOW);

    expect(metrics.students).toEqual({ total: 0, lastWeek: 0, lastMonth: 0 });
    expect(metrics.signups).toHaveLength(30);
    expect(metrics.signups.every((day) => day.count === 0)).toBe(true);
    expect(metrics.feedback).toMatchObject({
      recent: 0,
      awaitingReview: 0,
      latest: [],
      statusCounts: { new: 0, not_reviewed: 0, in_review: 0, resolved: 0, dismissed: 0 },
    });
    expect(metrics.timetables).toEqual({ total: 0, lastWeek: 0, todayEntries: 0, activeBuildings: 0 });
    expect(metrics.buildings).toEqual({ total: 0, located: 0 });
  });
});

describe("student numbers", () => {
  beforeEach(async () => {
    // Each fixture sits just either side of a boundary it is meant to test.
    await addStudent(1, new Date("2026-10-14T04:00:00Z")); // 1 hour ago; today in Melbourne
    await addStudent(2, new Date("2026-10-12T14:30:00Z")); // still the 12th in UTC, already the 13th in Melbourne
    await addStudent(3, new Date("2026-10-07T06:00:00Z")); // 6 days 23 hours ago: inside 7 days
    await addStudent(4, new Date("2026-10-07T03:00:00Z")); // 7 days 2 hours ago: just outside 7 days
    await addStudent(5, new Date("2026-09-15T05:00:00Z")); // 29 days ago: inside 30 days
    await addStudent(6, new Date("2026-09-13T05:00:00Z")); // 31 days ago: outside 30 days
  });

  it("counts everyone, the last 7 days, and the last 30 days", async () => {
    const { students: counts } = await getDashboardMetrics(NOW);

    expect(counts).toEqual({ total: 6, lastWeek: 3, lastMonth: 5 });
  });

  it("charts the last 30 completed Melbourne days, leaving today out", async () => {
    const { signups } = await getDashboardMetrics(NOW);

    expect(signups).toHaveLength(30);
    expect(signups[0].date).toBe("2026-09-14");
    expect(signups[29].date).toBe("2026-10-13");
    expect(signups.find((day) => day.date === "2026-10-14")).toBeUndefined();

    const nonZero = Object.fromEntries(signups.filter((day) => day.count > 0).map((day) => [day.date, day.count]));
    expect(nonZero).toEqual({ "2026-09-15": 1, "2026-10-07": 2, "2026-10-13": 1 });
  });

  it("buckets a late-evening UTC sign-up on the next Melbourne day", async () => {
    const { signups } = await getDashboardMetrics(NOW);

    expect(signups.find((day) => day.date === "2026-10-12")?.count).toBe(0);
    expect(signups.find((day) => day.date === "2026-10-13")?.count).toBe(1);
  });

  it("does not move the chart until Melbourne midnight", async () => {
    const lateToday = await getDashboardMetrics(new Date("2026-10-14T12:59:00Z")); // 23:59 on the 14th
    const justAfterMidnight = await getDashboardMetrics(new Date("2026-10-14T13:01:00Z")); // 00:01 on the 15th

    expect(lateToday.signups.at(-1)?.date).toBe("2026-10-13");
    expect(justAfterMidnight.signups.at(-1)?.date).toBe("2026-10-14");
    // The student who signed up an hour before NOW (on the 14th) appears once the day has closed.
    expect(justAfterMidnight.signups.at(-1)?.count).toBe(1);
  });
});

describe("feedback numbers", () => {
  beforeEach(async () => {
    const author = await addStudent(1, ago(40 * DAY));
    const rows = [
      { message: "f1", status: "new", createdAt: ago(1 * DAY), studentId: author },
      { message: "f2", status: "not_reviewed", createdAt: ago(8 * DAY), studentId: author },
      { message: "f3", status: "in_review", createdAt: ago(2 * DAY), studentId: author },
      { message: "f4", status: "resolved", createdAt: ago(10 * DAY), studentId: author },
      { message: "f5", status: "dismissed", createdAt: ago(1 * HOUR), studentId: author },
      { message: "f6", status: "new", createdAt: ago(3 * DAY), studentId: null }, // guest
    ] as const;
    for (const row of rows) await db.insert(feedback).values({ ...row, updatedAt: row.createdAt });
  });

  it("counts each status", async () => {
    const { feedback: f } = await getDashboardMetrics(NOW);

    expect(f.statusCounts).toEqual({ new: 2, not_reviewed: 1, in_review: 1, resolved: 1, dismissed: 1 });
  });

  it("counts feedback from the last 7 days as recent, whatever its status", async () => {
    const { feedback: f } = await getDashboardMetrics(NOW);

    expect(f.recent).toBe(4); // f1, f3, f5, f6
  });

  it("treats only new and not-reviewed feedback as awaiting review", async () => {
    const { feedback: f } = await getDashboardMetrics(NOW);

    expect(f.awaitingReview).toBe(3); // f1, f6, f2
  });

  it("lists the five latest, newest first, including guest feedback", async () => {
    const { feedback: f } = await getDashboardMetrics(NOW);

    expect(f.latest.map((item) => [item.message, item.student?.username ?? null])).toEqual([
      ["f5", "student1"],
      ["f1", "student1"],
      ["f3", "student1"],
      ["f6", null],
      ["f2", "student1"],
    ]);
  });
});

describe("timetable and building numbers", () => {
  async function seedTimetables() {
    const owner = await addStudent(1, ago(60 * DAY));
    await db.insert(timetables).values([
      { id: uuid(21), studentId: owner, name: "new", createdAt: ago(1 * DAY) },
      { id: uuid(22), studentId: owner, name: "this week", createdAt: ago(6 * DAY) },
      { id: uuid(23), studentId: owner, name: "older", createdAt: ago(8 * DAY) },
    ]);
    await db.insert(buildings).values([
      { id: uuid(31), name: "Located", latitude: -37.9133, longitude: 145.1344 },
      { id: uuid(32), name: "No location" },
      { id: uuid(33), name: "Half located", latitude: -37.91 },
    ]);
  }

  it("counts timetables, and those created in the last 7 days", async () => {
    await seedTimetables();

    const { timetables: t } = await getDashboardMetrics(NOW);

    expect(t.total).toBe(3);
    expect(t.lastWeek).toBe(2);
  });

  it("counts a building as located only when it has both coordinates", async () => {
    await seedTimetables();

    expect((await getDashboardMetrics(NOW)).buildings).toEqual({ total: 3, located: 1 });
  });

  it("counts today's classes by campus weekday and the distinct buildings they use", async () => {
    await seedTimetables();
    await db.insert(timetableBuildings).values([
      { timetableId: uuid(21), buildingId: uuid(31), position: 0, dayOfWeek: "Wednesday" },
      { timetableId: uuid(21), buildingId: uuid(31), position: 1, dayOfWeek: "Wednesday" },
      { timetableId: uuid(21), buildingId: uuid(32), position: 2, dayOfWeek: "Wednesday" },
      { timetableId: uuid(21), buildingId: uuid(31), position: 3, dayOfWeek: "Thursday" },
      { timetableId: uuid(21), buildingId: uuid(33), position: 4, dayOfWeek: "Thursday" },
      { timetableId: uuid(21), buildingId: uuid(33), position: 5, dayOfWeek: null },
    ]);

    const wednesday = await getDashboardMetrics(NOW);
    expect(wednesday.timetables).toMatchObject({ todayEntries: 3, activeBuildings: 2 });

    // 13:30 UTC on Wednesday is already 00:30 on Thursday in Melbourne.
    const thursdayInMelbourne = await getDashboardMetrics(new Date("2026-10-14T13:30:00Z"));
    expect(thursdayInMelbourne.timetables).toMatchObject({ todayEntries: 2, activeBuildings: 2 });
  });

  it("reports no classes on a day that has none", async () => {
    await seedTimetables();

    expect((await getDashboardMetrics(NOW)).timetables).toMatchObject({ todayEntries: 0, activeBuildings: 0 });
  });
});
