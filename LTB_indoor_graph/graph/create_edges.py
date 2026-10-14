
import json
import math
import os

# --------------------------------------------------
# SETTINGS
# --------------------------------------------------

NODES_PATH = "../output/nodes.json"
EDGES_PATH = "../output/edges.json"

# Maximum distance for corridor-to-corridor candidates
CORRIDOR_MAX_DISTANCE = 450

# Number of nearest corridor nodes to consider per corridor
NEAREST_CORRIDORS = 2

# Maximum distance for rooms/connectors to reach a corridor
CONNECTOR_MAX_DISTANCE = 180

# Number of corridor connections per room/connector
NEAREST_CONNECTORS = 2

# --------------------------------------------------
# LOAD NODES
# --------------------------------------------------

with open(NODES_PATH, "r") as file:
    nodes = json.load(file)

# Fix incorrect corridor types
for node in nodes.values():
    if node.get("type") == "corridor'":
        node["type"] = "corridor"

# --------------------------------------------------
# HELPER FUNCTIONS
# --------------------------------------------------

def distance(node_a, node_b):
    dx = node_a["x_pixel"] - node_b["x_pixel"]
    dy = node_a["y_pixel"] - node_b["y_pixel"]
    return math.sqrt(dx**2 + dy**2)


def add_edge(edges, node_a_id, node_b_id, node_a, node_b, edge_set):
    """Add an undirected edge once, using pixel distance as its weight."""
    if node_a_id == node_b_id:
        return

    edge_key = frozenset((node_a_id, node_b_id))

    if edge_key in edge_set:
        return

    edges.append({
        "from": node_a_id,
        "to": node_b_id,
        "distance_pixels": round(distance(node_a, node_b), 2)
    })

    edge_set.add(edge_key)


# --------------------------------------------------
# CREATE EDGES
# --------------------------------------------------

edges = []
edge_set = set()

# --------------------------------------------------
# CORRIDOR → CORRIDOR
# Connect each corridor to its nearest same-floor
# corridor candidates within the configured distance.
# --------------------------------------------------

for a_id, a in nodes.items():

    if a.get("type") != "corridor":
        continue

    candidates = []

    for b_id, b in nodes.items():

        if a_id == b_id:
            continue

        if b.get("type") != "corridor":
            continue

        # Same floor only
        if a.get("floor") != b.get("floor"):
            continue

        d = distance(a, b)

        if d <= CORRIDOR_MAX_DISTANCE:
            candidates.append((d, b_id, b))

    candidates.sort(key=lambda item: item[0])

    for d, b_id, b in candidates[:NEAREST_CORRIDORS]:
        add_edge(edges, a_id, b_id, a, b, edge_set)


# --------------------------------------------------
# ROOMS / STAIRS / LIFTS / ENTRANCES
# → NEAREST CORRIDOR
# --------------------------------------------------

for node_id, node in nodes.items():

    if node.get("type") == "corridor":
        continue

    candidates = []

    for corridor_id, corridor in nodes.items():

        if corridor.get("type") != "corridor":
            continue

        # Same floor only
        if corridor.get("floor") != node.get("floor"):
            continue

        d = distance(node, corridor)

        if d <= CONNECTOR_MAX_DISTANCE:
            candidates.append((d, corridor_id, corridor))

    candidates.sort(key=lambda item: item[0])

    for d, corridor_id, corridor in candidates[:NEAREST_CONNECTORS]:
        add_edge(
            edges,
            node_id,
            corridor_id,
            node,
            corridor,
            edge_set
        )


# --------------------------------------------------
# SAVE
# --------------------------------------------------

os.makedirs(os.path.dirname(EDGES_PATH) or ".", exist_ok=True)

with open(EDGES_PATH, "w") as file:
    json.dump(edges, file, indent=4)

print(f"Created {len(edges)} unique edges.")
print(f"Saved to {EDGES_PATH}")
print()
print("WARNING: Nearest-node edges are candidates, not")
print("verified walkable paths. Check them against each")
print("floor plan before using them for live navigation.")