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

# --------------------------------------------------
# LOAD EXISTING NODES
# --------------------------------------------------

if os.path.exists(OUTPUT_PATH):
    try:
        with open(OUTPUT_PATH, "r") as file:
            nodes = json.load(file)
    except json.JSONDecodeError:
        nodes = {}
else:
    nodes = {}

# Find the next available node number for this floor
existing_numbers = []

for node_id in nodes:
    if node_id.startswith(f"{FLOOR}_N"):
        try:
            existing_numbers.append(int(node_id.split("_N")[1]))
        except ValueError:
            pass

node_number = max(existing_numbers, default=0) + 1

# --------------------------------------------------
# DISPLAY FLOOR PLAN
# --------------------------------------------------

plt.ion()

fig, ax = plt.subplots(figsize=(16, 11))
ax.imshow(image)
ax.set_title(
    "Click a navigation point.\n"
    "Close the window when you are finished."
)
ax.set_xlabel("X pixel")
ax.set_ylabel("Y pixel")

plt.show(block=False)
plt.pause(0.5)

# --------------------------------------------------
# SELECT NODES
# --------------------------------------------------

while True:

    print("\nClick a point on the floor plan.")

    plt.draw()
    plt.pause(0.1)

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

    # Save immediately
    with open(OUTPUT_PATH, "w") as file:
        json.dump(nodes, file, indent=4)

    print(f"Saved {node_id}")
    print(f"Total nodes saved: {len(nodes)}")

    node_number += 1

plt.close(fig)

print("\nAll nodes saved to:")
print(OUTPUT_PATH)
