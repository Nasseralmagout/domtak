import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomBar, Screen, ScreenHeader } from '../../../components/layout';
import { Banner, Button, Card, Divider, Icon, KeyValue, Radio, Row, T } from '../../../components/ui';
import { euro } from '../../../lib/format';
import { useApp } from '../../../store/useApp';
import { colors } from '../../../theme';

const REASONS = ['Already booked that date', 'Offer below my fee', 'Not my music style', 'Other reason'];

export default function RequestReview() {
  const { id, decline } = useLocalSearchParams<{ id: string; decline?: string }>();
  const insets = useSafeAreaInsets();
  const req = useApp((s) => s.requests.find((r) => r.id === id));
  const setStatus = useApp((s) => s.setRequestStatus);
  const [sheet, setSheet] = useState(decline === '1');
  const [reason, setReason] = useState(REASONS[0]);

  if (!req) {
    return (
      <Screen header={<ScreenHeader title="Request" />}>
        <T v="body">Request not found.</T>
      </Screen>
    );
  }
  const fee = req.offer * 0.1;

  if (req.status === 'accepted' && !sheet) {
    return (
      <Screen
        header={<ScreenHeader title={req.title} />}
        footer={<BottomBar><Button title={`Message ${req.requester.split(' ')[0]}`} onPress={() => router.push('/inbox')} /></BottomBar>}
        contentStyle={{ alignItems: 'center', gap: 14, paddingTop: 40, paddingHorizontal: 24 }}
      >
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check" size={48} color={colors.white} />
        </View>
        <T v="h2" center>Booking accepted</T>
        <T v="body" color={colors.muted} center>{req.requester} has 24 h to pay. We’ll notify you when {euro(req.offer)} is held in escrow and the date is locked in your calendar.</T>
        <Card style={{ alignSelf: 'stretch', gap: 6, marginTop: 8 }}>
          <KeyValue k="Date" v={req.date} />
          <KeyValue k="Time" v={req.time} />
          <KeyValue k="You receive" v={euro(req.offer - fee, true)} color={colors.brand} />
        </Card>
      </Screen>
    );
  }

  return (
    <>
      <Screen
        header={<ScreenHeader title={`Request from ${req.requester.split(' ')[0]}`} />}
        footer={
          req.status === 'new' ? (
            <BottomBar>
              <Row gap={8}>
                <Button title="Decline" variant="secondary" size="md" style={{ flex: 1, borderColor: colors.borderStrong }} onPress={() => setSheet(true)} />
                <Button title="Counter" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => router.push('/inbox')} />
                <Button title="Accept" size="md" style={{ flex: 1 }} onPress={() => setStatus(req.id, 'accepted')} />
              </Row>
            </BottomBar>
          ) : null
        }
      >
        <Card style={{ gap: 12 }}>
          <T v="h2">{req.title}</T>
          <KeyValue k="Date" v={req.date} />
          <KeyValue k="Time" v={`${req.time} (${req.hours} h)`} />
          <KeyValue k="Location" v={req.location} />
          <KeyValue k="Guests" v={`~${req.guests} people`} />
          <KeyValue k="Equipment" v={req.equipment} />
          {req.message ? <View style={{ padding: 12, borderRadius: 12, backgroundColor: colors.brandTint }}><T v="body" color="#2E1D5E">“{req.message}”</T></View> : null}
        </Card>
        <Banner icon="calendar-clock" tone="success">You’re free that night — no calendar conflicts</Banner>
        <Card style={{ gap: 6 }}>
          <KeyValue k="Offer" v={euro(req.offer, true)} />
          <KeyValue k="Domtak fee (10%)" v={`−${euro(fee, true)}`} />
          <Divider style={{ marginVertical: 6 }} />
          <KeyValue k="You receive" v={euro(req.offer - fee, true)} strong color={colors.brand} />
          <T v="small" style={{ fontSize: 12 }}>Paid into escrow when the booker pays, released 24 h after the gig.</T>
        </Card>
        {req.status === 'declined' ? <Banner icon="close" tone="danger">You declined this request. The booker was notified and not charged.</Banner> : null}
        {req.status === 'past' ? <Banner icon="check" tone="success">Completed and paid out.</Banner> : null}
      </Screen>

      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <View style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}>
          <Pressable accessibilityLabel="Close" style={{ flex: 1 }} onPress={() => setSheet(false)} />
          <View accessibilityViewIsModal style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: insets.bottom + 20, gap: 12 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong }} />
            <T v="h3">Why are you declining?</T>
            <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
              {REASONS.map((r) => (
                <Pressable key={r} accessibilityRole="radio" accessibilityState={{ checked: reason === r }} onPress={() => setReason(r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 52, paddingHorizontal: 14, borderRadius: 14, borderWidth: reason === r ? 2 : 1, borderColor: reason === r ? colors.brand : colors.border, backgroundColor: reason === r ? colors.brandTint : colors.surface }}>
                  <Radio selected={reason === r} />
                  <T v="body">{r}</T>
                </Pressable>
              ))}
            </View>
            <T v="small">The requester is notified and not charged.</T>
            <Row gap={10}>
              <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setSheet(false)} />
              <Button title="Decline request" variant="danger" style={{ flex: 1 }} onPress={() => { setStatus(req.id, 'declined'); setSheet(false); router.back(); }} />
            </Row>
          </View>
        </View>
      </Modal>
    </>
  );
}
