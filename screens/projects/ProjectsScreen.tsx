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
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator size="large" color="#10b981" />
      </SafeAreaView>
    );
  }

  if (projects.length === 0) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6">
        <Text className="text-center font-inter-extrabold text-[26px] uppercase leading-[1.1] tracking-[0.2px] text-ink">
          Start Gathering Data
        </Text>
        <Text className="mt-3 text-center font-inter-light text-base text-body">
          Create a project to define what you want to capture and log.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Start gathering data"
          activeOpacity={0.85}
          onPress={() => navigation.navigate('CreateProject')}
          className="mt-10 h-[56px] w-full items-center justify-center bg-primary px-6"
        >
          <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-primary-on">
            Yes, Let's Start
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas px-6 pt-8">
      <View className="flex-row items-center justify-between">
        <Text className="font-inter-extrabold text-[26px] uppercase leading-[1.1] tracking-[0.2px] text-ink">
          Projects
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="New project"
          activeOpacity={0.7}
          onPress={() => navigation.navigate('CreateProject')}
          className="h-11 items-center justify-center border-2 border-hairline-strong px-4"
        >
          <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-ink">+ New</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        className="mt-6"
        data={projects}
        keyExtractor={(project) => project.id}
        ItemSeparatorComponent={() => <View className="h-px bg-hairline" />}
        renderItem={({ item }) => (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Open project ${item.name}`}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('ProjectHome', { projectId: item.id, projectName: item.name })}
            className="h-14 flex-row items-center bg-surface-card px-4"
          >
            <View style={{ backgroundColor: item.color ?? '#64748B' }} className="mr-3 h-4 w-4 rounded-full" />
            <Text className="font-inter-bold text-base text-body-strong">{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
