import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { goBack, Screen, ScreenHeader } from '../components/layout';
import { Button, Field, Icon, Row, T } from '../components/ui';
import { toast } from '../store/toast';
import { useApp } from '../store/useApp';
import { colors } from '../theme';

function strength(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}

export default function ForgotPassword() {
  const savedEmail = useApp((s) => s.user.email);
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState(savedEmail);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState<string>();
  const [pwError, setPwError] = useState<string>();
  const st = strength(pw);
  const label = ['Too weak', 'Weak', 'Okay', 'Strong', 'Very strong'][st];

  return (
    <Screen keyboard header={<ScreenHeader onBack={() => (step > 0 && step < 3 ? setStep(step - 1) : goBack('/login'))} />} contentStyle={{ paddingHorizontal: 24, gap: 22 }}>
      <Row gap={6} accessibilityLabel={`Step ${Math.min(step + 1, 3)} of 3`}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= step ? colors.brand : colors.track }} />
        ))}
      </Row>

      {step === 0 ? (
        <>
          <View style={{ gap: 8 }}>
            <T v="h1">Forgot password?</T>
            <T v="body" color={colors.muted}>Enter the email you registered with and we’ll send you a reset link.</T>
          </View>
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" icon="email-outline" error={error} />
          <Button title="Send reset link" onPress={() => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? (setError(undefined), setStep(1)) : setError('Enter a valid email'))} />
        </>
      ) : null}

      {step === 1 ? (
        <>
          <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="send-outline" size={32} color={colors.brand} />
          </View>
          <View style={{ gap: 8 }}>
            <T v="h1">Check your inbox</T>
            <T v="body" color={colors.muted}>We sent a reset link to <T v="bodyBold">{email}</T>. It expires in 30 minutes.</T>
          </View>
          <Button title="I’ve opened the link" onPress={() => setStep(2)} />
          <T v="small">No email? Check your spam folder or send it again.</T>
          <Button title="Resend link" variant="ghost" size="md" onPress={() => toast(`Reset link sent again to ${email.trim()}`)} />
          <Button title="Use a different email" variant="ghost" size="md" onPress={() => setStep(0)} />
        </>
      ) : null}

      {step === 2 ? (
        <>
          <T v="h1">Create a new password</T>
          <Field label="New password" value={pw} onChangeText={(t) => { setPw(t); setPwError(undefined); setError(undefined); }} secureTextEntry autoComplete="new-password" error={pwError} />
          <View style={{ gap: 8 }}>
            <Row gap={6}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < st ? (st >= 3 ? colors.success : colors.warningStrong) : colors.track }} />
              ))}
            </Row>
            <T v="smallBold" color={st >= 3 ? colors.success : colors.warning}>{pw ? label : 'Use 8+ characters with numbers and symbols'}</T>
          </View>
          <Field label="Confirm password" value={pw2} onChangeText={(t) => { setPw2(t); setError(undefined); }} secureTextEntry autoComplete="new-password" error={error} />
          <Button
            title="Save password"
            onPress={() => {
              if (pw.length < 8 || st < 2) return setPwError('Use at least 8 characters with a mix of letters, numbers or symbols');
              if (pw !== pw2) return setError('Passwords don’t match');
              setPwError(undefined);
              setError(undefined);
              setStep(3);
              toast('Password updated');
            }}
          />
        </>
      ) : null}

      {step === 3 ? (
        <View style={{ alignItems: 'center', gap: 16, paddingTop: 48 }}>
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={44} color={colors.white} />
          </View>
          <T v="h2">Password updated</T>
          <T v="body" color={colors.muted} center>You can now sign in with your new password.</T>
          <Button title="Back to sign in" full onPress={() => router.replace('/login')} style={{ marginTop: 16 }} />
        </View>
      ) : null}
    </Screen>
  );
}
