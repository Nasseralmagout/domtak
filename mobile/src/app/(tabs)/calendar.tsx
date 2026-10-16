import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateBadge, EventRow } from '../../components/cards';
import { Avatar, Button, Icon, IconButton, Pill, Row, Segmented, StatusPill, T, TimeLeft, type Tone } from '../../components/ui';
import { venueById } from '../../data/mock';
import type { Booking, BookingStatus, EventItem, GuestInvite, IncomingRequest, Role } from '../../data/types';
import { bookingLabel, providerOf } from '../../lib/booking';
import { requestDay } from '../../lib/dashboards';
import { eventState } from '../../lib/events';
import { isoDay, MONTHS_LONG, parse, plural, sameDay, shortDate, TODAY } from '../../lib/format';
import { isDiscoverable } from '../../store/filters';
import { activeWorkspace, type ActionItem, useActionQueue, useAllEvents, useApp, useInvitedEvents } from '../../store/useApp';
import { colors, fonts, radius, shadow } from '../../theme';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
/** Bookings that still hold a date in the calendar (also while a change or a failed payment is being sorted out). */
const ACTIVE: BookingStatus[] = ['requested', 'pending', 'accepted', 'paid', 'confirmed', 'change_requested', 'payment_failed'];

type View3 = 'month' | 'week' | 'day';

const noon = (y: number, m: number, d: number) => new Date(y, m, d, 12);
const addDays = (d: Date, n: number) => noon(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));

function monthGrid(year: number, month: number) {
  const start = mondayOf(noon(year, month, 1));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** Requests that belong to a provider workspace: venue hire for a venue, everything else for an artist. */
const forWorkspace = (r: IncomingRequest, workspace: Role) => (workspace === 'venue' ? r.kind === 'venue' : r.kind !== 'venue');

const TONE_FG: Record<Tone, string> = { success: colors.success, warning: colors.warningStrong, danger: colors.danger, brand: colors.brand, neutral: colors.label };
const TONE_BG: Record<Tone, string> = { success: colors.successBg, warning: colors.warningBg, danger: colors.dangerBg, brand: colors.brandSoft, neutral: colors.chipIdle };

/** The next action at the top of Overview, linked to the record that needs it. */
function NextActionCard({ item, more, onMore }: { item: ActionItem; more: number; onMore: () => void }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 10, borderLeftWidth: 5, borderLeftColor: TONE_FG[item.tone], ...shadow(1) }}>
      <T v="caption">NEXT ACTION</T>
      <Pressable accessibilityRole="button" accessibilityLabel={`Next action: ${item.title}. ${item.sub}`} onPress={() => router.push(item.href as never)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.75 : 1 })}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: TONE_BG[item.tone], alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={item.icon} size={20} color={TONE_FG[item.tone]} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="bodyBold">{item.title}</T>
          <T v="small" numberOfLines={2}>{item.sub}</T>
        </View>
        <Icon name="chevron-right" size={22} color={colors.subtle} />
      </Pressable>
      {more > 0 ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${plural(more, 'more item')} waiting. Open dashboard`} onPress={onMore} hitSlop={6} style={{ minHeight: 44, justifyContent: 'center' }}>
          <T v="smallBold" color={colors.brand}>{plural(more, 'more item')} waiting · Open dashboard</T>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function CalendarTab() {
  const params = useLocalSearchParams<{ date?: string }>();
  const user = useApp((s) => s.user);
  const going = useApp((s) => s.going);
  const tickets = useApp((s) => s.tickets);
  const bookings = useApp((s) => s.bookings);
  const requests = useApp((s) => s.requests);
  const allEvents = useAllEvents();
  const invited = useInvitedEvents();
  const queue = useActionQueue();
  const workspace = activeWorkspace(user);
  const pro = workspace !== 'fan';
  // Only artist and venue workspaces take provider bookings; an organizer books providers instead.
  const provider = workspace === 'musician' || workspace === 'venue';
  const [view, setView] = useState<View3>('month');
  const [selected, setSelected] = useState(TODAY);
  const [cursor, setCursor] = useState(noon(TODAY.getFullYear(), TODAY.getMonth(), 1));
  const [overview, setOverview] = useState(false);

  /** Select a day and keep the visible month in sync with it. */
  const select = (d: Date) => {
    setSelected(d);
    setCursor(noon(d.getFullYear(), d.getMonth(), 1));
  };

  // Deep links such as "Add to calendar" pass ?date=YYYY-MM-DD so the calendar opens on that day.
  const [lastDate, setLastDate] = useState<string>();
  if (params.date !== lastDate) {
    setLastDate(params.date);
    const d = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? parse(params.date) : undefined;
    if (d && !Number.isNaN(d.getTime())) {
      setSelected(d);
      setCursor(noon(d.getFullYear(), d.getMonth(), 1));
      setOverview(false);
    }
  }

  // Invitations you haven't declined, by event (private events are not in the public list).
  const inviteByEvent = useMemo(() => {
    const m = new Map<string, GuestInvite>();
    invited.forEach(({ invite }) => {
      if (invite.status !== 'declined') m.set(invite.eventId, invite);
    });
    return m;
  }, [invited]);
  const myEventIds = useMemo(
    () =>
      new Set([
        // respondInvite('declined') stores going[id] = false, so only count the true entries.
        ...Object.keys(going).filter((id) => going[id]),
        ...tickets.filter((t) => t.status === 'valid' || t.status === 'used').map((t) => t.eventId),
        ...allEvents.filter((e) => e.organizerId === 'me' || e.hostId === 'me').map((e) => e.id),
        ...inviteByEvent.keys(),
      ]),
    [going, tickets, allEvents, inviteByEvent],
  );
  // Public events everyone can see, plus your own and the private ones you were invited to.
  const events = useMemo(() => {
    const visible = allEvents.filter((e) => isDiscoverable(e) || myEventIds.has(e.id));
    const extra = invited.map((x) => x.event).filter((e) => inviteByEvent.has(e.id) && !visible.some((v) => v.id === e.id));
    return extra.length ? [...visible, ...extra] : visible;
  }, [allEvents, invited, inviteByEvent, myEventIds]);
  const byDay = useMemo(() => {
    const m = new Map<string, EventItem[]>();
    events.forEach((e) => {
      const k = isoDay(parse(e.start));
      m.set(k, [...(m.get(k) ?? []), e]);
    });
    return m;
  }, [events]);
  const activeBookings = useMemo(() => bookings.filter((b) => ACTIVE.includes(b.status)).sort((a, b) => a.date.localeCompare(b.date)), [bookings]);
  const bookingsByDay = useMemo(() => {
    const m = new Map<string, Booking[]>();
    activeBookings.forEach((b) => m.set(b.date, [...(m.get(b.date) ?? []), b]));
    return m;
  }, [activeBookings]);
  // Professionals also see the work they accepted from booking requests (venue hire in the venue workspace).
  const gigs = useMemo(
    () =>
      (provider ? requests : [])
        .filter((r) => r.status === 'accepted' && forWorkspace(r, workspace))
        .map((r) => ({ r, day: requestDay(r) }))
        .filter((g): g is { r: IncomingRequest; day: string } => !!g.day)
        .sort((a, b) => a.day.localeCompare(b.day)),
    [provider, requests, workspace],
  );
  const gigsByDay = useMemo(() => {
    const m = new Map<string, IncomingRequest[]>();
    gigs.forEach(({ r, day }) => m.set(day, [...(m.get(day) ?? []), r]));
    return m;
  }, [gigs]);

  /** How an event you have plans for relates to you. */
  const planLabel = (e: EventItem) => {
    if (eventState(e, bookings) === 'cancelled') return 'Cancelled';
    if (e.organizerId === 'me' || e.hostId === 'me') return 'You’re hosting';
    const inv = inviteByEvent.get(e.id);
    if (inv) return inv.status === 'invited' ? 'Invitation · reply' : 'Invited · going';
    if (tickets.some((t) => t.eventId === e.id && t.status === 'valid')) return 'Ticket ready';
    if (tickets.some((t) => t.eventId === e.id && t.status === 'used')) return 'Checked in';
    return 'Going';
  };
  const openPlan = (e: EventItem) => {
    const inv = inviteByEvent.get(e.id);
    if (inv && inv.status === 'invited') router.push(`/invitation/${inv.id}`);
    else router.push(`/event/${e.id}`);
  };

  const weekStart = mondayOf(selected);
  const days = view === 'month' ? monthGrid(cursor.getFullYear(), cursor.getMonth()) : view === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) : [];
  const selKey = isoDay(selected);
  // Your plans first, then everything else happening in Berlin that day.
  const dayEvents = [...(byDay.get(selKey) ?? [])].sort((a, b) => Number(myEventIds.has(b.id)) - Number(myEventIds.has(a.id)) || a.start.localeCompare(b.start));
  const dayBookings = bookingsByDay.get(selKey) ?? [];
  const dayGigs = gigsByDay.get(selKey) ?? [];
  const dayCount = dayEvents.length + dayBookings.length + dayGigs.length;

  const mine = events.filter((e) => myEventIds.has(e.id) && parse(e.end) >= TODAY).sort((a, b) => a.start.localeCompare(b.start));
  const groups = mine.reduce<Record<string, typeof mine>>((acc, e) => {
    const d = parse(e.start);
    const k = `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
    (acc[k] ??= []).push(e);
    return acc;
  }, {});
  const upcomingBookings = activeBookings.filter((b) => parse(b.date) >= addDays(TODAY, -1));
  const upcomingGigs = gigs.filter((g) => parse(g.day) >= addDays(TODAY, -1));

  // Overview starts with what needs doing: provider requests first in a provider workspace, then your own records.
  // The shared queue lists every new request; keep only the ones the active workspace can answer.
  const actions = useMemo(() => {
    const own = new Set(requests.filter((r) => provider && forWorkspace(r, workspace)).map((r) => r.id));
    return [...queue.filter((q) => q.kind === 'request' && own.has(q.id)), ...queue.filter((q) => q.kind !== 'request')];
  }, [queue, requests, provider, workspace]);
  const awaitingReply = upcomingBookings.filter((b) => b.status === 'pending' || (b.status === 'requested' && b.pricing === 'quote' && (!b.quote || b.quote.version === 0)));

  const changeView = (v: View3) => {
    setView(v);
    // Whatever view you switch to, it opens on the selected day.
    setCursor(noon(selected.getFullYear(), selected.getMonth(), 1));
  };
  const step = (dir: 1 | -1) => {
    if (view === 'month') {
      const c = noon(cursor.getFullYear(), cursor.getMonth() + dir, 1);
      setCursor(c);
      // Keep the selection inside the visible month so the list below matches the grid.
      const sameMonthAsToday = c.getFullYear() === TODAY.getFullYear() && c.getMonth() === TODAY.getMonth();
      setSelected(sameMonthAsToday ? TODAY : c);
    } else {
      select(addDays(selected, view === 'week' ? 7 * dir : dir));
    }
  };
  const weekEnd = addDays(weekStart, 6);
  const rangeLabel =
    view === 'month'
      ? `${MONTHS_LONG[cursor.getMonth()]} ${cursor.getFullYear()}`
      : view === 'week'
        ? `${weekStart.getDate()} ${MONTHS_LONG[weekStart.getMonth()].slice(0, 3)} – ${weekEnd.getDate()} ${MONTHS_LONG[weekEnd.getMonth()].slice(0, 3)}`
        : `${WEEKDAYS_LONG[(selected.getDay() + 6) % 7]}`;
  const unit = view === 'month' ? 'month' : view === 'week' ? 'week' : 'day';
  const isToday = sameDay(selected, TODAY);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
        <Row justify="space-between">
          {overview ? <IconButton name="chevron-left" label="Back to calendar" iconSize={30} onPress={() => setOverview(false)} /> : <T v="h3" accessibilityRole="header">Calendar</T>}
          <Pressable accessibilityRole="button" accessibilityLabel="Your profile" onPress={() => router.push('/profile/me')}>
            <Avatar src={user.avatar} size={48} label={user.name} />
          </Pressable>
        </Row>

        {overview ? (
          <>
            <T v="h1">Your event overview</T>
            {actions.length ? (
              <NextActionCard item={actions[0]} more={actions.length - 1} onMore={() => router.push('/dashboard')} />
            ) : (
              <Row gap={10} style={{ padding: 12, borderRadius: radius.md, backgroundColor: colors.successBg }}>
                <Icon name="check-circle-outline" size={22} color={colors.success} />
                <T v="small" color={colors.success} style={{ flex: 1 }}>Nothing needs your action right now.</T>
              </Row>
            )}
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              <Button title="Your dashboard" icon="view-dashboard-outline" size="sm" variant="light" onPress={() => router.push('/dashboard')} />
              {pro ? <Button title="Pro workspace" icon="briefcase-outline" size="sm" variant="light" onPress={() => router.push('/pro/workspace')} /> : null}
            </Row>
            {awaitingReply.map((b) => (
              <Pressable
                key={`wait-${b.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Waiting for ${providerOf(b).name}: ${b.eventTitle}, ${bookingLabel(b)}. Open booking`}
                onPress={() => router.push(`/booking/${b.id}`)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.brandTint, opacity: pressed ? 0.8 : 1 })}
              >
                <Icon name="timer-sand" size={20} color={colors.brand} />
                <View style={{ flex: 1, gap: 4 }}>
                  <T v="smallBold">Waiting for {providerOf(b).name} to reply</T>
                  <T v="small" numberOfLines={1}>{b.eventTitle} · {shortDate(b.date)}</T>
                </View>
                {b.status === 'pending' ? <TimeLeft deadline={b.deadline} /> : <Pill label={bookingLabel(b)} tone="brand" />}
              </Pressable>
            ))}
            {Object.keys(groups).length === 0 && upcomingBookings.length === 0 && upcomingGigs.length === 0 ? (
              <View style={{ gap: 10 }}>
                <T v="body" color={colors.muted}>Tap “Going”, buy a ticket or accept an invitation and your events show up here.</T>
                <Button title="Find events" variant="secondary" size="md" onPress={() => router.push('/events/all')} />
              </View>
            ) : null}
            {Object.entries(groups).map(([month, list]) => (
              <View key={month} style={{ gap: 2 }}>
                <T v="h2" style={{ marginVertical: 8 }}>{month}</T>
                {list.map((e) => (
                  <Pressable key={e.id} accessibilityRole="button" accessibilityLabel={`${e.title}, ${shortDate(e.start)}, ${planLabel(e)}`} onPress={() => openPlan(e)} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <DateBadge iso={e.start} size={64} />
                    <View style={{ flex: 1 }}>
                      <T v="title">{e.title}</T>
                      <T v="small" color={planLabel(e) === 'Cancelled' ? colors.danger : colors.muted}>{venueById(e.venueId)?.name} · {planLabel(e)}</T>
                    </View>
                    <Icon name="chevron-right" size={22} color={colors.subtle} />
                  </Pressable>
                ))}
              </View>
            ))}
            {upcomingBookings.length ? <T v="h2" style={{ marginTop: 8 }}>Bookings</T> : null}
            {upcomingBookings.map((b) => (
              <Pressable key={b.id} accessibilityRole="button" accessibilityLabel={`${b.eventTitle}, ${shortDate(b.date)}, ${providerOf(b).name}, ${bookingLabel(b)}`} onPress={() => router.push(`/booking/${b.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <DateBadge iso={b.date} size={64} />
                <View style={{ flex: 1, gap: 4 }}>
                  <T v="title">{b.eventTitle}</T>
                  <T v="small">{providerOf(b).name} · {b.startTime}–{b.endTime}</T>
                  <StatusPill booking={b} />
                </View>
                <Icon name="chevron-right" size={22} color={colors.subtle} />
              </Pressable>
            ))}
            {upcomingGigs.length ? <T v="h2" style={{ marginTop: 8 }}>{workspace === 'venue' ? 'Venue bookings' : 'Your gigs'}</T> : null}
            {upcomingGigs.map(({ r, day }) => (
              <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`${workspace === 'venue' ? 'Venue booking' : 'Gig'}: ${r.title}, ${shortDate(day)}, ${r.time}`} onPress={() => router.push(`/pro/request/${r.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <DateBadge iso={day} size={64} />
                <View style={{ flex: 1, gap: 4 }}>
                  <T v="title">{r.title}</T>
                  <T v="small">{r.requester} · {r.time}</T>
                  <Pill label={workspace === 'venue' ? 'Accepted booking' : 'Accepted gig'} tone="success" />
                </View>
                <Icon name="chevron-right" size={22} color={colors.subtle} />
              </Pressable>
            ))}
          </>
        ) : (
          <>
            <Row justify="space-between">
              <T v="h1" style={{ fontFamily: fonts.displayMedium, flex: 1 }}>{selected.getDate()} {MONTHS_LONG[selected.getMonth()]} {selected.getFullYear()}</T>
              {!isToday ? <Button title="Today" size="sm" variant="light" onPress={() => select(TODAY)} /> : null}
            </Row>
            <Segmented options={[{ key: 'month', label: 'Month' }, { key: 'week', label: 'Week' }, { key: 'day', label: 'Day' }]} value={view} onChange={changeView} />
            <Row justify="space-between">
              <IconButton name="chevron-left" label={`Previous ${unit}`} onPress={() => step(-1)} />
              <T v="title" accessibilityLiveRegion="polite">{rangeLabel}</T>
              <IconButton name="chevron-right" label={`Next ${unit}`} onPress={() => step(1)} />
            </Row>
            {view !== 'day' ? (
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 8, ...shadow(1) }}>
                <Row gap={0}>
                  {WEEKDAYS.map((d, i) => <Text key={i} accessibilityLabel={WEEKDAYS_LONG[i]} style={{ flex: 1, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, paddingVertical: 8 }}>{d}</Text>)}
                </Row>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {days.map((d) => {
                    const k = isoDay(d);
                    const inMonth = view === 'week' || d.getMonth() === cursor.getMonth();
                    const evs = byDay.get(k) ?? [];
                    const bks = bookingsByDay.get(k) ?? [];
                    const gg = gigsByDay.get(k) ?? [];
                    const isMine = evs.some((e) => myEventIds.has(e.id)) || bks.length > 0 || gg.length > 0;
                    const others = evs.some((e) => !myEventIds.has(e.id));
                    const sel = sameDay(d, selected);
                    const today = sameDay(d, TODAY);
                    const count = evs.length + bks.length + gg.length;
                    return (
                      <Pressable
                        key={k}
                        accessibilityRole="button"
                        accessibilityLabel={`${d.getDate()} ${MONTHS_LONG[d.getMonth()]}${count ? `, ${count} item${count > 1 ? 's' : ''}` : ''}${isMine ? ', includes your plans' : ''}`}
                        accessibilityState={{ selected: sel }}
                        onPress={() => (inMonth ? setSelected(d) : select(d))}
                        style={{ width: `${100 / 7}%`, height: view === 'week' ? 64 : 56, alignItems: 'center', justifyContent: 'center', gap: 3 }}
                      >
                        <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? colors.brand : today ? colors.brandSoft : 'transparent' }}>
                          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: sel ? colors.white : inMonth ? colors.ink : colors.disabled }}>{d.getDate()}</Text>
                        </View>
                        <View style={{ height: 6, flexDirection: 'row', gap: 3 }}>
                          {isMine ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold }} /> : null}
                          {others ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brandDeep }} /> : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
            {view !== 'day' ? (
              <Row gap={14}>
                <Row gap={6}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold }} /><T v="small">Your plans</T></Row>
                <Row gap={6}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandDeep }} /><T v="small">Events in Berlin</T></Row>
              </Row>
            ) : null}
            <Button
              title={actions.length ? `Overview · ${plural(actions.length, 'action')}` : 'Overview'}
              icon="format-list-bulleted"
              size="md"
              accessibilityLabel={actions.length ? `Overview, ${plural(actions.length, 'item')} need your action` : 'Overview'}
              style={{ alignSelf: 'center', paddingHorizontal: 32 }}
              onPress={() => setOverview(true)}
            />

            <T v="h3">{dayCount ? `On ${shortDate(selKey)}` : `Nothing planned on ${shortDate(selKey)}`}</T>
            {dayGigs.map((r) => (
              <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`${workspace === 'venue' ? 'Venue booking' : 'Gig'}: ${r.title} for ${r.requester}, ${r.time}`} onPress={() => router.push(`/pro/request/${r.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.successBg, padding: 14, borderRadius: radius.lg }}>
                <Icon name={workspace === 'venue' ? 'storefront-outline' : 'microphone'} size={24} color={colors.success} />
                <View style={{ flex: 1, gap: 4 }}>
                  <T v="title">{r.title}</T>
                  <T v="small">{r.time} · {r.location.split(',')[0]} · for {r.requester}</T>
                  <Pill label={workspace === 'venue' ? 'Accepted booking' : 'Accepted gig'} tone="success" />
                </View>
                <Icon name="chevron-right" size={22} color={colors.subtle} />
              </Pressable>
            ))}
            {dayBookings.map((b) => (
              <Pressable key={b.id} accessibilityRole="button" accessibilityLabel={`Booking: ${b.eventTitle} with ${providerOf(b).name}, ${bookingLabel(b)}`} onPress={() => router.push(`/booking/${b.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.brandTint, padding: 14, borderRadius: radius.lg }}>
                <Icon name="calendar-clock" size={24} color={colors.brand} />
                <View style={{ flex: 1, gap: 4 }}>
                  <T v="title">{b.eventTitle}</T>
                  <T v="small">{b.startTime}–{b.endTime} · {providerOf(b).name}</T>
                  <StatusPill booking={b} />
                </View>
                <Icon name="chevron-right" size={22} color={colors.subtle} />
              </Pressable>
            ))}
            {dayEvents.map((e) => {
              const plan = myEventIds.has(e.id) ? planLabel(e) : undefined;
              return (
                <View key={e.id} style={{ gap: 6 }}>
                  {plan ? <Pill label={plan} tone={plan === 'Cancelled' ? 'danger' : 'warning'} icon={plan === 'Cancelled' ? 'calendar-remove-outline' : 'star'} /> : null}
                  {e.isPrivate && inviteByEvent.has(e.id) && plan !== 'You’re hosting' ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`${e.title}, private event. Open invitation`} onPress={() => openPlan(e)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow(1) }}>
                      <DateBadge iso={e.start} size={52} />
                      <View style={{ flex: 1 }}>
                        <T v="title">{e.title}</T>
                        <T v="small">Private · {venueById(e.venueId)?.name}</T>
                      </View>
                      <Icon name="lock-outline" size={20} color={colors.subtle} />
                    </Pressable>
                  ) : (
                    <EventRow event={e} />
                  )}
                </View>
              );
            })}
            {dayCount === 0 ? <Button title="Find events" variant="secondary" size="md" onPress={() => router.push('/events/all')} /> : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
