import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ReasonSheet } from '../../components/ActionSheet';
import { DemoBar, goBack, Screen, ScreenHeader } from '../../components/layout';
import { Banner, Button, Card, Icon, type IconName, KeyValue, LineItems, Photo, Pill, Row, StatusPill, Steps, T, TimeLeft, type Tone } from '../../components/ui';
import type { Booking, Profile, QuoteItem, Venue } from '../../data/types';
import {
  bookingRef,
  cancellationOutcome,
  chargeItems,
  isClosed,
  lessonOf,
  lifecycleIndex,
  LIFECYCLE,
  nextPaymentStep,
  PAYMENT_LABEL,
  PAYMENT_NOTE,
  PAYMENT_PROVIDER_LABEL,
  PAYMENT_TONE,
  providerOf,
  QUOTE_LIFECYCLE,
  QUOTE_STATUS_LABEL,
  QUOTE_STATUS_TONE,
  quoteState,
  quoteStepIndex,
  REMINDER_HOURS,
  reminderDue,
  RESPONSE_HOURS,
  isOverdue,
  timeLeft,
} from '../../lib/booking';
import { ago, dateTime, euro, isoDay, parse, plural, shortDate, time, TODAY } from '../../lib/format';
import { toLineItems, venueEstimate } from '../../lib/pricing';
import { useArtist } from '../../store/services';
import { toast } from '../../store/toast';
import { useApp, useEvent, useVenue } from '../../store/useApp';
import { colors, radius, shadow } from '../../theme';

type Action = { label: string; onPress: () => void; icon?: IconName };
interface Panel {
  tone: Tone;
  icon: IconName;
  title: string;
  body: string;
  primary?: Action;
  secondary?: Action;
  more?: Action[];
}

const CANCEL_REASONS = ['Plans changed', 'Event cancelled', 'Booked someone else', 'Date no longer works', 'Other'];
const CHANGE_REASONS = ['Different start time', 'Different number of guests', 'Different date', 'Different set length', 'Other'];
const REPORT_REASONS = ['Provider didn’t show up', 'Arrived late or left early', 'Sound or equipment problems', 'Different from what was agreed', 'Other'];

const PANEL_BG: Record<Tone, string> = { success: colors.successBg, warning: colors.warningBg, danger: colors.dangerBg, brand: colors.brandSoft, neutral: colors.chipIdle };
const PANEL_FG: Record<Tone, string> = { success: colors.success, warning: colors.warning, danger: colors.danger, brand: colors.brand, neutral: colors.label };

const round10 = (n: number) => Math.round(n / 10) * 10;

/**
 * What the customer sees about the money. A closed request or an open quote never asks for a payment:
 * "Payment needed" only makes sense while a payment step is actually open.
 */
function moneyView(b: Booking): { label: string; tone: Tone; note: string } {
  const p = b.payment;
  if (!p) return { label: 'No payment', tone: 'neutral', note: 'No payment has been taken.' };
  if (isClosed(b.status) && (p === 'not_started' || p === 'failed')) return { label: 'Not charged', tone: 'neutral', note: 'Nothing was charged for this booking.' };
  if (b.status === 'requested' && p === 'not_started') return { label: 'Not charged yet', tone: 'neutral', note: 'Nothing is charged until you accept a quote and complete the payment step.' };
  return { label: PAYMENT_LABEL[p], tone: PAYMENT_TONE[p], note: PAYMENT_NOTE[p] };
}

/** What the charges card explains under the line items, per kind of booking. */
const CHARGES_NOTE: Record<Booking['type'], string> = {
  musician: 'Travel and equipment are separate from the performance fee. Agreed terms stay as they are if prices change later.',
  venue: 'Catering and security are priced by the number of guests. Agreed terms stay as they are if prices change later.',
  lesson: 'A lesson has its own price; performance fees never apply. Agreed terms stay as they are if prices change later.',
};

/** Itemised quote a provider could send for this request (demo controls only). */
function demoQuote(b: Booking, artist?: Profile, venue?: Venue, revise = false): QuoteItem[] {
  let items: QuoteItem[];
  if (b.type === 'venue' && venue) {
    const est = venueEstimate(venue, { guests: b.guests, catering: /catering/i.test(b.extras), security: /security/i.test(b.extras) });
    items = toLineItems(est.items).map(({ label, amount }) => ({ label, amount }));
    if (est.quote) items.unshift({ label: 'Venue hire · 1 night', amount: venue.pricePerNight });
  } else if (b.type === 'lesson') {
    const lesson = lessonOf(b);
    items = [{ label: `${lesson?.title ?? 'Lesson'} · ${b.extras.match(/(\d+) sessions/)?.[1] ?? 1} × ${lesson?.durationMin ?? 60} min`, amount: round10((lesson?.price ?? 60) * Number(b.extras.match(/(\d+) sessions/)?.[1] ?? 1)) }];
  } else {
    const fee = artist?.feePerHour ?? 300;
    items = [{ label: `Performance · ${b.hours} h`, amount: fee * b.hours }];
    if (artist?.charges?.travel) items.push({ label: 'Travel', amount: artist.charges.travel });
    if (artist?.charges?.equipment) items.push({ label: 'Equipment', amount: artist.charges.equipment });
  }
  // A revision lowers the main line a little, so the new version is visibly different.
  return revise ? items.map((i, idx) => (idx === 0 ? { ...i, amount: round10(i.amount * 0.92) } : i)) : items;
}

/** Summary line whose value is free text, so it wraps instead of running off the card. */
function TextLine({ k, v }: { k: string; v: string }) {
  return (
    <Row justify="space-between" align="flex-start" gap={12} style={{ paddingVertical: 4 }}>
      <T v="body" color={colors.muted}>{k}</T>
      <T v="bodyBold" style={{ flex: 1, textAlign: 'right' }}>{v}</T>
    </Row>
  );
}

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const booking = useApp((s) => s.bookings.find((b) => b.id === id));
  const reviewed = useApp((s) => (id ? !!s.reviews[id] : false));
  const methods = useApp((s) => s.paymentMethods);
  const selectedPayment = useApp((s) => s.selectedPayment);
  const setStatus = useApp((s) => s.setBookingStatus);
  const startCheckout = useApp((s) => s.startBookingCheckout);
  const ensureConversation = useApp((s) => s.ensureConversation);
  const sendMessage = useApp((s) => s.sendMessage);
  const cancelBooking = useApp((s) => s.cancelBooking);
  const requestChange = useApp((s) => s.requestChange);
  const resolveChange = useApp((s) => s.resolveChange);
  const verifyPayment = useApp((s) => s.verifyPayment);
  const failPayment = useApp((s) => s.failPayment);
  const setPayment = useApp((s) => s.setPayment);
  const sendQuote = useApp((s) => s.sendQuote);
  const openCase = useApp((s) => s.openCase);
  const expireOverdue = useApp((s) => s.expireOverdue);
  const artist = useArtist(booking && booking.type !== 'venue' ? booking.targetId : undefined);
  const venue = useVenue(booking?.type === 'venue' ? booking.targetId : undefined);
  const linkedEvent = useEvent(booking?.eventId);
  const [sheet, setSheet] = useState<'cancel' | 'change' | 'report'>();

  if (!booking) {
    return (
      <Screen header={<ScreenHeader title="Booking" onBack={() => goBack('/my-bookings?tab=musician')} />}>
        <T v="body">Booking not found.</T>
        <Button title="Your bookings" onPress={() => router.replace('/my-bookings?tab=musician')} />
      </Screen>
    );
  }

  const b = booking;
  const provider = providerOf(b);
  const lesson = lessonOf(b);
  const name = provider.name;
  const ref = bookingRef(b);
  const isQuote = b.pricing === 'quote';
  const q = b.quote ? quoteState(b.quote) : undefined;
  const priced = !isQuote || (!!b.quote && b.quote.version > 0);
  // A withdrawn request keeps its last quote status; that offer is closed, not "received".
  const offerClosed = isClosed(b.status) && q !== 'accepted' && q !== 'rejected';
  const items = chargeItems(b);
  const method = methods.find((m) => m.id === selectedPayment);
  const payment = b.payment;
  const money = moneyView(b);
  const tab = b.type === 'venue' ? 'venue' : b.type === 'lesson' ? 'lesson' : 'musician';
  const browse = b.type === 'venue' ? '/venues' : '/artists/all';
  // Problems can be reported up to 48 h after the event.
  const reportable = TODAY.getTime() <= parse(b.date).getTime() + 2 * 86_400_000;
  const confirmed = b.status === 'confirmed' || b.status === 'paid';

  const chat = () => router.push(`/chat/${ensureConversation(b.targetId)}`);
  // A failed payment is retried on this same booking when you submit the payment step (checkout), not by opening it.
  const pay = () => {
    startCheckout(b.id);
    router.push('/checkout');
  };
  const askNewQuote = () => {
    const cid = ensureConversation(b.targetId);
    sendMessage(cid, { type: 'text', text: `Hi ${name}, the quote for ${b.eventTitle} (${shortDate(b.date)}) expired before I could accept it. Could you send an updated quote?` });
    toast(`Asked ${name} for a new quote`);
    router.push(`/chat/${cid}`);
  };
  const bookAgain = () => router.push({ pathname: '/booking/new', params: b.type === 'lesson' ? { type: 'lesson', id: b.targetId, lesson: b.lessonId ?? '' } : { type: b.type, id: b.targetId } });
  // A closed request stays closed (its release is tracked on its own). Asking again is a new request with the same details,
  // so the terms and payment details are confirmed again and nothing is authorized silently.
  const requestAgain = () =>
    router.push({
      pathname: '/booking/new',
      params: {
        type: b.type,
        id: b.targetId,
        ...(b.lessonId ? { lesson: b.lessonId } : {}),
        ...(b.eventId ? { eventId: b.eventId } : {}),
        date: b.date,
        title: b.eventTitle,
        start: b.startTime,
        hours: String(Math.max(1, Math.round(b.hours))),
        location: b.location,
        guests: String(b.guests),
        ...(b.type === 'venue' ? { catering: b.charges?.catering ? '1' : '0', security: b.charges?.security ? '1' : '0' } : {}),
        ...(b.pricing === 'quote' ? { quote: '1' } : {}),
      },
    });
  const addToCalendar = () => {
    toast(`${b.eventTitle} is in your calendar`);
    router.push({ pathname: '/(tabs)/calendar', params: { date: b.date } });
  };
  const refundCase = () => router.push({ pathname: '/booking/issue', params: { id: b.id } });
  const cancelAction: Action = confirmed ? { label: 'Cancel or request a refund', onPress: refundCase } : { label: b.status === 'pending' || b.status === 'requested' ? 'Cancel request' : 'Cancel booking', onPress: () => setSheet('cancel') };

  // ---------- What happens now ----------
  const moneyLine = money.note;
  let panel: Panel;
  switch (b.status) {
    case 'requested':
      if (isQuote && (q === 'sent' || q === 'revised') && b.quote) {
        panel = {
          tone: 'warning',
          icon: 'file-document-outline',
          title: q === 'revised' ? `Revised quote v${b.quote.version}` : 'Quote received',
          body: `${euro(b.quote.total)}${b.quote.validUntil ? `, valid until ${shortDate(b.quote.validUntil)}` : ''}. ${q === 'revised' ? 'It replaces the earlier version and needs your explicit acceptance. ' : ''}Review the items, then accept, decline or ask a question.`,
          primary: { label: 'Review quote', onPress: () => router.push(`/quote/${b.id}`) },
          secondary: { label: 'Ask a question', onPress: chat },
          more: [cancelAction],
        };
      } else if (isQuote && q === 'expired' && b.quote) {
        panel = {
          tone: 'neutral',
          icon: 'timer-off-outline',
          title: 'Quote expired',
          body: `This quote was valid until ${b.quote.validUntil ? shortDate(b.quote.validUntil) : 'its deadline'} and can’t be accepted anymore. Ask ${name} for a new one or withdraw the request. Nothing was charged.`,
          primary: { label: 'Ask for a new quote', onPress: askNewQuote },
          secondary: { label: 'Withdraw request', onPress: () => setSheet('cancel') },
        };
      } else if (isQuote) {
        panel = {
          tone: 'brand',
          icon: 'file-clock-outline',
          title: `Waiting for ${name}’s quote`,
          body: `They review your details and send an itemised quote${b.deadline ? ` within ${RESPONSE_HOURS} hours (${timeLeft(b.deadline).toLowerCase()})` : ''}. Nothing is charged until you accept it.`,
          primary: { label: `Message ${name}`, onPress: chat },
          secondary: { label: 'Withdraw request', onPress: () => setSheet('cancel') },
        };
      } else {
        panel = { tone: 'brand', icon: 'send-clock-outline', title: 'Request sent', body: `Your request is on its way to ${name}. ${moneyLine}`, primary: { label: `Message ${name}`, onPress: chat }, secondary: cancelAction };
      }
      break;
    case 'pending': {
      const overdue = isOverdue(b);
      const reminder = reminderDue(b)
        ? `A reminder was sent ${b.reminderAt ? ago(b.reminderAt) : ''} after ${REMINDER_HOURS} hours without a response.`
        : b.reminderAt && parse(b.reminderAt).getTime() > TODAY.getTime()
          ? `If they haven’t answered by ${time(b.reminderAt)}, they get a reminder.`
          : '';
      panel = overdue
        ? {
            tone: 'warning',
            icon: 'clock-alert-outline',
            title: 'Deadline passed',
            body: `${name} didn’t answer within ${RESPONSE_HOURS} hours, so this request is closing. The payment authorization is then released; you’ll see when that is complete.`,
            primary: { label: 'Update status', onPress: () => { const n = expireOverdue(); toast(n ? 'Request closed as expired' : 'Status is up to date'); } },
          }
        : {
            tone: 'warning',
            icon: 'timer-sand',
            title: `Awaiting ${name}`,
            body: `They have until ${b.deadline ? dateTime(b.deadline) : 'the deadline'} to accept or decline. ${reminder} ${moneyLine}`.replace(/\s+/g, ' ').trim(),
            primary: { label: `Message ${name}`, onPress: chat },
            secondary: cancelAction,
          };
      break;
    }
    case 'accepted':
      panel =
        payment === 'not_started'
          ? {
              tone: 'warning',
              icon: 'credit-card-outline',
              title: isQuote ? 'Quote accepted · payment needed' : 'Payment needed',
              body: `Complete the payment of ${euro(b.amount)} to confirm. The booking is confirmed only once the payment is verified.`,
              primary: { label: `Pay ${euro(b.amount)}`, onPress: pay },
              secondary: cancelAction,
            }
          : {
              tone: 'warning',
              icon: 'credit-card-clock-outline',
              title: 'Accepted · finalizing payment',
              body: `${name} accepted. We’re finalizing your payment and your bank may ask you to approve it. The booking is confirmed only once the payment is verified.`,
              primary: { label: 'Complete payment step', onPress: pay },
              secondary: { label: `Message ${name}`, onPress: chat },
              more: [cancelAction],
            };
      break;
    case 'payment_failed':
      panel = {
        tone: 'danger',
        icon: 'credit-card-off-outline',
        title: 'Payment failed',
        body: `Nothing was charged and your booking with ${name} is kept. Retry safely on this same booking or choose another method.${b.paymentAttempts ? ` ${plural(b.paymentAttempts, 'attempt')} so far.` : ''}`,
        primary: { label: 'Retry payment', onPress: pay },
        secondary: { label: 'Change payment method', onPress: () => router.push('/payment-methods') },
        more: [{ label: 'Get help', onPress: () => router.push('/help') }, { label: 'Cancel booking', onPress: () => setSheet('cancel') }],
      };
      break;
    case 'paid':
    case 'confirmed':
      panel = {
        tone: 'success',
        icon: 'check-decagram',
        title: 'Confirmed',
        body: `Payment verified. The agreed terms are kept even if ${name} changes prices later. Share arrival and ${b.type === 'lesson' ? 'lesson' : 'equipment'} details in chat.`,
        primary: { label: 'Open chat', onPress: chat },
        secondary: { label: 'Add to calendar', onPress: addToCalendar },
        more: [{ label: 'Request a change', onPress: () => setSheet('change') }, cancelAction],
      };
      break;
    case 'change_requested':
      panel = {
        tone: 'warning',
        icon: 'swap-horizontal',
        title: 'Change requested',
        body: `“${b.change?.note ?? 'Changed terms'}” The agreed terms stay as they are until both sides accept the change.`,
        primary: { label: `Message ${name}`, onPress: chat },
        secondary: { label: 'Withdraw change request', onPress: () => { resolveChange(b.id, false); toast('Change request withdrawn. The agreed terms stay.'); } },
      };
      break;
    case 'completed':
      panel = {
        tone: 'success',
        icon: 'party-popper',
        title: 'Completed',
        body: reviewed ? `Thanks for reviewing ${name}. You can still update your review.` : `Hope it went well. A review helps other people book ${name}.`,
        primary: { label: reviewed ? 'Edit review' : 'Leave review', onPress: () => router.push(`/review/${b.id}`) },
        secondary: reportable ? { label: 'Report a problem', onPress: () => setSheet('report') } : { label: `Book ${name} again`, onPress: bookAgain },
        more: reportable ? [{ label: `Book ${name} again`, onPress: bookAgain }] : undefined,
      };
      break;
    case 'declined':
      panel = {
        tone: 'danger',
        icon: 'close-circle-outline',
        title: `${name} declined`,
        body: `${name} can’t take this ${b.type === 'lesson' ? 'lesson' : 'booking'}. ${moneyLine}`,
        primary: { label: b.type === 'venue' ? 'Find similar venues' : 'Find similar artists', onPress: () => router.push(browse) },
        secondary: { label: `Message ${name}`, onPress: chat },
      };
      break;
    case 'expired':
      panel = {
        tone: 'warning',
        icon: 'clock-outline',
        title: `No response within ${RESPONSE_HOURS} hours`,
        body: `The request expired before ${name} answered. ${moneyLine}`,
        primary: { label: 'Send a new request', onPress: requestAgain },
        secondary: { label: 'Browse others', onPress: () => router.push(browse) },
      };
      break;
    case 'cancelled':
      panel = {
        tone: 'neutral',
        icon: 'calendar-remove-outline',
        title: q === 'rejected' ? 'Quote declined' : 'Booking cancelled',
        body: `${b.cancelReason ? `Reason: ${b.cancelReason}. ` : ''}${moneyLine}`,
        primary: payment === 'refund_pending' || payment === 'refunded' || payment === 'release_pending' ? { label: 'Refund details', onPress: refundCase } : { label: `Book ${name} again`, onPress: bookAgain },
        secondary: { label: b.type === 'venue' ? 'Find other venues' : 'Find other artists', onPress: () => router.push(browse) },
      };
      break;
    case 'disputed':
    default:
      panel = {
        tone: 'warning',
        icon: 'flag-outline',
        title: 'Problem reported',
        body: `Support is reviewing the case. The payment stays visible meanwhile: ${money.label.toLowerCase()}.`,
        primary: { label: 'Open case', onPress: refundCase },
        secondary: { label: `Message ${name}`, onPress: chat },
      };
  }

  // ---------- Progress ----------
  const showSteps = !isClosed(b.status) && b.status !== 'disputed';
  const steps = isQuote ? QUOTE_LIFECYCLE.map((s) => ({ title: s.name, note: s.note })) : LIFECYCLE.map((s) => ({ title: s.name, note: s.note }));
  const current = isQuote ? quoteStepIndex(b) : lifecycleIndex(b.status);

  // ---------- Demo controls ----------
  const demo: Action[] = [];
  if (b.status === 'requested' && isQuote) {
    if (!b.quote || b.quote.version === 0) demo.push({ label: `${name} sends a quote`, onPress: () => { sendQuote(b.id, demoQuote(b, artist, venue), isoDay(new Date(TODAY.getTime() + 7 * 86_400_000))); toast(`${name} sent a quote`); } });
    else demo.push({ label: `${name} revises the quote`, onPress: () => { sendQuote(b.id, demoQuote(b, artist, venue, true), isoDay(new Date(TODAY.getTime() + 7 * 86_400_000)), 'Adjusted after your questions.'); toast(`${name} sent a revised quote · it needs your acceptance`); } });
  }
  if (b.status === 'pending') {
    demo.push({ label: `${name} accepts`, onPress: () => { setStatus(b.id, 'accepted'); toast(`${name} accepted · finalizing payment`); } });
    demo.push({ label: `${name} declines`, onPress: () => { setStatus(b.id, 'declined'); toast(`${name} declined · release started`); } });
    demo.push({ label: 'No answer in 24 h', onPress: () => { setStatus(b.id, 'expired'); toast('Request expired · release started'); } });
  }
  if (b.status === 'accepted' && payment !== 'not_started') {
    demo.push({ label: 'Payment verified', onPress: () => { verifyPayment(b.id); toast('Payment verified · booking confirmed'); } });
    demo.push({ label: 'Payment fails', onPress: () => { failPayment(b.id); toast('Payment failed · nothing charged'); } });
  }
  if (confirmed) demo.push({ label: 'The event took place', onPress: () => { setStatus(b.id, 'completed'); toast('Booking completed'); } });
  if (b.status === 'change_requested') {
    demo.push({ label: `${name} agrees`, onPress: () => { resolveChange(b.id, true); toast('Change agreed by both sides'); } });
    demo.push({ label: `${name} keeps the terms`, onPress: () => { resolveChange(b.id, false); toast('Change declined · the agreed terms stay'); } });
  }
  const next = nextPaymentStep(payment);
  if (next && (payment === 'release_pending' || payment === 'refund_pending')) demo.push({ label: `Payment provider confirms: ${PAYMENT_PROVIDER_LABEL[next].toLowerCase()}`, onPress: () => { setPayment(b.id, next); toast(`${PAYMENT_LABEL[next]} · reference saved`); } });

  const cancelTitle = b.status === 'pending' || b.status === 'requested' ? 'Cancel this request?' : 'Cancel this booking?';

  return (
    <Screen header={<ScreenHeader title={`Booking ${ref}`} onBack={() => goBack(`/my-bookings?tab=${tab}`)} />}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${name}’s page`} onPress={() => router.push(provider.href as never)} style={{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 14, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadow(1) }}>
        <Photo src={provider.image ?? 'ven_moon'} style={{ width: 64, height: 64 }} radius={16} />
        <View style={{ flex: 1, gap: 3 }}>
          <T v="title" numberOfLines={1}>{name} · {lesson ? lesson.title : provider.subtitle}</T>
          <T v="small">{b.eventTitle} · {shortDate(b.date)}, {b.startTime}–{b.endTime}</T>
          <T v="small" numberOfLines={1}>{b.location}{priced ? ` · ${euro(b.amount)}` : ''}</T>
        </View>
        <Icon name="chevron-right" size={22} color={colors.subtle} />
      </Pressable>

      <Row justify="space-between" align="flex-start" gap={8}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 }}>
          <StatusPill booking={b} />
          <Pill label={money.label} tone={money.tone} icon="credit-card-outline" />
          {b.status === 'pending' ? <TimeLeft deadline={b.deadline} /> : null}
        </View>
        <T v="small">Requested {shortDate(b.createdAt)}</T>
      </Row>

      {b.pendingCancellation && !isClosed(b.status) && b.status !== 'completed' ? (
        <Banner icon="calendar-alert" tone="warning">
          <View style={{ gap: 8 }}>
            <T v="small" color={colors.warning}>{`The event was cancelled (${b.pendingCancellation.reason}). This booking is not cancelled automatically: cancel it under the agreed policy or agree new terms with ${name}.`}</T>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              <Button title={confirmed ? 'Cancellation and refund' : 'Cancel this booking'} size="sm" variant="secondary" onPress={cancelAction.onPress} />
              <Button title={`Message ${name}`} size="sm" variant="ghost" onPress={chat} />
            </Row>
          </View>
        </Banner>
      ) : null}

      <View style={{ padding: 16, borderRadius: radius.lg, backgroundColor: PANEL_BG[panel.tone], gap: 12 }}>
        <Row gap={10} align="flex-start">
          <Icon name={panel.icon} size={24} color={PANEL_FG[panel.tone]} />
          <View style={{ flex: 1, gap: 4 }}>
            <T v="title" color={panel.tone === 'brand' ? colors.brandDeep : PANEL_FG[panel.tone]}>{panel.title}</T>
            <T v="body" color={colors.inkSoft}>{panel.body}</T>
          </View>
        </Row>
        {panel.primary || panel.secondary ? (
          <View style={{ gap: 10 }}>
            {panel.primary ? <Button title={panel.primary.label} size="md" onPress={panel.primary.onPress} /> : null}
            {panel.secondary ? <Button title={panel.secondary.label} variant="secondary" size="md" onPress={panel.secondary.onPress} /> : null}
            {panel.more?.map((a) => <Button key={a.label} title={a.label} variant="ghost" size="md" onPress={a.onPress} />)}
          </View>
        ) : null}
      </View>

      {showSteps ? (
        <Card style={{ gap: 12 }}>
          <T v="title">Progress</T>
          <Steps steps={steps} current={current} failed={b.status === 'payment_failed'} />
          {b.status === 'change_requested' ? <T v="small">A change request pauses nothing: the confirmed booking and its terms stay valid.</T> : null}
        </Card>
      ) : null}

      <Card style={{ gap: 10 }}>
        <Row justify="space-between">
          <T v="title">{isQuote ? (b.quote && b.quote.version > 0 ? `Quote v${b.quote.version}` : 'Quote') : confirmed || b.status === 'completed' ? 'Agreed charges' : 'Charges'}</T>
          {isQuote && q ? (offerClosed ? <Pill label="Offer closed" tone="neutral" /> : <Pill label={QUOTE_STATUS_LABEL[q]} tone={QUOTE_STATUS_TONE[q]} />) : null}
        </Row>
        {priced ? (
          <LineItems items={items} total={b.amount} />
        ) : (
          <T v="body" color={colors.muted}>No price yet. {name} sends an itemised quote; nothing is charged before you accept it.</T>
        )}
        {isQuote && b.quote?.validUntil && (q === 'sent' || q === 'revised') && !offerClosed ? <T v="small">Valid until {shortDate(b.quote.validUntil)}.</T> : null}
        {isQuote && b.quote && b.quote.version > 0 ? <Button title="Open quote" variant="light" size="md" icon="file-document-outline" onPress={() => router.push(`/quote/${b.id}`)} /> : null}
        {!isQuote && priced ? <T v="small">{CHARGES_NOTE[b.type]}</T> : null}
      </Card>

      <Card style={{ gap: 8 }}>
        <Row justify="space-between">
          <T v="title">Payment</T>
          <Pill label={money.label} tone={money.tone} icon="credit-card-outline" />
        </Row>
        <T v="body" color={colors.inkSoft}>{moneyLine}</T>
        {payment === 'release_pending' ? <T v="small">Release pending means the release has started but isn’t confirmed yet. It shows as released once the payment provider confirms it.</T> : null}
        {payment === 'refund_pending' ? <T v="small">A refund request is not a completed refund. It shows as refunded once the payment provider confirms it.</T> : null}
        {method && b.status === 'payment_failed' ? <KeyValue k="Retry with" v={method.label} /> : null}
        {b.paymentRef ? <KeyValue k="Reference" v={b.paymentRef} /> : null}
        {b.paymentAttempts ? <KeyValue k="Payment attempts" v={String(b.paymentAttempts)} /> : null}
        <KeyValue k="Booking reference" v={ref} />
      </Card>

      <Card style={{ gap: 4 }}>
        <T v="title" style={{ marginBottom: 4 }}>Details</T>
        <TextLine k={b.type === 'lesson' ? 'Lesson' : 'Event'} v={b.eventTitle} />
        <KeyValue k="When" v={`${shortDate(b.date)}, ${b.startTime}–${b.endTime}`} />
        <TextLine k="Where" v={b.location} />
        {b.type !== 'lesson' ? <KeyValue k="Guests" v={String(b.guests)} /> : null}
        <TextLine k={b.type === 'venue' ? 'Setup' : b.type === 'lesson' ? 'Format' : 'Equipment'} v={b.equipment} />
        <TextLine k="Options" v={b.extras || 'None'} />
        {b.note ? <TextLine k="Message" v={b.note} /> : null}
        {linkedEvent ? (
          <Button title={`Event: ${linkedEvent.title}`} variant="ghost" size="md" icon="calendar-star" onPress={() => router.push(`/event/${linkedEvent.id}`)} style={{ alignSelf: 'flex-start' }} />
        ) : null}
      </Card>

      {b.timeline?.length ? (
        <Card style={{ gap: 10 }}>
          <T v="title">History</T>
          {b.timeline.map((e, i) => (
            <Row key={`${e.at}-${i}`} gap={10} align="flex-start">
              <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 7, backgroundColor: i === b.timeline!.length - 1 ? colors.brand : colors.borderStrong }} />
              <View style={{ flex: 1 }}>
                <T v="body">{e.label}</T>
                <T v="small">{dateTime(e.at)}</T>
              </View>
            </Row>
          ))}
        </Card>
      ) : null}

      {demo.length ? (
        <DemoBar note="Simulate what the provider, the bank or time does next. Each button changes this booking for real.">
          <View style={{ gap: 8 }}>
            {demo.map((a) => <Button key={a.label} title={a.label} variant="light" size="md" onPress={a.onPress} />)}
          </View>
        </DemoBar>
      ) : null}

      <ReasonSheet
        visible={sheet === 'cancel'}
        title={cancelTitle}
        body={cancellationOutcome(b)}
        reasons={CANCEL_REASONS}
        confirmLabel={b.status === 'pending' || b.status === 'requested' ? 'Cancel request' : 'Cancel booking'}
        destructive
        notePlaceholder="Anything to add? (optional)"
        onSubmit={(reason, note) => {
          const wasPaid = payment === 'paid';
          const held = payment === 'authorized' || payment === 'capture_pending';
          cancelBooking(b.id, note ? `${reason}: ${note}` : reason);
          toast(wasPaid ? 'Cancelled. Refund requested; it’s complete once the payment provider confirms it.' : held ? 'Cancelled. The payment authorization is being released.' : 'Cancelled. Nothing was charged.');
        }}
        onClose={() => setSheet(undefined)}
      />
      <ReasonSheet
        visible={sheet === 'change'}
        title="Request a change"
        body={`Your current terms stay until ${name} agrees to the change. Nothing is charged or refunded now.`}
        reasons={CHANGE_REASONS}
        confirmLabel="Send change request"
        notePlaceholder="Describe the change"
        noteRequired
        onSubmit={(reason, note) => {
          requestChange(b.id, `${reason}: ${note}`);
          sendMessage(ensureConversation(b.targetId), { type: 'text', text: `Change request for ${b.eventTitle} (${shortDate(b.date)}): ${reason}. ${note}` });
          toast(`Change request sent to ${name}`);
        }}
        onClose={() => setSheet(undefined)}
      />
      <ReasonSheet
        visible={sheet === 'report'}
        title="Report a problem"
        body="Support reviews the case with evidence from both sides. The payment state stays visible while they look into it, and support can’t promise a refund before a decision."
        reasons={REPORT_REASONS}
        confirmLabel="Report problem"
        destructive
        notePlaceholder="What happened?"
        onSubmit={(reason, note) => {
          setStatus(b.id, 'disputed');
          openCase(`Problem with booking ${ref}`, note ? `${reason}: ${note}` : reason, { kind: 'booking', id: b.id });
          toast('Problem reported. A support case is open.');
          refundCase();
        }}
        onClose={() => setSheet(undefined)}
      />
    </Screen>
  );
}
