import { createMockProfileService } from './mockProfile';
import type { ProfileService } from './types';

export * from './types';

export const profileService: ProfileService = createMockProfileService();
