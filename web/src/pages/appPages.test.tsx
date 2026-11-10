import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRoutes } from '../App';
import { renderWithProviders, makeServices, seedUser, ONBOARDED, type Services } from '../test/utils';
import { localDateKey } from '../models/profile';
import type { ProfilePatch } from '../services/profile/types';

const loc = () => screen.getByTestId('location').textContent;
const waitForPath = (p: string) => waitFor(() => expect(loc()).toBe(p));
const today = () => localDateKey(new Date());

async function open(route: string, patch: ProfilePatch = {}, services: Services = makeServices()) {
  const { userId } = await seedUser(services, { profile: { ...ONBOARDED, ...patch } });
  const utils = renderWithProviders(<AppRoutes />, { route, services });
  return { ...utils, services, userId, stored: () => services.profiles.getProfile(userId) };
}

describe('tab bar', () => {
  it('shows Mountains, Map and Profile tabs and marks the current one', async () => {
    await open('/');
    const nav = await screen.findByRole('navigation', { name: /main/i });
    for (const name of [/mountains/i, /map/i, /profile/i]) expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /mountains/i })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(within(nav).getByRole('link', { name: /profile/i }));
    await waitForPath('/profile');
    expect(within(nav).getByRole('link', { name: /profile/i })).toHaveAttribute('aria-current', 'page');
  });

  it('points the Map tab at the most recent mountain, or Find my mountain when there is none', async () => {
    const { unmount } = await open('/', { recentMountainIds: ['mammoth'] });
    const nav = await screen.findByRole('navigation', { name: /main/i });
    expect(within(nav).getByRole('link', { name: /map/i })).toHaveAttribute('href', '/m/mammoth/map');
    unmount();
    localStorage.clear();
    await open('/');
    const nav2 = await screen.findByRole('navigation', { name: /main/i });
    expect(within(nav2).getByRole('link', { name: /map/i })).toHaveAttribute('href', '/');
  });
});

describe('Find my mountain', () => {
  it('greets the user and lists mountains', async () => {
    await open('/');
    expect(await screen.findByRole('heading', { name: /find my mountain/i })).toBeInTheDocument();
    expect(screen.getByText(/hi, alex/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mammoth mountain/i })).toBeInTheDocument();
  });

  it('shows the home mountain under "Your mountains"', async () => {
    await open('/', { homeMountainId: 'mammoth' });
    const mine = await screen.findByRole('region', { name: /your mountains/i });
    expect(within(mine).getByRole('button', { name: /mammoth mountain/i })).toBeInTheDocument();
  });

  it('has no "Your mountains" section for a user without home or recent mountains', async () => {
    await open('/');
    await screen.findByRole('heading', { name: /find my mountain/i });
    expect(screen.queryByRole('region', { name: /your mountains/i })).not.toBeInTheDocument();
  });

  it('filters by search and shows an empty state', async () => {
    await open('/');
    const search = await screen.findByLabelText(/search mountains/i);
    await userEvent.type(search, 'vail');
    const results = screen.getByRole('region', { name: /all mountains/i });
    expect(within(results).getAllByRole('button')).toHaveLength(1);
    await userEvent.clear(search);
    await userEvent.type(search, 'zzzz');
    expect(screen.getByText(/no mountains match/i)).toBeInTheDocument();
  });

  it('opens a mountain with trail data and records it as recent (deduped, newest first)', async () => {
    const { stored } = await open('/', { recentMountainIds: ['vail', 'mammoth'] });
    const all = await screen.findByRole('region', { name: /all mountains/i });
    await userEvent.click(within(all).getByRole('button', { name: /mammoth mountain/i }));
    await waitForPath('/m/mammoth');
    expect((await stored())!.recentMountainIds).toEqual(['mammoth', 'vail']);
  });

  it('marks mountains without trail data as coming soon and does not open them', async () => {
    await open('/');
    const btn = await screen.findByRole('button', { name: /vail/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAccessibleName(/coming soon/i);
  });
});

describe("Today's session", () => {
  it('opens on the first visit today, prefilled from the profile', async () => {
    await open('/m/mammoth', { challengeAppetite: 4 });
    const d = await screen.findByRole('dialog', { name: /today.s session/i });
    expect(within(d).getByRole('slider', { name: /today.s challenge/i })).toHaveValue('4');
    expect(within(d).getByRole('radio', { name: /^ok$/i })).toHaveAttribute('aria-checked', 'true');
  });

  it('saves today\'s choices and shows them on the page', async () => {
    const { services, userId } = await open('/m/mammoth');
    const d = await screen.findByRole('dialog', { name: /today.s session/i });
    fireEvent.change(within(d).getByRole('slider', { name: /today.s challenge/i }), { target: { value: '5' } });
    await userEvent.click(within(d).getByRole('radio', { name: /fresh/i }));
    await userEvent.click(within(d).getByRole('checkbox', { name: /steeps/i }));
    await userEvent.type(within(d).getByLabelText(/meeting point/i), 'Main Lodge at noon');
    await userEvent.click(within(d).getByRole('button', { name: /save/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await services.profiles.getDaySession(userId, 'mammoth', today())).toMatchObject({
      challengeToday: 5, energy: 'fresh', wantToday: ['steeps'], meetingPoint: { name: 'Main Lodge at noon' },
    });
    expect(screen.getByText(/push me/i)).toBeInTheDocument();
    expect(screen.getByText(/main lodge at noon/i)).toBeInTheDocument();
  });

  it('does not save a blank meeting point', async () => {
    const { services, userId } = await open('/m/mammoth');
    const d = await screen.findByRole('dialog', { name: /today.s session/i });
    await userEvent.type(within(d).getByLabelText(/meeting point/i), '   ');
    await userEvent.click(within(d).getByRole('button', { name: /save/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((await services.profiles.getDaySession(userId, 'mammoth', today()))!.meetingPoint).toBeUndefined();
  });

  it('"Not now" closes without saving, and the session can be opened again', async () => {
    const { services, userId } = await open('/m/mammoth');
    await screen.findByRole('dialog', { name: /today.s session/i });
    await userEvent.click(screen.getByRole('button', { name: /not now/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await services.profiles.getDaySession(userId, 'mammoth', today())).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /set today.s session|edit today.s session/i }));
    expect(await screen.findByRole('dialog', { name: /today.s session/i })).toBeInTheDocument();
  });

  it('Escape works like "Not now"', async () => {
    await open('/m/mammoth');
    await screen.findByRole('dialog', { name: /today.s session/i });
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not pop up again when today\'s session already exists', async () => {
    const services = makeServices();
    const { userId } = await seedUser(services, { profile: ONBOARDED });
    await services.profiles.saveDaySession({ userId, mountainId: 'mammoth', date: today(), challengeToday: 2, energy: 'tired', wantToday: [] });
    renderWithProviders(<AppRoutes />, { route: '/m/mammoth', services });
    expect(await screen.findByRole('heading', { name: /mammoth mountain/i })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText(/tired/i)).toBeInTheDocument();
  });

  it('editing today\'s session starts from the saved values', async () => {
    const services = makeServices();
    const { userId } = await seedUser(services, { profile: ONBOARDED });
    await services.profiles.saveDaySession({ userId, mountainId: 'mammoth', date: today(), challengeToday: 2, energy: 'tired', wantToday: [] });
    renderWithProviders(<AppRoutes />, { route: '/m/mammoth', services });
    await userEvent.click(await screen.findByRole('button', { name: /edit today.s session/i }));
    const d = await screen.findByRole('dialog', { name: /today.s session/i });
    expect(within(d).getByRole('slider', { name: /today.s challenge/i })).toHaveValue('2');
    expect(within(d).getByRole('radio', { name: /tired/i })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('mountain page', () => {
  it('summarizes what recommendations will use (allowed ratings from comfort)', async () => {
    await open('/m/mammoth', {
      terrainComfort: { green: 'comfortable', blue: 'cautious', black: 'avoid', doubleBlack: 'avoid' },
    });
    await userEvent.click(await screen.findByRole('button', { name: /not now/i }));
    const recs = screen.getByRole('region', { name: /recommended runs/i });
    expect(within(recs).getByText(/green, blue/i)).toBeInTheDocument();
    expect(within(recs).queryByText(/double black/i)).not.toBeInTheDocument();
  });

  it('links to the map for planning a route', async () => {
    await open('/m/mammoth');
    await userEvent.click(await screen.findByRole('button', { name: /not now/i }));
    await userEvent.click(screen.getByRole('link', { name: /plan a route/i }));
    await waitForPath('/m/mammoth/map');
    expect(await screen.findByRole('heading', { name: /map & route/i })).toBeInTheDocument();
  });

  it('handles an unknown mountain id', async () => {
    await open('/m/atlantis');
    expect(await screen.findByText(/couldn.t find that mountain/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: /find my mountain/i }));
    await waitForPath('/');
  });

  it('shows "coming soon" for a mountain without trail data and no session prompt', async () => {
    await open('/m/vail');
    expect(await screen.findByText(/trail data .*coming soon/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('the map page handles an unknown mountain too', async () => {
    await open('/m/atlantis/map');
    expect(await screen.findByText(/couldn.t find that mountain/i)).toBeInTheDocument();
  });
});

describe('Profile', () => {
  it('shows the skier card with the user\'s answers', async () => {
    await open('/profile');
    expect(await screen.findByRole('heading', { name: /your profile/i })).toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
  });

  it('edits a section in a dialog and saves it', async () => {
    const { stored } = await open('/profile');
    await userEvent.click(await screen.findByRole('button', { name: /edit terrain/i }));
    const d = await screen.findByRole('dialog', { name: /terrain you like or avoid/i });
    await userEvent.click(within(d).getByRole('button', { name: /groomers/i }));
    await userEvent.click(within(d).getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((await stored())!.terrainLikes).toEqual(['groomers']);
    expect(screen.getByText('Groomers')).toBeInTheDocument();
  });

  it('Cancel discards edits', async () => {
    const { stored } = await open('/profile');
    await userEvent.click(await screen.findByRole('button', { name: /edit about you/i }));
    const d = await screen.findByRole('dialog', { name: /about you/i });
    await userEvent.clear(within(d).getByLabelText('Your name'));
    await userEvent.type(within(d).getByLabelText('Your name'), 'Zed');
    await userEvent.click(within(d).getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect((await stored())!.displayName).toBe('Alex');
    expect(screen.getByText('Alex')).toBeInTheDocument();
  });

  it('validates edits the same way as onboarding', async () => {
    const { stored } = await open('/profile');
    await userEvent.click(await screen.findByRole('button', { name: /edit about you/i }));
    const d = await screen.findByRole('dialog', { name: /about you/i });
    await userEvent.clear(within(d).getByLabelText('Your name'));
    await userEvent.click(within(d).getByRole('button', { name: /^save$/i }));
    expect(within(d).getByLabelText('Your name')).toHaveAccessibleDescription(/enter your name/i);
    expect((await stored())!.displayName).toBe('Alex');
  });

  it('toggles showing skill level on reviews', async () => {
    const { stored } = await open('/profile');
    const sw = await screen.findByRole('switch', { name: /show my skill level on reviews/i });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(sw);
    await waitFor(() => expect(sw).toHaveAttribute('aria-checked', 'false'));
    expect((await stored())!.showSkillOnReviews).toBe(false);
  });

  it('sets the home mountain', async () => {
    const { stored } = await open('/profile');
    await userEvent.selectOptions(await screen.findByLabelText(/home mountain/i), 'mammoth');
    await waitFor(async () => expect((await stored())!.homeMountainId).toBe('mammoth'));
    await userEvent.selectOptions(screen.getByLabelText(/home mountain/i), '');
    await waitFor(async () => expect((await stored())!.homeMountainId).toBeNull());
  });

  it('signs out and returns to Welcome', async () => {
    const { services } = await open('/profile');
    await userEvent.click(await screen.findByRole('button', { name: /sign out/i }));
    await waitForPath('/welcome');
    expect(await services.auth.getSession()).toBeNull();
  });
});
