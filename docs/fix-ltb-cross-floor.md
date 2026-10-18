# Fix: LTB cross-floor indoor routing

Branch: `fix/ltb-cross-floor-edges` · Based on: `main` `4fa0dc8` · Date: 18 Oct 2026 · Author: Jiaqi
Status: **ready for review; not merged into `main`**. Jasleen owns the LTB indoor data and should confirm before merging.

## 1. Problem found

Since commit `2f8978d` ("Indoor edges and graphs now smooth and cohesive", 14 Oct 2026, 19:20), **no indoor route can change floors**. Requirement R2 asks for navigation "between different levels in indoor environments", so this blocks part of the R2 demo.

### What users see

| Action in `/map` | Result on `main` `4fa0dc8` |
|---|---|
| LTB room: start Campus Centre, destination **G01** (ground floor) | Works |
| LTB room: start Campus Centre, destination **101**, **231** or **383** (floors 1–3) | "No LTB route was found." |
| Indoor-to-indoor: **G01 → 101** | "No route is available for this walking preference…" |
| Same requests with the accessible walking preference | Same errors |

### Evidence

| Check | `e05c27c` (before) | `2f8978d` → `4fa0dc8` (now) |
|---|---|---|
| Edges in `api/ltb_edges.json` | 491 | 549 |
| Edges between different floors | **24** (6 lift, 18 stairs) | **0** |
| Connected components in the indoor graph | 1 | **8** (one or more per floor) |
| Rooms with no edges at all | none | `3_N37` (room 383), `3_N67` (room 303) |

Failing tests on `main` `4fa0dc8`:
- `api.tests.test_ltb_connectors`: `test_cross_floor_routes_keep_a_candidate_ltb_outdoor_endpoint` fails for floors 1, 2 and 3.
- `api.tests.test_indoor_route_integration`: errors with `KeyError: 'indoor_path'`. This one is unrelated to floors: `/api/indoor-route` now returns `path`.

## 2. Root cause

`2f8978d` replaced `api/ltb_edges.json` with redrawn corridor edges (each with `distance_pixels`), but the new file contains no `vertical` edges. The 24 lift and stair links between floors were lost, together with the only edges of rooms `3_N37` and `3_N67`.

`api/index.py` builds `LTB_G` only from this file, so every floor became a separate island. The accessible graph is derived from the same file, so step-free routing failed as well.

## 3. Fix

### 3.1 Data: `api/ltb_edges.json` (append only; no existing edge removed or changed)

26 edges were restored exactly as they were in `e05c27c`. All their end nodes still exist in the current `api/ltb_nodes.json`.

| Restored edges | Count | Details |
|---|---|---|
| Lifts | 6 | `G_N14–1_N01–2_N01–3_N01` and `G_N41–1_N02–2_N02–3_N02` |
| Stairs | 18 | Six stair cores: `G_N15/16/17/18/19/33` up through `1_N03…1_N08`, `2_N03…2_N08` and `3_N03…3_N08` |
| Room links | 2 | `3_N37–3_N23` and `3_N67–3_N17` (no `distance_pixels`; `api/indoor_distance.py` measures them from node coordinates) |

### 3.2 Tests

- **New** `api/tests/test_ltb_graph_connectivity.py` (6 tests):
  - every pair of adjacent floors has at least one lift and one stair link;
  - the standard indoor graph is one connected building;
  - all 205 rooms are reachable from both enabled entrances;
  - step-free reachability misses only the known wing (see §5);
  - outdoor → floor 1/2/3 routes work for both walking preferences, and accessible routes use lifts and no stairs;
  - an indoor-to-indoor route works from the ground floor to floor 3.
- **Updated** `api/tests/test_indoor_route_integration.py`: it now reads the current `path` key (a list of node IDs) instead of `indoor_path`. The frontend already accepts `indoor_path`, `path` and `route`.

## 4. Verification

| Suite | `main` `4fa0dc8` | This branch |
|---|---|---|
| Python routing tests (`test_ltb_connectors`, `test_indoor_distance`, `test_indoor_route_integration`, `test_route_privacy`, `test_pedestrian_graph`, and the new `test_ltb_graph_connectivity`) | 19 passed, 3 failed, 1 error (23 tests) | **29 passed** |
| New connectivity tests run against the unfixed edge file | — | 12 failures, so the tests detect the defect |
| Vitest (`npm test`) | 235 passed, 1 file fails to load | Unchanged (the file is not touched by this fix; see §6) |

Routes from Campus Centre on this branch (`/api/ltb-route`, Python):

| Destination | Normal | Accessible |
|---|---|---|
| G01 (`G_N20`) | ≈ 396.9 m, no floor change | ≈ 396.9 m |
| 101 (`1_N42`) | ≈ 418.0 m, 1 stair link | ≈ 473.4 m, 1 lift link |
| 231 (`2_N45`) | ≈ 458.8 m, 2 stair links | ≈ 465.0 m, 2 lift links |
| 383 (`3_N37`) | ≈ 474.9 m, 3 lift links (the lift is shorter here) | ≈ 474.9 m, 3 lift links |

Indoor-to-indoor G01 → 383: 11 nodes, 3 floor changes, ≈ 109.2 m indoors.

Distances include the existing assumptions for vertical travel (4.5 m per floor by lift, 12 m by stairs; see the README section "LTB indoor distance").

### How to check in the app

1. Start the Python API, which must be restarted after this JSON change: `python -m uvicorn api.index:app --reload --port 8000`.
2. Start Next.js: `npm run dev`.
3. Open `/map` → LTB room → start Campus Centre → floor 1 → room 101 → Plan route. The route should open, and the floor plan should step from G to floor 1.
4. Repeat for 231 (floor 2) and 383 (floor 3).
5. Try indoor-to-indoor G01 → 101.
6. Logged in with the accessible walking preference, the same routes should use lifts.

## 5. Known limitation (not introduced by this fix)

With the accessible preference, seven floor 1 rooms (`1_N91`–`1_N97`) cannot be reached. Their wing (`1_N31`–`1_N40`) connects to the rest of the building only through the `1_N05` stairs.

This was already the case at `e05c27c`, which also had `3_N46` and `3_N47` in the same situation. The new test pins this exact set, so any change will be noticed.

**Jasleen, please confirm from the floor plans** whether that wing has a step-free corridor that should be added.

## 6. Not changed / out of scope

- Corridor geometry and `distance_pixels` from `2f8978d` are kept as they are.
- No frontend, API or outdoor routing code was changed.
- `lib/navigation/tests/campus-integration.test.ts` still fails to load under Vitest. `app/api/route/route.ts` now imports `getWalkingPreference`, which imports `server-only` (from the wheelchair-preference work), and that test does not mock it. This is a test-setup issue, not a runtime bug, and is left for a separate fix.

## 7. Questions for Jasleen before merging

1. Was removing the lift and stair edges intentional? For example, are new connector positions planned for the redrawn corridors?
2. Are the restored connector nodes (`G_N14`, `G_N41`, `G_N15`–`G_N19`, `G_N33` and their counterparts on floors 1–3) still in the right places on the new floor plans?
3. Are `3_N37–3_N23` and `3_N67–3_N17` the correct corridor links for rooms 383 and 303?
