import uvicorn 
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import osmnx as ox
import networkx as nx

app = FastAPI()

# Allow frontend and backend to communicate with each other
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom filter to explicitly reject indoor tags and corridors
outdoor_filter = (
                '["highway"]'
                '["highway"!~"corridor|motor|proposed|construction|abandoned|platform|raceway"]'
                '["foot"!~"no"]'
                '["indoor"!~"yes"]'
                )

# Load Monash Clayton graph into memory on startup 
print("Downloading and building Monash Clayton graph...")
west,south,east,north = 145.1270, -37.9220, 145.1420, -37.9050

G = ox.graph_from_bbox(
    bbox = (west, south, east, north),
    network_type='walk',
    custom_filter=outdoor_filter,
    truncate_by_edge=True,
    )

print("Graph built successfully!")

@app.get("/route")
def get_route(start_lat: float, start_lon: float, end_lat: float, end_lon: float):
    try:
        # Snap the frontend coordinates to the nearest nodes in the graph
        orig_node = ox.distance.nearest_nodes(G, X=start_lon, Y=start_lat)
        dest_node = ox.distance.nearest_nodes(G, X=end_lon, Y=end_lat)

        # Run the routing algorithm 
        path = nx.shortest_path(G, orig_node, dest_node, weight='length')

        # Extract the actual GPS coordinates of the path to send back
        route_coords = [(G.nodes[node]['y'], G.nodes[node]['x']) for node in path]

        return {"route": route_coords}
    except nx.NetworkXNoPath:
        return {"error": "No path found between the specified points."}
    except Exception as e:
        return {"error": str(e)}

# fig, ax = ox.plot_graph(G, node_color='r', node_size=5, edge_linewidth=1)

# if __name__ == "__main__":
#     uvicorn.run(app, host="127.0.0.1", port=8000)