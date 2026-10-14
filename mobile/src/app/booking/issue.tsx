import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ActionSheet } from '../../components/ActionSheet';
import { BottomBar, Screen, ScreenHeader } from '../../components/layout';
import { Button, Card, Icon, type IconName, KeyValue, Pill, Row, T } from '../../components/ui';
import { profileById, venueById } from '../../data/mock';
import { euro, shortDate } from '../../lib/format';
import { toast } from '../../store/toast';
import { useApp } from '../../store/useApp';
import { colors } from '../../theme';

type Action = [string, () => void];

export default function BookingIssue() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const booking = useApp((s) => s.bookings.find((b) => b.id === id));
  const setStatus = useApp((s) => s.setBookingStatus);
  const ensureConversation = useApp((s) => s.ensureConversation);
  const [evidenceSheet, setEvidenceSheet] = useState(false);
  const [evidence, setEvidence] = useState<string[]>([]);

  if (!booking) {
    return (
      <Screen header={<ScreenHeader title="Booking" onBack={() => router.replace('/my-bookings?tab=musician')} />}>
        <T v="body">Booking not found.</T>
        <Button title="Your bookings" onPress={() => router.replace('/my-bookings?tab=musician')} />
      </Screen>
    );
  }
  const name = (booking.type === 'musician' ? profileById(booking.targetId)?.name : venueById(booking.targetId)?.name) ?? '';
  const browse = booking.type === 'musician' ? '/artists/all' : '/venues';
  const ref = `#${booking.id.slice(-4).toUpperCase()}`;
  const message = () => router.push(`/chat/${ensureConversation(booking.targetId)}`);
  const addEvidence = (kind: string) => {
    setEvidence((e) => [...e, kind]);
    toast(`${kind} added to case ${ref}`);
  };

  const V: Record<string, { chip: string; tone: 'danger' | 'warning' | 'brand'; icon: IconName; title: string; body: string; money: string; moneyColor: string; primary: Action; secondary: Action; tertiary?: Action }> = {
    declined: {
      chip: 'Declined', tone: 'danger', icon: 'close', title: `${name} can’t take this booking`,
      body: 'They’re not available for this date. You weren’t charged. Similar options may still be free that night.',
      money: 'Not charged', moneyColor: colors.success,
      primary: [booking.type === 'musician' ? 'Find similar artists' : 'Find similar venues', () => router.replace(browse)],
      secondary: [`Message ${name}`, message],
    },
    expired: {
      chip: 'Expired', tone: 'warning', icon: 'clock-outline', title: 'No response in 48 hours',
      body: 'Your request expired before they replied. Send it again or try someone else.', money: 'Not charged', moneyColor: colors.success,
      primary: ['Send request again', () => { setStatus(booking.id, 'pending'); toast(`Request sent to ${name} again`); router.replace(`/booking/${booking.id}`); }],
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
      body: 'You reported a problem. Funds stay frozen in escrow while our team reviews both sides, usually within 3 working days.', money: 'Held in escrow', moneyColor: colors.warning,
      primary: ['Add evidence', () => setEvidenceSheet(true)],
      secondary: [`Message ${name}`, message],
      tertiary: ['Withdraw report', () => { setStatus(booking.id, 'completed'); toast('Report withdrawn. Funds will be released.'); router.replace(`/booking/${booking.id}`); }],
    },
  };
  const v = V[booking.status] ?? V.cancelled;
  const toneBg = v.tone === 'danger' ? colors.dangerBg : v.tone === 'warning' ? colors.warningBg : colors.brandSoft;
  const toneFg = v.tone === 'danger' ? colors.danger : v.tone === 'warning' ? colors.warning : colors.brand;

  return (
    <Screen
      header={<ScreenHeader title={`Booking ${ref}`} onBack={() => router.replace(`/my-bookings?tab=${booking.type}`)} />}
      contentStyle={{ alignItems: 'center', paddingHorizontal: 24, gap: 14, paddingTop: 32 }}
      footer={
        <BottomBar>
          <Button title={v.primary[0]} onPress={v.primary[1]} />
          <Button title={v.secondary[0]} variant="ghost" onPress={v.secondary[1]} style={{ marginTop: 6 }} />
          {v.tertiary ? <Button title={v.tertiary[0]} variant="ghost" size="md" onPress={v.tertiary[1]} /> : null}
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
        <KeyValue k="Event" v={booking.eventTitle} />
        <KeyValue k="Amount" v={euro(booking.amount, true)} />
        <KeyValue k="Money status" v={v.money} color={v.moneyColor} />
      </Card>
      {booking.status === 'disputed' ? (
        <Card style={{ alignSelf: 'stretch', gap: 8 }}>
          <T v="title">Case {ref}</T>
          {evidence.length ? (
            evidence.map((e, i) => (
              <Row key={`${e}-${i}`} gap={8}>
                <Icon name="paperclip" size={18} color={colors.brand} />
                <T v="body">{e}</T>
              </Row>
            ))
          ) : (
            <T v="small">No evidence yet. Photos, screenshots or a short statement help us decide faster.</T>
          )}
        </Card>
      ) : null}

      <ActionSheet
        visible={evidenceSheet}
        title="Add evidence"
        actions={[
          { label: 'Photo from the event', icon: 'image-outline', onPress: () => addEvidence('Photo from the event') },
          { label: 'Screenshot of the chat', icon: 'message-image-outline', onPress: () => addEvidence('Chat screenshot') },
          { label: 'Written statement', icon: 'text-box-outline', onPress: () => addEvidence('Written statement') },
        ]}
        onClose={() => setEvidenceSheet(false)}
      />
    </Screen>
  );
}
