import { FontAwesome } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signInWithGithub, signInWithGoogle } from '../lib/oauth';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

export default function SignInScreen({ navigation }: Props) {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email || !password) {
      Alert.alert('Missing info', 'Enter your email and password.');
      return;
    }

    if (mode === 'signUp' && password !== confirmPassword) {
      Alert.alert("Passwords don't match", 'Make sure both password fields are the same.');
      return;
    }

    setLoading(true);
    const { error } =
      mode === 'signIn'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert(mode === 'signIn' ? 'Could not log in' : 'Could not create account', error.message);
      return;
    }

    navigation.replace('Main');
  }

  async function handleOAuth(provider: 'google' | 'github') {
    setLoading(true);
    try {
      await (provider === 'google' ? signInWithGoogle() : signInWithGithub());
      navigation.replace('Main');
    } catch (err) {
      Alert.alert(
        `Could not continue with ${provider === 'google' ? 'Google' : 'GitHub'}`,
        err instanceof Error ? err.message : 'Something went wrong.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 justify-center bg-white px-6">
      <Text className="text-3xl font-bold text-slate-900">
        {mode === 'signIn' ? 'Log In' : 'Create Account'}
      </Text>

      <TextInput
        accessibilityLabel="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        className="mt-8 min-h-[56px] rounded-xl border-2 border-slate-300 px-4 text-lg text-slate-900"
      />

      <TextInput
        accessibilityLabel="Password"
        autoCapitalize="none"
        autoComplete={mode === 'signUp' ? 'new-password' : 'password'}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        className="mt-4 min-h-[56px] rounded-xl border-2 border-slate-300 px-4 text-lg text-slate-900"
      />

      {mode === 'signUp' && (
        <TextInput
          accessibilityLabel="Confirm password"
          autoCapitalize="none"
          autoComplete="new-password"
          placeholder="Confirm password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          className="mt-4 min-h-[56px] rounded-xl border-2 border-slate-300 px-4 text-lg text-slate-900"
        />
      )}

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={mode === 'signIn' ? 'Log in' : 'Create account'}
        onPress={handleSubmit}
        disabled={loading}
        className="mt-8 min-h-[56px] w-full items-center justify-center rounded-xl bg-emerald-600 px-6"
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-lg font-semibold text-white">
            {mode === 'signIn' ? 'Log In' : 'Create Account'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={mode === 'signIn' ? 'Switch to create account' : 'Switch to log in'}
        onPress={() => {
          setMode(mode === 'signIn' ? 'signUp' : 'signIn');
          setConfirmPassword('');
        }}
        disabled={loading}
        className="mt-4 min-h-[48px] items-center justify-center px-6"
      >
        <Text className="text-base font-semibold text-emerald-700">
          {mode === 'signIn' ? "Don't have an account? Create one" : 'Already have an account? Log in'}
        </Text>
      </TouchableOpacity>

      <Text className="mt-6 text-center text-base text-slate-400">or</Text>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        onPress={() => handleOAuth('google')}
        disabled={loading}
        className="mt-4 min-h-[56px] w-full flex-row items-center justify-center rounded-xl border-2 border-slate-300 px-6"
      >
        <FontAwesome name="google" size={20} color="#334155" />
        <Text className="ml-3 text-lg font-semibold text-slate-700">Continue with Google</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Continue with GitHub"
        onPress={() => handleOAuth('github')}
        disabled={loading}
        className="mt-4 min-h-[56px] w-full flex-row items-center justify-center rounded-xl border-2 border-slate-300 px-6"
      >
        <FontAwesome name="github" size={20} color="#334155" />
        <Text className="ml-3 text-lg font-semibold text-slate-700">Continue with GitHub</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
