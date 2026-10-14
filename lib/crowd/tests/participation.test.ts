import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), revalidatePath: vi.fn(), database: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getSession: mocks.getSession }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/db/client", () => ({ db: new Proxy({}, {
  get(_, key) {
    const database = mocks.database as Record<PropertyKey, unknown>;
    const value = database[key];
    return typeof value === "function" ? value.bind(database) : value;
  },
}) }));

import { setCrowdParticipation } from "../../../app/students/[id]/crowd-actions";
import { readParticipation, readRealCrowdData } from "../data";
import { PARTICIPATION_MS } from "../time";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const now = new Date("2026-10-06T23:00:00Z");
const join = (n: number) => setCrowdParticipation({ action: "join", timetableId: id(n), confirmed: true });
let client: PGlite;

beforeAll(async () => {
  client = new PGlite();
  await client.exec(`
    CREATE TABLE students (id uuid PRIMARY KEY);
    CREATE TABLE timetables (id uuid PRIMARY KEY, student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE, name text NOT NULL DEFAULT 'Test', created_at timestamp NOT NULL DEFAULT now());
    CREATE TABLE buildings (id uuid PRIMARY KEY, name text NOT NULL, latitude double precision, longitude double precision, created_at timestamp NOT NULL DEFAULT now());
    CREATE TABLE timetable_buildings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), timetable_id uuid REFERENCES timetables(id) ON DELETE CASCADE, building_id uuid REFERENCES buildings(id), position integer NOT NULL,
      day_of_week text, start_time time, duration text, class_dates text, campus text);
  `);
  const ddl = readFileSync("scripts/crowd/create-participation.sql", "utf8");
  await client.exec(ddl); await client.exec(ddl);
  mocks.database = drizzle(client);
}, 20_000);

beforeEach(async () => {
  vi.clearAllMocks(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now);
  await client.exec("TRUNCATE crowd_participation, timetable_buildings, timetables, buildings, students CASCADE");
  for (let n = 1; n <= 5; n++) {
    await client.query("INSERT INTO students VALUES ($1)", [id(n)]);
    await client.query("INSERT INTO timetables (id,student_id) VALUES ($1,$2)", [id(n * 10 + 1), id(n)]);
  }
  await client.query("INSERT INTO timetables (id,student_id) VALUES ($1,$2)", [id(12), id(1)]);
  await client.query("INSERT INTO buildings (id,name,latitude,longitude) VALUES ($1,'LTB',-37.913906,145.1328033)", [id(100)]);
  mocks.getSession.mockResolvedValue({ userId: id(1), role: "student" });
});
afterAll(async () => { vi.useRealTimers(); await client.close(); });

describe("participation and aggregation with isolated PostgreSQL", () => {
  it("does not enroll uploaded or saved timetables by default", async () => {
    const status = await readParticipation(id(1));
    expect(status.available).toBe(true); expect(status.timetableId).toBeNull();
  });
  it("requires explicit confirmation and creates exactly 168 hours of consent", async () => {
    expect((await setCrowdParticipation({ action: "join", timetableId: id(11), confirmed: false })).success).toBe(false);
    const result = await join(11);
    expect(result.success).toBe(true); expect(result.status?.timetableId).toBe(id(11));
    expect(new Date(result.status!.expiresAt!).getTime()).toBe(now.getTime() + PARTICIPATION_MS);
  });
  it("replaces a participating timetable instead of counting multiple versions", async () => {
    await join(11); await join(12);
    const { rows } = await client.query<{ timetable_id: string }>("SELECT timetable_id FROM crowd_participation");
    expect(rows).toEqual([{ timetable_id: id(12) }]);
  });
  it("refuses another student's timetable and leaves consent unchanged", async () => {
    await join(11);
    const result = await join(21);
    expect(result.success).toBe(false); expect(result.message).toContain("your own");
    expect((await readParticipation(id(1))).timetableId).toBe(id(11));
  });
  it.each([null, { userId: id(1), role: "admin" }])("denies enrollment without a student session %j", async session => {
    mocks.getSession.mockResolvedValue(session);
    expect((await join(11)).success).toBe(false);
    expect((await client.query("SELECT * FROM crowd_participation")).rows).toHaveLength(0);
  });
  it("allows the owner to stop without deleting any saved classes", async () => {
    await join(11);
    expect((await setCrowdParticipation({ action: "stop" })).success).toBe(true);
    expect((await client.query("SELECT * FROM crowd_participation")).rows).toHaveLength(0);
    expect((await client.query("SELECT id FROM timetables")).rows).toHaveLength(6);
  });
  it("deleting the selected timetable ends participation through the foreign key", async () => {
    await join(11); await client.query("DELETE FROM timetables WHERE id=$1", [id(11)]);
    expect((await readParticipation(id(1))).timetableId).toBeNull();
  });
  it("excludes expired participation and future times beyond its validity", async () => {
    await join(11);
    const expiry = new Date(now.getTime() + PARTICIPATION_MS);
    expect((await readRealCrowdData(now, expiry)).participants).toHaveLength(0);
    expect((await readRealCrowdData(expiry, expiry)).participants).toHaveLength(0);
  });
  it("enforces the consent validity period in PostgreSQL", async () => {
    await expect(client.query("INSERT INTO crowd_participation VALUES ($1,$2,$3,$4)", [id(1), id(11), now.toISOString(), new Date(now.getTime() + PARTICIPATION_MS + 1).toISOString()])).rejects.toThrow();
    expect((await readParticipation(id(1))).timetableId).toBeNull();
  });
  it("excludes an inconsistent owner pairing even if inserted outside the action", async () => {
    await client.query("INSERT INTO crowd_participation VALUES ($1,$2,$3,$4)", [id(1), id(21), now.toISOString(), new Date(now.getTime() + PARTICIPATION_MS).toISOString()]);
    expect((await readRealCrowdData(now, now)).participants).toHaveLength(0);
  });
  it("joins only consented owners and selected timetables, with minimum necessary fields", async () => {
    for (let n = 1; n <= 5; n++) {
      mocks.getSession.mockResolvedValue({ userId: id(n), role: "student" });
      await join(n * 10 + 1);
      await client.query("INSERT INTO timetable_buildings (timetable_id,building_id,position,day_of_week,start_time,duration,campus) VALUES ($1,$2,1,'Wednesday','10:00','1 hr','CL')", [id(n * 10 + 1), id(100)]);
    }
    await client.query("INSERT INTO timetable_buildings (timetable_id,building_id,position,day_of_week,start_time) VALUES ($1,$2,1,'Wednesday','11:00')", [id(12), id(100)]);
    const data = await readRealCrowdData(now, now);
    expect(data.participants).toHaveLength(5); expect(data.classes).toHaveLength(5);
    expect(data.classes.every(c => c.startTime === "10:00:00")).toBe(true);
    expect(data.buildings[0]).toMatchObject({ name: "LTB", latitude: -37.913906 });
  });
});
