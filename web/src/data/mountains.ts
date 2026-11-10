/**
 * Resort catalog for "Find my mountain". Only Mammoth has processed trail data
 * (data/processed/mammoth_*.geojson); the rest are listed so users can search and
 * mark mountains they know, and show as "coming soon".
 */
export interface Mountain {
  id: string;
  name: string;
  region: string;
  hasTrailData: boolean;
  /** [lng, lat] — map center. */
  center: [number, number];
}

export const MOUNTAINS: readonly Mountain[] = [
  { id: 'mammoth', name: 'Mammoth Mountain', region: 'California', hasTrailData: true, center: [-119.0326, 37.6308] },
  { id: 'june', name: 'June Mountain', region: 'California', hasTrailData: false, center: [-119.0907, 37.7676] },
  { id: 'palisades', name: 'Palisades Tahoe', region: 'California', hasTrailData: false, center: [-120.2357, 39.1969] },
  { id: 'heavenly', name: 'Heavenly', region: 'California / Nevada', hasTrailData: false, center: [-119.9400, 38.9353] },
  { id: 'big-bear', name: 'Big Bear Mountain Resort', region: 'California', hasTrailData: false, center: [-116.8899, 34.2364] },
  { id: 'mt-baldy', name: 'Mt. Baldy', region: 'California', hasTrailData: false, center: [-117.6265, 34.2700] },
  { id: 'vail', name: 'Vail', region: 'Colorado', hasTrailData: false, center: [-106.3742, 39.6061] },
  { id: 'breckenridge', name: 'Breckenridge', region: 'Colorado', hasTrailData: false, center: [-106.0667, 39.4817] },
  { id: 'aspen-snowmass', name: 'Aspen Snowmass', region: 'Colorado', hasTrailData: false, center: [-106.9490, 39.2084] },
  { id: 'park-city', name: 'Park City Mountain', region: 'Utah', hasTrailData: false, center: [-111.5080, 40.6514] },
  { id: 'snowbird', name: 'Snowbird', region: 'Utah', hasTrailData: false, center: [-111.6563, 40.5830] },
  { id: 'jackson-hole', name: 'Jackson Hole', region: 'Wyoming', hasTrailData: false, center: [-110.8279, 43.5875] },
  { id: 'big-sky', name: 'Big Sky', region: 'Montana', hasTrailData: false, center: [-111.4012, 45.2857] },
  { id: 'whistler', name: 'Whistler Blackcomb', region: 'British Columbia', hasTrailData: false, center: [-122.9486, 50.1163] },
];

export function getMountain(id: string): Mountain | undefined {
  return MOUNTAINS.find((m) => m.id === id);
}

export function searchMountains(query: string): Mountain[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
  const scored = MOUNTAINS
    .map((m) => {
      const name = m.name.toLowerCase();
      const region = m.region.toLowerCase();
      let score: number;
      if (!q) score = 0;
      else if (name.startsWith(q)) score = 0;
      else if (name.split(/[\s.-]+/).some((w) => w.startsWith(q))) score = 1;
      else if (name.includes(q)) score = 2;
      else if (region.includes(q)) score = 3;
      else score = -1;
      return { m, score };
    })
    .filter((x) => x.score >= 0);
  return scored
    .sort((a, b) => a.score - b.score || Number(b.m.hasTrailData) - Number(a.m.hasTrailData) || a.m.name.localeCompare(b.m.name))
    .map((x) => x.m);
}
