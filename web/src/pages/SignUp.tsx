import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { PasswordField } from '../components/PasswordField';
import { useAuth } from '../context/AuthContext';
import { validatePassword } from '../lib/password';
import { isValidEmail } from '../services/auth/mockAuth';
import { Brand } from './Brand';
import styles from './Auth.module.css';

interface Errors { email?: string; password?: string; confirm?: string; form?: string }

export function SignUp() {
  const { signUp } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!email.trim()) next.email = 'Enter your email.';
    else if (!isValidEmail(email)) next.email = 'Enter a valid email address.';
    const pwErr = validatePassword(password);
    if (pwErr) next.password = pwErr;
    if (!confirm) next.confirm = 'Confirm your password.';
    else if (confirm !== password) next.confirm = "Passwords don't match.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const res = await signUp(email, password);
    if (!res.ok) {
      setBusy(false);
      if (res.error.code === 'invalid_email') setErrors({ email: res.error.message });
      else if (res.error.code === 'weak_password') setErrors({ password: res.error.message });
      else setErrors({ form: res.error.message });
    }
    // On success the SignedOutOnly guard routes to onboarding.
  }

  return (
    <AuthLayout>
      <Brand />
      <h1>Create your account</h1>
      <p className={styles.lead}>Takes a minute, then a few quick questions about how you ski.</p>
      {errors.form && (
        <div role="alert" className={styles.alert}>
          {errors.form} <Link to="/login" state={location.state}>Sign in instead</Link>
        </div>
      )}
      <form onSubmit={onSubmit} noValidate>
        <TextField label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={setEmail} error={errors.email} />
        <PasswordField label="Password" autoComplete="new-password" value={password} onChange={setPassword}
          error={errors.password} hint="At least 8 characters, with a letter and a number." showStrength />
        <PasswordField label="Confirm password" autoComplete="new-password" value={confirm} onChange={setConfirm} error={errors.confirm} />
        <Button type="submit" block loading={busy}>Create account</Button>
      </form>
      <p className={styles.alt}>Already have an account? <Link to="/login" state={location.state}>Sign in</Link></p>
    </AuthLayout>
  );
}
