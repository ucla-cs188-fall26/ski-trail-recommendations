import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockAuth, type MockAuth } from './mockAuth';
import { createMockMailbox, type MockMailbox } from '../mailbox';

const PW = 'powder123';
const MIN = 60 * 1000;

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

let storage: Storage;
let now: number;
let mailbox: MockMailbox;
let auth: MockAuth;
const make = () => createMockAuth({ storage, mailbox, clock: () => now, hashIterations: 1000 });

function tokenFromLatestMail(): string {
  const msg = mailbox.list()[0];
  const url = new URL(msg.link);
  return url.searchParams.get('token')!;
}

beforeEach(() => {
  storage = memoryStorage();
  now = Date.UTC(2026, 0, 10, 9);
  mailbox = createMockMailbox(storage);
  auth = make();
});

describe('signUp', () => {
  it('creates an account, signs the user in and normalizes the email', async () => {
    const res = await auth.signUp('  Alex@Example.COM ', PW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.user.email).toBe('alex@example.com');
    expect(res.data.user.id).toBeTruthy();
    expect((await auth.getSession())?.user.email).toBe('alex@example.com');
  });

  it('persists the session across app reloads', async () => {
    await auth.signUp('alex@example.com', PW);
    const reloaded = make();
    expect((await reloaded.getSession())?.user.email).toBe('alex@example.com');
  });

  it('rejects a duplicate email regardless of case or whitespace', async () => {
    await auth.signUp('alex@example.com', PW);
    await auth.signOut();
    const res = await auth.signUp(' ALEX@example.com', 'another123');
    expect(res).toEqual({ ok: false, error: { code: 'email_taken', message: 'An account with this email already exists.' } });
  });

  it('rejects malformed emails', async () => {
    for (const bad of ['', 'alex', 'alex@', '@example.com', 'a b@c.com']) {
      const res = await auth.signUp(bad, PW);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('invalid_email');
    }
  });

  it('rejects weak passwords with a helpful message', async () => {
    const res = await auth.signUp('alex@example.com', 'short1');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('weak_password');
      expect(res.error.message).toMatch(/8/);
    }
  });

  it('never stores the password in plain text', async () => {
    await auth.signUp('alex@example.com', PW);
    for (let i = 0; i < storage.length; i++) {
      expect(storage.getItem(storage.key(i)!)).not.toContain(PW);
    }
  });

  it('gives each account a distinct id', async () => {
    const a = await auth.signUp('a@example.com', PW);
    const b = await auth.signUp('b@example.com', PW);
    expect(a.ok && b.ok && a.data.user.id !== b.data.user.id).toBe(true);
  });
});

describe('signIn / signOut', () => {
  beforeEach(async () => {
    await auth.signUp('alex@example.com', PW);
    await auth.signOut();
  });

  it('signs in with the right password (email case-insensitive)', async () => {
    const res = await auth.signIn(' Alex@Example.com', PW);
    expect(res.ok).toBe(true);
    expect((await auth.getSession())?.user.email).toBe('alex@example.com');
  });

  it('returns the same generic error for a wrong password and an unknown email', async () => {
    const wrong = await auth.signIn('alex@example.com', 'wrongpass1');
    const unknown = await auth.signIn('nobody@example.com', PW);
    const expected = { ok: false, error: { code: 'invalid_credentials', message: 'Email or password is incorrect.' } };
    expect(wrong).toEqual(expected);
    expect(unknown).toEqual(expected);
    expect(await auth.getSession()).toBeNull();
  });

  it('signOut clears the session', async () => {
    await auth.signIn('alex@example.com', PW);
    await auth.signOut();
    expect(await auth.getSession()).toBeNull();
    expect(await make().getSession()).toBeNull();
  });

  it('signOut when already signed out is a no-op', async () => {
    await expect(auth.signOut()).resolves.toBeUndefined();
  });
});

describe('onAuthStateChange', () => {
  it('emits SIGNED_IN and SIGNED_OUT and stops after unsubscribe', async () => {
    const cb = vi.fn();
    const unsubscribe = auth.onAuthStateChange(cb);
    await auth.signUp('alex@example.com', PW);
    expect(cb).toHaveBeenLastCalledWith('SIGNED_IN', expect.objectContaining({ user: expect.objectContaining({ email: 'alex@example.com' }) }));
    await auth.signOut();
    expect(cb).toHaveBeenLastCalledWith('SIGNED_OUT', null);
    unsubscribe();
    await auth.signIn('alex@example.com', PW);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('does not emit on failed attempts', async () => {
    const cb = vi.fn();
    auth.onAuthStateChange(cb);
    await auth.signIn('nobody@example.com', PW);
    await auth.signUp('bad', PW);
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('password reset', () => {
  const REDIRECT = 'http://localhost:5173/reset-password';

  beforeEach(async () => {
    await auth.signUp('alex@example.com', PW);
    await auth.signOut();
  });

  it('sends a reset email with a link to the redirect URL', async () => {
    await auth.requestPasswordReset(' ALEX@example.com', REDIRECT);
    const [msg] = mailbox.list();
    expect(msg.to).toBe('alex@example.com');
    expect(msg.link.startsWith(REDIRECT + '?token=')).toBe(true);
  });

  it('silently does nothing for unknown emails (no account enumeration)', async () => {
    await expect(auth.requestPasswordReset('nobody@example.com', REDIRECT)).resolves.toBeUndefined();
    expect(mailbox.list()).toHaveLength(0);
  });

  it('lets the user set a new password; the old one stops working', async () => {
    await auth.requestPasswordReset('alex@example.com', REDIRECT);
    const res = await auth.completePasswordReset(tokenFromLatestMail(), 'newpowder456');
    expect(res.ok).toBe(true);
    expect((await auth.signIn('alex@example.com', PW)).ok).toBe(false);
    expect((await auth.signIn('alex@example.com', 'newpowder456')).ok).toBe(true);
  });

  it('accepts a token only once', async () => {
    await auth.requestPasswordReset('alex@example.com', REDIRECT);
    const token = tokenFromLatestMail();
    await auth.completePasswordReset(token, 'newpowder456');
    const again = await auth.completePasswordReset(token, 'other789xyz');
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe('invalid_token');
  });

  it('accepts a token just before 30 minutes and rejects it after', async () => {
    await auth.requestPasswordReset('alex@example.com', REDIRECT);
    const token = tokenFromLatestMail();
    now += 29 * MIN;
    expect(await auth.validateResetToken(token)).toBe(true);
    now += 2 * MIN;
    const res = await auth.completePasswordReset(token, 'newpowder456');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('expired_token');
  });

  it('rejects unknown or empty tokens', async () => {
    for (const t of ['', 'not-a-real-token']) {
      const res = await auth.completePasswordReset(t, 'newpowder456');
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('invalid_token');
      expect(await auth.validateResetToken(t)).toBe(false);
    }
  });

  it('rejects a weak new password without burning the token', async () => {
    await auth.requestPasswordReset('alex@example.com', REDIRECT);
    const token = tokenFromLatestMail();
    const weak = await auth.completePasswordReset(token, 'short');
    expect(weak.ok).toBe(false);
    if (!weak.ok) expect(weak.error.code).toBe('weak_password');
    expect((await auth.completePasswordReset(token, 'newpowder456')).ok).toBe(true);
  });

  it('a newer reset request invalidates the older link', async () => {
    await auth.requestPasswordReset('alex@example.com', REDIRECT);
    const first = tokenFromLatestMail();
    await auth.requestPasswordReset('alex@example.com', REDIRECT);
    const second = tokenFromLatestMail();
    expect(second).not.toBe(first);
    expect((await auth.completePasswordReset(first, 'newpowder456')).ok).toBe(false);
    expect((await auth.completePasswordReset(second, 'newpowder456')).ok).toBe(true);
  });
});

describe('robustness', () => {
  it('treats corrupted storage as empty instead of crashing', async () => {
    for (let i = 0; i < storage.length; i++) storage.setItem(storage.key(i)!, '{not json');
    storage.setItem('trailwise.auth.users', '{not json');
    storage.setItem('trailwise.auth.session', '{not json');
    const fresh = make();
    expect(await fresh.getSession()).toBeNull();
    expect((await fresh.signUp('alex@example.com', PW)).ok).toBe(true);
  });
});
