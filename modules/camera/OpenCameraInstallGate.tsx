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
