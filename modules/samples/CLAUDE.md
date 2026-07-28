# modules/samples/

`SampleForm.tsx` — the shared per-sample logging form, rendered once every capture slot has a photo. `api.ts` — `createSample` (writes `samples` + `sample_photos` + `sample_values`), `checkIdentifierDuplicate`, `fetchSamples` (used by `modules/data/DataScreen.tsx` to read samples back for the grid).

- `timestamp` fields are filtered out entirely (auto-written from `samples.created_at`, never shown in the form).
- `is_required` fields hard-block Save Sample; the project's `is_sample_identifier` field (if any) is checked via `checkIdentifierDuplicate` at submit time and warns (non-blocking, `Alert` with Go Back / Continue Anyway) on a match. No field in the app can actually have `is_required`/`is_sample_identifier` set yet — the Fields/Add Field UI toggle for that is build order step 5b, still unbuilt — so this logic is currently a no-op until that ships; it's implemented now because the schema and behavior are already committed in `docs/architecture.md`.
- `photo`-data-type fields reuse `modules/camera/CameraCaptureStep.tsx` inside a `Modal` — captured local URI is stored directly as the field's `sample_values.value` text (there's no separate table for field-level photos, per the schema).
- Dependent category fields (`field_category_rules` auto-fill) are **not** implemented in the form — build order step 5 (the UI to create those rules) doesn't exist yet, so no field can have `source_field_id` set; there's nothing to auto-fill against. Revisit when step 5 ships.
- Writes go straight to Supabase — offline-first SQLite and the immediate-sync-on-completion trigger are still separate, unbuilt steps (`docs/current-task.md` build order steps 2 and 9). Photos are stored as local URIs only; `photo_remote_url` stays null until Storage upload exists.
