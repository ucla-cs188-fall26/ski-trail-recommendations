import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext';
import { makeServices, seedUser, TEST_PASSWORD, ONBOARDED, type Services } from '../test/utils';

function Probe() {
  const a = useAuth();
  const [error, setError] = useState('');
  return (
    <div>
      <p data-testid="status">{a.status}</p>
      <p data-testid="email">{a.user?.email ?? ''}</p>
      <p data-testid="name">{a.profile?.displayName ?? ''}</p>
      <p data-testid="onboarded">{String(a.profile?.onboardingComplete ?? '')}</p>
      <p data-testid="error">{error}</p>
      <button onClick={async () => {
        const r = await a.signUp('new@example.com', TEST_PASSWORD);
        if (!r.ok) setError(r.error.message);
      }}>signup</button>
      <button onClick={async () => {
        const r = await a.signIn('alex@example.com', 'wrongpass1');
        if (!r.ok) setError(r.error.message);
      }}>bad-signin</button>
      <button onClick={() => a.signIn('alex@example.com', TEST_PASSWORD)}>signin</button>
      <button onClick={() => a.signOut()}>signout</button>
      <button onClick={() => a.updateProfile({ displayName: 'Renamed' })}>rename</button>
    </div>
  );
}

function setup(services: Services = makeServices()) {
  render(<AuthProvider auth={services.auth} profiles={services.profiles}><Probe /></AuthProvider>);
  return services;
}
const status = () => screen.getByTestId('status').textContent;

describe('AuthContext', () => {
  it('starts loading, then reports signed out when there is no session', async () => {
    setup();
    expect(status()).toBe('loading');
    await waitFor(() => expect(status()).toBe('signedOut'));
  });

  it('restores an existing session and its profile on load', async () => {
    const services = makeServices();
    await seedUser(services, { profile: ONBOARDED });
    setup(services);
    await waitFor(() => expect(status()).toBe('signedIn'));
    expect(screen.getByTestId('email')).toHaveTextContent('alex@example.com');
    expect(screen.getByTestId('name')).toHaveTextContent('Alex');
  });

  it('signUp signs the user in with a fresh, un-onboarded profile', async () => {
    setup();
    await waitFor(() => expect(status()).toBe('signedOut'));
    await userEvent.click(screen.getByText('signup'));
    await waitFor(() => expect(status()).toBe('signedIn'));
    expect(screen.getByTestId('email')).toHaveTextContent('new@example.com');
    expect(screen.getByTestId('onboarded')).toHaveTextContent('false');
  });

  it('creates a profile on sign-in if one is missing (e.g. account made elsewhere)', async () => {
    const services = makeServices();
    await services.auth.signUp('alex@example.com', TEST_PASSWORD);
    await services.auth.signOut();
    setup(services);
    await waitFor(() => expect(status()).toBe('signedOut'));
    await userEvent.click(screen.getByText('signin'));
    await waitFor(() => expect(status()).toBe('signedIn'));
    expect(screen.getByTestId('onboarded')).toHaveTextContent('false');
  });

  it('a failed sign-in keeps the user signed out and surfaces the error', async () => {
    const services = makeServices();
    await seedUser(services, { signedIn: false });
    setup(services);
    await waitFor(() => expect(status()).toBe('signedOut'));
    await userEvent.click(screen.getByText('bad-signin'));
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Email or password is incorrect.'));
    expect(status()).toBe('signedOut');
  });

  it('signOut clears the user and profile', async () => {
    const services = makeServices();
    await seedUser(services, { profile: ONBOARDED });
    setup(services);
    await waitFor(() => expect(status()).toBe('signedIn'));
    await userEvent.click(screen.getByText('signout'));
    await waitFor(() => expect(status()).toBe('signedOut'));
    expect(screen.getByTestId('email')).toHaveTextContent('');
    expect(screen.getByTestId('name')).toHaveTextContent('');
  });

  it('updateProfile updates both storage and the context', async () => {
    const services = makeServices();
    const { userId } = await seedUser(services, { profile: ONBOARDED });
    setup(services);
    await waitFor(() => expect(status()).toBe('signedIn'));
    await userEvent.click(screen.getByText('rename'));
    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('Renamed'));
    expect((await services.profiles.getProfile(userId))!.displayName).toBe('Renamed');
  });

  it('follows auth changes made outside the context (e.g. another tab or service call)', async () => {
    const services = makeServices();
    await seedUser(services, { profile: ONBOARDED });
    setup(services);
    await waitFor(() => expect(status()).toBe('signedIn'));
    await act(() => services.auth.signOut());
    await waitFor(() => expect(status()).toBe('signedOut'));
  });

  it('useAuth throws a clear error outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/AuthProvider/);
    spy.mockRestore();
  });
});
