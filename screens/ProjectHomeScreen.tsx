import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectHome'>;

export default function ProjectHomeScreen({ route, navigation }: Props) {
  const { projectName } = route.params;

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-2xl font-bold text-slate-900">{projectName}</Text>
      <Text className="mt-2 text-center text-base text-slate-500">
        Capture, Fields, and Data tabs for this project are coming soon.
      </Text>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Back to projects"
        onPress={() => navigation.navigate('Main')}
        className="mt-8 min-h-[48px] items-center justify-center rounded-xl border-2 border-slate-300 px-6"
      >
        <Text className="text-base font-semibold text-slate-700">Back to Projects</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
