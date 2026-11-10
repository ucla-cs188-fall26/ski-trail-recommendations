import { createMockAuth } from './mockAuth';
import type { AuthService } from './types';

export * from './types';

/**
 * Picks the implementation from VITE_AUTH_PROVIDER (mock | supabase).
 * Only the mock exists today; see web/README.md for the Supabase swap.
 */
function pickAuth(): AuthService {
  const provider = import.meta.env.VITE_AUTH_PROVIDER ?? 'mock';
  if (provider !== 'mock') {
    console.warn(`VITE_AUTH_PROVIDER="${provider}" is not implemented yet; falling back to mock auth.`);
  }
  return createMockAuth();
}

export const authService: AuthService = pickAuth();
