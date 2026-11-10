import { SegmentedControl } from '../../components/SegmentedControl';
import { RATINGS, allowedRatings } from '../../models/profile';
import { COMFORT_OPTIONS, ERRORS, RATING_LABELS } from '../questions';
import type { StepProps } from './types';
import styles from './Steps.module.css';

export function ComfortStep({ draft, update }: StepProps) {
  return (
    <>
      {RATINGS.map((r) => (
        <div key={r}>
          <div className={styles.groupLabel} aria-hidden="true">
            <span className={`${styles.sym} ${styles[r]}`}>{RATING_LABELS[r].symbol}</span>{RATING_LABELS[r].label}
          </div>
          <SegmentedControl label={RATING_LABELS[r].label} showLabel={false} options={COMFORT_OPTIONS}
            value={draft.terrainComfort[r]}
            tone={(v) => (v === 'avoid' ? 'danger' : v === 'love' ? 'good' : undefined)}
            onChange={(v) => update({ terrainComfort: { ...draft.terrainComfort, [r]: v } })} />
        </div>
      ))}
      {allowedRatings(draft.terrainComfort).length === 0 && <p className={styles.warn} role="status">{ERRORS.allAvoided}</p>}
    </>
  );
}
