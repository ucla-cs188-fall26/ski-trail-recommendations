/* A static viewer. GeoJSON coordinates are passed directly to MapLibre. */
"use strict";

// Looking southwest from the northeast side: an approximate ski-map perspective.
// Change camera values here or use ?bearing=210&pitch=55&zoom=13.1.
const INITIAL_CAMERA = {center: [-119.025, 37.639], zoom: 13.1, bearing: 210, pitch: 55};
const params = new URLSearchParams(location.search);
const flat = params.get("view") === "2d";
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
  const kinds = ["runs", "lifts", "spots", "ski_area"];
  const entries = await Promise.all(kinds.map(async kind => {
    const response = await fetch(`../data/processed/mammoth_${kind}.geojson`);
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
    maxBounds: [[-119.12, 37.58], [-118.92, 37.71]],
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
      new maplibregl.Popup({maxWidth: "280px"}).setLngLat(event.lngLat).setDOMContent(content).addTo(map);
    });
    if (!terrainFailed) document.getElementById("mode").textContent = flat ? "2D · topographic view" : "3D terrain · 1.15× elevation";
  });
  if (flat) {
    document.getElementById("flat-link").href = "./";
    document.getElementById("flat-link").textContent = "Open 3D terrain";
  }
}

start().catch(error => {
  document.getElementById("summary").textContent = "Map could not start";
  document.getElementById("mode").textContent = "Unavailable";
  notify(error.message);
  console.error(error);
});
