import unittest

import networkx as nx

from api.indoor_distance import (
    PIXELS_PER_METRE,
    horizontal_edge_pixels,
    measure_indoor_path,
    routing_weight_pixels,
)


class IndoorDistanceTests(unittest.TestCase):
    def test_same_floor_route_exceeds_straight_line_distance(self):
        graph = nx.Graph()
        graph.add_node("a", floor="G", x_pixel=0, y_pixel=0)
        graph.add_node("b", floor="G", x_pixel=142, y_pixel=0)
        graph.add_node("c", floor="G", x_pixel=142, y_pixel=142)
        graph.add_edge("a", "b", distance_pixels=142)
        graph.add_edge("b", "c")  # A manually added link has no stored length.

        self.assertEqual(
            horizontal_edge_pixels({}, graph.nodes["b"], graph.nodes["c"]),
            142,
        )
        metrics = measure_indoor_path(graph, ["a", "b", "c"])
        self.assertEqual(metrics["indoor_horizontal_distance_m"], 20.0)
        self.assertEqual(metrics["map_straight_line_m"], 14.1)
        self.assertTrue(metrics["distance_complete"])

    def test_cross_floor_route_does_not_claim_an_actual_vertical_distance(self):
        graph = nx.Graph()
        graph.add_node("a", floor="G", x_pixel=0, y_pixel=0)
        graph.add_node("b", floor="G", x_pixel=PIXELS_PER_METRE, y_pixel=0)
        graph.add_node("c", floor="1", x_pixel=PIXELS_PER_METRE, y_pixel=0)
        graph.add_edge("a", "b", distance_pixels=PIXELS_PER_METRE)
        graph.add_edge("b", "c", vertical=True)

        metrics = measure_indoor_path(graph, ["a", "b", "c"])
        self.assertEqual(metrics["indoor_horizontal_distance_m"], 1.0)
        self.assertIsNone(metrics["map_straight_line_m"])
        self.assertEqual(metrics["vertical_segments"], 1)
        self.assertFalse(metrics["distance_complete"])

    def test_routing_prefers_a_same_floor_path_to_a_floor_change_detour(self):
        graph = nx.Graph()
        graph.add_node("a", floor="G", x_pixel=0, y_pixel=0)
        graph.add_node("b", floor="G", x_pixel=100, y_pixel=0)
        graph.add_node("lift_g", floor="G", x_pixel=0, y_pixel=10)
        graph.add_node("lift_1", floor="1", x_pixel=0, y_pixel=10)
        graph.add_node("stairs_1", floor="1", x_pixel=100, y_pixel=10)
        graph.add_node("stairs_g", floor="G", x_pixel=100, y_pixel=10)
        graph.add_edges_from([
            ("a", "b"), ("a", "lift_g"), ("lift_g", "lift_1"),
            ("lift_1", "stairs_1"), ("stairs_1", "stairs_g"),
            ("stairs_g", "b"),
        ])

        for from_id, to_id, edge in graph.edges(data=True):
            edge["vertical"] = graph.nodes[from_id]["floor"] != graph.nodes[to_id]["floor"]
            edge["weight"] = routing_weight_pixels(
                edge, graph.nodes[from_id], graph.nodes[to_id]
            )

        self.assertEqual(
            nx.shortest_path(graph, "a", "b", weight="weight"),
            ["a", "b"],
        )


if __name__ == "__main__":
    unittest.main()
