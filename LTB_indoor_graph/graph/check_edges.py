from PIL import Image
import matplotlib.pyplot as plt
import json
import os

# --------------------------------------------------
# SETTINGS
# --------------------------------------------------

FLOOR = "G"

IMAGE_PATH = f"floorplans/Floor {FLOOR}.png"
NODES_PATH = "output/nodes.json"
EDGES_PATH = "output/edges.json"

# --------------------------------------------------
# LOAD DATA
# --------------------------------------------------

image = Image.open(IMAGE_PATH)

with open(NODES_PATH, "r") as file:
    nodes = json.load(file)

with open(EDGES_PATH, "r") as file:
    edges = json.load(file)

# --------------------------------------------------
# DISPLAY FLOOR PLAN
# --------------------------------------------------

fig, ax = plt.subplots(figsize=(16, 11))

ax.imshow(image)

# --------------------------------------------------
# DRAW EDGES
# --------------------------------------------------

for edge in edges:

    from_id = edge["from"]
    to_id = edge["to"]

    # Only show edges belonging to this floor
    if not from_id.startswith(f"{FLOOR}_"):
        continue

    node_a = nodes[from_id]
    node_b = nodes[to_id]

    ax.plot(
        [node_a["x_pixel"], node_b["x_pixel"]],
        [node_a["y_pixel"], node_b["y_pixel"]],
        color="blue",
        linewidth=0.7,
        alpha=0.4
    )

# --------------------------------------------------
# DRAW NODES
# --------------------------------------------------

for node_id, node in nodes.items():

    if node["floor"] != FLOOR:
        continue

    x = node["x_pixel"]
    y = node["y_pixel"]

    ax.plot(
        x,
        y,
        "ro",
        markersize=4
    )

    ax.text(
        x + 6,
        y,
        node_id,
        fontsize=7
    )

# --------------------------------------------------
# DISPLAY
# --------------------------------------------------

ax.set_title(
    f"Indoor Graph Inspection — Floor {FLOOR}\n"
    "Blue lines = automatically generated edges"
)

ax.set_xlabel("X pixel")
ax.set_ylabel("Y pixel")

plt.show()
