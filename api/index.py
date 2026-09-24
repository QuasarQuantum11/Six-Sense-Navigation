import os
import json
import uvicorn 
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import osmnx as ox
import networkx as nx
from api.indoor_distance import measure_indoor_path, routing_weight_pixels

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the pre-saved file
GRAPH_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "components",
    "monash_graph.graphml"
)
print("Loading saved Monash graph...")
G = ox.load_graphml(GRAPH_PATH)
print("Graph ready.")

# Load LTB indoor navigation graph
LTB_NODES_PATH = os.path.join(os.path.dirname(__file__), "ltb_nodes.json")
LTB_EDGES_PATH = os.path.join(os.path.dirname(__file__), "ltb_edges.json")

with open(LTB_NODES_PATH) as f:
    LTB_NODES = json.load(f)

with open(LTB_EDGES_PATH) as f:
    LTB_EDGES = json.load(f)

print(f"LTB indoor graph ready: {len(LTB_NODES)} nodes, {len(LTB_EDGES)} edges")

# LTB indoor-to-outdoor entrance connections
LTB_CONNECTORS = {
    "G_N01": 611527813,  # Bus Loop Entrance
    "G_N02": 588089887,  # South Car Park Entrance
    "G_N03": 611527849,  # LTB Lawn Entrance
}

# Build LTB indoor routing graph
LTB_G = nx.Graph()

for node_id, data in LTB_NODES.items():
    LTB_G.add_node(node_id, **data)

for edge in LTB_EDGES:
    weight = routing_weight_pixels(
        edge, LTB_NODES[edge["from"]], LTB_NODES[edge["to"]]
    )
    LTB_G.add_edge(
        edge["from"],
        edge["to"],
        weight=weight,
        vertical=edge.get("vertical", False),
        connector_type=edge.get("type"),
    )

print(f"LTB routing graph ready: {LTB_G.number_of_nodes()} nodes, {LTB_G.number_of_edges()} edges")

# Routing
@app.get("/api/route")
def get_route(start_lat: float, start_lon: float, end_lat: float, end_lon: float):
    try:
        orig_node = ox.distance.nearest_nodes(G, X=start_lon, Y=start_lat)
        dest_node = ox.distance.nearest_nodes(G, X=end_lon, Y=end_lat)
        path = nx.shortest_path(G, orig_node, dest_node, weight='length')
        route_coords = [(G.nodes[node]['y'], G.nodes[node]['x']) for node in path]
        return {"route": route_coords}
    except Exception as e:
        return {"error": str(e)}

# Basic indoor LTB routing
@app.get("/api/indoor-nodes")
def get_indoor_nodes():
    return LTB_NODES

@app.get("/api/indoor-route")
def get_indoor_route(start_node: str, end_node: str):
    try:
        if start_node not in LTB_G:
            return {"error": f"Unknown start node: {start_node}"}
        if end_node not in LTB_G:
            return {"error": f"Unknown end node: {end_node}"}

        path = nx.shortest_path(LTB_G, start_node, end_node, weight="weight")

        route = []
        for node_id in path:
            data = LTB_G.nodes[node_id]
            route.append({
                "id": node_id,
                "floor": data.get("floor"),
                "type": data.get("type"),
                "description": data.get("description", ""),
                "x_pixel": data.get("x_pixel"),
                "y_pixel": data.get("y_pixel")
            })

        return {"route": route, **measure_indoor_path(LTB_G, path)}

    except Exception as e:
        return {"error": str(e)}

# Combined outdoor + indoor LTB routing
@app.get("/api/ltb-route")
def get_ltb_route(start_lat: float, start_lon: float, end_node: str):
    try:
        if end_node not in LTB_G:
            return {"error": f"Unknown indoor destination: {end_node}"}

        # Find the closest outdoor node to the starting location
        outdoor_start = ox.distance.nearest_nodes(G, X=start_lon, Y=start_lat)

        best_result = None

        # Try each LTB entrance and choose the shortest combined route
        for indoor_entrance, outdoor_node in LTB_CONNECTORS.items():
            outdoor_path = nx.shortest_path(G, outdoor_start, outdoor_node, weight="length")
            indoor_path = nx.shortest_path(LTB_G, indoor_entrance, end_node, weight="weight")

            result = {
                "entrance_node": indoor_entrance,
                "outdoor_node": outdoor_node,
                "outdoor_path": [(G.nodes[node]["y"], G.nodes[node]["x"]) for node in outdoor_path],
                "indoor_path": [
                    {
                        "id": node_id,
                        "floor": LTB_G.nodes[node_id].get("floor"),
                        "type": LTB_G.nodes[node_id].get("type"),
                        "description": LTB_G.nodes[node_id].get("description", ""),
                        "x_pixel": LTB_G.nodes[node_id].get("x_pixel"),
                        "y_pixel": LTB_G.nodes[node_id].get("y_pixel")
                    }
                    for node_id in indoor_path
                ]
            }

            outdoor_distance = sum(
                min(edge["length"] for edge in G.get_edge_data(u, v).values())
                for u, v in zip(outdoor_path[:-1], outdoor_path[1:])
            )

            indoor_metrics = measure_indoor_path(LTB_G, indoor_path)
            result["outdoor_distance_m"] = outdoor_distance
            result.update(indoor_metrics)

            known_distance = outdoor_distance + indoor_metrics["indoor_horizontal_distance_m"]
            result["total_known_distance_m"] = round(known_distance, 1)
            indoor_estimate = indoor_metrics["indoor_estimated_distance_m"]
            result["total_estimated_distance_m"] = (
                round(outdoor_distance + indoor_estimate, 1)
                if indoor_estimate is not None else None
            )
            result["total_estimate_min_m"] = (
                round(outdoor_distance + indoor_metrics["indoor_estimate_min_m"], 1)
                if indoor_estimate is not None else None
            )
            result["total_estimate_max_m"] = (
                round(outdoor_distance + indoor_metrics["indoor_estimate_max_m"], 1)
                if indoor_estimate is not None else None
            )
            comparison_score = result["total_estimated_distance_m"]
            if comparison_score is None:
                comparison_score = known_distance + 1_000_000

            if best_result is None or comparison_score < best_result["comparison_score"]:
                result["comparison_score"] = comparison_score
                best_result = result

        return best_result

    except Exception as e:
        return {"error": str(e)}


# Return the navigation graph for map overlay
# Return the navigation graph for map overlay
@app.get("/api/graph")
def get_graph():
    try:
        edges = []

        # Clayton campus + nearby surrounding roads
        SOUTH = -37.9185
        NORTH = -37.8990
        WEST = 145.1255
        EAST = 145.1445

        for u, v, data in G.edges(data=True):
            geometry = data.get("geometry")

            if geometry:
                coords = list(geometry.coords)

                # Graph geometry is (longitude, latitude)
                edge_coords = [(lat, lon) for lon, lat in coords]

            else:
                # Fallback if an edge has no geometry
                edge_coords = [
                    (G.nodes[u]['y'], G.nodes[u]['x']),
                    (G.nodes[v]['y'], G.nodes[v]['x'])
                ]

            # Keep only edges within the desired map area
            if any(
                SOUTH <= lat <= NORTH and WEST <= lon <= EAST
                for lat, lon in edge_coords
            ):
                edges.append(edge_coords)

        return {"edges": edges}

    except Exception as e:
        return {"error": str(e)}

# Local runner (For local testing)
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
