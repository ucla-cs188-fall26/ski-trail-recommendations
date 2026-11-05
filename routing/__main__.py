"""Command line graph audit and coordinate routing."""
import argparse
import json
from pathlib import Path

from . import load_graph, route


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path(__file__).resolve().parents[1] / "data/processed")
    parser.add_argument("--approved-connectors", type=Path)
    sub = parser.add_subparsers(dest="command", required=True)
    audit = sub.add_parser("audit")
    audit.add_argument("--output", type=Path)
    query = sub.add_parser("route")
    query.add_argument("--start", type=float, nargs=2, required=True, metavar=("LON", "LAT"))
    query.add_argument("--destination", type=float, nargs=2, required=True, metavar=("LON", "LAT"))
    query.add_argument("--allow", nargs="*", choices=("green", "blue", "black"), default=["green", "blue", "black"])
    query.add_argument("--include-unknown", action="store_true")
    query.add_argument("--max-snap", type=float, default=10)
    query.add_argument("--output", type=Path, help="Route GeoJSON; summary is printed to stdout")
    args = parser.parse_args()
    if args.output and (args.output.suffix not in (".json", ".geojson") or
                        args.output.resolve().parent == args.data_dir.resolve() or
                        "raw" in args.output.parts):
        parser.error("Write JSON/GeoJSON outputs outside the source data directories (e.g. outputs/)")
    approvals = json.loads(args.approved_connectors.read_text()) if args.approved_connectors else []
    network = load_graph(args.data_dir, approved_connectors=approvals)
    if args.command == "audit":
        result = network.report
        output = result
    else:
        result = route(network, args.start, args.destination, args.allow, args.include_unknown, args.max_snap)
        output = result["geojson"]
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(output, indent=2) + "\n")
    if args.command == "route":
        result = {k: v for k, v in result.items() if k not in ("path", "geojson")}
    elif args.output:
        result = {k: network.report[k] for k in ("nodes", "edges", "edges_by_kind", "weak_components", "strong_components")}
        result["audit_file"] = str(args.output)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
