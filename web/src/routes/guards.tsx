import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FullPageLoader } from '../components/FullPageLoader';

export interface FromState {
  from?: string;
}

/** Signed-in users only; others go to /welcome and come back after sign-in. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'signedOut') {
    const from = location.pathname + location.search;
    return <Navigate to="/welcome" replace state={{ from } satisfies FromState} />;
  }
  return <Outlet />;
}

/** Signed-in users who finished onboarding; others are sent to /onboarding. */
export function RequireOnboarded() {
  const { profile } = useAuth();
  if (!profile?.onboardingComplete) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

/** /onboarding only while onboarding is unfinished. */
export function RequireNotOnboarded() {
  const { profile } = useAuth();
  if (profile?.onboardingComplete) return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Welcome / sign-in / sign-up: signed-in users are sent onward. */
export function SignedOutOnly() {
  const { status, profile } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'signedIn') {
    if (!profile?.onboardingComplete) return <Navigate to="/onboarding" replace />;
    const from = (location.state as FromState | null)?.from;
    return <Navigate to={from && from.startsWith('/') && !from.startsWith('//') ? from : '/'} replace />;
  }
  return <Outlet />;
}
