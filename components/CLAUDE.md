# components/

For UI shared across more than one `screens/` use case only. If a component is used by exactly one screen directory, it belongs beside that screen, not here.

- `AddFieldModal.tsx` — shared by `screens/projects/CreateProjectScreen.tsx` and `screens/fields/FieldsScreen.tsx`. That's the bar for living in this directory: a real cross-use-case dependency, not convenience.
