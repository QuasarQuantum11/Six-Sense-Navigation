"""Regression tests for pedestrian access filtering on the real campus graph.

Run from the repository root:
    python -m unittest api.tests.test_pedestrian_graph
"""

import json
import hashlib
import math
import unittest
from pathlib import Path

import networkx as nx

from api.pedestrian_graph import is_pedestrian_accessible, pedestrian_subgraph

ROOT = Path(__file__).resolve().parents[2]
RAW_GRAPH = nx.read_graphml(ROOT / "components" / "monash_graph.graphml")
GRAPH, SUMMARY = pedestrian_subgraph(RAW_GRAPH)
BUILDINGS = {b["id"]: b for b in json.loads((ROOT / "api" / "buildings.json").read_text())}
ENTRANCES = json.loads((ROOT / "api" / "ltb_entrances.json").read_text())["entrances"]

CAMPUS_CENTRE_TUNNEL_END = "12478159822"  # dead end of the access=no basement tunnel


def metres(lat1, lon1, lat2, lon2):
    radius = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    return 2 * radius * math.asin(math.sqrt(
        math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    ))


def nearest_node(graph, building):
    # Same metric as the actual Next.js and Python route handlers.
    lat, lon = building["latitude"], building["longitude"]
    return min(
        graph.nodes,
        key=lambda n: metres(lat, lon, float(graph.nodes[n]["y"]), float(graph.nodes[n]["x"])),
    )


def route_length(graph, start, end):
    path = nx.shortest_path(graph, start, end, weight=lambda u, v, d: min(float(e["length"]) for e in d.values()))
    length = sum(min(float(e["length"]) for e in graph.get_edge_data(u, v).values()) for u, v in zip(path, path[1:]))
    return path, length


class AccessRuleTests(unittest.TestCase):
    def test_empty_graph_is_supported(self):
        graph, summary = pedestrian_subgraph(nx.MultiDiGraph())
        self.assertEqual(graph.number_of_nodes(), 0)
        self.assertEqual(summary["removed_edges"], 0)

    def test_access_values(self):
        self.assertTrue(is_pedestrian_accessible({}))
        self.assertTrue(is_pedestrian_accessible({"access": "yes"}))
        self.assertFalse(is_pedestrian_accessible({"access": "no"}))
        self.assertFalse(is_pedestrian_accessible({"access": "private"}))
        # Simplified OSM edges can merge several ways into one list value.
        self.assertFalse(is_pedestrian_accessible({"access": "['yes', 'private']"}))


class PedestrianGraphTests(unittest.TestCase):
    def test_nextjs_runtime_policy_matches_saved_graph_access_rules(self):
        policy = json.loads((ROOT / "lib/navigation/pedestrian-restrictions.json").read_text())
        expected = sorted({(int(u), int(v)) for u, v, data in RAW_GRAPH.edges(data=True) if not is_pedestrian_accessible(data)})
        self.assertEqual(expected, [tuple(edge) for edge in policy["blockedEdges"]])
        self.assertEqual(policy["sha256"], hashlib.sha256((ROOT / policy["source"]).read_bytes()).hexdigest())

    def test_no_closed_edges_remain(self):
        self.assertGreater(SUMMARY["removed_edges"], 0)
        for _, _, data in GRAPH.edges(data=True):
            self.assertTrue(is_pedestrian_accessible(data), data.get("name"))
        names = {data.get("name") for _, _, data in GRAPH.edges(data=True)}
        self.assertNotIn("Campus Centre Basement Tunnel", names)

    def test_graph_is_one_strongly_connected_component(self):
        self.assertEqual(nx.number_strongly_connected_components(GRAPH), 1)
        # Guard against the filter deleting a large part of the campus.
        self.assertGreater(GRAPH.number_of_nodes(), 0.95 * RAW_GRAPH.number_of_nodes())

    def test_ltb_entrance_nodes_are_kept(self):
        for entrance in ENTRANCES:
            self.assertIn(str(entrance["outdoor_node"]), GRAPH)

    def test_every_building_snaps_within_60_m(self):
        for building_id, building in BUILDINGS.items():
            node = GRAPH.nodes[nearest_node(GRAPH, building)]
            distance = metres(building["latitude"], building["longitude"], float(node["y"]), float(node["x"]))
            self.assertLess(distance, 60, building_id)


class CampusCentreRegressionTests(unittest.TestCase):
    def test_campus_centre_no_longer_snaps_to_the_tunnel(self):
        self.assertEqual(nearest_node(RAW_GRAPH, BUILDINGS["campus-centre"]), CAMPUS_CENTRE_TUNNEL_END)
        self.assertNotEqual(nearest_node(GRAPH, BUILDINGS["campus-centre"]), CAMPUS_CENTRE_TUNNEL_END)

    def test_known_campus_centre_routes_are_shorter(self):
        # Before the fix: 661 m, 596 m and 425 m respectively.
        limits = {"monash-it": 250, "religious-centre": 250, "menzies": 300}
        start = nearest_node(GRAPH, BUILDINGS["campus-centre"])
        for building_id, limit in limits.items():
            with self.subTest(destination=building_id):
                _, length = route_length(GRAPH, start, nearest_node(GRAPH, BUILDINGS[building_id]))
                self.assertLess(length, limit)

    def test_no_building_pair_detours_more_than_three_times_straight_line(self):
        ids = sorted(BUILDINGS)
        for i, a in enumerate(ids):
            for b in ids[i + 1:]:
                with self.subTest(start=a, end=b):
                    _, length = route_length(GRAPH, nearest_node(GRAPH, BUILDINGS[a]), nearest_node(GRAPH, BUILDINGS[b]))
                    straight = metres(BUILDINGS[a]["latitude"], BUILDINGS[a]["longitude"],
                                      BUILDINGS[b]["latitude"], BUILDINGS[b]["longitude"])
                    self.assertLess(length / straight, 3.0)


if __name__ == "__main__":
    unittest.main()
