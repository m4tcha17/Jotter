import { supabase } from './supabase';

export type FieldDataType = 'text' | 'number' | 'date' | 'boolean' | 'category' | 'photo' | 'timestamp';
export type CategoryScope = 'global' | 'field';
export type CaptureMode = 'single' | 'multi';

export type Project = {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
};

export type CaptureSlotInput = {
  label: string;
  targetAngleDegrees?: number;
};

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

export type CaptureSlot = {
  id: string;
  label: string;
  target_angle_degrees: number | null;
  sort_order: number;
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

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, color, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', projectId);
  if (error) throw error;
}

export async function fetchGlobalCategories(): Promise<ExistingCategory[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('categories')
    .select('id, name, scope')
    .eq('owner_id', user.id)
    .eq('scope', 'global')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

async function insertFieldWithCategory(
  userId: string,
  projectId: string,
  field: NewFieldInput,
  sortOrder: number,
): Promise<void> {
  let categoryId: string | undefined;

  if (field.category?.kind === 'existing') {
    categoryId = field.category.categoryId;
  } else if (field.category?.kind === 'new') {
    const { name, scope, options } = field.category;
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .insert({
        owner_id: userId,
        project_id: scope === 'field' ? projectId : null,
        name,
        scope,
      })
      .select('id')
      .single();
    if (categoryError) throw categoryError;
    categoryId = category.id;

    const { error: optionsError } = await supabase.from('category_options').insert(
      options.map((label, index) => ({
        category_id: categoryId,
        label,
        sort_order: index,
      })),
    );
    if (optionsError) throw optionsError;
  }

  const { error: fieldError } = await supabase.from('fields').insert({
    project_id: projectId,
    name: field.name,
    data_type: field.dataType,
    category_id: categoryId ?? null,
    sort_order: sortOrder,
  });
  if (fieldError) throw fieldError;
}

export async function createProject(input: {
  name: string;
  color: string;
  fields: NewFieldInput[];
  captureMode: CaptureMode;
  captureSlots: CaptureSlotInput[];
}): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({ name: input.name, color: input.color, capture_mode: input.captureMode, owner_id: user.id })
    .select('id')
    .single();
  if (projectError) throw projectError;

  const projectId: string = project.id;

  // Single-shot projects get one auto-created, hidden slot; multi-shot projects use
  // whatever slots the researcher defined in the capture-plan builder.
  const slots = input.captureMode === 'single' ? [{ label: 'Photo' }] : input.captureSlots;
  const { error: slotsError } = await supabase.from('capture_slots').insert(
    slots.map((slot, index) => ({
      project_id: projectId,
      label: slot.label,
      target_angle_degrees: slot.targetAngleDegrees ?? null,
      sort_order: index,
    })),
  );
  if (slotsError) throw slotsError;

  for (let i = 0; i < input.fields.length; i++) {
    await insertFieldWithCategory(user.id, projectId, input.fields[i], i);
  }

  return projectId;
}

export async function fetchFields(projectId: string): Promise<ProjectField[]> {
  const { data, error } = await supabase
    .from('fields')
    .select(
      'id, name, data_type, sort_order, is_required, is_sample_identifier, ' +
        'category:categories(id, name, category_options(id, label, sort_order))',
    )
    .eq('project_id', projectId)
    .order('sort_order');
  if (error) throw error;
  const fields = (data ?? []) as unknown as ProjectField[];
  for (const field of fields) {
    field.category?.options.sort((a, b) => a.sort_order - b.sort_order);
  }
  return fields;
}

export async function addField(projectId: string, field: NewFieldInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');

  const { count, error: countError } = await supabase
    .from('fields')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId);
  if (countError) throw countError;

  await insertFieldWithCategory(user.id, projectId, field, count ?? 0);
}

export async function deleteField(fieldId: string): Promise<void> {
  const { error } = await supabase.from('fields').delete().eq('id', fieldId);
  if (error) throw error;
}

export async function fetchCaptureSlots(projectId: string): Promise<CaptureSlot[]> {
  const { data, error } = await supabase
    .from('capture_slots')
    .select('id, label, target_angle_degrees, sort_order')
    .eq('project_id', projectId)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

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

export type NewSamplePhoto = { captureSlotId: string; localUri: string };
export type NewSampleValue = { fieldId: string; value: string };

export type SamplePhoto = { localUri: string | null; remoteUrl: string | null };
export type SampleRow = {
  id: string;
  createdAt: string;
  values: Record<string, string>;
  photos: Record<string, SamplePhoto>;
};

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
