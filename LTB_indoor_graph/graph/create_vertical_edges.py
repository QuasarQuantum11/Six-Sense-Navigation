import json

NODES_PATH = "output/nodes.json"
EDGES_PATH = "output/vertical_edges.json"

with open(NODES_PATH, "r") as file:
    nodes = json.load(file)

# Matching vertical connectors across floors
connector_groups = [
    ["G_N14", "1_N01", "2_N01", "3_N01"],  # Main Lift
    ["G_N41", "1_N02", "2_N02", "3_N02"],  # External Lift
    ["G_N15", "1_N03", "2_N03", "3_N03"],  # Main Stairway
    ["G_N16", "1_N04", "2_N04", "3_N04"],  # Side Stairway
    ["G_N17", "1_N05", "2_N05", "3_N05"],  # External Stairs 1
    ["G_N18", "1_N06", "2_N06", "3_N06"],  # External Stairs 2
    ["G_N19", "1_N07", "2_N07", "3_N07"],  # External Stairs 3
    ["G_N33", "1_N08", "2_N08", "3_N08"],  # External Stairs 4
]

edges = []

# Connect each vertical connector to the same connector
# on the floor immediately above it.
for group in connector_groups:

    for i in range(len(group) - 1):

        from_node = group[i]
        to_node = group[i + 1]

        # Make sure both nodes actually exist
        if from_node not in nodes or to_node not in nodes:
            print(f"WARNING: Missing node: {from_node} or {to_node}")
            continue

        connector_type = nodes[from_node]["type"]

        edges.append({
            "from": from_node,
            "to": to_node,
            "type": connector_type,
            "vertical": True
        })

with open(EDGES_PATH, "w") as file:
    json.dump(edges, file, indent=4)

print(f"Created {len(edges)} vertical edges.")
print(f"Saved to {EDGES_PATH}")
