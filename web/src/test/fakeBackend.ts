import { vi } from 'vitest';

const fc = (features: unknown[] = []) => ({ type: 'FeatureCollection', features });
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const HITS = [
  { id: 'lift-23', name: 'Chair 23', kind: 'lift', difficulty: null },
  { id: 'run-broadway', name: 'Broadway', kind: 'trail', difficulty: 'intermediate' },
];

export const OK_ROUTE = {
  status: 'ok', message: 'Route found', total_trail_distance_m: 1234, total_lift_distance_m: 800,
  total_connector_distance_m: 0, lifts_used: [{ id: 'lift-23', name: 'Chair 23' }],
  geojson: fc([{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[-119, 37.6], [-119.01, 37.61]] }, properties: {} }]),
};

/** Stub fetch with a tiny Mammoth-only backend. Returns the mock so tests can inspect calls. */
export function stubBackend(route: unknown = OK_ROUTE) {
  const mock = vi.fn(async (url: string, _init?: RequestInit) => {
    const path = url.split('?')[0];
    if (path === '/v1/resorts') return json([{ id: 'mammoth', name: 'Mammoth Mountain' }]);
    if (path === '/v1/resorts/mammoth') return json({ id: 'mammoth', name: 'Mammoth Mountain' });
    if (path.startsWith('/v1/resorts/mammoth/features/')) return json(fc());
    if (path === '/v1/resorts/mammoth/search') {
      const q = new URL(url, 'http://x').searchParams.get('q')!.toLowerCase();
      return json(HITS.filter((h) => h.name.toLowerCase().includes(q)));
    }
    if (path === '/v1/resorts/mammoth/routes') return json(route);
    return json({ detail: 'Not Found' }, 404);
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}
