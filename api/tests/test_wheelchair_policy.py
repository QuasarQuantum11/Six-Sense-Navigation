"""Policy and real-snapshot regression checks; no database writes or downloads."""

import unittest
from pathlib import Path

import networkx as nx

from api.pedestrian_graph import pedestrian_subgraph
from api.wheelchair_policy import rejection_reason


class WheelchairPolicyTests(unittest.TestCase):
    def test_service_candidates_and_known_barriers(self):
        self.assertIsNone(rejection_reason({"highway": "service"}))
        self.assertIsNone(rejection_reason({"highway": "service", "maxspeed": "20"}))
        for attributes in [
            {"highway": "service", "maxspeed": "30"},
            {"highway": "service", "maxspeed": "20 mph"},
            {"highway": "service", "wheelchair": "no"},
            {"highway": "footway", "wheelchair": "limited"},
            {"highway": "footway", "access": "private"},
            {"highway": "footway", "foot": "no"},
            {"highway": "['footway', 'steps']"},
            {"highway": "footway", "step_count": "3"},
            {"highway": "primary", "wheelchair": "yes"},
            {},
        ]:
            with self.subTest(attributes=attributes):
                self.assertIsNotNone(rejection_reason(attributes))
        self.assertIsNone(rejection_reason({"highway": "residential", "wheelchair": "yes"}))
        self.assertIsNotNone(rejection_reason({"highway": "residential"}))

    def test_richardson_to_menzies_snapshot(self):
        root = Path(__file__).resolve().parents[2]
        graph, _ = pedestrian_subgraph(nx.read_graphml(root / "components/monash_graph.graphml"))
        # Nearest public nodes to representative Richardson Hall / Menzies pins.
        # These are reproducible graph points, not the user's private GPS sample.
        start, end = "4636745032", "4721847759"
        candidate = graph.copy()
        for u, v, key, attributes in list(candidate.edges(keys=True, data=True)):
            if rejection_reason(attributes):
                candidate.remove_edge(u, v, key)
        weight = lambda u, v, edges: min(float(edge["length"]) for edge in edges.values())
        path = nx.shortest_path(candidate, start, end, weight=weight)
        distance = nx.shortest_path_length(candidate, start, end, weight=weight)
        self.assertGreater(distance, 1000)
        self.assertLess(distance, 1500)
        self.assertTrue(any(candidate[u][v][key].get("highway") == "service"
                            for u, v in zip(path, path[1:]) for key in candidate[u][v]))
        self.assertFalse(any(rejection_reason(attributes) for u, v in zip(path, path[1:])
                             for attributes in candidate[u][v].values()))
        old = candidate.copy()
        old.remove_edges_from([(u, v, key) for u, v, key, attributes in old.edges(keys=True, data=True)
                               if "service" in str(attributes.get("highway", ""))])
        self.assertFalse(nx.has_path(old, start, end))


if __name__ == "__main__":
    unittest.main()
