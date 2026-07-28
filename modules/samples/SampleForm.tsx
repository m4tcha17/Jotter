import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { checkIdentifierDuplicate } from './api';
import type { NewSampleValue } from './api';
import type { ProjectField } from '../fields/api';
import CameraCaptureStep from '../camera/CameraCaptureStep';

const INPUT_BASE = 'h-[56px] border-2 px-4 font-inter text-lg text-ink';
const CHIP_BASE = 'h-12 items-center justify-center border-2 px-4';
const CHIP_LABEL_BASE = 'font-inter-bold text-[13px] uppercase tracking-[1.2px]';

type Props = {
  projectId: string;
  fields: ProjectField[];
  saving: boolean;
  onSave: (values: NewSampleValue[]) => void;
};

export default function SampleForm({ projectId, fields, saving, onSave }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [focusedFieldId, setFocusedFieldId] = useState<string | null>(null);
  const [photoFieldOpen, setPhotoFieldOpen] = useState<ProjectField | null>(null);
  const [checkingIdentifier, setCheckingIdentifier] = useState(false);

  const visibleFields = fields.filter((field) => field.data_type !== 'timestamp');

  function setValue(fieldId: string, value: string) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  function buildValues(): NewSampleValue[] {
    return Object.entries(values)
      .filter(([, value]) => value.trim().length > 0)
      .map(([fieldId, value]) => ({ fieldId, value: value.trim() }));
  }

  async function handleSubmit() {
    const missing = visibleFields.filter((field) => field.is_required && !values[field.id]?.trim());
    if (missing.length > 0) {
      Alert.alert('Missing required fields', missing.map((field) => field.name).join(', '));
      return;
    }

    const identifierField = visibleFields.find((field) => field.is_sample_identifier);
    const identifierValue = identifierField ? values[identifierField.id]?.trim() : undefined;

    if (identifierField && identifierValue) {
      setCheckingIdentifier(true);
      let isDuplicate: boolean;
      try {
        isDuplicate = await checkIdentifierDuplicate(projectId, identifierField.id, identifierValue);
      } catch (err) {
        setCheckingIdentifier(false);
        Alert.alert('Could not check for duplicates', err instanceof Error ? err.message : 'Something went wrong.');
        return;
      }
      setCheckingIdentifier(false);

      if (isDuplicate) {
        Alert.alert(
          `"${identifierValue}" is already used`,
          `Another sample already uses this ${identifierField.name}. Continue anyway, or go back and fix it?`,
          [
            { text: 'Go Back', style: 'cancel' },
            { text: 'Continue Anyway', onPress: () => onSave(buildValues()) },
          ],
        );
        return;
      }
    }

    onSave(buildValues());
  }

  const busy = saving || checkingIdentifier;

  return (
    <View className="flex-1 bg-canvas">
      <ScrollView className="flex-1 px-6 pt-6" keyboardShouldPersistTaps="handled">
        <Text className="font-inter-black text-[26px] uppercase leading-[1.1] tracking-[0.2px] text-ink">
          Log Sample
        </Text>

        {visibleFields.map((field) => (
          <View key={field.id} className="mt-6">
            <View className="flex-row items-center">
              <Text className="font-inter-bold text-base text-body-strong">{field.name}</Text>
              {field.is_required && <Text className="ml-2 font-inter-bold text-xs text-destructive">Required</Text>}
              {field.is_sample_identifier && (
                <Text className="ml-2 font-inter-bold text-xs text-muted">ID</Text>
              )}
            </View>

            {(field.data_type === 'text' || field.data_type === 'date') && (
              <TextInput
                accessibilityLabel={field.name}
                placeholder={field.data_type === 'date' ? 'YYYY-MM-DD' : undefined}
                placeholderTextColor="#7a7a7a"
                value={values[field.id] ?? ''}
                onChangeText={(text) => setValue(field.id, text)}
                onFocus={() => setFocusedFieldId(field.id)}
                onBlur={() => setFocusedFieldId(null)}
                className={`mt-2 ${INPUT_BASE} ${
                  focusedFieldId === field.id ? 'border-primary' : 'border-hairline-strong'
                }`}
              />
            )}

            {field.data_type === 'number' && (
              <TextInput
                accessibilityLabel={field.name}
                keyboardType="numeric"
                placeholderTextColor="#7a7a7a"
                value={values[field.id] ?? ''}
                onChangeText={(text) => setValue(field.id, text)}
                onFocus={() => setFocusedFieldId(field.id)}
                onBlur={() => setFocusedFieldId(null)}
                className={`mt-2 ${INPUT_BASE} ${
                  focusedFieldId === field.id ? 'border-primary' : 'border-hairline-strong'
                }`}
              />
            )}

            {field.data_type === 'boolean' && (
              <View className="mt-2 flex-row gap-2">
                {(['true', 'false'] as const).map((option) => (
                  <TouchableOpacity
                    key={option}
                    accessibilityRole="button"
                    accessibilityLabel={`${field.name}: ${option === 'true' ? 'Yes' : 'No'}`}
                    activeOpacity={0.7}
                    onPress={() => setValue(field.id, option)}
                    className={`${CHIP_BASE} flex-1 ${
                      values[field.id] === option ? 'border-primary bg-surface-elevated' : 'border-hairline-strong'
                    }`}
                  >
                    <Text
                      className={`${CHIP_LABEL_BASE} ${
                        values[field.id] === option ? 'text-primary' : 'text-body'
                      }`}
                    >
                      {option === 'true' ? 'Yes' : 'No'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {field.data_type === 'category' && (
              <View className="mt-2 flex-row flex-wrap gap-2">
                {(field.category?.options ?? []).map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${field.name}: ${option.label}`}
                    activeOpacity={0.7}
                    onPress={() => setValue(field.id, option.label)}
                    className={`${CHIP_BASE} ${
                      values[field.id] === option.label
                        ? 'border-primary bg-surface-elevated'
                        : 'border-hairline-strong'
                    }`}
                  >
                    <Text
                      className={`${CHIP_LABEL_BASE} ${
                        values[field.id] === option.label ? 'text-primary' : 'text-body'
                      }`}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {field.data_type === 'photo' && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={values[field.id] ? `Retake photo for ${field.name}` : `Take photo for ${field.name}`}
                activeOpacity={0.7}
                onPress={() => setPhotoFieldOpen(field)}
                className={`mt-2 h-12 items-center justify-center border-2 ${
                  values[field.id] ? 'border-primary' : 'border-hairline-strong'
                }`}
              >
                <Text className={`${CHIP_LABEL_BASE} ${values[field.id] ? 'text-primary' : 'text-body'}`}>
                  {values[field.id] ? 'Photo Captured — Retake' : 'Take Photo'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        <View className="h-6" />
      </ScrollView>

      <View className="border-t border-hairline px-6 py-4">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Save sample"
          activeOpacity={0.85}
          disabled={busy}
          onPress={handleSubmit}
          className={`h-[56px] items-center justify-center ${busy ? 'bg-surface-elevated' : 'bg-primary'}`}
        >
          {busy ? (
            <ActivityIndicator color="#10b981" />
          ) : (
            <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-primary-on">
              Save Sample
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal visible={photoFieldOpen !== null} animationType="slide" onRequestClose={() => setPhotoFieldOpen(null)}>
        {photoFieldOpen && (
          <CameraCaptureStep
            label={photoFieldOpen.name}
            onCapture={(uri) => {
              setValue(photoFieldOpen.id, uri);
              setPhotoFieldOpen(null);
            }}
          />
        )}
      </Modal>
    </View>
  );
}
