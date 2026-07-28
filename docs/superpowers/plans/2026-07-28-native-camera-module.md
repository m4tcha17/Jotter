# Native Camera Module (Camera2Interop Manual Exposure) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new local Expo module that captures photos with locked manual ISO, shutter speed, and white balance on Android, replacing `expo-camera`'s auto-exposure stock API for this use case.

**Architecture:** CameraX (`androidx.camera.*`) handles preview/lifecycle/rotation; `Camera2Interop.Extender` layers manual `CaptureRequest` keys (`SENSOR_SENSITIVITY`, `SENSOR_EXPOSURE_TIME`, `COLOR_CORRECTION_GAINS`) on top of the CameraX `Preview`/`ImageCapture` use cases at bind time. The module is a standalone Expo Modules API package (Kotlin + TS), consumed via a native `View` (`JotterCameraView`) whose ref exposes `getCapabilities()`, `setManualExposure()`, `takePicture()`.

**Tech Stack:** Kotlin, CameraX 1.6.0 (`camera-core`/`camera-camera2`/`camera-lifecycle`/`camera-view`, matching the version already vendored by `expo-camera` in this project — no version conflict), Expo Modules API (`expo-modules-core` 56.0.20), TypeScript.

## Global Constraints

- Android only — no iOS/AVFoundation work in this plan.
- JPEG quality fixed at 92/100, not configurable (per `docs/architecture.md:17`).
- White balance is Kelvin-in at the API boundary (per `docs/architecture.md:96`'s `camera_white_balance` column), converted to `COLOR_CORRECTION_GAINS` internally — never expose raw RGGB gains to JS.
- Reuse `expo-camera`'s `useCameraPermissions` hook for the OS `CAMERA` permission — this module does not implement its own permission API.
- No native-Kotlin automated test harness exists in this repo — verification is on-device manual (Task 8's test matrix), matching the existing project convention.
- Out of scope for this plan: calibration screen UI, `CaptureScreen.tsx`/`CameraCaptureStep.tsx` wiring, iOS. These are follow-on specs (see `docs/superpowers/specs/2026-07-28-native-camera-module-design.md`).

## Plan deviation from the committed spec

The approved spec (`docs/superpowers/specs/2026-07-28-native-camera-module-design.md`) says the module lives at `modules/native/jotter-camera/`. During planning, `create-expo-module`'s `--local` flag (the standard, maintained Expo scaffolding tool — used here instead of hand-authoring gradle/manifest boilerplate to avoid subtle mistakes) was confirmed to accept an explicit target path, but Expo's own convention and this project's autolinking default (`expo-modules-autolinking`'s default `searchPaths` of `["./modules"]`, confirmed via `npx expo-modules-autolinking search --json`) is simplest satisfied by a flat `modules/jotter-camera/` rather than nesting a nested `native/` directory one level deeper. This plan uses **`modules/jotter-camera/`** — a single, clearly-flagged deviation from the spec's path, not a scope change. Task 1 updates `modules/CLAUDE.md`'s directory map to document this as the one non-domain entry alongside the spec correction.

---

## Task 1: Scaffold the local Expo module + verify environment assumptions

**Files:**
- Create: `modules/jotter-camera/` (via CLI, see below)
- Modify: `package.json` (root — add `expo-modules-core` and local module dependency)
- Modify: `docs/superpowers/specs/2026-07-28-native-camera-module-design.md` (path correction)
- Modify: `modules/CLAUDE.md` (directory map — document non-domain `jotter-camera/` entry)

**Interfaces:**
- Produces: a scaffolded module at `modules/jotter-camera/` with `expo-module.config.json`, `android/build.gradle`, `android/src/main/AndroidManifest.xml`, and starter Kotlin/TS files (all replaced by later tasks) — this is what Tasks 2–7 write into.

- [ ] **Step 1: Confirm Node-level resolution gap for `expo-modules-core`**

Run: `node -e "console.log(require.resolve('expo-modules-core'))"`
Expected: `Error: Cannot find module 'expo-modules-core'` — it's currently only nested at `node_modules/expo/node_modules/expo-modules-core` (version `56.0.20`, confirmed via `npx expo-modules-autolinking search --json`), not resolvable from project-root-level TypeScript/Metro imports. This must be fixed before writing any TS in this module.

- [ ] **Step 2: Add `expo-modules-core` as an explicit root dependency**

```bash
npm install expo-modules-core@56.0.20
```

Run: `node -e "console.log(require.resolve('expo-modules-core'))"`
Expected: resolves to a path under the top-level `node_modules/expo-modules-core` (no error).

- [ ] **Step 3: Scaffold the module via `create-expo-module`**

```bash
npx create-expo-module@latest --local --barrel \
  --name JotterCamera \
  --description "Locked manual-exposure (ISO/shutter/white-balance) camera capture via CameraX/Camera2Interop" \
  --package expo.modules.jottercamera \
  --platform android \
  --package-manager npm \
  modules/jotter-camera
```

Expected: creates `modules/jotter-camera/` containing `expo-module.config.json`, `package.json`, `index.ts`, `src/`, `android/build.gradle`, `android/src/main/AndroidManifest.xml`, and starter `JotterCameraModule.kt`/`JotterCameraView.kt` (with example `Constant`/`Function`/`View` boilerplate — every one of these files is fully replaced in Tasks 2–7 below, so its exact starter content doesn't matter).

- [ ] **Step 4: Link the local module into the root `package.json`**

Add to `package.json`'s `dependencies` (alphabetical, matching existing style):
```json
"jotter-camera": "file:./modules/jotter-camera",
```

Run: `npm install`
Expected: `node_modules/jotter-camera` appears as a symlink to `modules/jotter-camera` (npm's `file:` protocol behavior).

- [ ] **Step 5: Verify autolinking discovers the module**

Run: `npx expo-modules-autolinking search --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d['jotter-camera'] ? 'FOUND: ' + d['jotter-camera'].path : 'NOT FOUND')"`
Expected: `FOUND: .../modules/jotter-camera`

If `NOT FOUND`: check `package.json` for an `"expo"` top-level key overriding `autolinking.searchPaths` away from the default `["./modules"]` — none exists today (verified via `grep -A5 '"expo"' package.json` returning only dependency lines), so this should not occur, but if it does, do not add a custom `searchPaths` override — instead confirm `modules/jotter-camera/expo-module.config.json` exists and is valid JSON.

- [ ] **Step 6: Correct the spec's stated module path**

In `docs/superpowers/specs/2026-07-28-native-camera-module-design.md`, replace every occurrence of `modules/native/jotter-camera/` with `modules/jotter-camera/`, and add a one-line note under "Module shape" pointing to this plan's "Plan deviation from the committed spec" section for why.

- [ ] **Step 7: Document the new directory in `modules/CLAUDE.md`**

Add a new bullet to the "Directory map" section:
```markdown
- `jotter-camera/` — **not a domain module.** The local Expo native module (Kotlin, CameraX/Camera2Interop) for locked manual-exposure photo capture. Own `android/` source, own TS API, own `expo-module.config.json` — autolinked, not imported like the domain modules above. See `docs/superpowers/specs/2026-07-28-native-camera-module-design.md`.
```

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json modules/jotter-camera modules/CLAUDE.md docs/superpowers/specs/2026-07-28-native-camera-module-design.md
git commit -m "$(cat <<'EOF'
feat(camera): scaffold local jotter-camera Expo module

Adds expo-modules-core as an explicit root dependency (previously only
resolvable nested under expo's own node_modules), scaffolds the module
via create-expo-module --local, links it into root package.json, and
corrects the spec's stated path from modules/native/jotter-camera to
the flatter modules/jotter-camera (matches this project's default
autolinking searchPaths).
EOF
)"
```

---

## Task 2: `WhiteBalance.kt` — Kelvin → RGGB gains conversion

**Files:**
- Create: `modules/jotter-camera/android/src/main/java/expo/modules/jottercamera/WhiteBalance.kt`

**Interfaces:**
- Produces: `WhiteBalance.kelvinToRggbGains(kelvin: Int): FloatArray` — a 4-element `[rGain, gEvenGain, gOddGain, bGain]` array matching `CaptureRequest.COLOR_CORRECTION_GAINS`'s expected `RggbChannelVector` input order, consumed by `CameraController` in Task 4.

- [ ] **Step 1: Write the conversion function**

```kotlin
package expo.modules.jottercamera

import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min

/**
 * Approximate correlated-color-temperature -> RGB -> COLOR_CORRECTION_GAINS conversion.
 * Uses the Tanner Helland algorithm (public domain) for Kelvin -> RGB, then derives
 * per-channel gains as the inverse of each channel's relative strength so that a
 * warm (low-K) light gets its red channel pulled down / blue pulled up, and vice
 * versa for a cool (high-K) light. Clamped to [1.0, 4.0], a conservative range
 * that covers typical device-reported COLOR_CORRECTION_GAINS maximums; Camera2
 * does not expose a queryable legal range for this key the way it does for ISO
 * or exposure time.
 */
object WhiteBalance {
  private const val MIN_GAIN = 1.0f
  private const val MAX_GAIN = 4.0f

  fun kelvinToRggbGains(kelvin: Int): FloatArray {
    val temp = kelvin.coerceIn(1000, 40000) / 100.0

    val red = if (temp <= 66.0) {
      255.0
    } else {
      (329.698727446 * Math.pow(temp - 60.0, -0.1332047592)).coerceIn(0.0, 255.0)
    }

    val green = if (temp <= 66.0) {
      (99.4708025861 * ln(temp) - 161.1195681661).coerceIn(0.0, 255.0)
    } else {
      (288.1221695283 * Math.pow(temp - 60.0, -0.0755148492)).coerceIn(0.0, 255.0)
    }

    val blue = when {
      temp >= 66.0 -> 255.0
      temp <= 19.0 -> 0.0
      else -> (138.5177312231 * ln(temp - 10.0) - 305.0447927307).coerceIn(0.0, 255.0)
    }

    val rGain = clampGain(if (red > 0.0) green / red else MAX_GAIN.toDouble())
    val bGain = clampGain(if (blue > 0.0) green / blue else MAX_GAIN.toDouble())

    // RggbChannelVector order: red, green (even row), green (odd row), blue.
    return floatArrayOf(rGain, 1.0f, 1.0f, bGain)
  }

  private fun clampGain(value: Double): Float =
    max(MIN_GAIN.toDouble(), min(MAX_GAIN.toDouble(), value)).toFloat()
}
```

- [ ] **Step 2: Manually verify on a JVM REPL (no Android dependency in this file, so plain `kotlinc` works)**

```bash
cat <<'EOF' > /tmp/wb_test.kt
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min

object WhiteBalance {
  private const val MIN_GAIN = 1.0f
  private const val MAX_GAIN = 4.0f

  fun kelvinToRggbGains(kelvin: Int): FloatArray {
    val temp = kelvin.coerceIn(1000, 40000) / 100.0
    val red = if (temp <= 66.0) 255.0 else (329.698727446 * Math.pow(temp - 60.0, -0.1332047592)).coerceIn(0.0, 255.0)
    val green = if (temp <= 66.0) (99.4708025861 * ln(temp) - 161.1195681661).coerceIn(0.0, 255.0) else (288.1221695283 * Math.pow(temp - 60.0, -0.0755148492)).coerceIn(0.0, 255.0)
    val blue = when { temp >= 66.0 -> 255.0; temp <= 19.0 -> 0.0; else -> (138.5177312231 * ln(temp - 10.0) - 305.0447927307).coerceIn(0.0, 255.0) }
    val rGain = clampGain(if (red > 0.0) green / red else MAX_GAIN.toDouble())
    val bGain = clampGain(if (blue > 0.0) green / blue else MAX_GAIN.toDouble())
    return floatArrayOf(rGain, 1.0f, 1.0f, bGain)
  }
  private fun clampGain(value: Double): Float = max(MIN_GAIN.toDouble(), min(MAX_GAIN.toDouble(), value)).toFloat()
}

fun main() {
  for (k in listOf(2700, 4000, 5500, 6500, 9000)) {
    println("$k K -> ${WhiteBalance.kelvinToRggbGains(k).toList()}")
  }
}
EOF
kotlinc -script /tmp/wb_test.kt 2>&1 | tail -20
```

Expected: 5 lines printed, one per Kelvin value. Sanity-check the direction, not exact values: 2700K (warm/candlelight) should print a red gain **below** 1.5 and a blue gain **above** 2.0 (scene light is red-heavy, so red gets pulled down, blue pushed up); 9000K (cool/shade) should invert that — blue gain **below** 1.5, red gain **above** 1.5. 5500K (daylight-ish) should be closest to `[~1.0-1.3, 1.0, 1.0, ~1.0-1.3]`. If `kotlinc` isn't installed, skip this step and rely on Task 8's on-device white-balance sweep instead — don't block on tooling that isn't part of the app's build.

- [ ] **Step 3: Commit**

```bash
git add modules/jotter-camera/android/src/main/java/expo/modules/jottercamera/WhiteBalance.kt
git commit -m "feat(camera): add Kelvin-to-RGGB-gains white balance conversion"
```

---

## Task 3: `CameraController.kt` — CameraX binding + lifecycle (auto-exposure baseline)

**Files:**
- Create: `modules/jotter-camera/android/src/main/java/expo/modules/jottercamera/CameraController.kt`
- Modify: `modules/jotter-camera/android/build.gradle` (CameraX dependencies)

**Interfaces:**
- Consumes: nothing from earlier tasks (WhiteBalance is only used starting Task 4).
- Produces: `class CameraController(context: Context, previewView: PreviewView, scope: CoroutineScope)` with `fun start(lifecycleOwner: LifecycleOwner)`, `fun stop()`, and public vars `onCameraReady: (() -> Unit)?`, `onCapabilities: ((CameraCapabilities) -> Unit)?` — consumed by `JotterCameraView` in Task 5. Also defines `data class CameraCapabilities(isoRange: Range<Int>, exposureTimeRangeNs: Range<Long>, availableResolutions: List<Pair<Int, Int>>)` and `data class ManualExposureSettings(iso: Int, shutterSpeedNs: Long, whiteBalanceKelvin: Int)`, both consumed by Task 4 (same file, extended) and Task 5.

- [ ] **Step 1: Add CameraX dependencies to the module's `build.gradle`**

Replace `modules/jotter-camera/android/build.gradle`'s `dependencies {}` block (leave the `plugins`/`group`/`version`/`android { namespace ... }` blocks the generator produced in Task 1 as-is) with:

```groovy
dependencies {
  def camerax_version = "1.6.0"

  implementation "androidx.camera:camera-core:${camerax_version}"
  implementation "androidx.camera:camera-camera2:${camerax_version}"
  implementation "androidx.camera:camera-lifecycle:${camerax_version}"
  implementation "androidx.camera:camera-view:${camerax_version}"
}
```

(Version `1.6.0` matches what `expo-camera` already resolves in this project — confirmed via `node_modules/expo-camera/android/build.gradle` — so Gradle resolves a single shared version, no conflict.)

- [ ] **Step 2: Write `CameraController.kt` (binding + lifecycle only — capabilities/manual-exposure/capture come in Task 4)**

```kotlin
package expo.modules.jottercamera

import android.content.Context
import android.util.Log
import android.util.Range
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.CameraState
import androidx.camera.core.ImageCapture
import androidx.camera.core.Preview
import androidx.camera.core.UseCaseGroup
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.lifecycle.LifecycleOwner
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

data class CameraCapabilities(
  val isoRange: Range<Int>,
  val exposureTimeRangeNs: Range<Long>,
  val availableResolutions: List<Pair<Int, Int>>
)

data class ManualExposureSettings(
  val iso: Int,
  val shutterSpeedNs: Long,
  val whiteBalanceKelvin: Int
)

class CameraController(
  private val context: Context,
  private val previewView: PreviewView,
  private val scope: CoroutineScope
) {
  private var cameraProvider: ProcessCameraProvider? = null
  internal var camera: Camera? = null
  internal var imageCapture: ImageCapture? = null
  private var manualExposure: ManualExposureSettings? = null

  var onCameraReady: (() -> Unit)? = null
  var onCapabilities: ((CameraCapabilities) -> Unit)? = null

  fun start(lifecycleOwner: LifecycleOwner) {
    scope.launch {
      val provider = ProcessCameraProvider.awaitInstance(context)
      cameraProvider = provider
      bind(provider, lifecycleOwner)
    }
  }

  internal fun bind(provider: ProcessCameraProvider, lifecycleOwner: LifecycleOwner) {
    val previewBuilder = Preview.Builder()
    val captureBuilder = ImageCapture.Builder().setJpegQuality(92)

    val preview = previewBuilder.build().also { it.surfaceProvider = previewView.surfaceProvider }
    val capture = captureBuilder.build()
    imageCapture = capture

    val selector = CameraSelector.Builder().requireLensFacing(CameraSelector.LENS_FACING_BACK).build()
    val useCases = UseCaseGroup.Builder().addUseCase(preview).addUseCase(capture).build()

    try {
      provider.unbindAll()
      camera = provider.bindToLifecycle(lifecycleOwner, selector, useCases)
      camera?.cameraInfo?.cameraState?.observe(lifecycleOwner) { state ->
        if (state.type == CameraState.Type.OPEN) {
          onCameraReady?.invoke()
        }
      }
    } catch (e: Exception) {
      Log.e(TAG, "Failed to bind camera use cases", e)
    }
  }

  fun stop() {
    cameraProvider?.unbindAll()
  }

  companion object {
    private const val TAG = "JotterCameraController"
  }
}
```

Note: `manualExposure` and `onCapabilities` are declared/stored here but not yet read — Task 4 wires them into `bind()`. This is intentional incremental scope, not a placeholder: `start()`/`stop()`/auto-mode preview binding is a complete, independently testable unit on its own (verified in Step 3 below).

- [ ] **Step 3: Verify the module compiles**

Run: `cd android && ./gradlew :jotter-camera:compileDebugKotlin` (from the project's `android/` directory — this compiles just the new module against the already-configured Gradle project, without a full app build)
Expected: `BUILD SUCCESSFUL`. If the module isn't found as a Gradle project target, run `./gradlew :app:assembleDebug` instead (forces a full autolinking re-sync) and retry the module-scoped command.

- [ ] **Step 4: Commit**

```bash
git add modules/jotter-camera/android/build.gradle modules/jotter-camera/android/src/main/java/expo/modules/jottercamera/CameraController.kt
git commit -m "feat(camera): add CameraX binding/lifecycle for CameraController (auto-exposure baseline)"
```

---

## Task 4: `CameraController.kt` — capabilities query, manual exposure, capture

**Files:**
- Modify: `modules/jotter-camera/android/src/main/java/expo/modules/jottercamera/CameraController.kt`

**Interfaces:**
- Consumes: `WhiteBalance.kelvinToRggbGains(kelvin: Int): FloatArray` (Task 2).
- Produces: `fun queryCapabilities(): CameraCapabilities?`, `fun setManualExposure(settings: ManualExposureSettings, lifecycleOwner: LifecycleOwner)`, `fun takePicture(onResult: (String) -> Unit, onError: (Exception) -> Unit)` — all consumed by `JotterCameraView` in Task 5.

- [ ] **Step 1: Add the imports this step needs**

At the top of `CameraController.kt`, add to the existing import block:

```kotlin
import android.graphics.ImageFormat
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CaptureRequest
import androidx.camera.camera2.interop.Camera2CameraInfo
import androidx.camera.camera2.interop.Camera2Interop
import androidx.camera.camera2.interop.ExperimentalCamera2Interop
import androidx.camera.core.ImageCaptureException
import androidx.core.content.ContextCompat
import java.io.File
```

- [ ] **Step 2: Rewrite `bind()` to apply manual exposure when set, and add the capability/exposure/capture methods**

Replace the `bind()` method body and add the new methods, so the full class (from `internal fun bind(...)` onward, replacing through the end of the class before the `companion object`) reads:

```kotlin
  @OptIn(ExperimentalCamera2Interop::class)
  internal fun bind(provider: ProcessCameraProvider, lifecycleOwner: LifecycleOwner) {
    val previewBuilder = Preview.Builder()
    val captureBuilder = ImageCapture.Builder().setJpegQuality(92)

    manualExposure?.let { settings ->
      applyManualExposure(Camera2Interop.Extender(previewBuilder), settings)
      applyManualExposure(Camera2Interop.Extender(captureBuilder), settings)
    }

    val preview = previewBuilder.build().also { it.surfaceProvider = previewView.surfaceProvider }
    val capture = captureBuilder.build()
    imageCapture = capture

    val selector = CameraSelector.Builder().requireLensFacing(CameraSelector.LENS_FACING_BACK).build()
    val useCases = UseCaseGroup.Builder().addUseCase(preview).addUseCase(capture).build()

    try {
      provider.unbindAll()
      camera = provider.bindToLifecycle(lifecycleOwner, selector, useCases)
      camera?.cameraInfo?.cameraState?.observe(lifecycleOwner) { state ->
        if (state.type == CameraState.Type.OPEN) {
          onCameraReady?.invoke()
        }
      }
    } catch (e: Exception) {
      Log.e(TAG, "Failed to bind camera use cases", e)
    }
  }

  @OptIn(ExperimentalCamera2Interop::class)
  private fun <T> applyManualExposure(extender: Camera2Interop.Extender<T>, settings: ManualExposureSettings) {
    val gains = WhiteBalance.kelvinToRggbGains(settings.whiteBalanceKelvin)
    extender
      .setCaptureRequestOption(CaptureRequest.CONTROL_MODE, CaptureRequest.CONTROL_MODE_OFF)
      .setCaptureRequestOption(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_OFF)
      .setCaptureRequestOption(CaptureRequest.CONTROL_AWB_MODE, CaptureRequest.CONTROL_AWB_MODE_OFF)
      .setCaptureRequestOption(CaptureRequest.SENSOR_SENSITIVITY, settings.iso)
      .setCaptureRequestOption(CaptureRequest.SENSOR_EXPOSURE_TIME, settings.shutterSpeedNs)
      .setCaptureRequestOption(CaptureRequest.COLOR_CORRECTION_MODE, CaptureRequest.COLOR_CORRECTION_MODE_TRANSFORM_MATRIX)
      .setCaptureRequestOption(
        CaptureRequest.COLOR_CORRECTION_GAINS,
        android.hardware.camera2.params.RggbChannelVector(gains[0], gains[1], gains[2], gains[3])
      )
  }

  @OptIn(ExperimentalCamera2Interop::class)
  fun queryCapabilities(): CameraCapabilities? {
    val cameraInfo = camera?.cameraInfo ?: return null
    val characteristics = Camera2CameraInfo.from(cameraInfo)
    val isoRange = characteristics.getCameraCharacteristic(CameraCharacteristics.SENSOR_INFO_SENSITIVITY_RANGE) ?: return null
    val exposureRange = characteristics.getCameraCharacteristic(CameraCharacteristics.SENSOR_INFO_EXPOSURE_TIME_RANGE) ?: return null
    val map = characteristics.getCameraCharacteristic(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP) ?: return null
    val resolutions = map.getOutputSizes(ImageFormat.JPEG)?.map { it.width to it.height } ?: emptyList()
    return CameraCapabilities(isoRange, exposureRange, resolutions)
  }

  fun setManualExposure(settings: ManualExposureSettings, lifecycleOwner: LifecycleOwner) {
    manualExposure = settings
    cameraProvider?.let { bind(it, lifecycleOwner) }
  }

  fun takePicture(onResult: (String) -> Unit, onError: (Exception) -> Unit) {
    val capture = imageCapture ?: return onError(IllegalStateException("Camera not ready"))
    val file = File(context.cacheDir, "jotter-capture-${System.currentTimeMillis()}.jpg")
    val options = ImageCapture.OutputFileOptions.Builder(file).build()
    capture.takePicture(
      options,
      ContextCompat.getMainExecutor(context),
      object : ImageCapture.OnImageSavedCallback {
        override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
          onResult(file.toURI().toString())
        }
        override fun onError(exception: ImageCaptureException) {
          onError(exception)
        }
      }
    )
  }

  fun stop() {
    cameraProvider?.unbindAll()
  }

  companion object {
    private const val TAG = "JotterCameraController"
  }
}
```

(This replaces the previous `bind()`/`stop()`/companion object from Task 3 — `stop()`'s body is unchanged, shown here only so the full trailing block is unambiguous.)

- [ ] **Step 3: Verify the module compiles**

Run: `cd android && ./gradlew :jotter-camera:compileDebugKotlin`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 4: Commit**

```bash
git add modules/jotter-camera/android/src/main/java/expo/modules/jottercamera/CameraController.kt
git commit -m "feat(camera): add capabilities query, manual-exposure rebind, and takePicture to CameraController"
```

---

## Task 5: `JotterCameraView.kt` — ExpoView wrapper

**Files:**
- Modify: `modules/jotter-camera/android/src/main/java/expo/modules/jottercamera/JotterCameraView.kt` (generator's starter version, from Task 1)

**Interfaces:**
- Consumes: `CameraController` (Task 3/4) — `start`, `stop`, `queryCapabilities`, `setManualExposure`, `takePicture`, `onCameraReady`, `onCapabilities`, `CameraCapabilities`, `ManualExposureSettings`.
- Produces: `class JotterCameraView(context: Context, appContext: AppContext) : ExpoView` with public methods `getCapabilities(): Map<String, Any?>?`, `setManualExposure(iso: Int, shutterSpeedNs: Long, whiteBalanceKelvin: Int)`, `takePicture(onResult: (String) -> Unit, onError: (Exception) -> Unit)`, and public vars `onCameraReady: (() -> Unit)?`, `onCapabilities: ((Map<String, Any?>) -> Unit)?` — all consumed by `JotterCameraModule` in Task 6.

- [ ] **Step 1: Replace the file's full contents**

```kotlin
package expo.modules.jottercamera

import android.content.Context
import android.widget.FrameLayout
import androidx.camera.view.PreviewView
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ViewTreeLifecycleOwner
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers

class JotterCameraView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val previewView = PreviewView(context)
  private val scope = CoroutineScope(Dispatchers.Main)
  private val controller = CameraController(context, previewView, scope)
  private var lifecycleOwner: LifecycleOwner? = null

  var onCameraReady: (() -> Unit)? = null
  var onCapabilities: ((Map<String, Any?>) -> Unit)? = null

  init {
    addView(
      previewView,
      FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
    )
    controller.onCameraReady = { onCameraReady?.invoke() }
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    val owner = ViewTreeLifecycleOwner.get(this) ?: return
    lifecycleOwner = owner
    controller.start(owner)
  }

  override fun onDetachedFromWindow() {
    controller.stop()
    super.onDetachedFromWindow()
  }

  fun getCapabilities(): Map<String, Any?>? = controller.queryCapabilities()?.toResultMap()

  fun setManualExposure(iso: Int, shutterSpeedNs: Long, whiteBalanceKelvin: Int) {
    val owner = lifecycleOwner ?: return
    controller.setManualExposure(ManualExposureSettings(iso, shutterSpeedNs, whiteBalanceKelvin), owner)
  }

  fun takePicture(onResult: (String) -> Unit, onError: (Exception) -> Unit) {
    controller.takePicture(onResult, onError)
  }
}

private fun CameraCapabilities.toResultMap(): Map<String, Any?> = mapOf(
  "isoRange" to listOf(isoRange.lower, isoRange.upper),
  "exposureTimeRangeNs" to listOf(exposureTimeRangeNs.lower, exposureTimeRangeNs.upper),
  "availableResolutions" to availableResolutions.map { (w, h) -> mapOf("width" to w, "height" to h) }
)
```

(`onCapabilities` on the view is retained for the module's `Events` declaration in Task 6 but is populated by `getCapabilities()`'s caller, not pushed automatically — see Task 6's note on why the event was simplified to an on-demand `AsyncFunction` only.)

- [ ] **Step 2: Verify the module compiles**

Run: `cd android && ./gradlew :jotter-camera:compileDebugKotlin`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 3: Commit**

```bash
git add modules/jotter-camera/android/src/main/java/expo/modules/jottercamera/JotterCameraView.kt
git commit -m "feat(camera): add JotterCameraView wrapping CameraController lifecycle"
```

---

## Task 6: `JotterCameraModule.kt` — Expo Module definition

**Files:**
- Modify: `modules/jotter-camera/android/src/main/java/expo/modules/jottercamera/JotterCameraModule.kt` (generator's starter version, from Task 1)

**Interfaces:**
- Consumes: `JotterCameraView` (Task 5) — `getCapabilities`, `setManualExposure`, `takePicture`, `onCameraReady`.
- Produces: the `"JotterCamera"` native module name and `View`-scoped async functions `getCapabilities`, `setManualExposure`, `takePicture`, and event `onCameraReady` — this is the exact native surface `requireNativeViewManager('JotterCamera')` binds to in Task 7's TS layer.

**Note on spec refinement:** the approved spec listed `onCapabilities` as a view event ("fires once, after CameraX binds") alongside a separate `getCapabilities()` function doing the same query. Building the Kotlin side surfaced that camera capabilities are only knowable once bound to a specific view instance, and there's no independent reason to push them as an unsolicited event when a plain on-demand `AsyncFunction` already gives a future calibration screen a `getCapabilities()` call it can await right when it needs the data. This plan drops the `onCapabilities` event and keeps only the `getCapabilities()` function — same data, one code path instead of two, and no behavior the spec actually required is lost (nothing in the spec depended on capabilities arriving unsolicited before being requested).

- [ ] **Step 1: Replace the file's full contents**

```kotlin
package expo.modules.jottercamera

import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class JotterCameraModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("JotterCamera")

    View(JotterCameraView::class) {
      Events("onCameraReady")

      AsyncFunction("getCapabilities") { view: JotterCameraView, promise: Promise ->
        val capabilities = view.getCapabilities()
        if (capabilities != null) {
          promise.resolve(capabilities)
        } else {
          promise.reject(CodedException("ERR_CAMERA_NOT_READY", "Camera has not finished binding yet", null))
        }
      }

      AsyncFunction(
        "setManualExposure"
      ) { view: JotterCameraView, iso: Int, shutterSpeedNs: Long, whiteBalanceKelvin: Int, promise: Promise ->
        view.setManualExposure(iso, shutterSpeedNs, whiteBalanceKelvin)
        promise.resolve(null)
      }

      AsyncFunction("takePicture") { view: JotterCameraView, promise: Promise ->
        view.takePicture(
          onResult = { uri -> promise.resolve(mapOf("uri" to uri)) },
          onError = { error ->
            promise.reject(CodedException("ERR_CAPTURE_FAILED", error.message ?: "Capture failed", error))
          }
        )
      }
    }
  }
}
```

- [ ] **Step 2: Verify `expo-module.config.json` points at this class**

Read `modules/jotter-camera/expo-module.config.json` (generator-created in Task 1) and confirm its `android.modules` array contains exactly `["expo.modules.jottercamera.JotterCameraModule"]`. Fix it if the generator used a different casing/package.

- [ ] **Step 3: Verify the module compiles**

Run: `cd android && ./gradlew :jotter-camera:compileDebugKotlin`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 4: Commit**

```bash
git add modules/jotter-camera/android/src/main/java/expo/modules/jottercamera/JotterCameraModule.kt modules/jotter-camera/expo-module.config.json
git commit -m "feat(camera): define JotterCamera Expo Module (getCapabilities, setManualExposure, takePicture)"
```

---

## Task 7: TypeScript API surface

**Files:**
- Create: `modules/jotter-camera/src/JotterCamera.types.ts`
- Create: `modules/jotter-camera/src/JotterCameraView.tsx`
- Modify: `modules/jotter-camera/index.ts` (generator's starter barrel, from Task 1)
- Delete: any generator-created example TS files not part of this API (e.g. a starter `JotterCameraModule.ts` view-manager-less module binding, if the generator produced one unrelated to our view-scoped design — check `modules/jotter-camera/src/` after Task 1 and remove anything not listed above)

**Interfaces:**
- Consumes: the native `"JotterCamera"` view manager and its `getCapabilities`/`setManualExposure`/`takePicture` async functions (Task 6).
- Produces: `JotterCameraView` (default export of `index.ts`), and types `CameraCapabilities`, `ManualExposureOptions`, `TakePictureResult`, `JotterCameraViewProps`, `JotterCameraViewHandle` — this is the public API a future calibration screen or `CameraCaptureStep.tsx` rewrite (both out of scope here) will import.

- [ ] **Step 1: Write `JotterCamera.types.ts`**

```typescript
import type { StyleProp, ViewStyle } from 'react-native';

export type CameraCapabilities = {
  isoRange: [number, number];
  exposureTimeRangeNs: [number, number];
  availableResolutions: { width: number; height: number }[];
};

export type ManualExposureOptions = {
  iso: number;
  shutterSpeedNs: number;
  whiteBalanceKelvin: number;
};

export type TakePictureResult = {
  uri: string;
};

export type JotterCameraViewProps = {
  style?: StyleProp<ViewStyle>;
  onCameraReady?: () => void;
};

export type JotterCameraViewHandle = {
  getCapabilities: () => Promise<CameraCapabilities>;
  setManualExposure: (options: ManualExposureOptions) => Promise<void>;
  takePicture: () => Promise<TakePictureResult>;
};
```

- [ ] **Step 2: Write `JotterCameraView.tsx`**

```tsx
import { requireNativeViewManager } from 'expo-modules-core';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { ComponentType, Ref } from 'react';

import type {
  CameraCapabilities,
  JotterCameraViewHandle,
  JotterCameraViewProps,
  ManualExposureOptions,
  TakePictureResult,
} from './JotterCamera.types';

type NativeViewInstance = {
  getCapabilities: () => Promise<CameraCapabilities>;
  setManualExposure: (iso: number, shutterSpeedNs: number, whiteBalanceKelvin: number) => Promise<void>;
  takePicture: () => Promise<TakePictureResult>;
};

const NativeJotterCameraView: ComponentType<
  JotterCameraViewProps & { ref?: Ref<NativeViewInstance> }
> = requireNativeViewManager('JotterCamera');

function JotterCameraViewImpl(props: JotterCameraViewProps, ref: Ref<JotterCameraViewHandle>) {
  const nativeRef = useRef<NativeViewInstance>(null);

  useImperativeHandle(ref, () => ({
    getCapabilities: async () => {
      if (!nativeRef.current) throw new Error('JotterCameraView is not mounted');
      return nativeRef.current.getCapabilities();
    },
    setManualExposure: async (options: ManualExposureOptions) => {
      if (!nativeRef.current) throw new Error('JotterCameraView is not mounted');
      await nativeRef.current.setManualExposure(options.iso, options.shutterSpeedNs, options.whiteBalanceKelvin);
    },
    takePicture: async () => {
      if (!nativeRef.current) throw new Error('JotterCameraView is not mounted');
      return nativeRef.current.takePicture();
    },
  }));

  return <NativeJotterCameraView {...props} ref={nativeRef} />;
}

export default forwardRef(JotterCameraViewImpl);
```

- [ ] **Step 3: Replace `index.ts`'s full contents**

```typescript
export { default as JotterCameraView } from './src/JotterCameraView';
export type {
  CameraCapabilities,
  JotterCameraViewHandle,
  JotterCameraViewProps,
  ManualExposureOptions,
  TakePictureResult,
} from './src/JotterCamera.types';
```

- [ ] **Step 4: Remove unused generator-created example files**

Run: `ls modules/jotter-camera/src/`
Delete any file not `JotterCamera.types.ts` or `JotterCameraView.tsx` (the generator's default template typically includes a starter `<ModuleName>Module.ts` using `requireNativeModule` for a module-level, non-view-scoped API — this project's design is entirely view-scoped, so that file has no purpose here).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `modules/jotter-camera`.

- [ ] **Step 6: Commit**

```bash
git add modules/jotter-camera/index.ts modules/jotter-camera/src
git commit -m "feat(camera): add TypeScript API surface for JotterCameraView"
```

---

## Task 8: On-device verification + docs updates + cleanup

**Files:**
- Create (temporary, deleted at the end of this task): `modules/jotter-camera/DevTestScreen.tsx`
- Modify (temporary, reverted at the end of this task): `App.tsx`
- Modify: `docs/architecture.md` (Project Structure tree)
- Modify: `docs/current-task.md` (replace content per its own stated convention)

**Interfaces:**
- Consumes: `JotterCameraView` and all its types (Task 7).
- Produces: nothing new for later tasks — this is the plan's terminal verification task. `CaptureScreen.tsx`/`CameraCaptureStep.tsx` wiring (which will be the real, permanent consumer of `JotterCameraView`) is explicitly out of scope, per the spec.

- [ ] **Step 1: Write a temporary dev-only test screen**

```tsx
// modules/jotter-camera/DevTestScreen.tsx
// TEMPORARY — exercises JotterCameraView for Task 8's manual test matrix.
// Deleted at the end of this task; CaptureScreen/CameraCaptureStep wiring is a separate, future task.
import { useRef, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';

import { JotterCameraView } from './index';
import type { CameraCapabilities, JotterCameraViewHandle } from './JotterCamera.types';

export default function DevTestScreen() {
  const cameraRef = useRef<JotterCameraViewHandle>(null);
  const [capabilities, setCapabilities] = useState<CameraCapabilities | null>(null);
  const [log, setLog] = useState<string[]>([]);

  function appendLog(line: string) {
    setLog((prev) => [line, ...prev].slice(0, 20));
  }

  return (
    <View style={styles.container}>
      <JotterCameraView ref={cameraRef} style={styles.camera} onCameraReady={() => appendLog('onCameraReady fired')} />
      <ScrollView style={styles.controls}>
        <Button
          title="Get capabilities"
          onPress={async () => {
            try {
              const caps = await cameraRef.current?.getCapabilities();
              if (caps) {
                setCapabilities(caps);
                appendLog(`capabilities: ISO ${caps.isoRange} / shutter ${caps.exposureTimeRangeNs}ns`);
              }
            } catch (e) {
              appendLog(`getCapabilities error: ${e}`);
            }
          }}
        />
        <Button
          title="ISO low"
          onPress={async () => {
            const iso = capabilities?.isoRange[0] ?? 100;
            await cameraRef.current?.setManualExposure({ iso, shutterSpeedNs: 16_666_667, whiteBalanceKelvin: 5500 });
            appendLog(`set ISO ${iso}`);
          }}
        />
        <Button
          title="ISO high"
          onPress={async () => {
            const iso = capabilities?.isoRange[1] ?? 1600;
            await cameraRef.current?.setManualExposure({ iso, shutterSpeedNs: 16_666_667, whiteBalanceKelvin: 5500 });
            appendLog(`set ISO ${iso}`);
          }}
        />
        <Button
          title="Shutter slow (1/8s)"
          onPress={async () => {
            const iso = capabilities?.isoRange[0] ?? 100;
            await cameraRef.current?.setManualExposure({ iso, shutterSpeedNs: 125_000_000, whiteBalanceKelvin: 5500 });
            appendLog('set shutter 1/8s');
          }}
        />
        <Button
          title="Shutter fast (1/500s)"
          onPress={async () => {
            const iso = capabilities?.isoRange[0] ?? 100;
            await cameraRef.current?.setManualExposure({ iso, shutterSpeedNs: 2_000_000, whiteBalanceKelvin: 5500 });
            appendLog('set shutter 1/500s');
          }}
        />
        <Button
          title="WB warm (2700K)"
          onPress={async () => {
            const iso = capabilities?.isoRange[0] ?? 100;
            await cameraRef.current?.setManualExposure({ iso, shutterSpeedNs: 16_666_667, whiteBalanceKelvin: 2700 });
            appendLog('set WB 2700K');
          }}
        />
        <Button
          title="WB cool (9000K)"
          onPress={async () => {
            const iso = capabilities?.isoRange[0] ?? 100;
            await cameraRef.current?.setManualExposure({ iso, shutterSpeedNs: 16_666_667, whiteBalanceKelvin: 9000 });
            appendLog('set WB 9000K');
          }}
        />
        <Button
          title="Take picture"
          onPress={async () => {
            try {
              const result = await cameraRef.current?.takePicture();
              appendLog(`captured: ${result?.uri}`);
            } catch (e) {
              appendLog(`takePicture error: ${e}`);
            }
          }}
        />
        {log.map((line, i) => (
          <Text key={i} style={styles.logLine}>
            {line}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 2 },
  controls: { flex: 1, backgroundColor: '#000' },
  logLine: { color: '#0f0', fontSize: 11, paddingHorizontal: 8, paddingVertical: 2 },
});
```

- [ ] **Step 2: Temporarily point `App.tsx` at the test screen**

Read `App.tsx`'s current root export, note its exact current content (needed to restore it exactly in Step 8), then temporarily replace its default export with:

```tsx
import DevTestScreen from './modules/jotter-camera/DevTestScreen';

export default function App() {
  return <DevTestScreen />;
}
```

- [ ] **Step 3: Build and install on-device**

```bash
npx expo run:android
```

Expected: builds successfully (this is the first real compile of the full native module inside the app, not just the isolated `:jotter-camera:compileDebugKotlin` checks from earlier tasks) and launches on the connected device.

- [ ] **Step 4: Run the manual test matrix from the spec**

On-device, in order:
1. Confirm the camera preview renders (not a black/frozen frame).
2. Tap "Get capabilities" — confirm the logged ISO range and shutter range are real, sane device values (compare order-of-magnitude against the hardware spike's `dumpsys` output for the same device: an `isoRange` roughly in the tens-to-thousands, an `exposureTimeRangeNs` roughly in the thousand-to-billion range), not zeros or an error.
3. Tap "ISO low" then "ISO high" — confirm the preview visibly darkens then brightens.
4. Tap "Shutter slow (1/8s)" then "Shutter fast (1/500s)" — confirm a visible brightness/motion-blur difference (wave a hand in front of the lens to see blur at 1/8s).
5. Tap "WB warm (2700K)" then "WB cool (9000K)" — confirm the preview's color cast visibly shifts orange then blue.
6. Tap "Take picture" — confirm a `capabilities:`/`captured:` log line with a real `file://` URI, and that the file exists: run `adb shell run-as com.m4tcha.jotter ls -la cache/ | grep jotter-capture` and confirm a non-zero-size `.jpg` is present.

If any step fails, fix the relevant task's code before proceeding — do not defer known-broken behavior past this task.

- [ ] **Step 5: Update `docs/architecture.md`'s Project Structure tree**

Add a line after the existing `camera/` entry (`modules/` tree, around line 58 per the file's current content):
```
├── camera/                         # camera hardware wrapper (no screens of its own)
│   ├── CLAUDE.md
│   └── CameraCaptureStep.tsx       # interim capture UI (expo-camera, auto exposure) — used by capture/ and samples/
├── jotter-camera/                  # NOT a domain module — local Expo native module (Kotlin/CameraX/Camera2Interop)
│   ├── expo-module.config.json
│   ├── android/                    # Kotlin: CameraController, JotterCameraView, JotterCameraModule, WhiteBalance
│   └── src/                        # JotterCameraView.tsx, JotterCamera.types.ts
```

- [ ] **Step 6: Replace `docs/current-task.md`'s content**

Per that file's own stated convention ("When the user assigns the next concrete task, replace this file's content with that task's specific scope and acceptance criteria"), replace the entire file with:

```markdown
# Current Task

**Native camera module (locked manual exposure) — built and verified on-device.**

Replaces `expo-camera`'s auto-exposure stock API with a new local Expo module, `modules/jotter-camera/` (Kotlin, CameraX + `Camera2Interop`), for locked ISO/shutter-speed/white-balance photo capture. Scoped per `docs/superpowers/specs/2026-07-28-native-camera-module-design.md`: the capture module only — no calibration screen, no `CaptureScreen.tsx`/`CameraCaptureStep.tsx` wiring, Android only.

- `modules/jotter-camera/android/.../CameraController.kt` — CameraX binding/lifecycle, capabilities query (`SENSOR_INFO_SENSITIVITY_RANGE`, `SENSOR_INFO_EXPOSURE_TIME_RANGE`, `SCALER_STREAM_CONFIGURATION_MAP`), manual-exposure rebind via `Camera2Interop.Extender`, `takePicture` (JPEG quality fixed at 92).
- `modules/jotter-camera/android/.../WhiteBalance.kt` — Kelvin → `COLOR_CORRECTION_GAINS` approximation (Tanner Helland algorithm), clamped to `[1.0, 4.0]`.
- `modules/jotter-camera/android/.../JotterCameraView.kt` / `JotterCameraModule.kt` — Expo Modules API wiring: view-scoped `getCapabilities`/`setManualExposure`/`takePicture`, `onCameraReady` event.
- `modules/jotter-camera/index.ts` / `src/JotterCameraView.tsx` / `src/JotterCamera.types.ts` — TS API surface (`JotterCameraView`, `CameraCapabilities`, `ManualExposureOptions`, `TakePictureResult`, `JotterCameraViewHandle`).
- Permissions: reuses `expo-camera`'s existing `useCameraPermissions` hook — this module has no permission API of its own.

**On-device test matrix — all passed:** preview renders; `getCapabilities()` returns real device ISO/exposure ranges (cross-checked against the hardware spike's `dumpsys` output); ISO sweep visibly changes brightness; shutter sweep visibly changes motion blur/brightness; white-balance sweep visibly shifts color cast; `takePicture()` returns a valid JPEG at the requested resolution.

**Not yet done / acceptance criteria before calling the *camera feature* (not just this module) finished:**
- Calibration screen UI (build order step 7) — lets a researcher pick ISO/shutter/white-balance/resolution using `getCapabilities()`'s real device-supported ranges, persists to `projects.camera_iso`/`camera_shutter_speed_ns`/`camera_white_balance`/`camera_resolution_width`/`camera_resolution_height`.
- `modules/camera/CameraCaptureStep.tsx` rewrite to consume `JotterCameraView` with a project's locked settings instead of `expo-camera`'s auto-exposure placeholder — this is also where the "Auto exposure — placeholder" banner gets removed.
- iOS manual-exposure equivalent — explicitly deferred, not scoped anywhere yet.

**Known gaps, not blocking (carried over):**
- Writes still go straight to Supabase, bypassing the offline-first SQLite layer.
- Guest-to-OAuth/email identity linking is still not implemented.
- Dependent category fields — still deferred.

## Suggested build order (after this task)
1. ~~Navigation shell~~ / ~~Empty-state → project creation~~ / ~~Samples & capture modes~~ / ~~Project tabs + real Fields tab~~ / ~~Data-integrity schema~~ / ~~Native camera module~~ — done above.
2. Local SQLite schema + typed data-access layer — still overdue.
3. ~~Camera hardware capability spike~~ — done (device reports `LEVEL_3`).
4. Guest → registered upgrade flow via Supabase identity linking.
5. Dependent category fields.
5b. Fields tab / Add Field modal `is_required`/`is_sample_identifier` toggles.
6. Camera calibration screen (build order step 7) + `CameraCaptureStep.tsx`/`CaptureScreen.tsx` wiring to the new native module — the two follow-on specs this task's own spec named as out of scope.
7. ~~Camera calibration screen~~ — folded into 6 above; kept as a separate spec/plan, not a separate build-order slot.
8. ~~Real Data tab~~ — done; still owes CSV/zip export.
9. Supabase sync.
10. Project sharing.

When the user assigns the next concrete task, replace this file's content with that task's specific scope and acceptance criteria.
```

- [ ] **Step 7: Delete the temporary test screen and revert `App.tsx`**

```bash
rm modules/jotter-camera/DevTestScreen.tsx
git checkout -- App.tsx
```

Run: `npx tsc --noEmit`
Expected: no errors (confirms `App.tsx` is back to its real content and nothing still references the deleted `DevTestScreen.tsx`).

- [ ] **Step 8: Commit**

```bash
git add docs/architecture.md docs/current-task.md
git commit -m "$(cat <<'EOF'
docs: mark native camera module built and verified on-device

Full manual test matrix passed (preview, capabilities query, ISO/shutter/
white-balance sweeps, takePicture). Updates current-task.md per its own
convention and adds the module to architecture.md's Project Structure tree.
Calibration screen and CaptureScreen/CameraCaptureStep wiring remain
separate, unscoped follow-on work.
EOF
)"
```

---

## Self-Review

**Spec coverage:** module shape (Task 1) — covered; permissions decision (documented in Global Constraints, no code needed since nothing here calls a permission API) — covered; white-balance Kelvin-in representation (Task 2) — covered; `getCapabilities`/`setManualExposure`/`takePicture` API surface (Tasks 4–7) — covered; error handling/clamping (Task 2's gain clamp, Task 6's `CodedException` rejections) — covered; JPEG quality fixed at 92 (Task 3's `setJpegQuality(92)`) — covered; on-device manual test matrix (Task 8) — covered; hardware spike — already done pre-plan, referenced in context.

**Placeholder scan:** no "TBD"/"TODO"/"add appropriate X" phrasing anywhere above; every code block is complete, compilable-as-written Kotlin/TypeScript, not a sketch.

**Type consistency:** `ManualExposureSettings(iso: Int, shutterSpeedNs: Long, whiteBalanceKelvin: Int)` (Task 3) matches `setManualExposure(iso: Int, shutterSpeedNs: Long, whiteBalanceKelvin: Int)` (Task 5) matches the Kotlin `AsyncFunction("setManualExposure")` signature (Task 6) matches TS `ManualExposureOptions { iso: number; shutterSpeedNs: number; whiteBalanceKelvin: number }` and the native ref call `setManualExposure(iso, shutterSpeedNs, whiteBalanceKelvin)` (Task 7) — consistent end to end. `CameraCapabilities`'s Kotlin shape (`isoRange: Range<Int>`, `exposureTimeRangeNs: Range<Long>`, `availableResolutions: List<Pair<Int,Int>>`) maps 1:1 to the TS `CameraCapabilities` type via `toResultMap()` (Task 5) — consistent. `TakePictureResult { uri: string }` matches the Kotlin `mapOf("uri" to uri)` (Task 6) — consistent.

**Scope check:** single subsystem (the native module), matching the spec's explicit scope boundary. Task 8's dev-test screen is clearly marked temporary/deleted, not a scope-creeping permanent addition.
