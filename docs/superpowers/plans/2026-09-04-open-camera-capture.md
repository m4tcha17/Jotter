# Open Camera Capture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Jotter's custom in-app camera with a hand-off to the Open Camera app, deleting the `jotter-camera` native module and all per-project camera calibration.

**Architecture:** A ~90-line local Expo module (`jotter-open-camera`) fires a package-pinned `ACTION_IMAGE_CAPTURE` intent at Open Camera and returns the captured JPEG's path via `OnActivityResult`. `CameraCaptureStep` becomes a launcher + review screen instead of a live preview. Everything about storing/applying exposure per project is removed, including five `projects` table columns.

**Tech Stack:** Expo SDK 56, React Native 0.85, TypeScript, expo-modules-core (Kotlin), expo-sqlite, Supabase CLI migrations, Jest (`jest-expo`).

**Spec:** `docs/superpowers/specs/2026-09-04-open-camera-capture-design.md`

## Global Constraints

- **Platform:** Android only. No `Platform.OS` branching anywhere.
- **Open Camera package id:** `net.sourceforge.opencamera` (exact, everywhere).
- **Pipeline is JPEG-only.** No DNG handling.
- **No new JS test dependency.** This repo has no React-Native component test infra (`@testing-library/react-native` is not installed) — existing tests are pure-logic `.test.ts` only (`modules/*/__tests__/*.test.ts`). Add Jest tests **only** for pure functions. Native code and UI components are manual-verify, per `modules/camera/CLAUDE.md`.
- **Package manager:** npm. `npm install` in this repo requires `--force` (peer-dep conflict: `expo-modules-core`'s optional `react-native-worklets` peer vs `react-native-reanimated`'s 0.10.0). Always `npm install --force`.
- **Local module linking pattern:** local modules live at `modules/<name>/`, have **no `package.json`**, are referenced from root `package.json` as `"<name>": "file:./modules/<name>"`, and expose their JS entry via a root `index.ts` that re-exports from `src/`. Mirror `modules/jotter-camera/` exactly.
- **Design system:** dark-only "Calibration Bench" (`DESIGN.md` / `modules/CLAUDE.md`) — no light-mode classes. Accessibility floor: `accessibilityRole` + `accessibilityLabel` on every interactive element, 48×48dp min touch targets, never `allowFontScaling={false}`.
- **Commit style:** end commit messages with the two trailer lines:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01SrPn1VYLUnAFNYdiH79o2S
  ```
- **Do not run `expo run:android` / `expo run:ios`.** The operator builds on-device. `npx tsc --noEmit` and `npm test` are fine.

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `modules/jotter-open-camera/expo-module.config.json` | Autolink descriptor |
| `modules/jotter-open-camera/index.ts` | Public JS entry — re-exports from `src/` |
| `modules/jotter-open-camera/src/index.ts` | Typed JS wrapper over the native module (`isOpenCameraInstalled`, `capture`) |
| `modules/jotter-open-camera/LICENSE` | Copied from `jotter-camera` |
| `modules/jotter-open-camera/android/build.gradle` | Library module gradle |
| `modules/jotter-open-camera/android/src/main/AndroidManifest.xml` | Declares the module's own `FileProvider` |
| `modules/jotter-open-camera/android/src/main/res/xml/jotter_open_camera_file_paths.xml` | FileProvider path config (`cache-path`) |
| `modules/jotter-open-camera/android/src/main/java/expo/modules/jotteropencamera/JotterOpenCameraModule.kt` | The module: `isOpenCameraInstalled` + `capture` + `OnActivityResult` |
| `modules/jotter-open-camera/android/src/main/java/expo/modules/jotteropencamera/JotterOpenCameraFileProvider.kt` | `FileProvider` subclass (distinct class name → no manifest-merge clash) |
| `modules/camera/OpenCameraInstallGate.tsx` | "Install Open Camera" screen |
| `modules/camera/openCameraStoreLinks.ts` | Pure: store deep-link + F-Droid fallback URLs |
| `modules/camera/__tests__/openCameraStoreLinks.test.ts` | Unit test for the above |

**Modified:**

| Path | Change |
|---|---|
| `package.json` | +`jotter-open-camera` file dep; −`jotter-camera`, −`expo-camera`, −`@react-native-community/slider` |
| `app.json` | −`expo-camera` plugin block; −`android.permission.CAMERA` |
| `modules/camera/CameraCaptureStep.tsx` | Rewritten: launcher + review, no preview, no `cameraSettings` |
| `modules/capture/CaptureScreen.tsx` | Drop `cameraSettings` state + fetch + `useFocusEffect`; wire `onCancel` |
| `modules/samples/SampleForm.tsx` | Drop `cameraSettings` prop; wire `onCancel` |
| `modules/projects/api.ts` | Drop `cameraSettings` from `createProject`; delete `fetch/updateProjectCameraSettings` |
| `modules/projects/CreateProjectScreen.tsx` | Delete calibration section + modal + state |
| `modules/projects/ProjectSettingsScreen.tsx` | Delete calibration section + modal + state + `handleRecalibrate` |
| `modules/account/seed.ts` | Drop `camera_*` from projects SELECT + INSERT |
| `lib/db.ts` | Remove `camera_*` from `SCHEMA_V1`; add v2 migration |
| `docs/schema.sql` | Remove `camera_*` columns from `projects` |
| `docs/architecture.md`, `AGENTS.md`, `modules/CLAUDE.md`, `modules/camera/CLAUDE.md`, `modules/capture/CLAUDE.md`, `modules/projects/CLAUDE.md` | Update camera narrative |
| `docs/superpowers/specs/2026-07-28-native-camera-module-design.md`, `docs/superpowers/specs/2026-07-29-camera-calibration-integration-design.md` | Mark superseded |

**Deleted:**

| Path |
|---|
| `modules/jotter-camera/` (entire directory) |
| `modules/camera/CameraCalibrationScreen.tsx` |
| `modules/camera/exposureMapping.ts` |
| `modules/camera/__tests__/exposureMapping.test.ts` |

**New Supabase migration:** `supabase/migrations/<UTC timestamp>_drop_project_camera_columns.sql`

---

## Task 1: Scaffold and link the `jotter-open-camera` module

**Files:**
- Create: all 9 files under `modules/jotter-open-camera/` (see File Structure)
- Modify: `package.json` (add the file dep)

**Interfaces:**
- Produces (JS, from `jotter-open-camera`):
  ```ts
  export const OPEN_CAMERA_PACKAGE: 'net.sourceforge.opencamera';
  export type CaptureResult = { uri: string } | { cancelled: true };
  export function isOpenCameraInstalled(): boolean;
  export function capture(): Promise<CaptureResult>;
  ```
- Produces (native): an Expo module named `"JotterOpenCamera"` with a sync
  `Function("isOpenCameraInstalled"): Boolean` and `AsyncFunction("capture")`
  resolving `{ "uri": string }` or `{ "cancelled": true }`, rejecting
  `ERR_OPEN_CAMERA_MISSING` / `ERR_CAPTURE_IN_PROGRESS` / `ERR_CAPTURE_EMPTY`.

- [ ] **Step 1: Create `modules/jotter-open-camera/expo-module.config.json`**

```json
{
  "platforms": ["android"],
  "android": {
    "modules": ["expo.modules.jotteropencamera.JotterOpenCameraModule"]
  }
}
```

- [ ] **Step 2: Create `modules/jotter-open-camera/LICENSE`**

Copy `modules/jotter-camera/LICENSE` verbatim:

```bash
cp modules/jotter-camera/LICENSE modules/jotter-open-camera/LICENSE
```

- [ ] **Step 3: Create `modules/jotter-open-camera/src/index.ts`**

```ts
import { requireNativeModule } from 'expo-modules-core';

export const OPEN_CAMERA_PACKAGE = 'net.sourceforge.opencamera';

export type CaptureResult = { uri: string } | { cancelled: true };

type JotterOpenCameraNativeModule = {
  isOpenCameraInstalled(): boolean;
  capture(): Promise<CaptureResult>;
};

const native = requireNativeModule<JotterOpenCameraNativeModule>('JotterOpenCamera');

export function isOpenCameraInstalled(): boolean {
  return native.isOpenCameraInstalled();
}

export function capture(): Promise<CaptureResult> {
  return native.capture();
}
```

- [ ] **Step 4: Create `modules/jotter-open-camera/index.ts`**

```ts
export { OPEN_CAMERA_PACKAGE, isOpenCameraInstalled, capture } from './src/index';
export type { CaptureResult } from './src/index';
```

- [ ] **Step 5: Create `modules/jotter-open-camera/android/build.gradle`**

```gradle
plugins {
  id 'com.android.library'
  id 'expo-module-gradle-plugin'
}

group = 'expo.modules.jotteropencamera'
version = '0.1.0'

android {
  namespace "expo.modules.jotteropencamera"
  defaultConfig {
    versionCode 1
    versionName "0.1.0"
  }
  lintOptions {
    abortOnError false
  }
}

dependencies {
}
```

(No explicit deps — `androidx.core.content.FileProvider` and expo-modules-core
are already on the classpath via the app, same as `jotter-camera` relied on
`ContextCompat` without declaring `androidx.core`.)

- [ ] **Step 6: Create `modules/jotter-open-camera/android/src/main/res/xml/jotter_open_camera_file_paths.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
  <cache-path name="oc_captures" path="." />
</paths>
```

- [ ] **Step 7: Create `modules/jotter-open-camera/android/src/main/AndroidManifest.xml`**

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application>
    <provider
      android:name=".JotterOpenCameraFileProvider"
      android:authorities="${applicationId}.jotteropencamera.fileprovider"
      android:exported="false"
      android:grantUriPermissions="true">
      <meta-data
        android:name="android.support.FILE_PROVIDER_PATHS"
        android:resource="@xml/jotter_open_camera_file_paths" />
    </provider>
  </application>
</manifest>
```

The distinct `android:name` (`.JotterOpenCameraFileProvider`, resolved against
the module namespace `expo.modules.jotteropencamera`) avoids a manifest-merge
collision with `expo-file-system` / `expo-sharing`, which register
`androidx.core.content.FileProvider` under their own authorities.

- [ ] **Step 8: Create `modules/jotter-open-camera/android/src/main/java/expo/modules/jotteropencamera/JotterOpenCameraFileProvider.kt`**

```kotlin
package expo.modules.jotteropencamera

import androidx.core.content.FileProvider

class JotterOpenCameraFileProvider : FileProvider()
```

- [ ] **Step 9: Create `modules/jotter-open-camera/android/src/main/java/expo/modules/jotteropencamera/JotterOpenCameraModule.kt`**

```kotlin
package expo.modules.jotteropencamera

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.MediaStore
import androidx.core.content.FileProvider
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

private const val OPEN_CAMERA_PACKAGE = "net.sourceforge.opencamera"
private const val CAPTURE_REQUEST_CODE = 0x0C4A

class JotterOpenCameraModule : Module() {
  private var pendingPromise: Promise? = null
  private var pendingFile: File? = null

  override fun definition() = ModuleDefinition {
    Name("JotterOpenCamera")

    Function("isOpenCameraInstalled") {
      val pm = appContext.reactContext?.packageManager ?: return@Function false
      try {
        pm.getPackageInfo(OPEN_CAMERA_PACKAGE, 0)
        true
      } catch (e: PackageManager.NameNotFoundException) {
        false
      }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != CAPTURE_REQUEST_CODE) return@OnActivityResult
      val promise = pendingPromise ?: return@OnActivityResult
      val file = pendingFile
      pendingPromise = null
      pendingFile = null

      if (payload.resultCode == Activity.RESULT_OK) {
        if (file != null && file.exists() && file.length() > 0L) {
          promise.resolve(mapOf("uri" to file.toURI().toString()))
        } else {
          promise.reject(CodedException("ERR_CAPTURE_EMPTY", "Open Camera returned no image", null))
        }
      } else {
        file?.delete()
        promise.resolve(mapOf("cancelled" to true))
      }
    }

    AsyncFunction("capture") { promise: Promise ->
      val context = appContext.reactContext
        ?: return@AsyncFunction promise.reject(Exceptions.ReactContextLost())
      val activity = appContext.currentActivity
        ?: return@AsyncFunction promise.reject(Exceptions.MissingActivity())

      if (pendingPromise != null) {
        return@AsyncFunction promise.reject(
          CodedException("ERR_CAPTURE_IN_PROGRESS", "A capture is already in progress", null)
        )
      }

      val file = File(context.cacheDir, "oc-capture-${System.currentTimeMillis()}.jpg")
      val uri = FileProvider.getUriForFile(
        context,
        "${context.packageName}.jotteropencamera.fileprovider",
        file
      )

      val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
        setPackage(OPEN_CAMERA_PACKAGE)
        putExtra(MediaStore.EXTRA_OUTPUT, uri)
        addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
      }

      if (intent.resolveActivity(context.packageManager) == null) {
        return@AsyncFunction promise.reject(
          CodedException("ERR_OPEN_CAMERA_MISSING", "Open Camera is not installed", null)
        )
      }

      pendingPromise = promise
      pendingFile = file
      activity.startActivityForResult(intent, CAPTURE_REQUEST_CODE)
    }
  }
}
```

**If compilation fails on `appContext.currentActivity`:** try
`appContext.activityProvider?.currentActivity` or
`appContext.throwingActivity`. **If `Exceptions.ReactContextLost()` /
`Exceptions.MissingActivity()` don't resolve:** check
`expo.modules.kotlin.exception.Exceptions` in
`node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/exception/`
for the correct names, or substitute
`CodedException("ERR_NO_ACTIVITY", "...", null)`.

- [ ] **Step 10: Add the file dependency to `package.json`**

In the `dependencies` block, add (alphabetical order — right after the existing
`"jotter-camera"` line):

```json
    "jotter-open-camera": "file:./modules/jotter-open-camera",
```

- [ ] **Step 11: Install**

Run: `npm install --force`
Expected: completes; `node_modules/jotter-open-camera` now exists (mirroring how
`node_modules/jotter-camera` does), and `package-lock.json` gains a
`node_modules/jotter-open-camera` entry resolved to `modules/jotter-open-camera`.

If `node_modules/jotter-open-camera` is **not** created (npm's `file:` handling
without a `package.json` in the target is version-dependent), copy it manually
to match `jotter-camera`:
```bash
mkdir -p node_modules/jotter-open-camera && cp -r modules/jotter-open-camera/. node_modules/jotter-open-camera/
```

- [ ] **Step 12: Verify autolinking sees the module**

Run: `npx expo-modules-autolinking search --platform android | grep -i jotter`
Expected: both `jotter-camera` and `jotter-open-camera` appear.

- [ ] **Step 13: Verify types**

Run: `npx tsc --noEmit`
Expected: PASS (the new `src/index.ts` compiles; `requireNativeModule` generic is
supported by `expo-modules-core`).

- [ ] **Step 14: Verify Jest still green**

Run: `npm test`
Expected: PASS (nothing changed for existing tests).

- [ ] **Step 15: Commit**

```bash
git add modules/jotter-open-camera package.json package-lock.json
git commit -m "$(cat <<'EOF'
feat(camera): scaffold jotter-open-camera intent module

Local Expo module that fires a package-pinned ACTION_IMAGE_CAPTURE intent
at Open Camera and returns the JPEG path via OnActivityResult. No camera
code — pure delegation. Ships its own FileProvider subclass to avoid a
manifest-merge clash.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SrPn1VYLUnAFNYdiH79o2S
EOF
)"
```

- [ ] **Step 16: Operator rebuild + native smoke test**

Tell the operator: rebuild the app on-device (`npx expo run:android`), then in a
scratch screen or via the RN debugger console confirm
`require('jotter-open-camera').isOpenCameraInstalled()` returns `true` on the
POCO. This is the only way to catch Kotlin compile errors. Do not proceed past
Task 3 until this passes.

---

## Task 2: `OpenCameraInstallGate` + store-link helper

**Files:**
- Create: `modules/camera/openCameraStoreLinks.ts`
- Create: `modules/camera/__tests__/openCameraStoreLinks.test.ts`
- Create: `modules/camera/OpenCameraInstallGate.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  // openCameraStoreLinks.ts
  export function openCameraStoreLinks(): { primary: string; fallback: string };
  // OpenCameraInstallGate.tsx
  export default function OpenCameraInstallGate(props: { onCancel: () => void }): JSX.Element;
  ```

- [ ] **Step 1: Write the failing test — `modules/camera/__tests__/openCameraStoreLinks.test.ts`**

```ts
import { openCameraStoreLinks } from '../openCameraStoreLinks';

describe('openCameraStoreLinks', () => {
  it('returns the Play Store deep link as primary and the F-Droid page as fallback', () => {
    expect(openCameraStoreLinks()).toEqual({
      primary: 'market://details?id=net.sourceforge.opencamera',
      fallback: 'https://f-droid.org/packages/net.sourceforge.opencamera/',
    });
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npm test -- openCameraStoreLinks`
Expected: FAIL — cannot find module `../openCameraStoreLinks`.

- [ ] **Step 3: Create `modules/camera/openCameraStoreLinks.ts`**

```ts
export const OPEN_CAMERA_PACKAGE = 'net.sourceforge.opencamera';

export function openCameraStoreLinks(): { primary: string; fallback: string } {
  return {
    primary: `market://details?id=${OPEN_CAMERA_PACKAGE}`,
    fallback: `https://f-droid.org/packages/${OPEN_CAMERA_PACKAGE}/`,
  };
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npm test -- openCameraStoreLinks`
Expected: PASS.

- [ ] **Step 5: Create `modules/camera/OpenCameraInstallGate.tsx`**

```tsx
import { Linking, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { openCameraStoreLinks } from './openCameraStoreLinks';

type Props = { onCancel: () => void };

export default function OpenCameraInstallGate({ onCancel }: Props) {
  async function openStore() {
    const { primary, fallback } = openCameraStoreLinks();
    try {
      const canOpenPrimary = await Linking.canOpenURL(primary);
      await Linking.openURL(canOpenPrimary ? primary : fallback);
    } catch {
      Linking.openURL(fallback).catch(() => {});
    }
  }

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 items-center justify-center bg-canvas px-6">
      <Text className="text-center font-inter-bold text-base text-body-strong">
        Jotter uses Open Camera to take photos.
      </Text>
      <Text className="mt-2 text-center font-inter-light text-sm text-body">
        Install Open Camera to continue.
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Install Open Camera"
        activeOpacity={0.85}
        onPress={openStore}
        className="mt-6 h-[56px] w-full items-center justify-center bg-primary"
      >
        <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-primary-on">
          Install Open Camera
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Cancel"
        activeOpacity={0.7}
        onPress={onCancel}
        className="mt-3 h-12 items-center justify-center px-6"
      >
        <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-body">Cancel</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
```

- [ ] **Step 6: Verify types**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add modules/camera/openCameraStoreLinks.ts modules/camera/OpenCameraInstallGate.tsx modules/camera/__tests__/openCameraStoreLinks.test.ts
git commit -m "$(cat <<'EOF'
feat(camera): add Open Camera install-gate screen

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SrPn1VYLUnAFNYdiH79o2S
EOF
)"
```

---

## Task 3: Capture cutover — rewrite `CameraCaptureStep`, update both call sites

This task keeps the tree compiling: `CameraCaptureStep` loses `cameraSettings`,
and its two callers (`CaptureScreen`, `SampleForm`) stop passing it in the same
commit. `modules/projects/api.ts` still exports `fetchProjectCameraSettings`
(unused now — removed in Task 4) and `jotter-camera` still exists (removed in
Task 5).

**Files:**
- Modify: `modules/camera/CameraCaptureStep.tsx` (full rewrite)
- Modify: `modules/capture/CaptureScreen.tsx`
- Modify: `modules/samples/SampleForm.tsx`

**Interfaces:**
- Consumes: `jotter-open-camera` (`capture`, `isOpenCameraInstalled`),
  `OpenCameraInstallGate` (Task 2), `newId` from `lib/db`, `File`/`Paths` from
  `expo-file-system`.
- Produces:
  ```ts
  // CameraCaptureStep.tsx — new props
  type Props = {
    label: string;
    onCapture: (localUri: string) => void;
    onCancel: () => void;
  };
  ```

- [ ] **Step 1: Rewrite `modules/camera/CameraCaptureStep.tsx`**

Replace the entire file with:

```tsx
import { useState } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { File, Paths } from 'expo-file-system';

import { capture, isOpenCameraInstalled } from 'jotter-open-camera';
import { newId } from '../../lib/db';
import OpenCameraInstallGate from './OpenCameraInstallGate';

type Props = {
  label: string;
  onCapture: (localUri: string) => void;
  onCancel: () => void;
};

type Stage = 'idle' | 'capturing' | 'review';

export default function CameraCaptureStep({ label, onCapture, onCancel }: Props) {
  const [installed] = useState(isOpenCameraInstalled);
  const [missing, setMissing] = useState(false);
  const [stage, setStage] = useState<Stage>('idle');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  if (!installed || missing) {
    return <OpenCameraInstallGate onCancel={onCancel} />;
  }

  async function runCapture() {
    setStage('capturing');
    try {
      const result = await capture();
      if ('cancelled' in result) {
        setStage('idle');
        return;
      }
      setPhotoUri(result.uri);
      setStage('review');
    } catch (err) {
      const code = err instanceof Error ? (err as { code?: string }).code : undefined;
      if (code === 'ERR_OPEN_CAMERA_MISSING') {
        setMissing(true);
        return;
      }
      setStage('idle');
    }
  }

  async function usePhoto() {
    if (!photoUri) return;
    const destination = new File(Paths.document, `${newId()}.jpg`);
    await new File(photoUri).copy(destination);
    onCapture(destination.uri);
  }

  if (stage === 'review' && photoUri) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-canvas">
        <Image source={{ uri: photoUri }} resizeMode="contain" className="flex-1" />
        <View className="border-t border-hairline px-6 py-6">
          <Text className="mb-4 text-center font-inter-bold text-base text-body-strong">{label}</Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Retake photo"
              activeOpacity={0.85}
              onPress={runCapture}
              className="h-[56px] flex-1 items-center justify-center border-2 border-hairline-strong"
            >
              <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-ink">Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Use this photo"
              activeOpacity={0.85}
              onPress={usePhoto}
              className="h-[56px] flex-1 items-center justify-center bg-primary"
            >
              <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-primary-on">
                Use Photo
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 items-center justify-center bg-canvas px-6">
      <Text className="mb-6 text-center font-inter-bold text-base text-body-strong">{label}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Open Camera to take photo — ${label}`}
        activeOpacity={0.85}
        disabled={stage === 'capturing'}
        onPress={runCapture}
        className={`h-[56px] w-full items-center justify-center ${
          stage === 'capturing' ? 'bg-surface-elevated' : 'bg-primary'
        }`}
      >
        <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-primary-on">
          {stage === 'capturing' ? 'Opening…' : 'Open Camera'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Cancel"
        activeOpacity={0.7}
        onPress={onCancel}
        className="mt-3 h-12 items-center justify-center px-6"
      >
        <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-body">Cancel</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Update `modules/capture/CaptureScreen.tsx`**

Make these edits:

1. Delete the import line `import { useFocusEffect } from '@react-navigation/native';` (line 2).
2. Delete `import { fetchProjectCameraSettings } from '../projects/api';` (line 11).
3. Delete `import type { ManualExposureOptions } from 'jotter-camera';` (line 12).
4. Delete the state line `const [cameraSettings, setCameraSettings] = useState<ManualExposureOptions | null>(null);` (line 30).
5. In `load` (the `useCallback`), change the `Promise.all` from three calls to two:

```ts
  const load = useCallback(() => {
    setLoadError(false);
    Promise.all([fetchCaptureSlots(projectId), fetchFields(projectId)])
      .then(([loadedSlots, loadedFields]) => {
        setSlots(loadedSlots);
        setFields(loadedFields);
        setSlotIndex(0);
        setPhotos([]);
        setStep(loadedSlots[0]?.target_angle_degrees != null ? 'angle-assist' : 'camera');
      })
      .catch(() => setLoadError(true));
  }, [projectId]);
```

6. Delete the entire `useFocusEffect(...)` block (the one with the
   `// Camera settings can change (recalibration)...` comment, lines ~55-65).
7. In the `step === 'camera'` return, update the `<CameraCaptureStep>` usage:

```tsx
        <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
          {cameraOpen && (
            <CameraCaptureStep
              label={currentSlot.label}
              onCancel={() => setCameraOpen(false)}
              onCapture={(uri) => {
                setCameraOpen(false);
                handleAdvanceSlot(uri);
              }}
            />
          )}
        </Modal>
```

8. In the final return, update `<SampleForm>` — remove the `cameraSettings` prop:

```tsx
      <SampleForm
        projectId={projectId}
        fields={fields}
        saving={step === 'saving'}
        onSave={handleSaveSample}
      />
```

- [ ] **Step 3: Update `modules/samples/SampleForm.tsx`**

1. Delete `import type { ManualExposureOptions } from 'jotter-camera';` (line 7).
2. In `type Props`, delete `cameraSettings: ManualExposureOptions | null;` (line 17).
3. In the function signature, remove `cameraSettings` from the destructured props (line 22):

```tsx
export default function SampleForm({ projectId, fields, saving, onSave }: Props) {
```

4. Update the `<CameraCaptureStep>` in the photo-field `<Modal>` (lines ~220-228):

```tsx
      <Modal visible={photoFieldOpen !== null} animationType="slide" onRequestClose={() => setPhotoFieldOpen(null)}>
        {photoFieldOpen && (
          <CameraCaptureStep
            label={photoFieldOpen.name}
            onCancel={() => setPhotoFieldOpen(null)}
            onCapture={(uri) => {
              setValue(photoFieldOpen.id, uri);
              setPhotoFieldOpen(null);
            }}
          />
        )}
      </Modal>
```

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: PASS. (`modules/projects/api.ts` still compiles — its now-unused
`fetchProjectCameraSettings` / `updateProjectCameraSettings` stay until Task 4.)

- [ ] **Step 5: Verify Jest**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add modules/camera/CameraCaptureStep.tsx modules/capture/CaptureScreen.tsx modules/samples/SampleForm.tsx
git commit -m "$(cat <<'EOF'
feat(camera): capture via Open Camera hand-off instead of live preview

CameraCaptureStep is now a launcher + review screen. CaptureScreen and
SampleForm no longer thread per-project exposure settings through.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SrPn1VYLUnAFNYdiH79o2S
EOF
)"
```

---

## Task 4: Remove per-project camera settings from the data + project screens

**Files:**
- Modify: `modules/projects/api.ts`
- Modify: `modules/projects/CreateProjectScreen.tsx`
- Modify: `modules/projects/ProjectSettingsScreen.tsx`

**Interfaces:**
- Produces: `createProject` input type loses `cameraSettings`;
  `fetchProjectCameraSettings` and `updateProjectCameraSettings` no longer exist.

- [ ] **Step 1: Edit `modules/projects/api.ts`**

1. Delete `import type { ManualExposureOptions, WhiteBalancePreset } from 'jotter-camera';` (line 5).
2. In the `createProject` input object type, delete the line `cameraSettings: ManualExposureOptions | null;`.
3. Replace the `INSERT INTO projects` statement and its params:

```ts
    await db.runAsync(
      'INSERT INTO projects (id, owner_id, name, color, capture_mode, created_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?)',
      projectId,
      userId,
      input.name,
      input.color,
      input.captureMode,
      nowIso(),
    );
```

4. Delete the entire `fetchProjectCameraSettings` function.
5. Delete the entire `updateProjectCameraSettings` function.

- [ ] **Step 2: Edit `modules/projects/CreateProjectScreen.tsx`**

1. Delete `import CameraCalibrationScreen from '../camera/CameraCalibrationScreen';` (line 14).
2. Delete `import type { ManualExposureOptions } from 'jotter-camera';` (line 15).
3. Delete the two state lines (lines 48-49):
   ```tsx
   const [cameraSettings, setCameraSettings] = useState<ManualExposureOptions | null>(null);
   const [calibrationOpen, setCalibrationOpen] = useState(false);
   ```
4. In `handleCreate`'s `createProject({...})` call, delete the `cameraSettings,` line.
5. Delete the entire "Camera" section in the JSX — from `<Text className="mt-8 font-inter-bold text-base text-body-strong">Camera</Text>` through the closing `</TouchableOpacity>` of the Calibrate button (the block ending `{cameraSettings ? 'Recalibrate' : 'Calibrate Camera'}` ... `</TouchableOpacity>`). The next sibling (`<View className="mt-8 flex-row items-center justify-between">` for Fields) becomes the first element after capture-slots.
6. Delete the calibration `<Modal>` at the end of the component:
   ```tsx
   <Modal visible={calibrationOpen} onRequestClose={...}>
     <CameraCalibrationScreen ... />
   </Modal>
   ```

- [ ] **Step 3: Edit `modules/projects/ProjectSettingsScreen.tsx`**

1. Delete `import type { ManualExposureOptions } from 'jotter-camera';` (line 3).
2. Change the api import to drop the camera functions:
   ```ts
   import { deleteProject } from './api';
   ```
3. Delete `import CameraCalibrationScreen from '../camera/CameraCalibrationScreen';` (line 10).
4. Delete the state lines:
   ```tsx
   const [cameraSettings, setCameraSettings] = useState<ManualExposureOptions | null>(null);
   const [loadingCamera, setLoadingCamera] = useState(true);
   const [calibrationOpen, setCalibrationOpen] = useState(false);
   ```
5. Delete the `useEffect` that calls `fetchProjectCameraSettings`.
6. Delete the entire `handleRecalibrate` function.
7. Delete the entire "Camera" `<View className="mt-8">` block (the `<Text>Camera</Text>` heading through its Recalibrate `<TouchableOpacity>`).
8. Delete the calibration `<Modal>` at the end.
9. Remove now-unused imports: `ActivityIndicator` is still used (delete button spinner) — keep. Check `useState` still used (`deleting`) — keep. `useEffect` — if no other `useEffect` remains, remove it from the React import.

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Verify Jest**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add modules/projects/api.ts modules/projects/CreateProjectScreen.tsx modules/projects/ProjectSettingsScreen.tsx
git commit -m "$(cat <<'EOF'
refactor(projects): drop per-project camera calibration

Open Camera holds exposure settings device-globally, so Jotter no longer
stores or applies them per project. Removes the calibration UI from
project create/settings and the two data functions.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SrPn1VYLUnAFNYdiH79o2S
EOF
)"
```

---

## Task 5: Delete `jotter-camera`, the calibration screens, and unused deps

**Files:**
- Delete: `modules/jotter-camera/` (whole dir)
- Delete: `modules/camera/CameraCalibrationScreen.tsx`
- Delete: `modules/camera/exposureMapping.ts`
- Delete: `modules/camera/__tests__/exposureMapping.test.ts`
- Modify: `package.json`, `app.json`

- [ ] **Step 1: Confirm nothing still imports the doomed files**

Run:
```bash
grep -rn "jotter-camera\|CameraCalibrationScreen\|exposureMapping\|expo-camera\|community/slider\|ManualExposureOptions\|WhiteBalancePreset\|JotterCameraView" --include="*.ts" --include="*.tsx" modules/ lib/ navigation/ App.tsx
```
Expected: **no matches.** If any appear, fix them before deleting.

- [ ] **Step 2: Delete the files**

```bash
git rm -r modules/jotter-camera
git rm modules/camera/CameraCalibrationScreen.tsx modules/camera/exposureMapping.ts modules/camera/__tests__/exposureMapping.test.ts
```

- [ ] **Step 3: Edit `package.json`**

Remove these three lines from `dependencies`:
```json
    "@react-native-community/slider": "5.2.0",
    "expo-camera": "~56.0.8",
    "jotter-camera": "file:./modules/jotter-camera",
```

- [ ] **Step 4: Edit `app.json`**

1. In `expo.plugins`, delete the entire `expo-camera` array entry:
   ```json
   [
     "expo-camera",
     {
       "cameraPermission": "...",
       "recordAudioAndroid": false
     }
   ],
   ```
2. In `expo.android.permissions`, remove `"android.permission.CAMERA"`, leaving
   `"permissions": []`. (The `ACTION_IMAGE_CAPTURE` intent does not require the
   caller to hold CAMERA.)

- [ ] **Step 5: Reinstall**

Run: `npm install --force`
Expected: completes; `node_modules/jotter-camera`, `node_modules/expo-camera`,
`node_modules/@react-native-community/slider` are gone;
`package-lock.json` updated.

- [ ] **Step 6: Verify types + tests**

Run: `npx tsc --noEmit && npm test`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(camera): delete jotter-camera module and calibration screens

Removes the custom CameraX module (source of the fixed-focus blur and the
lifecycle black-screen bug), the slider-based calibration screens, and the
now-unused expo-camera / @react-native-community/slider deps. Drops the
CAMERA permission and expo-camera config plugin.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SrPn1VYLUnAFNYdiH79o2S
EOF
)"
```

- [ ] **Step 8: Operator rebuild**

Tell the operator: `npx expo prebuild --clean` then `npx expo run:android` — the
`app.json` plugin/permission change needs a fresh prebuild. Confirm the app
still launches and the Capture tab opens without error.

---

## Task 6: Drop the `camera_*` columns (SQLite + Supabase + seed + schema doc)

**Files:**
- Modify: `lib/db.ts`
- Modify: `modules/account/seed.ts`
- Modify: `docs/schema.sql`
- Create: `supabase/migrations/<UTC timestamp>_drop_project_camera_columns.sql`

- [ ] **Step 1: Edit `lib/db.ts` — `SCHEMA_V1`**

In the `CREATE TABLE IF NOT EXISTS projects (...)` block, delete these five lines:
```sql
  camera_iso INTEGER,
  camera_shutter_speed_ns INTEGER,
  camera_white_balance TEXT,
  camera_resolution_width INTEGER,
  camera_resolution_height INTEGER,
```
The `projects` block becomes: `id, owner_id, name, color, capture_mode,
created_at, synced_at`.

- [ ] **Step 2: Edit `lib/db.ts` — `migrate()`**

Replace the body of `migrate`'s transaction with:

```ts
    const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    let version = result?.user_version ?? 0;
    if (version < 1) {
      await db.execAsync(SCHEMA_V1);
      // Fresh install: SCHEMA_V1 already has no camera_* columns, so it is
      // schema v2. Jump straight there and skip the drop-column step below.
      version = 2;
    }
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
    await db.execAsync(`PRAGMA user_version = ${version}`);
```

- [ ] **Step 3: Edit `modules/account/seed.ts`**

1. In the projects `.select(...)` string (line ~48), change to:
   ```ts
   .select('id, owner_id, name, color, capture_mode, created_at')
   ```
2. In the projects `INSERT OR REPLACE` (line ~134), change the statement + params:
   ```ts
   await db.runAsync(
     'INSERT OR REPLACE INTO projects (id, owner_id, name, color, capture_mode, created_at, synced_at) ' +
       'VALUES (?, ?, ?, ?, ?, ?, ?)',
     p.id,
     p.owner_id,
     p.name,
     p.color,
     p.capture_mode,
     p.created_at,
     now,
   );
   ```

- [ ] **Step 4: Edit `docs/schema.sql`**

In `create table projects (...)`, delete:
```sql
  camera_iso integer,
  camera_shutter_speed_ns bigint,
  camera_white_balance text,
  camera_resolution_width integer,
  camera_resolution_height integer,
```

- [ ] **Step 5: Create the Supabase migration**

Run `date -u +%Y%m%d%H%M%S` to get the timestamp, then create
`supabase/migrations/<timestamp>_drop_project_camera_columns.sql`:

```sql
alter table projects drop column if exists camera_iso;
alter table projects drop column if exists camera_shutter_speed_ns;
alter table projects drop column if exists camera_white_balance;
alter table projects drop column if exists camera_resolution_width;
alter table projects drop column if exists camera_resolution_height;
```

- [ ] **Step 6: Verify types + tests**

Run: `npx tsc --noEmit && npm test`
Expected: both PASS. (`modules/data/__tests__/export.test.ts` builds its own
field fixtures and does not touch `projects` camera columns — confirm it still
passes.)

- [ ] **Step 7: Commit**

```bash
git add lib/db.ts modules/account/seed.ts docs/schema.sql supabase/migrations
git commit -m "$(cat <<'EOF'
refactor(db): drop the projects camera_* columns

Local SQLite schema v2 (ALTER TABLE DROP COLUMN for existing installs),
matching Supabase migration, seed + schema doc updated. Camera exposure
is no longer stored per project.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SrPn1VYLUnAFNYdiH79o2S
EOF
)"
```

- [ ] **Step 8: Operator applies the Supabase migration**

Tell the operator: `npm run db:push` (needs `supabase link` + connectivity).
Non-blocking for on-device testing — local SQLite is the source of truth.

---

## Task 7: Documentation

**Files:**
- Modify: `docs/architecture.md`
- Modify: `AGENTS.md`
- Modify: `modules/CLAUDE.md`
- Modify: `modules/camera/CLAUDE.md`
- Modify: `modules/capture/CLAUDE.md`
- Modify: `modules/projects/CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-07-28-native-camera-module-design.md`
- Modify: `docs/superpowers/specs/2026-07-29-camera-calibration-integration-design.md`

- [ ] **Step 1: `AGENTS.md`**

Replace the key-architecture bullet that begins "Photo capture uses a custom
native camera module for locked manual exposure..." with:

```
- Photo capture hands off to the Open Camera app (`net.sourceforge.opencamera`)
  via a package-pinned `ACTION_IMAGE_CAPTURE` intent (`modules/jotter-open-camera/`).
  Manual exposure (ISO/shutter/white-balance/focus) is configured once per device
  inside Open Camera, per an external SOP — Jotter neither sets nor stores it.
  If Open Camera is not installed, capture is blocked behind an install-gate screen.
```

- [ ] **Step 2: `docs/architecture.md`**

1. Replace the bullet at line ~15-16 (custom native Android camera module +
   `StreamConfigurationMap` resolution) with a short bullet describing the Open
   Camera intent hand-off and that exposure is configured in Open Camera per an
   external SOP, not in-app.
2. In the Project Structure tree (lines ~58-64): remove the `jotter-camera/`
   subtree; change the `camera/` line to
   `# camera hand-off (Open Camera launcher + install gate)` and update its file
   list to `CameraCaptureStep.tsx`, `OpenCameraInstallGate.tsx`,
   `openCameraStoreLinks.ts`. Add a `jotter-open-camera/` entry:
   `# NOT a domain module — local Expo module, ACTION_IMAGE_CAPTURE intent to Open Camera`.
3. In the `projects` data-model line (~103): remove `camera_iso`,
   `camera_shutter_speed_ns`, `camera_white_balance`, `camera_resolution_width`,
   `camera_resolution_height` and the sentence about camera settings being
   configured at first Capture open.
4. In the Capture-flow description (~140): change "takes the photo using Jotter's
   own camera, captured with the project's locked ISO/shutter-speed/white-balance
   via the native camera module — no app-switching required" to describe leaving
   to Open Camera and returning with the photo.
5. Delete or rewrite the line at ~145 ("Camera calibration ... is deliberately
   **not** part of initial project creation ...") — there is no calibration.

- [ ] **Step 3: `modules/CLAUDE.md`**

In the Directory map: delete the `jotter-camera/` line; change the `camera/`
line to describe the Open Camera launcher (no live preview).

- [ ] **Step 4: `modules/camera/CLAUDE.md`**

Rewrite the file body for the new model: `CameraCaptureStep.tsx` is a launcher
(button → `jotter-open-camera`'s `capture()` → review → attach) reused by
`CaptureScreen` and `SampleForm`; `OpenCameraInstallGate.tsx` is shown when
`isOpenCameraInstalled()` is false; `openCameraStoreLinks.ts` is the pure
tested helper. Remove all references to `expo-camera`, `JotterCameraView`,
manual exposure, calibration, and Camera2 hardware levels. Keep the note that
`CameraCaptureStep`'s `usePhoto` copies the capture into `Paths.document` via
`newId()` so consumers always get a document-dir URI.

- [ ] **Step 5: `modules/capture/CLAUDE.md`**

Update the line about "the actual camera hardware interaction lives in
`modules/camera/`" — it's now an app hand-off, not hardware interaction. Remove
any mention of locked settings being applied during capture.

- [ ] **Step 6: `modules/projects/CLAUDE.md`**

Remove the sentences about camera calibration being configured "the first time
Capture is opened" / not part of creation. Remove
`fetchProjectCameraSettings`/`updateProjectCameraSettings` from the `api.ts`
function list if named.

- [ ] **Step 7: Mark the two old specs superseded**

At the very top of each of
`docs/superpowers/specs/2026-07-28-native-camera-module-design.md` and
`docs/superpowers/specs/2026-07-29-camera-calibration-integration-design.md`,
add a blockquote line:

```
> **SUPERSEDED (2026-09-04)** by `2026-09-04-open-camera-capture-design.md` —
> the custom camera module and per-project calibration are removed; capture is
> now an Open Camera intent hand-off.
```

- [ ] **Step 8: Commit**

```bash
git add AGENTS.md docs/ modules/CLAUDE.md modules/camera/CLAUDE.md modules/capture/CLAUDE.md modules/projects/CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: update camera narrative for the Open Camera hand-off

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SrPn1VYLUnAFNYdiH79o2S
EOF
)"
```

---

## Task 8: On-device verification

Not a code task — the operator runs this on the POCO X6 Pro 5G after a clean
rebuild (`npx expo prebuild --clean && npx expo run:android`). Every item must
pass before the branch merges.

- [ ] Open Camera configured per SOP (Camera2 API on; manual ISO/shutter/WB; MF locked; HDR off; no zoom; no photo stamp).
- [ ] New project → Capture tab → "Open Camera" → Open Camera launches → shoot → its confirm screen → land back in Jotter on the review screen.
- [ ] Review screen: "Use Photo" → photo attaches to the sample, flow advances.
- [ ] Review screen: "Retake" → Open Camera re-launches.
- [ ] Cancel inside Open Camera (back out without confirming) → returns to the "Open Camera" idle screen, no crash.
- [ ] "Cancel" on the idle screen → closes the capture modal.
- [ ] Multi-slot project → capture every slot in sequence → each photo lands on the right slot → logging form appears after the last.
- [ ] A slot with a target angle → `AngleAssistStep` still runs before "Open Camera".
- [ ] Sample-photo field inside the logging form → same launch → review → attach flow.
- [ ] EXIF of an attached photo shows the locked manual ISO / shutter / WB (settings survived the intent).
- [ ] Uninstall Open Camera → Capture → "Open Camera" button screen replaced by the install-gate → "Install Open Camera" opens a store page → reinstall → capture works again.
- [ ] Repeat capture → back → capture several times: **no black screen** (there is no camera session in Jotter).
- [ ] Captured photos are **sharp** at the working distance (Open Camera manual focus).
- [ ] Existing project created before this change still opens Capture without error (v2 migration dropped its `camera_*` columns cleanly).

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| New module `jotter-open-camera` (JS API, Kotlin, FileProvider) | Task 1 |
| `CameraCaptureStep` rewrite (state machine) | Task 3 |
| Install-gate screen | Task 2 |
| `CaptureScreen` / `SampleForm` call-site changes | Task 3 |
| `projects/api.ts` — remove settings code | Task 4 |
| `CreateProjectScreen` / `ProjectSettingsScreen` — remove calibration | Task 4 |
| `seed.ts` column removal | Task 6 |
| Local SQLite `SCHEMA_V1` edit + v2 migration | Task 6 |
| Supabase migration | Task 6 |
| `docs/schema.sql`, `architecture.md`, module `CLAUDE.md`s, `AGENTS.md` | Task 7 |
| Delete `jotter-camera`, calibration screens, `exposureMapping` | Task 5 |
| Drop `expo-camera`, `@react-native-community/slider` | Task 5 |
| `[diag]` logging removed with the module | Task 5 (implicit — whole dir deleted) |
| Test plan (automated + on-device checklist) | Tasks 2, 8 |
| Implementation order keeps tree compiling | Task order 1→7 |

No gaps.

**Placeholder scan:** none — every step has concrete code or an exact edit list.
Two flagged uncertainties (Kotlin `currentActivity` accessor, `Exceptions.*`
names) carry explicit fallback instructions in Task 1 Step 9.

**Type consistency:** `CaptureResult = { uri: string } | { cancelled: true }`
used identically in Task 1 (`src/index.ts`) and Task 3 (`CameraCaptureStep`
checks `'cancelled' in result`). `capture()` / `isOpenCameraInstalled()`
signatures match between Task 1 (produced) and Task 3 (consumed). Props type
`{ label; onCapture; onCancel }` defined in Task 3 Step 1 and consumed by the
same step's edits to `CaptureScreen` / `SampleForm`. `openCameraStoreLinks(): {
primary: string; fallback: string }` defined and consumed in Task 2.
