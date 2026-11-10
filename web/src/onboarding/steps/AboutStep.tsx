import { TextField } from '../../components/TextField';
import { OptionCard } from '../../components/OptionCard';
import { SegmentedControl } from '../../components/SegmentedControl';
import { FLATS_OPTIONS, FLATS_QUESTION, SPORT_OPTIONS, SPORT_QUESTION } from '../questions';
import type { StepProps } from './types';
import styles from './Steps.module.css';

export function AboutStep({ draft, update, errors }: StepProps) {
  return (
    <>
      <TextField label="Your name" autoComplete="given-name" value={draft.displayName}
        onChange={(displayName) => update({ displayName })} error={errors.displayName} />
      <p className={styles.groupLabel} id="sport-q">{SPORT_QUESTION}</p>
      <div role="radiogroup" aria-labelledby="sport-q">
        {SPORT_OPTIONS.map((o) => (
          <OptionCard key={o.value} title={o.label} icon={o.icon} selected={draft.sport === o.value}
            onSelect={() => update({ sport: o.value, flatsBother: o.value === 'ski' ? null : draft.flatsBother })} />
        ))}
      </div>
      {errors.sport && <p className={styles.error} role="alert">{errors.sport}</p>}
      {(draft.sport === 'snowboard' || draft.sport === 'both') && (
        <SegmentedControl label={FLATS_QUESTION} options={FLATS_OPTIONS} value={draft.flatsBother}
          onChange={(flatsBother) => update({ flatsBother })} />
      )}
    </>
  );
}
