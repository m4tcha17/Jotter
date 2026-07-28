# screens/fields/

`FieldsScreen.tsx` — the project's field/category schema editor. Locked/read-only by default; "Edit" exposes per-field delete and "+ Add Field".

- Fields are EAV (`fields` + `sample_values`), never hardcoded columns — don't add a fixed-column shortcut here even for a type that feels "simple".
- Shares `components/AddFieldModal.tsx` with `screens/projects/CreateProjectScreen.tsx` for the field-creation UI. The category picker (existing global/field-scoped vs. new) and dependent-category setup live inside that modal, not duplicated here — extend the modal, don't fork it.
- Dependent category fields (`field_category_rules`) are v1-scoped to `number` source fields only — don't widen the source-field type picker without checking with the user first.
