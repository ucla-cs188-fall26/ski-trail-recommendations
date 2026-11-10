import { useId, useState, type InputHTMLAttributes } from 'react';
import { passwordStrength } from '../lib/password';
import styles from './Field.module.css';

export interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  hint?: string;
  showStrength?: boolean;
}

const METER_COLORS = ['#c0262d', '#e8890c', '#d4b106', '#2169c4', '#178342'];

export function PasswordField({ label, value, onChange, error, hint, showStrength = false, id, ...rest }: PasswordFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [visible, setVisible] = useState(false);
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  const strength = passwordStrength(value);
  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>{label}</label>
      <div className={styles.inputWrap}>
        <input
          {...rest}
          id={inputId}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${styles.input} ${styles.withToggle} ${error ? styles.invalid : ''}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {showStrength && (
        <div className={styles.meterRow}>
          <div
            className={styles.meter}
            role="meter"
            aria-label="Password strength"
            aria-valuemin={0}
            aria-valuemax={4}
            aria-valuenow={strength.score}
            aria-valuetext={strength.label}
          >
            <div className={styles.meterFill}
              style={{ width: `${(strength.score / 4) * 100}%`, background: METER_COLORS[strength.score] }} />
          </div>
          <span>{value ? strength.label : ''}</span>
        </div>
      )}
      {hint && <p id={hintId} className={styles.hint}>{hint}</p>}
      <div aria-live="polite">{error && <p id={errorId} className={styles.error}>{error}</p>}</div>
    </div>
  );
}
