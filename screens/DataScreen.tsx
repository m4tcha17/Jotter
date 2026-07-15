import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ProjectTabParamList } from '../navigation/ProjectTabs';

type Props = BottomTabScreenProps<ProjectTabParamList, 'Data'>;

export default function DataScreen({}: Props) {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-2xl font-bold text-slate-900">Data</Text>
      <Text className="mt-2 text-center text-base text-slate-500">
        Your captured samples will show up here as a table, with CSV export — once Capture is built.
      </Text>
    </SafeAreaView>
  );
}
