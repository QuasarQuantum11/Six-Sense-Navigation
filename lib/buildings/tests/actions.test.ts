import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getSession: mocks.getSession }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
vi.mock("@/lib/db/client", async () => ({
  db: (await import("@/lib/test-utils/test-database")).currentDatabaseProxy,
}));

import {
  createBuilding,
  mergeBuilding,
  updateBuilding,
} from "../../../app/admins/buildings/actions";
import { buildings, timetableBuildings, timetables } from "@/lib/timetables/schema";
import { students } from "@/lib/students/schema";
import {
  createTestDatabase,
  resetTables,
  setCurrentDatabase,
  uuid,
  type TestDatabase,
} from "@/lib/test-utils/test-database";

const admin = { userId: uuid(900), username: "admin", role: "admin" };
const student = { userId: uuid(901), username: "student", role: "student" };

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
  vi.clearAllMocks();
  await resetTables(client);
  mocks.getSession.mockResolvedValue(admin);
});

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

async function seedBuilding(
  n: number,
  name: string,
  coordinates: { latitude: number; longitude: number } | null = null,
) {
  await db.insert(buildings).values({ id: uuid(n), name, ...coordinates });
  return uuid(n);
}

const allBuildings = () => db.select().from(buildings);

describe("access control", () => {
  const initial = {};

  it.each([
    ["a guest", null],
    ["a student", student],
  ])("blocks %s from every building action and changes nothing", async (_label, session) => {
    mocks.getSession.mockResolvedValue(session);
    const keep = await seedBuilding(1, "Library");
    const duplicate = await seedBuilding(2, "Library (copy)");

    await expect(createBuilding(initial, form({ name: "Sneaky" }))).rejects.toThrow("redirect:/admin/login");
    await expect(updateBuilding(keep, { name: "Hacked", latitude: "", longitude: "" })).rejects.toThrow("redirect:/admin/login");
    await expect(mergeBuilding(duplicate, keep)).rejects.toThrow("redirect:/admin/login");

    const rows = await allBuildings();
    expect(rows.map((row) => row.name).sort()).toEqual(["Library", "Library (copy)"]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("createBuilding", () => {
  it("creates a building with coordinates, revalidates, and redirects to the list", async () => {
    await expect(
      createBuilding({}, form({ name: "  Learning and Teaching  ", latitude: "-37.9133", longitude: "145.1344" })),
    ).rejects.toThrow("redirect:/admins/buildings");

    const [row] = await allBuildings();
    expect(row).toMatchObject({ name: "Learning and Teaching", latitude: -37.9133, longitude: 145.1344 });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admins/buildings");
  });

  it("accepts a building with no coordinates", async () => {
    await expect(createBuilding({}, form({ name: "Gatehouse" }))).rejects.toThrow("redirect:/admins/buildings");
    const [row] = await allBuildings();
    expect(row).toMatchObject({ name: "Gatehouse", latitude: null, longitude: null });
  });

  it("returns field errors and saves nothing for invalid input", async () => {
    const blank = await createBuilding({}, form({ name: "   " }));
    expect(blank.errors?.name).toBeDefined();

    const offCampus = await createBuilding({}, form({ name: "Far away", latitude: "10", longitude: "145.13" }));
    expect(offCampus.errors?.latitude).toBeDefined();

    const half = await createBuilding({}, form({ name: "Half", latitude: "-37.91", longitude: "" }));
    expect(half.errors?.longitude).toBeDefined();

    expect(await allBuildings()).toHaveLength(0);
  });

  it("rejects a duplicate name, ignoring case and surrounding spaces", async () => {
    await seedBuilding(1, "Library");

    const result = await createBuilding({}, form({ name: "  library " }));

    expect(result.errors?.name?.[0]).toMatch(/already exists/);
    expect(await allBuildings()).toHaveLength(1);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateBuilding", () => {
  const input = (overrides: Partial<{ name: string; latitude: string; longitude: string }> = {}) => ({
    name: "Library",
    latitude: "",
    longitude: "",
    ...overrides,
  });

  it("treats a malformed or unknown id as not found", async () => {
    expect(await updateBuilding("not-a-uuid", input())).toEqual({ message: "Building not found." });

    const result = await updateBuilding(uuid(404), input());
    expect(result.message).toMatch(/not found/i);
  });

  it("returns validation errors and leaves the building unchanged", async () => {
    const id = await seedBuilding(1, "Library");

    const result = await updateBuilding(id, input({ latitude: "-37.91", longitude: "" }));

    expect(result.errors?.longitude).toBeDefined();
    const [row] = await allBuildings();
    expect(row).toMatchObject({ name: "Library", latitude: null });
  });

  it("refuses a name that another building already uses, in any letter case", async () => {
    await seedBuilding(1, "Library");
    const other = await seedBuilding(2, "Gatehouse");

    const result = await updateBuilding(other, input({ name: "LIBRARY" }));

    expect(result.errors?.name?.[0]).toMatch(/already exists/);
    const rows = await db.select().from(buildings).where(eq(buildings.id, other));
    expect(rows[0].name).toBe("Gatehouse");
  });

  it("lets a building keep or re-case its own name while changing its location", async () => {
    const id = await seedBuilding(1, "Library");

    const result = await updateBuilding(id, input({ name: "LIBRARY", latitude: "-37.9133", longitude: "145.1344" }));

    expect(result).toEqual({});
    const [row] = await allBuildings();
    expect(row).toMatchObject({ name: "LIBRARY", latitude: -37.9133, longitude: 145.1344 });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admins/buildings");
  });

  it("can clear a building's location", async () => {
    const id = await seedBuilding(1, "Library", { latitude: -37.9133, longitude: 145.1344 });

    expect(await updateBuilding(id, input())).toEqual({});

    const [row] = await allBuildings();
    expect(row).toMatchObject({ latitude: null, longitude: null });
  });
});

describe("mergeBuilding", () => {
  // A timetable with `count` stops at `buildingId`, using unique positions.
  async function addEntries(timetableNumber: number, buildingId: string, count: number, firstPosition = 0) {
    const timetableId = uuid(timetableNumber);
    const existing = await db.select().from(timetables).where(eq(timetables.id, timetableId));
    if (existing.length === 0) {
      const studentId = uuid(timetableNumber + 100);
      await db.insert(students).values({
        id: studentId,
        username: `student${timetableNumber}`,
        email: `student${timetableNumber}@example.com`,
        passwordHash: "x",
      });
      await db.insert(timetables).values({ id: timetableId, studentId, name: "Test" });
    }
    for (let i = 0; i < count; i++) {
      await db.insert(timetableBuildings).values({ timetableId, buildingId, position: firstPosition + i });
    }
  }

  const entriesFor = async (buildingId: string) =>
    (await db.select().from(timetableBuildings).where(eq(timetableBuildings.buildingId, buildingId))).length;

  it("rejects malformed ids, merging a building into itself, and buildings that don't exist", async () => {
    const id = await seedBuilding(1, "Library");

    await expect(mergeBuilding("nope", id)).rejects.toThrow("Building not found.");
    await expect(mergeBuilding(id, "nope")).rejects.toThrow("Building not found.");
    await expect(mergeBuilding(id, id)).rejects.toThrow("Choose a different building to merge into.");
    await expect(mergeBuilding(uuid(404), id)).rejects.toThrow(/may have been merged already/);
    await expect(mergeBuilding(id, uuid(404))).rejects.toThrow(/may have been merged already/);

    expect(await allBuildings()).toHaveLength(1);
  });

  it("moves every timetable entry to the kept building and deletes the duplicate", async () => {
    const keep = await seedBuilding(1, "Library");
    const duplicate = await seedBuilding(2, "Library (old name)");
    await addEntries(10, keep, 1, 0);
    await addEntries(10, duplicate, 2, 1);
    await addEntries(11, duplicate, 1, 0);

    await mergeBuilding(duplicate, keep);

    expect(await entriesFor(keep)).toBe(4);
    expect(await entriesFor(duplicate)).toBe(0);
    expect((await allBuildings()).map((row) => row.id)).toEqual([keep]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admins/buildings");
  });

  it("gives the kept building the duplicate's location only when it has none of its own", async () => {
    const located = { latitude: -37.9133, longitude: 145.1344 };
    const other = { latitude: -37.9, longitude: 145.13 };

    const missing = await seedBuilding(1, "No location");
    const donor = await seedBuilding(2, "Has location", located);
    await mergeBuilding(donor, missing);
    expect((await db.select().from(buildings).where(eq(buildings.id, missing)))[0]).toMatchObject(located);

    const keeper = await seedBuilding(3, "Keeper", other);
    const second = await seedBuilding(4, "Second", located);
    await mergeBuilding(second, keeper);
    expect((await db.select().from(buildings).where(eq(buildings.id, keeper)))[0]).toMatchObject(other);

    const bare = await seedBuilding(5, "Bare");
    const alsoBare = await seedBuilding(6, "Also bare");
    await mergeBuilding(alsoBare, bare);
    expect((await db.select().from(buildings).where(eq(buildings.id, bare)))[0]).toMatchObject({ latitude: null, longitude: null });
  });

  it("does not partially merge: a second attempt fails and changes nothing", async () => {
    const keep = await seedBuilding(1, "Library");
    const duplicate = await seedBuilding(2, "Library (copy)");
    await addEntries(10, duplicate, 2);

    await mergeBuilding(duplicate, keep);
    await expect(mergeBuilding(duplicate, keep)).rejects.toThrow(/may have been merged already/);

    expect(await entriesFor(keep)).toBe(2);
    expect(await allBuildings()).toHaveLength(1);
  });
});
