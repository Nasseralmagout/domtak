import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { BottomBar, goBack, Screen, ScreenHeader } from '../components/layout';
import { Banner, Button, Card, Divider, Field, Icon, KeyValue, Photo, Radio, Row, T } from '../components/ui';
import { profileById, venueById } from '../data/mock';
import { euro, eventWhen, shortDate } from '../lib/format';
import { toast } from '../store/toast';
import { useApp, useEvent } from '../store/useApp';
import { colors, fonts } from '../theme';

/** Ticket promo codes (same list as Help → Promo code). */
const PROMOS: Record<string, { label: string; off: (subtotal: number) => number }> = {
  BERLIN10: { label: '10% off tickets', off: (n) => n * 0.1 },
  DOMTAK5: { label: '€5 off your order', off: (n) => Math.min(5, n) },
};

/** Demo bank: this code is always declined so the failure path can be tried. */
const DECLINE_CODE = '0000';

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
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState<string>();
  const [promoError, setPromoError] = useState<string>();
  // Set once the order is complete: the draft is cleared then, so don't show "expired" while the success screen opens.
  const [paidOut, setPaidOut] = useState(false);
  const ticketType = draft?.kind === 'ticket' ? event?.ticketTypes.find((t) => t.id === draft.typeId) : undefined;

  if (paidOut) {
    return (
      <Screen header={<ScreenHeader title="Checkout" back={false} />} contentStyle={{ alignItems: 'center', paddingTop: 80, gap: 12 }}>
        <Icon name="check-circle-outline" size={56} color={colors.success} />
        <T v="h3" center>Payment complete</T>
        <T v="body" color={colors.muted} center>Opening your confirmation…</T>
      </Screen>
    );
  }

  if (!draft || (draft.kind === 'ticket' && !ticketType) || (draft.kind === 'booking' && !booking)) {
    return (
      <Screen header={<ScreenHeader title="Checkout" onBack={() => goBack('/(tabs)/events')} />}>
        <T v="body">Your checkout session expired. Pick your tickets again.</T>
        <Button title="Back to events" onPress={() => router.replace('/(tabs)/events')} />
        <Button title="Your bookings" variant="secondary" onPress={() => router.replace('/my-bookings?tab=musician')} />
      </Screen>
    );
  }

  let title = '';
  let sub = '';
  let image = event?.cover ?? 'ev_dance_world';
  let lines: { k: string; v: number }[] = [];
  if (draft.kind === 'ticket' && event && ticketType) {
    const type = ticketType;
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
  const subtotal = lines.reduce((n, l) => n + l.v, 0);
  const discount = promo && draft.kind === 'ticket' ? Math.round(PROMOS[promo].off(lines[0]?.v ?? 0) * 100) / 100 : 0;
  const total = Math.max(0, subtotal - discount);
  const vat = total - total / 1.19;
  const free = subtotal === 0;
  const method = methods.find((m) => m.id === selected);

  const applyPromo = () => {
    const c = promoInput.trim().toUpperCase();
    if (!c) return setPromoError('Enter a code');
    if (!PROMOS[c]) return setPromoError('This code isn’t valid. Check the spelling or expiry date.');
    setPromo(c);
    setPromoError(undefined);
    toast(`${c} applied: ${PROMOS[c].label}`);
  };

  const confirm = () => {
    if (code === DECLINE_CODE) {
      setCode('');
      setStep('failed');
      return;
    }
    finish();
  };

  const finish = () => {
    setLoading(true);
    setTimeout(() => {
      const res = complete();
      setLoading(false);
      if (!res) return;
      setPaidOut(true);
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
          <T v="body" color={colors.muted} center>Your bank sent a code to the phone ending {user.phone.slice(-4)} to approve {euro(total, true)}{method ? ` with ${method.label}` : ''}.</T>
        </View>
        <Field label="Bank verification code" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="6-digit code" onSubmitEditing={() => code.length >= 4 && confirm()} />
        <Button title="Confirm payment" loading={loading} disabled={code.length < 4} onPress={confirm} />
        <T v="small" center>Demo: any 4–6 digits approve the payment; {DECLINE_CODE} is declined by the bank.</T>
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
        <Button title="Try again" variant="secondary" full onPress={() => setStep('verify')} />
        <Button title="Contact support" variant="ghost" full onPress={() => router.push('/help?section=refunds')} />
      </Screen>
    );
  }

  return (
    <Screen
      keyboard
      header={<ScreenHeader title="Review summary" onBack={() => goBack(draft.kind === 'ticket' ? `/tickets/${draft.eventId}` : `/booking/${draft.bookingId}`)} right={<Row gap={4} style={{ paddingRight: 16 }} accessibilityLabel="Secure checkout"><Icon name="lock-outline" size={16} color={colors.success} /><T v="smallBold" color={colors.success}>Secure</T></Row>} />}
      footer={
        <BottomBar>
          <Button
            title={free ? 'Confirm registration' : total === 0 ? 'Confirm order' : `Pay ${euro(total, true)}`}
            loading={loading}
            disabled={!free && total > 0 && !method}
            onPress={() => (free || total === 0 ? finish() : setStep('verify'))}
          />
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
        {discount > 0 && promo ? <KeyValue k={`Promo ${promo}`} v={`−${euro(discount, true)}`} color={colors.success} /> : null}
        <KeyValue k="incl. VAT (19%)" v={euro(vat, true)} />
        <Divider style={{ marginVertical: 6 }} />
        <KeyValue k="Total" v={free ? 'Free' : euro(total, true)} strong />
      </Card>

      {draft.kind === 'ticket' && !free ? (
        <Card style={{ gap: 10 }}>
          <T v="title">Promo code</T>
          {promo ? (
            <Row justify="space-between">
              <Row gap={8} style={{ flex: 1 }}>
                <Icon name="ticket-percent-outline" size={20} color={colors.success} />
                <T v="bodyBold" color={colors.success} style={{ flex: 1 }}>{promo} · {PROMOS[promo].label}</T>
              </Row>
              <Button title="Remove" variant="ghost" size="sm" onPress={() => { setPromo(undefined); setPromoInput(''); toast('Promo code removed'); }} />
            </Row>
          ) : (
            <Row gap={10} align="flex-start">
              <Field placeholder="e.g. BERLIN10" value={promoInput} onChangeText={(t) => { setPromoInput(t.toUpperCase()); setPromoError(undefined); }} autoCapitalize="characters" accessibilityLabel="Promo code" error={promoError} onSubmitEditing={applyPromo} style={{ flex: 1 }} />
              <Button title="Apply" size="md" style={{ marginTop: 4 }} onPress={applyPromo} />
            </Row>
          )}
        </Card>
      ) : null}

      {!free && total > 0 ? (
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
