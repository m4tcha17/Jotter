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

export type ProjectField = {
  id: string;
  name: string;
  data_type: FieldDataType;
  sort_order: number;
  category: { name: string } | null;
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
    .select('id, name, data_type, sort_order, category:categories(name)')
    .eq('project_id', projectId)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as unknown as ProjectField[];
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

export async function fetchSampleCount(projectId: string): Promise<number> {
  const { count, error } = await supabase
    .from('samples')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId);
  if (error) throw error;
  return count ?? 0;
}
