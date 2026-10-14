import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { BottomBar, goBack, Screen, ScreenHeader } from '../../components/layout';
import { Avatar, Banner, Button, Card, Chip, Divider, Field, KeyValue, Photo, Row, Stepper, T, Toggle } from '../../components/ui';
import { OCCASIONS, profileById, venueById } from '../../data/mock';
import { euro, isoDay, shortDate, TODAY } from '../../lib/format';
import { useApp } from '../../store/useApp';
import { colors, fonts } from '../../theme';

const STARTS = ['16:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'];

function addHours(t: string, h: number) {
  const [hh, mm] = t.split(':').map(Number);
  return `${String((hh + h) % 24).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export default function NewBooking() {
  const { type = 'musician', id } = useLocalSearchParams<{ type: 'musician' | 'venue'; id: string }>();
  const artist = type === 'musician' ? profileById(id ?? '') : undefined;
  const venue = type === 'venue' ? venueById(id ?? '') : undefined;
  const user = useApp((s) => s.user);
  const bookings = useApp((s) => s.bookings);
  const createBooking = useApp((s) => s.createBooking);

  const dates = useMemo(() => Array.from({ length: 45 }, (_, i) => new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + 3 + i, 12)), []);
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [title, setTitle] = useState('');
  // Venues only list the occasions they host, so start on one of those.
  const [occasion, setOccasion] = useState(venue && !venue.occasions.slice(0, 6).includes('Birthday') ? (venue.occasions[0] ?? 'Other') : 'Birthday');
  const [date, setDate] = useState(dates[10]);
  const [start, setStart] = useState('20:00');
  const [hours, setHours] = useState(type === 'venue' ? 6 : 4);
  const [location, setLocation] = useState(venue ? `${venue.name}, ${venue.area}` : '');
  const [guests, setGuests] = useState('80');
  const [ownGear, setOwnGear] = useState(true);
  const [extras, setExtras] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!artist && !venue) {
    return (
      <Screen header={<ScreenHeader title="Booking" onBack={() => goBack('/(tabs)/artists')} />}>
        <T v="body">Choose a musician or venue first.</T>
        <Button title="Browse artists" onPress={() => router.replace('/artists/all')} />
        <Button title="Browse venues" variant="secondary" onPress={() => router.replace('/venues')} />
      </Screen>
    );
  }
  const name = artist?.name ?? venue!.name;
  const image = artist?.avatar ?? venue!.cover;
  const amount = artist ? (artist.feePerHour ?? 0) * hours : venue!.pricePerNight;
  const end = addHours(start, hours);
  const equipment = artist ? (ownGear ? 'Provided by venue / host' : 'Artist brings own gear') : venue!.equipment;

  const targetId = (artist?.id ?? venue?.id)!;
  // You can only hold one open request per provider and date.
  const clash = bookings.find((b) => b.targetId === targetId && b.date === isoDay(date) && !['declined', 'cancelled', 'expired', 'completed'].includes(b.status));

  const toReview = () => {
    const e: Record<string, string> = {};
    if (title.trim().length < 3) e.title = 'Give your event a name';
    if (artist && location.trim().length < 3) e.location = 'Where is the event?';
    if (!Number(guests)) e.guests = 'Roughly how many guests?';
    else if (venue && Number(guests) > venue.capacity) e.guests = `${venue.name} fits up to ${venue.capacity} people`;
    if (clash) e.date = `You already have a request with ${name} on ${shortDate(isoDay(date))}`;
    setErrors(e);
    if (!Object.keys(e).length) setStep('review');
  };

  const send = () => {
    const bid = createBooking({
      type: type === 'venue' ? 'venue' : 'musician',
      targetId,
      eventTitle: title.trim(),
      date: isoDay(date),
      startTime: start,
      endTime: end,
      hours,
      location: location.trim() || `${venue?.name}, ${venue?.area}`,
      guests: Number(guests),
      equipment,
      extras: extras.trim() || 'None',
      note: [occasion !== 'Other' ? `Occasion: ${occasion}.` : '', note.trim()].filter(Boolean).join(' '),
      amount,
    });
    router.replace({ pathname: '/success', params: { kind: 'request', id: bid } });
  };

  if (step === 'review') {
    return (
      <Screen
        header={<ScreenHeader title="Review summary" onBack={() => setStep('form')} />}
        footer={
          <BottomBar>
            <Button title="Send request" onPress={send} />
            <T v="small" center style={{ marginTop: 8 }}>You won’t be charged until {name} accepts.</T>
          </BottomBar>
        }
      >
        <Card padded={false} style={{ flexDirection: 'row', overflow: 'hidden' }}>
          <Photo src={image} style={{ width: 120, height: 120 }} />
          <View style={{ flex: 1, padding: 12, gap: 4, justifyContent: 'center' }}>
            <T v="h3">{name}</T>
            <T v="small">{artist?.title ?? `${venue!.type} · ${venue!.capacity} people`}</T>
            <T v="bodyBold">{shortDate(isoDay(date))} · {start}–{end}</T>
            <T v="small" numberOfLines={1}>{location || venue?.name}</T>
          </View>
        </Card>
        <Card style={{ gap: 6 }}>
          <KeyValue k="Event" v={title} />
          <KeyValue k="Occasion" v={occasion} />
          <KeyValue k="Guests" v={guests} />
          <KeyValue k={artist ? 'Equipment' : 'Setup'} v={equipment} />
          <KeyValue k="Extra services" v={extras || 'None'} />
        </Card>
        <Card style={{ gap: 6 }}>
          <KeyValue k="Full name" v={user.name} />
          <KeyValue k="Phone" v={user.phone} />
          <KeyValue k="Email" v={user.email} />
        </Card>
        <Card style={{ gap: 6 }}>
          <KeyValue k={artist ? `${hours} hours × ${euro(artist.feePerHour ?? 0)}` : '1 night'} v={euro(amount, true)} />
          <KeyValue k="incl. VAT (19%)" v={euro(amount - amount / 1.19, true)} />
          <Divider style={{ marginVertical: 6 }} />
          <KeyValue k="Total" v={euro(amount, true)} strong />
        </Card>
        <Banner icon="shield-check-outline">After acceptance you pay into Domtak escrow. Money is released to {name} only after the event — full refund if they cancel.</Banner>
      </Screen>
    );
  }

  return (
    <Screen
      keyboard
      header={<ScreenHeader title={`Book ${name}`} onBack={() => goBack(artist ? `/artist/${artist.id}` : `/venue/${venue?.id}`)} />}
      footer={
        <BottomBar>
          {Object.keys(errors).length ? (
            <T v="small" color={colors.danger} style={{ marginBottom: 8 }}>{Object.values(errors)[0]}</T>
          ) : null}
          <Row gap={14}>
            <View>
              <T v="small">Estimated</T>
              <T v="h3">{euro(amount)}</T>
            </View>
            <Button title="Review request" style={{ flex: 1 }} onPress={toReview} />
          </Row>
        </BottomBar>
      }
    >
      <View style={{ alignItems: 'center', gap: 8 }}>
        {artist ? <Avatar src={image} size={110} verified={artist.verified} /> : <Photo src={image} style={{ width: 200, height: 130 }} radius={18} />}
        <T v="h3">{name}</T>
        <T v="small">{artist ? `${artist.title} · ${euro(artist.feePerHour ?? 0)}/h` : `${euro(venue!.pricePerNight)}/night · up to ${venue!.capacity} people`}</T>
      </View>
      <T v="h3">Your event</T>
      <Field label="Event title" value={title} onChangeText={setTitle} placeholder="e.g. Shakira birthday" error={errors.title} />
      <View style={{ gap: 8 }}>
        <T v="label">Occasion</T>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {(venue ? venue.occasions.slice(0, 6) : OCCASIONS).map((o) => <Chip key={o} label={o} selected={occasion === o} onPress={() => setOccasion(o)} />)}
        </Row>
      </View>
      <View style={{ gap: 8 }}>
        <T v="label">Date</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {dates.map((d) => {
            const on = isoDay(d) === isoDay(date);
            return (
              <Pressable key={isoDay(d)} accessibilityRole="button" accessibilityLabel={shortDate(isoDay(d))} accessibilityState={{ selected: on }} onPress={() => { setDate(d); setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'date'))); }} style={{ width: 62, height: 74, borderRadius: 14, borderWidth: 1, borderColor: on ? colors.brand : colors.borderStrong, backgroundColor: on ? colors.brand : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                <T v="small" color={on ? colors.lilacLight : colors.muted}>{shortDate(isoDay(d)).split(' ')[0]}</T>
                <T v="h3" color={on ? colors.white : colors.ink} style={{ fontFamily: fonts.display }}>{d.getDate()}</T>
                <T v="small" color={on ? colors.lilacLight : colors.muted} style={{ fontSize: 11 }}>{shortDate(isoDay(d)).split(' ')[2]}</T>
              </Pressable>
            );
          })}
        </ScrollView>
        {errors.date ? <T v="small" color={colors.danger}>{errors.date}</T> : null}
      </View>
      <View style={{ gap: 8 }}>
        <T v="label">Start time</T>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {STARTS.map((s) => <Chip key={s} label={s} selected={start === s} onPress={() => setStart(s)} />)}
        </Row>
      </View>
      <Row justify="space-between">
        <View>
          <T v="label">Duration</T>
          <T v="small">{start} – {end}</T>
        </View>
        <Stepper value={hours} onChange={setHours} min={1} max={12} label="hours" />
      </Row>
      {artist ? <Field label="Location" value={location} onChangeText={setLocation} placeholder="Address or venue" icon="map-marker-outline" error={errors.location} /> : null}
      <Field label="Number of guests" value={guests} onChangeText={(t) => setGuests(t.replace(/\D/g, ''))} keyboardType="number-pad" error={errors.guests} />
      {artist ? (
        <Row gap={12}>
          <View style={{ flex: 1 }}>
            <T v="bodyBold">Equipment provided</T>
            <T v="small">Turn off if {artist.name} should bring their own gear</T>
          </View>
          <Toggle label="Equipment provided" value={ownGear} onValueChange={setOwnGear} />
        </Row>
      ) : null}
      <Field label="Extra services" value={extras} onChangeText={setExtras} placeholder={artist ? 'e.g. MC, lights, extra hour' : 'e.g. catering, heaters, security'} />
      <Field label={`Message to ${name}`} value={note} onChangeText={setNote} multiline placeholder="Tell them about the vibe you want…" />
    </Screen>
  );
}
