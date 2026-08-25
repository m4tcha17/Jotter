# Current Task

**Local SQLite layer — design spec locked, implementation not started.**

Sub-project 1 of 2 for offline-first (per `docs/architecture.md`'s "Offline & Sync Strategy"). Full design in `docs/superpowers/specs/2026-08-25-local-sqlite-layer-design.md`. Makes every write land in local `expo-sqlite` instead of Supabase — app fully usable with zero connectivity. Sync engine (push unsynced rows, upload photos) is out of scope here, a second spec.

**Scope:**
- New `lib/db.ts` singleton — connection, `PRAGMA user_version` migrations, `PRAGMA foreign_keys = ON`, `newId()` (`expo-crypto`), `nowIso()`.
- Rewrite `modules/{projects,fields,capture,samples}/api.ts` to call `getDb()` instead of `supabase.from(...)` — exact same exported function names/signatures, screens untouched.
- Local schema (full DDL in spec) mirrors `docs/schema.sql` with `uuid→TEXT`, `timestamptz→TEXT`, `boolean→INTEGER`, no `auth.users` FKs, no RLS. `sample_photos.capture_slot_id` uses `ON DELETE CASCADE` (matches the live-DB fix in `20260803051000_fix_sample_photos_capture_slot_cascade.sql`, not the stale `docs/schema.sql`).
- Seed-on-first-launch: one-time pull of the signed-in user's existing Supabase rows into the fresh local DB, FK-safe order, gated by an AsyncStorage flag, with retry/skip if offline.
- Photo relocation: `takePicture()`'s cache-dir URI copied to `Paths.document` before being stored, closing a durability gap.
- `project_members` stays direct-Supabase, unchanged.

**Acceptance criteria:**
- All rewritten `api.ts` functions read/write local SQLite only; no `supabase.from(...)` calls remain in those 4 files for the tables covered by the schema above.
- Migrations run once on startup via `PRAGMA user_version`, idempotent on repeat launches.
- Seed flow populates local DB from Supabase on first launch, using existing row ids, `synced_at` stamped so the future sync engine won't re-push them.
- Captured photos persist under `Paths.document`, survive app restart (cache-dir purge no longer a risk).
- Pure row-shaping functions (flat SQL rows → typed shapes) are unit-tested; `lib/db.ts` and the SQL-executing `api.ts` bodies are manually verified on-device (no Jest mock for `expo-sqlite`, same situation as `react-native-zip-archive` in the CSV export work).
- `npx tsc --noEmit` and `npx jest` clean.

---

**Carried over, paused — camera calibration on-device bug (separate `camera` branch, not merged to main):**

`sdd/camera-calibration-integration` merged into `camera` branch on 2026-08-11, then further rebind-loop fixes applied 2026-08-25 morning (ref guards, `CameraController` refactor to avoid unbind/rebind, `PreviewView` switched `SurfaceView→TextureView` for Fabric compatibility, `onCameraReady` moved from closure to `EventDispatcher`). Root cause of the on-device hang was **not confirmed fixed** as of the last test before this work paused to prioritize CSV export — needs a fresh on-device pass before calling it done. Calibration is currently **not mandatory** at project creation (temporarily reverted in `CreateProjectScreen.tsx`/`projects/api.ts` to unblock testing) — re-enable once confirmed stable.

**Known gaps, not blocking:**
- Guest-to-OAuth/email identity linking is still not implemented.
- Dependent category fields — still deferred.
- iOS manual-exposure equivalent — explicitly deferred, not scoped anywhere yet.

## Suggested build order (after this task)
1. ~~Navigation shell~~ / ~~Empty-state → project creation~~ / ~~Samples & capture modes~~ / ~~Project tabs + real Fields tab~~ / ~~Data-integrity schema~~ / ~~Native camera module~~ / ~~Real Data tab~~ / ~~CSV/zip export~~ — done.
2. **Local SQLite schema + typed data-access layer — in progress, this task.**
3. Camera calibration on-device verification (paused, see above) — resume once SQLite layer lands, since photo relocation touches the same capture path.
4. Guest → registered upgrade flow via Supabase identity linking.
5. Dependent category fields.
5b. Fields tab / Add Field modal `is_required`/`is_sample_identifier` toggles.
6. Sync engine (push unsynced rows to Supabase, upload photos to Storage) — second spec, deferred per this task's own scope.
7. Project sharing.

When the user assigns the next concrete task, replace this file's content with that task's specific scope and acceptance criteria.
