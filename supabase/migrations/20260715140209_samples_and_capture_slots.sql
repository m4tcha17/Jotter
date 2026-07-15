-- Restructures the capture data model: a project's unit of data becomes a "sample"
-- (one shared set of field values) which can have multiple photos, one per "capture
-- slot" (a named photo position, e.g. Top/Bottom/Side 1-4, defined per project). This
-- replaces the old one-photo-per-row `entries`/`entry_values` tables, which have never
-- been written to in production (no Capture screen exists yet), so a clean drop+recreate
-- is safe rather than a data migration.

drop table if exists entry_values;
drop table if exists entries;

alter table projects add column if not exists capture_mode text not null default 'single' check (capture_mode in ('single', 'multi'));
alter table projects drop column if exists target_angle_degrees;

create table capture_slots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  label text not null,
  target_angle_degrees numeric,
  sort_order integer not null,
  synced_at timestamptz,
  unique (project_id, label)
);
create index capture_slots_project_id_idx on capture_slots(project_id);

create table samples (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  synced_at timestamptz
);
create index samples_project_id_idx on samples(project_id);

create table sample_photos (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid not null references samples(id) on delete cascade,
  capture_slot_id uuid not null references capture_slots(id) on delete restrict,
  photo_local_uri text,
  photo_remote_url text,
  created_at timestamptz not null default now(),
  synced_at timestamptz,
  unique (sample_id, capture_slot_id)
);
create index sample_photos_sample_id_idx on sample_photos(sample_id);
create index sample_photos_capture_slot_id_idx on sample_photos(capture_slot_id);

create table sample_values (
  sample_id uuid not null references samples(id) on delete cascade,
  field_id uuid not null references fields(id) on delete cascade,
  value text,
  primary key (sample_id, field_id)
);
create index sample_values_field_id_idx on sample_values(field_id);

alter table capture_slots enable row level security;
alter table samples enable row level security;
alter table sample_photos enable row level security;
alter table sample_values enable row level security;

create policy "capture_slots_all" on capture_slots for all
  using (is_project_member(project_id))
  with check (is_project_member(project_id));

create policy "samples_all" on samples for all
  using (is_project_member(project_id))
  with check (is_project_member(project_id));

create policy "sample_photos_all" on sample_photos for all
  using (exists (select 1 from samples s where s.id = sample_id and is_project_member(s.project_id)))
  with check (exists (select 1 from samples s where s.id = sample_id and is_project_member(s.project_id)));

create policy "sample_values_all" on sample_values for all
  using (exists (select 1 from samples s where s.id = sample_id and is_project_member(s.project_id)))
  with check (exists (select 1 from samples s where s.id = sample_id and is_project_member(s.project_id)));
