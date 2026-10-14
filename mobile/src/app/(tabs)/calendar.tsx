import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateBadge, EventRow } from '../../components/cards';
import { Avatar, Button, Icon, IconButton, Pill, Row, Segmented, T } from '../../components/ui';
import { profileById, venueById } from '../../data/mock';
import type { Booking, BookingStatus } from '../../data/types';
import { STATUS_LABEL, STATUS_TONE } from '../../lib/booking';
import { isoDay, MONTHS_LONG, parse, sameDay, shortDate, TODAY } from '../../lib/format';
import { useAllEvents, useApp } from '../../store/useApp';
import { colors, fonts, radius, shadow } from '../../theme';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
/** Bookings that still hold a date in the calendar. */
const ACTIVE: BookingStatus[] = ['requested', 'pending', 'accepted', 'paid', 'confirmed'];

type View3 = 'month' | 'week' | 'day';

const noon = (y: number, m: number, d: number) => new Date(y, m, d, 12);
const addDays = (d: Date, n: number) => noon(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));

function monthGrid(year: number, month: number) {
  const start = mondayOf(noon(year, month, 1));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function bookingName(b: Booking) {
  return (b.type === 'musician' ? profileById(b.targetId)?.name : venueById(b.targetId)?.name) ?? 'Booking';
}

export default function CalendarTab() {
  const params = useLocalSearchParams<{ date?: string }>();
  const user = useApp((s) => s.user);
  const going = useApp((s) => s.going);
  const tickets = useApp((s) => s.tickets);
  const bookings = useApp((s) => s.bookings);
  const events = useAllEvents();
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

  const myEventIds = useMemo(
    () => new Set([...Object.keys(going), ...tickets.filter((t) => t.status !== 'cancelled').map((t) => t.eventId), ...events.filter((e) => e.organizerId === 'me').map((e) => e.id)]),
    [going, tickets, events],
  );
  const byDay = useMemo(() => {
    const m = new Map<string, typeof events>();
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

  const weekStart = mondayOf(selected);
  const days = view === 'month' ? monthGrid(cursor.getFullYear(), cursor.getMonth()) : view === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) : [];
  const selKey = isoDay(selected);
  // Your plans first, then everything else happening in Berlin that day.
  const dayEvents = [...(byDay.get(selKey) ?? [])].sort((a, b) => Number(myEventIds.has(b.id)) - Number(myEventIds.has(a.id)) || a.start.localeCompare(b.start));
  const dayBookings = bookingsByDay.get(selKey) ?? [];

  const mine = events.filter((e) => myEventIds.has(e.id) && parse(e.end) >= TODAY).sort((a, b) => a.start.localeCompare(b.start));
  const groups = mine.reduce<Record<string, typeof mine>>((acc, e) => {
    const d = parse(e.start);
    const k = `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
    (acc[k] ??= []).push(e);
    return acc;
  }, {});
  const upcomingBookings = activeBookings.filter((b) => parse(b.date) >= addDays(TODAY, -1));

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
            {Object.keys(groups).length === 0 && upcomingBookings.length === 0 ? (
              <View style={{ gap: 10 }}>
                <T v="body" color={colors.muted}>Tap “Going” or buy a ticket and your events show up here.</T>
                <Button title="Find events" variant="secondary" size="md" onPress={() => router.push('/events/all')} />
              </View>
            ) : null}
            {Object.entries(groups).map(([month, list]) => (
              <View key={month} style={{ gap: 2 }}>
                <T v="h2" style={{ marginVertical: 8 }}>{month}</T>
                {list.map((e) => (
                  <Pressable key={e.id} accessibilityRole="button" accessibilityLabel={`${e.title}, ${shortDate(e.start)}`} onPress={() => router.push(`/event/${e.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <DateBadge iso={e.start} size={64} />
                    <View style={{ flex: 1 }}>
                      <T v="title">{e.title}</T>
                      <T v="small">{venueById(e.venueId)?.name}{e.organizerId === 'me' ? ' · You’re hosting' : tickets.some((t) => t.eventId === e.id && t.status === 'valid') ? ' · Ticket ready' : ' · Going'}</T>
                    </View>
                    <Icon name="chevron-right" size={22} color={colors.subtle} />
                  </Pressable>
                ))}
              </View>
            ))}
            {upcomingBookings.length ? <T v="h2" style={{ marginTop: 8 }}>Bookings</T> : null}
            {upcomingBookings.map((b) => (
              <Pressable key={b.id} accessibilityRole="button" accessibilityLabel={`${b.eventTitle}, ${shortDate(b.date)}, ${STATUS_LABEL[b.status]}`} onPress={() => router.push(`/booking/${b.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <DateBadge iso={b.date} size={64} />
                <View style={{ flex: 1, gap: 4 }}>
                  <T v="title">{b.eventTitle}</T>
                  <T v="small">{bookingName(b)} · {b.startTime}–{b.endTime}</T>
                  <Pill label={STATUS_LABEL[b.status]} tone={STATUS_TONE[b.status]} />
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
                    const isMine = evs.some((e) => myEventIds.has(e.id)) || bks.length > 0;
                    const others = evs.some((e) => !myEventIds.has(e.id));
                    const sel = sameDay(d, selected);
                    const today = sameDay(d, TODAY);
                    const count = evs.length + bks.length;
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
            <Button title="Overview" icon="format-list-bulleted" size="md" style={{ alignSelf: 'center', paddingHorizontal: 40 }} onPress={() => setOverview(true)} />

            <T v="h3">{dayEvents.length + dayBookings.length ? `On ${shortDate(selKey)}` : `Nothing planned on ${shortDate(selKey)}`}</T>
            {dayBookings.map((b) => (
              <Pressable key={b.id} accessibilityRole="button" accessibilityLabel={`Booking: ${b.eventTitle} with ${bookingName(b)}, ${STATUS_LABEL[b.status]}`} onPress={() => router.push(`/booking/${b.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.brandTint, padding: 14, borderRadius: radius.lg }}>
                <Icon name="calendar-clock" size={24} color={colors.brand} />
                <View style={{ flex: 1, gap: 4 }}>
                  <T v="title">{b.eventTitle}</T>
                  <T v="small">{b.startTime}–{b.endTime} · {bookingName(b)}</T>
                  <Pill label={STATUS_LABEL[b.status]} tone={STATUS_TONE[b.status]} />
                </View>
                <Icon name="chevron-right" size={22} color={colors.subtle} />
              </Pressable>
            ))}
            {dayEvents.map((e) => (
              <View key={e.id} style={{ gap: 6 }}>
                {myEventIds.has(e.id) ? <Pill label={e.organizerId === 'me' ? 'You’re hosting' : 'Your plans'} tone="warning" icon="star" /> : null}
                <EventRow event={e} />
              </View>
            ))}
            {dayEvents.length + dayBookings.length === 0 ? <Button title="Find events" variant="secondary" size="md" onPress={() => router.push('/events/all')} /> : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
