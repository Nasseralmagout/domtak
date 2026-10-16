import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackOverlay } from '../../components/cards';
import { BottomBar, goBack, Screen, ScreenHeader } from '../../components/layout';
import { Banner, Button, EmptyState, Photo, Radio, Row, Stepper, T } from '../../components/ui';
import { venueById } from '../../data/mock';
import { eventState } from '../../lib/events';
import { euro, eventWhen, parse, TODAY } from '../../lib/format';
import { toast } from '../../store/toast';
import { useApp, useEvent } from '../../store/useApp';

import { colors, fonts } from '../../theme';

/** Matches the per-ticket service fee charged at checkout. */
const SERVICE_FEE = 1.5;

export default function ChooseTicket() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const event = useEvent(eventId);
  const start = useApp((s) => s.startTicketCheckout);
  const wished = useApp((s) => (eventId ? s.wishlist.events.includes(eventId) : false));
  const toggleWish = useApp((s) => s.toggleWish);
  const bookings = useApp((s) => s.bookings);
  const invites = useApp((s) => s.guestInvites);
  const myTickets = useApp((s) => s.tickets);
  const firstAvailable = event?.ticketTypes.find((t) => t.sold < t.capacity)?.id;
  const [typeId, setTypeId] = useState(firstAvailable);
  const [qty, setQty] = useState(1);

  if (!event) {
    return (
      <Screen header={<ScreenHeader title="Tickets" onBack={() => goBack('/(tabs)/events')} />}>
        <EmptyState icon="ticket-outline" title="Event not found" body="This event may have been cancelled or removed." action="Browse events" onAction={() => router.replace('/events/all')} />
      </Screen>
    );
  }
  // Private events have no public ticket sales: entry is by invitation (F20).
  if (event.isPrivate && event.organizerId !== 'me' && event.hostId !== 'me') {
    const invite = invites.find((g) => g.eventId === event.id);
    const own = myTickets.find((t) => t.eventId === event.id && t.status === 'valid');
    return (
      <Screen header={<ScreenHeader title="Tickets" onBack={() => goBack(`/event/${event.id}`)} />}>
        <EmptyState
          icon="lock-outline"
          title="Entry by invitation"
          body={own ? 'You already have a ticket for this private event.' : invite ? 'This is a private event. Answer your invitation to get your ticket.' : 'This is a private event. Only invited guests get tickets.'}
          action={own ? 'Open ticket' : invite ? 'Open invitation' : 'Back to event'}
          onAction={() => (own ? router.replace(`/ticket/${own.id}`) : invite ? router.replace(`/invitation/${invite.id}`) : goBack(`/event/${event.id}`))}
        />
      </Screen>
    );
  }
  const state = eventState(event, bookings);
  if (state === 'cancelled' || state === 'draft') {
    return (
      <Screen header={<ScreenHeader title="Tickets" onBack={() => goBack(`/event/${event.id}`)} />}>
        <EmptyState
          icon={state === 'cancelled' ? 'calendar-remove-outline' : 'file-document-edit-outline'}
          title={state === 'cancelled' ? 'Event cancelled' : 'Not on sale yet'}
          body={state === 'cancelled' ? `${event.title} was cancelled${event.cancelReason ? `: ${event.cancelReason}` : ''}. Tickets are no longer sold.` : 'This event is still a draft. Tickets go on sale once the organizer publishes it.'}
          action="Back to event"
          onAction={() => goBack(`/event/${event.id}`)}
        />
      </Screen>
    );
  }
  const type = event.ticketTypes.find((t) => t.id === typeId);
  const left = type ? type.capacity - type.sold : 0;
  const maxQty = Math.max(1, Math.min(6, left));
  const count = Math.min(qty, maxQty);
  const subtotal = (type?.price ?? 0) * count;
  const fees = type && type.price > 0 ? SERVICE_FEE * count : 0;
  const total = subtotal + fees;
  const venue = venueById(event.venueId);
  const soldOut = !firstAvailable;
  // Sales close when doors open.
  const closed = parse(event.start) <= TODAY;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ height: 210 }}>
        <Photo src={event.cover} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <LinearGradient colors={['rgba(0,0,0,0.3)', 'rgba(20,10,40,0.9)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <SafeAreaView edges={['top']} style={{ paddingHorizontal: 12, paddingTop: 4 }}>
          <BackOverlay onPress={() => goBack(`/event/${event.id}`)} />
        </SafeAreaView>
        <View style={{ position: 'absolute', left: 20, right: 20, bottom: 18 }}>
          <Text style={{ color: colors.white, fontFamily: fonts.display, fontSize: 26 }}>{event.title}</Text>
          <Text style={{ color: colors.lilacLight, fontFamily: fonts.body, fontSize: 14 }}>{eventWhen(event.start, event.end)} · {venue?.name}</Text>
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
        <T v="h3">Choose your ticket</T>
        {closed ? (
          <Banner icon="calendar-remove-outline" tone="warning">Ticket sales for this event have closed.</Banner>
        ) : soldOut ? (
          <Banner icon="ticket-outline" tone="danger">This event is sold out. Save it to your wishlist to keep it handy in case tickets come back.</Banner>
        ) : null}
        <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
          {event.ticketTypes.map((t) => {
            const soldOut = t.sold >= t.capacity;
            const on = t.id === typeId;
            const left = t.capacity - t.sold;
            return (
              <Pressable
                key={t.id}
                accessibilityRole="radio"
                accessibilityLabel={`${t.name}, ${t.price === 0 ? 'free' : euro(t.price)}${soldOut ? ', sold out' : ''}`}
                accessibilityState={{ checked: on, disabled: soldOut }}
                disabled={soldOut}
                onPress={() => { setTypeId(t.id); setQty((n) => Math.max(1, Math.min(n, 6, left))); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, borderWidth: on ? 2 : 1, borderColor: on ? colors.brand : colors.border, backgroundColor: soldOut ? colors.chipIdle : on ? colors.brandTint : colors.surface }}
              >
                <Radio selected={on} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="bodyBold" color={soldOut ? colors.subtle : colors.ink}>{t.name}</T>
                  <T v="small" color={soldOut ? colors.danger : colors.muted}>{soldOut ? 'Sold out' : t.description}{!soldOut && left < 40 ? ` · only ${left} left` : ''}</T>
                </View>
                <T v="h3" color={soldOut ? colors.subtle : colors.ink}>{t.price === 0 ? 'Free' : euro(t.price)}</T>
              </Pressable>
            );
          })}
        </View>
        <Row justify="space-between" style={{ backgroundColor: colors.surface, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.border }}>
          <View>
            <T v="bodyBold">Quantity</T>
            <T v="small">{maxQty < 6 && type ? `Only ${left} left` : 'Max 6 per order'}</T>
          </View>
          <Stepper value={count} onChange={setQty} max={maxQty} label="tickets" />
        </Row>
        <Banner icon="information-outline">{`${event.ageLimit ? `${event.ageLimit}+ event. ` : ''}${event.refundPolicy}. Each ticket gets its own QR code.`}</Banner>
      </ScrollView>
      <BottomBar>
        {closed ? (
          <Button title="Back to event" variant="secondary" onPress={() => goBack(`/event/${event.id}`)} />
        ) : soldOut ? (
          <Button
            title={wished ? 'Saved to wishlist' : 'Save to wishlist'}
            icon={wished ? 'heart' : 'heart-outline'}
            variant={wished ? 'secondary' : 'primary'}
            onPress={() => { toggleWish('events', event.id); toast(wished ? 'Removed from wishlist' : 'Saved to your wishlist'); }}
          />
        ) : (
          <Row gap={14}>
            <View>
              <T v="small">{fees ? `Incl. ${euro(fees, true)} fees` : 'Total incl. tax'}</T>
              <T v="h2">{total === 0 ? 'Free' : euro(total, true)}</T>
            </View>
            <Button
              title={total === 0 ? 'Register' : 'Continue'}
              disabled={!type}
              style={{ flex: 1 }}
              onPress={() => {
                if (!type) return;
                start(event.id, type.id, count);
                router.push('/checkout');
              }}
            />
          </Row>
        )}
      </BottomBar>
    </View>
  );
}
