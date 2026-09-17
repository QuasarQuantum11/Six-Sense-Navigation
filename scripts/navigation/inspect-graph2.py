import osmnx as ox
from collections import Counter

G = ox.load_graphml("monash_graph.graphml")

print(f"Nodes: {len(G.nodes)}")
print(f"Edges: {len(G.edges)}")

# Highway counts
highway_counts = Counter()

# Geometry count
geometry_count = 0

# Other useful attributes
oneway_counts = Counter()
width_count = 0
access_count = 0
name_count = 0

for _, _, data in G.edges(data=True):

    highway = data.get("highway")

    if isinstance(highway, list):
        for h in highway:
            highway_counts[h] += 1
    elif highway:
        highway_counts[highway] += 1

    if data.get("geometry") is not None:
        geometry_count += 1

    oneway_counts[str(data.get("oneway"))] += 1

    if data.get("width") is not None:
        width_count += 1

    if data.get("access") is not None:
        access_count += 1

    if data.get("name") is not None:
        name_count += 1


print("\n========== HIGHWAY COUNTS ==========")

for highway, count in highway_counts.most_common():
    print(f"{highway}: {count}")


print("\n========== OTHER ATTRIBUTES ==========")

print(f"Edges with geometry: {geometry_count}/{len(G.edges)}")
print(f"Edges with width:    {width_count}/{len(G.edges)}")
print(f"Edges with access:   {access_count}/{len(G.edges)}")
print(f"Edges with name:     {name_count}/{len(G.edges)}")

print("\n========== ONEWAY ==========")

for value, count in oneway_counts.items():
    print(f"{value}: {count}")