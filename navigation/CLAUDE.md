# navigation/

- `RootNavigator.tsx` sets `screenOptions={{ headerShown: false }}` globally — every screen hand-rolls its own back button/header. Don't opt one screen into the native header without revisiting this file and `screens/CLAUDE.md`.
- Two navigation levels, not one: the outer `Stack.Navigator` (Landing/SignIn/Main/CreateProject/ProjectSettings) and the inner `ProjectTabs` (Capture/Fields/Data), which only mounts once a project is open, at the `ProjectHome` route. Don't add a project-scoped screen to the outer stack, or an account-level screen to the inner tabs.
- `RootStackParamList`, `MainTabParamList`, and `ProjectTabParamList` are the source of truth for what params a screen receives — update the relevant param list in the same change as adding, removing, or reparameterizing a screen.
