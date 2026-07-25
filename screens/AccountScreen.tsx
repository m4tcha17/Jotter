import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../lib/supabase';
import type { MainTabParamList } from '../navigation/MainTabs';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Account'>,
  NativeStackScreenProps<RootStackParamList>
>;

function formatProvider(provider: string) {
  if (provider === 'github') return 'GitHub';
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export default function AccountScreen({ navigation }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    // getSession() reads the cached local session — offline-first, unlike
    // getUser(), which always round-trips to the Auth server.
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    // supabase-js's signOut() always POSTs /logout, even at scope: 'local' — scope only
    // changes what the server revokes, it doesn't skip the request. That request has no
    // built-in timeout, so on poor/no connectivity it can hang indefinitely. Race it
    // against a short timeout and proceed locally either way: matches this app's
    // offline-first stance that server sync is best-effort, never a hard dependency for
    // a core flow like signing out.
    const result = await Promise.race([
      supabase.auth.signOut({ scope: 'local' }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);
    setSigningOut(false);

    if (result?.error) {
      Alert.alert('Could not sign out', result.error.message);
      return;
    }

    // Don't rely solely on App.tsx's reactive session listener to redirect —
    // reset the root stack directly so this is immediate and guaranteed.
    navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Landing' }] });
  }

  if (!user) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator size="large" color="#10b981" />
      </SafeAreaView>
    );
  }

  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: 'Account type', value: user.is_anonymous ? 'Guest' : 'Registered' },
    { label: 'Sign-in method', value: formatProvider(user.app_metadata?.provider ?? 'unknown') },
    { label: 'Email', value: user.email ?? 'None' },
    { label: 'User ID', value: user.id, mono: true },
  ];

  return (
    <SafeAreaView className="flex-1 bg-canvas px-6 pt-8">
      <Text className="font-inter-extrabold text-[26px] uppercase leading-[1.1] tracking-[0.2px] text-ink">
        Account
      </Text>

      <View className="mt-6 w-full bg-surface-card px-4">
        {rows.map((row, index) => (
          <View
            key={row.label}
            className={`flex-row items-center justify-between py-3 ${
              index < rows.length - 1 ? 'border-b border-hairline' : ''
            }`}
          >
            <Text className="font-inter text-base text-body">{row.label}</Text>
            <Text
              className="ml-4 flex-shrink text-right font-inter text-base text-body-strong"
              numberOfLines={1}
              ellipsizeMode={row.mono ? 'middle' : 'tail'}
            >
              {row.value}
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        accessibilityState={{ disabled: signingOut }}
        activeOpacity={0.7}
        onPress={handleSignOut}
        disabled={signingOut}
        className={`mt-8 h-[56px] w-full items-center justify-center border-2 border-hairline-strong px-6 ${
          signingOut ? 'opacity-60' : ''
        }`}
      >
        {signingOut ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-ink">Sign Out</Text>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}
