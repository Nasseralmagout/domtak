import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Screen } from '../components/layout';
import { Button, Field, Icon, IconButton, Photo, Row, T } from '../components/ui';
import { useApp } from '../store/useApp';
import { colors, fonts } from '../theme';

export default function Login() {
  const signIn = useApp((s) => s.signIn);
  const savedEmail = useApp((s) => s.user.email);
  const [email, setEmail] = useState(savedEmail);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string>();

  const submit = () => {
    if (!email.includes('@')) return setError('Enter a valid email address');
    if (password.length < 6) return setError('Password must be at least 6 characters');
    setError(undefined);
    signIn(email.trim());
    router.replace('/(tabs)');
  };

  return (
    <Screen keyboard contentStyle={{ paddingHorizontal: 24, paddingTop: 32, gap: 18 }}>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <T v="h2" color={colors.muted} style={{ fontFamily: fonts.displayMedium }}>Welcome</T>
        <Photo src="logo" contentFit="contain" style={{ width: 190, height: 190, backgroundColor: 'transparent' }} accessibilityLabel="Domtak logo" />
        <T v="body" color={colors.muted}>Sign in to access your account</T>
      </View>

      <Field placeholder="Enter your email" keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email} onChangeText={setEmail} icon="email-outline" />
      <Field
        placeholder="Password"
        secureTextEntry={!show}
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={submit}
        right={<IconButton name={show ? 'eye-off-outline' : 'eye-outline'} label={show ? 'Hide password' : 'Show password'} size={40} iconSize={20} color={colors.muted} onPress={() => setShow(!show)} />}
      />
      {error ? <T v="small" color={colors.danger}>{error}</T> : null}

      <Row justify="space-between">
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: remember }} onPress={() => setRemember(!remember)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
          <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: colors.brand, backgroundColor: remember ? colors.brand : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
            {remember ? <Icon name="check" size={14} color={colors.white} /> : null}
          </View>
          <T v="small" color={colors.inkSoft}>Remember me</T>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => router.push('/forgot-password')} hitSlop={8}>
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
        <Button title="Google" icon="google" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => { signIn(email); router.replace('/(tabs)'); }} />
        <Button title="Apple" icon="apple" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => { signIn(email); router.replace('/(tabs)'); }} />
      </Row>

      <Row justify="center" gap={4} style={{ marginTop: 8 }}>
        <T v="body" color={colors.muted}>New member?</T>
        <Pressable accessibilityRole="link" onPress={() => router.push('/register')} hitSlop={8}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.brand }}>Register now</Text>
        </Pressable>
      </Row>
    </Screen>
  );
}
