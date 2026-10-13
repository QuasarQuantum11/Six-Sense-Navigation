import osmnx as ox
from pathlib import Path

# Preserve foot permissions for the next snapshot. The current snapshot lacks
# them; filtering access=no/private is therefore deliberately conservative.
ox.settings.useful_tags_way = list(dict.fromkeys([*ox.settings.useful_tags_way, "access", "foot", "tunnel"]))

west, south, east, north = 145.1270, -37.9220, 145.1420, -37.9050
outdoor_filter = '["highway"]["highway"!~"corridor|motor|proposed|construction|abandoned|platform|raceway"]["foot"!~"no|private|permit"]["indoor"!~"yes"]'

print("Downloading graph...")
G = ox.graph_from_bbox(bbox=(west, south, east, north), network_type='walk', custom_filter=outdoor_filter, truncate_by_edge=True)

print("Saving to file...")
ox.save_graphml(G, filepath=Path(__file__).resolve().parents[2] / "components/monash_graph.graphml")
print("Done!")
