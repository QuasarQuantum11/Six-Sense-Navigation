import unittest

from api.index import get_indoor_route


class IndoorRouteIntegrationTests(unittest.TestCase):
    def test_ground_floor_route_stays_on_ground_floor(self):
        result = get_indoor_route("G_N01", "G_N02")

        self.assertTrue(result["distance_complete"])
        self.assertEqual(result["vertical_segments"], 0)
        self.assertTrue(all(node["floor"] == "G" for node in result["route"]))
        self.assertGreater(
            result["indoor_horizontal_distance_m"],
            result["map_straight_line_m"],
        )


if __name__ == "__main__":
    unittest.main()
