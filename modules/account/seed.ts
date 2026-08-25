import AsyncStorage from '@react-native-async-storage/async-storage';

import { getDb } from '../../lib/db';
import { supabase } from '../../lib/supabase';

const SEED_FLAG_PREFIX = 'jotter-seeded:';

export async function hasSeeded(userId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(`${SEED_FLAG_PREFIX}${userId}`)) === 'true';
}

export async function markSeeded(userId: string): Promise<void> {
  await AsyncStorage.setItem(`${SEED_FLAG_PREFIX}${userId}`, 'true');
}

const PAGE_SIZE = 1000;

// PostgREST silently caps an unpaginated select at PAGE_SIZE rows with no error — loop
// .range() until a page comes back short to pull every row instead of truncating.
async function fetchAllPages<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const results: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    results.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return results;
}

// One-time pull of a signed-in user's existing Supabase rows into the fresh local DB, in
// FK-safe order per the spec's Seed-on-First-Launch section. Every row is inserted with
// its existing Postgres-assigned id (no re-keying) and synced_at stamped now, so the
// future sync engine never re-pushes seeded data as if it were new.
export async function seedFromSupabase(userId: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  const projects = await fetchAllPages((from, to) =>
    supabase
      .from('projects')
      .select(
        'id, owner_id, name, color, camera_iso, camera_shutter_speed_ns, camera_white_balance, capture_mode, created_at',
      )
      .eq('owner_id', userId)
      .range(from, to),
  );

  const categories = await fetchAllPages((from, to) =>
    supabase
      .from('categories')
      .select('id, owner_id, project_id, name, scope, created_at')
      .eq('owner_id', userId)
      .range(from, to),
  );

  const categoryIds = categories.map((c) => c.id);
  const categoryOptions = categoryIds.length
    ? await fetchAllPages((from, to) =>
        supabase.from('category_options').select('id, category_id, label, sort_order').in('category_id', categoryIds).range(from, to),
      )
    : [];

  const projectIds = projects.map((p) => p.id);
  const fields = projectIds.length
    ? await fetchAllPages((from, to) =>
        supabase
          .from('fields')
          .select(
            'id, project_id, name, data_type, category_id, source_field_id, is_required, is_sample_identifier, sort_order, created_at',
          )
          .in('project_id', projectIds)
          .range(from, to),
      )
    : [];

  const fieldIds = fields.map((f) => f.id);
  const fieldCategoryRules = fieldIds.length
    ? await fetchAllPages((from, to) =>
        supabase
          .from('field_category_rules')
          .select('id, field_id, category_option_id, operator, value, min_value, max_value, sort_order')
          .in('field_id', fieldIds)
          .range(from, to),
      )
    : [];

  const captureSlots = projectIds.length
    ? await fetchAllPages((from, to) =>
        supabase
          .from('capture_slots')
          .select('id, project_id, label, target_angle_degrees, sort_order')
          .in('project_id', projectIds)
          .range(from, to),
      )
    : [];

  const samples = projectIds.length
    ? await fetchAllPages((from, to) =>
        supabase.from('samples').select('id, project_id, created_at').in('project_id', projectIds).range(from, to),
      )
    : [];

  // Scoped by projectIds (bounded) rather than sampleIds (unbounded) — an .in() over every
  // sample id can exceed request-header length limits past ~200 samples.
  const samplePhotos = projectIds.length
    ? await fetchAllPages((from, to) =>
        supabase
          .from('sample_photos')
          .select('id, sample_id, capture_slot_id, photo_local_uri, photo_remote_url, created_at, samples!inner(project_id)')
          .in('samples.project_id', projectIds)
          .range(from, to),
      )
    : [];

  const sampleValues = projectIds.length
    ? await fetchAllPages((from, to) =>
        supabase
          .from('sample_values')
          .select('sample_id, field_id, value, samples!inner(project_id)')
          .in('samples.project_id', projectIds)
          .range(from, to),
      )
    : [];

  await db.withTransactionAsync(async () => {
    for (const p of projects ?? []) {
      await db.runAsync(
        'INSERT OR REPLACE INTO projects (id, owner_id, name, color, camera_iso, camera_shutter_speed_ns, camera_white_balance, capture_mode, created_at, synced_at) ' +
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
        'INSERT OR REPLACE INTO categories (id, owner_id, project_id, name, scope, created_at, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
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
        'INSERT OR REPLACE INTO category_options (id, category_id, label, sort_order, synced_at) VALUES (?, ?, ?, ?, ?)',
        o.id,
        o.category_id,
        o.label,
        o.sort_order,
        now,
      );
    }
    for (const f of fields ?? []) {
      await db.runAsync(
        'INSERT OR REPLACE INTO fields (id, project_id, name, data_type, category_id, source_field_id, is_required, is_sample_identifier, sort_order, created_at, synced_at) ' +
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
        'INSERT OR REPLACE INTO field_category_rules (id, field_id, category_option_id, operator, value, min_value, max_value, sort_order, synced_at) ' +
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
        'INSERT OR REPLACE INTO capture_slots (id, project_id, label, target_angle_degrees, sort_order, synced_at) VALUES (?, ?, ?, ?, ?, ?)',
        s.id,
        s.project_id,
        s.label,
        s.target_angle_degrees,
        s.sort_order,
        now,
      );
    }
    for (const s of samples ?? []) {
      await db.runAsync('INSERT OR REPLACE INTO samples (id, project_id, created_at, synced_at) VALUES (?, ?, ?, ?)', s.id, s.project_id, s.created_at, now);
    }
    for (const p of samplePhotos ?? []) {
      await db.runAsync(
        'INSERT OR REPLACE INTO sample_photos (id, sample_id, capture_slot_id, photo_local_uri, photo_remote_url, created_at, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
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
      await db.runAsync('INSERT OR REPLACE INTO sample_values (sample_id, field_id, value) VALUES (?, ?, ?)', v.sample_id, v.field_id, v.value);
    }
  });
}
