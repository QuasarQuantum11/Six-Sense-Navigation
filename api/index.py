
import os
import json
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import osmnx as ox
import networkx as nx
from api.indoor_distance import measure_indoor_path, routing_weight_pixels

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

# Load the pre-saved outdoor graph.
GRAPH_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "components",
    "monash_graph.graphml",
)
print("Loading saved Monash graph...")
G = ox.load_graphml(GRAPH_PATH)
print("Graph ready.")

# Load LTB indoor navigation data.
LTB_NODES_PATH = os.path.join(os.path.dirname(__file__), "ltb_nodes.json")
LTB_EDGES_PATH = os.path.join(os.path.dirname(__file__), "ltb_edges.json")

with open(LTB_NODES_PATH) as f:
    LTB_NODES = json.load(f)

with open(LTB_EDGES_PATH) as f:
    LTB_EDGES = json.load(f)

BUILDINGS_PATH = os.path.join(os.path.dirname(__file__), "buildings.json")

with open(BUILDINGS_PATH) as f:
    BUILDINGS = json.load(f)


@app.get("/api/buildings")
def get_buildings():
    return {"buildings": BUILDINGS}


print(f"Building search data ready: {len(BUILDINGS)} buildings")

# Candidate entrances on the actual LTB footprint.
with open(os.path.join(os.path.dirname(__file__), "ltb_entrances.json")) as f:
    LTB_ENTRANCE_CONFIG = json.load(f)

LTB_ENTRANCES = {
    entry["indoor_node"]: entry
    for entry in LTB_ENTRANCE_CONFIG["entrances"]
}
LTB_CONNECTORS = {
    indoor: entry["outdoor_node"]
    for indoor, entry in LTB_ENTRANCES.items()
}

for indoor, entry in LTB_ENTRANCES.items():
    outdoor = G.nodes[entry["outdoor_node"]]

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

# Build the standard LTB indoor routing graph.
LTB_G = nx.Graph()

for node_id, data in LTB_NODES.items():
    LTB_G.add_node(node_id, **data)

for edge in LTB_EDGES:
    weight = routing_weight_pixels(
        edge,
        LTB_NODES[edge["from"]],
        LTB_NODES[edge["to"]],
    )

    LTB_G.add_edge(
        edge["from"],
        edge["to"],
        weight=weight,
        vertical=edge.get("vertical", False),
        connector_type=edge.get("type"),
    )

LTB_ACCESSIBLE_G = LTB_G.copy()

for u, v, data in list(LTB_ACCESSIBLE_G.edges(data=True)):
    connector = str(
        data.get("connector_type", data.get("type", ""))
    ).strip().lower()

    if data.get("vertical") or connector in {
        "stairs", "stair", "staircase"
    }:
        LTB_ACCESSIBLE_G.remove_edge(u, v)

print(
    f"LTB routing graph ready: "
    f"{LTB_G.number_of_nodes()} nodes, {LTB_G.number_of_edges()} edges"
)

# Accessible routing graph: remove stair connections.
# A lift-connected route must exist for an accessible journey to succeed.
LTB_ACCESSIBLE_G = LTB_G.copy()

stair_edges = [
    (u, v)
    for u, v, data in LTB_ACCESSIBLE_G.edges(data=True)
    if data.get("vertical")
    and str(data.get("connector_type", "")).strip().lower()
    in {"stairs", "stair"}
]

LTB_ACCESSIBLE_G.remove_edges_from(stair_edges)

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
    return walking_speed in {"accessible", "normal", "fast"}


# Outdoor routing.
@app.get("/api/route")
def get_route(
    start_lat: float,
    start_lon: float,
    end_lat: float,
    end_lon: float,
):
    try:
        orig_node = ox.distance.nearest_nodes(
            G, X=start_lon, Y=start_lat
        )
        dest_node = ox.distance.nearest_nodes(
            G, X=end_lon, Y=end_lat
        )

        path = nx.shortest_path(
            G, orig_node, dest_node, weight="length"
        )

        route_coords = [
            (G.nodes[node]["y"], G.nodes[node]["x"])
            for node in path
        ]

        return {"route": route_coords}

    except Exception:
        return {
            "error": "The requested navigation data could not be calculated."
        }


# Indoor LTB nodes.
@app.get("/api/indoor-nodes")
def get_indoor_nodes():
    return LTB_NODES


# Direct indoor routing.
@app.get("/api/indoor-route")
def get_indoor_route(
    start_node: str,
    end_node: str,
    walking_speed: str = "normal",
):
    try:
        if not validate_walking_speed(walking_speed):
            return {"error": "Invalid walking speed preference."}

        graph = get_indoor_graph(
            accessible=(walking_speed == "accessible")
        )

        if start_node not in graph:
            return {
                "error": f"Unknown start node or no accessible route: {start_node}"
            }

        if end_node not in graph:
            return {
                "error": f"Unknown end node or no accessible route: {end_node}"
            }

        path = nx.shortest_path(
            graph, start_node, end_node, weight="weight"
        )

        route = []
        for node_id in path:
            data = graph.nodes[node_id]
            route.append({
                "id": node_id,
                "floor": data.get("floor"),
                "type": data.get("type"),
                "description": data.get("description", ""),
                "x_pixel": data.get("x_pixel"),
                "y_pixel": data.get("y_pixel"),
            })

        return {
            "route": route,
            **measure_indoor_path(graph, path),
        }

    except nx.NetworkXNoPath:
        return {
            "error": "No route is available for this walking preference."
        }
    except Exception:
        return {
            "error": "The requested navigation data could not be calculated."
        }


# Combined outdoor + indoor LTB routing request.
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
        pattern=r"^(accessible|normal|fast)$",
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
    route_graph = (
        LTB_ACCESSIBLE_G
        if walking_speed == "accessible"
        else LTB_G
    )

    try:
        if not validate_walking_speed(walking_speed):
            return {"error": "Invalid walking speed preference."}

        if end_node not in LTB_G:
            return {"error": f"Unknown indoor destination: {end_node}"}

        indoor_graph = get_indoor_graph(
            accessible=(walking_speed == "accessible")
        )

        # Find the closest outdoor node to the starting location.
        outdoor_start = ox.distance.nearest_nodes(
            G, X=start_lon, Y=start_lat
        )

        best_result = None

        # Try each configured LTB entrance.
        for indoor_entrance, outdoor_node in LTB_CONNECTORS.items():
            if indoor_entrance not in indoor_graph:
                continue

            try:
                outdoor_path = nx.shortest_path(
                    G, outdoor_start, outdoor_node, weight="length"
                )

                indoor_path = nx.shortest_path(
                    indoor_graph,
                    indoor_entrance,
                    end_node,
                    weight="weight",
                )

            except nx.NetworkXNoPath:
                continue

            result = {
                "entrance_node": indoor_entrance,
                "entrance_label": LTB_ENTRANCES[indoor_entrance]["label"],
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
                for u, v in zip(outdoor_path[:-1], outdoor_path[1:])
            )

            indoor_metrics = measure_indoor_path(
                indoor_graph, indoor_path
            )

            result["outdoor_distance_m"] = outdoor_distance
            result.update(indoor_metrics)

            known_distance = (
                outdoor_distance
                + indoor_metrics["indoor_horizontal_distance_m"]
            )
            result["total_known_distance_m"] = round(known_distance, 1)

            indoor_estimate = indoor_metrics["indoor_estimated_distance_m"]

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
                "error": "No route is available for this walking preference."
            }

        best_result.pop("comparison_score", None)
        return best_result

    except Exception:
        return {
            "error": "The requested navigation data could not be calculated."
        }


# Return the navigation graph for map overlay.
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
                # Graph geometry is (longitude, latitude).
                edge_coords = [(lat, lon) for lon, lat in coords]
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
            "error": "The requested navigation data could not be calculated."
        }


# Search campus buildings.
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


@app.get("/api/building-route")
def building_route(
    start_lat: float,
    start_lon: float,
    end_lat: float,
    end_lon: float,
):
    try:
        start_node = ox.distance.nearest_nodes(
            G, X=start_lon, Y=start_lat
        )
        end_node = ox.distance.nearest_nodes(
            G, X=end_lon, Y=end_lat
        )

        route = nx.shortest_path(
            G, start_node, end_node, weight="length"
        )

        coordinates = [
            [G.nodes[node]["y"], G.nodes[node]["x"]]
            for node in route
        ]

        distance = nx.path_weight(
            G, route, weight="length"
        )

        return {
            "route": coordinates,
            "distance_m": distance,
        }

    except Exception:
        return {
            "error": "The requested navigation data could not be calculated."
        }


# Local runner for testing.
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
