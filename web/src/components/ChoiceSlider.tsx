import { useId } from 'react';
import styles from './ChoiceSlider.module.css';

export interface ChoiceSliderProps {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  minLabel?: string;
  maxLabel?: string;
  valueText?: (value: number) => string;
}

export function ChoiceSlider({ label, min, max, step = 1, value, onChange, minLabel, maxLabel, valueText }: ChoiceSliderProps) {
  const id = useId();
  const text = valueText?.(value);
  return (
    <div className={styles.wrap}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      {text && <p className={styles.value} aria-hidden="true">{text}</p>}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={text}
        className={styles.range}
      />
      {(minLabel || maxLabel) && (
        <div className={styles.ends}>
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}
