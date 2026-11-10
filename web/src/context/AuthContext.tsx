import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SkierProfile, DaySession } from '../models/profile';
import type { AuthErrorCode, AuthService, AuthUser, Session } from '../services/auth/types';
import type { ProfileErrorCode, ProfilePatch, ProfileService } from '../services/profile/types';
import type { Result } from '../services/result';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: AuthUser | null;
  profile: SkierProfile | null;
  signUp(email: string, password: string): Promise<Result<Session, AuthErrorCode>>;
  signIn(email: string, password: string): Promise<Result<Session, AuthErrorCode>>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  validateResetToken(token: string): Promise<boolean>;
  completePasswordReset(token: string, newPassword: string): Promise<Result<void, AuthErrorCode>>;
  updateProfile(patch: ProfilePatch): Promise<Result<SkierProfile, ProfileErrorCode>>;
  getDaySession(mountainId: string, date: string): Promise<DaySession | null>;
  saveDaySession(session: DaySession): Promise<Result<DaySession, ProfileErrorCode>>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ auth, profiles, children }: { auth: AuthService; profiles: ProfileService; children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<SkierProfile | null>(null);
  const loadSeq = useRef(0);

  /** Load (or lazily create) the profile for a session, ignoring stale results. */
  const applySession = useCallback(async (s: Session | null) => {
    const seq = ++loadSeq.current;
    if (!s) {
      setSession(null);
      setProfile(null);
      setStatus('signedOut');
      return;
    }
    const p = (await profiles.getProfile(s.user.id)) ?? (await profiles.createProfile(s.user.id, s.user.email));
    if (seq !== loadSeq.current) return;
    setSession(s);
    setProfile(p);
    setStatus('signedIn');
  }, [profiles]);

  useEffect(() => {
    let cancelled = false;
    auth.getSession().then((s) => { if (!cancelled) void applySession(s); });
    const unsubscribe = auth.onAuthStateChange((event, s) => {
      if (cancelled) return;
      if (event === 'SIGNED_IN') void applySession(s);
      else if (event === 'SIGNED_OUT') void applySession(null);
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [auth, applySession]);

  const signUp = useCallback(async (email: string, password: string) => {
    const res = await auth.signUp(email, password);
    if (res.ok) await applySession(res.data);
    return res;
  }, [auth, applySession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await auth.signIn(email, password);
    if (res.ok) await applySession(res.data);
    return res;
  }, [auth, applySession]);

  const signOut = useCallback(async () => {
    await auth.signOut();
    await applySession(null);
  }, [auth, applySession]);

  const updateProfile = useCallback(async (patch: ProfilePatch) => {
    if (!session) return { ok: false as const, error: { code: 'not_found' as const, message: 'Not signed in.' } };
    const res = await profiles.updateProfile(session.user.id, patch);
    if (res.ok) setProfile(res.data);
    return res;
  }, [profiles, session]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    session,
    user: session?.user ?? null,
    profile,
    signUp,
    signIn,
    signOut,
    requestPasswordReset: (email) => auth.requestPasswordReset(email, `${window.location.origin}/reset-password`),
    validateResetToken: (token) => auth.validateResetToken(token),
    completePasswordReset: (token, pw) => auth.completePasswordReset(token, pw),
    updateProfile,
    getDaySession: async (mountainId, date) => (session ? profiles.getDaySession(session.user.id, mountainId, date) : null),
    saveDaySession: (s) => profiles.saveDaySession(s),
  }), [status, session, profile, signUp, signIn, signOut, auth, updateProfile, profiles]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}
