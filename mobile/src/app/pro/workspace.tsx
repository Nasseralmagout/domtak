import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateBadge } from '../../components/cards';
import { goBack } from '../../components/layout';
import { Avatar, Button, Icon, type IconName, IconButton, Row, T } from '../../components/ui';
import { euro } from '../../lib/format';
import { ROLE_LABEL, useApp } from '../../store/useApp';
import { colors, fonts, radius, shadow } from '../../theme';

function Action({ icon, label, badge, onPress }: { icon: IconName; label: string; badge?: number; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}${badge ? `, ${badge} new` : ''}`} onPress={onPress} style={{ flex: 1, alignItems: 'center', gap: 8, paddingVertical: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={22} color={colors.brand} />
      </View>
      <T v="smallBold" style={{ fontSize: 12 }}>{label}</T>
      {badge ? (
        <View style={{ position: 'absolute', top: 6, right: 8, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.warningStrong, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
          <Text style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: 11 }}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function Workspace() {
  const user = useApp((s) => s.user);
  const requests = useApp((s) => s.requests);
  const myEvents = useApp((s) => s.myEvents);
  const newCount = requests.filter((r) => r.status === 'new').length;
  const accepted = requests.filter((r) => r.status === 'accepted');
  const escrow = accepted.reduce((n, r) => n + r.offer * 0.9, 0);
  const bars = [18, 26, 22, 30, 28, 38, 44];
  const organizer = user.role === 'organizer' || user.role === 'venue';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.brandDeep, paddingBottom: 64 }}>
        <Row style={{ paddingHorizontal: 4, height: 56 }} gap={4}>
          <IconButton name="chevron-left" label="Back" color={colors.white} iconSize={30} onPress={() => goBack('/(tabs)')} />
          <Text style={{ flex: 1, color: colors.white, fontFamily: fonts.wordmark, fontSize: 24 }}>DOMTAK <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.brandDark, backgroundColor: colors.gold }}> PRO </Text></Text>
          <IconButton name="cog-outline" label="Settings" color={colors.lilac} onPress={() => router.push('/settings')} />
        </Row>
        <Row gap={12} style={{ paddingHorizontal: 20, paddingTop: 4 }}>
          <Avatar src={user.avatar} size={52} label={user.name} verified={user.pro === 'verified'} />
          <View>
            <Text style={{ color: colors.white, fontFamily: fonts.displaySemi, fontSize: 18 }}>Hi, {user.name.split(' ')[0]}</Text>
            <Text style={{ color: colors.lilacLight, fontFamily: fonts.body, fontSize: 13 }}>{ROLE_LABEL[user.role]} · {user.pro === 'verified' ? 'Verified' : user.pro === 'review' ? 'Verification in review' : 'Not verified yet'} · Berlin</Text>
          </View>
        </Row>
      </SafeAreaView>

      <ScrollView style={{ marginTop: -52 }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: 18, gap: 14, ...shadow(2) }}>
          <Row justify="space-between" align="flex-start">
            <View>
              <T v="small">Earnings this month</T>
              <T v="h1">€3.240</T>
            </View>
            <Button title="Payout" size="sm" onPress={() => router.push('/payment-methods?payout=1')} />
          </Row>
          <Row gap={10}>
            <View style={{ flex: 1, padding: 12, borderRadius: 14, backgroundColor: colors.brandTint }}>
              <T v="small" style={{ fontSize: 12 }}>Held in escrow</T>
              <T v="bodyBold">{euro(escrow)}</T>
            </View>
            <View style={{ flex: 1, padding: 12, borderRadius: 14, backgroundColor: colors.brandTint }}>
              <T v="small" style={{ fontSize: 12 }}>Available</T>
              <T v="bodyBold">€2.040</T>
            </View>
          </Row>
        </View>

        <Row gap={8}>
          <Action icon="inbox-arrow-down" label="Requests" badge={newCount} onPress={() => router.push('/pro/requests')} />
          <Action icon="calendar-plus" label={organizer ? 'New event' : 'Availability'} onPress={() => router.push(organizer ? '/create-event' : '/(tabs)/calendar')} />
          <Action icon="account-group-outline" label="Attendees" onPress={() => router.push('/pro/attendees/bunker7')} />
          <Action icon="qrcode-scan" label="Scan" onPress={() => router.push('/pro/scan')} />
        </Row>

        {user.pro !== 'verified' ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/pro-verification')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.brandDeep }}>
            <Icon name="check-decagram" size={26} color={colors.gold} />
            <View style={{ flex: 1 }}>
              <T v="bodyBold" color={colors.white}>{user.pro === 'review' ? 'Verification in review' : 'Get verified as Pro'}</T>
              <T v="small" color={colors.lilacLight}>Badge, in-app bookings & payouts</T>
            </View>
            <Icon name="chevron-right" size={22} color={colors.white} />
          </Pressable>
        ) : null}

        <View style={{ gap: 10 }}>
          <Row justify="space-between">
            <T v="h3">Upcoming gigs</T>
            <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/calendar')} hitSlop={8}><T v="smallBold" color={colors.brand}>Calendar</T></Pressable>
          </Row>
          {accepted.map((r) => (
            <Pressable key={r.id} accessibilityRole="button" onPress={() => router.push(`/pro/request/${r.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: colors.surface, ...shadow(1) }}>
              <DateBadge iso={r.date.includes('Dec') ? '2026-12-31' : '2026-11-07'} size={52} />
              <View style={{ flex: 1 }}>
                <T v="bodyBold">{r.title}</T>
                <T v="small">{r.time} · {r.location.split(',')[0]} · {euro(r.offer)}</T>
              </View>
              <T v="smallBold" color={colors.success}>Paid</T>
            </Pressable>
          ))}
          {myEvents.map((e) => (
            <Pressable key={e.id} accessibilityRole="button" onPress={() => router.push(`/pro/attendees/${e.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: colors.surface, ...shadow(1) }}>
              <DateBadge iso={e.start} size={52} />
              <View style={{ flex: 1 }}>
                <T v="bodyBold">{e.title}</T>
                <T v="small">Your event · {e.ticketTypes.reduce((n, t) => n + t.capacity, 0)} tickets</T>
              </View>
              <T v="smallBold" color={colors.brand}>Manage</T>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14, padding: 16, borderRadius: 16, backgroundColor: colors.surface, ...shadow(1) }}>
          <View style={{ flex: 1 }}>
            <T v="small">Profile views · 7 days</T>
            <T v="h2">1.284 <T v="smallBold" color={colors.success}>+18%</T></T>
          </View>
          <Row gap={5} align="flex-end" style={{ height: 44 }}>
            {bars.map((h, i) => <View key={i} style={{ width: 10, height: h, borderRadius: 3, backgroundColor: i === bars.length - 1 ? colors.brand : colors.lilac }} />)}
          </Row>
        </View>
      </ScrollView>
    </View>
  );
}
