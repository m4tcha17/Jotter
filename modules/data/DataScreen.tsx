import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';

import { fetchCaptureSlots } from '../capture/api';
import type { CaptureSlot } from '../capture/api';
import { DATA_TYPE_LABELS, fetchFields } from '../fields/api';
import type { ProjectField } from '../fields/api';
import { fetchSamples } from '../samples/api';
import type { SampleRow } from '../samples/api';
import type { ProjectTabParamList } from '../../navigation/ProjectTabs';
import { exportProjectData } from './export';

type Props = BottomTabScreenProps<ProjectTabParamList, 'Data'>;

const COLUMN_WIDTH = 160;
const ID_COLUMN_WIDTH = 90;
const ROW_HEIGHT = 72;
const LETTER_ROW_HEIGHT = 32;
const HEADER_ROW_HEIGHT = 56;

type Column =
  | { kind: 'slot'; id: string; title: string; subtitle: string }
  | { kind: 'field'; id: string; title: string; subtitle: string; dataType: ProjectField['data_type'] };

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

function buildColumns(slots: CaptureSlot[], fields: ProjectField[]): Column[] {
  return [
    ...slots.map((slot): Column => ({ kind: 'slot', id: slot.id, title: slot.label, subtitle: DATA_TYPE_LABELS.photo })),
    ...fields.map((field): Column => ({
      kind: 'field',
      id: field.id,
      title: field.name,
      subtitle: DATA_TYPE_LABELS[field.data_type] + (field.category ? ` · ${field.category.name}` : ''),
      dataType: field.data_type,
    })),
  ];
}

function formatTimestamp(isoString: string): string {
  return isoString.slice(0, 16).replace('T', ' ');
}

function PhotoCell({ uri }: { uri: string | null | undefined }) {
  if (!uri) {
    return (
      <View className="h-full w-full items-center justify-center">
        <Text className="font-inter text-sm text-muted">—</Text>
      </View>
    );
  }
  return <Image source={{ uri }} resizeMode="cover" className="h-full w-full" />;
}

function TextCell({ text }: { text: string }) {
  return (
    <View className="h-full justify-center px-3">
      <Text className="font-inter text-sm text-body-strong" numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

function DataCell({ column, sample }: { column: Column; sample: SampleRow }) {
  if (column.kind === 'slot') {
    const photo = sample.photos[column.id];
    return <PhotoCell uri={photo?.remoteUrl ?? photo?.localUri} />;
  }

  if (column.dataType === 'photo') {
    return <PhotoCell uri={sample.values[column.id]} />;
  }

  if (column.dataType === 'timestamp') {
    return <TextCell text={formatTimestamp(sample.createdAt)} />;
  }

  const raw = sample.values[column.id];
  if (raw == null) return <TextCell text="—" />;
  if (column.dataType === 'boolean') return <TextCell text={raw === 'true' ? 'Yes' : 'No'} />;
  return <TextCell text={raw} />;
}

export default function DataScreen({ route }: Props) {
  const { projectId, projectName } = route.params;
  const [slots, setSlots] = useState<CaptureSlot[] | null>(null);
  const [fields, setFields] = useState<ProjectField[] | null>(null);
  const [samples, setSamples] = useState<SampleRow[] | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      Promise.all([fetchCaptureSlots(projectId), fetchFields(projectId), fetchSamples(projectId)])
        .then(([loadedSlots, loadedFields, loadedSamples]) => {
          setSlots(loadedSlots);
          setFields(loadedFields);
          setSamples(loadedSamples);
        })
        .catch(() => {
          setSlots([]);
          setFields([]);
          setSamples([]);
        });
    }, [projectId]),
  );

  async function handleExport() {
    if (isExporting || samples === null || fields === null || slots === null) return;
    setIsExporting(true);
    try {
      const result = await exportProjectData(projectName, fields, slots, samples);
      if (result.duplicates.length > 0) {
        Alert.alert(
          'Duplicate sample IDs found',
          `${result.duplicates.length} value(s) are used by more than one sample. A full list is included in the export as duplicate-ids.txt.`,
        );
      }
      await Sharing.shareAsync(result.zipUri, {
        mimeType: 'application/zip',
        dialogTitle: 'Export project data',
      });
    } catch {
      Alert.alert('Export failed', 'Could not build the export. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }

  if (slots === null || fields === null || samples === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator size="large" color="#10b981" />
      </SafeAreaView>
    );
  }

  if (samples.length === 0) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6">
        <Text className="font-inter-black text-[26px] uppercase text-ink">Data</Text>
        <Text className="mt-2 text-center font-inter-light text-base text-body">
          Your captured samples will show up here as a table, with CSV export — once you capture your first sample.
        </Text>
      </SafeAreaView>
    );
  }

  const columns = buildColumns(slots, fields);

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="h-14 flex-row items-center justify-between border-b border-hairline px-6">
        <Text className="font-inter-bold text-[20px] text-ink">Data</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Export project data as CSV and photos"
          activeOpacity={0.85}
          disabled={isExporting}
          onPress={handleExport}
          className="h-12 min-w-[96px] items-center justify-center rounded-none bg-primary px-4"
        >
          {isExporting ? (
            <ActivityIndicator size="small" color="#0a0a0a" />
          ) : (
            <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-primary-on">Export</Text>
          )}
        </TouchableOpacity>
      </View>

      <View className="flex-1 flex-row">
        {/* Frozen left column: row numbers, stays put while the sheet scrolls horizontally. */}
        <View className="border-r border-hairline">
          <View style={{ height: LETTER_ROW_HEIGHT }} className="border-b border-hairline bg-surface-soft" />
          <View
            style={{ width: ID_COLUMN_WIDTH, height: HEADER_ROW_HEIGHT }}
            className="items-center justify-center border-b border-hairline bg-surface-soft px-3"
          >
            <Text className="font-inter-bold text-base text-body-strong">id</Text>
            <Text className="font-inter text-xs text-muted">auto</Text>
          </View>
          {samples.map((_, rowIndex) => (
            <View
              key={rowIndex}
              style={{ width: ID_COLUMN_WIDTH, height: ROW_HEIGHT }}
              className="items-center justify-center border-b border-hairline bg-surface-soft"
            >
              <Text className="font-inter text-sm text-muted">{rowIndex + 1}</Text>
            </View>
          ))}
        </View>

        <ScrollView horizontal>
          <View>
            {/* Spreadsheet-style column letters, A/B/C..., one per slot/field. */}
            <View style={{ height: LETTER_ROW_HEIGHT }} className="flex-row border-b border-hairline">
              {columns.map((column, index) => (
                <View
                  key={column.id}
                  style={{ width: COLUMN_WIDTH }}
                  className="items-center justify-center border-r border-hairline bg-surface-soft"
                >
                  <Text className="font-inter-bold text-xs text-muted">{columnLetter(index)}</Text>
                </View>
              ))}
            </View>

            {/* Column header row: name, type, category. */}
            <View style={{ height: HEADER_ROW_HEIGHT }} className="flex-row border-b border-hairline">
              {columns.map((column) => (
                <View
                  key={column.id}
                  style={{ width: COLUMN_WIDTH }}
                  className="justify-center border-r border-hairline px-3 py-2"
                >
                  <Text className="font-inter-bold text-base text-body-strong" numberOfLines={1}>
                    {column.title}
                  </Text>
                  <Text className="font-inter text-xs text-muted">{column.subtitle}</Text>
                </View>
              ))}
            </View>

            {/* One row per captured sample. */}
            {samples.map((sample) => (
              <View key={sample.id} style={{ height: ROW_HEIGHT }} className="flex-row border-b border-hairline">
                {columns.map((column) => (
                  <View key={column.id} style={{ width: COLUMN_WIDTH }} className="border-r border-hairline">
                    <DataCell column={column} sample={sample} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
