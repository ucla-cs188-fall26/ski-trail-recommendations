import { OptionCard } from '../../components/OptionCard';
import { SegmentedControl } from '../../components/SegmentedControl';
import { computeAbilityScore, deriveTerrainComfort, needsClarifier, type Clarifier } from '../../models/profile';
import { ABILITY_OPTIONS, ABILITY_QUESTION, CLARIFIER_OPTIONS, CLARIFIER_QUESTION } from '../questions';
import type { StepProps } from './types';
import styles from './Steps.module.css';

export function AbilityStep({ draft, update, errors }: StepProps) {
  const setAbility = (abilityLevel: number, abilityClarifier: Clarifier | null) => {
    const abilityScore = computeAbilityScore({ abilityLevel, clarifier: abilityClarifier, daysPerSeason: draft.daysPerSeason });
    update({ abilityLevel, abilityClarifier, abilityScore, terrainComfort: deriveTerrainComfort(abilityScore) });
  };
  return (
    <>
      <p className={styles.groupLabel} id="ability-q">{ABILITY_QUESTION}</p>
      <div role="radiogroup" aria-labelledby="ability-q">
        {ABILITY_OPTIONS.map((o) => (
          <div key={o.level}>
            <OptionCard title={o.title} description={o.description} icon={o.icon}
              selected={draft.abilityLevel === o.level}
              onSelect={() => setAbility(o.level, draft.abilityLevel === o.level ? draft.abilityClarifier : null)} />
            {draft.abilityLevel === o.level && needsClarifier(o.level) && (
              <div className={styles.clarifier}>
                <SegmentedControl label={CLARIFIER_QUESTION} options={CLARIFIER_OPTIONS} value={draft.abilityClarifier}
                  onChange={(c) => setAbility(o.level, c)} />
              </div>
            )}
          </div>
        ))}
      </div>
      {errors.abilityLevel && <p className={styles.error} role="alert">{errors.abilityLevel}</p>}
    </>
  );
}
