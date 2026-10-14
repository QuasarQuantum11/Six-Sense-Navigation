import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getSession: vi.fn(), readRealCrowdData: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/crowd/data", () => ({ readRealCrowdData: mocks.readRealCrowdData, isMissingCrowdTable: (e: { code?: string }) => e.code === "42P01" }));
import { POST } from "../../../app/api/crowd-estimates/route";
const request = (input: unknown) => new Request("http://example.test/api/crowd-estimates", { method: "POST", body: JSON.stringify(input) });
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-06T22:00:00Z"));
  mocks.getSession.mockResolvedValue({ role: "student", userId: "private-user" });
  mocks.readRealCrowdData.mockResolvedValue({ buildings: [], classes: [], participants: [] });
});
afterEach(() => vi.useRealTimers());

describe("crowd API isolation", () => {
  it("denies guests before reading any timetable data", async () => {
    mocks.getSession.mockResolvedValue(null);
    const response = await POST(request({ mode: "demo" }));
    expect(response.status).toBe(401); expect(mocks.readRealCrowdData).not.toHaveBeenCalled();
  });
  it("runs the simulation without any real data query", async () => {
    const response = await POST(request({ mode: "demo" }));
    const body = await response.json();
    expect(response.status).toBe(200); expect(body.mode).toBe("demo");
    expect(body.buildings.map((b: { level: string }) => b.level)).toEqual(["high", "medium", "low"]);
    expect(mocks.readRealCrowdData).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("does not substitute simulation for insufficient real data", async () => {
    const response = await POST(request({ mode: "real" })); const body = await response.json();
    expect(body.mode).toBe("real"); expect(body.buildings).toEqual([]);
    expect(body.notices.join(" ")).toContain("Insufficient");
    expect(mocks.readRealCrowdData).toHaveBeenCalledOnce();
  });
  it("reports missing setup without inventing an estimate", async () => {
    mocks.readRealCrowdData.mockRejectedValue({ code: "42P01" });
    const response = await POST(request({ mode: "real" }));
    expect(response.status).toBe(503); expect(await response.text()).toContain("not set up");
  });
  it.each([{ mode: "bad" }, { mode: "real", studentId: "other" }, { mode: "demo", date: "2026-10-08", time: "10:00" }, { mode: "real", date: "2026-10-07" }])("rejects invalid input %j before data access", async input => {
    const response = await POST(request(input)); expect(response.status).toBe(400);
    expect(mocks.readRealCrowdData).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("does not leak database error details", async () => {
    mocks.readRealCrowdData.mockRejectedValue(new Error("private database connection details"));
    const response = await POST(request({ mode: "real" }));
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("connection details");
  });
});
