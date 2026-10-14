import unittest
from unittest.mock import AsyncMock

from pydantic import ValidationError
from starlette.requests import Request
from starlette.responses import JSONResponse

from api.index import LTBRouteRequest, post_ltb_route, private_route_responses


class LTBPostRouteTests(unittest.TestCase):
    def test_post_body_calculates_real_outdoor_to_indoor_route(self):
        result = post_ltb_route(LTBRouteRequest(
            start_lat=-37.9083, start_lon=145.1380, end_node="G_N01"
        ))
        self.assertNotIn("error", result)
        self.assertTrue(result["outdoor_path"])
        self.assertEqual(result["indoor_path"][-1]["id"], "G_N01")
        self.assertGreater(result["total_known_distance_m"], 0)

    def test_rejects_invalid_coordinates_and_destinations(self):
        for invalid in [
            {"start_lat": 91}, {"start_lon": 181},
            {"start_lat": float("nan")}, {"end_node": "../../secret"},
        ]:
            with self.subTest(invalid=invalid):
                values = dict(start_lat=-37.9083, start_lon=145.138, end_node="G_N01")
                values.update(invalid)
                with self.assertRaises(ValidationError):
                    LTBRouteRequest(**values)


class PrivateRouteHeadersTests(unittest.IsolatedAsyncioTestCase):
    async def test_route_responses_are_not_cached_including_errors(self):
        for path in ["/api/route", "/api/ltb-route", "/api/indoor-route", "/api/building-route"]:
            for status in [200, 400, 500]:
                with self.subTest(path=path, status=status):
                    request = Request({"type": "http", "method": "POST", "path": path, "headers": [], "scheme": "http"})
                    response = JSONResponse({}, status_code=status)
                    result = await private_route_responses(request, AsyncMock(return_value=response))
                    self.assertEqual(result.headers["cache-control"], "private, no-store")


if __name__ == "__main__":
    unittest.main()
