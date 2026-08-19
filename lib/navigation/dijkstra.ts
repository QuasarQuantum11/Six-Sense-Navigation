import { calculateRouteDistance } from "./distance";
import type {
  NavigationGraph,
  NodeId,
  RouteResult,
} from "./types";

function hasNode(
  graph: NavigationGraph,
  nodeId: NodeId,
): boolean {
  return Object.prototype.hasOwnProperty.call(graph, nodeId);
}

function validateGraph(graph: NavigationGraph): void {
  const nodeIds = Object.keys(graph);

  for (const fromId of nodeIds) {
    const edges = graph[fromId];

    for (const edge of edges) {
      if (!hasNode(graph, edge.to)) {
        throw new Error(
          `Edge from "${fromId}" points to unknown node "${edge.to}".`,
        );
      }

      if (!Number.isFinite(edge.cost) || edge.cost < 0) {
        throw new RangeError(
          `Edge from "${fromId}" to "${edge.to}" has an invalid cost.`,
        );
      }

      if (
        !Number.isFinite(edge.distanceMeters) ||
        edge.distanceMeters < 0
      ) {
        throw new RangeError(
          `Edge from "${fromId}" to "${edge.to}" has an invalid distance.`,
        );
      }
    }
  }
}

function findClosestUnvisitedNode(
  unvisited: ReadonlySet<NodeId>,
  distances: ReadonlyMap<NodeId, number>,
): NodeId | null {
  let closestNodeId: NodeId | null = null;
  let closestDistance = Infinity;

  for (const nodeId of unvisited) {
    const distance = distances.get(nodeId) ?? Infinity;

    if (distance < closestDistance) {
      closestNodeId = nodeId;
      closestDistance = distance;
    }
  }

  return closestNodeId;
}

export function findShortestPath(
  graph: NavigationGraph,
  startId: NodeId,
  destinationId: NodeId,
): RouteResult | null {
  if (!hasNode(graph, startId)) {
    throw new Error(`Unknown start node: "${startId}".`);
  }

  if (!hasNode(graph, destinationId)) {
    throw new Error(
      `Unknown destination node: "${destinationId}".`,
    );
  }

  validateGraph(graph);

  if (startId === destinationId) {
    return {
      nodeIds: [startId],
      totalCost: 0,
      distanceMeters: 0,
    };
  }

  const nodeIds = Object.keys(graph);

  const distances = new Map<NodeId, number>();
  const previous = new Map<NodeId, NodeId | null>();
  const unvisited = new Set<NodeId>();

  for (const nodeId of nodeIds) {
    distances.set(
      nodeId,
      nodeId === startId ? 0 : Infinity,
    );

    previous.set(nodeId, null);
    unvisited.add(nodeId);
  }

  while (unvisited.size > 0) {
    const currentId = findClosestUnvisitedNode(
      unvisited,
      distances,
    );

    if (currentId === null) {
      break;
    }

    const currentCost =
      distances.get(currentId) ?? Infinity;

    unvisited.delete(currentId);

    if (currentId === destinationId) {
      break;
    }

    const edges = graph[currentId];

    for (const edge of edges) {

      if (!unvisited.has(edge.to)) {
        continue;
      }

      const candidateCost = currentCost + edge.cost;
      const knownCost =
        distances.get(edge.to) ?? Infinity;

      if (candidateCost < knownCost) {
        distances.set(edge.to, candidateCost);
        previous.set(edge.to, currentId);
      }
    }
  }

  const destinationCost =
    distances.get(destinationId) ?? Infinity;

  if (!Number.isFinite(destinationCost)) {
    return null;
  }

  const reversedNodeIds: NodeId[] = [];
  let currentId: NodeId | null = destinationId;

  while (currentId !== null) {
    reversedNodeIds.push(currentId);

    if (currentId === startId) {
      break;
    }

    currentId = previous.get(currentId) ?? null;
  }

  if (
    reversedNodeIds[reversedNodeIds.length - 1] !==
    startId
  ) {
    return null;
  }

  const routeNodeIds = reversedNodeIds.reverse();

  return {
    nodeIds: routeNodeIds,
    totalCost: destinationCost,
    distanceMeters: calculateRouteDistance(
      graph,
      routeNodeIds,
    ),
  };
}