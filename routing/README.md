# Directed Mammoth routing backend

This package builds a NetworkX `MultiDiGraph` and runs Dijkstra on a filtered,
query-local graph. It does not change GeoJSON files or either map viewer.

## Install and test

From the repository root, using Python 3.11 or newer:

```bash
python3 -m venv .venv  # skip if the project environment already exists
.venv/bin/python -m pip install -r routing/requirements.txt
.venv/bin/python -m pytest tests/test_routing.py -q
```

On Windows use `py` and `.venv\Scripts\python.exe` instead. Dependencies are
pinned to the versions used for development. The suite includes synthetic
adversarial networks and an integration test against Mammoth's processed data.

## Graph audit

```bash
.venv/bin/python -m routing audit --output outputs/mammoth_routing_audit.json
```

The report includes graph counts, weak/strong component sizes, dead ends,
uphill segments, station disagreements, lift access gaps and connector proposals.
Generated reports and route files under `outputs/` are ignored by Git; recreate
them locally with the commands here.

Current results (no reviewed connectors):

| Graph | Nodes | Edges | Weak components | Strong components |
| --- | ---: | ---: | ---: | ---: |
| All difficulty groups, including unknown | 2,052 | 2,280 | 69 | 1,745 |
| Default routing: green, blue, black only | 1,934 | 2,091 | 76 | 1,775 |

The full graph has 1,784 trail edges, 28 lift edges and 468 directed junction
transfers. Weak components ignore direction; strong components require travel
in both directions. Their counts differ substantially in a downhill network.
No heuristic gap connectors are enabled by default.

## Query a route

For example, ride Chair 23 uphill, even with only green trails permitted:

```bash
.venv/bin/python -m routing route \
  --start -119.037769 37.6406848 \
  --destination -119.039052 37.6338582 \
  --allow green \
  --output outputs/example_lift_route.geojson
```

The command prints a summary and writes only the route FeatureCollection.
This example returns 766.10 m of lift travel and 3,064.39 weighted meters.
Use `--allow green blue black` (the default), add `--include-unknown` to permit
unknown ratings, or pass `--allow` with no values for lifts only. Use
`--max-snap 5` to tighten snapping (default 10 m, maximum 20 m).

The Python interface provides the complete ordered path and GeoJSON:

```python
from routing import load_graph, route

network = load_graph("data/processed")  # build once and reuse
result = route(
    network,
    start=[-119.037769, 37.6406848],
    destination=[-119.039052, 37.6338582],
    allowed_difficulties=["green", "blue"],
    include_unknown=False,
)
if result["status"] == "ok":
    print(result["total_weighted_cost"])
    print(result["total_trail_distance_m"])
    print(result["lifts_used"])
    ordered_edges = result["path"]
    route_geojson = result["geojson"]
else:
    print(result["message"])
```

`status` is `ok`, `unreachable`, or `snap_failed`. Failed results have empty
paths/GeoJSON and `total_weighted_cost: null`. Invalid arguments raise
`ValueError`. Identical valid start/destination locations return a zero-cost
route. Successful results also report lift and connector distances, and the
chosen snap coordinates, feature IDs and offset distances.

## Graph and geometry rules

- Topology calculations use UTM zone 11N (meters). WGS84 geodesic horizontal
  length determines edge distance, not degree distance or elevation difference.
  Output uses `[longitude, latitude, elevation]` coordinates.
- Each original trail vertex is retained as a node. This includes shape points
  in addition to endpoints, intersections and stations, allowing every local
  elevation change to be checked. New split points interpolate elevation;
  interpolated elevations are rounded to micrometers to suppress numeric noise.
- The overall endpoint drop establishes trail orientation, reversing coordinate
  order when necessary. Each resulting segment must be level or downhill in
  that orientation. A locally uphill segment is excluded and reported, never
  reversed independently or smoothed away. Flat *whole trails* are ambiguous
  and excluded. Non-operating/non-downhill/invalid features are excluded.
- Trail/trail intersections are split only when interpolated elevations differ
  by at most 2 m and neither feature is marked as a bridge/tunnel. Transfers
  themselves must never climb: unequal elevations produce only downhill
  transfers. Self-crossings and overlaps are not automatically joined.
- Lift geometry is oriented from lower to higher endpoint. Embedded `stations`
  and spots linked by `liftId` corroborate terminal positions and access flags.
  Explicitly forbidden loading/exit excludes the lift. Missing terminal metadata
  is reported and the geometric endpoint is used. Aerial crossings and
  intermediate stations never create transfers or boarding locations.
- Lift nodes have loading/unloading roles: transfers enter a loading terminal
  or leave an unloading terminal. Lift rides preserve all original coordinates,
  including any internal cable dips; they are single uphill terminal-to-terminal
  edges. Only the 28 operating lifts are included.
- Nodes are owned by their original feature, with explicit transfers between
  features at junctions. Coordinates within 2 cm are treated as near-coincident
  endpoint precision errors; elevation and station-role rules still apply.
- Trail cost = length, lift cost = length × 4, connector/junction cost = length.
  Thus total cost = trail distance + 4 × lift distance + connector distance.
  Cost is weighted meters, not estimated travel time.
- Edges retain feature IDs, ordered geometry, difficulty and original properties.
  Complete source features remain available at `network.features[id]` even when
  a segment is excluded. Route output includes IDs for joining back to the
  processed GeoJSON; original metadata is not duplicated into each route edge.

## Snapping and difficulty guarantees

Snapping chooses the nearest trail segment or lift terminal within the radius,
**before** filtering for reachability. Excluded trails and rejected uphill
segments remain blocked snap candidates. If the closest location is forbidden,
the query fails instead of searching for a farther allowed trail. Exactly tied
locations may select an allowed anchor, such as a shared trail intersection.

Lift interiors and connector interiors are not snap targets. A query may split
a trail edge at both start and destination; split edges retain their original
direction/difficulty. The shared graph is copied, never mutated. Dijkstra never
tries alternative snap locations to manufacture a route.

Difficulty filtering removes forbidden feature nodes and all incident transfers
and reviewed connectors as well as trail edges. This prevents excluded trails
from serving as connector stepping stones. Unknown ratings are excluded unless
explicitly enabled; `easy`/`novice` map to green, `intermediate` to blue, and
`advanced`/`expert` to black. Lifts are independent of difficulty selection.

Snap offsets are reported but are **not** traversable access paths and do not
contribute to route distance/cost. Coordinates alone cannot prove that a user
can physically walk/ski from their raw position to the snapped location. Use a
tight radius or require user confirmation when integrating with the map.

## Connectivity review and current limitations

The source data is not a complete navigable network:

- 31 locally uphill segments across 25 trails are excluded. Rises range up to
  11.1 m; some smaller changes may be elevation noise, but the backend does not
  silently allow them under a downhill-only requirement.
- 37 lift terminals lack a connected trail transfer. The audit reports their
  nearest trail and elevation difference. Gaps range from about 1 m to 228 m;
  joining all nearest lines would invent substantial off-trail access paths.
- 16 terminal records are inferred from lift endpoints without matching station
  metadata. The disused Heimo's Express is excluded.
- 3 nearby endpoint pairs and 18 endpoint-to-trail proposals are reported within
  an 8 m review radius. Proposals can overlap; they are not connected by default.
- At-grade crossings are inferred from geometry/elevation and available tags,
  not independently confirmed physical access. DEM elevations and missing tags
  can hide grade separation. The report is a data audit, not field validation.

To add a short connector after confirming navigability, copy node IDs from
`nearby_endpoints_for_review` or `endpoint_to_trail_candidates` into a JSON file:

```json
[
  {"from": "SOURCE_NODE_ID", "to": "TARGET_NODE_ID", "reason": "Evidence confirming this connection"}
]
```

Pass it using the global flag **before** the command:

```bash
.venv/bin/python -m routing --approved-connectors reviewed_connectors.json audit
```

Or pass the list to `load_graph(..., approved_connectors=approvals)`. A connector
is directed, must involve an original endpoint/station, be at most 8 m long,
drop at most 2 m, never climb, and respect loading/unloading roles. It carries
both feature dependencies, so difficulty filtering cannot bypass a restriction.
An endpoint may connect to a proposed split point partway along a trail.
Re-review IDs/evidence after a dataset update. Longer gaps require real mapped
access geometry, rather than increasing the threshold arbitrarily.

No Mammoth gap has been declared navigable without evidence in this implementation.
Consequently, many resort-wide routes correctly return `unreachable` with the
current inputs. Resolve these gaps before relying on complete resort routing.

## Modules

- `geometry.py`: coordinate projection, interpolation and geodesic lengths.
- `graph.py`: graph construction, station association and audit reporting.
- `router.py`: snapping, filtering, Dijkstra and ordered GeoJSON results.
- `__main__.py`: local audit/route command-line interface.
- `../tests/test_routing.py`: direction, weights, intersection, snapping,
  connector/filter bypass, and real-dataset invariant tests.
