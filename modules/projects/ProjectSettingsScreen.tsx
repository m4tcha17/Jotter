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
