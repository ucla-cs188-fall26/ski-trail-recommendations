import { Link } from 'react-router-dom';
import styles from '../layouts/Page.module.css';

export function NotFoundMountain() {
  return (
    <div className={styles.body} style={{ marginTop: 24 }}>
      <div className={styles.panel}>
        <h1>Hmm.</h1>
        <p>We couldn't find that mountain.</p>
        <Link to="/" className={styles.cta}>Back to Find my mountain</Link>
      </div>
    </div>
  );
}
