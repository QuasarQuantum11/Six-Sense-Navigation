import osmnx as ox

west, south, east, north = 145.1270, -37.9220, 145.1420, -37.9050
outdoor_filter = '["highway"]["highway"!~"corridor|motor|proposed|construction|abandoned|platform|raceway"]["foot"!~"no"]["indoor"!~"yes"]'

print("Downloading graph...")
G = ox.graph_from_bbox(bbox=(west, south, east, north), network_type='walk', custom_filter=outdoor_filter, truncate_by_edge=True)

print("Saving to file...")
ox.save_graphml(G, filepath="monash_graph.graphml")
print("Done!")