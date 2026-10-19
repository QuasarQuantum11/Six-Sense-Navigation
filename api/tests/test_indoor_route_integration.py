import unittest

from api.index import LTB_NODES, get_indoor_route


class IndoorRouteIntegrationTests(unittest.TestCase):
    def test_ground_floor_route_stays_on_ground_floor(self):
        result = get_indoor_route("G_N01", "G_N02")

        # /api/indoor-route returns "path" as a list of node IDs
        # (the frontend accepts indoor_path, path or route).
        path = result["path"]
        self.assertTrue(result["distance_complete"])
        self.assertEqual(result["vertical_segments"], 0)
        self.assertEqual(path[0], "G_N01")
        self.assertEqual(path[-1], "G_N02")
        self.assertTrue(all(LTB_NODES[node]["floor"] == "G" for node in path))
        self.assertGreater(
            result["indoor_horizontal_distance_m"],
            result["map_straight_line_m"],
        )


if __name__ == "__main__":
    unittest.main()
