import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  returning: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/db/client", () => ({
  db: {
    update: mocks.update,
    query: { feedback: { findFirst: mocks.findFirst } },
  },
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { updateFeedbackStatus } from "../../../app/admin/feedback/actions";
import { updateFeedback } from "../../../app/students/[id]/feedback/actions";
import { isRecentFeedback } from "../status";

const ID = "3f0c2a4e-7a54-4a5b-9a52-6a1f0c6f2b11";
const admin = { userId: "a1", username: "Admin", role: "admin" };
const student = { userId: "s1", username: "Student", role: "student" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.update.mockReturnValue({ set: mocks.set });
  mocks.set.mockReturnValue({ where: mocks.where });
  mocks.where.mockReturnValue({ returning: mocks.returning });
  mocks.returning.mockResolvedValue([{ id: ID }]);
});

describe("updateFeedbackStatus", () => {
  it("redirects guests and students without writing", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(updateFeedbackStatus(ID, "resolved")).rejects.toThrow("redirect:/admin/login");
    mocks.getSession.mockResolvedValue(student);
    await expect(updateFeedbackStatus(ID, "resolved")).rejects.toThrow("redirect:/admin/login");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects a malformed id or unknown status", async () => {
    mocks.getSession.mockResolvedValue(admin);
    expect(await updateFeedbackStatus("nope", "resolved")).toEqual({ error: "Feedback not found." });
    expect(await updateFeedbackStatus(ID, "bogus" as never)).toEqual({ error: "Invalid feedback status." });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("reports a missing row", async () => {
    mocks.getSession.mockResolvedValue(admin);
    mocks.returning.mockResolvedValue([]);
    const result = await updateFeedbackStatus(ID, "in_review");
    expect(result.error).toMatch(/not found/i);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("updates status and revalidates dashboard and feedback pages", async () => {
    mocks.getSession.mockResolvedValue(admin);
    expect(await updateFeedbackStatus(ID, "resolved")).toEqual({});
    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ status: "resolved", updatedAt: expect.any(Date) }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/feedback");
  });
});

describe("updateFeedback message edits", () => {
  it("blocks admins from editing a student's message", async () => {
    mocks.getSession.mockResolvedValue(admin);
    mocks.findFirst.mockResolvedValue({ id: ID, studentId: "s1" });
    await expect(updateFeedback(ID, "changed")).rejects.toThrow("Only the author");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("lets the author edit their own message", async () => {
    mocks.getSession.mockResolvedValue(student);
    mocks.findFirst.mockResolvedValue({ id: ID, studentId: "s1" });
    await updateFeedback(ID, "  changed ");
    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ message: "changed" }));
  });
});

describe("isRecentFeedback", () => {
  const now = new Date("2026-10-07T00:00:00Z");
  it("treats the last 7 days as recent", () => {
    expect(isRecentFeedback(new Date("2026-10-01T00:00:00Z"), now)).toBe(true);
    expect(isRecentFeedback(new Date("2026-09-29T00:00:00Z"), now)).toBe(false);
  });
});
