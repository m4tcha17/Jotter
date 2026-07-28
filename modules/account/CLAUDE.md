# screens/account/

`AccountScreen.tsx` — account-level settings only (profile info, sign-out). Project-level settings live in `screens/projects/ProjectSettingsScreen.tsx`, not here.

- Sign-out calls `signOutLocally` (`lib/supabase.ts`) and then manually resets the root stack to `Landing` — don't rely solely on the reactive session listener in `App.tsx` to redirect after sign-out; it isn't immediate enough on its own (this was a real bug, fixed by the manual reset).
- Reads `supabase.auth.getSession()` (cached, local) rather than `getUser()` (always round-trips to the Auth server) — this screen must render offline.
