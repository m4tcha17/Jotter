import { Ionicons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AddFieldModal from '../components/AddFieldModal';
import { addField, DATA_TYPE_LABELS, deleteField, fetchFields, fetchGlobalCategories } from '../lib/projects';
import type { ExistingCategory, ProjectField } from '../lib/projects';
import type { ProjectTabParamList } from '../navigation/ProjectTabs';

type Props = BottomTabScreenProps<ProjectTabParamList, 'Fields'>;

const COLUMN_WIDTH = 160;
const ID_COLUMN_WIDTH = 90;
const ROW_HEIGHT = 44;
const LETTER_ROW_HEIGHT = 32;
const HEADER_ROW_HEIGHT = 56;
const PREVIEW_ROW_COUNT = 12;

function columnLetter(index: number): string {
  // 0 -> A, 25 -> Z, 26 -> AA, matching spreadsheet column naming.
  let n = index;
  let label = '';
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

export default function FieldsScreen({ route }: Props) {
  const { projectId } = route.params;
  const [fields, setFields] = useState<ProjectField[] | null>(null);
  const [existingCategories, setExistingCategories] = useState<ExistingCategory[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(false);

  const loadFields = useCallback(() => {
    fetchFields(projectId)
      .then(setFields)
      .catch(() => setFields([]));
  }, [projectId]);

  useFocusEffect(loadFields);

  useFocusEffect(
    useCallback(() => {
      fetchGlobalCategories()
        .then(setExistingCategories)
        .catch(() => {});
    }, []),
  );

  async function handleAddField(field: Parameters<typeof addField>[1]) {
    try {
      await addField(projectId, field);
      loadFields();
    } catch (err) {
      Alert.alert('Could not add field', err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  function handleDeleteField(field: ProjectField) {
    Alert.alert(
      `Delete "${field.name}"?`,
      'Any data already logged in this column will be permanently deleted. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteField(field.id);
              loadFields();
            } catch (err) {
              Alert.alert('Could not delete field', err instanceof Error ? err.message : 'Something went wrong.');
            }
          },
        },
      ],
    );
  }

  if (fields === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center justify-between border-b border-slate-100 px-4 py-2">
        <Text className="text-lg font-bold text-slate-900">Fields</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={editing ? 'Done editing' : 'Edit fields'}
          onPress={() => setEditing(!editing)}
          className="min-h-[40px] flex-row items-center rounded-xl border-2 border-slate-300 px-3"
        >
          <Ionicons name={editing ? 'checkmark' : 'create-outline'} size={18} color="#334155" />
          <Text className="ml-1 text-sm font-semibold text-slate-700">{editing ? 'Done' : 'Edit'}</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-1 flex-row">
        {/* Frozen left column: row numbers, stays put while the sheet scrolls horizontally. */}
        <View className="border-r border-slate-200">
          <View style={{ height: LETTER_ROW_HEIGHT }} className="border-b border-slate-200 bg-slate-100" />
          <View
            style={{ width: ID_COLUMN_WIDTH, height: HEADER_ROW_HEIGHT }}
            className="items-center justify-center border-b border-slate-200 bg-slate-50 px-3"
          >
            <Text className="text-base font-bold text-slate-900">id</Text>
            <Text className="text-xs text-slate-500">auto</Text>
          </View>
          {Array.from({ length: PREVIEW_ROW_COUNT }).map((_, rowIndex) => (
            <View
              key={rowIndex}
              style={{ width: ID_COLUMN_WIDTH, height: ROW_HEIGHT }}
              className="items-center justify-center border-b border-slate-100 bg-slate-50"
            >
              <Text className="text-sm text-slate-400">{rowIndex + 1}</Text>
            </View>
          ))}
        </View>

        <ScrollView horizontal>
          <View>
            {/* Spreadsheet-style column letters, A/B/C..., one per field. */}
            <View style={{ height: LETTER_ROW_HEIGHT }} className="flex-row border-b border-slate-200">
              {fields.map((field, index) => (
                <View
                  key={field.id}
                  style={{ width: COLUMN_WIDTH }}
                  className="items-center justify-center border-r border-slate-200 bg-slate-100"
                >
                  <Text className="text-xs font-semibold text-slate-500">{columnLetter(index)}</Text>
                </View>
              ))}
              <View
                style={{ width: COLUMN_WIDTH }}
                className="items-center justify-center border-r border-slate-200 bg-slate-100"
              >
                <Text className="text-xs font-semibold text-slate-500">{columnLetter(fields.length)}</Text>
              </View>
            </View>

            {/* Field header row: name, type, category, and (in Edit mode) a delete button. */}
            <View style={{ height: HEADER_ROW_HEIGHT }} className="flex-row border-b border-slate-200">
              {fields.map((field) => (
                <View
                  key={field.id}
                  style={{ width: COLUMN_WIDTH }}
                  className="flex-row items-start justify-between border-r border-slate-200 px-3 py-2"
                >
                  <View className="flex-shrink">
                    <Text className="text-base font-bold text-slate-900" numberOfLines={1}>
                      {field.name}
                    </Text>
                    <Text className="text-xs text-slate-500">
                      {DATA_TYPE_LABELS[field.data_type]}
                      {field.category ? ` · ${field.category.name}` : ''}
                    </Text>
                  </View>
                  {editing && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Delete field ${field.name}`}
                      onPress={() => handleDeleteField(field)}
                      className="ml-1 min-h-[24px] min-w-[24px] items-center justify-center"
                    >
                      <Text className="text-base font-bold text-red-600">×</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {editing ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Add field"
                  onPress={() => setModalVisible(true)}
                  style={{ width: COLUMN_WIDTH }}
                  className="items-center justify-center border-r border-dashed border-slate-300 px-3"
                >
                  <Text className="text-base font-semibold text-emerald-700">+ Add Field</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ width: COLUMN_WIDTH }} className="border-r border-slate-200" />
              )}
            </View>

            {/* Empty preview rows — real sample data will fill these in once Capture exists. */}
            {Array.from({ length: PREVIEW_ROW_COUNT }).map((_, rowIndex) => (
              <View key={rowIndex} style={{ height: ROW_HEIGHT }} className="flex-row border-b border-slate-100">
                {fields.map((field) => (
                  <View
                    key={field.id}
                    style={{ width: COLUMN_WIDTH }}
                    className="justify-center border-r border-slate-100 px-3"
                  />
                ))}
                <View style={{ width: COLUMN_WIDTH }} className="border-r border-slate-100" />
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {!editing && (
        <View className="border-t border-slate-100 px-4 py-3">
          <Text className="text-center text-sm text-slate-500">
            Locked to prevent accidental changes — tap Edit to add or remove fields.
          </Text>
        </View>
      )}

      <AddFieldModal
        visible={modalVisible}
        existingCategories={existingCategories}
        onClose={() => setModalVisible(false)}
        onAdd={handleAddField}
      />
    </SafeAreaView>
  );
}
