import AsyncStorage from '@react-native-async-storage/async-storage';

import { getDb } from '../../lib/db';
import { supabase } from '../../lib/supabase';

const SEED_FLAG_KEY = 'jotter-seeded';

export async function hasSeeded(): Promise<boolean> {
  return (await AsyncStorage.getItem(SEED_FLAG_KEY)) === 'true';
}

export async function markSeeded(): Promise<void> {
  await AsyncStorage.setItem(SEED_FLAG_KEY, 'true');
}

// One-time pull of a signed-in user's existing Supabase rows into the fresh local DB, in
// FK-safe order per the spec's Seed-on-First-Launch section. Every row is inserted with
// its existing Postgres-assigned id (no re-keying) and synced_at stamped now, so the
// future sync engine never re-pushes seeded data as if it were new.
export async function seedFromSupabase(userId: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select(
      'id, owner_id, name, color, camera_iso, camera_shutter_speed_ns, camera_white_balance, capture_mode, created_at',
    )
    .eq('owner_id', userId);
  if (projectsError) throw projectsError;

  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('id, owner_id, project_id, name, scope, created_at')
    .eq('owner_id', userId);
  if (categoriesError) throw categoriesError;

  const categoryIds = (categories ?? []).map((c) => c.id);
  const { data: categoryOptions, error: optionsError } = categoryIds.length
    ? await supabase.from('category_options').select('id, category_id, label, sort_order').in('category_id', categoryIds)
    : { data: [] as { id: string; category_id: string; label: string; sort_order: number }[], error: null };
  if (optionsError) throw optionsError;

  const projectIds = (projects ?? []).map((p) => p.id);
  const { data: fields, error: fieldsError } = projectIds.length
    ? await supabase
        .from('fields')
        .select(
          'id, project_id, name, data_type, category_id, source_field_id, is_required, is_sample_identifier, sort_order, created_at',
        )
        .in('project_id', projectIds)
    : { data: [] as any[], error: null };
  if (fieldsError) throw fieldsError;

  const fieldIds = (fields ?? []).map((f) => f.id);
  const { data: fieldCategoryRules, error: rulesError } = fieldIds.length
    ? await supabase
        .from('field_category_rules')
        .select('id, field_id, category_option_id, operator, value, min_value, max_value, sort_order')
        .in('field_id', fieldIds)
    : { data: [] as any[], error: null };
  if (rulesError) throw rulesError;

  const { data: captureSlots, error: slotsError } = projectIds.length
    ? await supabase.from('capture_slots').select('id, project_id, label, target_angle_degrees, sort_order').in('project_id', projectIds)
    : { data: [] as any[], error: null };
  if (slotsError) throw slotsError;

  const { data: samples, error: samplesError } = projectIds.length
    ? await supabase.from('samples').select('id, project_id, created_at').in('project_id', projectIds)
    : { data: [] as any[], error: null };
  if (samplesError) throw samplesError;

  const sampleIds = (samples ?? []).map((s) => s.id);
  const { data: samplePhotos, error: photosError } = sampleIds.length
    ? await supabase
        .from('sample_photos')
        .select('id, sample_id, capture_slot_id, photo_local_uri, photo_remote_url, created_at')
        .in('sample_id', sampleIds)
    : { data: [] as any[], error: null };
  if (photosError) throw photosError;

  const { data: sampleValues, error: valuesError } = sampleIds.length
    ? await supabase.from('sample_values').select('sample_id, field_id, value').in('sample_id', sampleIds)
    : { data: [] as any[], error: null };
  if (valuesError) throw valuesError;

  await db.withTransactionAsync(async () => {
    for (const p of projects ?? []) {
      await db.runAsync(
        'INSERT INTO projects (id, owner_id, name, color, camera_iso, camera_shutter_speed_ns, camera_white_balance, capture_mode, created_at, synced_at) ' +
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
        'INSERT INTO categories (id, owner_id, project_id, name, scope, created_at, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
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
        'INSERT INTO category_options (id, category_id, label, sort_order, synced_at) VALUES (?, ?, ?, ?, ?)',
        o.id,
        o.category_id,
        o.label,
        o.sort_order,
        now,
      );
    }
    for (const f of fields ?? []) {
      await db.runAsync(
        'INSERT INTO fields (id, project_id, name, data_type, category_id, source_field_id, is_required, is_sample_identifier, sort_order, created_at, synced_at) ' +
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
        'INSERT INTO field_category_rules (id, field_id, category_option_id, operator, value, min_value, max_value, sort_order, synced_at) ' +
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
        'INSERT INTO capture_slots (id, project_id, label, target_angle_degrees, sort_order, synced_at) VALUES (?, ?, ?, ?, ?, ?)',
        s.id,
        s.project_id,
        s.label,
        s.target_angle_degrees,
        s.sort_order,
        now,
      );
    }
    for (const s of samples ?? []) {
      await db.runAsync('INSERT INTO samples (id, project_id, created_at, synced_at) VALUES (?, ?, ?, ?)', s.id, s.project_id, s.created_at, now);
    }
    for (const p of samplePhotos ?? []) {
      await db.runAsync(
        'INSERT INTO sample_photos (id, sample_id, capture_slot_id, photo_local_uri, photo_remote_url, created_at, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
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
      await db.runAsync('INSERT INTO sample_values (sample_id, field_id, value) VALUES (?, ?, ?)', v.sample_id, v.field_id, v.value);
    }
  });
}
