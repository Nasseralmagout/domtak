import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { goBack, Screen, ScreenHeader } from '../components/layout';
import { Button, EmptyState, Icon, PaymentPill, Photo, Pill, Row, Segmented, StatusPill, T, TimeLeft } from '../components/ui';
import { venueById } from '../data/mock';
import type { Booking } from '../data/types';
import { bookingLabel, isClosed, isOutstanding, providerOf, QUOTE_STATUS_LABEL, quoteState } from '../lib/booking';
import { euro, parse, plural, shortDate, time, TODAY } from '../lib/format';
import { useAllEvents, useApp } from '../store/useApp';
import { colors, radius, shadow } from '../theme';

type Tab = 'tickets' | 'musician' | 'venue' | 'lesson';
const asTab = (t?: string): Tab => (t === 'musician' || t === 'venue' || t === 'lesson' ? t : 'tickets');
const rank = (status: string, end: string) => (status === 'cancelled' || status === 'refunded' ? 2 : status === 'used' || parse(end) < TODAY ? 1 : 0);

/** What the customer has to do next on a booking, if anything (blueprint member dashboard). */
function actionFor(b: Booking): string | undefined {
  if (b.status === 'payment_failed' || b.payment === 'failed') return 'Payment failed · retry on this booking';
  if (b.pendingCancellation && !isClosed(b.status) && b.status !== 'completed') return 'Event cancelled · decide on this booking';
  if (b.pricing === 'quote' && b.quote && b.status === 'requested') {
    const q = quoteState(b.quote);
    if (q === 'sent' || q === 'revised') return q === 'revised' ? 'Revised quote · needs your acceptance' : 'Quote received · review it';
    if (q === 'expired') return 'Quote expired · ask for a new one';
  }
  if (b.status === 'accepted' && b.payment !== 'paid') return 'Complete the payment step to confirm';
  if (b.status === 'change_requested') return 'Change requested · waiting for both sides';
  return undefined;
}

/** Needs action first, then open requests, then confirmed work, then closed or done. */
const bookingRank = (b: Booking) => (actionFor(b) ? 0 : isOutstanding(b.status) ? 1 : b.status === 'confirmed' || b.status === 'paid' ? 2 : 3);

export default function MyBookings() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(asTab(params.tab));
  const tickets = useApp((s) => s.tickets);
  const bookings = useApp((s) => s.bookings);
  const reviews = useApp((s) => s.reviews);
  const allEvents = useAllEvents();

  // Opening "Your tickets" from the menu while this screen is already mounted should still switch tabs.
  const [lastParam, setLastParam] = useState(params.tab);
  if (params.tab !== lastParam) {
    setLastParam(params.tab);
    if (params.tab) setTab(asTab(params.tab));
  }

  // Group multiple tickets for the same event into one card; upcoming first.
  const ticketGroups = Object.values(
    tickets.reduce<Record<string, typeof tickets>>((acc, t) => {
      const k = `${t.eventId}-${t.status}`;
      (acc[k] ??= []).push(t);
      return acc;
    }, {}),
  )
    .map((group) => ({ group, event: allEvents.find((x) => x.id === group[0].eventId) }))
    .filter((g): g is { group: typeof tickets; event: NonNullable<typeof g.event> } => !!g.event)
    // Upcoming first (soonest on top), then past nights, then cancelled orders.
    .sort((a, b) => rank(a.group[0].status, a.event.end) - rank(b.group[0].status, b.event.end) || a.event.start.localeCompare(b.event.start));

  const bookingList = bookings.filter((b) => b.type === tab).sort((a, b) => bookingRank(a) - bookingRank(b) || b.createdAt.localeCompare(a.createdAt));
  const needAction = bookingList.filter((b) => actionFor(b)).length;
  const hasLessons = bookings.some((b) => b.type === 'lesson');

  return (
    <Screen header={<ScreenHeader title="Your bookings" onBack={() => goBack('/(tabs)')} />}>
      <Segmented
        dark
        options={[
          { key: 'tickets', label: `Tickets (${ticketGroups.length})` },
          { key: 'musician', label: 'Musicians' },
          { key: 'venue', label: 'Venues' },
          ...(hasLessons || tab === 'lesson' ? [{ key: 'lesson' as const, label: 'Lessons' }] : []),
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'tickets' ? (
        ticketGroups.length ? (
          ticketGroups.map(({ group, event: e }) => {
            const t = group[0];
            const past = parse(e.end) < TODAY;
            const cancelled = t.status === 'cancelled' || t.status === 'refunded';
            return (
              <Pressable
                key={`${t.eventId}-${t.status}`}
                accessibilityRole="button"
                accessibilityLabel={`${e.title}, ${shortDate(e.start)}${cancelled ? ', cancelled' : ''}`}
                onPress={() => (cancelled || past ? router.push(`/event/${e.id}`) : router.push(`/ticket/${t.id}`))}
                style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', opacity: cancelled ? 0.85 : 1, ...shadow(1) }}
              >
                <Photo src={e.cover} style={{ width: 120 }} />
                <View style={{ flex: 1, padding: 12, gap: 6 }}>
                  <T v="h3" color={colors.brandDeep} numberOfLines={1}>{e.title}</T>
                  <T v="smallBold" color={colors.inkSoft}>{shortDate(e.start)} · {time(e.start)}–{time(e.end)}</T>
                  <Row gap={4}><Icon name="map-marker-outline" size={16} color={colors.inkSoft} /><T v="small" color={colors.inkSoft} numberOfLines={1} style={{ flex: 1 }}>{venueById(e.venueId)?.name}, Berlin</T></Row>
                  {group.length > 1 ? <T v="small">{group.length} tickets</T> : null}
                  <Row justify="flex-end" gap={8} style={{ flexWrap: 'wrap', rowGap: 6 }}>
                    {cancelled ? (
                      <>
                        <Pill label={t.status === 'refunded' ? 'Refunded' : 'Cancelled'} tone={t.status === 'refunded' ? 'neutral' : 'danger'} />
                        <Button title="Refund details" size="sm" variant="ghost" onPress={() => router.push('/help?section=refunds')} />
                      </>
                    ) : past || t.status === 'used' ? (
                      reviews[e.id] ? (
                        <Button title="Edit review" size="sm" variant="ghost" icon="star" onPress={() => router.push(`/review/${e.id}`)} />
                      ) : (
                        <Button title="Leave review" size="sm" variant="light" onPress={() => router.push(`/review/${e.id}`)} />
                      )
                    ) : (
                      <Button title={group.length > 1 ? 'View e-tickets' : 'View e-ticket'} size="sm" onPress={() => router.push(`/ticket/${t.id}`)} />
                    )}
                  </Row>
                </View>
              </Pressable>
            );
          })
        ) : (
          <EmptyState icon="ticket-confirmation-outline" title="No tickets yet" body="Tickets you buy show up here with their QR code." action="Find events" onAction={() => router.push('/events/all')} />
        )
      ) : null}

      {tab !== 'tickets' && bookingList.length ? (
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          <Pill label={plural(bookingList.length, tab === 'lesson' ? 'lesson booking' : 'booking')} tone="neutral" />
          {needAction ? <Pill label={`${needAction} need${needAction === 1 ? 's' : ''} your action`} tone="warning" icon="alert-circle-outline" /> : null}
        </Row>
      ) : null}

      {tab !== 'tickets' ? (
        bookingList.length ? (
          bookingList.map((b) => {
            const provider = providerOf(b);
            const action = actionFor(b);
            const q = b.pricing === 'quote' && b.quote ? quoteState(b.quote) : undefined;
            const priced = b.pricing !== 'quote' || (!!b.quote && b.quote.version > 0);
            return (
              <Pressable key={b.id} accessibilityRole="button" accessibilityLabel={`${provider.name}, ${b.eventTitle}, ${bookingLabel(b)}${action ? `, ${action}` : ''}`} onPress={() => router.push(`/booking/${b.id}`)} style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', ...shadow(1) }}>
                <Photo src={provider.image ?? 'ven_moon'} style={{ width: 104 }} />
                <View style={{ flex: 1, padding: 12, gap: 6 }}>
                  <Row justify="space-between" gap={8}>
                    <T v="h3" color={colors.brandDeep} numberOfLines={1} style={{ flex: 1 }}>{provider.name}</T>
                    {priced ? <T v="bodyBold">{euro(b.amount)}</T> : null}
                  </Row>
                  <T v="small" numberOfLines={1}>{b.eventTitle}</T>
                  <T v="smallBold" color={colors.inkSoft}>{shortDate(b.date)} · {b.startTime}–{b.endTime}</T>
                  <Row gap={4}><Icon name="map-marker-outline" size={16} color={colors.inkSoft} /><T v="small" color={colors.inkSoft} numberOfLines={1} style={{ flex: 1 }}>{b.location}</T></Row>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    <StatusPill booking={b} />
                    {b.payment && b.payment !== 'not_started' ? <PaymentPill state={b.payment} /> : null}
                    {b.status === 'pending' ? <TimeLeft deadline={b.deadline} /> : null}
                    {q && b.quote && b.quote.version > 0 && b.status !== 'requested' ? <Pill label={`Quote v${b.quote.version} · ${QUOTE_STATUS_LABEL[q]}`} tone="neutral" icon="file-document-outline" /> : null}
                  </View>
                  {action ? (
                    <Row gap={6}>
                      <Icon name="alert-circle-outline" size={16} color={b.payment === 'failed' ? colors.danger : colors.warning} />
                      <T v="smallBold" color={b.payment === 'failed' ? colors.danger : colors.warning} style={{ flex: 1 }}>{action}</T>
                    </Row>
                  ) : null}
                </View>
              </Pressable>
            );
          })
        ) : (
          <EmptyState
            icon={tab === 'musician' ? 'account-music-outline' : tab === 'lesson' ? 'school-outline' : 'storefront-outline'}
            title={tab === 'lesson' ? 'No lessons booked' : 'No bookings yet'}
            body={tab === 'musician' ? 'Book a musician, band or DJ for your next event.' : tab === 'lesson' ? 'Lessons you book with artists show up here.' : 'Find a venue for your party, wedding or showcase.'}
            action={tab === 'venue' ? 'Browse venues' : 'Browse artists'}
            onAction={() => router.push(tab === 'venue' ? '/venues' : '/artists/all')}
          />
        )
      ) : null}
    </Screen>
  );
}
