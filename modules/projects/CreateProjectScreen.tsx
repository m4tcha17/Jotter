import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AddFieldModal from '../fields/AddFieldModal';
import { DATA_TYPE_LABELS, fetchGlobalCategories } from '../fields/api';
import type { ExistingCategory, NewFieldInput } from '../fields/api';
import type { CaptureSlotInput } from '../capture/api';
import { createProject } from './api';
import type { CaptureMode } from './api';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import CameraCalibrationScreen from '../camera/CameraCalibrationScreen';
import type { ManualExposureOptions } from 'jotter-camera';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateProject'>;

const PRESET_COLORS = [
  '#10B981', // emerald
  '#3B82F6', // blue
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#14B8A6', // teal
  '#64748B', // slate
];

const INPUT_BASE = 'border-2 px-4 font-inter text-lg text-ink';

export default function CreateProjectScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [fields, setFields] = useState<NewFieldInput[]>([]);
  const [existingCategories, setExistingCategories] = useState<ExistingCategory[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const [captureMode, setCaptureMode] = useState<CaptureMode>('single');
  const [captureSlots, setCaptureSlots] = useState<CaptureSlotInput[]>([]);
  const [slotLabelDraft, setSlotLabelDraft] = useState('');
  const [slotLabelFocused, setSlotLabelFocused] = useState(false);
  const [slotAngleDraft, setSlotAngleDraft] = useState('');
  const [slotAngleFocused, setSlotAngleFocused] = useState(false);

  const [cameraSettings, setCameraSettings] = useState<ManualExposureOptions | null>(null);
  const [calibrationOpen, setCalibrationOpen] = useState(false);

  useEffect(() => {
    fetchGlobalCategories()
      .then(setExistingCategories)
      .catch(() => {});
  }, []);

  function handleAddSlot() {
    const label = slotLabelDraft.trim();
    if (!label) {
      Alert.alert('Missing slot name', 'Give this photo position a name (e.g. Top, Side 1).');
      return;
    }
    const angle = slotAngleDraft.trim() ? Number(slotAngleDraft.trim()) : undefined;
    if (slotAngleDraft.trim() && (angle === undefined || Number.isNaN(angle))) {
      Alert.alert('Invalid angle', 'Target angle must be a number, or left blank.');
      return;
    }
    setCaptureSlots([...captureSlots, { label, targetAngleDegrees: angle }]);
    setSlotLabelDraft('');
    setSlotAngleDraft('');
  }

  async function handleCreate() {
    if (!name.trim()) {
      Alert.alert('Missing project name', 'Give your project a name.');
      return;
    }
    if (captureMode === 'multi' && captureSlots.length === 0) {
      Alert.alert('Add capture slots', 'Multi Shot needs at least one photo position (e.g. Top, Side 1).');
      return;
    }
    if (!cameraSettings) {
      Alert.alert('Camera not calibrated', 'Calibrate the camera before creating this project.');
      return;
    }

    setSaving(true);
    try {
      const projectId = await createProject({
        name: name.trim(),
        color,
        fields,
        captureMode,
        captureSlots,
        cameraSettings,
      });
      Alert.alert('Project has been created', undefined, [
        { text: 'OK', onPress: () => navigation.replace('ProjectHome', { projectId, projectName: name.trim() }) },
      ]);
    } catch (err) {
      Alert.alert('Could not create project', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView className="flex-1 px-6 pt-6" keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back"
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
          className="h-12 w-12 items-center justify-center rounded-full"
        >
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>

        <Text className="mt-2 font-inter-black text-[32px] uppercase leading-[1.05] tracking-[0.2px] text-ink">
          New Project
        </Text>

        <Text className="mt-6 font-inter-bold text-base text-body-strong">Project name</Text>
        <TextInput
          accessibilityLabel="Project name"
          placeholder="e.g. Copra Moisture Survey"
          placeholderTextColor="#7a7a7a"
          value={name}
          onChangeText={setName}
          onFocus={() => setNameFocused(true)}
          onBlur={() => setNameFocused(false)}
          className={`mt-2 h-[56px] ${INPUT_BASE} ${nameFocused ? 'border-primary' : 'border-hairline-strong'}`}
        />

        <Text className="mt-6 font-inter-bold text-base text-body-strong">Color</Text>
        <View className="mt-2 flex-row flex-wrap gap-3">
          {PRESET_COLORS.map((preset) => (
            <TouchableOpacity
              key={preset}
              accessibilityRole="button"
              accessibilityLabel={`Color ${preset}`}
              activeOpacity={0.7}
              onPress={() => setColor(preset)}
              style={{ backgroundColor: preset }}
              className={`h-12 w-12 rounded-full ${color === preset ? 'border-[3px] border-ink' : 'border-2 border-hairline'}`}
            />
          ))}
        </View>

        <Text className="mt-6 font-inter-bold text-base text-body-strong">Photos per sample</Text>
        <View className="mt-2 flex-row gap-2">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Single Shot — one photo per sample"
            activeOpacity={0.7}
            onPress={() => setCaptureMode('single')}
            className={`h-12 flex-1 items-center justify-center border-2 ${
              captureMode === 'single' ? 'border-primary bg-surface-elevated' : 'border-hairline-strong'
            }`}
          >
            <Text
              className={`font-inter-bold text-[13px] uppercase tracking-[1.2px] ${
                captureMode === 'single' ? 'text-primary' : 'text-body'
              }`}
            >
              Single Shot
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Multi Shot — several photos per sample"
            activeOpacity={0.7}
            onPress={() => setCaptureMode('multi')}
            className={`h-12 flex-1 items-center justify-center border-2 ${
              captureMode === 'multi' ? 'border-primary bg-surface-elevated' : 'border-hairline-strong'
            }`}
          >
            <Text
              className={`font-inter-bold text-[13px] uppercase tracking-[1.2px] ${
                captureMode === 'multi' ? 'text-primary' : 'text-body'
              }`}
            >
              Multi Shot
            </Text>
          </TouchableOpacity>
        </View>

        {captureMode === 'single' ? (
          <Text className="mt-2 font-inter-light text-base text-body">One photo per sample, then the data form.</Text>
        ) : (
          <View className="mt-3">
            <Text className="font-inter-light text-base text-body">
              Define each photo position for one complete sample (e.g. Top, Bottom, Side 1-4).
            </Text>

            {captureSlots.length > 0 && (
              <View className="mt-3 bg-surface-card px-4">
                {captureSlots.map((slot, index) => (
                  <View
                    key={`${slot.label}-${index}`}
                    className={`flex-row items-center justify-between py-3 ${
                      index < captureSlots.length - 1 ? 'border-b border-hairline' : ''
                    }`}
                  >
                    <View>
                      <Text className="font-inter-bold text-base text-body-strong">{slot.label}</Text>
                      {slot.targetAngleDegrees !== undefined && (
                        <Text className="mt-1 font-inter text-sm text-muted">
                          Target angle: {slot.targetAngleDegrees}°
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Remove slot ${slot.label}`}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => setCaptureSlots(captureSlots.filter((_, i) => i !== index))}
                      className="h-11 w-11 items-center justify-center"
                    >
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View className="mt-3 flex-row gap-2">
              <TextInput
                accessibilityLabel="Photo position name"
                placeholder="e.g. Top"
                placeholderTextColor="#7a7a7a"
                value={slotLabelDraft}
                onChangeText={setSlotLabelDraft}
                onFocus={() => setSlotLabelFocused(true)}
                onBlur={() => setSlotLabelFocused(false)}
                className={`h-12 flex-1 ${INPUT_BASE} text-base ${slotLabelFocused ? 'border-primary' : 'border-hairline-strong'}`}
              />
              <TextInput
                accessibilityLabel="Target angle in degrees, optional"
                placeholder="Angle °"
                placeholderTextColor="#7a7a7a"
                keyboardType="numeric"
                value={slotAngleDraft}
                onChangeText={setSlotAngleDraft}
                onFocus={() => setSlotAngleFocused(true)}
                onBlur={() => setSlotAngleFocused(false)}
                className={`h-12 w-24 ${INPUT_BASE} text-base ${slotAngleFocused ? 'border-primary' : 'border-hairline-strong'}`}
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Add photo position"
                activeOpacity={0.7}
                onPress={handleAddSlot}
                className="h-12 items-center justify-center border-2 border-hairline-strong px-4"
              >
                <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-ink">Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

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

        <View className="mt-8 flex-row items-center justify-between">
          <Text className="font-inter-bold text-base text-body-strong">Fields</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Add field"
            activeOpacity={0.7}
            onPress={() => setModalVisible(true)}
            className="h-11 items-center justify-center border-2 border-hairline-strong px-4"
          >
            <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-ink">+ Add Field</Text>
          </TouchableOpacity>
        </View>

        {fields.length === 0 ? (
          <Text className="mt-3 font-inter-light text-base text-body">
            No fields yet. You can add fields now, or come back and add more later.
          </Text>
        ) : (
          <View className="mt-3 bg-surface-card px-4">
            {fields.map((field, index) => (
              <View
                key={`${field.name}-${index}`}
                className={`flex-row items-center justify-between py-3 ${
                  index < fields.length - 1 ? 'border-b border-hairline' : ''
                }`}
              >
                <View>
                  <Text className="font-inter-bold text-base text-body-strong">{field.name}</Text>
                  <Text className="mt-1 font-inter text-sm text-muted">{DATA_TYPE_LABELS[field.dataType]}</Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Remove field ${field.name}`}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => setFields(fields.filter((_, i) => i !== index))}
                  className="h-11 w-11 items-center justify-center"
                >
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View className="border-t border-hairline px-6 py-4">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Create project"
          accessibilityState={{ disabled: saving }}
          activeOpacity={0.85}
          onPress={handleCreate}
          disabled={saving}
          className={`h-[56px] w-full items-center justify-center bg-primary px-6 ${saving ? 'opacity-60' : ''}`}
        >
          {saving ? (
            <ActivityIndicator color="#03140d" />
          ) : (
            <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-primary-on">
              Create Project
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <AddFieldModal
        visible={modalVisible}
        existingCategories={existingCategories}
        onClose={() => setModalVisible(false)}
        onAdd={(field) => setFields([...fields, field])}
      />

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
    </SafeAreaView>
  );
}
