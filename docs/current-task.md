# Current Task

**Local SQLite layer — built, `tsc`/`jest` clean. Manual on-device regression still pending.**

Sub-project 1 of 2 for offline-first (per `docs/architecture.md`'s "Offline & Sync Strategy"). Full design in `docs/superpowers/specs/2026-08-25-local-sqlite-layer-design.md`. Every write in `projects/api.ts`, `fields/api.ts`, `capture/api.ts`, `samples/api.ts` now goes through local `expo-sqlite` (`lib/db.ts`) instead of `supabase.from(...)` — app usable with zero connectivity. `project_members` stays direct-Supabase, unchanged (sending an invite requires connectivity). Sync engine (push unsynced rows, upload photos) is still out of scope, a second spec.

**Built:**
- `lib/db.ts` — connection singleton, `PRAGMA user_version` migrations, `PRAGMA foreign_keys = ON`, `newId()`/`nowIso()` helpers.
- `projects/api.ts`, `fields/api.ts`, `capture/api.ts`, `samples/api.ts` rewritten to read/write local SQLite, same exported function names/signatures, screens untouched. Pure row-shaping helpers (`assembleFields`, `assembleSampleRows`) split out and unit-tested.
- `modules/camera/CameraCaptureStep.tsx` — captured photos relocated from the cache dir to `Paths.document` before being stored, closing the durability gap (cache-dir purge no longer loses photos).
- `modules/account/seed.ts` + `SeedScreen.tsx` — one-time pull of the signed-in user's existing Supabase rows into the fresh local DB on first launch, FK-safe order, existing row ids kept, `synced_at` stamped so the future sync engine won't re-push them, gated by an AsyncStorage flag with retry/skip if offline. Wired into `App.tsx` right after session resolution, alongside a fatal error screen if migration/seed fails.

**Not yet done:**
- Full manual on-device regression (sign in → create project with fields/capture slots → capture a sample end to end → confirm it in the Data tab → export to CSV/zip → force-quit and relaunch → confirm everything persisted) — no device access during this closing task, still pending.
- `camera_resolution_width`/`camera_resolution_height` are not populated anywhere (project creation, camera settings, or seed) — camera-resolution locking isn't wired up yet. Flagged during Task 7's review as a known, non-blocking gap.

`npx tsc --noEmit` and `npx jest` both clean (4 suites, 39 tests, including the new `assembleFields`/`assembleSampleRows` coverage).

---

**Carried over, paused — camera calibration on-device bug (separate `camera` branch, not merged to main):**

`sdd/camera-calibration-integration` merged into `camera` branch on 2026-08-11, then further rebind-loop fixes applied 2026-08-25 morning (ref guards, `CameraController` refactor to avoid unbind/rebind, `PreviewView` switched `SurfaceView→TextureView` for Fabric compatibility, `onCameraReady` moved from closure to `EventDispatcher`). Root cause of the on-device hang was **not confirmed fixed** as of the last test before this work paused to prioritize CSV export — needs a fresh on-device pass before calling it done. Calibration is currently **not mandatory** at project creation (temporarily reverted in `CreateProjectScreen.tsx`/`projects/api.ts` to unblock testing) — re-enable once confirmed stable.

**Known gaps, not blocking:**
- Guest-to-OAuth/email identity linking is still not implemented.
- Dependent category fields — still deferred.
- iOS manual-exposure equivalent — explicitly deferred, not scoped anywhere yet.

## Suggested build order (after this task)
1. ~~Navigation shell~~ / ~~Empty-state → project creation~~ / ~~Samples & capture modes~~ / ~~Project tabs + real Fields tab~~ / ~~Data-integrity schema~~ / ~~Native camera module~~ / ~~Real Data tab~~ / ~~CSV/zip export~~ — done.
2. ~~Local SQLite schema + typed data-access layer~~ — done.
3. Camera calibration on-device verification (paused, see above) — resume once SQLite layer lands, since photo relocation touches the same capture path.
4. Guest → registered upgrade flow via Supabase identity linking.
5. Dependent category fields.
5b. Fields tab / Add Field modal `is_required`/`is_sample_identifier` toggles.
6. Sync engine (push unsynced rows to Supabase, upload photos to Storage) — second spec, deferred per this task's own scope.
7. Project sharing.

When the user assigns the next concrete task, replace this file's content with that task's specific scope and acceptance criteria.
