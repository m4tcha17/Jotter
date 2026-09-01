import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchCaptureSlots } from './api';
import type { CaptureSlot } from './api';
import { fetchFields } from '../fields/api';
import type { ProjectField } from '../fields/api';
import { fetchProjectCameraSettings } from '../projects/api';
import type { ManualExposureOptions } from 'jotter-camera';
import { createSample } from '../samples/api';
import type { NewSamplePhoto, NewSampleValue } from '../samples/api';
import type { ProjectTabParamList } from '../../navigation/ProjectTabs';
import AngleAssistStep from './AngleAssistStep';
import CameraCaptureStep from '../camera/CameraCaptureStep';
import SampleForm from '../samples/SampleForm';

type Props = BottomTabScreenProps<ProjectTabParamList, 'Capture'>;

type Step = 'angle-assist' | 'camera' | 'form' | 'saving';

export default function CaptureScreen({ route }: Props) {
  const { projectId } = route.params;

  const [slots, setSlots] = useState<CaptureSlot[] | null>(null);
  const [fields, setFields] = useState<ProjectField[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [cameraSettings, setCameraSettings] = useState<ManualExposureOptions | null>(null);

  const [slotIndex, setSlotIndex] = useState(0);
  const [step, setStep] = useState<Step>('camera');
  const [photos, setPhotos] = useState<NewSamplePhoto[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);

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

  useEffect(() => {
    load();
  }, [load]);

  // Camera settings can change (recalibration) while this screen stays mounted in the tab
  // bar — refetch on every focus so a stale ISO/shutter/white-balance from an earlier
  // mount doesn't keep getting applied. Only cameraSettings refreshes here, never slots/
  // fields/slotIndex/photos/step, so an in-progress capture isn't reset by a tab switch.
  useFocusEffect(
    useCallback(() => {
      fetchProjectCameraSettings(projectId)
        .then(setCameraSettings)
        .catch(() => {});
    }, [projectId])
  );

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
    // The native camera view only mounts inside this Modal, opened on demand by the button
    // below — never embedded directly in this tab screen. Mounting it there wedged CameraX on
    // some devices (bottom-tab Fragment hosting never completes the camera session, unlike a
    // Modal's own window) every time this step re-rendered, with no way to recover short of
    // leaving the tab. The Modal mirrors SampleForm's photo-field capture, which works reliably.
    return (
      <View className="flex-1 bg-canvas">
        <CaptureHeader slotIndex={slotIndex} slotCount={slots.length} />
        <SafeAreaView edges={['bottom']} className="flex-1 items-center justify-center px-6">
          <Text className="mb-6 text-center font-inter-bold text-base text-body-strong">{currentSlot.label}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Take sample photo — ${currentSlot.label}`}
            activeOpacity={0.85}
            onPress={() => setCameraOpen(true)}
            className="h-[56px] w-full items-center justify-center bg-primary"
          >
            <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-primary-on">
              Take Sample
            </Text>
          </TouchableOpacity>
        </SafeAreaView>

        <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
          {cameraOpen && (
            <CameraCaptureStep
              label={currentSlot.label}
              cameraSettings={cameraSettings}
              onCapture={(uri) => {
                setCameraOpen(false);
                handleAdvanceSlot(uri);
              }}
            />
          )}
        </Modal>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['bottom']}>
      <SampleForm
        projectId={projectId}
        fields={fields}
        cameraSettings={cameraSettings}
        saving={step === 'saving'}
        onSave={handleSaveSample}
      />
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
