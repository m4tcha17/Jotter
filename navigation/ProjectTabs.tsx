import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CaptureScreen from '../screens/capture/CaptureScreen';
import DataScreen from '../screens/data/DataScreen';
import FieldsScreen from '../screens/fields/FieldsScreen';
import type { RootStackParamList } from './RootNavigator';

export type ProjectTabParamList = {
  Capture: { projectId: string; projectName: string };
  Fields: { projectId: string; projectName: string };
  Data: { projectId: string; projectName: string };
};

const TAB_ICONS: Record<keyof ProjectTabParamList, { outline: keyof typeof Ionicons.glyphMap; filled: keyof typeof Ionicons.glyphMap }> = {
  Capture: { outline: 'camera-outline', filled: 'camera' },
  Fields: { outline: 'list-outline', filled: 'list' },
  Data: { outline: 'grid-outline', filled: 'grid' },
};

const Tab = createBottomTabNavigator<ProjectTabParamList>();

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectHome'>;

export function ProjectTabs({ route, navigation }: Props) {
  const { projectId, projectName } = route.params;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="h-14 flex-row items-center justify-between border-b border-hairline px-6">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back to projects"
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Main')}
          className="h-12 w-12 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-inter-bold text-[20px] text-ink" numberOfLines={1}>
          {projectName}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Project settings"
          activeOpacity={0.7}
          onPress={() => navigation.navigate('ProjectSettings', { projectId, projectName })}
          className="h-12 w-12 items-center justify-center"
        >
          <Ionicons name="settings-outline" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <Tab.Navigator
        screenOptions={({ route: tabRoute }) => ({
          headerShown: false,
          tabBarActiveTintColor: '#10b981',
          tabBarInactiveTintColor: '#b3b3b3',
          tabBarStyle: {
            backgroundColor: '#000000',
            borderTopColor: '#2a2a2a',
            borderTopWidth: 1,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? TAB_ICONS[tabRoute.name].filled : TAB_ICONS[tabRoute.name].outline}
              size={24}
              color={color}
            />
          ),
          tabBarLabel: ({ focused, color }) => (
            <Text
              className="font-inter-bold text-[11px] uppercase tracking-[1.2px]"
              style={{ color, marginTop: 4 }}
            >
              {tabRoute.name}
            </Text>
          ),
        })}
      >
        <Tab.Screen name="Capture" component={CaptureScreen} initialParams={{ projectId, projectName }} />
        <Tab.Screen name="Fields" component={FieldsScreen} initialParams={{ projectId, projectName }} />
        <Tab.Screen name="Data" component={DataScreen} initialParams={{ projectId, projectName }} />
      </Tab.Navigator>
    </SafeAreaView>
  );
}
