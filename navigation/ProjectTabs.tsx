import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CaptureScreen from '../screens/CaptureScreen';
import DataScreen from '../screens/DataScreen';
import FieldsScreen from '../screens/FieldsScreen';
import type { RootStackParamList } from './RootNavigator';

export type ProjectTabParamList = {
  Capture: { projectId: string; projectName: string };
  Fields: { projectId: string; projectName: string };
  Data: { projectId: string; projectName: string };
};

const Tab = createBottomTabNavigator<ProjectTabParamList>();

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectHome'>;

export function ProjectTabs({ route, navigation }: Props) {
  const { projectId, projectName } = route.params;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <SafeAreaView className="flex-row items-center justify-between border-b border-slate-100 px-4 py-3" edges={[]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back to projects"
          onPress={() => navigation.navigate('Main')}
          className="min-h-[44px] w-11 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={24} color="#334155" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-lg font-bold text-slate-900" numberOfLines={1}>
          {projectName}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Project settings"
          onPress={() => navigation.navigate('ProjectSettings', { projectId, projectName })}
          className="min-h-[44px] w-11 items-center justify-center"
        >
          <Ionicons name="settings-outline" size={22} color="#334155" />
        </TouchableOpacity>
      </SafeAreaView>

      <Tab.Navigator screenOptions={{ headerShown: false }}>
        <Tab.Screen name="Capture" component={CaptureScreen} initialParams={{ projectId, projectName }} />
        <Tab.Screen name="Fields" component={FieldsScreen} initialParams={{ projectId, projectName }} />
        <Tab.Screen name="Data" component={DataScreen} initialParams={{ projectId, projectName }} />
      </Tab.Navigator>
    </SafeAreaView>
  );
}
