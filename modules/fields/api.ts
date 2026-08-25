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
