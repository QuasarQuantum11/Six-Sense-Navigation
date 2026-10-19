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

import { expireStaleFeedback } from "../expire";
import { updateFeedbackStatus } from "../../../app/admin/feedback/actions";
import { updateFeedback } from "../../../app/students/[id]/feedback/actions";
import { feedback } from "@/lib/feedback/schema";
import { students } from "@/lib/students/schema";
import {
  createTestDatabase,
  resetTables,
  setCurrentDatabase,
  uuid,
  type TestDatabase,
} from "@/lib/test-utils/test-database";

const NOW = new Date("2026-10-14T05:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const ago = (ms: number) => new Date(NOW.getTime() - ms);

const STUDENT = uuid(1);
const admin = { userId: uuid(900), username: "admin", role: "admin" };
const author = { userId: STUDENT, username: "alice", role: "student" };

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
  await db.insert(students).values({ id: STUDENT, username: "alice", email: "alice@example.com", passwordHash: "x" });
});

type Status = "new" | "not_reviewed" | "in_review" | "resolved" | "dismissed";

async function addFeedback(n: number, status: Status, updatedAt: Date, createdAt = updatedAt) {
  await db.insert(feedback).values({ id: uuid(n), studentId: STUDENT, message: `item ${n}`, status, createdAt, updatedAt });
  return uuid(n);
}

async function rowFor(id: string) {
  return (await db.select().from(feedback).where(eq(feedback.id, id)))[0];
}

describe("expireStaleFeedback", () => {
  it("moves only feedback still New after the 7-day window to Not reviewed", async () => {
    const stale = await addFeedback(1, "new", ago(8 * DAY));
    const fresh = await addFeedback(2, "new", ago(6 * DAY));
    const oldButHandled = [
      await addFeedback(3, "in_review", ago(30 * DAY)),
      await addFeedback(4, "resolved", ago(30 * DAY)),
      await addFeedback(5, "dismissed", ago(30 * DAY)),
      await addFeedback(6, "not_reviewed", ago(30 * DAY)),
    ];

    const changed = await expireStaleFeedback(NOW);

    expect(changed).toBe(1);
    expect((await rowFor(stale)).status).toBe("not_reviewed");
    expect((await rowFor(fresh)).status).toBe("new");
    expect(await Promise.all(oldButHandled.map(async (id) => (await rowFor(id)).status))).toEqual([
      "in_review",
      "resolved",
      "dismissed",
      "not_reviewed",
    ]);
  });

  it("treats exactly 7 days as still within the window, and one second more as expired", async () => {
    const exactly = await addFeedback(1, "new", ago(7 * DAY));
    const justOver = await addFeedback(2, "new", ago(7 * DAY + 1000));

    await expireStaleFeedback(NOW);

    expect((await rowFor(exactly)).status).toBe("new");
    expect((await rowFor(justOver)).status).toBe("not_reviewed");
  });

  it("changes the status only, leaving the message and timestamps as they were", async () => {
    const updatedAt = ago(9 * DAY);
    const createdAt = ago(12 * DAY);
    const id = await addFeedback(1, "new", updatedAt, createdAt);

    await expireStaleFeedback(NOW);

    const row = await rowFor(id);
    expect(row.status).toBe("not_reviewed");
    expect(row.message).toBe("item 1");
    expect(row.updatedAt).toEqual(updatedAt);
    expect(row.createdAt).toEqual(createdAt);
  });

  it("is safe to repeat, and does nothing to an empty table", async () => {
    expect(await expireStaleFeedback(NOW)).toBe(0);

    await addFeedback(1, "new", ago(9 * DAY));
    expect(await expireStaleFeedback(NOW)).toBe(1);
    expect(await expireStaleFeedback(NOW)).toBe(0);
  });

  it("measures the window from the last change, not from when it was submitted", async () => {
    const id = await addFeedback(1, "new", ago(1 * DAY), ago(30 * DAY));

    await expireStaleFeedback(NOW);

    expect((await rowFor(id)).status).toBe("new");
  });
});

describe("how admin and student actions restart the clock", () => {
  it("gives feedback an admin sets back to New a fresh window", async () => {
    const id = await addFeedback(1, "not_reviewed", ago(20 * DAY));
    mocks.getSession.mockResolvedValue(admin);

    expect(await updateFeedbackStatus(id, "new")).toEqual({});
    expect((await rowFor(id)).status).toBe("new");

    // Right away, and a few days later, it stays New...
    await expireStaleFeedback(new Date());
    expect((await rowFor(id)).status).toBe("new");
    await expireStaleFeedback(new Date(Date.now() + 3 * DAY));
    expect((await rowFor(id)).status).toBe("new");

    // ...and moves on once a full window has passed again.
    await expireStaleFeedback(new Date(Date.now() + 7 * DAY + 60_000));
    expect((await rowFor(id)).status).toBe("not_reviewed");
  });

  it("restarts the window when the author edits their feedback", async () => {
    const id = await addFeedback(1, "new", ago(9 * DAY));
    mocks.getSession.mockResolvedValue(author);

    await updateFeedback(id, "Updated with more detail");
    await expireStaleFeedback(new Date());

    expect((await rowFor(id)).status).toBe("new");
  });

  it("lets an admin's other status changes stick, however old the feedback is", async () => {
    const id = await addFeedback(1, "new", ago(40 * DAY));
    mocks.getSession.mockResolvedValue(admin);

    await updateFeedbackStatus(id, "in_review");
    await expireStaleFeedback(new Date(Date.now() + 60 * DAY));

    expect((await rowFor(id)).status).toBe("in_review");
  });
});
