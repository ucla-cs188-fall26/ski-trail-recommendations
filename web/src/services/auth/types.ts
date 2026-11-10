import type { Result } from '../result';

export interface AuthUser {
  id: string;
  email: string;
}

export interface Session {
  user: AuthUser;
  accessToken: string;
  createdAt: string;
}

export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'PASSWORD_RECOVERY';
export type AuthErrorCode =
  | 'invalid_email'
  | 'weak_password'
  | 'email_taken'
  | 'invalid_credentials'
  | 'invalid_token'
  | 'expired_token'
  | 'network';
export type Unsubscribe = () => void;

/**
 * Mirrors supabase-js auth semantics so a Supabase implementation can drop in:
 *  - requestPasswordReset ~ supabase.auth.resetPasswordForEmail(email, { redirectTo })
 *  - completePasswordReset ~ supabase.auth.updateUser({ password }) inside the recovery session
 */
export interface AuthService {
  signUp(email: string, password: string): Promise<Result<Session, AuthErrorCode>>;
  signIn(email: string, password: string): Promise<Result<Session, AuthErrorCode>>;
  signOut(): Promise<void>;
  getSession(): Promise<Session | null>;
  onAuthStateChange(cb: (event: AuthEvent, session: Session | null) => void): Unsubscribe;
  requestPasswordReset(email: string, redirectTo: string): Promise<void>;
  /** True when the token exists, is unused and is not expired. */
  validateResetToken(token: string): Promise<boolean>;
  completePasswordReset(token: string, newPassword: string): Promise<Result<void, AuthErrorCode>>;
}
