"""Pedestrian rules for the outdoor OSM graph.

The graph was downloaded with a custom Overpass filter that excludes
``foot=no`` but not ``access=no``/``access=private``. Those ways (for example
the Campus Centre basement vehicle tunnel and the Bus Loop) are not open to
people on foot, yet they stayed in the routing graph. A building pin that
snapped to the end of such a way forced every route to start with it.

``pedestrian_subgraph`` removes those edges and keeps only the largest
strongly connected component, so every remaining node can reach every other
node and a start or destination can never snap to an isolated fragment.

Limitation: the saved graphml does not store the OSM ``foot`` tag, so a way
tagged ``access=no`` + ``foot=yes`` would also be removed. To handle that
case, regenerate the graph with ``foot`` in ``ox.settings.useful_tags_way``
and allow ``foot`` in {yes, designated, permissive}.
"""

import ast

import networkx as nx

BLOCKED_ACCESS = frozenset({"no", "private"})


def _values(value):
    """Return an OSM tag value as a list (simplified edges may hold a list)."""
    if value is None:
        return []
    if isinstance(value, str) and value.startswith("[") and value.endswith("]"):
        try:
            value = ast.literal_eval(value)
        except (SyntaxError, ValueError):
            return [value]
    if isinstance(value, (list, tuple)):
        return [str(item) for item in value]
    return [str(value)]


def is_pedestrian_accessible(edge_data):
    """False when any part of a (possibly merged) way is closed to the public."""
    return not any(value in BLOCKED_ACCESS for value in _values(edge_data.get("access")))


def pedestrian_subgraph(graph):
    """Return (walkable graph, summary) without access=no/private edges.

    Only the largest strongly connected component is kept. The input graph is
    not modified.
    """
    walkable = graph.copy()
    blocked = [
        (u, v, key)
        for u, v, key, data in walkable.edges(keys=True, data=True)
        if not is_pedestrian_accessible(data)
    ]
    walkable.remove_edges_from(blocked)

    largest = max(nx.strongly_connected_components(walkable), key=len, default=set())
    walkable = walkable.subgraph(largest).copy()

    summary = {
        "removed_edges": len(blocked),
        "removed_nodes": graph.number_of_nodes() - walkable.number_of_nodes(),
        "nodes": walkable.number_of_nodes(),
        "edges": walkable.number_of_edges(),
    }
    return walkable, summary
