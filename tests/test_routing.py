"""Small, adversarial networks verify routing restrictions independently of Mammoth."""
import json
from pathlib import Path

import networkx as nx
import pytest

from routing import build_graph, load_graph, route
from routing.geometry import TO_LL, length


def coord(x, y=0, z=100):
    lon, lat = TO_LL.transform(320000 + x, 4167000 + y)
    return [lon, lat, z]


def feature(fid, points, kind="trail", difficulty="easy", **properties):
    return {"type": "Feature", "geometry": {"type": "LineString", "coordinates": [coord(*p) for p in points]},
            "properties": {"id": fid, "name": fid, "status": "operating", "difficulty": difficulty,
                           "uses": ["downhill"], "liftType": "chair_lift" if kind == "lift" else None, **properties}}


def test_midtrail_downhill_only_and_query_does_not_mutate_graph():
    n = build_graph([feature("run", [(0, 0, 100), (100, 0, 80)])], [])
    before = nx.node_link_data(n.graph)
    result = route(n, coord(20), coord(80))
    assert result["status"] == "ok"
    assert result["total_trail_distance_m"] == pytest.approx(length([coord(20), coord(80)]), abs=1e-5)
    assert result["total_weighted_cost"] == pytest.approx(result["total_trail_distance_m"])
    assert result["geojson"]["features"][0]["geometry"]["coordinates"][0][2] == pytest.approx(96)
    assert route(n, coord(80), coord(20))["status"] == "unreachable"
    assert before == nx.node_link_data(n.graph)


def test_reversed_source_coordinates_and_lift_weight():
    lift = feature("lift", [(0, 0, 100), (100, 0, 200)], "lift")
    lift["geometry"]["coordinates"].reverse()
    n = build_graph([], [lift])
    result = route(n, coord(0), coord(100), allowed_difficulties=[])
    assert result["status"] == "ok"
    assert result["total_weighted_cost"] == pytest.approx(length(lift["geometry"]["coordinates"]) * 4)
    assert result["total_trail_distance_m"] == 0
    assert result["lifts_used"] == [{"id": "lift", "name": "lift"}]
    assert route(n, coord(100), coord(0))["status"] == "unreachable"
    assert route(n, coord(50), coord(100))["status"] == "snap_failed"


@pytest.mark.parametrize("difficulty,group", [("novice", "green"), ("easy", "green"),
    ("intermediate", "blue"), ("advanced", "black"), ("expert", "black")])
def test_difficulty_groups(difficulty, group):
    n = build_graph([feature("run", [(0, 0, 100), (100, 0, 80)], difficulty=difficulty)], [])
    assert route(n, coord(20), coord(80), [group])["status"] == "ok"
    assert route(n, coord(20), coord(80), list({"green", "blue", "black"} - {group}))["status"] == "snap_failed"


def test_unknown_opt_in():
    n = build_graph([feature("run", [(0, 0, 100), (100, 0, 80)], difficulty=None)], [])
    assert route(n, coord(20), coord(80))["status"] == "snap_failed"
    assert route(n, coord(20), coord(80), [], include_unknown=True)["status"] == "ok"


def test_allowed_endpoints_do_not_bypass_disallowed_middle_trail():
    n = build_graph([
        feature("a", [(0, 0, 100), (100, 0, 90)]),
        feature("black", [(100, 0, 90), (200, 0, 80)], difficulty="expert"),
        feature("b", [(200, 0, 80), (300, 0, 70)])], [])
    assert route(n, coord(20), coord(280), ["green"])["status"] == "unreachable"
    result = route(n, coord(20), coord(280), ["green", "black"])
    assert result["status"] == "ok"
    assert "black" in [e["feature_id"] for e in result["path"]]


def test_no_resnap_to_nearby_allowed_parallel_trail():
    n = build_graph([feature("black", [(0, 0, 100), (100, 0, 80)], difficulty="expert"),
                     feature("green", [(0, 3, 100), (100, 3, 80)])], [])
    assert route(n, coord(20, 0), coord(80, 3), ["green"])["status"] == "snap_failed"


def test_local_uphill_segment_is_blocked_not_reversed():
    n = build_graph([feature("a", [(0, 0, 100), (40, 0, 90), (60, 0, 92), (100, 0, 80)])], [])
    assert len(n.report["uphill_trail_segments"]) == 1
    assert route(n, coord(10), coord(90))["status"] == "unreachable"
    assert route(n, coord(50), coord(90))["status"] == "snap_failed"


def test_crossing_splits_and_routes_between_trails():
    n = build_graph([feature("a", [(0, 0, 100), (100, 0, 80)]),
                     feature("b", [(50, -50, 100), (50, 50, 80)])], [])
    # Both input lines are split at the actual geometric intersection.
    assert sum(d["kind"] == "trail" for *_, d in n.graph.edges(data=True)) == 4
    assert route(n, coord(10, 0), coord(50, 40))["status"] == "ok"
    assert route(n, coord(50, 40), coord(10, 0))["status"] == "unreachable"


@pytest.mark.parametrize("extra", [{"tunnel": True}, {"bridge": True}, {}])
def test_grade_separated_crossings_not_connected(extra):
    # With no explicit structure tags, 30 m elevation separation still rejects it.
    z = 100 if extra else 130
    n = build_graph([feature("a", [(0, 0, 100), (100, 0, 80)]),
                     feature("b", [(50, -50, z), (50, 50, z - 20)], **extra)], [])
    assert n.report["rejected_crossings"]
    assert route(n, coord(10), coord(50, 40))["status"] == "unreachable"


def test_no_midair_lift_connection():
    n = build_graph([feature("run", [(0, 0, 100), (100, 0, 80)])],
                     [feature("lift", [(50, -50, 80), (50, 50, 100)], "lift")])
    assert route(n, coord(10), coord(50, 50))["status"] == "unreachable"
    assert n.graph.number_of_edges() == 2


def test_ski_lift_ski_route_and_station_roles():
    n = build_graph([feature("approach", [(0, 0, 110), (100, 0, 100)]),
                     feature("exit", [(100, 100, 150), (200, 100, 130)])],
                     [feature("lift", [(100, 0, 100), (100, 100, 150)], "lift")])
    result = route(n, coord(10, 0), coord(190, 100))
    assert result["status"] == "ok"
    assert result["total_weighted_cost"] == pytest.approx(result["total_trail_distance_m"] +
        4 * result["total_lift_distance_m"] + result["total_connector_distance_m"])
    assert result["lifts_used"][0]["id"] == "lift"
    assert route(n, coord(190, 100), coord(10, 0))["status"] == "unreachable"


def test_reviewed_connector_direction_and_difficulty_dependencies():
    runs = [feature("a", [(0, 0, 110), (100, 0, 100)], difficulty="expert"),
            feature("b", [(103, 0, 100), (200, 0, 90)])]
    n = build_graph(runs, [])
    assert route(n, coord(10), coord(190))["status"] == "unreachable"
    approval = {"from": "a@1.000000000", "to": "b@0.000000000", "reason": "Synthetic verified open junction"}
    n = build_graph(runs, [], approved_connectors=[approval])
    assert route(n, coord(10), coord(190))["status"] == "ok"
    assert route(n, coord(10), coord(190), ["green"])["status"] == "snap_failed"
    assert route(n, coord(190), coord(10))["status"] == "unreachable"
    runs[1]["geometry"]["coordinates"][0][2] = 101
    with pytest.raises(ValueError, match="violates"):
        build_graph(runs, [], approved_connectors=[approval])


def test_transfer_cannot_climb_even_within_intersection_tolerance():
    n = build_graph([feature("a", [(0, 0, 110), (100, 0, 100)]),
                     feature("b", [(100, 0, 101), (200, 0, 90)])], [])
    assert route(n, coord(10), coord(190))["status"] == "unreachable"


def test_connectors_cannot_use_disallowed_trail_nodes_as_stepping_stones():
    runs = [feature("a", [(0, 0, 110), (100, 0, 100)]),
            feature("black", [(103, 0, 100), (103, 100, 80)], difficulty="expert"),
            feature("c", [(106, 0, 100), (200, 0, 90)])]
    approvals = [{"from": "a@1.000000000", "to": "black@0.000000000", "reason": "Test verified access"},
                 {"from": "black@0.000000000", "to": "c@0.000000000", "reason": "Test verified access"}]
    n = build_graph(runs, [], approved_connectors=approvals)
    assert route(n, coord(10), coord(190))["status"] == "ok"
    assert route(n, coord(10), coord(190), ["green"])["status"] == "unreachable"


def test_reviewed_station_to_trail_interior_connection():
    runs = [feature("run", [(0, 0, 110), (100, 0, 90)])]
    lifts = [feature("lift", [(50, 3, 100), (50, 100, 150)], "lift")]
    n = build_graph(runs, lifts)
    proposal = next(p for p in n.report["endpoint_to_trail_candidates"] if p["nodes"][0] == "lift@0.000000000")
    station, trail = proposal["nodes"]
    assert route(n, coord(10), coord(50, 100))["status"] == "unreachable"
    n = build_graph(runs, lifts, approved_connectors=[{"from": trail, "to": station, "reason": "Reviewed test loading area"}])
    result = route(n, coord(10), coord(50, 100))
    assert result["status"] == "ok"
    assert result["total_connector_distance_m"] == pytest.approx(3, abs=0.01)


def test_parallel_edges_choose_minimum_cost():
    n = build_graph([feature("run", [(0, 0, 100), (100, 0, 80)])], [])
    u, v, edge = next(iter(n.graph.edges(data=True)))
    n.graph.add_edge(u, v, **{**edge, "weight": edge["weight"] + 1000})
    result = route(n, coord(0), coord(100))
    assert result["total_weighted_cost"] == pytest.approx(edge["weight"])


def test_dijkstra_finds_shortest_path_and_filter_forces_longer_alternative():
    n = build_graph([feature("short", [(0, 0, 100), (100, 0, 80)], difficulty="intermediate"),
                     feature("long", [(0, 0, 100), (50, 100, 90), (100, 0, 80)])], [])
    result = route(n, coord(0), coord(100))
    assert result["status"] == "ok"
    assert result["total_trail_distance_m"] == pytest.approx(100, abs=0.1)
    filtered = route(n, coord(0), coord(100), ["green"])
    assert filtered["status"] == "ok"
    assert filtered["total_trail_distance_m"] > 220
    assert all(e["feature_id"] != "short" for e in filtered["path"])


def test_grade_separated_endpoint_not_rejoined_by_precision_pass():
    n = build_graph([feature("a", [(0, 0, 100), (100, 0, 90)], bridge=True),
                     feature("b", [(100, 0, 90), (200, 0, 80)])], [])
    assert route(n, coord(10), coord(190))["status"] == "unreachable"


def test_station_entry_restriction_and_disused_lifts():
    lift = feature("lift", [(0, 0, 100), (100, 0, 200)], "lift")
    station = {"type": "Feature", "geometry": {"type": "Point", "coordinates": coord(0, 0, 100)},
               "properties": {"id": "station", "liftId": "lift", "position": "bottom", "entry": False}}
    assert build_graph([], [lift], [station]).graph.number_of_edges() == 0
    lift["properties"]["status"] = "disused"
    assert build_graph([], [lift]).graph.number_of_edges() == 0


def test_invalid_and_unreachable_inputs():
    n = build_graph([feature("run", [(0, 0, 100), (100, 0, 80)])], [])
    assert route(n, coord(0, 100), coord(100))["status"] == "snap_failed"
    assert route(n, [90, 0], coord(100))["status"] == "snap_failed"
    with pytest.raises(ValueError):
        route(n, [float("nan"), 37], coord(100))
    with pytest.raises(ValueError):
        route(n, coord(0), coord(100), ["purple"])
    same = route(n, coord(50), coord(50))
    assert same["status"] == "ok" and same["total_weighted_cost"] == 0


def test_mammoth_invariants_and_original_geometry_retained():
    n = load_graph(Path(__file__).resolve().parents[1] / "data/processed")
    assert n.graph.is_directed() and n.graph.is_multigraph()
    assert n.report["edges_by_kind"]["lift"] == 28
    for a, b, edge in n.graph.edges(data=True):
        ca, cb = n.graph.nodes[a]["coordinate"], n.graph.nodes[b]["coordinate"]
        assert edge["weight"] >= 0
        assert edge["coordinates"][0] == ca and edge["coordinates"][-1] == cb
        if edge["kind"] == "lift":
            assert ca[2] < cb[2]
            assert edge["weight"] == pytest.approx(edge["length_m"] * 4)
            original = n.features[edge["feature_id"]]["original_feature"]["geometry"]["coordinates"]
            assert edge["coordinates"] in (original, list(reversed(original)))
        else:
            assert ca[2] >= cb[2]
            assert edge["weight"] == pytest.approx(edge["length_m"])
    # Find a real downhill route and confirm result serialization/continuity.
    a, b, edge = next((a, b, e) for a, b, e in n.graph.edges(data=True)
                      if e["kind"] == "trail" and e["difficulty_group"] != "unknown")
    result = route(n, n.graph.nodes[a]["coordinate"], n.graph.nodes[b]["coordinate"])
    assert result["status"] == "ok"
    json.dumps(result, allow_nan=False)
    for first, second in zip(result["geojson"]["features"], result["geojson"]["features"][1:]):
        assert first["geometry"]["coordinates"][-1] == second["geometry"]["coordinates"][0]
