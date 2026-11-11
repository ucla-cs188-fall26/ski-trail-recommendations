# Mammoth MapLibre viewer

Separate static HTML/CSS/JavaScript visualization. No build step or API key.
The Folium implementation and processed GeoJSON are unchanged.

The viewer runs in two modes and detects which one it is in:

- **Static** (below): served by `python3 -m http.server`, it reads the processed
  GeoJSON files. No Python packages are needed and the Directions panel is hidden.
- **Backend**: served by `uvicorn backend.main:app` at http://localhost:8000/, it
  loads data, camera and bounds from the API and shows the Directions panel.
  See the root README. On load `map.js` requests `/v1/resorts/mammoth`; a JSON
  answer selects backend mode, anything else selects static mode. `?resort=<id>`
  chooses another resort id once more exist.

## Run locally

From the repository root (`all_slopes`):

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Open **http://localhost:8000/maplibre/**. Stop the server with Ctrl+C.
Serve the repository root, not just the `maplibre` directory: the viewer fetches
`../data/processed/mammoth_*.geojson`. Opening `index.html` as `file://` will not work.
Internet is required for the pinned MapLibre 5.6.2 library and background tiles.
A WebGL-capable browser is required even in 2D mode.

## Camera and interaction

The initial camera is centered at `[-119.025, 37.639]`, zoom `13.1`, bearing
`210°`, pitch `55°`. This looks southwest from the northeast side of the resort.
It approximates a ski-map perspective; an exact OpenSkiMap reference angle was
not available in the conversation. Terrain exaggeration is a modest `1.15`.

Drag to pan, scroll/pinch to zoom, and right-drag (or Ctrl-drag) to rotate and tilt.
Edit `INITIAL_CAMERA` in `map.js` or use URL parameters, for example:

http://localhost:8000/maplibre/?bearing=225&pitch=60&zoom=13.3

Custom rotation, tilt, zoom and reset controls are deferred as requested.
Click a trail for its name/difficulty or an operating lift for its name/type.
Boundary and lift-station visibility can be toggled in the legend.

## Data and rendering

- All 197 runs load from the original GeoJSON. `easy` and `novice` are green,
  `intermediate` blue, `advanced` and `expert` black; other/missing values gray.
- All lift data loads, but the style displays only the 28 `operating` lifts as
  red dashed lines. The disused lift is excluded by a rendering filter.
- The original resort polygon and 43 spots load; `lift_station` points are
  optional and hidden initially.
- No coordinate rotation, reprojection, geometry editing, or graph construction.
  GeoJSON is passed directly to MapLibre with `tolerance: 0`. Rotation is solely
  a camera operation. Lines drape onto the elevation surface; the GeoJSON Z
  coordinates remain in the source data, but the DEM controls displayed terrain.
- Dataset operating status is not a live lift-status feed. Some names and
  difficulty ratings are missing; the viewer displays explicit placeholders.

## Providers, attribution and fallback

- Basemap: [USGS The National Map — USGSTopo](https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer).
  Topographic raster with contours and shaded relief; source zoom capped at 16
  and overzoomed when closer. No OSM tile-server requests.
- Elevation: [Mapzen Terrain Tiles on AWS Open Data](https://registry.opendata.aws/terrain-tiles/),
  `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`.
  Uses Terrarium encoding, 256-pixel tiles, source zoom capped at 15. No API key.
  [Terrain attribution and licenses](https://github.com/tilezen/joerd/blob/master/docs/attribution.md)
  cover USGS 3DEP/SRTM/GMTED2010 and NOAA ETOPO1 data relevant to this regional view.
- MapLibre is pinned on unpkg. Source attribution stays visible on the map;
  preserve these credits when reusing it. Requests are viewport driven with no
  prefetch/bulk download routine. The map is constrained to the Mammoth region.
  These public services provide no availability guarantee; recheck their published
  terms before a production deployment or replacing providers.

**2D fallback:** http://localhost:8000/maplibre/?view=2d

This mode does not request elevation tiles and uses a flat topographic basemap.
If a DEM request fails in 3D, the viewer automatically disables terrain and
hillshade, resets pitch to zero, and reports the fallback. If USGS tiles fail,
the overlays stay available on a plain background. The library itself still
needs to load; the fallback does not replace WebGL or make the app offline.
