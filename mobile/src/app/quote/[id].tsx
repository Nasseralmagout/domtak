import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ActionSheet, ReasonSheet } from '../../components/ActionSheet';
import { BottomBar, goBack, Screen, ScreenHeader } from '../../components/layout';
import { Banner, Button, Card, Icon, KeyValue, LineItems, PaymentPill, Photo, Pill, Row, T, TimeLeft } from '../../components/ui';
import { bookingRef, isClosed, isConfirmed, PAYMENT_NOTE, providerOf, QUOTE_STATUS_LABEL, QUOTE_STATUS_TONE, quoteState } from '../../lib/booking';
import { euro, parse, plural, shortDate, TODAY } from '../../lib/format';
import { toast } from '../../store/toast';
import { useApp } from '../../store/useApp';
import { colors, radius, shadow } from '../../theme';

const REJECT_REASONS = ['Over my budget', 'Booked someone else', 'Event plans changed', 'The scope doesn’t match', 'Other'];

/** Summary line whose value is free text, so it wraps instead of running off the card. */
function TextLine({ k, v }: { k: string; v: string }) {
  return (
    <Row justify="space-between" align="flex-start" gap={12} style={{ paddingVertical: 4 }}>
      <T v="body" color={colors.muted}>{k}</T>
      <T v="bodyBold" style={{ flex: 1, textAlign: 'right' }}>{v}</T>
    </Row>
  );
}

/** Customer side of an itemised quote (F15): review, accept into payment, decline, or ask a question. */
export default function QuoteReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const booking = useApp((s) => s.bookings.find((b) => b.id === id));
  const acceptQuote = useApp((s) => s.acceptQuote);
  const rejectQuote = useApp((s) => s.rejectQuote);
  const startCheckout = useApp((s) => s.startBookingCheckout);
  const ensureConversation = useApp((s) => s.ensureConversation);
  const sendMessage = useApp((s) => s.sendMessage);
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  if (!booking) {
    return (
      <Screen header={<ScreenHeader title="Quote" onBack={() => goBack('/my-bookings?tab=musician')} />}>
        <T v="body">This quote doesn’t exist anymore.</T>
        <Button title="Your bookings" onPress={() => router.replace('/my-bookings?tab=musician')} />
      </Screen>
    );
  }

  const b = booking;
  const provider = providerOf(b);
  const name = provider.name;
  const ref = bookingRef(b);
  const quote = b.quote;
  const chat = () => router.push(`/chat/${ensureConversation(b.targetId)}`);
  const toBooking = () => router.replace(`/booking/${b.id}`);

  const header = (
    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 14, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadow(1) }}>
      <Photo src={provider.image ?? 'ven_moon'} style={{ width: 60, height: 60 }} radius={16} />
      <View style={{ flex: 1, gap: 3 }}>
        <T v="title" numberOfLines={1}>{name}</T>
        <T v="small">{b.eventTitle} · {shortDate(b.date)}, {b.startTime}–{b.endTime}</T>
        <T v="small" numberOfLines={1}>{b.location}</T>
      </View>
    </View>
  );

  if (b.pricing !== 'quote' || !quote || quote.version === 0) {
    const waiting = b.pricing === 'quote' && b.status === 'requested';
    return (
      <Screen header={<ScreenHeader title="Quote" subtitle={`Booking ${ref}`} onBack={() => goBack(`/booking/${b.id}`)} />}>
        {header}
        <Card style={{ gap: 10, alignItems: 'center', paddingVertical: 24 }}>
          <Icon name={waiting ? 'file-clock-outline' : 'file-document-outline'} size={40} color={colors.brand} />
          <T v="h3" center>{waiting ? `Waiting for ${name}’s quote` : 'No quote for this booking'}</T>
          <T v="body" color={colors.muted} center>
            {waiting ? `${name} reviews your details and sends an itemised quote. Nothing is charged until you accept it.` : 'This booking uses the listed price agreed in the request.'}
          </T>
          {waiting ? <TimeLeft deadline={b.deadline} prefix="Reply due ·" /> : null}
        </Card>
        {waiting ? <Button title={`Message ${name}`} icon="message-text-outline" variant="secondary" onPress={chat} /> : null}
        <Button title="Open booking" onPress={toBooking} />
      </Screen>
    );
  }

  const state = quoteState(quote);
  // A withdrawn or cancelled request keeps its last quote status, but that offer can't be accepted anymore.
  const open = (state === 'sent' || state === 'revised') && b.status === 'requested';
  const daysLeft = quote.validUntil ? Math.floor((parse(quote.validUntil).getTime() + 12 * 3_600_000 - TODAY.getTime()) / 86_400_000) : undefined;
  const awaitingPayment = state === 'accepted' && (b.status === 'accepted' || b.status === 'payment_failed') && b.payment !== 'paid';
  const confirmed = isConfirmed(b.status);
  // The request can be withdrawn, or the booking cancelled after acceptance: nothing is payable or acceptable then.
  const closed = state !== 'rejected' && isClosed(b.status);
  const nothingCharged = !b.payment || b.payment === 'not_started' || b.payment === 'failed';

  const accept = () => {
    if (!open || !acceptQuote(b.id)) {
      toast('This quote can’t be accepted anymore. Ask for a new one.');
      return;
    }
    startCheckout(b.id);
    router.push('/checkout');
  };
  const pay = () => {
    startCheckout(b.id);
    router.push('/checkout');
  };
  const askNew = () => {
    const cid = ensureConversation(b.targetId);
    sendMessage(cid, { type: 'text', text: `Hi ${name}, the quote for ${b.eventTitle} (${shortDate(b.date)}) expired before I could accept it. Could you send an updated quote?` });
    toast(`Asked ${name} for a new quote`);
    router.push(`/chat/${cid}`);
  };

  return (
    <Screen
      header={<ScreenHeader title={`Quote v${quote.version}`} subtitle={`Booking ${ref}`} onBack={() => goBack(`/booking/${b.id}`)} />}
      footer={
        open ? (
          <BottomBar>
            <Row gap={10}>
              <Button title="Decline" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => setRejecting(true)} />
              <Button title={`Accept · ${euro(quote.total)}`} size="md" style={{ flex: 1.4 }} onPress={() => setConfirming(true)} />
            </Row>
            <Button title="Ask a question" variant="ghost" size="md" icon="message-text-outline" onPress={chat} style={{ marginTop: 4 }} />
          </BottomBar>
        ) : state === 'expired' && !closed ? (
          <BottomBar>
            <Button title="Ask for a new quote" onPress={askNew} />
            <Button title="Open booking" variant="ghost" onPress={toBooking} style={{ marginTop: 4 }} />
          </BottomBar>
        ) : awaitingPayment ? (
          <BottomBar>
            <Button title={`Continue to payment · ${euro(b.amount)}`} onPress={pay} />
          </BottomBar>
        ) : null
      }
    >
      {header}

      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        <Pill label={closed ? 'Request closed' : QUOTE_STATUS_LABEL[state]} tone={closed ? 'neutral' : QUOTE_STATUS_TONE[state]} />
        {open && daysLeft !== undefined ? <Pill label={daysLeft <= 0 ? 'Last day to accept' : `${plural(daysLeft, 'day')} left to accept`} tone={daysLeft <= 2 ? 'warning' : 'brand'} icon="timer-sand" /> : null}
        {state === 'accepted' && !closed ? <PaymentPill state={b.payment} /> : null}
      </Row>

      {state === 'revised' && open ? (
        <Banner icon="file-replace-outline" tone="warning">{`${name} revised the quote. Version ${quote.version} replaces the earlier offer and needs your explicit acceptance; nothing changes until you accept it.`}</Banner>
      ) : null}
      {state === 'expired' && !closed ? (
        <Banner icon="timer-off-outline" tone="danger">{`This quote was valid until ${quote.validUntil ? shortDate(quote.validUntil) : 'its deadline'}. An expired quote can’t be accepted. Ask ${name} for a new one; nothing was charged.`}</Banner>
      ) : null}
      {state === 'rejected' ? <Banner icon="close-circle-outline" tone="neutral">You declined this quote. The offer is closed and nothing was charged.</Banner> : null}
      {closed ? (
        <Banner icon="calendar-remove-outline" tone="neutral">
          {`${state === 'accepted' ? 'You accepted this quote, but the booking was cancelled' : 'This request was closed, so the quote can’t be accepted anymore'}${b.cancelReason ? ` (${b.cancelReason})` : ''}. ${nothingCharged || !b.payment ? 'Nothing was charged.' : PAYMENT_NOTE[b.payment]}`}
        </Banner>
      ) : state === 'accepted' ? (
        <Banner icon={confirmed ? 'check-decagram' : 'credit-card-clock-outline'} tone={confirmed ? 'success' : 'warning'}>
          {confirmed ? 'You accepted this quote and the payment is verified. The booking is confirmed.' : `You accepted this quote. ${b.payment ? PAYMENT_NOTE[b.payment] : ''} The booking is confirmed only once the payment is verified.`}
        </Banner>
      ) : null}

      <Card style={{ gap: 12 }}>
        <Row justify="space-between">
          <T v="title">Itemised price</T>
          {quote.validUntil ? <T v="small">Valid until {shortDate(quote.validUntil)}</T> : null}
        </Row>
        <LineItems items={quote.items} total={quote.total} />
        {quote.note ? (
          <View style={{ padding: 12, borderRadius: 12, backgroundColor: colors.brandTint }}>
            <T v="small" color={colors.muted}>Note from {name}</T>
            <T v="body" color={colors.brandDeep}>“{quote.note}”</T>
          </View>
        ) : null}
      </Card>

      <Card style={{ gap: 4 }}>
        <T v="title" style={{ marginBottom: 4 }}>What you asked for</T>
        <TextLine k={b.type === 'lesson' ? 'Lesson' : 'Event'} v={b.eventTitle} />
        <KeyValue k="When" v={`${shortDate(b.date)}, ${b.startTime}–${b.endTime}`} />
        <TextLine k="Where" v={b.location} />
        {b.type !== 'lesson' ? <KeyValue k="Guests" v={String(b.guests)} /> : null}
        <TextLine k={b.type === 'venue' ? 'Setup' : b.type === 'lesson' ? 'Format' : 'Equipment'} v={b.equipment} />
        <TextLine k="Options" v={b.extras || 'None'} />
        {b.note ? <TextLine k="Your message" v={b.note} /> : null}
      </Card>

      {open ? (
        <Card style={{ gap: 8 }}>
          <T v="title">Before you accept</T>
          <T v="body" color={colors.inkSoft}>Accepting takes you to the payment step. The booking is confirmed only once the payment is verified.</T>
          <T v="body" color={colors.inkSoft}>If the payment fails, nothing is charged and you can retry on this same booking. Declining closes the offer without any charge.</T>
          <T v="small">Questions about the scope? Ask {name} in chat before you decide. If they change anything, they send a revised quote for you to accept.</T>
        </Card>
      ) : null}

      <ActionSheet
        visible={confirming}
        title={`Accept quote v${quote.version} for ${euro(quote.total)}?`}
        actions={[{ label: 'Accept and continue to payment', sub: 'Confirmed once the payment is verified', icon: 'check-circle-outline', onPress: accept }]}
        onClose={() => setConfirming(false)}
      />
      <ReasonSheet
        visible={rejecting}
        title="Decline this quote?"
        body={`The offer from ${name} closes without a booking or any charge. You can still message them afterwards.`}
        reasons={REJECT_REASONS}
        confirmLabel="Decline quote"
        destructive
        notePlaceholder="Add a note for the provider (optional)"
        onSubmit={(reason, note) => {
          rejectQuote(b.id);
          sendMessage(ensureConversation(b.targetId), { type: 'text', text: `I’m declining the quote for ${b.eventTitle}: ${reason}.${note ? ` ${note}` : ''}` });
          toast('Quote declined. Nothing was charged.');
          toBooking();
        }}
        onClose={() => setRejecting(false)}
      />
    </Screen>
  );
}
