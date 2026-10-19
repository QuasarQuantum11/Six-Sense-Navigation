import heapq
import json
import math
import os
from itertools import count

import networkx as nx
import osmnx as ox
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from api.indoor_distance import measure_indoor_path, routing_weight_pixels
from api.pedestrian_graph import pedestrian_subgraph


app = FastAPI()


@app.middleware("http")
async def private_route_responses(request, call_next):
    response = await call_next(request)
    if request.url.path in {
        "/api/route",
        "/api/ltb-route",
        "/api/indoor-route",
        "/api/building-route",
    }:
        response.headers["Cache-Control"] = "private, no-store"
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------------------------------------------------
# Load outdoor pedestrian graph
# -------------------------------------------------------------------

GRAPH_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "components",
    "monash_graph.graphml",
)

print("Loading saved Monash graph...")
G, PEDESTRIAN_SUMMARY = pedestrian_subgraph(
    ox.load_graphml(GRAPH_PATH)
)

print(
    "Graph ready: "
    f"{PEDESTRIAN_SUMMARY['nodes']} nodes, "
    f"{PEDESTRIAN_SUMMARY['edges']} edges "
    f"({PEDESTRIAN_SUMMARY['removed_edges']} access=no/private edges "
    f"and {PEDESTRIAN_SUMMARY['removed_nodes']} unreachable nodes removed)."
)


# -------------------------------------------------------------------
# Load LTB data
# -------------------------------------------------------------------

API_DIR = os.path.dirname(__file__)

with open(os.path.join(API_DIR, "ltb_nodes.json")) as f:
    LTB_NODES = json.load(f)

with open(os.path.join(API_DIR, "ltb_edges.json")) as f:
    LTB_EDGES = json.load(f)

with open(os.path.join(API_DIR, "buildings.json")) as f:
    BUILDINGS = json.load(f)

with open(os.path.join(API_DIR, "ltb_entrances.json")) as f:
    LTB_ENTRANCE_CONFIG = json.load(f)


@app.get("/api/buildings")
def get_buildings():
    return {"buildings": BUILDINGS}


print(f"Building search data ready: {len(BUILDINGS)} buildings")


# -------------------------------------------------------------------
# Configure verified outdoor/indoor entrance connections
# -------------------------------------------------------------------

LTB_ENTRANCES = {
    entry["indoor_node"]: entry
    for entry in LTB_ENTRANCE_CONFIG["entrances"]
}

LTB_CONNECTORS = {
    indoor: entry["outdoor_node"]
    for indoor, entry in LTB_ENTRANCES.items()
}

for indoor, entry in LTB_ENTRANCES.items():
    outdoor_node = entry["outdoor_node"]

    if outdoor_node not in G:
        raise ValueError(
            f"Outdoor graph node missing for LTB entrance {indoor}: "
            f"{outdoor_node}"
        )

    outdoor = G.nodes[outdoor_node]

    if (
        abs(outdoor["y"] - entry["latitude"]) > 1e-7
        or abs(outdoor["x"] - entry["longitude"]) > 1e-7
    ):
        raise ValueError(
            f"LTB entrance {indoor} does not match its outdoor graph coordinates"
        )

    LTB_NODES[indoor]["description"] = entry["label"]

for indoor in LTB_ENTRANCE_CONFIG["disabled_indoor_nodes"]:
    LTB_NODES[indoor]["description"] = (
        "Unverified entrance (outdoor connection disabled)"
    )


# -------------------------------------------------------------------
# Build indoor routing graphs
# -------------------------------------------------------------------

LTB_G = nx.Graph()

for node_id, data in LTB_NODES.items():
    LTB_G.add_node(node_id, **data)

for edge in LTB_EDGES:
    source = edge["from"]
    target = edge["to"]

    weight = routing_weight_pixels(
        edge,
        LTB_NODES[source],
        LTB_NODES[target],
    )

    LTB_G.add_edge(
        source,
        target,
        weight=weight,
        vertical=edge.get("vertical", False),
        connector_type=edge.get("type"),
    )


# Accessible graph: remove stair connections but retain lifts.
LTB_ACCESSIBLE_G = LTB_G.copy()

stair_types = {"stairs", "stair", "staircase"}

stair_edges = [
    (u, v)
    for u, v, data in LTB_ACCESSIBLE_G.edges(data=True)
    if str(data.get("connector_type", "")).strip().lower() in stair_types
]

LTB_ACCESSIBLE_G.remove_edges_from(stair_edges)

print(
    f"LTB routing graph ready: {LTB_G.number_of_nodes()} nodes, "
    f"{LTB_G.number_of_edges()} edges"
)

print(
    f"Accessible LTB graph ready: "
    f"{LTB_ACCESSIBLE_G.number_of_nodes()} nodes, "
    f"{LTB_ACCESSIBLE_G.number_of_edges()} edges; "
    f"removed {len(stair_edges)} stair edges"
)


def get_indoor_graph(accessible=False):
    """Return the standard or stair-free indoor graph."""
    return LTB_ACCESSIBLE_G if accessible else LTB_G


def validate_walking_speed(walking_speed):
    return walking_speed in {
        "accessible",
        "normal",
        "standard",
        "fast",
    }


# -------------------------------------------------------------------
# Indoor graph filtering and route helpers
# -------------------------------------------------------------------

def build_routing_graph(graph, start_node, end_node):
    """
    Restrict same-floor journeys to that floor while allowing routes
    to pass through intermediate room nodes.
    """
    if start_node not in graph:
        raise nx.NodeNotFound(f"Start node not found: {start_node}")

    if end_node not in graph:
        raise nx.NodeNotFound(f"Destination node not found: {end_node}")

    start_floor = graph.nodes[start_node].get("floor")
    end_floor = graph.nodes[end_node].get("floor")

    if start_floor == end_floor:
        allowed_nodes = [
            node_id
            for node_id, data in graph.nodes(data=True)
            if data.get("floor") == start_floor
        ]
        return graph.subgraph(allowed_nodes).copy()

    return graph.copy()


def is_lift_area(node_data):
    """Identify nodes explicitly labelled as lift/elevator areas."""
    label = " ".join(
        [
            str(node_data.get("type", "")),
            str(node_data.get("description", "")),
        ]
    ).lower()

    return "lift" in label or "elevator" in label


def turn_aware_shortest_path(graph, start_node, end_node):
    """
    Find a low-distance route while discouraging sharp turns.

    Same-floor journeys are restricted to that floor so that a missing
    corridor connection cannot produce a detour across other floors.
    Intermediate room nodes are excluded from the routing graph.
    """
    routing_graph = build_routing_graph(
        graph,
        start_node,
        end_node,
    )

    if start_node == end_node:
        return [start_node]

    start_floor = routing_graph.nodes[start_node].get("floor")
    end_floor = routing_graph.nodes[end_node].get("floor")
    same_floor_journey = start_floor == end_floor

    TURN_PENALTY = 35
    LIFT_AREA_PENALTY = 150

    def turn_cost(previous, current, following):
        a = routing_graph.nodes[previous]
        b = routing_graph.nodes[current]
        c = routing_graph.nodes[following]

        floors = (
            a.get("floor"),
            b.get("floor"),
            c.get("floor"),
        )

        if floors[0] != floors[1] or floors[1] != floors[2]:
            return 0

        coords = [
            (a.get("x_pixel"), a.get("y_pixel")),
            (b.get("x_pixel"), b.get("y_pixel")),
            (c.get("x_pixel"), c.get("y_pixel")),
        ]

        if any(x is None or y is None for x, y in coords):
            return 0

        ax = coords[1][0] - coords[0][0]
        ay = coords[1][1] - coords[0][1]
        bx = coords[2][0] - coords[1][0]
        by = coords[2][1] - coords[1][1]

        len_a = math.hypot(ax, ay)
        len_b = math.hypot(bx, by)

        if len_a == 0 or len_b == 0:
            return 0

        cosine = (ax * bx + ay * by) / (len_a * len_b)
        cosine = max(-1.0, min(1.0, cosine))
        angle = math.degrees(math.acos(cosine))

        if angle < 25:
            return 0

        return TURN_PENALTY * angle / 90

    initial_state = (None, start_node)
    distances = {initial_state: 0}
    parents = {}
    queue_counter = count()
    queue = [(0, next(queue_counter), initial_state)]
    final_state = None

    while queue:
        cost, _, state = heapq.heappop(queue)

        if cost != distances.get(state):
            continue

        previous, current = state

        if current == end_node:
            final_state = state
            break

        for following in routing_graph.neighbors(current):
            edge = routing_graph.edges[current, following]
            edge_cost = float(edge.get("weight", 1))
            extra_cost = 0

            if previous is not None:
                extra_cost += turn_cost(previous, current, following)

            if (
                same_floor_journey
                and following != end_node
                and is_lift_area(routing_graph.nodes[following])
            ):
                extra_cost += LIFT_AREA_PENALTY

            next_state = (current, following)
            new_cost = cost + edge_cost + extra_cost

            if new_cost < distances.get(next_state, float("inf")):
                distances[next_state] = new_cost
                parents[next_state] = state
                heapq.heappush(
                    queue,
                    (new_cost, next(queue_counter), next_state),
                )

    if final_state is None:
        raise nx.NetworkXNoPath(
            f"No valid indoor route from {start_node} to {end_node}"
        )

    states = []
    state = final_state

    while True:
        states.append(state)

        if state == initial_state:
            break

        state = parents[state]

    states.reverse()
    return [node for _, node in states]


# -------------------------------------------------------------------
# Outdoor routing
# -------------------------------------------------------------------

@app.get("/api/route")
def get_route(
    start_lat: float,
    start_lon: float,
    end_lat: float,
    end_lon: float,
):
    try:
        orig_node = ox.distance.nearest_nodes(
            G,
            X=start_lon,
            Y=start_lat,
        )
        dest_node = ox.distance.nearest_nodes(
            G,
            X=end_lon,
            Y=end_lat,
        )

        path = nx.shortest_path(
            G,
            orig_node,
            dest_node,
            weight="length",
        )

        route_coords = [
            (G.nodes[node]["y"], G.nodes[node]["x"])
            for node in path
        ]

        return {"route": route_coords}

    except (nx.NetworkXNoPath, nx.NodeNotFound, ValueError):
        return {
            "error": "No outdoor route is available between those locations."
        }


# -------------------------------------------------------------------
# Indoor node data and direct indoor routing
# -------------------------------------------------------------------

@app.get("/api/indoor-nodes")
def get_indoor_nodes():
    return LTB_NODES


@app.get("/api/indoor-route")
def get_indoor_route(
    start_node: str,
    end_node: str,
    walking_speed: str = "standard",
):
    if not validate_walking_speed(walking_speed):
        return {"error": "Invalid walking speed preference."}

    route_graph = get_indoor_graph(
        accessible=(walking_speed == "accessible")
    )

    try:
        routing_graph = build_routing_graph(
            route_graph,
            start_node,
            end_node,
        )

        if not nx.has_path(routing_graph, start_node, end_node):
            return {
                "error": (
                    "No indoor route is available between these rooms"
                    + (" without stairs." if walking_speed == "accessible" else ".")
                )
            }

        path = nx.shortest_path(
            routing_graph,
            source=start_node,
            target=end_node,
            weight="weight",
        )

        distance_data = measure_indoor_path(routing_graph, path)

        return {
            "start": start_node,
            "destination": end_node,
            "path": path,
            **distance_data,
        }

    except nx.NodeNotFound as exc:
        return {"error": str(exc)}

    except nx.NetworkXNoPath:
        return {"error": "No indoor route is available between these rooms."}


# -------------------------------------------------------------------
# Combined outdoor + indoor LTB route
# -------------------------------------------------------------------

class LTBRouteRequest(BaseModel):
    start_lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    start_lon: float = Field(ge=-180, le=180, allow_inf_nan=False)
    end_node: str = Field(
        min_length=1,
        max_length=64,
        pattern=r"^[A-Za-z0-9_]+$",
    )
    walking_speed: str = Field(
        default="normal",
        pattern=r"^(accessible|normal|standard|fast)$",
    )


@app.post("/api/ltb-route")
def post_ltb_route(request: LTBRouteRequest):
    return get_ltb_route(
        request.start_lat,
        request.start_lon,
        request.end_node,
        walking_speed=request.walking_speed,
    )


@app.get("/api/ltb-route")
def get_ltb_route(
    start_lat: float,
    start_lon: float,
    end_node: str,
    walking_speed: str = "normal",
):
    if not validate_walking_speed(walking_speed):
        return {"error": "Invalid walking speed preference."}

    if end_node not in LTB_G:
        return {"error": f"Unknown indoor destination: {end_node}"}

    indoor_graph = get_indoor_graph(
        accessible=(walking_speed == "accessible")
    )

    try:
        outdoor_start = ox.distance.nearest_nodes(
            G,
            X=start_lon,
            Y=start_lat,
        )

        best_result = None

        for indoor_entrance, outdoor_node in LTB_CONNECTORS.items():
            if indoor_entrance not in indoor_graph:
                continue

            try:
                outdoor_path = nx.shortest_path(
                    G,
                    outdoor_start,
                    outdoor_node,
                    weight="length",
                )

                indoor_path = turn_aware_shortest_path(
                    indoor_graph,
                    indoor_entrance,
                    end_node,
                )

            except (nx.NetworkXNoPath, nx.NodeNotFound):
                continue

            result = {
                "entrance_node": indoor_entrance,
                "entrance_label": LTB_ENTRANCES[
                    indoor_entrance
                ]["label"],
                "entrance_mapping_verified": (
                    LTB_ENTRANCE_CONFIG["mapping_verified"]
                ),
                "outdoor_node": outdoor_node,
                "outdoor_path": [
                    (G.nodes[node]["y"], G.nodes[node]["x"])
                    for node in outdoor_path
                ],
                "indoor_path": [
                    {
                        "id": node_id,
                        "floor": indoor_graph.nodes[node_id].get("floor"),
                        "type": indoor_graph.nodes[node_id].get("type"),
                        "description": indoor_graph.nodes[node_id].get(
                            "description", ""
                        ),
                        "x_pixel": indoor_graph.nodes[node_id].get("x_pixel"),
                        "y_pixel": indoor_graph.nodes[node_id].get("y_pixel"),
                    }
                    for node_id in indoor_path
                ],
            }

            outdoor_distance = sum(
                min(
                    edge["length"]
                    for edge in G.get_edge_data(u, v).values()
                )
                for u, v in zip(
                    outdoor_path[:-1],
                    outdoor_path[1:],
                )
            )

            indoor_metrics = measure_indoor_path(
                indoor_graph,
                indoor_path,
            )

            result["outdoor_distance_m"] = outdoor_distance
            result.update(indoor_metrics)

            known_distance = (
                outdoor_distance
                + indoor_metrics["indoor_horizontal_distance_m"]
            )
            result["total_known_distance_m"] = round(
                known_distance, 1
            )

            indoor_estimate = indoor_metrics[
                "indoor_estimated_distance_m"
            ]

            result["total_estimated_distance_m"] = (
                round(outdoor_distance + indoor_estimate, 1)
                if indoor_estimate is not None
                else None
            )

            result["total_estimate_min_m"] = (
                round(
                    outdoor_distance
                    + indoor_metrics["indoor_estimate_min_m"],
                    1,
                )
                if indoor_estimate is not None
                else None
            )

            result["total_estimate_max_m"] = (
                round(
                    outdoor_distance
                    + indoor_metrics["indoor_estimate_max_m"],
                    1,
                )
                if indoor_estimate is not None
                else None
            )

            comparison_score = result["total_estimated_distance_m"]

            if comparison_score is None:
                comparison_score = known_distance + 1_000_000

            if (
                best_result is None
                or comparison_score < best_result["comparison_score"]
            ):
                result["comparison_score"] = comparison_score
                best_result = result

        if best_result is None:
            return {
                "error": (
                    "No route is available for this walking preference. "
                    "Check indoor corridor connectivity and entrance links."
                )
            }

        best_result.pop("comparison_score", None)
        return best_result

    except (nx.NetworkXNoPath, nx.NodeNotFound, ValueError):
        return {
            "error": "No valid combined outdoor and indoor route is available."
        }


# -------------------------------------------------------------------
# Outdoor graph overlay
# -------------------------------------------------------------------

@app.get("/api/graph")
def get_graph():
    try:
        edges = []

        SOUTH = -37.9185
        NORTH = -37.8990
        WEST = 145.1255
        EAST = 145.1445

        for u, v, data in G.edges(data=True):
            geometry = data.get("geometry")

            if geometry:
                coords = list(geometry.coords)
                edge_coords = [
                    (lat, lon)
                    for lon, lat in coords
                ]
            else:
                edge_coords = [
                    (G.nodes[u]["y"], G.nodes[u]["x"]),
                    (G.nodes[v]["y"], G.nodes[v]["x"]),
                ]

            if any(
                SOUTH <= lat <= NORTH and WEST <= lon <= EAST
                for lat, lon in edge_coords
            ):
                edges.append(edge_coords)

        return {"edges": edges}

    except Exception:
        return {
            "error": "The outdoor graph could not be returned."
        }


# -------------------------------------------------------------------
# Building search
# -------------------------------------------------------------------

@app.get("/search/buildings")
def search_buildings(q: str):
    query = q.strip().lower()

    if not query:
        return []

    return [
        building
        for building in BUILDINGS
        if query in building["name"].lower()
    ]


# -------------------------------------------------------------------
# Outdoor building-to-building routing
# -------------------------------------------------------------------

@app.get("/api/building-route")
def building_route(
    start_lat: float,
    start_lon: float,
    end_lat: float,
    end_lon: float,
):
    try:
        start_node = ox.distance.nearest_nodes(
            G,
            X=start_lon,
            Y=start_lat,
        )
        end_node = ox.distance.nearest_nodes(
            G,
            X=end_lon,
            Y=end_lat,
        )

        route = nx.shortest_path(
            G,
            start_node,
            end_node,
            weight="length",
        )

        coordinates = [
            [G.nodes[node]["y"], G.nodes[node]["x"]]
            for node in route
        ]

        distance = nx.path_weight(
            G,
            route,
            weight="length",
        )

        return {
            "route": coordinates,
            "distance_m": distance,
        }

    except (nx.NetworkXNoPath, nx.NodeNotFound, ValueError):
        return {
            "error": "No outdoor route is available between those buildings."
        }


# -------------------------------------------------------------------
# LTB debugging endpoints (kept available, no startup diagnostics)
# -------------------------------------------------------------------

@app.get("/api/debug-ltb-connectivity")
def debug_ltb_connectivity(
    start_node: str = "G_N20",
    end_node: str = "G_N54",
):
    result = {}

    for node_id in (start_node, end_node):
        if node_id not in LTB_G:
            result[node_id] = {"error": "Node not found"}
            continue

        result[node_id] = {
            "floor": LTB_G.nodes[node_id].get("floor"),
            "type": LTB_G.nodes[node_id].get("type"),
            "neighbours": [
                {
                    "id": neighbour,
                    "floor": LTB_G.nodes[neighbour].get("floor"),
                    "type": LTB_G.nodes[neighbour].get("type"),
                    "description": LTB_G.nodes[neighbour].get(
                        "description", ""
                    ),
                }
                for neighbour in LTB_G.neighbors(node_id)
            ],
        }

    ground_nodes = [
        node_id
        for node_id, data in LTB_G.nodes(data=True)
        if data.get("floor") == "G"
    ]
    ground_graph = LTB_G.subgraph(ground_nodes)

    if start_node in ground_graph and end_node in ground_graph:
        result["same_floor_path_exists"] = nx.has_path(
            ground_graph,
            start_node,
            end_node,
        )
    else:
        result["same_floor_path_exists"] = False

    return result


@app.get("/api/debug-ltb-ground-components")
def debug_ltb_ground_components():
    ground_nodes = [
        node_id
        for node_id, data in LTB_G.nodes(data=True)
        if data.get("floor") == "G"
    ]

    ground_graph = LTB_G.subgraph(ground_nodes).copy()
    components = list(nx.connected_components(ground_graph))

    start_component = next(
        (c for c in components if "G_N20" in c),
        set(),
    )
    end_component = next(
        (c for c in components if "G_N54" in c),
        set(),
    )

    def describe(component):
        return [
            {
                "id": node_id,
                "type": ground_graph.nodes[node_id].get("type"),
                "description": ground_graph.nodes[node_id].get(
                    "description", ""
                ),
                "x_pixel": ground_graph.nodes[node_id].get("x_pixel"),
                "y_pixel": ground_graph.nodes[node_id].get("y_pixel"),
            }
            for node_id in sorted(component)
        ]

    return {
        "component_count": len(components),
        "component_sizes": sorted(
            [len(c) for c in components],
            reverse=True,
        ),
        "start_component_size": len(start_component),
        "end_component_size": len(end_component),
        "start_component": describe(start_component),
        "end_component": describe(end_component),
    }


@app.get("/api/debug-ltb-ground-edges")
def debug_ltb_ground_edges():
    result = []

    for u, v, data in LTB_G.edges(data=True):
        node_u = LTB_G.nodes[u]
        node_v = LTB_G.nodes[v]

        if (
            node_u.get("floor") != "G"
            or node_v.get("floor") != "G"
        ):
            continue

        result.append({
            "from": u,
            "from_type": node_u.get("type"),
            "from_description": node_u.get("description", ""),
            "from_x": node_u.get("x_pixel"),
            "from_y": node_u.get("y_pixel"),
            "to": v,
            "to_type": node_v.get("type"),
            "to_description": node_v.get("description", ""),
            "to_x": node_v.get("x_pixel"),
            "to_y": node_v.get("y_pixel"),
            "weight": round(float(data.get("weight", 0)), 2),
            "vertical": data.get("vertical", False),
            "connector_type": data.get("connector_type"),
        })

    return {"edges": result}


@app.get("/api/debug-ltb-route")
def debug_ltb_route(
    start_node: str = "G_N20",
    end_node: str = "G_N54",
):
    try:
        path = nx.shortest_path(
            LTB_G,
            source=start_node,
            target=end_node,
            weight="weight",
        )

        route_details = []

        for i, node_id in enumerate(path):
            node = LTB_G.nodes[node_id]
            neighbours = []

            for neighbour in LTB_G.neighbors(node_id):
                edge = LTB_G.edges[node_id, neighbour]
                other = LTB_G.nodes[neighbour]

                neighbours.append({
                    "id": neighbour,
                    "floor": other.get("floor"),
                    "type": other.get("type"),
                    "description": other.get("description", ""),
                    "x_pixel": other.get("x_pixel"),
                    "y_pixel": other.get("y_pixel"),
                    "edge_weight": round(
                        float(edge.get("weight", 0)), 2
                    ),
                    "vertical": edge.get("vertical", False),
                    "connector_type": edge.get("connector_type"),
                })

            route_details.append({
                "step": i,
                "id": node_id,
                "floor": node.get("floor"),
                "type": node.get("type"),
                "description": node.get("description", ""),
                "x_pixel": node.get("x_pixel"),
                "y_pixel": node.get("y_pixel"),
                "neighbours": neighbours,
            })

        return {
            "start": start_node,
            "destination": end_node,
            "route": route_details,
        }

    except (nx.NetworkXNoPath, nx.NodeNotFound) as exc:
        return {"error": str(exc)}


# -------------------------------------------------------------------
# Local development runner
# -------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
    )
