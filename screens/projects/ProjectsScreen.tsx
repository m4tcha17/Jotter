import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect, type CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchProjects } from '../../lib/projects';
import type { Project } from '../../lib/projects';
import type { MainTabParamList } from '../../navigation/MainTabs';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Projects'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function ProjectsScreen({ navigation }: Props) {
  const [projects, setProjects] = useState<Project[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchProjects()
        .then(setProjects)
        .catch(() => setProjects([]));
    }, []),
  );

  if (projects === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (projects.length === 0) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-2xl font-bold text-slate-900">Start Gathering Data</Text>
        <Text className="mt-2 text-center text-base text-slate-500">
          Create a project to define what you want to capture and log.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Start gathering data"
          onPress={() => navigation.navigate('CreateProject')}
          className="mt-8 min-h-[56px] w-full items-center justify-center rounded-xl bg-emerald-600 px-6"
        >
          <Text className="text-lg font-semibold text-white">Yes, let's start</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white px-6 pt-6">
      <View className="flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-slate-900">Projects</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="New project"
          onPress={() => navigation.navigate('CreateProject')}
          className="min-h-[44px] items-center justify-center rounded-xl bg-emerald-600 px-4"
        >
          <Text className="text-base font-semibold text-white">+ New</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        className="mt-4"
        data={projects}
        keyExtractor={(project) => project.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Open project ${item.name}`}
            onPress={() => navigation.navigate('ProjectHome', { projectId: item.id, projectName: item.name })}
            className="mb-3 min-h-[56px] flex-row items-center rounded-xl border-2 border-slate-100 px-4"
          >
            <View style={{ backgroundColor: item.color ?? '#64748B' }} className="mr-3 h-4 w-4 rounded-full" />
            <Text className="text-lg font-semibold text-slate-900">{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
