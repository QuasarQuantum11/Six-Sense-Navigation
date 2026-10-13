import json
import math
from pathlib import Path

API_DIR = Path(__file__).parent
GEOJSON_PATH = API_DIR / "data" / "campus-buildings.geojson"
BUILDINGS_PATH = API_DIR / "buildings.json"

with GEOJSON_PATH.open(encoding="utf-8") as file:
    geojson = json.load(file)

with BUILDINGS_PATH.open(encoding="utf-8") as file:
    buildings = json.load(file)

NAME_ALIASES = {
    "learning and teaching building (ltb)": [
        "learning and teaching building",
        "ltb",
    ],
    "david derham school of law": [
        "david derham law building",
    ],
    "woodside building": [
        "woodside",
    ],
    "monash it": [
        "information technology",
        "faculty of information technology",
    ],
    "robert blackwood hall": [
        "sir robert blackwood concert hall",
        "robert blackwood concert hall",
    ],
}

footprints = {}

for feature in geojson.get("features", []):
    props = feature.get("properties") or {}
    geometry = feature.get("geometry") or {}

    name = props.get("name")
    if name and props.get("building") and geometry.get("type") == "Polygon":
        footprints.setdefault(name.strip().lower(), []).append({
            "name": name,
            "id": props.get("@id", feature.get("id", "unknown")),
        })

print("BUILDING FOOTPRINT MATCH REPORT")
print("=" * 50)

matched = 0


for building in buildings:
    name = building["name"].strip().lower()
    possible_names = [name] + NAME_ALIASES.get(name, [])

    candidates = []
    seen_ids = set()

    for possible_name in possible_names:
        for candidate in footprints.get(possible_name.strip().lower(), []):
            if candidate["id"] not in seen_ids:
                candidates.append(candidate)
                seen_ids.add(candidate["id"])

    if candidates:
        matched += 1
        print(f"\nMATCH: {building['name']}")
        for candidate in candidates:
            print(f"  {candidate['name']} [{candidate['id']}]")
    else:
        print(f"\nNO MATCH: {building['name']}")

print("\n" + "=" * 50)
print(f"Searchable buildings: {len(buildings)}")
print(f"Buildings with exact-name footprint matches: {matched}")
print(f"Buildings without exact-name matches: {len(buildings) - matched}")


print("\nNEAREST FOOTPRINTS FOR UNMATCHED BUILDINGS")
print("=" * 50)

unmatched_names = {
    "learning and teaching building (ltb)",
    "woodside building",
}

def haversine_m(lat1, lon1, lat2, lon2):
    radius = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

for building in buildings:
    if building["name"].strip().lower() not in unmatched_names:
        continue

    # Locate this building's original centre in buildings.json.
    original = next(
        (b for b in json.load(open(BUILDINGS_PATH, encoding="utf-8"))
         if b["name"].strip().lower() == building["name"].strip().lower()),
        None,
    )
    if original is None:
        continue

    nearby = []
    for name, candidates in footprints.items():
        for candidate in candidates:
            feature = next(
                (f for f in geojson["features"]
                 if (f.get("properties") or {}).get("@id") == candidate["id"]),
                None,
            )
            if not feature:
                continue

            geometry = feature.get("geometry") or {}
            coords = geometry.get("coordinates") or []
            if geometry.get("type") != "Polygon" or not coords or not coords[0]:
                continue

            # Use the average of the outer ring vertices as a rough search point.
            ring = coords[0][:-1]
            centre_lon = sum(p[0] for p in ring) / len(ring)
            centre_lat = sum(p[1] for p in ring) / len(ring)
            distance = haversine_m(
                original["latitude"], original["longitude"],
                centre_lat, centre_lon,
            )
            nearby.append((distance, candidate["name"], candidate["id"]))

    print(f"\n{original['name']}:")
    for distance, name, feature_id in sorted(nearby)[:5]:
        print(f"  {distance:.1f} m — {name} [{feature_id}]")
