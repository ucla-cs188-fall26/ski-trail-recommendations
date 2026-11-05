"""Build a directed multigraph without joining aerial lift crossings.

Feature-owned nodes keep transfers explicit: difficulty restrictions can remove
both a trail and all its junction/connector edges. Every original trail vertex
is retained, in addition to interpolated intersections.
"""
import json
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path

import networkx as nx
from shapely.geometry import LineString, Point
from shapely.strtree import STRtree

from .geometry import interpolate, length, project, valid_coordinate, xy

DIFFICULTIES = {"easy": "green", "novice": "green", "intermediate": "blue",
                "advanced": "black", "expert": "black"}


@dataclass(frozen=True)
class BuildConfig:
    intersection_elevation_tolerance_m: float = 2.0
    endpoint_precision_m: float = 0.02
    review_distance_m: float = 8.0
    station_match_m: float = 15.0

    def __post_init__(self):
        if not 0 <= self.endpoint_precision_m <= 0.05:
            raise ValueError("Endpoint precision must be between 0 and 0.05 meters")
        if not 0 <= self.intersection_elevation_tolerance_m <= 3:
            raise ValueError("Intersection elevation tolerance must be 0–3 meters")
        if not 0 < self.review_distance_m <= 10 or not 0 < self.station_match_m <= 20:
            raise ValueError("Review distance must be 0–10 m and station matching 0–20 m")


@dataclass
class Network:
    graph: nx.MultiDiGraph
    features: dict
    blocked_segments: list
    report: dict


def load_graph(data_dir="data/processed", config=None, approved_connectors=()):
    collections = []
    for name in ("runs", "lifts", "spots"):
        with (Path(data_dir) / f"mammoth_{name}.geojson").open() as source:
            collections.append(json.load(source)["features"])
    return build_graph(*collections, config=config, approved_connectors=approved_connectors)


def edge_data(feature_id, properties, coordinates, kind):
    distance = length(coordinates)
    factor = 4 if kind == "lift" else 1
    return dict(feature_id=feature_id, name=properties.get("name"),
                difficulty=properties.get("difficulty"),
                difficulty_group=DIFFICULTIES.get(properties.get("difficulty"), "unknown"),
                kind=kind, length_m=distance, weight=distance * factor,
                coordinates=coordinates, required_features=[feature_id],
                original_properties=properties)


def build_graph(runs, lifts, spots=(), config=None, approved_connectors=()):
    config = config or BuildConfig()
    graph = nx.MultiDiGraph()
    features, records, blocked = {}, [], []
    report = {"config": asdict(config), "excluded_features": [], "uphill_trail_segments": [],
              "rejected_crossings": [], "overlapping_segments": [], "junctions": [],
              "station_issues": [], "nearby_endpoints_for_review": [],
              "endpoint_to_trail_candidates": [], "approved_connectors": []}

    def node(fid, position, coordinate, role="trail", endpoint=False):
        nid = f"{fid}@{position:.9f}"
        if nid not in graph:
            graph.add_node(nid, coordinate=list(coordinate), feature_id=fid,
                           role=role, endpoint=endpoint, station_ids=[])
        return nid

    for kind, collection in (("trail", runs), ("lift", lifts)):
        for feature in collection:
            props = feature.get("properties") or {}
            fid = props.get("id")
            if not fid or fid in features:
                raise ValueError(f"Missing or duplicate feature ID: {fid}")
            features[fid] = {"kind": kind, "properties": props, "original_feature": feature}
            geom = feature.get("geometry") or {}
            coords = geom.get("coordinates") or []
            reason = None
            if geom.get("type") != "LineString" or len(coords) < 2 or not all(valid_coordinate(c, True) for c in coords):
                reason = "Invalid LineString or missing/nonfinite elevation"
            elif props.get("status") != "operating":
                reason = "Not explicitly operating"
            elif kind == "trail" and "downhill" not in (props.get("uses") or []):
                reason = "Not a downhill ski trail"
            elif coords[0][2] == coords[-1][2]:
                reason = "Equal endpoint elevations: direction ambiguous"
            if reason:
                report["excluded_features"].append({"id": fid, "name": props.get("name"), "reason": reason})
                # Retain valid excluded trail geometry as blocked snap anchors.
                if kind == "trail" and geom.get("type") == "LineString":
                    for a, b in zip(coords, coords[1:]):
                        if valid_coordinate(a, True) and valid_coordinate(b, True) and xy(a) != xy(b):
                            blocked.append({"feature_id": fid, "coordinates": [a, b], "reason": reason})
                continue
            coords = list(coords)
            reverse = coords[0][2] < coords[-1][2] if kind == "trail" else coords[0][2] > coords[-1][2]
            if reverse:
                coords.reverse()
            if kind == "lift":
                # Lift cable dips do not permit boarding/exiting mid-span.
                low = node(fid, 0, coords[0], "loading", True)
                high = node(fid, len(coords) - 1, coords[-1], "unloading", True)
                station_features = list(props.get("stations") or []) + [s for s in spots if s.get("properties", {}).get("liftId") == fid]
                denied = False
                seen = set()
                for station in station_features:
                    sp = station.get("properties") or {}
                    sid = sp.get("id")
                    if sid in seen:
                        continue
                    seen.add(sid)
                    sc = (station.get("geometry") or {}).get("coordinates")
                    position = sp.get("position")
                    if position not in ("bottom", "top") or not valid_coordinate(sc, True):
                        report["station_issues"].append({"lift_id": fid, "station_id": sid, "reason": "Intermediate/invalid station not used"})
                        continue
                    target = low if position == "bottom" else high
                    nc = graph.nodes[target]["coordinate"]
                    if length([sc, nc]) > config.station_match_m or abs(sc[2] - nc[2]) > 3:
                        report["station_issues"].append({"lift_id": fid, "station_id": sid, "reason": "Station disagrees with lift endpoint"})
                        continue
                    graph.nodes[target]["station_ids"].append(sid)
                    if sp.get("entry" if position == "bottom" else "exit") is False:
                        denied = True
                if denied:
                    graph.remove_nodes_from([low, high])
                    report["excluded_features"].append({"id": fid, "reason": "Station explicitly forbids uphill boarding or exit"})
                    continue
                for nid in (low, high):
                    if not graph.nodes[nid]["station_ids"]:
                        report["station_issues"].append({"lift_id": fid, "node": nid, "reason": "Station inferred from elevated line endpoint"})
                graph.add_edge(low, high, **edge_data(fid, props, coords, "lift"))
                continue
            for i, (a, b) in enumerate(zip(coords, coords[1:])):
                if xy(a) == xy(b):
                    blocked.append({"feature_id": fid, "coordinates": [a, b], "reason": "Zero-length segment"})
                    continue
                if b[2] > a[2]:
                    item = {"feature_id": fid, "name": props.get("name"), "segment": i,
                            "rise_m": b[2] - a[2], "coordinates": [a, b], "reason": "Local uphill segment"}
                    blocked.append(item)
                    report["uphill_trail_segments"].append(item)
                    continue
                records.append({"fid": fid, "i": i, "a": a, "b": b,
                                "last": len(coords) - 1, "line": LineString([xy(a), xy(b)]), "cuts": {0., 1.}})

    def locate(record, t):
        if t < 1e-9:
            t = 0.
        elif t > 1 - 1e-9:
            t = 1.
        record["cuts"].add(t)
        return node(record["fid"], record["i"] + t, interpolate(record["a"], record["b"], t),
                    endpoint=record["i"] + t in (0, record["last"]))

    def transfer(a, b, kind="junction", reason="Compatible at-grade intersection"):
        if a == b:
            return
        na, nb = graph.nodes[a], graph.nodes[b]
        if na["feature_id"] == nb["feature_id"]:
            return
        if kind == "junction" and any(
            features[n["feature_id"]]["properties"].get(tag) not in (None, False, "no")
            for n in (na, nb) for tag in ("tunnel", "bridge")
        ):
            return
        ca, cb = na["coordinate"], nb["coordinate"]
        # Never jump uphill, even by the crossing tolerance. Different measured
        # elevations therefore produce at most a one-way transfer.
        if cb[2] > ca[2] or ca[2] - cb[2] > config.intersection_elevation_tolerance_m:
            return
        if na["role"] == "loading" or nb["role"] == "unloading":
            return
        distance = length([ca, cb])
        key = f"{kind}:{a}:{b}"
        graph.add_edge(a, b, key=key, kind=kind, length_m=distance, weight=distance,
                       coordinates=[ca, cb], feature_id=None,
                       required_features=[na["feature_id"], nb["feature_id"]], reason=reason)

    # Intersect individual trail segments, retaining crossings within one trail
    # as separate positions (self-crossings are reported rather than merged).
    tree = STRtree([r["line"] for r in records])
    for i, r in enumerate(records):
        for j in tree.query(r["line"]):
            j = int(j)
            if j <= i:
                continue
            s = records[j]
            if r["fid"] == s["fid"] and abs(r["i"] - s["i"]) <= 1:
                continue
            hit = r["line"].intersection(s["line"])
            if hit.is_empty:
                continue
            ids = [r["fid"], s["fid"]]
            if hit.geom_type != "Point":
                report["overlapping_segments"].append({"feature_ids": ids, "reason": "Overlap not auto-joined"})
                continue
            t, u = r["line"].project(hit, normalized=True), s["line"].project(hit, normalized=True)
            ca, cb = interpolate(r["a"], r["b"], t), interpolate(s["a"], s["b"], u)
            pa, pb = features[r["fid"]]["properties"], features[s["fid"]]["properties"]
            separated = any(p.get("tunnel") not in (None, False, "no") or p.get("bridge") not in (None, False, "no") for p in (pa, pb))
            if separated or abs(ca[2] - cb[2]) > config.intersection_elevation_tolerance_m or r["fid"] == s["fid"]:
                report["rejected_crossings"].append({"feature_ids": ids, "coordinates": ca,
                    "elevation_difference_m": abs(ca[2] - cb[2]), "reason": "Grade separation, elevation mismatch, or self-crossing"})
                continue
            a, b = locate(r, t), locate(s, u)
            transfer(a, b)
            transfer(b, a)
            report["junctions"].append({"nodes": [a, b], "elevation_difference_m": abs(ca[2] - cb[2])})

    # Only lift terminals participate in topology. Near-coincident endpoints can
    # join a trail interior, but positive gaps require a reviewed connector.
    terminals = [n for n, d in graph.nodes(data=True) if d["role"] != "trail"]
    for r in records:
        locate(r, 0.)
        locate(r, 1.)
    endpoints = terminals + [n for n, d in graph.nodes(data=True) if d["role"] == "trail" and d["endpoint"]]
    for endpoint in endpoints:
        nd = graph.nodes[endpoint]
        point = Point(xy(nd["coordinate"]))
        for i in tree.query(point.buffer(config.endpoint_precision_m)):
            r = records[int(i)]
            if r["fid"] == nd["feature_id"] or point.distance(r["line"]) > config.endpoint_precision_m:
                continue
            t = r["line"].project(point, normalized=True)
            other = locate(r, t)
            transfer(endpoint, other)
            transfer(other, endpoint)
        # Make bounded endpoint-to-interior proposals addressable by node ID.
        # Splitting does not create a transfer; explicit review is still needed.
        nearby = []
        for i in tree.query(point.buffer(config.review_distance_m)):
            r = records[int(i)]
            distance = point.distance(r["line"])
            if r["fid"] != nd["feature_id"] and config.endpoint_precision_m < distance <= config.review_distance_m:
                nearby.append((distance, int(i)))
        if nearby:
            distance, i = min(nearby)
            r = records[i]
            other = locate(r, r["line"].project(point, normalized=True))
            report["endpoint_to_trail_candidates"].append({
                "nodes": [endpoint, other], "distance_m": distance,
                "elevations_m": [nd["coordinate"][2], graph.nodes[other]["coordinate"][2]],
                "coordinates": [nd["coordinate"], graph.nodes[other]["coordinate"]],
                "reason": "Nearby geometry only; physical access must be reviewed"})
    for r in records:
        cuts = sorted(r["cuts"])
        for t, u in zip(cuts, cuts[1:]):
            a, b = locate(r, t), locate(r, u)
            if a != b:
                graph.add_edge(a, b, **edge_data(r["fid"], features[r["fid"]]["properties"],
                    [graph.nodes[a]["coordinate"], graph.nodes[b]["coordinate"]], "trail"))

    # Connect only nearly identical endpoint positions automatically. Actual gaps
    # are proposals, not edges: a reviewer must establish navigability.
    for i, a in enumerate(endpoints):
        for b in endpoints[i + 1:]:
            na, nb = graph.nodes[a], graph.nodes[b]
            if na["feature_id"] == nb["feature_id"]:
                continue
            distance = length([na["coordinate"], nb["coordinate"]])
            if distance <= config.endpoint_precision_m:
                transfer(a, b)
                transfer(b, a)
            elif distance <= config.review_distance_m:
                report["nearby_endpoints_for_review"].append({"nodes": [a, b], "distance_m": distance,
                    "elevation_difference_m": abs(na["coordinate"][2] - nb["coordinate"][2])})

    for approval in approved_connectors:
        a, b = approval["from"], approval["to"]
        reason = approval.get("reason", "").strip()
        if a not in graph or b not in graph or not reason:
            raise ValueError("Approved connectors require existing node IDs and a review reason")
        na, nb = graph.nodes[a], graph.nodes[b]
        if not (na["endpoint"] or nb["endpoint"]):
            raise ValueError("Reviewed connectors require at least one original endpoint/station")
        if length([na["coordinate"], nb["coordinate"]]) > config.review_distance_m:
            raise ValueError("Reviewed connector exceeds maximum distance")
        before = graph.number_of_edges()
        transfer(a, b, "connector", reason)
        if graph.number_of_edges() == before:
            raise ValueError("Connector violates elevation, lift-role, or feature restrictions")
        report["approved_connectors"].append(approval)

    weak = sorted((len(c) for c in nx.weakly_connected_components(graph)), reverse=True)
    strong = sorted((len(c) for c in nx.strongly_connected_components(graph)), reverse=True)
    report.update(nodes=graph.number_of_nodes(), edges=graph.number_of_edges(),
        edges_by_kind=dict(Counter(d["kind"] for *_, d in graph.edges(data=True))),
        weak_components=len(weak), weak_component_sizes=weak,
        strong_components=len(strong), strong_component_sizes=strong,
        isolated_nodes=list(nx.isolates(graph)),
        dead_ends=[n for n in graph if graph.out_degree(n) == 0],
        disconnected_lift_terminals=[n for n in terminals if graph.degree(n) <= 1])
    trail_edges = [e for *_, e in graph.edges(data=True) if e["kind"] == "trail"]
    report["lift_terminal_gaps"] = []
    if trail_edges:
        for nid in report["disconnected_lift_terminals"]:
            nd = graph.nodes[nid]
            nearest = min(((*project(nd["coordinate"], *e["coordinates"])[1:], e["feature_id"])
                           for e in trail_edges), key=lambda item: item[0])
            report["lift_terminal_gaps"].append({"node": nid,
                "lift_name": features[nd["feature_id"]]["properties"].get("name"),
                "role": nd["role"], "distance_to_nearest_trail_m": nearest[0],
                "nearest_trail_coordinate": nearest[1], "trail_id": nearest[2],
                "trail_minus_station_elevation_m": nearest[1][2] - nd["coordinate"][2]})
    allowed = {fid for fid, f in features.items() if f["kind"] == "lift" or f["properties"].get("difficulty") in DIFFICULTIES}
    filtered = graph.subgraph([n for n, d in graph.nodes(data=True) if d["feature_id"] in allowed])
    report["default_difficulty_graph"] = {"nodes": filtered.number_of_nodes(),
        "edges": filtered.number_of_edges(), "weak_components": nx.number_weakly_connected_components(filtered),
        "strong_components": nx.number_strongly_connected_components(filtered)}
    graph.graph["config"] = asdict(config)
    return Network(graph, features, blocked, report)
