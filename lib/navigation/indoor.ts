// Helpers for the LTB indoor route: room labels, walking directions and a
// distance summary shared by the outdoor-to-room and room-to-room flows.

export type IndoorNode = {
    floor: string;
    type: string;
    description: string;
    x_pixel: number;
    y_pixel: number;
};

export type IndoorRouteNode = IndoorNode & { id: string };

export type RoomOption = { id: string; name: string; floor: string };

export type IndoorStep = {
    kind: "start" | "turn" | "floor" | "arrive";
    text: string;
    floor: string;
    nodeId: string;
};

export type IndoorRouteSummary = {
    // Best estimate of the whole route, or null if it could not be estimated.
    totalMeters: number | null;
    // Only present for routes that start outside the LTB.
    outdoorMeters: number | null;
    indoorMeters: number;
    verticalMeters: number | null;
    minMeters: number | null;
    maxMeters: number | null;
    liftSegments: number;
    stairSegments: number;
};

export const FLOORS = ["G", "1", "2", "3"] as const;

export function floorRank(floor: string): number {
    return FLOORS.indexOf(floor as (typeof FLOORS)[number]);
}

export function floorLabel(floor: string): string {
    return floor === "G" ? "Ground floor" : `Floor ${floor}`;
}

// A node's name for users, without internal wording such as "candidate".
export function placeName(node: Pick<IndoorNode, "description">): string | null {
    const name = node.description.replace(/\s*candidate\b/i, "").replace(/\s+/g, " ").trim();
    return name || null;
}

// Room numbers such as "101", "G01" or "165B" read better as "room 101".
function spokenPlace(node: IndoorNode, fallback: string): string {
    const name = placeName(node);
    if (!name) return fallback;
    return /^(G|\d)\d*[A-Z]?$/.test(name) ? `room ${name}` : name;
}

// Selectable LTB rooms, ordered by floor then name. Rooms that share a name
// (toilets, study areas, kitchens) also name the closest uniquely named room
// on the same floor, so users never need internal node IDs to tell them apart.
export function roomOptions(nodes: Record<string, IndoorNode>): RoomOption[] {
    const rooms = Object.entries(nodes).filter(
        ([, node]) => node.type === "room" && placeName(node),
    );
    const counts = new Map<string, number>();
    for (const [, node] of rooms) {
        const name = placeName(node)!;
        counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const landmarks = rooms.filter(([, node]) => counts.get(placeName(node)!) === 1);

    return rooms
        .map(([id, node]) => {
            const name = placeName(node)!;
            let label = `${name} · ${floorLabel(node.floor)}`;
            if (counts.get(name)! > 1) {
                let nearest: string | null = null;
                let best = Infinity;
                for (const [, other] of landmarks) {
                    if (other.floor !== node.floor) continue;
                    const distance = Math.hypot(other.x_pixel - node.x_pixel, other.y_pixel - node.y_pixel);
                    if (distance < best) {
                        best = distance;
                        nearest = placeName(other);
                    }
                }
                if (nearest) label += ` · near ${nearest}`;
            }
            return { id, name: label, floor: node.floor, sortName: name };
        })
        .sort((a, b) =>
            floorRank(a.floor) - floorRank(b.floor) ||
            a.sortName.localeCompare(b.sortName, undefined, { numeric: true }) ||
            a.name.localeCompare(b.name, undefined, { numeric: true }) ||
            a.id.localeCompare(b.id, undefined, { numeric: true }),
        )
        .map(({ id, name, floor }, index, all) => {
            // Many study areas share the same nearby room; number those.
            const same = all.filter((option) => option.name === name);
            if (same.length === 1) return { id, name, floor };
            return { id, name: `${name} (${same.findIndex((option) => option.id === id) + 1})`, floor };
        });
}

// Signed turn angle in degrees at `node`; negative is left because floor-plan
// y-coordinates increase downwards.
function turnAngle(previous: IndoorNode, node: IndoorNode, next: IndoorNode): number {
    const ax = node.x_pixel - previous.x_pixel;
    const ay = node.y_pixel - previous.y_pixel;
    const bx = next.x_pixel - node.x_pixel;
    const by = next.y_pixel - node.y_pixel;
    return (Math.atan2(ax * by - ay * bx, ax * bx + ay * by) * 180) / Math.PI;
}

function turnText(angle: number): string | null {
    const size = Math.abs(angle);
    const side = angle < 0 ? "left" : "right";
    if (size < 25) return null;
    if (size < 50) return `Bear ${side}`;
    if (size < 135) return `Turn ${side}`;
    if (size < 165) return `Turn sharp ${side}`;
    return "Turn around";
}

// Walking directions for an indoor route. Straight corridor points without a
// name are skipped, and a run of floor changes becomes one "take the lift /
// stairs" step that names the connector used.
export function makeIndoorDirections(route: IndoorRouteNode[]): IndoorStep[] {
    if (route.length === 0) return [];

    const steps: IndoorStep[] = [{
        kind: "start",
        text: `Start at ${spokenPlace(route[0], "the entrance")}`,
        floor: route[0].floor,
        nodeId: route[0].id,
    }];

    for (let i = 1; i < route.length; i++) {
        const previous = route[i - 1];
        const node = route[i];

        if (node.floor !== previous.floor) {
            let last = i;
            while (last + 1 < route.length && route[last + 1].floor !== route[last].floor) last++;
            const target = route[last];
            const connector = placeName(previous) ?? (previous.type === "lift" ? "lift" : "stairs");
            const direction = floorRank(target.floor) > floorRank(previous.floor) ? "up" : "down";
            steps.push({
                kind: "floor",
                text: `Take the ${connector} ${direction} to ${floorLabel(target.floor)}`,
                floor: target.floor,
                nodeId: target.id,
            });
            i = last;
            continue;
        }

        if (i === route.length - 1) break;

        const next = route[i + 1];
        // The connector itself is described by the floor-change step.
        if (next.floor !== node.floor) continue;

        const turn = turnText(turnAngle(previous, node, next));
        const name = placeName(node);
        if (turn) {
            steps.push({ kind: "turn", text: name ? `${turn} at ${name}` : turn, floor: node.floor, nodeId: node.id });
        } else if (name && node.type !== "corridor") {
            steps.push({ kind: "turn", text: `Continue past ${name}`, floor: node.floor, nodeId: node.id });
        }
    }

    const last = route[route.length - 1];
    if (route.length > 1) {
        steps.push({
            kind: "arrive",
            text: `Arrive at ${spokenPlace(last, "your destination")}`,
            floor: last.floor,
            nodeId: last.id,
        });
    }
    return steps;
}

const num = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;

// Normalises the distance fields of /api/ltb-route (outdoor start) and
// /api/indoor-route (room start) into one shape for the interface.
export function summariseIndoorRoute(data: Record<string, unknown>): IndoorRouteSummary | null {
    const indoorMeters = num(data.indoor_horizontal_distance_m);
    if (indoorMeters === null) return null;

    const vertical = num(data.vertical_segments) ?? 0;
    const outdoorMeters = num(data.outdoor_distance_m);
    const fromOutside = outdoorMeters !== null;

    const estimate = num(fromOutside ? data.total_estimated_distance_m : data.indoor_estimated_distance_m);
    const known = fromOutside ? num(data.total_known_distance_m) : indoorMeters;

    return {
        totalMeters: estimate ?? (vertical === 0 ? known : null),
        outdoorMeters,
        indoorMeters,
        verticalMeters: num(data.estimated_vertical_distance_m),
        minMeters: num(fromOutside ? data.total_estimate_min_m : data.indoor_estimate_min_m),
        maxMeters: num(fromOutside ? data.total_estimate_max_m : data.indoor_estimate_max_m),
        liftSegments: num(data.lift_segments) ?? 0,
        stairSegments: num(data.stair_segments) ?? 0,
    };
}
