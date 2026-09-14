import os
import json
import uvicorn 
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import osmnx as ox
import networkx as nx

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the pre-saved file
GRAPH_PATH = os.path.join(os.path.dirname(__file__), "monash_graph.graphml")
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
    LTB_G.add_edge(
        edge["from"],
        edge["to"],
        weight=edge["distance_pixels"]
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