import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRoutes } from '../App';
import { renderWithProviders, makeServices, seedUser, ONBOARDED } from '../test/utils';
import { stubBackend } from '../test/fakeBackend';
import { localDateKey } from '../models/profile';
import type { ProfilePatch } from '../services/profile/types';

// MapLibre needs WebGL, which jsdom lacks; the page logic is what's under test here.
vi.mock('../components/TrailMap', () => ({
  TrailMap: ({ route, onPick }: { route: unknown; onPick: (w: string, f: object) => void }) => (
    <div data-testid="trail-map" data-has-route={String(!!route)}>
      <button type="button" onClick={() => onPick('from', { id: 'lift-23', name: 'Chair 23', kind: 'lift', difficulty: null })}>
        map: start at Chair 23
      </button>
    </div>
  ),
}));

const COMFORT_BLUE: ProfilePatch = {
  terrainComfort: { green: 'comfortable', blue: 'cautious', black: 'avoid', doubleBlack: 'avoid' },
};

async function openMap(patch: ProfilePatch = {}) {
  const services = makeServices();
  const { userId } = await seedUser(services, { profile: { ...ONBOARDED, ...patch } });
  renderWithProviders(<AppRoutes />, { route: '/m/mammoth/map', services });
  return { services, userId };
}

async function pick(label: RegExp, query: string, option: RegExp) {
  await userEvent.type(screen.getByLabelText(label), query);
  await userEvent.click(await screen.findByRole('button', { name: option }));
}

describe('Map & route page', () => {
  it('explains how to start the backend when it is not running', async () => {
    await openMap();
    expect(await screen.findByRole('alert')).toHaveTextContent(/can.t reach the trail server/i);
  });

  it('pre-selects allowed trails from the profile comfort ratings', async () => {
    stubBackend();
    await openMap(COMFORT_BLUE);
    await screen.findByTestId('trail-map');
    expect(screen.getByRole('checkbox', { name: 'Green' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Blue' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Black' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Unrated' })).not.toBeChecked();
  });

  it('plans a route from search picks and shows the summary', async () => {
    const fetchMock = stubBackend();
    await openMap(COMFORT_BLUE);
    await screen.findByTestId('trail-map');
    const go = screen.getByRole('button', { name: /get route/i });
    expect(go).toBeDisabled();
    await pick(/^from$/i, 'chair', /chair 23/i);
    await pick(/^to$/i, 'broad', /broadway/i);
    await userEvent.click(go);
    expect(await screen.findByText(/1\.2 km skiing · 0\.8 km on lifts \(chair 23\)/i)).toBeInTheDocument();
    expect(screen.getByTestId('trail-map')).toHaveAttribute('data-has-route', 'true');
    const post = fetchMock.mock.calls.find(([url]) => url.endsWith('/routes'))!;
    expect(JSON.parse(post[1]!.body as string)).toEqual({
      start: { feature_id: 'lift-23' }, destination: { feature_id: 'run-broadway' }, allow: ['green', 'blue'], include_unknown: false,
    });
  });

  it('accepts a start picked on the map', async () => {
    stubBackend();
    await openMap();
    await userEvent.click(await screen.findByRole('button', { name: /map: start at chair 23/i }));
    expect(screen.getByLabelText(/^from$/i)).toHaveValue('Chair 23');
  });

  it('explains an unreachable route', async () => {
    stubBackend({ status: 'unreachable', message: 'x', total_trail_distance_m: 0, total_lift_distance_m: 0,
      total_connector_distance_m: 0, lifts_used: [], geojson: { type: 'FeatureCollection', features: [] } });
    await openMap();
    await screen.findByTestId('trail-map');
    await pick(/^from$/i, 'chair', /chair 23/i);
    await pick(/^to$/i, 'broad', /broadway/i);
    await userEvent.click(screen.getByRole('button', { name: /get route/i }));
    expect(await screen.findByText(/no connected route/i)).toBeInTheDocument();
    expect(screen.getByTestId('trail-map')).toHaveAttribute('data-has-route', 'false');
  });

  it('uses today\'s picked meeting point as the destination', async () => {
    stubBackend();
    const services = makeServices();
    const { userId } = await seedUser(services, { profile: ONBOARDED });
    await services.profiles.saveDaySession({
      userId, mountainId: 'mammoth', date: localDateKey(new Date()), challengeToday: 3, energy: 'ok', wantToday: [],
      meetingPoint: { name: 'Broadway', featureId: 'run-broadway' },
    });
    renderWithProviders(<AppRoutes />, { route: '/m/mammoth/map', services });
    await waitFor(() => expect(screen.getByLabelText(/^to$/i)).toHaveValue('Broadway'));
  });
});

describe('live resort data', () => {
  it('saves a meeting point picked from the trail search with its feature id', async () => {
    stubBackend();
    const services = makeServices();
    const { userId } = await seedUser(services, { profile: ONBOARDED });
    renderWithProviders(<AppRoutes />, { route: '/m/mammoth', services });
    const d = await screen.findByRole('dialog', { name: /today.s session/i });
    await userEvent.type(within(d).getByLabelText(/meeting point/i), 'chair');
    await userEvent.click(await within(d).findByRole('button', { name: /chair 23/i }));
    await userEvent.click(within(d).getByRole('button', { name: /save/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((await services.profiles.getDaySession(userId, 'mammoth', localDateKey(new Date())))!.meetingPoint)
      .toEqual({ name: 'Chair 23', featureId: 'lift-23' });
  });

  it('typing after a pick drops the feature id', async () => {
    stubBackend();
    const services = makeServices();
    const { userId } = await seedUser(services, { profile: ONBOARDED });
    renderWithProviders(<AppRoutes />, { route: '/m/mammoth', services });
    const d = await screen.findByRole('dialog', { name: /today.s session/i });
    const field = within(d).getByLabelText(/meeting point/i);
    await userEvent.type(field, 'chair');
    await userEvent.click(await within(d).findByRole('button', { name: /chair 23/i }));
    await userEvent.type(field, ' at noon');
    await userEvent.click(within(d).getByRole('button', { name: /save/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((await services.profiles.getDaySession(userId, 'mammoth', localDateKey(new Date())))!.meetingPoint)
      .toEqual({ name: 'Chair 23 at noon' });
  });
});
