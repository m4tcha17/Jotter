# modules/data/

`DataScreen.tsx` — the spreadsheet-style samples × fields grid (column letters, frozen id gutter) and the CSV/zip export entry point.

- Empty state until `fetchSamples(projectId)` (from `modules/samples/api.ts`) returns at least one row — don't render the grid chrome for a project with zero samples.
- Grid columns are capture slots (photo thumbnails, from `modules/capture/api.ts`'s `fetchCaptureSlots`) followed by fields (from `modules/fields/api.ts`'s `fetchFields`), in that order — built by `buildColumns`. Cell values come from `fetchSamples`'s nested `sample_values`/`sample_photos` select, one round trip for the whole grid.
- Photo cells (slot columns and `photo`-type fields) render `photo_remote_url ?? photo_local_uri` — currently always the local URI since Storage upload doesn't exist yet, so thumbnails only resolve on the device that captured them. Once sync/Storage upload lands (`docs/current-task.md` build order step 9), remote URLs will make these portable across devices.
- CSV/zip export is built in `modules/data/export.ts` (`exportProjectData`), invoked from the header row's Export button via `Sharing.shareAsync`. The CSV column order there is **id, then fields, then slot photos** — deliberately not the same order as this screen's grid, which puts slot photo columns first for thumbnail-first scanning on screen. The CSV instead keeps every typed field together up front, since that's what a downstream analysis script actually wants.
- If the project has an `is_sample_identifier` field, export re-checks every sample's value for duplicates (`findDuplicateIdentifierValues`) and surfaces a summary alongside the archive as `duplicate-ids.txt` — this is a final catch-all, never a hard block on export.
