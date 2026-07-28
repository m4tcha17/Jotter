# screens/

Rules shared by every screen, regardless of use case.

- `navigation/RootNavigator.tsx` sets `headerShown: false` globally — there is no native header anywhere. Every screen hand-rolls its own back button/title. Don't turn the native header on for one screen without revisiting that assumption in `navigation/CLAUDE.md`.
- Follow `DESIGN.md`'s dark-only "Calibration Bench" system for any visual work — no light-mode classes (`bg-white`, `slate-*`, `emerald-*`, `rounded-xl`) in new or touched screens. Several screens still predate this system; migrating one is in scope whenever you touch it, but don't drive-by-restyle screens outside the current task.
- Accessibility floor is self-imposed, not a formal requirement, but it's non-negotiable: `accessibilityRole`/`accessibilityLabel` on every interactive element, 48×48dp minimum touch targets, never `allowFontScaling={false}`.

## Directory map

One directory per use case, matching the outer/inner navigation split in `docs/architecture.md`:

- `auth/` — pre-session (Landing, Sign In)
- `account/` — account-level settings
- `projects/` — outer-level project list/switcher, creation, and project settings
- `capture/`, `fields/`, `data/` — the three inner, project-scoped tabs

Each has its own `CLAUDE.md`. A screen belongs to exactly one use case — don't reach across directories except where a component is genuinely shared (see `components/CLAUDE.md`).
