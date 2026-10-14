import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Screen, ScreenHeader } from '../components/layout';
import { Button, Icon, Segmented, T } from '../components/ui';
import { useApp } from '../store/useApp';
import { colors, fonts } from '../theme';

export default function Verify() {
  const params = useLocalSearchParams<{ email?: string; phone?: string }>();
  const user = useApp((s) => s.user);
  const [by, setBy] = useState<'email' | 'phone'>('email');
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(42);
  const [error, setError] = useState<string>();
  const input = useRef<TextInput>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const email = params.email || user.email;
  const phone = params.phone || user.phone;
  const target = by === 'email' ? email : phone.replace(/\d(?=\d{4})/g, '•');

  const submit = () => {
    if (code.length !== 6) return setError('Enter all 6 digits');
    setError(undefined);
    router.replace('/role');
  };

  return (
    <Screen keyboard header={<ScreenHeader />} contentStyle={{ paddingHorizontal: 24, gap: 22 }}>
      <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={by === 'email' ? 'email-outline' : 'cellphone'} size={34} color={colors.brand} />
      </View>
      <View style={{ gap: 8 }}>
        <T v="h1">Verify your account</T>
        <T v="body" color={colors.muted}>
          Enter the 6-digit code we sent to <T v="bodyBold">{target}</T>
        </T>
      </View>
      <Segmented options={[{ key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone (SMS)' }]} value={by} onChange={(k) => { setBy(k); setCode(''); setSeconds(42); }} />

      <Pressable accessibilityLabel="Verification code" onPress={() => input.current?.focus()} style={{ flexDirection: 'row', gap: 10 }}>
        {Array.from({ length: 6 }).map((_, i) => {
          const filled = i < code.length;
          const active = i === code.length;
          return (
            <View key={i} style={{ flex: 1, height: 60, borderRadius: 14, borderWidth: filled || active ? 2 : 1, borderColor: filled || active ? colors.brand : colors.borderStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <T v="h2" style={{ fontFamily: fonts.displaySemi }}>{code[i] ?? ''}</T>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={input}
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoFocus
        maxLength={6}
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        accessibilityLabel="Verification code input"
        style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
      />
      {error ? <T v="small" color={colors.danger}>{error}</T> : null}

      {seconds > 0 ? (
        <T v="body" color={colors.muted}>Didn’t get it? <T v="bodyBold">Resend in 0:{String(seconds).padStart(2, '0')}</T></T>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setSeconds(42)}>
          <T v="bodyBold" color={colors.brand}>Resend code</T>
        </Pressable>
      )}
      <View style={{ flex: 1 }} />
      <Button title="Verify" onPress={submit} />
      <T v="small" center>Demo: any 6 digits will work.</T>
    </Screen>
  );
}
