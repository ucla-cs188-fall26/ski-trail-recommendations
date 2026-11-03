#!/usr/bin/env python3
"""Extract Mammoth Mountain features from OpenSkiData GeoJSON exports.

The OpenSkiData files are large FeatureCollections.  This script uses only the
Python standard library and decodes one feature at a time so that runs.geojson
does not need to be loaded wholly into memory.

Membership policy:
  * properties.skiAreas IDs are authoritative when the relationship exists.
  * A feature with no linked ski-area ID is included when its geometry
    intersects Mammoth's published polygon.
  * Geometry never overrides a relationship to a different ski area.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Iterable, Iterator, Sequence


TARGET_NAME = "Mammoth Mountain"
TARGET_LOCALITY = "Mammoth Lakes"
TARGET_REGION_CODE = "US-CA"
EXPECTED_FILES = {
    "ski_area": "ski_areas.geojson",
    "runs": "runs.geojson",
    "lifts": "lifts.geojson",
    "spots": "spots.geojson",
}
OUTPUT_FILES = {
    "ski_area": "mammoth_ski_area.geojson",
    "runs": "mammoth_runs.geojson",
    "lifts": "mammoth_lifts.geojson",
    "spots": "mammoth_spots.geojson",
}


def iter_features(path: Path, chunk_size: int = 1024 * 1024) -> Iterator[dict[str, Any]]:
    """Stream features from a GeoJSON FeatureCollection."""
    decoder = json.JSONDecoder()
    with path.open("r", encoding="utf-8") as source:
        buffer = ""
        eof = False
        match = None
        while match is None:
            chunk = source.read(chunk_size)
            if not chunk:
                raise ValueError(f"{path}: could not find a features array")
            buffer += chunk
            match = re.search(r'"features"\s*:\s*\[', buffer)

        position = match.end()
        while True:
            while True:
                while position < len(buffer) and buffer[position] in " \t\r\n,":
                    position += 1
                if position < len(buffer):
                    break
                if eof:
                    raise ValueError(f"{path}: unterminated features array")
                buffer = ""
                position = 0
                chunk = source.read(chunk_size)
                if chunk:
                    buffer = chunk
                else:
                    eof = True

            if buffer[position] == "]":
                return

            # Keep only the undecoded suffix.  A single unusually large feature
            # can span multiple chunks and is accumulated until complete.
            if position:
                buffer = buffer[position:]
                position = 0
            while True:
                try:
                    feature, end = decoder.raw_decode(buffer, position)
                    break
                except json.JSONDecodeError as error:
                    chunk = source.read(chunk_size)
                    if not chunk:
                        raise ValueError(
                            f"{path}: invalid feature near character {error.pos}: {error.msg}"
                        ) from error
                    buffer += chunk
            if not isinstance(feature, dict) or feature.get("type") != "Feature":
                raise ValueError(f"{path}: features array contains a non-Feature value")
            yield feature
            position = end


def iter_positions(geometry: Any) -> Iterator[tuple[float, float]]:
    """Yield (longitude, latitude) pairs from any GeoJSON geometry."""
    if not isinstance(geometry, dict):
        return
    if geometry.get("type") == "GeometryCollection":
        for child in geometry.get("geometries") or []:
            yield from iter_positions(child)
        return

    coordinates = geometry.get("coordinates")

    def descend(value: Any) -> Iterator[tuple[float, float]]:
        if (
            isinstance(value, (list, tuple))
            and len(value) >= 2
            and isinstance(value[0], (int, float))
            and not isinstance(value[0], bool)
            and isinstance(value[1], (int, float))
            and not isinstance(value[1], bool)
        ):
            yield float(value[0]), float(value[1])
        elif isinstance(value, (list, tuple)):
            for child in value:
                yield from descend(child)

    yield from descend(coordinates)


def geometry_errors(geometry: Any) -> list[str]:
    if geometry is None:
        return ["geometry is null"]
    if not isinstance(geometry, dict):
        return ["geometry is not an object"]
    geometry_type = geometry.get("type")
    allowed = {
        "Point", "MultiPoint", "LineString", "MultiLineString",
        "Polygon", "MultiPolygon", "GeometryCollection",
    }
    if geometry_type not in allowed:
        return [f"unsupported geometry type {geometry_type!r}"]
    positions = list(iter_positions(geometry))
    if not positions:
        return ["geometry has no coordinate positions"]
    errors = []
    for longitude, latitude in positions:
        if not (math.isfinite(longitude) and math.isfinite(latitude)):
            errors.append("geometry contains a non-finite coordinate")
            break
        if not (-180 <= longitude <= 180 and -90 <= latitude <= 90):
            errors.append("geometry contains a coordinate outside lon/lat ranges")
            break

    coordinates = geometry.get("coordinates")

    def is_position(value: Any) -> bool:
        return (
            isinstance(value, list) and len(value) >= 2
            and all(isinstance(item, (int, float)) and not isinstance(item, bool) for item in value[:2])
        )

    def valid_line(value: Any) -> bool:
        return isinstance(value, list) and len(value) >= 2 and all(is_position(item) for item in value)

    def valid_ring(value: Any) -> bool:
        return (
            isinstance(value, list) and len(value) >= 4
            and all(is_position(item) for item in value)
            and value[0][:2] == value[-1][:2]
        )

    structurally_valid = {
        "Point": lambda value: is_position(value),
        "MultiPoint": lambda value: isinstance(value, list) and bool(value) and all(is_position(item) for item in value),
        "LineString": valid_line,
        "MultiLineString": lambda value: isinstance(value, list) and bool(value) and all(valid_line(item) for item in value),
        "Polygon": lambda value: isinstance(value, list) and bool(value) and all(valid_ring(item) for item in value),
        "MultiPolygon": lambda value: (
            isinstance(value, list) and bool(value)
            and all(isinstance(polygon, list) and bool(polygon) and all(valid_ring(ring) for ring in polygon)
                    for polygon in value)
        ),
    }
    if geometry_type == "GeometryCollection":
        children = geometry.get("geometries")
        if not isinstance(children, list) or not children:
            errors.append("GeometryCollection has no child geometries")
        else:
            for child_index, child in enumerate(children):
                errors.extend(
                    f"child {child_index}: {error}" for error in geometry_errors(child)
                )
    elif not structurally_valid[geometry_type](coordinates):
        errors.append(f"coordinates do not satisfy {geometry_type} structure requirements")
    return errors


def bounds_of(features: Iterable[dict[str, Any]]) -> list[float] | None:
    west = south = math.inf
    east = north = -math.inf
    for feature in features:
        for longitude, latitude in iter_positions(feature.get("geometry")):
            west = min(west, longitude)
            south = min(south, latitude)
            east = max(east, longitude)
            north = max(north, latitude)
    return None if west == math.inf else [west, south, east, north]


def point_in_ring(point: tuple[float, float], ring: Sequence[Sequence[float]]) -> bool:
    x, y = point
    inside = False
    if len(ring) < 3:
        return False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        # Boundary points count as inside for this audit.
        cross = (x - xi) * (yj - yi) - (y - yi) * (xj - xi)
        if abs(cross) < 1e-12 and min(xi, xj) <= x <= max(xi, xj) and min(yi, yj) <= y <= max(yi, yj):
            return True
        if (yi > y) != (yj > y):
            x_intersection = (xj - xi) * (y - yi) / (yj - yi) + xi
            if x < x_intersection:
                inside = not inside
        j = i
    return inside


def point_in_polygon(point: tuple[float, float], polygon: Sequence[Any]) -> bool:
    return bool(polygon) and point_in_ring(point, polygon[0]) and not any(
        point_in_ring(point, hole) for hole in polygon[1:]
    )


def point_in_area(point: tuple[float, float], area_geometry: dict[str, Any]) -> bool:
    geometry_type = area_geometry.get("type")
    coordinates = area_geometry.get("coordinates") or []
    if geometry_type == "Polygon":
        return point_in_polygon(point, coordinates)
    if geometry_type == "MultiPolygon":
        return any(point_in_polygon(point, polygon) for polygon in coordinates)
    return False


def orientation(a: tuple[float, float], b: tuple[float, float], c: tuple[float, float]) -> float:
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def segments_intersect(
    a: tuple[float, float], b: tuple[float, float],
    c: tuple[float, float], d: tuple[float, float],
) -> bool:
    o1, o2 = orientation(a, b, c), orientation(a, b, d)
    o3, o4 = orientation(c, d, a), orientation(c, d, b)
    return (o1 == 0 or o2 == 0 or o1 * o2 < 0) and (o3 == 0 or o4 == 0 or o3 * o4 < 0)


def area_edges(area_geometry: dict[str, Any]) -> Iterator[tuple[tuple[float, float], tuple[float, float]]]:
    polygons = area_geometry.get("coordinates") or []
    if area_geometry.get("type") == "Polygon":
        polygons = [polygons]
    for polygon in polygons:
        for ring in polygon:
            points = [(float(p[0]), float(p[1])) for p in ring]
            for start, end in zip(points, points[1:]):
                yield start, end


def geometry_intersects_area(
    geometry: Any,
    area_geometry: dict[str, Any],
    area_bounds: Sequence[float],
    boundary_edges: Sequence[tuple[tuple[float, float], tuple[float, float]]],
) -> bool:
    points = list(iter_positions(geometry))
    if not points:
        return False
    area_west, area_south, area_east, area_north = area_bounds
    feature_west = min(point[0] for point in points)
    feature_south = min(point[1] for point in points)
    feature_east = max(point[0] for point in points)
    feature_north = max(point[1] for point in points)
    if (
        feature_east < area_west or feature_west > area_east
        or feature_north < area_south or feature_south > area_north
    ):
        return False
    if any(point_in_area(point, area_geometry) for point in points):
        return True
    # This catches a line crossing a narrow boundary without a vertex inside.
    for start, end in zip(points, points[1:]):
        if any(segments_intersect(start, end, edge_start, edge_end)
               for edge_start, edge_end in boundary_edges):
            return True
    return False


def ski_area_ids(feature: dict[str, Any]) -> list[str]:
    relationships = (feature.get("properties") or {}).get("skiAreas")
    if not isinstance(relationships, list):
        return []
    ids = []
    for relationship in relationships:
        if isinstance(relationship, dict):
            area_id = (relationship.get("properties") or {}).get("id")
            if isinstance(area_id, str):
                ids.append(area_id)
    return ids


def is_mammoth_area(feature: dict[str, Any]) -> bool:
    properties = feature.get("properties") or {}
    if properties.get("name") != TARGET_NAME:
        return False
    places = properties.get("places") or []
    has_region = any(place.get("iso3166_2") == TARGET_REGION_CODE for place in places if isinstance(place, dict))
    has_locality = any(
        ((place.get("localized") or {}).get("en") or {}).get("locality") == TARGET_LOCALITY
        for place in places if isinstance(place, dict)
    )
    return has_region and has_locality


def feature_label(feature: dict[str, Any]) -> dict[str, Any]:
    properties = feature.get("properties") or {}
    return {
        "id": properties.get("id"),
        "name": properties.get("name"),
        "geometry_type": (feature.get("geometry") or {}).get("type"),
        "ski_area_ids": ski_area_ids(feature),
        "bounds": bounds_of([feature]),
    }


def write_collection(path: Path, features: Sequence[dict[str, Any]]) -> None:
    collection = {
        "type": "FeatureCollection",
        "features": features,
    }
    with path.open("w", encoding="utf-8") as destination:
        json.dump(collection, destination, ensure_ascii=False, separators=(",", ":"))
        destination.write("\n")


def parse_args() -> argparse.Namespace:
    repository = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-dir", type=Path, default=repository / "data" / "raw")
    parser.add_argument("--output-dir", type=Path, default=repository / "data" / "processed")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    paths = {key: args.raw_dir / filename for key, filename in EXPECTED_FILES.items()}
    missing = [str(path) for path in paths.values() if not path.is_file()]
    if missing:
        raise FileNotFoundError("Missing expected raw dataset(s): " + ", ".join(missing))

    matching_areas = [feature for feature in iter_features(paths["ski_area"]) if is_mammoth_area(feature)]
    if len(matching_areas) != 1:
        raise RuntimeError(f"Expected exactly one California Mammoth Mountain ski area; found {len(matching_areas)}")
    mammoth_area = matching_areas[0]
    area_properties = mammoth_area.get("properties") or {}
    area_id = area_properties.get("id")
    if not isinstance(area_id, str) or not area_id:
        raise RuntimeError("Mammoth Mountain ski area has no usable properties.id")
    area_geometry = mammoth_area.get("geometry")
    if not isinstance(area_geometry, dict) or area_geometry.get("type") not in {"Polygon", "MultiPolygon"}:
        raise RuntimeError("Mammoth Mountain ski area does not have a polygon geometry")
    area_bounds = bounds_of([mammoth_area])
    if area_bounds is None:
        raise RuntimeError("Mammoth Mountain ski area geometry has no coordinates")
    boundary_edges = list(area_edges(area_geometry))

    selected: dict[str, list[dict[str, Any]]] = {key: [] for key in ("runs", "lifts", "spots")}
    audit: dict[str, Any] = {}
    for dataset in ("runs", "lifts", "spots"):
        property_keys: set[str] = set()
        geometry_types: Counter[str] = Counter()
        invalid: list[dict[str, Any]] = []
        explicit_outside: list[dict[str, Any]] = []
        intersecting_nonmembers: list[dict[str, Any]] = []
        geographic_fallback: list[dict[str, Any]] = []
        missing_relationship_count = 0
        duplicate_ids: list[str] = []
        seen_ids: set[str] = set()
        source_count = 0
        explicit_count = 0

        for feature in iter_features(paths[dataset]):
            source_count += 1
            properties = feature.get("properties") or {}
            property_keys.update(properties.keys())
            geometry_type = (feature.get("geometry") or {}).get("type", "null")
            geometry_types[str(geometry_type)] += 1
            relationships = properties.get("skiAreas")
            if not isinstance(relationships, list):
                missing_relationship_count += 1
            ids = ski_area_ids(feature)
            is_explicit_member = area_id in ids
            intersects = geometry_intersects_area(
                feature.get("geometry"), area_geometry, area_bounds, boundary_edges
            )
            is_geographic_member = not ids and intersects

            if is_explicit_member or is_geographic_member:
                selected[dataset].append(feature)
                if is_explicit_member:
                    explicit_count += 1
                else:
                    geographic_fallback.append(feature_label(feature))
                feature_id = properties.get("id")
                if isinstance(feature_id, str):
                    if feature_id in seen_ids:
                        duplicate_ids.append(feature_id)
                    seen_ids.add(feature_id)
                errors = geometry_errors(feature.get("geometry"))
                if errors:
                    invalid.append({**feature_label(feature), "errors": errors})
                if is_explicit_member and not intersects:
                    explicit_outside.append(feature_label(feature))
            elif intersects:
                # Do not let geometry override a relationship to another area.
                intersecting_nonmembers.append(feature_label(feature))

        audit[dataset] = {
            "source_feature_count": source_count,
            "source_property_keys": sorted(property_keys),
            "source_geometry_types": dict(sorted(geometry_types.items())),
            "features_without_skiAreas_list": missing_relationship_count,
            "selected_count": len(selected[dataset]),
            "selected_by_explicit_relationship": explicit_count,
            "selected_by_geographic_fallback": len(geographic_fallback),
            "geographic_fallback_features": geographic_fallback,
            "selected_bounds": bounds_of(selected[dataset]),
            "invalid_selected_geometries": invalid,
            "duplicate_selected_ids": sorted(set(duplicate_ids)),
            "explicit_members_not_intersecting_area": explicit_outside,
            "intersecting_nonmembers_not_included": intersecting_nonmembers,
        }

    args.output_dir.mkdir(parents=True, exist_ok=True)
    write_collection(args.output_dir / OUTPUT_FILES["ski_area"], [mammoth_area])
    for dataset in ("runs", "lifts", "spots"):
        write_collection(args.output_dir / OUTPUT_FILES[dataset], selected[dataset])

    report = {
        "target": {
            "id": area_id,
            "name": area_properties.get("name"),
            "places": area_properties.get("places"),
            "sources": area_properties.get("sources"),
            "bounds": bounds_of([mammoth_area]),
            "geometry_errors": geometry_errors(area_geometry),
        },
        "membership_policy": (
            "Included features linked to the target ID, plus features intersecting the "
            "target polygon only when they have no linked ski-area ID. Geometry does not "
            "override a relationship to a different ski area."
        ),
        "datasets": audit,
        "outputs": {key: str(args.output_dir / filename) for key, filename in OUTPUT_FILES.items()},
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (FileNotFoundError, RuntimeError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)
