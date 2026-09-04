# Open Camera capture — design

## Context

Photo capture for Jotter currently runs on a custom native Android module
(`modules/jotter-camera/`, Kotlin / CameraX / `Camera2Interop`, ~200 lines) that
opens the camera hardware live inside a React Native view and locks manual
exposure (ISO / shutter / white balance / focus). Two follow-on specs built on
it: `2026-07-28-native-camera-module-design.md` (the module) and
`2026-07-29-camera-calibration-integration-design.md` (per-project calibration +
wiring it into the capture flow).

On-device use surfaced two bugs:

1. **Blurry photos.** The module disables autofocus and pins focus to a
   hardcoded 25 cm (`CameraController.kt` `FIXED_FOCUS_DISTANCE_DIOPTERS = 4.0`).
   Testing showed both calibrated and uncalibrated projects were soft — partly
   the wrong fixed distance, partly handheld motion blur, partly the main lens
   not focusing that close. Blur defeats the downstream ML feature extraction
   (GLCM texture, Canny edges) on marble-sized samples.
2. **Black screen on second open.** `JotterCameraView`'s coroutine scope is
   never cancelled on detach, and `CameraController.stop()` is a no-op when it
   loses a race against async setup. A camera session then binds to a dead
   lifecycle owner; because `ProcessCameraProvider` is a process singleton, that
   orphaned session blocks the next open (black preview). Opening the separate
   calibration screen forces a clean bind/unbind that clears it — hence
   "recalibrate to fix it". A stash (`stash@{0}`) holds earlier band-aid
   attempts against the same area.

These bugs are inherent to hosting a live camera session in the RN view tree.
Rather than keep patching, this spec replaces the entire in-app camera with a
hand-off to **Open Camera** (open-source, F-Droid: `net.sourceforge.opencamera`),
which provides lockable manual ISO / shutter / white balance / manual focus,
HDR-off, and no digital zoom. Jotter becomes pure data collection plus a thin
launcher.

### Validated on-device (POCO X6 Pro 5G) before writing this spec

- Standalone manual capture: ISO / shutter / WB / zoom / flash / no-HDR
  identical across 5 frames — manual lock holds shot-to-shot.
- Intent capture (`ACTION_IMAGE_CAPTURE` from another app): manual settings
  survive the hand-off — ISO, shutter, WB, zoom, HDR all preserved in EXIF.
- DNG is **not** returned through the intent (JPEG only). Acceptable — the
  feature-extraction pipeline is JPEG-only.

This spec supersedes `2026-07-29-camera-calibration-integration-design.md`
(per-project calibration) in full, and retires the `modules/jotter-camera/`
module from `2026-07-28`.

## Scope

Covers:

- A new local Expo module `modules/jotter-open-camera/` — package-pinned
  `ACTION_IMAGE_CAPTURE` intent to Open Camera, plus an installed check.
- Rewriting `modules/camera/CameraCaptureStep.tsx` from a live-preview shutter
  into a launcher + review screen.
- A new install-gate screen shown when Open Camera is absent.
- Removing the custom camera module, both calibration screens, the
  `expo-camera` dependency, all per-project camera-settings code, and the five
  `camera_*` columns on `projects` (local SQLite + Supabase + `docs/schema.sql`
  + `seed.ts`).
- Stripping the now-dead `cameraSettings` plumbing from `CaptureScreen.tsx` and
  `SampleForm.tsx`.

Explicitly out of scope:

- In-app Open Camera setup guidance. The operator configures Open Camera once
  per device (manual ISO/shutter/WB/MF, Camera2 API on, HDR off, no zoom, no
  stamp) from an external SOP. Jotter only checks that the app is installed.
- iOS. The app is Android-only; no `Platform.OS` branching anywhere.
- `capture_mode`, capture slots, and the multi-angle stepping flow — untouched.
  These organise "how many photos per sample", not camera hardware.
- `AngleAssistStep` (tilt/level guide) — kept exactly as-is, still the
  pre-launch step for angled slots.
- The uncommitted `modules/fields/` change (Required / Sample Identifier
  toggles) — unrelated, tracked separately.

## Decisions

- **Hard-pin to Open Camera, no chooser.** The intent sets
  `package = "net.sourceforge.opencamera"`. If the app is not installed, capture
  is blocked behind an install-gate screen. Rationale: a generic
  `ACTION_IMAGE_CAPTURE` chooser relies on the operator picking the right app
  every time and on their device default not being the stock camera (which
  drops to auto exposure on intent capture). Consistency matters more than
  flexibility here.

- **A tiny native module is still required.** Android exposes no JavaScript API
  for a package-targeted capture that returns a full-resolution file.
  `expo-image-picker` cannot target a package; `expo-intent-launcher` cannot
  marshal `EXTRA_OUTPUT` as a `Uri` parcelable (only string extras), so Open
  Camera would ignore it and return a low-res thumbnail. The new module is
  ~50 lines with no camera code — it builds an intent, awaits an activity
  result, and returns a file path. It is not the class of thing being retired
  (a live CameraX session with lifecycle).

- **Drop per-project calibration entirely.** Open Camera holds exposure settings
  globally on the device; Jotter cannot store or apply them per project.
  Removing them (rather than keeping a reference-note field) is simplest and
  the operator's SOP covers the setup. This reverses
  `2026-07-29`'s mandatory-calibration-at-creation decision and the
  corresponding lines in `modules/projects/CLAUDE.md` and `docs/architecture.md`
  — all updated as part of implementation.

- **Full removal of the `camera_*` columns**, not dormant columns. The five
  columns (`camera_iso`, `camera_shutter_speed_ns`, `camera_white_balance`,
  `camera_resolution_width`, `camera_resolution_height`) are dropped from local
  SQLite (schema edit + a `user_version` v2 migration for existing dev installs)
  and Supabase (new migration), with `docs/schema.sql` and
  `modules/account/seed.ts` updated to match. The app is not yet distributed to
  real users, so this is low-risk now and avoids a later cleanup pass.

- **Jotter shows its own review screen after capture.** Open Camera's intent
  mode has its own accept/retake step, but Jotter adds a thumbnail +
  "Use Photo / Retake" screen so the operator can bail without re-entering Open
  Camera's flow, and so the review UX is consistent with the rest of Jotter.

- **`AngleAssistStep` unchanged.** It runs before launching Open Camera for any
  slot with a `target_angle_degrees`, exactly as today. Open Camera's own level
  overlay (enabled in its settings, per the SOP) continues the guidance through
  the app switch.

- **Drop `expo-camera`.** Its only remaining uses are `useCameraPermissions` in
  the two files being deleted/rewritten. With intent hand-off Jotter never
  touches the camera, so it needs no camera permission.

## New module — `modules/jotter-open-camera/`

Local Expo module, same layout as `jotter-camera` (own `android/`, `src/`,
`expo-module.config.json`, autolinked).

### JS API (`src/index.ts`)

```ts
export type CaptureResult = { uri: string } | { cancelled: true };

export function isOpenCameraInstalled(): boolean;   // synchronous
export function capture(): Promise<CaptureResult>;
```

### Kotlin — `JotterOpenCameraModule.kt`

- `Function("isOpenCameraInstalled")` — `packageManager.getPackageInfo(
  "net.sourceforge.opencamera", 0)` in try/catch → `Boolean`.

- `AsyncFunction("capture")`:
  1. Create `File(context.cacheDir, "oc-capture-<timestamp>.jpg")`.
  2. `FileProvider.getUriForFile(context, "<applicationId>.opencamera.fileprovider", file)`.
  3. `Intent(MediaStore.ACTION_IMAGE_CAPTURE)` with
     `setPackage("net.sourceforge.opencamera")`,
     `putExtra(MediaStore.EXTRA_OUTPUT, uri)`,
     `addFlags(FLAG_GRANT_WRITE_URI_PERMISSION)`.
  4. Launch for result via the Expo Modules API activity-result mechanism;
     await.
  5. `Activity.RESULT_OK` → resolve `{ "uri": "file://<file path>" }`.
     `RESULT_CANCELED` → resolve `{ "cancelled": true }`.
     `ActivityNotFoundException` → reject `ERR_OPEN_CAMERA_MISSING`.

- FileProvider is declared in the module's own
  `android/src/main/AndroidManifest.xml` (`<provider>` with authority
  `${applicationId}.opencamera.fileprovider`) plus a `res/xml/file_paths.xml`
  exposing `<cache-path>`. Self-contained — no app-level config-plugin change.

The exact Expo activity-result hook for SDK 56 (module-level `OnActivityResult`
vs `registerForActivityResult` vs a view requirement) is confirmed against the
`expo-module` skill / SDK 56 docs at implementation. The JS contract above is
fixed.

## Capture flow — `modules/camera/CameraCaptureStep.tsx`

Rewritten. No `JotterCameraView`, no `expo-camera`, no `cameraSettings`.

```ts
type Props = {
  label: string;
  onCapture: (localUri: string) => void;
  onCancel: () => void;
};
```

State machine: `idle` → `capturing` → `review` → (attach | back to `idle`).

- On mount, if `!isOpenCameraInstalled()` → render `OpenCameraInstallGate`
  (below) instead of the button.
- `idle`: the slot `label` + an "Open Camera" button, and a "Cancel" affordance
  wired to `onCancel`.
- Button press → `capturing`; `await capture()`.
  - `{ cancelled: true }` → back to `idle`.
  - `{ uri }` → go to `review` (the returned cache-dir file is displayed
    directly; no intermediate copy).
  - `ERR_OPEN_CAMERA_MISSING` thrown mid-flow → render `OpenCameraInstallGate`.
- `review`: `<Image>` of the returned cache-dir JPEG + "Use Photo" / "Retake".
  - "Use Photo" → copy to `Paths.document` as `${newId()}.jpg` (unchanged from
    today), call `onCapture(documentUri)`.
  - "Retake" → re-invoke `capture()`.

Design-system: dark-only "Calibration Bench" per `modules/CLAUDE.md` /
`DESIGN.md`. Accessibility floor (`accessibilityRole`/`accessibilityLabel`,
48×48dp targets) on every control.

## Install-gate — `modules/camera/OpenCameraInstallGate.tsx`

Small presentational component, reused by `CameraCaptureStep` (capture flow) and
the sample-photo-field flow.

- Copy: "Jotter uses Open Camera to take photos. Install it to continue."
- Button → `Linking.openURL('market://details?id=net.sourceforge.opencamera')`,
  catch → open the F-Droid web URL
  (`https://f-droid.org/packages/net.sourceforge.opencamera/`).
- A "Cancel" / back affordance so the operator isn't trapped.

## Call-site changes

### `modules/capture/CaptureScreen.tsx`

- Remove: `cameraSettings` state, the `fetchProjectCameraSettings` import and
  its `useEffect`/`useFocusEffect` refetch, the `ManualExposureOptions` import.
- `step === 'camera'`: keep the existing `<Modal>` + "Take Sample" button
  pattern. `CameraCaptureStep` inside the modal now gets `label` / `onCapture` /
  `onCancel` only. `onCancel` → `setCameraOpen(false)`. `onCapture` unchanged
  (`setCameraOpen(false)` then `handleAdvanceSlot(uri)`).
- `angle-assist` branch and `AngleAssistStep` — untouched.

### `modules/samples/SampleForm.tsx`

- Remove the `cameraSettings` prop and `ManualExposureOptions` import. The
  photo-field `<Modal>` renders `CameraCaptureStep` with `label` / `onCapture` /
  `onCancel`.

### `modules/projects/api.ts`

- Delete `fetchProjectCameraSettings`, `updateProjectCameraSettings`, the
  `ManualExposureOptions`/`WhiteBalancePreset` imports, and the `cameraSettings`
  field on the `createProject` input. Remove the five `camera_*` columns from
  the `createProject` insert.

### `modules/projects/ProjectSettingsScreen.tsx` and `CreateProjectScreen.tsx`

- Delete the "Calibrate / Recalibrate Camera" section, the `calibrationOpen`
  state, the `CameraCalibrationScreen` modal and import, and the
  `cameraSettings` state.

### `modules/account/seed.ts`

- Drop the five `camera_*` columns from the projects `SELECT` (line ~48) and the
  `INSERT OR REPLACE` (line ~134) plus the corresponding bind values.

## Data layer — removing the `camera_*` columns

### Local SQLite (`lib/db.ts`)

- Edit the `SCHEMA_V1` `projects` block: remove `camera_iso`,
  `camera_shutter_speed_ns`, `camera_white_balance`, `camera_resolution_width`,
  `camera_resolution_height`.
- Add a v2 step to `migrate()`:
  ```
  if (version < 2) {
    await db.execAsync(`
      ALTER TABLE projects DROP COLUMN camera_iso;
      ALTER TABLE projects DROP COLUMN camera_shutter_speed_ns;
      ALTER TABLE projects DROP COLUMN camera_white_balance;
      ALTER TABLE projects DROP COLUMN camera_resolution_width;
      ALTER TABLE projects DROP COLUMN camera_resolution_height;
    `);
    version = 2;
  }
  ```
  `ALTER TABLE ... DROP COLUMN` is supported by the SQLite bundled with
  `expo-sqlite` (3.35+). Existing dev installs are at `user_version = 1` and
  pick this up on next launch; fresh installs get the clean `SCHEMA_V1` and skip
  straight to 2.

### Supabase

- New migration `supabase/migrations/<timestamp>_drop_project_camera_columns.sql`:
  ```sql
  alter table projects drop column if exists camera_iso;
  alter table projects drop column if exists camera_shutter_speed_ns;
  alter table projects drop column if exists camera_white_balance;
  alter table projects drop column if exists camera_resolution_width;
  alter table projects drop column if exists camera_resolution_height;
  ```

### Docs

- `docs/schema.sql`: remove the five columns from the `projects` table.
- `docs/architecture.md`: update the camera decision(s) to describe the Open
  Camera hand-off; remove the "calibration at first Capture open" / mandatory
  calibration language.
- `modules/projects/CLAUDE.md`, `modules/camera/CLAUDE.md`,
  `modules/capture/CLAUDE.md`, `modules/jotter-camera/` removal — update /
  delete the camera-related notes.
- `AGENTS.md`: the "custom native camera module for locked manual exposure"
  key-architecture bullet is replaced with the Open Camera hand-off.

## Deletions

- `modules/jotter-camera/` — entire directory (Kotlin, TS, `android/`,
  `expo-module.config.json`).
- `modules/camera/CameraCalibrationScreen.tsx`
- `modules/camera/exposureMapping.ts` and
  `modules/camera/__tests__/exposureMapping.test.ts`
- `expo-camera` from `package.json` (and `npx expo install --fix` / lockfile
  update).
- `@react-native-community/slider` **only if** nothing else uses it after
  `CameraCalibrationScreen` is gone — check first (`grep -r "community/slider"`).

## Testing

### Automated (runs in CI / on machine)

- `npx tsc --noEmit` clean after all import removals.
- Jest: `OpenCameraInstallGate` render + store-URL fallback; `CameraCaptureStep`
  state-machine transitions with `capture()` mocked (`idle → capturing →
  review → attach`, cancel path, `ERR_OPEN_CAMERA_MISSING` path). The
  `jotter-open-camera` native module has no unit tests, consistent with
  `jotter-camera` (`modules/camera/CLAUDE.md`: native is manual-verify only).
- `exposureMapping.test.ts` is deleted with its source.

### On-device manual checklist (operator runs, POCO)

1. New project → Capture → "Open Camera" → shoot → review → "Use Photo" →
   photo attaches to the sample.
2. "Retake" from the review screen re-opens Open Camera.
3. Cancel inside Open Camera → returns to `idle`, no crash.
4. Multi-slot project → capture each slot in sequence, each photo attaches to
   the correct slot.
5. Angled slot → `AngleAssistStep` still runs before the camera launches.
6. Sample-photo field in the logging form → same capture + review flow works.
7. Uninstall Open Camera → capture button → install-gate screen with a working
   store link.
8. Reopen the camera repeatedly after captures — **no black screen** (no camera
   session in Jotter). Photos are **sharp** (Open Camera's manual focus).

## Implementation notes

- The temporary `[diag]` logging added to `CameraController.kt` during
  investigation is removed with the whole module — no separate cleanup.
- Order that keeps the tree compiling: (1) add `jotter-open-camera`; (2) rewrite
  `CameraCaptureStep` + add install-gate; (3) strip call sites
  (`CaptureScreen`, `SampleForm`, `projects/api.ts`, the two project screens,
  `seed.ts`); (4) delete `jotter-camera` + calibration screens + `expo-camera`;
  (5) DB migrations + docs. Native rebuild (operator) after step 1 and step 4.
