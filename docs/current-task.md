# Current Task

**Samples / Single Shot vs Multi Shot — schema and project-creation config done; on-device testing still needed.**

Generalizes a personal-use requirement (one physical sample = 6 photos: top, bottom, 4 sides) into a project-configurable feature, rather than hardcoding any particular count/naming:

- **Data model restructure**: replaced the old one-photo-per-row `entries`/`entry_values` tables with `capture_slots` (defines the named photo positions that make up one complete sample for a project — e.g. "Top", "Side 1"), `samples` (the actual unit of data, replacing `entries`), `sample_photos` (one photo per sample × slot), and `sample_values` (replacing `entry_values` — field data shared across a sample's photos, not per-photo). `projects.target_angle_degrees` (project-wide) was removed in favor of a per-slot `capture_slots.target_angle_degrees`, since different slots (e.g. a top-down shot vs. a side shot) can need different tilt targets. Migration: `supabase/migrations/20260715140209_samples_and_capture_slots.sql`, pushed and verified live. `docs/schema.sql` and `docs/architecture.md` (Data Model, Capture flow, Export sections) all updated to match.
- **`projects.capture_mode`** (`single` | `multi`, default `single`) governs which UI a project gets. Single Shot behaves exactly like the app already did (one photo, then the form) via one auto-created, hidden capture slot — no new complexity for projects that don't need it. Multi Shot exposes a capture-plan builder.
- **`screens/CreateProjectScreen.tsx`**: new "Photos per sample" section — Single Shot / Multi Shot toggle; Multi Shot reveals a slot builder (name + optional target angle per slot, add/remove).
- **`lib/projects.ts`**: `createProject` now takes `captureMode`/`captureSlots` and creates the appropriate `capture_slots` rows (one generic "Photo" slot for single-shot, or the researcher-defined list for multi-shot).

**Important limitation, documented in `docs/architecture.md`'s Capture flow**: angle-assist (phone tilt via `expo-sensors`) can only verify pitch/roll — it can confirm something like a top-down "Top" shot, but has no way to verify physical position (e.g. "am I on the correct side of the object" for a "Side 2" slot). That's on the researcher to get right physically (e.g. via markings on a rig); not a software gap to try to close.

**Not yet built**: the actual Capture screen that walks through slots, takes photos, and shows the shared form — still blocked on the camera hardware spike + native manual-exposure module (unchanged from before). This task only covers the data model and the project-creation-time configuration of capture mode/slots.

**Not yet done / acceptance criteria before calling this finished:**
- On-device testing: create a Multi Shot project with several named slots (including one with a target angle) and confirm they save correctly; create a Single Shot project and confirm no slot-builder UI appears and it still works exactly as before.

**Known gaps, not blocking (carried over from previous tasks):**
- Writes still go straight to Supabase, bypassing the offline-first SQLite layer — same deliberate, temporary deviation as before, now also applying to `samples`/`capture_slots`/etc.
- Guest-to-OAuth/email identity linking is still not implemented.
- Dependent category fields, camera calibration — still deferred (see below).

## Suggested build order (after this task)
1. ~~Navigation shell~~ / ~~Empty-state → project creation~~ / ~~Samples & capture modes~~ — done above.
2. Local SQLite schema + typed data-access layer (`projects`, `categories`, `category_options`, `fields`, `capture_slots`, `samples`, `sample_photos`, `sample_values`) — **now overdue**, since `lib/projects.ts` currently writes straight to Supabase and needs refactoring once this lands.
3. Camera hardware capability spike — verify Camera2 `INFO_SUPPORTED_HARDWARE_LEVEL` on the actual field device(s) before investing in the native manual-exposure module; `LEGACY`-level devices can't do manual exposure at all.
4. Guest → registered upgrade flow via Supabase identity linking (not yet built — current Log In/Sign Up/OAuth are separate accounts, not an upgrade path).
5. Dependent category fields — let a category field derive its value from a `number` field via threshold/range rules (`field_category_rules`), auto-filled but overridable in Capture.
6. Real inner-level tabs for an open project — Capture (per-slot angle-assist where applicable → native manual-exposure camera capture, walking through all of a project's `capture_slots` → shared logging form once the sample is complete), Fields (persistent schema editor, not just at creation), Data (table view + CSV/zip export, one row per sample with one photo column per slot) — replacing the `ProjectHomeScreen` placeholder.
7. Camera calibration screen — locked ISO/shutter/white-balance/resolution, whenever Capture is first opened for a project.
8. Supabase sync — push/pull unsynced rows, photo upload to Storage (this is where the offline-first SQLite layer and the direct-to-Supabase code converge).
9. Project sharing — invite collaborator by email, `project_members` UI/flow. (RLS policies already exist in `docs/schema.sql`.)

When the user assigns the next concrete task, replace this file's content with that task's specific scope and acceptance criteria.
