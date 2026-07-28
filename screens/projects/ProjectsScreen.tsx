import { Ionicons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect, type CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchProjects } from '../../lib/projects';
import type { Project } from '../../lib/projects';
import type { MainTabParamList } from '../../navigation/MainTabs';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Projects'>,
  NativeStackScreenProps<RootStackParamList>
>;

const SKELETON_ROW_WIDTHS: `${number}%`[] = ['70%', '52%', '64%', '45%', '58%'];

function useSkeletonPulse() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] });
}

function ProjectsSkeleton() {
  const opacity = useSkeletonPulse();

  return (
    <SafeAreaView className="flex-1 bg-canvas px-6 pt-8">
      <View className="flex-row items-center justify-between">
        <Animated.View style={{ opacity }} className="h-6 w-32 bg-surface-elevated" />
        <Animated.View style={{ opacity }} className="h-11 w-20 bg-surface-elevated" />
      </View>

      <View className="mt-6 bg-surface-card">
        {SKELETON_ROW_WIDTHS.map((width, index) => (
          <View
            key={width + index}
            className={`flex-row items-center justify-between px-4 py-4 ${
              index < SKELETON_ROW_WIDTHS.length - 1 ? 'border-b border-hairline' : ''
            }`}
          >
            <View className="flex-shrink flex-row items-center pr-3">
              <Animated.View style={{ opacity }} className="h-3 w-3 rounded-full bg-surface-elevated" />
              <Animated.View style={{ opacity, width }} className="ml-3 h-4 bg-surface-elevated" />
            </View>
            <Animated.View style={{ opacity }} className="h-3 w-3 bg-surface-elevated" />
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

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
    return <ProjectsSkeleton />;
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
            activeOpacity={0.6}
            onPress={() => navigation.navigate('ProjectHome', { projectId: item.id, projectName: item.name })}
            className="flex-row items-center justify-between bg-surface-card px-4 py-4"
          >
            <View className="flex-shrink flex-row items-center pr-3">
              <View
                style={{ backgroundColor: item.color ?? '#64748B' }}
                className="h-3 w-3 rounded-full border border-hairline-strong"
              />
              <Text className="ml-3 flex-shrink font-inter-bold text-base text-body-strong" numberOfLines={1}>
                {item.name}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#7a7a7a" />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
