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

const INPUT_BASE = 'border-2 px-4 font-inter text-lg text-ink';
const CHIP_BASE = 'h-12 items-center justify-center border-2 px-4';
const CHIP_LABEL_BASE = 'font-inter-bold text-[13px] uppercase tracking-[1.2px]';

type Props = {
  visible: boolean;
  existingCategories: ExistingCategory[];
  onClose: () => void;
  onAdd: (field: NewFieldInput) => void;
};

export default function AddFieldModal({ visible, existingCategories, onClose, onAdd }: Props) {
  const [name, setName] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [dataType, setDataType] = useState<FieldDataType | null>(null);
  const [categoryMode, setCategoryMode] = useState<'existing' | 'new'>(
    existingCategories.length > 0 ? 'existing' : 'new',
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryNameFocused, setNewCategoryNameFocused] = useState(false);
  const [newCategoryScope, setNewCategoryScope] = useState<CategoryScope>('field');
  const [options, setOptions] = useState<string[]>([]);
  const [optionDraft, setOptionDraft] = useState('');
  const [optionDraftFocused, setOptionDraftFocused] = useState(false);

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
      <SafeAreaView className="flex-1 bg-canvas">
        <ScrollView className="flex-1 px-6 pt-6" keyboardShouldPersistTaps="handled">
          <Text className="font-inter-black text-[26px] uppercase leading-[1.1] tracking-[0.2px] text-ink">
            Add Field
          </Text>

          <Text className="mt-6 font-inter-bold text-base text-body-strong">Field name</Text>
          <TextInput
            accessibilityLabel="Field name"
            placeholder="e.g. Moisture %"
            placeholderTextColor="#7a7a7a"
            value={name}
            onChangeText={setName}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            className={`mt-2 h-[56px] ${INPUT_BASE} ${nameFocused ? 'border-primary' : 'border-hairline-strong'}`}
          />

          <Text className="mt-6 font-inter-bold text-base text-body-strong">Data type</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {DATA_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                accessibilityRole="button"
                accessibilityLabel={`Data type: ${type.label}`}
                activeOpacity={0.7}
                onPress={() => setDataType(type.value)}
                className={`${CHIP_BASE} ${
                  dataType === type.value ? 'border-primary bg-surface-elevated' : 'border-hairline-strong'
                }`}
              >
                <Text className={`${CHIP_LABEL_BASE} ${dataType === type.value ? 'text-primary' : 'text-body'}`}>
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
                  activeOpacity={0.7}
                  onPress={() => setCategoryMode('existing')}
                  className={`${CHIP_BASE} flex-1 ${
                    categoryMode === 'existing' ? 'border-primary bg-surface-elevated' : 'border-hairline-strong'
                  }`}
                >
                  <Text
                    className={`${CHIP_LABEL_BASE} ${categoryMode === 'existing' ? 'text-primary' : 'text-body'}`}
                  >
                    Use existing
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Create a new category"
                  activeOpacity={0.7}
                  onPress={() => setCategoryMode('new')}
                  className={`${CHIP_BASE} flex-1 ${
                    categoryMode === 'new' ? 'border-primary bg-surface-elevated' : 'border-hairline-strong'
                  }`}
                >
                  <Text className={`${CHIP_LABEL_BASE} ${categoryMode === 'new' ? 'text-primary' : 'text-body'}`}>
                    Create new
                  </Text>
                </TouchableOpacity>
              </View>

              {categoryMode === 'existing' ? (
                <View className="mt-4">
                  {existingCategories.length === 0 ? (
                    <Text className="font-inter-light text-base text-body">
                      No global categories yet — create one instead.
                    </Text>
                  ) : (
                    existingCategories.map((category) => (
                      <TouchableOpacity
                        key={category.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Select category ${category.name}`}
                        activeOpacity={0.7}
                        onPress={() => setSelectedCategoryId(category.id)}
                        className={`mt-2 h-12 justify-center border-2 px-4 ${
                          selectedCategoryId === category.id
                            ? 'border-primary bg-surface-elevated'
                            : 'border-hairline-strong'
                        }`}
                      >
                        <Text
                          className={`${CHIP_LABEL_BASE} ${
                            selectedCategoryId === category.id ? 'text-primary' : 'text-body'
                          }`}
                        >
                          {category.name}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              ) : (
                <View className="mt-4">
                  <TextInput
                    accessibilityLabel="Category name"
                    placeholder="e.g. Classification"
                    placeholderTextColor="#7a7a7a"
                    value={newCategoryName}
                    onChangeText={setNewCategoryName}
                    onFocus={() => setNewCategoryNameFocused(true)}
                    onBlur={() => setNewCategoryNameFocused(false)}
                    className={`h-[56px] ${INPUT_BASE} ${
                      newCategoryNameFocused ? 'border-primary' : 'border-hairline-strong'
                    }`}
                  />

                  <View className="mt-3 flex-row gap-2">
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Global category — reusable across projects"
                      activeOpacity={0.7}
                      onPress={() => setNewCategoryScope('global')}
                      className={`${CHIP_BASE} flex-1 ${
                        newCategoryScope === 'global' ? 'border-primary bg-surface-elevated' : 'border-hairline-strong'
                      }`}
                    >
                      <Text
                        className={`${CHIP_LABEL_BASE} ${
                          newCategoryScope === 'global' ? 'text-primary' : 'text-body'
                        }`}
                      >
                        Global
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Just this field"
                      activeOpacity={0.7}
                      onPress={() => setNewCategoryScope('field')}
                      className={`${CHIP_BASE} flex-1 ${
                        newCategoryScope === 'field' ? 'border-primary bg-surface-elevated' : 'border-hairline-strong'
                      }`}
                    >
                      <Text
                        className={`${CHIP_LABEL_BASE} ${newCategoryScope === 'field' ? 'text-primary' : 'text-body'}`}
                      >
                        Just this field
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text className="mt-4 font-inter-bold text-base text-body-strong">Options</Text>
                  {options.map((option, index) => (
                    <View
                      key={`${option}-${index}`}
                      className="mt-2 flex-row items-center justify-between"
                    >
                      <Text className="font-inter text-base text-ink">{option}</Text>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`Remove option ${option}`}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        onPress={() => setOptions(options.filter((_, i) => i !== index))}
                      >
                        <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-destructive">
                          Remove
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <View className="mt-2 flex-row items-center gap-2">
                    <TextInput
                      accessibilityLabel="New option"
                      placeholder="e.g. Wet"
                      placeholderTextColor="#7a7a7a"
                      value={optionDraft}
                      onChangeText={setOptionDraft}
                      onFocus={() => setOptionDraftFocused(true)}
                      onBlur={() => setOptionDraftFocused(false)}
                      onSubmitEditing={handleAddOption}
                      className={`h-12 flex-1 border-2 px-4 font-inter text-base text-ink ${
                        optionDraftFocused ? 'border-primary' : 'border-hairline-strong'
                      }`}
                    />
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Add option"
                      activeOpacity={0.7}
                      onPress={handleAddOption}
                      className="h-12 items-center justify-center border-2 border-hairline-strong px-4"
                    >
                      <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-ink">Add</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        <View className="flex-row gap-3 border-t border-hairline px-6 py-4">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            activeOpacity={0.7}
            onPress={() => {
              reset();
              onClose();
            }}
            className="h-[56px] flex-1 items-center justify-center border-2 border-hairline-strong"
          >
            <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-ink">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Add field"
            activeOpacity={0.85}
            onPress={handleSubmit}
            className="h-[56px] flex-1 items-center justify-center bg-primary"
          >
            <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-primary-on">Add Field</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
