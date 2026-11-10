import styles from './Auth.module.css';

export function Brand() {
  return (
    <div className={styles.brand}>
      <span className={styles.brandMark} aria-hidden="true">▲</span>
      Trailwise
    </div>
  );
}
