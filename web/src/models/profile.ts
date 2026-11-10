/**
 * Skier profile + per-day session model.
 *
 * Field ↔ routing mapping lives in docs/sign-in-flow-plan.md ("Profile → routing mapping").
 * Ratings map to OpenSkiMap `difficulty` values on runs in data/processed/mammoth_runs.geojson.
 */

export type Sport = 'ski' | 'snowboard' | 'both';
export type Rating = 'green' | 'blue' | 'black' | 'doubleBlack';
export type ComfortLevel = 'avoid' | 'cautious' | 'comfortable' | 'love';
export type TerrainType = 'groomers' | 'moguls' | 'trees' | 'park' | 'steeps';
export type ConditionKind = 'ice' | 'powder' | 'slush' | 'flatLight';
export type ConditionTolerance = 'avoid' | 'manageable' | 'comfortable';
export type FallConcern = 'low' | 'medium' | 'high';
export type FlatsBother = 'yes' | 'a_bit' | 'no';
export type Clarifier = 'carve' | 'skid' | 'sideslip';
export type UsualGroup = 'solo' | 'same_level' | 'mixed_ability' | 'family_kids';
export type Priority = 'avoid_lines' | 'most_skiing_per_ride' | 'variety';
export type DetailLevel = 'simple' | 'detailed';
export type AgeRange = 'under_18' | '18_24' | '25_34' | '35_49' | '50_64' | '65_plus';
export type Energy = 'fresh' | 'ok' | 'tired';

export const RATINGS: readonly Rating[] = ['green', 'blue', 'black', 'doubleBlack'];
export const COMFORT_LEVELS: readonly ComfortLevel[] = ['avoid', 'cautious', 'comfortable', 'love'];
export const TERRAIN_TYPES: readonly TerrainType[] = ['groomers', 'moguls', 'trees', 'park', 'steeps'];
export const CONDITION_KINDS: readonly ConditionKind[] = ['ice', 'powder', 'slush', 'flatLight'];
export const CONDITION_TOLERANCES: readonly ConditionTolerance[] = ['avoid', 'manageable', 'comfortable'];
export const PRIORITIES: readonly Priority[] = ['avoid_lines', 'most_skiing_per_ride', 'variety'];
export const AGE_RANGES: readonly AgeRange[] = ['under_18', '18_24', '25_34', '35_49', '50_64', '65_plus'];

export type TerrainComfort = Record<Rating, ComfortLevel>;
export type ConditionPrefs = Record<ConditionKind, ConditionTolerance>;

export const DISPLAY_NAME_MAX = 60;

export interface SkierProfile {
  userId: string;
  email: string;
  displayName: string;
  sport: Sport | null;
  /** Snowboard/both only: how much flat cat-tracks bother the rider. */
  flatsBother: FlatsBother | null;
  /** Behavior-anchored ability answer, 1 (first day) .. 5 (steeps, chutes). */
  abilityLevel: number | null;
  abilityClarifier: Clarifier | null;
  /** Refined ability 1..10 (see computeAbilityScore). */
  abilityScore: number | null;
  terrainComfort: TerrainComfort;
  terrainLikes: TerrainType[];
  terrainAvoids: TerrainType[];
  conditions: ConditionPrefs;
  /** Baseline "keep it mellow" (1) ↔ "push me" (5). DaySession.challengeToday overrides. */
  challengeAppetite: number;
  fallConcern: FallConcern;
  yearsExperience: number | null;
  daysPerSeason: number | null;
  ageRange: AgeRange | null;
  familiarMountainIds: string[];
  homeMountainId: string | null;
  recentMountainIds: string[];
  usualGroup: UsualGroup | null;
  priorities: Priority[];
  detailLevel: DetailLevel;
  showSkillOnReviews: boolean;
  onboardingComplete: boolean;
  onboardingStep: number;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingPoint {
  name: string;
  coordinate?: [number, number];
  time?: string;
}

export interface DaySession {
  userId: string;
  mountainId: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  challengeToday: number;
  energy: Energy;
  wantToday: TerrainType[];
  meetingPoint?: MeetingPoint;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function createDefaultProfile(userId: string, email: string, now: Date = new Date()): SkierProfile {
  const ts = now.toISOString();
  return {
    userId,
    email,
    displayName: '',
    sport: null,
    flatsBother: null,
    abilityLevel: null,
    abilityClarifier: null,
    abilityScore: null,
    terrainComfort: deriveTerrainComfort(3),
    terrainLikes: [],
    terrainAvoids: [],
    conditions: { ice: 'manageable', powder: 'manageable', slush: 'manageable', flatLight: 'manageable' },
    challengeAppetite: 3,
    fallConcern: 'medium',
    yearsExperience: null,
    daysPerSeason: null,
    ageRange: null,
    familiarMountainIds: [],
    homeMountainId: null,
    recentMountainIds: [],
    usualGroup: null,
    priorities: [],
    detailLevel: 'simple',
    showSkillOnReviews: true,
    onboardingComplete: false,
    onboardingStep: 0,
    createdAt: ts,
    updatedAt: ts,
  };
}

// ---------- Ability ----------

/** Ability levels 2–4 are ambiguous, so the Tisane-style clarifier is asked for them. */
export function needsClarifier(abilityLevel: number): boolean {
  const level = clamp(Math.round(abilityLevel), 1, 5);
  return level >= 2 && level <= 4;
}

const LEVEL_BASE: Record<number, number> = { 1: 1, 2: 3, 3: 5, 4: 7, 5: 10 };
const CLARIFIER_DELTA: Record<Clarifier, number> = { carve: 1, skid: 0, sideslip: -1 };

export function computeAbilityScore(input: {
  abilityLevel: number;
  clarifier?: Clarifier | null;
  daysPerSeason?: number | null;
}): number {
  const level = clamp(Math.round(Number.isFinite(input.abilityLevel) ? input.abilityLevel : 1), 1, 5);
  let score = LEVEL_BASE[level];
  if (needsClarifier(level)) {
    if (input.clarifier) {
      score += CLARIFIER_DELTA[input.clarifier];
    } else if (input.daysPerSeason != null && Number.isFinite(input.daysPerSeason)) {
      // Weak prior only when the clarifier was skipped.
      if (input.daysPerSeason >= 15) score += 1;
      else if (input.daysPerSeason <= 3) score -= 1;
    }
  }
  return clamp(score, 1, 10);
}

/** Per-rating comfort implied by an ability score. Users adjust it in onboarding step 3. */
export function deriveTerrainComfort(abilityScore: number): TerrainComfort {
  const s = clamp(Math.round(Number.isFinite(abilityScore) ? abilityScore : 1), 1, 10);
  const level = (cautiousFrom: number, comfortableFrom: number): ComfortLevel =>
    s >= comfortableFrom ? 'comfortable' : s >= cautiousFrom ? 'cautious' : 'avoid';
  return {
    green: level(1, 2),
    blue: level(3, 5),
    black: level(5, 7),
    doubleBlack: level(7, 9),
  };
}

// ---------- Ratings ----------

/** OpenSkiMap difficulty → piste rating. Unknown/missing → null. */
export function difficultyToRating(difficulty: string | null | undefined): Rating | null {
  switch (difficulty) {
    case 'novice':
    case 'easy':
      return 'green';
    case 'intermediate':
      return 'blue';
    case 'advanced':
      return 'black';
    case 'expert':
      return 'doubleBlack';
    default:
      return null;
  }
}

export function allowedRatings(comfort: TerrainComfort): Rating[] {
  return RATINGS.filter((r) => comfort[r] !== 'avoid');
}

// ---------- Validation ----------

const inRange = (n: number | null, lo: number, hi: number) => n == null || (Number.isFinite(n) && n >= lo && n <= hi);

export function validateProfile(p: SkierProfile): string[] {
  const errors: string[] = [];
  if (p.displayName.length > DISPLAY_NAME_MAX) errors.push(`Name must be ${DISPLAY_NAME_MAX} characters or fewer.`);
  if (p.onboardingComplete && !p.displayName.trim()) errors.push('Name is required.');
  if (!inRange(p.abilityLevel, 1, 5)) errors.push('Ability level must be between 1 and 5.');
  if (!inRange(p.abilityScore, 1, 10)) errors.push('Ability score must be between 1 and 10.');
  if (!inRange(p.challengeAppetite, 1, 5)) errors.push('Challenge must be between 1 and 5.');
  if (!inRange(p.daysPerSeason, 0, 365)) errors.push('Days per season must be between 0 and 365.');
  if (!inRange(p.yearsExperience, 0, 100)) errors.push('Years skiing must be between 0 and 100.');
  if (!inRange(p.onboardingStep, 0, 100)) errors.push('Invalid onboarding step.');
  for (const r of RATINGS) {
    if (!COMFORT_LEVELS.includes(p.terrainComfort?.[r])) errors.push(`Invalid comfort for ${r}.`);
  }
  const bad = [...p.terrainLikes, ...p.terrainAvoids].filter((t) => !TERRAIN_TYPES.includes(t));
  if (bad.length) errors.push('Unknown terrain type.');
  if (p.terrainLikes.some((t) => p.terrainAvoids.includes(t))) {
    errors.push('A terrain type cannot be both liked and avoided.');
  }
  if (p.priorities.some((x) => !PRIORITIES.includes(x))) errors.push('Unknown priority.');
  return errors;
}

export function validateDaySession(s: DaySession): string[] {
  const errors: string[] = [];
  if (!s.userId || !s.mountainId) errors.push('Session needs a user and a mountain.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) errors.push('Invalid date.');
  if (!inRange(s.challengeToday, 1, 5)) errors.push('Challenge must be between 1 and 5.');
  if (!['fresh', 'ok', 'tired'].includes(s.energy)) errors.push('Invalid energy.');
  if (s.wantToday.some((t) => !TERRAIN_TYPES.includes(t))) errors.push('Unknown terrain type.');
  return errors;
}

// ---------- Day session ----------

export function localDateKey(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function createDaySession(profile: SkierProfile, mountainId: string, date: Date = new Date()): DaySession {
  return {
    userId: profile.userId,
    mountainId,
    date: localDateKey(date),
    challengeToday: clamp(profile.challengeAppetite, 1, 5),
    energy: 'ok',
    wantToday: [],
  };
}

export interface EffectivePreferences {
  challenge: number;
  energy: Energy;
  likes: TerrainType[];
  avoids: TerrainType[];
}

/** Today's session first, then the profile baseline. */
export function effectivePreferences(profile: SkierProfile, session: DaySession | null): EffectivePreferences {
  if (!session) {
    return {
      challenge: clamp(profile.challengeAppetite, 1, 5),
      energy: 'ok',
      likes: [...profile.terrainLikes],
      avoids: [...profile.terrainAvoids],
    };
  }
  const tiredPenalty = session.energy === 'tired' ? 1 : 0;
  const likes = Array.from(new Set([...profile.terrainLikes, ...session.wantToday]));
  return {
    challenge: clamp(session.challengeToday - tiredPenalty, 1, 5),
    energy: session.energy,
    likes,
    avoids: profile.terrainAvoids.filter((t) => !session.wantToday.includes(t)),
  };
}
