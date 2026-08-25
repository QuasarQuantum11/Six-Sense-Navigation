import os
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

# Local runner (For local testing)
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)