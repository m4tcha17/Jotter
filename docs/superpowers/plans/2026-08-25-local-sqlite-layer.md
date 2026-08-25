# Local SQLite Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every write in the app land in local `expo-sqlite` storage instead of Supabase, so the app is fully usable with zero connectivity.

**Architecture:** A new `lib/db.ts` singleton owns the SQLite connection, schema migrations, and id/timestamp helpers, following the existing `lib/supabase.ts` plain-singleton pattern. Each domain module's `api.ts` (`projects`, `fields`, `capture`, `samples`) is rewritten in place to call `getDb()` instead of `supabase.from(...)`, keeping exact function names/signatures so no screen changes. A one-time seed step pulls existing Supabase data into the fresh local DB on first launch after this ships.

**Tech Stack:** `expo-sqlite` (~56.0.5, already installed), `expo-crypto` (new dependency, for `randomUUID()`), `expo-file-system` (~56.0.8, already installed, new `File`/`Directory`/`Paths` API — same one used in the CSV export feature), `@react-native-async-storage/async-storage` (already installed, for the seed flag).

**Spec:** `docs/superpowers/specs/2026-08-25-local-sqlite-layer-design.md`

## Global Constraints

- Expo SDK 56 — verified against `/expo/expo` versioned docs (`__branch__sdk-56`), not training-data assumptions, per `AGENTS.md`.
- Never mention "thesis" in code, comments, UI copy, or commit messages.
- **Current-user id for `owner_id` columns must come from `supabase.auth.getSession()` (local cache, offline-safe), never `supabase.auth.getUser()` (always round-trips to the Auth server)** — this is the existing convention in `modules/account/CLAUDE.md` and is load-bearing here: using `getUser()` anywhere in a write path would silently break offline writes, defeating the point of this feature.
- No RLS locally; local schema has no `auth.users` foreign keys (per spec's Architecture section) — every table below matches the DDL already locked into the spec verbatim.
- `PRAGMA foreign_keys = ON` must run on every connection open, or every `ON DELETE CASCADE`/`RESTRICT`/`SET NULL` in the schema is silently inert (SQLite disables FK enforcement by default per-connection).
- New/touched screens (`SeedScreen.tsx`) follow `DESIGN.md`'s dark-only "Calibration Bench" system — no light-mode classes (`bg-white`, `slate-*`, `emerald-*`, `rounded-xl`).
- Accessibility floor: `accessibilityRole`/`accessibilityLabel` on every interactive element, 48×48dp minimum touch targets, never `allowFontScaling={false}`.
- `expo-sqlite` has no Jest mock in this project — SQL-executing code is not unit-testable here (confirmed in the spec, same situation this project already hit with `react-native-zip-archive` in the CSV export work). Only pure row-shaping functions (flat SQL rows in, typed shapes out) get automated tests; everything else gets `npx tsc --noEmit` + manual on-device verification.
- Never run `expo run:android`/`expo run:ios` — the user builds/launches on-device themselves.

---

### Task 1: `lib/db.ts` — connection, migrations, id/timestamp helpers

**Files:**
- Create: `lib/db.ts`
- Modify: `package.json` (add `expo-crypto`)
- Modify: `lib/CLAUDE.md`

**Interfaces:**
- Produces: `getDb(): Promise<SQLiteDatabase>`, `getCurrentUserId(): Promise<string | null>`, `newId(): string`, `nowIso(): string` — every later task imports these from `../../lib/db`.

- [ ] **Step 1: Install `expo-crypto`**

Run: `npx expo install expo-crypto`

Confirms it lands in `package.json` under the SDK-56-compatible version Expo's installer resolves.

- [ ] **Step 2: Write `lib/db.ts`**

```typescript
import { openDatabaseAsync } from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';

import { supabase } from './supabase';

const SCHEMA_V1 = `
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
`;

let dbPromise: Promise<SQLiteDatabase> | null = null;

async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    let version = result?.user_version ?? 0;
    if (version < 1) {
      await db.execAsync(SCHEMA_V1);
      version = 1;
    }
    await db.execAsync(`PRAGMA user_version = ${version}`);
  });
}

export async function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await openDatabaseAsync('jotter.db');
      await db.execAsync('PRAGMA foreign_keys = ON');
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

// Local cache read only — never supabase.auth.getUser(), which round-trips to the
// Auth server and would break every write path the moment the device is offline.
export async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean (no errors from `lib/db.ts`).

- [ ] **Step 4: Update `lib/CLAUDE.md`**

Replace the file's contents with:

```markdown
# lib/

`supabase.ts` — the Supabase client singleton plus offline-aware session helpers (`signOutLocally`, `flushPendingRevocations`). `db.ts` — the local SQLite connection singleton (`getDb`), schema migrations via `PRAGMA user_version`, and shared write-path helpers (`getCurrentUserId`, `newId`, `nowIso`). These two files are the only cross-cutting infra shared by every module.

- All domain data access (projects, fields, capture slots, samples) lives in each `modules/<domain>/api.ts` instead — don't add a new domain function here. If it's about a specific domain concept, it belongs in that module, not `lib/`.
- `getCurrentUserId()` reads `supabase.auth.getSession()` (local cache) — never call `supabase.auth.getUser()` from a write path, it round-trips to the Auth server and breaks offline writes.
- `expo-sqlite` has no Jest mock in this project — `db.ts` itself is not unit-testable; verify with `npx tsc --noEmit` plus on-device checks. Pure row-shaping helpers in each domain's `api.ts` are the unit-testable layer.
```

- [ ] **Step 5: Commit**

```bash
git add lib/db.ts lib/CLAUDE.md package.json package-lock.json
git commit -m "feat(db): add local SQLite connection singleton with schema migrations"
```

---

### Task 2: Rewrite `modules/fields/api.ts` for SQLite

**Files:**
- Modify: `modules/fields/api.ts`
- Create: `modules/fields/__tests__/api.test.ts`
- Modify: `modules/fields/CLAUDE.md`

**Interfaces:**
- Consumes: `getDb(): Promise<SQLiteDatabase>`, `getCurrentUserId(): Promise<string | null>`, `newId(): string`, `nowIso(): string` from `../../lib/db` (Task 1).
- Produces: `insertFieldWithCategory(userId: string, projectId: string, field: NewFieldInput, sortOrder: number): Promise<void>` — consumed by `modules/projects/api.ts`'s `createProject` (Task 4). All other exports (`fetchFields`, `fetchGlobalCategories`, `addField`, `deleteField`, `ProjectField`, `NewFieldInput`, etc.) keep their exact current names/shapes.

- [ ] **Step 1: Write the failing test for the pure row-assembly function**

```typescript
// modules/fields/__tests__/api.test.ts
import { assembleFields } from '../api';

describe('assembleFields', () => {
  it('attaches a category with its options sorted by sort_order', () => {
    const result = assembleFields(
      [
        {
          id: 'f1',
          name: 'Color',
          data_type: 'category',
          sort_order: 0,
          is_required: 0,
          is_sample_identifier: 0,
          category_id: 'c1',
        },
      ],
      [{ id: 'c1', name: 'Colors' }],
      [
        { id: 'o2', category_id: 'c1', label: 'Blue', sort_order: 1 },
        { id: 'o1', category_id: 'c1', label: 'Red', sort_order: 0 },
      ],
    );

    expect(result).toEqual([
      {
        id: 'f1',
        name: 'Color',
        data_type: 'category',
        sort_order: 0,
        is_required: false,
        is_sample_identifier: false,
        category: {
          id: 'c1',
          name: 'Colors',
          options: [
            { id: 'o1', label: 'Red', sort_order: 0 },
            { id: 'o2', label: 'Blue', sort_order: 1 },
          ],
        },
      },
    ]);
  });

  it('leaves category null for a field with no category_id', () => {
    const result = assembleFields(
      [
        {
          id: 'f2',
          name: 'Notes',
          data_type: 'text',
          sort_order: 1,
          is_required: 1,
          is_sample_identifier: 0,
          category_id: null,
        },
      ],
      [],
      [],
    );

    expect(result[0].category).toBeNull();
    expect(result[0].is_required).toBe(true);
  });

  it('shares one category across multiple fields without cross-contaminating options', () => {
    const result = assembleFields(
      [
        { id: 'f1', name: 'A', data_type: 'category', sort_order: 0, is_required: 0, is_sample_identifier: 0, category_id: 'c1' },
        { id: 'f2', name: 'B', data_type: 'category', sort_order: 1, is_required: 0, is_sample_identifier: 0, category_id: 'c1' },
      ],
      [{ id: 'c1', name: 'Shared' }],
      [{ id: 'o1', category_id: 'c1', label: 'X', sort_order: 0 }],
    );

    expect(result[0].category?.options).toEqual(result[1].category?.options);
    expect(result[0].category?.options).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest modules/fields/__tests__/api.test.ts`
Expected: FAIL — `assembleFields` is not exported yet.

- [ ] **Step 3: Rewrite `modules/fields/api.ts`**

```typescript
import { getCurrentUserId, getDb, newId, nowIso } from '../../lib/db';

export type FieldDataType = 'text' | 'number' | 'date' | 'boolean' | 'category' | 'photo' | 'timestamp';
export type CategoryScope = 'global' | 'field';

export type ExistingCategory = {
  id: string;
  name: string;
  scope: CategoryScope;
};

export type CategoryRef =
  | { kind: 'existing'; categoryId: string }
  | { kind: 'new'; name: string; scope: CategoryScope; options: string[] };

export type NewFieldInput = {
  name: string;
  dataType: FieldDataType;
  category?: CategoryRef;
};

export type CategoryOption = {
  id: string;
  label: string;
  sort_order: number;
};

export type ProjectField = {
  id: string;
  name: string;
  data_type: FieldDataType;
  sort_order: number;
  is_required: boolean;
  is_sample_identifier: boolean;
  category: { id: string; name: string; options: CategoryOption[] } | null;
};

export const DATA_TYPE_LABELS: Record<FieldDataType, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  boolean: 'Yes / No',
  category: 'Category',
  photo: 'Photo',
  timestamp: 'Timestamp (auto)',
};

type FieldRow = {
  id: string;
  name: string;
  data_type: FieldDataType;
  sort_order: number;
  is_required: number;
  is_sample_identifier: number;
  category_id: string | null;
};
type CategoryRow = { id: string; name: string };
type CategoryOptionRow = { id: string; category_id: string; label: string; sort_order: number };

// Pure row-to-shape assembly, split out from the SQL-fetching wrapper below so it's
// unit-testable without expo-sqlite (which has no Jest mock in this project).
export function assembleFields(
  fieldRows: FieldRow[],
  categoryRows: CategoryRow[],
  optionRows: CategoryOptionRow[],
): ProjectField[] {
  const categoriesById = new Map(categoryRows.map((c) => [c.id, c]));
  const optionsByCategory = new Map<string, CategoryOption[]>();
  for (const opt of optionRows) {
    const list = optionsByCategory.get(opt.category_id) ?? [];
    list.push({ id: opt.id, label: opt.label, sort_order: opt.sort_order });
    optionsByCategory.set(opt.category_id, list);
  }
  for (const list of optionsByCategory.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order);
  }

  return fieldRows.map((row) => {
    const category = row.category_id ? categoriesById.get(row.category_id) : undefined;
    return {
      id: row.id,
      name: row.name,
      data_type: row.data_type,
      sort_order: row.sort_order,
      is_required: row.is_required === 1,
      is_sample_identifier: row.is_sample_identifier === 1,
      category: category
        ? { id: category.id, name: category.name, options: optionsByCategory.get(category.id) ?? [] }
        : null,
    };
  });
}

export async function fetchGlobalCategories(): Promise<ExistingCategory[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const db = await getDb();
  return db.getAllAsync<ExistingCategory>(
    "SELECT id, name, scope FROM categories WHERE owner_id = ? AND scope = 'global' ORDER BY name",
    userId,
  );
}

// Shared by createProject's initial-fields loop (modules/projects/api.ts) and addField —
// both go through the same category-then-field insert path.
export async function insertFieldWithCategory(
  userId: string,
  projectId: string,
  field: NewFieldInput,
  sortOrder: number,
): Promise<void> {
  const db = await getDb();
  let categoryId: string | undefined;

  if (field.category?.kind === 'existing') {
    categoryId = field.category.categoryId;
  } else if (field.category?.kind === 'new') {
    const { name, scope, options } = field.category;
    categoryId = newId();
    await db.runAsync(
      'INSERT INTO categories (id, owner_id, project_id, name, scope, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      categoryId,
      userId,
      scope === 'field' ? projectId : null,
      name,
      scope,
      nowIso(),
    );

    for (let i = 0; i < options.length; i++) {
      await db.runAsync(
        'INSERT INTO category_options (id, category_id, label, sort_order) VALUES (?, ?, ?, ?)',
        newId(),
        categoryId,
        options[i],
        i,
      );
    }
  }

  await db.runAsync(
    'INSERT INTO fields (id, project_id, name, data_type, category_id, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    newId(),
    projectId,
    field.name,
    field.dataType,
    categoryId ?? null,
    sortOrder,
    nowIso(),
  );
}

export async function fetchFields(projectId: string): Promise<ProjectField[]> {
  const db = await getDb();
  const fieldRows = await db.getAllAsync<FieldRow>(
    'SELECT id, name, data_type, sort_order, is_required, is_sample_identifier, category_id ' +
      'FROM fields WHERE project_id = ? ORDER BY sort_order',
    projectId,
  );

  const categoryIds = [...new Set(fieldRows.map((f) => f.category_id).filter((id): id is string => id !== null))];
  if (categoryIds.length === 0) return assembleFields(fieldRows, [], []);

  const placeholders = categoryIds.map(() => '?').join(',');
  const categoryRows = await db.getAllAsync<CategoryRow>(
    `SELECT id, name FROM categories WHERE id IN (${placeholders})`,
    ...categoryIds,
  );
  const optionRows = await db.getAllAsync<CategoryOptionRow>(
    `SELECT id, category_id, label, sort_order FROM category_options WHERE category_id IN (${placeholders})`,
    ...categoryIds,
  );

  return assembleFields(fieldRows, categoryRows, optionRows);
}

export async function addField(projectId: string, field: NewFieldInput): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Not signed in.');

  const db = await getDb();
  const countRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM fields WHERE project_id = ?',
    projectId,
  );

  await insertFieldWithCategory(userId, projectId, field, countRow?.count ?? 0);
}

export async function deleteField(fieldId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM fields WHERE id = ?', fieldId);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest modules/fields/__tests__/api.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Update `modules/fields/CLAUDE.md`**

Append this line to the existing bullet list (file otherwise unchanged):

```markdown
- `api.ts` reads/writes local SQLite (`lib/db.ts`'s `getDb()`), not Supabase, as of the local-SQLite-layer work. `assembleFields` is the unit-tested pure row-shaping function; the SQL-executing wrapper (`fetchFields`) is manual-verify only, per `lib/CLAUDE.md`.
```

- [ ] **Step 7: Commit**

```bash
git add modules/fields/api.ts modules/fields/__tests__/api.test.ts modules/fields/CLAUDE.md
git commit -m "feat(fields): rewrite api.ts to read/write local SQLite"
```

---

### Task 3: Rewrite `modules/capture/api.ts` for SQLite

**Files:**
- Modify: `modules/capture/api.ts`

**Interfaces:**
- Consumes: `getDb(): Promise<SQLiteDatabase>` from `../../lib/db` (Task 1).
- Produces: `CaptureSlotInput`, `CaptureSlot` types and `fetchCaptureSlots(projectId: string): Promise<CaptureSlot[]>` — unchanged shape, consumed by `modules/projects/api.ts` (Task 4, type only) and `modules/capture/CaptureScreen.tsx`/`modules/data/DataScreen.tsx` (unchanged callers).

This table's row shape is a direct 1:1 column mapping (no nested assembly) — nothing here is separable into a pure, independently testable function per the spec's Testing section. Verify with `tsc` + on-device check during Task 4 (which writes `capture_slots` via `createProject`).

- [ ] **Step 1: Rewrite `modules/capture/api.ts`**

```typescript
import { getDb } from '../../lib/db';

export type CaptureSlotInput = {
  label: string;
  targetAngleDegrees?: number;
};

export type CaptureSlot = {
  id: string;
  label: string;
  target_angle_degrees: number | null;
  sort_order: number;
};

export async function fetchCaptureSlots(projectId: string): Promise<CaptureSlot[]> {
  const db = await getDb();
  return db.getAllAsync<CaptureSlot>(
    'SELECT id, label, target_angle_degrees, sort_order FROM capture_slots WHERE project_id = ? ORDER BY sort_order',
    projectId,
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. (This will show a transitive error from `modules/projects/api.ts` still calling the old Supabase insert for `capture_slots` directly — that's expected and resolved in Task 4.)

- [ ] **Step 3: Commit**

```bash
git add modules/capture/api.ts
git commit -m "feat(capture): rewrite fetchCaptureSlots to read local SQLite"
```

---

### Task 4: Rewrite `modules/projects/api.ts` for SQLite

**Files:**
- Modify: `modules/projects/api.ts`
- Modify: `modules/projects/CLAUDE.md`

**Interfaces:**
- Consumes: `getDb`, `getCurrentUserId`, `newId`, `nowIso` from `../../lib/db` (Task 1); `insertFieldWithCategory` from `../fields/api` (Task 2); `CaptureSlotInput` type from `../capture/api` (Task 3).
- Produces: `Project`, `CaptureMode` types and `fetchProjects`, `deleteProject`, `createProject`, `fetchProjectCameraSettings`, `updateProjectCameraSettings` — unchanged names/signatures, consumed by `ProjectsScreen.tsx`, `CreateProjectScreen.tsx`, `ProjectSettingsScreen.tsx`, `CaptureScreen.tsx` (unchanged callers).

`createProject` is the one multi-table write in this module — wrapped in `db.withTransactionAsync` so a partial failure (e.g. a bad field insert) can't leave an orphaned project row with no fields, which the old Supabase version had no equivalent atomicity guard against either.

- [ ] **Step 1: Rewrite `modules/projects/api.ts`**

```typescript
import { getCurrentUserId, getDb, newId, nowIso } from '../../lib/db';
import { insertFieldWithCategory } from '../fields/api';
import type { NewFieldInput } from '../fields/api';
import type { CaptureSlotInput } from '../capture/api';
import type { ManualExposureOptions } from 'jotter-camera';

export type CaptureMode = 'single' | 'multi';

export type Project = {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
};

export async function fetchProjects(): Promise<Project[]> {
  const db = await getDb();
  return db.getAllAsync<Project>('SELECT id, name, color, created_at FROM projects ORDER BY created_at DESC');
}

export async function deleteProject(projectId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM projects WHERE id = ?', projectId);
}

export async function createProject(input: {
  name: string;
  color: string;
  fields: NewFieldInput[];
  captureMode: CaptureMode;
  captureSlots: CaptureSlotInput[];
  cameraSettings: ManualExposureOptions | null;
}): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Not signed in.');

  const db = await getDb();
  const projectId = newId();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO projects (id, owner_id, name, color, camera_iso, camera_shutter_speed_ns, camera_white_balance, capture_mode, created_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      projectId,
      userId,
      input.name,
      input.color,
      input.cameraSettings?.iso ?? null,
      input.cameraSettings?.shutterSpeedNs ?? null,
      input.cameraSettings ? String(input.cameraSettings.whiteBalanceKelvin) : null,
      input.captureMode,
      nowIso(),
    );

    // Single-shot projects get one auto-created, hidden slot; multi-shot projects use
    // whatever slots the researcher defined in the capture-plan builder.
    const slots = input.captureMode === 'single' ? [{ label: 'Photo' }] : input.captureSlots;
    for (let i = 0; i < slots.length; i++) {
      await db.runAsync(
        'INSERT INTO capture_slots (id, project_id, label, target_angle_degrees, sort_order) VALUES (?, ?, ?, ?, ?)',
        newId(),
        projectId,
        slots[i].label,
        slots[i].targetAngleDegrees ?? null,
        i,
      );
    }

    for (let i = 0; i < input.fields.length; i++) {
      await insertFieldWithCategory(userId, projectId, input.fields[i], i);
    }
  });

  return projectId;
}

export async function fetchProjectCameraSettings(projectId: string): Promise<ManualExposureOptions | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    camera_iso: number | null;
    camera_shutter_speed_ns: number | null;
    camera_white_balance: string | null;
  }>('SELECT camera_iso, camera_shutter_speed_ns, camera_white_balance FROM projects WHERE id = ?', projectId);

  if (!row || row.camera_iso == null || row.camera_shutter_speed_ns == null || row.camera_white_balance == null) {
    return null;
  }
  return {
    iso: row.camera_iso,
    shutterSpeedNs: row.camera_shutter_speed_ns,
    whiteBalanceKelvin: Number(row.camera_white_balance),
  };
}

export async function updateProjectCameraSettings(projectId: string, settings: ManualExposureOptions): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE projects SET camera_iso = ?, camera_shutter_speed_ns = ?, camera_white_balance = ? WHERE id = ?',
    settings.iso,
    settings.shutterSpeedNs,
    String(settings.whiteBalanceKelvin),
    projectId,
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Manual on-device verification**

With the app running on-device: create a new project (single-shot, at least one field, one category field), confirm it appears in the project list, open it, confirm its field and capture slot are there, delete it, confirm it's gone (and cascades — no orphaned rows to check visually, but nothing errors).

- [ ] **Step 4: Update `modules/projects/CLAUDE.md`**

Replace the file's third bullet (`createProject` depends on...) with:

```markdown
- `createProject` depends on `modules/fields/api.ts` (`insertFieldWithCategory`) and `modules/capture/api.ts`'s `CaptureSlotInput` type — this module reaches into both to assemble a new project's initial fields and capture slots in one call, all inside a single `db.withTransactionAsync` for atomicity.
- `api.ts` reads/writes local SQLite (`lib/db.ts`'s `getDb()`), not Supabase, as of the local-SQLite-layer work.
```

- [ ] **Step 5: Commit**

```bash
git add modules/projects/api.ts modules/projects/CLAUDE.md
git commit -m "feat(projects): rewrite api.ts to read/write local SQLite"
```

---

### Task 5: Rewrite `modules/samples/api.ts` for SQLite

**Files:**
- Modify: `modules/samples/api.ts`
- Create: `modules/samples/__tests__/api.test.ts`
- Modify: `modules/samples/CLAUDE.md`
- Modify: `modules/capture/CLAUDE.md`

**Interfaces:**
- Consumes: `getDb`, `newId`, `nowIso` from `../../lib/db` (Task 1).
- Produces: `NewSamplePhoto`, `NewSampleValue`, `SamplePhoto`, `SampleRow` types and `checkIdentifierDuplicate`, `fetchSamples`, `createSample` — unchanged names/signatures, consumed by `CaptureScreen.tsx`, `SampleForm.tsx`, `DataScreen.tsx` (unchanged callers).

- [ ] **Step 1: Write the failing test for the pure row-assembly function**

```typescript
// modules/samples/__tests__/api.test.ts
import { assembleSampleRows } from '../api';

describe('assembleSampleRows', () => {
  it('folds values and photos into their sample by id', () => {
    const result = assembleSampleRows(
      [{ id: 's1', created_at: '2026-01-01T00:00:00.000Z' }],
      [{ sample_id: 's1', field_id: 'f1', value: 'hello' }],
      [{ sample_id: 's1', capture_slot_id: 'slot1', photo_local_uri: 'file://a.jpg', photo_remote_url: null }],
    );

    expect(result).toEqual([
      {
        id: 's1',
        createdAt: '2026-01-01T00:00:00.000Z',
        values: { f1: 'hello' },
        photos: { slot1: { localUri: 'file://a.jpg', remoteUrl: null } },
      },
    ]);
  });

  it('gives a sample with no values/photos empty objects, not undefined', () => {
    const result = assembleSampleRows([{ id: 's2', created_at: '2026-01-02T00:00:00.000Z' }], [], []);
    expect(result).toEqual([{ id: 's2', createdAt: '2026-01-02T00:00:00.000Z', values: {}, photos: {} }]);
  });

  it('does not cross-contaminate values/photos between multiple samples', () => {
    const result = assembleSampleRows(
      [
        { id: 's1', created_at: '2026-01-01T00:00:00.000Z' },
        { id: 's2', created_at: '2026-01-02T00:00:00.000Z' },
      ],
      [
        { sample_id: 's1', field_id: 'f1', value: 'a' },
        { sample_id: 's2', field_id: 'f1', value: 'b' },
      ],
      [],
    );

    expect(result[0].values).toEqual({ f1: 'a' });
    expect(result[1].values).toEqual({ f1: 'b' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest modules/samples/__tests__/api.test.ts`
Expected: FAIL — `assembleSampleRows` is not exported yet.

- [ ] **Step 3: Rewrite `modules/samples/api.ts`**

```typescript
import { getDb, newId, nowIso } from '../../lib/db';

export type NewSamplePhoto = { captureSlotId: string; localUri: string };
export type NewSampleValue = { fieldId: string; value: string };

export type SamplePhoto = { localUri: string | null; remoteUrl: string | null };
export type SampleRow = {
  id: string;
  createdAt: string;
  values: Record<string, string>;
  photos: Record<string, SamplePhoto>;
};

type SampleRowRaw = { id: string; created_at: string };
type SampleValueRow = { sample_id: string; field_id: string; value: string };
type SamplePhotoRow = {
  sample_id: string;
  capture_slot_id: string;
  photo_local_uri: string | null;
  photo_remote_url: string | null;
};

// Pure row-to-shape assembly, split out from the SQL-fetching wrapper below so it's
// unit-testable without expo-sqlite (which has no Jest mock in this project).
export function assembleSampleRows(
  sampleRows: SampleRowRaw[],
  valueRows: SampleValueRow[],
  photoRows: SamplePhotoRow[],
): SampleRow[] {
  const valuesBySample = new Map<string, Record<string, string>>();
  for (const v of valueRows) {
    const rec = valuesBySample.get(v.sample_id) ?? {};
    rec[v.field_id] = v.value;
    valuesBySample.set(v.sample_id, rec);
  }

  const photosBySample = new Map<string, Record<string, SamplePhoto>>();
  for (const p of photoRows) {
    const rec = photosBySample.get(p.sample_id) ?? {};
    rec[p.capture_slot_id] = { localUri: p.photo_local_uri, remoteUrl: p.photo_remote_url };
    photosBySample.set(p.sample_id, rec);
  }

  return sampleRows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    values: valuesBySample.get(row.id) ?? {},
    photos: photosBySample.get(row.id) ?? {},
  }));
}

// Non-blocking save-time check: does any other sample in this project already use this
// value for the project's designated is_sample_identifier field?
export async function checkIdentifierDuplicate(
  projectId: string,
  fieldId: string,
  value: string,
): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync(
    'SELECT sv.sample_id FROM sample_values sv JOIN samples s ON s.id = sv.sample_id ' +
      'WHERE sv.field_id = ? AND sv.value = ? AND s.project_id = ? LIMIT 1',
    fieldId,
    value,
    projectId,
  );
  return row != null;
}

export async function fetchSamples(projectId: string): Promise<SampleRow[]> {
  const db = await getDb();
  const sampleRows = await db.getAllAsync<SampleRowRaw>(
    'SELECT id, created_at FROM samples WHERE project_id = ? ORDER BY created_at',
    projectId,
  );
  if (sampleRows.length === 0) return [];

  const ids = sampleRows.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const valueRows = await db.getAllAsync<SampleValueRow>(
    `SELECT sample_id, field_id, value FROM sample_values WHERE sample_id IN (${placeholders})`,
    ...ids,
  );
  const photoRows = await db.getAllAsync<SamplePhotoRow>(
    `SELECT sample_id, capture_slot_id, photo_local_uri, photo_remote_url FROM sample_photos WHERE sample_id IN (${placeholders})`,
    ...ids,
  );

  return assembleSampleRows(sampleRows, valueRows, photoRows);
}

export async function createSample(
  projectId: string,
  photos: NewSamplePhoto[],
  values: NewSampleValue[],
): Promise<string> {
  const db = await getDb();
  const sampleId = newId();

  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT INTO samples (id, project_id, created_at) VALUES (?, ?, ?)', sampleId, projectId, nowIso());

    for (const photo of photos) {
      await db.runAsync(
        'INSERT INTO sample_photos (id, sample_id, capture_slot_id, photo_local_uri, created_at) VALUES (?, ?, ?, ?, ?)',
        newId(),
        sampleId,
        photo.captureSlotId,
        photo.localUri,
        nowIso(),
      );
    }

    for (const v of values) {
      await db.runAsync('INSERT INTO sample_values (sample_id, field_id, value) VALUES (?, ?, ?)', sampleId, v.fieldId, v.value);
    }
  });

  return sampleId;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest modules/samples/__tests__/api.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Update `modules/samples/CLAUDE.md`**

Replace the last bullet ("Writes go straight to Supabase...") with:

```markdown
- Writes go to local SQLite (`lib/db.ts`'s `getDb()`), not Supabase, as of the local-SQLite-layer work. `assembleSampleRows` is the unit-tested pure row-shaping function; `fetchSamples`/`createSample`/`checkIdentifierDuplicate` are manual-verify only, per `lib/CLAUDE.md`. Photos are stored as local URIs under `Paths.document` (relocated there by `modules/camera/CameraCaptureStep.tsx` right after capture — see its own notes); `photo_remote_url` stays null until Storage upload exists (a later sync-engine spec).
```

- [ ] **Step 7: Update `modules/capture/CLAUDE.md`**

Replace the bullet starting "Writes go straight to Supabase..." with:

```markdown
- Writes go to local SQLite via `modules/samples/api.ts`'s `createSample`, not Supabase, as of the local-SQLite-layer work — the immediate-sync-on-completion trigger is still a separate, unbuilt step (`docs/current-task.md` build order).
```

- [ ] **Step 8: Commit**

```bash
git add modules/samples/api.ts modules/samples/__tests__/api.test.ts modules/samples/CLAUDE.md modules/capture/CLAUDE.md
git commit -m "feat(samples): rewrite api.ts to read/write local SQLite"
```

---

### Task 6: Relocate captured photos from cache to `Paths.document`

**Files:**
- Modify: `modules/camera/CameraCaptureStep.tsx`
- Modify: `modules/camera/CLAUDE.md`

**Interfaces:**
- Consumes: `newId()` from `../../lib/db` (Task 1).

The native module's `takePicture()` always returns a `file://.../cache/jotter-capture-*.jpg` URI (`CameraController.kt`'s `takePicture`, unchanged, out of scope here). The OS can purge cache-dir files at any time — this is a real durability gap once samples are meant to persist locally as the source of truth. Both consumers of `CameraCaptureStep`'s `onCapture` callback (`CaptureScreen.tsx`'s slot photos, `SampleForm.tsx`'s photo-field capture) receive the URI through this one choke point, so relocating it here — before either consumer ever sees it — fixes both flows without touching either file.

Not unit-testable (native camera + native filesystem); verify manually on-device.

- [ ] **Step 1: Modify `modules/camera/CameraCaptureStep.tsx`'s `handleShutter`**

Add the import:

```typescript
import { File, Paths } from 'expo-file-system';
import { newId } from '../../lib/db';
```

Replace `handleShutter`:

```typescript
  async function handleShutter() {
    if (!cameraRef.current || !ready || !exposureConfirmed || capturing) return;
    setCapturing(true);
    try {
      const result = await cameraRef.current.takePicture();
      const destination = new File(Paths.document, `${newId()}.jpg`);
      await new File(result.uri).copy(destination);
      onCapture(destination.uri);
    } finally {
      setCapturing(false);
    }
  }
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Manual on-device verification**

Capture a photo (either a capture-slot photo via `CaptureScreen`, or a `photo`-data-type field via `SampleForm`). Confirm the photo shows correctly in the Data tab grid immediately after. Then force-quit the app (not just background it — Android can purge cache-dir on a real memory-pressure event, which is hard to trigger on demand; force-quit + relaunch is the practical proxy) and confirm the same photo still renders in the Data tab — this is the actual bug this task closes.

- [ ] **Step 4: Update `modules/camera/CLAUDE.md`**

Read the file first, then append a bullet noting: `CameraCaptureStep.tsx`'s `handleShutter` copies the native module's cache-dir capture result to `Paths.document` (via `newId()` from `lib/db.ts`) before calling `onCapture` — every consumer of this component always receives a document-dir URI, never a cache-dir one.

- [ ] **Step 5: Commit**

```bash
git add modules/camera/CameraCaptureStep.tsx modules/camera/CLAUDE.md
git commit -m "fix(camera): persist captured photos to document dir instead of cache dir"
```

---

### Task 7: Seed-on-first-launch, and a fatal screen for migration failure

**Files:**
- Create: `modules/account/seed.ts`
- Create: `modules/account/SeedScreen.tsx`
- Modify: `App.tsx`
- Modify: `modules/account/CLAUDE.md`

**Interfaces:**
- Consumes: `getDb()` from `../../lib/db` (Task 1); `supabase` from `../../lib/supabase`.
- Produces: `hasSeeded(): Promise<boolean>`, `markSeeded(): Promise<void>`, `seedFromSupabase(userId: string): Promise<void>` from `modules/account/seed.ts`; `SeedScreen` (default export, `{ onComplete: () => void }` props) from `modules/account/SeedScreen.tsx` — both consumed by `App.tsx`.

Also closes the spec's Error Handling requirement that migration failure is fatal with "a dedicated init-error screen (not a toast/alert that can be dismissed into a broken app)" — nothing in Tasks 1-6 calls `getDb()` eagerly at startup, so a migration failure would otherwise only surface the first time some screen happens to call an `api.ts` function, as an ordinary dismissible `Alert.alert`. `App.tsx` is the right place to force that eager call, since it's already the sole gate in front of `RootNavigator`.

Not unit-testable (network + `expo-sqlite` + `AsyncStorage`, all native); verify manually.

- [ ] **Step 1: Write `modules/account/seed.ts`**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getDb } from '../../lib/db';
import { supabase } from '../../lib/supabase';

const SEED_FLAG_KEY = 'jotter-seeded';

export async function hasSeeded(): Promise<boolean> {
  return (await AsyncStorage.getItem(SEED_FLAG_KEY)) === 'true';
}

export async function markSeeded(): Promise<void> {
  await AsyncStorage.setItem(SEED_FLAG_KEY, 'true');
}

// One-time pull of a signed-in user's existing Supabase rows into the fresh local DB, in
// FK-safe order per the spec's Seed-on-First-Launch section. Every row is inserted with
// its existing Postgres-assigned id (no re-keying) and synced_at stamped now, so the
// future sync engine never re-pushes seeded data as if it were new.
export async function seedFromSupabase(userId: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select(
      'id, owner_id, name, color, camera_iso, camera_shutter_speed_ns, camera_white_balance, capture_mode, created_at',
    )
    .eq('owner_id', userId);
  if (projectsError) throw projectsError;

  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('id, owner_id, project_id, name, scope, created_at')
    .eq('owner_id', userId);
  if (categoriesError) throw categoriesError;

  const categoryIds = (categories ?? []).map((c) => c.id);
  const { data: categoryOptions, error: optionsError } = categoryIds.length
    ? await supabase.from('category_options').select('id, category_id, label, sort_order').in('category_id', categoryIds)
    : { data: [] as { id: string; category_id: string; label: string; sort_order: number }[], error: null };
  if (optionsError) throw optionsError;

  const projectIds = (projects ?? []).map((p) => p.id);
  const { data: fields, error: fieldsError } = projectIds.length
    ? await supabase
        .from('fields')
        .select(
          'id, project_id, name, data_type, category_id, source_field_id, is_required, is_sample_identifier, sort_order, created_at',
        )
        .in('project_id', projectIds)
    : { data: [] as any[], error: null };
  if (fieldsError) throw fieldsError;

  const fieldIds = (fields ?? []).map((f) => f.id);
  const { data: fieldCategoryRules, error: rulesError } = fieldIds.length
    ? await supabase
        .from('field_category_rules')
        .select('id, field_id, category_option_id, operator, value, min_value, max_value, sort_order')
        .in('field_id', fieldIds)
    : { data: [] as any[], error: null };
  if (rulesError) throw rulesError;

  const { data: captureSlots, error: slotsError } = projectIds.length
    ? await supabase.from('capture_slots').select('id, project_id, label, target_angle_degrees, sort_order').in('project_id', projectIds)
    : { data: [] as any[], error: null };
  if (slotsError) throw slotsError;

  const { data: samples, error: samplesError } = projectIds.length
    ? await supabase.from('samples').select('id, project_id, created_at').in('project_id', projectIds)
    : { data: [] as any[], error: null };
  if (samplesError) throw samplesError;

  const sampleIds = (samples ?? []).map((s) => s.id);
  const { data: samplePhotos, error: photosError } = sampleIds.length
    ? await supabase
        .from('sample_photos')
        .select('id, sample_id, capture_slot_id, photo_local_uri, photo_remote_url, created_at')
        .in('sample_id', sampleIds)
    : { data: [] as any[], error: null };
  if (photosError) throw photosError;

  const { data: sampleValues, error: valuesError } = sampleIds.length
    ? await supabase.from('sample_values').select('sample_id, field_id, value').in('sample_id', sampleIds)
    : { data: [] as any[], error: null };
  if (valuesError) throw valuesError;

  await db.withTransactionAsync(async () => {
    for (const p of projects ?? []) {
      await db.runAsync(
        'INSERT INTO projects (id, owner_id, name, color, camera_iso, camera_shutter_speed_ns, camera_white_balance, capture_mode, created_at, synced_at) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        p.id,
        p.owner_id,
        p.name,
        p.color,
        p.camera_iso,
        p.camera_shutter_speed_ns,
        p.camera_white_balance,
        p.capture_mode,
        p.created_at,
        now,
      );
    }
    for (const c of categories ?? []) {
      await db.runAsync(
        'INSERT INTO categories (id, owner_id, project_id, name, scope, created_at, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        c.id,
        c.owner_id,
        c.project_id,
        c.name,
        c.scope,
        c.created_at,
        now,
      );
    }
    for (const o of categoryOptions ?? []) {
      await db.runAsync(
        'INSERT INTO category_options (id, category_id, label, sort_order, synced_at) VALUES (?, ?, ?, ?, ?)',
        o.id,
        o.category_id,
        o.label,
        o.sort_order,
        now,
      );
    }
    for (const f of fields ?? []) {
      await db.runAsync(
        'INSERT INTO fields (id, project_id, name, data_type, category_id, source_field_id, is_required, is_sample_identifier, sort_order, created_at, synced_at) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        f.id,
        f.project_id,
        f.name,
        f.data_type,
        f.category_id,
        f.source_field_id,
        f.is_required ? 1 : 0,
        f.is_sample_identifier ? 1 : 0,
        f.sort_order,
        f.created_at,
        now,
      );
    }
    for (const r of fieldCategoryRules ?? []) {
      await db.runAsync(
        'INSERT INTO field_category_rules (id, field_id, category_option_id, operator, value, min_value, max_value, sort_order, synced_at) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        r.id,
        r.field_id,
        r.category_option_id,
        r.operator,
        r.value,
        r.min_value,
        r.max_value,
        r.sort_order,
        now,
      );
    }
    for (const s of captureSlots ?? []) {
      await db.runAsync(
        'INSERT INTO capture_slots (id, project_id, label, target_angle_degrees, sort_order, synced_at) VALUES (?, ?, ?, ?, ?, ?)',
        s.id,
        s.project_id,
        s.label,
        s.target_angle_degrees,
        s.sort_order,
        now,
      );
    }
    for (const s of samples ?? []) {
      await db.runAsync('INSERT INTO samples (id, project_id, created_at, synced_at) VALUES (?, ?, ?, ?)', s.id, s.project_id, s.created_at, now);
    }
    for (const p of samplePhotos ?? []) {
      await db.runAsync(
        'INSERT INTO sample_photos (id, sample_id, capture_slot_id, photo_local_uri, photo_remote_url, created_at, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        p.id,
        p.sample_id,
        p.capture_slot_id,
        p.photo_local_uri,
        p.photo_remote_url,
        p.created_at,
        now,
      );
    }
    for (const v of sampleValues ?? []) {
      await db.runAsync('INSERT INTO sample_values (sample_id, field_id, value) VALUES (?, ?, ?)', v.sample_id, v.field_id, v.value);
    }
  });
}
```

- [ ] **Step 2: Write `modules/account/SeedScreen.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../lib/supabase';
import { hasSeeded, markSeeded, seedFromSupabase } from './seed';

type Props = { onComplete: () => void };

export default function SeedScreen({ onComplete }: Props) {
  const [status, setStatus] = useState<'checking' | 'seeding' | 'error'>('checking');

  const run = useCallback(async () => {
    setStatus('checking');
    try {
      if (await hasSeeded()) {
        onComplete();
        return;
      }
      setStatus('seeding');
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        onComplete();
        return;
      }
      await seedFromSupabase(session.user.id);
      await markSeeded();
      onComplete();
    } catch {
      setStatus('error');
    }
  }, [onComplete]);

  useEffect(() => {
    run();
  }, [run]);

  if (status === 'error') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6">
        <Text className="text-center font-inter-bold text-base text-body-strong">
          Could not set up your data. Check your connection and try again.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Retry setup"
          activeOpacity={0.85}
          onPress={run}
          className="mt-6 h-[56px] w-full items-center justify-center bg-primary"
        >
          <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-primary-on">Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Skip setup for now"
          activeOpacity={0.7}
          onPress={onComplete}
          className="mt-4 h-12 items-center justify-center"
        >
          <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-body">Skip for now</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6">
      <ActivityIndicator size="large" color="#10b981" />
      <Text className="mt-6 text-center font-inter-bold text-base text-body-strong">Setting up your data…</Text>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Wire into `App.tsx`**

Add `Text` to the existing `react-native` import (currently `{ ActivityIndicator, Linking, View }`) — it's used by the new fatal-error screen below:

```typescript
import { ActivityIndicator, Linking, Text, View } from 'react-native';
```

Add the imports:

```typescript
import { getDb } from './lib/db';
import SeedScreen from './modules/account/SeedScreen';
```

Add state, alongside the existing `useState` calls:

```typescript
  const [seeded, setSeeded] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
```

Inside the existing `useEffect`, add an eager `getDb()` call alongside the existing `supabase.auth.getSession()` call (this forces migration to run — and any failure to surface — at startup, before any screen mounts):

```typescript
    getDb().catch((err) => setDbError(err instanceof Error ? err.message : 'Something went wrong.'));
```

Add two render branches, right after the existing `loading || !fontsLoaded` early return and before the final `return`. The db-error branch goes first — it's fatal and must win over every other state:

```typescript
  if (dbError) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas px-6">
        <Text className="text-center font-inter-bold text-base text-destructive">Jotter could not start.</Text>
        <Text className="mt-2 text-center font-inter-light text-sm text-body">{dbError}</Text>
      </View>
    );
  }

  if (hasSession && !seeded) {
    return (
      <SafeAreaProvider>
        <SeedScreen onComplete={() => setSeeded(true)} />
        <StatusBar style="light" />
      </SafeAreaProvider>
    );
  }
```

(insert both immediately before the existing final `return (<SafeAreaProvider>...<RootNavigator .../>...)`)

This is deliberately not dismissible and has no retry — the spec calls migration failure fatal ("the app cannot function without its schema"), unlike the seed flow's failure mode (Step 2 above), which is recoverable because the app is still usable locally-empty while offline.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Manual on-device verification**

Four paths to check:
1. **Fresh install / first sign-in with existing Supabase data**: sign in with an account that has projects/samples already in Supabase from before this feature. Confirm "Setting up your data…" shows briefly, then the app lands on the project list with that data present.
2. **Already-seeded app**: force-quit and relaunch after a successful seed. Confirm the app goes straight to the project list with no "Setting up your data…" flash (or at most an imperceptible one, since `hasSeeded()` short-circuits).
3. **Offline first-launch**: put the device in airplane mode, sign in fresh. Confirm the error state with Retry/Skip appears rather than a stuck spinner; confirm Skip proceeds into the (locally empty) app.
4. **Migration failure path** (hard to trigger for real — sanity-check the wiring instead): temporarily make `migrate()` in `lib/db.ts` throw unconditionally, launch the app, confirm the "Jotter could not start." screen renders instead of any other screen or a dismissible alert, then revert the temporary throw.

- [ ] **Step 6: Update `modules/account/CLAUDE.md`**

Read the file first, then append: `seed.ts`/`SeedScreen.tsx` — the one-time first-launch pull of existing Supabase data into the fresh local SQLite DB, gated by an AsyncStorage flag (`hasSeeded`/`markSeeded`) and wired into `App.tsx` right after session resolution, before `RootNavigator` ever mounts. Retry/Skip on failure, per the design spec's Seed-on-First-Launch section.

- [ ] **Step 7: Commit**

```bash
git add modules/account/seed.ts modules/account/SeedScreen.tsx App.tsx modules/account/CLAUDE.md
git commit -m "feat(account): seed local SQLite from Supabase on first launch"
```

---

### Task 8: Final regression pass and doc closeout

**Files:**
- Modify: `lib/CLAUDE.md`
- Modify: `docs/current-task.md`

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2: Full test suite**

Run: `npx jest`
Expected: all green, including the new `assembleFields`/`assembleSampleRows` suites and every pre-existing suite (CSV export's `export.test.ts`, `exposureMapping.ts`'s tests, etc.) untouched.

- [ ] **Step 3: Full manual on-device regression**

Walk the whole golden path once, end to end, on-device: sign in → create a project with fields (text/number/category/photo) and capture slots → capture a sample through the full flow (angle-assist if applicable, camera, form) → confirm it shows in the Data tab → export to CSV/zip (confirms `modules/data/export.ts` still reads the same `ProjectField`/`CaptureSlot`/`SampleRow` shapes correctly from the new SQLite-backed `fetchFields`/`fetchCaptureSlots`/`fetchSamples`) → force-quit and relaunch → confirm everything is still there (proves local persistence, no more silent reliance on Supabase already having the data).

- [ ] **Step 4: Update `lib/CLAUDE.md`**

Remove the old gap-flagging note (no longer true) — replace the file's last bullet with:

```markdown
- `expo-sqlite` has no Jest mock in this project — `db.ts` itself is not unit-testable; verify with `npx tsc --noEmit` plus on-device checks. Pure row-shaping helpers in each domain's `api.ts` (`assembleFields`, `assembleSampleRows`) are the unit-testable layer. All of `projects/api.ts`, `fields/api.ts`, `capture/api.ts`, `samples/api.ts` read/write local SQLite as of the local-SQLite-layer work — `project_members` is the one exception, still direct-Supabase (sending an invite requires connectivity).
```

- [ ] **Step 5: Update `docs/current-task.md`**

Replace the file's top section (the "Local SQLite layer" current-task block through the `---` separator) with a completion summary in the same style as the CSV-export entry it replaces, and mark build-order step 2 done (`~~Local SQLite schema + typed data-access layer~~ — done`). Leave the "Carried over, paused" camera section and everything below the `---` untouched except that build-order renumbering.

- [ ] **Step 6: Commit**

```bash
git add lib/CLAUDE.md docs/current-task.md
git commit -m "docs: mark local SQLite layer as built"
```
