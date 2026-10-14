import argparse
import ast
from pathlib import Path

import networkx as nx


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = ROOT / "components" / "monash_graph.graphml"
DEFAULT_OUTPUT = ROOT / "components" / "monash_wheelchair_graph.graphml"

ROAD_HIGHWAYS = {
    "motorway",
    "motorway_link",
    "trunk",
    "trunk_link",
    "primary",
    "primary_link",
    "secondary",
    "secondary_link",
    "tertiary",
    "tertiary_link",
    "residential",
    "service",
    "unclassified",
    "road",
}


def tag_values(value):
    if value is None:
        return []

    if isinstance(value, str):
        try:
            parsed = ast.literal_eval(value)
        except (SyntaxError, ValueError):
            parsed = value
        value = parsed

    if isinstance(value, (list, tuple, set)):
        return [str(item).strip().lower() for item in value if item is not None]
    return [str(value).strip().lower()]


def has_steps(attributes):
    highway_values = tag_values(attributes.get("highway"))
    if "steps" in highway_values:
        return True

    step_count = tag_values(attributes.get("step_count"))
    return any(value.isdigit() and int(value) > 0 for value in step_count)


def is_road(attributes):
    highway_values = tag_values(attributes.get("highway"))
    return any(
        value in ROAD_HIGHWAYS or "road" in value
        for value in highway_values
    )


def rejection_reason(attributes):
    if is_road(attributes):
        return "road"
    if has_steps(attributes):
        return "steps"
    if "no" in tag_values(attributes.get("foot")):
        return "foot access=no"
    if any(value in {"no", "private"} for value in tag_values(attributes.get("access"))):
        return "access restricted"
    if any(value in {"no", "limited"} for value in tag_values(attributes.get("wheelchair"))):
        return "wheelchair tag"
    return None


def edge_records(graph):
    if graph.is_multigraph():
        yield from graph.edges(keys=True, data=True)
    else:
        for from_node, to_node, attributes in graph.edges(data=True):
            yield from_node, to_node, None, attributes


def main():
    parser = argparse.ArgumentParser(
        description="Create a wheelchair-candidate graph from a local GraphML file."
    )
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report filtered edge counts without writing an output graph.",
    )
    args = parser.parse_args()

    if not args.input.is_file():
        raise FileNotFoundError(f"Input graph not found: {args.input}")

    graph = nx.read_graphml(args.input)
    filtered = graph.copy()
    rejected = {
        "road": 0,
        "steps": 0,
        "foot access=no": 0,
        "access restricted": 0,
        "wheelchair tag": 0,
    }

    for from_node, to_node, key, attributes in list(edge_records(filtered)):
        reason = rejection_reason(attributes)
        if reason:
            rejected[reason] += 1
            if filtered.is_multigraph():
                filtered.remove_edge(from_node, to_node, key)
            else:
                filtered.remove_edge(from_node, to_node)
        else:
            attributes["has_steps"] = False
            attributes["wheelchair_accessible"] = True
            attributes["wheelchair_accessibility_source"] = "inferred_non_road_non_steps"

    print(f"Input: {args.input}")
    print(f"Edges before filtering: {graph.number_of_edges()}")
    print(f"Edges retained: {filtered.number_of_edges()}")
    for reason, count in rejected.items():
        if count:
            print(f"Edges excluded ({reason}): {count}")

    if args.dry_run:
        print("Dry run only; no graph was written.")
        return

    args.output.parent.mkdir(parents=True, exist_ok=True)
    nx.write_graphml(filtered, args.output)
    print(f"Filtered graph written to: {args.output}")
    print("Wheelchair accessibility is inferred for retained edges, not verified.")


if __name__ == "__main__":
    main()