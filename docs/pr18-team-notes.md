# Six-Sense Navigation: what PR #18 changed, and what it means for you

From: Jiaqi · Updated 14 Oct 2026 · Applies to `main` at `8f09c4f` (merge of PR #18 `fix/r1-review-followup`: commits `3caba5d` and `10a73e9`)

Background reading: `docs/r1-review-followup.md` in the repo.

---

## 1. What PR #18 does

| Area | Change |
|---|---|
| Campus Centre tunnel | Outdoor routes no longer use the Campus Centre basement tunnel (OSM way 996225593, `access=no`, `foot=permit`). All 50 `access=no/private` edges in the saved graph are excluded |
| Where the filter runs | `/api/route` and `/api/graph` filter on every request (`lib/navigation/public-outdoor.ts`). The Python API filters when it loads the graph (`api/pedestrian_graph.py`). The importer filters before inserting. **No Neon re-import is needed** |
| `/api/route` input | Validated with zod; out-of-range coordinates return 400 |
| `/api/route` responses | Every response sends `Cache-Control: private, no-store` (R12). The same start and destination returns 0 m. Unreachable points get a plain 422 message. Internal database details are never shown |
| Entrance data | The LTB and Campus Centre entrances moved out of `route.ts` into `api/ltb_entrances.json` and `api/campus_centre_entrances.json` |
| Tests | Vitest 414/414 and Python 23/23 on `main`. An independent NetworkX check of all 182 building routes agrees. My extra check: 676 routes from points within 60 m of Campus Centre; none uses the tunnel and none errors |

---

## 2. Jasleen (R2 indoor / LTB)

### 2.1 LTB entrances: before and after

`app/api/route/route.ts` used to define its own `BUILDINGS.ltb` with three entrances. It now builds them from `api/ltb_entrances.json` (`route.ts` lines 5–6 and 47–55), the same file the Python API uses for `/api/ltb-route`.

| Your entrance in `route.ts` (before) | Coordinates | Now | Distance to your point | Indoor node |
|---|---|---|---|---|
| Car Park Entrance | -37.913908, 145.132796 | `east` candidate (-37.913906, 145.1328033), outdoor node 6801226848 | 0.7 m | `G_N02` "South Car Park Entrance" |
| Bus Loop Entrance | -37.913662, 145.132447 | `west` candidate (-37.9136649, 145.1324424), outdoor node 7764050705 | 0.5 m | `G_N01` "Bus Loop Entrance" |
| Campus-facing Entrance | -37.913393, 145.132742 | **Removed** | Nearest walking-path node 9201945780 is 14.3 m away | Probably `G_N03` "LTB Lawn Entrance", which is in `disabled_indoor_nodes` |

So two of your three doors are effectively unchanged. Only the campus-facing (Lawn) door is not used for routing.

### 2.2 LTB search pin

In `components/Map.tsx` lines 344–346, choosing LTB in the search box now places the pin on the entrance named by `building_search_entrance` in `ltb_entrances.json`:

| | Before | After |
|---|---|---|
| Pin | Hard-coded -37.913901, 145.132517 | `east` candidate -37.913906, 145.1328033 (about 25 m east) |

Because the pin now sits exactly on the LTB centre used in `route.ts`, the entrance logic applies when LTB is chosen from search. It did not before, because the old pin was 25 m from the centre.

### 2.3 R2 figures that changed

Python `/api/ltb-route`, normal speed, destination `G_N20`:

| Start | Before PR #18 | After PR #18 | Why |
|---|---|---|---|
| Campus Centre | outdoor 323 m (via tunnel) | **outdoor 370.7 m, total 397.3 m**, via `G_N01` (Bus Loop) | The tunnel is excluded |
| Sir Louis Matheson Library | n/a | outdoor 303.6 m, total 369.0 m, via `G_N02` (South Car Park) | Measured on current `main` |

Outdoor building-to-LTB routes (`/api/route`): Sir Louis Matheson Library → LTB is now **318 m / 4 min**.

### 2.4 Test you may notice

`api/tests/test_indoor_route_integration.py` now reads `result["indoor_path"]`, because `cacdeba` renamed the response key from `route`. The frontend already reads `indoor_path` (`Map.tsx` falls back to `route`). **Please confirm `indoor_path` is the key you intend to keep.**

### 2.5 Not changed

Indoor routing, the stair-free accessible mode, indoor-to-indoor routes, `api/ltb_nodes.json`, `api/ltb_edges.json`, and the floor-plan view.

### 2.6 Optional: restore the campus-facing (Lawn) entrance

Only do this if you confirm that the campus-facing door is `G_N03` and the coordinates come from a reliable source (site visit or floor plan). I tested these exact steps in a copy of `main`: all 414 Vitest and 23 Python tests pass.

**Step 1.** In `api/ltb_entrances.json`, add a third item to `"entrances"` and empty the disabled list:

```json
    {
      "id": "lawn",
      "label": "Lawn candidate entrance",
      "indoor_node": "G_N03",
      "outdoor_node": 9201945780,
      "latitude": -37.9132852,
      "longitude": 145.1326522
    }
```
```json
  "disabled_indoor_nodes": []
```

Rules:
- `latitude` and `longitude` must be exactly the outdoor node's coordinates. `api/index.py` refuses to start if they differ by more than 1e-7.
- The label must contain the word "candidate", because a test checks this.
- If you know a walking-path node closer to the real door, use that node and its exact coordinates instead.

**Step 2.** In `api/tests/test_ltb_connectors.py` lines 10–11, change:

```python
self.assertEqual(len(LTB_CONNECTORS), 2)
self.assertNotIn("G_N03", LTB_CONNECTORS)
```
to
```python
self.assertEqual(len(LTB_CONNECTORS), 3)
self.assertIn("G_N03", LTB_CONNECTORS)
```

**Step 3.** Regenerate the reference data and run the tests:

```bash
source .venv/bin/activate
python scripts/navigation/verify-routes.py
npm test
python -m unittest api.tests.test_ltb_connectors api.tests.test_indoor_distance api.tests.test_indoor_route_integration api.tests.test_route_privacy api.tests.test_pedestrian_graph
```

Expected:
- `verify-routes.py` rewrites `lib/navigation/tests/fixtures/networkx-reference.json`;
- `npm test` shows 414 passed;
- the Python tests end with OK (23 tests).

Without Step 3, 23 Vitest tests fail, because the stored LTB reference distances change.

**Effect on demo figures (tested):**

| Route | Current `main` | With the Lawn entrance |
|---|---|---|
| Campus Centre → LTB `G_N20` (Python) | 370.7 m outdoor / 397.3 m total via `G_N01` | 332.4 m / 360.8 m via `G_N03` |
| Sir Louis Matheson → LTB `G_N20` (Python) | 303.6 m / 369.0 m via `G_N02` | 271.5 m / 299.9 m via `G_N03` |
| Sir Louis Matheson → LTB (`/api/route`) | 318 m | 286 m |
| Campus Centre → LTB (`/api/route`) | n/a | 223 m |
| Menzies → LTB (`/api/route`) | n/a | 217 m |

These changes affect both R1's and R2's demo numbers, so please agree with the team before merging.

### 2.7 Questions for you

1. Is the campus-facing door the same as `G_N03` "LTB Lawn Entrance"?
2. Where did the three `route.ts` entrance coordinates come from: site, floor plan, or map estimate?
3. Is `indoor_path` the final response key?

---

## 3. Jonathan (graph scripts, debug overlay)

### 3.1 `scripts/navigation/generate_graph.py`

| Line | Before | After |
|---|---|---|
| 6 | (none) | `ox.settings.useful_tags_way` now also keeps `access`, `foot` and `tunnel` |
| 9 | `["foot"!~"no"]` | `["foot"!~"no\|private\|permit"]` |
| 15 | `save_graphml(G, filepath="monash_graph.graphml")`, which saved to the current folder | Saves to **`components/monash_graph.graphml`**, overwriting the committed graph |

**Risk:** re-running the script downloads fresh OSM data. Node IDs can change, which breaks:
- `api/ltb_entrances.json`: outdoor nodes 7764050705 and 6801226848. `api/index.py` will refuse to start;
- `lib/navigation/pedestrian-restrictions.json`: tests check the graph hash;
- the stored NetworkX reference.

**Please don't re-run it before the demo** unless the team agrees. If you do:
1. Commit the result on a branch.
2. Check that both LTB outdoor nodes still exist.
3. Run `python scripts/navigation/verify-routes.py`, then `npm test` and the Python tests.

### 3.2 `scripts/navigation/import-graph.py`

- Line 80: the graph goes through `pedestrian_subgraph()` before insert. It prints "Removed 50 access=no/private edges and 15 unreachable nodes", then "Prepared 1852 nodes and 5402 edges".
- Line 174: a dry run (without `--apply`) no longer needs `DATABASE_URL`.
- **No Neon re-import is needed**, because `/api/route` filters old rows at request time. If the team does re-import later, try it on a Neon branch first.

### 3.3 `app/api/graph/route.ts`

The "Show navigation network (debug)" overlay now shows the filtered public graph: 1852 nodes and 5402 edges. The tunnel is not drawn.

### 3.4 Presentation note

There is **no outdoor step-free / accessibility routing** yet. `709b958` added a stair-free mode for indoor routes only. Please don't describe outdoor routes as step-free.

---

## 4. Benjamin

`lib/navigation/tests/walking.test.ts`: the expected values were updated for the 4 / 5 / 6 km/h speeds introduced in `5ff80a0`. For example, 590 m at the accessible speed is now 9 min (it was 10). No action needed.

---

## 5. Everyone: update and check

```bash
git checkout main
git pull origin main
npm install
npm test
source .venv/bin/activate
python -m unittest api.tests.test_ltb_connectors api.tests.test_indoor_distance api.tests.test_indoor_route_integration api.tests.test_route_privacy api.tests.test_pedestrian_graph
```

Expected:
- `npm test`: `Tests 414 passed (414)`.
- Python: `Graph ready: 1852 nodes, 5402 edges (50 access=no/private edges and 15 unreachable nodes removed).`, then `Ran 23 tests … OK`.

**Deployment:** redeploy Next.js, and **redeploy or restart the Python API** so it reloads the filtered graph. No database migration or re-import is needed.

Please re-run your own demo flow after pulling. Anything that starts or ends at LTB or Campus Centre may show new distances.

---

## 6. Current demo figures (`main` 8f09c4f, guest, normal speed)

| Route | Result |
|---|---|
| Sir Louis Matheson Library → LTB | 318 m / 4 min |
| Campus Centre → Monash IT | 186 m / 3 min |
| Campus Centre → Menzies | 73 m |
| Map point 13 m from Campus Centre → Monash IT | 212 m, no tunnel |
| Same building as start and destination | 0 m / 0 min, "You are already at the destination." |
| Point far off campus | 422: "Choose a start and destination within 100 metres of a campus walking path." |
| Campus Centre → LTB `G_N20` (R2) | 370.7 m outdoor, 397.3 m total |

All distances are map estimates, including short straight connectors to the path network.

---

## 7. Still open

| Item | Owner |
|---|---|
| Entrance pairings (LTB, Campus Centre) are candidates, not physically verified (`mapping_verified: false`) | Jasleen |
| The saved graph has no `foot` tags, so some of the 50 excluded edges (Bus Loop, private driveways) might allow walking. Conservative choice | Team |
| The remote branch `fix/r1-final` points to the old commit `a7d2675` and contains nothing new. I'll delete it unless someone objects | Jiaqi |
| Browser checks on the presentation machine; the logged-in walking-speed check; independent-user test | Each requirement owner |
