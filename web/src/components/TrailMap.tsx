import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap, GeoJSONSource, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection, FeatureKind, ResortMeta } from '../services/api';
import { hitLabel } from './FeaturePicker';
import styles from './TrailMap.module.css';

/** A lift or trail the user clicked, in the same shape the search returns. */
export interface PickedFeature {
  id: string;
  name: string;
  kind: 'lift' | 'trail';
  difficulty: string | null;
}

export type MapData = Record<FeatureKind, FeatureCollection>;

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
const FALLBACK_CAMERA = { center: [-119.025, 37.639] as [number, number], zoom: 13.1, bearing: 210, pitch: 55 };
const DEM = {
  type: 'raster-dem' as const, tileSize: 256, encoding: 'terrarium' as const, maxzoom: 15,
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  attribution: 'Elevation: Mapzen Terrain Tiles; USGS 3DEP, SRTM, GMTED2010; NOAA ETOPO1',
};

/** Layer styling ported from maplibre/map.js so both viewers look the same. */
function buildStyle(data: MapData): StyleSpecification {
  return {
    version: 8,
    sources: {
      topo: {
        type: 'raster', tileSize: 256, maxzoom: 16,
        tiles: ['https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}'],
        attribution: 'USGS The National Map',
      },
      terrain: { ...DEM },
      shading: { ...DEM },
      ...Object.fromEntries((Object.keys(data) as FeatureKind[]).map((kind) => [kind, {
        type: 'geojson', data: data[kind] as GeoJSON.FeatureCollection, tolerance: 0,
        attribution: kind === 'runs' ? 'Trails: OpenSkiData / © OpenStreetMap contributors' : '',
      }])),
      route: { type: 'geojson', data: EMPTY as GeoJSON.FeatureCollection },
    },
    terrain: { source: 'terrain', exaggeration: 1.15 },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#e9eee7' } },
      { id: 'topo', type: 'raster', source: 'topo', paint: { 'raster-opacity': 0.78, 'raster-saturation': -0.65 } },
      { id: 'hillshade', type: 'hillshade', source: 'shading',
        paint: { 'hillshade-exaggeration': 0.25, 'hillshade-shadow-color': '#52634d' } },
      { id: 'boundary', type: 'line', source: 'ski_area',
        paint: { 'line-color': '#806391', 'line-width': 1.5, 'line-dasharray': [4, 3], 'line-opacity': 0.8 } },
      { id: 'runs-halo', type: 'line', source: 'runs', layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 4.5, 'line-opacity': 0.7 } },
      { id: 'runs', type: 'line', source: 'runs', layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['match', ['get', 'difficulty'],
            ['easy', 'novice'], '#178342', 'intermediate', '#2169c4', ['advanced', 'expert'], '#202725', '#858b88'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.3, 14, 2.6, 18, 5],
        } },
      { id: 'lifts', type: 'line', source: 'lifts', layout: { 'line-cap': 'round', 'line-join': 'round' },
        filter: ['==', ['get', 'status'], 'operating'],
        paint: { 'line-color': '#de3535', 'line-width': 3, 'line-dasharray': [3, 1.5] } },
      { id: 'route-halo', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 10, 'line-opacity': 0.9 } },
      { id: 'route', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#f59e0b', 'line-width': 6 } },
    ],
  };
}

function routePoints(route: FeatureCollection): [number, number][] {
  return route.features.flatMap((f) => (f.geometry.coordinates as number[][]).map((c) => [c[0], c[1]] as [number, number]));
}

export function TrailMap({ resort, data, route, onPick }: {
  resort: ResortMeta;
  data: MapData;
  route: FeatureCollection | null;
  onPick?: (which: 'from' | 'to', feature: PickedFeature) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [status, setStatus] = useState<string>('Loading map…');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      if (cancelled || !container.current) return;
      const camera = resort.camera ?? FALLBACK_CAMERA;
      try {
        map = new maplibregl.Map({
          container: container.current, style: buildStyle(data), ...camera,
          minZoom: 11, maxZoom: 18, maxPitch: 70, maxBounds: resort.bounds, renderWorldCopies: false,
        });
      } catch {
        setStatus('This device or browser cannot show the 3D map (WebGL is unavailable). Directions still work.');
        return;
      }
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
      let terrainFailed = false;
      map.on('error', (event: { sourceId?: string }) => {
        if (!map || terrainFailed || !['terrain', 'shading'].includes(event.sourceId ?? '')) return;
        terrainFailed = true;
        map.setTerrain(null);
        if (map.getLayer('hillshade')) map.removeLayer('hillshade');
        map.jumpTo({ pitch: 0 });
        setStatus('Elevation tiles could not load, so the map is flat.');
      });
      map.on('load', () => { if (!cancelled) { setReady(true); setStatus(''); } });
      for (const layer of ['runs', 'lifts']) {
        map.on('mouseenter', layer, () => { map!.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layer, () => { map!.getCanvas().style.cursor = ''; });
      }
      map.on('click', (event) => {
        const hit = map!.queryRenderedFeatures(event.point, { layers: ['lifts', 'runs'] })[0];
        if (!hit) return;
        const props = hit.properties as Record<string, unknown>;
        if (typeof props.id !== 'string') return;
        const picked: PickedFeature = {
          id: props.id,
          name: typeof props.name === 'string' && props.name ? props.name : 'Unnamed feature',
          kind: hit.layer.id === 'lifts' ? 'lift' : 'trail',
          difficulty: typeof props.difficulty === 'string' ? props.difficulty : null,
        };
        const content = document.createElement('div');
        const title = document.createElement('p');
        title.className = styles.popupTitle;
        title.textContent = picked.name;
        const detail = document.createElement('p');
        detail.className = styles.popupDetail;
        detail.textContent = hitLabel(picked);
        const actions = document.createElement('div');
        actions.className = styles.popupActions;
        const popup = new maplibregl.Popup({ maxWidth: '260px' }).setLngLat(event.lngLat);
        for (const [which, label] of [['from', 'Start here'], ['to', 'End here']] as const) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = label;
          button.addEventListener('click', () => { onPickRef.current?.(which, picked); popup.remove(); });
          actions.append(button);
        }
        content.append(title, detail, ...(onPickRef.current ? [actions] : []));
        popup.setDOMContent(content).addTo(map!);
      });
    })().catch(() => setStatus('The map could not load. Check your connection and reload.'));
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [resort, data]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const geojson = route ?? EMPTY;
    (map.getSource('route') as GeoJSONSource | undefined)?.setData(geojson as GeoJSON.FeatureCollection);
    const points = routePoints(geojson);
    if (!points.length) return;
    const lngs = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60, maxZoom: 16 });
  }, [route, ready]);

  return (
    <>
      <div ref={container} className={styles.map} role="region" aria-label="Trail map" />
      {status && <p className={styles.status} role="status">{status}</p>}
    </>
  );
}
