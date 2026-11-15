import { describe, it, expect, vi } from 'vitest';
import { api, OFFLINE_MESSAGE } from './client';
import { loadLiveResortIds } from './useResorts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('api client', () => {
  it('reports an unreachable backend as a network error', async () => {
    const r = await api.listResorts();
    expect(r).toEqual({ ok: false, error: { code: 'network', message: OFFLINE_MESSAGE } });
  });

  it('treats a non-JSON proxy error page as offline', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Bad gateway', { status: 502 })));
    expect((await api.listResorts()).ok).toBe(false);
  });

  it('encodes search queries and returns hits', async () => {
    const fetchMock = vi.fn(async () => json([{ id: 'l1', name: 'Chair 23', kind: 'lift', difficulty: null }]));
    vi.stubGlobal('fetch', fetchMock);
    const r = await api.searchFeatures('mammoth', 'chair 23');
    expect(fetchMock).toHaveBeenCalledWith('/v1/resorts/mammoth/search?limit=6&q=chair%2023', undefined);
    expect(r.ok && r.data[0].name).toBe('Chair 23');
  });

  it('posts route requests as JSON', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => json({ status: 'unreachable', message: 'x' }));
    vi.stubGlobal('fetch', fetchMock);
    const body = { start: { feature_id: 'a' }, destination: { feature_id: 'b' }, allow: ['green' as const] };
    await api.planRoute('mammoth', body);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/v1/resorts/mammoth/routes');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual(body);
  });

  it('maps 404 and FastAPI validation errors to readable messages', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ detail: 'Unknown resort: nowhere' }, 404)));
    expect(await api.getResort('nowhere')).toEqual({ ok: false, error: { code: 'not_found', message: 'Unknown resort: nowhere' } });
    vi.stubGlobal('fetch', vi.fn(async () => json({ detail: [{ msg: 'Give exactly one of coordinate or feature_id' }] }, 422)));
    const r = await api.planRoute('mammoth', { start: { feature_id: 'a' }, destination: { feature_id: 'b' }, allow: [] });
    expect(r).toEqual({ ok: false, error: { code: 'bad_request', message: 'Give exactly one of coordinate or feature_id' } });
  });

  it('loads live resort ids, retrying after a failure', async () => {
    expect(await loadLiveResortIds()).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => json([{ id: 'mammoth', name: 'Mammoth Mountain' }])));
    expect(await loadLiveResortIds()).toEqual(new Set(['mammoth']));
  });
});
