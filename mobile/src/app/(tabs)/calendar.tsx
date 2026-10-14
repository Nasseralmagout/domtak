import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateBadge, EventRow } from '../../components/cards';
import { Avatar, Button, Icon, IconButton, Row, Segmented, T } from '../../components/ui';
import { profileById, venueById } from '../../data/mock';
import { isoDay, MONTHS_LONG, parse, sameDay, TODAY } from '../../lib/format';
import { useAllEvents, useApp } from '../../store/useApp';
import { colors, fonts, radius, shadow } from '../../theme';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1, 12);
  const offset = (first.getDay() + 6) % 7; // Monday first
  const start = new Date(year, month, 1 - offset, 12);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12));
}

export default function CalendarTab() {
  const user = useApp((s) => s.user);
  const going = useApp((s) => s.going);
  const tickets = useApp((s) => s.tickets);
  const bookings = useApp((s) => s.bookings);
  const events = useAllEvents();
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [cursor, setCursor] = useState(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1, 12));
  const [selected, setSelected] = useState(TODAY);
  const [overview, setOverview] = useState(false);

  const myEventIds = useMemo(
    () => new Set([...Object.keys(going), ...tickets.filter((t) => t.status === 'valid').map((t) => t.eventId), ...events.filter((e) => e.organizerId === 'me').map((e) => e.id)]),
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
  const bookingDays = useMemo(() => new Set(bookings.filter((b) => ['accepted', 'paid', 'confirmed', 'pending'].includes(b.status)).map((b) => b.date)), [bookings]);

  const grid = monthGrid(cursor.getFullYear(), cursor.getMonth());
  const weekStart = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate() - ((selected.getDay() + 6) % 7), 12);
  const days = view === 'month' ? grid : view === 'week' ? Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i, 12)) : [];
  const dayEvents = byDay.get(isoDay(selected)) ?? [];
  const dayBookings = bookings.filter((b) => b.date === isoDay(selected));

  const mine = events.filter((e) => myEventIds.has(e.id)).sort((a, b) => a.start.localeCompare(b.start));
  const groups = mine.reduce<Record<string, typeof mine>>((acc, e) => {
    const k = MONTHS_LONG[parse(e.start).getMonth()];
    (acc[k] ??= []).push(e);
    return acc;
  }, {});

  const shift = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1, 12));

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
        <Row justify="space-between">
          {overview ? <IconButton name="chevron-left" label="Back to calendar" iconSize={30} onPress={() => setOverview(false)} /> : <View />}
          <Pressable accessibilityRole="button" accessibilityLabel="Your profile" onPress={() => router.push('/profile/me')}>
            <Avatar src={user.avatar} size={48} label={user.name} />
          </Pressable>
        </Row>

        {overview ? (
          <>
            <T v="h1">Your event overview</T>
            {Object.keys(groups).length === 0 ? <T v="body" color={colors.muted}>Tap “Going” or buy a ticket and your events show up here.</T> : null}
            {Object.entries(groups).map(([month, list]) => (
              <View key={month} style={{ gap: 2 }}>
                <T v="h2" style={{ marginVertical: 8 }}>{month}</T>
                {list.map((e) => (
                  <Pressable key={e.id} accessibilityRole="button" onPress={() => router.push(`/event/${e.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <DateBadge iso={e.start} size={64} />
                    <View style={{ flex: 1 }}>
                      <T v="title">{e.title}</T>
                      <T v="small">{venueById(e.venueId)?.name}</T>
                    </View>
                    <Icon name="chevron-right" size={22} color={colors.subtle} />
                  </Pressable>
                ))}
              </View>
            ))}
            {bookings.filter((b) => ['accepted', 'paid', 'confirmed', 'pending'].includes(b.status)).length ? <T v="h2" style={{ marginTop: 8 }}>Bookings</T> : null}
            {bookings.filter((b) => ['accepted', 'paid', 'confirmed', 'pending'].includes(b.status)).map((b) => (
              <Pressable key={b.id} accessibilityRole="button" onPress={() => router.push(`/booking/${b.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <DateBadge iso={b.date} size={64} />
                <View style={{ flex: 1 }}>
                  <T v="title">{b.eventTitle}</T>
                  <T v="small">{b.type === 'musician' ? profileById(b.targetId)?.name : venueById(b.targetId)?.name} · {b.status}</T>
                </View>
                <Icon name="chevron-right" size={22} color={colors.subtle} />
              </Pressable>
            ))}
          </>
        ) : (
          <>
            <Row justify="space-between">
              <T v="h1" style={{ fontFamily: fonts.displayMedium }}>{selected.getDate()} {MONTHS_LONG[selected.getMonth()]} {selected.getFullYear()}</T>
            </Row>
            <Segmented options={[{ key: 'month', label: 'Month' }, { key: 'week', label: 'Week' }, { key: 'day', label: 'Day' }]} value={view} onChange={setView} />
            {view === 'month' ? (
              <Row justify="space-between">
                <IconButton name="chevron-left" label="Previous month" onPress={() => shift(-1)} />
                <T v="title">{MONTHS_LONG[cursor.getMonth()]} {cursor.getFullYear()}</T>
                <IconButton name="chevron-right" label="Next month" onPress={() => shift(1)} />
              </Row>
            ) : null}
            {view !== 'day' ? (
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 8, ...shadow(1) }}>
                <Row gap={0}>
                  {WEEKDAYS.map((d, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, paddingVertical: 8 }}>{d}</Text>)}
                </Row>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {days.map((d) => {
                    const k = isoDay(d);
                    const inMonth = view === 'week' || d.getMonth() === cursor.getMonth();
                    const has = byDay.get(k)?.length;
                    const isMine = (byDay.get(k) ?? []).some((e) => myEventIds.has(e.id)) || bookingDays.has(k);
                    const sel = sameDay(d, selected);
                    const today = sameDay(d, TODAY);
                    return (
                      <Pressable
                        key={k}
                        accessibilityRole="button"
                        accessibilityLabel={`${d.getDate()} ${MONTHS_LONG[d.getMonth()]}${has ? `, ${has} events` : ''}`}
                        accessibilityState={{ selected: sel }}
                        onPress={() => setSelected(d)}
                        style={{ width: `${100 / 7}%`, height: 56, alignItems: 'center', justifyContent: 'center', gap: 3 }}
                      >
                        <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? colors.brand : today ? colors.brandSoft : 'transparent' }}>
                          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: sel ? colors.white : inMonth ? colors.ink : colors.disabled }}>{d.getDate()}</Text>
                        </View>
                        <View style={{ height: 6, flexDirection: 'row', gap: 3 }}>
                          {has ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isMine ? colors.gold : colors.brandDeep }} /> : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
            <Row gap={14}>
              <Row gap={6}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold }} /><T v="small">Your plans</T></Row>
              <Row gap={6}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandDeep }} /><T v="small">Events in Berlin</T></Row>
            </Row>
            <Button title="Overview" size="md" style={{ alignSelf: 'center', paddingHorizontal: 40 }} onPress={() => setOverview(true)} />

            <T v="h3">{dayEvents.length + dayBookings.length ? `On ${selected.getDate()} ${MONTHS_LONG[selected.getMonth()]}` : 'Nothing planned this day'}</T>
            {dayBookings.map((b) => (
              <Pressable key={b.id} accessibilityRole="button" onPress={() => router.push(`/booking/${b.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.brandTint, padding: 14, borderRadius: radius.lg }}>
                <Icon name="calendar-clock" size={24} color={colors.brand} />
                <View style={{ flex: 1 }}>
                  <T v="title">{b.eventTitle}</T>
                  <T v="small">{b.startTime}–{b.endTime} · booking {b.status}</T>
                </View>
              </Pressable>
            ))}
            {dayEvents.map((e) => <EventRow key={e.id} event={e} />)}
            {dayEvents.length + dayBookings.length === 0 ? <Button title="Find events" variant="secondary" size="md" onPress={() => router.push('/events/all')} /> : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
