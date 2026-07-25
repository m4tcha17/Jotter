-- Supports two data-integrity features on the Capture/Export flow:
-- 1. is_required: a field must have a value before a sample can be saved as complete.
-- 2. is_sample_identifier: opt-in, at most one per project — the field whose value acts
--    as the researcher's own human-chosen sample ID, checked for duplicates at save time
--    (a warning, not a block) and again at export time (a summary of any duplicates found).
alter table fields add column if not exists is_required boolean not null default false;
alter table fields add column if not exists is_sample_identifier boolean not null default false;

create unique index if not exists fields_one_identifier_per_project on fields(project_id) where is_sample_identifier;
