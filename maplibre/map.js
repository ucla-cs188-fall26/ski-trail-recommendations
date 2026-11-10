/* Map viewer. GeoJSON coordinates are passed directly to MapLibre.
   Served by the backend (uvicorn backend.main:app) it loads data from the API and
   enables directions. Served by a plain file server it reads the static GeoJSON
   files and directions stay hidden. */
"use strict";

// Looking southwest from the northeast side: an approximate ski-map perspective.
// Change camera values here or use ?bearing=210&pitch=55&zoom=13.1.
const INITIAL_CAMERA = {center: [-119.025, 37.639], zoom: 13.1, bearing: 210, pitch: 55};
const params = new URLSearchParams(location.search);
const flat = params.get("view") === "2d";
const API = `/v1/resorts/${encodeURIComponent(params.get("resort") || "mammoth")}`;
function cameraValue(key, low, high) {
  const value = params.has(key) ? Number(params.get(key)) : INITIAL_CAMERA[key];
  return Number.isFinite(value) ? Math.max(low, Math.min(high, value)) : INITIAL_CAMERA[key];
}
function notify(message) {
  const notice = document.getElementById("notice");
  notice.textContent = message;
  notice.hidden = false;
}

async function start() {
  if (location.protocol === "file:") throw new Error("Start the local server described in maplibre/README.md, then open http://localhost:8000/maplibre/.");
  if (!window.maplibregl) throw new Error("MapLibre could not load. Check your internet connection and reload.");
  // The backend answers with resort metadata; a plain file server does not.
  let resort = null;
  try {
    const response = await fetch(API);
    if (response.ok && (response.headers.get("content-type") || "").includes("json")) resort = await response.json();
  } catch (error) { /* static mode */ }
  if (resort && resort.camera) Object.assign(INITIAL_CAMERA, resort.camera);
  const kinds = ["runs", "lifts", "spots", "ski_area"];
  const entries = await Promise.all(kinds.map(async kind => {
    const response = await fetch(resort ? `${API}/features/${kind}` : `../data/processed/mammoth_${kind}.geojson`);
    if (!response.ok) throw new Error(`Cannot load ${kind}: HTTP ${response.status}`);
    const data = await response.json();
    if (data.type !== "FeatureCollection") throw new Error(`Invalid ${kind} FeatureCollection`);
    return [kind, data];
  }));
  const data = Object.fromEntries(entries);
  const operatingCount = data.lifts.features.filter(f => f.properties.status === "operating").length;
  document.getElementById("summary").textContent = `${data.runs.features.length} runs · ${operatingCount} operating lifts · Mammoth Lakes`;

  const dem = {
    type: "raster-dem", tileSize: 256, encoding: "terrarium", maxzoom: 15,
    tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
    attribution: 'Elevation: <a href="https://registry.opendata.aws/terrain-tiles/">Mapzen Terrain Tiles</a>; 3DEP, SRTM & GMTED2010 courtesy of USGS; ETOPO1: NOAA'
  };
  const style = {
    version: 8,
    sources: {
      topo: {
        type: "raster", tileSize: 256, maxzoom: 16,
        tiles: ["https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}"],
        attribution: '<a href="https://www.usgs.gov/programs/national-geospatial-program/the-national-map">USGS The National Map</a>'
      },
      ...Object.fromEntries(entries.map(([kind, collection]) => [kind, {
        type: "geojson", data: collection, tolerance: 0,
        attribution: kind === "runs" ? 'Trails: OpenSkiData / <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>' : ""
      }]))
    },
    layers: [
      {id: "background", type: "background", paint: {"background-color": "#e9eee7"}},
      {id: "topo", type: "raster", source: "topo", paint: {"raster-opacity": 0.78, "raster-saturation": -0.65}}
    ]
  };
  if (!flat) {
    // Separate DEM sources avoid terrain/hillshade rendering artifacts.
    style.sources.terrain = {...dem};
    style.sources.shading = {...dem};
    style.terrain = {source: "terrain", exaggeration: 1.15};
    style.layers.push({id: "hillshade", type: "hillshade", source: "shading",
      paint: {"hillshade-exaggeration": 0.25, "hillshade-shadow-color": "#52634d"}});
  }
  const map = new maplibregl.Map({
    container: "map", style, ...INITIAL_CAMERA,
    zoom: cameraValue("zoom", 11, 18), bearing: cameraValue("bearing", -360, 360),
    pitch: flat ? 0 : cameraValue("pitch", 0, 70),
    minZoom: 11, maxZoom: 18, maxPitch: 70,
    maxBounds: (resort && resort.bounds) || [[-119.12, 37.58], [-118.92, 37.71]],
    renderWorldCopies: false
  });
  let terrainFailed = false;
  map.on("error", event => {
    console.warn("Map resource error:", event.error);
    if (["terrain", "shading"].includes(event.sourceId) && !terrainFailed) {
      terrainFailed = true;
      map.setTerrain(null);
      if (map.getLayer("hillshade")) map.removeLayer("hillshade");
      map.removeSource("terrain");
      map.removeSource("shading");
      map.jumpTo({pitch: 0});
      document.getElementById("mode").textContent = "2D · elevation unavailable";
      notify("Elevation tiles could not load. Showing the 2D topographic map.");
    } else if (event.sourceId === "topo") {
      map.setLayoutProperty("topo", "visibility", "none");
      notify("Topographic tiles could not load. Trail overlays remain available on a plain background.");
    } else if (kinds.includes(event.sourceId)) {
      notify(`The ${event.sourceId} layer failed to render. See the browser console for details.`);
    }
  });
  map.on("load", () => {
    const round = {"line-cap": "round", "line-join": "round"};
    map.addLayer({id: "boundary", type: "line", source: "ski_area",
      paint: {"line-color": "#806391", "line-width": 1.5, "line-dasharray": [4, 3], "line-opacity": 0.8}});
    map.addLayer({id: "runs-halo", type: "line", source: "runs", layout: round,
      paint: {"line-color": "#ffffff", "line-width": 4.5, "line-opacity": 0.7}});
    map.addLayer({id: "runs", type: "line", source: "runs", layout: round,
      paint: {
        "line-color": ["match", ["get", "difficulty"],
          ["easy", "novice"], "#178342", "intermediate", "#2169c4",
          ["advanced", "expert"], "#202725", "#858b88"],
        "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1.3, 14, 2.6, 18, 5]
      }});
    map.addLayer({id: "lifts", type: "line", source: "lifts", layout: round,
      filter: ["==", ["get", "status"], "operating"],
      paint: {"line-color": "#de3535", "line-width": 3, "line-dasharray": [3, 1.5]}});
    map.addLayer({id: "stations", type: "circle", source: "spots",
      filter: ["==", ["get", "spotType"], "lift_station"], layout: {visibility: "none"},
      paint: {"circle-radius": 4, "circle-color": "#de3535", "circle-stroke-color": "white", "circle-stroke-width": 1.5}});

    map.addSource("route", {type: "geojson", data: {type: "FeatureCollection", features: []}});
    map.addLayer({id: "route-halo", type: "line", source: "route", layout: round,
      paint: {"line-color": "#ffffff", "line-width": 10, "line-opacity": 0.9}});
    map.addLayer({id: "route", type: "line", source: "route", layout: round,
      paint: {"line-color": "#f59e0b", "line-width": 6}});
    const setEnd = resort ? setupDirections(map) : null;

    for (const [control, layer] of [["boundary-toggle", "boundary"], ["stations-toggle", "stations"]]) {
      const input = document.getElementById(control);
      input.disabled = false;
      input.addEventListener("change", () => map.setLayoutProperty(layer, "visibility", input.checked ? "visible" : "none"));
    }
    // A single handler avoids overlapping lift/trail popups at intersections.
    const hitLayers = ["lifts", "runs", "stations"];
    function hits(point) {
      return map.queryRenderedFeatures([[point.x - 4, point.y - 4], [point.x + 4, point.y + 4]], {layers: hitLayers});
    }
    map.on("mousemove", event => {map.getCanvas().style.cursor = hits(event.point).length ? "pointer" : "";});
    map.on("click", event => {
      const feature = hits(event.point)[0];
      if (!feature) return;
      const props = feature.properties;
      const content = document.createElement("div");
      const title = document.createElement("h3");
      title.textContent = props.name || "Unnamed feature";
      const detail = document.createElement("p");
      detail.textContent = feature.layer.id === "runs"
        ? `Difficulty: ${props.difficulty || "unknown"}`
        : `Type: ${props.liftType || props.spotType || "lift"}`;
      content.append(title, detail);
      const popup = new maplibregl.Popup({maxWidth: "280px"}).setLngLat(event.lngLat).setDOMContent(content);
      if (setEnd && props.id && ["runs", "lifts"].includes(feature.layer.id)) {
        const actions = document.createElement("div");
        actions.className = "popup-actions";
        for (const [which, label] of [["from", "Directions from here"], ["to", "Directions to here"]]) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = label;
          button.addEventListener("click", () => {
            setEnd(which, {id: props.id, name: props.name || "Unnamed feature"});
            popup.remove();
          });
          actions.append(button);
        }
        content.append(actions);
      }
      popup.addTo(map);
    });
    if (!terrainFailed) document.getElementById("mode").textContent = flat ? "2D · topographic view" : "3D terrain · 1.15× elevation";
  });
  if (flat) {
    document.getElementById("flat-link").href = "./";
    document.getElementById("flat-link").textContent = "Open 3D terrain";
  }
}

// Directions panel: pick a start and a destination by name (search) or from a
// map popup, then ask the backend for a route. Returns the setter popups use.
function setupDirections(map) {
  const ends = {from: null, to: null};
  const go = document.getElementById("route-go");
  const output = document.getElementById("route-result");
  const empty = {type: "FeatureCollection", features: []};
  document.getElementById("directions").hidden = false;

  function setEnd(which, feature) {
    ends[which] = feature;
    document.getElementById(`${which}-input`).value = feature ? feature.name : "";
    document.getElementById(`${which}-list`).hidden = true;
    go.disabled = !(ends.from && ends.to);
  }
  for (const which of ["from", "to"]) {
    const input = document.getElementById(`${which}-input`);
    const list = document.getElementById(`${which}-list`);
    let timer = null, latest = 0;
    input.addEventListener("input", () => {
      ends[which] = null;  // typed text is not a selection until a result is chosen
      go.disabled = true;
      clearTimeout(timer);
      const query = input.value.trim();
      if (!query) { list.hidden = true; return; }
      timer = setTimeout(async () => {
        const ticket = ++latest;
        const response = await fetch(`${API}/search?limit=6&q=${encodeURIComponent(query)}`);
        if (!response.ok || ticket !== latest) return;
        const hits = await response.json();
        list.replaceChildren(...hits.map(hit => {
          const item = document.createElement("li");
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = hit.kind === "lift" ? `${hit.name} · lift` : `${hit.name} · ${hit.difficulty || "unknown"}`;
          button.addEventListener("click", () => setEnd(which, hit));
          item.append(button);
          return item;
        }));
        if (!hits.length) {
          const none = document.createElement("li");
          none.textContent = "No lift or trail with that name";
          list.append(none);
        }
        list.hidden = false;
      }, 200);
    });
  }
  go.addEventListener("click", async () => {
    output.textContent = "Finding a route…";
    go.disabled = true;
    try {
      const allow = ["green", "blue", "black"].filter(group => document.getElementById(`allow-${group}`).checked);
      const response = await fetch(`${API}/routes`, {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({start: {feature_id: ends.from.id}, destination: {feature_id: ends.to.id},
          allow, include_unknown: document.getElementById("allow-unknown").checked})
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : "The route request was rejected.");
      map.getSource("route").setData(result.geojson);
      if (result.status !== "ok") {
        output.textContent = result.status === "unreachable"
          ? "No connected route between these with the allowed difficulties. The trail data still has gaps."
          : result.message;
        return;
      }
      const km = meters => (meters / 1000).toFixed(2);
      const lifts = result.lifts_used.map(lift => lift.name || "Unnamed lift").join(", ");
      output.textContent = `${km(result.total_trail_distance_m)} km skiing · ${km(result.total_lift_distance_m)} km on lifts`
        + (lifts ? ` (${lifts})` : "");
      const points = result.geojson.features.flatMap(feature => feature.geometry.coordinates);
      if (points.length) {
        const bounds = points.reduce((box, point) => box.extend(point.slice(0, 2)),
          new maplibregl.LngLatBounds(points[0].slice(0, 2), points[0].slice(0, 2)));
        map.fitBounds(bounds, {padding: 120, maxZoom: 16});
      }
    } catch (error) {
      output.textContent = error.message;
    } finally {
      go.disabled = !(ends.from && ends.to);
    }
  });
  document.getElementById("route-clear").addEventListener("click", () => {
    setEnd("from", null);
    setEnd("to", null);
    output.textContent = "";
    map.getSource("route").setData(empty);
  });
  return setEnd;
}

start().catch(error => {
  document.getElementById("summary").textContent = "Map could not start";
  document.getElementById("mode").textContent = "Unavailable";
  notify(error.message);
  console.error(error);
});
