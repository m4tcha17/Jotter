# Current Task

**Native camera module (locked manual exposure) — built and verified on-device.**

Replaces `expo-camera`'s auto-exposure stock API with a new local Expo module, `modules/jotter-camera/` (Kotlin, CameraX + `Camera2Interop`), for locked ISO/shutter-speed/white-balance photo capture. Scoped per `docs/superpowers/specs/2026-07-28-native-camera-module-design.md`: the capture module only — no calibration screen, no `CaptureScreen.tsx`/`CameraCaptureStep.tsx` wiring, Android only.

- `modules/jotter-camera/android/.../CameraController.kt` — CameraX binding/lifecycle, capabilities query (`SENSOR_INFO_SENSITIVITY_RANGE`, `SENSOR_INFO_EXPOSURE_TIME_RANGE`, `SCALER_STREAM_CONFIGURATION_MAP`), manual-exposure rebind via `Camera2Interop.Extender`, `takePicture` (JPEG quality fixed at 92).
- `modules/jotter-camera/android/.../WhiteBalance.kt` — Kelvin → `COLOR_CORRECTION_GAINS` approximation (Tanner Helland algorithm), clamped to `[1.0, 4.0]`.
- `modules/jotter-camera/android/.../JotterCameraView.kt` / `JotterCameraModule.kt` — Expo Modules API wiring: view-scoped `getCapabilities`/`setManualExposure`/`takePicture`, `onCameraReady` event.
- `modules/jotter-camera/index.ts` / `src/JotterCameraView.tsx` / `src/JotterCamera.types.ts` — TS API surface (`JotterCameraView`, `CameraCapabilities`, `ManualExposureOptions`, `TakePictureResult`, `JotterCameraViewHandle`).
- Permissions: reuses `expo-camera`'s existing `useCameraPermissions` hook — this module has no permission API of its own.

**On-device test matrix — all 6 steps PASS**, run 2026-07-29 on a physical Xiaomi 2311DRK48G (confirmed Camera2 hardware level `LEVEL_3`):

1. Preview renders — confirmed live.
2. Capabilities query — real device values: ISO range [50, 6400], `exposureTimeRangeNs` [30833, 30000000000] ns (~1/32000s to 30s). Sane for this device's hardware level.
3. ISO sweep — ISO 50 visibly dark, ISO 6400 visibly blown-out bright on the same static scene. Clear monotonic brightness response.
4. Shutter sweep — 1/8s bright, 1/500s near-black. Clear monotonic exposure-time response.
5. White balance sweep — WB 2700K produced a blue-gray cast, WB 9000K produced a distinct green cast on the same framing. The sensor corrects in the direction opposite the naive "warm/cool" label (you supply the assumed scene illuminant color temp and it corrects inversely) — this is a spec-quirk already flagged in Task 2's review, not a new bug. Shift between the two settings was clear and distinct.
6. `takePicture` — returned a `file://.../cache/jotter-capture-*.jpg` URI with no error. The file was pulled off-device and verified: valid JPEG, ~693KB, 2448x3264, EXIF confirms the Xiaomi 2311DRK48G sensor. Visually the captured JPEG matches the live preview's WB-9000K green cast, confirming locked settings are baked into the actual capture pipeline, not just the preview.

**Not yet done / acceptance criteria before calling the *camera feature* (not just this module) finished:**
- Calibration screen UI (build order step 7) — lets a researcher pick ISO/shutter/white-balance/resolution using `getCapabilities()`'s real device-supported ranges, persists to `projects.camera_iso`/`camera_shutter_speed_ns`/`camera_white_balance`/`camera_resolution_width`/`camera_resolution_height`.
- `modules/camera/CameraCaptureStep.tsx` rewrite to actually consume `JotterCameraView` with a project's locked settings, replacing the current `expo-camera` auto-exposure placeholder — this is also where the "Auto exposure — placeholder" banner gets removed.
- iOS manual-exposure equivalent — explicitly deferred, not scoped anywhere yet.

**Known gaps, not blocking (carried over):**
- Writes still go straight to Supabase, bypassing the offline-first SQLite layer.
- Guest-to-OAuth/email identity linking is still not implemented.
- Dependent category fields — still deferred.

## Suggested build order (after this task)
1. ~~Navigation shell~~ / ~~Empty-state → project creation~~ / ~~Samples & capture modes~~ / ~~Project tabs + real Fields tab~~ / ~~Data-integrity schema~~ / ~~Native camera module~~ — done above.
2. Local SQLite schema + typed data-access layer — still overdue.
3. ~~Camera hardware capability spike~~ — done (device confirmed `LEVEL_3`).
4. Guest → registered upgrade flow via Supabase identity linking.
5. Dependent category fields.
5b. Fields tab / Add Field modal `is_required`/`is_sample_identifier` toggles.
6. Camera calibration screen + `CameraCaptureStep.tsx`/`CaptureScreen.tsx` wiring to the new native module — the two follow-on pieces of work this module's own spec named as out of scope.
7. ~~Camera calibration screen~~ — folded into 6 above; kept as a separate spec/plan, not a separate build-order slot.
8. ~~Real Data tab~~ — done; still owes CSV/zip export.
9. Supabase sync.
10. Project sharing.

When the user assigns the next concrete task, replace this file's content with that task's specific scope and acceptance criteria.
