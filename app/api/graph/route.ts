import { asc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { navigationEdges, navigationNodes } from "@/lib/navigation/schema";

type Coordinate = [number, number];

function parseGeometry(geometry: string | null): Coordinate[] | null {
  if (!geometry) return null;

  const match = geometry.match(/LINESTRING\s*\((.+)\)/i);
  if (!match) return null;

  const coordinates = match[1].split(",").flatMap((point) => {
    const [longitude, latitude] = point.trim().split(/\s+/).map(Number);
    return Number.isFinite(latitude) && Number.isFinite(longitude)
      ? ([[latitude, longitude]] as Coordinate[])
      : [];
  });

  return coordinates.length >= 2 ? coordinates : null;
}

export async function GET() {
  try {
    const [nodes, edges] = await Promise.all([
      db.select().from(navigationNodes),
      db.select().from(navigationEdges).orderBy(asc(navigationEdges.id)),
    ]);
    const nodeById = new Map(nodes.map((node) => [node.id, node]));

    const result = edges.flatMap((edge) => {
      const from = nodeById.get(edge.fromNode);
      const to = nodeById.get(edge.toNode);
      if (!from || !to) return [];

      return [
        parseGeometry(edge.geometry) ?? [
          [from.latitude, from.longitude],
          [to.latitude, to.longitude],
        ],
      ];
    });

    return Response.json({ edges: result, nodeCount: nodes.length });
  } catch (error) {
    console.error("Failed to load navigation graph:", error);
    return Response.json(
      { error: "The navigation graph could not be loaded." },
      { status: 500 },
    );
  }
}