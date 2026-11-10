import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { PasswordField } from '../components/PasswordField';
import { useAuth } from '../context/AuthContext';
import { Brand } from './Brand';
import styles from './Auth.module.css';

interface Errors { email?: string; password?: string; form?: string }

export function SignIn() {
  const { signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!email.trim()) next.email = 'Enter your email.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const res = await signIn(email, password);
    if (!res.ok) {
      setBusy(false);
      setPassword('');
      setErrors({ form: res.error.message });
    }
    // On success the SignedOutOnly guard routes onward (back to `from` if present).
  }

  return (
    <AuthLayout>
      <Brand />
      <h1>Welcome back</h1>
      {errors.form && <div role="alert" className={styles.alert}>{errors.form}</div>}
      <form onSubmit={onSubmit} noValidate>
        <TextField label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={setEmail} error={errors.email} />
        <PasswordField label="Password" autoComplete="current-password" value={password} onChange={setPassword} error={errors.password} />
        <div className={styles.row}><Link to="/forgot-password">Forgot password?</Link></div>
        <Button type="submit" block loading={busy}>Sign in</Button>
      </form>
      <p className={styles.alt}>New here? <Link to="/signup" state={location.state}>Create an account</Link></p>
    </AuthLayout>
  );
}
