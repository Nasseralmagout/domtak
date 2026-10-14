import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { goBack, Screen, ScreenHeader } from '../components/layout';
import { Button, Field, Icon, Row, T } from '../components/ui';
import { useApp } from '../store/useApp';
import { colors, fonts } from '../theme';

export default function Register() {
  const registerUser = useApp((s) => s.register);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Enter your full name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email';
    if (phone.replace(/\D/g, '').length < 7) e.phone = 'Enter a valid phone number';
    if (password.length < 8) e.password = 'Use at least 8 characters';
    if (!agree) e.agree = 'Please accept the Terms and Conditions';
    setErrors(e);
    if (Object.keys(e).length) return;
    const handle = '@' + (name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '') || 'domtaker');
    registerUser({ name: name.trim(), email: email.trim(), phone: phone.trim(), handle });
    router.push({ pathname: '/verify', params: { email: email.trim(), phone: phone.trim() } });
  };

  return (
    <Screen keyboard header={<ScreenHeader onBack={() => goBack('/login')} />} contentStyle={{ paddingHorizontal: 24, gap: 16 }}>
      <View style={{ alignItems: 'center', gap: 4, marginBottom: 8 }}>
        <T v="h1" style={{ fontSize: 34, lineHeight: 42, fontFamily: fonts.displayMedium }}>Get Started</T>
        <T v="body" color={colors.muted}>by creating a free account.</T>
      </View>
      <Field placeholder="Full name" accessibilityLabel="Full name" value={name} onChangeText={setName} icon="account-outline" autoComplete="name" error={errors.name} />
      <Field placeholder="Valid email" accessibilityLabel="Email" value={email} onChangeText={setEmail} icon="email-outline" keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={errors.email} />
      <Field placeholder="Phone number" accessibilityLabel="Phone number" value={phone} onChangeText={setPhone} icon="cellphone" keyboardType="phone-pad" autoComplete="tel" error={errors.phone} />
      <Field placeholder="Strong password" accessibilityLabel="Password, at least 8 characters" value={password} onChangeText={setPassword} icon="lock-outline" secureTextEntry autoComplete="new-password" error={errors.password} onSubmitEditing={submit} />
      <Pressable accessibilityRole="checkbox" accessibilityLabel="I agree to the Terms and Conditions" accessibilityState={{ checked: agree }} onPress={() => setAgree(!agree)} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 8 }}>
        <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.brand, backgroundColor: agree ? colors.brand : colors.surface, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
          {agree ? <Icon name="check" size={16} color={colors.white} /> : null}
        </View>
        <T v="small" color={colors.inkSoft} style={{ flex: 1 }}>
          By checking the box you agree to our Terms and Conditions.
        </T>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={() => router.push('/help?section=about')} hitSlop={8} style={{ alignSelf: 'flex-start', marginTop: -8 }}>
        <Text style={{ color: colors.brand, fontFamily: fonts.bodyBold, fontSize: 13 }}>Read the Terms and Conditions</Text>
      </Pressable>
      {errors.agree ? <T v="small" color={colors.danger}>{errors.agree}</T> : null}
      <Button title="Next" onPress={submit} style={{ borderRadius: 16 }} />
      <Row justify="center" gap={4}>
        <T v="body" color={colors.muted}>Already a member?</T>
        <Pressable accessibilityRole="link" onPress={() => router.replace('/login')} hitSlop={12}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.brand }}>Log In</Text>
        </Pressable>
      </Row>
    </Screen>
  );
}
