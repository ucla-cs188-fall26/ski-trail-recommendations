import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRoutes } from '../App';
import { renderWithProviders, makeServices, seedUser, type Services } from '../test/utils';
import { computeAbilityScore } from '../models/profile';
import type { ProfilePatch } from '../services/profile/types';

const dialog = (name: RegExp | string) => screen.findByRole('dialog', { name });
const click = (name: RegExp | string) => userEvent.click(screen.getByRole('button', { name }));
const next = () => click(/^next$/i);
const radioIn = (group: RegExp | string, option: RegExp | string) =>
  within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', { name: option });

async function start(patch?: ProfilePatch, services: Services = makeServices()) {
  const { userId } = await seedUser(services, { profile: patch });
  const utils = renderWithProviders(<AppRoutes />, { route: '/onboarding', services });
  const stored = () => services.profiles.getProfile(userId);
  return { ...utils, services, userId, stored };
}

async function doStep1(name = 'Alex', sport: RegExp = /^ski$/i) {
  await dialog('About you');
  await userEvent.type(screen.getByLabelText('Your name'), name);
  await userEvent.click(radioIn(/ski or snowboard/i, sport));
  await next();
}

async function doStep2(level: RegExp = /most blues/i, clarifier?: RegExp) {
  await dialog(/how do you ski/i);
  await userEvent.click(screen.getByRole('radio', { name: level }));
  if (clarifier) await userEvent.click(radioIn(/steep, icy blue/i, clarifier));
  await next();
}

const AFTER_STEP_2: ProfilePatch = {
  displayName: 'Alex', sport: 'ski', abilityLevel: 3, abilityScore: 5, onboardingStep: 2,
};

describe('onboarding: step 1 (About you)', () => {
  it('opens as a modal card showing step 1 of 8', async () => {
    await start();
    await dialog('About you');
    expect(screen.getByRole('progressbar')).toHaveAccessibleName(/step 1 of 8/i);
  });

  it('is required: no Skip, and Next validates name and sport', async () => {
    await start();
    await dialog('About you');
    expect(screen.queryByRole('button', { name: /skip/i })).not.toBeInTheDocument();
    await next();
    expect(screen.getByLabelText('Your name')).toHaveAccessibleDescription(/enter your name/i);
    expect(screen.getByText(/choose ski, snowboard or both/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'About you' })).toBeInTheDocument();
  });

  it('rejects a whitespace-only name and an over-long one', async () => {
    await start();
    await dialog('About you');
    await userEvent.type(screen.getByLabelText('Your name'), '   ');
    await userEvent.click(radioIn(/ski or snowboard/i, /^ski$/i));
    await next();
    expect(screen.getByLabelText('Your name')).toHaveAccessibleDescription(/enter your name/i);
    await userEvent.clear(screen.getByLabelText('Your name'));
    await userEvent.type(screen.getByLabelText('Your name'), 'x'.repeat(61));
    await next();
    expect(screen.getByLabelText('Your name')).toHaveAccessibleDescription(/60 characters/i);
  });

  it('saves the answers and moves to the ability step', async () => {
    const { stored } = await start();
    await doStep1('  Alex  ');
    await dialog(/how do you ski/i);
    const p = await stored();
    expect(p).toMatchObject({ displayName: 'Alex', sport: 'ski', onboardingStep: 1 });
  });

  it('asks snowboarders about flat cat-tracks, but not skiers', async () => {
    const { stored } = await start();
    await dialog('About you');
    expect(screen.queryByRole('radiogroup', { name: /flat cat-tracks/i })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Your name'), 'Sam');
    await userEvent.click(radioIn(/ski or snowboard/i, /snowboard/i));
    await userEvent.click(radioIn(/flat cat-tracks/i, /a bit/i));
    await next();
    await dialog(/how do you ski/i);
    expect((await stored())!.flatsBother).toBe('a_bit');
  });

  it('clears the flats answer if the user switches back to skiing', async () => {
    const { stored } = await start();
    await dialog('About you');
    await userEvent.type(screen.getByLabelText('Your name'), 'Sam');
    await userEvent.click(radioIn(/ski or snowboard/i, /snowboard/i));
    await userEvent.click(radioIn(/flat cat-tracks/i, /^yes$/i));
    await userEvent.click(radioIn(/ski or snowboard/i, /^ski$/i));
    await next();
    await dialog(/how do you ski/i);
    expect((await stored())!.flatsBother).toBeNull();
  });

  it('ignores Escape on required steps', async () => {
    await start();
    await dialog('About you');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'About you' })).toBeInTheDocument();
  });
});

describe('onboarding: step 2 (ability + clarifier)', () => {
  it('describes behaviors instead of labels and is required', async () => {
    await start();
    await doStep1();
    await dialog(/how do you ski/i);
    expect(screen.getAllByRole('radio').length).toBeGreaterThanOrEqual(5);
    expect(screen.queryByText(/^intermediate$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /skip/i })).not.toBeInTheDocument();
    await next();
    expect(screen.getByText(/pick the one that sounds most like you/i)).toBeInTheDocument();
  });

  it('asks the clarifier for middle levels and uses it to refine the score', async () => {
    const { stored } = await start();
    await doStep1();
    await doStep2(/most blues/i, /carve/i);
    await dialog(/comfort by trail rating/i);
    const p = await stored();
    expect(p!.abilityLevel).toBe(3);
    expect(p!.abilityClarifier).toBe('carve');
    expect(p!.abilityScore).toBe(computeAbilityScore({ abilityLevel: 3, clarifier: 'carve' }));
  });

  it('does not ask the clarifier for first-timers or experts', async () => {
    await start();
    await doStep1();
    await dialog(/how do you ski/i);
    await userEvent.click(screen.getByRole('radio', { name: /first day/i }));
    expect(screen.queryByRole('radiogroup', { name: /steep, icy blue/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /steeps, chutes/i }));
    expect(screen.queryByRole('radiogroup', { name: /steep, icy blue/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /linking turns/i }));
    expect(screen.getByRole('radiogroup', { name: /steep, icy blue/i })).toBeInTheDocument();
  });

  it('lets the clarifier be left unanswered', async () => {
    const { stored } = await start();
    await doStep1();
    await doStep2(/confident on blacks/i);
    await dialog(/comfort by trail rating/i);
    expect((await stored())!.abilityClarifier).toBeNull();
  });
});

describe('onboarding: step 3 (comfort by rating)', () => {
  it('is prefilled from the ability answer', async () => {
    await start();
    await doStep1();
    await doStep2(/first day/i);
    await dialog(/comfort by trail rating/i);
    expect(radioIn(/^blue/i, /^avoid$/i)).toHaveAttribute('aria-checked', 'true');
    expect(radioIn(/double black/i, /^avoid$/i)).toHaveAttribute('aria-checked', 'true');
    expect(radioIn(/^green/i, /^avoid$/i)).toHaveAttribute('aria-checked', 'false');
  });

  it('re-derives when the user goes back and changes their ability', async () => {
    await start();
    await doStep1();
    await doStep2(/first day/i);
    await dialog(/comfort by trail rating/i);
    await click(/^back$/i);
    await dialog(/how do you ski/i);
    await userEvent.click(screen.getByRole('radio', { name: /steeps, chutes/i }));
    await next();
    await dialog(/comfort by trail rating/i);
    expect(radioIn(/double black/i, /comfortable/i)).toHaveAttribute('aria-checked', 'true');
  });

  it('saves user adjustments', async () => {
    const { stored } = await start(AFTER_STEP_2);
    await dialog(/comfort by trail rating/i);
    await userEvent.click(radioIn(/^black/i, /^love$/i));
    await next();
    await dialog(/terrain you like or avoid/i);
    expect((await stored())!.terrainComfort.black).toBe('love');
  });

  it('warns but allows avoiding every rating', async () => {
    await start(AFTER_STEP_2);
    await dialog(/comfort by trail rating/i);
    for (const r of [/^green/i, /^blue/i, /^black/i, /double black/i]) await userEvent.click(radioIn(r, /^avoid$/i));
    expect(screen.getByText(/we won.t be able to suggest any runs/i)).toBeInTheDocument();
  });

  it('is skippable and Escape skips it too', async () => {
    await start(AFTER_STEP_2);
    await dialog(/comfort by trail rating/i);
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await dialog(/terrain you like or avoid/i);
  });
});

describe('onboarding: step 4 (terrain chips)', () => {
  it('cycles chips and saves likes and avoids', async () => {
    const { stored } = await start({ ...AFTER_STEP_2, onboardingStep: 3 });
    await dialog(/terrain you like or avoid/i);
    expect(screen.queryByRole('button', { name: /powder/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /trees/i }));
    await userEvent.click(screen.getByRole('button', { name: /moguls/i }));
    await userEvent.click(screen.getByRole('button', { name: /moguls/i }));
    await next();
    await dialog(/conditions/i);
    const p = await stored();
    expect(p!.terrainLikes).toEqual(['trees']);
    expect(p!.terrainAvoids).toEqual(['moguls']);
  });

  it('Skip moves on without saving changes', async () => {
    const { stored } = await start({ ...AFTER_STEP_2, onboardingStep: 3 });
    await dialog(/terrain you like or avoid/i);
    await userEvent.click(screen.getByRole('button', { name: /trees/i }));
    await click(/skip/i);
    await dialog(/conditions/i);
    const p = await stored();
    expect(p!.terrainLikes).toEqual([]);
    expect(p!.onboardingStep).toBe(4);
  });
});

describe('onboarding: steps 5–6', () => {
  it('saves condition tolerances', async () => {
    const { stored } = await start({ ...AFTER_STEP_2, onboardingStep: 4 });
    await dialog(/conditions/i);
    await userEvent.click(radioIn(/ice/i, /^avoid$/i));
    await userEvent.click(radioIn(/powder/i, /comfortable/i));
    await next();
    await dialog(/pace and risk/i);
    expect((await stored())!.conditions).toMatchObject({ ice: 'avoid', powder: 'comfortable' });
  });

  it('saves challenge appetite and fall concern', async () => {
    const { stored } = await start({ ...AFTER_STEP_2, onboardingStep: 5 });
    await dialog(/pace and risk/i);
    const slider = screen.getByRole('slider', { name: /challenge/i });
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(slider, { target: { value: '5' } });
    await userEvent.click(radioIn(/falls worry you/i, /a lot/i));
    await next();
    await dialog(/your experience/i);
    expect(await stored()).toMatchObject({ challengeAppetite: 5, fallConcern: 'high' });
  });
});

describe('onboarding: step 7 (experience)', () => {
  it('saves optional experience, familiar mountains and detail level, and suggests a home mountain', async () => {
    const { stored } = await start({ ...AFTER_STEP_2, onboardingStep: 6 });
    await dialog(/your experience/i);
    await userEvent.type(screen.getByLabelText(/years skiing/i), '4');
    await userEvent.type(screen.getByLabelText(/days per season/i), '6');
    await userEvent.type(screen.getByLabelText(/search mountains/i), 'mamm');
    await userEvent.click(screen.getByRole('checkbox', { name: /mammoth/i }));
    await userEvent.click(radioIn(/how much detail/i, /show me the numbers/i));
    await next();
    await dialog(/crew and priorities/i);
    expect(await stored()).toMatchObject({
      yearsExperience: 4, daysPerSeason: 6, familiarMountainIds: ['mammoth'],
      homeMountainId: 'mammoth', detailLevel: 'detailed',
    });
  });

  it('filters the mountain list by search and shows an empty state', async () => {
    await start({ ...AFTER_STEP_2, onboardingStep: 6 });
    await dialog(/your experience/i);
    await userEvent.type(screen.getByLabelText(/search mountains/i), 'zzzz');
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByText(/no mountains match/i)).toBeInTheDocument();
  });

  it('rejects impossible numbers', async () => {
    await start({ ...AFTER_STEP_2, onboardingStep: 6 });
    await dialog(/your experience/i);
    await userEvent.type(screen.getByLabelText(/days per season/i), '400');
    await next();
    expect(screen.getByLabelText(/days per season/i)).toHaveAccessibleDescription(/0 and 365/i);
    expect(screen.getByRole('dialog', { name: /your experience/i })).toBeInTheDocument();
  });

  it('uses days per season to refine ability when the clarifier was skipped', async () => {
    const { stored } = await start({ ...AFTER_STEP_2, abilityClarifier: null, onboardingStep: 6 });
    await dialog(/your experience/i);
    await userEvent.type(screen.getByLabelText(/days per season/i), '40');
    await next();
    await dialog(/crew and priorities/i);
    expect((await stored())!.abilityScore).toBe(computeAbilityScore({ abilityLevel: 3, daysPerSeason: 40 }));
  });
});

describe('onboarding: step 8 and the skier card', () => {
  it('saves crew and priorities, then shows the skier card', async () => {
    const { stored } = await start({ ...AFTER_STEP_2, onboardingStep: 7 });
    await dialog(/crew and priorities/i);
    expect(screen.queryByRole('checkbox', { name: /scenery/i })).not.toBeInTheDocument();
    await userEvent.click(radioIn(/who do you usually ski with/i, /mixed-ability/i));
    await userEvent.click(screen.getByRole('checkbox', { name: /lift lines/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /variety/i }));
    await next();
    await dialog(/your skier card/i);
    expect(await stored()).toMatchObject({ usualGroup: 'mixed_ability', priorities: ['avoid_lines', 'variety'] });
  });

  it('summarizes answers with edit links that jump back to a step', async () => {
    await start({ ...AFTER_STEP_2, onboardingStep: 8 });
    const card = await dialog(/your skier card/i);
    expect(within(card).getByText('Alex')).toBeInTheDocument();
    expect(within(card).getByText(/comfortable on most blues/i)).toBeInTheDocument();
    await userEvent.click(within(card).getByRole('button', { name: /edit terrain/i }));
    await dialog(/terrain you like or avoid/i);
  });

  it('"Hit the slopes" completes onboarding and opens Find my mountain', async () => {
    const { stored } = await start({ ...AFTER_STEP_2, onboardingStep: 8 });
    await dialog(/your skier card/i);
    await click(/hit the slopes/i);
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/'));
    expect((await stored())!.onboardingComplete).toBe(true);
  });
});

describe('onboarding: navigation and resume', () => {
  it('Back keeps earlier answers', async () => {
    await start();
    await doStep1('Alex');
    await dialog(/how do you ski/i);
    await click(/^back$/i);
    await dialog('About you');
    expect(screen.getByLabelText('Your name')).toHaveValue('Alex');
    expect(radioIn(/ski or snowboard/i, /^ski$/i)).toHaveAttribute('aria-checked', 'true');
  });

  it('resumes where the user left off after a reload', async () => {
    const services = makeServices();
    const { userId } = await seedUser(services);
    const first = renderWithProviders(<AppRoutes />, { route: '/onboarding', services });
    await doStep1('Alex');
    await doStep2(/most blues/i, /skid/i);
    await dialog(/comfort by trail rating/i);
    first.unmount();

    renderWithProviders(<AppRoutes />, { route: '/onboarding', services });
    await dialog(/comfort by trail rating/i);
    expect(screen.getByRole('progressbar')).toHaveAccessibleName(/step 3 of 8/i);
    expect((await services.profiles.getProfile(userId))!.displayName).toBe('Alex');
  });

  it('skipping every optional step still reaches the skier card', async () => {
    await start(AFTER_STEP_2);
    for (const title of [/comfort by trail rating/i, /terrain you like/i, /conditions/i, /pace and risk/i, /your experience/i, /crew and priorities/i]) {
      await dialog(title);
      await click(/skip/i);
    }
    await dialog(/your skier card/i);
  });
});
