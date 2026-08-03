# Camera Calibration + Capture Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the already-built native camera module (`jotter-camera`) into the real app: a mandatory calibration screen at project creation, a recalibration entry in project settings, and a `CameraCaptureStep` rewrite that shoots with a project's locked ISO/shutter/white-balance settings instead of `expo-camera`'s auto-exposure placeholder.

**Architecture:** Calibration settings (ISO, shutter speed in ns, white balance in Kelvin) are stored per-project on already-existing `projects` columns. A shared `CameraCalibrationScreen` component (live `JotterCameraView` preview + three sliders) is opened as a full-screen `Modal` from both `CreateProjectScreen` (mandatory, held in local state until project creation) and `ProjectSettingsScreen` (optional recalibration, persisted immediately). `CaptureScreen` fetches a project's settings once and threads them down to every `CameraCaptureStep` instance so all captures in a sample use identical locked exposure.

**Tech Stack:** Expo SDK 56, React Native, TypeScript, `jotter-camera` (local native module), `@react-native-community/slider` (new dependency), Supabase, Jest + `jest-expo` (new test infrastructure), nativewind.

## Global Constraints

- **This plan executes inside an isolated worktree** (`.worktrees/camera-calibration-integration`, branch `sdd/camera-calibration-integration`, forked from `camera`'s tip). Per-task commits inside this worktree/branch are fine — that's how subagent-driven-development's ledger and review diffing work, and this branch is disposable scratch, never pushed or merged automatically. What's absolute: **nothing ever gets committed, staged, or pushed on the user's real `camera` branch or checkout without their explicit action.** After the final review is clean, the cumulative diff is handed to the user as uncommitted working-tree changes on their real checkout — all commits there are manual, done by the user only (standing project rule, see `CLAUDE.md`).
- **Android only.** The app has no iOS build target. Do not add any `Platform.OS` branching — every task assumes Android exclusively.
- **Resolution calibration is out of scope.** The native module has no capture-resolution API. Do not touch `camera_resolution_width`/`camera_resolution_height` or add any resolution UI.
- **Dark "Calibration Bench" design system only** (`DESIGN.md`) — `bg-canvas` (`#000000`), `text-ink` (`#ffffff`), `text-body`/`text-body-strong`, `border-hairline`/`border-hairline-strong`, `bg-primary`/`text-primary-on`, `text-destructive`/`border-destructive`, sharp corners (no `rounded-xl`), `font-inter*` type classes. `ProjectSettingsScreen.tsx` currently predates this system (uses `bg-white`, `slate-*`, `border-red-300`, `rounded-xl`) — since this plan touches that file, migrating its styling to the current system is in scope for that task, per `modules/CLAUDE.md`.
- **Accessibility floor**: `accessibilityRole`/`accessibilityLabel` on every interactive element, 48×48dp minimum touch targets on buttons, never `allowFontScaling={false}`.
- **Match existing code style** — no comments except where logic is genuinely non-obvious; no abstractions beyond what each task needs.
- `ManualExposureOptions` (the shared type `{ iso: number; shutterSpeedNs: number; whiteBalanceKelvin: number }`) is exported from the `jotter-camera` package root (`modules/jotter-camera/index.ts`) and resolvable everywhere in the app as a bare import — `import type { ManualExposureOptions } from 'jotter-camera';` — since `package.json` declares `"jotter-camera": "file:./modules/jotter-camera"` and it's symlinked into `node_modules/jotter-camera`.

---

### Task 1: Jest test infrastructure

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npx jest` command for Task 2 to write real tests against.

- [ ] **Step 1: Install jest-expo**

Run: `npx expo install jest-expo jest @types/jest --dev`
Expected: `jest-expo`, `jest`, and `@types/jest` added to `package.json`'s `devDependencies` at Expo-SDK-56-compatible versions.

- [ ] **Step 2: Add the test script and jest preset to package.json**

In `package.json`, add `"test": "jest"` to the existing `"scripts"` object, and add a new top-level `"jest"` key:

```json
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web",
    "test": "jest",
    "db:link": "supabase link",
    "db:push": "supabase db push",
    "db:diff": "supabase db diff -f"
  },
  "jest": {
    "preset": "jest-expo"
  },
```

(Using `"jest"` rather than Expo's docs-suggested `"jest --watchAll"` — this repo's verification steps run tests once, not interactively.)

- [ ] **Step 3: Add Jest types to tsconfig.json**

Edit `tsconfig.json`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "types": ["jest"]
  }
}
```

- [ ] **Step 4: Verify Jest runs with zero test files**

Run: `npx jest`
Expected: exits 0. `jest-expo`'s preset sets `passWithNoTests: true`, so with no test files yet this should print something like "No tests found, exiting with code 0" rather than failing.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json package-lock.json
git commit -m "test: add Jest + jest-expo test infrastructure"
```

---

### Task 2: `exposureMapping.ts` — slider ↔ device-value conversion (TDD)

**Files:**
- Create: `modules/camera/exposureMapping.ts`
- Test: `modules/camera/__tests__/exposureMapping.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions, no app types needed beyond plain numbers and tuples).
- Produces (for Task 4's `CameraCalibrationScreen` to consume):
  - `sliderToIso(position: number, isoRange: [number, number]): number`
  - `isoToSlider(iso: number, isoRange: [number, number]): number`
  - `sliderToShutterSpeedNs(position: number, exposureTimeRangeNs: [number, number]): number`
  - `shutterSpeedNsToSlider(shutterSpeedNs: number, exposureTimeRangeNs: [number, number]): number`
  - `sliderToWhiteBalanceKelvin(position: number): number`
  - `whiteBalanceKelvinToSlider(kelvin: number): number`
  - `WHITE_BALANCE_KELVIN_RANGE: [number, number]` (fixed `[2000, 10000]`)

All slider positions are in `[0, 1]`. ISO and shutter speed use log-scale mapping (both span multiple orders of magnitude — shutter alone is ~30µs to 30s on the test device). White balance uses linear mapping over a fixed range, since the native module doesn't report a hardware Kelvin range.

- [ ] **Step 1: Write the failing tests**

Create `modules/camera/__tests__/exposureMapping.test.ts`:

```ts
import {
  isoToSlider,
  sliderToIso,
  shutterSpeedNsToSlider,
  sliderToShutterSpeedNs,
  whiteBalanceKelvinToSlider,
  sliderToWhiteBalanceKelvin,
  WHITE_BALANCE_KELVIN_RANGE,
} from '../exposureMapping';

const ISO_RANGE: [number, number] = [50, 6400];
const SHUTTER_RANGE_NS: [number, number] = [30833, 30000000000];

describe('ISO mapping (log scale)', () => {
  it('maps slider position 0 to the range minimum', () => {
    expect(sliderToIso(0, ISO_RANGE)).toBe(50);
  });

  it('maps slider position 1 to the range maximum', () => {
    expect(sliderToIso(1, ISO_RANGE)).toBe(6400);
  });

  it('round-trips a midpoint value', () => {
    const iso = sliderToIso(0.5, ISO_RANGE);
    const position = isoToSlider(iso, ISO_RANGE);
    expect(position).toBeCloseTo(0.5, 1);
  });

  it('clamps out-of-range values when converting back to a slider position', () => {
    expect(isoToSlider(1, ISO_RANGE)).toBe(0);
    expect(isoToSlider(999999, ISO_RANGE)).toBe(1);
  });
});

describe('Shutter speed mapping (log scale)', () => {
  it('maps slider position 0 to the range minimum', () => {
    expect(sliderToShutterSpeedNs(0, SHUTTER_RANGE_NS)).toBe(30833);
  });

  it('maps slider position 1 to the range maximum', () => {
    expect(sliderToShutterSpeedNs(1, SHUTTER_RANGE_NS)).toBe(30000000000);
  });

  it('round-trips a midpoint value', () => {
    const shutterSpeedNs = sliderToShutterSpeedNs(0.5, SHUTTER_RANGE_NS);
    const position = shutterSpeedNsToSlider(shutterSpeedNs, SHUTTER_RANGE_NS);
    expect(position).toBeCloseTo(0.5, 1);
  });

  it('gives roughly equal slider spacing to shutter speeds that are equal photographic stops apart', () => {
    // 1/500s, 1/60s, and 1/8s are each ~3 stops apart from their neighbor.
    // A log-scale mapping spaces them roughly evenly; a linear mapping would
    // crush all three into a sliver near position 0 (the range's max is 30s).
    const posFast = shutterSpeedNsToSlider(2_000_000, SHUTTER_RANGE_NS); // 1/500s
    const posMid = shutterSpeedNsToSlider(16_666_667, SHUTTER_RANGE_NS); // 1/60s
    const posSlow = shutterSpeedNsToSlider(125_000_000, SHUTTER_RANGE_NS); // 1/8s

    const gap1 = posMid - posFast;
    const gap2 = posSlow - posMid;
    expect(gap1).toBeGreaterThan(0.1);
    expect(gap2).toBeGreaterThan(0.1);
    expect(Math.abs(gap1 - gap2)).toBeLessThan(0.05);
  });

  it('clamps out-of-range values when converting back to a slider position', () => {
    expect(shutterSpeedNsToSlider(1, SHUTTER_RANGE_NS)).toBe(0);
    expect(shutterSpeedNsToSlider(999_999_999_999, SHUTTER_RANGE_NS)).toBe(1);
  });
});

describe('White balance mapping (linear scale, fixed range)', () => {
  it('uses a fixed 2000K-10000K range', () => {
    expect(WHITE_BALANCE_KELVIN_RANGE).toEqual([2000, 10000]);
  });

  it('maps slider position 0 to 2000K and position 1 to 10000K', () => {
    expect(sliderToWhiteBalanceKelvin(0)).toBe(2000);
    expect(sliderToWhiteBalanceKelvin(1)).toBe(10000);
  });

  it('round-trips a midpoint value', () => {
    const kelvin = sliderToWhiteBalanceKelvin(0.5);
    expect(whiteBalanceKelvinToSlider(kelvin)).toBeCloseTo(0.5, 2);
  });

  it('clamps out-of-range values when converting back to a slider position', () => {
    expect(whiteBalanceKelvinToSlider(100)).toBe(0);
    expect(whiteBalanceKelvinToSlider(50000)).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest exposureMapping`
Expected: FAIL — `Cannot find module '../exposureMapping'` (the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `modules/camera/exposureMapping.ts`:

```ts
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function logSliderToValue(position: number, min: number, max: number): number {
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  return Math.exp(logMin + position * (logMax - logMin));
}

function valueToLogSlider(value: number, min: number, max: number): number {
  const clamped = clamp(value, min, max);
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  return (Math.log(clamped) - logMin) / (logMax - logMin);
}

export function sliderToIso(position: number, isoRange: [number, number]): number {
  return Math.round(logSliderToValue(position, isoRange[0], isoRange[1]));
}

export function isoToSlider(iso: number, isoRange: [number, number]): number {
  return valueToLogSlider(iso, isoRange[0], isoRange[1]);
}

export function sliderToShutterSpeedNs(position: number, exposureTimeRangeNs: [number, number]): number {
  return Math.round(logSliderToValue(position, exposureTimeRangeNs[0], exposureTimeRangeNs[1]));
}

export function shutterSpeedNsToSlider(shutterSpeedNs: number, exposureTimeRangeNs: [number, number]): number {
  return valueToLogSlider(shutterSpeedNs, exposureTimeRangeNs[0], exposureTimeRangeNs[1]);
}

export const WHITE_BALANCE_KELVIN_RANGE: [number, number] = [2000, 10000];

export function sliderToWhiteBalanceKelvin(position: number): number {
  const [min, max] = WHITE_BALANCE_KELVIN_RANGE;
  return Math.round(min + position * (max - min));
}

export function whiteBalanceKelvinToSlider(kelvin: number): number {
  const [min, max] = WHITE_BALANCE_KELVIN_RANGE;
  const clamped = clamp(kelvin, min, max);
  return (clamped - min) / (max - min);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest exposureMapping`
Expected: PASS, all 12 tests.

- [ ] **Step 5: Commit**

```bash
git add modules/camera/exposureMapping.ts modules/camera/__tests__/exposureMapping.test.ts
git commit -m "test(camera): add exposureMapping slider/device-value conversion with unit tests"
```

---

### Task 3: Data layer — `modules/projects/api.ts`

**Files:**
- Modify: `modules/projects/api.ts`

**Interfaces:**
- Consumes: `ManualExposureOptions` from `jotter-camera`.
- Produces (for Task 5, 6, and 8):
  - `createProject(input: { ...existing fields..., cameraSettings: ManualExposureOptions })`
  - `fetchProjectCameraSettings(projectId: string): Promise<ManualExposureOptions | null>` — `null` means the project has no calibration recorded (only possible for a project that predates this feature; every project created going forward always has one).
  - `updateProjectCameraSettings(projectId: string, settings: ManualExposureOptions): Promise<void>`

`camera_iso` (integer) and `camera_shutter_speed_ns` (bigint) map directly. `camera_white_balance` is a `text` column — store the Kelvin integer as a string (`String(kelvin)`), parse back with `Number(...)`.

- [ ] **Step 1: Add the import and extend `createProject`'s input type**

In `modules/projects/api.ts`, add to the top imports:

```ts
import type { ManualExposureOptions } from 'jotter-camera';
```

Change the `createProject` function signature (currently around line 29):

```ts
export async function createProject(input: {
  name: string;
  color: string;
  fields: NewFieldInput[];
  captureMode: CaptureMode;
  captureSlots: CaptureSlotInput[];
  cameraSettings: ManualExposureOptions;
}): Promise<string> {
```

- [ ] **Step 2: Include camera settings in the insert**

Change the insert call inside `createProject` (currently around line 41):

```ts
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      name: input.name,
      color: input.color,
      capture_mode: input.captureMode,
      owner_id: user.id,
      camera_iso: input.cameraSettings.iso,
      camera_shutter_speed_ns: input.cameraSettings.shutterSpeedNs,
      camera_white_balance: String(input.cameraSettings.whiteBalanceKelvin),
    })
    .select('id')
    .single();
  if (projectError) throw projectError;
```

- [ ] **Step 3: Add `fetchProjectCameraSettings` and `updateProjectCameraSettings`**

Append to `modules/projects/api.ts`:

```ts
export async function fetchProjectCameraSettings(projectId: string): Promise<ManualExposureOptions | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('camera_iso, camera_shutter_speed_ns, camera_white_balance')
    .eq('id', projectId)
    .single();
  if (error) throw error;
  if (data.camera_iso == null || data.camera_shutter_speed_ns == null || data.camera_white_balance == null) {
    return null;
  }
  return {
    iso: data.camera_iso,
    shutterSpeedNs: data.camera_shutter_speed_ns,
    whiteBalanceKelvin: Number(data.camera_white_balance),
  };
}

export async function updateProjectCameraSettings(projectId: string, settings: ManualExposureOptions): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({
      camera_iso: settings.iso,
      camera_shutter_speed_ns: settings.shutterSpeedNs,
      camera_white_balance: String(settings.whiteBalanceKelvin),
    })
    .eq('id', projectId);
  if (error) throw error;
}
```

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: fails only on `CreateProjectScreen.tsx`'s existing `createProject(...)` call site missing the new required `cameraSettings` field (that call site is fixed in Task 5) — no other errors. If there are other, unrelated errors, stop and investigate before proceeding.

- [ ] **Step 5: Commit**

```bash
git add modules/projects/api.ts
git commit -m "feat(projects): persist and read back camera calibration settings"
```

---

### Task 4: `CameraCalibrationScreen` component

**Files:**
- Create: `modules/camera/CameraCalibrationScreen.tsx`
- Modify: `package.json` (new dependency)

**Interfaces:**
- Consumes: `JotterCameraView`, `JotterCameraViewHandle`, `CameraCapabilities`, `ManualExposureOptions` from `jotter-camera`; the six functions + constant from Task 2's `./exposureMapping`.
- Produces (for Task 5 and Task 6):

```ts
type Props = {
  initialSettings?: ManualExposureOptions | null; // omit or null for first-time calibration
  onConfirm: (settings: ManualExposureOptions) => void;
  onCancel: () => void;
};
export default function CameraCalibrationScreen(props: Props): JSX.Element;
```

No Supabase/data-layer imports in this file — it's pure UI/hardware, matching `modules/camera/CLAUDE.md`'s existing rule for this module.

- [ ] **Step 1: Install the slider dependency**

Run: `npx expo install @react-native-community/slider`
Expected: added to `package.json` `dependencies` at an SDK-56-compatible version.

- [ ] **Step 2: Create the component**

Create `modules/camera/CameraCalibrationScreen.tsx`:

```tsx
import Slider from '@react-native-community/slider';
import { JotterCameraView } from 'jotter-camera';
import type { CameraCapabilities, JotterCameraViewHandle, ManualExposureOptions } from 'jotter-camera';
import { useRef, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import {
  isoToSlider,
  shutterSpeedNsToSlider,
  sliderToIso,
  sliderToShutterSpeedNs,
  sliderToWhiteBalanceKelvin,
  whiteBalanceKelvinToSlider,
} from './exposureMapping';

type Props = {
  initialSettings?: ManualExposureOptions | null;
  onConfirm: (settings: ManualExposureOptions) => void;
  onCancel: () => void;
};

type SliderPositions = {
  isoPosition: number;
  shutterPosition: number;
  whiteBalancePosition: number;
};

const DEFAULT_POSITIONS: SliderPositions = {
  isoPosition: 0.3,
  shutterPosition: 0.45,
  whiteBalancePosition: 0.44, // ~5500K within the fixed 2000-10000K range
};

const DEBOUNCE_MS = 150;

export default function CameraCalibrationScreen({ initialSettings, onConfirm, onCancel }: Props) {
  const cameraRef = useRef<JotterCameraViewHandle>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [capabilities, setCapabilities] = useState<CameraCapabilities | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const [positions, setPositions] = useState<SliderPositions>(DEFAULT_POSITIONS);

  function settingsFromPositions(next: SliderPositions, caps: CameraCapabilities): ManualExposureOptions {
    return {
      iso: sliderToIso(next.isoPosition, caps.isoRange),
      shutterSpeedNs: sliderToShutterSpeedNs(next.shutterPosition, caps.exposureTimeRangeNs),
      whiteBalanceKelvin: sliderToWhiteBalanceKelvin(next.whiteBalancePosition),
    };
  }

  async function handleCameraReady() {
    setLoadError(false);
    try {
      const caps = await cameraRef.current?.getCapabilities();
      if (!caps) throw new Error('Camera not ready');
      setCapabilities(caps);

      const startPositions: SliderPositions = initialSettings
        ? {
            isoPosition: isoToSlider(initialSettings.iso, caps.isoRange),
            shutterPosition: shutterSpeedNsToSlider(initialSettings.shutterSpeedNs, caps.exposureTimeRangeNs),
            whiteBalancePosition: whiteBalanceKelvinToSlider(initialSettings.whiteBalanceKelvin),
          }
        : DEFAULT_POSITIONS;
      setPositions(startPositions);
      await cameraRef.current?.setManualExposure(settingsFromPositions(startPositions, caps));
    } catch {
      setLoadError(true);
    }
  }

  function applyPositions(next: SliderPositions) {
    if (!capabilities) return;
    cameraRef.current
      ?.setManualExposure(settingsFromPositions(next, capabilities))
      .then(() => setApplyError(null))
      .catch(() => setApplyError('Could not apply that setting.'));
  }

  function scheduleApply(next: SliderPositions) {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => applyPositions(next), DEBOUNCE_MS);
  }

  function handleConfirm() {
    if (!capabilities) return;
    onConfirm(settingsFromPositions(positions, capabilities));
  }

  function makeSliderHandlers(key: keyof SliderPositions) {
    return {
      onValueChange: (value: number) => {
        const next = { ...positions, [key]: value };
        setPositions(next);
        scheduleApply(next);
      },
      onSlidingComplete: (value: number) => {
        const next = { ...positions, [key]: value };
        setPositions(next);
        applyPositions(next);
      },
    };
  }

  return (
    <View className="flex-1 bg-canvas">
      <View className="border-b border-hairline px-6 py-3">
        <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-body-strong">
          Calibrate Camera
        </Text>
        <Text className="mt-1 font-inter-light text-sm text-body">
          Adjust until the preview looks right for your lighting.
        </Text>
      </View>

      <JotterCameraView ref={cameraRef} style={{ flex: 1 }} onCameraReady={handleCameraReady} />

      {loadError && (
        <View className="items-center border-t border-hairline px-6 py-4">
          <Text className="text-center font-inter-bold text-base text-destructive">
            Could not read camera capabilities.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Retry reading camera capabilities"
            activeOpacity={0.85}
            onPress={handleCameraReady}
            className="mt-3 h-12 items-center justify-center border-2 border-hairline-strong px-6"
          >
            <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-ink">Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loadError && !capabilities && (
        <View className="items-center py-6">
          <ActivityIndicator size="large" color="#10b981" />
        </View>
      )}

      {!loadError && capabilities && (
        <View className="border-t border-hairline px-6 py-4">
          {applyError && <Text className="mb-2 font-inter text-sm text-destructive">{applyError}</Text>}

          <Text className="font-inter-bold text-base text-body-strong">Brightness</Text>
          <Slider
            accessibilityLabel="Brightness"
            minimumValue={0}
            maximumValue={1}
            value={positions.isoPosition}
            minimumTrackTintColor="#10b981"
            maximumTrackTintColor="#3a3a3a"
            {...makeSliderHandlers('isoPosition')}
          />

          <Text className="mt-4 font-inter-bold text-base text-body-strong">Exposure Time</Text>
          <Slider
            accessibilityLabel="Exposure Time"
            minimumValue={0}
            maximumValue={1}
            value={positions.shutterPosition}
            minimumTrackTintColor="#10b981"
            maximumTrackTintColor="#3a3a3a"
            {...makeSliderHandlers('shutterPosition')}
          />

          <Text className="mt-4 font-inter-bold text-base text-body-strong">Color Warmth</Text>
          <Slider
            accessibilityLabel="Color Warmth"
            minimumValue={0}
            maximumValue={1}
            value={positions.whiteBalancePosition}
            minimumTrackTintColor="#10b981"
            maximumTrackTintColor="#3a3a3a"
            {...makeSliderHandlers('whiteBalancePosition')}
          />

          <View className="mt-6 flex-row gap-3">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Cancel calibration"
              activeOpacity={0.7}
              onPress={onCancel}
              className="h-[56px] flex-1 items-center justify-center border-2 border-hairline-strong"
            >
              <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-ink">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Confirm calibration"
              activeOpacity={0.85}
              onPress={handleConfirm}
              className="h-[56px] flex-1 items-center justify-center bg-primary"
            >
              <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-primary-on">
                Confirm
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by this file (the pre-existing `CreateProjectScreen.tsx` error from Task 3 is still expected until Task 5).

- [ ] **Step 4: Commit**

```bash
git add modules/camera/CameraCalibrationScreen.tsx package.json package-lock.json
git commit -m "feat(camera): add CameraCalibrationScreen live-preview slider UI"
```

---

### Task 5: `CreateProjectScreen.tsx` — mandatory calibration

**Files:**
- Modify: `modules/projects/CreateProjectScreen.tsx`

**Interfaces:**
- Consumes: `CameraCalibrationScreen` (Task 4), `createProject` (Task 3, now requiring `cameraSettings`), `ManualExposureOptions` from `jotter-camera`.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Add imports and state**

In `modules/projects/CreateProjectScreen.tsx`, change the `react-native` import (currently line 4) to include `Modal`:

```tsx
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
```

Add new imports after the existing ones (after the current line 13):

```tsx
import CameraCalibrationScreen from '../camera/CameraCalibrationScreen';
import type { ManualExposureOptions } from 'jotter-camera';
```

Add new state after the existing `captureSlots`/slot-draft state (after the current line 44):

```tsx
  const [cameraSettings, setCameraSettings] = useState<ManualExposureOptions | null>(null);
  const [calibrationOpen, setCalibrationOpen] = useState(false);
```

- [ ] **Step 2: Add the guard in `handleCreate`**

In `handleCreate` (currently starting at line 68), add this check right after the existing `captureMode === 'multi'` slot check and before `setSaving(true)`:

```tsx
    if (!cameraSettings) {
      Alert.alert('Camera not calibrated', 'Calibrate the camera before creating this project.');
      return;
    }
```

Update the `createProject` call in the same function to pass it through:

```tsx
      const projectId = await createProject({
        name: name.trim(),
        color,
        fields,
        captureMode,
        captureSlots,
        cameraSettings,
      });
```

- [ ] **Step 3: Add the Camera section to the form**

Insert a new section between the existing "Photos per sample" block (which currently ends right before the "Fields" section, i.e. right after the closing `)}` that follows the multi-mode slot-builder `View`, before the `<View className="mt-8 flex-row items-center justify-between">` Fields header) and the "Fields" section:

```tsx
        <Text className="mt-8 font-inter-bold text-base text-body-strong">Camera</Text>
        <Text className="mt-2 font-inter-light text-base text-body">
          {cameraSettings
            ? 'Camera calibrated ✓'
            : 'Lock exposure so every photo in this project matches.'}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={cameraSettings ? 'Recalibrate camera' : 'Calibrate camera'}
          activeOpacity={0.7}
          onPress={() => setCalibrationOpen(true)}
          className="mt-3 h-12 items-center justify-center border-2 border-hairline-strong px-6"
        >
          <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-ink">
            {cameraSettings ? 'Recalibrate' : 'Calibrate Camera'}
          </Text>
        </TouchableOpacity>
```

(Note: this replaces the section header pattern used by "Fields" — `mt-8` on the `Text` itself here since there's no button on the same row as the header, unlike Fields' header+button row.)

- [ ] **Step 4: Add the calibration Modal**

Add this alongside the existing `<AddFieldModal .../>` at the bottom of the component (before the closing `</SafeAreaView>`):

```tsx
      <Modal visible={calibrationOpen} animationType="slide" onRequestClose={() => setCalibrationOpen(false)}>
        <CameraCalibrationScreen
          initialSettings={cameraSettings}
          onConfirm={(settings) => {
            setCameraSettings(settings);
            setCalibrationOpen(false);
          }}
          onCancel={() => setCalibrationOpen(false)}
        />
      </Modal>
```

- [ ] **Step 5: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add modules/projects/CreateProjectScreen.tsx
git commit -m "feat(projects): make camera calibration mandatory at project creation"
```

---

### Task 6: `ProjectSettingsScreen.tsx` — recalibration + design-system migration

**Files:**
- Modify: `modules/projects/ProjectSettingsScreen.tsx`

**Interfaces:**
- Consumes: `CameraCalibrationScreen` (Task 4), `fetchProjectCameraSettings`/`updateProjectCameraSettings` (Task 3), `ManualExposureOptions` from `jotter-camera`.
- Produces: nothing new for later tasks.

This file currently predates the dark design system (`bg-white`, `text-slate-900`, `border-red-300`, `text-red-600`, `rounded-xl`). Since this task touches it, it's fully rewritten below to match `DESIGN.md` (per `modules/CLAUDE.md`'s "migrating one is in scope whenever you touch it" rule) — matching the header pattern already used in `CreateProjectScreen.tsx` and the `button-destructive` spec (transparent background, 2px `destructive`-tinted border, `destructive` label, sharp corners).

- [ ] **Step 1: Replace the full file**

Replace the entire contents of `modules/projects/ProjectSettingsScreen.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ManualExposureOptions } from 'jotter-camera';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deleteProject, fetchProjectCameraSettings, updateProjectCameraSettings } from './api';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import CameraCalibrationScreen from '../camera/CameraCalibrationScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectSettings'>;

export default function ProjectSettingsScreen({ route, navigation }: Props) {
  const { projectId, projectName } = route.params;
  const [deleting, setDeleting] = useState(false);

  const [cameraSettings, setCameraSettings] = useState<ManualExposureOptions | null>(null);
  const [loadingCamera, setLoadingCamera] = useState(true);
  const [calibrationOpen, setCalibrationOpen] = useState(false);

  useEffect(() => {
    fetchProjectCameraSettings(projectId)
      .then(setCameraSettings)
      .catch(() => setCameraSettings(null))
      .finally(() => setLoadingCamera(false));
  }, [projectId]);

  async function handleRecalibrate(settings: ManualExposureOptions) {
    try {
      await updateProjectCameraSettings(projectId, settings);
      setCameraSettings(settings);
      setCalibrationOpen(false);
    } catch (err) {
      Alert.alert('Could not save camera settings', err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  function handleDelete() {
    Alert.alert(
      'Delete this project?',
      `"${projectName}" and everything in it — fields, categories, and any samples — will be permanently deleted. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteProject(projectId);
              navigation.replace('Main');
            } catch (err) {
              setDeleting(false);
              Alert.alert('Could not delete project', err instanceof Error ? err.message : 'Something went wrong.');
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas px-6 pt-6">
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Back"
        activeOpacity={0.7}
        onPress={() => navigation.goBack()}
        className="h-12 w-12 items-center justify-center rounded-full"
      >
        <Ionicons name="arrow-back" size={24} color="#ffffff" />
      </TouchableOpacity>

      <Text className="mt-2 font-inter-black text-[26px] uppercase leading-[1.1] tracking-[0.2px] text-ink">
        {projectName}
      </Text>
      <Text className="mt-1 font-inter-light text-base text-body">Project settings</Text>

      <View className="mt-8">
        <Text className="font-inter-bold text-base text-body-strong">Camera</Text>
        {loadingCamera ? (
          <ActivityIndicator className="mt-3 self-start" color="#10b981" />
        ) : (
          <>
            <Text className="mt-2 font-inter-light text-base text-body">
              {cameraSettings ? 'Camera calibrated ✓' : 'Not calibrated yet'}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={cameraSettings ? 'Recalibrate camera' : 'Calibrate camera'}
              activeOpacity={0.7}
              onPress={() => setCalibrationOpen(true)}
              className="mt-3 h-12 items-center justify-center border-2 border-hairline-strong px-6"
            >
              <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-ink">
                {cameraSettings ? 'Recalibrate Camera' : 'Calibrate Camera'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Delete project"
        activeOpacity={0.7}
        onPress={handleDelete}
        disabled={deleting}
        className="mt-8 h-12 items-center justify-center border-2 border-destructive px-6"
      >
        {deleting ? (
          <ActivityIndicator color="#ef4444" />
        ) : (
          <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-destructive">
            Delete Project
          </Text>
        )}
      </TouchableOpacity>

      <Modal visible={calibrationOpen} animationType="slide" onRequestClose={() => setCalibrationOpen(false)}>
        <CameraCalibrationScreen
          initialSettings={cameraSettings}
          onConfirm={handleRecalibrate}
          onCancel={() => setCalibrationOpen(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add modules/projects/ProjectSettingsScreen.tsx
git commit -m "feat(projects): add camera recalibration to Project Settings"
```

---

### Task 7: `CameraCaptureStep.tsx` rewrite

**Files:**
- Modify: `modules/camera/CameraCaptureStep.tsx`

**Interfaces:**
- Consumes: `JotterCameraView`, `JotterCameraViewHandle`, `ManualExposureOptions` from `jotter-camera`.
- Produces (for Task 8):

```ts
type Props = {
  label: string;
  cameraSettings: ManualExposureOptions | null;
  onCapture: (localUri: string) => void;
};
```

`cameraSettings` is nullable: if `null` (only possible for a pre-existing project that predates this feature), the component skips locking exposure and the camera runs under CameraX's default binding rather than crashing. If settings are provided but fail to apply, this is a real problem for data consistency — the component blocks capture and shows a retry, rather than silently taking an unlocked photo.

- [ ] **Step 1: Replace the full file**

Replace the entire contents of `modules/camera/CameraCaptureStep.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useCameraPermissions } from 'expo-camera';
import { JotterCameraView } from 'jotter-camera';
import type { JotterCameraViewHandle, ManualExposureOptions } from 'jotter-camera';
import { useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

type Props = {
  label: string;
  cameraSettings: ManualExposureOptions | null;
  onCapture: (localUri: string) => void;
};

export default function CameraCaptureStep({ label, cameraSettings, onCapture }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [exposureError, setExposureError] = useState(false);
  const cameraRef = useRef<JotterCameraViewHandle>(null);

  if (!permission) {
    return <View className="flex-1 bg-canvas" />;
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas px-6">
        <Text className="text-center font-inter-bold text-base text-body-strong">
          Jotter needs camera access to capture photos.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Grant camera permission"
          activeOpacity={0.85}
          onPress={requestPermission}
          className="mt-6 h-[56px] w-full items-center justify-center bg-primary"
        >
          <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-primary-on">
            Grant Permission
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function handleCameraReady() {
    setReady(true);
    if (!cameraSettings) return;
    try {
      await cameraRef.current?.setManualExposure(cameraSettings);
      setExposureError(false);
    } catch {
      setExposureError(true);
    }
  }

  async function handleShutter() {
    if (!cameraRef.current || !ready || capturing || exposureError) return;
    setCapturing(true);
    try {
      const result = await cameraRef.current.takePicture();
      onCapture(result.uri);
    } finally {
      setCapturing(false);
    }
  }

  return (
    <View className="flex-1 bg-canvas">
      <JotterCameraView ref={cameraRef} style={{ flex: 1 }} onCameraReady={handleCameraReady} />

      {exposureError && (
        <View className="items-center border-t border-hairline px-6 py-4">
          <Text className="text-center font-inter-bold text-base text-destructive">
            Could not lock camera settings for this project.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Retry applying camera settings"
            activeOpacity={0.85}
            onPress={handleCameraReady}
            className="mt-3 h-12 items-center justify-center border-2 border-hairline-strong px-6"
          >
            <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-ink">Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!exposureError && (
        <View className="items-center border-t border-hairline px-6 py-6">
          <Text className="mb-4 font-inter-bold text-base text-body-strong">{label}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Take photo — ${label}`}
            activeOpacity={0.85}
            disabled={!ready || capturing}
            onPress={handleShutter}
            className={`h-20 w-20 items-center justify-center rounded-full border-4 border-hairline-strong ${
              capturing ? 'bg-surface-elevated' : 'bg-primary'
            }`}
          >
            <Ionicons name="camera" size={28} color={capturing ? '#7a7a7a' : '#03140d'} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: fails only on the two existing call sites of `<CameraCaptureStep>` (`CaptureScreen.tsx` and `SampleForm.tsx`) missing the new required `cameraSettings` prop — fixed in Task 8. No other errors.

- [ ] **Step 3: Commit**

```bash
git add modules/camera/CameraCaptureStep.tsx
git commit -m "feat(camera): rewrite CameraCaptureStep to shoot with locked exposure"
```

---

### Task 8: Wire `CaptureScreen.tsx` and `SampleForm.tsx`

**Files:**
- Modify: `modules/capture/CaptureScreen.tsx`
- Modify: `modules/samples/SampleForm.tsx`

**Interfaces:**
- Consumes: `fetchProjectCameraSettings` (Task 3), `CameraCaptureStep`'s new `cameraSettings` prop (Task 7).
- Produces: nothing new for later tasks — this is the last integration point.

- [ ] **Step 1: Fetch camera settings in `CaptureScreen.tsx`**

In `modules/capture/CaptureScreen.tsx`, add to the imports (after the existing `fetchCaptureSlots` import on line 6):

```tsx
import { fetchProjectCameraSettings } from '../projects/api';
import type { ManualExposureOptions } from 'jotter-camera';
```

Add new state after the existing `loadError` state (currently line 26):

```tsx
  const [cameraSettings, setCameraSettings] = useState<ManualExposureOptions | null>(null);
```

Change the `load` callback (currently lines 32-43) to fetch camera settings alongside slots and fields:

```tsx
  const load = useCallback(() => {
    setLoadError(false);
    Promise.all([fetchCaptureSlots(projectId), fetchFields(projectId), fetchProjectCameraSettings(projectId)])
      .then(([loadedSlots, loadedFields, loadedCameraSettings]) => {
        setSlots(loadedSlots);
        setFields(loadedFields);
        setCameraSettings(loadedCameraSettings);
        setSlotIndex(0);
        setPhotos([]);
        setStep(loadedSlots[0]?.target_angle_degrees != null ? 'angle-assist' : 'camera');
      })
      .catch(() => setLoadError(true));
  }, [projectId]);
```

- [ ] **Step 2: Pass `cameraSettings` to both `CameraCaptureStep` and `SampleForm`**

Change the direct `CameraCaptureStep` usage (currently line 119):

```tsx
        <CameraCaptureStep label={currentSlot.label} cameraSettings={cameraSettings} onCapture={handleAdvanceSlot} />
```

Change the `SampleForm` usage (currently line 126):

```tsx
      <SampleForm
        projectId={projectId}
        fields={fields}
        cameraSettings={cameraSettings}
        saving={step === 'saving'}
        onSave={handleSaveSample}
      />
```

- [ ] **Step 3: Thread `cameraSettings` through `SampleForm.tsx`**

In `modules/samples/SampleForm.tsx`, add the import (alongside the existing `ProjectField` import on line 6):

```tsx
import type { ManualExposureOptions } from 'jotter-camera';
```

Change the `Props` type (currently lines 13-18):

```tsx
type Props = {
  projectId: string;
  fields: ProjectField[];
  cameraSettings: ManualExposureOptions | null;
  saving: boolean;
  onSave: (values: NewSampleValue[]) => void;
};
```

Change the function signature (currently line 20):

```tsx
export default function SampleForm({ projectId, fields, cameraSettings, saving, onSave }: Props) {
```

Change the `CameraCaptureStep` usage inside the `Modal` (currently lines 217-227):

```tsx
      <Modal visible={photoFieldOpen !== null} animationType="slide" onRequestClose={() => setPhotoFieldOpen(null)}>
        {photoFieldOpen && (
          <CameraCaptureStep
            label={photoFieldOpen.name}
            cameraSettings={cameraSettings}
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
Expected: no errors — this resolves the last two dangling call-site errors from Tasks 3 and 7.

- [ ] **Step 5: Commit**

```bash
git add modules/capture/CaptureScreen.tsx modules/samples/SampleForm.tsx
git commit -m "feat(capture): thread project camera settings into capture and sample-photo flows"
```

---

### Task 9: On-device verification + docs updates + cleanup

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/current-task.md`
- Modify: `modules/projects/CLAUDE.md`
- Modify: `modules/camera/CLAUDE.md`

**Interfaces:**
- Consumes: everything from Tasks 1-8, fully wired.
- Produces: nothing — this is the plan's terminal task.

- [ ] **Step 1: Full test suite + typecheck**

Run: `npx jest`
Expected: PASS (the 12 `exposureMapping` tests from Task 2, no regressions).

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Build and install on-device**

Run: `npx expo run:android`
Expected: builds successfully and launches on the connected physical device (the same Xiaomi 2311DRK48G used for the native module's own on-device pass).

- [ ] **Step 3: Manual test matrix**

On-device, in order:

1. Go to create a new project. Confirm "Create Project" shows the `Alert` ("Camera not calibrated") and refuses to proceed if you try to submit before calibrating.
2. Tap "Calibrate Camera". Confirm the live preview renders and each of the three sliders (Brightness, Exposure Time, Color Warmth) visibly changes the preview as you drag it — brightness/exposure change should be visible within ~150ms of releasing or pausing the drag, not instant on every pixel of motion.
3. Confirm, then finish creating a multi-mode project with at least 2 capture slots.
4. Check the created project's row directly (e.g. via `npx supabase db` or the Supabase dashboard): confirm `camera_iso`, `camera_shutter_speed_ns`, and `camera_white_balance` are non-null and match what was chosen.
5. Open Capture and shoot through all slots for one sample. Confirm no "Auto exposure — placeholder" banner appears anywhere, and confirm the resulting photos look consistently exposed/colored with each other (comparable brightness and color cast across every slot's photo).
6. Add a `photo`-data-type field to the project's Fields tab (via Edit mode), then in the Capture flow's logging form, tap that field's "Take Photo" button. Confirm the same locked settings apply there too (compare its brightness/color cast against the slot photos from Step 5 — should match).
7. Open Project Settings for this project. Confirm the Camera section shows "Camera calibrated ✓" and a "Recalibrate Camera" button. Tap it, change at least one slider meaningfully, confirm. Re-check the DB row — confirm it updated to the new values.
8. Shoot one more slot photo after recalibrating in Step 7. Confirm it visibly reflects the new settings (not the original ones from Step 2).

If any step fails, fix the relevant task's code before proceeding — do not defer known-broken behavior past this task.

- [ ] **Step 4: Update `docs/architecture.md`**

Find the line (`docs/architecture.md:142`) that currently reads:

```
Camera calibration (locked ISO/shutter/white-balance/resolution/target-angle) is deliberately **not** part of initial project creation — it's set up later, whenever Capture is first opened for that project, to keep the creation screen focused.
```

Replace it with:

```
Camera calibration (locked ISO/shutter/white-balance) is a mandatory step of project creation — `CreateProjectScreen` blocks "Create Project" until it's completed, so every project has consistent locked exposure from its very first capture. `ProjectSettingsScreen` offers a "Recalibrate Camera" option to change it later. Resolution and target-angle calibration are not part of this — resolution has no native-module support yet, and target angle is configured per capture slot, not per project.
```

- [ ] **Step 5: Replace `docs/current-task.md`'s content**

Per that file's own stated convention, replace its entire content with:

```markdown
# Current Task

**Camera calibration + capture integration — built and verified on-device.**

Wires the native camera module (`modules/jotter-camera/`) into the real app: a mandatory calibration screen at project creation, a recalibration entry in project settings, and a `CameraCaptureStep` rewrite that shoots with a project's locked settings. Scoped per `docs/superpowers/specs/2026-07-29-camera-calibration-integration-design.md`: ISO/shutter/white-balance only — no resolution calibration (native module has no API for it yet).

- `modules/camera/CameraCalibrationScreen.tsx` — live `JotterCameraView` preview with three sliders (Brightness/Exposure Time/Color Warmth), log-scale for ISO/shutter, linear for white balance, mapped via `modules/camera/exposureMapping.ts` (unit tested). Debounced live updates (~150ms) so dragging doesn't spam the native camera rebind.
- `modules/projects/CreateProjectScreen.tsx` — calibration is now a mandatory section; "Create Project" is blocked with an `Alert` until it's completed. Chosen settings ride along in the same `createProject()` insert as name/color/capture mode.
- `modules/projects/ProjectSettingsScreen.tsx` — migrated off the old light-mode Tailwind classes to the dark "Calibration Bench" design system while adding a "Recalibrate Camera" section, which persists changes immediately via `updateProjectCameraSettings`.
- `modules/camera/CameraCaptureStep.tsx` — now renders `JotterCameraView` instead of `expo-camera`'s auto-exposure `CameraView`; applies a project's locked settings on ready. The "Auto exposure — placeholder" banner is gone. If settings fail to apply, capture is blocked with a retry rather than silently taking an unlocked, inconsistent photo.
- `modules/projects/api.ts` — added `fetchProjectCameraSettings`/`updateProjectCameraSettings`; extended `createProject` to require `cameraSettings`.
- `modules/capture/CaptureScreen.tsx` / `modules/samples/SampleForm.tsx` — fetch a project's camera settings once and thread them to every `CameraCaptureStep` instance (both the per-slot capture and the `photo`-field capture in the logging form), so every photo in a sample uses identical locked exposure.

**On-device test matrix — all passed:** project creation blocks on missing calibration; live-preview sliders visibly change brightness/exposure/color cast; a created project's `camera_iso`/`camera_shutter_speed_ns`/`camera_white_balance` columns are non-null and match the chosen values; a full capture sequence across multiple slots produces consistently exposed/colored photos with no placeholder banner; a `photo`-field capture in the logging form uses the same locked settings; recalibrating via Project Settings updates the DB and is reflected in the next capture.

**Not yet done / acceptance criteria before calling the *camera feature* (not just this module) finished:**
- Resolution calibration — the native module has no capture-resolution API yet; `camera_resolution_width`/`camera_resolution_height` stay unused.
- The moisture-reading (or any) required-field UI — `fields.is_required` toggle in the Fields/Add Field modal (build order step 5b) is still unbuilt, so no field can actually be marked required yet.
- iOS manual-exposure equivalent — the app is Android-only; not scoped anywhere.

**Known gaps, not blocking (carried over):**
- Writes still go straight to Supabase, bypassing the offline-first SQLite layer.
- Guest-to-OAuth/email identity linking is still not implemented.
- Dependent category fields — still deferred.

## Suggested build order (after this task)
1. ~~Navigation shell~~ / ~~Empty-state → project creation~~ / ~~Samples & capture modes~~ / ~~Project tabs + real Fields tab~~ / ~~Data-integrity schema~~ / ~~Native camera module~~ / ~~Camera calibration + capture integration~~ — done above.
2. Local SQLite schema + typed data-access layer — still overdue.
3. ~~Camera hardware capability spike~~ — done (device confirmed `LEVEL_3`).
4. Guest → registered upgrade flow via Supabase identity linking.
5. Dependent category fields.
5b. Fields tab / Add Field modal `is_required`/`is_sample_identifier` toggles.
6. ~~Camera calibration screen + `CameraCaptureStep.tsx`/`CaptureScreen.tsx` wiring~~ — done above.
7. ~~Camera calibration screen~~ — folded into 6 above.
8. ~~Real Data tab~~ — done; still owes CSV/zip export.
9. Supabase sync.
10. Project sharing.

When the user assigns the next concrete task, replace this file's content with that task's specific scope and acceptance criteria.
```

- [ ] **Step 6: Update `modules/projects/CLAUDE.md`**

Find the line:

```
- Project creation bundles name, color, capture mode (single/multi + capture slots), and initial fields into one screen. Camera calibration (ISO/shutter/white-balance/resolution/target-angle) is deliberately **not** part of this flow — it's configured later, the first time Capture is opened for that project. Don't add it here.
```

Replace it with:

```
- Project creation bundles name, color, capture mode (single/multi + capture slots), initial fields, and camera calibration into one screen — `createProject` will reject a missing `cameraSettings` at the type level, and `CreateProjectScreen` blocks submission with an `Alert` if calibration hasn't been done. `ProjectSettingsScreen` offers "Recalibrate Camera" to change it after creation.
```

- [ ] **Step 7: Update `modules/camera/CLAUDE.md`**

Replace the entire file with:

```
# modules/camera/

`CameraCaptureStep.tsx` — the camera hardware wrapper: permission request UI, `JotterCameraView` preview, shutter button, applies a project's locked exposure settings on ready. Pure UI/hardware, zero data-layer imports — reused by both `modules/capture/CaptureScreen.tsx` (slot photos) and `modules/samples/SampleForm.tsx` (`photo`-data-type field capture, via a `Modal`). Takes `cameraSettings: ManualExposureOptions | null` as a prop from its caller — never fetches it itself.

`CameraCalibrationScreen.tsx` — the live-preview, slider-based calibration UI (Brightness/Exposure Time/Color Warmth, mapped to real device ISO/shutter ranges via `exposureMapping.ts`, log-scale for ISO/shutter since both span multiple orders of magnitude). Also pure UI/hardware — takes `initialSettings`/`onConfirm`/`onCancel`, the caller (`CreateProjectScreen` or `ProjectSettingsScreen`) decides what to do with the confirmed settings (hold in local state vs. persist immediately).

`exposureMapping.ts` — pure slider-position ↔ device-value conversion functions, unit tested in `__tests__/exposureMapping.test.ts`. No React/native imports.

- If `cameraSettings` is `null` (only possible for a project that predates this feature), `CameraCaptureStep` skips locking exposure and the camera runs under CameraX's default binding rather than crashing. If settings are provided but fail to apply, capture is blocked with a retry rather than silently taking an unlocked photo — a locked-but-failed capture would silently corrupt cross-photo consistency, which is the entire point of this module.
- Only works on devices reporting Camera2 hardware level `LIMITED` or better — this is a hard hardware ceiling, not a software gap to work around.
- Android only — no `Platform.OS` branching anywhere in this module; the app has no iOS build target.
```

- [ ] **Step 8: Commit the docs updates**

```bash
git add docs/architecture.md docs/current-task.md modules/projects/CLAUDE.md modules/camera/CLAUDE.md
git commit -m "docs: mark camera calibration integration built and verified on-device"
```

Note: this task's on-device manual test matrix (Step 3) requires a human physically operating the test device — it cannot be completed by an isolated subagent with no device access. The controller session runs Step 2 and Step 3 directly with the user before dispatching (or itself writing) the docs-update steps above, then commits.
