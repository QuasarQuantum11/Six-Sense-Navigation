import { describe, expect, it } from "vitest";
import ltbNodes from "@/api/ltb_nodes.json";
import {
    floorLabel,
    makeIndoorDirections,
    placeName,
    roomOptions,
    summariseIndoorRoute,
    type IndoorNode,
    type IndoorRouteNode,
} from "../indoor";

const nodes = ltbNodes as Record<string, IndoorNode>;
const path = (...ids: string[]): IndoorRouteNode[] => ids.map((id) => ({ id, ...nodes[id] }));
const texts = (route: IndoorRouteNode[]) => makeIndoorDirections(route).map((step) => step.text);

function node(id: string, x: number, y: number, extra: Partial<IndoorNode> = {}): IndoorRouteNode {
    return { id, floor: "G", type: "corridor", description: "", x_pixel: x, y_pixel: y, ...extra };
}

describe("indoor walking directions", () => {
    it("names left and right turns using floor-plan coordinates", () => {
        // Walking east, then south on screen (y grows downwards) is a right turn.
        expect(texts([node("a", 0, 0), node("b", 100, 0), node("c", 100, 100)])).toEqual([
            "Start at the entrance", "Turn right", "Arrive at your destination",
        ]);
        expect(texts([node("a", 0, 0), node("b", 100, 0), node("c", 100, -100)])[1]).toBe("Turn left");
        expect(texts([node("a", 0, 0), node("b", 100, 0), node("c", 200, -60)])[1]).toBe("Bear left");
    });

    it("calls an acute turn a sharp turn, not a U-turn", () => {
        expect(texts([node("a", 0, 0), node("b", 100, 0), node("c", 20, 40)])[1]).toBe("Turn sharp right");
        expect(texts([node("a", 0, 0), node("b", 100, 0), node("c", 0, 1)])[1]).toBe("Turn around");
    });

    it("skips unnamed straight corridor points but keeps named landmarks", () => {
        expect(texts([
            node("a", 0, 0), node("b", 50, 2), node("c", 100, 0, { type: "stairs", description: "Main Stairway" }), node("d", 150, 0),
        ])).toEqual(["Start at the entrance", "Continue past Main Stairway", "Arrive at your destination"]);
    });

    it("turns the real route to room 101 into one stairs step", () => {
        const steps = makeIndoorDirections(path("G_N01", "G_N08", "G_N16", "1_N04", "1_N14", "1_N42"));
        expect(steps.map((step) => step.text)).toEqual([
            "Start at Bus Loop Entrance",
            "Turn right",
            "Take the Side Stairway up to Floor 1",
            "Bear left",
            "Arrive at room 101",
        ]);
        expect(steps[2]).toMatchObject({ kind: "floor", floor: "1", nodeId: "1_N04" });
        expect(steps.some((step) => step.text === "Turn around")).toBe(false);
    });

    it("merges several floor changes into one lift step", () => {
        const steps = texts(path("G_N01", "G_N07", "G_N38", "G_N40", "G_N41", "1_N02", "2_N02", "3_N02", "3_N26", "3_N22", "3_N23", "3_N37"));
        expect(steps.filter((text) => text.startsWith("Take the"))).toEqual(["Take the External Lift up to Floor 3"]);
        expect(steps.at(-1)).toBe("Arrive at room 383");
    });

    it("hides internal entrance wording", () => {
        expect(texts(path("G_N01", "G_N08").map((n, i) => (i === 0 ? { ...n, description: "West candidate entrance" } : n)))[0])
            .toBe("Start at West entrance");
        expect(placeName({ description: "East candidate entrance" })).toBe("East entrance");
    });

    it("handles empty and single-point routes", () => {
        expect(makeIndoorDirections([])).toEqual([]);
        expect(texts([node("a", 0, 0)])).toEqual(["Start at the entrance"]);
    });
});

describe("LTB room options", () => {
    const options = roomOptions(nodes);

    it("lists every named room once, ground floor first", () => {
        const rooms = Object.values(nodes).filter((n) => n.type === "room" && n.description.trim());
        expect(options).toHaveLength(rooms.length);
        expect(new Set(options.map((o) => o.id)).size).toBe(options.length);
        expect(options[0].floor).toBe("G");
        expect(options.at(-1)!.floor).toBe("3");
    });

    it("never shows node IDs and gives every option a unique label", () => {
        expect(options.every((o) => !/[G\d]_N\d+/.test(o.name))).toBe(true);
        expect(new Set(options.map((o) => o.name)).size).toBe(options.length);
    });

    it("labels rooms with their floor and disambiguates shared names", () => {
        expect(options.find((o) => o.id === "1_N42")!.name).toBe(`101 · ${floorLabel("1")}`);
        expect(options.find((o) => o.id === "G_N61")!.name).toMatch(/^Accessible Toilets · Ground floor · near \S+/);
    });
});

describe("indoor route summary", () => {
    it("uses the combined estimate for a route that starts outside", () => {
        expect(summariseIndoorRoute({
            outdoor_distance_m: 370.7, indoor_horizontal_distance_m: 35.3, estimated_vertical_distance_m: 12,
            total_known_distance_m: 406, total_estimated_distance_m: 418, total_estimate_min_m: 414, total_estimate_max_m: 422,
            vertical_segments: 1, stair_segments: 1, lift_segments: 0,
        })).toEqual({
            totalMeters: 418, outdoorMeters: 370.7, indoorMeters: 35.3, verticalMeters: 12,
            minMeters: 414, maxMeters: 422, liftSegments: 0, stairSegments: 1,
        });
    });

    it("uses indoor fields for a room-to-room route", () => {
        expect(summariseIndoorRoute({
            indoor_horizontal_distance_m: 73.2, indoor_estimated_distance_m: 109.2, estimated_vertical_distance_m: 36,
            indoor_estimate_min_m: 86.7, indoor_estimate_max_m: 109.2, vertical_segments: 3, stair_segments: 3, lift_segments: 0,
        })).toMatchObject({ totalMeters: 109.2, outdoorMeters: null, minMeters: 86.7, stairSegments: 3 });
    });

    it("falls back to the measured distance on one floor and rejects bad data", () => {
        expect(summariseIndoorRoute({ indoor_horizontal_distance_m: 40, vertical_segments: 0, indoor_estimated_distance_m: null })!.totalMeters).toBe(40);
        expect(summariseIndoorRoute({ indoor_horizontal_distance_m: 40, vertical_segments: 2, indoor_estimated_distance_m: null })!.totalMeters).toBeNull();
        expect(summariseIndoorRoute({ error: "No route" })).toBeNull();
    });
});
