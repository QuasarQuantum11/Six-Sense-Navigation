import json

EDGES_PATH = "output/edges.json"

with open(EDGES_PATH, "r") as file:
    edges = json.load(file)

new_edges = [
    ("G_N55", "G_N04"),
    ("G_N57", "G_N06"),
    ("G_N60", "G_N06"),
    ("G_N61", "G_N06"),
    ("2_N24", "2_N44"),
    ("2_N44", "2_N39"),
    ("3_N15", "3_N27"),
    ("3_N37", "3_N23"),
    ("3_N67", "3_N17"),
]

existing = {
    (edge["from"], edge["to"])
    for edge in edges
} | {
    (edge["to"], edge["from"])
    for edge in edges
}

added = 0

for from_node, to_node in new_edges:
    if (from_node, to_node) not in existing:
        edges.append({
            "from": from_node,
            "to": to_node,
            "type": "corridor"
        })
        added += 1

with open(EDGES_PATH, "w") as file:
    json.dump(edges, file, indent=4)

print(f"Added {added} repair edges.")
print(f"Total edges: {len(edges)}")
