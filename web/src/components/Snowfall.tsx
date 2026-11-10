import { useMemo } from 'react';
import styles from './Snowfall.module.css';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function Snowfall({ count = 40 }: { count?: number }) {
  const reduce = prefersReducedMotion();
  const flakes = useMemo(() => Array.from({ length: count }, (_, i) => ({
    left: (i * 37) % 100,
    size: 3 + ((i * 7) % 5),
    duration: 8 + ((i * 13) % 10),
    delay: -((i * 11) % 15),
    drift: ((i % 5) - 2) * 12,
  })), [count]);
  return (
    <div className={styles.snow} aria-hidden="true">
      {!reduce && flakes.map((f, i) => (
        <span
          key={i}
          data-flake
          className={styles.flake}
          style={{
            left: `${f.left}%`, width: f.size, height: f.size,
            animationDuration: `${f.duration}s`, animationDelay: `${f.delay}s`,
            ['--drift' as string]: `${f.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
