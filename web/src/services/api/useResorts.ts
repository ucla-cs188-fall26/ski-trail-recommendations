import { useEffect, useState } from 'react';
import { api } from './client';

let cache: Promise<Set<string> | null> | null = null;

/** Resort ids the backend has routing data for, fetched once per page load. */
export function loadLiveResortIds(): Promise<Set<string> | null> {
  cache ??= api.listResorts().then((r) => {
    if (r.ok) return new Set(r.data.map((x) => x.id));
    cache = null; // retry next time; the backend may just not be up yet
    return null;
  });
  return cache;
}

export function resetResortCache() {
  cache = null;
}

/** null while loading or when the backend is unreachable (callers fall back to the static catalog). */
export function useLiveResortIds(): Set<string> | null {
  const [ids, setIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadLiveResortIds().then((x) => { if (!cancelled) setIds(x); });
    return () => { cancelled = true; };
  }, []);
  return ids;
}
