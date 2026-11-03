#!/usr/bin/env python3
"""Build a standalone Folium HTML map; internet is needed for tiles and JS/CSS.

Install: python3 -m pip install -r scripts/requirements-visualization.txt
Run: python3 scripts/visualize_mammoth.py
All GeoJSON is embedded unchanged in the HTML. No web server is required.
"""

import argparse
import html
import json
from collections import Counter
from pathlib import Path

import folium


COLORS = {
    "easy": "#16803c", "novice": "#16803c",
    "intermediate": "#1565c0",
    "advanced": "#111111", "expert": "#111111",
}


def popup(feature):
    """Escape dataset text and expose all original metadata in a scrollable popup."""
    props = feature.get("properties") or {}
    name = html.escape(str(props.get("name") or "Unnamed feature"))
    details = html.escape(str(props.get("difficulty") or props.get("liftType")
                              or props.get("spotType") or "Unknown / not specified"))
    feature_id = html.escape(str(props.get("id") or feature.get("id") or "Missing"))
    metadata = html.escape(json.dumps(props, ensure_ascii=False, indent=2))
    content = (
        '<div style="font:13px sans-serif;overflow-wrap:anywhere">'
        f'<h3>{name}</h3><p>Difficulty / type: {details}</p>'
        f'<p>Feature ID: {feature_id}</p>'
        '<details><summary>All available metadata</summary>'
        f'<pre style="white-space:pre-wrap">{metadata}</pre></details></div>'
    )
    return folium.Popup(folium.IFrame(html=content, width=380, height=290), max_width=410)


def add_feature(feature, layer, style, point=False):
    # Folium receives the entire original feature, including every coordinate
    # and elevation. Disable Leaflet line simplification for faithful rendering.
    obj = folium.GeoJson(
        feature,
        style_function=lambda _: style,
        smooth_factor=0,
        marker=folium.CircleMarker(radius=4, color="#673ab7", fill=True,
                                   fill_color="#673ab7", fill_opacity=0.8) if point else None,
        tooltip=folium.Tooltip(html.escape(str(feature["properties"].get("name") or "Unnamed feature"))),
    )
    popup(feature).add_to(obj)
    obj.add_to(layer)


def main():
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=root / "data" / "processed")
    parser.add_argument("--output", type=Path, help="Defaults to DATA_DIR/mammoth_map.html")
    args = parser.parse_args()
    datasets = {}
    for kind in ("runs", "lifts", "spots", "ski_area"):
        path = args.data_dir / f"mammoth_{kind}.geojson"
        with path.open(encoding="utf-8") as source:
            collection = json.load(source)
        if collection.get("type") != "FeatureCollection":
            raise ValueError(f"Expected a FeatureCollection: {path}")
        datasets[kind] = collection["features"]

    output = args.output or args.data_dir / "mammoth_map.html"
    if output.resolve() in {p.resolve() for p in args.data_dir.glob("*.geojson")}:
        raise ValueError("Output must not overwrite a GeoJSON file")
    if output.suffix.lower() != ".html":
        raise ValueError("Output must have an .html extension")

    mountain_map = folium.Map(tiles=None, control_scale=True, max_zoom=20)
    # USGS provides terrain context without requesting OSM's blocked tile server.
    folium.TileLayer(
        tiles="https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}",
        attr='USGS <a href="https://www.usgs.gov/programs/national-geospatial-program/the-national-map">The National Map</a>',
        name="USGS topographic map", max_native_zoom=16, max_zoom=20,
    ).add_to(mountain_map)
    folium.FeatureGroup(name="Plain background (no tiles)", overlay=False,
                        show=False).add_to(mountain_map)
    boundary = folium.FeatureGroup(name="Resort boundary", show=True).add_to(mountain_map)
    runs = folium.FeatureGroup(name=f"Runs ({len(datasets['runs'])})", show=True).add_to(mountain_map)
    operating = folium.FeatureGroup(name="Operating lifts", show=True).add_to(mountain_map)
    inactive = folium.FeatureGroup(name="Disused / other non-operating lifts", show=False).add_to(mountain_map)
    spots = folium.FeatureGroup(name=f"Spots ({len(datasets['spots'])})", show=False).add_to(mountain_map)

    for feature in datasets["ski_area"]:
        add_feature(feature, boundary, {"color": "#7b1fa2", "weight": 2,
                                       "dashArray": "6 5", "fillOpacity": 0.025})
    for feature in datasets["runs"]:
        add_feature(feature, runs, {"color": COLORS.get(feature["properties"].get("difficulty"), "#808080"),
                                   "weight": 3, "opacity": 0.9})
    for feature in datasets["lifts"]:
        is_operating = feature["properties"].get("status") == "operating"
        add_feature(feature, operating if is_operating else inactive,
                    {"color": "#f58220" if is_operating else "#9c5c20",
                     "weight": 4, "opacity": 0.95,
                     "dashArray": "9 5" if is_operating else "2 7"})
    for feature in datasets["spots"]:
        add_feature(feature, spots, {"color": "#673ab7", "weight": 1}, point=True)

    mountain_map.fit_bounds(mountain_map.get_bounds(), padding=(25, 25))
    folium.LayerControl(collapsed=False).add_to(mountain_map)
    legend = '''<div style="position:fixed;bottom:30px;left:15px;z-index:1000;
        background:white;padding:12px;border:1px solid #888;border-radius:5px;
        font:13px/1.6 sans-serif;box-shadow:0 1px 5px #888">
        <b>Mammoth Mountain</b><br>
        <span style="color:#16803c">━━</span> Beginner (easy / novice)<br>
        <span style="color:#1565c0">━━</span> Intermediate<br>
        <span style="color:#111">━━</span> Advanced / expert<br>
        <span style="color:#808080">━━</span> Other / unknown<br>
        <span style="color:#f58220">┅┅</span> Operating lifts<br>
        <span style="color:#673ab7">●</span> Spots (toggle layer)<br>
        <small>Click features for metadata.<br>Dataset status is not live lift status.</small>
        </div>'''
    mountain_map.get_root().html.add_child(folium.Element(legend))
    output.parent.mkdir(parents=True, exist_ok=True)
    mountain_map.save(str(output))
    print(f"Saved {output} ({output.stat().st_size:,} bytes)")
    for kind, features in datasets.items():
        print(f"{kind}: {len(features)}")
    print("Run difficulties:", dict(Counter(f["properties"].get("difficulty") for f in datasets["runs"])))
    print("Lift statuses:", dict(Counter(f["properties"].get("status") for f in datasets["lifts"])))
    print("Bounds [southwest, northeast]:", mountain_map.get_bounds())


if __name__ == "__main__":
    main()
