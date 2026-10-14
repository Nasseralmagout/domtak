import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { BottomBar, Screen, ScreenHeader } from '../components/layout';
import { Banner, Button, Card, Divider, Field, Icon, KeyValue, Photo, Radio, Row, T } from '../components/ui';
import { profileById, venueById } from '../data/mock';
import { euro, eventWhen, shortDate } from '../lib/format';
import { useApp, useEvent } from '../store/useApp';
import { colors, fonts } from '../theme';

export default function Checkout() {
  const draft = useApp((s) => s.checkout);
  const user = useApp((s) => s.user);
  const bookings = useApp((s) => s.bookings);
  const methods = useApp((s) => s.paymentMethods);
  const selected = useApp((s) => s.selectedPayment);
  const setSelected = useApp((s) => s.setSelectedPayment);
  const complete = useApp((s) => s.completeCheckout);
  const event = useEvent(draft?.kind === 'ticket' ? draft.eventId : undefined);
  const booking = draft?.kind === 'booking' ? bookings.find((b) => b.id === draft.bookingId) : undefined;
  const [step, setStep] = useState<'review' | 'verify' | 'failed'>('review');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  if (!draft || (draft.kind === 'ticket' && !event) || (draft.kind === 'booking' && !booking)) {
    return (
      <Screen header={<ScreenHeader title="Checkout" />}>
        <T v="body">Your checkout session expired. Pick your tickets again.</T>
        <Button title="Back to events" onPress={() => router.replace('/(tabs)/events')} />
      </Screen>
    );
  }

  let title = '';
  let sub = '';
  let image = event?.cover ?? 'ev_dance_world';
  let lines: { k: string; v: number }[] = [];
  if (draft.kind === 'ticket' && event) {
    const type = event.ticketTypes.find((t) => t.id === draft.typeId)!;
    title = event.title;
    sub = `${eventWhen(event.start, event.end)} · ${venueById(event.venueId)?.name}`;
    lines = [{ k: `${draft.qty}× ${type.name}`, v: type.price * draft.qty }, ...(type.price > 0 ? [{ k: 'Service fee', v: 1.5 * draft.qty }] : [])];
  } else if (booking) {
    const target = booking.type === 'musician' ? profileById(booking.targetId) : venueById(booking.targetId);
    title = target?.name ?? 'Booking';
    image = booking.type === 'musician' ? (profileById(booking.targetId)?.avatar ?? image) : (venueById(booking.targetId)?.cover ?? image);
    sub = `${booking.eventTitle} · ${shortDate(booking.date)} · ${booking.startTime}–${booking.endTime}`;
    lines = [{ k: booking.type === 'musician' ? `${booking.hours} hours` : '1 night', v: booking.amount }, { k: 'Escrow protection', v: 0 }];
  }
  const total = lines.reduce((n, l) => n + l.v, 0);
  const vat = total - total / 1.19;
  const free = total === 0;

  const finish = () => {
    setLoading(true);
    setTimeout(() => {
      const res = complete();
      setLoading(false);
      if (!res) return;
      if (res.kind === 'ticket') router.replace({ pathname: '/success', params: { kind: 'ticket', id: res.ids[0], count: String(res.ids.length) } });
      else router.replace({ pathname: '/success', params: { kind: 'booking', id: res.id } });
    }, 700);
  };

  if (step === 'verify') {
    return (
      <Screen keyboard header={<ScreenHeader title="Confirm with your bank" onBack={() => setStep('review')} />} contentStyle={{ paddingHorizontal: 24, gap: 18 }}>
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 16 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="shield-check-outline" size={40} color={colors.brand} />
          </View>
          <T v="h2" center>Verify this payment</T>
          <T v="body" color={colors.muted} center>Your bank sent a code to the phone ending {user.phone.slice(-4)} to approve {euro(total, true)}.</T>
        </View>
        <Field label="Bank verification code" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="6-digit code" />
        <Button title="Confirm payment" loading={loading} disabled={code.length < 4} onPress={finish} />
        <T v="small" center>Demo: any 4–6 digits approve the payment.</T>
      </Screen>
    );
  }

  if (step === 'failed') {
    return (
      <Screen header={<ScreenHeader title="Payment" onBack={() => setStep('review')} />} contentStyle={{ alignItems: 'center', paddingHorizontal: 24, gap: 14, paddingTop: 40 }}>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.dangerBg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={44} color={colors.danger} />
        </View>
        <T v="h2" center>Payment didn’t go through</T>
        <T v="body" color={colors.muted} center>Your card was declined by the bank. You haven’t been charged{draft.kind === 'ticket' ? ' and your tickets are held for 10 minutes' : ''}.</T>
        <Button title="Try another method" full onPress={() => setStep('review')} style={{ marginTop: 16 }} />
        <Button title="Contact support" variant="ghost" full onPress={() => router.push('/help')} />
      </Screen>
    );
  }

  return (
    <Screen
      header={<ScreenHeader title="Review summary" right={<Row gap={4} style={{ paddingRight: 16 }}><Icon name="lock-outline" size={16} color={colors.success} /><T v="smallBold" color={colors.success}>Secure</T></Row>} />}
      footer={
        <BottomBar>
          <Button title={free ? 'Confirm registration' : `Pay ${euro(total, true)}`} loading={loading} onPress={() => (free ? finish() : setStep('verify'))} />
          {!free ? (
            <Pressable accessibilityRole="button" onPress={() => setStep('failed')} style={{ alignItems: 'center', paddingTop: 8 }}>
              <T v="small" style={{ textDecorationLine: 'underline' }}>Preview: payment failed state</T>
            </Pressable>
          ) : null}
        </BottomBar>
      }
    >
      <Card style={{ flexDirection: 'row', gap: 14, padding: 0, overflow: 'hidden' }} padded={false}>
        <Photo src={image} style={{ width: 120, height: 120 }} />
        <View style={{ flex: 1, paddingVertical: 12, paddingRight: 12, gap: 4, justifyContent: 'center' }}>
          <T v="h3" numberOfLines={1}>{title}</T>
          <T v="small" numberOfLines={3}>{sub}</T>
        </View>
      </Card>

      <Card style={{ gap: 6 }}>
        <KeyValue k="Full name" v={user.name} />
        <KeyValue k="Phone" v={user.phone} />
        <KeyValue k="Email" v={user.email} />
      </Card>

      {booking ? (
        <Card style={{ gap: 6 }}>
          <KeyValue k={booking.type === 'musician' ? 'Equipment' : 'Setup'} v={booking.equipment} />
          <KeyValue k="Guests" v={String(booking.guests)} />
          <KeyValue k="Extra services" v={booking.extras || 'None'} />
        </Card>
      ) : null}

      <Card style={{ gap: 6 }}>
        {lines.map((l) => <KeyValue key={l.k} k={l.k} v={l.v === 0 && l.k.startsWith('Escrow') ? 'Included' : euro(l.v, true)} />)}
        <KeyValue k="incl. VAT (19%)" v={euro(vat, true)} />
        <Divider style={{ marginVertical: 6 }} />
        <KeyValue k="Total" v={free ? 'Free' : euro(total, true)} strong />
      </Card>

      {!free ? (
        <>
          <T v="title">Pay with</T>
          <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
            {methods.map((m) => {
              const on = m.id === selected;
              return (
                <Pressable key={m.id} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setSelected(m.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, height: 64, paddingHorizontal: 16, borderRadius: 16, borderWidth: on ? 2 : 1, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brandTint : colors.surface }}>
                  <View style={{ width: 52, height: 34, borderRadius: 6, backgroundColor: m.badge === 'VISA' ? colors.brand : m.badge === 'PP' ? '#1F4E9C' : colors.ink, alignItems: 'center', justifyContent: 'center' }}>
                    <T v="caption" color={colors.white} style={{ fontFamily: fonts.bodyBold }}>{m.badge}</T>
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="bodyBold">{m.label}</T>
                    <T v="small">{m.sub}</T>
                  </View>
                  <Radio selected={on} />
                </Pressable>
              );
            })}
            <Button title="Add new card" icon="plus" variant="ghost" onPress={() => router.push('/payment-methods?add=1')} />
          </View>
        </>
      ) : null}

      <Banner icon="shield-check-outline">
        {draft.kind === 'booking'
          ? 'Protected by Domtak escrow: your payment is held until the booking is confirmed, then released to the provider.'
          : 'Tickets are delivered instantly as QR codes in “Your tickets”.'}
      </Banner>
    </Screen>
  );
}
