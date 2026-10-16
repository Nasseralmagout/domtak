import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { goBack, Screen, ScreenHeader } from '../components/layout';
import { Banner, Button, Card, EmptyState, Icon, Photo, Pill, Row, Segmented, T } from '../components/ui';
import { profileById } from '../data/mock';
import type { EventItem, EventState } from '../data/types';
import { guestInviteLabel, readinessLine } from '../lib/eventHost';
import { EVENT_STATE_TONE, eventState, eventStateLabel, guestSummary, type Readiness, readiness } from '../lib/events';
import { eventWhen, parse, plural, TODAY } from '../lib/format';
import { activeWorkspace, canPublishPublicEvents, useApp, useInvitedEvents, useVenue } from '../store/useApp';
import { colors, radius } from '../theme';

type Tab = 'upcoming' | 'drafts' | 'past';

interface HostedRow {
  event: EventItem;
  state: EventState;
  r: Readiness;
}

function HostedCard({ row }: { row: HostedRow }) {
  const { event, state, r } = row;
  const venue = useVenue(event.venueId);
  const g = guestSummary(event);
  const cs = event.costSharing?.enabled ? event.costSharing : undefined;
  const sold = event.ticketTypes.reduce((n, t) => n + t.sold, 0);
  const capacity = event.ticketTypes.reduce((n, t) => n + t.capacity, 0);
  const guests = event.isPrivate
    ? g.invited
      ? `${g.accepted} accepted · ${g.waiting} no answer${cs ? ` · ${g.paid} paid` : ''}`
      : 'No guests invited yet'
    : `${sold} of ${capacity} tickets sold`;
  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <Row gap={12} style={{ padding: 12 }} align="flex-start">
        <Photo src={event.cover} style={{ width: 72, height: 72 }} radius={12} accessibilityLabel={`${event.title} cover`} />
        <View style={{ flex: 1, gap: 4 }}>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            <Pill label={eventStateLabel(state, event.isPrivate)} tone={EVENT_STATE_TONE[state]} />
            <Pill label={event.isPrivate ? 'Private' : 'Public'} icon={event.isPrivate ? 'lock-outline' : 'earth'} tone="neutral" />
          </Row>
          <T v="title" numberOfLines={1}>{event.title}</T>
          <T v="small" numberOfLines={1}>{eventWhen(event.start, event.end)}</T>
          <T v="small" numberOfLines={1}>{venue ? `${venue.name}, ${venue.area}` : 'Venue not decided yet'}</T>
        </View>
      </Row>
      <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 6 }}>
        <Row gap={8} align="flex-start">
          <Icon name="account-music-outline" size={16} color={r.ready ? colors.success : colors.brand} />
          <T v="small" color={r.ready ? colors.success : colors.inkSoft} style={{ flex: 1 }}>{readinessLine(r)}</T>
        </Row>
        <Row gap={8} align="flex-start">
          <Icon name={event.isPrivate ? 'account-group-outline' : 'ticket-confirmation-outline'} size={16} color={colors.brand} />
          <T v="small" color={colors.inkSoft} style={{ flex: 1 }}>{guests}</T>
        </Row>
        {state === 'cancelled' && event.cancelReason ? <T v="small" color={colors.danger}>Cancelled: {event.cancelReason}</T> : null}
        <Row gap={8} style={{ marginTop: 6 }}>
          <Button title="Manage" icon="view-dashboard-outline" size="md" style={{ flex: 1 }} accessibilityLabel={`Manage ${event.title}`} onPress={() => router.push(`/event-workspace/${event.id}`)} />
          <Button title="View" size="md" variant="secondary" style={{ flex: 1 }} accessibilityLabel={`View ${event.title}`} onPress={() => router.push(`/event/${event.id}`)} />
        </Row>
      </View>
    </Card>
  );
}

export default function MyEvents() {
  const myEvents = useApp((s) => s.myEvents);
  const bookings = useApp((s) => s.bookings);
  const user = useApp((s) => s.user);
  const blocked = useApp((s) => s.blocked);
  const invitedAll = useInvitedEvents();

  const rows = useMemo<HostedRow[]>(() => myEvents.map((event) => ({ event, state: eventState(event, bookings), r: readiness(event, bookings) })), [myEvents, bookings]);
  const groups = useMemo(() => {
    const asc = (a: HostedRow, b: HostedRow) => a.event.start.localeCompare(b.event.start);
    return {
      upcoming: rows.filter((x) => x.state !== 'draft' && x.state !== 'completed' && x.state !== 'cancelled').sort(asc),
      drafts: rows.filter((x) => x.state === 'draft').sort(asc),
      past: rows.filter((x) => x.state === 'completed' || x.state === 'cancelled').sort((a, b) => b.event.start.localeCompare(a.event.start)),
    };
  }, [rows]);
  // Invitations you received for events that have not ended, from hosts you have not blocked.
  const invitations = useMemo(() => invitedAll.filter((x) => !blocked.includes(x.invite.fromId) && parse(x.event.end).getTime() >= TODAY.getTime()), [invitedAll, blocked]);
  const [tab, setTab] = useState<Tab>(() => (groups.upcoming.length || !groups.drafts.length ? 'upcoming' : 'drafts'));

  const createHref = canPublishPublicEvents(user) ? '/create-event' : '/create-event?private=1';
  const list = groups[tab];

  return (
    <Screen
      header={
        <ScreenHeader
          title="My events"
          subtitle={`${groups.upcoming.length} upcoming · ${plural(groups.drafts.length, 'draft')}`}
          onBack={() => goBack('/(tabs)')}
          right={<Button title="New" icon="plus" size="sm" hitSlop={6} style={{ marginRight: 12 }} accessibilityLabel="Create event" onPress={() => router.push(createHref as never)} />}
        />
      }
    >
      {activeWorkspace(user) === 'organizer' ? (
        <Banner icon="calendar-star">
          <View style={{ gap: 6 }}>
            <T v="small" color="#2E1D5E">Public events, ticket sales and promotions are in your organizer dashboard.</T>
            <Button title="Organizer events" size="sm" variant="light" style={{ alignSelf: 'flex-start' }} onPress={() => router.push('/pro/events')} />
          </View>
        </Banner>
      ) : null}

      {invitations.length ? (
        <View style={{ gap: 10 }}>
          <T v="h3" accessibilityRole="header">Invitations</T>
          {invitations.map(({ invite, event }) => {
            const st = guestInviteLabel(invite);
            const host = profileById(invite.fromId);
            return (
              <Card key={invite.id} onPress={() => router.push(`/invitation/${invite.id}`)} accessibilityLabel={`${event.title}, invitation from ${host?.name ?? 'a friend'}: ${st.label}. Open invitation`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 }}>
                <Photo src={event.cover} style={{ width: 60, height: 60 }} radius={12} />
                <View style={{ flex: 1, gap: 3 }}>
                  <T v="bodyBold" numberOfLines={1}>{event.title}</T>
                  <T v="small" numberOfLines={1}>{host ? `From ${host.name}` : 'Invitation'} · {eventWhen(event.start, event.end)}</T>
                  <Pill label={st.label} tone={st.tone} />
                </View>
                <Icon name="chevron-right" size={22} color={colors.subtle} />
              </Card>
            );
          })}
        </View>
      ) : null}

      <T v="h3" accessibilityRole="header">Events you host</T>
      <Segmented
        options={[
          { key: 'upcoming', label: `Upcoming (${groups.upcoming.length})` },
          { key: 'drafts', label: `Drafts (${groups.drafts.length})` },
          { key: 'past', label: `Past (${groups.past.length})` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {list.length ? (
        list.map((row) => <HostedCard key={row.event.id} row={row} />)
      ) : tab === 'upcoming' ? (
        myEvents.length === 0 ? (
          <EmptyState icon="calendar-lock-outline" title="No events yet" body="Create a private event: a birthday or a gathering. Invite friends, book an artist or a venue, and share costs." action="Create private event" onAction={() => router.push('/create-event?private=1')} />
        ) : groups.drafts.length ? (
          <EmptyState icon="calendar-edit" title="No upcoming events" body="Finish one of your drafts to open invitations." action="See drafts" onAction={() => setTab('drafts')} />
        ) : (
          <EmptyState icon="calendar-blank-outline" title="No upcoming events" body="Your next event shows here once you create it." action="Create private event" onAction={() => router.push('/create-event?private=1')} />
        )
      ) : tab === 'drafts' ? (
        <EmptyState icon="file-document-edit-outline" title="No drafts" body="Events you save while still planning show up here, with what is left to finish." />
      ) : (
        <EmptyState icon="history" title="No past events" body="Events that ended or were cancelled show up here." />
      )}

      {list.length ? (
        <View style={{ padding: 12, borderRadius: radius.md, backgroundColor: colors.chipIdle }}>
          <T v="small">Each provider booking keeps its own status and payment. An event is ready only when every provider has confirmed.</T>
        </View>
      ) : null}
    </Screen>
  );
}
