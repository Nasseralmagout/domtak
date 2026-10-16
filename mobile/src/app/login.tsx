import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Screen } from '../components/layout';
import { Banner, Button, Field, Icon, IconButton, Photo, Row, T } from '../components/ui';
import { safeNext } from '../lib/access';
import { toast } from '../store/toast';
import { useApp } from '../store/useApp';
import { colors, fonts } from '../theme';

export default function Login() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  // Where to go after signing in (an expired session returns to the screen that was open).
  const dest = safeNext(next);
  const signIn = useApp((s) => s.signIn);
  const approvedRoles = useApp((s) => s.user.approvedRoles);
  const savedEmail = useApp((s) => s.user.email);
  // Saved right away: without it, the next app launch starts signed out.
  const remember = useApp((s) => s.prefs.rememberMe);
  const setPref = useApp((s) => s.setPref);
  const [email, setEmail] = useState(savedEmail);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string>();

  // F04: restore the intended destination, else let accounts with several workspaces pick one.
  const enter = () => {
    if (dest) router.replace(dest as never);
    else if ((approvedRoles ?? []).some((r) => r !== 'fan')) router.replace({ pathname: '/workspace', params: { signin: '1' } });
    else router.replace('/(tabs)');
  };

  const submit = () => {
    const e = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return setError('Enter a valid email address');
    if (password.length < 6) return setError('Password must be at least 6 characters');
    setError(undefined);
    signIn(e, remember);
    toast(remember ? 'Welcome back! You’ll stay signed in on this device.' : 'Welcome back! You’ll be signed out when you close the app.');
    enter();
  };
  const social = (provider: 'Google' | 'Apple') => {
    signIn(email.includes('@') ? email.trim() : savedEmail, remember);
    toast(`Signed in with ${provider}`);
    enter();
  };

  return (
    <Screen keyboard contentStyle={{ paddingHorizontal: 24, paddingTop: 32, gap: 18 }}>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <T v="h2" color={colors.muted} style={{ fontFamily: fonts.displayMedium }}>Welcome</T>
        <Photo src="logo" contentFit="contain" style={{ width: 190, height: 190, backgroundColor: 'transparent' }} accessibilityLabel="Domtak logo" />
        <T v="body" color={colors.muted}>Sign in to access your account</T>
      </View>
      {dest ? <Banner icon="lock-clock">Sign in to continue to the page you opened.</Banner> : null}

      <Field placeholder="Enter your email" accessibilityLabel="Email" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" returnKeyType="next" value={email} onChangeText={(t) => { setEmail(t); setError(undefined); }} icon="email-outline" />
      <Field
        placeholder="Password"
        accessibilityLabel="Password"
        secureTextEntry={!show}
        autoComplete="password"
        textContentType="password"
        returnKeyType="go"
        value={password}
        onChangeText={(t) => { setPassword(t); setError(undefined); }}
        onSubmitEditing={submit}
        right={<IconButton name={show ? 'eye-off-outline' : 'eye-outline'} label={show ? 'Hide password' : 'Show password'} size={40} iconSize={20} color={colors.muted} onPress={() => setShow(!show)} />}
      />
      {error ? <T v="small" color={colors.danger} accessibilityLiveRegion="polite">{error}</T> : null}

      <Row justify="space-between">
        <Pressable accessibilityRole="checkbox" accessibilityLabel="Remember me" accessibilityHint="Keeps you signed in after the app restarts" accessibilityState={{ checked: remember }} onPress={() => setPref('rememberMe', !remember)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
          <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: colors.brand, backgroundColor: remember ? colors.brand : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
            {remember ? <Icon name="check" size={14} color={colors.white} /> : null}
          </View>
          <T v="small" color={colors.inkSoft}>Remember me</T>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => router.push('/forgot-password')} hitSlop={12} style={{ minHeight: 44, justifyContent: 'center' }}>
          <T v="smallBold" color={colors.brand}>Forgot password?</T>
        </Pressable>
      </Row>

      <Button title="Next" icon="chevron-right" onPress={submit} style={{ borderRadius: 16, flexDirection: 'row-reverse' }} />

      <Row gap={12}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <T v="small">or continue with</T>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </Row>
      <Row gap={12}>
        <Button title="Google" accessibilityLabel="Continue with Google" icon="google" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => social('Google')} />
        <Button title="Apple" accessibilityLabel="Continue with Apple" icon="apple" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => social('Apple')} />
      </Row>

      <Row justify="center" gap={4} style={{ marginTop: 8 }}>
        <T v="body" color={colors.muted}>New member?</T>
        <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/register', params: dest ? { next: dest } : {} })} hitSlop={12} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.brand }}>Register now</Text>
        </Pressable>
      </Row>
    </Screen>
  );
}
