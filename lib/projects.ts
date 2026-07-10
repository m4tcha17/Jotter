import { supabase } from './supabase';

export type FieldDataType = 'text' | 'number' | 'date' | 'boolean' | 'category' | 'photo' | 'timestamp';
export type CategoryScope = 'global' | 'field';

export type Project = {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
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

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, color, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
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

export async function createProject(input: {
  name: string;
  color: string;
  fields: NewFieldInput[];
}): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({ name: input.name, color: input.color, owner_id: user.id })
    .select('id')
    .single();
  if (projectError) throw projectError;

  const projectId: string = project.id;

  for (let i = 0; i < input.fields.length; i++) {
    const field = input.fields[i];
    let categoryId: string | undefined;

    if (field.category?.kind === 'existing') {
      categoryId = field.category.categoryId;
    } else if (field.category?.kind === 'new') {
      const { name, scope, options } = field.category;
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .insert({
          owner_id: user.id,
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
      sort_order: i,
    });
    if (fieldError) throw fieldError;
  }

  return projectId;
}
