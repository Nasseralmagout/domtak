import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '../components/layout';
import { Button, Icon, Photo, T } from '../components/ui';
import { PAYMENT_NOTE, providerOf, REMINDER_HOURS, RESPONSE_HOURS } from '../lib/booking';
import { useApp, useEvent } from '../store/useApp';
import { colors } from '../theme';

export default function Success() {
  const { kind, id, count } = useLocalSearchParams<{ kind: 'ticket' | 'booking' | 'request' | 'quote'; id: string; count?: string }>();
  const ticket = useApp((s) => s.tickets.find((t) => t.id === id));
  const booking = useApp((s) => s.bookings.find((b) => b.id === id));
  const event = useEvent(ticket?.eventId);

  const provider = booking ? providerOf(booking) : undefined;
  const image = kind === 'ticket' ? event?.cover : provider?.image;
  const target = provider?.name ?? 'The provider';

  const many = !!count && Number(count) > 1;
  // Free events hand out registrations, not paid tickets.
  const free = kind === 'ticket' && !!ticket && event?.ticketTypes.find((t) => t.id === ticket.typeId)?.price === 0;
  const title =
    kind === 'ticket'
      ? free
        ? 'You’re registered!'
        : many
          ? 'Your tickets are booked!'
          : 'Your ticket is booked!'
      : kind === 'request'
        ? 'Request sent!'
        : kind === 'quote'
          ? 'Quote requested!'
          : 'Booking confirmed!';
  const body =
    kind === 'ticket'
      ? `${many ? `${count} tickets` : 'Your ticket'} for ${event?.title ?? 'the event'} ${many ? 'are' : 'is'} ready. ${many ? 'Each one has its own QR code to show' : 'Show the QR code'} at the entrance.`
      : kind === 'request'
        ? `${target} has ${RESPONSE_HOURS} hours to accept or decline, with a reminder after ${REMINDER_HOURS} hours. ${PAYMENT_NOTE.authorized}`
        : kind === 'quote'
          ? `${target} will send you an itemised quote. Nothing is charged until you accept it, and you can ask questions in chat first.`
          : `Payment verified. Your booking with ${target} is confirmed and the agreed terms are saved. Chat with them to share the details.`;

  return (
    <Screen edges={['top', 'bottom']} contentStyle={{ paddingHorizontal: 24, paddingTop: 40, gap: 18, alignItems: 'center' }}>
      <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={kind === 'request' || kind === 'quote' ? 'send-check' : 'check'} size={52} color={colors.white} />
      </View>
      <T v="h1" center color={colors.brandMid}>{title}</T>
      <T v="body" color={colors.muted} center>{body}</T>
      {image ? <Photo src={image} style={{ width: '100%', height: 220 }} radius={20} /> : null}
      <View style={{ alignSelf: 'stretch', gap: 12, marginTop: 8 }}>
        {kind === 'ticket' && ticket ? <Button title={many ? 'Your tickets' : 'Your ticket'} onPress={() => router.replace(`/ticket/${ticket.id}`)} style={{ backgroundColor: '#7A3BC0' }} /> : null}
        {kind !== 'ticket' && booking ? <Button title={kind === 'quote' ? 'View quote request' : 'View booking'} onPress={() => router.replace(`/booking/${booking.id}`)} style={{ backgroundColor: '#7A3BC0' }} /> : null}
        <Button title="To Home page" onPress={() => router.replace('/(tabs)')} />
      </View>
    </Screen>
  );
}
