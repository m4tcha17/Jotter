# modules/data/

`DataScreen.tsx` — the spreadsheet-style samples × fields grid (column letters, frozen id gutter) and the CSV/zip export entry point.

- Empty state until `fetchSamples(projectId)` (from `modules/samples/api.ts`) returns at least one row — don't render the grid chrome for a project with zero samples.
- Grid columns are capture slots (photo thumbnails, from `modules/capture/api.ts`'s `fetchCaptureSlots`) followed by fields (from `modules/fields/api.ts`'s `fetchFields`), in that order — built by `buildColumns`. Cell values come from `fetchSamples`'s nested `sample_values`/`sample_photos` select, one round trip for the whole grid.
- Photo cells (slot columns and `photo`-type fields) render `photo_remote_url ?? photo_local_uri` — currently always the local URI since Storage upload doesn't exist yet, so thumbnails only resolve on the device that captured them. Once sync/Storage upload lands (`docs/current-task.md` build order step 9), remote URLs will make these portable across devices.
- CSV/zip export is not built yet — this screen is view-only.
- If the project has an `is_sample_identifier` field, export must re-check every sample's value for duplicates and surface a summary alongside the archive — this is a final catch-all, never a hard block on export.
