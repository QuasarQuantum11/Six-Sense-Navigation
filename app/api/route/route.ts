import { db } from "@/lib/db/client";
import { navigationEdges, navigationNodes } from "@/lib/navigation/schema";
import { routeInputSchema, privateRouteHeaders } from "@/lib/navigation/route-input";

type Node = typeof navigationNodes.$inferSelect;
type Edge = typeof navigationEdges.$inferSelect;

function nearestNode(nodes: Node[], latitude: number, longitude: number): Node | null {
  return nodes.reduce<Node | null>((nearest, node) => {
    if (!nearest) return node;

    const nearestDistance =
      (nearest.latitude - latitude) ** 2 + (nearest.longitude - longitude) ** 2;
    const nodeDistance =
      (node.latitude - latitude) ** 2 + (node.longitude - longitude) ** 2;
    return nodeDistance < nearestDistance ? node : nearest;
  }, null);
}

function findPath(nodes: Node[], edges: Edge[], startId: number, destinationId: number): number[] | null {
  const distances = new Map(nodes.map((node) => [node.id, Infinity]));
  const previous = new Map<number, number>();
  const unvisited = new Set(nodes.map((node) => node.id));
  distances.set(startId, 0);

  while (unvisited.size > 0) {
    const currentId = [...unvisited].reduce<number | null>((closest, nodeId) => {
      if (closest === null) return nodeId;
      return (distances.get(nodeId) ?? Infinity) < (distances.get(closest) ?? Infinity)
        ? nodeId
        : closest;
    }, null);

    if (currentId === null || !Number.isFinite(distances.get(currentId))) break;
    unvisited.delete(currentId);
    if (currentId === destinationId) break;

    for (const edge of edges) {
      if (edge.fromNode !== currentId || !unvisited.has(edge.toNode)) continue;
      const candidate = (distances.get(currentId) ?? Infinity) + (edge.weight ?? edge.length);
      if (candidate < (distances.get(edge.toNode) ?? Infinity)) {
        distances.set(edge.toNode, candidate);
        previous.set(edge.toNode, currentId);
      }
    }
  }

  if (!Number.isFinite(distances.get(destinationId))) return null;

  const path: number[] = [];
  for (let currentId: number | undefined = destinationId; currentId !== undefined; currentId = previous.get(currentId)) {
    path.push(currentId);
    if (currentId === startId) return path.reverse();
  }
  return null;
}

// Real walking length of a path, from each edge's OpenStreetMap length (the
// drawn route only joins nodes with straight lines). Uses `length`, not the
// routing `weight`, which may be adjusted for preferences.
function pathLengthMeters(edges: Edge[], nodeIds: number[]): number {
  const shortestEdge = new Map<string, number>();
  for (const edge of edges) {
    const key = `${edge.fromNode}:${edge.toNode}`;
    shortestEdge.set(key, Math.min(shortestEdge.get(key) ?? Infinity, edge.length));
  }

  let total = 0;
  for (let index = 0; index < nodeIds.length - 1; index += 1) {
    total += shortestEdge.get(`${nodeIds[index]}:${nodeIds[index + 1]}`) ?? 0;
  }
  return total;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const input = Object.fromEntries(["start_lat", "start_lon", "end_lat", "end_lon"].map((key) => {
    const value = params.get(key);
    return [key, value?.trim() ? Number(value) : undefined];
  }));
  return calculateRoute(input);
}

export async function POST(request: Request) {
  try {
    return await calculateRoute(await request.json());
  } catch {
    return Response.json({ error: "A JSON route request is required." }, { status: 400, headers: privateRouteHeaders });
  }
}

async function calculateRoute(input: unknown) {
  const parsed = routeInputSchema.safeParse(input);
  if (!parsed.success) {
    return Response.json(
      { error: "Valid start_lat, start_lon, end_lat, and end_lon coordinates are required." },
      { status: 400, headers: privateRouteHeaders },
    );
  }

  try {
    const [nodes, edges] = await Promise.all([
      db.select().from(navigationNodes),
      db.select().from(navigationEdges),
    ]);
    const { start_lat: startLatitude, start_lon: startLongitude, end_lat: endLatitude, end_lon: endLongitude } = parsed.data;
    const start = nearestNode(nodes, startLatitude, startLongitude);
    const destination = nearestNode(nodes, endLatitude, endLongitude);

    if (!start || !destination) {
      return Response.json({ error: "The navigation graph is empty." }, { status: 503, headers: privateRouteHeaders });
    }

    const nodeIds = findPath(nodes, edges, start.id, destination.id);
    if (!nodeIds) return Response.json({ error: "No route was found." }, { status: 404, headers: privateRouteHeaders });

    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const route = nodeIds.flatMap((nodeId) => {
      const node = nodeById.get(nodeId);
      return node ? ([[node.latitude, node.longitude]] as [number, number][]) : [];
    });

    return Response.json({
      route,
      distanceMeters: pathLengthMeters(edges, nodeIds),
      startNode: start.id,
      destinationNode: destination.id,
    }, { headers: privateRouteHeaders });
  } catch {
    console.error("Failed to calculate navigation route.");
    return Response.json(
      { error: "The navigation route could not be calculated." },
      { status: 500, headers: privateRouteHeaders },
    );
  }
}
