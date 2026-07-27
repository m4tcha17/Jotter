import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deleteProject } from '../lib/projects';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectSettings'>;

export default function ProjectSettingsScreen({ route, navigation }: Props) {
  const { projectId, projectName } = route.params;
  const [deleting, setDeleting] = useState(false);

  function handleDelete() {
    Alert.alert(
      'Delete this project?',
      `"${projectName}" and everything in it — fields, categories, and any samples — will be permanently deleted. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteProject(projectId);
              navigation.replace('Main');
            } catch (err) {
              setDeleting(false);
              Alert.alert('Could not delete project', err instanceof Error ? err.message : 'Something went wrong.');
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white px-6 pt-6">
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => navigation.goBack()}
        className="min-h-[44px] w-11 items-center justify-center"
      >
        <Ionicons name="arrow-back" size={24} color="#334155" />
      </TouchableOpacity>

      <Text className="mt-2 text-3xl font-bold text-slate-900">{projectName}</Text>
      <Text className="mt-1 text-base text-slate-500">Project settings</Text>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Delete project"
        onPress={handleDelete}
        disabled={deleting}
        className="mt-8 min-h-[48px] items-center justify-center rounded-xl border-2 border-red-300 px-6"
      >
        {deleting ? (
          <ActivityIndicator color="#DC2626" />
        ) : (
          <Text className="text-base font-semibold text-red-600">Delete Project</Text>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}
