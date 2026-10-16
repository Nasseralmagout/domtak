import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReasonSheet } from '../../../components/ActionSheet';
import { BottomBar, DemoBar, goBack, PermissionNotice, Screen, ScreenHeader } from '../../../components/layout';
import { Avatar, Banner, Button, Card, Chip, Divider, Field, IconButton, KeyValue, LineItems, PaymentPill, Pill, Row, T, TimeLeft } from '../../../components/ui';
import { profiles, venueById } from '../../../data/mock';
import type { IncomingRequest, QuoteItem, QuoteStatus } from '../../../data/types';
import { CHARGE_LABEL, PAYMENT_PROVIDER_LABEL, QUOTE_STATUS_TONE, quoteState, quoteTotal, REMINDER_HOURS, reminderDue, REQUEST_STATUS_LABEL, requestConflict, RESPONSE_HOURS } from '../../../lib/booking';
import { ago, dateTime, euro, isoDay, parse, shortDate, TODAY } from '../../../lib/format';
import { commissionOf, PLATFORM_COMMISSION_RATE, providerNet, toLineItems, venueEstimate } from '../../../lib/pricing';
import { OWN_ARTIST_ID, useArtist } from '../../../store/services';
import { toast } from '../../../store/toast';
import { canAcceptBookings, OWN_VENUE_ID, overlayVenue, useApp, type Weekday } from '../../../store/useApp';
import { colors } from '../../../theme';

const DECLINE_REASONS = ['Already booked that date', 'The price doesn’t work for me', 'Not my music style', 'Can’t meet the requirements', 'Other reason'];
const WEEKDAY: Weekday[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const VALIDITY = [3, 7, 14];
const BASE_LABEL: Record<NonNullable<IncomingRequest['kind']>, string> = { performance: 'Performance fee', venue: 'Venue hire', lesson: 'Lesson' };
const pct = `${Math.round(PLATFORM_COMMISSION_RATE * 100)}%`;
/** Quote states in the provider's words (the customer sees "Quote received"). */
const PROVIDER_QUOTE_LABEL: Record<QuoteStatus, string> = { requested: 'Quote requested', sent: 'Quote sent', revised: 'Revised quote sent', accepted: 'Quote accepted', rejected: 'Quote declined', expired: 'Quote expired' };

type Line = { label: string; amount: string };

/** The request's charges as line items (base fee plus separate charges). */
function requestItems(r: IncomingRequest): QuoteItem[] {
  if (!r.charges) return [{ label: BASE_LABEL[r.kind ?? 'performance'], amount: r.offer }];
  const items: QuoteItem[] = [{ label: `${BASE_LABEL[r.kind ?? 'performance']}${r.kind === 'venue' ? '' : ` · ${r.hours} h`}`, amount: r.charges.base }];
  (['travel', 'equipment', 'catering', 'security', 'fee'] as const).forEach((k) => {
    const v = r.charges?.[k];
    if (v) items.push({ label: CHARGE_LABEL[k], amount: v });
  });
  return items;
}

export default function RequestReview() {
  const { id, decline } = useLocalSearchParams<{ id: string; decline?: string }>();
  const insets = useSafeAreaInsets();
  const user = useApp((s) => s.user);
  const req = useApp((s) => s.requests.find((r) => r.id === id));
  const requests = useApp((s) => s.requests);
  const availability = useApp((s) => s.availability);
  const venueListing = useApp((s) => s.venueListing);
  const setStatus = useApp((s) => s.setRequestStatus);
  const quoteRequest = useApp((s) => s.quoteRequest);
  const setRequestPayment = useApp((s) => s.setRequestPayment);
  const ensureConversation = useApp((s) => s.ensureConversation);
  const sendMessage = useApp((s) => s.sendMessage);
  const ownArtist = useArtist(OWN_ARTIST_ID);
  // ?decline=1 (from the requests list) opens the decline sheet; it only applies while the request is open.
  const [declineOpen, setDeclineOpen] = useState(decline === '1');
  const [composer, setComposer] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [validDays, setValidDays] = useState(7);
  const [quoteNote, setQuoteNote] = useState('');

  if (!canAcceptBookings(user)) {
    return (
      <Screen header={<ScreenHeader title="Request" onBack={() => goBack('/(tabs)')} />}>
        <PermissionNotice role={user.role === 'venue' ? 'venue' : 'musician'} action="respond to booking requests" />
      </Screen>
    );
  }
  if (!req) {
    return (
      <Screen header={<ScreenHeader title="Request" onBack={() => goBack('/pro/requests')} />}>
        <T v="body">Request not found.</T>
        <Button title="All requests" onPress={() => router.replace('/pro/requests')} />
      </Screen>
    );
  }

  const r = req;
  const first = r.requester.split(' ')[0];
  // Requests from people with a Domtak profile can be answered in chat.
  const contact = profiles.find((p) => p.name === r.requester);
  const isQuote = r.pricing === 'quote';
  const q: QuoteStatus | undefined = r.quote ? (r.status === 'accepted' || r.status === 'past' ? 'accepted' : quoteState(r.quote)) : undefined;
  const quoteSent = !!r.quote && r.quote.version > 0;
  const conflict = r.status === 'new' ? requestConflict(r, requests) : undefined;
  const day = r.isoDate ? parse(r.isoDate) : undefined;
  const weekday = day ? WEEKDAY[day.getDay()] : undefined;
  const softWarning =
    r.status === 'new' && r.isoDate && r.kind !== 'venue'
      ? availability.blockedDates.includes(r.isoDate)
        ? 'You blocked this date in your availability.'
        : weekday && !availability.days[weekday]
          ? `${weekday} isn’t one of your usual days.`
          : undefined
      : undefined;
  const items = isQuote ? (r.quote?.items ?? []) : requestItems(r);
  const gross = isQuote ? (r.quote?.total ?? 0) : r.offer;
  const reminded = reminderDue(r);

  const say = (text: string) => {
    if (contact) sendMessage(ensureConversation(contact.id), { type: 'text', text });
  };
  const openChat = () => (contact ? router.push(`/chat/${ensureConversation(contact.id)}`) : router.push('/inbox'));

  // ---------- Quote composer ----------
  const openComposer = () => {
    let start: QuoteItem[];
    if (r.quote?.items.length) start = r.quote.items;
    else if (!isQuote) start = requestItems(r);
    else if (r.kind === 'venue') {
      const v = overlayVenue(venueById(OWN_VENUE_ID), venueListing);
      start = v ? toLineItems(venueEstimate({ ...v, pricing: 'listed' }, { guests: r.guests }).items).map(({ label, amount }) => ({ label, amount })) : [{ label: 'Venue hire', amount: r.offer }];
    } else if (r.kind === 'lesson') start = [{ label: 'Lesson', amount: r.offer }];
    else {
      start = [{ label: `Performance · ${r.hours} h`, amount: availability.feePerHour * r.hours }];
      if (ownArtist?.charges?.travel) start.push({ label: 'Travel', amount: ownArtist.charges.travel });
      if (ownArtist?.charges?.equipment && !/provided|on site|setup/i.test(r.equipment)) start.push({ label: 'Equipment', amount: ownArtist.charges.equipment });
    }
    setLines(start.map((i) => ({ label: i.label, amount: String(i.amount) })));
    setQuoteNote(r.quote?.note ?? '');
    setValidDays(7);
    setComposer(true);
  };
  const draftItems: QuoteItem[] = lines.map((l) => ({ label: l.label.trim(), amount: Number(l.amount.replace(',', '.')) || 0 })).filter((l) => l.label && l.amount > 0);
  const draftTotal = quoteTotal(draftItems);
  const validUntil = isoDay(new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + validDays, 12));
  const unchanged = quoteSent && r.quote && JSON.stringify(r.quote.items) === JSON.stringify(draftItems) && (r.quote.note ?? '') === quoteNote.trim();
  const sendQuote = () => {
    if (!draftItems.length || unchanged) return;
    const revision = quoteSent || !isQuote;
    quoteRequest(r.id, draftItems, validUntil, quoteNote.trim() || undefined);
    say(`${revision ? 'Revised offer' : 'Quote'} for ${r.title} (${r.date}): ${draftItems.map((i) => `${i.label} ${euro(i.amount)}`).join(', ')}. Total ${euro(draftTotal)}, valid until ${shortDate(validUntil)}.${quoteNote.trim() ? ` ${quoteNote.trim()}` : ''}`);
    setComposer(false);
    toast(revision ? `Revised offer sent to ${first}. It needs their acceptance.` : `Quote sent to ${first}`);
  };

  const accept = () => {
    if (conflict) return;
    setStatus(r.id, 'accepted');
    say(`I’ve accepted ${r.title} on ${r.date}. Looking forward to it!`);
    toast('Accepted. The customer’s payment is being finalized; the booking is confirmed once it’s verified.');
  };

  // ---------- Status banner ----------
  let status: { tone: 'success' | 'warning' | 'danger' | 'brand' | 'neutral'; icon: 'check-decagram' | 'credit-card-clock-outline' | 'credit-card-off-outline' | 'close-circle-outline' | 'clock-outline' | 'cash-check'; text: string } | undefined;
  if (r.status === 'accepted') {
    status =
      r.payment === 'paid'
        ? { tone: 'success', icon: 'check-decagram', text: 'Confirmed: the customer’s payment is verified and the date is locked in your calendar.' }
        : r.payment === 'failed'
          ? { tone: 'danger', icon: 'credit-card-off-outline', text: 'The customer’s payment failed, so this booking isn’t confirmed. They can retry safely on the same booking; nothing was charged.' }
          : { tone: 'warning', icon: 'credit-card-clock-outline', text: `Accepted · waiting for the customer’s verified payment. Don’t treat the ${r.kind === 'venue' ? 'date' : 'gig'} as confirmed until then.` };
  } else if (r.status === 'declined') {
    status = { tone: 'neutral', icon: 'close-circle-outline', text: `You declined this request. ${r.payment === 'released' ? 'The customer’s payment authorization was released.' : r.payment === 'release_pending' ? 'The customer’s payment authorization is being released (release pending).' : 'The customer wasn’t charged.'}` };
  } else if (r.status === 'expired') {
    status = { tone: 'warning', icon: 'clock-outline', text: `No response within ${RESPONSE_HOURS} hours, so the request expired. ${r.payment === 'released' ? 'The customer’s payment was released.' : 'Release of the customer’s payment has started.'}` };
  } else if (r.status === 'past') {
    status = { tone: 'success', icon: 'cash-check', text: `Completed. Payout: ${r.payment ? PAYMENT_PROVIDER_LABEL[r.payment].toLowerCase() : 'see Earnings'}.` };
  }

  // ---------- Demo controls ----------
  const demo: { label: string; onPress: () => void }[] = [];
  if (r.status === 'new' && isQuote && (q === 'sent' || q === 'revised')) {
    demo.push({ label: `${first} accepts your quote`, onPress: () => { setStatus(r.id, 'accepted'); setRequestPayment(r.id, 'capture_pending'); toast(`${first} accepted · payment being finalized`); } });
  }
  if (r.status === 'accepted' && r.payment !== 'paid') {
    demo.push({ label: 'Customer payment verified', onPress: () => { setRequestPayment(r.id, 'paid'); toast('Payment verified · booking confirmed'); } });
    if (r.payment !== 'failed') demo.push({ label: 'Customer payment fails', onPress: () => { setRequestPayment(r.id, 'failed'); toast('Payment failed · not confirmed'); } });
  }
  if (r.status === 'accepted' && r.payment === 'paid') demo.push({ label: 'The event took place', onPress: () => { setStatus(r.id, 'past'); setRequestPayment(r.id, 'payout_pending'); toast('Completed · payout pending'); } });
  if (r.payment === 'release_pending') demo.push({ label: 'Payment provider confirms the release', onPress: () => { setRequestPayment(r.id, 'released'); toast('Release confirmed'); } });
  if (r.status === 'past' && r.payment === 'payout_pending') demo.push({ label: 'Payout sent', onPress: () => { setRequestPayment(r.id, 'paid_out'); toast('Paid out'); } });

  // ---------- Footer ----------
  let footer = null;
  if (r.status === 'new') {
    footer = (
      <BottomBar>
        {conflict ? <T v="small" color={colors.danger} style={{ marginBottom: 8 }}>{`Accepting is blocked: you already accepted ${conflict.title} on this date.`}</T> : null}
        <Row gap={8}>
          <Button title="Decline" variant="secondary" size="md" style={{ flex: 1, borderColor: colors.borderStrong }} onPress={() => setDeclineOpen(true)} />
          {isQuote ? (
            <Button title={quoteSent ? (q === 'expired' ? 'Send new quote' : 'Revise quote') : 'Send quote'} size="md" style={{ flex: 1.4 }} onPress={openComposer} />
          ) : (
            <>
              <Button title="Propose changes" accessibilityLabel="Propose different terms as a revised offer" variant="secondary" size="md" style={{ flex: 1.2, paddingHorizontal: 10 }} onPress={openComposer} />
              <Button title="Accept" accessibilityLabel={`Accept ${first}’s request for ${euro(r.offer)}`} size="md" style={{ flex: 1 }} disabled={!!conflict} onPress={accept} />
            </>
          )}
        </Row>
      </BottomBar>
    );
  } else if (r.status === 'accepted') {
    footer = (
      <BottomBar>
        <Button title={contact ? `Message ${first}` : 'Open inbox'} icon="message-text-outline" onPress={openChat} />
        <Button title="Open calendar" variant="ghost" onPress={() => router.push(r.isoDate ? { pathname: '/(tabs)/calendar', params: { date: r.isoDate } } : '/(tabs)/calendar')} style={{ marginTop: 6 }} />
      </BottomBar>
    );
  }

  return (
    <>
      <Screen header={<ScreenHeader title={r.status === 'new' ? `Request from ${first}` : r.title} subtitle={REQUEST_STATUS_LABEL[r.status]} onBack={() => goBack('/pro/requests')} />} footer={footer}>
        <Row gap={12}>
          <Avatar src={contact?.avatar} label={r.initials} size={48} verified={contact?.verified} />
          <View style={{ flex: 1 }}>
            <T v="bodyBold">{r.requester}</T>
            <T v="small">{r.requesterRole}</T>
          </View>
          {r.status === 'new' ? <TimeLeft deadline={r.deadline} /> : <PaymentPill state={r.payment} provider />}
        </Row>

        {r.status === 'new' ? (
          <Banner icon={reminded ? 'bell-ring-outline' : 'timer-sand'} tone={reminded ? 'warning' : 'brand'}>
            {`Answer by ${r.deadline ? dateTime(r.deadline) : 'the deadline'}. ${reminded && r.reminderAt ? `A reminder was sent ${ago(r.reminderAt)} after ${REMINDER_HOURS} hours without a response. ` : `You get a reminder after ${REMINDER_HOURS} hours. `}If you don’t answer, the request expires and the customer’s payment is released.`}
          </Banner>
        ) : null}

        {status ? <Banner icon={status.icon} tone={status.tone}>{status.text}</Banner> : null}

        <Card style={{ gap: 6 }}>
          <T v="h2">{r.title}</T>
          {r.kind && r.kind !== 'performance' ? <Pill label={BASE_LABEL[r.kind]} tone="neutral" /> : null}
          <KeyValue k="Date" v={r.date} />
          <KeyValue k="Time" v={`${r.time} (${r.hours} h)`} />
          <KeyValue k="Location" v={r.location} />
          <KeyValue k="Guests" v={`~${r.guests} people`} />
          <KeyValue k="Equipment" v={r.equipment} />
          {r.message ? <View style={{ padding: 12, borderRadius: 12, backgroundColor: colors.brandTint, marginTop: 4 }}><T v="body" color="#2E1D5E">“{r.message}”</T></View> : null}
        </Card>

        {r.status === 'new' ? (
          conflict ? (
            <Banner icon="calendar-alert" tone="danger">{`You already accepted ${conflict.title} on ${conflict.date}. Accepting this request is blocked so you don’t double-book. Decline it, or message ${first} about another date.`}</Banner>
          ) : softWarning ? (
            <Banner icon="calendar-alert" tone="warning">{`${softWarning} You can still accept if you’re available.`}</Banner>
          ) : (
            <Banner icon="calendar-check" tone="success">No conflicts with your confirmed work on this date.</Banner>
          )
        ) : null}

        {r.counterOffer !== undefined && r.status === 'new' && !quoteSent ? (
          <Banner icon="swap-horizontal">{`Your earlier counter offer of ${euro(r.counterOffer)} is still with ${first}. Use Propose changes to send an itemised revised offer they can accept.`}</Banner>
        ) : null}

        <Card style={{ gap: 10 }}>
          <Row justify="space-between">
            <T v="title">{isQuote ? (quoteSent ? `Your quote v${r.quote?.version}` : 'Quote requested') : 'Requested charges'}</T>
            {isQuote && q ? <Pill label={PROVIDER_QUOTE_LABEL[q]} tone={QUOTE_STATUS_TONE[q]} /> : null}
          </Row>
          {isQuote && !quoteSent ? (
            <T v="body" color={colors.muted}>{`${first} asked for an itemised quote. List the performance, travel, equipment and any other charges separately.`}</T>
          ) : (
            <LineItems items={items} total={gross} totalLabel={isQuote ? 'Quote total' : 'Customer total'} />
          )}
          {isQuote && quoteSent && r.quote?.validUntil ? (
            <T v="small">{q === 'expired' ? `Expired on ${shortDate(r.quote.validUntil)}. Send a new quote if you still want the booking.` : `Valid until ${shortDate(r.quote.validUntil)}. ${q === 'revised' ? 'A revised quote needs the customer’s acceptance again.' : `Waiting for ${first} to accept, decline or ask questions.`}`}</T>
          ) : null}
          {!isQuote ? <T v="small">Accepting keeps exactly these terms. To change anything, send a revised offer instead; nothing changes until {first} accepts it.</T> : null}
        </Card>

        {gross > 0 ? (
          <Card style={{ gap: 6 }}>
            <T v="title" style={{ marginBottom: 2 }}>Your estimated earnings</T>
            <KeyValue k="Gross booking value" v={euro(gross, true)} />
            <KeyValue k={`Platform commission (${pct})`} v={`−${euro(commissionOf(gross), true)}`} />
            <Divider style={{ marginVertical: 4 }} />
            <KeyValue k="Estimated payout" v={euro(providerNet(gross), true)} strong color={colors.brand} />
            <T v="small" style={{ fontSize: 12 }}>Estimated. You’re paid only after a verified payment, and payout timing follows the settlement policy. Gross is not what you receive.</T>
            {r.status === 'past' ? <Button title="Open earnings" variant="light" size="md" icon="wallet-outline" onPress={() => router.push('/pro/earnings')} style={{ marginTop: 6 }} /> : null}
          </Card>
        ) : null}

        {contact && r.status !== 'new' && r.status !== 'accepted' ? <Button title={`Message ${first}`} variant="secondary" icon="message-text-outline" onPress={openChat} /> : null}
        {r.status === 'new' && contact ? <Button title={`Discuss scope with ${first}`} variant="ghost" icon="message-text-outline" onPress={openChat} /> : null}

        {demo.length ? (
          <DemoBar note="Simulate what the customer, the bank or time does next. Each button changes this request for real.">
            <View style={{ gap: 8 }}>
              {demo.map((a) => <Button key={a.label} title={a.label} variant="light" size="md" onPress={a.onPress} />)}
            </View>
          </DemoBar>
        ) : null}
      </Screen>

      <ReasonSheet
        visible={declineOpen && r.status === 'new'}
        title="Why are you declining?"
        body={`${first} is told you can’t take it. ${r.payment === 'authorized' ? 'Their payment authorization is released.' : 'Nothing was charged.'} Declining doesn’t affect their other bookings.`}
        reasons={DECLINE_REASONS}
        confirmLabel="Decline request"
        destructive
        notePlaceholder={`Note for ${first} (optional)`}
        onSubmit={(reason, note) => {
          setStatus(r.id, 'declined');
          say(`Sorry, I can’t take ${r.title} on ${r.date}: ${reason.toLowerCase()}.${note ? ` ${note}` : ''}`);
          toast(`Declined: ${reason.toLowerCase()}`);
        }}
        onClose={() => setDeclineOpen(false)}
      />

      <Modal visible={composer} transparent animationType="slide" onRequestClose={() => setComposer(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" style={{ flex: 1 }} onPress={() => setComposer(false)} />
            <View accessibilityViewIsModal style={{ maxHeight: '90%', backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingBottom: insets.bottom + 16 }}>
              <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 8 }} />
              <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }} keyboardShouldPersistTaps="handled">
                <T v="h3" accessibilityRole="header">{!isQuote ? 'Propose different terms' : quoteSent ? `Revise quote (v${(r.quote?.version ?? 0) + 1})` : 'Send an itemised quote'}</T>
                <T v="small">
                  {!isQuote
                    ? `${first}’s request stays exactly as sent until they accept your revised offer. Nothing changes silently.`
                    : quoteSent
                      ? 'The revision replaces your earlier quote and needs the customer’s explicit acceptance.'
                      : 'List each charge separately. The customer accepts, declines or asks questions before paying.'}
                </T>
                {lines.map((l, i) => (
                  <Row key={i} gap={8} align="flex-start">
                    <Field placeholder="Item" value={l.label} onChangeText={(t) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, label: t } : x)))} accessibilityLabel={`Item ${i + 1} name`} style={{ flex: 1 }} />
                    <Field placeholder="€" value={l.amount} onChangeText={(t) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, amount: t.replace(/[^\d,.]/g, '') } : x)))} keyboardType="decimal-pad" accessibilityLabel={`Item ${i + 1} amount in euro`} style={{ width: 96 }} />
                    <IconButton name="close" label={`Remove item ${i + 1}`} size={44} iconSize={20} color={colors.muted} onPress={() => setLines((ls) => ls.filter((_, j) => j !== i))} />
                  </Row>
                ))}
                <Button title="Add a line" icon="plus" variant="ghost" size="md" onPress={() => setLines((ls) => [...ls, { label: '', amount: '' }])} style={{ alignSelf: 'flex-start' }} />
                <View style={{ gap: 8 }}>
                  <T v="label">Valid for</T>
                  <Row gap={8}>
                    {VALIDITY.map((d) => <Chip key={d} label={`${d} days`} selected={validDays === d} onPress={() => setValidDays(d)} />)}
                  </Row>
                  <T v="small">Valid until {shortDate(validUntil)}. An expired quote can’t be accepted.</T>
                </View>
                <Field label="Note (optional)" value={quoteNote} onChangeText={setQuoteNote} multiline placeholder="e.g. Two sets with a 30-minute break" />
                <View style={{ gap: 4 }}>
                  <KeyValue k="Total for the customer" v={euro(draftTotal, true)} strong />
                  <KeyValue k={`Platform commission (${pct})`} v={`−${euro(commissionOf(draftTotal), true)}`} />
                  <KeyValue k="Your estimated payout" v={euro(providerNet(draftTotal), true)} color={colors.brand} />
                </View>
                <Row gap={10}>
                  <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setComposer(false)} />
                  <Button title={!isQuote || quoteSent ? 'Send revision' : 'Send quote'} style={{ flex: 1 }} disabled={!draftItems.length || !!unchanged} onPress={sendQuote} />
                </Row>
                {!draftItems.length ? <T v="small" center>Add at least one item with a name and an amount.</T> : unchanged ? <T v="small" center>Change an item or the note to send a revision.</T> : null}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
