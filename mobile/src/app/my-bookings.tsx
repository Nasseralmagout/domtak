import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen, ScreenHeader } from '../components/layout';
import { Button, EmptyState, Icon, Photo, Pill, Row, Segmented, T } from '../components/ui';
import { events as seedEvents, profileById, venueById } from '../data/mock';
import { STATUS_LABEL, STATUS_TONE } from '../lib/booking';
import { parse, shortDate, time, TODAY } from '../lib/format';
import { useApp } from '../store/useApp';
import { colors, radius, shadow } from '../theme';

type Tab = 'tickets' | 'musician' | 'venue';

export default function MyBookings() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'musician' || params.tab === 'venue' ? params.tab : 'tickets');
  const tickets = useApp((s) => s.tickets);
  const bookings = useApp((s) => s.bookings);
  const myEvents = useApp((s) => s.myEvents);
  const reviews = useApp((s) => s.reviews);
  const allEvents = [...myEvents, ...seedEvents];

  // Group multiple tickets for the same event into one card.
  const ticketGroups = Object.values(
    tickets.reduce<Record<string, typeof tickets>>((acc, t) => {
      const k = `${t.eventId}-${t.status}`;
      (acc[k] ??= []).push(t);
      return acc;
    }, {}),
  );

  return (
    <Screen header={<ScreenHeader title="Your bookings" />}>
      <Segmented dark options={[{ key: 'tickets', label: 'Tickets' }, { key: 'musician', label: 'Musicians' }, { key: 'venue', label: 'Venues' }]} value={tab} onChange={setTab} />

      {tab === 'tickets' ? (
        ticketGroups.length ? (
          ticketGroups.map((group) => {
            const t = group[0];
            const e = allEvents.find((x) => x.id === t.eventId);
            if (!e) return null;
            const past = parse(e.end) < TODAY;
            return (
              <View key={`${t.eventId}-${t.status}`} style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', ...shadow(1) }}>
                <Photo src={e.cover} style={{ width: 120 }} />
                <View style={{ flex: 1, padding: 12, gap: 6 }}>
                  <T v="h3" color={colors.brandDeep} numberOfLines={1}>{e.title}</T>
                  <T v="smallBold" color={colors.inkSoft}>{shortDate(e.start)} · {time(e.start)}–{time(e.end)}</T>
                  <Row gap={4}><Icon name="map-marker-outline" size={16} color={colors.inkSoft} /><T v="small" color={colors.inkSoft}>{venueById(e.venueId)?.name}, Berlin</T></Row>
                  {group.length > 1 ? <T v="small">{group.length} tickets</T> : null}
                  <Row justify="flex-end">
                    {t.status === 'cancelled' ? (
                      <T v="bodyBold" color={colors.danger}>Cancelled · refunded</T>
                    ) : past || t.status === 'used' ? (
                      reviews[e.id] ? <Pill label="Reviewed" tone="success" icon="check" /> : <Button title="Leave review" size="sm" variant="light" onPress={() => router.push(`/review/${e.id}`)} />
                    ) : (
                      <Button title="View e-ticket" size="sm" onPress={() => router.push(`/ticket/${t.id}`)} />
                    )}
                  </Row>
                </View>
              </View>
            );
          })
        ) : (
          <EmptyState icon="ticket-confirmation-outline" title="No tickets yet" body="Tickets you buy show up here with their QR code." action="Find events" onAction={() => router.push('/events/all')} />
        )
      ) : null}

      {tab !== 'tickets'
        ? (() => {
            const list = bookings.filter((b) => b.type === tab);
            if (!list.length) {
              return <EmptyState icon={tab === 'musician' ? 'account-music-outline' : 'storefront-outline'} title="No bookings yet" body={tab === 'musician' ? 'Book a musician or DJ for your next event.' : 'Find a venue for your party, wedding or showcase.'} action={tab === 'musician' ? 'Browse artists' : 'Browse venues'} onAction={() => router.push(tab === 'musician' ? '/artists/all' : '/venues')} />;
            }
            return list.map((b) => {
              const target = b.type === 'musician' ? profileById(b.targetId) : undefined;
              const venue = b.type === 'venue' ? venueById(b.targetId) : undefined;
              return (
                <Pressable key={b.id} accessibilityRole="button" onPress={() => router.push(`/booking/${b.id}`)} style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', ...shadow(1) }}>
                  <Photo src={target?.avatar ?? venue?.cover ?? 'ven_moon'} style={{ width: 116 }} />
                  <View style={{ flex: 1, padding: 12, gap: 6 }}>
                    <T v="h3" color={colors.brandDeep} numberOfLines={1}>{target?.name ?? venue?.name}</T>
                    <T v="smallBold" color={colors.inkSoft}>{shortDate(b.date)} · {b.startTime}–{b.endTime}</T>
                    <Row gap={4}><Icon name="map-marker-outline" size={16} color={colors.inkSoft} /><T v="small" color={colors.inkSoft} numberOfLines={1} style={{ flex: 1 }}>{b.location}</T></Row>
                    <Row justify="space-between">
                      <T v="small" numberOfLines={1} style={{ flex: 1 }}>{b.eventTitle}</T>
                      <Pill label={STATUS_LABEL[b.status]} tone={STATUS_TONE[b.status]} />
                    </Row>
                  </View>
                </Pressable>
              );
            });
          })()
        : null}
    </Screen>
  );
}
