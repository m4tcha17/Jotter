# screens/projects/

The outer-level project list/switcher (`ProjectsScreen.tsx`), project creation (`CreateProjectScreen.tsx`), and project-level settings (`ProjectSettingsScreen.tsx`).

- A project is the ownership/sharing boundary (`owner_id` + `project_members`) — any query or feature added here must stay project-scoped, never a blanket "all authenticated users" model.
- Project creation bundles name, color, capture mode (single/multi + capture slots), and initial fields into one screen. Camera calibration (ISO/shutter/white-balance/resolution/target-angle) is deliberately **not** part of this flow — it's configured later, the first time Capture is opened for that project. Don't add it here.
- `CreateProjectScreen.tsx` shares `components/AddFieldModal.tsx` with `screens/fields/FieldsScreen.tsx` for the "+ Add Field" flow. If you change the field-creation contract (`NewFieldInput`, category handling), update both call sites.
- Deleting a project is permanent and cascades to its fields, categories, and samples — always confirm via `Alert.alert` before calling `deleteProject`.
