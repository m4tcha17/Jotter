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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="mt-3 w-full flex-row justify-between border-b border-slate-100 pb-3">
      <Text className="text-base text-slate-500">{label}</Text>
      <Text className="text-base font-semibold text-slate-900">{value}</Text>
    </View>
  );
}

export default function AccountScreen({ navigation }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    // 'local' scope only clears this device's session — no server round-trip to revoke
    // every other session, so it's fast even on a slow/flaky connection. The default
    // ('global') scope was likely the cause of a long hang here on poor connectivity.
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    setSigningOut(false);

    if (error) {
      Alert.alert('Could not sign out', error.message);
      return;
    }

    // Don't rely solely on App.tsx's reactive session listener to redirect —
    // reset the root stack directly so this is immediate and guaranteed.
    navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Landing' }] });
  }

  if (!user) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  const provider = user.app_metadata?.provider ?? 'unknown';

  return (
    <SafeAreaView className="flex-1 bg-white px-6 pt-8">
      <Text className="text-2xl font-bold text-slate-900">Account</Text>

      <View className="mt-6 w-full rounded-xl border-2 border-slate-100 p-4">
        <InfoRow label="Account type" value={user.is_anonymous ? 'Guest' : 'Registered'} />
        <InfoRow label="Sign-in method" value={provider} />
        <InfoRow label="Email" value={user.email ?? 'None'} />
        <InfoRow label="User ID" value={user.id} />
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={handleSignOut}
        disabled={signingOut}
        className="mt-8 min-h-[48px] items-center justify-center rounded-xl border-2 border-slate-300 px-6"
      >
        {signingOut ? (
          <ActivityIndicator color="#334155" />
        ) : (
          <Text className="text-base font-semibold text-slate-700">Sign Out</Text>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}
