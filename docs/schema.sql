-- Jotter database schema (Supabase Postgres).
--
-- The local SQLite mirror (expo-sqlite, the offline-first source of truth) uses the
-- same tables and columns with SQLite-appropriate types: uuid -> TEXT, timestamptz ->
-- TEXT (ISO 8601), boolean -> INTEGER (0/1). It has no auth.users foreign keys, since
-- auth is enforced remotely, not on-device. Its CREATE TABLE statements are written as
-- code in the "Local SQLite schema" build step, adapted from this file.
--
-- Row Level Security: every table is owned/shared per-project (see docs/architecture.md's
-- Auth Model and Data Model). The `is_project_member` helper below is the single source of
-- truth for "can this user see/edit this project's data" — project owner, or an accepted
-- collaborator. Policies are defined at the end of this file, after all tables exist.

create table projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  camera_iso integer,
  camera_shutter_speed_ns bigint,
  camera_white_balance text,
  camera_resolution_width integer,
  camera_resolution_height integer,
  capture_mode text not null default 'single' check (capture_mode in ('single', 'multi')),
  created_at timestamptz not null default now(),
  synced_at timestamptz
);
create index projects_owner_id_idx on projects(owner_id);

create table project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  invited_email text not null,
  role text not null check (role in ('owner', 'collaborator')),
  status text not null check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  unique (project_id, invited_email)
);
create index project_members_project_id_idx on project_members(project_id);
create index project_members_user_id_idx on project_members(user_id);

create table categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  scope text not null check (scope in ('global', 'field')),
  created_at timestamptz not null default now(),
  synced_at timestamptz
);
create index categories_owner_id_idx on categories(owner_id);
create index categories_project_id_idx on categories(project_id);

create table category_options (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  label text not null,
  sort_order integer not null,
  synced_at timestamptz,
  unique (category_id, label)
);
create index category_options_category_id_idx on category_options(category_id);

create table fields (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  data_type text not null check (
    data_type in ('text', 'number', 'date', 'boolean', 'category', 'photo', 'timestamp')
  ),
  category_id uuid references categories(id) on delete restrict,
  source_field_id uuid references fields(id) on delete set null,
  is_required boolean not null default false,
  is_sample_identifier boolean not null default false,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  synced_at timestamptz,
  unique (project_id, name)
);
create index fields_project_id_idx on fields(project_id);
-- At most one field per project may be the sample identifier (a project doesn't need one).
create unique index fields_one_identifier_per_project on fields(project_id) where is_sample_identifier;

create table field_category_rules (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references fields(id) on delete cascade,
  category_option_id uuid not null references category_options(id) on delete cascade,
  operator text not null check (operator in ('<', '<=', '>', '>=', '==', 'between')),
  value numeric,
  min_value numeric,
  max_value numeric,
  sort_order integer not null,
  synced_at timestamptz
);
create index field_category_rules_field_id_idx on field_category_rules(field_id);

-- capture_slots: defines the "shape" of one complete sample for a project — an ordered
-- list of named photo positions (e.g. Top, Bottom, Side 1..4). A `single`-capture_mode
-- project has exactly one auto-created slot (the app never shows slot-building UI for
-- it); a `multi`-capture_mode project's researcher defines these themselves.
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

-- samples: the actual unit of data — one set of field values (via sample_values) shared
-- across every photo taken for it. Replaces the old single-photo-per-row `entries` table.
create table samples (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  synced_at timestamptz
);
create index samples_project_id_idx on samples(project_id);

-- sample_photos: one photo per (sample, capture_slot) pair — a sample is "complete" once
-- it has a photo for every capture_slot defined by its project.
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

-- Row Level Security
--
-- is_project_member: true if the current user owns the project, or is an accepted
-- collaborator on it. security definer so it can read `projects`/`project_members`
-- from inside a policy on another table without those tables' own RLS recursing.
create or replace function is_project_member(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from projects p
    where p.id = p_project_id and p.owner_id = auth.uid()
  ) or exists (
    select 1 from project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
      and pm.status = 'accepted'
  );
$$;

alter table projects enable row level security;
alter table project_members enable row level security;
alter table categories enable row level security;
alter table category_options enable row level security;
alter table fields enable row level security;
alter table field_category_rules enable row level security;
alter table capture_slots enable row level security;
alter table samples enable row level security;
alter table sample_photos enable row level security;
alter table sample_values enable row level security;

-- projects: owner manages the project itself; members can only view it.
create policy "projects_select" on projects for select
  using (owner_id = auth.uid() or is_project_member(id));
create policy "projects_insert" on projects for insert
  with check (owner_id = auth.uid());
create policy "projects_update" on projects for update
  using (owner_id = auth.uid());
create policy "projects_delete" on projects for delete
  using (owner_id = auth.uid());

-- project_members: only the owner manages sharing; an invited user can see and accept
-- their own (pending or accepted) invite.
create policy "project_members_select" on project_members for select
  using (
    exists (select 1 from projects p where p.id = project_id and p.owner_id = auth.uid())
    or user_id = auth.uid()
    or invited_email = (auth.jwt() ->> 'email')
  );
create policy "project_members_insert" on project_members for insert
  with check (exists (select 1 from projects p where p.id = project_id and p.owner_id = auth.uid()));
create policy "project_members_update" on project_members for update
  using (
    exists (select 1 from projects p where p.id = project_id and p.owner_id = auth.uid())
    or invited_email = (auth.jwt() ->> 'email')
  );
create policy "project_members_delete" on project_members for delete
  using (exists (select 1 from projects p where p.id = project_id and p.owner_id = auth.uid()));

-- categories: global categories (project_id null) are private to their owner; field-scoped
-- categories (project_id set) follow the owning project's membership, regardless of creator.
create policy "categories_select" on categories for select
  using (
    (project_id is null and owner_id = auth.uid())
    or (project_id is not null and is_project_member(project_id))
  );
create policy "categories_insert" on categories for insert
  with check (
    owner_id = auth.uid()
    and (project_id is null or is_project_member(project_id))
  );
create policy "categories_update" on categories for update
  using (
    (project_id is null and owner_id = auth.uid())
    or (project_id is not null and is_project_member(project_id))
  );
create policy "categories_delete" on categories for delete
  using (
    (project_id is null and owner_id = auth.uid())
    or (project_id is not null and is_project_member(project_id))
  );

-- category_options / fields / field_category_rules / entries / entry_values: all follow
-- their owning project's membership via a join, since none of them carry an owner_id.
create policy "category_options_all" on category_options for all
  using (
    exists (
      select 1 from categories c
      where c.id = category_id
        and ((c.project_id is null and c.owner_id = auth.uid()) or (c.project_id is not null and is_project_member(c.project_id)))
    )
  )
  with check (
    exists (
      select 1 from categories c
      where c.id = category_id
        and ((c.project_id is null and c.owner_id = auth.uid()) or (c.project_id is not null and is_project_member(c.project_id)))
    )
  );

create policy "fields_all" on fields for all
  using (is_project_member(project_id))
  with check (is_project_member(project_id));

create policy "field_category_rules_all" on field_category_rules for all
  using (exists (select 1 from fields f where f.id = field_id and is_project_member(f.project_id)))
  with check (exists (select 1 from fields f where f.id = field_id and is_project_member(f.project_id)));

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
