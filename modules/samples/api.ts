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
