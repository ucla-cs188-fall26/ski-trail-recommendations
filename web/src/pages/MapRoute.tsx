import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { FeaturePicker } from '../components/FeaturePicker';
import { TrailMap, type MapData, type PickedFeature } from '../components/TrailMap';
import { useAuth } from '../context/AuthContext';
import { getMountain } from '../data/mountains';
import {
  blackIncludesDoubleBlackWarning, localDateKey, toRouteAllow, type RouteDifficulty, type SkierProfile,
} from '../models/profile';
import { api, type FeatureKind, type ResortMeta, type RouteResponse } from '../services/api';
import { NotFoundMountain } from './NotFoundMountain';
import styles from '../layouts/Page.module.css';
import own from './MapRoute.module.css';

const KINDS: FeatureKind[] = ['runs', 'lifts', 'spots', 'ski_area'];
const DIFFICULTIES: { value: RouteDifficulty; label: string }[] = [
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
  { value: 'black', label: 'Black' },
];

type End = { id: string; name: string } | null;

export function summarizeRoute(r: RouteResponse): string {
  if (r.status === 'unreachable') {
    return 'No connected route between these with the trails allowed. Try allowing more trails, or a nearby start. The trail data still has some gaps.';
  }
  if (r.status === 'snap_failed') return `We couldn't place that on the trail network (${r.message}).`;
  const km = (m: number) => (m / 1000).toFixed(1);
  const lifts = r.lifts_used.map((l) => l.name || 'Unnamed lift').join(', ');
  return `${km(r.total_trail_distance_m)} km skiing · ${km(r.total_lift_distance_m)} km on lifts${lifts ? ` (${lifts})` : ''}`;
}

type Load =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; resort: ResortMeta; data: MapData };

export function MapRoute() {
  const { mountainId = '' } = useParams();
  const mountain = getMountain(mountainId);
  const { profile, getDaySession } = useAuth();
  const p = profile as SkierProfile;
  const profileAllow = useMemo(() => toRouteAllow(p.terrainComfort), [p.terrainComfort]);

  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [ends, setEnds] = useState<{ from: End; to: End }>({ from: null, to: null });
  const [text, setText] = useState({ from: '', to: '' });
  const [allow, setAllow] = useState<RouteDifficulty[]>(profileAllow);
  const [includeUnknown, setIncludeUnknown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RouteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mountain) return;
    let cancelled = false;
    setLoad({ state: 'loading' });
    (async () => {
      const meta = await api.getResort(mountain.id);
      if (!meta.ok) {
        if (!cancelled) {
          setLoad({ state: 'error', message: meta.error.code === 'not_found'
            ? `Trail data for ${mountain.name} is coming soon.` : meta.error.message });
        }
        return;
      }
      const collections = await Promise.all(KINDS.map((k) => api.getFeatures(mountain.id, k)));
      if (cancelled) return;
      const failed = collections.find((c) => !c.ok);
      if (failed && !failed.ok) { setLoad({ state: 'error', message: failed.error.message }); return; }
      const data = Object.fromEntries(KINDS.map((k, i) => [k, (collections[i] as { data: MapData[FeatureKind] }).data])) as MapData;
      setLoad({ state: 'ready', resort: meta.data, data });
    })();
    return () => { cancelled = true; };
  }, [mountain]);

  // Pre-fill "To" with today's meeting point when it was picked from the trail search.
  useEffect(() => {
    if (!mountain) return;
    let cancelled = false;
    getDaySession(mountain.id, localDateKey(new Date())).then((s) => {
      const mp = s?.meetingPoint;
      if (cancelled || !mp?.featureId) return;
      setEnds((e) => (e.to ? e : { ...e, to: { id: mp.featureId!, name: mp.name } }));
      setText((t) => (t.to ? t : { ...t, to: mp.name }));
    });
    return () => { cancelled = true; };
  }, [mountain, getDaySession]);

  if (!mountain) return <NotFoundMountain />;

  const setEnd = (which: 'from' | 'to', end: End) => {
    setEnds((e) => ({ ...e, [which]: end }));
    if (end) setText((t) => ({ ...t, [which]: end.name }));
  };
  const onMapPick = (which: 'from' | 'to', f: PickedFeature) => setEnd(which, { id: f.id, name: f.name });

  const canRoute = !!ends.from && !!ends.to && (allow.length > 0 || includeUnknown) && !busy;
  const go = async () => {
    if (!ends.from || !ends.to) return;
    setBusy(true);
    setError(null);
    const r = await api.planRoute(mountain.id, {
      start: { feature_id: ends.from.id }, destination: { feature_id: ends.to.id }, allow, include_unknown: includeUnknown,
    });
    setBusy(false);
    if (!r.ok) { setError(r.error.message); setResult(null); return; }
    setResult(r.data);
  };
  const clear = () => {
    setEnds({ from: null, to: null });
    setText({ from: '', to: '' });
    setResult(null);
    setError(null);
  };
  const toggle = (d: RouteDifficulty) =>
    setAllow((a) => DIFFICULTIES.map((x) => x.value).filter((v) => (v === d ? !a.includes(v) : a.includes(v))));

  return (
    <>
      <header className={styles.hero}>
        <p className={styles.heroSub}>{mountain.name}</p>
        <h1>Map &amp; route</h1>
      </header>
      <div className={styles.body}>
        {load.state === 'loading' && <div className={styles.panel}><p role="status">Loading trail map…</p></div>}
        {load.state === 'error' && (
          <div className={styles.panel}>
            <p role="alert" className={own.error}>{load.message}</p>
            <Link to={`/m/${mountain.id}`} className={styles.cta}>Back to {mountain.name}</Link>
          </div>
        )}
        {load.state === 'ready' && (
          <>
            <div className={`${styles.panel} ${own.mapPanel}`}>
              <TrailMap resort={load.resort} data={load.data} route={result?.status === 'ok' ? result.geojson : null} onPick={onMapPick} />
            </div>
            <section className={styles.panel} aria-label="Directions">
              <h2>Directions</h2>
              <p className={styles.muted}>Search a lift or trail, or tap one on the map. A trail starts at its top and ends at its bottom; a lift starts at the bottom station.</p>
              <FeaturePicker resortId={mountain.id} label="From" value={text.from} placeholder="Search a lift or trail"
                onChange={(v) => setText((t) => ({ ...t, from: v }))} onPick={(h) => setEnd('from', h)} />
              <FeaturePicker resortId={mountain.id} label="To" value={text.to} placeholder="Search a lift or trail"
                onChange={(v) => setText((t) => ({ ...t, to: v }))} onPick={(h) => setEnd('to', h)} />
              <fieldset className={own.allow}>
                <legend>Trails allowed</legend>
                <p className={own.warn}>Set from your comfort ratings in Profile. Change them here for this route only.</p>
                {allow.includes('black') && blackIncludesDoubleBlackWarning(p.terrainComfort) && (
                  <p className={own.warn}>Heads up: our trail data doesn't separate double blacks yet, so Black can include them.</p>
                )}
                <div className={own.checks}>
                  {DIFFICULTIES.map((d) => (
                    <label key={d.value}>
                      <input type="checkbox" checked={allow.includes(d.value)} onChange={() => toggle(d.value)} /> {d.label}
                    </label>
                  ))}
                  <label>
                    <input type="checkbox" checked={includeUnknown} onChange={(e) => setIncludeUnknown(e.target.checked)} /> Unrated
                  </label>
                </div>
              </fieldset>
              <div className={styles.actions}>
                <Button onClick={go} loading={busy} disabled={!canRoute}>Get route</Button>
                <Button variant="secondary" onClick={clear}>Clear</Button>
              </div>
              {error && <p role="alert" className={own.error}>{error}</p>}
              {result && <p role="status" className={own.result}>{summarizeRoute(result)}</p>}
            </section>
          </>
        )}
      </div>
    </>
  );
}
