# Trailwise web app (sign-in + onboarding)

A Vite + React + TypeScript single-page app. It covers sign up, sign in, password reset, an
8-step skier onboarding, a profile page, "Find my mountain", and a per-day "Today's session"
prompt. Recommendations and the map/route planner are placeholders for now.

Auth and profile data use a **localStorage mock** behind service interfaces, so a real backend
(Supabase) can be swapped in later without changing any UI code.

## Run it

You need Node 18 or newer.

```bash
cd web
npm install
npm run dev          # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm test` | Run the Vitest suite once (`npm run test:watch` to watch) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Typecheck, then a production build into `web/dist/` |

### Trying password reset locally

The mock doesn't send real email. Request a reset at `/forgot-password`, then open
**`/dev/mailbox`** (dev builds only) and click the link. Links expire after 30 minutes and
work once. To start over, clear the site's localStorage in your browser's dev tools.

## Layout

```
src/
  models/profile.ts          SkierProfile + DaySession types, ability scoring, comfort derivation, validation
  services/auth/             AuthService interface, mockAuth (localStorage + PBKDF2), provider picker
  services/profile/          ProfileService interface + mock (profiles and day sessions)
  services/mailbox.ts        Dev-only simulated inbox
  context/AuthContext.tsx    useAuth(): status, session, profile, and actions
  routes/guards.tsx          RequireAuth / RequireOnboarded / RequireNotOnboarded / SignedOutOnly
  onboarding/questions.ts    All onboarding wording (edit copy here)
  onboarding/steps.ts        Step definitions: validation and the fields each step saves
  onboarding/steps/*.tsx     One component per step (also reused for profile editing)
  pages/                     Welcome, SignUp, SignIn, ForgotPassword, ResetPassword, DevMailbox,
                             FindMountain, MountainHome (+ DaySessionDialog), MapRoute, Profile
  data/mountains.ts          Resort catalog + search (only Mammoth has trail data)
  components/                Button, TextField, PasswordField, OptionCard, SegmentedControl,
                             ChoiceSlider, CycleChip, TrailProgress, Modal, Snowfall, …
  theme/                     Design tokens + global styles
```

Tests sit next to the code (`*.test.ts(x)`). They exercise the public behavior (rendered UI,
service APIs) rather than internals. `src/test/utils.tsx` provides `renderWithProviders`,
fresh mock services and `seedUser`.

## Swapping to Supabase (later)

1. `npm install @supabase/supabase-js` and add `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
   to `web/.env.local`.
2. Add `src/services/auth/supabaseAuth.ts` implementing `AuthService` from
   `services/auth/types.ts`. The methods map to supabase-js:
   - `signUp` → `auth.signUp`
   - `signIn` → `auth.signInWithPassword`
   - `onAuthStateChange` → `auth.onAuthStateChange`
   - `requestPasswordReset(email, redirectTo)` → `auth.resetPasswordForEmail(email, { redirectTo })`
   - `completePasswordReset` → `auth.updateUser({ password })` in the recovery session
3. Return it from `services/auth/index.ts` when `VITE_AUTH_PROVIDER=supabase`.
4. Create a `profiles` table keyed by `auth.users.id` with RLS `auth.uid() = id`. Profile
   fields map 1:1 to columns, with enums as Postgres enums or text checks and multi-selects
   as `text[]`. Add a `day_sessions` table keyed by `(user_id, mountain_id, date)`. Then
   implement `ProfileService` against them.

The mock auth is **not** a security boundary. It only exists for local development and demos.
