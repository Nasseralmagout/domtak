import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen, ScreenHeader } from '../components/layout';
import { Banner, Button, Card, Divider, Field, Icon, type IconName, Row, T, Toggle } from '../components/ui';
import { toast } from '../store/toast';
import { useApp } from '../store/useApp';
import { colors } from '../theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CODE_RE = /^\d{6}$/;

type Contact = 'email' | 'phone';
type Change = { kind: Contact; value: string; step: 'enter' | 'code'; code: string; error?: string };
type Device = { id: string; icon: IconName; name: string; where: string; current?: boolean };

const DEVICES: Device[] = [
  { id: 'd1', icon: 'cellphone', name: 'This phone · Domtak for Android', where: 'Berlin · active now', current: true },
  { id: 'd2', icon: 'laptop', name: 'Chrome on macOS', where: 'Berlin · 2 days ago' },
  { id: 'd3', icon: 'tablet', name: 'iPad · Domtak', where: 'Hamburg · 3 weeks ago' },
];

/** Change email or phone: enter the new value, then confirm the 6-digit code we send to it. */
function ContactChange({ change, onChange, onCancel, onDone }: { change: Change; onChange: (c: Change) => void; onCancel: () => void; onDone: (value: string) => void }) {
  const email = change.kind === 'email';
  const send = () => {
    const v = change.value.trim();
    const ok = email ? EMAIL_RE.test(v) : v.replace(/[^\d]/g, '').length >= 8;
    if (!ok) return onChange({ ...change, error: email ? 'Enter a valid email address' : 'Enter a valid phone number with country code' });
    onChange({ ...change, value: v, step: 'code', code: '', error: undefined });
    toast(email ? `We sent a 6-digit code to ${v}` : `We texted a 6-digit code to ${v}`);
  };
  const confirm = () => {
    if (!CODE_RE.test(change.code)) return onChange({ ...change, error: 'Enter the 6-digit code' });
    onDone(change.value);
  };
  return (
    <View style={{ gap: 10, paddingTop: 4 }}>
      {change.step === 'enter' ? (
        <Field
          label={email ? 'New email' : 'New phone number'}
          value={change.value}
          onChangeText={(t) => onChange({ ...change, value: t, error: undefined })}
          placeholder={email ? 'name@example.com' : '+49 151 0000 0000'}
          keyboardType={email ? 'email-address' : 'phone-pad'}
          autoCapitalize="none"
          icon={email ? 'email-outline' : 'phone-outline'}
          error={change.error}
        />
      ) : (
        <Field
          label={`Code sent to ${change.value}`}
          value={change.code}
          onChangeText={(t) => onChange({ ...change, code: t.replace(/\D/g, '').slice(0, 6), error: undefined })}
          placeholder="6-digit code"
          keyboardType="number-pad"
          icon="shield-key-outline"
          error={change.error}
        />
      )}
      <Row gap={10}>
        <Button title="Cancel" variant="secondary" size="md" style={{ flex: 1 }} onPress={onCancel} />
        <Button title={change.step === 'enter' ? 'Send code' : 'Confirm'} size="md" style={{ flex: 1 }} onPress={change.step === 'enter' ? send : confirm} />
      </Row>
      {change.step === 'code' ? <T v="small">Demo: any 6 digits confirm the change.</T> : null}
    </View>
  );
}

export default function AccountSecurity() {
  const user = useApp((s) => s.user);
  const updateUser = useApp((s) => s.updateUser);
  const twoFactor = useApp((s) => s.prefs.twoFactor);
  const setPref = useApp((s) => s.setPref);
  const [change, setChange] = useState<Change>();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [pwError, setPwError] = useState<{ current?: string; next?: string; repeat?: string }>({});
  const [devices, setDevices] = useState(DEVICES);
  const [exportAsked, setExportAsked] = useState(false);

  const start = (kind: Contact) => setChange({ kind, value: '', step: 'enter', code: '' });
  const finish = (value: string) => {
    if (!change) return;
    updateUser(change.kind === 'email' ? { email: value } : { phone: value });
    toast(change.kind === 'email' ? 'Email updated' : 'Phone number updated');
    setChange(undefined);
  };

  const savePassword = () => {
    const e: typeof pwError = {};
    if (current.length < 6) e.current = 'Enter your current password';
    if (next.length < 8 || !/\d/.test(next) || !/[A-Za-z]/.test(next)) e.next = 'Use 8+ characters with letters and numbers';
    else if (next === current) e.next = 'Choose a password you haven’t used here';
    if (repeat !== next) e.repeat = 'The passwords don’t match';
    setPwError(e);
    if (Object.keys(e).length) return;
    setCurrent('');
    setNext('');
    setRepeat('');
    toast('Password changed. Other devices need the new password.');
  };

  const others = devices.filter((d) => !d.current);
  const signOutOthers = () => {
    setDevices(devices.filter((d) => d.current));
    toast(`Signed out of ${others.length} other device${others.length === 1 ? '' : 's'}`);
  };

  const rows: { kind: Contact; label: string; value: string; icon: IconName }[] = [
    { kind: 'email', label: 'Email', value: user.email, icon: 'email-outline' },
    { kind: 'phone', label: 'Phone', value: user.phone, icon: 'phone-outline' },
  ];

  return (
    <Screen keyboard header={<ScreenHeader title="Account & security" />}>
      <Card style={{ gap: 12 }}>
        <T v="title" accessibilityRole="header">Sign-in details</T>
        {rows.map((r, i) => (
          <View key={r.kind} style={{ gap: 8 }}>
            {i ? <Divider /> : null}
            <Row gap={12}>
              <Icon name={r.icon} size={22} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <T v="small">{r.label}</T>
                <T v="bodyBold" numberOfLines={1}>{r.value}</T>
              </View>
              {change?.kind !== r.kind ? <Button title="Change" variant="ghost" size="sm" accessibilityLabel={`Change ${r.label.toLowerCase()}`} onPress={() => start(r.kind)} /> : null}
            </Row>
            {change?.kind === r.kind ? <ContactChange change={change} onChange={setChange} onCancel={() => setChange(undefined)} onDone={finish} /> : null}
          </View>
        ))}
      </Card>

      <Card style={{ gap: 12 }}>
        <T v="title" accessibilityRole="header">Change password</T>
        <Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry icon="lock-outline" error={pwError.current} />
        <Field label="New password" value={next} onChangeText={setNext} secureTextEntry icon="lock-reset" error={pwError.next} />
        <Field label="Repeat new password" value={repeat} onChangeText={setRepeat} secureTextEntry icon="lock-check-outline" error={pwError.repeat} />
        <Button title="Update password" size="md" onPress={savePassword} />
        <Button title="Forgot your current password?" variant="ghost" size="sm" style={{ alignSelf: 'center' }} onPress={() => router.push('/forgot-password')} />
      </Card>

      <Card style={{ gap: 12 }}>
        <Row gap={12}>
          <View style={{ flex: 1 }}>
            <T v="bodyBold">Two-step verification</T>
            <T v="small">Ask for a code sent to {user.phone} when you sign in on a new device.</T>
          </View>
          <Toggle
            label="Two-step verification"
            value={twoFactor}
            onValueChange={(v) => {
              setPref('twoFactor', v);
              toast(v ? 'Two-step verification is on' : 'Two-step verification is off');
            }}
          />
        </Row>
      </Card>

      <Card style={{ gap: 12 }}>
        <T v="title" accessibilityRole="header">Where you’re signed in</T>
        {devices.map((d, i) => (
          <View key={d.id} style={{ gap: 10 }}>
            {i ? <Divider /> : null}
            <Row gap={12}>
              <Icon name={d.icon} size={22} color={d.current ? colors.success : colors.muted} />
              <View style={{ flex: 1 }}>
                <T v="bodyBold">{d.name}</T>
                <T v="small">{d.where}</T>
              </View>
            </Row>
          </View>
        ))}
        {others.length ? <Button title="Sign out of other devices" variant="secondary" size="md" icon="logout" onPress={signOutOthers} /> : <T v="small">Only this phone is signed in.</T>}
      </Card>

      <Card style={{ gap: 10 }}>
        <T v="title" accessibilityRole="header">Your data</T>
        <T v="small">Get a copy of your profile, posts, bookings, tickets and messages (GDPR).</T>
        <Button
          title={exportAsked ? 'Export requested' : 'Download my data'}
          icon={exportAsked ? 'check' : 'download-outline'}
          variant="secondary"
          size="md"
          disabled={exportAsked}
          onPress={() => {
            setExportAsked(true);
            toast(`We’ll email your data to ${user.email} within 48 hours`);
          }}
        />
      </Card>

      <Banner icon="shield-check-outline">Domtak will never ask for your password or a code by chat, phone or email.</Banner>
    </Screen>
  );
}
