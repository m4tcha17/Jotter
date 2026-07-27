# lib/

`supabase.ts`, `oauth.ts`, `projects.ts` — the data/auth layer shared by every screen.

- This is the only place a screen should touch `supabase` directly for anything already wrapped here — add a function here instead of inlining a query in a screen.
- Offline-first (`expo-sqlite` as local source of truth, Supabase as best-effort sync) is the target architecture per `docs/architecture.md`, but is not yet implemented for most of `projects.ts` — it currently talks to Supabase directly. Flag this gap rather than silently building further on the online-only path; don't assume it's already offline-first.
