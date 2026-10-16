import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { PersonRow } from '../../../components/cards';
import { BottomBar, goBack, Screen, ScreenHeader } from '../../../components/layout';
import { Avatar, Banner, Button, Card, Chip, EmptyState, Field, Icon, Pill, Row, T } from '../../../components/ui';
import { attendees as seedAttendees, profileById } from '../../../data/mock';
import type { Attendee } from '../../../data/types';
import { hostsEvent, invitationLabel } from '../../../lib/eventHost';
import { EVENT_STATE_TONE, eventState, eventStateLabel, guestSummary } from '../../../lib/events';
import { euro, isoDay, shortDate, time, TODAY } from '../../../lib/format';
import { doorsOpenAt, promotionState } from '../../../lib/promotions';
import { useApp, useEvent } from '../../../store/useApp';
import { colors } from '../../../theme';

const NO_GUESTS: Attendee[] = [];

export default function Attendees() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const event = useEvent(eventId);
  const promotions = useApp((s) => s.promotions);
  const user = useApp((s) => s.user);
  const bookings = useApp((s) => s.bookings);
  // Codes scanned at the door (shared with /pro/scan).
  const scanned = useApp((s) => s.checkIns[eventId ?? '']);
  const tickets = useApp((s) => s.tickets);
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');
  const [q, setQ] = useState('');

  const sold = event ? event.ticketTypes.reduce((n, t) => n + t.sold, 0) : 0;
  // Demo attendee sample; an event with no tickets sold has no sample guests (only tickets scanned at the door).
  const sample = sold > 0 ? seedAttendees : NO_GUESTS;
  const guests = useMemo(() => {
    if (!scanned?.length) return sample;
    const list = sample.map((a) => (a.checkedIn || !scanned.includes(a.code) ? a : { ...a, checkedIn: true }));
    // Tickets scanned at /pro/scan that are not on the sample list (e.g. your own) are guests too.
    const extra = scanned
      .filter((code) => !list.some((a) => a.code === code))
      .map((code): Attendee => {
        const t = tickets.find((x) => x.code === code && x.eventId === eventId);
        const type = event?.ticketTypes.find((x) => x.id === t?.typeId)?.name ?? 'Ticket';
        return { id: `scan_${code}`, name: t?.holder ?? 'Guest', ticketType: type, code, checkedIn: true };
      });
    return extra.length ? [...list, ...extra] : list;
  }, [sample, scanned, tickets, eventId, event]);
  const list = useMemo(
    () =>
      guests.filter((a) => (filter === 'all' || (filter === 'in' ? a.checkedIn : !a.checkedIn)) && (!q || `${a.name} ${a.code}`.toLowerCase().includes(q.toLowerCase()))),
    [guests, filter, q],
  );
  if (!event) {
    return (
      <Screen header={<ScreenHeader title="Attendees" onBack={() => goBack('/my-events')} />}>
        <EmptyState icon="calendar-remove-outline" title="Event not found" body="This event may have been removed. Pick another one from your events." action="Back to my events" onAction={() => router.replace('/my-events')} />
      </Screen>
    );
  }
  // Guest lists and entry are for the person who runs the event.
  if (!hostsEvent(event, user)) {
    return (
      <Screen header={<ScreenHeader title="Attendees" onBack={() => goBack(`/event/${event.id}`)} />}>
        <EmptyState icon="account-lock-outline" title="Only the host can see guests" body="Guest lists, tickets and entry are visible to the person who runs the event." action="View event" onAction={() => router.replace(`/event/${event.id}`)} />
      </Screen>
    );
  }
  const workspace = `/event-workspace/${event.id}`;
  const state = eventState(event, bookings);
  const invitations = event.invitations ?? [];
  const g = guestSummary(event);
  const cs = event.costSharing?.enabled ? event.costSharing : undefined;
  const cap = event.ticketTypes.reduce((n, t) => n + t.capacity, 0);
  const revenue = event.ticketTypes.reduce((n, t) => n + t.sold * t.price, 0);
  // Same count as /pro/scan: guests already inside plus every ticket scanned at the door.
  const checked = guests.filter((a) => a.checkedIn).length;

  // Same boost states as /pro/events: Promote, Extend while a boost runs, Promoted once it lasts until doors open.
  const promo = promotionState(promotions, event, TODAY);
  const promoted = promo.kind !== 'none';
  const covered = promo.kind === 'covered';
  // Only a live public event can be promoted (never a draft, a cancelled or a private event).
  const canPromote = !event.isPrivate && state !== 'draft' && state !== 'cancelled' && state !== 'completed' && doorsOpenAt(event) > TODAY;
  const until = promo.kind === 'none' ? '' : shortDate(isoDay(promo.until));

  return (
    <Screen
      header={
        <ScreenHeader
          title={event.title}
          subtitle={`${shortDate(event.start)} · ${time(event.start)} · ${eventStateLabel(state, event.isPrivate)}`}
          onBack={() => goBack(workspace)}
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
            ) : event.isPrivate && state !== 'cancelled' && state !== 'completed' ? (
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
      <Card onPress={() => router.push(workspace as never)} accessibilityLabel="Open the event workspace: providers, budget and invitations" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
        <Icon name="view-dashboard-outline" size={22} color={colors.brand} />
        <View style={{ flex: 1 }}>
          <T v="bodyBold">Event workspace</T>
          <T v="small">Providers, budget and invitations</T>
        </View>
        <Pill label={eventStateLabel(state, event.isPrivate)} tone={EVENT_STATE_TONE[state]} />
        <Icon name="chevron-right" size={20} color={colors.subtle} />
      </Card>
      {state === 'cancelled' ? <Banner icon="calendar-remove-outline" tone="danger">{`This event is cancelled${event.cancelReason ? `: ${event.cancelReason}` : ''}. Tickets are no longer valid for entry.`}</Banner> : null}
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
      {event.isPrivate && invitations.length ? (
        <Card style={{ gap: 6 }}>
          <Row justify="space-between">
            <T v="title">Invited guests</T>
            <T v="small">{`${g.accepted} accepted · ${g.waiting} no answer${cs ? ` · ${g.paid} paid` : ''}`}</T>
          </Row>
          {invitations.map((inv) => {
            const st = invitationLabel(inv, cs);
            return <PersonRow key={inv.profileId} id={inv.profileId} subtitle={profileById(inv.profileId)?.handle} right={<Pill label={st.label} tone={st.tone} />} />;
          })}
        </Card>
      ) : null}
      {sold === 0 && guests.length === 0 ? (
        event.isPrivate && invitations.length ? null : (
        <EmptyState
          icon="ticket-outline"
          title={event.isPrivate ? 'No guests yet' : 'No tickets sold yet'}
          body={
            event.isPrivate
              ? 'Guests show up here once you invite them and they answer.'
              : promoted
                ? `Guests show up here as soon as they get a ticket. Your boost runs until ${covered ? 'doors open on ' : ''}${until}.`
                : canPromote
                  ? 'Guests show up here as soon as they get a ticket. Promote the event to reach fans nearby.'
                  : 'Guests show up here as soon as they get a ticket.'
          }
          action={event.isPrivate ? 'Invite guests' : canPromote && !covered ? (promoted ? 'Extend promotion' : 'Promote event') : undefined}
          onAction={() => router.push(event.isPrivate ? `/invite?event=${event.id}` : `/pro/promote/${event.id}`)}
        />
        )
      ) : (
        <>
          <Field placeholder="Search name or ticket ID" value={q} onChangeText={setQ} icon="magnify" />
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            <Chip label={`All ${guests.length}`} selected={filter === 'all'} onPress={() => setFilter('all')} />
            <Chip label={`Checked in ${checked}`} selected={filter === 'in'} onPress={() => setFilter('in')} />
            <Chip label={`Not yet ${guests.length - checked}`} selected={filter === 'out'} onPress={() => setFilter('out')} />
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
