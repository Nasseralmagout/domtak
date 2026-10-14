import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { EventCard } from '../components/cards';
import { BottomBar, goBack, Screen, ScreenHeader } from '../components/layout';
import { Avatar, Banner, Button, Chip, Field, Icon, IconButton, Photo, Row, Segmented, T, Toggle } from '../components/ui';
import type { ImgKey } from '../data/images';
import { profiles, venues } from '../data/mock';
import type { EventCategory, TicketType } from '../data/types';
import { isoDay, shortDate, TODAY } from '../lib/format';
import { useApp } from '../store/useApp';
import { colors, radius } from '../theme';

const COVERS: ImgKey[] = ['ev_lasers', 'ev_concert_blue', 'ev_party', 'feed_openair', 'ev_pool_party', 'ev_red_crowd', 'cat_acoustic', 'ev_purple_arena'];
const CATEGORIES: EventCategory[] = ['Concerts', 'Parties', 'Electronic', 'Acoustic', 'Family', 'Festivals', 'Listening'];
const STEPS = ['Details', 'Location', 'Tickets', 'Preview'];

export default function CreateEvent() {
  const { private: priv } = useLocalSearchParams<{ private?: string }>();
  const isPrivate = priv === '1';
  const { width } = useWindowDimensions();
  const addEvent = useApp((s) => s.addEvent);
  const user = useApp((s) => s.user);
  const dates = useMemo(() => Array.from({ length: 60 }, (_, i) => new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + 2 + i, 12)), []);

  const [step, setStep] = useState(0);
  const [cover, setCover] = useState<ImgKey>(isPrivate ? 'ev_pool_party' : 'ev_lasers');
  const [title, setTitle] = useState(isPrivate ? `${user.name.split(' ')[0]}'s Birthday Party` : '');
  const [category, setCategory] = useState<EventCategory>(isPrivate ? 'Parties' : 'Electronic');
  const [genre, setGenre] = useState('Techno');
  const [date, setDate] = useState(dates[14]);
  const [startTime, setStartTime] = useState('22:00');
  const [hours, setHours] = useState(6);
  const [oneTime, setOneTime] = useState(true);
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
    description: description.trim() || 'More details coming soon.',
    mapPos: venue.mapPos,
    ageLimit: adults ? 18 : undefined,
    refundPolicy: paid ? refund : 'Free event',
    isPrivate,
  };

  const next = () => {
    if (step === 0 && title.trim().length < 3) return setError('Give your event a name (3+ characters)');
    if (step === 2 && paid && tickets.some((t) => !t.name.trim() || t.capacity <= 0)) return setError('Every ticket type needs a name and quantity');
    setError(undefined);
    if (step < 3) setStep(step + 1);
    else {
      const id = addEvent(draft);
      router.replace({ pathname: '/event-created', params: { id } });
    }
  };

  const updateTicket = (i: number, p: Partial<TicketType>) => setTickets((ts) => ts.map((t, j) => (j === i ? { ...t, ...p } : t)));

  return (
    <Screen
      keyboard
      header={<ScreenHeader title={isPrivate ? 'Private event' : 'Add event'} onBack={() => (step ? setStep(step - 1) : goBack('/(tabs)'))} />}
      footer={
        <BottomBar>
          {error ? <T v="small" color={colors.danger} style={{ marginBottom: 8 }}>{error}</T> : null}
          <Button title={step === 3 ? 'Publish' : 'Next'} onPress={next} />
        </BottomBar>
      }
    >
      <Row gap={6}>
        {STEPS.map((s, i) => (
          <View key={s} style={{ flex: 1, gap: 6 }}>
            <View style={{ height: 5, borderRadius: 3, backgroundColor: i <= step ? colors.brand : colors.track }} />
            <T v="smallBold" style={{ fontSize: 11 }} color={i <= step ? colors.brand : colors.subtle}>{s}</T>
          </View>
        ))}
      </Row>

      {step === 0 ? (
        <>
          <View style={{ height: 190, borderRadius: radius.xl, overflow: 'hidden' }}>
            <Photo src={cover} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <View style={{ position: 'absolute', left: 16, right: 16, top: 30, bottom: 30, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.88)', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name="image-outline" size={26} color={colors.brandDeep} />
              <T v="bodyBold">Choose a cover below or upload</T>
              <T v="small" style={{ fontSize: 12 }}>PNG, GIF, WEBP, MP4 or MP3 · max 1 GB</T>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Upload cover" style={{ width: 72, height: 72, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="camera-outline" size={26} color={colors.brand} />
            </Pressable>
            {COVERS.map((c) => (
              <Pressable key={c} accessibilityRole="button" accessibilityState={{ selected: cover === c }} onPress={() => setCover(c)}>
                <Photo src={c} style={{ width: 72, height: 72, borderRadius: 14, borderWidth: cover === c ? 3 : 0, borderColor: colors.brand }} />
              </Pressable>
            ))}
          </ScrollView>
          <Field label="Event name" value={title} onChangeText={setTitle} placeholder="e.g. Bunker Floor Vol. 8" />
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
                  <Pressable key={isoDay(d)} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setDate(d)} style={{ width: 58, height: 70, borderRadius: 14, borderWidth: 1, borderColor: on ? colors.brand : colors.borderStrong, backgroundColor: on ? colors.brand : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
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
            <Row gap={8} style={{ flexWrap: 'wrap' }}>{['14:00', '18:00', '20:00', '22:00', '23:00'].map((t) => <Chip key={t} label={t} selected={startTime === t} onPress={() => setStartTime(t)} />)}</Row>
          </View>
          <Row justify="space-between">
            <View><T v="label">Duration</T><T v="small">Ends {shortDate(endIso)} {endIso.slice(11, 16)}</T></View>
            <Row gap={6}>
              <IconButton name="minus" label="Shorter" bg={colors.surface} size={44} onPress={() => setHours(Math.max(1, hours - 1))} />
              <T v="h3">{hours} h</T>
              <IconButton name="plus" label="Longer" bg={colors.brand} color={colors.white} size={44} onPress={() => setHours(Math.min(24, hours + 1))} />
            </Row>
          </Row>
          <Row gap={12}>
            <View style={{ flex: 1 }}><T v="bodyBold">One-time event</T><T v="small">Turn off for a weekly series</T></View>
            <Toggle label="One-time event" value={oneTime} onValueChange={setOneTime} />
          </Row>
          {!isPrivate ? (
            <View style={{ gap: 8 }}>
              <T v="label">Line up — tag musicians</T>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {artists.map((a) => {
                  const on = lineup.includes(a.id);
                  return (
                    <Pressable key={a.id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setLineup(on ? lineup.filter((x) => x !== a.id) : [...lineup, a.id])} style={{ alignItems: 'center', gap: 4, width: 64 }}>
                      <Avatar src={a.avatar} size={56} ring={on ? colors.brand : false} />
                      <T v="small" numberOfLines={1} color={on ? colors.brand : colors.ink} style={{ fontSize: 12 }}>{a.name}</T>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <T v="small">Tagged artists get a booking request automatically.</T>
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
                <Pressable key={v.id} accessibilityRole="button" accessibilityLabel={v.name} onPress={() => setVenueId(v.id)} style={{ position: 'absolute', left: (v.mapPos.x / 100) * side - (on ? 18 : 12), top: (v.mapPos.y / 100) * (width * 0.7) - (on ? 18 : 12) }}>
                  <View style={{ width: on ? 36 : 24, height: on ? 36 : 24, borderRadius: 18, backgroundColor: on ? colors.brand : '#E5484D', borderWidth: 3, borderColor: colors.white }} />
                </Pressable>
              );
            })}
          </View>
          <View style={{ gap: 8 }}>
            {venues.map((v) => (
              <Pressable key={v.id} accessibilityRole="radio" accessibilityState={{ checked: v.id === venueId }} onPress={() => setVenueId(v.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, borderWidth: v.id === venueId ? 2 : 1, borderColor: v.id === venueId ? colors.brand : colors.border, backgroundColor: colors.surface }}>
                <Photo src={v.cover} style={{ width: 48, height: 48 }} radius={10} />
                <View style={{ flex: 1 }}>
                  <T v="bodyBold">{v.name}</T>
                  <T v="small">{v.area} · {v.capacity} people</T>
                </View>
                {v.id === venueId ? <Icon name="check" size={22} color={colors.brand} /> : null}
              </Pressable>
            ))}
          </View>
          <Banner icon="information-outline">{`Not booked yet? Send ${venue.name} a booking request from its page — the event stays a draft for the venue until they accept.`}</Banner>
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
                <Field label="Name" value={t.name} onChangeText={(v) => updateTicket(i, { name: v })} />
                <Row gap={10}>
                  <Field label="Price (€)" value={String(t.price)} onChangeText={(v) => updateTicket(i, { price: Number(v.replace(/\D/g, '')) || 0 })} keyboardType="number-pad" style={{ flex: 1 }} />
                  <Field label="Quantity" value={String(t.capacity)} onChangeText={(v) => updateTicket(i, { capacity: Number(v.replace(/\D/g, '')) || 0 })} keyboardType="number-pad" style={{ flex: 1 }} />
                </Row>
              </View>
            ))
          ) : (
            <Field label="Guest limit" value={String(tickets[0]?.capacity ?? 100)} onChangeText={(v) => updateTicket(0, { capacity: Number(v.replace(/\D/g, '')) || 0 })} keyboardType="number-pad" />
          )}
          {paid ? <Button title="Add ticket type" icon="plus" variant="secondary" onPress={() => setTickets([...tickets, { id: `t${Date.now()}`, name: 'Late entry', description: 'After 03:00', price: 15, capacity: 100, sold: 0 }])} /> : null}
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
          <EventCard event={{ ...draft, id: 'preview', organizerId: 'me', going: 0, rating: 0, distanceKm: 0.5 }} />
          <View style={{ gap: 6, backgroundColor: colors.surface, padding: 16, borderRadius: radius.lg }}>
            <Row justify="space-between"><T v="body" color={colors.muted}>Visibility</T><T v="bodyBold">{isPrivate ? 'Private · invite only' : 'Public · feed & map'}</T></Row>
            <Row justify="space-between"><T v="body" color={colors.muted}>Tickets</T><T v="bodyBold">{finalTickets.reduce((n, t) => n + t.capacity, 0)} across {finalTickets.length} type{finalTickets.length > 1 ? 's' : ''}</T></Row>
            <Row justify="space-between"><T v="body" color={colors.muted}>Venue</T><T v="bodyBold">{venue.name}</T></Row>
            <Row justify="space-between"><T v="body" color={colors.muted}>Line up</T><T v="bodyBold">{lineup.length ? `${lineup.length} artist${lineup.length > 1 ? 's' : ''} tagged` : '—'}</T></Row>
          </View>
        </>
      ) : null}
    </Screen>
  );
}
