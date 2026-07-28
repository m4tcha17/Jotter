import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createSample, fetchCaptureSlots, fetchFields } from '../../lib/projects';
import type { CaptureSlot, NewSamplePhoto, NewSampleValue, ProjectField } from '../../lib/projects';
import type { ProjectTabParamList } from '../../navigation/ProjectTabs';
import AngleAssistStep from './AngleAssistStep';
import CameraCaptureStep from './CameraCaptureStep';
import SampleForm from './SampleForm';

type Props = BottomTabScreenProps<ProjectTabParamList, 'Capture'>;

type Step = 'angle-assist' | 'camera' | 'form' | 'saving';

export default function CaptureScreen({ route }: Props) {
  const { projectId } = route.params;

  const [slots, setSlots] = useState<CaptureSlot[] | null>(null);
  const [fields, setFields] = useState<ProjectField[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [slotIndex, setSlotIndex] = useState(0);
  const [step, setStep] = useState<Step>('camera');
  const [photos, setPhotos] = useState<NewSamplePhoto[]>([]);

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

  useEffect(() => {
    load();
  }, [load]);

  if (slots === null || fields === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={['bottom']}>
        {loadError ? (
          <>
            <Text className="font-inter-bold text-base text-body-strong">Could not load capture setup.</Text>
            <Text className="mt-2 font-inter-light text-sm text-body">Reopen the tab to try again.</Text>
          </>
        ) : (
          <ActivityIndicator size="large" color="#10b981" />
        )}
      </SafeAreaView>
    );
  }

  if (slots.length === 0) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={['bottom']}>
        <Text className="font-inter-black text-[26px] uppercase text-ink">Capture</Text>
        <Text className="mt-2 text-center font-inter-light text-base text-body">
          This project has no capture slots configured yet.
        </Text>
      </SafeAreaView>
    );
  }

  const currentSlot = slots[slotIndex];

  function handleAdvanceSlot(localUri: string) {
    const nextPhotos = [...photos, { captureSlotId: currentSlot.id, localUri }];
    setPhotos(nextPhotos);

    if (slotIndex + 1 < slots!.length) {
      const nextIndex = slotIndex + 1;
      setSlotIndex(nextIndex);
      setStep(slots![nextIndex].target_angle_degrees != null ? 'angle-assist' : 'camera');
    } else {
      setStep('form');
    }
  }

  async function handleSaveSample(values: NewSampleValue[]) {
    setStep('saving');
    try {
      await createSample(projectId, photos, values);
      Alert.alert('Sample Saved', 'Ready for the next one.');
      load();
    } catch (err) {
      setStep('form');
      Alert.alert('Could not save sample', err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  if (step === 'angle-assist' && currentSlot.target_angle_degrees != null) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['bottom']}>
        <CaptureHeader slotIndex={slotIndex} slotCount={slots.length} />
        <AngleAssistStep
          slotLabel={currentSlot.label}
          targetAngleDegrees={currentSlot.target_angle_degrees}
          onAligned={() => setStep('camera')}
        />
      </SafeAreaView>
    );
  }

  if (step === 'camera') {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['bottom']}>
        <CaptureHeader slotIndex={slotIndex} slotCount={slots.length} />
        <CameraCaptureStep label={currentSlot.label} onCapture={handleAdvanceSlot} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['bottom']}>
      <SampleForm projectId={projectId} fields={fields} saving={step === 'saving'} onSave={handleSaveSample} />
    </SafeAreaView>
  );
}

function CaptureHeader({ slotIndex, slotCount }: { slotIndex: number; slotCount: number }) {
  if (slotCount <= 1) return null;
  return (
    <View className="h-14 flex-row items-center justify-between border-b border-hairline px-6">
      <Text className="font-inter-bold text-[20px] text-ink">Capture</Text>
      <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-body">
        Slot {slotIndex + 1} of {slotCount}
      </Text>
    </View>
  );
}
