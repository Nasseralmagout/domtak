import { router } from 'expo-router';
import { Alert, Platform, Pressable, View } from 'react-native';

import { Screen, ScreenHeader } from '../components/layout';
import { Button, Icon, Row, Segmented, T, Toggle } from '../components/ui';
import type { Role } from '../data/types';
import { ROLE_LABEL, useApp } from '../store/useApp';
import { colors, radius } from '../theme';

function LinkRow({ label, value, onPress, first }: { label: string; value?: string; onPress: () => void; first?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingHorizontal: 16, borderTopWidth: first ? 0 : 1, borderTopColor: colors.divider }}>
      <T v="body" style={{ flex: 1 }}>{label}</T>
      {value ? <T v="small" numberOfLines={1} style={{ maxWidth: 160 }}>{value}</T> : null}
      <Icon name="chevron-right" size={20} color={colors.subtle} />
    </Pressable>
  );
}

function ToggleRow({ label, value, onChange, first }: { label: string; value: boolean; onChange: (v: boolean) => void; first?: boolean }) {
  return (
    <Row gap={12} style={{ minHeight: 54, paddingHorizontal: 16, borderTopWidth: first ? 0 : 1, borderTopColor: colors.divider }}>
      <T v="body" style={{ flex: 1 }}>{label}</T>
      <Toggle label={label} value={value} onValueChange={onChange} />
    </Row>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <T v="caption" color="#6B5F8A" style={{ marginLeft: 4 }}>{title.toUpperCase()}</T>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

export default function Settings() {
  const user = useApp((s) => s.user);
  const prefs = useApp((s) => s.prefs);
  const setPref = useApp((s) => s.setPref);
  const update = useApp((s) => s.updateUser);
  const methods = useApp((s) => s.paymentMethods);
  const selected = useApp((s) => s.selectedPayment);
  const signOut = useApp((s) => s.signOut);
  const resetDemo = useApp((s) => s.resetDemo);

  const confirm = (title: string, msg: string, onYes: () => void) => {
    if (Platform.OS === 'web') {
      onYes();
      return;
    }
    Alert.alert(title, msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Continue', style: 'destructive', onPress: onYes }]);
  };

  return (
    <Screen header={<ScreenHeader title="Settings" />}>
      <Pressable accessibilityRole="button" onPress={() => router.push('/pro-verification')} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.xl, backgroundColor: colors.brandDeep }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="star" size={22} color={colors.brandDark} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="bodyBold" color={colors.white}>{user.pro === 'verified' ? 'Verified Pro account' : user.pro === 'review' ? 'Pro verification in review' : 'Get verified as Pro'}</T>
          <T v="small" color={colors.lilacLight}>Badge, bookings & payouts</T>
        </View>
        <Icon name="chevron-right" size={22} color={colors.white} />
      </Pressable>

      <Group title="Account">
        <LinkRow first label="Edit profile" onPress={() => router.push('/profile-setup?mode=edit')} />
        <LinkRow label="Email & phone" value={user.email} onPress={() => router.push('/profile-setup?mode=edit')} />
        <LinkRow label="Password" value="Change" onPress={() => router.push('/forgot-password')} />
        <LinkRow label="Payment methods" value={methods.find((m) => m.id === selected)?.label} onPress={() => router.push('/payment-methods')} />
      </Group>

      <Group title="Notifications">
        <ToggleRow first label="Booking updates" value={prefs.bookings} onChange={(v) => setPref('bookings', v)} />
        <ToggleRow label="Messages" value={prefs.messages} onChange={(v) => setPref('messages', v)} />
        <ToggleRow label="Events near me" value={prefs.nearby} onChange={(v) => setPref('nearby', v)} />
      </Group>

      <Group title="Privacy">
        <ToggleRow first label="Private account" value={prefs.privateAccount} onChange={(v) => setPref('privateAccount', v)} />
        <LinkRow label="Blocked users" value="0" onPress={() => router.push('/help?section=safety')} />
      </Group>

      <View style={{ gap: 8 }}>
        <T v="caption" color="#6B5F8A" style={{ marginLeft: 4 }}>LANGUAGE</T>
        <Segmented options={[{ key: 'English', label: 'English' }, { key: 'Deutsch', label: 'Deutsch' }]} value={prefs.language} onChange={(v) => setPref('language', v)} />
      </View>

      <View style={{ gap: 8, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderStrong }}>
        <T v="bodyBold">Demo: account role</T>
        <T v="small">In production the role is chosen once at registration. Switch here to explore every user type.</T>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {(['fan', 'musician', 'venue', 'organizer'] as Role[]).map((r) => (
            <Button key={r} title={ROLE_LABEL[r]} size="sm" variant={user.role === r ? 'primary' : 'secondary'} onPress={() => update({ role: r })} />
          ))}
        </Row>
      </View>

      <Group title="Support">
        <LinkRow first label="Help & FAQ" onPress={() => router.push('/help')} />
        <LinkRow label="Terms & privacy" onPress={() => router.push('/help?section=about')} />
      </Group>

      <Row gap={10}>
        <Button title="Log out" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => { signOut(); router.replace('/login'); }} />
        <Button title="Reset demo" variant="ghost" size="md" style={{ flex: 1 }} onPress={() => confirm('Reset demo data?', 'Tickets, bookings, posts and settings return to the sample data.', () => { resetDemo(); router.replace('/'); })} />
      </Row>
      <Button title="Delete account" variant="ghost" size="sm" style={{ alignSelf: 'center' }} onPress={() => confirm('Delete account?', 'This permanently removes your profile, tickets and bookings.', () => { resetDemo(); router.replace('/'); })} />
      <T v="small" center>Domtak · Version 1.0.0</T>
    </Screen>
  );
}
