import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), insert: vi.fn(), values: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/db/client", () => ({ db: { insert: mocks.insert } }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { requireAdmin, requireStudentOrAdmin } from "../dal";
import { submitFeedback } from "../../../app/students/[id]/feedback/new/actions";

beforeEach(() => { vi.clearAllMocks(); mocks.insert.mockReturnValue({ values: mocks.values }); });
const student = { userId: "owner", username: "Student", role: "student" };
function form() { const data = new FormData(); data.set("message", "  A route issue  "); return data; }

describe("private student data and feedback entry points", () => {
  it("denies guests before feedback is written", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(submitFeedback("owner", form())).rejects.toThrow("redirect:/login");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("denies a student submitting as another student", async () => {
    mocks.getSession.mockResolvedValue(student);
    await expect(submitFeedback("other", form())).rejects.toThrow("redirect:/");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("allows an owner to submit and revalidates only their feedback", async () => {
    mocks.getSession.mockResolvedValue(student);
    await expect(submitFeedback("owner", form())).rejects.toThrow("redirect:/students/owner/feedback");
    expect(mocks.values).toHaveBeenCalledWith({ studentId: "owner", message: "A route issue" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/students/owner/feedback");
  });
  it("denies students protected admin functions", async () => {
    mocks.getSession.mockResolvedValue(student);
    await expect(requireAdmin()).rejects.toThrow("redirect:/admin/login");
  });
  it("preserves authorised admin access to student records", async () => {
    const admin = { ...student, role: "admin" }; mocks.getSession.mockResolvedValue(admin);
    await expect(requireStudentOrAdmin("other")).resolves.toEqual(admin);
  });
});
