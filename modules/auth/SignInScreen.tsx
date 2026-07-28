import { FontAwesome, Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signInWithGithub, signInWithGoogle } from '../../lib/oauth';
import { supabase } from '../../lib/supabase';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

const INPUT_BASE =
  'min-h-[56px] border-2 px-4 font-inter text-lg text-ink';

export default function SignInScreen({ navigation }: Props) {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

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
    <SafeAreaView className="flex-1 justify-center bg-canvas px-6">
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Back to landing"
        activeOpacity={0.7}
        onPress={() => navigation.goBack()}
        className="absolute left-4 top-4 h-12 w-12 items-center justify-center rounded-full"
      >
        <Ionicons name="arrow-back" size={24} color="#ffffff" />
      </TouchableOpacity>

      <Text className="font-inter-extrabold text-[26px] uppercase leading-[1.1] tracking-[0.2px] text-ink">
        {mode === 'signIn' ? 'Log In' : 'Create Account'}
      </Text>

      <TextInput
        accessibilityLabel="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor="#7a7a7a"
        value={email}
        onChangeText={setEmail}
        onFocus={() => setEmailFocused(true)}
        onBlur={() => setEmailFocused(false)}
        className={`mt-8 ${INPUT_BASE} ${emailFocused ? 'border-primary' : 'border-hairline-strong'}`}
      />

      <TextInput
        accessibilityLabel="Password"
        autoCapitalize="none"
        autoComplete={mode === 'signUp' ? 'new-password' : 'password'}
        placeholder="Password"
        placeholderTextColor="#7a7a7a"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        onFocus={() => setPasswordFocused(true)}
        onBlur={() => setPasswordFocused(false)}
        className={`mt-4 ${INPUT_BASE} ${passwordFocused ? 'border-primary' : 'border-hairline-strong'}`}
      />

      {mode === 'signUp' && (
        <TextInput
          accessibilityLabel="Confirm password"
          autoCapitalize="none"
          autoComplete="new-password"
          placeholder="Confirm password"
          placeholderTextColor="#7a7a7a"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          onFocus={() => setConfirmFocused(true)}
          onBlur={() => setConfirmFocused(false)}
          className={`mt-4 ${INPUT_BASE} ${confirmFocused ? 'border-primary' : 'border-hairline-strong'}`}
        />
      )}

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={mode === 'signIn' ? 'Log in' : 'Create account'}
        accessibilityState={{ disabled: loading }}
        activeOpacity={0.85}
        onPress={handleSubmit}
        disabled={loading}
        className={`mt-8 h-[56px] w-full items-center justify-center bg-primary px-6 ${loading ? 'opacity-60' : ''}`}
      >
        {loading ? (
          <ActivityIndicator color="#03140d" />
        ) : (
          <Text className="font-inter-bold text-[13px] uppercase tracking-[1.2px] text-primary-on">
            {mode === 'signIn' ? 'Log In' : 'Create Account'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={mode === 'signIn' ? 'Switch to create account' : 'Switch to log in'}
        accessibilityState={{ disabled: loading }}
        activeOpacity={0.7}
        onPress={() => {
          setMode(mode === 'signIn' ? 'signUp' : 'signIn');
          setConfirmPassword('');
        }}
        disabled={loading}
        className={`mt-4 min-h-[48px] items-center justify-center px-6 ${loading ? 'opacity-60' : ''}`}
      >
        <Text className="font-inter text-base text-primary">
          {mode === 'signIn' ? "Don't have an account? Create one" : 'Already have an account? Log in'}
        </Text>
      </TouchableOpacity>

      <View className="mt-6 flex-row items-center">
        <View className="h-px flex-1 bg-hairline" />
        <Text className="mx-4 font-inter text-sm text-muted">or</Text>
        <View className="h-px flex-1 bg-hairline" />
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        accessibilityState={{ disabled: loading }}
        activeOpacity={0.7}
        onPress={() => handleOAuth('google')}
        disabled={loading}
        className={`mt-4 h-[56px] w-full flex-row items-center justify-center border-2 border-hairline-strong px-6 ${loading ? 'opacity-60' : ''}`}
      >
        <FontAwesome name="google" size={20} color="#ffffff" />
        <Text className="ml-3 font-inter-bold text-[13px] uppercase tracking-[1.2px] text-ink">
          Continue with Google
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Continue with GitHub"
        accessibilityState={{ disabled: loading }}
        activeOpacity={0.7}
        onPress={() => handleOAuth('github')}
        disabled={loading}
        className={`mt-4 h-[56px] w-full flex-row items-center justify-center border-2 border-hairline-strong px-6 ${loading ? 'opacity-60' : ''}`}
      >
        <FontAwesome name="github" size={20} color="#ffffff" />
        <Text className="ml-3 font-inter-bold text-[13px] uppercase tracking-[1.2px] text-ink">
          Continue with GitHub
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
