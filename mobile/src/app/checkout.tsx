import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { BottomBar, goBack, Screen, ScreenHeader } from '../components/layout';
import { Banner, Button, Card, Divider, Field, Icon, KeyValue, PaymentPill, Photo, Radio, Row, StatusPill, T } from '../components/ui';
import { venueById } from '../data/mock';
import { bookingRef, chargeItems, isClosed, providerOf } from '../lib/booking';
import { euro, eventWhen, shortDate } from '../lib/format';
import { applyPromo, findPromo } from '../lib/promos';
import { toast } from '../store/toast';
import { overlayVenue, useApp, useEvent } from '../store/useApp';
import { colors, fonts } from '../theme';

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
  const failPayment = useApp((s) => s.failPayment);
  const retryPayment = useApp((s) => s.retryPayment);
  const venueListing = useApp((s) => s.venueListing);
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

  if (booking && (booking.payment === 'paid' || booking.payment === 'payout_pending' || booking.payment === 'paid_out' || booking.status === 'confirmed' || booking.status === 'completed' || booking.status === 'paid')) {
    // Opening checkout again (back button, lost connection, a repeated tap) never charges a second time.
    return (
      <Screen header={<ScreenHeader title="Payment" onBack={() => goBack(`/booking/${booking.id}`)} />} contentStyle={{ alignItems: 'center', paddingHorizontal: 24, gap: 12, paddingTop: 48 }}>
        <Icon name="check-decagram" size={56} color={colors.success} />
        <T v="h2" center>Already paid</T>
        <T v="body" color={colors.muted} center>{`The payment for booking ${bookingRef(booking)} is verified, so there is nothing to pay again.`}</T>
        <Button title="View booking" full onPress={() => router.replace(`/booking/${booking.id}`)} style={{ marginTop: 12 }} />
      </Screen>
    );
  }
  if (booking && step !== 'failed' && booking.status !== 'accepted' && booking.status !== 'payment_failed') {
    return (
      <Screen header={<ScreenHeader title="Payment" onBack={() => goBack(`/booking/${booking.id}`)} />} contentStyle={{ alignItems: 'center', paddingHorizontal: 24, gap: 12, paddingTop: 48 }}>
        <Icon name="credit-card-clock-outline" size={56} color={colors.brand} />
        <T v="h2" center>Not ready for payment</T>
        <StatusPill booking={booking} />
        <T v="body" color={colors.muted} center>
          {booking.status === 'pending' || booking.status === 'requested'
            ? 'The payment step opens once the provider accepts (or once you accept their quote). Your payment details stay pending their decision.'
            : isClosed(booking.status)
              ? 'This booking is closed, so there is nothing to pay.'
              : 'There is no payment step open for this booking right now. Its current state is shown on the booking page.'}
        </T>
        <Button title="View booking" full onPress={() => router.replace(`/booking/${booking.id}`)} style={{ marginTop: 12 }} />
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
    const venueName = overlayVenue(venueById(event.venueId), venueListing)?.name;
    sub = venueName ? `${eventWhen(event.start, event.end)} · ${venueName}` : eventWhen(event.start, event.end);
    lines = [{ k: `${draft.qty}× ${type.name}`, v: type.price * draft.qty }, ...(type.price > 0 ? [{ k: 'Service fee', v: 1.5 * draft.qty }] : [])];
  } else if (booking) {
    // A venue shows as its public page does, including the owner's listing edits.
    const venue = booking.type === 'venue' ? overlayVenue(venueById(booking.targetId), venueListing) : undefined;
    const provider = providerOf(booking);
    title = venue?.name ?? provider.name;
    image = venue?.cover ?? provider.image ?? image;
    sub = `${booking.eventTitle} · ${shortDate(booking.date)} · ${booking.startTime}–${booking.endTime}`;
    // The agreed charges, each on its own line (quote items for quote bookings).
    lines = chargeItems(booking).map((i) => ({ k: i.label, v: i.amount }));
  }
  const subtotal = lines.reduce((n, l) => n + l.v, 0);
  // Promo codes apply to the tickets themselves, not the service fee.
  const applied = promo && draft.kind === 'ticket' ? applyPromo(promo, lines[0]?.v ?? 0) : null;
  const discount = applied?.discount ?? 0;
  const total = Math.max(0, subtotal - discount);
  // Ticket prices include German VAT. Provider bookings don't state a tax rate, so no VAT line is invented for them.
  const vat = draft.kind === 'ticket' ? total - total / 1.19 : 0;
  const free = subtotal === 0;
  const method = methods.find((m) => m.id === selected);

  const submitPromo = () => {
    if (!promoInput.trim()) return setPromoError('Enter a code');
    const found = findPromo(promoInput);
    if (!found) return setPromoError('This code isn’t valid. Check the spelling or expiry date.');
    setPromo(found.code);
    setPromoError(undefined);
    toast(`${found.code} applied: ${found.label}`);
  };

  const confirm = () => {
    if (loading) return;
    if (code === DECLINE_CODE) {
      setCode('');
      // The booking is kept and marked "Payment failed"; nothing is charged and no second booking is created.
      if (booking) failPayment(booking.id);
      setStep('failed');
      return;
    }
    finish();
  };

  /** Starts another attempt on the SAME booking (never a new booking or a second charge). */
  const retry = () => {
    if (booking?.payment === 'failed') retryPayment(booking.id);
    setStep('verify');
  };

  const finish = () => {
    if (loading) return;
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
          {booking ? <T v="small" center>The booking is confirmed only once your bank verifies the payment.</T> : null}
        </View>
        <Field label="Bank verification code" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="6-digit code" onSubmitEditing={() => code.length >= 4 && confirm()} />
        <Button title={loading ? 'Checking with your bank…' : 'Confirm payment'} loading={loading} disabled={code.length < 4} onPress={confirm} />
        <T v="small" center>Demo: any 4–6 digits approve the payment; {DECLINE_CODE} is declined by the bank.</T>
      </Screen>
    );
  }

  if (step === 'failed') {
    return (
      <Screen header={<ScreenHeader title="Payment" onBack={() => (booking ? router.replace(`/booking/${booking.id}`) : setStep('review'))} />} contentStyle={{ alignItems: 'center', paddingHorizontal: 24, gap: 14, paddingTop: 40 }}>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.dangerBg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={44} color={colors.danger} />
        </View>
        <T v="h2" center>Payment didn’t go through</T>
        <T v="body" color={colors.muted} center>
          {booking
            ? `Your bank declined the payment and nothing was charged. Your booking with ${title} is kept as “Payment failed”, so you can retry safely on the same booking.`
            : 'Your card was declined by the bank and you haven’t been charged. No ticket is issued until a payment goes through.'}
        </T>
        {booking ? <PaymentPill state={booking.payment} /> : null}
        <Button title={method ? `Retry with ${method.label}` : 'Try again'} full onPress={retry} style={{ marginTop: 16 }} />
        {/* Choosing another method only goes back to the summary; the retry starts when you pay. */}
        <Button title="Use another method" variant="secondary" full onPress={() => setStep('review')} />
        {booking ? <Button title="View booking" variant="ghost" full onPress={() => router.replace(`/booking/${booking.id}`)} /> : null}
        <Button title="Contact support" variant="ghost" full onPress={() => router.push('/help')} />
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
            onPress={() => (free || total === 0 ? finish() : retry())}
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
          <KeyValue k={booking.type === 'musician' ? 'Equipment' : booking.type === 'lesson' ? 'Format' : 'Setup'} v={booking.equipment} />
          {booking.type !== 'lesson' ? <KeyValue k="Guests" v={String(booking.guests)} /> : null}
          <KeyValue k={booking.type === 'lesson' ? 'Options' : 'Extra services'} v={booking.extras || 'None'} />
        </Card>
      ) : null}

      <Card style={{ gap: 6 }}>
        {lines.map((l, i) => <KeyValue key={`${l.k}-${i}`} k={l.k} v={euro(l.v, true)} />)}
        {discount > 0 && promo ? <KeyValue k={`Promo ${promo}`} v={`−${euro(discount, true)}`} color={colors.success} /> : null}
        {draft.kind === 'ticket' ? <KeyValue k="incl. VAT (19%)" v={euro(vat, true)} /> : null}
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
                <T v="bodyBold" color={colors.success} style={{ flex: 1 }}>{promo} · {findPromo(promo)?.label}</T>
              </Row>
              <Button title="Remove" accessibilityLabel={`Remove promo code ${promo}`} variant="ghost" size="sm" onPress={() => { setPromo(undefined); setPromoInput(''); toast('Promo code removed'); }} />
            </Row>
          ) : (
            <Row gap={10} align="flex-start">
              <Field placeholder="e.g. BERLIN10" value={promoInput} onChangeText={(t) => { setPromoInput(t.toUpperCase()); setPromoError(undefined); }} autoCapitalize="characters" accessibilityLabel="Promo code" error={promoError} onSubmitEditing={submitPromo} style={{ flex: 1 }} />
              <Button title="Apply" size="md" style={{ marginTop: 4 }} onPress={submitPromo} />
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

      <Banner icon={draft.kind === 'booking' ? 'credit-card-check-outline' : 'shield-check-outline'}>
        {draft.kind === 'booking'
          ? 'The booking is confirmed only once the payment is verified. If it fails, nothing is charged and the booking stays open for a safe retry. Cancellations and refunds follow the agreed policy.'
          : 'Tickets are delivered instantly as QR codes in “Your tickets”.'}
      </Banner>
    </Screen>
  );
}
