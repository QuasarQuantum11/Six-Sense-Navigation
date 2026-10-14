import { NextResponse } from "next/server";
import { outdoorRouteInputSchema, privateRouteHeaders } from "@/lib/navigation/route-input";
import { publicOutdoorGraph } from "@/lib/navigation/public-outdoor";
import ltbEntrances from "@/api/ltb_entrances.json";
import campusCentreEntrances from "@/api/campus_centre_entrances.json";
const ltbSearchEntrance = ltbEntrances.entrances.find((entry) => entry.id === ltbEntrances.building_search_entrance)!;
import { db } from "@/lib/db/client";
import {
  navigationEdges,
  navigationNodes,
} from "@/lib/navigation/schema";

type Node = {
  id: number;
  latitude: number;
  longitude: number;
  streetCount: number | null;
};

type Edge = {
  id: number;
  fromNode: number;
  toNode: number;
  osmid: number | null;
  highway: string | null;
  lanes: string | null;
  maxspeed: string | null;
  name: string | null;
  oneway: boolean | null;
  reversed: boolean | null;
  length: number;
  weight: number | null;
  geometry: string | null;
};

type Entrance = {
  name: string;
  latitude: number;
  longitude: number;
};

type Coordinate = [number, number];

const BUILDING_MATCH_DISTANCE = 12;
const MAX_CONNECTOR_DISTANCE = 100;

const BUILDINGS = {
  campusCentre: campusCentreEntrances,
  ltb: {
    centre: [ltbSearchEntrance.latitude, ltbSearchEntrance.longitude] as Coordinate,
    entrances: ltbEntrances.entrances.map((entry) => ({
      name: entry.label, latitude: entry.latitude, longitude: entry.longitude,
    })),
  },
};

function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestNode(
  nodes: Node[],
  latitude: number,
  longitude: number,
): Node | null {
  let nearest: Node | null = null;
  let nearestDistance = Infinity;

  for (const node of nodes) {
    const distance = distanceMeters(
      latitude,
      longitude,
      node.latitude,
      node.longitude,
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = node;
    }
  }

  if (nearestDistance > MAX_CONNECTOR_DISTANCE) {
    return null;
  }

  return nearest;
}

function getEntrances(
  latitude: number,
  longitude: number,
): Entrance[] {
  for (const building of Object.values(BUILDINGS)) {
    const [centreLat, centreLon] = building.centre;

    if (
      distanceMeters(
        latitude,
        longitude,
        centreLat,
        centreLon,
      ) <= BUILDING_MATCH_DISTANCE
    ) {
      return building.entrances;
    }
  }

  return [
    {
      name: "Selected location",
      latitude,
      longitude,
    },
  ];
}

function parseGeometry(geometry: string | null): Coordinate[] {
  if (!geometry) return [];

  try {
    const parsed = JSON.parse(geometry);

    if (parsed.type === "LineString" && Array.isArray(parsed.coordinates)) {
      return parsed.coordinates
        .filter(
          (point: unknown) =>
            Array.isArray(point) &&
            point.length >= 2 &&
            Number.isFinite(point[0]) &&
            Number.isFinite(point[1]),
        )
        .map((point: number[]) => [point[1], point[0]]);
    }

    if (Array.isArray(parsed)) {
      if (
        parsed.length > 0 &&
        Array.isArray(parsed[0]) &&
        typeof parsed[0][0] === "number"
      ) {
        return parsed.map((point: number[]) => [
          point[1],
          point[0],
        ]);
      }
    }
  } catch {
    // Try WKT format below.
  }

  const match = geometry.match(/LINESTRING(?:\s+Z)?\s*\((.+)\)/i);

  if (match) {
    return match[1]
      .split(",")
      .map((pair) => {
        const [longitude, latitude] = pair.trim().split(/\s+/).map(Number);
        return [latitude, longitude] as Coordinate;
      })
      .filter(
        ([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon),
      );
  }

  return [];
}

function getEdgeCoordinates(
  edge: Edge,
  fromNode: Node,
  toNode: Node,
): Coordinate[] {
  const geometry = parseGeometry(edge.geometry);

  if (geometry.length < 2) {
    return [
      [fromNode.latitude, fromNode.longitude],
      [toNode.latitude, toNode.longitude],
    ];
  }

  const first = geometry[0];
  const last = geometry[geometry.length - 1];

  const forwardDistance =
    distanceMeters(
      first[0],
      first[1],
      fromNode.latitude,
      fromNode.longitude,
    ) +
    distanceMeters(
      last[0],
      last[1],
      toNode.latitude,
      toNode.longitude,
    );

  const reverseDistance =
    distanceMeters(
      first[0],
      first[1],
      toNode.latitude,
      toNode.longitude,
    ) +
    distanceMeters(
      last[0],
      last[1],
      fromNode.latitude,
      fromNode.longitude,
    );

  return forwardDistance <= reverseDistance
    ? geometry
    : [...geometry].reverse();
}

function findPath(
  startId: number,
  endId: number,
  nodes: Node[],
  edges: Edge[],
): { nodeIds: number[]; distance: number } | null {
  if (startId === endId) {
    return { nodeIds: [startId], distance: 0 };
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  const adjacency = new Map<
    number,
    { to: number; cost: number }[]
  >();

  for (const node of nodes) {
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    if (!nodeMap.has(edge.fromNode) || !nodeMap.has(edge.toNode)) {
      continue;
    }

    const cost =
      edge.weight != null && edge.weight > 0
        ? edge.weight
        : edge.length;

    if (!Number.isFinite(cost) || cost <= 0) continue;

    adjacency.get(edge.fromNode)!.push({
      to: edge.toNode,
      cost,
    });

    if (!edge.oneway) {
      adjacency.get(edge.toNode)!.push({
        to: edge.fromNode,
        cost,
      });
    }
  }

  const distances = new Map<number, number>();
  const previous = new Map<number, number>();
  const unvisited = new Set<number>();

  for (const node of nodes) {
    distances.set(node.id, Infinity);
    unvisited.add(node.id);
  }

  distances.set(startId, 0);

  while (unvisited.size > 0) {
    let currentId: number | null = null;
    let currentDistance = Infinity;

    for (const id of unvisited) {
      const distance = distances.get(id) ?? Infinity;

      if (distance < currentDistance) {
        currentDistance = distance;
        currentId = id;
      }
    }

    if (currentId === null || currentDistance === Infinity) break;
    if (currentId === endId) break;

    unvisited.delete(currentId);

    for (const neighbour of adjacency.get(currentId) ?? []) {
      if (!unvisited.has(neighbour.to)) continue;

      const candidate = currentDistance + neighbour.cost;

      if (candidate < (distances.get(neighbour.to) ?? Infinity)) {
        distances.set(neighbour.to, candidate);
        previous.set(neighbour.to, currentId);
      }
    }
  }

  if (!previous.has(endId)) return null;

  const nodeIds: number[] = [];
  let currentId: number | undefined = endId;

  while (currentId !== undefined) {
    nodeIds.unshift(currentId);

    if (currentId === startId) break;

    currentId = previous.get(currentId);
  }

  if (nodeIds[0] !== startId) return null;

  return {
    nodeIds,
    distance: distances.get(endId) ?? Infinity,
  };
}

function buildRouteCoordinates(
  path: { nodeIds: number[]; distance: number },
  nodes: Node[],
  edges: Edge[],
): Coordinate[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const edgeMap = new Map<string, Edge>();
  const cost = (edge: Edge) => edge.weight != null && edge.weight > 0 ? edge.weight : edge.length;
  const setEdge = (from: number, to: number, edge: Edge) => {
    const key = `${from}-${to}`;
    const previous = edgeMap.get(key);
    if (!previous || cost(edge) < cost(previous)) edgeMap.set(key, edge);
  };

  for (const edge of edges) {
    setEdge(edge.fromNode, edge.toNode, edge);

    if (!edge.oneway) {
      setEdge(edge.toNode, edge.fromNode, edge);
    }
  }

  const coordinates: Coordinate[] = [];

  for (let i = 0; i < path.nodeIds.length; i++) {
    const node = nodeMap.get(path.nodeIds[i]);
    if (!node) continue;

    if (i === 0) {
      coordinates.push([node.latitude, node.longitude]);
      continue;
    }

    const previousNode = nodeMap.get(path.nodeIds[i - 1]);
    if (!previousNode) continue;

    const edge = edgeMap.get(`${previousNode.id}-${node.id}`);

    if (edge) {
      const from = edge.fromNode === previousNode.id ? previousNode : node;
      const to = edge.toNode === node.id ? node : previousNode;

      const edgeCoordinates = getEdgeCoordinates(edge, from, to);

      if (edge.fromNode !== previousNode.id) {
        edgeCoordinates.reverse();
      }

      coordinates.push(...edgeCoordinates.slice(1));
    } else {
      coordinates.push([node.latitude, node.longitude]);
    }
  }

  return coordinates.filter(
    ([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon),
  );
}

class RouteError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function calculateRoute(
  startLatitude: number,
  startLongitude: number,
  destinationLatitude: number,
  destinationLongitude: number,
) {
  const [storedNodes, storedEdges] = await Promise.all([
    db.select().from(navigationNodes), db.select().from(navigationEdges),
  ]);
  const { nodes, edges } = publicOutdoorGraph(storedNodes as Node[], storedEdges as Edge[]);

  if (nodes.length === 0 || edges.length === 0) {
    throw new RouteError("The walking network is unavailable. Please try again later.", 503);
  }

  const startEntrances = getEntrances(startLatitude, startLongitude);
  const destinationEntrances = getEntrances(
    destinationLatitude,
    destinationLongitude,
  );

  let bestRoute: Coordinate[] | null = null;
  let bestDistance = Infinity;
  let startConnected = false;
  let destinationConnected = false;

  for (const start of startEntrances) {
    const startNode = nearestNode(
      nodes,
      start.latitude,
      start.longitude,
    );

    if (!startNode) continue;
    startConnected = true;

    for (const destination of destinationEntrances) {
      const endNode = nearestNode(
        nodes,
        destination.latitude,
        destination.longitude,
      );

      if (!endNode) continue;
      destinationConnected = true;

      const path = findPath(startNode.id, endNode.id, nodes, edges);
      if (!path) continue;

      const route = buildRouteCoordinates(path, nodes, edges);
      if (route.length === 0) continue;
      // Include the short, estimated connectors already counted in distance.
      const startPoint: Coordinate = [start.latitude, start.longitude];
      const endPoint: Coordinate = [destination.latitude, destination.longitude];
      if (distanceMeters(...startPoint, ...route[0]) > 0.01) route.unshift(startPoint);
      if (distanceMeters(...endPoint, ...route[route.length - 1]) > 0.01) route.push(endPoint);
      if (route.length === 1) route.push([...route[0]]);

      const connectorDistance =
        distanceMeters(
          start.latitude,
          start.longitude,
          startNode.latitude,
          startNode.longitude,
        ) +
        distanceMeters(
          destination.latitude,
          destination.longitude,
          endNode.latitude,
          endNode.longitude,
        );

      const totalDistance = path.distance + connectorDistance;

      if (totalDistance < bestDistance) {
        bestDistance = totalDistance;
        bestRoute = route;
      }
    }
  }

  if (!bestRoute) {
    if (!startConnected || !destinationConnected) {
      throw new RouteError("Choose a start and destination within 100 metres of a campus walking path.", 422);
    }
    throw new RouteError("No public walking route connects these locations. Please choose another start or destination.", 422);
  }

  return {
    route: bestRoute,
    distanceMeters: Math.round(bestDistance),
  };
}

function getCoordinate(
  params: URLSearchParams,
  names: string[],
): number | null {
  for (const name of names) {
    const value = params.get(name);

    if (value !== null && value.trim() !== "") {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}

function getBodyCoordinate(
  body: Record<string, unknown>,
  names: string[],
): number | null {
  for (const name of names) {
    const value = body[name];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}

async function handleRoute(
  startLatitude: number | null,
  startLongitude: number | null,
  destinationLatitude: number | null,
  destinationLongitude: number | null,
) {
  const parsed = outdoorRouteInputSchema.safeParse({ startLatitude, startLongitude, destinationLatitude, destinationLongitude });
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Missing or invalid start/destination coordinates.",
      },
      { status: 400, headers: privateRouteHeaders },
    );
  }

  if (startLatitude === destinationLatitude && startLongitude === destinationLongitude) {
    const point: Coordinate = [parsed.data.startLatitude, parsed.data.startLongitude];
    return NextResponse.json({ route: [point, point], distanceMeters: 0 }, { headers: privateRouteHeaders });
  }

  try {
    const result = await calculateRoute(
      parsed.data.startLatitude,
      parsed.data.startLongitude,
      parsed.data.destinationLatitude,
      parsed.data.destinationLongitude,
    );

    return NextResponse.json(result, { headers: privateRouteHeaders });
  } catch (error) {
    if (!(error instanceof RouteError)) console.error("Walking route calculation failed.");

    return NextResponse.json(
      {
        error:
          error instanceof RouteError
            ? error.message
            : "The walking route could not be calculated. Please try again.",
      },
      { status: error instanceof RouteError ? error.status : 500, headers: privateRouteHeaders },
    );
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  return handleRoute(
    getCoordinate(params, [
      "startLatitude",
      "startLat",
      "fromLat",
      "start_lat",
    ]),
    getCoordinate(params, [
      "startLongitude",
      "startLng",
      "fromLng",
      "start_lon",
    ]),
    getCoordinate(params, [
      "destinationLatitude",
      "destinationLat",
      "endLat",
      "toLat",
      "end_lat",
    ]),
    getCoordinate(params, [
      "destinationLongitude",
      "destinationLng",
      "endLng",
      "toLng",
      "end_lon",
    ]),
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    return handleRoute(
      getBodyCoordinate(body, [
        "startLatitude",
        "startLat",
        "fromLat",
        "start_lat",
      ]),
      getBodyCoordinate(body, [
        "startLongitude",
        "startLng",
        "fromLng",
        "start_lon",
      ]),
      getBodyCoordinate(body, [
        "destinationLatitude",
        "destinationLat",
        "endLat",
        "toLat",
        "end_lat",
      ]),
      getBodyCoordinate(body, [
        "destinationLongitude",
        "destinationLng",
        "endLng",
        "toLng",
        "end_lon",
      ]),
    );
  } catch {
    return NextResponse.json(
      {
        error: "A JSON route request with valid coordinates is required.",
      },
      { status: 400, headers: privateRouteHeaders },
    );
  }
}
