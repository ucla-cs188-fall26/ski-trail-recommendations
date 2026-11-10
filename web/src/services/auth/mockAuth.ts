/**
 * localStorage-backed mock of the AuthService. NOT a security boundary:
 * anything in localStorage is readable by the page. PBKDF2 hashing just
 * avoids storing plaintext and keeps behavior realistic.
 */
import { validatePassword } from '../../lib/password';
import { createMockMailbox, type MockMailbox } from '../mailbox';
import { fail, ok, type Result } from '../result';
import { readJson, writeJson } from '../storage';
import type { AuthErrorCode, AuthEvent, AuthService, Session } from './types';

const USERS_KEY = 'trailwise.auth.users';
const SESSION_KEY = 'trailwise.auth.session';
const RESETS_KEY = 'trailwise.auth.resets';
export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

interface StoredUser {
  id: string;
  email: string;
  salt: string;
  hash: string;
  createdAt: string;
}

interface StoredReset {
  token: string;
  userId: string;
  expiresAt: number;
  used: boolean;
}

export interface MockAuthOptions {
  storage?: Storage;
  mailbox?: MockMailbox;
  clock?: () => number;
  hashIterations?: number;
}

export type MockAuth = AuthService;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const isValidEmail = (email: string) => EMAIL_RE.test(normalizeEmail(email));

const toB64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const randomToken = (bytes = 32) => {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
};

async function hashPassword(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return toB64(bits);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function createMockAuth(options: MockAuthOptions = {}): MockAuth {
  const storage = options.storage ?? localStorage;
  const mailbox = options.mailbox ?? createMockMailbox(storage);
  const clock = options.clock ?? Date.now;
  const iterations = options.hashIterations ?? 100_000;
  const listeners = new Set<(e: AuthEvent, s: Session | null) => void>();

  const users = (): StoredUser[] => {
    const v = readJson<StoredUser[]>(storage, USERS_KEY, []);
    return Array.isArray(v) ? v : [];
  };
  const resets = (): StoredReset[] => {
    const v = readJson<StoredReset[]>(storage, RESETS_KEY, []);
    return Array.isArray(v) ? v : [];
  };
  const emit = (e: AuthEvent, s: Session | null) => listeners.forEach((cb) => cb(e, s));

  const startSession = (user: StoredUser): Session => {
    const session: Session = {
      user: { id: user.id, email: user.email },
      accessToken: randomToken(16),
      createdAt: new Date(clock()).toISOString(),
    };
    writeJson(storage, SESSION_KEY, session);
    emit('SIGNED_IN', session);
    return session;
  };

  const findReset = (token: string): Result<StoredReset, AuthErrorCode> => {
    const r = token ? resets().find((x) => x.token === token) : undefined;
    if (!r || r.used) return fail('invalid_token', 'This reset link is invalid or has already been used.');
    if (clock() > r.expiresAt) return fail('expired_token', 'This reset link has expired. Request a new one.');
    return ok(r);
  };

  return {
    async signUp(rawEmail, password) {
      const email = normalizeEmail(rawEmail);
      if (!isValidEmail(email)) return fail('invalid_email', 'Enter a valid email address.');
      const pwError = validatePassword(password);
      if (pwError) return fail('weak_password', pwError);
      const all = users();
      if (all.some((u) => u.email === email)) {
        return fail('email_taken', 'An account with this email already exists.');
      }
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const user: StoredUser = {
        id: crypto.randomUUID(),
        email,
        salt: toB64(salt),
        hash: await hashPassword(password, salt, iterations),
        createdAt: new Date(clock()).toISOString(),
      };
      writeJson(storage, USERS_KEY, [...all, user]);
      return ok(startSession(user));
    },

    async signIn(rawEmail, password) {
      const email = normalizeEmail(rawEmail);
      const user = users().find((u) => u.email === email);
      // Hash even for unknown users so timing does not reveal account existence.
      const salt = user ? fromB64(user.salt) : new Uint8Array(16);
      const hash = await hashPassword(password, salt, iterations);
      if (!user || !constantTimeEqual(hash, user.hash)) {
        return fail('invalid_credentials', 'Email or password is incorrect.');
      }
      return ok(startSession(user));
    },

    async signOut() {
      const had = storage.getItem(SESSION_KEY) != null;
      storage.removeItem(SESSION_KEY);
      if (had) emit('SIGNED_OUT', null);
    },

    async getSession() {
      const s = readJson<Session | null>(storage, SESSION_KEY, null);
      if (!s || typeof s !== 'object' || !s.user?.id) return null;
      return users().some((u) => u.id === s.user.id) ? s : null;
    },

    onAuthStateChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    async requestPasswordReset(rawEmail, redirectTo) {
      const email = normalizeEmail(rawEmail);
      const user = users().find((u) => u.email === email);
      if (!user) return; // no account enumeration
      const token = randomToken();
      const others = resets().filter((r) => r.userId !== user.id); // newest link wins
      writeJson(storage, RESETS_KEY, [...others, { token, userId: user.id, expiresAt: clock() + RESET_TOKEN_TTL_MS, used: false }]);
      const link = `${redirectTo}?token=${encodeURIComponent(token)}`;
      mailbox.send({
        to: email,
        subject: 'Reset your Trailwise password',
        body: 'Someone asked to reset your password. If that was you, use the link below within 30 minutes. If not, you can ignore this email.',
        link,
      }, clock());
    },

    async validateResetToken(token) {
      return findReset(token).ok;
    },

    async completePasswordReset(token, newPassword) {
      const found = findReset(token);
      if (!found.ok) return found;
      const pwError = validatePassword(newPassword);
      if (pwError) return fail('weak_password', pwError);
      const all = users();
      const user = all.find((u) => u.id === found.data.userId);
      if (!user) return fail('invalid_token', 'This reset link is invalid or has already been used.');
      const salt = crypto.getRandomValues(new Uint8Array(16));
      user.salt = toB64(salt);
      user.hash = await hashPassword(newPassword, salt, iterations);
      writeJson(storage, USERS_KEY, all);
      writeJson(storage, RESETS_KEY, resets().map((r) => (r.token === token ? { ...r, used: true } : r)));
      return ok(undefined);
    },
  };
}
