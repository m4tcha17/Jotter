import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deleteProject } from '../lib/projects';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectHome'>;

export default function ProjectHomeScreen({ route, navigation }: Props) {
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

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Delete project"
        onPress={handleDelete}
        disabled={deleting}
        className="mt-4 min-h-[48px] items-center justify-center rounded-xl border-2 border-red-300 px-6"
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
