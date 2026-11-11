import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from routing import route

from .resorts import KINDS, Resort, load_all
from .schemas import Endpoint, RouteRequest

ROOT = Path(__file__).resolve().parents[1]
RESORTS_DIR = Path(os.environ.get("ALL_SLOPES_RESORTS_DIR", ROOT / "data/resorts"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.resorts = load_all(RESORTS_DIR)  # ~1.5 s per resort, once
    yield


app = FastAPI(title="all_slopes API", version="0.1.0", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1024)


def get_resort(request: Request, resort_id: str) -> Resort:
    resort = request.app.state.resorts.get(resort_id)
    if resort is None:
        raise HTTPException(404, f"Unknown resort: {resort_id}")
    return resort


@app.get("/healthz")
def health(request: Request):
    return {"status": "ok", "resorts": sorted(request.app.state.resorts)}


@app.get("/v1/resorts")
def list_resorts(request: Request):
    return [r.meta for r in request.app.state.resorts.values()]


@app.get("/v1/resorts/{resort_id}")
def resort_detail(request: Request, resort_id: str):
    resort = get_resort(request, resort_id)
    report = resort.network.report
    return {**resort.meta, "counts": {k: len(v["features"]) for k, v in resort.collections.items()},
            "graph": {k: report[k] for k in ("nodes", "edges", "weak_components")}}


@app.get("/v1/resorts/{resort_id}/features/{kind}")
def features(request: Request, resort_id: str, kind: str):
    if kind not in KINDS:
        raise HTTPException(404, f"Unknown feature kind: {kind}")
    return get_resort(request, resort_id).collections[kind]


@app.get("/v1/resorts/{resort_id}/search")
def search(request: Request, resort_id: str, q: str, limit: int = 10):
    resort = get_resort(request, resort_id)
    needle = q.strip().lower()
    hits = []
    for fid, f in resort.network.features.items():
        name = f["properties"].get("name") or ""
        if needle and needle in name.lower():
            hits.append({"id": fid, "name": name, "kind": f["kind"],
                         "difficulty": f["properties"].get("difficulty")})
    hits.sort(key=lambda h: (not h["name"].lower().startswith(needle), h["name"]))
    return hits[:limit]


def resolve(resort: Resort, endpoint: Endpoint, is_start: bool):
    """Turn a feature reference into a coordinate on the routing graph."""
    if endpoint.coordinate is not None:
        return list(endpoint.coordinate)
    graph = resort.network.graph
    nodes = [(n, d) for n, d in graph.nodes(data=True) if d["feature_id"] == endpoint.feature_id]
    if not nodes:
        raise HTTPException(422, f"Feature {endpoint.feature_id} is not on the routing graph")
    if nodes[0][1]["role"] != "trail":  # lift: board at the bottom, arrive at the top
        role = "loading" if is_start else "unloading"
        return next(d["coordinate"] for _, d in nodes if d["role"] == role)
    # Trail node IDs are "<feature>@<position>" with position 0 at the top.
    ordered = sorted(nodes, key=lambda item: float(item[0].rsplit("@", 1)[1]))
    return (ordered[0] if is_start else ordered[-1])[1]["coordinate"]


@app.post("/v1/resorts/{resort_id}/routes")
def create_route(request: Request, resort_id: str, body: RouteRequest):
    resort = get_resort(request, resort_id)
    try:
        result = route(resort.network,
                       resolve(resort, body.start, True), resolve(resort, body.destination, False),
                       body.allow, body.include_unknown, body.max_snap_m)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    result.pop("path")  # same data as geojson feature properties
    return result


@app.get("/v1/resorts/{resort_id}/audit")
def audit(request: Request, resort_id: str):
    return get_resort(request, resort_id).network.report


# Last: the existing viewer, same origin as the API (no CORS needed).
app.mount("/", StaticFiles(directory=ROOT / "maplibre", html=True), name="viewer")
