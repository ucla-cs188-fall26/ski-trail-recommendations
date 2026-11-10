import styles from './CycleChip.module.css';

export type ChipState = 'neutral' | 'like' | 'avoid';
const NEXT: Record<ChipState, ChipState> = { neutral: 'like', like: 'avoid', avoid: 'neutral' };
const SPOKEN: Record<ChipState, string> = { neutral: 'no preference', like: 'like', avoid: 'avoid' };
const MARK: Record<ChipState, string> = { neutral: '', like: '♥', avoid: '✕' };

export function CycleChip({ label, state, onChange }: { label: string; state: ChipState; onChange: (s: ChipState) => void }) {
  return (
    <button
      type="button"
      className={`${styles.chip} ${styles[state]}`}
      onClick={() => onChange(NEXT[state])}
      aria-label={`${label}: ${SPOKEN[state]}`}
    >
      <span aria-hidden="true" className={styles.mark}>{MARK[state]}</span>
      {label}
    </button>
  );
}
