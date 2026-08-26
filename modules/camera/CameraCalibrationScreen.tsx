import Slider from '@react-native-community/slider';
import { useCameraPermissions } from 'expo-camera';
import { JotterCameraView } from 'jotter-camera';
import type { CameraCapabilities, JotterCameraViewHandle, ManualExposureOptions, WhiteBalancePreset } from 'jotter-camera';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isoToSlider, shutterSpeedNsToSlider, sliderToIso, sliderToShutterSpeedNs } from './exposureMapping';

type Props = {
  initialSettings?: ManualExposureOptions | null;
  onConfirm: (settings: ManualExposureOptions) => void;
  onCancel: () => void;
};

type SliderPositions = {
  isoPosition: number;
  shutterPosition: number;
};

// Exposure-correct beats low-noise: a crushed-dark frame flattens GLCM contrast/entropy and
// starves Canny of edges to find at all, which is worse for feature extraction than sensor noise.
// These values assume ambient/handheld light, not a fixed lightbox (none built yet) — once one
// exists, re-tune ISO down against its measured lux, since noise is the next thing that hurts
// GLCM/Canny once exposure itself is solid.
const DEFAULT_POSITIONS: SliderPositions = {
  isoPosition: 0.3,
  shutterPosition: 0.45,
};

// Ordered warm-to-cool, matching how the old Kelvin slider ran — daylight is a reasonable
// ambient/handheld default until a fixed lightbox exists to calibrate against.
const WHITE_BALANCE_PRESETS: { value: WhiteBalancePreset; label: string }[] = [
  { value: 'incandescent', label: 'Incandescent' },
  { value: 'warm_fluorescent', label: 'Warm Fluorescent' },
  { value: 'fluorescent', label: 'Fluorescent' },
  { value: 'daylight', label: 'Daylight' },
  { value: 'cloudy_daylight', label: 'Cloudy' },
  { value: 'twilight', label: 'Twilight' },
  { value: 'shade', label: 'Shade' },
];

const DEFAULT_WHITE_BALANCE_PRESET: WhiteBalancePreset = 'daylight';

const DEBOUNCE_MS = 150;

function CalibrationPanelSkeleton() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] });

  return (
    <View accessible accessibilityLabel="Loading camera calibration controls" className="border-t border-hairline px-6 py-4">
      {[0, 1, 2].map((row) => (
        <View key={row} className={row === 0 ? '' : 'mt-4'}>
          <Animated.View style={{ opacity }} className="h-4 w-32 bg-surface-elevated" />
          <Animated.View style={{ opacity }} className="mt-3 h-2 w-full bg-surface-elevated" />
        </View>
      ))}

      <View className="mt-6 flex-row gap-3">
        <Animated.View style={{ opacity }} className="h-[56px] flex-1 bg-surface-elevated" />
        <Animated.View style={{ opacity }} className="h-[56px] flex-1 bg-surface-elevated" />
      </View>
    </View>
  );
}

export default function CameraCalibrationScreen({ initialSettings, onConfirm, onCancel }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<JotterCameraViewHandle>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // setManualExposure rebinds the camera natively, which re-fires onCameraReady — this guards
  // against re-running initial setup (and re-triggering another rebind) in a feedback loop.
  const initializedRef = useRef(false);

  const [capabilities, setCapabilities] = useState<CameraCapabilities | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const [positions, setPositions] = useState<SliderPositions>(DEFAULT_POSITIONS);
  const [whiteBalancePreset, setWhiteBalancePreset] = useState<WhiteBalancePreset>(DEFAULT_WHITE_BALANCE_PRESET);

  function settingsFromState(
    next: SliderPositions,
    preset: WhiteBalancePreset,
    caps: CameraCapabilities,
  ): ManualExposureOptions {
    return {
      iso: sliderToIso(next.isoPosition, caps.isoRange),
      shutterSpeedNs: sliderToShutterSpeedNs(next.shutterPosition, caps.exposureTimeRangeNs),
      whiteBalancePreset: preset,
    };
  }

  async function handleCameraReady() {
    if (initializedRef.current) return;
    initializedRef.current = true;
    setLoadError(false);
    try {
      const rawCaps = await cameraRef.current?.getCapabilities();
      if (!rawCaps) throw new Error('Camera not ready');
      // Bridge boundary: native may be a build behind (Kotlin changes need a full rebuild, not
      // just a JS reload) or the device may legitimately report no matching AWB presets — either
      // way, default to an empty list rather than let a missing field crash calibration.
      const caps: CameraCapabilities = {
        ...rawCaps,
        availableWhiteBalancePresets: rawCaps.availableWhiteBalancePresets ?? [],
      };
      setCapabilities(caps);

      const startPositions: SliderPositions = initialSettings
        ? {
            isoPosition: isoToSlider(initialSettings.iso, caps.isoRange),
            shutterPosition: shutterSpeedNsToSlider(initialSettings.shutterSpeedNs, caps.exposureTimeRangeNs),
          }
        : DEFAULT_POSITIONS;
      // A stored preset from a previous device might not be in this device's supported list —
      // fall back to the default, or the first supported preset if even that isn't available.
      const startPreset: WhiteBalancePreset =
        initialSettings && caps.availableWhiteBalancePresets.includes(initialSettings.whiteBalancePreset)
          ? initialSettings.whiteBalancePreset
          : caps.availableWhiteBalancePresets.includes(DEFAULT_WHITE_BALANCE_PRESET)
            ? DEFAULT_WHITE_BALANCE_PRESET
            : (caps.availableWhiteBalancePresets[0] ?? DEFAULT_WHITE_BALANCE_PRESET);
      setPositions(startPositions);
      setWhiteBalancePreset(startPreset);
      await cameraRef.current?.setManualExposure(settingsFromState(startPositions, startPreset, caps));
    } catch {
      initializedRef.current = false;
      setLoadError(true);
    }
  }

  function applySettings(nextPositions: SliderPositions, nextPreset: WhiteBalancePreset) {
    if (!capabilities) return;
    cameraRef.current
      ?.setManualExposure(settingsFromState(nextPositions, nextPreset, capabilities))
      .then(() => setApplyError(null))
      .catch(() => setApplyError('Could not apply that setting.'));
  }

  function scheduleApply(nextPositions: SliderPositions, nextPreset: WhiteBalancePreset) {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => applySettings(nextPositions, nextPreset), DEBOUNCE_MS);
  }

  function handleConfirm() {
    if (!capabilities) return;
    onConfirm(settingsFromState(positions, whiteBalancePreset, capabilities));
  }

  function makeSliderHandlers(key: keyof SliderPositions) {
    return {
      onValueChange: (value: number) => {
        const next = { ...positions, [key]: value };
        setPositions(next);
        scheduleApply(next, whiteBalancePreset);
      },
      onSlidingComplete: (value: number) => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        const next = { ...positions, [key]: value };
        setPositions(next);
        applySettings(next, whiteBalancePreset);
      },
    };
  }

  function handleSelectWhiteBalance(preset: WhiteBalancePreset) {
    setWhiteBalancePreset(preset);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    applySettings(positions, preset);
  }

  if (!permission) {
    return <View className="flex-1 bg-canvas" />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 items-center justify-center bg-canvas px-6">
        <Text className="text-center font-inter-bold text-base text-body-strong">
          Jotter needs camera access to calibrate exposure.
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
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Cancel calibration"
          activeOpacity={0.7}
          onPress={onCancel}
          className="mt-3 h-12 items-center justify-center px-6"
        >
          <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-body">Cancel</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-canvas">
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

      {!loadError && !capabilities && <CalibrationPanelSkeleton />}

      {!loadError && capabilities && (
        <View className="border-t border-hairline px-6 py-4">
          {applyError && <Text className="mb-2 font-inter text-sm text-destructive">{applyError}</Text>}

          <Text className="font-inter-bold text-base text-body-strong">Brightness</Text>
          <Slider
            accessibilityRole="adjustable"
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
            accessibilityRole="adjustable"
            accessibilityLabel="Exposure Time"
            minimumValue={0}
            maximumValue={1}
            value={positions.shutterPosition}
            minimumTrackTintColor="#10b981"
            maximumTrackTintColor="#3a3a3a"
            {...makeSliderHandlers('shutterPosition')}
          />

          <Text className="mt-4 font-inter-bold text-base text-body-strong">White Balance</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {WHITE_BALANCE_PRESETS.filter(({ value }) => capabilities.availableWhiteBalancePresets.includes(value)).map(
              ({ value, label }) => (
                <TouchableOpacity
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={`White balance: ${label}`}
                  activeOpacity={0.7}
                  onPress={() => handleSelectWhiteBalance(value)}
                  className={`h-12 items-center justify-center border-2 px-4 ${
                    whiteBalancePreset === value ? 'border-primary bg-surface-elevated' : 'border-hairline-strong'
                  }`}
                >
                  <Text
                    className={`font-inter-bold text-[13px] uppercase tracking-[1.2px] ${
                      whiteBalancePreset === value ? 'text-primary' : 'text-body'
                    }`}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ),
            )}
          </View>

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
    </SafeAreaView>
  );
}
