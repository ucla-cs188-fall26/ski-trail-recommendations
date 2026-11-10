import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRoutes } from '../App';
import { renderWithProviders, makeServices, seedUser, ONBOARDED, TEST_PASSWORD } from '../test/utils';

const loc = () => screen.getByTestId('location').textContent;
const waitForPath = (p: string) => waitFor(() => expect(loc()).toBe(p));

async function fillSignUp(email: string, pw: string, confirm = pw) {
  await userEvent.type(screen.getByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText('Password'), pw);
  await userEvent.type(screen.getByLabelText('Confirm password'), confirm);
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
}

async function fillSignIn(email: string, pw: string) {
  if (email) await userEvent.type(screen.getByLabelText('Email'), email);
  if (pw) await userEvent.type(screen.getByLabelText('Password'), pw);
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('Welcome', () => {
  it('is the landing page for signed-out users and links to sign up and sign in', async () => {
    renderWithProviders(<AppRoutes />, { route: '/' });
    await waitForPath('/welcome');
    await userEvent.click(screen.getByRole('link', { name: /create account/i }));
    await waitForPath('/signup');
  });

  it('links to sign in', async () => {
    renderWithProviders(<AppRoutes />, { route: '/welcome' });
    await userEvent.click(await screen.findByRole('link', { name: /^sign in$/i }));
    await waitForPath('/login');
  });
});

describe('Sign up', () => {
  it('creates an account and starts onboarding', async () => {
    const { services } = renderWithProviders(<AppRoutes />, { route: '/signup' });
    await screen.findByRole('heading', { name: /create your account/i });
    await fillSignUp('alex@example.com', TEST_PASSWORD);
    await waitForPath('/onboarding');
    expect(await services.auth.getSession()).not.toBeNull();
  });

  it('shows a strength meter for the password', async () => {
    renderWithProviders(<AppRoutes />, { route: '/signup' });
    await screen.findByRole('heading', { name: /create your account/i });
    expect(screen.getByRole('meter', { name: /password strength/i })).toBeInTheDocument();
  });

  it('flags mismatched passwords and does not create an account', async () => {
    const { services } = renderWithProviders(<AppRoutes />, { route: '/signup' });
    await screen.findByRole('heading', { name: /create your account/i });
    await fillSignUp('alex@example.com', TEST_PASSWORD, 'powder124');
    expect(screen.getByLabelText('Confirm password')).toHaveAccessibleDescription(/don.t match/i);
    expect(loc()).toBe('/signup');
    expect((await services.auth.signIn('alex@example.com', TEST_PASSWORD)).ok).toBe(false);
  });

  it('flags a weak password', async () => {
    renderWithProviders(<AppRoutes />, { route: '/signup' });
    await screen.findByRole('heading', { name: /create your account/i });
    await fillSignUp('alex@example.com', 'short');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(/at least 8/i);
    expect(loc()).toBe('/signup');
  });

  it('flags an invalid email', async () => {
    renderWithProviders(<AppRoutes />, { route: '/signup' });
    await screen.findByRole('heading', { name: /create your account/i });
    await fillSignUp('not-an-email', TEST_PASSWORD);
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(/valid email/i);
  });

  it('flags required fields when submitted empty', async () => {
    renderWithProviders(<AppRoutes />, { route: '/signup' });
    await screen.findByRole('heading', { name: /create your account/i });
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
  });

  it('tells the user when the email is already registered and offers sign in', async () => {
    const services = makeServices();
    await seedUser(services, { signedIn: false });
    renderWithProviders(<AppRoutes />, { route: '/signup', services });
    await screen.findByRole('heading', { name: /create your account/i });
    await fillSignUp('ALEX@example.com', TEST_PASSWORD);
    expect(await screen.findByRole('alert')).toHaveTextContent('An account with this email already exists.');
    expect(screen.getAllByRole('link', { name: /sign in/i }).length).toBeGreaterThan(0);
    expect(loc()).toBe('/signup');
  });
});

describe('Sign in', () => {
  it('signs in an onboarded user and goes to Find my mountain', async () => {
    const services = makeServices();
    await seedUser(services, { profile: ONBOARDED, signedIn: false });
    renderWithProviders(<AppRoutes />, { route: '/login', services });
    await screen.findByRole('heading', { name: /welcome back/i });
    await fillSignIn('alex@example.com', TEST_PASSWORD);
    await waitForPath('/');
  });

  it('sends a user who has not finished onboarding back to onboarding', async () => {
    const services = makeServices();
    await seedUser(services, { signedIn: false });
    renderWithProviders(<AppRoutes />, { route: '/login', services });
    await screen.findByRole('heading', { name: /welcome back/i });
    await fillSignIn('alex@example.com', TEST_PASSWORD);
    await waitForPath('/onboarding');
  });

  it('shows a generic error for a wrong password and keeps the email', async () => {
    const services = makeServices();
    await seedUser(services, { signedIn: false });
    renderWithProviders(<AppRoutes />, { route: '/login', services });
    await screen.findByRole('heading', { name: /welcome back/i });
    await fillSignIn('alex@example.com', 'wrongpass1');
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    expect(screen.getByLabelText('Email')).toHaveValue('alex@example.com');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(loc()).toBe('/login');
  });

  it('validates empty fields without contacting the service', async () => {
    renderWithProviders(<AppRoutes />, { route: '/login' });
    await screen.findByRole('heading', { name: /welcome back/i });
    await fillSignIn('', '');
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(/enter your email/i);
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(/enter your password/i);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('links to forgot password', async () => {
    renderWithProviders(<AppRoutes />, { route: '/login' });
    await userEvent.click(await screen.findByRole('link', { name: /forgot password/i }));
    await waitForPath('/forgot-password');
  });

  it('returns the user to the page they originally asked for', async () => {
    const services = makeServices();
    await seedUser(services, { profile: ONBOARDED, signedIn: false });
    renderWithProviders(<AppRoutes />, { route: '/profile', services });
    await waitForPath('/welcome');
    await userEvent.click(screen.getByRole('link', { name: /^sign in$/i }));
    await screen.findByRole('heading', { name: /welcome back/i });
    await fillSignIn('alex@example.com', TEST_PASSWORD);
    await waitForPath('/profile');
  });
});

describe('Forgot password', () => {
  const CONFIRMATION = /if an account exists/i;

  it('sends a reset email to an existing account and shows a neutral confirmation', async () => {
    const services = makeServices();
    await seedUser(services, { signedIn: false });
    renderWithProviders(<AppRoutes />, { route: '/forgot-password', services });
    await userEvent.type(await screen.findByLabelText('Email'), 'alex@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByText(CONFIRMATION)).toBeInTheDocument();
    expect(services.mailbox.list()).toHaveLength(1);
  });

  it('shows the same confirmation for an unknown email and sends nothing', async () => {
    const { services } = renderWithProviders(<AppRoutes />, { route: '/forgot-password' });
    await userEvent.type(await screen.findByLabelText('Email'), 'nobody@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByText(CONFIRMATION)).toBeInTheDocument();
    expect(services.mailbox.list()).toHaveLength(0);
  });

  it('validates the email format first', async () => {
    renderWithProviders(<AppRoutes />, { route: '/forgot-password' });
    await userEvent.type(await screen.findByLabelText('Email'), 'nope');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(/valid email/i);
    expect(screen.queryByText(CONFIRMATION)).not.toBeInTheDocument();
  });

  it('points to the dev mailbox in development', async () => {
    renderWithProviders(<AppRoutes />, { route: '/forgot-password' });
    await userEvent.type(await screen.findByLabelText('Email'), 'nobody@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByRole('link', { name: /dev mailbox/i })).toHaveAttribute('href', '/dev/mailbox');
  });
});

describe('Reset password', () => {
  async function setupWithToken(clockRef = { now: Date.now() }) {
    const services = makeServices({ clock: () => clockRef.now });
    await seedUser(services, { signedIn: false });
    await services.auth.requestPasswordReset('alex@example.com', 'http://localhost/reset-password');
    const token = new URL(services.mailbox.list()[0].link).searchParams.get('token')!;
    return { services, token, clockRef };
  }

  async function submitNew(pw: string, confirm = pw) {
    await userEvent.type(await screen.findByLabelText('New password'), pw);
    await userEvent.type(screen.getByLabelText('Confirm new password'), confirm);
    await userEvent.click(screen.getByRole('button', { name: /set new password/i }));
  }

  it('sets a new password with a valid link, after which the new password works', async () => {
    const { services, token } = await setupWithToken();
    renderWithProviders(<AppRoutes />, { route: `/reset-password?token=${token}`, services });
    await submitNew('newpowder456');
    expect(await screen.findByText(/password updated/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: /sign in/i }));
    await screen.findByRole('heading', { name: /welcome back/i });
    await fillSignIn('alex@example.com', TEST_PASSWORD);
    expect(await screen.findByRole('alert')).toHaveTextContent(/incorrect/i);
    await userEvent.clear(screen.getByLabelText('Email'));
    await fillSignIn('alex@example.com', 'newpowder456');
    await waitForPath('/onboarding');
  });

  it('rejects a link that has already been used', async () => {
    const { services, token } = await setupWithToken();
    await services.auth.completePasswordReset(token, 'newpowder456');
    renderWithProviders(<AppRoutes />, { route: `/reset-password?token=${token}`, services });
    expect(await screen.findByText(/invalid or has already been used/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /request a new link/i })).toHaveAttribute('href', '/forgot-password');
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });

  it('rejects an expired link', async () => {
    const { services, token, clockRef } = await setupWithToken();
    clockRef.now += 31 * 60 * 1000;
    renderWithProviders(<AppRoutes />, { route: `/reset-password?token=${token}`, services });
    expect(await screen.findByText(/invalid or has expired|has expired/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /request a new link/i })).toBeInTheDocument();
  });

  it('rejects a missing token', async () => {
    renderWithProviders(<AppRoutes />, { route: '/reset-password' });
    expect(await screen.findByRole('link', { name: /request a new link/i })).toBeInTheDocument();
  });

  it('validates mismatched and weak new passwords without using the link', async () => {
    const { services, token } = await setupWithToken();
    renderWithProviders(<AppRoutes />, { route: `/reset-password?token=${token}`, services });
    await submitNew('newpowder456', 'newpowder457');
    expect(screen.getByLabelText('Confirm new password')).toHaveAccessibleDescription(/don.t match/i);
    await userEvent.clear(screen.getByLabelText('New password'));
    await userEvent.clear(screen.getByLabelText('Confirm new password'));
    await submitNew('weak');
    expect(screen.getByLabelText('New password')).toHaveAccessibleDescription(/at least 8/i);
    expect(await services.auth.validateResetToken(token)).toBe(true);
  });
});

describe('Dev mailbox', () => {
  it('lists reset emails with a clickable link', async () => {
    const services = makeServices();
    await seedUser(services, { signedIn: false });
    await services.auth.requestPasswordReset('alex@example.com', 'http://localhost/reset-password');
    renderWithProviders(<AppRoutes />, { route: '/dev/mailbox', services });
    expect(await screen.findByText('alex@example.com', { exact: false })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /reset password/i });
    expect(link.getAttribute('href')).toMatch(/^\/reset-password\?token=/);
  });

  it('shows an empty state and can be cleared', async () => {
    const services = makeServices();
    await seedUser(services, { signedIn: false });
    await services.auth.requestPasswordReset('alex@example.com', 'http://localhost/reset-password');
    renderWithProviders(<AppRoutes />, { route: '/dev/mailbox', services });
    await userEvent.click(await screen.findByRole('button', { name: /clear/i }));
    expect(screen.getByText(/no messages/i)).toBeInTheDocument();
  });
});
