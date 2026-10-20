# Outdoor wheelchair routing

Accessible navigation recommends **unverified step-free route candidates**.
It does not certify wheelchair access. Current graph data lacks reliable
surface, slope, kerb, width and crossing information.

## Path rules

| Path information | Routing treatment |
| --- | --- |
| Stairs, including steps within merged highway tags | Excluded |
| Explicit wheelchair prohibition or limited access | Excluded |
| Private or prohibited public access | Excluded by the public graph policy |
| Footway, pedestrian, path, cycleway, living street | Candidate unless explicitly excluded |
| Service link | Candidate unless explicitly excluded or a recorded speed exceeds 20 km/h |
| Residential, unclassified or generic road | Requires an explicit wheelchair-accessible flag |
| Major roads and unknown highway types | Excluded |

The service-road speed threshold is an application policy, not an accessibility
standard. Missing speed/accessibility data leaves the link unverified. Being
classified as a service link does not prove that it has a pavement or safe kerbs.
No path is relabelled as verified simply to make a route possible.

The router filters eligibility **before selecting endpoint nodes**, retains
the largest strongly connected candidate network, and applies the existing
100 metre maximum estimated endpoint connector. A returned connector is a
straight-line estimate, not proof of a traversable building entrance or crossing.
Smaller candidate components cannot currently be used, even for local trips.

## Richardson Hall to Menzies investigation

The checked-in `components/monash_graph.graphml` reproduces the failure with
the former policy, which excluded every service road. Representative nearby
nodes are Richardson `4636745032` and Menzies `4721847759`. Retaining candidate
service links produces approximately **1,219 metres along the graph**, including
Dinosaur Drive and unnamed service links. Endpoint connectors are additional.
This is a graph-data investigation, not a site accessibility inspection or a
replay of the user's exact GPS reading. A live database with different graph
data may produce a different route. After the targeted Neon review below, the
read-only live database audit also returned 1,219 m with approximately 9 m and
19 m endpoint connectors.

Run the reproducible local regression:

```powershell
.\.venv\Scripts\python.exe -m unittest api.tests.test_wheelchair_policy
```

The live route handler uses **Neon**, not a generated GraphML file. No import
or graph regeneration is needed. The read-only Neon audit found all 1,218
service edges marked false; the user confirmed these flags were generated
automatically from highway type rather than verified on site.

`review-service-access.py` defaults to a dry run. It identifies public service
edges whose stored speed/step data and every matching source edge pass the
candidate policy. The review identified 1,134 eligible directed edge rows;
ambiguous, restricted and higher-speed links remain excluded. Applying the
review changed these 1,134 generated false flags to NULL (unverified), never
to true, and saved `artifacts/navigation/service-access-review.json` for a
conditional rollback. Explicit true flags,
stairs and other road categories are preserved. Run with `--restore <backup>
--apply` to restore the reviewed legacy false flags.

## Existing crowd estimator

The teammate-owned crowd estimator, API and real/demo datasets are unchanged.
Outdoor routing uses Neon's existing edge weights, falling back to length.
No additional crowd multipliers or fixed simulation scenario are applied.
The existing crowd overlay remains available. In the current estimator version,
overlay grades do not update routing weights automatically; any future
integration should use the estimator owner's agreed routing contract.
