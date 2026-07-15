import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AddFieldModal from '../components/AddFieldModal';
import { createProject, fetchGlobalCategories } from '../lib/projects';
import type { CaptureMode, CaptureSlotInput, ExistingCategory, NewFieldInput } from '../lib/projects';
import type { RootStackParamList } from '../navigation/RootNavigator';

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

const DATA_TYPE_LABELS: Record<NewFieldInput['dataType'], string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  boolean: 'Yes / No',
  category: 'Category',
  photo: 'Photo',
  timestamp: 'Timestamp (auto)',
};

export default function CreateProjectScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [fields, setFields] = useState<NewFieldInput[]>([]);
  const [existingCategories, setExistingCategories] = useState<ExistingCategory[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const [captureMode, setCaptureMode] = useState<CaptureMode>('single');
  const [captureSlots, setCaptureSlots] = useState<CaptureSlotInput[]>([]);
  const [slotLabelDraft, setSlotLabelDraft] = useState('');
  const [slotAngleDraft, setSlotAngleDraft] = useState('');

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

    setSaving(true);
    try {
      const projectId = await createProject({ name: name.trim(), color, fields, captureMode, captureSlots });
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
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-6 pt-6" keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          className="min-h-[44px] w-11 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={24} color="#334155" />
        </TouchableOpacity>

        <Text className="mt-2 text-3xl font-bold text-slate-900">New Project</Text>

        <Text className="mt-6 text-base font-semibold text-slate-700">Project name</Text>
        <TextInput
          accessibilityLabel="Project name"
          placeholder="e.g. Copra Moisture Survey"
          value={name}
          onChangeText={setName}
          className="mt-2 min-h-[56px] rounded-xl border-2 border-slate-300 px-4 text-lg text-slate-900"
        />

        <Text className="mt-6 text-base font-semibold text-slate-700">Color</Text>
        <View className="mt-2 flex-row flex-wrap gap-3">
          {PRESET_COLORS.map((preset) => (
            <TouchableOpacity
              key={preset}
              accessibilityRole="button"
              accessibilityLabel={`Color ${preset}`}
              onPress={() => setColor(preset)}
              style={{ backgroundColor: preset }}
              className={`h-12 w-12 rounded-full ${color === preset ? 'border-4 border-slate-900' : ''}`}
            />
          ))}
        </View>

        <Text className="mt-6 text-base font-semibold text-slate-700">Photos per sample</Text>
        <View className="mt-2 flex-row gap-2">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Single Shot — one photo per sample"
            onPress={() => setCaptureMode('single')}
            className={`min-h-[48px] flex-1 items-center justify-center rounded-xl border-2 ${
              captureMode === 'single' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-300'
            }`}
          >
            <Text className="text-base font-semibold text-slate-700">Single Shot</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Multi Shot — several photos per sample"
            onPress={() => setCaptureMode('multi')}
            className={`min-h-[48px] flex-1 items-center justify-center rounded-xl border-2 ${
              captureMode === 'multi' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-300'
            }`}
          >
            <Text className="text-base font-semibold text-slate-700">Multi Shot</Text>
          </TouchableOpacity>
        </View>

        {captureMode === 'single' ? (
          <Text className="mt-2 text-base text-slate-500">One photo per sample, then the data form.</Text>
        ) : (
          <View className="mt-3">
            <Text className="text-base text-slate-500">
              Define each photo position for one complete sample (e.g. Top, Bottom, Side 1-4).
            </Text>

            {captureSlots.map((slot, index) => (
              <View
                key={`${slot.label}-${index}`}
                className="mt-3 flex-row items-center justify-between rounded-xl border-2 border-slate-100 px-4 py-3"
              >
                <View>
                  <Text className="text-base font-semibold text-slate-900">{slot.label}</Text>
                  {slot.targetAngleDegrees !== undefined && (
                    <Text className="text-sm text-slate-500">Target angle: {slot.targetAngleDegrees}°</Text>
                  )}
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Remove slot ${slot.label}`}
                  onPress={() => setCaptureSlots(captureSlots.filter((_, i) => i !== index))}
                >
                  <Text className="text-base font-semibold text-red-600">Remove</Text>
                </TouchableOpacity>
              </View>
            ))}

            <View className="mt-3 flex-row gap-2">
              <TextInput
                accessibilityLabel="Photo position name"
                placeholder="e.g. Top"
                value={slotLabelDraft}
                onChangeText={setSlotLabelDraft}
                className="min-h-[48px] flex-1 rounded-xl border-2 border-slate-300 px-4 text-base text-slate-900"
              />
              <TextInput
                accessibilityLabel="Target angle in degrees, optional"
                placeholder="Angle °"
                keyboardType="numeric"
                value={slotAngleDraft}
                onChangeText={setSlotAngleDraft}
                className="min-h-[48px] w-24 rounded-xl border-2 border-slate-300 px-3 text-base text-slate-900"
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Add photo position"
                onPress={handleAddSlot}
                className="min-h-[48px] items-center justify-center rounded-xl border-2 border-slate-300 px-4"
              >
                <Text className="text-base font-semibold text-slate-700">Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View className="mt-8 flex-row items-center justify-between">
          <Text className="text-base font-semibold text-slate-700">Fields</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Add field"
            onPress={() => setModalVisible(true)}
            className="min-h-[44px] items-center justify-center rounded-xl bg-emerald-600 px-4"
          >
            <Text className="text-base font-semibold text-white">+ Add Field</Text>
          </TouchableOpacity>
        </View>

        {fields.length === 0 ? (
          <Text className="mt-3 text-base text-slate-500">
            No fields yet. You can add fields now, or come back and add more later.
          </Text>
        ) : (
          fields.map((field, index) => (
            <View
              key={`${field.name}-${index}`}
              className="mt-3 flex-row items-center justify-between rounded-xl border-2 border-slate-100 px-4 py-3"
            >
              <View>
                <Text className="text-base font-semibold text-slate-900">{field.name}</Text>
                <Text className="text-sm text-slate-500">{DATA_TYPE_LABELS[field.dataType]}</Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Remove field ${field.name}`}
                onPress={() => setFields(fields.filter((_, i) => i !== index))}
              >
                <Text className="text-base font-semibold text-red-600">Remove</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <View className="border-t border-slate-100 px-6 py-4">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Create project"
          onPress={handleCreate}
          disabled={saving}
          className="min-h-[56px] w-full items-center justify-center rounded-xl bg-emerald-600 px-6"
        >
          {saving ? <ActivityIndicator color="white" /> : <Text className="text-lg font-semibold text-white">Create Project</Text>}
        </TouchableOpacity>
      </View>

      <AddFieldModal
        visible={modalVisible}
        existingCategories={existingCategories}
        onClose={() => setModalVisible(false)}
        onAdd={(field) => setFields([...fields, field])}
      />
    </SafeAreaView>
  );
}
