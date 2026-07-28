import { supabase } from '../../lib/supabase';

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

// Shared by createProject's initial-fields loop (modules/projects/api.ts) and addField —
// both go through the same category-then-field insert path.
export async function insertFieldWithCategory(
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
