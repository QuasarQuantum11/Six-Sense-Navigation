# R1 review follow-up

Date: 2026-10-13 (Australia/Melbourne). Base: main `cacdeba`.
Branch: `fix/r1-review-followup`.

## Result

Outdoor routes now use the public pedestrian network for building searches,
arbitrary map selections and the debug overlay. The Python outdoor segment of
LTB routes and future navigation imports use the same access policy. Requests
again validate coordinates and return `Cache-Control: private, no-store` on
success and failure. Identical locations return 0 m; distant locations return
a friendly 422 instead of database statistics or an internal error.

This follows the 2026-10-13 R1 review and Campus Centre patch v2. It preserves
the latest main's building-entrance selection, true edge geometry and indoor
accessibility changes. No shared database rows or production deployment were
modified during verification.

## Implementation

- `api/pedestrian_graph.py` rejects saved `access=no/private` edges and retains
  the largest strongly connected component: 1852 nodes and 5402 edges.
  `api/index.py` applies it on startup; `import-graph.py` applies it before
  preparing insert rows. Dry-run no longer requires database credentials.
- `lib/navigation/public-outdoor.ts` applies the saved snapshot exclusions to
  old database rows before routing, and keeps the largest connected public
  component. `/api/graph` uses it too. Thus the code correction works even
  before a shared-table re-import.
- `pedestrian-restrictions.json` is generated from the real GraphML's access
  tags. Python and TypeScript tests check the graph hash, all 50 exclusions,
  filtered counts and retained LTB entrance nodes. Regenerate the policy and
  reference whenever the graph or entrance inputs change.
- The outdoor handler validates normalized camelCase inputs, continues to
  accept existing aliases and numeric strings, and hides raw database/parser
  errors. The stricter snake_case LTB input contract remains intact, including
  its `walking_speed` field.
- LTB search pins and outdoor candidate entrances share `ltb_entrances.json`
  with Python. Campus Centre's four existing team-provided candidates are now
  recorded in `campus_centre_entrances.json`, with their provenance and
  `mapping_verified: false`; they were not independently verified on site.
- Geometry selection now chooses the same cheapest parallel edge as routing,
  including reversed geometry. Short straight connectors already counted in
  the distance are drawn too. Those connectors remain estimates, not verified
  physical paths.
- The UI displays 0 m / 0 min and an arrival message for identical locations.
  Walking-speed tests now match the existing 4/5/6 km/h preferences. The indoor
  integration test was updated for main's `indoor_path` response field.

## Verification

| Check | Result |
|---|---|
| Vitest | 414/414 passed, 26 files |
| Python routing tests | 23/23 passed |
| NetworkX comparison | All 182 directed building routes agree |
| TypeScript | Passed after `next typegen` |
| Full ESLint | Passed |
| Production build | Passed |
| Drizzle migration metadata check | Passed; no schema migration added |
| Import preview | Removed 50 edges / 15 nodes; prepared 1852 / 5402 |
| Live local Next.js + shared Neon reads | Public graph counts and route/error responses verified |

The NetworkX reference is computed independently from the actual Python
importer's output, including candidate-entrance matching, metre-based nearest
nodes and connector distances. Committed hashes prevent stale fixtures from
quietly passing. Next.js tests use the real GraphML as legacy database rows,
then exercise the actual POST handler against all 182 reference results.

Reproduce with the project dependencies installed:

```sh
python scripts/navigation/verify-routes.py
npm test
python -m unittest discover -s api/tests -v
npx next typegen
npx tsc --noEmit
npm run lint
npm run build
./node_modules/.bin/drizzle-kit check --config=drizzle.config.ts
python scripts/navigation/import-graph.py
```

## Current demo values and local browser checks

Guest mode, local Next.js and Python servers, existing Neon navigation rows
read without modification:

| Scenario | Observed result |
|---|---|
| Campus Centre → Monash IT | 186 m / 3 min; blue ground-network route |
| Campus Centre → Menzies | 73 m / 1 min using a team candidate entrance |
| Same Campus Centre start/end | 0 m / 0 min; arrival message; no error |
| Matheson Library → LTB | 318 m / 4 min after unifying LTB candidates |
| Map-selected point near Campus Centre → Monash IT | 211 m / 3 min; selected-point label; no tunnel |
| Precise map regression point `(-37.91180, 145.13283)` → Monash IT | Live API: 212 m; no tunnel |
| Campus Centre → LTB G01 (`G_N20`) | Outdoor 370.7 m, indoor 26.6 m, total 397.3 m; west candidate; indoor view opens |
| Map dragging / zoom controls | Worked without route errors |
| Public debug endpoint | 1852 nodes / 5402 edges; restricted tunnel excluded |
| Invalid latitude 999 | 400, private/no-store; no graph read in unit test |
| More than 100 m from walking network | Friendly 422, private/no-store |

Three warmed live API requests for Matheson → LTB took 98.2, 83.0 and 67.7 ms,
including the read-only database query. These are local-development timings,
not a production performance guarantee. The first compiled route request took
about 1.4 seconds; pre-warm the demonstration environment.

The earlier 343 m / 5 min and 250 m values refer to different pins/entrance
rules and must not be mixed with this branch's measurements. All distances
remain map-based estimates. The 73 m result starts from a candidate entrance;
it does not include an indoor walk from the building centre.

## Remaining operational steps and limits

1. Review and merge the draft PR. Deploy both Next.js and Python. Production
   LTB proxying requires an HTTPS Python API, as before.
2. Coordinate any shared Neon navigation-table replacement with the team;
   preview first on a Neon branch, then run the existing importer with
   `--apply --replace` only against the agreed target. This was not executed.
   Runtime filtering already protects old rows after the code is deployed.
3. Repeat guest use cases on the actual presentation machine and deployment,
   including three successful rehearsals. Local screenshots are not evidence
   of production acceptance.
4. A logged-in browser check of walking preferences remains unexecuted; speed
   calculation is covered automatically. No student profile was modified.
5. Entrance pairings require physical confirmation. Outdoor accessibility,
   opening hours and road-closure data are outside this fix. The current saved
   GraphML lacks `foot`, so the access filter is conservative. Future downloads
   preserve foot/access tags, but should be checked for explicit pedestrian
   permissions before replacing the current snapshot.

Local acceptance screenshots and read-only API results are saved separately
in the workspace's `outputs/final-preparation/r1-followup/` directory.
