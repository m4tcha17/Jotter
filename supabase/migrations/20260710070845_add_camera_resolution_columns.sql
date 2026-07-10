-- The initial schema (20260709024213_initial_schema.sql) was run manually via the SQL
-- Editor before camera_resolution_width/height were added to docs/schema.sql, so the live
-- database never got them. This migration closes that gap.
alter table projects add column if not exists camera_resolution_width integer;
alter table projects add column if not exists camera_resolution_height integer;
