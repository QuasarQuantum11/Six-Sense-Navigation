# Fix: LTB cross-floor and step-free indoor routing

Branch: `fix/ltb-cross-floor-edges` · Based on: `main` `4fa0dc8` · Date: 18 Oct 2026 · Author: Jiaqi
Status: **ready for review; not merged into `main`**. Jasleen owns the LTB indoor data and should confirm before merging.

This branch fixes three problems:

| # | Problem | Fix |
|---|---|---|
| 1 | No indoor route can change floors (R2) | Restore 24 lift and stair edges and 2 room links that `2f8978d` dropped |
| 2 | Step-free routes cannot reach the floor 1 study area | Add the missing corridor link `1_N30–1_N31`, confirmed on the Level 1 floor plan |
| 3 | A Vitest suite (182 real-campus outdoor routes) fails to load | Mock the server-only walking preference in that test |

---

## 1. Problem: no indoor route can change floors

### What users see on `main` `4fa0dc8`

| Action in `/map` | Result |
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
| Connected components in the indoor graph | 1 | **8** |
| Rooms with no edges | none | `3_N37` (room 383), `3_N67` (room 303) |

### Root cause

`2f8978d` ("Indoor edges and graphs now smooth and cohesive", 14 Oct, 19:20) replaced `api/ltb_edges.json` with redrawn corridor edges, but the new file has no `vertical` edges. The 24 lift and stair links were lost, together with the only edges of rooms `3_N37` and `3_N67`.

`api/index.py` builds the indoor graph only from this file, so every floor became a separate island. The accessible graph is derived from the same file, so it failed too.

### Fix

The 26 edges are appended exactly as they were in `e05c27c`. All their end nodes still exist in the current `api/ltb_nodes.json`.

| Restored edges | Count | Details |
|---|---|---|
| Lifts | 6 | `G_N14–1_N01–2_N01–3_N01` and `G_N41–1_N02–2_N02–3_N02` |
| Stairs | 18 | Six stair cores: `G_N15/16/17/18/19/33` up through `1_N03…1_N08`, `2_N03…2_N08` and `3_N03…3_N08` |
| Room links | 2 | `3_N37–3_N23`, `3_N67–3_N17` (lengths measured from node coordinates by `api/indoor_distance.py`) |

No existing edge was removed or changed.

---

## 2. Problem: step-free routes cannot reach the floor 1 study area

### What we found

With the accessible walking preference (stairs removed), seven floor 1 "Study Area" rooms, `1_N91`–`1_N97`, could not be reached from either entrance.

Their wing (corridor nodes `1_N31`–`1_N40`) was linked to the rest of the building **only through `1_N05`, "External Stairs 1"**. So the data said "stairs only", even though the floor plan shows an open corridor.

This gap predates `2f8978d`; it also exists at `e05c27c`.

### Evidence from the Level 1 floor plan

![Level 1 study-area link](images/ltb-floor1-study-area-link.png)

`1_N30` (beside 165B/166C) and `1_N31` (beside 164C) sit on the same straight, open passage between the workstation pods and room 152. There is no wall or door between them, and they are 156 px apart (≈ 11 m at the plan's 14.2 px/m). The edge was simply never drawn.

### Fix

Add one corridor edge in the current format:

```json
{ "from": "1_N30", "to": "1_N31", "distance_pixels": 156.03 }
```

Effect, starting near Campus Centre (`/api/ltb-route`):

| Room | Normal | Accessible: before | Accessible: after |
|---|---|---|---|
| Study Area `1_N91` | 1 stair link, ≈ 474.6 m | unreachable | 1 lift link, ≈ 480.9 m |
| Study Area `1_N95` | 1 stair link, ≈ 475.7 m | unreachable | 1 lift link, ≈ 511.6 m |

---

## 3. Problem: the real-campus Vitest suite fails to load

`app/api/route/route.ts` now calls `getWalkingPreference()` (added with the wheelchair preference). That function imports `server-only` session code.

`lib/navigation/tests/route-api.test.ts` already mocks it; `lib/navigation/tests/campus-integration.test.ts` did not. As a result, Vitest stopped loading that file, so the 182-route NetworkX regression check was not running.

**Fix:** mock `@/lib/students/walking-preference` in that test with the guest default (`normal`, not personalised), the same way `route-api.test.ts` does. This is test setup only; runtime behaviour is unchanged.

---

## 4. Tests

- **New** `api/tests/test_ltb_graph_connectivity.py` (8 tests):
  - every pair of adjacent floors has a lift and a stair link;
  - the standard and the step-free graphs are each one connected building;
  - all 205 rooms are reachable from both entrances, with and without stairs;
  - the `1_N30–1_N31` link exists;
  - outdoor → floors 1/2/3 work for both preferences, and accessible routes use lifts and no stairs;
  - there is a step-free route to the study area;
  - an indoor-to-indoor route works from the ground floor to floor 3.
- **Updated** `api/tests/test_indoor_route_integration.py`: it reads the current `path` key (a list of node IDs) instead of the old `indoor_path`. The frontend already accepts `indoor_path`, `path` and `route`.
- **Updated** `lib/navigation/tests/campus-integration.test.ts`: walking-preference mock (§3).

## 5. Verification

| Suite | `main` `4fa0dc8` | This branch |
|---|---|---|
| Python routing tests (`test_ltb_connectors`, `test_indoor_distance`, `test_indoor_route_integration`, `test_route_privacy`, `test_pedestrian_graph`, and the new `test_ltb_graph_connectivity`) | 19 passed, 3 failed, 1 error (23 tests) | **31 passed** |
| Vitest (`npm test`) | 235 passed; 1 file fails to load | **420 passed, 27 files** |
| New connectivity tests against the unfixed edge file | — | Fail (12 failures), so the tests detect the defect |
| The same tests with only the `1_N30–1_N31` edge removed | — | 3 failures |

Routes from Campus Centre on this branch:

| Destination | Normal | Accessible |
|---|---|---|
| G01 (`G_N20`) | ≈ 396.9 m, same floor | ≈ 396.9 m |
| 101 (`1_N42`) | ≈ 418.0 m, 1 stair link | ≈ 473.4 m, 1 lift link |
| 231 (`2_N45`) | ≈ 458.8 m, 2 stair links | ≈ 465.0 m, 2 lift links |
| 383 (`3_N37`) | ≈ 474.9 m, 3 lift links (the lift is shorter here) | ≈ 474.9 m, 3 lift links |

Indoor-to-indoor G01 → 383: 11 nodes, 3 floor changes, ≈ 109.2 m.

Vertical travel uses the existing assumptions: 4.5 m per floor by lift and 12 m by stairs (README, "LTB indoor distance").

### How to check in the app

1. Restart the Python API, because JSON changes are not hot-reloaded: `python -m uvicorn api.index:app --reload --port 8000`. Then run `npm run dev`.
2. `/map` → **LTB room** → start Campus Centre → floor 1 → room **101** → Plan route. The route should open, and the floor plan should step from G to floor 1. Repeat for **231** and **383**.
3. Indoor-to-indoor **G01 → 101**.
4. Logged in with the accessible walking preference: the same routes use lifts, and a floor 1 "Study Area" room is reachable.

## 6. Not changed

- Corridor geometry and `distance_pixels` from `2f8978d` are kept.
- No frontend, API or outdoor routing code was changed.
- No database change.

## 7. Questions for Jasleen before merging

1. Was removing the lift and stair edges in `2f8978d` intentional, for example with new connector positions planned?
2. Are the restored connector nodes (`G_N14`, `G_N41`, `G_N15`–`G_N19`, `G_N33` and their counterparts on floors 1–3) still placed correctly on the new floor plans?
3. Are `3_N37–3_N23`, `3_N67–3_N17` and the new `1_N30–1_N31` the right corridor links?
