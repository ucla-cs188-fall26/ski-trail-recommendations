import {
  createDefaultProfile, validateDaySession, validateProfile, type DaySession, type SkierProfile,
} from '../../models/profile';
import { fail, ok } from '../result';
import { readJson, writeJson } from '../storage';
import type { ProfileService } from './types';

export type { ProfileService } from './types';

const PROFILES_KEY = 'trailwise.profiles';
const SESSIONS_KEY = 'trailwise.daySessions';
const IMMUTABLE = ['userId', 'email', 'createdAt', 'updatedAt'] as const;

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const sessionKey = (userId: string, mountainId: string, date: string) => `${userId}|${mountainId}|${date}`;

export function createMockProfileService(options: { storage?: Storage; clock?: () => number } = {}): ProfileService {
  const storage = options.storage ?? localStorage;
  const clock = options.clock ?? Date.now;
  const readMap = <T>(key: string): Record<string, T> => {
    const v = readJson<Record<string, T>>(storage, key, {});
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  };

  return {
    async getProfile(userId) {
      const p = readMap<SkierProfile>(PROFILES_KEY)[userId];
      return p ? clone({ ...createDefaultProfile(userId, p.email), ...p }) : null;
    },

    async createProfile(userId, email) {
      const all = readMap<SkierProfile>(PROFILES_KEY);
      if (all[userId]) return clone(all[userId]);
      const p = createDefaultProfile(userId, email, new Date(clock()));
      all[userId] = p;
      writeJson(storage, PROFILES_KEY, all);
      return clone(p);
    },

    async updateProfile(userId, patch) {
      const all = readMap<SkierProfile>(PROFILES_KEY);
      const current = all[userId];
      if (!current) return fail('not_found', 'Profile not found.');
      const safePatch: Record<string, unknown> = { ...patch };
      for (const k of IMMUTABLE) delete safePatch[k];
      const next: SkierProfile = { ...current, ...clone(safePatch), updatedAt: new Date(clock()).toISOString() };
      const errors = validateProfile(next);
      if (errors.length) return fail('invalid_profile', errors.join(' '));
      all[userId] = next;
      writeJson(storage, PROFILES_KEY, all);
      return ok(clone(next));
    },

    async getDaySession(userId, mountainId, date) {
      const s = readMap<DaySession>(SESSIONS_KEY)[sessionKey(userId, mountainId, date)];
      return s ? clone(s) : null;
    },

    async saveDaySession(session) {
      const errors = validateDaySession(session);
      if (errors.length) return fail('invalid_session', errors.join(' '));
      const all = readMap<DaySession>(SESSIONS_KEY);
      all[sessionKey(session.userId, session.mountainId, session.date)] = clone(session);
      writeJson(storage, SESSIONS_KEY, all);
      return ok(clone(session));
    },
  };
}
