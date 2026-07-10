import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Landing'>;

export default function LandingScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleContinueAsGuest() {
    setLoading(true);
    const { error } = await supabase.auth.signInAnonymously();
    setLoading(false);
    if (error) {
      Alert.alert('Could not continue as guest', error.message);
      return;
    }
    navigation.replace('Main');
  }

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-4xl font-bold text-slate-900">DataSnap</Text>
      <Text className="mt-2 text-center text-lg text-slate-500">
        Capture photos, log data, export to CSV.
      </Text>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Continue as guest"
        onPress={handleContinueAsGuest}
        disabled={loading}
        className="mt-12 min-h-[56px] w-full items-center justify-center rounded-xl bg-emerald-600 px-6"
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-lg font-semibold text-white">Continue as Guest</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Log in"
        onPress={() => navigation.navigate('SignIn')}
        disabled={loading}
        className="mt-4 min-h-[56px] w-full items-center justify-center rounded-xl border-2 border-slate-300 px-6"
      >
        <Text className="text-lg font-semibold text-slate-700">Log In</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
