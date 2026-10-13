import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ select: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ db: { select: mocks.select } }));
import { GET, POST } from "../../../app/api/route/route";
import { POST as ltbPost } from "../../../app/api/ltb-route/route";

const coordinates = { startLatitude: -37.908, startLongitude: 145.138, destinationLatitude: -37.909, destinationLongitude: 145.139 };
const ltbCoordinates = { start_lat: coordinates.startLatitude, start_lon: coordinates.startLongitude };
function request(input: unknown) { return new Request("https://example.test/api/route", { method: "POST", body: JSON.stringify(input) }); }
beforeEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); mocks.select.mockReturnValue({ from: mocks.from }); });

describe("private coordinate routing", () => {
  it.each([{}, { ...coordinates, startLatitude: 999 }, { ...coordinates, destinationLongitude: 181 }, { ...coordinates, startLongitude: "invalid" }, { ...coordinates, startLatitude: null }, null, [], { ...coordinates, startLatitude: true }])("rejects invalid input before reading the graph", async (input) => {
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
      { id: 1, latitude: coordinates.startLatitude, longitude: coordinates.startLongitude },
      { id: 2, latitude: coordinates.destinationLatitude, longitude: coordinates.destinationLongitude },
    ]).mockResolvedValueOnce([{ fromNode: 1, toNode: 2, length: 150, weight: 150 }]);
    const result = await POST(request(coordinates));
    expect(result.status).toBe(200); expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(await result.json()).toMatchObject({ distanceMeters: 150, route: [[-37.908, 145.138], [-37.909, 145.139]] });
  });
  it("returns zero distance for identical locations without reading the graph", async () => {
    const result = await POST(request({ ...coordinates, destinationLatitude: coordinates.startLatitude, destinationLongitude: coordinates.startLongitude }));
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(await result.json()).toMatchObject({ distanceMeters: 0, route: [[-37.908, 145.138], [-37.908, 145.138]] });
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it("accepts numeric strings and the legacy coordinate names", async () => {
    for (const input of [Object.fromEntries(Object.entries(coordinates).map(([key, value]) => [key, String(value)])),
      { start_lat: coordinates.startLatitude, start_lon: coordinates.startLongitude, end_lat: coordinates.destinationLatitude, end_lon: coordinates.destinationLongitude }]) {
      mocks.from.mockResolvedValueOnce([
        { id: 1, latitude: coordinates.startLatitude, longitude: coordinates.startLongitude },
        { id: 2, latitude: coordinates.destinationLatitude, longitude: coordinates.destinationLongitude },
      ]).mockResolvedValueOnce([{ fromNode: 1, toNode: 2, length: 150 }]);
      expect((await POST(request(input))).status).toBe(200);
    }
  });
  it("rejects malformed JSON without exposing parser details", async () => {
    const result = await POST(new Request("https://example.test/api/route", { method: "POST", body: "{" }));
    expect(result.status).toBe(400);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(await result.text()).not.toMatch(/SyntaxError|position|Unexpected/);
  });
  it("gives a private, friendly 422 for points more than 100 metres from the graph", async () => {
    mocks.from.mockResolvedValueOnce([
      { id: 1, latitude: coordinates.startLatitude, longitude: coordinates.startLongitude },
      { id: 2, latitude: coordinates.destinationLatitude, longitude: coordinates.destinationLongitude },
    ]).mockResolvedValueOnce([{ fromNode: 1, toNode: 2, length: 150 }]);
    const result = await POST(request({ ...coordinates, startLatitude: -37.5 }));
    expect(result.status).toBe(422);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(await result.text()).toContain("100 metres");
  });
  it("does not expose raw database failures in responses or logs", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.from.mockRejectedValue(new Error("secret connection details"));
    const result = await POST(request(coordinates));
    expect(result.status).toBe(500);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(await result.text()).not.toContain("secret");
    expect(logger).toHaveBeenCalledWith("Walking route calculation failed.");
    logger.mockRestore();
  });
  it("draws the selected shortest parallel edge geometry in the correct direction", async () => {
    const nodes = [
      { id: 1, latitude: coordinates.startLatitude, longitude: coordinates.startLongitude },
      { id: 2, latitude: coordinates.destinationLatitude, longitude: coordinates.destinationLongitude },
    ];
    const edges = [
      { fromNode: 1, toNode: 2, length: 150, geometry: "LINESTRING (145.139 -37.909, 145.1384 -37.9086, 145.138 -37.908)" },
      { fromNode: 1, toNode: 2, length: 300, geometry: "LINESTRING (145.138 -37.908, 145.140 -37.910, 145.139 -37.909)" },
    ];
    for (const [input, expected] of [
      [coordinates, [[-37.908, 145.138], [-37.9086, 145.1384], [-37.909, 145.139]]],
      [{ startLatitude: coordinates.destinationLatitude, startLongitude: coordinates.destinationLongitude, destinationLatitude: coordinates.startLatitude, destinationLongitude: coordinates.startLongitude }, [[-37.909, 145.139], [-37.9086, 145.1384], [-37.908, 145.138]]],
    ] as const) {
      mocks.from.mockResolvedValueOnce(nodes).mockResolvedValueOnce(edges);
      const result = await POST(request(input));
      expect(result.status).toBe(200);
      expect(await result.json()).toMatchObject({ distanceMeters: 150, route: expected });
    }
  });
  it("forwards LTB coordinates only in the body and drops unrelated data", async () => {
    vi.stubEnv("API_BASE_URL", "https://routing.example.test");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ indoor_path: [{ id: "G_N01" }] })); vi.stubGlobal("fetch", fetchMock);
    const result = await ltbPost(request({ ...ltbCoordinates, end_node: "G_N01", walking_speed: "accessible", studentId: "private" }));
    expect(result.status).toBe(200);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://routing.example.test/api/ltb-route");
    expect(JSON.parse(options.body)).toEqual({ ...ltbCoordinates, end_node: "G_N01", walking_speed: "accessible" });
    expect(options).toMatchObject({ method: "POST", cache: "no-store", redirect: "error" });
  });
  it("refuses insecure production upstreams", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("API_BASE_URL", "http://routing.example.test");
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const result = await ltbPost(request({ ...ltbCoordinates, end_node: "G_N01" }));
    expect(result.status).toBe(502); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not expose upstream error details", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("secret connection details")); vi.stubGlobal("fetch", fetchMock);
    const result = await ltbPost(request({ ...ltbCoordinates, end_node: "G_N01" }));
    expect(result.status).toBe(502); expect(await result.text()).not.toContain("secret");
  });
});
