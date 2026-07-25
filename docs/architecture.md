# Architecture

## Overview
Jotter is a mobile data-collection app: capture a photo, log structured data against it within a fully user-customizable field schema, organize work into projects, and export everything to CSV. Built for field researchers who are not comfortable with technology, so every flow favors simplicity, offline reliability, and accessibility over flexibility.

## Platform
- Android only, phone-first.
- No iOS or web target for v1.

## Tech Stack
- Expo SDK 56 (React Native 0.85, React 19), TypeScript strict.
- NativeWind v4 (Tailwind) for styling — already installed, no additional UI kit.
- React Navigation: bottom-tabs for the main sections, native-stack per tab for modals/detail screens.
- Zustand for lightweight app state (current capture draft, active project, sync status).
- A custom native Android camera module (Kotlin, built on Camera2/CameraX's `Camera2Interop`) for photo capture with locked manual exposure (ISO, shutter speed, white balance). `expo-camera`'s JS API has no manual exposure controls (verified against the SDK 56 docs — only `zoom`/`flash`/`enableTorch`/`autofocus`/`active` are exposed), so this requires real native code plus an Expo config plugin, not a stock library. Only works on devices reporting Camera2 hardware level `LIMITED` or better — verify this on the actual field device before relying on it; `LEGACY`-level devices cannot do manual exposure at all, hardware-level, regardless of software.
  - The same module queries `StreamConfigurationMap.getOutputSizes()` for the device's actual supported still-capture resolutions, so the project camera-calibration step can recommend the maximum available resolution as the default (preserving detail for the downstream ML pipeline) while still letting the researcher pick a smaller one from the real device-supported list if storage/bandwidth matters more for their use case.
  - Photos are always encoded as JPEG at a fixed quality of **92/100**, app-wide (not researcher-configurable, unlike ISO/shutter/white-balance/resolution) — chosen because quality above ~90 has steeply diminishing returns on file size for a barely-perceptible visual difference, while materially lower settings risk compression artifacts that could confound color/texture-based classification.
- `expo-sensors` (`DeviceMotion`) for the angle-assist tilt/level indicator shown during capture.
- `expo-sqlite` as the local, offline-first source of truth.
- `expo-file-system` for on-device photo storage.
- `expo-sharing` + a small CSV writer + a zip library (e.g. `react-native-zip-archive`) for bundled export.
- Supabase (Postgres + Auth + Storage) as the remote backend for sync, backup, and sharing.
- `@react-native-async-storage/async-storage` for Supabase auth session persistence.

## Auth Model
- Every user is a real Supabase Auth user — there is no separate "local-only" code path.
- **Guest**: signed in via Supabase anonymous auth (`signInAnonymously`) on first launch. Fully functional, but has no email and cannot send/receive project invites.
- **Registered**: email/password, or OAuth via Google or GitHub. A guest can upgrade in place via Supabase identity linking — this attaches an email/password or OAuth identity to the same underlying user id, so all existing data (owned locally and already-synced remotely) carries over automatically with no migration step. (Guest-to-OAuth linking specifically is not yet wired up in code — current OAuth sign-in is a fresh session, same as email/password.)
- Google uses the native `@react-native-google-signin/google-signin` SDK + `supabase.auth.signInWithIdToken` (Supabase's recommended mobile pattern — faster UX, no browser redirect, but requires a Google Cloud Android OAuth Client ID tied to the app's signing SHA-1). GitHub has no native SDK, so it uses the browser-redirect flow (`expo-web-browser` + `expo-auth-session` + the app's `jotter://` URL scheme for the deep-link callback, per Supabase's documented React Native OAuth pattern).
- OAuth/anonymous/email users all land in Supabase's built-in `auth.users` — no separate `profiles` table; `owner_id`/`user_id` columns across the schema (`docs/schema.sql`) reference `auth.users(id)` directly.
- The app works fully offline after the initial anonymous/registered sign-in; sync resumes automatically when connectivity returns.

## Data Model
Mirrored in Supabase Postgres and local SQLite. Ownership and sharing are scoped **per project**, not globally. Exact column types, constraints, and foreign keys are in `docs/schema.sql`; this section is the conceptual summary.

- `projects`: id, owner_id (auth user), name, color (nullable — hex string, picked from a fixed set of preset swatches at creation), capture_mode (`single` | `multi`, default `single`), created_at, synced_at (nullable), camera_iso (nullable), camera_shutter_speed_ns (nullable), camera_white_balance (nullable — color-correction gains or Kelvin value), camera_resolution_width (nullable), camera_resolution_height (nullable). Camera settings and resolution are nullable and configured separately, later — whenever Capture is first opened for that project (not part of initial project creation) — and are then locked across every capture in that project, matching a fixed-methodology capture protocol. `capture_mode` governs whether a sample is one photo (`single`) or multiple named photos (`multi`, via `capture_slots`) — see Data Model below and the Capture flow under Navigation Structure.
- `project_members`: project_id (FK), user_id (nullable until an invite is accepted), invited_email, role (`owner` | `collaborator`), status (`pending` | `accepted`), created_at. Governs sharing — a project's fields/categories/samples are visible and editable to its owner and any accepted collaborator, regardless of who created a given row. No `synced_at` — sending an invite requires connectivity, so this table is written directly to Supabase rather than queued offline like the rest.
- `categories`: id, owner_id, project_id (nullable — set when scope = `field`), name, scope (`global` | `field`), created_at, synced_at (nullable). Global categories are reusable across any of the owning user's own projects; field-scoped categories are tied to exactly one field and not reusable elsewhere. Scope is chosen via a toggle at creation time.
- `category_options`: id, category_id (FK), label, sort_order, synced_at (nullable) — e.g. Wet / Dry / Very Dry.
- `fields`: id, project_id (FK), name, data_type (`text` | `number` | `date` | `boolean` | `category` | `photo` | `timestamp`), category_id (nullable FK, set when data_type = `category`), source_field_id (nullable FK → another `fields.id` in the same project; set only when this is a *dependent* category field, and the referenced field must be `data_type = number`), is_required (boolean, default false), is_sample_identifier (boolean, default false — at most one per project, enforced by a partial unique index), sort_order, created_at, synced_at (nullable).
- `field_category_rules`: id, field_id (FK → the dependent category field), category_option_id (FK), operator (`<` | `<=` | `>` | `>=` | `==` | `between`), value (numeric, used for single-operator comparisons), min_value / max_value (used when operator = `between`), sort_order (evaluation priority — rules are checked in order, first match wins, to resolve overlapping ranges), synced_at (nullable).
- `capture_slots`: id, project_id (FK), label (text, researcher-defined — e.g. "Top", "Bottom", "Side 1"), target_angle_degrees (nullable — a tilt target for angle-assist, meaningful for some slots like a top-down shot, not others; see Capture flow), sort_order, synced_at (nullable). Defines the ordered set of named photo positions that make up one complete sample for a project. A `single`-capture_mode project has exactly one auto-created slot, hidden from the researcher; a `multi`-capture_mode project's researcher builds this list themselves (this is what generalizes an arbitrary "N angles per sample" scheme rather than hardcoding any particular count or naming).
- `samples`: id, project_id (FK), created_at, synced_at (nullable). The actual unit of data — replaces the old single-photo-per-row `entries` concept. `id` is the auto-generated primary key and is always shown as the first, non-editable column in the data table UI.
- `sample_photos`: id, sample_id (FK), capture_slot_id (FK), photo_local_uri, photo_remote_url (nullable until synced), created_at, synced_at (nullable). One row per (sample, capture_slot) pair — a sample is "complete" once it has a photo for every capture_slot its project defines.
- `sample_values`: sample_id (FK), field_id (FK), value (text, interpreted per `field.data_type` on read) — one row per field per sample; the composite `(sample_id, field_id)` primary key enforces that directly.

Fields are entirely user-defined and change over time, so samples use an entity-attribute-value (`sample_values`) shape instead of a fixed-column table — this avoids altering table schema every time a researcher adds or removes a field. The `photo` field data type stores a reference to an *additional* photo tied to a specific field (e.g. a close-up), distinct from the sample's own capture-slot photos in `sample_photos`. The `timestamp` data type is an opt-in, visible "captured at" column — auto-populated from the same moment already recorded in `samples.created_at` when the sample is saved, not typed in by the researcher and not editable afterward, distinct from `date` (a manual entry, e.g. for recording a collection date that differs from the capture day).

**Dependent category fields**: a category field can optionally derive its value from another `number` field in the same project (e.g. a "Classification" field set to "Dry" when "Moisture %" is around 3%). The rule set lives on the field (`field_category_rules`), not on the shared category, because the same category can be reused globally across fields/projects that each need different thresholds against different source fields. Rules are v1-scoped to `number` source fields only.

**Data integrity — required fields and sample identifiers**: a field can be marked `is_required`, which blocks saving a sample until that field has a value — a hard block, unlike the dependent-category auto-fill, since a genuinely required field has no reasonable "leave it blank" case. Separately, a project may designate **one** field as `is_sample_identifier` — an opt-in, human-chosen ID the researcher types in themselves (distinct from `samples.id`, the system's own auto-generated UUID, which is unique by construction and never needs checking). When a project has a designated identifier field:
- **At save time**, the just-entered value is checked against every other sample's value for that field in the project; a match shows a non-blocking warning ("already used for another sample — continue anyway, or go back and fix it?"), not a hard stop, since a legitimate re-check is possible.
- **At export time**, every sample's value for that field is checked again, grouped by value; any value used by more than one sample is surfaced as a duplicate-ID summary alongside the export, catching anything missed in the field.

## Offline & Sync Strategy
- Every write (new project, field, category, sample) lands in `expo-sqlite` first, so the app is fully usable with zero connectivity.
- A sync module pushes unsynced rows (`synced_at IS NULL`) to Supabase when connectivity is available (checked on app foreground / periodic timer), **plus an immediate sync attempt triggered right when a sample is confirmed complete** (all required capture slots and required fields present) — the periodic/foreground check exists as a catch-all for anything created while offline, not as the only trigger. Also pulls changes made by project collaborators.
- Photos are written to local storage immediately; upload to Supabase Storage happens during the same sync pass, after which `photo_remote_url` is populated.
- Conflict handling: last-write-wins per row — acceptable given expected usage patterns, avoids building merge UI or live-presence infrastructure.

## Navigation Structure
Two distinct navigation levels — which one is showing depends on whether the user is "inside" a project:

**Outer level (no project open)** — its own nav bar, e.g. Projects / Account. This is what a signed-in user sees by default:
- If they have zero projects (first account ever, or all projects deleted), the Projects screen is an empty state prompting them to start — confirming takes them to a single project-creation screen covering name, color, and initial field/category setup together. On save, a "Project has been created" confirmation appears and the user is redirected straight into that project (inner level below).
- If they have one or more projects, this is a project list/switcher instead.
- Account covers profile/sign-out/account-level settings (not project-specific).

**Inner level (inside a project)** — the bottom tab navigator only appears here, 3 tabs, all scoped to the currently open project:
1. **Capture** — behavior depends on the project's `capture_mode`:
   - **Single** (default): works as a single-slot case of the same underlying flow below — one photo, then the form. The researcher never sees "slots" at all.
   - **Multi**: the researcher steps through each of the project's `capture_slots` in order, shooting one photo per slot, before the sample is complete.
   - For each slot: an angle-assist screen first (if that slot has a `target_angle_degrees`) — a live tilt/level indicator (via `expo-sensors`, no camera preview needed) shows a border that turns green once the phone matches the slot's target tilt, with a haptic cue on alignment. Angle-assist can only verify phone tilt (pitch/roll), not physical position — e.g. it can confirm a top-down "Top" shot, but has no way to verify the camera is actually on the correct *side* of the object for something like "Side 2"; that's on the researcher to position correctly (e.g. via markings on a physical rig). The researcher then takes the photo using Jotter's own camera, captured with the project's locked ISO/shutter-speed/white-balance via the native camera module — no app-switching required.
   - Once every slot for the current sample has a photo, the logging form (one input per field, in `sort_order`, shared across the whole sample) appears, skipping any `timestamp`-type field entirely — its value is auto-written at save time, not entered by the researcher. As the researcher fills in a `number` field, any category field depending on it auto-evaluates its rules and pre-fills the first matching option — as an editable suggestion, not a locked value, and left unset if no rule matches. A field marked `is_required` blocks Save Sample until it has a value; a project's designated `is_sample_identifier` field (if any) is checked against every other sample's value for it as soon as it's entered, warning (not blocking) on a match.
2. **Fields** — plain list schema editor for the active project, not a spreadsheet. Locked/read-only by default; an "Edit" toggle exposes per-field delete and "+ Add Field". "+ Add Field" flow is name → data type (`text` | `number` | `date` | `boolean` | `category` | `photo` | `timestamp`) → (if category) pick an existing global category, pick an existing field-scoped one, or create new with a Global/Field-only toggle → save. For a category field, an optional further step lets the researcher make it dependent on an existing `number` field in the project, defining one threshold/range rule per category option. Also hosts category management (edit/remove a category's options).
3. **Data** — empty state ("capture your first sample") until the project has at least one sample; once it does, a spreadsheet-style view of all samples × fields for the active project (column letters, frozen id gutter, one row per sample), with an "Export" action. The spreadsheet visual lives here, not on Fields — Fields is schema-only.

Camera calibration (locked ISO/shutter/white-balance/resolution/target-angle) is deliberately **not** part of initial project creation — it's set up later, whenever Capture is first opened for that project, to keep the creation screen focused.

A native-stack sits above the tab navigator for modals: project creation/switching, project sharing (invite by email), field creation, category creation/edit, sample detail/edit.

## Export
- Bundled export: a `.zip` containing a CSV (one row per sample, one column per field in `sort_order`, id column first, plus one photo-filename column per capture_slot) plus the actual referenced photo files.
- If the project has an `is_sample_identifier` field, export re-checks every sample's value for it and includes a duplicate-ID summary alongside the archive — export is never blocked by this, it's a final catch-all after the save-time warning.
- Built with `expo-file-system` (write the CSV + assemble the zip) + `expo-sharing` (share/save the resulting archive).

## UI/UX & Accessibility Principles
Target users are researchers unfamiliar with technology, and accessibility is a real requirement, not just "beginner-friendly":
- Every primary action reachable in ≤2 taps from a tab root; capture flow is linear (Photo → Form → Save), no branching choices mid-flow.
- Minimum 48×48dp touch targets, large legible text, icon + label pairing (never icon-only for primary actions), no color-only indicators (category chips always carry a text label too).
- Screen-reader support: `accessibilityLabel`/`accessibilityRole` on all interactive elements.
- Respect OS font-scaling settings (never disable it via `allowFontScaling={false}`); maintain WCAG AA-adequate contrast.
- Destructive actions (delete project, delete field, delete category, delete sample, remove a collaborator) always require a confirmation dialog.

## Out of scope for v1
- Real-time collaborative editing within a shared project (live presence, cursors, or conflict resolution beyond last-write-wins).
- iOS, web, or desktop targets.
- GPS/location field type.
