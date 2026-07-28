# screens/auth/

`LandingScreen.tsx` (pre-session entry, guest sign-in) and `SignInScreen.tsx` (email/password + OAuth). Nothing here has a project or account context yet — no bottom tabs, no project-scoped data.

- Guest is a real Supabase Auth user via `signInAnonymously`, not a separate local-only path — never build one.
- Google OAuth uses the native `@react-native-google-signin/google-signin` SDK + `supabase.auth.signInWithIdToken`. GitHub has no native SDK, so it uses the browser-redirect flow (`expo-web-browser`/`expo-auth-session` + the `jotter://` deep link). Both live in `lib/oauth.ts` — check whether a new provider has a native SDK before defaulting to browser-redirect for it.
- Guest-to-registered upgrade is meant to be Supabase identity linking on the same user id (so existing data carries over for free) — this is not yet wired up. Don't build a data-migration step for it; when it's implemented, linking alone should be sufficient.
