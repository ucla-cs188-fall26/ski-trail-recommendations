import type { DaySession, SkierProfile } from '../../models/profile';
import type { Result } from '../result';

export type ProfileErrorCode = 'not_found' | 'invalid_profile' | 'invalid_session';
export type ProfilePatch = Partial<Omit<SkierProfile, 'userId' | 'email' | 'createdAt' | 'updatedAt'>>;

export interface ProfileService {
  getProfile(userId: string): Promise<SkierProfile | null>;
  /** Idempotent: returns the existing profile when there is one. */
  createProfile(userId: string, email: string): Promise<SkierProfile>;
  updateProfile(userId: string, patch: ProfilePatch): Promise<Result<SkierProfile, ProfileErrorCode>>;
  getDaySession(userId: string, mountainId: string, date: string): Promise<DaySession | null>;
  saveDaySession(session: DaySession): Promise<Result<DaySession, ProfileErrorCode>>;
}
