# Current Task

**Empty-state → project creation flow — done, on-device testing still needed.**

Navigation is now two-level, per `docs/architecture.md`'s Navigation Structure:
- **Outer level**: `navigation/MainTabs.tsx` — bottom tabs `Projects` / `Account`, shown right after sign-in.
  - `screens/ProjectsScreen.tsx` — if the signed-in user has zero projects, shows the "Start Gathering Data" empty state; otherwise a tappable project list (color dot + name).
  - `screens/AccountScreen.tsx` — the account-info content that used to live in `HomeScreen.tsx` (now deleted; folded in here). Sign-out lives here.
- **Project creation**: `screens/CreateProjectScreen.tsx` — one screen for name, color (preset swatch picker, no color-picker library needed), and an "+ Add Field" flow (`components/AddFieldModal.tsx`) covering all 7 data types, with inline category creation (name, Global/Field-only toggle, options list) or picking an existing global category. On save, shows a "Project has been created" alert, then redirects into `screens/ProjectHomeScreen.tsx` (placeholder — the real Capture/Fields/Data inner tabs are a separate follow-up task).
- `lib/projects.ts` — `fetchProjects`, `fetchGlobalCategories`, `createProject` (inserts the project, then any new categories + their options, then the fields, in sequence) — talks to Supabase **directly**, not through local SQLite.

**Deliberate scope decisions from this task:**
- Dependent category fields (the `field_category_rules` threshold/range builder) were explicitly deferred — the category flow here only covers picking/creating a category, not making one derive from a `number` field. Follow-up task.
- Camera calibration (locked ISO/shutter/white-balance/resolution/target-angle) is explicitly **not** part of project creation — deferred to whenever Capture is first opened for a project, confirmed by the user and reflected in `docs/architecture.md`.
- **Writes go straight to Supabase, bypassing the offline-first SQLite layer** described in `docs/architecture.md`'s Offline & Sync Strategy — because the "Local SQLite schema" build step (still queued, see below) hasn't happened yet, and building the full local-first + sync layer in the same pass as this UI would have been too much at once. This is a known, temporary architecture deviation: `createProject` will need to be refactored to write-through-local-first once SQLite lands, not a permanent design choice.
- Icon/branding assets — explicitly the user's responsibility, not mine.

**Schema changes made this task:**
- `projects.color` (text, nullable) added via `supabase/migrations/20260710072317_add_project_color.sql`, pushed live and reflected in `docs/schema.sql`/`docs/architecture.md`.
- Also fixed a pre-existing drift found while verifying the database against `docs/schema.sql`: `projects.camera_resolution_width`/`camera_resolution_height` existed in the doc but not the live table (added to the doc after the initial manual SQL Editor run) — closed via `20260710070845_add_camera_resolution_columns.sql`.

**Not yet done / acceptance criteria before calling this finished:**
- On-device testing of the whole flow: empty state → create project (with at least one of each field data type, plus both new and existing categories) → confirmation → redirect into `ProjectHome`, then back to `Projects` showing the new project in the list.
- Confirm `useFocusEffect`-driven refetch in `ProjectsScreen` actually shows a newly created project immediately after returning from `ProjectHome`.

**Known gaps, not blocking:**
- Guest-to-OAuth/email identity linking is still not implemented — every sign-in method starts a fresh session.

## Suggested build order (after this task)
1. ~~Navigation shell~~ / ~~Empty-state → project creation~~ — done above.
2. Local SQLite schema + typed data-access layer (`projects`, `categories`, `category_options`, `fields`, `entries`, `entry_values`) — **now overdue**, since `lib/projects.ts` currently writes straight to Supabase and needs refactoring once this lands.
3. Camera hardware capability spike — verify Camera2 `INFO_SUPPORTED_HARDWARE_LEVEL` on the actual field device(s) before investing in the native manual-exposure module; `LEGACY`-level devices can't do manual exposure at all.
4. Guest → registered upgrade flow via Supabase identity linking (not yet built — current Log In/Sign Up/OAuth are separate accounts, not an upgrade path).
5. Dependent category fields — let a category field derive its value from a `number` field via threshold/range rules (`field_category_rules`), auto-filled but overridable in Capture. Deferred from this task.
6. Real inner-level tabs for an open project — Capture (angle-assist → native manual-exposure camera capture → logging form), Fields (persistent schema editor, not just at creation), Data (table view + CSV/zip export) — replacing the `ProjectHomeScreen` placeholder.
7. Camera calibration screen — locked ISO/shutter/white-balance/resolution/target-angle, whenever Capture is first opened for a project.
8. Supabase sync — push/pull unsynced rows, photo upload to Storage (this is where the offline-first SQLite layer and the direct-to-Supabase code from this task converge).
9. Project sharing — invite collaborator by email, `project_members` UI/flow. (RLS policies already exist in `docs/schema.sql`.)

When the user assigns the next concrete task, replace this file's content with that task's specific scope and acceptance criteria.
