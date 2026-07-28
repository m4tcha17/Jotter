# screens/data/

`DataScreen.tsx` — the spreadsheet-style samples × fields grid (column letters, frozen id gutter) and the CSV/zip export entry point.

- Empty state until `fetchSampleCount(projectId)` > 0 — don't render the grid chrome for a project with zero samples.
- Cell values are still unwired pending `sample_values` fetching (grid renders empty cells for now) — check `docs/current-task.md` before assuming this screen is feature-complete.
- If the project has an `is_sample_identifier` field, export must re-check every sample's value for duplicates and surface a summary alongside the archive — this is a final catch-all, never a hard block on export.
