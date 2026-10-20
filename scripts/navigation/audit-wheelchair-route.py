"""Read-only Neon audit for representative Richardson Hall -> Menzies points.

The comparison scenario removes legacy service-road false flags IN MEMORY ONLY.
It identifies links needing review; it does not certify or modify any path.
"""

import json
import math
import os
import sys
from pathlib import Path

import networkx as nx
import psycopg2
from psycopg2.extras import RealDictCursor

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from api.wheelchair_policy import rejection_reason, tag_values  # noqa: E402


def metres(a, b):
    p, q = math.radians(a[0]), math.radians(b[0])
    return 6371000 * 2 * math.asin(math.sqrt(math.sin((q-p)/2)**2
        + math.cos(p)*math.cos(q)*math.sin(math.radians(b[1]-a[1])/2)**2))


def audit(nodes, edges, review_service):
    graph = nx.MultiDiGraph()
    graph.add_nodes_from((row["id"], row) for row in nodes)
    restrictions = json.loads((ROOT / "lib/navigation/pedestrian-restrictions.json").read_text())
    blocked = {tuple(pair) for pair in restrictions["blockedEdges"]}
    for row in edges:
        if (row["from_node"], row["to_node"]) in blocked:
            continue
        candidate = dict(row)
        if review_service and "service" in tag_values(row["highway"]) and row["wheelchair_accessible"] is False:
            candidate["wheelchair_accessible"] = None
        if rejection_reason(candidate):
            continue
        cost = row["weight"] if row["weight"] is not None and row["weight"] > 0 else row["length"]
        if not math.isfinite(cost) or cost <= 0:
            continue
        graph.add_edge(row["from_node"], row["to_node"], key=row["id"], cost=cost, record=row)
        if not row["oneway"]:
            graph.add_edge(row["to_node"], row["from_node"], key=row["id"], cost=cost, record=row)
    largest = max(nx.strongly_connected_components(graph), key=len, default=set())
    graph = graph.subgraph(largest)
    if not graph:
        return {"error": "No candidate network"}
    points = [(-37.90695, 145.1389), (-37.912676127832164, 145.13266012072566)]
    nearest = [min(graph, key=lambda node: metres(point, (graph.nodes[node]["latitude"], graph.nodes[node]["longitude"]))) for point in points]
    connectors = [metres(point, (graph.nodes[node]["latitude"], graph.nodes[node]["longitude"])) for point, node in zip(points, nearest)]
    if max(connectors) > 100:
        return {"error": "No eligible connection within 100 metres", "connectorMetres": [round(value) for value in connectors]}
    path = nx.shortest_path(graph, *nearest, weight=lambda u, v, ds: min(d["cost"] for d in ds.values()))
    chosen = [min(graph[u][v].values(), key=lambda edge: edge["cost"]) for u, v in zip(path, path[1:])]
    review = {edge["record"]["id"]: edge["record"] for edge in chosen if edge["record"]["wheelchair_accessible"] is False}
    return {"networkMetres": round(sum(edge["cost"] for edge in chosen)), "connectorMetres": [round(value) for value in connectors],
            "serviceLinksNeedingReview": [{key: row[key] for key in ["id", "from_node", "to_node", "highway", "name", "maxspeed", "wheelchair_accessible", "has_steps"]} for row in review.values()]}


def main():
    for filename in [".env.local", ".env"]:
        for line in (ROOT / filename).read_text(encoding="utf8").splitlines():
            if line.startswith("DATABASE_URL="):
                os.environ.setdefault("DATABASE_URL", line.split("=", 1)[1].strip().strip('"').strip("'"))
    with psycopg2.connect(os.environ["DATABASE_URL"], connect_timeout=10) as connection:
        connection.set_session(readonly=True)
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("SELECT id, latitude, longitude FROM navigation_nodes")
            nodes = cursor.fetchall()
            cursor.execute("SELECT id, from_node, to_node, highway, name, maxspeed, oneway, length, weight, wheelchair_accessible, has_steps FROM navigation_edges")
            edges = cursor.fetchall()
    print(json.dumps({"source": "Neon (read only); representative building points, not user GPS", "storedFlags": audit(nodes, edges, False),
                      "hypotheticalServiceReview": audit(nodes, edges, True)}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except psycopg2.Error:
        print("Neon audit failed; connection details omitted.", file=sys.stderr)
        raise SystemExit(1)
