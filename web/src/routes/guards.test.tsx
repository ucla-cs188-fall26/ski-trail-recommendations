import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { RequireAuth, RequireOnboarded, SignedOutOnly, RequireNotOnboarded } from './guards';
import { renderWithProviders, makeServices, seedUser, ONBOARDED } from '../test/utils';

function TestRoutes() {
  return (
    <Routes>
      <Route element={<SignedOutOnly />}>
        <Route path="/welcome" element={<h1>Welcome page</h1>} />
        <Route path="/login" element={<h1>Login page</h1>} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<RequireNotOnboarded />}>
          <Route path="/onboarding" element={<h1>Onboarding page</h1>} />
        </Route>
        <Route element={<RequireOnboarded />}>
          <Route path="/" element={<h1>Mountains page</h1>} />
          <Route path="/profile" element={<h1>Profile page</h1>} />
        </Route>
      </Route>
    </Routes>
  );
}
const loc = () => screen.getByTestId('location').textContent;

describe('route guards', () => {
  it('shows a loading status (not a redirect) while the session is restored', async () => {
    renderWithProviders(<TestRoutes />, { route: '/profile' });
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    await waitFor(() => expect(loc()).toBe('/welcome'));
  });

  it('sends signed-out users from a protected page to /welcome', async () => {
    renderWithProviders(<TestRoutes />, { route: '/profile' });
    expect(await screen.findByRole('heading', { name: 'Welcome page' })).toBeInTheDocument();
    expect(loc()).toBe('/welcome');
  });

  it('sends signed-in but un-onboarded users to /onboarding', async () => {
    const services = makeServices();
    await seedUser(services);
    renderWithProviders(<TestRoutes />, { route: '/', services });
    expect(await screen.findByRole('heading', { name: 'Onboarding page' })).toBeInTheDocument();
  });

  it('lets onboarded users reach protected pages', async () => {
    const services = makeServices();
    await seedUser(services, { profile: ONBOARDED });
    renderWithProviders(<TestRoutes />, { route: '/profile', services });
    expect(await screen.findByRole('heading', { name: 'Profile page' })).toBeInTheDocument();
  });

  it('keeps onboarded users out of onboarding', async () => {
    const services = makeServices();
    await seedUser(services, { profile: ONBOARDED });
    renderWithProviders(<TestRoutes />, { route: '/onboarding', services });
    expect(await screen.findByRole('heading', { name: 'Mountains page' })).toBeInTheDocument();
  });

  it('redirects signed-in users away from signed-out pages', async () => {
    const services = makeServices();
    await seedUser(services, { profile: ONBOARDED });
    renderWithProviders(<TestRoutes />, { route: '/login', services });
    expect(await screen.findByRole('heading', { name: 'Mountains page' })).toBeInTheDocument();
  });

  it('redirects a signed-in, un-onboarded user on /login to onboarding', async () => {
    const services = makeServices();
    await seedUser(services);
    renderWithProviders(<TestRoutes />, { route: '/login', services });
    expect(await screen.findByRole('heading', { name: 'Onboarding page' })).toBeInTheDocument();
  });

  it('signed-out users can see signed-out pages', async () => {
    renderWithProviders(<TestRoutes />, { route: '/login' });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Login page' })).toBeInTheDocument());
  });
});
