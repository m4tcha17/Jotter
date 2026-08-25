import './global.css';

import {
  Inter_300Light,
  Inter_400Regular,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
  useFonts,
} from '@expo-google-fonts/inter';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getDb } from './lib/db';
import { createSessionFromUrl } from './modules/auth/api';
import { flushPendingRevocations, supabase } from './lib/supabase';
import SeedScreen from './modules/account/SeedScreen';
import { RootNavigator } from './navigation/RootNavigator';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [fontsLoaded] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setLoading(false);
    });

    flushPendingRevocations().catch(() => {});

    getDb().catch((err) => setDbError(err instanceof Error ? err.message : 'Something went wrong.'));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });

    // Backstop for the GitHub OAuth redirect landing outside the in-flight
    // WebBrowser auth session (e.g. the app was backgrounded mid-flow).
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      createSessionFromUrl(url).catch(() => {});
    });

    return () => {
      listener.subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  if (loading || !fontsLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (dbError) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas px-6">
        <Text className="text-center font-inter-bold text-base text-destructive">Jotter could not start.</Text>
        <Text className="mt-2 text-center font-inter-light text-sm text-body">{dbError}</Text>
      </View>
    );
  }

  if (hasSession && !seeded) {
    return (
      <SafeAreaProvider>
        <SeedScreen onComplete={() => setSeeded(true)} />
        <StatusBar style="light" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator key={hasSession ? 'authed' : 'guest'} initialRouteName={hasSession ? 'Main' : 'Landing'} />
      </NavigationContainer>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
