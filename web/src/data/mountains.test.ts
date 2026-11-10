import { describe, it, expect } from 'vitest';
import { MOUNTAINS, getMountain, searchMountains } from './mountains';

describe('mountain catalog', () => {
  it('includes Mammoth with trail data', () => {
    expect(getMountain('mammoth')).toMatchObject({ name: expect.stringMatching(/mammoth/i), hasTrailData: true });
  });

  it('has unique ids', () => {
    expect(new Set(MOUNTAINS.map((m) => m.id)).size).toBe(MOUNTAINS.length);
  });

  it('returns undefined for unknown ids', () => {
    expect(getMountain('atlantis')).toBeUndefined();
  });

  it('searches by name case-insensitively, ignoring extra whitespace', () => {
    expect(searchMountains('  MAMM ').map((m) => m.id)).toContain('mammoth');
  });

  it('searches by region/state', () => {
    const results = searchMountains('colorado');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((m) => /colorado/i.test(m.region))).toBe(true);
  });

  it('returns the whole catalog for an empty query, mountains with trail data first', () => {
    const all = searchMountains('');
    expect(all).toHaveLength(MOUNTAINS.length);
    expect(all[0].hasTrailData).toBe(true);
  });

  it('returns nothing for a query with no match', () => {
    expect(searchMountains('zzzz')).toEqual([]);
  });

  it('ranks names that start with the query above names that merely contain it', () => {
    const r = searchMountains('mo');
    const firstStartsWith = r.findIndex((m) => m.name.toLowerCase().startsWith('mo'));
    const firstContains = r.findIndex((m) => !m.name.toLowerCase().startsWith('mo'));
    if (firstStartsWith !== -1 && firstContains !== -1) expect(firstStartsWith).toBeLessThan(firstContains);
  });
});
