import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { BottomBar, goBack, Screen, ScreenHeader } from '../../../components/layout';
import { Avatar, Button, Card, Chip, EmptyState, Field, Pill, Row, T } from '../../../components/ui';
import { attendees as seedAttendees } from '../../../data/mock';
import { euro, isoDay, shortDate, time, TODAY } from '../../../lib/format';
import { doorsOpenAt, isPromoted, promotionChain, promotionEnd } from '../../../lib/promotions';
import { useApp, useEvent } from '../../../store/useApp';
import { colors } from '../../../theme';

const NO_GUESTS: typeof seedAttendees = [];

export default function Attendees() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const event = useEvent(eventId);
  const promotions = useApp((s) => s.promotions);
  // Codes scanned at the door (shared with /pro/scan).
  const scanned = useApp((s) => s.checkIns[eventId ?? '']);
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');
  const [q, setQ] = useState('');

  const sold = event ? event.ticketTypes.reduce((n, t) => n + t.sold, 0) : 0;
  // Demo attendee sample; an event with no tickets sold has nobody to list or check in.
  const sample = sold > 0 ? seedAttendees : NO_GUESTS;
  const guests = useMemo(() => (scanned?.length ? sample.map((a) => (a.checkedIn || !scanned.includes(a.code) ? a : { ...a, checkedIn: true })) : sample), [sample, scanned]);
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
  // Guests on the sample list plus any other ticket scanned at the door (e.g. your own), as /pro/scan counts them.
  const checked = new Set([...guests.filter((a) => a.checkedIn).map((a) => a.code), ...(scanned ?? [])]).size;

  // Same boost states as /pro/events: Promote, Extend while a boost runs, Promoted once it lasts until doors open.
  const promoted = isPromoted(promotions, event, TODAY);
  const promotedUntil = promotionEnd(promotions, event);
  const covered = promoted && promotionChain(promotions, event.id).end >= doorsOpenAt(event).getTime();
  const canPromote = !event.isPrivate && doorsOpenAt(event) > TODAY;
  const until = promotedUntil ? shortDate(isoDay(promotedUntil)) : '';

  return (
    <Screen
      header={
        <ScreenHeader
          title={event.title}
          subtitle={`${shortDate(event.start)} · ${time(event.start)}`}
          onBack={() => goBack('/pro/events')}
          right={
            canPromote ? (
              <Button
                title={covered ? 'Promoted' : promoted ? 'Extend' : 'Promote'}
                icon={promoted ? 'rocket-launch' : 'rocket-launch-outline'}
                size="sm"
                variant="light"
                hitSlop={6}
                style={{ marginRight: 12 }}
                accessibilityLabel={
                  covered
                    ? `${event.title} is promoted until doors open on ${until}. View promotion`
                    : promoted
                      ? `Extend promotion for ${event.title}, promoted until ${until}`
                      : `Promote ${event.title}`
                }
                onPress={() => router.push(`/pro/promote/${event.id}`)}
              />
            ) : event.isPrivate ? (
              <Button
                title="Invite"
                icon="account-plus-outline"
                size="sm"
                variant="light"
                hitSlop={6}
                style={{ marginRight: 12 }}
                accessibilityLabel={`Invite guests to ${event.title}`}
                onPress={() => router.push(`/invite?event=${event.id}`)}
              />
            ) : undefined
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
          body={
            event.isPrivate
              ? 'Guests show up here once they register with your invite link.'
              : promoted
                ? `Guests show up here as soon as they get a ticket. Your boost runs until ${covered ? 'doors open on ' : ''}${until}.`
                : canPromote
                  ? 'Guests show up here as soon as they get a ticket. Promote the event to reach fans nearby.'
                  : 'Guests show up here as soon as they get a ticket.'
          }
          action={event.isPrivate ? 'Invite guests' : canPromote && !covered ? (promoted ? 'Extend promotion' : 'Promote event') : undefined}
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
