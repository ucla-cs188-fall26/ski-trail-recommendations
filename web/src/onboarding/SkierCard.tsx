import type { ReactNode } from 'react';
import { RATINGS, type SkierProfile } from '../models/profile';
import { getMountain } from '../data/mountains';
import {
  ABILITY_OPTIONS, AGE_LABELS, CHALLENGE_TEXT, CLARIFIER_OPTIONS, CONDITION_LABELS, CONDITION_OPTIONS, COMFORT_OPTIONS,
  DETAIL_OPTIONS, FALL_OPTIONS, FLATS_OPTIONS, GROUP_OPTIONS, PRIORITY_OPTIONS, RATING_LABELS, SPORT_OPTIONS,
  STEP_IDS, SUMMARY_SECTIONS, TERRAIN_LABELS, type StepId,
} from './questions';
import styles from './SkierCard.module.css';

const label = <V,>(opts: { value: V; label?: string; title?: string }[], v: V | null | undefined) => {
  const o = opts.find((x) => x.value === v);
  return o ? (o.label ?? o.title ?? '') : '';
};
const NOT_SET = '—';

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <dt>{term}</dt>
      <dd>{children || NOT_SET}</dd>
    </div>
  );
}

/** Summary of a profile, grouped by onboarding section, with optional per-section edit buttons. */
export function SkierCard({ profile: p, onEdit }: { profile: SkierProfile; onEdit?: (step: StepId) => void }) {
  const ability = ABILITY_OPTIONS.find((o) => o.level === p.abilityLevel);
  const sections: Record<StepId, ReactNode> = {
    about: (
      <dl>
        <Row term="Name"><span>{p.displayName}</span></Row>
        <Row term="Rides">{label(SPORT_OPTIONS, p.sport)}</Row>
        {p.sport !== 'ski' && p.flatsBother && <Row term="Flats bother you">{label(FLATS_OPTIONS, p.flatsBother)}</Row>}
      </dl>
    ),
    ability: (
      <dl>
        <Row term="Level"><span>{ability?.title ?? ''}</span></Row>
        {p.abilityClarifier && <Row term="Steep, icy blue">{label(CLARIFIER_OPTIONS, p.abilityClarifier)}</Row>}
      </dl>
    ),
    comfort: (
      <dl>
        {RATINGS.map((r) => (
          <Row key={r} term={`${RATING_LABELS[r].symbol} ${RATING_LABELS[r].label}`}>{label(COMFORT_OPTIONS, p.terrainComfort[r])}</Row>
        ))}
      </dl>
    ),
    terrain: (
      <dl>
        <Row term="Likes">{p.terrainLikes.map((t) => TERRAIN_LABELS[t]).join(', ')}</Row>
        <Row term="Avoids">{p.terrainAvoids.map((t) => TERRAIN_LABELS[t]).join(', ')}</Row>
      </dl>
    ),
    conditions: (
      <dl>
        {(Object.keys(CONDITION_LABELS) as (keyof typeof CONDITION_LABELS)[]).map((k) => (
          <Row key={k} term={CONDITION_LABELS[k]}>{label(CONDITION_OPTIONS, p.conditions[k])}</Row>
        ))}
      </dl>
    ),
    pace: (
      <dl>
        <Row term="Usual challenge">{CHALLENGE_TEXT[p.challengeAppetite]}</Row>
        <Row term="Falls worry you">{label(FALL_OPTIONS, p.fallConcern)}</Row>
      </dl>
    ),
    experience: (
      <dl>
        <Row term="Years">{p.yearsExperience != null ? String(p.yearsExperience) : ''}</Row>
        <Row term="Days per season">{p.daysPerSeason != null ? String(p.daysPerSeason) : ''}</Row>
        <Row term="Age range">{p.ageRange ? AGE_LABELS[p.ageRange] : ''}</Row>
        <Row term="Mountains skied">{p.familiarMountainIds.map((id) => getMountain(id)?.name ?? id).join(', ')}</Row>
        <Row term="Detail">{label(DETAIL_OPTIONS, p.detailLevel)}</Row>
      </dl>
    ),
    crew: (
      <dl>
        <Row term="Usually with">{label(GROUP_OPTIONS, p.usualGroup)}</Row>
        <Row term="Priorities">{p.priorities.map((x) => label(PRIORITY_OPTIONS, x)).join(', ')}</Row>
      </dl>
    ),
  };

  return (
    <div className={styles.card}>
      {STEP_IDS.map((id) => (
        <section key={id} className={styles.section} aria-label={SUMMARY_SECTIONS[id]}>
          <div className={styles.head}>
            <h3>{SUMMARY_SECTIONS[id]}</h3>
            {onEdit && (
              <button type="button" className={styles.edit} onClick={() => onEdit(id)}
                aria-label={`Edit ${SUMMARY_SECTIONS[id].toLowerCase()}`}>
                Edit
              </button>
            )}
          </div>
          {sections[id]}
        </section>
      ))}
    </div>
  );
}
