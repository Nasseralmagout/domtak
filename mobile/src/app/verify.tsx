import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { goBack, Screen, ScreenHeader } from '../components/layout';
import { Button, Icon, Segmented, T } from '../components/ui';
import { safeNext } from '../lib/access';
import { toast } from '../store/toast';
import { useApp } from '../store/useApp';
import { colors, fonts } from '../theme';

/** "+49 151 2345 4821" -> "+•• ••• •••• 4821": hide every digit except the last four, keeping the spacing. */
function maskPhone(p: string) {
  let seen = 0;
  return p
    .split('')
    .reverse()
    .map((ch) => (/\d/.test(ch) ? (seen++ < 4 ? ch : '•') : ch))
    .reverse()
    .join('');
}

export default function Verify() {
  const params = useLocalSearchParams<{ email?: string; phone?: string; next?: string }>();
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
  const target = by === 'email' ? email : maskPhone(phone);

  const submit = () => {
    if (code.length !== 6) return setError('Enter all 6 digits');
    setError(undefined);
    toast(by === 'email' ? 'Email verified' : 'Phone number verified');
    // Next: city and music interests, then the profile. A sign-in destination travels along.
    const next = safeNext(params.next);
    router.replace({ pathname: '/role', params: next ? { next } : {} });
  };
  const resend = () => {
    setSeconds(42);
    setCode('');
    toast(`New code sent to ${target}`);
    input.current?.focus();
  };

  return (
    <Screen keyboard header={<ScreenHeader onBack={() => goBack('/register')} />} contentStyle={{ paddingHorizontal: 24, gap: 22 }}>
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

      <Pressable accessibilityRole="button" accessibilityLabel={`Verification code, ${code.length} of 6 digits entered`} onPress={() => input.current?.focus()} style={{ flexDirection: 'row', gap: 10 }}>
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
        onChangeText={(t) => { setCode(t.replace(/\D/g, '').slice(0, 6)); setError(undefined); }}
        onSubmitEditing={submit}
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
        <Pressable accessibilityRole="button" onPress={resend} hitSlop={12} style={{ alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' }}>
          <T v="bodyBold" color={colors.brand}>Resend code</T>
        </Pressable>
      )}
      <View style={{ flex: 1 }} />
      <Button title="Verify" disabled={code.length !== 6} onPress={submit} />
      <T v="small" center>Demo: any 6 digits will work.</T>
    </Screen>
  );
}
