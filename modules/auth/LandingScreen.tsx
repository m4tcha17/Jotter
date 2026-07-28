import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../lib/supabase';
import type { RootStackParamList } from '../../navigation/RootNavigator';

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
    <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6">
      <Text className="text-center font-inter-black text-[32px] uppercase leading-[1.05] tracking-[0.2px] text-ink">
        Jotter
      </Text>
      <View className="mt-3 h-[3px] w-16 flex-row overflow-hidden">
        <View className="flex-1 bg-calibration-amber" />
        <View className="flex-1 bg-calibration-green" />
        <View className="flex-1 bg-calibration-cyan" />
      </View>
      <Text className="mt-6 text-center font-inter-light text-base leading-[1.5] text-body">
        Capture photos, log data, export to CSV.
      </Text>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Continue as guest"
        accessibilityState={{ disabled: loading }}
        activeOpacity={0.85}
        onPress={handleContinueAsGuest}
        disabled={loading}
        className={`mt-12 h-[56px] w-full items-center justify-center bg-primary px-6 ${loading ? 'opacity-60' : ''}`}
      >
        {loading ? (
          <ActivityIndicator color="#03140d" />
        ) : (
          <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-primary-on">
            Continue as Guest
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Log in"
        accessibilityState={{ disabled: loading }}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('SignIn')}
        disabled={loading}
        className={`mt-4 h-[56px] w-full items-center justify-center border-2 border-hairline-strong px-6 ${loading ? 'opacity-60' : ''}`}
      >
        <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-ink">Log In</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
