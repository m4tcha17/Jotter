# CSV/Zip Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the "Export" action to the Data tab — bundles all of a project's samples into a `.zip` containing a CSV (one row per sample) plus every referenced photo, and hands it to the OS share sheet.

**Architecture:** A new `modules/data/export.ts` splits into two halves: pure, unit-testable data-shaping functions (CSV header/row building, RFC4180 escaping, duplicate-identifier detection, photo filename derivation) and a native-dependent orchestration function (`exportProjectData`) that writes files via `expo-file-system`'s new `File`/`Directory` API, zips them with `react-native-zip-archive`, and returns a `file://` URI. `modules/data/DataScreen.tsx` gets an "Export" button that calls the orchestration function and hands the result to `expo-sharing`.

**Tech Stack:** `expo-file-system` (`File`, `Directory`, `Paths` — the new object-oriented API, not the legacy `FileSystem.writeAsStringAsync`), `react-native-zip-archive` (`zip()`), `expo-sharing` (`shareAsync`). All three are already in `package.json` — no new dependencies.

**Spec:** `docs/architecture.md`'s "Export" section (verbatim spec text) and Data Model section (schema this export reads).

## Global Constraints

- Android only, no `Platform.OS` branching (per `docs/architecture.md`'s Platform section).
- No light-mode Tailwind classes (`bg-white`, `slate-*`, etc.) in any touched screen — dark-only "Calibration Bench" system (`modules/CLAUDE.md`).
- `accessibilityRole`/`accessibilityLabel` on every interactive element, 48×48dp minimum touch targets (`modules/CLAUDE.md`).
- Photos currently only ever have a local URI (`photo_remote_url` is always null — Storage upload isn't built yet, `modules/data/CLAUDE.md`). This plan exports `photo_local_uri` only; a sample photo with no local URI (shouldn't currently happen, but is defensively handled) is simply skipped with a blank CSV cell, not an error.
- No field can currently have `is_sample_identifier = true` in practice (the Fields tab toggle to set it doesn't exist yet — separate build-order item). The duplicate-detection code is implemented anyway per the already-committed schema/spec, and is a correct no-op today.

---

### Task 1: Pure export data-shaping functions

**Files:**
- Create: `modules/data/export.ts`
- Test: `modules/data/__tests__/export.test.ts`

**Interfaces:**
- Consumes: `ProjectField` from `modules/fields/api.ts`, `CaptureSlot` from `modules/capture/api.ts`, `SampleRow` from `modules/samples/api.ts` (all already exist).
- Produces (used by Task 2):
  - `slugify(text: string): string`
  - `photoExportFilename(rowNumber: number, label: string, sourceUri: string | null | undefined): string | null`
  - `buildCsvHeader(fields: ProjectField[], slots: CaptureSlot[]): string[]`
  - `buildCsvRow(sample: SampleRow, rowNumber: number, fields: ProjectField[], slots: CaptureSlot[]): string[]`
  - `toCsvText(header: string[], rows: string[][]): string`
  - `type DuplicateGroup = { value: string; sampleRowNumbers: number[] }`
  - `findDuplicateIdentifierValues(fields: ProjectField[], samples: SampleRow[]): DuplicateGroup[]`
  - `formatDuplicateSummary(duplicates: DuplicateGroup[]): string`

- [ ] **Step 1: Write the failing tests**

```typescript
// modules/data/__tests__/export.test.ts
import {
  buildCsvHeader,
  buildCsvRow,
  toCsvText,
  slugify,
  photoExportFilename,
  findDuplicateIdentifierValues,
  formatDuplicateSummary,
} from '../export';
import type { ProjectField } from '../../fields/api';
import type { CaptureSlot } from '../../capture/api';
import type { SampleRow } from '../../samples/api';

const textField: ProjectField = {
  id: 'f-text',
  name: 'Notes',
  data_type: 'text',
  sort_order: 0,
  is_required: false,
  is_sample_identifier: false,
  category: null,
};

const timestampField: ProjectField = {
  id: 'f-ts',
  name: 'Captured At',
  data_type: 'timestamp',
  sort_order: 1,
  is_required: false,
  is_sample_identifier: false,
  category: null,
};

const photoField: ProjectField = {
  id: 'f-photo',
  name: 'Closeup',
  data_type: 'photo',
  sort_order: 2,
  is_required: false,
  is_sample_identifier: false,
  category: null,
};

const idField: ProjectField = {
  id: 'f-id',
  name: 'Sample Code',
  data_type: 'text',
  sort_order: 3,
  is_required: false,
  is_sample_identifier: true,
  category: null,
};

const slot: CaptureSlot = { id: 's-top', label: 'Top', target_angle_degrees: null, sort_order: 0 };

function makeSample(overrides: Partial<SampleRow>): SampleRow {
  return {
    id: 'sample-1',
    createdAt: '2026-08-25T03:15:00.000Z',
    values: {},
    photos: {},
    ...overrides,
  };
}

describe('slugify', () => {
  it('lowercases and replaces non-alphanumeric runs with a single hyphen', () => {
    expect(slugify('Side 1 (Left)')).toBe('side-1-left');
  });

  it('falls back to "field" for an all-punctuation input', () => {
    expect(slugify('***')).toBe('field');
  });
});

describe('photoExportFilename', () => {
  it('returns null when there is no source URI', () => {
    expect(photoExportFilename(1, 'Top', null)).toBeNull();
    expect(photoExportFilename(1, 'Top', undefined)).toBeNull();
  });

  it('zero-pads the row number and slugifies the label, keeping the source extension', () => {
    expect(photoExportFilename(7, 'Top', 'file:///cache/jotter-capture-123.jpg')).toBe('0007_top.jpg');
  });

  it('defaults to .jpg when the source URI has no extension', () => {
    expect(photoExportFilename(1, 'Top', 'file:///cache/some-opaque-id')).toBe('0001_top.jpg');
  });
});

describe('buildCsvHeader', () => {
  it('puts id first, then fields in sort_order, then one photo column per slot', () => {
    expect(buildCsvHeader([textField, timestampField], [slot])).toEqual([
      'id',
      'Notes',
      'Captured At',
      'Top photo',
    ]);
  });
});

describe('buildCsvRow', () => {
  it('outputs the raw stored value for a text field', () => {
    const sample = makeSample({ values: { [textField.id]: 'Looks dry' } });
    const row = buildCsvRow(sample, 1, [textField], []);
    expect(row).toEqual(['sample-1', 'Looks dry']);
  });

  it('outputs an empty string for a missing value, not a dash', () => {
    const sample = makeSample({});
    const row = buildCsvRow(sample, 1, [textField], []);
    expect(row).toEqual(['sample-1', '']);
  });

  it('outputs the full ISO createdAt for a timestamp field, ignoring any stored value', () => {
    const sample = makeSample({});
    const row = buildCsvRow(sample, 1, [timestampField], []);
    expect(row).toEqual(['sample-1', '2026-08-25T03:15:00.000Z']);
  });

  it('outputs a photos/<file> relative path for a photo-type field', () => {
    const sample = makeSample({ values: { [photoField.id]: 'file:///cache/jotter-capture-9.jpg' } });
    const row = buildCsvRow(sample, 3, [photoField], []);
    expect(row).toEqual(['sample-1', 'photos/0003_closeup.jpg']);
  });

  it('outputs a photos/<file> relative path for a capture slot column', () => {
    const sample = makeSample({ photos: { [slot.id]: { localUri: 'file:///cache/top.jpg', remoteUrl: null } } });
    const row = buildCsvRow(sample, 2, [], [slot]);
    expect(row).toEqual(['sample-1', 'photos/0002_top.jpg']);
  });
});

describe('toCsvText', () => {
  it('joins header and rows with commas and newlines', () => {
    expect(toCsvText(['id', 'Notes'], [['sample-1', 'Looks dry']])).toBe('id,Notes\nsample-1,Looks dry');
  });

  it('quotes a field containing a comma, quote, or newline, doubling internal quotes', () => {
    expect(toCsvText(['id', 'Notes'], [['sample-1', 'Wet, 3" deep\nedge']])).toBe(
      'id,Notes\nsample-1,"Wet, 3"" deep\nedge"',
    );
  });
});

describe('findDuplicateIdentifierValues', () => {
  it('returns an empty array when no field is marked is_sample_identifier', () => {
    const samples = [makeSample({ id: 'a' }), makeSample({ id: 'b' })];
    expect(findDuplicateIdentifierValues([textField], samples)).toEqual([]);
  });

  it('groups samples whose identifier-field value repeats, keyed by 1-based row number', () => {
    const samples = [
      makeSample({ id: 'a', values: { [idField.id]: 'CP-01' } }),
      makeSample({ id: 'b', values: { [idField.id]: 'CP-02' } }),
      makeSample({ id: 'c', values: { [idField.id]: 'CP-01' } }),
    ];
    expect(findDuplicateIdentifierValues([idField], samples)).toEqual([
      { value: 'CP-01', sampleRowNumbers: [1, 3] },
    ]);
  });

  it('ignores samples with no value for the identifier field', () => {
    const samples = [makeSample({ id: 'a' }), makeSample({ id: 'b' })];
    expect(findDuplicateIdentifierValues([idField], samples)).toEqual([]);
  });
});

describe('formatDuplicateSummary', () => {
  it('renders one line per duplicate value with its row numbers', () => {
    expect(formatDuplicateSummary([{ value: 'CP-01', sampleRowNumbers: [1, 3] }])).toBe(
      'CP-01 — used by rows 1, 3',
    );
  });

  it('joins multiple duplicate groups with newlines', () => {
    expect(
      formatDuplicateSummary([
        { value: 'CP-01', sampleRowNumbers: [1, 3] },
        { value: 'CP-02', sampleRowNumbers: [2, 5] },
      ]),
    ).toBe('CP-01 — used by rows 1, 3\nCP-02 — used by rows 2, 5');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest modules/data/__tests__/export.test.ts`
Expected: FAIL with "Cannot find module '../export'"

- [ ] **Step 3: Write the implementation**

```typescript
// modules/data/export.ts
import type { CaptureSlot } from '../capture/api';
import type { ProjectField } from '../fields/api';
import type { SampleRow } from '../samples/api';

export function slugify(text: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'field';
}

export function photoExportFilename(
  rowNumber: number,
  label: string,
  sourceUri: string | null | undefined,
): string | null {
  if (!sourceUri) return null;
  const match = sourceUri.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
  const ext = match ? match[1].toLowerCase() : 'jpg';
  const paddedRow = String(rowNumber).padStart(4, '0');
  return `${paddedRow}_${slugify(label)}.${ext}`;
}

// Column order follows docs/architecture.md's Export section literally: id first, then one
// column per field in sort_order, then one photo column per capture_slot appended after —
// deliberately NOT the same order as the DataScreen grid (which puts slot photo columns
// first for thumbnail-first scanning on screen; the CSV instead keeps every typed field
// together up front, which is what a downstream analysis script actually wants).
export function buildCsvHeader(fields: ProjectField[], slots: CaptureSlot[]): string[] {
  return ['id', ...fields.map((field) => field.name), ...slots.map((slot) => `${slot.label} photo`)];
}

export function buildCsvRow(
  sample: SampleRow,
  rowNumber: number,
  fields: ProjectField[],
  slots: CaptureSlot[],
): string[] {
  const fieldCells = fields.map((field) => {
    if (field.data_type === 'timestamp') return sample.createdAt;
    if (field.data_type === 'photo') {
      const filename = photoExportFilename(rowNumber, field.name, sample.values[field.id]);
      return filename ? `photos/${filename}` : '';
    }
    return sample.values[field.id] ?? '';
  });

  const slotCells = slots.map((slot) => {
    const photo = sample.photos[slot.id];
    const filename = photoExportFilename(rowNumber, slot.label, photo?.localUri);
    return filename ? `photos/${filename}` : '';
  });

  return [sample.id, ...fieldCells, ...slotCells];
}

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsvText(header: string[], rows: string[][]): string {
  const lines = [header, ...rows].map((line) => line.map(escapeCsvField).join(','));
  return lines.join('\n');
}

export type DuplicateGroup = { value: string; sampleRowNumbers: number[] };

// v1 supports at most one is_sample_identifier field per project (enforced by a partial
// unique index in the DB, docs/architecture.md's Data Model) — take the first match.
export function findDuplicateIdentifierValues(fields: ProjectField[], samples: SampleRow[]): DuplicateGroup[] {
  const identifierField = fields.find((field) => field.is_sample_identifier);
  if (!identifierField) return [];

  const byValue = new Map<string, number[]>();
  samples.forEach((sample, index) => {
    const value = sample.values[identifierField.id];
    if (!value) return;
    const rowNumber = index + 1;
    const existing = byValue.get(value);
    if (existing) existing.push(rowNumber);
    else byValue.set(value, [rowNumber]);
  });

  return Array.from(byValue.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([value, rows]) => ({ value, sampleRowNumbers: rows }));
}

export function formatDuplicateSummary(duplicates: DuplicateGroup[]): string {
  return duplicates
    .map((group) => `${group.value} — used by rows ${group.sampleRowNumbers.join(', ')}`)
    .join('\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest modules/data/__tests__/export.test.ts`
Expected: PASS, all cases green

- [ ] **Step 5: Commit**

```bash
git add modules/data/export.ts modules/data/__tests__/export.test.ts
git commit -m "feat(data): add pure CSV/duplicate-detection export functions"
```

---

### Task 2: File/zip assembly orchestration

**Files:**
- Modify: `modules/data/export.ts` (add to the file created in Task 1)

**Interfaces:**
- Consumes: everything Task 1 produced, plus `ProjectField[]`, `CaptureSlot[]`, `SampleRow[]` (already fetched by `DataScreen.tsx` today).
- Produces (used by Task 3):
  - `type ExportResult = { zipUri: string; duplicates: DuplicateGroup[] }`
  - `exportProjectData(projectName: string, fields: ProjectField[], slots: CaptureSlot[], samples: SampleRow[]): Promise<ExportResult>`

This function touches native file I/O (`expo-file-system`, `react-native-zip-archive`) and cannot be meaningfully unit-tested in Jest without mocking away the exact behavior being verified — no TDD step here. It gets exercised for real in Task 3's on-device manual test.

- [ ] **Step 1: Add the orchestration function**

```typescript
// Append to modules/data/export.ts
import { Directory, File, Paths } from 'expo-file-system';
import { zip } from 'react-native-zip-archive';

export type ExportResult = { zipUri: string; duplicates: DuplicateGroup[] };

async function copyPhotoIfPresent(
  sourceUri: string | null | undefined,
  photosDir: Directory,
  rowNumber: number,
  label: string,
): Promise<void> {
  const filename = photoExportFilename(rowNumber, label, sourceUri);
  if (!filename || !sourceUri) return;
  const destination = new File(photosDir, filename);
  await new File(sourceUri).copy(destination);
}

export async function exportProjectData(
  projectName: string,
  fields: ProjectField[],
  slots: CaptureSlot[],
  samples: SampleRow[],
): Promise<ExportResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const stagingDir = new Directory(Paths.cache, `export-${timestamp}`);
  stagingDir.create({ intermediates: true });

  const photosDir = new Directory(stagingDir, 'photos');
  photosDir.create({ intermediates: true });

  const header = buildCsvHeader(fields, slots);
  const rows = samples.map((sample, index) => buildCsvRow(sample, index + 1, fields, slots));
  const csvFile = new File(stagingDir, 'data.csv');
  await csvFile.write(toCsvText(header, rows));

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const rowNumber = i + 1;
    for (const slot of slots) {
      await copyPhotoIfPresent(sample.photos[slot.id]?.localUri, photosDir, rowNumber, slot.label);
    }
    for (const field of fields) {
      if (field.data_type !== 'photo') continue;
      await copyPhotoIfPresent(sample.values[field.id], photosDir, rowNumber, field.name);
    }
  }

  const duplicates = findDuplicateIdentifierValues(fields, samples);
  if (duplicates.length > 0) {
    const summaryFile = new File(stagingDir, 'duplicate-ids.txt');
    await summaryFile.write(formatDuplicateSummary(duplicates));
  }

  const zipTarget = new File(Paths.cache, `${slugify(projectName)}-export-${timestamp}.zip`);
  await zip(stagingDir.uri, zipTarget.uri);

  stagingDir.delete();

  return { zipUri: zipTarget.uri, duplicates };
}
```

- [ ] **Step 2: Static-check it**

Run: `npx tsc --noEmit`
Expected: no new errors from `modules/data/export.ts`

- [ ] **Step 3: Commit**

```bash
git add modules/data/export.ts
git commit -m "feat(data): assemble CSV+photos export into a zip via expo-file-system"
```

---

### Task 3: Wire the Export button into DataScreen

**Files:**
- Modify: `modules/data/DataScreen.tsx:1-21` (imports, props), `:141-144` (header row)

**Interfaces:**
- Consumes: `exportProjectData` and `ExportResult` from Task 2, `Sharing.shareAsync` from `expo-sharing`.

- [ ] **Step 1: Add the Export button and export handler**

In `modules/data/DataScreen.tsx`, add these imports alongside the existing ones:

```typescript
import { useState } from 'react';
// (extend the existing 'react' import line rather than duplicating it — this repo's
// DataScreen.tsx already imports useCallback/useState from 'react' at line 3)
import { Alert } from 'react-native';
// (extend the existing 'react-native' import line at line 4 rather than duplicating it)
import * as Sharing from 'expo-sharing';
import { exportProjectData } from './export';
```

Add an `isExporting` state and a handler inside `DataScreen`, right after the existing `useFocusEffect` block (after line 116):

```typescript
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    if (isExporting || samples === null || fields === null || slots === null) return;
    setIsExporting(true);
    try {
      const result = await exportProjectData(projectName, fields, slots, samples);
      if (result.duplicates.length > 0) {
        Alert.alert(
          'Duplicate sample IDs found',
          `${result.duplicates.length} value(s) are used by more than one sample. A full list is included in the export as duplicate-ids.txt.`,
        );
      }
      await Sharing.shareAsync(result.zipUri, {
        mimeType: 'application/zip',
        dialogTitle: 'Export project data',
      });
    } catch {
      Alert.alert('Export failed', 'Could not build the export. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }
```

`projectName` comes from `route.params` — add it to the existing destructure at line 97:

```typescript
  const { projectId, projectName } = route.params;
```

Replace the header row (lines 141-143) to add the button:

```typescript
      <View className="h-14 flex-row items-center justify-between border-b border-hairline px-6">
        <Text className="font-inter-bold text-[20px] text-ink">Data</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Export project data as CSV and photos"
          activeOpacity={0.85}
          disabled={isExporting}
          onPress={handleExport}
          className="h-12 min-w-[96px] items-center justify-center rounded-none bg-primary px-4"
        >
          {isExporting ? (
            <ActivityIndicator size="small" color="#0a0a0a" />
          ) : (
            <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-primary-on">Export</Text>
          )}
        </TouchableOpacity>
      </View>
```

Add `TouchableOpacity` to the existing `react-native` import (it currently imports `ActivityIndicator, Image, ScrollView, Text, View` at line 4 — extend it, don't duplicate the import line).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Run the full test suite**

Run: `npx jest`
Expected: all existing tests plus Task 1's new `export.test.ts` pass

- [ ] **Step 4: Commit**

```bash
git add modules/data/DataScreen.tsx
git commit -m "feat(data): wire Export button into DataScreen"
```

- [ ] **Step 5: Update docs**

Update `modules/data/CLAUDE.md` line 8 (`"CSV/zip export is not built yet — this screen is view-only."`) to instead point at `export.ts` and describe the CSV column order decision (id, fields, then slot photos — differs from grid order). Update `docs/architecture.md`'s "Out of scope for v1" / build-order references if any mention export as unbuilt. Commit these doc updates in a separate commit:

```bash
git add modules/data/CLAUDE.md docs/architecture.md docs/current-task.md
git commit -m "docs: mark CSV/zip export as built"
```

## Post-plan manual verification (on-device, user-run — not part of any task above)

`react-native-zip-archive` is a native module. If the installed Expo dev client predates this dependency being added to `package.json`, `zip()` will fail at runtime with a native-module-not-found error until the user rebuilds the dev client themselves (per this repo's standing rule, no `expo run:android` from an agent). Test matrix once on-device:
1. Export a project with ≥2 samples, at least one multi-photo slot, and one `photo`-type field — confirm the share sheet opens and the resulting zip (pulled via `adb` or opened from wherever it's shared to) contains a correct `data.csv` plus every photo under `photos/` with the expected filenames.
2. Export a project with zero samples — the Data tab's empty state means the Export button is never reachable; confirm this by inspection, no separate test needed.
3. Confirm CSV opens cleanly in a spreadsheet app (column alignment, no broken quoting) for a sample whose text field contains a comma.
