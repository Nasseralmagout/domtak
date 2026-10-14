import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { goBack, Screen, ScreenHeader } from '../../components/layout';
import { Button, Card, EmptyState, Icon, Photo, Pill, Row, Segmented, T } from '../../components/ui';
import { events as seedEvents, venueById } from '../../data/mock';
import type { EventItem } from '../../data/types';
import { euro, eventWhen, parse, TODAY } from '../../lib/format';
import { type Promotion, useApp } from '../../store/useApp';
import { colors, fonts, radius } from '../../theme';

/** For the demo, these seed organizers count as "you". */
const DEMO_ORGANIZERS = ['mobolosa', 'og'];
const DAY = 86_400_000;

/** End of an event's promotion chain (extensions start when the previous boost ends). */
function promotionEnd(list: Promotion[], eventId: string) {
  return list
    .filter((p) => p.eventId === eventId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .reduce((end, p) => Math.max(end, Date.parse(p.createdAt)) + p.days * DAY, 0);
}

function stats(e: EventItem) {
  const sold = e.ticketTypes.reduce((n, t) => n + t.sold, 0);
  const capacity = e.ticketTypes.reduce((n, t) => n + t.capacity, 0);
  const revenue = e.ticketTypes.reduce((n, t) => n + t.sold * t.price, 0);
  return { sold, capacity, revenue, pct: capacity ? Math.min(1, sold / capacity) : 0 };
}

function daysUntil(iso: string) {
  const d = Math.ceil((parse(iso).getTime() - TODAY.getTime()) / DAY);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  return `In ${d} days`;
}

function ManageCard({ event, promoted, past, mine }: { event: EventItem; promoted: boolean; past: boolean; mine: boolean }) {
  const venue = venueById(event.venueId);
  const { sold, capacity, revenue, pct } = stats(event);
  const soldOut = capacity > 0 && sold >= capacity;
  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <View style={{ height: 136 }}>
        <Photo src={event.cover} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} accessibilityLabel={`${event.title} cover`} />
        <LinearGradient colors={['transparent', 'rgba(20,10,40,0.85)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 96 }} />
        <Row gap={6} style={{ position: 'absolute', top: 12, left: 12, right: 12, flexWrap: 'wrap' }}>
          {promoted ? <Pill label="Promoted" icon="rocket-launch" tone="brand" /> : null}
          {event.isPrivate ? <Pill label="Private" icon="lock-outline" tone="neutral" /> : null}
          {mine ? <Pill label="New" tone="success" /> : null}
          {past ? <Pill label="Ended" tone="neutral" /> : null}
        </Row>
        <View style={{ position: 'absolute', left: 14, right: 14, bottom: 12 }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: 20, color: colors.white }}>{event.title}</Text>
          <Text numberOfLines={1} style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.lilacLight }}>
            {eventWhen(event.start, event.end)}
          </Text>
        </View>
      </View>

      <View style={{ padding: 14, gap: 12 }}>
        <Row justify="space-between">
          <Row gap={4} style={{ flex: 1 }}>
            <Icon name="map-marker-outline" size={16} color={colors.brand} />
            <T v="small" color={colors.inkSoft} numberOfLines={1} style={{ flex: 1 }}>{venue ? `${venue.name}, ${venue.area}` : 'Venue to be announced'}</T>
          </Row>
          <T v="smallBold" color={past ? colors.subtle : colors.brand}>{past ? 'Finished' : daysUntil(event.start)}</T>
        </Row>

        <View style={{ gap: 6 }} accessible accessibilityLabel={`${sold} of ${capacity} tickets sold`}>
          <Row justify="space-between">
            <T v="label">Tickets sold</T>
            <T v="smallBold">
              {sold} / {capacity}
              {soldOut ? <T v="smallBold" color={colors.success}>{'  ·  Sold out'}</T> : null}
            </T>
          </Row>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.divider, overflow: 'hidden' }}>
            <View style={{ height: 8, width: `${Math.round(pct * 100)}%`, borderRadius: 4, backgroundColor: soldOut ? colors.success : colors.brand }} />
          </View>
        </View>

        <Row gap={10}>
          <View style={{ flex: 1, padding: 10, borderRadius: radius.sm, backgroundColor: colors.brandTint }}>
            <T v="small" style={{ fontSize: 12 }}>{past ? 'Final revenue' : 'Revenue so far'}</T>
            <T v="bodyBold">{euro(revenue)}</T>
          </View>
          <View style={{ flex: 1, padding: 10, borderRadius: radius.sm, backgroundColor: colors.brandTint }}>
            <T v="small" style={{ fontSize: 12 }}>Going</T>
            <T v="bodyBold">{event.going || sold}</T>
          </View>
        </Row>

        <Row gap={8}>
          <Button title="Manage" size="md" variant="primary" style={{ flex: 1, paddingHorizontal: 8 }} accessibilityLabel={`Manage ${event.title}`} onPress={() => router.push(`/pro/attendees/${event.id}`)} />
          {!past && !event.isPrivate ? (
            <Button
              title={promoted ? 'Boosted' : 'Promote'}
              size="md"
              variant="light"
              style={{ flex: 1, paddingHorizontal: 8 }}
              accessibilityLabel={promoted ? `Extend promotion for ${event.title}` : `Promote ${event.title}`}
              onPress={() => router.push(`/pro/promote/${event.id}`)}
            />
          ) : null}
          <Button title="View" size="md" variant="secondary" style={{ flex: 1, paddingHorizontal: 8 }} accessibilityLabel={`View ${event.title}`} onPress={() => router.push(`/event/${event.id}`)} />
        </Row>
      </View>
    </Card>
  );
}

export default function ProEvents() {
  const myEvents = useApp((s) => s.myEvents);
  const promotions = useApp((s) => s.promotions);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  const { upcoming, past } = useMemo(() => {
    const all = [...myEvents, ...seedEvents.filter((e) => DEMO_ORGANIZERS.includes(e.organizerId))];
    return {
      upcoming: all.filter((e) => parse(e.end) >= TODAY).sort((a, b) => a.start.localeCompare(b.start)),
      past: all.filter((e) => parse(e.end) < TODAY).sort((a, b) => b.start.localeCompare(a.start)),
    };
  }, [myEvents]);

  const myIds = useMemo(() => new Set(myEvents.map((e) => e.id)), [myEvents]);
  // Captured once per visit; new boosts start after this, so they always count as running.
  const [now] = useState(() => Date.now());
  const isPromoted = (id: string) => promotionEnd(promotions, id) > now;

  const list = tab === 'upcoming' ? upcoming : past;
  const totals = upcoming.reduce(
    (acc, e) => {
      const s = stats(e);
      return { sold: acc.sold + s.sold, revenue: acc.revenue + s.revenue };
    },
    { sold: 0, revenue: 0 },
  );
  const promotedCount = upcoming.filter((e) => isPromoted(e.id)).length;

  return (
    <Screen
      header={
        <ScreenHeader
          title="My events"
          subtitle={`${upcoming.length} upcoming · ${promotedCount} promoted`}
          onBack={() => goBack('/pro/workspace')}
          right={<Button title="New event" icon="plus" size="sm" hitSlop={6} style={{ marginRight: 12 }} onPress={() => router.push('/create-event')} />}
        />
      }
    >
      <Row gap={8}>
        <Card style={{ flex: 1, backgroundColor: colors.brandDeep, padding: 12 }}>
          <T v="small" color={colors.lilacLight}>Upcoming</T>
          <T v="h3" color={colors.white}>{upcoming.length}</T>
        </Card>
        <Card style={{ flex: 1, padding: 12 }}>
          <T v="small">Tickets sold</T>
          <T v="h3">{totals.sold}</T>
        </Card>
        <Card style={{ flex: 1, padding: 12 }}>
          <T v="small">Revenue</T>
          <T v="h3" numberOfLines={1} adjustsFontSizeToFit>{euro(totals.revenue)}</T>
        </Card>
      </Row>

      <Segmented
        options={[
          { key: 'upcoming', label: `Upcoming (${upcoming.length})` },
          { key: 'past', label: `Past (${past.length})` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {list.length === 0 ? (
        tab === 'upcoming' ? (
          <EmptyState icon="calendar-plus" title="No upcoming events" body="Create an event to sell tickets, track sales and promote it to fans nearby." action="Create event" onAction={() => router.push('/create-event')} />
        ) : (
          <EmptyState icon="history" title="No past events yet" body="Once an event has ended, its final ticket sales and revenue show up here." />
        )
      ) : (
        list.map((e) => <ManageCard key={e.id} event={e} promoted={isPromoted(e.id)} past={tab === 'past'} mine={myIds.has(e.id)} />)
      )}
    </Screen>
  );
}
