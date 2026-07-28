# lib/

`supabase.ts` — the Supabase client singleton plus offline-aware session helpers (`signOutLocally`, `flushPendingRevocations`). This is the only cross-cutting infra shared by every module; there is no other file here.

- All domain data access (projects, fields, capture slots, samples) lives in each `modules/<domain>/api.ts` instead — don't add a new domain function here. If it's about a specific domain concept, it belongs in that module, not `lib/`.
- Offline-first (`expo-sqlite` as local source of truth, Supabase as best-effort sync) is the target architecture per `docs/architecture.md`, but is not yet implemented for most modules' `api.ts` files — they currently talk to Supabase directly. Flag this gap rather than silently building further on the online-only path; don't assume it's already offline-first.
