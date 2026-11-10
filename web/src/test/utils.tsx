import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { createMockAuth } from '../services/auth/mockAuth';
import { createMockProfileService } from '../services/profile/mockProfile';
import { createMockMailbox } from '../services/mailbox';
import type { ProfilePatch } from '../services/profile/types';

export const TEST_PASSWORD = 'powder123';

export function makeServices({ clock }: { clock?: () => number } = {}) {
  const mailbox = createMockMailbox(localStorage);
  const auth = createMockAuth({ storage: localStorage, mailbox, hashIterations: 1000, clock });
  const profiles = createMockProfileService({ storage: localStorage, clock });
  return { auth, profiles, mailbox };
}
export type Services = ReturnType<typeof makeServices>;

/** Creates an account directly through the services (bypassing UI). */
export async function seedUser(
  services: Services,
  opts: { email?: string; password?: string; profile?: ProfilePatch; signedIn?: boolean } = {},
) {
  const email = opts.email ?? 'alex@example.com';
  const res = await services.auth.signUp(email, opts.password ?? TEST_PASSWORD);
  if (!res.ok) throw new Error(res.error.message);
  const userId = res.data.user.id;
  await services.profiles.createProfile(userId, email);
  if (opts.profile) {
    const upd = await services.profiles.updateProfile(userId, opts.profile);
    if (!upd.ok) throw new Error(upd.error.message);
  }
  if (opts.signedIn === false) await services.auth.signOut();
  return { userId, email };
}

export const ONBOARDED: ProfilePatch = {
  displayName: 'Alex',
  sport: 'ski',
  abilityLevel: 3,
  abilityScore: 5,
  onboardingComplete: true,
  onboardingStep: 8,
};

export function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname + loc.search}</div>;
}

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', services = makeServices() }: { route?: string; services?: Services } = {},
) {
  const utils = render(
    <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider auth={services.auth} profiles={services.profiles}>
        {ui}
        <Routes><Route path="*" element={<LocationProbe />} /></Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
  return { ...utils, services };
}
