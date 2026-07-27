import { Ionicons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AddFieldModal from '../../components/AddFieldModal';
import { addField, DATA_TYPE_LABELS, deleteField, fetchFields, fetchGlobalCategories } from '../../lib/projects';
import type { ExistingCategory, ProjectField } from '../../lib/projects';
import type { ProjectTabParamList } from '../../navigation/ProjectTabs';

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
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator size="large" color="#10b981" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="h-14 flex-row items-center justify-between border-b border-hairline px-6">
        <Text className="font-inter-bold text-[20px] text-ink">Fields</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={editing ? 'Done editing' : 'Edit fields'}
          activeOpacity={0.7}
          onPress={() => setEditing(!editing)}
          className="h-11 flex-row items-center justify-center border-2 border-hairline-strong px-4"
        >
          <Ionicons name={editing ? 'checkmark' : 'create-outline'} size={18} color="#ffffff" />
          <Text className="ml-2 font-inter-bold text-[13px] uppercase tracking-[1.2px] text-ink">
            {editing ? 'Done' : 'Edit'}
          </Text>
        </TouchableOpacity>
      </View>

      {fields.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="font-inter-bold text-[20px] text-ink">No fields yet</Text>
          <Text className="mt-2 text-center font-inter-light text-base text-body">
            Add a field to define what you capture for each sample.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Add field"
            activeOpacity={0.85}
            onPress={() => setModalVisible(true)}
            className="mt-6 h-[56px] items-center justify-center bg-primary px-6"
          >
            <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-primary-on">
              + Add Field
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          className="flex-1 px-6 pt-4"
          data={fields}
          keyExtractor={(field) => field.id}
          ItemSeparatorComponent={() => <View className="h-px bg-hairline" />}
          renderItem={({ item: field }) => (
            <View className="flex-row items-center justify-between bg-surface-card px-4 py-3">
              <View className="flex-shrink pr-3">
                <Text className="font-inter-bold text-base text-body-strong" numberOfLines={1}>
                  {field.name}
                </Text>
                <Text className="font-inter text-sm text-muted">
                  {DATA_TYPE_LABELS[field.data_type]}
                  {field.category ? ` · ${field.category.name}` : ''}
                </Text>
              </View>
              {editing && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Delete field ${field.name}`}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => handleDeleteField(field)}
                  className="h-11 w-11 items-center justify-center"
                >
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}

      {editing && (
        <View className="border-t border-hairline px-6 py-4">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Add field"
            activeOpacity={0.7}
            onPress={() => setModalVisible(true)}
            className="h-[56px] items-center justify-center border-2 border-hairline-strong px-6"
          >
            <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-ink">+ Add Field</Text>
          </TouchableOpacity>
        </View>
      )}

      {!editing && fields.length > 0 && (
        <View className="border-t border-hairline px-6 py-4">
          <Text className="text-center font-inter-light text-sm text-muted">
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
