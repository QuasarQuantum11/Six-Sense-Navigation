import osmnx as ox

GRAPH_PATH = "monash_graph.graphml"

print("Loading graph...")
G = ox.load_graphml(GRAPH_PATH)

print(f"\nNodes: {len(G.nodes)}")
print(f"Edges: {len(G.edges)}")

# Show one node
node_id, node_data = next(iter(G.nodes(data=True)))

print("\n========== SAMPLE NODE ==========")
print("ID:", node_id)
for key, value in node_data.items():
    print(f"{key}: {value!r}")

# Show one edge
u, v, data = next(iter(G.edges(data=True)))

print("\n========== SAMPLE EDGE ==========")
print("From:", u)
print("To:", v)

for key, value in data.items():
    print(f"{key}: {value!r}")

# Show some different highway types
highway_types = set()

for _, _, data in G.edges(data=True):
    highway = data.get("highway")

    if highway:
        if isinstance(highway, list):
            highway_types.update(highway)
        else:
            highway_types.add(highway)

print("\n========== HIGHWAY TYPES ==========")
for highway in sorted(highway_types):
    print(highway)