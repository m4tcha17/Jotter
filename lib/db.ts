import { openDatabaseAsync } from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';

import { supabase } from './supabase';

const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  camera_iso INTEGER,
  camera_shutter_speed_ns INTEGER,
  camera_white_balance TEXT,
  camera_resolution_width INTEGER,
  camera_resolution_height INTEGER,
  capture_mode TEXT NOT NULL DEFAULT 'single' CHECK (capture_mode IN ('single', 'multi')),
  created_at TEXT NOT NULL,
  synced_at TEXT
);
CREATE INDEX IF NOT EXISTS projects_owner_id_idx ON projects(owner_id);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'field')),
  created_at TEXT NOT NULL,
  synced_at TEXT
);
CREATE INDEX IF NOT EXISTS categories_owner_id_idx ON categories(owner_id);
CREATE INDEX IF NOT EXISTS categories_project_id_idx ON categories(project_id);

CREATE TABLE IF NOT EXISTS category_options (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  synced_at TEXT,
  UNIQUE (category_id, label)
);
CREATE INDEX IF NOT EXISTS category_options_category_id_idx ON category_options(category_id);

CREATE TABLE IF NOT EXISTS fields (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data_type TEXT NOT NULL CHECK (
    data_type IN ('text', 'number', 'date', 'boolean', 'category', 'photo', 'timestamp')
  ),
  category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
  source_field_id TEXT REFERENCES fields(id) ON DELETE SET NULL,
  is_required INTEGER NOT NULL DEFAULT 0,
  is_sample_identifier INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  synced_at TEXT,
  UNIQUE (project_id, name)
);
CREATE INDEX IF NOT EXISTS fields_project_id_idx ON fields(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS fields_one_identifier_per_project
  ON fields(project_id) WHERE is_sample_identifier = 1;

CREATE TABLE IF NOT EXISTS field_category_rules (
  id TEXT PRIMARY KEY,
  field_id TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  category_option_id TEXT NOT NULL REFERENCES category_options(id) ON DELETE CASCADE,
  operator TEXT NOT NULL CHECK (operator IN ('<', '<=', '>', '>=', '==', 'between')),
  value REAL,
  min_value REAL,
  max_value REAL,
  sort_order INTEGER NOT NULL,
  synced_at TEXT
);
CREATE INDEX IF NOT EXISTS field_category_rules_field_id_idx ON field_category_rules(field_id);

CREATE TABLE IF NOT EXISTS capture_slots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  target_angle_degrees REAL,
  sort_order INTEGER NOT NULL,
  synced_at TEXT,
  UNIQUE (project_id, label)
);
CREATE INDEX IF NOT EXISTS capture_slots_project_id_idx ON capture_slots(project_id);

CREATE TABLE IF NOT EXISTS samples (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  synced_at TEXT
);
CREATE INDEX IF NOT EXISTS samples_project_id_idx ON samples(project_id);

CREATE TABLE IF NOT EXISTS sample_photos (
  id TEXT PRIMARY KEY,
  sample_id TEXT NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
  capture_slot_id TEXT NOT NULL REFERENCES capture_slots(id) ON DELETE CASCADE,
  photo_local_uri TEXT,
  photo_remote_url TEXT,
  created_at TEXT NOT NULL,
  synced_at TEXT,
  UNIQUE (sample_id, capture_slot_id)
);
CREATE INDEX IF NOT EXISTS sample_photos_sample_id_idx ON sample_photos(sample_id);
CREATE INDEX IF NOT EXISTS sample_photos_capture_slot_id_idx ON sample_photos(capture_slot_id);

CREATE TABLE IF NOT EXISTS sample_values (
  sample_id TEXT NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
  field_id TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  value TEXT,
  PRIMARY KEY (sample_id, field_id)
);
CREATE INDEX IF NOT EXISTS sample_values_field_id_idx ON sample_values(field_id);
`;

let dbPromise: Promise<SQLiteDatabase> | null = null;

async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    let version = result?.user_version ?? 0;
    if (version < 1) {
      await db.execAsync(SCHEMA_V1);
      version = 1;
    }
    await db.execAsync(`PRAGMA user_version = ${version}`);
  });
}

export async function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await openDatabaseAsync('jotter.db');
      await db.execAsync('PRAGMA foreign_keys = ON');
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

// Local cache read only — never supabase.auth.getUser(), which round-trips to the
// Auth server and would break every write path the moment the device is offline.
export async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
