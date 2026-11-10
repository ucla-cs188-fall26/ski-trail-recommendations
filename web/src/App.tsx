import { Route, Routes, Navigate } from 'react-router-dom';
import { RequireAuth, RequireNotOnboarded, RequireOnboarded, SignedOutOnly } from './routes/guards';
import { Welcome } from './pages/Welcome';
import { SignUp } from './pages/SignUp';
import { SignIn } from './pages/SignIn';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { DevMailbox } from './pages/DevMailbox';
import { OnboardingPage } from './onboarding/OnboardingPage';
import { AppShell } from './layouts/AppShell';
import { FindMountain } from './pages/FindMountain';
import { MountainHome } from './pages/MountainHome';
import { MapRoute } from './pages/MapRoute';
import { Profile } from './pages/Profile';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<SignedOutOnly />}>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<SignIn />} />
      </Route>
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {import.meta.env.DEV && <Route path="/dev/mailbox" element={<DevMailbox />} />}

      <Route element={<RequireAuth />}>
        <Route element={<RequireNotOnboarded />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
        </Route>
        <Route element={<RequireOnboarded />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<FindMountain />} />
            <Route path="/m/:mountainId" element={<MountainHome />} />
            <Route path="/m/:mountainId/map" element={<MapRoute />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
