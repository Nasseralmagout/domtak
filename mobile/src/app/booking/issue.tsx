import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { BottomBar, Screen, ScreenHeader } from '../../components/layout';
import { Button, Card, Icon, type IconName, KeyValue, Pill, T } from '../../components/ui';
import { profileById, venueById } from '../../data/mock';
import { euro, shortDate } from '../../lib/format';
import { useApp } from '../../store/useApp';
import { colors } from '../../theme';

export default function BookingIssue() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const booking = useApp((s) => s.bookings.find((b) => b.id === id));
  const setStatus = useApp((s) => s.setBookingStatus);
  if (!booking) {
    return (
      <Screen header={<ScreenHeader title="Booking" />}>
        <T v="body">Booking not found.</T>
      </Screen>
    );
  }
  const name = (booking.type === 'musician' ? profileById(booking.targetId)?.name : venueById(booking.targetId)?.name) ?? '';
  const browse = booking.type === 'musician' ? '/artists/all' : '/venues';

  const V: Record<string, { chip: string; tone: 'danger' | 'warning' | 'brand'; icon: IconName; title: string; body: string; money: string; moneyColor: string; primary: [string, () => void]; secondary: [string, () => void] }> = {
    declined: {
      chip: 'Declined', tone: 'danger', icon: 'close', title: `${name} can’t take this booking`,
      body: 'They’re not available for this date. You weren’t charged — here are similar options free that night.',
      money: 'Not charged', moneyColor: colors.success,
      primary: [booking.type === 'musician' ? 'Find similar artists' : 'Find similar venues', () => router.replace(browse)],
      secondary: [`Message ${name}`, () => router.push(`/chat/${useApp.getState().ensureConversation(booking.targetId)}`)],
    },
    expired: {
      chip: 'Expired', tone: 'warning', icon: 'clock-outline', title: 'No response in 48 hours',
      body: 'Your request expired before they replied. Send it again or try someone else.', money: 'Not charged', moneyColor: colors.success,
      primary: ['Send request again', () => { setStatus(booking.id, 'pending'); router.replace(`/booking/${booking.id}`); }],
      secondary: ['Browse others', () => router.replace(browse)],
    },
    cancelled: {
      chip: 'Cancelled · refund', tone: 'brand', icon: 'cash-refund', title: 'Booking cancelled',
      body: 'Any payment held in escrow is refunded in full to your original payment method.', money: 'Refund · 3–5 days', moneyColor: colors.brand,
      primary: ['Back to discovery', () => router.replace('/(tabs)')],
      secondary: ['View refund details', () => router.push('/help?section=refunds')],
    },
    disputed: {
      chip: 'In dispute', tone: 'warning', icon: 'flag-outline', title: 'We’re looking into it',
      body: 'You reported a problem. Funds stay frozen in escrow while our team reviews both sides — usually within 3 working days.', money: 'Held in escrow', moneyColor: colors.warning,
      primary: ['Add evidence', () => router.push('/help?section=disputes')],
      secondary: ['Contact support', () => router.push('/help')],
    },
  };
  const v = V[booking.status] ?? V.cancelled;
  const toneBg = v.tone === 'danger' ? colors.dangerBg : v.tone === 'warning' ? colors.warningBg : colors.brandSoft;
  const toneFg = v.tone === 'danger' ? colors.danger : v.tone === 'warning' ? colors.warning : colors.brand;

  return (
    <Screen
      header={<ScreenHeader title={`Booking #${booking.id.slice(-4).toUpperCase()}`} onBack={() => router.replace('/my-bookings?tab=' + booking.type)} />}
      contentStyle={{ alignItems: 'center', paddingHorizontal: 24, gap: 14, paddingTop: 32 }}
      footer={
        <BottomBar>
          <Button title={v.primary[0]} onPress={v.primary[1]} />
          <Button title={v.secondary[0]} variant="ghost" onPress={v.secondary[1]} style={{ marginTop: 6 }} />
        </BottomBar>
      }
    >
      <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: toneBg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={v.icon} size={44} color={toneFg} />
      </View>
      <Pill label={v.chip} tone={v.tone} />
      <T v="h2" center>{v.title}</T>
      <T v="body" color={colors.muted} center>{v.body}</T>
      <Card style={{ alignSelf: 'stretch', gap: 6, marginTop: 8 }}>
        <KeyValue k="Booking" v={`${name} · ${shortDate(booking.date)}`} />
        <KeyValue k="Amount" v={euro(booking.amount, true)} />
        <KeyValue k="Money status" v={v.money} color={v.moneyColor} />
      </Card>
    </Screen>
  );
}
