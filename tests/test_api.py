import pytest
from fastapi.testclient import TestClient

from backend.main import app

CHAIR_23_BOTTOM = [-119.037769, 37.6406848]
CHAIR_23_TOP = [-119.039052, 37.6338582]


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as client:
        yield client


def test_resort_and_features(client):
    assert client.get("/v1/resorts/mammoth").json()["counts"]["runs"] == 197
    assert client.get("/v1/resorts/nowhere").status_code == 404
    runs = client.get("/v1/resorts/mammoth/features/runs").json()
    assert "skiAreas" not in runs["features"][0]["properties"]


def test_route_by_coordinate_and_by_feature(client):
    body = {"start": {"coordinate": CHAIR_23_BOTTOM},
            "destination": {"coordinate": CHAIR_23_TOP}, "allow": ["green"]}
    by_coordinate = client.post("/v1/resorts/mammoth/routes", json=body).json()
    assert by_coordinate["status"] == "ok"
    lift = client.get("/v1/resorts/mammoth/search", params={"q": "chair 23"}).json()[0]
    body = {"start": {"feature_id": lift["id"]}, "destination": {"feature_id": lift["id"]}}
    by_feature = client.post("/v1/resorts/mammoth/routes", json=body).json()
    assert by_feature["total_lift_distance_m"] == by_coordinate["total_lift_distance_m"]


def test_bad_requests(client):
    far = {"start": {"coordinate": [-119.0, 37.0]}, "destination": {"coordinate": CHAIR_23_TOP}}
    assert client.post("/v1/resorts/mammoth/routes", json=far).json()["status"] == "snap_failed"
    both = {"start": {"coordinate": [0, 0], "feature_id": "x"}, "destination": {"coordinate": CHAIR_23_TOP}}
    assert client.post("/v1/resorts/mammoth/routes", json=both).status_code == 422
