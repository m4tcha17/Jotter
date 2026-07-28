# modules/

Rules shared by every module, regardless of domain.

- `navigation/RootNavigator.tsx` sets `headerShown: false` globally — there is no native header anywhere. Every screen hand-rolls its own back button/title. Don't turn the native header on for one screen without revisiting that assumption in `navigation/CLAUDE.md`.
- Follow `DESIGN.md`'s dark-only "Calibration Bench" system for any visual work — no light-mode classes (`bg-white`, `slate-*`, `emerald-*`, `rounded-xl`) in new or touched screens. Several screens still predate this system; migrating one is in scope whenever you touch it, but don't drive-by-restyle screens outside the current task.
- Accessibility floor is self-imposed, not a formal requirement, but it's non-negotiable: `accessibilityRole`/`accessibilityLabel` on every interactive element, 48×48dp minimum touch targets, never `allowFontScaling={false}`.
- Each module owns both its screens/components and its own data functions (`api.ts`, where it has one) — a module is the unit of "everything about this concept lives together," not just a UI grouping. When a module needs another module's data function or component, import it directly (e.g. `import fetchFields from '../fields/api'`) rather than duplicating logic; that's a real dependency, not a layering violation, as long as it doesn't create a cycle (see each module's own `CLAUDE.md` for its specific cross-module dependencies).

## Directory map

One directory per domain, matching the outer/inner navigation split in `docs/architecture.md`:

- `auth/` — pre-session (Landing, Sign In)
- `account/` — account-level settings
- `projects/` — outer-level project list/switcher, creation, and project settings
- `fields/` — project field/category schema
- `capture/` — the capture-flow orchestrator (Capture tab)
- `camera/` — the camera hardware wrapper (no screens of its own — a shared component, reused by `capture/` and `samples/`)
- `samples/` — the per-sample logging form and sample data access
- `data/` — the samples × fields grid (Data tab)
- `jotter-camera/` — **not a domain module.** The local Expo native module (Kotlin, CameraX/Camera2Interop) for locked manual-exposure photo capture. Own `android/` source, own TS API, own `expo-module.config.json` — autolinked, not imported like the domain modules above. See `docs/superpowers/specs/2026-07-28-native-camera-module-design.md`.

Each has its own `CLAUDE.md`. A screen belongs to exactly one module — don't reach across module boundaries except for a genuine, documented cross-module dependency (see each module's `CLAUDE.md`).
