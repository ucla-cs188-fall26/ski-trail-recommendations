import { useRef, type KeyboardEvent } from 'react';
import styles from './SegmentedControl.module.css';

export interface SegmentOption<V extends string> {
  value: V;
  label: string;
}

export interface SegmentedControlProps<V extends string> {
  label: string;
  options: readonly SegmentOption<V>[];
  value: V | null;
  onChange: (value: V) => void;
  /** Visually show the label above the control (default true). */
  showLabel?: boolean;
  tone?: (value: V) => string | undefined;
}

export function SegmentedControl<V extends string>({ label, options, value, onChange, showLabel = true, tone }: SegmentedControlProps<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const checkedIndex = options.findIndex((o) => o.value === value);
  const tabIndexFor = (i: number) => (checkedIndex === -1 ? (i === 0 ? 0 : -1) : i === checkedIndex ? 0 : -1);

  const select = (i: number) => {
    const opt = options[i];
    if (opt.value !== value) onChange(opt.value);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + options.length) % options.length;
    if (next === -1) return;
    e.preventDefault();
    select(next);
    refs.current[next]?.focus();
  };

  return (
    <div className={styles.wrap}>
      {showLabel && <div className={styles.label} aria-hidden="true">{label}</div>}
      <div role="radiogroup" aria-label={label} className={styles.group}>
        {options.map((o, i) => {
          const checked = o.value === value;
          return (
            <button
              key={o.value}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={tabIndexFor(i)}
              className={`${styles.segment} ${checked ? styles.checked : ''} ${checked && tone ? styles[tone(o.value) ?? ''] ?? '' : ''}`}
              onClick={() => select(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
