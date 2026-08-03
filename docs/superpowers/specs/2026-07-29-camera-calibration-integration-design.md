# Camera calibration + capture integration — design

## Context

The native camera module (`modules/jotter-camera/`, Kotlin/CameraX/`Camera2Interop`) is built and verified on-device — see `docs/superpowers/specs/2026-07-28-native-camera-module-design.md`. That spec explicitly scoped out two follow-on pieces: the calibration screen, and wiring `CameraCaptureStep.tsx`/`CaptureScreen.tsx` to actually shoot with a project's locked settings instead of `expo-camera`'s auto-exposure placeholder. This spec covers both.

The motivating requirement: a research capture flow needs identical ISO/shutter-speed/white-balance across every angle photo taken for a sample, so downstream image analysis (texture/color feature extraction, thresholding) isn't confounded by exposure drift between shots. Locking those three settings once per project and reusing them for every capture in that project satisfies this.

## Scope

Covers:
- A new `CameraCalibrationScreen` component (live-preview, slider-based).
- Calibration as a mandatory step in `CreateProjectScreen`'s existing flow.
- A "Recalibrate Camera" entry in `ProjectSettingsScreen`.
- Rewriting `CameraCaptureStep.tsx` to shoot with `JotterCameraView` and a project's locked settings.
- Data-layer additions in `modules/projects/api.ts` for reading/writing the three already-existing `projects` columns.

Explicitly out of scope:
- Resolution calibration. The native module has no capture-resolution API today (`CameraController.kt`'s `ImageCapture.Builder()` never sets a target resolution), even though `projects.camera_resolution_width`/`camera_resolution_height` columns exist. Those columns stay unused until a future task adds native resolution support. This spec's calibration screen only covers ISO, shutter speed, and white balance.
- The "confirm moisture reading" concept — resolved to be a plain required `number` field on the project's schema (`fields.is_required`), which already exists as a data-model concept; no new confirmation-dialog UI is needed. Not built here since the Fields/Add Field UI toggle for `is_required` (build order step 5b) isn't built yet either.
- iOS. The app is Android-only; no `Platform.OS` branching is needed anywhere in this work.

## Decisions

- **Per-project, not per-slot locking.** `camera_iso`/`camera_shutter_speed_ns`/`camera_white_balance` already live on `projects`, not `capture_slots` — confirmed correct, since the requirement is identical settings across every angle in a sample, not per-angle variation.
- **Calibration is mandatory at project creation, not a first-Capture-open gate.** This reverses what `modules/projects/CLAUDE.md` and `docs/architecture.md:142` currently document (calibration deliberately excluded from creation, deferred to first Capture open). That documented decision is superseded by this spec — both files get updated as part of implementation. Rationale: doing it once at creation, before any data collection starts, guarantees photo consistency from the very first sample, rather than leaving a window where a researcher could start capturing before locking anything down.
- **No runtime null-check gate in `CaptureScreen`.** Since calibration is mandatory at creation, `CaptureScreen`/`CameraCaptureStep` don't need to check for or redirect on missing settings. Pre-existing projects with null camera columns (created before this feature shipped) are handled defensively, not as a UX gate: `CameraCaptureStep` simply skips `setManualExposure()` if it isn't given settings, and the camera runs under CameraX's default (auto-exposure) binding rather than crashing.
- **Recalibration persists immediately; creation-time calibration doesn't.** `ProjectSettingsScreen`'s "Recalibrate" writes straight to Supabase via a new `updateProjectCameraSettings()`, since the project already exists. `CreateProjectScreen`'s calibration step only holds the chosen values in local component state until "Create Project" is pressed, at which point they ride along in the same insert as name/color/capture mode — consistent with how the rest of that screen already batches everything into one `createProject()` call.
- **Slider-based calibration UI, no raw numbers shown.** Matches `AGENTS.md`'s persona ("field researchers unfamiliar with technology"). Three continuous sliders — ISO, shutter speed, white balance — labeled plainly ("Brightness", "Exposure Time", "Color Warmth"), watched against a live `JotterCameraView` preview until the image looks right, no ISO/nanosecond/Kelvin values surfaced to the user.
- **Log-scale slider mapping for ISO and shutter speed; linear for white balance.** Shutter speed alone spans ~30µs to 30s (six orders of magnitude, confirmed via `getCapabilities()` on the test device) — a linear slider would put almost every commonly-useful speed (1/30s–1/1000s) into a sliver of the track. ISO gets the same treatment for a consistent feel across stops. White balance has no hardware-reported range (the module doesn't expose one), so it uses a fixed practical 2000K–10000K span, linear, matching the 2700K/9000K values already validated during the native module's on-device test pass.
- **Debounced live updates, not per-pixel.** Each `setManualExposure()` call triggers a full CameraX rebind in `CameraController.kt` (`bind()` unbinds and rebinds all use cases). Calling it on every `onValueChange` tick during a drag would spam rebinds and visibly stutter the preview. Sliders debounce ~150ms after the last drag movement, plus a guaranteed final call on `onSlidingComplete` so the last position always lands even if the debounce was mid-flight.
- **New dependency**: `@react-native-community/slider`, installed via `npx expo install` for SDK 56-compatible version resolution. Not previously a dependency.

## Data layer (`modules/projects/api.ts`)

No migration needed — `camera_iso` (integer), `camera_shutter_speed_ns` (bigint), `camera_white_balance` (text) already exist on `projects` in the live Supabase database (migration `20260709024213`, confirmed applied via `supabase migration list`).

- `createProject()`'s input gains `cameraSettings: ManualExposureOptions` (reusing the type from `modules/jotter-camera/src/JotterCamera.types.ts`), included directly in the existing insert.
- New `fetchProjectCameraSettings(projectId: string): Promise<ManualExposureOptions>` — reads the three columns back. Used by `CaptureScreen` (to pass down to `CameraCaptureStep`) and `ProjectSettingsScreen` (to pre-fill Recalibrate).
- New `updateProjectCameraSettings(projectId: string, settings: ManualExposureOptions): Promise<void>` — plain update on the three columns, used only by Recalibrate.

## `CameraCalibrationScreen` component

New file: `modules/camera/CameraCalibrationScreen.tsx`. Pure UI/hardware component — no Supabase imports, matching the existing rule for this module (`modules/camera/CLAUDE.md`).

```ts
type Props = {
  initialSettings?: ManualExposureOptions | null; // pre-fill for Recalibrate; omit for first-time creation
  onConfirm: (settings: ManualExposureOptions) => void;
  onCancel: () => void;
};
```

- Mounts `JotterCameraView`; on `onCameraReady`, calls `getCapabilities()` once to get the device's real `isoRange`/`exposureTimeRangeNs`. Wrapped in try/catch — on failure, shows an inline error state with a retry action rather than a broken slider screen with no valid ranges to map against.
- Renders three `@react-native-community/slider` controls (ISO, shutter, white balance) per the log/linear mapping above. The ISO/shutter log-scale conversion (slider position 0–1 ↔ real device value) is extracted into pure functions in a new `modules/camera/exposureMapping.ts`, since this math is easy to get wrong at range boundaries and is cheap to unit test in isolation.
- Starting position: `initialSettings` if provided (converted back to slider positions via the inverse mapping), else a sensible default (mid ISO, ~1/60s shutter, ~5500K daylight) applied immediately once the camera is ready.
- "Confirm" button calls `onConfirm()` with the last-applied raw values. No `takePicture()` call — this screen tunes by eye, it doesn't save a photo.
- Opened as a full-screen `Modal` from both call sites (matching the existing `AddFieldModal` pattern), not a separate navigator route.

## `CreateProjectScreen.tsx` changes

- New section between "Photos per sample" and "Fields": a summary row ("Camera — Not calibrated yet" / "Camera — Calibrated ✓") plus a "Calibrate Camera" / "Recalibrate" button, styled consistently with the screen's other sections.
- Button opens `CameraCalibrationScreen` in a `Modal`, no `initialSettings` on first use.
- New local state: `cameraSettings: ManualExposureOptions | null`.
- `handleCreate()` gains a guard: if `cameraSettings === null`, `Alert.alert('Camera not calibrated', 'Calibrate the camera before creating this project.')` and return — same pattern as the existing name/slot validation earlier in the same function.
- `createProject()` call passes `cameraSettings` through.

## `ProjectSettingsScreen.tsx` changes

- On mount, fetches current settings via `fetchProjectCameraSettings(projectId)` (this screen currently has no data fetch at all — adds a loading state while it resolves).
- New "Camera" section (no raw numbers shown) with a "Recalibrate Camera" button.
- Button opens `CameraCalibrationScreen` in a `Modal` with `initialSettings` pre-filled.
- `onConfirm` calls `updateProjectCameraSettings(projectId, settings)` directly — persists immediately, wrapped in try/catch + `Alert.alert` on failure, matching this file's existing `handleDelete` error-handling pattern — then updates the displayed status and closes the modal.
- `onCancel` closes the modal with no write.

## `CameraCaptureStep.tsx` rewrite

New required prop: `cameraSettings: ManualExposureOptions`. `CaptureScreen` fetches this once via `fetchProjectCameraSettings` and threads it both to its own direct usage and through to `SampleForm` (for the `photo`-data-type field capture case), so `CameraCaptureStep` itself stays free of any data-layer import.

- Keeps `expo-camera`'s `useCameraPermissions` for the permission-request UI only — the native module has no permission API of its own (unchanged from the native module spec's decision).
- Once permission is granted, renders `JotterCameraView` instead of `expo-camera`'s `CameraView`.
- On `onCameraReady`: if `cameraSettings` is present, calls `cameraRef.current.setManualExposure(cameraSettings)` once. If a caller ever passes `null`/`undefined` (defensive handling for pre-existing projects with null DB columns), skips the call — camera runs under CameraX's default binding.
- `handleShutter()` calls `cameraRef.current.takePicture()` (already returns a `file://` URI) instead of `takePictureAsync()`. Wrapped in try/catch → `Alert.alert` on failure.
- Removes the "Auto exposure — placeholder" banner entirely.

## Testing

- `modules/camera/exposureMapping.ts`'s log/linear conversion functions get Jest unit tests: both directions (slider position → device value and back), and boundary values (0, 1, midpoint) for each of ISO, shutter, and white balance.
- Everything else — the calibration screen, both integration points, and the capture rewrite — verified via an on-device manual test pass on the physical Xiaomi 2311DRK48G test device, matching the pattern already established for the native module itself (Task 8):
  1. Create a new multi-mode project; confirm "Create Project" is blocked until calibration is completed.
  2. Calibrate: confirm the live preview visibly responds to each of the three sliders (brightness change, exposure-time change, color-cast change).
  3. Confirm the created project's row in Supabase has non-null `camera_iso`/`camera_shutter_speed_ns`/`camera_white_balance`.
  4. Run a real capture sequence (multiple angle slots); confirm every photo looks consistently exposed/colored with each other.
  5. Open Project Settings, Recalibrate with different values, confirm the DB row updates and a subsequent capture reflects the new settings.

## Open follow-on work (not this spec)

- Resolution calibration (native module has no API for it yet).
- The moisture-reading (or any) required-field UI (`fields.is_required` toggle, build order step 5b).
- iOS manual-exposure equivalent (native module and this integration are both Android-only; app is Android-only entirely).
