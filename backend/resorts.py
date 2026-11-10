"""Load every resort manifest once and keep its routing graph in memory."""
import json
from dataclasses import dataclass
from pathlib import Path

from routing import build_graph
from routing.graph import Network

KINDS = ("runs", "lifts", "spots", "ski_area")
DROP = {"skiAreas", "places", "sources"}  # repeated per feature; not needed by the client


@dataclass
class Resort:
    id: str
    meta: dict
    collections: dict  # kind -> slim FeatureCollection served to clients
    network: Network


def _slim(feature):
    props = {k: v for k, v in (feature.get("properties") or {}).items() if k not in DROP}
    return {"type": "Feature", "geometry": feature["geometry"], "properties": props}


def load_resort(manifest_path: Path) -> Resort:
    meta = json.loads(manifest_path.read_text())
    raw = {kind: json.loads((manifest_path.parent / meta["files"][kind]).read_text())["features"]
           for kind in KINDS}
    approvals = []
    if meta.get("connectors"):
        approvals = json.loads((manifest_path.parent / meta["connectors"]).read_text())
    network = build_graph(raw["runs"], raw["lifts"], raw["spots"], approved_connectors=approvals)
    collections = {kind: {"type": "FeatureCollection", "features": [_slim(f) for f in raw[kind]]}
                   for kind in KINDS}
    public = {k: v for k, v in meta.items() if k not in ("files", "connectors")}
    return Resort(meta["id"], public, collections, network)


def load_all(resorts_dir: Path) -> dict[str, Resort]:
    resorts = {}
    for path in sorted(resorts_dir.glob("*.json")):
        if path.name.endswith(".connectors.json"):
            continue
        resort = load_resort(path)
        resorts[resort.id] = resort
    return resorts
