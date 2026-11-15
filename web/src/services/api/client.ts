import { fail, ok, type Result } from '../result';
import type {
  ApiErrorCode, FeatureCollection, FeatureKind, ResortMeta, RouteRequest, RouteResponse, SearchHit,
} from './types';

/**
 * Thin client for the trail backend. In dev, Vite proxies /v1 to uvicorn on :8000
 * (web/vite.config.ts), so the default base is same-origin. Set VITE_API_BASE to
 * point at a deployed backend (which will then need CORS).
 */
const BASE: string = import.meta.env.VITE_API_BASE ?? '';

export type ApiResult<T> = Result<T, ApiErrorCode>;

export const OFFLINE_MESSAGE =
  "Can't reach the trail server. Start it with `uvicorn backend.main:app --reload` from the repo root.";

function detailMessage(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as { msg?: unknown };
    if (typeof first?.msg === 'string') return first.msg;
  }
  return fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    return fail('network', OFFLINE_MESSAGE);
  }
  // Without the backend, the Vite proxy answers with an empty/HTML error page.
  if (!(res.headers.get('content-type') ?? '').includes('json')) return fail('network', OFFLINE_MESSAGE);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return fail('server', 'The trail server sent an unreadable response.');
  }
  if (res.status === 404) return fail('not_found', detailMessage(body, 'Not found.'));
  if (res.status === 400 || res.status === 422) return fail('bad_request', detailMessage(body, 'The request was rejected.'));
  if (!res.ok) return fail('server', detailMessage(body, `The trail server failed (HTTP ${res.status}).`));
  return ok(body as T);
}

const resortPath = (id: string) => `/v1/resorts/${encodeURIComponent(id)}`;

export const api = {
  listResorts: () => request<ResortMeta[]>('/v1/resorts'),
  getResort: (id: string) => request<ResortMeta>(resortPath(id)),
  getFeatures: (id: string, kind: FeatureKind) => request<FeatureCollection>(`${resortPath(id)}/features/${kind}`),
  searchFeatures: (id: string, q: string, limit = 6) =>
    request<SearchHit[]>(`${resortPath(id)}/search?limit=${limit}&q=${encodeURIComponent(q)}`),
  planRoute: (id: string, body: RouteRequest) =>
    request<RouteResponse>(`${resortPath(id)}/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
};
