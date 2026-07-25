---
name: Jotter
description: A near-black, editorial-industrial field tool — confident uppercase display type over light-weight body copy, hairline dividers instead of shadows, and a Calibration Stripe accent that mirrors the app's own locked white-balance range.

colors:
  canvas: "#000000"
  surface-soft: "#0d0d0d"
  surface-card: "#161616"
  surface-elevated: "#232323"
  ink: "#ffffff"
  body: "#b3b3b3"
  body-strong: "#e6e6e6"
  muted: "#7a7a7a"
  hairline: "#2a2a2a"
  hairline-strong: "#3d3d3d"
  primary: "#10b981"
  primary-strong: "#059669"
  primary-on: "#03140d"
  destructive: "#ef4444"
  destructive-strong: "#f87171"
  calibration-amber: "#f5a623"
  calibration-green: "#10b981"
  calibration-cyan: "#22d3ee"

typography:
  display-lg:
    fontFamily: "Inter Black, Inter, sans-serif"
    fontSize: "32sp"
    fontWeight: 900
    lineHeight: 1.05
    letterSpacing: "0.2px"
  display-md:
    fontFamily: "Inter ExtraBold, Inter, sans-serif"
    fontSize: "26sp"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "0.2px"
  title:
    fontFamily: "Inter Bold, Inter, sans-serif"
    fontSize: "20sp"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "16sp"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  body-light:
    fontFamily: "Inter Light, Inter, sans-serif"
    fontSize: "16sp"
    fontWeight: 300
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter Bold, Inter, sans-serif"
    fontSize: "13sp"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "1.2px"
  caption:
    fontFamily: "Inter, sans-serif"
    fontSize: "12sp"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.4px"

rounded:
  none: "0px"
  sm: "4px"
  full: "9999px"

spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-on}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "16px 24px"
    height: "56px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "16px 24px"
    height: "56px"
  button-destructive:
    backgroundColor: "transparent"
    textColor: "{colors.destructive}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    height: "48px"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    size: "48px"
  chip-selectable:
    backgroundColor: "transparent"
    textColor: "{colors.body}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    height: "48px"
  chip-selectable-active:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    height: "48px"
  text-input:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "16px"
    height: "56px"
  list-row:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "16px"
  top-bar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    height: "56px"
---

# Design System: Jotter

## Overview

**Creative North Star: "The Calibration Bench"**

Jotter's surface is a near-pure black canvas (`{colors.canvas}`) holding white, heavy-weight uppercase display type — the same "stamped versus engineered" contrast that gave the BMW reference its editorial confidence, rebuilt here with an original face (Inter, not a licensed automotive typeface) and an original reason to exist: this is the visual language of an instrument bench, not a showroom. A field researcher calibrating a camera's exposure before every capture is already living inside a world of locked settings, reference marks, and deliberate, sparse signal — the app should look like that instrument, not like a lifestyle brand borrowing its gloss.

The system carries over one deliberate constraint from the app's own prior world and rejects one from the reference: it stays completely flat — no shadows, ever, exactly as before — and it upgrades the reference's all-ghost-button convention where product truth demands otherwise. BMW's marketing surface can afford transparent, outline-only buttons because a car buyer already understands the page. A non-technical field researcher operating one-handed outdoors cannot be left guessing which shape is tappable, so Jotter's single primary action per screen stays a solid, unmistakable fill. Confidence in this system comes from restraint and precision, not from decoration or gloss.

**Confirmed anti-reference:** consumer/social app polish — no gradients, no soft shadows, no playful illustration, no rounded-friendly SaaS gloss. Nothing here should read as a lifestyle app.

**Key Characteristics:**
- Near-pure black canvas (`{colors.canvas}`) with white (`{colors.ink}`) type. There is no light-mode variant — dark is the only theme.
- Display headlines in UPPERCASE Inter at weight 900/800. Body copy drops to weight 300–400 — the heavy/light contrast is the system's signature.
- The **Calibration Stripe** (`{colors.calibration-amber}` → `{colors.calibration-green}` → `{colors.calibration-cyan}`) appears rarely, as a brand-signature mark only — never as a button fill.
- Captured field/sample photography is the system's real hero content, run large wherever it exists (project cards, Data grid thumbnails, the Capture preview) — there is no stock or decorative photography anywhere in this product.
- Corners are sharp (`{rounded.none}`) almost everywhere; the only curves are `{rounded.full}` on circular icon buttons and the rare `{rounded.sm}` toggle pill.
- Depth comes entirely from hairline dividers (`{colors.hairline}`) and tonal surface steps (`{colors.canvas}` → `{colors.surface-soft}` → `{colors.surface-card}` → `{colors.surface-elevated}`) — never a shadow.

## Colors

A near-monochrome dark ground with exactly one saturated interactive color and one rare tricolor signature — the palette stays quiet so the researcher's own photography and data are what stand out.

### Primary
- **Field Green** (`{colors.primary}` — #10b981): The single interactive accent, carried over from the app's original palette for continuity. Used on the one primary button per screen, selected chip/toggle states, and links. This is the "go / confirm" color throughout the app — it never appears purely decoratively.
- **Field Green Strong** (`{colors.primary-strong}` — #059669): Pressed/active state of Field Green.

### Signature Accent (rare)
**The Calibration Stripe Rule.** A three-stop, warm-to-cool sequence — `{colors.calibration-amber}` (#f5a623) → `{colors.calibration-green}` (#10b981) → `{colors.calibration-cyan}` (#22d3ee) — that visually mirrors the white-balance range the app's locked-exposure camera calibrates against per project. It appears only as a 3px accent stripe: on the app's own wordmark/splash, as a divider on the exposure-lock indicator once Capture is built, and on onboarding. It is never a button color, never a background fill, and never used more than once per screen. Its rarity is the entire point — if it shows up twice on one screen, it has already lost its meaning.

### Surface
- **Canvas** (`{colors.canvas}` — #000000): The base of every screen. True black.
- **Surface Soft** (`{colors.surface-soft}` — #0d0d0d): Barely-off-black, used for the Fields grid's frozen gutter and header row.
- **Surface Card** (`{colors.surface-card}` — #161616): List rows — project rows, field rows, capture-slot rows.
- **Surface Elevated** (`{colors.surface-elevated}` — #232323): One step up, used for the active/selected fill on chips and toggles (replaces the old system's `bg-emerald-50` selected-state fill).

### Hairlines
- **Hairline** (`{colors.hairline}` — #2a2a2a): Default 1px divider — between list rows, under the top bar, around the Fields grid cells.
- **Hairline Strong** (`{colors.hairline-strong}` — #3d3d3d): The 2px outline used on unselected buttons, inputs, and chips — this is the border weight the old light-mode system used at `border-slate-300`, kept at the same visual role and heft.

### Text
- **Ink** (`{colors.ink}` — #ffffff): All headline and primary text.
- **Body** (`{colors.body}` — #b3b3b3): Default running text, secondary labels, helper copy (was `text-slate-500`).
- **Body Strong** (`{colors.body-strong}` — #e6e6e6): Field names, list-row primary text (was `text-slate-900` on white; now near-white on black keeps the same relative emphasis).
- **Muted** (`{colors.muted}` — #7a7a7a): Placeholder text, disabled labels, the "auto" hint under the Fields id column.

### Semantic
- **Destructive** (`{colors.destructive}` — #ef4444): Delete actions, error copy. Same hue family as the old system's red, adjusted for dark-ground contrast.
- **Destructive Strong** (`{colors.destructive-strong}` — #f87171): Pressed state of destructive actions.

## Typography

**Display Font:** Inter (Black/ExtraBold cuts), with system sans-serif fallback.
**Body Font:** Inter (Regular/Light cuts).

**Character:** One family, two extremes of its weight axis — heavy uppercase display versus light-weight body — carrying over the reference's "stamped vs. engineered" contrast without adopting its proprietary face. Inter is chosen specifically because it stays highly legible at small sizes on a phone screen for a non-technical user, which a more stylized display face would compromise.

### Hierarchy
- **Display** (900, 32sp, 1.05 line-height, uppercase): Screen-level titles like "NEW PROJECT", hero moments (Landing).
- **Display Md** (800, 26sp, 1.1 line-height, uppercase): Section-level titles ("PROJECTS", "ACCOUNT").
- **Title** (700, 20sp, 1.2 line-height): Top-bar screen names, card titles, field names in the Fields grid header.
- **Body** (400, 16sp, 1.5 line-height): Default running text, input values.
- **Body Light** (300, 16sp, 1.5 line-height): Secondary/helper copy — descriptions, hints (was `text-slate-500` at regular weight; now carries the Light cut for the same secondary role).
- **Label** (700, 13sp, uppercase, 1.2px tracking): All button text, chip text, tab labels — every tappable label in the system is uppercase and tracked.

### Named Rules
**The Uppercase Action Rule.** Anything tappable that carries a short label — buttons, chips, tabs — is set in `{typography.label}`: bold, uppercase, tracked. Body copy is never uppercase. This is the one line that separates "you can act on this" from "you are reading this."

## Layout

Same spatial rhythm as the app's original implementation, carried forward: `px-6` (24px) horizontal screen padding, vertical rhythm on the `{spacing}` scale (8/12/16/24/32/48px), single-column portrait-only layout throughout (no tablet/landscape target). Primary CTAs anchor to the bottom of the screen in a footer band separated by a hairline, exactly as before. The Fields spreadsheet grid is the one screen that breaks single-column flow deliberately — it stays a frozen-gutter, horizontally-scrolling grid, and that exception is the point: it's the one place the app admits it's a spreadsheet.

## Elevation & Depth

Flat by design, with no exceptions. There is no shadow token in this system and none should be added. Depth is conveyed exclusively through two devices: hairline dividers (`{colors.hairline}`) marking edges, and tonal surface steps (canvas → surface-soft → surface-card → surface-elevated) marking layers. A card sitting "above" the canvas is communicated by its fill being one tone lighter, never by a drop shadow.

### Named Rules
**The No-Shadow Rule.** If a component needs to look "raised," give it a lighter surface tone or a hairline outline — never `box-shadow`/`elevation`. This was already true of the app's original light-mode system and stays true here; it is not a casualty of going dark, it is a constant.

## Shapes

Sharp by default: `{rounded.none}` (0px) on every button, input, card, and list row. This is a deliberate departure from the app's original `rounded-xl` (12px)-everywhere language, adopted because the sharp-cornered "precision instrument" silhouette is what makes this system read as calibrated and engineered rather than soft and consumer-friendly. The only curves in the entire system: `{rounded.full}` on circular icon-only buttons (back arrow, settings gear, carousel-style controls), and `{rounded.sm}` (4px) on the rare small toggle pill where a fully sharp corner would look like a rendering error at very small sizes.

## Components

### Buttons
- **Shape:** Sharp corners (`{rounded.none}`), 56px height for primary CTAs, 48px for secondary actions and icon buttons — the 48px floor is a hard minimum (Android's touch-target guideline), a stricter floor than the prior system's 44px icon buttons.
- **Primary:** Solid `{colors.primary}` fill, `{colors.primary-on}` (near-black) label — the one deliberate break from the reference's ghost-button convention. Label always uppercase (`{typography.label}`). One primary button per screen, maximum.
- **Secondary / Outline:** Transparent fill, 2px `{colors.hairline-strong}` border, `{colors.ink}` label. This is the reference's ghost-button language, kept as-is for every non-primary action.
- **Destructive:** Transparent fill, 2px `{colors.destructive}`-tinted border, `{colors.destructive}` label. Reserved for delete/irreversible actions only.
- **Icon-only:** Transparent, no border, `{rounded.full}`, 48×48px minimum — back navigation, settings gear.

### Chips (selectable toggles)
- **Style:** Transparent by default with a 2px `{colors.hairline-strong}` border; on selection, fill goes to `{colors.surface-elevated}` and the border/label switch to `{colors.primary}`. This directly replaces the old system's `border-emerald-600 bg-emerald-50` selected state.
- **Use:** Capture mode (Single/Multi Shot), field data-type picker, category mode, color/category selection rows.

### Cards / List Rows
- **Corner Style:** Sharp (`{rounded.none}`).
- **Background:** `{colors.surface-card}`.
- **Depth Strategy:** Tonal step up from canvas — see Elevation & Depth. No border by default; a hairline separates stacked rows instead of wrapping each one.
- **Internal Padding:** `{spacing.md}` (16px).
- **Imagery:** Where a project or sample has a captured photo, it runs as the row's dominant visual element (left-aligned thumbnail growing to a near-full-bleed treatment on the Data grid and Capture preview) — this is the system's one photography-led moment, and it only ever shows real captured photos, never a placeholder image standing in for one.

### Inputs / Fields
- **Style:** Transparent fill, 2px `{colors.hairline-strong}` border, sharp corners, `{colors.ink}` value text, `{colors.muted}` placeholder.
- **Focus:** Border brightens to `{colors.primary}` — no glow, no shadow.
- **Height:** 56px, matching primary buttons so a form's rhythm stays even.

### Navigation
- **Top bar:** `{colors.canvas}` background, back icon left, `{typography.title}` centered/leading name, one contextual icon action right (e.g. project settings gear), separated from content by a single hairline. No shadow, no elevation change on scroll.
- **Bottom tabs:** `{colors.canvas}` background, hairline top border, `{typography.label}` tab text — unselected tabs at `{colors.body}`, selected at `{colors.primary}`.

### The Fields Grid (signature component)
The one place the app is honest about being a spreadsheet: a frozen row-number gutter (`{colors.surface-soft}` fill) stays fixed while the field columns scroll horizontally beneath a column-letter row (A/B/C…) and a header row carrying each field's name, type, and category. Every cell boundary is a 1px `{colors.hairline}` line — no fills inside the data cells themselves, so captured data reads as data, not as decoration. This grid is the system's clearest expression of "instrument, not showroom": it looks exactly like what it is.

## Do's and Don'ts

### Do:
- **Do** keep the Calibration Stripe to one appearance per screen, and never as a button or background fill — its rarity is the whole point.
- **Do** run captured field/sample photography large and unapologetically wherever it exists — it is the system's only "hero" content.
- **Do** keep every tappable label uppercase and tracked (`{typography.label}`); keep every body copy sentence-case.
- **Do** hold every touch target to a 48px floor, 56px for primary actions.
- **Do** use a solid-fill primary button for the one primary action per screen — non-technical users need an unmistakable "tap here."

### Don't:
- **Don't** use BMW's licensed typeface or the literal blue/blue/red M-tricolor — this system's face is Inter and its signature stripe is the original amber/green/cyan Calibration Stripe.
- **Don't** add a shadow, glow, or elevation effect anywhere. Depth is hairlines and tonal steps only.
- **Don't** round a corner beyond `{rounded.sm}` outside of circular icon buttons (`{rounded.full}`) — sharp corners are the system's silhouette.
- **Don't** introduce a light-mode variant. This system is dark-only by design.
- **Don't** use stock or fabricated photography anywhere. If a photo slot is empty, show a deliberate dark placeholder — never invented imagery.
