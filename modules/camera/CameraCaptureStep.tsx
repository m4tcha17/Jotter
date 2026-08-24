import { Ionicons } from '@expo/vector-icons';
import { useCameraPermissions } from 'expo-camera';
import { JotterCameraView } from 'jotter-camera';
import type { JotterCameraViewHandle, ManualExposureOptions } from 'jotter-camera';
import { useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  const [exposureConfirmed, setExposureConfirmed] = useState(false);
  const cameraRef = useRef<JotterCameraViewHandle>(null);
  // setManualExposure rebinds the camera natively, which re-fires onCameraReady — this guards
  // against re-applying exposure (and re-triggering another rebind) in a feedback loop.
  const exposureAppliedRef = useRef(false);

  if (!permission) {
    return <View className="flex-1 bg-canvas" />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 items-center justify-center bg-canvas px-6">
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
      </SafeAreaView>
    );
  }

  async function handleCameraReady() {
    setReady(true);
    if (!cameraSettings) {
      setExposureConfirmed(true);
      return;
    }
    if (exposureAppliedRef.current) return;
    exposureAppliedRef.current = true;
    setExposureConfirmed(false);
    try {
      await cameraRef.current?.setManualExposure(cameraSettings);
      setExposureError(false);
      setExposureConfirmed(true);
    } catch {
      exposureAppliedRef.current = false;
      setExposureError(true);
    }
  }

  async function handleShutter() {
    if (!cameraRef.current || !ready || !exposureConfirmed || capturing) return;
    setCapturing(true);
    try {
      const result = await cameraRef.current.takePicture();
      onCapture(result.uri);
    } finally {
      setCapturing(false);
    }
  }

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-canvas">
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
            disabled={!ready || !exposureConfirmed || capturing}
            onPress={handleShutter}
            className={`h-20 w-20 items-center justify-center rounded-full border-4 border-hairline-strong ${
              capturing ? 'bg-surface-elevated' : 'bg-primary'
            }`}
          >
            <Ionicons name="camera" size={28} color={capturing ? '#7a7a7a' : '#03140d'} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
