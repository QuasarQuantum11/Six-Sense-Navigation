import json
import math

with open("output/nodes.json", "r") as file:
    nodes = json.load(file)

targets = [
    "G_N55",
    "G_N57",
    "G_N60",
    "G_N61",
    "2_N24",
    "2_N44",
    "3_N15",
    "3_N37",
    "3_N67"
]

for target in targets:
    node = nodes[target]

    print(
        f"\n{target} | Floor {node['floor']} | "
        f"{node['type']} | {node['description']}"
    )
    print(
        f"Position: ({node['x_pixel']:.1f}, {node['y_pixel']:.1f})"
    )

    nearby = []

    for node_id, other in nodes.items():
        if node_id == target:
            continue

        if other["floor"] != node["floor"]:
            continue

        distance = math.hypot(
            node["x_pixel"] - other["x_pixel"],
            node["y_pixel"] - other["y_pixel"]
        )

        nearby.append((distance, node_id, other))

    nearby.sort()

    print("Nearest nodes:")

    for distance, node_id, other in nearby[:5]:
        print(
            f"  {node_id} | {other['type']} | "
            f"{other['description']} | "
            f"distance = {distance:.1f}px"
        )
