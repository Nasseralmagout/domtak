import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { goBack, Screen, ScreenHeader } from '../components/layout';
import { Button, EmptyState, Icon, Photo, Pill, Row, Segmented, T } from '../components/ui';
import { profileById, venueById } from '../data/mock';
import { STATUS_LABEL, STATUS_TONE } from '../lib/booking';
import { parse, shortDate, time, TODAY } from '../lib/format';
import { useAllEvents, useApp } from '../store/useApp';
import { colors, radius, shadow } from '../theme';

type Tab = 'tickets' | 'musician' | 'venue';
const asTab = (t?: string): Tab => (t === 'musician' || t === 'venue' ? t : 'tickets');

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
    .sort((a, b) => Number(a.group[0].status === 'cancelled') - Number(b.group[0].status === 'cancelled') || a.event.start.localeCompare(b.event.start));

  const bookingList = bookings.filter((b) => b.type === tab).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <Screen header={<ScreenHeader title="Your bookings" onBack={() => goBack('/(tabs)')} />}>
      <Segmented
        dark
        options={[
          { key: 'tickets', label: `Tickets (${ticketGroups.length})` },
          { key: 'musician', label: 'Musicians' },
          { key: 'venue', label: 'Venues' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'tickets' ? (
        ticketGroups.length ? (
          ticketGroups.map(({ group, event: e }) => {
            const t = group[0];
            const past = parse(e.end) < TODAY;
            const cancelled = t.status === 'cancelled';
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
                  <Row justify="flex-end" gap={8}>
                    {cancelled ? (
                      <>
                        <Pill label="Cancelled · refunded" tone="danger" />
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

      {tab !== 'tickets' ? (
        bookingList.length ? (
          bookingList.map((b) => {
            const target = b.type === 'musician' ? profileById(b.targetId) : undefined;
            const venue = b.type === 'venue' ? venueById(b.targetId) : undefined;
            const name = target?.name ?? venue?.name ?? 'Booking';
            return (
              <Pressable key={b.id} accessibilityRole="button" accessibilityLabel={`${name}, ${b.eventTitle}, ${STATUS_LABEL[b.status]}`} onPress={() => router.push(`/booking/${b.id}`)} style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', ...shadow(1) }}>
                <Photo src={target?.avatar ?? venue?.cover ?? 'ven_moon'} style={{ width: 116 }} />
                <View style={{ flex: 1, padding: 12, gap: 6 }}>
                  <T v="h3" color={colors.brandDeep} numberOfLines={1}>{name}</T>
                  <T v="smallBold" color={colors.inkSoft}>{shortDate(b.date)} · {b.startTime}–{b.endTime}</T>
                  <Row gap={4}><Icon name="map-marker-outline" size={16} color={colors.inkSoft} /><T v="small" color={colors.inkSoft} numberOfLines={1} style={{ flex: 1 }}>{b.location}</T></Row>
                  <Row justify="space-between" gap={8}>
                    <T v="small" numberOfLines={1} style={{ flex: 1 }}>{b.eventTitle}</T>
                    <Pill label={STATUS_LABEL[b.status]} tone={STATUS_TONE[b.status]} />
                  </Row>
                  {b.status === 'accepted' ? <T v="smallBold" color={colors.warning}>Action needed: pay to lock the date</T> : null}
                </View>
              </Pressable>
            );
          })
        ) : (
          <EmptyState
            icon={tab === 'musician' ? 'account-music-outline' : 'storefront-outline'}
            title="No bookings yet"
            body={tab === 'musician' ? 'Book a musician or DJ for your next event.' : 'Find a venue for your party, wedding or showcase.'}
            action={tab === 'musician' ? 'Browse artists' : 'Browse venues'}
            onAction={() => router.push(tab === 'musician' ? '/artists/all' : '/venues')}
          />
        )
      ) : null}
    </Screen>
  );
}
