import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EventCard } from '../components/cards';
import { BottomBar, goBack, Screen, ScreenHeader } from '../components/layout';
import { Avatar, Banner, Button, Chip, Field, Icon, IconButton, Photo, Row, Segmented, Stepper, T, Toggle } from '../components/ui';
import type { ImgKey } from '../data/images';
import { profiles, venues } from '../data/mock';
import type { EventCategory, TicketType } from '../data/types';
import { isoDay, parse, shortDate, time, TODAY } from '../lib/format';
import { toast } from '../store/toast';
import { useAllEvents, useApp } from '../store/useApp';
import { colors, radius } from '../theme';

const COVERS: ImgKey[] = ['ev_lasers', 'ev_concert_blue', 'ev_party', 'feed_openair', 'ev_pool_party', 'ev_red_crowd', 'cat_acoustic', 'ev_purple_arena'];
/** Your media library, opened from the upload tile. */
const LIBRARY: ImgKey[] = ['ev_lights', 'ev_lasers2', 'ev_club_dark', 'ev_festival', 'ev_live_stage', 'ev_stage_gold', 'ev_dancing', 'ev_hands', 'ev_silhouette', 'feed_club', 'feed_crowd', 'feed_rooftop', 'feed_decks', 'feed_friends', 'band_stage', 'ven_garden'];
const START_TIMES = ['14:00', '18:00', '20:00', '22:00', '23:00'];
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_PRICE = 500;
const CATEGORIES: EventCategory[] = ['Concerts', 'Parties', 'Electronic', 'Acoustic', 'Family', 'Festivals', 'Listening'];
const STEPS = ['Details', 'Location', 'Tickets', 'Preview'];

export default function CreateEvent() {
  const { private: priv } = useLocalSearchParams<{ private?: string }>();
  const isPrivate = priv === '1';
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const addEvent = useApp((s) => s.addEvent);
  const createBooking = useApp((s) => s.createBooking);
  const bookings = useApp((s) => s.bookings);
  const user = useApp((s) => s.user);
  const allEvents = useAllEvents();
  const dates = useMemo(() => Array.from({ length: 60 }, (_, i) => new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + 2 + i, 12)), []);

  const [step, setStep] = useState(0);
  const [cover, setCover] = useState<ImgKey>(isPrivate ? 'ev_pool_party' : 'ev_lasers');
  const [title, setTitle] = useState(isPrivate ? `${user.name.split(' ')[0]}’s Birthday Party` : '');
  const [category, setCategory] = useState<EventCategory>(isPrivate ? 'Parties' : 'Electronic');
  const [genre, setGenre] = useState('Techno');
  const [date, setDate] = useState(dates[14]);
  const [startTime, setStartTime] = useState('22:00');
  const [customTime, setCustomTime] = useState('');
  const [hours, setHours] = useState(6);
  const [oneTime, setOneTime] = useState(true);
  const [weeks, setWeeks] = useState(4);
  const [library, setLibrary] = useState(false);
  const [uploaded, setUploaded] = useState<ImgKey[]>([]);
  const [lineup, setLineup] = useState<string[]>(isPrivate ? [] : ['adam']);
  const [venueId, setVenueId] = useState(isPrivate ? 'arcada' : 'moonclub');
  const [description, setDescription] = useState('');
  const [paid, setPaid] = useState(!isPrivate);
  const [tickets, setTickets] = useState<TicketType[]>([
    { id: 'ga', name: 'General admission', description: 'Entry', price: 25, capacity: 200, sold: 0 },
    { id: 'vip', name: 'VIP', description: 'Fast lane', price: 45, capacity: 30, sold: 0 },
  ]);
  const [refund, setRefund] = useState('Refunds up to 48 h before doors');
  const [adults, setAdults] = useState(!isPrivate);
  const [error, setError] = useState<string>();

  const artists = profiles.filter((p) => ['dj', 'musician', 'band'].includes(p.kind));
  const venue = venues.find((v) => v.id === venueId)!;
  const [h, m] = startTime.split(':').map(Number);
  const startIso = `${isoDay(date)}T${startTime}:00`;
  const endDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h + hours, m);
  const endIso = `${isoDay(endDate)}T${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}:00`;
  const finalTickets = paid ? tickets : [{ id: 'free', name: isPrivate ? 'Guest' : 'Free entry', description: 'Register to get your QR', price: 0, capacity: tickets[0]?.capacity ?? 100, sold: 0 }];
  const totalCapacity = finalTickets.reduce((n, t) => n + t.capacity, 0);
  const startDate = parse(startIso);
  const occurrences = oneTime ? 1 : weeks;
  /** The same time slot moved by whole weeks (a weekly series repeats on this weekday). */
  const shiftWeeks = (iso: string, w: number) => {
    const d = parse(iso);
    const moved = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * w, d.getHours(), d.getMinutes());
    return `${isoDay(moved)}T${String(moved.getHours()).padStart(2, '0')}:${String(moved.getMinutes()).padStart(2, '0')}:00`;
  };
  // Another event at the same venue whose time overlaps any of the dates you're publishing.
  const clash = Array.from({ length: occurrences }, (_, w) => ({ s: parse(shiftWeeks(startIso, w)), e: parse(shiftWeeks(endIso, w)) }))
    .map(({ s, e }) => allEvents.find((x) => x.venueId === venueId && parse(x.start) < e && parse(x.end) > s))
    .find(Boolean);

  // Android back steps through the form like the header arrow does, instead of discarding it.
  useEffect(() => {
    if (step === 0) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setError(undefined);
      setStep((n) => Math.max(0, n - 1));
      return true;
    });
    return () => sub.remove();
  }, [step]);

  const draft = {
    title: title.trim() || 'Untitled event',
    cover,
    category,
    genre,
    venueId,
    lineup,
    start: startIso,
    end: endIso,
    ticketTypes: finalTickets,
    description: description.trim() || (isPrivate ? `Private party at ${venue.name}, ${venue.area}.` : `${genre} night at ${venue.name}, ${venue.area}.`),
    mapPos: venue.mapPos,
    ageLimit: adults ? 18 : undefined,
    refundPolicy: paid ? refund : 'Free event',
    isPrivate,
  };

  const validate = (s: number): string | undefined => {
    if (s === 0) {
      if (title.trim().length < 3) return 'Give your event a name (3+ characters)';
      if (customTime && !TIME_RE.test(customTime)) return 'Enter the start time as HH:MM, e.g. 21:30';
      if (startDate.getTime() <= TODAY.getTime()) return 'Pick a start date in the future';
      if (hours < 1 || hours > 24) return 'Events can last between 1 and 24 hours';
    }
    if (s === 1 && clash) return `${venue.name} already hosts “${clash.title}” on ${shortDate(clash.start)} (${time(clash.start)}–${time(clash.end)}). Pick another venue, date or time.`;
    if (s === 2) {
      if (paid && tickets.some((t) => !t.name.trim() || t.capacity <= 0)) return 'Every ticket type needs a name and quantity';
      if (paid && tickets.some((t) => t.price > MAX_PRICE)) return `Ticket prices can be at most €${MAX_PRICE}`;
      if (paid && tickets.every((t) => t.price === 0)) return 'Paid events need at least one ticket with a price, or switch to free entry';
      if (paid && new Set(tickets.map((t) => t.name.trim().toLowerCase())).size !== tickets.length) return 'Give each ticket type a different name';
      if (totalCapacity <= 0) return isPrivate ? 'Set how many guests can come' : 'Set how many tickets are available';
      if (totalCapacity > venue.capacity) return `${venue.name} fits ${venue.capacity} people, but you have ${totalCapacity} tickets`;
    }
    return undefined;
  };

  const publish = () => {
    let firstId = '';
    for (let w = 0; w < occurrences; w++) {
      const id = addEvent({ ...draft, start: shiftWeeks(startIso, w), end: shiftWeeks(endIso, w), subtitle: occurrences > 1 ? `Week ${w + 1} of ${occurrences}` : undefined });
      if (!firstId) firstId = id;
    }
    // Tagged artists get a real booking request for the first date, unless one is already open for that day.
    const day = isoDay(date);
    const toRequest = isPrivate
      ? []
      : lineup.filter((aid) => !bookings.some((b) => b.targetId === aid && b.date === day && !['declined', 'cancelled', 'expired', 'completed'].includes(b.status)));
    toRequest.forEach((aid) => {
      const a = profiles.find((p) => p.id === aid);
      if (!a) return;
      createBooking({
        type: 'musician',
        targetId: aid,
        eventTitle: draft.title,
        date: day,
        startTime,
        endTime: endIso.slice(11, 16),
        hours,
        location: `${venue.name}, ${venue.area}`,
        guests: totalCapacity,
        equipment: venue.equipment,
        extras: 'None',
        note: 'Tagged in the line up.',
        amount: (a.feePerHour ?? 0) * hours,
      });
    });
    const parts = [occurrences > 1 ? `${occurrences} weekly dates published` : 'Event published', toRequest.length ? `${toRequest.length} booking request${toRequest.length > 1 ? 's' : ''} sent` : ''].filter(Boolean);
    toast(parts.join(' · '));
    router.replace({ pathname: '/event-created', params: { id: firstId } });
  };

  const next = () => {
    if (step === 3) {
      // Re-check every step before publishing: earlier answers may have changed via "Edit details".
      const bad = [0, 1, 2].find((s) => validate(s));
      if (bad !== undefined) {
        setError(validate(bad));
        setStep(bad);
        return;
      }
      setError(undefined);
      publish();
      return;
    }
    const e = validate(step);
    setError(e);
    if (!e) setStep(step + 1);
  };

  const pickTime = (t: string) => {
    setStartTime(t);
    setCustomTime('');
    setError(undefined);
  };
  const onCustomTime = (raw: string) => {
    const digits = raw.replace(/[^\d]/g, '').slice(0, 4);
    const v = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
    setCustomTime(v);
    if (TIME_RE.test(v)) {
      setStartTime(v);
      setError(undefined);
    }
  };
  const chooseFromLibrary = (k: ImgKey) => {
    setCover(k);
    setUploaded((u) => (u.includes(k) || COVERS.includes(k) ? u : [k, ...u]));
    setLibrary(false);
    toast('Cover updated');
  };

  const updateTicket = (i: number, p: Partial<TicketType>) => setTickets((ts) => ts.map((t, j) => (j === i ? { ...t, ...p } : t)));

  return (
    <Screen
      keyboard
      header={<ScreenHeader title={isPrivate ? 'Private event' : 'Add event'} subtitle={`Step ${step + 1} of ${STEPS.length} · ${STEPS[step]}`} onBack={() => { setError(undefined); if (step) setStep(step - 1); else goBack('/(tabs)'); }} />}
      footer={
        <BottomBar>
          {error ? <T v="small" color={colors.danger} style={{ marginBottom: 8 }}>{error}</T> : null}
          <Button title={step === 3 ? (oneTime ? 'Publish' : `Publish ${weeks} dates`) : 'Next'} onPress={next} />
        </BottomBar>
      }
    >
      <Row gap={6}>
        {STEPS.map((s, i) => (
          <Pressable
            key={s}
            accessibilityRole="button"
            accessibilityLabel={`Step ${i + 1}: ${s}`}
            accessibilityState={{ selected: i === step, disabled: i > step }}
            disabled={i > step}
            onPress={() => { setError(undefined); setStep(i); }}
            style={{ flex: 1, gap: 6, minHeight: 44, justifyContent: 'center' }}
          >
            <View style={{ height: 5, borderRadius: 3, backgroundColor: i <= step ? colors.brand : colors.track }} />
            <T v="smallBold" style={{ fontSize: 11 }} color={i <= step ? colors.brand : colors.subtle}>{s}</T>
          </Pressable>
        ))}
      </Row>

      {step === 0 ? (
        <>
          <View style={{ height: 190, borderRadius: radius.xl, overflow: 'hidden' }}>
            <Photo src={cover} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <Pressable accessibilityRole="button" accessibilityLabel="Change cover from your library" onPress={() => setLibrary(true)} style={{ position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.92)' }}>
              <Icon name="image-edit-outline" size={18} color={colors.brandDeep} />
              <T v="smallBold" color={colors.brandDeep}>Change cover</T>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Upload cover from your library" onPress={() => setLibrary(true)} style={{ width: 72, height: 72, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <Icon name="camera-outline" size={26} color={colors.brand} />
              <T v="smallBold" color={colors.brand} style={{ fontSize: 11 }}>Upload</T>
            </Pressable>
            {[...uploaded, ...COVERS].map((c, i) => (
              <Pressable key={c} accessibilityRole="button" accessibilityLabel={`Cover ${i + 1}`} accessibilityState={{ selected: cover === c }} onPress={() => setCover(c)}>
                <Photo src={c} style={{ width: 72, height: 72, borderRadius: 14, borderWidth: cover === c ? 3 : 0, borderColor: colors.brand }} />
              </Pressable>
            ))}
          </ScrollView>
          <Field label="Event name" value={title} onChangeText={(t) => { setTitle(t); if (error) setError(undefined); }} placeholder="e.g. Bunker Floor Vol. 8" maxLength={60} />
          <View style={{ gap: 8 }}>
            <T v="label">Event category</T>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>{CATEGORIES.map((c) => <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />)}</Row>
          </View>
          <View style={{ gap: 8 }}>
            <T v="label">Music style</T>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>{['Techno', 'House', 'Hip Hop', 'Pop', 'Indie', 'Jazz', 'Acoustic'].map((g) => <Chip key={g} label={g} selected={genre === g} onPress={() => setGenre(g)} />)}</Row>
          </View>
          <View style={{ gap: 8 }}>
            <T v="label">Start date</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {dates.map((d) => {
                const on = isoDay(d) === isoDay(date);
                return (
                  <Pressable key={isoDay(d)} accessibilityRole="button" accessibilityLabel={shortDate(isoDay(d))} accessibilityState={{ selected: on }} onPress={() => setDate(d)} style={{ width: 58, height: 70, borderRadius: 14, borderWidth: 1, borderColor: on ? colors.brand : colors.borderStrong, backgroundColor: on ? colors.brand : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                    <T v="small" color={on ? colors.lilacLight : colors.muted} style={{ fontSize: 12 }}>{shortDate(isoDay(d)).split(' ')[0]}</T>
                    <T v="h3" color={on ? colors.white : colors.ink}>{d.getDate()}</T>
                    <T v="small" color={on ? colors.lilacLight : colors.muted} style={{ fontSize: 11 }}>{shortDate(isoDay(d)).split(' ')[2]}</T>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          <View style={{ gap: 8 }}>
            <T v="label">Start time</T>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>{START_TIMES.map((t) => <Chip key={t} label={t} selected={startTime === t && !customTime} onPress={() => pickTime(t)} />)}</Row>
            <Field
              placeholder="Other time, e.g. 21:30"
              value={customTime}
              onChangeText={onCustomTime}
              keyboardType="number-pad"
              accessibilityLabel="Custom start time"
              icon="clock-outline"
              error={customTime && !TIME_RE.test(customTime) && customTime.length >= 5 ? 'Use a 24-hour time between 00:00 and 23:59' : undefined}
            />
          </View>
          <Row justify="space-between">
            <View style={{ flex: 1 }}><T v="label">Duration</T><T v="small">Ends {shortDate(endIso)} {endIso.slice(11, 16)}</T></View>
            <Stepper value={hours} onChange={setHours} min={1} max={24} label="duration in hours" format={(n) => `${n} h`} />
          </Row>
          <Row gap={12}>
            <View style={{ flex: 1 }}><T v="bodyBold">One-time event</T><T v="small">{oneTime ? 'Turn off for a weekly series' : `Repeats every ${shortDate(startIso).split(' ')[0]} for ${weeks} weeks`}</T></View>
            <Toggle label="One-time event" value={oneTime} onValueChange={setOneTime} />
          </Row>
          {!oneTime ? (
            <Row justify="space-between">
              <View style={{ flex: 1 }}><T v="label">Number of weeks</T><T v="small">Last date {shortDate(isoDay(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7 * (weeks - 1), 12)))}</T></View>
              <Stepper value={weeks} onChange={setWeeks} min={2} max={12} label="weeks" />
            </Row>
          ) : null}
          {!isPrivate ? (
            <View style={{ gap: 8 }}>
              <T v="label">Line up — tag musicians</T>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {artists.map((a) => {
                  const on = lineup.includes(a.id);
                  return (
                    <Pressable key={a.id} accessibilityRole="button" accessibilityLabel={on ? `Remove ${a.name} from the line up` : `Tag ${a.name} in the line up`} accessibilityState={{ selected: on }} onPress={() => setLineup(on ? lineup.filter((x) => x !== a.id) : [...lineup, a.id])} style={{ alignItems: 'center', gap: 4, width: 64 }}>
                      <Avatar src={a.avatar} size={56} ring={on ? colors.brand : false} />
                      <T v="small" numberOfLines={1} color={on ? colors.brand : colors.ink} style={{ fontSize: 12 }}>{a.name}</T>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <T v="small">{lineup.length ? `${lineup.length} artist${lineup.length > 1 ? 's' : ''} tagged. Each gets a booking request for the first date when you publish.` : 'Tagged artists get a booking request automatically.'}</T>
            </View>
          ) : null}
        </>
      ) : null}

      {step === 1 ? (
        <>
          <T v="h3">Select on the map</T>
          <View style={{ height: width * 0.7, borderRadius: radius.xl, overflow: 'hidden' }}>
            <Photo src="map_berlin" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            {venues.map((v) => {
              const on = v.id === venueId;
              const side = width - 32;
              return (
                <Pressable key={v.id} accessibilityRole="button" accessibilityLabel={v.name} accessibilityState={{ selected: on }} hitSlop={on ? 6 : 12} onPress={() => setVenueId(v.id)} style={{ position: 'absolute', left: (v.mapPos.x / 100) * side - (on ? 18 : 12), top: (v.mapPos.y / 100) * (width * 0.7) - (on ? 18 : 12) }}>
                  <View style={{ width: on ? 36 : 24, height: on ? 36 : 24, borderRadius: 18, backgroundColor: on ? colors.brand : '#E5484D', borderWidth: 3, borderColor: colors.white }} />
                </Pressable>
              );
            })}
          </View>
          <View style={{ gap: 8 }}>
            {venues.map((v) => (
              <Pressable key={v.id} accessibilityRole="radio" accessibilityLabel={`${v.name}, ${v.area}, ${v.capacity} people`} accessibilityState={{ checked: v.id === venueId }} onPress={() => setVenueId(v.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, borderWidth: v.id === venueId ? 2 : 1, borderColor: v.id === venueId ? colors.brand : colors.border, backgroundColor: colors.surface }}>
                <Photo src={v.cover} style={{ width: 48, height: 48 }} radius={10} />
                <View style={{ flex: 1 }}>
                  <T v="bodyBold">{v.name}</T>
                  <T v="small">{v.area} · {v.capacity} people</T>
                </View>
                {v.id === venueId ? <Icon name="check" size={22} color={colors.brand} /> : null}
              </Pressable>
            ))}
          </View>
          {clash ? (
            <Banner icon="calendar-alert" tone="danger">{`${venue.name} already hosts “${clash.title}” on ${shortDate(clash.start)}, ${time(clash.start)}–${time(clash.end)}.`}</Banner>
          ) : (
            <Banner icon="information-outline">{`${venue.name} fits ${venue.capacity} people. Haven’t booked it yet? Send a booking request from the venue page.`}</Banner>
          )}
          <Button title={`Open ${venue.name}`} variant="ghost" size="sm" icon="storefront-outline" onPress={() => router.push(`/venue/${venue.id}`)} />
          <Field label="Description" value={description} onChangeText={setDescription} multiline placeholder="What should people expect?" />
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Segmented options={[{ key: 'free', label: isPrivate ? 'Free for guests' : 'Free entry' }, { key: 'paid', label: 'Paid tickets' }]} value={paid ? 'paid' : 'free'} onChange={(k) => setPaid(k === 'paid')} />
          {paid ? (
            tickets.map((t, i) => (
              <View key={t.id} style={{ gap: 10, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
                <Row justify="space-between">
                  <T v="caption">TICKET TYPE {i + 1}</T>
                  {tickets.length > 1 ? <IconButton name="trash-can-outline" label="Remove ticket type" size={36} iconSize={18} color={colors.danger} onPress={() => setTickets(tickets.filter((_, j) => j !== i))} /> : null}
                </Row>
                <Field label="Name" value={t.name} onChangeText={(v) => updateTicket(i, { name: v })} maxLength={40} />
                <Field label="What’s included" value={t.description} onChangeText={(v) => updateTicket(i, { description: v })} placeholder="e.g. Fast lane + welcome drink" maxLength={60} />
                <Row gap={10}>
                  <Field label="Price (€)" value={String(t.price)} onChangeText={(v) => updateTicket(i, { price: Math.min(9999, Number(v.replace(/\D/g, '')) || 0) })} keyboardType="number-pad" style={{ flex: 1 }} error={t.price > MAX_PRICE ? `Max €${MAX_PRICE}` : undefined} />
                  <Field label="Quantity" value={String(t.capacity)} onChangeText={(v) => updateTicket(i, { capacity: Math.min(99999, Number(v.replace(/\D/g, '')) || 0) })} keyboardType="number-pad" style={{ flex: 1 }} error={t.capacity <= 0 ? 'Required' : undefined} />
                </Row>
              </View>
            ))
          ) : (
            <Field label="Guest limit" value={String(tickets[0]?.capacity ?? 100)} onChangeText={(v) => updateTicket(0, { capacity: Math.min(99999, Number(v.replace(/\D/g, '')) || 0) })} keyboardType="number-pad" />
          )}
          <T v="small" color={totalCapacity > venue.capacity ? colors.danger : colors.muted}>{totalCapacity} of {venue.capacity} places at {venue.name}</T>
          {paid && tickets.length < 5 ? (
            <Button
              title="Add ticket type"
              icon="plus"
              variant="secondary"
              onPress={() => {
                const name = tickets.some((t) => t.name === 'Late entry') ? `Ticket type ${tickets.length + 1}` : 'Late entry';
                setTickets([...tickets, { id: `t${Date.now()}`, name, description: name === 'Late entry' ? 'After 03:00' : 'Entry', price: 15, capacity: 50, sold: 0 }]);
              }}
            />
          ) : null}
          {paid ? (
            <View style={{ gap: 8 }}>
              <T v="label">Price & refund policy</T>
              <Row gap={8} style={{ flexWrap: 'wrap' }}>
                {['Refunds up to 48 h before doors', 'Refunds up to 7 days before', 'No refunds'].map((r) => <Chip key={r} label={r} selected={refund === r} onPress={() => setRefund(r)} />)}
              </Row>
            </View>
          ) : null}
          <Row gap={12}>
            <View style={{ flex: 1 }}><T v="bodyBold">18+ only</T><T v="small">ID is checked at the door</T></View>
            <Toggle label="18+ only" value={adults} onValueChange={setAdults} />
          </Row>
          {paid ? <Banner icon="cash-multiple">Domtak keeps 5% per ticket sold. Payouts arrive 2 days after the event.</Banner> : null}
        </>
      ) : null}

      {step === 3 ? (
        <>
          <T v="small">This is how people will see your event in the feed and on the map.</T>
          {/* A picture of the card only: the event doesn't exist yet, so its buttons must not navigate or save. */}
          <View style={{ pointerEvents: 'none' }} accessible accessibilityLabel={`Preview of ${draft.title}`}>
            <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <EventCard event={{ ...draft, id: 'preview', organizerId: 'me', going: 0, rating: 0, distanceKm: 0.5 }} />
            </View>
          </View>
          <View style={{ gap: 6, backgroundColor: colors.surface, padding: 16, borderRadius: radius.lg }}>
            <Row justify="space-between"><T v="body" color={colors.muted}>Visibility</T><T v="bodyBold">{isPrivate ? 'Private · invite only' : 'Public · feed & map'}</T></Row>
            <Row justify="space-between"><T v="body" color={colors.muted}>When</T><T v="bodyBold">{shortDate(startIso)}, {startTime}–{endIso.slice(11, 16)}</T></Row>
            {!oneTime ? <Row justify="space-between"><T v="body" color={colors.muted}>Series</T><T v="bodyBold">Weekly · {weeks} dates</T></Row> : null}
            <Row justify="space-between"><T v="body" color={colors.muted}>Tickets</T><T v="bodyBold">{finalTickets.reduce((n, t) => n + t.capacity, 0)} across {finalTickets.length} type{finalTickets.length > 1 ? 's' : ''}</T></Row>
            <Row justify="space-between"><T v="body" color={colors.muted}>Venue</T><T v="bodyBold">{venue.name}</T></Row>
            <Row justify="space-between"><T v="body" color={colors.muted}>Line up</T><T v="bodyBold">{lineup.length ? `${lineup.length} artist${lineup.length > 1 ? 's' : ''} tagged` : '—'}</T></Row>
          </View>
          <Button title="Edit details" variant="ghost" size="sm" icon="pencil-outline" onPress={() => setStep(0)} />
        </>
      ) : null}

      <Modal visible={library} transparent animationType="slide" onRequestClose={() => setLibrary(false)}>
        <View style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close library" style={{ flex: 1 }} onPress={() => setLibrary(false)} />
          <View accessibilityViewIsModal style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: insets.bottom + 20, gap: 12, maxHeight: '80%' }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong }} />
            <Row justify="space-between">
              <T v="h3">Choose a cover</T>
              <IconButton name="close" label="Close library" size={40} onPress={() => setLibrary(false)} />
            </Row>
            <T v="small">Your Domtak media library. Landscape photos look best (16:9).</T>
            <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {LIBRARY.map((k, i) => (
                <Pressable key={k} accessibilityRole="button" accessibilityLabel={`Library photo ${i + 1}`} accessibilityState={{ selected: cover === k }} onPress={() => chooseFromLibrary(k)} style={{ width: '31.5%', aspectRatio: 1 }}>
                  <Photo src={k} style={{ flex: 1, borderRadius: 12, borderWidth: cover === k ? 3 : 0, borderColor: colors.brand }} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
