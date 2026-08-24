import { Directory, File, Paths } from 'expo-file-system';
import { zip } from 'react-native-zip-archive';

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
