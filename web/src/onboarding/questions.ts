/**
 * All onboarding wording lives here so teammates can tweak copy without touching components.
 */
import type {
  AgeRange, Clarifier, ComfortLevel, ConditionKind, ConditionTolerance, DetailLevel, FallConcern,
  FlatsBother, Priority, Rating, Sport, TerrainType, UsualGroup,
} from '../models/profile';

export const STEP_IDS = ['about', 'ability', 'comfort', 'terrain', 'conditions', 'pace', 'experience', 'crew'] as const;
export type StepId = (typeof STEP_IDS)[number];

export const STEP_TITLES: Record<StepId, string> = {
  about: 'About you',
  ability: 'How do you ski?',
  comfort: 'Comfort by trail rating',
  terrain: 'Terrain you like or avoid',
  conditions: 'Conditions',
  pace: 'Pace and risk',
  experience: 'Your experience',
  crew: 'Your crew and priorities',
};

export const STEP_INTROS: Record<StepId, string> = {
  about: "Let's start with the basics.",
  ability: 'Ratings mean different things at different mountains, so pick what you actually do.',
  comfort: 'We filled this in from your last answer. Adjust anything that feels off.',
  terrain: 'Tap once to like, twice to avoid, three times to reset.',
  conditions: 'The same run can feel completely different depending on the snow.',
  pace: "Your usual mood on the mountain. You can change it any day with \"Today's session\".",
  experience: 'All optional. It helps us fine-tune suggestions.',
  crew: 'Who you ski with and what matters most on your day.',
};

/** Card summary section titles (used for "Edit …" buttons). */
export const SUMMARY_SECTIONS: Record<StepId, string> = {
  about: 'About you',
  ability: 'Ability',
  comfort: 'Comfort',
  terrain: 'Terrain',
  conditions: 'Conditions',
  pace: 'Pace and risk',
  experience: 'Experience',
  crew: 'Crew and priorities',
};

export const SPORT_QUESTION = 'Ski or snowboard?';
export const SPORT_OPTIONS: { value: Sport; label: string; icon: string }[] = [
  { value: 'ski', label: 'Ski', icon: '⛷' },
  { value: 'snowboard', label: 'Snowboard', icon: '🏂' },
  { value: 'both', label: 'Both', icon: '✌' },
];

export const FLATS_QUESTION = 'Do flat cat-tracks bother you?';
export const FLATS_OPTIONS: { value: FlatsBother; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'a_bit', label: 'A bit' },
  { value: 'no', label: 'No' },
];

export const ABILITY_QUESTION = 'Which sounds most like you?';
export const ABILITY_OPTIONS: { level: number; title: string; description: string; icon: string }[] = [
  { level: 1, title: "It's my first day (or close to it)", description: 'Still learning to stop and turn.', icon: '🌱' },
  { level: 2, title: 'Linking turns on greens', description: 'Comfortable on gentle slopes, working up to blues.', icon: '●' },
  { level: 3, title: 'Comfortable on most blues', description: 'Can handle most groomed blue runs.', icon: '■' },
  { level: 4, title: 'Confident on blacks', description: 'Steeper pitches and some bumps are fine.', icon: '◆' },
  { level: 5, title: 'Steeps, chutes and double blacks', description: 'Bring on the hardest terrain.', icon: '◆◆' },
];

export const CLARIFIER_QUESTION = 'On a steep, icy blue you usually…';
export const CLARIFIER_OPTIONS: { value: Clarifier; label: string }[] = [
  { value: 'carve', label: 'Carve clean turns' },
  { value: 'skid', label: 'Skid turns to control speed' },
  { value: 'sideslip', label: 'Sideslip parts of it' },
];

export const RATING_LABELS: Record<Rating, { label: string; symbol: string }> = {
  green: { label: 'Green', symbol: '●' },
  blue: { label: 'Blue', symbol: '■' },
  black: { label: 'Black', symbol: '◆' },
  doubleBlack: { label: 'Double black', symbol: '◆◆' },
};

export const COMFORT_OPTIONS: { value: ComfortLevel; label: string }[] = [
  { value: 'avoid', label: 'Avoid' },
  { value: 'cautious', label: 'Cautious' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'love', label: 'Love' },
];

export const TERRAIN_LABELS: Record<TerrainType, string> = {
  groomers: 'Groomers',
  moguls: 'Moguls',
  trees: 'Trees & glades',
  park: 'Terrain park',
  steeps: 'Steeps',
};
export const TERRAIN_NOTE = "Terrain park picks are saved, but our trail data doesn't include parks yet.";

export const CONDITION_LABELS: Record<ConditionKind, string> = {
  ice: 'Ice / hardpack',
  powder: 'Deep powder',
  slush: 'Slush',
  flatLight: 'Flat light',
};
export const CONDITION_OPTIONS: { value: ConditionTolerance; label: string }[] = [
  { value: 'avoid', label: 'Avoid' },
  { value: 'manageable', label: 'Manageable' },
  { value: 'comfortable', label: 'Comfortable' },
];

export const CHALLENGE_LABEL = 'Challenge level';
export const CHALLENGE_ENDS = { min: 'Keep it mellow', max: 'Push me' };
export const CHALLENGE_TEXT: Record<number, string> = {
  1: 'Keep it mellow',
  2: 'Mostly cruising',
  3: 'A little challenge',
  4: 'Push me a bit',
  5: 'Push me',
};

export const FALL_QUESTION = 'How much do falls worry you?';
export const FALL_OPTIONS: { value: FallConcern; label: string }[] = [
  { value: 'low', label: 'Not much' },
  { value: 'medium', label: 'Somewhat' },
  { value: 'high', label: 'A lot' },
];

export const AGE_LABELS: Record<AgeRange, string> = {
  under_18: 'Under 18',
  '18_24': '18–24',
  '25_34': '25–34',
  '35_49': '35–49',
  '50_64': '50–64',
  '65_plus': '65+',
};

export const DETAIL_QUESTION = 'How much detail do you want?';
export const DETAIL_OPTIONS: { value: DetailLevel; title: string; description: string }[] = [
  { value: 'simple', title: 'Just tell me what fits', description: 'Plain-language reasons for each suggestion.' },
  { value: 'detailed', title: 'Show me the numbers', description: 'Also show grade, vertical and official ratings.' },
];

export const GROUP_QUESTION = 'Who do you usually ski with?';
export const GROUP_OPTIONS: { value: UsualGroup; label: string }[] = [
  { value: 'solo', label: 'Solo' },
  { value: 'same_level', label: 'Friends at my level' },
  { value: 'mixed_ability', label: 'Mixed-ability group' },
  { value: 'family_kids', label: 'Family with kids' },
];

export const PRIORITY_QUESTION = 'What matters most?';
export const PRIORITY_OPTIONS: { value: Priority; title: string; description: string }[] = [
  { value: 'avoid_lines', title: 'Avoiding lift lines', description: 'Prefer less-crowded lifts.' },
  { value: 'most_skiing_per_ride', title: 'Most skiing per lift ride', description: 'Long runs and big vertical.' },
  { value: 'variety', title: 'Variety', description: 'New runs over repeats.' },
];

export const ERRORS = {
  nameRequired: 'Enter your name.',
  nameTooLong: 'Keep it to 60 characters or fewer.',
  sportRequired: 'Choose ski, snowboard or both.',
  abilityRequired: 'Pick the one that sounds most like you.',
  years: 'Enter a number between 0 and 100.',
  days: 'Enter a number between 0 and 365.',
  allAvoided: "Heads up: if you avoid every rating, we won't be able to suggest any runs.",
};
