# Current Task

**Status: No active task — planning/docs only so far.** Nothing has been implemented; the repo is still the blank Expo starter.

## Suggested build order (for when work begins)
1. Navigation shell — bottom tabs (Capture / Fields / Data) + a project switcher, no logic yet.
2. Camera hardware capability spike — verify Camera2 `INFO_SUPPORTED_HARDWARE_LEVEL` on the actual field device(s) before investing in the native manual-exposure module; `LEGACY`-level devices can't do manual exposure at all.
3. Local SQLite schema + typed data-access layer (`projects`, `categories`, `category_options`, `fields`, `entries`, `entry_values`).
4. Auth — anonymous sign-in on first launch, upgrade-to-registered (email/password) flow via identity linking.
5. Fields tab — create/list fields, category management with the Global/Field-only toggle.
   - Dependent category fields — let a category field derive its value from a `number` field via threshold/range rules (`field_category_rules`), auto-filled but overridable in Capture.
6. Capture tab — angle-assist (sensor-based tilt indicator, target angle from the project or a per-shot override) → native manual-exposure camera capture (locked ISO/shutter/white-balance from the project's calibration) → logging form → save entry.
7. Data tab — table view + CSV/zip export (CSV + referenced photos).
8. Supabase sync — push/pull unsynced rows, photo upload to Storage.
9. Project sharing — invite collaborator by email, `project_members`, RLS policies.

When the user assigns a concrete task, replace this file's content with that task's specific scope and acceptance criteria — don't keep the backlog and the active task mixed together.
