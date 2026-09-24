"""Distance estimates for routes drawn on the LTB floor-plan images."""

from math import hypot, isfinite

# The team's 0–50 m scale bar spans roughly 710 pixels on the 1722 px plans.
# Keep this calibrated value in one place for both routing and display.
PIXELS_PER_METRE = 14.2

# This is a routing penalty, not a claimed physical length. It prevents a
# same-floor journey from detouring through another floor to exploit an edge
# whose real stair/lift length is still unknown.
VERTICAL_TRANSFER_PENALTY_PIXELS = 1_000_000


def horizontal_edge_pixels(edge, start, end):
    """Return a same-floor edge length, including manually added graph links."""
    if edge.get("vertical") or start["floor"] != end["floor"]:
        return None

    supplied = edge.get("distance_pixels")
    if isinstance(supplied, (int, float)) and isfinite(supplied) and supplied >= 0:
        return supplied

    return hypot(
        end["x_pixel"] - start["x_pixel"],
        end["y_pixel"] - start["y_pixel"],
    )


def routing_weight_pixels(edge, start, end):
    pixels = horizontal_edge_pixels(edge, start, end)
    return pixels if pixels is not None else VERTICAL_TRANSFER_PENALTY_PIXELS


def measure_indoor_path(graph, path):
    """Measure the known floor-plan distance without inventing stair/lift lengths."""
    horizontal_pixels = 0.0
    vertical_segments = 0
    unknown_segments = 0

    for from_id, to_id in zip(path, path[1:]):
        edge = graph.edges[from_id, to_id]
        pixels = horizontal_edge_pixels(edge, graph.nodes[from_id], graph.nodes[to_id])
        if pixels is not None:
            horizontal_pixels += pixels
        elif edge.get("vertical"):
            vertical_segments += 1
        else:
            unknown_segments += 1

    start = graph.nodes[path[0]]
    end = graph.nodes[path[-1]]
    straight_line_metres = None
    if start["floor"] == end["floor"]:
        straight_line_metres = hypot(
            end["x_pixel"] - start["x_pixel"],
            end["y_pixel"] - start["y_pixel"],
        ) / PIXELS_PER_METRE

    return {
        "indoor_horizontal_distance_m": round(horizontal_pixels / PIXELS_PER_METRE, 1),
        "map_straight_line_m": (
            round(straight_line_metres, 1)
            if straight_line_metres is not None else None
        ),
        "vertical_segments": vertical_segments,
        "unknown_segments": unknown_segments,
        "distance_complete": vertical_segments == 0 and unknown_segments == 0,
    }
