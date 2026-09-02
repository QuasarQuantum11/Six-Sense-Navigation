from PIL import Image
import matplotlib.pyplot as plt
import json
import os

# --------------------------------------------------
# SETTINGS
# --------------------------------------------------

FLOOR = "G"

IMAGE_PATH = f"floorplans/Floor {FLOOR}.png"
OUTPUT_PATH = "output/nodes.json"

# --------------------------------------------------
# LOAD FLOOR PLAN
# --------------------------------------------------

image = Image.open(IMAGE_PATH)

plt.figure(figsize=(16, 11))
plt.imshow(image)
plt.title(
    "Click a navigation point.\n"
    "Close the window when you are finished."
)
plt.axis("on")

# --------------------------------------------------
# LOAD EXISTING NODES
# --------------------------------------------------

if os.path.exists(OUTPUT_PATH):
    with open(OUTPUT_PATH, "r") as file:
        nodes = json.load(file)
else:
    nodes = {}

# --------------------------------------------------
# SELECT NODES
# --------------------------------------------------

node_number = 1

while True:

    print("\nClick a point on the floor plan.")

    points = plt.ginput(1, timeout=-1)

    if not points:
        break

    x, y = points[0]

    print(f"\nSelected position: ({x:.2f}, {y:.2f})")

    node_type = input(
        "Node type (entrance/corridor/room/lift/stairs): "
    ).strip()

    description = input(
        "Description/name (e.g. Main Entrance, Room 101): "
    ).strip()

    node_id = f"{FLOOR}_N{node_number:02d}"

    nodes[node_id] = {
        "floor": FLOOR,
        "type": node_type,
        "description": description,
        "x_pixel": round(x, 2),
        "y_pixel": round(y, 2)
    }

    print(f"Saved {node_id}")

    node_number += 1

# --------------------------------------------------
# SAVE NODES
# --------------------------------------------------

with open(OUTPUT_PATH, "w") as file:
    json.dump(nodes, file, indent=4)

plt.close()

print("\nAll nodes saved to:")
print(OUTPUT_PATH)