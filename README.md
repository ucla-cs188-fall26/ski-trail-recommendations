# Mammoth Mountain ski trail recommendations

Interactive trail and lift maps for Mammoth Mountain, California. The current
prototype visualizes the resort in 3D using MapLibre GL JS, with a separate
Python/Folium map. A directed NetworkX/Dijkstra routing package is exposed through
a small FastAPI backend, and the MapLibre map can request directions from it.
Source-data connectivity gaps are reported explicitly and still limit routing.

There are two ways to run the map:

| Mode | Command | Map URL | Directions |
| --- | --- | --- | --- |
| Static (no installs) | `python3 -m http.server 8000 --bind 127.0.0.1` | http://localhost:8000/maplibre/ | No |
| Backend API | `.venv/bin/python -m uvicorn backend.main:app --reload` | http://localhost:8000/ | Yes |

The static mode below works exactly as before. See
[Backend API and directions](#backend-api-and-directions) for the second mode.

## Quick start: view the map

You need Python 3, an internet connection, and a modern browser with WebGL
support. Viewing the MapLibre map does **not** require installing Python
packages, Node.js, or an API key.

1. Clone the repository and enter its root directory:

   ```bash
   git clone https://github.com/ucla-cs188-fall26/ski-trail-recommendations.git
   cd ski-trail-recommendations
   ```

   If you already have a checkout, open that folder instead. It may be named
   `all_slopes` locally. The root contains `README.md`, `maplibre/`, and `data/`.

2. Start a local development server **from the repository root**:

   ```bash
   python3 -m http.server 8000 --bind 127.0.0.1
   ```

   On Windows, use `py -m http.server 8000 --bind 127.0.0.1` if `python3` is
   unavailable.

3. Open one of these links in your browser:

   | View | Local URL |
   | --- | --- |
   | **MapLibre 3D terrain (recommended)** | http://localhost:8000/maplibre/ |
   | MapLibre 2D fallback | http://localhost:8000/maplibre/?view=2d |
   | Folium map | http://localhost:8000/data/processed/mammoth_map.html |

Keep the server terminal running while viewing. Press **Ctrl+C** in that
terminal to stop it. After restarting your computer, start the server again.
Each teammate runs their own server; `localhost` refers to your own computer.
Do not open the MapLibre HTML directly with `file://`, because it needs to fetch
the GeoJSON through the local server.

## Using the map

- Drag to pan; scroll or pinch to zoom.
- Right-drag or Ctrl-drag to rotate and tilt the 3D view.
- Click a trail for its name and difficulty, or a lift for its name and type.
- Use the legend checkboxes to toggle the resort boundary and lift stations.
- Trails are green for easy/novice, blue for intermediate, black for
  advanced/expert, and gray for missing/other difficulty ratings.
- Red dashed lines show lifts marked operating in the dataset. This is not a
  live operating-status feed.

The map includes 197 runs and 28 operating lifts. The processed data also
contains one disused lift, hidden in MapLibre, and 43 spots.

## Troubleshooting

**`OSError: [Errno 48] Address already in use`** (or an equivalent port error):
another server is already using port 8000. Try the map link first. If it works,
use the existing server; you do not need to start a second one. If it serves a
different project, use another port from this repository's root:

```bash
python3 -m http.server 8001 --bind 127.0.0.1
```

Then open http://localhost:8001/maplibre/ (replace `8000` with `8001` in the
other links as well).

**Page not found or missing trail data:** check that the server was started in
the repository root and that these files are present:

```text
maplibre/index.html
maplibre/map.js
maplibre/map.css
data/processed/mammoth_runs.geojson
data/processed/mammoth_lifts.geojson
data/processed/mammoth_spots.geojson
data/processed/mammoth_ski_area.geojson
```

If the processed files are missing from your checkout, get them from the team
or regenerate them using the extraction instructions below.

**Terrain or background unavailable:** internet is needed for MapLibre and
external tiles. Try the 2D fallback link. The viewer automatically falls back
to 2D on elevation-tile errors and a plain background on basemap-tile errors.
The 2D view still needs WebGL and the MapLibre library to load.

**Saved changes do not appear:** refresh the browser. Use **Cmd+Shift+R** on
macOS or **Ctrl+Shift+R** on Windows/Linux for a hard refresh. HTML, CSS, and
JavaScript edits do not require restarting the server.

## Regenerating data and the Folium map (optional)

These steps are unnecessary if the processed GeoJSON and Folium HTML are
already available. The large raw datasets are only needed for extraction.

To extract Mammoth again, place the OpenSkiData exports `runs.geojson`,
`lifts.geojson`, `spots.geojson`, and `ski_areas.geojson` under `data/raw/`, then:

```bash
python3 scripts/extract_mammoth.py
```

To generate or refresh `data/processed/mammoth_map.html` on macOS/Linux:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/requirements-visualization.txt
.venv/bin/python scripts/visualize_mammoth.py
```

On Windows, create the environment with `py -m venv .venv` and replace
`.venv/bin/python` with `.venv\Scripts\python.exe`.

MapLibre reads the processed GeoJSON directly; it has no generation or build
step. Camera settings, terrain providers, attribution, and implementation
details are documented in [maplibre/README.md](maplibre/README.md).

## Backend API and directions

The backend (`backend/`) loads each resort listed in `data/resorts/*.json` once at
startup, keeps its routing graph in memory, and serves the map, the map data and
routes from one address. It does not modify `routing/` or the processed GeoJSON.

### Set up and run

Python 3.11 or newer is required. From the repository root:

```bash
python3 -m venv .venv  # skip if it already exists
.venv/bin/python -m pip install -e ".[dev]"
.venv/bin/python -m uvicorn backend.main:app --reload
```

On Windows use `py -m venv .venv` and `.venv\Scripts\python.exe`. Startup takes
a couple of seconds while the graph is built. Then open:

| What | URL |
| --- | --- |
| Map with directions | http://localhost:8000/ |
| Interactive API docs (try requests in the browser) | http://localhost:8000/docs |
| Health check | http://localhost:8000/healthz |

Stop the static `http.server` first if it is using port 8000, or add `--port 8001`.
The Folium map is not served by the backend; use the static server for it.

### Getting directions on the map

In the **Directions** panel (top right), type a lift or trail name in **From** and
**To**, pick a result, and press **Get route**. You can also click a trail or
lift on the map and choose *Directions from here* or *Directions to here*.
The route is drawn in orange with its skiing and lift distances.

- A trail used as a start means its top; as a destination, its bottom. A lift
  starts at its bottom station and ends at its top station.
- Untick Green, Blue or Black to keep the route off those trails. Unrated
  trails are excluded unless **Unrated** is ticked.
- Many pairs currently report no connected route. That is the data, not a bug:
  the graph has 69 disconnected pieces and 37 lift terminals with no trail
  attached. See *Connectivity review* in [routing/README.md](routing/README.md).

### Endpoints

| Method and path | Returns |
| --- | --- |
| `GET /v1/resorts` | Resort list: id, name, camera, bounds |
| `GET /v1/resorts/{id}` | One resort plus feature counts and graph size |
| `GET /v1/resorts/{id}/features/{kind}` | GeoJSON for `runs`, `lifts`, `spots` or `ski_area` |
| `GET /v1/resorts/{id}/search?q=chair` | Lifts and trails matching a name |
| `POST /v1/resorts/{id}/routes` | Route summary and route GeoJSON |
| `GET /v1/resorts/{id}/audit` | Full graph audit (same as `python -m routing audit`) |

The only resort id today is `mammoth`. Example route request, from the command line:

```bash
curl -s -X POST http://localhost:8000/v1/resorts/mammoth/routes \
  -H "Content-Type: application/json" \
  -d '{"start": {"coordinate": [-119.037769, 37.6406848]},
       "destination": {"coordinate": [-119.039052, 37.6338582]},
       "allow": ["green"]}'
```

`start` and `destination` each take either `coordinate` (`[longitude, latitude]`,
snapped within `max_snap_m`, default 10, maximum 20) or `feature_id` (an `id` from
`/search` or from the GeoJSON). The response `status` is `ok`, `unreachable` or
`snap_failed`; all three return HTTP 200 and a `message`. Invalid input returns 422.
Feature GeoJSON from the API omits the repeated `skiAreas`, `places` and `sources`
properties, which cuts the runs payload from 612 KB to 240 KB.

### Where things live

| Path | Purpose |
| --- | --- |
| `backend/main.py` | App, startup loading, all endpoints, serves `maplibre/` at `/` |
| `backend/resorts.py` | Reads resort manifests and builds each routing graph |
| `backend/schemas.py` | Request validation for routes |
| `data/resorts/mammoth.json` | Resort manifest: data files, camera, bounds, optional connectors file |
| `tests/test_api.py` | API tests |
| `pyproject.toml` | Dependencies for routing and the backend |

### Working on it

- Run all tests with `.venv/bin/python -m pytest -q` (27 routing tests, 3 API tests).
- `--reload` restarts the server when Python files change. Edits to `maplibre/`
  only need a browser refresh.
- To add reviewed connectors, create `data/resorts/mammoth.connectors.json` in the
  format described in [routing/README.md](routing/README.md) and set
  `"connectors": "mammoth.connectors.json"` in the manifest, then restart.
- `routing/` still assumes UTM zone 11N and Mammoth filenames. A second resort
  needs the projection made per-resort first.
- `fastapi`, `uvicorn` and `httpx` are not version-pinned yet; pin them once the
  team agrees on versions.

## Routing backend

See [routing/README.md](routing/README.md) for setup, coordinate queries, difficulty
filters, route GeoJSON, and graph validation. The backend uses downhill trail
edges and uphill lift rides, with lifts weighted at four times their length.
It reads the existing processed GeoJSON without changing the data or map viewers.

```bash
.venv/bin/python -m pip install -r routing/requirements.txt
.venv/bin/python -m pytest tests/test_routing.py -q
.venv/bin/python -m routing audit --output outputs/mammoth_routing_audit.json
```

The conservative graph reports missing station/trail connections and locally
uphill trail segments. Many routes remain unreachable until those data gaps
are reviewed; see the routing documentation before integrating with the map.
