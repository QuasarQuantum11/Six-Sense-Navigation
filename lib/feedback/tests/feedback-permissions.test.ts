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
  deleteFeedback,
  updateFeedback,
} from "../../../app/students/[id]/feedback/actions";
import { feedback } from "@/lib/feedback/schema";
import { students } from "@/lib/students/schema";
import {
  createTestDatabase,
  resetTables,
  setCurrentDatabase,
  uuid,
  type TestDatabase,
} from "@/lib/test-utils/test-database";

const ALICE = uuid(1);
const BEN = uuid(2);
const alice = { userId: ALICE, username: "alice", role: "student" };
const ben = { userId: BEN, username: "ben", role: "student" };
const admin = { userId: uuid(900), username: "admin", role: "admin" };

const ALICES_FEEDBACK = uuid(11);
const BENS_FEEDBACK = uuid(12);
const GUEST_FEEDBACK = uuid(13);

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
  mocks.getSession.mockResolvedValue(alice);

  await db.insert(students).values([
    { id: ALICE, username: "alice", email: "alice@example.com", passwordHash: "x" },
    { id: BEN, username: "ben", email: "ben@example.com", passwordHash: "x" },
  ]);
  await db.insert(feedback).values([
    { id: ALICES_FEEDBACK, studentId: ALICE, message: "Alice's original" },
    { id: BENS_FEEDBACK, studentId: BEN, message: "Ben's original" },
    { id: GUEST_FEEDBACK, studentId: null, message: "From a guest" },
  ]);
});

const ids = async () => (await db.select({ id: feedback.id }).from(feedback)).map((row) => row.id).sort();
const messageOf = async (id: string) => (await db.select().from(feedback).where(eq(feedback.id, id)))[0]?.message;

describe("deleteFeedback", () => {
  it("refuses someone who is not signed in", async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(deleteFeedback(ALICES_FEEDBACK)).rejects.toThrow("You must be signed in to do this.");

    expect(await ids()).toHaveLength(3);
  });

  it("refuses a student deleting another student's feedback", async () => {
    mocks.getSession.mockResolvedValue(ben);

    await expect(deleteFeedback(ALICES_FEEDBACK)).rejects.toThrow("You are not allowed to modify this feedback.");

    expect(await ids()).toContain(ALICES_FEEDBACK);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a student deleting a guest's feedback", async () => {
    await expect(deleteFeedback(GUEST_FEEDBACK)).rejects.toThrow("You are not allowed to modify this feedback.");

    expect(await ids()).toContain(GUEST_FEEDBACK);
  });

  it("lets the author delete their own feedback and nobody else's", async () => {
    await deleteFeedback(ALICES_FEEDBACK);

    expect(await ids()).toEqual([BENS_FEEDBACK, GUEST_FEEDBACK].sort());
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/students/${ALICE}/feedback`);
  });

  it("lets an admin delete a student's feedback", async () => {
    mocks.getSession.mockResolvedValue(admin);

    await deleteFeedback(BENS_FEEDBACK);

    expect(await ids()).toEqual([ALICES_FEEDBACK, GUEST_FEEDBACK].sort());
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/students/${BEN}/feedback`);
  });

  it("lets an admin delete feedback that has no student attached", async () => {
    mocks.getSession.mockResolvedValue(admin);

    await deleteFeedback(GUEST_FEEDBACK);

    expect(await ids()).toEqual([ALICES_FEEDBACK, BENS_FEEDBACK].sort());
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("reports feedback that doesn't exist", async () => {
    mocks.getSession.mockResolvedValue(admin);

    await expect(deleteFeedback(uuid(404))).rejects.toThrow("Feedback not found.");
    expect(await ids()).toHaveLength(3);
  });

  it("rejects a malformed id without deleting anything", async () => {
    mocks.getSession.mockResolvedValue(admin);

    await expect(deleteFeedback("not-a-uuid")).rejects.toThrow();
    expect(await ids()).toHaveLength(3);
  });
});

describe("updateFeedback (editing the message)", () => {
  it("lets the author edit, trimming the text and keeping the status", async () => {
    await db.update(feedback).set({ status: "in_review" }).where(eq(feedback.id, ALICES_FEEDBACK));
    const before = (await db.select().from(feedback).where(eq(feedback.id, ALICES_FEEDBACK)))[0];

    await updateFeedback(ALICES_FEEDBACK, "  Edited text  ");

    const after = (await db.select().from(feedback).where(eq(feedback.id, ALICES_FEEDBACK)))[0];
    expect(after.message).toBe("Edited text");
    expect(after.status).toBe("in_review");
    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime());
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/students/${ALICE}/feedback`);
  });

  it.each(["", "   "])("rejects an empty message (%j) and keeps the original", async (message) => {
    await expect(updateFeedback(ALICES_FEEDBACK, message)).rejects.toThrow("Feedback message cannot be empty.");
    expect(await messageOf(ALICES_FEEDBACK)).toBe("Alice's original");
  });

  it("never lets an admin rewrite what a student or guest wrote", async () => {
    mocks.getSession.mockResolvedValue(admin);

    await expect(updateFeedback(ALICES_FEEDBACK, "Admin edit")).rejects.toThrow("Only the author can edit this feedback.");
    await expect(updateFeedback(GUEST_FEEDBACK, "Admin edit")).rejects.toThrow("Only the author can edit this feedback.");

    expect(await messageOf(ALICES_FEEDBACK)).toBe("Alice's original");
    expect(await messageOf(GUEST_FEEDBACK)).toBe("From a guest");
  });

  it("refuses other students and visitors who are not signed in", async () => {
    mocks.getSession.mockResolvedValue(ben);
    await expect(updateFeedback(ALICES_FEEDBACK, "Ben edit")).rejects.toThrow("You are not allowed to modify this feedback.");

    mocks.getSession.mockResolvedValue(null);
    await expect(updateFeedback(ALICES_FEEDBACK, "Anon edit")).rejects.toThrow("You must be signed in to do this.");

    expect(await messageOf(ALICES_FEEDBACK)).toBe("Alice's original");
  });
});
