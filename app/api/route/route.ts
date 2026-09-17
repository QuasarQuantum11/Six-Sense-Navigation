import { db } from "@/lib/db/client";
import { navigationEdges, navigationNodes } from "@/lib/navigation/schema";

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

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const values = ["start_lat", "start_lon", "end_lat", "end_lon"].map((key) =>
    Number(params.get(key)),
  );

  if (values.some((value) => !Number.isFinite(value))) {
    return Response.json(
      { error: "start_lat, start_lon, end_lat, and end_lon are required numbers." },
      { status: 400 },
    );
  }

  try {
    const [nodes, edges] = await Promise.all([
      db.select().from(navigationNodes),
      db.select().from(navigationEdges),
    ]);
    const [startLatitude, startLongitude, endLatitude, endLongitude] = values;
    const start = nearestNode(nodes, startLatitude, startLongitude);
    const destination = nearestNode(nodes, endLatitude, endLongitude);

    if (!start || !destination) {
      return Response.json({ error: "The navigation graph is empty." }, { status: 503 });
    }

    const nodeIds = findPath(nodes, edges, start.id, destination.id);
    if (!nodeIds) return Response.json({ error: "No route was found." }, { status: 404 });

    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const route = nodeIds.flatMap((nodeId) => {
      const node = nodeById.get(nodeId);
      return node ? ([[node.latitude, node.longitude]] as [number, number][]) : [];
    });

    return Response.json({ route, startNode: start.id, destinationNode: destination.id });
  } catch (error) {
    console.error("Failed to calculate navigation route:", error);
    return Response.json(
      { error: "The navigation route could not be calculated." },
      { status: 500 },
    );
  }
}