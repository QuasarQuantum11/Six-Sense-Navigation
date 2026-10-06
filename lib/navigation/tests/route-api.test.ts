import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ select: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ db: { select: mocks.select } }));
import { GET, POST } from "../../../app/api/route/route";
import { POST as ltbPost } from "../../../app/api/ltb-route/route";

const coordinates = { start_lat: -37.908, start_lon: 145.138, end_lat: -37.909, end_lon: 145.139 };
function request(input: unknown) { return new Request("https://example.test/api/route", { method: "POST", body: JSON.stringify(input) }); }
beforeEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); mocks.select.mockReturnValue({ from: mocks.from }); });

describe("private coordinate routing", () => {
  it.each([{}, { ...coordinates, start_lat: 91 }, { ...coordinates, end_lon: 181 }, { ...coordinates, start_lon: "145" }, { ...coordinates, start_lat: null }])("rejects invalid input before reading the graph", async (input) => {
    const result = await POST(request(input));
    expect(result.status).toBe(400); expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it("does not treat missing legacy query coordinates as zero", async () => {
    expect((await GET(new Request("https://example.test/api/route"))).status).toBe(400);
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it("calculates a POST route and prevents response caching", async () => {
    mocks.from.mockResolvedValueOnce([
      { id: 1, latitude: coordinates.start_lat, longitude: coordinates.start_lon },
      { id: 2, latitude: coordinates.end_lat, longitude: coordinates.end_lon },
    ]).mockResolvedValueOnce([{ fromNode: 1, toNode: 2, length: 150, weight: 150 }]);
    const result = await POST(request(coordinates));
    expect(result.status).toBe(200); expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(await result.json()).toMatchObject({ distanceMeters: 150, route: [[-37.908, 145.138], [-37.909, 145.139]] });
  });
  it("forwards LTB coordinates only in the body and drops unrelated data", async () => {
    vi.stubEnv("API_BASE_URL", "https://routing.example.test");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ indoor_path: [{ id: "G_N01" }] })); vi.stubGlobal("fetch", fetchMock);
    const result = await ltbPost(request({ ...coordinates, end_node: "G_N01", studentId: "private" }));
    expect(result.status).toBe(200);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://routing.example.test/api/ltb-route");
    expect(JSON.parse(options.body)).toEqual({ start_lat: coordinates.start_lat, start_lon: coordinates.start_lon, end_node: "G_N01" });
    expect(options).toMatchObject({ method: "POST", cache: "no-store", redirect: "error" });
  });
  it("refuses insecure production upstreams", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("API_BASE_URL", "http://routing.example.test");
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const result = await ltbPost(request({ ...coordinates, end_node: "G_N01" }));
    expect(result.status).toBe(502); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not expose upstream error details", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("secret connection details")); vi.stubGlobal("fetch", fetchMock);
    const result = await ltbPost(request({ ...coordinates, end_node: "G_N01" }));
    expect(result.status).toBe(502); expect(await result.text()).not.toContain("secret");
  });
});
