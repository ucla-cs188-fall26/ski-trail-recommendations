import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout';
import { Button } from '../components/Button';
import { PasswordField } from '../components/PasswordField';
import { FullPageLoader } from '../components/FullPageLoader';
import { useAuth } from '../context/AuthContext';
import { validatePassword } from '../lib/password';
import { Brand } from './Brand';
import styles from './Auth.module.css';

type Phase = 'checking' | 'invalid' | 'form' | 'done';
interface Errors { password?: string; confirm?: string; form?: string }

const INVALID = 'This reset link is invalid or has already been used, or it has expired.';

export function ResetPassword() {
  const { validateResetToken, completePasswordReset } = useAuth();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [phase, setPhase] = useState<Phase>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!token) { setPhase('invalid'); return; }
    validateResetToken(token).then((valid) => { if (!cancelled) setPhase(valid ? 'form' : 'invalid'); });
    return () => { cancelled = true; };
  }, [token, validateResetToken]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    const pwErr = validatePassword(password);
    if (pwErr) next.password = pwErr;
    if (!confirm) next.confirm = 'Confirm your new password.';
    else if (confirm !== password) next.confirm = "Passwords don't match.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const res = await completePasswordReset(token, password);
    setBusy(false);
    if (res.ok) setPhase('done');
    else if (res.error.code === 'weak_password') setErrors({ password: res.error.message });
    else setErrors({ form: res.error.message });
  }

  return (
    <AuthLayout>
      <Brand />
      <h1>Choose a new password</h1>
      {phase === 'checking' && <FullPageLoader label="Checking your link…" />}
      {phase === 'invalid' && (
        <>
          <div role="alert" className={styles.alert}>{INVALID}</div>
          <p className={styles.alt}><Link to="/forgot-password">Request a new link</Link></p>
        </>
      )}
      {phase === 'done' && (
        <>
          <div role="status" className={styles.success}>Password updated. You can sign in with your new password.</div>
          <Link to="/login" className={`${styles.linkButton} ${styles.linkPrimary}`}>Sign in</Link>
        </>
      )}
      {phase === 'form' && (
        <form onSubmit={onSubmit} noValidate>
          {errors.form && (
            <div role="alert" className={styles.alert}>
              {errors.form} <Link to="/forgot-password">Request a new link</Link>
            </div>
          )}
          <PasswordField label="New password" autoComplete="new-password" value={password} onChange={setPassword}
            error={errors.password} hint="At least 8 characters, with a letter and a number." showStrength />
          <PasswordField label="Confirm new password" autoComplete="new-password" value={confirm} onChange={setConfirm} error={errors.confirm} />
          <Button type="submit" block loading={busy}>Set new password</Button>
        </form>
      )}
    </AuthLayout>
  );
}
