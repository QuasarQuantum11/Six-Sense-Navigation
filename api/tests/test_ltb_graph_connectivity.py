"""Regression tests for LTB floor-to-floor connectivity.

Commit 2f8978d replaced api/ltb_edges.json and dropped every lift and stair
edge, so no route could change floors. These tests fail if that happens again.
Run from the repository root:
    python -m unittest api.tests.test_ltb_graph_connectivity -v
"""

import unittest

import networkx as nx

from api.index import (
    LTB_ACCESSIBLE_G,
    LTB_CONNECTORS,
    LTB_G,
    LTB_NODES,
    get_indoor_route,
    get_ltb_route,
)

FLOORS = ["G", "1", "2", "3"]
ROOMS = [node for node, data in LTB_NODES.items() if data.get("type") == "room"]
CAMPUS_START = (-37.9118, 145.1330)  # near Campus Centre, as in test_ltb_connectors

# Known gap that predates 2f8978d (it also exists at e05c27c): this floor 1 wing
# is only joined to the rest of the building by the 1_N05 stairs, so step-free
# routes cannot reach it. Change this set only after confirming the floor plan.
STEP_FREE_UNREACHABLE = {f"1_N{n}" for n in range(91, 98)}


def vertical_edges(graph, connector_type):
    return [
        (u, v)
        for u, v, data in graph.edges(data=True)
        if data.get("vertical") and data.get("connector_type") == connector_type
    ]


def floor_pairs(edges):
    return {tuple(sorted((LTB_NODES[u]["floor"], LTB_NODES[v]["floor"]))) for u, v in edges}


class FloorConnectorTests(unittest.TestCase):
    def test_each_pair_of_adjacent_floors_has_a_lift_and_stairs(self):
        adjacent = {tuple(sorted(pair)) for pair in zip(FLOORS, FLOORS[1:])}
        self.assertTrue(adjacent <= floor_pairs(vertical_edges(LTB_G, "lift")))
        self.assertTrue(adjacent <= floor_pairs(vertical_edges(LTB_G, "stairs")))

    def test_standard_graph_is_one_connected_building(self):
        self.assertEqual(nx.number_connected_components(LTB_G), 1)

    def test_every_room_is_reachable_from_each_entrance(self):
        for entrance in LTB_CONNECTORS:
            reachable = nx.node_connected_component(LTB_G, entrance)
            with self.subTest(entrance=entrance):
                self.assertEqual([room for room in ROOMS if room not in reachable], [])

    def test_step_free_reachability_only_misses_the_known_wing(self):
        for entrance in LTB_CONNECTORS:
            reachable = nx.node_connected_component(LTB_ACCESSIBLE_G, entrance)
            with self.subTest(entrance=entrance):
                self.assertEqual({room for room in ROOMS if room not in reachable}, STEP_FREE_UNREACHABLE)


class CrossFloorRouteTests(unittest.TestCase):
    def upper_floor_rooms(self):
        for floor in FLOORS[1:]:
            yield floor, next(
                room for room in ROOMS
                if LTB_NODES[room]["floor"] == floor and room not in STEP_FREE_UNREACHABLE
            )

    def test_outdoor_to_upper_floor_rooms_for_both_preferences(self):
        for floor, room in self.upper_floor_rooms():
            for speed in ("normal", "accessible"):
                with self.subTest(floor=floor, room=room, speed=speed):
                    result = get_ltb_route(*CAMPUS_START, room, walking_speed=speed)
                    self.assertNotIn("error", result)
                    self.assertEqual(result["indoor_path"][-1]["id"], room)
                    self.assertGreater(result["vertical_segments"], 0)
                    if speed == "accessible":
                        self.assertEqual(result["stair_segments"], 0)
                        self.assertGreater(result["lift_segments"], 0)

    def test_indoor_to_indoor_route_between_ground_and_top_floor(self):
        top_room = next(room for room in ROOMS if LTB_NODES[room]["floor"] == "3")
        result = get_indoor_route("G_N20", top_room)
        self.assertNotIn("error", result)
        self.assertEqual(result["path"][-1], top_room)
        self.assertGreaterEqual(result["vertical_segments"], 3)


if __name__ == "__main__":
    unittest.main()
