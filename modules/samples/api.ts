import { supabase } from '../../lib/supabase';

export type NewSamplePhoto = { captureSlotId: string; localUri: string };
export type NewSampleValue = { fieldId: string; value: string };

export type SamplePhoto = { localUri: string | null; remoteUrl: string | null };
export type SampleRow = {
  id: string;
  createdAt: string;
  values: Record<string, string>;
  photos: Record<string, SamplePhoto>;
};

// Non-blocking save-time check: does any other sample in this project already use this
// value for the project's designated is_sample_identifier field?
export async function checkIdentifierDuplicate(
  projectId: string,
  fieldId: string,
  value: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('sample_values')
    .select('sample_id, samples!inner(project_id)')
    .eq('field_id', fieldId)
    .eq('value', value)
    .eq('samples.project_id', projectId);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function fetchSamples(projectId: string): Promise<SampleRow[]> {
  const { data, error } = await supabase
    .from('samples')
    .select(
      'id, created_at, sample_values(field_id, value), ' +
        'sample_photos(capture_slot_id, photo_local_uri, photo_remote_url)',
    )
    .eq('project_id', projectId)
    .order('created_at');
  if (error) throw error;

  type RawSampleRow = {
    id: string;
    created_at: string;
    sample_values: { field_id: string; value: string }[];
    sample_photos: { capture_slot_id: string; photo_local_uri: string | null; photo_remote_url: string | null }[];
  };
  const rows = (data ?? []) as unknown as RawSampleRow[];

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    values: Object.fromEntries(row.sample_values.map((v) => [v.field_id, v.value])),
    photos: Object.fromEntries(
      row.sample_photos.map((p) => [p.capture_slot_id, { localUri: p.photo_local_uri, remoteUrl: p.photo_remote_url }]),
    ),
  }));
}

export async function createSample(
  projectId: string,
  photos: NewSamplePhoto[],
  values: NewSampleValue[],
): Promise<string> {
  const { data: sample, error: sampleError } = await supabase
    .from('samples')
    .insert({ project_id: projectId })
    .select('id')
    .single();
  if (sampleError) throw sampleError;

  const sampleId: string = sample.id;

  if (photos.length > 0) {
    const { error: photosError } = await supabase.from('sample_photos').insert(
      photos.map((photo) => ({
        sample_id: sampleId,
        capture_slot_id: photo.captureSlotId,
        photo_local_uri: photo.localUri,
      })),
    );
    if (photosError) throw photosError;
  }

  if (values.length > 0) {
    const { error: valuesError } = await supabase
      .from('sample_values')
      .insert(values.map((v) => ({ sample_id: sampleId, field_id: v.fieldId, value: v.value })));
    if (valuesError) throw valuesError;
  }

  return sampleId;
}
