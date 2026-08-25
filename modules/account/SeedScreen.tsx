import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../lib/supabase';
import { hasSeeded, markSeeded, seedFromSupabase } from './seed';

type Props = { onComplete: () => void };

export default function SeedScreen({ onComplete }: Props) {
  const [status, setStatus] = useState<'checking' | 'seeding' | 'error'>('checking');

  const run = useCallback(async () => {
    setStatus('checking');
    try {
      if (await hasSeeded()) {
        onComplete();
        return;
      }
      setStatus('seeding');
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        onComplete();
        return;
      }
      await seedFromSupabase(session.user.id);
      await markSeeded();
      onComplete();
    } catch {
      setStatus('error');
    }
  }, [onComplete]);

  useEffect(() => {
    run();
  }, [run]);

  if (status === 'error') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6">
        <Text className="text-center font-inter-bold text-base text-body-strong">
          Could not set up your data. Check your connection and try again.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Retry setup"
          activeOpacity={0.85}
          onPress={run}
          className="mt-6 h-[56px] w-full items-center justify-center bg-primary"
        >
          <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-primary-on">Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Skip setup for now"
          activeOpacity={0.7}
          onPress={onComplete}
          className="mt-4 h-12 items-center justify-center"
        >
          <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-body">Skip for now</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6">
      <ActivityIndicator size="large" color="#10b981" />
      <Text className="mt-6 text-center font-inter-bold text-base text-body-strong">Setting up your data…</Text>
    </SafeAreaView>
  );
}
