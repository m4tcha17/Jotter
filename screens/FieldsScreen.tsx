import { Ionicons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AddFieldModal from '../components/AddFieldModal';
import { addField, DATA_TYPE_LABELS, deleteField, fetchFields, fetchGlobalCategories } from '../lib/projects';
import type { ExistingCategory, ProjectField } from '../lib/projects';
import type { ProjectTabParamList } from '../navigation/ProjectTabs';

type Props = BottomTabScreenProps<ProjectTabParamList, 'Fields'>;

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

      {fields.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-lg font-semibold text-slate-900">No fields yet</Text>
          <Text className="mt-2 text-center text-base text-slate-500">
            Add a field to define what you capture for each sample.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Add field"
            onPress={() => setModalVisible(true)}
            className="mt-6 min-h-[48px] items-center justify-center rounded-xl bg-emerald-600 px-6"
          >
            <Text className="text-base font-semibold text-white">+ Add Field</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          className="flex-1 px-4 pt-3"
          data={fields}
          keyExtractor={(field) => field.id}
          renderItem={({ item: field }) => (
            <View className="mb-3 flex-row items-center justify-between rounded-xl border-2 border-slate-100 px-4 py-3">
              <View className="flex-shrink pr-3">
                <Text className="text-base font-bold text-slate-900" numberOfLines={1}>
                  {field.name}
                </Text>
                <Text className="text-sm text-slate-500">
                  {DATA_TYPE_LABELS[field.data_type]}
                  {field.category ? ` · ${field.category.name}` : ''}
                </Text>
              </View>
              {editing && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Delete field ${field.name}`}
                  onPress={() => handleDeleteField(field)}
                  className="min-h-[40px] min-w-[40px] items-center justify-center"
                >
                  <Ionicons name="trash-outline" size={20} color="#DC2626" />
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}

      {editing && (
        <View className="border-t border-slate-100 px-4 py-3">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Add field"
            onPress={() => setModalVisible(true)}
            className="min-h-[48px] items-center justify-center rounded-xl border-2 border-dashed border-emerald-600 px-6"
          >
            <Text className="text-base font-semibold text-emerald-700">+ Add Field</Text>
          </TouchableOpacity>
        </View>
      )}

      {!editing && fields.length > 0 && (
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
