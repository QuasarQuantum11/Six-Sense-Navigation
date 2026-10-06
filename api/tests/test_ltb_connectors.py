import json
from pathlib import Path
import unittest

from api.index import G, LTB_CONNECTORS, LTB_ENTRANCES, get_ltb_route


class LTBConnectorTests(unittest.TestCase):
    def test_connectors_end_at_ltb_not_distant_campus_junctions(self):
        self.assertEqual(len(LTB_CONNECTORS), 2)
        self.assertNotIn("G_N03", LTB_CONNECTORS)
        for node_id in LTB_CONNECTORS.values():
            node = G.nodes[node_id]
            # Independent envelope of OSM building 92. Former IDs were >300 m east.
            self.assertTrue(-37.91423 <= node["y"] <= -37.91324)
            self.assertTrue(145.13214 <= node["x"] <= 145.13309)
            self.assertGreater(G.degree(node_id), 0)

    def test_route_from_each_door_ends_at_that_same_candidate_door(self):
        for indoor, entry in LTB_ENTRANCES.items():
            with self.subTest(entrance=indoor):
                result = get_ltb_route(entry["latitude"], entry["longitude"], indoor)
                self.assertNotIn("error", result)
                self.assertEqual(result["entrance_node"], indoor)
                self.assertEqual(result["outdoor_distance_m"], 0)
                self.assertEqual(result["outdoor_path"][-1], (entry["latitude"], entry["longitude"]))
                self.assertFalse(result["entrance_mapping_verified"])
                self.assertIn("candidate", result["entrance_label"].lower())

    def test_cross_floor_routes_keep_a_candidate_ltb_outdoor_endpoint(self):
        from api.index import LTB_NODES
        for floor in ["G", "1", "2", "3"]:
            room = next(node for node, data in LTB_NODES.items() if data["floor"] == floor and data["type"] == "room")
            with self.subTest(floor=floor, room=room):
                result = get_ltb_route(-37.9118, 145.1330, room)
                self.assertNotIn("error", result)
                self.assertIn(result["outdoor_node"], LTB_CONNECTORS.values())
                self.assertEqual(result["indoor_path"][-1]["id"], room)
                self.assertFalse(result["entrance_mapping_verified"])

    def test_python_building_search_uses_the_same_east_candidate(self):
        buildings = json.loads((Path(__file__).parents[1] / "buildings.json").read_text())
        building = next(row for row in buildings if row["id"] == "ltb")
        entry = next(row for row in LTB_ENTRANCES.values() if row["id"] == "east")
        self.assertEqual((building["latitude"], building["longitude"]), (entry["latitude"], entry["longitude"]))


if __name__ == "__main__":
    unittest.main()
