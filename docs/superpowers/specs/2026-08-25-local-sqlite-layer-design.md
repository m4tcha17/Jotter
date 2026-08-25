# Local SQLite Layer — Design Spec

## Scope

This is sub-project 1 of 2 for making the app offline-first, per `docs/architecture.md`'s "Offline & Sync Strategy" section. It makes every write in the app land in local `expo-sqlite` storage instead of going straight to Supabase — the app becomes fully usable with zero connectivity. **Explicitly out of scope, deferred to a second spec/plan:** the sync engine that pushes unsynced rows to Supabase, uploads photos to Storage, and (per the user's decision) does NOT pull collaborator changes — one-way push only, when it ships.

**Decisions locked in during brainstorming:**
- One-way push only (no pull-sync) for the future sync engine — single-researcher workflow today, no active collaborators.
- A one-time seed-from-Supabase step runs on first launch after this ships, pulling existing Supabase data into the fresh local DB once, so existing projects/samples don't appear to vanish. Requires connectivity; has a retry/skip gate if offline.
- Captured photos move from the native camera module's cache-dir output to a persistent `Paths.document` location as part of this work — closes a real durability gap (the OS can purge cache-dir files at any time), and is tightly coupled to "local storage is now the source of truth" even though it touches the camera capture path, not just the DB layer.
- `project_members` stays a direct-Supabase table, unchanged — already carved out in `docs/architecture.md` ("sending an invite requires connectivity, so this table is written directly to Supabase rather than queued offline").

## Architecture

`lib/db.ts` is a new plain singleton module (matches this repo's existing `lib/supabase.ts` pattern — no React Context/Provider, since `api.ts` functions aren't components and need to call this from anywhere). It owns:
- Opening the SQLite connection (`expo-sqlite`'s `openDatabaseAsync`), lazily, memoized so repeated calls return the same open connection.
- Running migrations via `PRAGMA user_version` (Expo's own canonical pattern — read the version, run any pending `CREATE TABLE`/`ALTER` statements in order, bump the version, all inside one transaction).
- `PRAGMA foreign_keys = ON` on every connection open — SQLite disables FK enforcement by default per-connection, so every `REFERENCES ... ON DELETE CASCADE` below is inert unless this is set.
- `newId(): string` — `expo-crypto`'s `randomUUID()`. Confirmed against the SDK 56 source: Android/Hermes has no global `crypto.randomUUID`, so `expo-crypto` (a new dependency) is required, not optional.
- `nowIso(): string` — `new Date().toISOString()`.

Each domain module's `api.ts` (`modules/projects/api.ts`, `modules/fields/api.ts`, `modules/capture/api.ts`, `modules/samples/api.ts`) gets rewritten to call `getDb()` and run SQL instead of `supabase.from(...)`. **Every exported function keeps its exact current name and signature** — screens (`ProjectsScreen`, `CreateProjectScreen`, `FieldsScreen`, `CaptureScreen`, `SampleForm`, `DataScreen`, etc.) do not change at all. This is the entire point of Approach A over a repository abstraction: the blast radius is contained to the 4 `api.ts` files plus the new `lib/db.ts`.

## Local Schema

Adapted from `docs/schema.sql` per its own header comment: `uuid` → `TEXT`, `timestamptz` → `TEXT` (ISO 8601), `boolean` → `INTEGER` (0/1), no `auth.users` foreign keys (auth is enforced remotely only). No RLS locally — the device only ever holds one signed-in user's data.

**Note on `sample_photos.capture_slot_id`:** `docs/schema.sql` still shows `ON DELETE RESTRICT` for this column, but that was changed to `ON DELETE CASCADE` in production via migration `supabase/migrations/20260803051000_fix_sample_photos_capture_slot_cascade.sql` (the restrict was blocking project deletion — see that migration's own commit message). `docs/schema.sql` itself is stale and should eventually be regenerated from the live DB, but that's a pre-existing, unrelated doc-drift issue — out of scope here. The local schema below matches the **corrected** (cascade) behavior, not the stale doc.

```sql
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  camera_iso INTEGER,
  camera_shutter_speed_ns INTEGER,
  camera_white_balance TEXT,
  camera_resolution_width INTEGER,
  camera_resolution_height INTEGER,
  capture_mode TEXT NOT NULL DEFAULT 'single' CHECK (capture_mode IN ('single', 'multi')),
  created_at TEXT NOT NULL,
  synced_at TEXT
);
CREATE INDEX IF NOT EXISTS projects_owner_id_idx ON projects(owner_id);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'field')),
  created_at TEXT NOT NULL,
  synced_at TEXT
);
CREATE INDEX IF NOT EXISTS categories_owner_id_idx ON categories(owner_id);
CREATE INDEX IF NOT EXISTS categories_project_id_idx ON categories(project_id);

CREATE TABLE IF NOT EXISTS category_options (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  synced_at TEXT,
  UNIQUE (category_id, label)
);
CREATE INDEX IF NOT EXISTS category_options_category_id_idx ON category_options(category_id);

CREATE TABLE IF NOT EXISTS fields (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data_type TEXT NOT NULL CHECK (
    data_type IN ('text', 'number', 'date', 'boolean', 'category', 'photo', 'timestamp')
  ),
  category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
  source_field_id TEXT REFERENCES fields(id) ON DELETE SET NULL,
  is_required INTEGER NOT NULL DEFAULT 0,
  is_sample_identifier INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  synced_at TEXT,
  UNIQUE (project_id, name)
);
CREATE INDEX IF NOT EXISTS fields_project_id_idx ON fields(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS fields_one_identifier_per_project
  ON fields(project_id) WHERE is_sample_identifier = 1;

CREATE TABLE IF NOT EXISTS field_category_rules (
  id TEXT PRIMARY KEY,
  field_id TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  category_option_id TEXT NOT NULL REFERENCES category_options(id) ON DELETE CASCADE,
  operator TEXT NOT NULL CHECK (operator IN ('<', '<=', '>', '>=', '==', 'between')),
  value REAL,
  min_value REAL,
  max_value REAL,
  sort_order INTEGER NOT NULL,
  synced_at TEXT
);
CREATE INDEX IF NOT EXISTS field_category_rules_field_id_idx ON field_category_rules(field_id);

CREATE TABLE IF NOT EXISTS capture_slots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  target_angle_degrees REAL,
  sort_order INTEGER NOT NULL,
  synced_at TEXT,
  UNIQUE (project_id, label)
);
CREATE INDEX IF NOT EXISTS capture_slots_project_id_idx ON capture_slots(project_id);

CREATE TABLE IF NOT EXISTS samples (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  synced_at TEXT
);
CREATE INDEX IF NOT EXISTS samples_project_id_idx ON samples(project_id);

CREATE TABLE IF NOT EXISTS sample_photos (
  id TEXT PRIMARY KEY,
  sample_id TEXT NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
  capture_slot_id TEXT NOT NULL REFERENCES capture_slots(id) ON DELETE CASCADE,
  photo_local_uri TEXT,
  photo_remote_url TEXT,
  created_at TEXT NOT NULL,
  synced_at TEXT,
  UNIQUE (sample_id, capture_slot_id)
);
CREATE INDEX IF NOT EXISTS sample_photos_sample_id_idx ON sample_photos(sample_id);
CREATE INDEX IF NOT EXISTS sample_photos_capture_slot_id_idx ON sample_photos(capture_slot_id);

CREATE TABLE IF NOT EXISTS sample_values (
  sample_id TEXT NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
  field_id TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  value TEXT,
  PRIMARY KEY (sample_id, field_id)
);
CREATE INDEX IF NOT EXISTS sample_values_field_id_idx ON sample_values(field_id);
```

## Write Path

Every insert/update goes to local SQLite only (no Supabase call in this phase). `newId()` generates the row id client-side (Postgres's `gen_random_uuid()` ran server-side; there is no server round-trip now). `nowIso()` stamps `created_at`. `synced_at` is always written as `NULL` on insert and update — the column already exists in the schema for the future sync engine to consume (`WHERE synced_at IS NULL` = "needs push"); in this phase nothing reads it yet, so every row simply stays `NULL` forever until sync engine ships.

## Read Path

`fetchX` functions run flat per-table `SELECT`s via `getDb().getAllAsync(...)` and assemble nested shapes in JS — e.g. `fetchSamples` runs one query against `samples`, one against `sample_values` (or a `WHERE sample_id IN (...)`), one against `sample_photos`, then folds them into `SampleRow.values`/`.photos` exactly as the current Supabase-backed version already does in JS after its nested `.select()`. This avoids writing SQL `JOIN`/`GROUP BY` logic to reproduce what Postgres's nested-select already did automatically — the reshaping code that exists today mostly ports over unchanged, only the query itself changes.

## Seed-on-First-Launch

Gated by an AsyncStorage flag (`@react-native-async-storage/async-storage` is already a dependency). On first run after this ships:
1. Show a blocking "Setting up your data" screen.
2. Fetch the signed-in user's existing rows from Supabase in FK-safe order. Only `projects` and `categories` carry `owner_id` directly (`categories.project_id IS NULL` = a global category, owned directly; `categories.project_id IS NOT NULL` = field-scoped, tied to a project); every other table has no `owner_id` of its own and is scoped transitively via `project_id` (or, for `category_options`/`field_category_rules`, via their parent row): `projects WHERE owner_id = auth.uid()` → `categories WHERE owner_id = auth.uid()` (covers both global and this user's field-scoped categories) → `category_options WHERE category_id IN (<fetched category ids>)` → `fields WHERE project_id IN (<fetched project ids>)` → `field_category_rules WHERE field_id IN (<fetched field ids>)` → `capture_slots WHERE project_id IN (...)` → `samples WHERE project_id IN (...)` → `sample_photos WHERE sample_id IN (<fetched sample ids>)` → `sample_values WHERE sample_id IN (...)`.
3. Insert each row into local SQLite **using the same ids** (they're already valid UUIDs from Postgres — no re-keying), with `synced_at = nowIso()` on every seeded row (it's already synced by definition; this stops the future push engine from re-pushing old data as if it were new).
4. Set the AsyncStorage flag, proceed into the app.
5. **If step 2 fails** (offline, error): show a retry button, plus a "Skip for now" escape hatch — old data stays untouched in Supabase, just invisible locally until the user retries seeding later (re-triggerable from Account settings, not just first launch). This prevents a real connectivity outage from permanently locking the user out of the app.

## Photo Relocation

Wherever the camera module's `takePicture()` result (a `file://.../cache/...` URI) currently flows into the app — `modules/camera/CameraCaptureStep.tsx`'s capture callback, and the `photo`-data-type field capture path in `modules/samples/SampleForm.tsx` — copy it to `Paths.document` before it's stored as `photo_local_uri`/a `sample_values` entry. Filename: `${newId()}.jpg` (a fresh UUID, not derived from the sample, since capture happens *before* the sample row exists for slot photos — a fresh id sidesteps ordering entirely and can never collide). The native camera module itself is untouched; this is a JS-side copy immediately after `takePicture()` resolves.

## Error Handling

- Local SQLite read/write failures: wrapped in try/catch, surfaced via `Alert.alert(title, err instanceof Error ? err.message : 'Something went wrong.')` — the exact convention already used throughout this codebase (confirmed during the CSV export work).
- Migration failure on startup: fatal, since the app cannot function without its schema. A dedicated init-error screen (not a toast/alert that can be dismissed into a broken app).
- Seed failure: the retry/skip gate above — never a silent failure into an empty DB the user doesn't know is empty.

## Testing

`expo-sqlite` is a native module with no Jest mock in this project (confirmed: no `jest-expo` stub, no in-memory fallback available) — actual SQL execution is not unit-testable here, the same situation this project already hit with `react-native-zip-archive` in the CSV export work. Splitting the same way that work did:
- **Unit-testable (TDD):** pure row-shaping functions that convert flat SQL result rows into the app's existing typed shapes (`ProjectField`, `SampleRow`, etc.) — these take plain objects/arrays in, return plain objects out, no `expo-sqlite` reference.
- **Not unit-testable, manual on-device verification only:** `lib/db.ts` (connection, migration, `PRAGMA` handling), the SQL-executing bodies of the rewritten `api.ts` functions, the seed flow, and the photo relocation copy.

## Out of Scope (this spec)

- The sync engine itself (push unsynced rows, upload photos to Storage) — a second spec/plan.
- Pull-sync / collaborator changes / conflict resolution — explicitly deferred per the one-way-push decision.
- `project_members` — stays direct-Supabase, unchanged.
- Regenerating the stale `docs/schema.sql` doc to match the live `sample_photos.capture_slot_id` cascade fix — a pre-existing, unrelated doc-drift issue.
