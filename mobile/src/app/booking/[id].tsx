import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActionSheet } from '../../components/ActionSheet';
import { BottomBar, goBack, Screen, ScreenHeader } from '../../components/layout';
import { Banner, Button, Card, Divider, Icon, KeyValue, Photo, Pill, Row, T } from '../../components/ui';
import { profileById, venueById } from '../../data/mock';
import type { BookingStatus } from '../../data/types';
import { isException, LIFECYCLE, STATUS_LABEL, STATUS_TONE } from '../../lib/booking';
import { euro, parse, shortDate, TODAY } from '../../lib/format';
import { toast } from '../../store/toast';
import { useApp } from '../../store/useApp';
import { colors, radius, shadow } from '../../theme';

const PAID: BookingStatus[] = ['paid', 'confirmed', 'completed'];

export default function BookingStatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const booking = useApp((s) => s.bookings.find((b) => b.id === id));
  const reviewed = useApp((s) => (id ? !!s.reviews[id] : false));
  const methods = useApp((s) => s.paymentMethods);
  const selectedPayment = useApp((s) => s.selectedPayment);
  const setStatus = useApp((s) => s.setBookingStatus);
  const startCheckout = useApp((s) => s.startBookingCheckout);
  const ensureConversation = useApp((s) => s.ensureConversation);
  const [confirm, setConfirm] = useState<'cancel' | 'decline' | 'report'>();
  const [showReceipt, setShowReceipt] = useState(false);

  if (!booking) {
    return (
      <Screen header={<ScreenHeader title="Booking" onBack={() => goBack('/my-bookings?tab=musician')} />}>
        <T v="body">Booking not found.</T>
        <Button title="Your bookings" onPress={() => router.replace('/my-bookings?tab=musician')} />
      </Screen>
    );
  }
  if (isException(booking.status)) {
    // Exceptions get their own screen with next steps.
    return <Redirect href={{ pathname: '/booking/issue', params: { id: booking.id } }} />;
  }
  const artist = booking.type === 'musician' ? profileById(booking.targetId) : undefined;
  const venue = booking.type === 'venue' ? venueById(booking.targetId) : undefined;
  const name = artist?.name ?? venue?.name ?? '';
  const idx = LIFECYCLE.findIndex((l) => l.status === booking.status);
  const chat = () => router.push(`/chat/${ensureConversation(booking.targetId)}`);
  const ref = `#${booking.id.slice(-4).toUpperCase()}`;
  const method = methods.find((m) => m.id === selectedPayment) ?? methods[0];
  const paid = PAID.includes(booking.status);
  // Problems can be reported up to 48 h after the event (see Help → disputes).
  const reportable = TODAY.getTime() <= parse(booking.date).getTime() + 2 * 86_400_000;
  const bookAgain = () => router.push({ pathname: '/booking/new', params: { type: booking.type, id: booking.targetId } });
  const addToCalendar = () => {
    toast(`${booking.eventTitle} is in your calendar`);
    router.push({ pathname: '/(tabs)/calendar', params: { date: booking.date } });
  };

  const actions: Partial<Record<BookingStatus, { hint: string; primary: [string, () => void]; secondary: [string, () => void] }>> = {
    requested: { hint: `Your request is on its way to ${name}.`, primary: ['Message', chat], secondary: ['Cancel request', () => setConfirm('cancel')] },
    pending: { hint: `Waiting for ${name} to accept. You won’t be charged until they do.`, primary: [`Message ${name}`, chat], secondary: ['Cancel request', () => setConfirm('cancel')] },
    accepted: {
      hint: `${name} accepted! Pay now to lock the date. Your money stays in escrow until 24 h after the event.`,
      primary: [`Pay ${euro(booking.amount)}`, () => { startCheckout(booking.id); router.push('/checkout'); }],
      secondary: ['Decline offer', () => setConfirm('decline')],
    },
    paid: { hint: 'Payment received and held safely. The provider is confirming final details.', primary: ['Open chat', chat], secondary: [showReceipt ? 'Hide receipt' : 'View receipt', () => setShowReceipt(!showReceipt)] },
    confirmed: { hint: 'You’re all set. Share equipment and arrival details in chat.', primary: ['Open chat', chat], secondary: ['Add to calendar', addToCalendar] },
    completed: {
      hint: reviewed ? `Thanks for reviewing ${name}. You can still update your review.` : `Hope it was great! A review helps other people book ${name}.`,
      primary: [reviewed ? 'Edit review' : 'Leave review', () => router.push(`/review/${booking.id}`)],
      secondary: reportable ? ['Report a problem', () => setConfirm('report')] : [`Book ${name} again`, bookAgain],
    },
  };
  const a = actions[booking.status];

  // Demo control: simulate what the provider / time does next.
  const nextDemo: Partial<Record<BookingStatus, BookingStatus>> = { requested: 'pending', pending: 'accepted', paid: 'confirmed', confirmed: 'completed' };
  const advance = () => {
    const next = nextDemo[booking.status];
    if (!next) return;
    setStatus(booking.id, next);
    toast(`Booking is now: ${STATUS_LABEL[next]}`);
  };

  const sheet = {
    cancel: { title: 'Cancel this request?', label: 'Cancel request', icon: 'close-circle-outline' as const, status: 'cancelled' as const, done: 'Request cancelled. You weren’t charged.' },
    decline: { title: `Decline ${name}’s offer?`, label: 'Decline offer', icon: 'close-circle-outline' as const, status: 'cancelled' as const, done: 'Offer declined. You weren’t charged.' },
    report: { title: 'Report a problem with this booking?', label: 'Report a problem', icon: 'flag-outline' as const, status: 'disputed' as const, done: 'Problem reported. Funds are frozen while we review.' },
  };
  const s = confirm ? sheet[confirm] : undefined;

  return (
    <Screen
      header={<ScreenHeader title={`Booking ${ref}`} onBack={() => goBack(`/my-bookings?tab=${booking.type}`)} />}
      footer={
        nextDemo[booking.status] ? (
          <BottomBar>
            <T v="small" style={{ marginBottom: 8 }}>Demo: simulate the provider’s response</T>
            <Row gap={10}>
              {booking.status === 'pending' ? (
                <Button title="Provider declines" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => { setStatus(booking.id, 'declined'); toast(`${name} declined the request`); }} />
              ) : null}
              <Button title={booking.status === 'pending' ? 'Provider accepts' : 'Advance stage'} variant="light" size="md" style={{ flex: 1 }} onPress={advance} />
            </Row>
          </BottomBar>
        ) : null
      }
    >
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${name}’s page`} onPress={() => router.push(artist ? `/artist/${artist.id}` : `/venue/${venue?.id}`)} style={{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 14, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadow(1) }}>
        <Photo src={artist?.avatar ?? venue?.cover ?? 'ven_moon'} style={{ width: 64, height: 64 }} radius={16} />
        <View style={{ flex: 1, gap: 3 }}>
          <T v="title">{name}{artist ? ` · ${artist.title}` : ''}</T>
          <T v="small">{booking.eventTitle} · {shortDate(booking.date)}, {booking.startTime}–{booking.endTime}</T>
          <T v="small">{booking.location} · {euro(booking.amount)}</T>
        </View>
        <Icon name="chevron-right" size={22} color={colors.subtle} />
      </Pressable>

      <Row justify="space-between">
        <Pill label={STATUS_LABEL[booking.status]} tone={STATUS_TONE[booking.status]} />
        <T v="small">Requested {shortDate(booking.createdAt)}</T>
      </Row>

      <View accessibilityLabel={`Progress: ${LIFECYCLE[idx]?.name ?? STATUS_LABEL[booking.status]}, step ${idx + 1} of ${LIFECYCLE.length}`}>
        {LIFECYCLE.map((l, i) => {
          const done = i < idx;
          const cur = i === idx;
          return (
            <Row key={l.status} gap={14} align="flex-start">
              <View style={{ alignItems: 'center', width: 24 }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: done ? colors.brand : colors.surface, borderWidth: done ? 0 : cur ? 4 : 2, borderColor: cur ? colors.brand : colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
                  {done ? <Icon name="check" size={14} color={colors.white} /> : null}
                </View>
                {i < LIFECYCLE.length - 1 ? <View style={{ width: 2, height: 34, backgroundColor: done ? colors.brand : colors.track }} /> : null}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T v={cur ? 'bodyBold' : 'body'} color={i > idx ? colors.subtle : colors.ink}>{l.name}</T>
                <T v="small" style={{ fontSize: 12 }}>{l.note}</T>
              </View>
            </Row>
          );
        })}
      </View>

      {a ? (
        <Card style={{ gap: 12, backgroundColor: colors.brandSoft }}>
          <T v="body" color="#2E1D5E">{a.hint}</T>
          <View style={{ gap: 10 }}>
            <Button title={a.primary[0]} size="md" onPress={a.primary[1]} />
            <Button title={a.secondary[0]} variant="secondary" size="md" onPress={a.secondary[1]} />
          </View>
        </Card>
      ) : null}

      {paid && (showReceipt || booking.status !== 'paid') ? (
        <Card style={{ gap: 6 }}>
          <Row justify="space-between">
            <T v="title">Receipt {ref}</T>
            <Icon name="receipt" size={22} color={colors.brand} />
          </Row>
          <KeyValue k={booking.type === 'musician' ? `${booking.hours} hours · ${name}` : `1 night · ${name}`} v={euro(booking.amount, true)} />
          <KeyValue k="Escrow protection" v="Included" />
          <KeyValue k="incl. VAT (19%)" v={euro(booking.amount - booking.amount / 1.19, true)} />
          <Divider style={{ marginVertical: 6 }} />
          <KeyValue k="Total paid" v={euro(booking.amount, true)} strong />
          {method ? <T v="small">Charged to {method.label}. A copy was emailed to you.</T> : null}
        </Card>
      ) : null}

      <Banner icon="shield-check-outline">
        {booking.status === 'completed'
          ? reportable
            ? `Something went wrong? Report it within 48 h of the event and the payment to ${name} stays frozen while we review.`
            : `The escrow payment was released to ${name} after the event.`
          : paid
            ? `Your payment is held in escrow and only released to ${name} 24 h after the event.`
            : `You pay only after ${name} accepts. The money then waits in escrow until 24 h after the event.`}
      </Banner>

      <ActionSheet
        visible={!!s}
        title={s?.title}
        actions={s ? [{ label: s.label, icon: s.icon, destructive: true, onPress: () => { setStatus(booking.id, s.status); toast(s.done); } }] : []}
        onClose={() => setConfirm(undefined)}
      />
    </Screen>
  );
}
