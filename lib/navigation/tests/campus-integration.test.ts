import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import buildings from "@/api/buildings.json";
import reference from "./fixtures/networkx-reference.json";
import policy from "../pedestrian-restrictions.json";
import { publicOutdoorGraph } from "../public-outdoor";
import { nodes, edges } from "./real-campus-graph";

const mocks = vi.hoisted(() => ({ select: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ db: { select: mocks.select } }));
// route.ts reads the signed-in student's walking preference (server-only session
// code). These checks are for guests, so use the guest default.
vi.mock("@/lib/students/walking-preference", () => ({
  getWalkingPreference: async () => ({ walkingSpeed: "normal", personalised: false }),
}));
import { POST } from "@/app/api/route/route";

const byId = new Map(buildings.map((b) => [b.id, b]));
async function calculate(start: { latitude: number; longitude: number }, end: { latitude: number; longitude: number }, filtered = false) {
  const graph = filtered ? publicOutdoorGraph(nodes, edges) : { nodes, edges };
  mocks.from.mockResolvedValueOnce(graph.nodes).mockResolvedValueOnce(graph.edges);
  const response = await POST(new Request("https://example.test/api/route", { method: "POST", body: JSON.stringify({
    startLatitude: start.latitude, startLongitude: start.longitude,
    destinationLatitude: end.latitude, destinationLongitude: end.longitude,
  }) }));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  return response.json();
}
beforeEach(() => { vi.clearAllMocks(); mocks.select.mockReturnValue({ from: mocks.from }); });

describe("real-campus route handler versus independent NetworkX reference", () => {
  it("uses current source data and the same filtered graph as the Python importer", () => {
    for (const [path, hash] of Object.entries(reference.sha256)) {
      const bytes = readFileSync(new URL(`../../../${path}`, import.meta.url));
      expect(createHash("sha256").update(bytes).digest("hex"), `regenerate reference for ${path}`).toBe(hash);
    }
    expect(policy.sha256).toBe(reference.sha256["components/monash_graph.graphml"]);
    const publicGraph = publicOutdoorGraph(nodes, edges);
    expect(publicGraph.nodes.length).toBe(reference.nodes);
    expect(publicGraph.edges.length).toBe(reference.edges);
    expect(publicGraph.nodes.some((n) => n.id === 12478159822)).toBe(false);
    for (const entrance of [7764050705, 6801226848]) expect(publicGraph.nodes.some((n) => n.id === entrance)).toBe(true);
    expect(reference.routes.length).toBe(182);
  });

  it.each(reference.routes)("$start → $end agrees with NetworkX ($distanceMeters m)", async (expected) => {
    const result = await calculate(byId.get(expected.start)!, byId.get(expected.end)!);
    expect(result.distanceMeters).toBe(expected.distanceMeters);
    expect(result.route.length).toBeGreaterThan(1);
    expect(result.route).not.toContainEqual([-37.9118476, 145.1328445]);
  });

  it("also filters map selections outside the 12-metre building matching radius", async () => {
    const point = { latitude: -37.91180, longitude: 145.13283 };
    const result = await calculate(point, byId.get("monash-it")!);
    expect(result.route).not.toContainEqual([-37.9118476, 145.1328445]);
    expect(result.distanceMeters).toBeLessThan(300);
  });

  it("matches already-imported public graph rows without needing a shared-database rewrite", async () => {
    const start = byId.get("campus-centre")!;
    const end = byId.get("menzies")!;
    expect(await calculate(start, end, true)).toEqual(await calculate(start, end));
  });
});
