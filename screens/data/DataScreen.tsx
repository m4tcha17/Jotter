import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DATA_TYPE_LABELS, fetchFields, fetchSampleCount } from '../../lib/projects';
import type { ProjectField } from '../../lib/projects';
import type { ProjectTabParamList } from '../../navigation/ProjectTabs';

type Props = BottomTabScreenProps<ProjectTabParamList, 'Data'>;

const COLUMN_WIDTH = 160;
const ID_COLUMN_WIDTH = 90;
const ROW_HEIGHT = 44;
const LETTER_ROW_HEIGHT = 32;
const HEADER_ROW_HEIGHT = 56;

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

export default function DataScreen({ route }: Props) {
  const { projectId } = route.params;
  const [fields, setFields] = useState<ProjectField[] | null>(null);
  const [sampleCount, setSampleCount] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchFields(projectId)
        .then(setFields)
        .catch(() => setFields([]));
      fetchSampleCount(projectId)
        .then(setSampleCount)
        .catch(() => setSampleCount(0));
    }, [projectId]),
  );

  if (fields === null || sampleCount === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (sampleCount === 0) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-2xl font-bold text-slate-900">Data</Text>
        <Text className="mt-2 text-center text-base text-slate-500">
          Your captured samples will show up here as a table, with CSV export — once you capture your first sample.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center justify-between border-b border-slate-100 px-4 py-2">
        <Text className="text-lg font-bold text-slate-900">Data</Text>
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
          {Array.from({ length: sampleCount }).map((_, rowIndex) => (
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
            </View>

            {/* Field header row: name, type, category. */}
            <View style={{ height: HEADER_ROW_HEIGHT }} className="flex-row border-b border-slate-200">
              {fields.map((field) => (
                <View
                  key={field.id}
                  style={{ width: COLUMN_WIDTH }}
                  className="justify-center border-r border-slate-200 px-3 py-2"
                >
                  <Text className="text-base font-bold text-slate-900" numberOfLines={1}>
                    {field.name}
                  </Text>
                  <Text className="text-xs text-slate-500">
                    {DATA_TYPE_LABELS[field.data_type]}
                    {field.category ? ` · ${field.category.name}` : ''}
                  </Text>
                </View>
              ))}
            </View>

            {/* One row per captured sample — cell values fill in once sample_values fetching is wired up. */}
            {Array.from({ length: sampleCount }).map((_, rowIndex) => (
              <View key={rowIndex} style={{ height: ROW_HEIGHT }} className="flex-row border-b border-slate-100">
                {fields.map((field) => (
                  <View
                    key={field.id}
                    style={{ width: COLUMN_WIDTH }}
                    className="justify-center border-r border-slate-100 px-3"
                  />
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
