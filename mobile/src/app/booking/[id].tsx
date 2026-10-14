import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';

import { BottomBar, Screen, ScreenHeader } from '../../components/layout';
import { Banner, Button, Card, Icon, Photo, Pill, Row, T } from '../../components/ui';
import { profileById, venueById } from '../../data/mock';
import type { BookingStatus } from '../../data/types';
import { isException, LIFECYCLE, STATUS_LABEL, STATUS_TONE } from '../../lib/booking';
import { euro, shortDate } from '../../lib/format';
import { useApp } from '../../store/useApp';
import { colors, radius, shadow } from '../../theme';

export default function BookingStatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const booking = useApp((s) => s.bookings.find((b) => b.id === id));
  const setStatus = useApp((s) => s.setBookingStatus);
  const startCheckout = useApp((s) => s.startBookingCheckout);
  const ensureConversation = useApp((s) => s.ensureConversation);

  if (!booking) {
    return (
      <Screen header={<ScreenHeader title="Booking" />}>
        <T v="body">Booking not found.</T>
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

  const actions: Partial<Record<BookingStatus, { hint: string; primary: [string, () => void]; secondary: [string, () => void] }>> = {
    requested: { hint: `Your request is on its way to ${name}.`, primary: ['Message', chat], secondary: ['Cancel request', () => setStatus(booking.id, 'cancelled')] },
    pending: { hint: `Waiting for ${name} to accept. You won't be charged until they do.`, primary: [`Message ${name}`, chat], secondary: ['Cancel request', () => setStatus(booking.id, 'cancelled')] },
    accepted: {
      hint: `${name} accepted! Pay now to lock the date — funds stay in escrow until the event.`,
      primary: [`Pay ${euro(booking.amount)}`, () => { startCheckout(booking.id); router.push('/checkout'); }],
      secondary: ['Decline offer', () => setStatus(booking.id, 'cancelled')],
    },
    paid: { hint: 'Payment received and held safely. The provider is confirming final details.', primary: ['Open chat', chat], secondary: ['View receipt', () => router.push('/help?section=receipts')] },
    confirmed: { hint: 'You’re all set. Share equipment and arrival details in chat.', primary: ['Open chat', chat], secondary: ['Add to calendar', () => router.push('/(tabs)/calendar')] },
    completed: { hint: `Hope it was great! A review helps other people book ${name}.`, primary: ['Leave review', () => router.push(`/review/${booking.id}`)], secondary: ['Report a problem', () => setStatus(booking.id, 'disputed')] },
  };
  const a = actions[booking.status];

  // Demo control: simulate what the provider / time does next.
  const nextDemo: Partial<Record<BookingStatus, BookingStatus>> = { requested: 'pending', pending: 'accepted', paid: 'confirmed', confirmed: 'completed' };

  return (
    <Screen
      header={<ScreenHeader title={`Booking #${booking.id.slice(-4).toUpperCase()}`} />}
      footer={
        nextDemo[booking.status] || booking.status === 'pending' ? (
          <BottomBar>
            <T v="small" style={{ marginBottom: 8 }}>Demo: simulate the provider’s response</T>
            <Row gap={10}>
              {booking.status === 'pending' ? <Button title="Provider declines" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => setStatus(booking.id, 'declined')} /> : null}
              <Button title={booking.status === 'pending' ? 'Provider accepts' : 'Advance stage'} variant="light" size="md" style={{ flex: 1 }} onPress={() => setStatus(booking.id, nextDemo[booking.status]!)} />
            </Row>
          </BottomBar>
        ) : null
      }
    >
      <Pressable accessibilityRole="button" onPress={() => router.push(artist ? `/artist/${artist.id}` : `/venue/${venue?.id}`)} style={{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 14, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadow(1) }}>
        <Photo src={artist?.avatar ?? venue!.cover} style={{ width: 64, height: 64 }} radius={16} />
        <View style={{ flex: 1, gap: 3 }}>
          <T v="title">{name}{artist ? ` · ${artist.title}` : ''}</T>
          <T v="small">{booking.eventTitle} · {shortDate(booking.date)}, {booking.startTime}–{booking.endTime}</T>
          <T v="small">{booking.location} · {euro(booking.amount)}</T>
        </View>
      </Pressable>

      <Row justify="space-between">
        <Pill label={STATUS_LABEL[booking.status]} tone={STATUS_TONE[booking.status]} />
        <T v="small">Requested {shortDate(booking.createdAt)}</T>
      </Row>

      <View>
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
          <Row gap={10}>
            <Button title={a.secondary[0]} variant="secondary" size="md" style={{ flex: 1 }} onPress={a.secondary[1]} />
            <Button title={a.primary[0]} size="md" style={{ flex: 1 }} onPress={a.primary[1]} />
          </Row>
        </Card>
      ) : null}
      <Banner icon="shield-check-outline">Escrow keeps your money safe: it’s only released to {name} 24 h after the event.</Banner>
    </Screen>
  );
}
