import type { ComponentType } from 'react';
import { DISPLAY_NAME_MAX, computeAbilityScore, type SkierProfile } from '../models/profile';
import type { ProfilePatch } from '../services/profile/types';
import { ERRORS, STEP_IDS, type StepId } from './questions';
import type { StepErrors, StepProps } from './steps/types';
import { AboutStep } from './steps/AboutStep';
import { AbilityStep } from './steps/AbilityStep';
import { ComfortStep } from './steps/ComfortStep';
import { TerrainStep } from './steps/TerrainStep';
import { ConditionsStep } from './steps/ConditionsStep';
import { PaceStep } from './steps/PaceStep';
import { ExperienceStep } from './steps/ExperienceStep';
import { CrewStep } from './steps/CrewStep';

export interface StepDef {
  id: StepId;
  required: boolean;
  Component: ComponentType<StepProps>;
  validate: (d: SkierProfile) => StepErrors;
  /** The fields this step owns, as they should be saved. */
  toPatch: (d: SkierProfile) => ProfilePatch;
}

const none = () => ({});
const outOfRange = (n: number | null, lo: number, hi: number) => n != null && !(Number.isInteger(n) && n >= lo && n <= hi);

const DEFS: Record<StepId, Omit<StepDef, 'id'>> = {
  about: {
    required: true,
    Component: AboutStep,
    validate: (d) => {
      const e: StepErrors = {};
      const name = d.displayName.trim();
      if (!name) e.displayName = ERRORS.nameRequired;
      else if (name.length > DISPLAY_NAME_MAX) e.displayName = ERRORS.nameTooLong;
      if (!d.sport) e.sport = ERRORS.sportRequired;
      return e;
    },
    toPatch: (d) => ({
      displayName: d.displayName.trim(),
      sport: d.sport,
      flatsBother: d.sport === 'ski' ? null : d.flatsBother,
    }),
  },
  ability: {
    required: true,
    Component: AbilityStep,
    validate: (d): StepErrors => (d.abilityLevel == null ? { abilityLevel: ERRORS.abilityRequired } : {}),
    toPatch: (d) => ({
      abilityLevel: d.abilityLevel,
      abilityClarifier: d.abilityClarifier,
      abilityScore: d.abilityScore,
      terrainComfort: d.terrainComfort,
    }),
  },
  comfort: { required: false, Component: ComfortStep, validate: none, toPatch: (d) => ({ terrainComfort: d.terrainComfort }) },
  terrain: {
    required: false,
    Component: TerrainStep,
    validate: none,
    toPatch: (d) => ({ terrainLikes: d.terrainLikes, terrainAvoids: d.terrainAvoids }),
  },
  conditions: { required: false, Component: ConditionsStep, validate: none, toPatch: (d) => ({ conditions: d.conditions }) },
  pace: {
    required: false,
    Component: PaceStep,
    validate: none,
    toPatch: (d) => ({ challengeAppetite: d.challengeAppetite, fallConcern: d.fallConcern }),
  },
  experience: {
    required: false,
    Component: ExperienceStep,
    validate: (d) => {
      const e: StepErrors = {};
      if (outOfRange(d.yearsExperience, 0, 100)) e.yearsExperience = ERRORS.years;
      if (outOfRange(d.daysPerSeason, 0, 365)) e.daysPerSeason = ERRORS.days;
      return e;
    },
    toPatch: (d) => ({
      yearsExperience: d.yearsExperience,
      daysPerSeason: d.daysPerSeason,
      ageRange: d.ageRange,
      familiarMountainIds: d.familiarMountainIds,
      detailLevel: d.detailLevel,
      homeMountainId: d.homeMountainId ?? d.familiarMountainIds[0] ?? null,
      abilityScore: d.abilityLevel != null
        ? computeAbilityScore({ abilityLevel: d.abilityLevel, clarifier: d.abilityClarifier, daysPerSeason: d.daysPerSeason })
        : d.abilityScore,
    }),
  },
  crew: {
    required: false,
    Component: CrewStep,
    validate: none,
    toPatch: (d) => ({ usualGroup: d.usualGroup, priorities: d.priorities }),
  },
};

export const STEPS: StepDef[] = STEP_IDS.map((id) => ({ id, ...DEFS[id] }));
export const STEP_COUNT = STEPS.length;
