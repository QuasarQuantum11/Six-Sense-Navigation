import argparse
import ast
import os
from pathlib import Path

import networkx as nx
import psycopg2
from psycopg2.extras import execute_values


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_GRAPH_PATH = ROOT / "components" / "monash_graph.graphml"


def load_env_file(path: Path) -> None:
    if os.getenv("DATABASE_URL") or not path.exists():
        return

    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def first_value(value):
    if isinstance(value, str) and value.startswith("[") and value.endswith("]"):
        try:
            value = ast.literal_eval(value)
        except (SyntaxError, ValueError):
            pass

    if isinstance(value, (list, tuple)):
        return value[0] if value else None
    return value


def as_int(value):
    value = first_value(value)
    return int(value) if value not in (None, "") else None


def as_float(value):
    value = first_value(value)
    return float(value) if value not in (None, "") else None


def as_text(value):
    value = first_value(value)
    return str(value) if value not in (None, "") else None


def as_bool(value):
    value = first_value(value)
    if value in (None, ""):
        return None
    return str(value).strip().lower() in {"1", "true", "yes"}


def linestring_for_edge(graph, from_id, to_id, attributes):
    geometry = as_text(attributes.get("geometry"))
    if geometry:
        return geometry

    start = graph.nodes[from_id]
    end = graph.nodes[to_id]
    return (
        f"LINESTRING ({start['x']} {start['y']}, "
        f"{end['x']} {end['y']})"
    )


def read_graph(path: Path):
    graph = nx.read_graphml(path)
    nodes = []
    edges = []

    for node_id, attributes in graph.nodes(data=True):
        nodes.append(
            (
                int(node_id),
                float(attributes["y"]),
                float(attributes["x"]),
                as_int(attributes.get("street_count")),
            )
        )

    for from_id, to_id, attributes in graph.edges(data=True):
        edges.append(
            (
                int(from_id),
                int(to_id),
                as_int(attributes.get("osmid")),
                as_text(attributes.get("highway")),
                as_text(attributes.get("lanes")),
                as_text(attributes.get("maxspeed")),
                as_text(attributes.get("name")),
                as_bool(attributes.get("oneway")),
                as_text(attributes.get("ref")),
                as_bool(attributes.get("reversed")),
                float(attributes["length"]),
                as_float(attributes.get("weight")),
                linestring_for_edge(graph, from_id, to_id, attributes),
            )
        )

    return nodes, edges


def import_graph(database_url, nodes, edges, replace):
    with psycopg2.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM navigation_nodes")
            existing_nodes = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM navigation_edges")
            existing_edges = cursor.fetchone()[0]

            if (existing_nodes or existing_edges) and not replace:
                raise RuntimeError(
                    "Navigation tables are not empty. Re-run with --replace "
                    "if replacing the existing graph is intended."
                )

            if replace:
                cursor.execute("DELETE FROM navigation_edges")
                cursor.execute("DELETE FROM navigation_nodes")

            execute_values(
                cursor,
                """
                INSERT INTO navigation_nodes
                    (id, latitude, longitude, street_count)
                VALUES %s
                """,
                nodes,
                page_size=1000,
            )
            execute_values(
                cursor,
                """
                INSERT INTO navigation_edges
                    (from_node, to_node, osmid, highway, lanes, maxspeed,
                     name, oneway, ref, reversed, length, weight, geometry)
                VALUES %s
                """,
                edges,
                page_size=1000,
            )


def main():
    parser = argparse.ArgumentParser(description="Import the outdoor graph into Neon PostgreSQL.")
    parser.add_argument("--graph", type=Path, default=DEFAULT_GRAPH_PATH)
    parser.add_argument("--apply", action="store_true", help="Write the graph to Neon.")
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Allow existing navigation rows to be deleted before importing.",
    )
    args = parser.parse_args()

    load_env_file(ROOT / ".env.local")
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set in .env.local or the environment.")

    nodes, edges = read_graph(args.graph)
    print(f"Graph: {args.graph}")
    print(f"Prepared {len(nodes)} nodes and {len(edges)} edges.")
    if not args.apply:
        print("Dry run only. Use --apply to write this graph to Neon.")
        return

    import_graph(database_url, nodes, edges, args.replace)
    print("Navigation graph imported successfully.")


if __name__ == "__main__":
    main()