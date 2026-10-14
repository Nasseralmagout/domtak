import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { BottomBar, Screen, ScreenHeader } from '../components/layout';
import { Button, Card, Icon, type IconName, Row, T } from '../components/ui';
import { isPro, ROLE_LABEL, useApp } from '../store/useApp';
import { colors, radius } from '../theme';

const STEPS: { id: string; name: string; sub: string; icon: IconName }[] = [
  { id: 'id', name: 'Identity', sub: 'Photo ID + selfie', icon: 'account-outline' },
  { id: 'pro', name: 'Professional details', sub: 'Genres, booking fee, bio', icon: 'music-note' },
  { id: 'links', name: 'Music & media links', sub: 'SoundCloud, Spotify or YouTube', icon: 'soundcloud' },
  { id: 'payout', name: 'Payout account', sub: 'IBAN for bookings & tickets', icon: 'credit-card-outline' },
];

export default function ProVerification() {
  const user = useApp((s) => s.user);
  const update = useApp((s) => s.updateUser);
  const [done, setDone] = useState<string[]>(['id', 'pro']);
  const ready = done.length === STEPS.length;
  const role = isPro(user.role) ? user.role : 'musician';

  if (user.pro === 'review' || user.pro === 'verified') {
    const verified = user.pro === 'verified';
    return (
      <Screen
        header={<ScreenHeader title="Pro verification" />}
        footer={
          <BottomBar>
            <Button title="Open Pro workspace" onPress={() => router.replace('/pro/workspace')} />
            {!verified ? <Button title="Demo: approve application" variant="ghost" onPress={() => update({ pro: 'verified' })} style={{ marginTop: 6 }} /> : null}
          </BottomBar>
        }
        contentStyle={{ alignItems: 'center', gap: 16, paddingTop: 32, paddingHorizontal: 24 }}
      >
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: verified ? colors.brand : colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={verified ? 'check-decagram' : 'clock-outline'} size={46} color={verified ? colors.gold : colors.brand} />
        </View>
        <T v="h2" center>{verified ? 'You’re verified!' : 'Application under review'}</T>
        <T v="body" color={colors.muted} center>{verified ? 'The purple badge is on your profile and you can now receive bookings and payouts.' : `Thanks, ${user.name.split(' ')[0]}! The Domtak team usually reviews applications within 2 working days.`}</T>
        <Card style={{ alignSelf: 'stretch', gap: 14 }}>
          {[['Submitted', 'Today', true], ['Team review', verified ? 'Done' : 'In progress', verified], ['Badge & Pro tools unlocked', verified ? 'Now' : '~2 days', verified]].map(([label, when, ok], i) => (
            <Row key={String(label)} gap={12}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: ok ? colors.brand : colors.surface, borderWidth: ok ? 0 : i === 1 ? 4 : 2, borderColor: i === 1 ? colors.brand : colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
                {ok ? <Icon name="check" size={14} color={colors.white} /> : null}
              </View>
              <T v="bodyBold" style={{ flex: 1 }}>{label}</T>
              <T v="small">{when}</T>
            </Row>
          ))}
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      header={<ScreenHeader title="Pro verification" />}
      footer={
        <BottomBar>
          <Button title={ready ? 'Submit for review' : 'Complete all steps'} disabled={!ready} onPress={() => update({ pro: 'review', role })} />
        </BottomBar>
      }
    >
      <View style={{ backgroundColor: colors.brandDeep, borderRadius: radius.xl, padding: 18, gap: 10 }}>
        <T v="h2" color={colors.white}>Become a verified {ROLE_LABEL[role]}</T>
        <T v="body" color={colors.lilacLight}>Get the purple badge, receive bookings and payouts in-app, upload videos and go live.</T>
        <Row gap={10}>
          <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
            <View style={{ height: 8, width: `${(done.length / STEPS.length) * 100}%`, backgroundColor: colors.gold }} />
          </View>
          <T v="smallBold" color={colors.white}>{done.length}/{STEPS.length}</T>
        </Row>
      </View>
      {STEPS.map((s) => {
        const ok = done.includes(s.id);
        return (
          <Pressable
            key={s.id}
            accessibilityRole="button"
            accessibilityState={{ checked: ok }}
            onPress={() => setDone(ok ? done.filter((x) => x !== s.id) : [...done, s.id])}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderStyle: ok ? 'solid' : 'dashed', borderColor: ok ? colors.border : '#9C8FC2' }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: ok ? colors.brand : colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={ok ? 'check' : s.icon} size={20} color={ok ? colors.white : colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="bodyBold">{s.name}</T>
              <T v="small">{s.sub}</T>
            </View>
            <T v="smallBold" color={ok ? colors.success : colors.brand}>{ok ? 'Done' : 'Add'}</T>
          </Pressable>
        );
      })}
      <T v="small">Pro plan: €9,99/month or €89/year after a free first month. Every application is reviewed by our team.</T>
    </Screen>
  );
}
