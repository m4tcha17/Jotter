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
