"""Generate an independent NetworkX reference for all 182 building directions.

Uses the real importer's output; never connects to or modifies a database.
Run with the project's Python environment, then run npm test.
"""
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys

import networkx as nx

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

spec = importlib.util.spec_from_file_location("navigation_import", ROOT / "scripts/navigation/import-graph.py")
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)
nodes, edges = importer.read_graph(importer.DEFAULT_GRAPH_PATH)
graph = nx.DiGraph()
for node_id, lat, lon, _ in nodes:
    graph.add_node(node_id, latitude=lat, longitude=lon)
for edge in edges:
    start, end, *unused = edge
    length = edge[10]
    if not graph.has_edge(start, end) or length < graph[start][end]["length"]:
        graph.add_edge(start, end, length=length)

buildings = json.loads((ROOT / "api/buildings.json").read_text())
campus = json.loads((ROOT / "api/campus_centre_entrances.json").read_text())
ltb = json.loads((ROOT / "api/ltb_entrances.json").read_text())
ltb_search = next(e for e in ltb["entrances"] if e["id"] == ltb["building_search_entrance"])


def metres(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, (a["latitude"], a["longitude"], b["latitude"], b["longitude"]))
    h = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
    return 2 * 6371000 * math.asin(math.sqrt(min(1, max(0, h))))


def entrances(point):
    campus_centre = dict(zip(("latitude", "longitude"), campus["centre"]))
    if metres(point, campus_centre) <= 12:
        return campus["entrances"]
    if metres(point, ltb_search) <= 12:
        return ltb["entrances"]
    return [point]


def reference(start, end):
    candidates = []
    for a in entrances(start):
        source = min(graph, key=lambda n: metres(a, graph.nodes[n]))
        if metres(a, graph.nodes[source]) > 100:
            continue
        lengths = nx.single_source_dijkstra_path_length(graph, source, weight="length")
        for b in entrances(end):
            target = min(graph, key=lambda n: metres(b, graph.nodes[n]))
            if metres(b, graph.nodes[target]) <= 100 and target in lengths:
                candidates.append(lengths[target] + metres(a, graph.nodes[source]) + metres(b, graph.nodes[target]))
    return round(min(candidates))


sources = ["components/monash_graph.graphml", "api/buildings.json", "api/campus_centre_entrances.json", "api/ltb_entrances.json"]
results = [{"start": start["id"], "end": end["id"], "distanceMeters": reference(start, end)}
           for start in buildings for end in buildings if start["id"] != end["id"]]
output = {"reference": "NetworkX independent Dijkstra on the real importer output",
          "networkxVersion": nx.__version__, "nodes": len(nodes), "edges": len(edges),
          "sha256": {p: hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in sources},
          "routes": results}
target = ROOT / "lib/navigation/tests/fixtures/networkx-reference.json"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(output, indent=2) + "\n")

# The runtime fallback policy must track the same GraphML access decisions.
from api.pedestrian_graph import is_pedestrian_accessible
raw = nx.read_graphml(importer.DEFAULT_GRAPH_PATH)
blocked = sorted({(int(u), int(v)) for u, v, d in raw.edges(data=True) if not is_pedestrian_accessible(d)})
policy = {"source": sources[0], "sha256": output["sha256"][sources[0]], "blockedEdges": blocked}
(ROOT / "lib/navigation/pedestrian-restrictions.json").write_text(json.dumps(policy, indent=2) + "\n")
print(f"Generated {len(results)} directed reference routes; {len(blocked)} blocked snapshot edges.")
for result in results:
    if result["start"] in {"campus-centre", "sir-louis-matheson"} and result["end"] in {"ltb", "menzies", "monash-it", "religious-centre"}:
        print(result)
