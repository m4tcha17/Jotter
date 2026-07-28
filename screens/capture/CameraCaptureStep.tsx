import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

type Props = {
  label: string;
  onCapture: (localUri: string) => void;
};

// Interim placeholder: expo-camera's stock API has no locked ISO/shutter/white-balance
// controls. This runs on auto exposure until the custom Camera2Interop native module ships.
export default function CameraCaptureStep({ label, onCapture }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

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

  async function handleShutter() {
    if (!cameraRef.current || !ready || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.92 });
      if (photo?.uri) onCapture(photo.uri);
    } finally {
      setCapturing(false);
    }
  }

  return (
    <View className="flex-1 bg-canvas">
      <View className="border-b border-hairline px-6 py-3">
        <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-calibration-amber">
          Auto exposure — placeholder
        </Text>
        <Text className="mt-1 font-inter-light text-sm text-body">
          Locked manual exposure ships with the native camera module.
        </Text>
      </View>

      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" onCameraReady={() => setReady(true)} />

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
    </View>
  );
}
