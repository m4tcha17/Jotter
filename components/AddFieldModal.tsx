import { useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CategoryScope, ExistingCategory, FieldDataType, NewFieldInput } from '../lib/projects';

const DATA_TYPES: { value: FieldDataType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'category', label: 'Category' },
  { value: 'photo', label: 'Photo' },
  { value: 'timestamp', label: 'Timestamp (auto)' },
];

type Props = {
  visible: boolean;
  existingCategories: ExistingCategory[];
  onClose: () => void;
  onAdd: (field: NewFieldInput) => void;
};

export default function AddFieldModal({ visible, existingCategories, onClose, onAdd }: Props) {
  const [name, setName] = useState('');
  const [dataType, setDataType] = useState<FieldDataType | null>(null);
  const [categoryMode, setCategoryMode] = useState<'existing' | 'new'>(
    existingCategories.length > 0 ? 'existing' : 'new',
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryScope, setNewCategoryScope] = useState<CategoryScope>('field');
  const [options, setOptions] = useState<string[]>([]);
  const [optionDraft, setOptionDraft] = useState('');

  function reset() {
    setName('');
    setDataType(null);
    setCategoryMode(existingCategories.length > 0 ? 'existing' : 'new');
    setSelectedCategoryId(null);
    setNewCategoryName('');
    setNewCategoryScope('field');
    setOptions([]);
    setOptionDraft('');
  }

  function handleAddOption() {
    const trimmed = optionDraft.trim();
    if (!trimmed) return;
    setOptions([...options, trimmed]);
    setOptionDraft('');
  }

  function handleSubmit() {
    if (!name.trim()) {
      Alert.alert('Missing field name', 'Give this field a name.');
      return;
    }
    if (!dataType) {
      Alert.alert('Missing data type', 'Choose what kind of data this field holds.');
      return;
    }

    if (dataType !== 'category') {
      onAdd({ name: name.trim(), dataType });
      reset();
      onClose();
      return;
    }

    if (categoryMode === 'existing') {
      if (!selectedCategoryId) {
        Alert.alert('Choose a category', 'Pick an existing category, or switch to creating a new one.');
        return;
      }
      onAdd({ name: name.trim(), dataType, category: { kind: 'existing', categoryId: selectedCategoryId } });
    } else {
      if (!newCategoryName.trim()) {
        Alert.alert('Missing category name', 'Give the new category a name.');
        return;
      }
      if (options.length === 0) {
        Alert.alert('Add options', 'Add at least one option (e.g. Wet, Dry, Very Dry).');
        return;
      }
      onAdd({
        name: name.trim(),
        dataType,
        category: { kind: 'new', name: newCategoryName.trim(), scope: newCategoryScope, options },
      });
    }
    reset();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-white">
        <ScrollView className="flex-1 px-6 pt-6" keyboardShouldPersistTaps="handled">
          <Text className="text-2xl font-bold text-slate-900">Add Field</Text>

          <Text className="mt-6 text-base font-semibold text-slate-700">Field name</Text>
          <TextInput
            accessibilityLabel="Field name"
            placeholder="e.g. Moisture %"
            value={name}
            onChangeText={setName}
            className="mt-2 min-h-[56px] rounded-xl border-2 border-slate-300 px-4 text-lg text-slate-900"
          />

          <Text className="mt-6 text-base font-semibold text-slate-700">Data type</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {DATA_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                accessibilityRole="button"
                accessibilityLabel={`Data type: ${type.label}`}
                onPress={() => setDataType(type.value)}
                className={`min-h-[48px] items-center justify-center rounded-xl border-2 px-4 ${
                  dataType === type.value ? 'border-emerald-600 bg-emerald-50' : 'border-slate-300'
                }`}
              >
                <Text
                  className={`text-base font-semibold ${
                    dataType === type.value ? 'text-emerald-700' : 'text-slate-700'
                  }`}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {dataType === 'category' && (
            <View className="mt-6">
              <View className="flex-row gap-2">
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Use an existing category"
                  onPress={() => setCategoryMode('existing')}
                  className={`min-h-[48px] flex-1 items-center justify-center rounded-xl border-2 ${
                    categoryMode === 'existing' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-300'
                  }`}
                >
                  <Text className="text-base font-semibold text-slate-700">Use existing</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Create a new category"
                  onPress={() => setCategoryMode('new')}
                  className={`min-h-[48px] flex-1 items-center justify-center rounded-xl border-2 ${
                    categoryMode === 'new' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-300'
                  }`}
                >
                  <Text className="text-base font-semibold text-slate-700">Create new</Text>
                </TouchableOpacity>
              </View>

              {categoryMode === 'existing' ? (
                <View className="mt-4">
                  {existingCategories.length === 0 ? (
                    <Text className="text-base text-slate-500">
                      No global categories yet — create one instead.
                    </Text>
                  ) : (
                    existingCategories.map((category) => (
                      <TouchableOpacity
                        key={category.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Select category ${category.name}`}
                        onPress={() => setSelectedCategoryId(category.id)}
                        className={`mt-2 min-h-[48px] justify-center rounded-xl border-2 px-4 ${
                          selectedCategoryId === category.id ? 'border-emerald-600 bg-emerald-50' : 'border-slate-300'
                        }`}
                      >
                        <Text className="text-base font-semibold text-slate-700">{category.name}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              ) : (
                <View className="mt-4">
                  <TextInput
                    accessibilityLabel="Category name"
                    placeholder="e.g. Classification"
                    value={newCategoryName}
                    onChangeText={setNewCategoryName}
                    className="min-h-[56px] rounded-xl border-2 border-slate-300 px-4 text-lg text-slate-900"
                  />

                  <View className="mt-3 flex-row gap-2">
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Global category — reusable across projects"
                      onPress={() => setNewCategoryScope('global')}
                      className={`min-h-[48px] flex-1 items-center justify-center rounded-xl border-2 ${
                        newCategoryScope === 'global' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-300'
                      }`}
                    >
                      <Text className="text-base font-semibold text-slate-700">Global</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Just this field"
                      onPress={() => setNewCategoryScope('field')}
                      className={`min-h-[48px] flex-1 items-center justify-center rounded-xl border-2 ${
                        newCategoryScope === 'field' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-300'
                      }`}
                    >
                      <Text className="text-base font-semibold text-slate-700">Just this field</Text>
                    </TouchableOpacity>
                  </View>

                  <Text className="mt-4 text-base font-semibold text-slate-700">Options</Text>
                  {options.map((option, index) => (
                    <View key={`${option}-${index}`} className="mt-2 flex-row items-center justify-between">
                      <Text className="text-base text-slate-900">{option}</Text>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`Remove option ${option}`}
                        onPress={() => setOptions(options.filter((_, i) => i !== index))}
                      >
                        <Text className="text-base font-semibold text-red-600">Remove</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <View className="mt-2 flex-row items-center gap-2">
                    <TextInput
                      accessibilityLabel="New option"
                      placeholder="e.g. Wet"
                      value={optionDraft}
                      onChangeText={setOptionDraft}
                      onSubmitEditing={handleAddOption}
                      className="min-h-[48px] flex-1 rounded-xl border-2 border-slate-300 px-4 text-base text-slate-900"
                    />
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Add option"
                      onPress={handleAddOption}
                      className="min-h-[48px] items-center justify-center rounded-xl border-2 border-slate-300 px-4"
                    >
                      <Text className="text-base font-semibold text-slate-700">Add</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        <View className="flex-row gap-3 border-t border-slate-100 px-6 py-4">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={() => {
              reset();
              onClose();
            }}
            className="min-h-[56px] flex-1 items-center justify-center rounded-xl border-2 border-slate-300"
          >
            <Text className="text-lg font-semibold text-slate-700">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Add field"
            onPress={handleSubmit}
            className="min-h-[56px] flex-1 items-center justify-center rounded-xl bg-emerald-600"
          >
            <Text className="text-lg font-semibold text-white">Add Field</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
