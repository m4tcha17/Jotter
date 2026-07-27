import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ProjectTabParamList } from '../navigation/ProjectTabs';

type Props = BottomTabScreenProps<ProjectTabParamList, 'Capture'>;

export default function CaptureScreen({}: Props) {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-2xl font-bold text-slate-900">Capture</Text>
      <Text className="mt-2 text-center text-base text-slate-500">
        Camera capture is coming soon — it's waiting on a hardware compatibility check and a custom camera
        module for locked exposure settings.
      </Text>
    </SafeAreaView>
  );
}
