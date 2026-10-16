import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, View } from 'react-native';

import { BottomBar, goBack, Screen, ScreenHeader } from '../../components/layout';
import { Avatar, Banner, Button, Card, Chip, Field, Icon, KeyValue, LineItems, Photo, Pill, Radio, Row, Segmented, Stepper, T, Toggle } from '../../components/ui';
import { OCCASIONS, venueById } from '../../data/mock';
import type { Booking, EventItem, Lesson } from '../../data/types';
import { PAYMENT_NOTE, REMINDER_HOURS, RESPONSE_HOURS } from '../../lib/booking';
import { euro, isoDay, parse, plural, shortDate, TODAY } from '../../lib/format';
import { artistEstimate, type Estimate, guardsFor, lessonEstimate, securityRequired, toCharges, toLineItems, venueEstimate } from '../../lib/pricing';
import { LESSON_FORMAT_LABEL, useArtist, useArtistServices, useLesson } from '../../store/services';
import { toast } from '../../store/toast';
import { useApp, useEvent, useVenue } from '../../store/useApp';
import { colors, fonts, radius } from '../../theme';

type Kind = Booking['type'];
type Mode = 'listed' | 'quote';

const STARTS = ['10:00', '14:00', '16:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'];
/** A request in these states no longer holds the provider's date. */
const CLOSED: Booking['status'][] = ['declined', 'cancelled', 'expired', 'completed'];
const MUSIC_KINDS = ['dj', 'musician', 'band'];

/** "20:00" + 90 min -> "21:30" (wraps past midnight). */
function endOf(start: string, minutes: number) {
  const [hh, mm] = start.split(':').map(Number);
  const total = hh * 60 + mm + Math.round(minutes);
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Summary line whose value is free text, so it wraps instead of running off the card. */
function TextLine({ k, v }: { k: string; v: string }) {
  return (
    <Row justify="space-between" align="flex-start" gap={12} style={{ paddingVertical: 4 }}>
      <T v="body" color={colors.muted}>{k}</T>
      <T v="bodyBold" style={{ flex: 1, textAlign: 'right' }}>{v}</T>
    </Row>
  );
}

/** One optional charge with its price rule and a switch (or a "Required" pill). */
function OptionRow({ title, sub, value, onChange, required, label }: { title: string; sub: string; value: boolean; onChange: (v: boolean) => void; required?: boolean; label: string }) {
  return (
    <Row gap={12} style={{ minHeight: 48 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="bodyBold">{title}</T>
        <T v="small">{sub}</T>
      </View>
      {required ? <Pill label="Required" tone="warning" /> : <Toggle label={label} value={value} onValueChange={onChange} />}
    </Row>
  );
}

export default function NewBooking() {
  const params = useLocalSearchParams<{
    type?: string;
    id?: string;
    lesson?: string;
    guests?: string;
    catering?: string;
    security?: string;
    extras?: string;
    eventId?: string;
    quote?: string;
    date?: string;
    /** Prefill from an earlier request ("Send a new request" on an expired or declined booking). */
    title?: string;
    start?: string;
    hours?: string;
    location?: string;
  }>();
  const kind: Kind = params.type === 'venue' ? 'venue' : params.type === 'lesson' ? 'lesson' : 'musician';

  // Lessons arrive as /booking/new?type=lesson&id=<lessonId> (or id=<artistId>&lesson=<lessonId>).
  const lessonHit = useLesson(kind === 'lesson' ? (params.lesson ?? params.id) : undefined);
  const profile = useArtist(kind === 'venue' ? undefined : (lessonHit?.artist.id ?? params.id));
  // Only musicians, DJs and bands take bookings; fans and organizers have no service to book.
  const artist = profile && MUSIC_KINDS.includes(profile.kind) ? profile : undefined;
  const venue = useVenue(kind === 'venue' ? params.id : undefined);
  const services = useArtistServices(artist?.id);
  const initialEvent = useEvent(params.eventId);

  const user = useApp((s) => s.user);
  const bookings = useApp((s) => s.bookings);
  const myEvents = useApp((s) => s.myEvents);
  const methods = useApp((s) => s.paymentMethods);
  const selectedPayment = useApp((s) => s.selectedPayment);
  const setSelectedPayment = useApp((s) => s.setSelectedPayment);
  const createBooking = useApp((s) => s.createBooking);
  const requestQuote = useApp((s) => s.requestQuote);

  const lessons: Lesson[] = useMemo(() => (kind === 'lesson' ? (artist?.lessons ?? []) : []), [kind, artist]);
  const days = useMemo(() => Array.from({ length: 90 }, (_, i) => isoDay(new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + 2 + i, 12))), []);
  // Your upcoming events, plus the event this request was opened from (e.g. a sample event you run from its workspace).
  const linkable = useMemo(() => {
    const open = (e: EventItem) => e.state !== 'cancelled' && e.state !== 'completed' && parse(e.end).getTime() >= TODAY.getTime();
    const own = myEvents.filter(open);
    return initialEvent && open(initialEvent) && !own.some((e) => e.id === initialEvent.id) ? [initialEvent, ...own] : own;
  }, [myEvents, initialEvent]);
  const firstDay = (iso?: string) => (iso && parse(iso).getTime() > TODAY.getTime() ? iso.slice(0, 10) : days[10]);

  const [step, setStep] = useState<'form' | 'review'>('form');
  const [lessonId, setLessonId] = useState(lessonHit?.lesson.id ?? params.lesson);
  const [eventId, setEventId] = useState<string | undefined>(initialEvent?.id);
  const [title, setTitle] = useState(initialEvent?.title ?? params.title ?? '');
  // Venues only list the occasions they host, so start on one of those.
  const [occasion, setOccasion] = useState(venue && !venue.occasions.slice(0, 6).includes('Birthday') ? (venue.occasions[0] ?? 'Other') : 'Birthday');
  const [date, setDate] = useState(firstDay(params.date ?? initialEvent?.start));
  const [start, setStart] = useState(params.start && STARTS.includes(params.start) ? params.start : kind === 'lesson' ? '18:00' : '20:00');
  const [hours, setHours] = useState(Number(params.hours) >= 1 && Number(params.hours) <= 12 ? Math.round(Number(params.hours)) : kind === 'venue' ? 6 : 4);
  const [sessions, setSessions] = useState(1);
  const [location, setLocation] = useState(venue ? `${venue.name}, ${venue.area}` : initialEvent ? (venueById(initialEvent.venueId)?.name ?? '') : (params.location ?? ''));
  const [guests, setGuests] = useState(params.guests && Number(params.guests) > 0 ? params.guests : initialEvent?.expectedGuests ? String(initialEvent.expectedGuests) : '80');
  const [gearOn, setGearOn] = useState(false);
  const [cateringOn, setCateringOn] = useState(params.catering === '1');
  const [securityOn, setSecurityOn] = useState(params.security === '1');
  const [extras, setExtras] = useState<string[]>(params.extras ? params.extras.split(',').filter(Boolean) : []);
  const [extraText, setExtraText] = useState('');
  const [note, setNote] = useState('');
  const [askQuote, setAskQuote] = useState(params.quote === '1');
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Blocks a second tap while the first request is being created (duplicate submits never create two bookings).
  const submitting = useRef(false);

  const lesson = lessons.find((l) => l.id === lessonId) ?? lessonHit?.lesson ?? lessons[0];
  const g = Number(guests) || 0;

  const estimate: Estimate | undefined = useMemo(() => {
    if (kind === 'lesson') return lesson ? lessonEstimate(lesson, sessions) : undefined;
    // The venue price is per night, so the hire line says "1 night" rather than the hours booked.
    if (kind === 'venue') return venue ? venueEstimate(venue, { guests: g, catering: cateringOn, security: securityOn, extras }) : undefined;
    // Travel is billed whenever the artist lists it; equipment only when they bring their own gear.
    return artist ? artistEstimate(artist, { hours, travel: true, equipment: gearOn }) : undefined;
  }, [kind, lesson, sessions, venue, g, cateringOn, securityOn, extras, artist, gearOn, hours]);

  // Android back on the summary returns to the form instead of dropping everything typed so far.
  useEffect(() => {
    if (step !== 'review') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setStep('form');
      return true;
    });
    return () => sub.remove();
  }, [step]);

  const provider = kind === 'venue' ? venue : artist;
  if (!provider || !estimate || (kind === 'lesson' && !lesson)) {
    return (
      <Screen header={<ScreenHeader title="Booking" onBack={() => goBack('/(tabs)/artists')} />}>
        <T v="body">{kind === 'lesson' ? 'This lesson is no longer offered. Choose another teacher or lesson.' : 'Choose a musician or venue first.'}</T>
        <Button title="Browse artists" onPress={() => router.replace('/artists/all')} />
        <Button title="Browse venues" variant="secondary" onPress={() => router.replace('/venues')} />
      </Screen>
    );
  }

  const name = provider.name;
  const targetId = provider.id;
  const image = artist?.avatar ?? venue?.cover ?? 'ven_moon';
  const providerQuote = estimate.quote;
  const mode: Mode = providerQuote || askQuote ? 'quote' : 'listed';
  const durationMin = kind === 'lesson' && lesson ? lesson.durationMin : hours * 60;
  const end = endOf(start, durationMin);
  const capacity = venue?.capacity ?? 0;
  const secRequired = venue ? securityRequired(venue, g) : false;
  const method = methods.find((m) => m.id === selectedPayment);
  const dayList = days.includes(date) ? days : [date, ...days];
  const backHref = kind === 'venue' ? `/venue/${targetId}` : `/artist/${targetId}`;
  // Extras arriving from the venue page only count when the venue still lists them.
  const chosenExtras = venue ? extras.filter((x) => venue.extraCharges?.some((c) => c.label === x)) : [];

  // You can only hold one open request per provider (and lesson) and date.
  const clash = bookings.find((b) => b.targetId === targetId && b.date === date && (kind !== 'lesson' || b.lessonId === lesson?.id) && !CLOSED.includes(b.status));

  const clearError = (k: string) => setErrors((e) => Object.fromEntries(Object.entries(e).filter(([key]) => key !== k)));

  const linkEvent = (e?: EventItem) => {
    setEventId(e?.id);
    if (!e) return;
    setTitle(e.title);
    setDate(firstDay(e.start));
    if (kind === 'musician') setLocation(venueById(e.venueId)?.name ?? location);
    if (e.expectedGuests) setGuests(String(e.expectedGuests));
    clearError('date');
  };

  const toggleExtra = (label: string) => setExtras((xs) => (xs.includes(label) ? xs.filter((x) => x !== label) : [...xs, label]));

  // ---------- What the request says ----------
  const gearCharge = artist?.charges?.equipment;
  const equipment =
    kind === 'venue'
      ? (venue?.equipment ?? '')
      : kind === 'lesson' && lesson
        ? `${lesson.instrument} · ${LESSON_FORMAT_LABEL[lesson.format]}`
        : gearOn
          ? `${name} brings own equipment`
          : 'Provided by venue / host';
  const options: string[] = [];
  if (venue && g > 0) {
    if (cateringOn && venue.catering?.available) options.push(`Catering for ${g} guests`);
    if ((securityOn || secRequired) && venue.security?.available) options.push(`Security (${plural(guardsFor(g, venue.security.guestsPerGuard), 'guard')})`);
  }
  options.push(...chosenExtras);
  if (kind === 'lesson' && sessions > 1) options.push(plural(sessions, 'session'));
  if (extraText.trim()) options.push(extraText.trim());
  const extrasLine = options.join(', ') || 'None';
  const lessonPlace = lesson ? (lesson.format === 'online' ? 'Online · link shared in chat' : lesson.location ?? '') : '';
  const finalLocation = (kind === 'venue' ? `${venue?.name}, ${venue?.area}` : kind === 'lesson' ? location.trim() || lessonPlace : location.trim()) || name;
  const eventTitle = kind === 'lesson' && lesson ? title.trim() || lesson.title : title.trim();

  const toReview = () => {
    const e: Record<string, string> = {};
    if (kind !== 'lesson' && title.trim().length < 3) e.title = 'Give your event a name';
    if (kind === 'musician' && location.trim().length < 3) e.location = 'Where is the event?';
    if (kind === 'lesson' && lesson?.format === 'in-person' && !lesson.location && location.trim().length < 3) e.location = 'Where should the lesson take place?';
    if (kind !== 'lesson') {
      if (!g) e.guests = 'Roughly how many guests?';
      else if (venue && g > capacity) e.guests = `${name} fits up to ${capacity} people`;
    }
    if (clash) e.date = `You already have an open request with ${name} on ${shortDate(date)}`;
    setErrors(e);
    if (!Object.keys(e).length) {
      setAgreed(false);
      setStep('review');
    }
  };

  const send = () => {
    if (submitting.current || !agreed) return;
    // Idempotent: a repeated submit opens the request that already exists instead of creating a second one.
    const existing = useApp.getState().bookings.find((b) => b.targetId === targetId && b.date === date && (kind !== 'lesson' || b.lessonId === lesson?.id) && !CLOSED.includes(b.status));
    if (existing) {
      toast(`You already have an open request with ${name} on ${shortDate(date)}`);
      router.replace(`/booking/${existing.id}`);
      return;
    }
    if (mode === 'listed' && !method) return;
    submitting.current = true;
    const input = {
      type: kind,
      targetId,
      lessonId: kind === 'lesson' ? lesson?.id : undefined,
      eventId,
      eventTitle,
      date,
      startTime: start,
      endTime: end,
      hours: Math.round((durationMin / 60) * 100) / 100,
      location: finalLocation,
      guests: kind === 'lesson' ? 1 : g,
      equipment,
      extras: extrasLine,
      note: [kind !== 'lesson' && occasion !== 'Other' ? `Occasion: ${occasion}.` : '', note.trim()].filter(Boolean).join(' '),
    };
    const bid =
      mode === 'quote'
        ? requestQuote(input)
        : createBooking({ ...input, amount: estimate.total, pricing: 'listed', payment: 'authorized', charges: toCharges(estimate.items) });
    router.replace({ pathname: '/success', params: { kind: mode === 'quote' ? 'quote' : 'request', id: bid } });
  };

  const priceLabel = providerQuote
    ? 'Priced on request'
    : kind === 'lesson' && lesson
      ? `${euro(lesson.price ?? 0)} per ${lesson.durationMin}-min session`
      : artist
        ? `${euro(artist.feePerHour ?? 0)}/h`
        : `${euro(venue?.pricePerNight ?? 0)}/night`;
  const subtitle = kind === 'lesson' && lesson ? `${lesson.title} · ${lesson.level}` : artist ? artist.title : `${venue?.type} · up to ${capacity} guests`;
  const terms = kind === 'lesson' ? services?.lessonTerms : kind === 'musician' ? services?.performanceTerms : undefined;
  const listedSeparately = estimate.items.filter((i) => i.key !== 'base');

  // ---------- Review ----------
  if (step === 'review') {
    const ready = agreed && (mode === 'quote' || !!method);
    return (
      <Screen
        header={<ScreenHeader title={mode === 'quote' ? 'Review quote request' : 'Review request'} onBack={() => setStep('form')} />}
        footer={
          <BottomBar>
            <Button title={mode === 'quote' ? 'Send quote request' : `Send request · ${euro(estimate.total)}`} disabled={!ready} onPress={send} />
            <T v="small" center style={{ marginTop: 8 }}>
              {!agreed
                ? 'Confirm the details above to continue.'
                : mode === 'quote'
                  ? 'Nothing is charged until you accept a quote.'
                  : method
                    ? 'Payment pending the provider’s decision.'
                    : 'Choose or add a payment method to continue.'}
            </T>
          </BottomBar>
        }
      >
        <Card padded={false} style={{ flexDirection: 'row', overflow: 'hidden' }}>
          <Photo src={image} style={{ width: 112, height: 120 }} />
          <View style={{ flex: 1, padding: 12, gap: 4, justifyContent: 'center' }}>
            <T v="h3" numberOfLines={1}>{name}</T>
            <T v="small" numberOfLines={1}>{subtitle}</T>
            <T v="bodyBold">{shortDate(date)} · {start}–{end}</T>
            <T v="small" numberOfLines={1}>{finalLocation}</T>
          </View>
        </Card>

        <Card style={{ gap: 6 }}>
          <T v="title">{kind === 'lesson' ? 'Lesson' : 'Your event'}</T>
          <TextLine k={kind === 'lesson' ? 'Lesson' : 'Event'} v={eventTitle} />
          {kind !== 'lesson' ? <KeyValue k="Occasion" v={occasion} /> : <KeyValue k="Sessions" v={plural(sessions, 'session')} />}
          {kind !== 'lesson' ? <KeyValue k="Guests" v={String(g)} /> : null}
          <TextLine k={kind === 'venue' ? 'Setup' : kind === 'lesson' ? 'Format' : 'Equipment'} v={equipment} />
          <TextLine k="Options" v={extrasLine} />
          {eventId ? <TextLine k="Linked event" v={initialEvent?.id === eventId ? initialEvent.title : (linkable.find((e) => e.id === eventId)?.title ?? title)} /> : null}
          {note.trim() ? <TextLine k="Message" v={note.trim()} /> : null}
        </Card>

        <Card style={{ gap: 6 }}>
          <T v="title">Contact</T>
          <KeyValue k="Full name" v={user.name} />
          <KeyValue k="Phone" v={user.phone} />
          <KeyValue k="Email" v={user.email} />
        </Card>

        <Card style={{ gap: 10 }}>
          <T v="title">{mode === 'quote' ? 'Price' : 'Charges'}</T>
          {mode === 'quote' ? (
            <>
              <T v="body">{name} sends an itemised quote for this request. No total is shown until then.</T>
              {listedSeparately.length ? (
                <>
                  <T v="small">Charges {name} lists separately (the quote confirms them):</T>
                  <LineItems items={toLineItems(listedSeparately)} total={false} />
                </>
              ) : null}
            </>
          ) : (
            <LineItems items={toLineItems(estimate.items)} total={estimate.total} />
          )}
        </Card>

        {mode === 'listed' ? (
          <Card style={{ gap: 10 }}>
            <T v="title">Payment details</T>
            <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
              {methods.map((m) => {
                const on = m.id === selectedPayment;
                return (
                  <Pressable key={m.id} accessibilityRole="radio" accessibilityLabel={`${m.label}, ${m.sub}`} accessibilityState={{ checked: on }} onPress={() => setSelectedPayment(m.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: on ? 2 : 1, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brandTint : colors.surface }}>
                    <View style={{ width: 44, height: 28, borderRadius: 6, backgroundColor: m.badge === 'PP' ? '#1F4E9C' : m.badge === 'VISA' ? colors.brand : colors.ink, alignItems: 'center', justifyContent: 'center' }}>
                      <T v="caption" color={colors.white} style={{ fontFamily: fonts.bodyBold, fontSize: 10 }}>{m.badge}</T>
                    </View>
                    <View style={{ flex: 1 }}>
                      <T v="bodyBold">{m.label}</T>
                      <T v="small">{m.sub}</T>
                    </View>
                    <Radio selected={on} />
                  </Pressable>
                );
              })}
            </View>
            <Button title="Add new card" icon="plus" variant="ghost" size="md" onPress={() => router.push('/payment-methods?add=1')} />
            <Banner icon="credit-card-clock-outline">{PAYMENT_NOTE.authorized}</Banner>
          </Card>
        ) : null}

        <Card style={{ gap: 10 }}>
          <T v="title">What happens next</T>
          {(mode === 'quote'
            ? [
                `${name} reviews your request and sends an itemised quote with a validity date.`,
                'You accept it, decline it or ask questions in chat. A revised quote needs your acceptance again.',
                'Accepting moves to payment. The booking is confirmed only once the payment is verified.',
              ]
            : [
                `${name} has ${RESPONSE_HOURS} hours to accept or decline. A reminder goes out after ${REMINDER_HOURS} hours without a response.`,
                'If they accept, the payment is finalized. The booking is confirmed only once the payment is verified.',
                'If they decline or don’t answer in time, the payment is released or refunded. You’ll see when that is complete.',
              ]
          ).map((line, i) => (
            <Row key={line} gap={10} align="flex-start">
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                <T v="smallBold" color={colors.brand}>{i + 1}</T>
              </View>
              <T v="body" style={{ flex: 1 }}>{line}</T>
            </Row>
          ))}
          {terms ? <TextLine k="Service terms" v={terms} /> : null}
        </Card>

        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: agreed }} onPress={() => setAgreed((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 4 }}>
          <Icon name={agreed ? 'checkbox-marked' : 'checkbox-blank-outline'} size={26} color={agreed ? colors.brand : colors.disabled} />
          <T v="body" style={{ flex: 1 }}>
            {mode === 'quote' ? `I confirm the details and ask ${name} for a quote.` : `I confirm the details and the terms above${terms ? `, including ${name}’s service terms` : ''}.`}
          </T>
        </Pressable>
      </Screen>
    );
  }

  // ---------- Form ----------
  return (
    <Screen
      keyboard
      header={<ScreenHeader title={kind === 'lesson' ? 'Book a lesson' : `Book ${name}`} onBack={() => goBack(backHref)} />}
      footer={
        <BottomBar>
          {Object.keys(errors).length ? (
            <T v="small" color={colors.danger} style={{ marginBottom: 8 }}>{Object.values(errors)[0]}</T>
          ) : null}
          <Row gap={14}>
            <View>
              <T v="small">{mode === 'quote' ? 'Price' : 'Estimated total'}</T>
              <T v="h3">{mode === 'quote' ? 'By quote' : euro(estimate.total)}</T>
            </View>
            <Button title="Review request" style={{ flex: 1 }} onPress={toReview} />
          </Row>
        </BottomBar>
      }
    >
      <View style={{ alignItems: 'center', gap: 6 }}>
        {artist ? <Avatar src={image} size={104} verified={artist.verified} /> : <Photo src={image} style={{ width: 200, height: 124 }} radius={18} />}
        <T v="h3">{name}</T>
        <T v="small" center>{subtitle} · {priceLabel}</T>
      </View>

      {providerQuote ? (
        <Banner icon="file-document-outline">{`${name} prices ${kind === 'lesson' ? 'this lesson' : 'bookings'} on request. Send your details and they reply with an itemised quote. Nothing is charged until you accept it.`}</Banner>
      ) : (
        <View style={{ gap: 6 }}>
          <Segmented
            options={[
              { key: 'listed', label: 'Listed price' },
              { key: 'quote', label: 'Request a quote' },
            ]}
            value={mode}
            onChange={(k) => setAskQuote(k === 'quote')}
          />
          <T v="small">{mode === 'quote' ? 'Ask for an itemised quote instead, e.g. for a custom set or package. Nothing is charged now.' : 'Book at the listed price. Payment details are taken now and stay pending the provider’s decision.'}</T>
        </View>
      )}

      {kind === 'lesson' && lessons.length > 1 ? (
        <View style={{ gap: 8 }}>
          <T v="label">Lesson</T>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {lessons.map((l) => <Chip key={l.id} label={l.title} selected={lesson?.id === l.id} onPress={() => setLessonId(l.id)} />)}
          </Row>
        </View>
      ) : null}

      {kind === 'lesson' && lesson ? (
        <Card style={{ gap: 6 }}>
          <T v="title">{lesson.title}</T>
          <KeyValue k="Format" v={LESSON_FORMAT_LABEL[lesson.format]} />
          <KeyValue k="Length" v={`${lesson.durationMin} min per session`} />
          <KeyValue k="Level" v={lesson.level} />
          {lesson.location ? <TextLine k="Where" v={lesson.location} /> : null}
          {lesson.description ? <T v="small">{lesson.description}</T> : null}
          <T v="small">A lesson has its own scope and price. Performance fees never apply to it.</T>
        </Card>
      ) : null}

      {kind !== 'lesson' && linkable.length ? (
        <View style={{ gap: 8 }}>
          <T v="label">For one of your events?</T>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            <Chip label="No event" selected={!eventId} onPress={() => linkEvent(undefined)} />
            {linkable.map((e) => <Chip key={e.id} label={e.title} selected={eventId === e.id} onPress={() => linkEvent(e)} />)}
          </Row>
          <T v="small">Linked bookings appear in the event’s planning, each with its own status and payment.</T>
        </View>
      ) : null}

      {kind !== 'lesson' ? (
        <>
          <T v="h3">Your event</T>
          <Field label="Event title" value={title} onChangeText={(t) => { setTitle(t); clearError('title'); }} placeholder="e.g. Shakira birthday" error={errors.title} />
          <View style={{ gap: 8 }}>
            <T v="label">Occasion</T>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {(venue ? venue.occasions.slice(0, 6) : OCCASIONS).map((o) => <Chip key={o} label={o} selected={occasion === o} onPress={() => setOccasion(o)} />)}
            </Row>
          </View>
        </>
      ) : null}

      <View style={{ gap: 8 }}>
        <T v="label">{kind === 'lesson' ? 'First session' : 'Date'}</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {dayList.map((d) => {
            const on = d === date;
            const [wd, dd, mon] = shortDate(d).split(' ');
            return (
              <Pressable key={d} accessibilityRole="button" accessibilityLabel={shortDate(d)} accessibilityState={{ selected: on }} onPress={() => { setDate(d); clearError('date'); }} style={{ width: 62, height: 74, borderRadius: 14, borderWidth: 1, borderColor: on ? colors.brand : colors.borderStrong, backgroundColor: on ? colors.brand : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                <T v="small" color={on ? colors.lilacLight : colors.muted}>{wd}</T>
                <T v="h3" color={on ? colors.white : colors.ink} style={{ fontFamily: fonts.display }}>{dd}</T>
                <T v="small" color={on ? colors.lilacLight : colors.muted} style={{ fontSize: 11 }}>{mon}</T>
              </Pressable>
            );
          })}
        </ScrollView>
        {errors.date ? <T v="small" color={colors.danger}>{errors.date}</T> : null}
        {kind !== 'lesson' ? <T v="small">A date that looks free still needs the {kind === 'venue' ? 'venue' : 'artist'}’s acceptance.</T> : null}
      </View>

      <View style={{ gap: 8 }}>
        <T v="label">Start time</T>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {STARTS.map((s) => <Chip key={s} label={s} selected={start === s} onPress={() => setStart(s)} />)}
        </Row>
      </View>

      {kind === 'lesson' && lesson ? (
        <Row justify="space-between">
          <View style={{ flex: 1 }}>
            <T v="label">Sessions</T>
            <T v="small">{start} – {end} each · further dates agreed with {name}</T>
          </View>
          <Stepper value={sessions} onChange={setSessions} min={1} max={10} label="sessions" />
        </Row>
      ) : (
        <Row justify="space-between">
          <View>
            <T v="label">Duration</T>
            <T v="small">{start} – {end}</T>
          </View>
          <Stepper value={hours} onChange={setHours} min={1} max={12} label="hours" />
        </Row>
      )}

      {kind === 'musician' ? <Field label="Location" value={location} onChangeText={(t) => { setLocation(t); clearError('location'); }} placeholder="Address or venue" icon="map-marker-outline" error={errors.location} /> : null}
      {kind === 'lesson' && lesson?.format === 'in-person' ? (
        <Field label="Lesson address" value={location} onChangeText={(t) => { setLocation(t); clearError('location'); }} placeholder={lesson.location ?? 'Your address in Berlin'} icon="map-marker-outline" error={errors.location} />
      ) : null}
      {kind !== 'lesson' ? (
        <Field
          label="Number of guests"
          value={guests}
          onChangeText={(t) => { setGuests(t.replace(/\D/g, '').slice(0, 4)); clearError('guests'); }}
          keyboardType="number-pad"
          error={errors.guests}
        />
      ) : null}
      {venue && g > 0 && !errors.guests ? <T v="small">{`Catering and security are priced by attendance: ${plural(g, 'guest')}${g > capacity ? ` (over the ${capacity}-guest capacity)` : ''}.`}</T> : null}

      {artist && kind === 'musician' ? (
        <Card style={{ gap: 10 }}>
          <T v="title">Charges</T>
          {artist.charges?.travel ? (
            <Row gap={12} style={{ minHeight: 44 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="bodyBold">Travel · {euro(artist.charges.travel)}</T>
                <T v="small">{artist.charges.travelNote ?? 'Billed separately from the performance fee'}</T>
              </View>
              <Pill label="Listed" tone="neutral" />
            </Row>
          ) : (
            <T v="small">{name} lists no travel charge.</T>
          )}
          <OptionRow
            title={gearCharge ? `${name} brings equipment · ${euro(gearCharge)}` : `${name} brings own equipment`}
            sub={gearCharge ? (artist.charges?.equipmentNote ?? 'Billed separately from the performance fee') : 'No separate equipment charge listed. Agree details in chat.'}
            value={gearOn}
            onChange={setGearOn}
            label={`${name} brings equipment`}
          />
          {!gearOn ? <T v="small">Equipment is provided by the venue or host.</T> : null}
        </Card>
      ) : null}

      {venue ? (
        <Card style={{ gap: 12 }}>
          <T v="title">Catering, security and extras</T>
          {venue.catering?.available ? (
            <OptionRow
              title="Catering"
              sub={`${euro(venue.catering.pricePerGuest)} per guest${venue.catering.minGuests ? ` · minimum ${venue.catering.minGuests} guests` : ''}${venue.catering.notes ? ` · ${venue.catering.notes}` : ''}`}
              value={cateringOn}
              onChange={setCateringOn}
              label="Add catering"
            />
          ) : (
            <T v="small">{name} doesn’t offer catering.</T>
          )}
          {venue.security?.available ? (
            <OptionRow
              title="Security"
              sub={`${euro(venue.security.pricePerGuard)} per guard · 1 guard per ${venue.security.guestsPerGuard} guests${venue.security.requiredFrom ? ` · required from ${venue.security.requiredFrom} guests` : ''}`}
              value={securityOn || secRequired}
              onChange={setSecurityOn}
              required={secRequired}
              label="Add security"
            />
          ) : (
            <T v="small">{name} doesn’t offer security staff.</T>
          )}
          {venue.extraCharges?.length ? (
            <View style={{ gap: 8 }}>
              <T v="label">Extras</T>
              <Row gap={8} style={{ flexWrap: 'wrap' }}>
                {venue.extraCharges.map((x) => (
                  <Chip key={x.label} label={`${x.label} · ${euro(x.amount)}`} selected={extras.includes(x.label)} onPress={() => toggleExtra(x.label)} accessibilityLabel={`${x.label}, ${euro(x.amount)}`} />
                ))}
              </Row>
            </View>
          ) : null}
        </Card>
      ) : null}

      <Card style={{ gap: 10 }}>
        <Row justify="space-between">
          <T v="title">{mode === 'quote' ? 'Listed charges' : 'Price breakdown'}</T>
          {mode === 'quote' ? <Pill label="Quote" tone="brand" /> : null}
        </Row>
        {mode === 'quote' ? (
          listedSeparately.length ? (
            <>
              <LineItems items={toLineItems(listedSeparately)} total={false} />
              <T v="small">The itemised quote sets the final price{providerQuote ? '' : ` instead of ${euro(estimate.total)}`}.</T>
            </>
          ) : (
            <T v="small">{name} sets the price in an itemised quote.</T>
          )
        ) : (
          <LineItems items={toLineItems(estimate.items)} total={estimate.total} />
        )}
      </Card>

      <Field label="Other requests" value={extraText} onChangeText={setExtraText} placeholder={kind === 'venue' ? 'e.g. heaters, late opening' : kind === 'lesson' ? 'e.g. bring my own instrument' : 'e.g. MC, extra hour'} />
      <Field label={`Message to ${name}`} value={note} onChangeText={setNote} multiline placeholder={kind === 'lesson' ? 'Your experience and what you want to learn…' : 'Tell them about the vibe you want…'} />
    </Screen>
  );
}
