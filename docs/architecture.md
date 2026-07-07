# Architecture

## Overview
DataSnap is a mobile data-collection app: capture a photo, log structured data against it within a fully user-customizable field schema, organize work into projects, and export everything to CSV. Built for field researchers who are not comfortable with technology, so every flow favors simplicity, offline reliability, and accessibility over flexibility.

## Platform
- Android only, phone-first.
- No iOS or web target for v1.

## Tech Stack
- Expo SDK 56 (React Native 0.85, React 19), TypeScript strict.
- NativeWind v4 (Tailwind) for styling — already installed, no additional UI kit.
- React Navigation: bottom-tabs for the main sections, native-stack per tab for modals/detail screens.
- Zustand for lightweight app state (current capture draft, active project, sync status).
- A custom native Android camera module (Kotlin, built on Camera2/CameraX's `Camera2Interop`) for photo capture with locked manual exposure (ISO, shutter speed, white balance). `expo-camera`'s JS API has no manual exposure controls (verified against the SDK 56 docs — only `zoom`/`flash`/`enableTorch`/`autofocus`/`active` are exposed), so this requires real native code plus an Expo config plugin, not a stock library. Only works on devices reporting Camera2 hardware level `LIMITED` or better — verify this on the actual field device before relying on it; `LEGACY`-level devices cannot do manual exposure at all, hardware-level, regardless of software.
- `expo-sensors` (`DeviceMotion`) for the angle-assist tilt/level indicator shown during capture.
- `expo-sqlite` as the local, offline-first source of truth.
- `expo-file-system` for on-device photo storage.
- `expo-sharing` + a small CSV writer + a zip library (e.g. `react-native-zip-archive`) for bundled export.
- Supabase (Postgres + Auth + Storage) as the remote backend for sync, backup, and sharing.
- `@react-native-async-storage/async-storage` for Supabase auth session persistence.

## Auth Model
- Every user is a real Supabase Auth user — there is no separate "local-only" code path.
- **Guest**: signed in via Supabase anonymous auth (`signInAnonymously`) on first launch. Fully functional, but has no email and cannot send/receive project invites.
- **Registered**: email/password. A guest can upgrade in place via Supabase identity linking — this attaches an email/password to the same underlying user id, so all existing data (owned locally and already-synced remotely) carries over automatically with no migration step.
- The app works fully offline after the initial anonymous/registered sign-in; sync resumes automatically when connectivity returns.

## Data Model
Mirrored in Supabase Postgres and local SQLite. Ownership and sharing are scoped **per project**, not globally.

- `projects`: id, owner_id (auth user), name, created_at, camera_iso (nullable), camera_shutter_speed_ns (nullable), camera_white_balance (nullable — color-correction gains or Kelvin value), target_angle_degrees (nullable, default for the angle-assist tool, overridable per shot). Camera settings and target angle are configured once per project (a one-time calibration step during project creation) and locked across every capture in that project, matching a fixed-methodology capture protocol.
- `project_members`: project_id (FK), user_id (nullable until an invite is accepted), invited_email, role (`owner` | `collaborator`), status (`pending` | `accepted`), created_at. Governs sharing — a project's fields/categories/entries are visible and editable to its owner and any accepted collaborator, regardless of who created a given row.
- `categories`: id, owner_id, project_id (nullable — set when scope = `field`), name, scope (`global` | `field`), created_at. Global categories are reusable across any of the owning user's own projects; field-scoped categories are tied to exactly one field and not reusable elsewhere. Scope is chosen via a toggle at creation time.
- `category_options`: id, category_id (FK), label, sort_order — e.g. Wet / Dry / Very Dry.
- `fields`: id, project_id (FK), name, data_type (`text` | `number` | `date` | `boolean` | `category` | `photo`), category_id (nullable FK, set when data_type = `category`), source_field_id (nullable FK → another `fields.id` in the same project; set only when this is a *dependent* category field, and the referenced field must be `data_type = number`), sort_order, created_at.
- `field_category_rules`: id, field_id (FK → the dependent category field), category_option_id (FK), operator (`<` | `<=` | `>` | `>=` | `==` | `between`), value (numeric, used for single-operator comparisons), min_value / max_value (used when operator = `between`), sort_order (evaluation priority — rules are checked in order, first match wins, to resolve overlapping ranges).
- `entries`: id, project_id (FK), photo_local_uri, photo_remote_url (nullable until synced), created_at, synced_at (nullable). `id` is the auto-generated primary key and is always shown as the first, non-editable column in the data table UI.
- `entry_values`: entry_id (FK), field_id (FK), value (text, interpreted per `field.data_type` on read) — one row per field per entry.

Fields are entirely user-defined and change over time, so entries use an entity-attribute-value (`entry_values`) shape instead of a fixed-column table — this avoids altering table schema every time a researcher adds or removes a field. The `photo` data type stores a reference to a *secondary* photo, distinct from the one primary photo every entry already has via `entries.photo_local_uri`/`photo_remote_url`.

**Dependent category fields**: a category field can optionally derive its value from another `number` field in the same project (e.g. a "Classification" field set to "Dry" when "Moisture %" is around 3%). The rule set lives on the field (`field_category_rules`), not on the shared category, because the same category can be reused globally across fields/projects that each need different thresholds against different source fields. Rules are v1-scoped to `number` source fields only.

## Offline & Sync Strategy
- Every write (new project, field, category, entry) lands in `expo-sqlite` first, so the app is fully usable with zero connectivity.
- A sync module pushes unsynced rows (`synced_at IS NULL`) to Supabase when connectivity is available (checked on app foreground / periodic timer) and pulls changes made by project collaborators.
- Photos are written to local storage immediately; upload to Supabase Storage happens during the same sync pass, after which `photo_remote_url` is populated.
- Conflict handling: last-write-wins per row — acceptable given expected usage patterns, avoids building merge UI or live-presence infrastructure.

## Navigation Structure
Bottom tab navigator, 3 tabs, all scoped to the currently active project (a project switcher sits above the tabs since multi-project is core):
1. **Capture** — an angle-assist screen first: a live tilt/level indicator (via `expo-sensors`, no camera preview needed) shows a border that turns green once the phone matches the project's target angle (or a one-off override for that shot), with a haptic cue on alignment. The researcher then takes the photo using DataSnap's own camera, captured with the project's locked ISO/shutter-speed/white-balance via the native camera module — no app-switching required. The logging form (one input per field, in `sort_order`) appears immediately after. As the researcher fills in a `number` field, any category field depending on it auto-evaluates its rules and pre-fills the first matching option — as an editable suggestion, not a locked value, and left unset if no rule matches.
2. **Fields** — table-style schema editor for the active project. Lists current fields (id column pinned first); "+ Add Field" flow is name → data type → (if category) pick an existing global category, pick an existing field-scoped one, or create new with a Global/Field-only toggle → save. For a category field, an optional further step lets the researcher make it dependent on an existing `number` field in the project, defining one threshold/range rule per category option. Also hosts category management (edit/remove a category's options).
3. **Data** — spreadsheet-style view of all entries × fields for the active project, with an "Export" action.

A native-stack sits above the tab navigator for modals: project creation/switching, project sharing (invite by email), field creation, category creation/edit, entry detail/edit.

## Export
- Bundled export: a `.zip` containing a CSV (one row per entry, one column per field in `sort_order`, id column first, photo columns holding filenames) plus the actual referenced photo files.
- Built with `expo-file-system` (write the CSV + assemble the zip) + `expo-sharing` (share/save the resulting archive).

## UI/UX & Accessibility Principles
Target users are researchers unfamiliar with technology, and accessibility is a real requirement, not just "beginner-friendly":
- Every primary action reachable in ≤2 taps from a tab root; capture flow is linear (Photo → Form → Save), no branching choices mid-flow.
- Minimum 48×48dp touch targets, large legible text, icon + label pairing (never icon-only for primary actions), no color-only indicators (category chips always carry a text label too).
- Screen-reader support: `accessibilityLabel`/`accessibilityRole` on all interactive elements.
- Respect OS font-scaling settings (never disable it via `allowFontScaling={false}`); maintain WCAG AA-adequate contrast.
- Destructive actions (delete field, delete category, delete entry, remove a collaborator) always require a confirmation dialog.

## Out of scope for v1
- Real-time collaborative editing within a shared project (live presence, cursors, or conflict resolution beyond last-write-wins).
- iOS, web, or desktop targets.
- GPS/location field type.
