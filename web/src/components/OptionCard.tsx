import type { KeyboardEvent, ReactNode } from 'react';
import styles from './OptionCard.module.css';

export interface OptionCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  selected: boolean;
  onSelect: () => void;
  /** Multi-select (checkbox semantics) instead of single-select (radio). */
  multi?: boolean;
}

export function OptionCard({ title, description, icon, selected, onSelect, multi = false }: OptionCardProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  };
  return (
    <div
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      tabIndex={0}
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      onClick={onSelect}
      onKeyDown={onKeyDown}
    >
      {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {description && <span className={styles.description}>{description}</span>}
      </span>
      <span className={styles.check} aria-hidden="true">{selected ? '✓' : ''}</span>
    </div>
  );
}
