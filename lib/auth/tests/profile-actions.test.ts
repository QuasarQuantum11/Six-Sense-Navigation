import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(), hashPassword: vi.fn(), select: vi.fn(),
  limit: vi.fn(), update: vi.fn(), set: vi.fn(), where: vi.fn(), revalidatePath: vi.fn(),
}));
vi.mock("@/lib/auth/dal", () => ({ verifySession: mocks.verifySession }));
vi.mock("@/lib/auth/password", () => ({ hashPassword: mocks.hashPassword }));
vi.mock("@/lib/db/client", () => ({ db: { select: mocks.select, update: mocks.update } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
import { updateProfile } from "../../../app/profile-actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verifySession.mockResolvedValue({ userId: "owner", role: "student" });
  mocks.select.mockReturnValue({ from: () => ({ where: () => ({ limit: mocks.limit }) }) });
  mocks.limit.mockResolvedValue([]);
  mocks.update.mockReturnValue({ set: mocks.set });
  mocks.set.mockReturnValue({ where: mocks.where });
  mocks.hashPassword.mockResolvedValue("salted-hash");
});

describe("profile server action", () => {
  it.each(["short", "letters-only", "123456789", "        "])("rejects weak password %j before any database access", async password => {
    await expect(updateProfile("student", "a@example.com", "normal", password)).rejects.toThrow();
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.hashPassword).not.toHaveBeenCalled();
  });
  it.each([
    ["x", "a@example.com", "normal"],
    ["bad name", "a@example.com", "normal"],
    ["student", "not-email", "normal"],
    ["student", "a@example.com", "flying"],
  ])("validates profile fields on the server", async (username, email, speed) => {
    await expect(updateProfile(username, email, speed as "normal")).rejects.toThrow();
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each(["", undefined])("preserves the existing password for %j", async password => {
    await updateProfile(" student ", " A@EXAMPLE.COM ", "normal", password);
    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ username: "student", email: "a@example.com" }));
    expect(mocks.set.mock.calls[0][0]).not.toHaveProperty("passwordHash");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/profile");
  });
  it("hashes a strong password without changing intentional spaces", async () => {
    await updateProfile("student", "a@example.com", "normal", " StrongPass123 ");
    expect(mocks.hashPassword).toHaveBeenCalledWith(" StrongPass123 ");
    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ passwordHash: "salted-hash" }));
  });
  it("denies administrators editing a student profile", async () => {
    mocks.verifySession.mockResolvedValue({ userId: "admin", role: "admin" });
    await expect(updateProfile("student", "a@example.com", "normal")).rejects.toThrow("Only student profiles");
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it("denies guests before any database access", async () => {
    mocks.verifySession.mockRejectedValue(new Error("Sign in required"));
    await expect(updateProfile("student", "a@example.com", "normal")).rejects.toThrow("Sign in required");
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it("rejects a conflict belonging to another student", async () => {
    mocks.limit.mockResolvedValue([{ id: "other" }]);
    await expect(updateProfile("student", "a@example.com", "normal")).rejects.toThrow("already in use");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
