# Native camera module (Camera2Interop manual exposure) — design

## Context

`docs/architecture.md`'s architecture decisions require locked manual exposure (ISO, shutter speed, white balance) for photo capture, because the app's downstream (ML) use of captured photos depends on consistent, repeatable exposure across every capture in a project — something `expo-camera`'s stock JS API cannot provide (only `zoom`/`flash`/`enableTorch`/`autofocus`/`active` are exposed; verified against the SDK 56 docs). `modules/camera/CameraCaptureStep.tsx` currently runs on `expo-camera`'s auto-exposure API as an explicitly-labeled interim placeholder, pending this module.

**Hardware capability spike (`docs/current-task.md` build order step 3) — done, passed.** Queried via `adb shell dumpsys media.camera -a`, grepping `android.info.supportedHardwareLevel`: the connected test device (model `2311DRK48G`) reports **hardware level 3 (`LEVEL_3`)** on all 6 camera entries. Camera2 hardware level ordering is `LEGACY(2) < LIMITED(0) < FULL(1) < LEVEL_3(3)`; the architecture's floor is `LIMITED`. This device is well above that floor — clear to build the native module against it.

## Scope

This spec covers **only** the native capture module itself (build order step 6's "native manual-exposure camera capture" piece). Explicitly out of scope, each to be its own follow-on brainstorm/spec once this module exists and its real API shape is known:

- The camera calibration screen (build order step 7) that lets a researcher pick ISO/shutter/white-balance/resolution using this module's capability query.
- Wiring `CameraCaptureStep.tsx` / `CaptureScreen.tsx` to actually shoot with a project's locked settings (rest of build order step 6).
- iOS/AVFoundation manual-exposure equivalent — explicitly deferred; **Android only** for this spec.

## Decisions

- **Engine**: CameraX + `Camera2Interop.Extender`, per `docs/architecture.md:15`'s own stated direction (not a novel choice — the architecture already specifies this). CameraX handles lifecycle/preview/rotation boilerplate; `Camera2Interop` layers manual `CaptureRequest` keys (`SENSOR_SENSITIVITY`, `SENSOR_EXPOSURE_TIME`, `CONTROL_AWB_MODE`/`COLOR_CORRECTION_GAINS`, `CONTROL_MODE=OFF`, `CONTROL_AE_MODE=OFF`) on top. Rejected alternatives: raw Camera2 (far more native boilerplate for a one-developer project — exactly what CameraX exists to eliminate) and `react-native-vision-camera` (heavy third-party dependency, off the architecture's own stated path, not aligned with the "custom native camera module" decision).
- **Module shape**: a new local Expo module at `modules/native/jotter-camera/` (`expo-module create` convention — own `android/` Kotlin source, own `index.ts` TS API, own `expo-module.config.json`), registered as a config plugin in `app.json`'s `plugins` array alongside the existing `expo-camera` entry. `expo-camera` stays installed, but only for its permission hook — no capture code from it is used by the new module.
- **Permissions**: reuse `expo-camera`'s existing `useCameraPermissions` hook for the OS `CAMERA` permission (already built, already verified on-device today). The new module does not implement its own permission request/check API — same OS permission either way.
- **White balance representation**: Kelvin value in, matching `docs/architecture.md:96`'s `projects.camera_white_balance` column (already described as "color-correction gains or Kelvin value"). A calibration UI naturally wants a temperature slider; the module converts Kelvin → `COLOR_CORRECTION_GAINS` internally via a daylight-locus approximation, not exposed to JS as raw RGGB gains.
- **JPEG quality**: fixed at 92/100 app-wide per `docs/architecture.md:17` — not a configurable parameter anywhere in this module's API.

## API surface

- **`JotterCameraView`** — native View component (Expo Modules View-based pattern) wrapping a CameraX `PreviewView`.
  - Props: `style`, `facing: 'back' | 'front'` (default `'back'`), `onCameraReady`, `onCapabilities` (fires once, after CameraX binds, with the queried ranges below).
- **`getCapabilities()`** → `{ isoRange: [min, max]; exposureTimeRangeNs: [min, max]; availableResolutions: { width: number; height: number }[] }` — queried via `Camera2CameraInfo.extractCameraCharacteristics()` (includes `StreamConfigurationMap.getOutputSizes()` for real device-supported still-capture resolutions) once the camera has bound. This is what a future calibration screen calls to show real device-supported values instead of guessing.
- **`setManualExposure({ iso: number; shutterSpeedNs: number; whiteBalanceKelvin: number })`** — sets `SENSOR_SENSITIVITY` and `SENSOR_EXPOSURE_TIME` directly; converts `whiteBalanceKelvin` to `COLOR_CORRECTION_GAINS` internally.
- **`takePicture()`** → `{ uri: string }` — local `file://` URI, JPEG quality fixed at 92.

## Error handling & lifecycle

- CameraX's lifecycle-aware binding (bound to the host Activity/Fragment lifecycle) handles backgrounding/foregrounding automatically — no manual bind/unbind bookkeeping needed in the module.
- `takePicture()` rejects with a typed error code on capture failure (e.g. camera disconnected mid-shot).
- Manual exposure values outside the queried range (`isoRange`/`exposureTimeRangeNs`) clamp to the range with a console warning rather than throwing. Expected cause: a locked project setting captured on a different, more capable device than the one currently shooting — calibration UI (future work) will constrain choices to the current device's queried range up front, so out-of-range should only occur from this stale cross-device case, not routine use.

## Testing

No native-Kotlin automated test harness exists in this repo yet. Verification is on-device manual, matching the existing pattern of "on-device testing" acceptance criteria elsewhere in `docs/current-task.md`. Manual test matrix for this module:

1. Preview renders via `JotterCameraView`.
2. `getCapabilities()` returns real (non-placeholder) device ranges/resolutions — cross-check against the hardware spike's `dumpsys` output for the same device.
3. Manual ISO sweep visibly changes brightness.
4. Manual shutter-speed sweep visibly changes motion blur/brightness.
5. White-balance (Kelvin) sweep visibly shifts color cast.
6. `takePicture()` returns a valid, readable JPEG at the requested resolution.

## Open follow-on work (not this spec)

- Calibration screen UI (build order step 7).
- `CameraCaptureStep.tsx` / `CaptureScreen.tsx` wiring to shoot with a project's locked settings (rest of build order step 6) — this is also where `modules/camera/CameraCaptureStep.tsx`'s "Auto exposure — placeholder" banner gets removed.
- iOS manual-exposure equivalent.
