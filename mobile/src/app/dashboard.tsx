import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { DateBadge } from '../components/cards';
import { ConversationList, Panel, PanelEmpty, QueueRow } from '../components/dashboard';
import { goBack, Screen, ScreenHeader } from '../components/layout';
import { Avatar, Banner, Button, Icon, type IconName, IconButton, PaymentPill, Pill, Row, StatusPill, T, TimeLeft } from '../components/ui';
import { eventDiscussion, profileById } from '../data/mock';
import type { Booking, EventItem, EventState, GuestInvite, Ticket } from '../data/types';
import { WORKSPACE_LABEL } from '../lib/access';
import { isClosed, isConfirmed, isOutstanding, providerOf, quoteState, type Tone } from '../lib/booking';
import { guestInviteLabel, readinessLine } from '../lib/eventHost';
import { draftIssues, EVENT_STATE_TONE, eventState, eventStateLabel, guestSummary, type Readiness, readiness } from '../lib/events';
import { euro, parse, plural, shortDate, time, TODAY } from '../lib/format';
import { activeWorkspace, type ActionItem, useActionQueue, useAllEvents, useApp, useInvitedEvents } from '../store/useApp';
import { colors, radius } from '../theme';

/**
 * Member / host dashboard (blueprint section 11): the action queue first, then upcoming events
 * with their planning status, each provider booking with its own status, tickets with QR access
 * and messages. Every value comes from the account's records; empty sections say so.
 */

type Role = 'host' | 'guest' | 'ticket' | 'invited' | 'going';

interface UpcomingRow {
  event: EventItem;
  role: Role;
  state: EventState;
  r: Readiness;
  ticket?: Ticket;
  invite?: GuestInvite;
}

const ROLE_RANK: Record<Role, number> = { host: 0, guest: 1, ticket: 2, invited: 3, going: 4 };

const isHost = (e: EventItem) => e.organizerId === 'me' || e.hostId === 'me';
const upcoming = (e: EventItem) => parse(e.end).getTime() >= TODAY.getTime();

/** Needs your action first, then waiting on others, then confirmed, then closed. */
function bookingRank(b: Booking) {
  if (b.status === 'payment_failed' || b.payment === 'failed' || b.status === 'change_requested' || (b.pendingCancellation && !isClosed(b.status))) return 0;
  if (b.status === 'accepted' && b.payment !== 'paid') return 0;
  if (b.pricing === 'quote' && b.quote && b.status === 'requested' && ['sent', 'revised'].includes(quoteState(b.quote))) return 0;
  if (isOutstanding(b.status)) return 1;
  if (isConfirmed(b.status)) return 2;
  return 3;
}

const KIND_LABEL: Record<Booking['type'], string> = { musician: 'Artist', venue: 'Venue', lesson: 'Lesson' };

/** The next thing the host or guest still has to sort out for an event. */
function openTasks(row: UpcomingRow): string[] {
  const { event, role, state, r } = row;
  if (state === 'cancelled') return [event.cancelReason ? `Cancelled: ${event.cancelReason}` : 'This event was cancelled'];
  if (role === 'host') {
    const tasks: string[] = [];
    if (state === 'draft') {
      const issues = draftIssues(event);
      tasks.push(issues.length ? `Draft · ${plural(issues.length, 'detail')} missing` : 'Draft · ready to save as an event');
    }
    if (r.outstanding.length) tasks.push(`${plural(r.outstanding.length, 'provider booking')} outstanding`);
    if (r.closed.length) tasks.push(`${plural(r.closed.length, 'provider')} to replace`);
    if (event.isPrivate) {
      const g = guestSummary(event);
      if (!g.invited) tasks.push('No guests invited yet');
      else if (g.waiting) tasks.push(`${plural(g.waiting, 'guest')} haven’t answered`);
    }
    return tasks;
  }
  if (role === 'invited') return ['Reply to the invitation'];
  if (role === 'guest' && row.invite && !row.invite.ticketId && row.invite.contribution) return [`Pay your ${euro(row.invite.contribution)} contribution to get your ticket`];
  return [];
}

function roleLine(row: UpcomingRow) {
  if (row.role === 'host') return 'You’re hosting';
  if (row.invite) return guestInviteLabel(row.invite).label;
  if (row.role === 'ticket') return 'Ticket ready';
  return 'Going';
}

export default function Dashboard() {
  const user = useApp((s) => s.user);
  const bookings = useApp((s) => s.bookings);
  const tickets = useApp((s) => s.tickets);
  const going = useApp((s) => s.going);
  const myEvents = useApp((s) => s.myEvents);
  const blocked = useApp((s) => s.blocked);
  const extraComments = useApp((s) => s.extraComments);
  const removed = useApp((s) => s.removedContent);
  const allEvents = useAllEvents();
  const invited = useInvitedEvents();
  const queue = useActionQueue();
  const workspace = activeWorkspace(user);
  const hasProRoles = user.approvedRoles.some((r) => r !== 'fan');

  // Public events, your own events and private events you were invited to.
  const eventById = useMemo(() => {
    const m = new Map<string, EventItem>();
    allEvents.forEach((e) => m.set(e.id, e));
    invited.forEach(({ event }) => m.set(event.id, event));
    return m;
  }, [allEvents, invited]);

  const rows = useMemo<UpcomingRow[]>(() => {
    const out = new Map<string, UpcomingRow>();
    const add = (event: EventItem, role: Role, extra?: Partial<UpcomingRow>) => {
      if (!upcoming(event)) return;
      const prev = out.get(event.id);
      if (prev && ROLE_RANK[prev.role] <= ROLE_RANK[role]) return;
      out.set(event.id, { event, role, state: eventState(event, bookings), r: readiness(event, bookings), ...extra });
    };
    myEvents.filter(isHost).forEach((e) => add(e, 'host'));
    invited.forEach(({ invite, event }) => {
      if (invite.status === 'declined' || blocked.includes(invite.fromId)) return;
      add(event, invite.status === 'accepted' ? 'guest' : 'invited', { invite, ticket: tickets.find((t) => t.id === invite.ticketId) });
    });
    tickets.forEach((t) => {
      const e = eventById.get(t.eventId);
      if (e && (t.status === 'valid' || t.status === 'used')) add(e, 'ticket', { ticket: t });
    });
    Object.keys(going).forEach((id) => {
      const e = eventById.get(id);
      if (e) add(e, 'going');
    });
    return [...out.values()].sort((a, b) => Number(a.state === 'cancelled') - Number(b.state === 'cancelled') || a.event.start.localeCompare(b.event.start));
  }, [myEvents, invited, tickets, going, eventById, bookings, blocked]);

  // Event changes the queue doesn't cover: cancelled events you hold a ticket or invitation for, providers to replace, drafts.
  const items = useMemo<ActionItem[]>(() => {
    const extra: ActionItem[] = [];
    rows.forEach((row) => {
      const { event, role, state, r } = row;
      if (state === 'cancelled' && role !== 'host') {
        extra.push({
          id: `cx_${event.id}`,
          kind: 'booking',
          icon: 'calendar-remove-outline',
          title: `${event.title} was cancelled`,
          sub: row.ticket ? 'Your ticket is no longer valid. See what happens to your payment.' : event.cancelReason ?? 'The host cancelled this event',
          href: row.ticket ? `/ticket/${row.ticket.id}` : row.invite ? `/invitation/${row.invite.id}` : `/event/${event.id}`,
          tone: 'danger',
        });
      }
      if (role === 'host' && state !== 'cancelled') {
        r.closed.forEach((b) =>
          extra.push({ id: `rp_${b.id}`, kind: 'booking', icon: 'account-switch-outline', title: `Replace ${providerOf(b).name} for ${event.title}`, sub: 'The request closed without a booking. Other bookings are unchanged.', href: `/event-workspace/${event.id}`, tone: 'warning' }),
        );
        if (state === 'draft') {
          const issues = draftIssues(event);
          extra.push({ id: `dr_${event.id}`, kind: 'booking', icon: 'file-document-edit-outline', title: `Finish your draft: ${event.title}`, sub: issues.length ? issues.slice(0, 2).join(' · ') : 'All details are in. Save it to start inviting.', href: `/event-workspace/${event.id}`, tone: 'brand' });
        }
      }
    });
    // Provider requests belong to the professional workspace, not to the member dashboard.
    const own = queue.filter((q) => q.kind !== 'request');
    return [...own, ...extra.filter((x) => !own.some((q) => q.id === x.id))];
  }, [queue, rows]);
  const providerRequests = queue.filter((q) => q.kind === 'request').length;

  const bookingList = useMemo(
    () =>
      bookings
        .filter((b) => b.status !== 'completed' && !(isClosed(b.status) && parse(b.date).getTime() < TODAY.getTime()))
        .sort((a, b) => bookingRank(a) - bookingRank(b) || a.date.localeCompare(b.date)),
    [bookings],
  );

  const ticketRows = useMemo(() => {
    const groups = new Map<string, Ticket[]>();
    tickets.forEach((t) => {
      const e = eventById.get(t.eventId);
      if (!e || !upcoming(e)) return;
      const k = `${t.eventId}:${t.status}`;
      groups.set(k, [...(groups.get(k) ?? []), t]);
    });
    return [...groups.values()]
      .map((list) => ({ list, event: eventById.get(list[0].eventId) as EventItem }))
      .sort((a, b) => Number(a.list[0].status !== 'valid') - Number(b.list[0].status !== 'valid') || a.event.start.localeCompare(b.event.start));
  }, [tickets, eventById]);

  // Discussions of your next events (event context next to direct conversations).
  const discussions = useMemo(
    () =>
      rows
        .filter((x) => x.state !== 'cancelled')
        .map((x) => {
          const list = [...(eventDiscussion[x.event.id] ?? []), ...(extraComments[`event:${x.event.id}`] ?? [])].filter((c) => !removed.includes(c.id) && !blocked.includes(c.authorId));
          return { event: x.event, count: list.length, last: list[list.length - 1] };
        })
        .filter((x) => x.count > 0)
        .slice(0, 2),
    [rows, extraComments, removed, blocked],
  );

  const next = rows.find((x) => x.state !== 'cancelled');
  const nothingYet = !rows.length && !bookingList.length && !ticketRows.length && !items.length;
  const first = user.name.split(' ')[0];

  const openEvent = (row: UpcomingRow) => {
    if (row.role === 'host') router.push(`/event-workspace/${row.event.id}`);
    else if (row.ticket && row.ticket.status === 'valid') router.push(`/ticket/${row.ticket.id}`);
    else if (row.invite) router.push(`/invitation/${row.invite.id}`);
    else router.push(`/event/${row.event.id}`);
  };
  const actionLabel = (row: UpcomingRow) => (row.role === 'host' ? 'Manage event' : row.ticket?.status === 'valid' ? 'Open ticket' : row.invite ? (row.role === 'invited' ? 'Reply' : 'Invitation') : 'View event');

  return (
    <Screen
      header={
        <ScreenHeader
          title="Dashboard"
          subtitle={`Member · ${first}`}
          onBack={() => goBack('/(tabs)')}
          right={hasProRoles ? <IconButton name="swap-horizontal" label="Switch workspace" onPress={() => router.push('/workspace')} /> : undefined}
        />
      }
    >
      {workspace !== 'fan' ? (
        <Banner icon="briefcase-outline">
          <View style={{ gap: 8 }}>
            <T v="small" color="#2E1D5E">{`You’re working as ${WORKSPACE_LABEL[workspace]}. This dashboard covers your own events, bookings and tickets as a member.`}</T>
            <Button title={`Open ${WORKSPACE_LABEL[workspace]} workspace`} size="sm" variant="secondary" style={{ alignSelf: 'flex-start' }} onPress={() => router.push('/pro/workspace')} />
          </View>
        </Banner>
      ) : null}

      {nothingYet ? (
        <View style={{ padding: 18, borderRadius: radius.xl, backgroundColor: colors.brandDeep, gap: 12 }}>
          <T v="h2" color={colors.white}>Welcome, {first}</T>
          <T v="body" color={colors.lilacLight}>Nothing is planned yet. Find events and artists you like, or start your own private event and invite friends.</T>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            <Button title="Discover" icon="compass-outline" size="md" variant="light" onPress={() => router.push('/(tabs)/events')} />
            <Button title="Create private event" icon="calendar-plus" size="md" variant="outlineLight" onPress={() => router.push('/create-event?private=1')} />
          </Row>
        </View>
      ) : null}

      <Panel title="Action queue" icon="bell-ring-outline" count={items.length} note={items.length ? 'Open each record to take the next step.' : undefined}>
        {items.length ? (
          <View>
            {items.map((i) => (
              <QueueRow key={`${i.kind}-${i.id}`} icon={i.icon} title={i.title} sub={i.sub} tone={i.tone} onPress={() => router.push(i.href as never)} />
            ))}
          </View>
        ) : (
          <Row gap={10} style={{ padding: 12, borderRadius: radius.md, backgroundColor: colors.successBg }}>
            <Icon name="check-circle-outline" size={22} color={colors.success} />
            <T v="small" color={colors.success} style={{ flex: 1 }}>Nothing needs your attention. Invitations, payment issues and event changes show up here.</T>
          </Row>
        )}
        {providerRequests ? (
          <QueueRow icon="inbox-arrow-down" title={`${plural(providerRequests, 'booking request')} in your workspace`} sub="Respond before each 24-hour deadline" tone="warning" onPress={() => router.push('/pro/workspace')} />
        ) : null}
      </Panel>

      <Panel title="Upcoming events" icon="calendar-star" action={rows.length ? 'My events' : undefined} onAction={() => router.push('/my-events')}>
        {next ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Next event: ${next.event.title}, ${shortDate(next.event.start)}. ${openTasks(next).join('. ') || 'Nothing outstanding'}. ${actionLabel(next)}`}
            onPress={() => openEvent(next)}
            style={({ pressed }) => ({ padding: 14, borderRadius: radius.md, backgroundColor: colors.brandDeep, gap: 8, opacity: pressed ? 0.9 : 1 })}
          >
            <T v="caption" color={colors.gold}>YOUR NEXT EVENT</T>
            <Row gap={12} align="flex-start">
              <DateBadge iso={next.event.start} size={56} />
              <View style={{ flex: 1, gap: 2 }}>
                <T v="title" color={colors.white} numberOfLines={2}>{next.event.title}</T>
                <T v="small" color={colors.lilacLight}>{shortDate(next.event.start)} · {time(next.event.start)} · {next.event.isPrivate ? 'Private' : 'Public'} · {roleLine(next)}</T>
              </View>
            </Row>
            {openTasks(next).length ? (
              openTasks(next).map((t) => (
                <Row key={t} gap={8}>
                  <Icon name="alert-circle-outline" size={16} color={colors.gold} />
                  <T v="small" color={colors.white} style={{ flex: 1 }}>{t}</T>
                </Row>
              ))
            ) : (
              <Row gap={8}>
                <Icon name="check-circle-outline" size={16} color={colors.lilac} />
                <T v="small" color={colors.lilacLight}>Nothing outstanding</T>
              </Row>
            )}
            <T v="smallBold" color={colors.gold}>{actionLabel(next)} ›</T>
          </Pressable>
        ) : null}
        {rows.filter((x) => x !== next).slice(0, 4).map((row) => (
          <Pressable
            key={row.event.id}
            accessibilityRole="button"
            accessibilityLabel={`${row.event.title}, ${shortDate(row.event.start)}, ${row.event.isPrivate ? 'private' : 'public'}, ${eventStateLabel(row.state, row.event.isPrivate)}, ${roleLine(row)}. ${actionLabel(row)}`}
            onPress={() => openEvent(row)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}
          >
            <DateBadge iso={row.event.start} size={48} />
            <View style={{ flex: 1, gap: 4 }}>
              <T v="bodyBold" numberOfLines={1}>{row.event.title}</T>
              <Row gap={6} style={{ flexWrap: 'wrap' }}>
                <Pill label={eventStateLabel(row.state, row.event.isPrivate)} tone={EVENT_STATE_TONE[row.state]} />
                <Pill label={row.event.isPrivate ? 'Private' : 'Public'} icon={row.event.isPrivate ? 'lock-outline' : 'earth'} tone="neutral" />
              </Row>
              <T v="small" numberOfLines={2}>{row.role === 'host' ? readinessLine(row.r) : roleLine(row)}</T>
            </View>
            <Icon name="chevron-right" size={20} color={colors.subtle} />
          </Pressable>
        ))}
        {!rows.length ? (
          <PanelEmpty
            icon="calendar-blank-outline"
            title="No upcoming events"
            body="Events you host, have a ticket for, were invited to or marked as going appear here."
            actions={[
              { label: 'Find events', icon: 'compass-outline', onPress: () => router.push('/events/all') },
              { label: 'Create private event', icon: 'calendar-plus', primary: true, onPress: () => router.push('/create-event?private=1') },
            ]}
          />
        ) : (
          <Button title="Create private event" icon="calendar-plus" size="sm" variant="light" style={{ alignSelf: 'flex-start' }} onPress={() => router.push('/create-event?private=1')} />
        )}
      </Panel>

      <Panel
        title="Bookings"
        icon="account-music-outline"
        action={bookingList.length ? 'All bookings' : undefined}
        onAction={() => router.push(`/my-bookings?tab=${bookingList[0]?.type ?? 'musician'}`)}
        note={bookingList.length ? 'Each provider booking has its own status, deadline and payment.' : undefined}
      >
        {bookingList.length ? (
          bookingList.slice(0, 5).map((b) => {
            const p = providerOf(b);
            const closed = isClosed(b.status);
            const priced = b.pricing !== 'quote' || (!!b.quote && b.quote.version > 0);
            return (
              <View key={b.id} style={{ gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${p.name}, ${KIND_LABEL[b.type]}, ${b.eventTitle}, ${shortDate(b.date)}. View request`} onPress={() => router.push(`/booking/${b.id}`)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.7 : 1 })}>
                  <Avatar src={p.image} size={44} label={p.name} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Row gap={6}>
                      <T v="bodyBold" numberOfLines={1} style={{ flexShrink: 1 }}>{p.name}</T>
                      <T v="small" style={{ fontSize: 12 }}>{KIND_LABEL[b.type]}</T>
                    </Row>
                    <T v="small" numberOfLines={1}>{b.eventTitle} · {shortDate(b.date)}{priced ? ` · ${euro(b.amount)}` : ''}</T>
                  </View>
                  <Icon name="chevron-right" size={20} color={colors.subtle} />
                </Pressable>
                <Row gap={6} style={{ flexWrap: 'wrap', paddingLeft: 56 }}>
                  <StatusPill booking={b} />
                  {b.payment && b.payment !== 'not_started' ? <PaymentPill state={b.payment} /> : null}
                  {b.status === 'pending' ? <TimeLeft deadline={b.deadline} /> : null}
                </Row>
                {closed ? (
                  <Button
                    title={p.kind === 'venue' ? 'Find another venue' : 'Find another artist'}
                    icon="magnify"
                    size="sm"
                    variant="light"
                    style={{ alignSelf: 'flex-start', marginLeft: 56 }}
                    onPress={() => router.push(p.kind === 'venue' ? '/venues' : '/artists/all')}
                  />
                ) : null}
              </View>
            );
          })
        ) : (
          <PanelEmpty
            icon="handshake-outline"
            title="No open bookings"
            body="Book an artist, band, DJ or venue for your event. Each request shows its own status and payment here."
            actions={[
              { label: 'Browse artists', onPress: () => router.push('/artists/all') },
              { label: 'Browse venues', onPress: () => router.push('/venues') },
            ]}
          />
        )}
      </Panel>

      <Panel title="Tickets" icon="ticket-confirmation-outline" action={ticketRows.length ? 'All tickets' : undefined} onAction={() => router.push('/my-bookings?tab=tickets')}>
        {ticketRows.length ? (
          ticketRows.slice(0, 3).map(({ list, event }) => {
            const t = list[0];
            const cancelledEvent = eventState(event, bookings) === 'cancelled';
            const status: { label: string; tone: Tone; icon: IconName } =
              t.status === 'refunded'
                ? { label: 'Refunded', tone: 'neutral', icon: 'cash-refund' }
                : t.status === 'cancelled'
                  ? { label: 'Cancelled', tone: 'danger', icon: 'close-circle-outline' }
                  : cancelledEvent
                    ? { label: 'Event cancelled', tone: 'danger', icon: 'calendar-remove-outline' }
                    : t.status === 'used'
                      ? { label: t.checkedInAt ? `Checked in ${time(t.checkedInAt)}` : 'Checked in', tone: 'neutral', icon: 'check' }
                      : { label: 'Valid', tone: 'success', icon: 'qrcode' };
            return (
              <QueueRow
                key={`${t.eventId}-${t.status}`}
                icon={status.icon}
                tone={status.tone}
                title={event.title}
                sub={`${shortDate(event.start)} · ${time(event.start)} · ${plural(list.length, 'ticket')}`}
                right={<Pill label={status.label} tone={status.tone} />}
                a11y={`${event.title}, ${shortDate(event.start)}, ${plural(list.length, 'ticket')}, ${status.label}. Open ticket`}
                onPress={() => router.push(`/ticket/${t.id}`)}
              />
            );
          })
        ) : (
          <PanelEmpty icon="ticket-outline" title="No tickets yet" body="Tickets you buy and private-event tickets from invitations appear here with their QR code." actions={[{ label: 'Find events', onPress: () => router.push('/events/all') }]} />
        )}
      </Panel>

      <Panel title="Messages" icon="message-text-outline" action="Inbox" onAction={() => router.push('/inbox')}>
        {discussions.map(({ event, count, last }) => (
          <QueueRow
            key={`talk-${event.id}`}
            icon="forum-outline"
            tone="neutral"
            title={`${event.title} · ${plural(count, 'message')}`}
            sub={last ? `Event discussion · ${profileById(last.authorId)?.name ?? 'Guest'}: ${last.text}` : 'Event discussion'}
            onPress={() => router.push(`/event-comments/${event.id}`)}
          />
        ))}
        <ConversationList bookings={bookings} />
      </Panel>

      {hasProRoles ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={user.application ? 'Professional application status' : 'Apply as a professional: artist, band, DJ, venue or organizer'}
          onPress={() => router.push(user.application ? '/application' : '/apply')}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 })}
        >
          <Icon name="briefcase-plus-outline" size={24} color={colors.brand} />
          <View style={{ flex: 1 }}>
            <T v="bodyBold">{user.application ? 'Your professional application' : 'Perform, host or organize?'}</T>
            <T v="small">{user.application ? 'See its status and any missing details' : 'Artists, venues and organizers apply for a professional workspace'}</T>
          </View>
          <Icon name="chevron-right" size={20} color={colors.subtle} />
        </Pressable>
      )}
    </Screen>
  );
}
