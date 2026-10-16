import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { goBack, Screen, ScreenHeader } from '../components/layout';
import { Banner, Button, Card, Field, Icon, Row, T } from '../components/ui';
import { safeNext } from '../lib/access';
import { useApp } from '../store/useApp';
import { colors, fonts } from '../theme';

const TERMS = [
  'You must be 16 or older to use Domtak, and 18+ for events marked 18+.',
  'When you book an artist or venue, the payment stays pending until the provider decides. It is released or refunded if they decline or don’t answer within 24 hours.',
  'Everyone joins as a member. Artists, venues and organizers apply for a professional account, which our team reviews.',
  'Ticket refunds follow the organizer’s policy shown on each event page.',
  'Be respectful: harassment, fake profiles and ticket touting lead to removal.',
  'Your data is used only to run your account, payments and notifications.',
];

export default function Register() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const dest = safeNext(next);
  const registerUser = useApp((s) => s.register);
  const existingEmail = useApp((s) => s.user.email);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // The email this screen just registered: going back from verification and pressing Next again is not a duplicate.
  const [submitted, setSubmitted] = useState<string>();
  const [duplicate, setDuplicate] = useState(false);

  const submit = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Enter your full name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email';
    if (phone.replace(/\D/g, '').length < 7) e.phone = 'Enter a valid phone number';
    if (password.length < 8) e.password = 'Use at least 8 characters';
    if (!agree) e.agree = 'Please accept the Terms and Conditions';
    setErrors(e);
    if (Object.keys(e).length) return;
    const mail = email.trim().toLowerCase();
    // The account saved on this device already uses this email: offer sign-in or recovery instead.
    const taken = mail === existingEmail.trim().toLowerCase() && mail !== submitted;
    setDuplicate(taken);
    if (taken) return;
    setSubmitted(mail);
    const handle = '@' + (name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '') || 'domtaker');
    registerUser({ name: name.trim(), email: email.trim(), phone: phone.trim(), handle });
    router.push({ pathname: '/verify', params: { email: email.trim(), phone: phone.trim(), ...(dest ? { next: dest } : {}) } });
  };

  return (
    <Screen keyboard header={<ScreenHeader onBack={() => goBack('/login')} />} contentStyle={{ paddingHorizontal: 24, gap: 16 }}>
      <View style={{ alignItems: 'center', gap: 4, marginBottom: 8 }}>
        <T v="h1" style={{ fontSize: 34, lineHeight: 42, fontFamily: fonts.displayMedium }}>Get Started</T>
        <T v="body" color={colors.muted}>by creating a free member account.</T>
      </View>
      <Field placeholder="Full name" accessibilityLabel="Full name" value={name} onChangeText={setName} icon="account-outline" autoComplete="name" error={errors.name} />
      <Field placeholder="Valid email" accessibilityLabel="Email" value={email} onChangeText={(t) => { setEmail(t); setDuplicate(false); }} icon="email-outline" keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={errors.email} />
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
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showTerms }} onPress={() => setShowTerms(!showTerms)} hitSlop={8} style={{ alignSelf: 'flex-start', marginTop: -8, minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text style={{ color: colors.brand, fontFamily: fonts.bodyBold, fontSize: 13 }}>{showTerms ? 'Hide the Terms and Conditions' : 'Read the Terms and Conditions'}</Text>
        <Icon name={showTerms ? 'chevron-up' : 'chevron-down'} size={18} color={colors.brand} />
      </Pressable>
      {showTerms ? (
        <Card style={{ gap: 8 }}>
          <T v="title">Terms in short</T>
          {TERMS.map((t) => (
            <Row key={t} gap={8} align="flex-start">
              <Icon name="check" size={16} color={colors.brand} />
              <T v="small" style={{ flex: 1 }}>{t}</T>
            </Row>
          ))}
          <Pressable accessibilityRole="link" onPress={() => router.push('/legal')} hitSlop={8} style={{ minHeight: 32, justifyContent: 'center', alignSelf: 'flex-start' }}>
            <Text style={{ color: colors.brand, fontFamily: fonts.bodyBold, fontSize: 13 }}>Full terms, privacy and imprint</Text>
          </Pressable>
        </Card>
      ) : null}
      {errors.agree ? <T v="small" color={colors.danger}>{errors.agree}</T> : null}
      {duplicate ? (
        <Card style={{ gap: 10 }}>
          <Row gap={10} align="flex-start">
            <Icon name="account-alert-outline" size={22} color={colors.warning} />
            <View style={{ flex: 1, gap: 2 }}>
              <T v="bodyBold">This email already has an account</T>
              <T v="small">Sign in with it, or reset the password if you no longer know it.</T>
            </View>
          </Row>
          <Row gap={10}>
            <Button title="Sign in" size="md" style={{ flex: 1 }} onPress={() => router.replace({ pathname: '/login', params: dest ? { next: dest } : {} })} />
            <Button title="Reset password" size="md" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/forgot-password')} />
          </Row>
        </Card>
      ) : null}
      <Button title="Next" onPress={submit} style={{ borderRadius: 16 }} />
      <Banner icon="briefcase-outline">Artist, band, DJ, venue or organizer? Sign up first; you can apply for a professional account in the next steps.</Banner>
      <Row justify="center" gap={4}>
        <T v="body" color={colors.muted}>Already a member?</T>
        <Pressable accessibilityRole="link" onPress={() => router.replace({ pathname: '/login', params: dest ? { next: dest } : {} })} hitSlop={12} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.brand }}>Log In</Text>
        </Pressable>
      </Row>
    </Screen>
  );
}
