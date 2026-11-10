import { describe, it, expect } from 'vitest';
import {
  RATINGS, TERRAIN_TYPES, createDefaultProfile, deriveTerrainComfort, computeAbilityScore,
  needsClarifier, difficultyToRating, allowedRatings, validateProfile, createDaySession,
  effectivePreferences, localDateKey, type ComfortLevel, type SkierProfile,
} from './profile';

const ORDER: ComfortLevel[] = ['avoid', 'cautious', 'comfortable', 'love'];
const rank = (c: ComfortLevel) => ORDER.indexOf(c);

function profile(overrides: Partial<SkierProfile> = {}): SkierProfile {
  return { ...createDefaultProfile('u1', 'a@b.co', new Date('2026-01-01T00:00:00Z')), ...overrides };
}

describe('createDefaultProfile', () => {
  it('starts un-onboarded at step 0 with the given identity', () => {
    const p = createDefaultProfile('u1', 'a@b.co', new Date('2026-01-01T00:00:00Z'));
    expect(p.userId).toBe('u1');
    expect(p.email).toBe('a@b.co');
    expect(p.onboardingComplete).toBe(false);
    expect(p.onboardingStep).toBe(0);
    expect(p.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(p.updatedAt).toBe(p.createdAt);
  });

  it('has sensible privacy and display defaults', () => {
    const p = profile();
    expect(p.showSkillOnReviews).toBe(true);
    expect(p.detailLevel).toBe('simple');
    expect(p.terrainLikes).toEqual([]);
    expect(p.terrainAvoids).toEqual([]);
    expect(p.familiarMountainIds).toEqual([]);
    expect(p.recentMountainIds).toEqual([]);
  });

  it('does not offer powder as a terrain type (it is a condition)', () => {
    expect(TERRAIN_TYPES).not.toContain('powder');
    expect(TERRAIN_TYPES).toEqual(expect.arrayContaining(['groomers', 'moguls', 'trees', 'park', 'steeps']));
  });
});

describe('computeAbilityScore', () => {
  it('maps each ability level to an increasing score in 1..10', () => {
    const scores = [1, 2, 3, 4, 5].map((l) => computeAbilityScore({ abilityLevel: l }));
    for (const s of scores) {
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(10);
    }
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeGreaterThan(scores[i - 1]);
  });

  it('only asks the clarifier for the middle three levels', () => {
    expect([1, 2, 3, 4, 5].map(needsClarifier)).toEqual([false, true, true, true, false]);
  });

  it('carving raises and sideslipping lowers the score relative to skidding', () => {
    for (const level of [2, 3, 4]) {
      const carve = computeAbilityScore({ abilityLevel: level, clarifier: 'carve' });
      const skid = computeAbilityScore({ abilityLevel: level, clarifier: 'skid' });
      const slip = computeAbilityScore({ abilityLevel: level, clarifier: 'sideslip' });
      expect(carve).toBeGreaterThan(skid);
      expect(slip).toBeLessThan(skid);
    }
  });

  it('ignores a clarifier answer for levels that do not ask it', () => {
    expect(computeAbilityScore({ abilityLevel: 1, clarifier: 'carve' })).toBe(computeAbilityScore({ abilityLevel: 1 }));
    expect(computeAbilityScore({ abilityLevel: 5, clarifier: 'sideslip' })).toBe(computeAbilityScore({ abilityLevel: 5 }));
  });

  it('never lets a refined score overlap the next level band', () => {
    const topOf3 = computeAbilityScore({ abilityLevel: 3, clarifier: 'carve' });
    const bottomOf4 = computeAbilityScore({ abilityLevel: 4, clarifier: 'sideslip' });
    expect(topOf3).toBeLessThanOrEqual(bottomOf4);
  });

  it('uses days per season as a weak prior only when the clarifier was skipped', () => {
    const base = computeAbilityScore({ abilityLevel: 3 });
    const lots = computeAbilityScore({ abilityLevel: 3, daysPerSeason: 40 });
    const few = computeAbilityScore({ abilityLevel: 3, daysPerSeason: 1 });
    expect(lots).toBeGreaterThanOrEqual(base);
    expect(few).toBeLessThanOrEqual(base);
    expect(Math.abs(lots - base)).toBeLessThanOrEqual(1);
    expect(computeAbilityScore({ abilityLevel: 3, clarifier: 'skid', daysPerSeason: 40 }))
      .toBe(computeAbilityScore({ abilityLevel: 3, clarifier: 'skid' }));
  });

  it('clamps invalid levels into range instead of throwing', () => {
    expect(computeAbilityScore({ abilityLevel: 0 })).toBe(computeAbilityScore({ abilityLevel: 1 }));
    expect(computeAbilityScore({ abilityLevel: 9 })).toBe(computeAbilityScore({ abilityLevel: 5 }));
  });
});

describe('deriveTerrainComfort', () => {
  it('keeps a first-day skier off everything but greens', () => {
    const c = deriveTerrainComfort(1);
    expect(c.green).not.toBe('avoid');
    expect(c.blue).toBe('avoid');
    expect(c.black).toBe('avoid');
    expect(c.doubleBlack).toBe('avoid');
  });

  it('lets a top-level skier ski double blacks', () => {
    const c = deriveTerrainComfort(10);
    expect(rank(c.doubleBlack)).toBeGreaterThanOrEqual(rank('comfortable'));
  });

  it('is monotonic: a higher score never lowers comfort on any rating', () => {
    for (let s = 1; s < 10; s++) {
      const lo = deriveTerrainComfort(s);
      const hi = deriveTerrainComfort(s + 1);
      for (const r of RATINGS) expect(rank(hi[r])).toBeGreaterThanOrEqual(rank(lo[r]));
    }
  });

  it('is never more comfortable on a harder rating than an easier one', () => {
    for (let s = 1; s <= 10; s++) {
      const c = deriveTerrainComfort(s);
      expect(rank(c.green)).toBeGreaterThanOrEqual(rank(c.blue));
      expect(rank(c.blue)).toBeGreaterThanOrEqual(rank(c.black));
      expect(rank(c.black)).toBeGreaterThanOrEqual(rank(c.doubleBlack));
    }
  });

  it('clamps and rounds out-of-range scores', () => {
    expect(deriveTerrainComfort(-3)).toEqual(deriveTerrainComfort(1));
    expect(deriveTerrainComfort(42)).toEqual(deriveTerrainComfort(10));
    expect(deriveTerrainComfort(4.6)).toEqual(deriveTerrainComfort(5));
  });
});

describe('difficultyToRating / allowedRatings', () => {
  it('maps OpenSkiMap difficulties to the four piste ratings', () => {
    expect(difficultyToRating('novice')).toBe('green');
    expect(difficultyToRating('easy')).toBe('green');
    expect(difficultyToRating('intermediate')).toBe('blue');
    expect(difficultyToRating('advanced')).toBe('black');
    expect(difficultyToRating('expert')).toBe('doubleBlack');
  });

  it('returns null for missing or unknown difficulties', () => {
    expect(difficultyToRating(undefined)).toBeNull();
    expect(difficultyToRating('freeride')).toBeNull();
  });

  it('allows every rating the skier does not avoid', () => {
    expect(allowedRatings({ green: 'love', blue: 'cautious', black: 'avoid', doubleBlack: 'avoid' }))
      .toEqual(['green', 'blue']);
    expect(allowedRatings({ green: 'avoid', blue: 'avoid', black: 'avoid', doubleBlack: 'avoid' })).toEqual([]);
  });
});

describe('validateProfile', () => {
  it('accepts a default profile', () => {
    expect(validateProfile(profile())).toEqual([]);
  });

  it('rejects an over-long display name', () => {
    expect(validateProfile(profile({ displayName: 'x'.repeat(61) })).join(' ')).toMatch(/name/i);
  });

  it('rejects out-of-range numeric answers', () => {
    expect(validateProfile(profile({ abilityLevel: 6 })).length).toBeGreaterThan(0);
    expect(validateProfile(profile({ challengeAppetite: 0 })).length).toBeGreaterThan(0);
    expect(validateProfile(profile({ daysPerSeason: -1 })).length).toBeGreaterThan(0);
    expect(validateProfile(profile({ yearsExperience: 120 })).length).toBeGreaterThan(0);
  });

  it('rejects a terrain type that is both liked and avoided', () => {
    expect(validateProfile(profile({ terrainLikes: ['moguls'], terrainAvoids: ['moguls'] })).length).toBeGreaterThan(0);
  });

  it('requires a display name once onboarding is complete', () => {
    expect(validateProfile(profile({ onboardingComplete: true, displayName: '   ' })).length).toBeGreaterThan(0);
  });
});

describe('day sessions', () => {
  const date = new Date(2026, 1, 14, 9, 30);

  it('formats local date keys as YYYY-MM-DD', () => {
    expect(localDateKey(date)).toBe('2026-02-14');
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('prefills today\'s challenge from the profile baseline', () => {
    const s = createDaySession(profile({ challengeAppetite: 4 }), 'mammoth', date);
    expect(s).toMatchObject({ userId: 'u1', mountainId: 'mammoth', date: '2026-02-14', challengeToday: 4, energy: 'ok' });
    expect(s.wantToday).toEqual([]);
    expect(s.meetingPoint).toBeUndefined();
  });

  it('effective preferences fall back to the profile when there is no session', () => {
    const p = profile({ challengeAppetite: 2, terrainLikes: ['groomers'], terrainAvoids: ['moguls'] });
    expect(effectivePreferences(p, null)).toMatchObject({ challenge: 2, likes: ['groomers'], avoids: ['moguls'] });
  });

  it('today\'s session overrides the baseline challenge and adds today\'s wants', () => {
    const p = profile({ challengeAppetite: 2, terrainLikes: ['groomers'] });
    const s = { ...createDaySession(p, 'mammoth', date), challengeToday: 5, wantToday: ['steeps' as const] };
    const eff = effectivePreferences(p, s);
    expect(eff.challenge).toBe(5);
    expect(eff.likes).toEqual(expect.arrayContaining(['groomers', 'steeps']));
  });

  it('a wanted-today terrain is not also reported as avoided', () => {
    const p = profile({ terrainAvoids: ['trees'] });
    const s = { ...createDaySession(p, 'mammoth', date), wantToday: ['trees' as const] };
    const eff = effectivePreferences(p, s);
    expect(eff.likes).toContain('trees');
    expect(eff.avoids).not.toContain('trees');
  });

  it('being tired lowers the effective challenge, never below 1', () => {
    const p = profile({ challengeAppetite: 3 });
    const tired = { ...createDaySession(p, 'mammoth', date), challengeToday: 3, energy: 'tired' as const };
    expect(effectivePreferences(p, tired).challenge).toBe(2);
    const veryLow = { ...tired, challengeToday: 1 };
    expect(effectivePreferences(p, veryLow).challenge).toBe(1);
  });
});
