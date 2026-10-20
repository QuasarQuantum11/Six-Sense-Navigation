"""Review legacy highway-derived false flags. Dry-run by default; never reimport.

Only public service links matching the saved source graph and candidate policy
are eligible. --apply changes false to NULL (unverified), never to true.
"""

import argparse
import json
import os
import sys
from pathlib import Path

import networkx as nx
import psycopg2
from psycopg2.extras import RealDictCursor

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from api.wheelchair_policy import rejection_reason, tag_values  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--backup", type=Path, default=ROOT / "artifacts/navigation/service-access-review.json")
    parser.add_argument("--restore", type=Path, help="Restore only reviewed NULL flags using a saved backup")
    args = parser.parse_args()
    for filename in [".env.local", ".env"]:
        for line in (ROOT / filename).read_text(encoding="utf8").splitlines():
            if line.startswith("DATABASE_URL="):
                os.environ.setdefault("DATABASE_URL", line.split("=", 1)[1].strip().strip('"').strip("'"))
    with psycopg2.connect(os.environ["DATABASE_URL"], connect_timeout=10) as connection:
        connection.set_session(readonly=not args.apply)
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            if args.restore:
                reviewed = json.loads(args.restore.read_text())
                ids = [row["id"] for row in reviewed["edges"]]
                if args.apply:
                    cursor.execute("UPDATE navigation_edges SET wheelchair_accessible = false WHERE id = ANY(%s) AND wheelchair_accessible IS NULL AND highway = 'service' AND has_steps = false", (ids,))
                    print(f"Restored {cursor.rowcount} legacy false flags.")
                else:
                    print(f"Dry run: would restore up to {len(ids)} reviewed flags; add --apply.")
                return
            source = nx.read_graphml(ROOT / "components/monash_graph.graphml")
            blocked = {tuple(pair) for pair in json.loads((ROOT / "lib/navigation/pedestrian-restrictions.json").read_text())["blockedEdges"]}
            cursor.execute("SELECT id, from_node, to_node, highway, maxspeed, name, has_steps, wheelchair_accessible FROM navigation_edges WHERE highway = 'service' AND wheelchair_accessible = false AND has_steps = false ORDER BY id")
            eligible = []
            for row in cursor.fetchall():
                pair = (row["from_node"], row["to_node"])
                source_edges = source.get_edge_data(str(pair[0]), str(pair[1]))
                if pair in blocked or not source_edges:
                    continue
                # Every original parallel source edge must pass, so a merged or
                # ambiguous link cannot conceal stairs, restrictions or a major road.
                if any(rejection_reason(attributes) or "service" not in tag_values(attributes.get("highway"))
                       for attributes in source_edges.values()):
                    continue
                candidate = {**row, "wheelchair_accessible": None}
                if rejection_reason(candidate):
                    continue
                eligible.append(dict(row))
            report = {"source": "User confirmed false flags were generated from highway type", "change": "false -> null (unverified), not verified true", "edges": eligible}
            print(json.dumps({"eligibleCount": len(eligible), "preview": eligible[:8]}, indent=2))
            if not args.apply:
                print("Dry run only. No database rows changed.")
                return
            if args.backup.exists():
                raise RuntimeError("Backup already exists; provide a new --backup path rather than overwriting it.")
            args.backup.parent.mkdir(parents=True, exist_ok=True)
            args.backup.write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
            ids = [row["id"] for row in eligible]
            cursor.execute("UPDATE navigation_edges SET wheelchair_accessible = NULL WHERE id = ANY(%s) AND wheelchair_accessible = false AND has_steps = false AND highway = 'service'", (ids,))
            if cursor.rowcount != len(ids):
                raise RuntimeError("Reviewed rows changed during the operation; transaction rolled back. Use a fresh backup path to retry.")
            print(f"Updated {cursor.rowcount} service links to unverified. Backup: {args.backup}")


if __name__ == "__main__":
    try:
        main()
    except psycopg2.Error:
        print("Neon review failed; connection details omitted.", file=sys.stderr)
        raise SystemExit(1)
