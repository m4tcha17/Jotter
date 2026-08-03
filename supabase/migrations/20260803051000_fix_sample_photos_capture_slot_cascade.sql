-- sample_photos.capture_slot_id was `on delete restrict`, which conflicts with project
-- deletion: deleting a project cascades into both capture_slots (via project_id) and
-- sample_photos (via samples -> sample_id), but the restrict on capture_slot_id blocks
-- the capture_slots side of that cascade mid-statement, causing "could not delete
-- project" (23503 on sample_photos_capture_slot_id_fkey). A sample_photo referencing a
-- capture_slot that's being deleted should go with it, same as every other child row.
alter table sample_photos drop constraint sample_photos_capture_slot_id_fkey;
alter table sample_photos add constraint sample_photos_capture_slot_id_fkey
  foreign key (capture_slot_id) references capture_slots(id) on delete cascade;
