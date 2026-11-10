import { Link, useLocation } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout';
import { Brand } from './Brand';
import styles from './Auth.module.css';

export function Welcome() {
  const location = useLocation();
  return (
    <AuthLayout>
      <Brand />
      <h1>Find runs that fit you today.</h1>
      <div className={styles.piste} aria-hidden="true">
        <span className={styles.green} /><span className={styles.blue} /><span className={styles.black} />
      </div>
      <p className={styles.lead}>
        Tell us how you ski and what kind of day you want. We'll turn the trail map into runs and routes that match.
      </p>
      <div className={styles.stack}>
        <Link to="/signup" state={location.state} className={`${styles.linkButton} ${styles.linkPrimary}`}>Create account</Link>
        <Link to="/login" state={location.state} className={`${styles.linkButton} ${styles.linkSecondary}`}>Sign in</Link>
      </div>
    </AuthLayout>
  );
}
