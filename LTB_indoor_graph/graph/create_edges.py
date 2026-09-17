import json
import math

# --------------------------------------------------
# SETTINGS
# --------------------------------------------------

NODES_PATH = "output/nodes.json"
EDGES_PATH = "output/edges.json"

# Maximum distance for corridor-to-corridor connections
CORRIDOR_MAX_DISTANCE = 100

# Maximum distance for rooms/connectors to reach a corridor
CONNECTOR_MAX_DISTANCE = 180

# --------------------------------------------------
# LOAD NODES
# --------------------------------------------------

with open(NODES_PATH, "r") as file:
    nodes = json.load(file)

# Fix the one incorrect corridor type
for node in nodes.values():
    if node["type"] == "corridor'":
        node["type"] = "corridor"

# --------------------------------------------------
# HELPER FUNCTIONS
# --------------------------------------------------

def distance(node_a, node_b):
    dx = node_a["x_pixel"] - node_b["x_pixel"]
    dy = node_a["y_pixel"] - node_b["y_pixel"]

    return math.sqrt(dx ** 2 + dy ** 2)


def add_edge(edges, node_a_id, node_b_id, node_a, node_b):
    edges.append({
        "from": node_a_id,
        "to": node_b_id,
        "distance_pixels": round(distance(node_a, node_b), 2)
    })


# --------------------------------------------------
# CREATE EDGES
# --------------------------------------------------

edges = []

node_ids = list(nodes.keys())

# --------------------------------------------------
# CORRIDOR → CORRIDOR
# --------------------------------------------------

for i in range(len(node_ids)):
    for j in range(i + 1, len(node_ids)):

        a_id = node_ids[i]
        b_id = node_ids[j]

        a = nodes[a_id]
        b = nodes[b_id]

        # Same floor only
        if a["floor"] != b["floor"]:
            continue

        # Only corridor-to-corridor
        if a["type"] != "corridor" or b["type"] != "corridor":
            continue

        d = distance(a, b)

        if d <= CORRIDOR_MAX_DISTANCE:
            add_edge(edges, a_id, b_id, a, b)


# --------------------------------------------------
# ROOMS / STAIRS / LIFTS / ENTRANCES
# → NEAREST CORRIDOR
# --------------------------------------------------

for node_id, node in nodes.items():

    if node["type"] == "corridor":
        continue

    candidates = []

    for corridor_id, corridor in nodes.items():

        if corridor["type"] != "corridor":
            continue

        if corridor["floor"] != node["floor"]:
            continue

        d = distance(node, corridor)

        if d <= CONNECTOR_MAX_DISTANCE:
            candidates.append((d, corridor_id, corridor))

    # Sort nearest first
    candidates.sort(key=lambda x: x[0])

    # Connect to at most the two nearest corridor nodes
    for d, corridor_id, corridor in candidates[:2]:

        add_edge(
            edges,
            node_id,
            corridor_id,
            node,
            corridor
        )


# --------------------------------------------------
# SAVE
# --------------------------------------------------

with open(EDGES_PATH, "w") as file:
    json.dump(edges, file, indent=4)

print(f"Created {len(edges)} edges.")
print(f"Saved to {EDGES_PATH}")
