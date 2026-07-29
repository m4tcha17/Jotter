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
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
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

          <Text className="mt-4 font-inter-bold text-base text-body-strong">Color Warmth</Text>
          <Slider
            accessibilityRole="adjustable"
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
