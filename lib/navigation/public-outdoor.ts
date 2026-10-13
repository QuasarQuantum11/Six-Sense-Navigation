import snapshot from "./pedestrian-restrictions.json";

type Node = { id: number };
type Edge = { fromNode: number; toNode: number; oneway?: boolean | null };
const blocked = new Set(snapshot.blockedEdges.map(([from, to]) => `${from}:${to}`));

// Legacy database rows lost access tags. Apply the checked-in GraphML policy
// at runtime too, so deploying before re-importing cannot reopen closed paths.
export function publicOutdoorGraph<N extends Node, E extends Edge>(nodes: N[], edges: E[]) {
  const adjacency = new Map(nodes.map((n) => [n.id, [] as number[]]));
  const reverse = new Map(nodes.map((n) => [n.id, [] as number[]]));
  const allowed = edges.filter((e) => !blocked.has(`${e.fromNode}:${e.toNode}`)
    && adjacency.has(e.fromNode) && adjacency.has(e.toNode));
  const add = (from: number, to: number) => { adjacency.get(from)!.push(to); reverse.get(to)!.push(from); };
  for (const e of allowed) {
    add(e.fromNode, e.toNode);
    if (!e.oneway) add(e.toNode, e.fromNode);
  }

  // Iterative Kosaraju: retain the largest strongly connected component.
  const visited = new Set<number>();
  const order: number[] = [];
  for (const { id } of nodes) {
    if (visited.has(id)) continue;
    const stack: [number, boolean][] = [[id, false]];
    while (stack.length) {
      const [current, finish] = stack.pop()!;
      if (finish) { order.push(current); continue; }
      if (visited.has(current)) continue;
      visited.add(current);
      stack.push([current, true]);
      for (const next of adjacency.get(current)!) if (!visited.has(next)) stack.push([next, false]);
    }
  }
  visited.clear();
  let largest = new Set<number>();
  for (const id of order.reverse()) {
    if (visited.has(id)) continue;
    const component = new Set<number>();
    const stack = [id];
    while (stack.length) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current); component.add(current);
      for (const next of reverse.get(current)!) if (!visited.has(next)) stack.push(next);
    }
    if (component.size > largest.size) largest = component;
  }
  return {
    nodes: nodes.filter((n) => largest.has(n.id)),
    edges: allowed.filter((e) => largest.has(e.fromNode) && largest.has(e.toNode)),
  };
}
