import { describe, it, expect, beforeEach } from 'vitest';
import { createMockProfileService, type ProfileService } from './mockProfile';
import { createDaySession, createDefaultProfile } from '../../models/profile';

let now: number;
let svc: ProfileService;
const make = () => createMockProfileService({ storage: localStorage, clock: () => now });

beforeEach(() => {
  now = Date.UTC(2026, 0, 10, 9);
  svc = make();
});

describe('profiles', () => {
  it('returns null for a user with no profile', async () => {
    expect(await svc.getProfile('nobody')).toBeNull();
  });

  it('creates a default profile, and creating again returns the existing one', async () => {
    const p = await svc.createProfile('u1', 'a@b.co');
    expect(p.onboardingComplete).toBe(false);
    await svc.updateProfile('u1', { displayName: 'Alex' });
    const again = await svc.createProfile('u1', 'a@b.co');
    expect(again.displayName).toBe('Alex');
  });

  it('persists updates across reloads and bumps updatedAt', async () => {
    const created = await svc.createProfile('u1', 'a@b.co');
    now += 60_000;
    const res = await svc.updateProfile('u1', { displayName: 'Alex', sport: 'snowboard', onboardingStep: 2 });
    expect(res.ok).toBe(true);
    const loaded = await make().getProfile('u1');
    expect(loaded).toMatchObject({ displayName: 'Alex', sport: 'snowboard', onboardingStep: 2 });
    expect(loaded!.updatedAt > created.updatedAt).toBe(true);
    expect(loaded!.createdAt).toBe(created.createdAt);
  });

  it('keeps users isolated from each other', async () => {
    await svc.createProfile('u1', 'a@b.co');
    await svc.createProfile('u2', 'c@d.co');
    await svc.updateProfile('u1', { displayName: 'Alex' });
    expect((await svc.getProfile('u2'))!.displayName).not.toBe('Alex');
  });

  it('cannot change identity fields through a patch', async () => {
    await svc.createProfile('u1', 'a@b.co');
    await svc.updateProfile('u1', { userId: 'hacker', createdAt: '1999-01-01T00:00:00.000Z' } as never);
    const p = await svc.getProfile('u1');
    expect(p!.userId).toBe('u1');
    expect(p!.createdAt).not.toBe('1999-01-01T00:00:00.000Z');
    expect(await svc.getProfile('hacker')).toBeNull();
  });

  it('rejects invalid updates and leaves the stored profile unchanged', async () => {
    await svc.createProfile('u1', 'a@b.co');
    const res = await svc.updateProfile('u1', { challengeAppetite: 9 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('invalid_profile');
    expect((await svc.getProfile('u1'))!.challengeAppetite).not.toBe(9);
  });

  it('returns not_found when updating a missing profile', async () => {
    const res = await svc.updateProfile('ghost', { displayName: 'Boo' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('not_found');
  });

  it('returned objects are copies (mutating them does not change storage)', async () => {
    const p = await svc.createProfile('u1', 'a@b.co');
    p.terrainLikes.push('moguls');
    expect((await svc.getProfile('u1'))!.terrainLikes).toEqual([]);
  });
});

describe('day sessions', () => {
  const base = createDefaultProfile('u1', 'a@b.co');
  const feb14 = new Date(2026, 1, 14, 9);

  it('saves and loads today\'s session per mountain and date', async () => {
    const s = { ...createDaySession(base, 'mammoth', feb14), challengeToday: 5 };
    expect((await svc.saveDaySession(s)).ok).toBe(true);
    expect(await make().getDaySession('u1', 'mammoth', '2026-02-14')).toMatchObject({ challengeToday: 5 });
  });

  it('returns null for a different day or mountain', async () => {
    await svc.saveDaySession(createDaySession(base, 'mammoth', feb14));
    expect(await svc.getDaySession('u1', 'mammoth', '2026-02-15')).toBeNull();
    expect(await svc.getDaySession('u1', 'palisades', '2026-02-14')).toBeNull();
    expect(await svc.getDaySession('u2', 'mammoth', '2026-02-14')).toBeNull();
  });

  it('overwrites the session when saved again the same day', async () => {
    await svc.saveDaySession(createDaySession(base, 'mammoth', feb14));
    await svc.saveDaySession({ ...createDaySession(base, 'mammoth', feb14), energy: 'tired' });
    expect((await svc.getDaySession('u1', 'mammoth', '2026-02-14'))!.energy).toBe('tired');
  });

  it('rejects invalid sessions', async () => {
    const bad = { ...createDaySession(base, 'mammoth', feb14), challengeToday: 0 };
    const res = await svc.saveDaySession(bad);
    expect(res.ok).toBe(false);
  });
});
