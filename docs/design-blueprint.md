# Jotter — UI/UX Design Blueprint

This document is a design-facing blueprint of the entire app, meant to be handed to a design-generation tool (e.g. Figma Make) to produce mockups/prototypes. It describes **what the app looks like and how it behaves**, not how it's built — for the technical architecture (data model, tech stack, sync strategy), see `docs/architecture.md` instead. Where a screen already exists in the real app, this describes its actual current behavior; where a screen is planned but not yet built, that's called out explicitly so a designer/tool knows it's speculative.

## Product summary

Jotter is a mobile app for field researchers to capture photos of physical samples, log structured data against them using a fully custom field schema they define themselves, and export everything to CSV for analysis. It is framed as a general-purpose data-collection tool.

## Target users & design principles

Primary users are field researchers who are **not comfortable with technology** — assume low digital literacy, not low intelligence. Every screen should be designed against these principles:

- **Simplicity over flexibility.** Fewer choices per screen, linear flows, no branching decisions mid-task.
- **Large, obvious touch targets.** Minimum 48×48dp for anything tappable — err larger, not smaller.
- **Icon + label, always.** Never an icon-only button for a primary action. Never a color-only indicator (e.g. a status chip needs a text label, not just a color).
- **≤2 taps from any tab root** to reach a primary action.
- **Generous text size and contrast.** Design for readers who may be older, in bright outdoor sunlight (field conditions), or using a phone at arm's length. WCAG AA contrast minimum.
- **Destructive actions always confirm.** Every delete (project, field, category, sample) shows a confirmation dialog naming exactly what will be lost, in plain language, before proceeding.
- **Respect OS accessibility settings.** Font-scaling must never be disabled; screen-reader labels on every interactive element.
- **Platform**: Android only, phone-first, portrait orientation. No tablet-specific layout, no iOS, no web.

## Design system

### Color palette
The app currently uses a clean, neutral, minimal aesthetic (not deeply Material-themed) built on Tailwind/NativeWind's default slate + emerald palette:

| Role | Color | Hex |
|---|---|---|
| Primary action (buttons, active states, links) | Emerald 600 | `#059669` |
| Primary action background tint (selected chip/card) | Emerald 50 | `#ECFDF5` |
| Primary action text on tint | Emerald 700 | `#047857` |
| Destructive action | Red 600 | `#DC2626` |
| Primary text | Slate 900 | `#0F172A` |
| Secondary/muted text | Slate 500 | `#64748B` |
| Borders, dividers | Slate 200 / Slate 300 | `#E2E8F0` / `#CBD5E1` |
| Subtle background fill (headers, disabled cells) | Slate 50 / Slate 100 | `#F8FAFC` / `#F1F5F9` |
| Base background | White | `#FFFFFF` |

Projects each pick their own accent color at creation, from a fixed set of 8 presets (not a free color picker): Emerald `#10B981`, Blue `#3B82F6`, Amber `#F59E0B`, Red `#EF4444`, Violet `#8B5CF6`, Pink `#EC4899`, Teal `#14B8A6`, Slate `#64748B`. Shown as a small filled circle (color dot) next to the project name anywhere projects are listed.

### Typography
- Headings: bold, large (24–32px range) — `text-2xl`/`text-3xl` weight bold.
- Body: 16px (`text-base`), regular for descriptions, semibold for labels/values.
- Secondary/meta text: 12–14px (`text-xs`/`text-sm`), slate-500.
- No custom font — system default, but always via scalable text sizing (never a fixed non-scaling pixel size that ignores OS font-scale settings).

### Spacing & sizing
- Screen horizontal padding: 24px (`px-6`).
- Minimum interactive element height: 48px, most primary buttons 56px.
- Rounded corners throughout: `rounded-xl` (12px) on buttons, cards, inputs, color swatches use full circles.
- Borders: 2px solid on inputs/buttons/cards, 1px for table/grid dividers.

### Iconography
Ionicons + FontAwesome (via `@expo/vector-icons`), outline style, always paired with a text label for primary actions. Recognizable brand icons for Google/GitHub sign-in.

### Core component patterns
- **Primary button**: solid emerald-600 fill, white bold text, 56px min height, full width, rounded-xl.
- **Secondary button**: white fill, 2px slate-300 border, slate-700 text.
- **Destructive button**: white fill, 2px red-300 border, red-600 text.
- **Text input**: white fill, 2px slate-300 border, rounded-xl, 56px min height, large placeholder/value text.
- **Selectable chip/toggle** (e.g. data-type picker, Single/Multi Shot toggle): unselected = slate-300 border; selected = emerald-600 border + emerald-50 fill + emerald-700 text.
- **Confirmation dialog**: native alert — title states the action plainly ("Delete this project?"), body names what's lost and says it's permanent, Cancel + destructive-styled confirm.
- **Modal (full-screen sheet)**: slides up, own header, scrollable body, sticky action bar (Cancel + primary action) pinned to the bottom.
- **Empty state**: centered icon/heading + one-line explanation + one clear primary action — never a blank screen with no guidance.
- **Loading state**: centered `ActivityIndicator`, no skeleton screens.

## App structure (navigation map)

```
Landing (logged out)
 ├─ Continue as Guest → Main
 └─ Log In → Sign In (log in / create account, + Google/GitHub) → Main

Main (signed in, two tabs — outer level, no project open)
 ├─ Tab: Projects
 │   ├─ (0 projects) Empty state → Create Project → Project (inner level)
 │   └─ (1+ projects) List → tap a project → Project (inner level)
 └─ Tab: Account
     └─ Sign Out → back to Landing

Project (inner level, opened from Projects — its own 3-tab bar + header)
 Header: ← back to Projects | Project name | ⚙ Settings
 ├─ Tab: Capture   (planned — see below)
 ├─ Tab: Fields    (built — spreadsheet-style schema editor)
 ├─ Tab: Data      (planned — see below)
 └─ ⚙ Settings → Project Settings (Delete Project)
```

## Screen-by-screen blueprint

### 1. Landing — *built*
First screen for a signed-out user.
- Centered layout: app name "Jotter" (large, bold), one-line tagline below it ("Capture photos, log data, export to CSV.").
- Primary button: **Continue as Guest** (solid emerald) — immediate, no form.
- Secondary button below it: **Log In** (outlined) → Sign In screen.
- No other content — deliberately minimal, first-run screen.

### 2. Sign In — *built*
- Heading toggles between "Log In" and "Create Account".
- Email field, password field (+ a second "Confirm password" field, shown only in Create Account mode).
- Primary button: Log In / Create Account (label matches mode).
- Text link below: "Don't have an account? Create one" / "Already have an account? Log in" (toggles mode).
- Divider: "or".
- Two secondary buttons with brand icons: **Continue with Google**, **Continue with GitHub**.

### 3. Main → Projects tab — *built*
**Empty state** (no projects yet — true for a brand-new account, or after deleting the last project):
- Centered heading: "Start Gathering Data".
- One-line explanation.
- Primary button: "Yes, let's start" → Create Project.

**List state** (1+ projects):
- Header row: "Projects" heading + "+ New" button (top-right) → Create Project.
- Scrollable list, each row: small color-dot (project's accent color) + project name, tap to open that project.

### 4. Main → Account tab — *built*
- Heading "Account".
- Info card showing: Account type (Guest/Registered), Sign-in method (email/google/github/anonymous), Email (or "None"), User ID.
- **Sign Out** button (secondary style) below the card.

### 5. Create Project — *built*
A single scrollable screen covering everything needed to start a project. Has its own back-arrow (top-left) instead of a tab bar.
- Heading: "New Project".
- **Project name** — text input.
- **Color** — row of 8 tappable color-dot swatches; selected one gets a dark ring.
- **Photos per sample** — a two-option toggle: **Single Shot** / **Multi Shot**.
  - Single Shot: one line of explanatory text, nothing else to configure.
  - Multi Shot: reveals a capture-plan builder — a list of named "slots" already added (e.g. "Top", "Side 1"), each removable; below that, an inline mini-form (name text input + optional numeric angle input + "Add" button) to add more.
- **Fields** — section header + "+ Add Field" button (opens the Add Field modal, below). Added fields list below as cards (name + data-type, each removable).
- Sticky bottom bar: **Create Project** primary button.
- On success: a "Project has been created" confirmation, then redirect straight into the new project.

### 6. Add Field modal — *built*
Full-screen sheet, opened from Create Project or the Fields tab.
- **Field name** — text input.
- **Data type** — a wrapping row of selectable chips: Text, Number, Date, Yes/No, Category, Photo, Timestamp (auto).
- If **Category** is selected, two sub-options appear:
  - **Use existing** — list of the researcher's own previously-created global categories, tap to select.
  - **Create new** — category name input, a Global/"Just this field" toggle, and an options builder (add option label + "Add" button, each added option removable) — e.g. building "Wet / Dry / Very Dry".
- Sticky bottom bar: Cancel + **Add Field**.

### 7. Project header + tab bar — *built*
Shown across all three inner tabs once a project is open.
- Thin header: ← back arrow (to Projects) | project name (centered, truncates if long) | ⚙ settings gear (to Project Settings).
- Below it, a standard 3-tab bottom bar: **Capture**, **Fields**, **Data**.

### 8. Project → Fields tab — *built*
The centerpiece "spreadsheet" screen.
- Top bar: "Fields" heading + an **Edit** toggle button (pencil icon) on the right.
- **Locked by default** (Edit off): sheet is view-only, with a note at the bottom explaining it's locked to prevent accidental changes.
- The sheet itself, styled like a spreadsheet:
  - A frozen left column showing row numbers (1, 2, 3...) that stays fixed while the rest scrolls horizontally.
  - Above the field headers, a row of spreadsheet column letters (A, B, C...).
  - Field header row: each column shows the field's name (bold) and its data type/category (small, muted text below).
  - Below the headers, a set of empty preview rows (grid cells, no data yet — real sample rows appear here once Capture is built).
  - When **Edit** is on: each field header gains a small red "×" delete button (with confirmation dialog before removal), and a dashed "+ Add Field" column appears at the end (opens the Add Field modal).

### 9. Project → Capture tab — *placeholder, planned*
Currently a "coming soon" placeholder explaining it's waiting on hardware compatibility work. **Planned design** (for Figma to design ahead of the real build):
- **Angle-assist step** (per photo slot): a live full-screen camera-adjacent view with a border/frame overlay that changes color (e.g. red → green) as the phone's tilt approaches the target angle for that slot, plus a haptic pulse on alignment. No numeric readouts — just the color cue, kept simple for non-technical users.
- **Capture step**: a large, centered circular shutter button (thumb-reachable, bottom-center, ~72px), a small persistent label showing which slot is being shot (e.g. "Side 2 of 4") for Multi Shot projects.
- **Logging form step** (after all slots for one sample are captured): one input per field, in the project's field order — text/number as text inputs, date as a date picker, Yes/No as a toggle, Category as a chip picker, Photo as a small "add photo" tile, Timestamp not shown at all (auto-filled). A dependent category field pre-fills but stays editable (shown with a subtle "suggested" visual treatment, not locked). Sticky **Save Sample** button at the bottom.

### 10. Project → Data tab — *placeholder, planned*
Currently a "coming soon" placeholder. **Planned design**: the same spreadsheet visual language as the Fields tab (frozen row-number column, lettered columns), but now populated with real sample rows — each cell showing that sample's value for that field, photo columns showing a small thumbnail rather than a filename. An "Export" button (top-right) bundles a CSV + all photos into a shareable zip via the OS share sheet.

### 11. Project Settings — *built*
Reached via the ⚙ gear in the project header.
- Own back-arrow header, project name, "Project settings" subheading.
- **Delete Project** button (destructive style) → confirmation dialog naming the project and warning that fields, categories, and samples all go with it, permanently.

## Key user flows

1. **First-ever open**: Landing → Continue as Guest (or Log In → Sign In) → Main/Projects (empty state) → "Yes, let's start" → Create Project → fill in name/color/capture-mode/fields → Create Project → confirmation → redirected into the new project's Fields tab area.
2. **Returning user, has projects**: Landing (skipped automatically if a session persists) → Main/Projects (list) → tap a project → project header + tabs.
3. **Adding a field later**: inside a project → Fields tab → tap Edit → "+ Add Field" → (same modal as project creation) → field appears as a new lettered column.
4. **Deleting a project**: inside a project → ⚙ Settings → Delete Project → confirmation → back to Projects list.
5. **Signing out**: Main → Account tab → Sign Out → back to Landing.

## States & edge cases to design for
- **Empty states**: no projects yet (Projects tab), no fields yet (Create Project's field list), no samples yet (Fields/Data tab body).
- **Loading states**: initial session check on app launch, fetching projects/fields on screen focus, saving in progress (buttons show a spinner and disable, not a full-screen block).
- **Locked vs. unlocked**: Fields tab's two visual modes (view-only vs. editable) should look distinctly different, not just a subtle style change.
- **Long text handling**: project names and field names should truncate gracefully (single line, ellipsis) rather than wrap and break layouts.
- **Offline**: the app is designed to work fully offline (see `docs/architecture.md`) — no design requirement yet for an explicit "offline" indicator, but keep this in mind as a possible future banner/badge.

## Out of scope for this design pass
- iOS or web layouts — Android phone portrait only.
- Tablet/large-screen layouts.
- Project sharing/invite UI (planned but not yet designed in detail).
- Camera calibration screen (locked ISO/shutter/white-balance/resolution) — planned, not yet designed.
