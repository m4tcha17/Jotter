# Current Task

**Capture flow skeleton — built, running on auto-exposure `expo-camera` as a labeled placeholder; on-device testing still needed.**

Replaces the `CaptureScreen` placeholder with the real flow described in `docs/architecture.md`'s Navigation Structure, minus the native camera module (deferred — see `screens/capture/CLAUDE.md`):

- `screens/capture/CaptureScreen.tsx` — orchestrator/state machine: loads `capture_slots` + `fields` for the project, steps through slots in order (angle-assist → camera, per slot), then the logging form, then save.
- `screens/capture/AngleAssistStep.tsx` — `expo-sensors` `DeviceMotion` tilt/level indicator, green border + haptic when the phone matches a slot's `target_angle_degrees`.
- `screens/capture/CameraCaptureStep.tsx` — interim capture UI on `expo-camera`'s stock (auto-exposure) API, explicitly labeled as a placeholder in the UI itself; shared by slot capture and `photo`-data-type fields.
- `screens/capture/SampleForm.tsx` — one input per field in `sort_order`, `timestamp` fields filtered out, `is_required` hard-blocks Save Sample, `is_sample_identifier` duplicate-checked at submit via `checkIdentifierDuplicate` (non-blocking `Alert`).
- `lib/projects.ts` — added `fetchCaptureSlots`, `checkIdentifierDuplicate`, `createSample` (inserts `samples` + `sample_photos` + `sample_values`); extended `fetchFields`/`ProjectField` to select `is_required`, `is_sample_identifier`, and category options (needed to render category chips and enforce the above — previously only `category.name` was fetched).

**Not yet done / acceptance criteria before calling this finished:**
- On-device testing: single-mode project (one hidden slot, no angle-assist) end to end; multi-mode project with a slot that has a `target_angle_degrees` (confirm tilt indicator + haptic); every field data type in the form, including `category` chips and `photo` sub-capture; required-field block; identifier duplicate warning (needs a field manually flipped to `is_sample_identifier = true` in the DB, since there's no UI toggle yet — see gap below).
- Camera permission prompt flow (first launch) not yet verified on-device.
- No retake/confirm step after a slot photo is taken (by design — architecture's "no branching mid-flow" rule) or after a field's `photo` sub-capture (allowed, since that's a self-contained control, not the main flow) — verify this feels right in hand, not just on paper.

**Known gaps, not blocking (carried over or newly surfaced):**
- No field can have `is_required`/`is_sample_identifier` set yet (Fields/Add Field UI toggle is build order step 5b, unbuilt) — the enforcement code above is currently a no-op in practice.
- Dependent category fields (`field_category_rules` auto-fill) not implemented in the form — nothing can set `source_field_id` yet (build order step 5, unbuilt).
- Writes go straight to Supabase, same as the rest of `lib/projects.ts` — offline-first SQLite (step 2) and immediate-sync-on-completion (step 9) still unbuilt. Photos save as local URIs only; no Storage upload yet.
- Native camera module + hardware capability spike (build order step 3) still not done — Capture runs on auto exposure in the meantime.

---

**Data integrity: required fields + sample-identifier duplicate checking — schema done, UI not built yet.**

Formalizes three behaviors the user's methodology write-up describes, committing them as real planned features rather than leaving them as unstated assumptions:

- `fields.is_required` (boolean, default false) — blocks Save Sample in the future Capture flow until a required field has a value.
- `fields.is_sample_identifier` (boolean, default false, at most one per project via a partial unique index `fields_one_identifier_per_project`) — an opt-in, human-chosen ID field. Checked for duplicates against every other sample's value for it at save time (warning, non-blocking) and again at export time (a duplicate-ID summary alongside the archive, export never blocked).
- Immediate sync-on-completion — when a sample is confirmed complete, an immediate sync attempt fires right away, in addition to the existing periodic/foreground check (which remains the catch-all for anything created offline).

Migration: `supabase/migrations/20260725044536_field_required_and_identifier.sql`, pushed and verified live. `docs/schema.sql` and `docs/architecture.md` (Data Model, the new "Data integrity" subsection, Capture flow, Offline & Sync Strategy, Export) all updated.

**Not yet built**: the actual UI for any of this — marking a field as required/identifier (Fields tab or Add Field modal), the save-time blocking/warning behavior, and the export-time duplicate summary all depend on the Capture and Data/Export screens existing first, which they don't yet (see build order below). This task only covers the schema and the committed design.

---

**App renamed DataSnap → Jotter — code/docs done, one external step still needed (see below).**

`app.json` (name/slug/scheme/package: `com.m4tcha.jotter`, deep-link scheme `jotter://`), `package.json`, all docs (`AGENTS.md`, `docs/architecture.md`, `docs/design-blueprint.md`, `docs/schema.sql`, `README.md`), the historical migration's header comment, and the Landing screen's heading text are all updated. Native project regenerated (`expo prebuild --clean`) and verified: `AndroidManifest.xml`/`build.gradle` show `com.m4tcha.jotter` and the `jotter://` scheme.

**Still needed from the user (external, not something I can do):**
- Create a new Google Cloud **Android** OAuth Client for package `com.m4tcha.jotter` (same debug SHA-1 as before) — the old Android client was tied to the retired `com.m4tcha.datasnap` package and won't match anymore. The **Web** Client ID/Secret used in Supabase's Google provider does not need to change.
- Add `jotter://**` to Supabase → Authentication → URL Configuration's allowed Redirect URLs (for the GitHub OAuth flow); the old `datasnap://**` entry can be removed once confirmed working.
- Next `expo run:android` will install as a **new** app (different package name) alongside any old DataSnap install still on the test device/emulator — fine to just ignore/uninstall the old one.

**Project inner-level tabs + real Fields tab — done; on-device testing still needed.**

Builds out the "inside a project" navigation level described in `docs/architecture.md`, replacing the old `ProjectHomeScreen` placeholder:

- **`navigation/ProjectTabs.tsx`**: the real inner tab bar — Capture / Fields / Data — shown once a project is opened, with a thin header above it (back-to-Projects arrow, project name, settings gear). Wired into `RootNavigator` as what the `ProjectHome` route now renders (route name unchanged, so `CreateProjectScreen`/`ProjectsScreen`'s existing `navigate('ProjectHome', ...)` calls needed no changes).
- **`screens/fields/FieldsScreen.tsx`** — plain list of the project's fields (name, type, category), not a spreadsheet. Locked/read-only by default — an "Edit" button in the top-right toggles edit mode, which is the only state that exposes the per-field delete and the "+ Add Field" action, preventing accidental changes to the schema.
- **`screens/capture/CaptureScreen.tsx`** — was a template/placeholder page at the time; superseded above by the real capture flow skeleton (still on auto-exposure, pending the camera hardware spike + native module).
- **`screens/data/DataScreen.tsx`** — empty state until the project has at least one sample (`lib/projects.ts`'s `fetchSamples`); once samples exist, renders the Excel-style sheet (spreadsheet column letters, frozen row-number gutter, one row per sample, one photo column per capture slot then one column per field) that used to live on Fields. Cell values and photo thumbnails are now wired via `fetchSamples`'s nested `sample_values`/`sample_photos` select — photos render from local URI only until Storage upload exists (step 9). CSV/zip export still not built.
- **`screens/projects/ProjectSettingsScreen.tsx`** (new) — the Delete Project button + confirmation, moved here from the old `ProjectHomeScreen` now that the settings gear is its home instead of a placeholder screen.
- **`lib/projects.ts`**: added `fetchFields`, `addField`, `deleteField`, `fetchSampleCount`; extracted the field+category insert logic (previously inline in `createProject`'s loop) into a shared `insertFieldWithCategory` helper so both project creation and the Fields tab's "+ Add Field" use the same code path. Also extracted `DATA_TYPE_LABELS` as a shared exported constant (previously duplicated locally in `CreateProjectScreen`).

**Not yet done / acceptance criteria before calling this finished:**
- On-device testing: open a project, confirm the tab bar (Capture/Fields/Data) and header (back arrow, name, settings gear) render correctly; confirm Fields opens locked (no delete/add controls visible), tapping Edit reveals them, adding a field of each data type (including category, both new and existing) shows up in the list, deleting a field works with confirmation; confirm Data shows the empty state with zero samples, and once `fetchSampleCount` is non-zero (can be forced by inserting a row into `samples` directly for now, since Capture doesn't create samples yet), the sheet renders with the frozen row-number column staying in place while scrolling horizontally through many fields.

**Known gaps, not blocking (carried over from previous tasks):**
- Writes still go straight to Supabase, bypassing the offline-first SQLite layer.
- Guest-to-OAuth/email identity linking is still not implemented.
- Dependent category fields, camera calibration, camera hardware spike — still deferred.
- Fields tab has no rename/edit-in-place for an existing field yet (only add/delete) — not requested, flagging as a likely future addition rather than an oversight.

## Suggested build order (after this task)
1. ~~Navigation shell~~ / ~~Empty-state → project creation~~ / ~~Samples & capture modes~~ / ~~Project tabs + real Fields tab~~ / ~~Data-integrity schema~~ — done above.
2. Local SQLite schema + typed data-access layer (`projects`, `categories`, `category_options`, `fields`, `capture_slots`, `samples`, `sample_photos`, `sample_values`) — **now overdue**, since `lib/projects.ts` currently writes straight to Supabase and needs refactoring once this lands.
3. Camera hardware capability spike — verify Camera2 `INFO_SUPPORTED_HARDWARE_LEVEL` on the actual field device(s) before investing in the native manual-exposure module; `LEGACY`-level devices can't do manual exposure at all.
4. Guest → registered upgrade flow via Supabase identity linking (not yet built — current Log In/Sign Up/OAuth are separate accounts, not an upgrade path).
5. Dependent category fields — let a category field derive its value from a `number` field via threshold/range rules (`field_category_rules`), auto-filled but overridable in Capture.
5b. Fields tab / Add Field modal — add UI to mark a field `is_required` and to designate a project's (at most one) `is_sample_identifier` field, now that the columns exist.
6. ~~Real Capture tab~~ — skeleton done above (per-slot angle-assist → camera → shared logging form, enforcing `is_required`/`is_sample_identifier`); still owes: native manual-exposure camera capture (replacing the auto-exposure placeholder) and the immediate sync-on-completion trigger (depends on step 9).
7. Camera calibration screen — locked ISO/shutter/white-balance/resolution, whenever Capture is first opened for a project.
8. ~~Real Data tab — table view (one row per sample, one photo column per slot)~~ — done above; still owes CSV/zip export, including the export-time duplicate-identifier summary.
9. Supabase sync — push/pull unsynced rows, photo upload to Storage, the periodic/foreground sweep that backstops the immediate sync-on-completion trigger (this is where the offline-first SQLite layer and the direct-to-Supabase code converge).
10. Project sharing — invite collaborator by email, `project_members` UI/flow. (RLS policies already exist in `docs/schema.sql`.)

When the user assigns the next concrete task, replace this file's content with that task's specific scope and acceptance criteria.
