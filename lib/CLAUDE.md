# lib/

`supabase.ts` — the Supabase client singleton plus offline-aware session helpers (`signOutLocally`, `flushPendingRevocations`). `db.ts` — the local SQLite connection singleton (`getDb`), schema migrations via `PRAGMA user_version`, and shared write-path helpers (`getCurrentUserId`, `newId`, `nowIso`). These two files are the only cross-cutting infra shared by every module.

- All domain data access (projects, fields, capture slots, samples) lives in each `modules/<domain>/api.ts` instead — don't add a new domain function here. If it's about a specific domain concept, it belongs in that module, not `lib/`.
- `getCurrentUserId()` reads `supabase.auth.getSession()` (local cache) — never call `supabase.auth.getUser()` from a write path, it round-trips to the Auth server and breaks offline writes.
- `expo-sqlite` has no Jest mock in this project — `db.ts` itself is not unit-testable; verify with `npx tsc --noEmit` plus on-device checks. Pure row-shaping helpers in each domain's `api.ts` (`assembleFields`, `assembleSampleRows`) are the unit-testable layer. All of `projects/api.ts`, `fields/api.ts`, `capture/api.ts`, `samples/api.ts` read/write local SQLite as of the local-SQLite-layer work — `project_members` is the one exception, still direct-Supabase (sending an invite requires connectivity).
