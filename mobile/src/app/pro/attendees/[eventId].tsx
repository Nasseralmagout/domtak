import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { BottomBar, goBack, Screen, ScreenHeader } from '../../../components/layout';
import { Avatar, Button, Card, Chip, EmptyState, Field, Pill, Row, T } from '../../../components/ui';
import { attendees as seedAttendees } from '../../../data/mock';
import { euro, shortDate, time } from '../../../lib/format';
import { useEvent } from '../../../store/useApp';
import { colors } from '../../../theme';

const NO_GUESTS: typeof seedAttendees = [];

export default function Attendees() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const event = useEvent(eventId);
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');
  const [q, setQ] = useState('');

  const sold = event ? event.ticketTypes.reduce((n, t) => n + t.sold, 0) : 0;
  // Demo attendee sample; an event with no tickets sold has nobody to list or check in.
  const guests = sold > 0 ? seedAttendees : NO_GUESTS;
  const list = useMemo(
    () =>
      guests.filter((a) => (filter === 'all' || (filter === 'in' ? a.checkedIn : !a.checkedIn)) && (!q || `${a.name} ${a.code}`.toLowerCase().includes(q.toLowerCase()))),
    [guests, filter, q],
  );
  if (!event) {
    return (
      <Screen header={<ScreenHeader title="Attendees" onBack={() => goBack('/pro/events')} />}>
        <EmptyState icon="calendar-remove-outline" title="Event not found" body="This event may have been removed. Pick another one from your events." action="Back to my events" onAction={() => router.replace('/pro/events')} />
      </Screen>
    );
  }
  const cap = event.ticketTypes.reduce((n, t) => n + t.capacity, 0);
  const revenue = event.ticketTypes.reduce((n, t) => n + t.sold * t.price, 0);
  const checked = guests.filter((a) => a.checkedIn).length;

  return (
    <Screen
      header={
        <ScreenHeader
          title={event.title}
          subtitle={`${shortDate(event.start)} · ${time(event.start)}`}
          onBack={() => goBack('/pro/events')}
          right={
            <Button
              title="Promote"
              icon="rocket-launch-outline"
              size="sm"
              variant="light"
              hitSlop={6}
              style={{ marginRight: 12 }}
              accessibilityLabel={`Promote ${event.title}`}
              onPress={() => router.push(`/pro/promote/${event.id}`)}
            />
          }
        />
      }
      footer={<BottomBar><Button title="Scan tickets at the door" icon="qrcode-scan" onPress={() => router.push({ pathname: '/pro/scan', params: { eventId: event.id } })} /></BottomBar>}
    >
      <Row gap={8}>
        <Card style={{ flex: 1, backgroundColor: colors.brandDeep, padding: 12 }}>
          <T v="small" color={colors.lilacLight}>Sold</T>
          <T v="h3" color={colors.white}>{sold}<T v="small" color={colors.lilac}>/{cap}</T></T>
        </Card>
        <Card style={{ flex: 1, padding: 12 }}>
          <T v="small">Revenue</T>
          <T v="h3">{euro(revenue)}</T>
        </Card>
        <Card style={{ flex: 1, padding: 12 }}>
          <T v="small">Checked in</T>
          <T v="h3">{checked}</T>
        </Card>
      </Row>
      <Card style={{ gap: 12 }}>
        {event.ticketTypes.map((t) => (
          <View key={t.id} style={{ gap: 6 }}>
            <Row justify="space-between"><T v="smallBold">{t.name}</T><T v="small">{t.sold} / {t.capacity}</T></Row>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.divider, overflow: 'hidden' }}>
              <View style={{ height: 8, width: `${Math.round((t.sold / Math.max(1, t.capacity)) * 100)}%`, backgroundColor: colors.brand }} />
            </View>
          </View>
        ))}
      </Card>
      {sold === 0 ? (
        <EmptyState
          icon="ticket-outline"
          title={event.isPrivate ? 'No guests yet' : 'No tickets sold yet'}
          body={event.isPrivate ? 'Guests show up here once they register with your invite link.' : 'Guests show up here as soon as they get a ticket. Promote the event to reach fans nearby.'}
          action={event.isPrivate ? 'Invite guests' : 'Promote event'}
          onAction={() => router.push(event.isPrivate ? `/invite?event=${event.id}` : `/pro/promote/${event.id}`)}
        />
      ) : (
        <>
          <Field placeholder="Search name or ticket ID" value={q} onChangeText={setQ} icon="magnify" />
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            <Chip label={`All ${sold}`} selected={filter === 'all'} onPress={() => setFilter('all')} />
            <Chip label="Checked in" selected={filter === 'in'} onPress={() => setFilter('in')} />
            <Chip label="Not yet" selected={filter === 'out'} onPress={() => setFilter('out')} />
          </Row>
          {list.length === 0 ? (
            <T v="body" color={colors.muted} center style={{ paddingVertical: 24 }}>
              {q ? `No attendees match “${q}”.` : filter === 'in' ? 'Nobody has checked in yet.' : 'Everyone on this list has checked in.'}
            </T>
          ) : null}
          {list.map((a) => (
            <Row key={a.id} gap={12} style={{ backgroundColor: colors.surface, padding: 10, borderRadius: 14 }}>
              <Avatar src={a.avatar} size={40} label={a.name} />
              <View style={{ flex: 1 }}>
                <T v="bodyBold">{a.name}</T>
                <T v="small" style={{ fontSize: 12 }}>{a.ticketType} · #{a.code}</T>
              </View>
              <Pill label={a.checkedIn ? 'Checked in' : 'Not yet'} tone={a.checkedIn ? 'success' : 'neutral'} />
            </Row>
          ))}
        </>
      )}
    </Screen>
  );
}
