import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { useAuth } from '../context/AuthContext';
import { isValidEmail } from '../services/auth/mockAuth';
import { Brand } from './Brand';
import styles from './Auth.module.css';

export function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setError(undefined);
    setBusy(true);
    await requestPasswordReset(email);
    setBusy(false);
    setSent(true);
  }

  return (
    <AuthLayout>
      <Brand />
      <h1>Reset your password</h1>
      {sent ? (
        <>
          <div role="status" className={styles.success}>
            If an account exists for {email.trim()}, we sent a link to reset the password. It expires in 30 minutes.
          </div>
          {import.meta.env.DEV && (
            <p className={styles.lead}>Testing locally? Open the <Link to="/dev/mailbox">dev mailbox</Link> to see the email.</p>
          )}
          <p className={styles.alt}><Link to="/login">Back to sign in</Link></p>
        </>
      ) : (
        <>
          <p className={styles.lead}>Enter the email you signed up with and we'll send you a reset link.</p>
          <form onSubmit={onSubmit} noValidate>
            <TextField label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={setEmail} error={error} />
            <Button type="submit" block loading={busy}>Send reset link</Button>
          </form>
          <p className={styles.alt}><Link to="/login">Back to sign in</Link></p>
        </>
      )}
    </AuthLayout>
  );
}
