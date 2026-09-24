"""Distance estimates for routes drawn on the LTB floor-plan images."""

from math import hypot, isfinite

# The team's 0–50 m scale bar spans roughly 710 pixels on the 1722 px plans.
# Keep this calibrated value in one place for both routing and display.
PIXELS_PER_METRE = 14.2

# Approximate one-floor rise inferred from the published building section.
# Stair travel includes treads/landings, so it is longer than lift shaft travel.
# These are assumptions, not measured connector lengths; ranges cover only the
# vertical-connector model, not inaccuracies in graph geometry or map scale.
VERTICAL_ESTIMATES_M = {
    "lift": (4.5, 4.0, 5.0),
    "stairs": (12.0, 8.0, 16.0),
}

# This is a routing penalty, not a claimed physical length. It prevents a
# same-floor journey from detouring through another floor.
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
    if pixels is not None:
        return pixels
    estimate = VERTICAL_ESTIMATES_M.get(edge.get("connector_type", edge.get("type")))
    return VERTICAL_TRANSFER_PENALTY_PIXELS + (
        estimate[0] * PIXELS_PER_METRE if estimate else 0
    )


def measure_indoor_path(graph, path):
    """Measure floor-plan distance and separately report cross-floor estimates."""
    horizontal_pixels = 0.0
    vertical_segments = 0
    unknown_segments = 0
    vertical_estimate = 0.0
    vertical_min = 0.0
    vertical_max = 0.0
    connector_counts = {"lift": 0, "stairs": 0}

    for from_id, to_id in zip(path, path[1:]):
        edge = graph.edges[from_id, to_id]
        pixels = horizontal_edge_pixels(edge, graph.nodes[from_id], graph.nodes[to_id])
        if pixels is not None:
            horizontal_pixels += pixels
        elif edge.get("vertical"):
            vertical_segments += 1
            connector_type = edge.get("connector_type", edge.get("type"))
            estimate = VERTICAL_ESTIMATES_M.get(connector_type)
            if estimate:
                vertical_estimate += estimate[0]
                vertical_min += estimate[1]
                vertical_max += estimate[2]
                connector_counts[connector_type] += 1
            else:
                unknown_segments += 1
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

    horizontal_metres = horizontal_pixels / PIXELS_PER_METRE
    estimate_available = unknown_segments == 0

    return {
        "indoor_horizontal_distance_m": round(horizontal_metres, 1),
        "estimated_vertical_distance_m": round(vertical_estimate, 1) if estimate_available else None,
        "indoor_estimated_distance_m": round(horizontal_metres + vertical_estimate, 1) if estimate_available else None,
        "indoor_estimate_min_m": round(horizontal_metres + vertical_min, 1) if estimate_available else None,
        "indoor_estimate_max_m": round(horizontal_metres + vertical_max, 1) if estimate_available else None,
        "map_straight_line_m": (
            round(straight_line_metres, 1)
            if straight_line_metres is not None else None
        ),
        "vertical_segments": vertical_segments,
        "lift_segments": connector_counts["lift"],
        "stair_segments": connector_counts["stairs"],
        "unknown_segments": unknown_segments,
        "distance_complete": vertical_segments == 0 and unknown_segments == 0,
    }
