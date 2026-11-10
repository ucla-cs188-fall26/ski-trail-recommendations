import styles from './TrailProgress.module.css';

export function TrailProgress({ step, total }: { step: number; total: number }) {
  const now = Math.max(0, Math.min(total, step));
  const pct = total > 0 ? (now / total) * 100 : 0;
  return (
    <div
      className={styles.track}
      role="progressbar"
      aria-label={`Step ${now} of ${total}`}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={now}
    >
      <div className={styles.fill} style={{ width: `${pct}%` }} />
      <span className={styles.skier} style={{ left: `${pct}%` }} aria-hidden="true">⛷</span>
    </div>
  );
}
