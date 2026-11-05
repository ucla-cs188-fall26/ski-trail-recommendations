"""Bounded nearest-location snapping followed by filtered directed Dijkstra."""
import math

import networkx as nx

from .geometry import length, project, valid_coordinate, xy
from .graph import DIFFICULTIES


def permitted_features(network, allowed, include_unknown):
    return {fid for fid, f in network.features.items()
            if f["kind"] == "lift" or DIFFICULTIES.get(f["properties"].get("difficulty"), "unknown") in allowed
            or (include_unknown and f["kind"] == "trail" and f["properties"].get("difficulty") not in DIFFICULTIES)}


def snap(network, coordinate, permitted, max_distance):
    """Choose the nearest physical anchor BEFORE considering route reachability.

    Disallowed trails and removed uphill segments remain candidates, so queries
    cannot snap across them to a farther allowed trail. Lift interiors and
    connector interiors are never candidate boarding locations.
    """
    if not all(math.isfinite(value) for value in xy(coordinate)):
        return None, "Coordinate is outside the local routing projection"
    candidates = []
    for u, v, key, edge in network.graph.edges(keys=True, data=True):
        if edge["kind"] != "trail":
            continue
        t, distance, position = project(coordinate, *edge["coordinates"])
        nid = u if t <= 1e-9 else v if t >= 1 - 1e-9 else None
        candidates.append(dict(distance_m=distance, coordinate=position, node=nid,
                               edge=(u, v, key), fraction=t, feature_id=edge["feature_id"],
                               available=edge["feature_id"] in permitted))
    for nid, nd in network.graph.nodes(data=True):
        if nd["role"] not in ("loading", "unloading"):
            continue
        candidates.append(dict(distance_m=length([coordinate, nd["coordinate"]]),
            coordinate=nd["coordinate"], node=nid, feature_id=nd["feature_id"], available=True))
    for edge in network.blocked_segments:
        if edge["coordinates"][0][:2] == edge["coordinates"][1][:2]:
            continue
        _, distance, position = project(coordinate, *edge["coordinates"])
        candidates.append(dict(distance_m=distance, coordinate=position, node=None,
            feature_id=edge["feature_id"], available=False, reason=edge["reason"]))
    if not candidates:
        return None, "The graph has no snap locations"
    closest = min(c["distance_m"] for c in candidates)
    if closest > max_distance:
        return None, f"Nearest location is {closest:.2f} m away (limit {max_distance:g} m)"
    # Only exact-distance ties may choose an allowed anchor; no farther search.
    tied = [c for c in candidates if abs(c["distance_m"] - closest) <= 1e-6]
    available = [c for c in tied if c["available"]]
    if not available:
        chosen = min(tied, key=lambda c: c["feature_id"])
        return chosen, chosen.get("reason", "Nearest trail is excluded by difficulty")
    chosen = min(available, key=lambda c: (c["node"] is None, c["feature_id"], str(c.get("edge"))))
    return chosen, None


def route(network, start, destination, allowed_difficulties=("green", "blue", "black"),
          include_unknown=False, max_snap_distance_m=10.0):
    """Return JSON-compatible summary plus ordered route FeatureCollection.

    Input coordinates are [longitude, latitude]; optional Z is ignored for
    snapping. Snap offsets are disclosed, not traversable graph edges or part
    of the route cost. No route-dependent resnapping is performed.
    """
    if not valid_coordinate(start) or not valid_coordinate(destination):
        raise ValueError("Start/destination must be finite [longitude, latitude] coordinates")
    if not math.isfinite(max_snap_distance_m) or not 0 <= max_snap_distance_m <= 20:
        raise ValueError("Snap radius must be between 0 and 20 meters")
    allowed = set(allowed_difficulties)
    if not allowed <= {"green", "blue", "black"}:
        raise ValueError("Allowed difficulties must be green, blue, and/or black")
    permitted = permitted_features(network, allowed, include_unknown)
    result = {"status": "unreachable", "message": "No directed route under the selected restrictions",
              "path": [], "total_weighted_cost": None, "total_trail_distance_m": 0.,
              "total_lift_distance_m": 0., "total_connector_distance_m": 0., "lifts_used": [],
              "geojson": {"type": "FeatureCollection", "features": []}}
    snaps = []
    for label, coordinate in (("start", start), ("destination", destination)):
        snapped, error = snap(network, coordinate, permitted, max_snap_distance_m)
        result[label + "_snap"] = ({k: v for k, v in snapped.items() if k not in ("edge", "available")}
                                    if snapped else None)
        if error:
            result.update(status="snap_failed", message=f"{label}: {error}")
            return result
        snaps.append(snapped)

    graph = network.graph.copy()
    graph.remove_edges_from([(u, v, k) for u, v, k, d in graph.edges(keys=True, data=True)
                             if not set(d["required_features"]) <= permitted])
    graph.remove_nodes_from([n for n, d in graph.nodes(data=True) if d["feature_id"] not in permitted])
    cuts = {}
    for index, snapped in enumerate(snaps):
        if snapped["node"] is not None:
            continue
        edge_key = snapped["edge"]
        same = next((n for t, n, _ in cuts.get(edge_key, []) if abs(t - snapped["fraction"]) < 1e-10), None)
        nid = same or f"query:{index}"
        snapped["node"] = nid
        if same is None:
            graph.add_node(nid, coordinate=snapped["coordinate"], feature_id=snapped["feature_id"], role="trail")
            cuts.setdefault(edge_key, []).append((snapped["fraction"], nid, snapped["coordinate"]))
    for (u, v, key), interior in cuts.items():
        edge = dict(graph[u][v][key])
        graph.remove_edge(u, v, key)
        sequence = [(0., u, edge["coordinates"][0])] + sorted(interior) + [(1., v, edge["coordinates"][-1])]
        for (_, a, ca), (_, b, cb) in zip(sequence, sequence[1:]):
            distance = length([ca, cb])
            graph.add_edge(a, b, **{**edge, "coordinates": [ca, cb], "length_m": distance, "weight": distance})
    try:
        cost, nodes = nx.single_source_dijkstra(graph, snaps[0]["node"], snaps[1]["node"], weight="weight")
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return result
    lifts_seen = set()
    for index, (a, b) in enumerate(zip(nodes, nodes[1:])):
        key, edge = min(graph[a][b].items(), key=lambda item: (item[1]["weight"], str(item[0])))
        properties = {k: edge.get(k) for k in ("feature_id", "name", "kind", "difficulty", "difficulty_group", "length_m", "weight", "required_features")}
        properties.update(order=index, from_node=a, to_node=b, edge_key=str(key))
        result["path"].append(properties)
        result["geojson"]["features"].append({"type": "Feature", "geometry": {
            "type": "LineString", "coordinates": edge["coordinates"]}, "properties": properties})
        if edge["kind"] == "trail":
            result["total_trail_distance_m"] += edge["length_m"]
        elif edge["kind"] == "lift":
            result["total_lift_distance_m"] += edge["length_m"]
            if edge["feature_id"] not in lifts_seen:
                result["lifts_used"].append({"id": edge["feature_id"], "name": edge["name"]})
                lifts_seen.add(edge["feature_id"])
        else:
            result["total_connector_distance_m"] += edge["length_m"]
    result.update(status="ok", message="Route found", total_weighted_cost=cost)
    return result
