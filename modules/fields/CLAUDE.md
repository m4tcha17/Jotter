# modules/fields/

`FieldsScreen.tsx` — the project's field/category schema editor. Locked/read-only by default; "Edit" exposes per-field delete and "+ Add Field". `AddFieldModal.tsx` — the field-creation UI, shared with `modules/projects/CreateProjectScreen.tsx`. `api.ts` — `fetchFields`, `addField`, `deleteField`, `fetchGlobalCategories`, `insertFieldWithCategory` (also called by `modules/projects/api.ts`'s `createProject`), `DATA_TYPE_LABELS`.

- Fields are EAV (`fields` + `sample_values`), never hardcoded columns — don't add a fixed-column shortcut here even for a type that feels "simple".
- `AddFieldModal.tsx` is a real cross-module dependency, not convenience — `modules/projects/CreateProjectScreen.tsx` imports it directly from here for its "+ Add Field" step. The category picker (existing global/field-scoped vs. new) and dependent-category setup live inside that modal, not duplicated in either screen — extend the modal, don't fork it. If you change the field-creation contract (`NewFieldInput`, category handling), update both call sites.
- Dependent category fields (`field_category_rules`) are v1-scoped to `number` source fields only — don't widen the source-field type picker without checking with the user first.
- `api.ts` reads/writes local SQLite (`lib/db.ts`'s `getDb()`), not Supabase, as of the local-SQLite-layer work. `assembleFields` is the unit-tested pure row-shaping function; the SQL-executing wrapper (`fetchFields`) is manual-verify only, per `lib/CLAUDE.md`.
