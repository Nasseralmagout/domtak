import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EventCard } from '../components/cards';
import { BottomBar, goBack, Screen, ScreenHeader } from '../components/layout';
import { Avatar, Banner, Button, Card, Chip, Divider, EmptyState, Field, Icon, IconButton, Photo, Pill, Row, Segmented, Stepper, T, Toggle } from '../components/ui';
import type { ImgKey } from '../data/images';
import { profiles } from '../data/mock';
import type { EventCategory, TicketType } from '../data/types';
import { isClosed } from '../lib/booking';
import { deadlineChoices, hostsEvent } from '../lib/eventHost';
import { draftIssues, eventState, guestSummary, linkedBookings } from '../lib/events';
import { euro, isoDay, parse, plural, shortDate, time, TODAY } from '../lib/format';
import { artistEstimate, toCharges } from '../lib/pricing';
import { toast } from '../store/toast';
import { APPLICATION_STATUS_LABEL, canPublishPublicEvents, isApproved, type User, useAllEvents, useApp, useEvent, useVenues } from '../store/useApp';
import { colors, radius } from '../theme';

const COVERS: ImgKey[] = ['ev_lasers', 'ev_concert_blue', 'ev_party', 'feed_openair', 'ev_pool_party', 'ev_red_crowd', 'cat_acoustic', 'ev_purple_arena'];
/** Your media library, opened from the upload tile. */
const LIBRARY: ImgKey[] = ['ev_lights', 'ev_lasers2', 'ev_club_dark', 'ev_festival', 'ev_live_stage', 'ev_stage_gold', 'ev_dancing', 'ev_hands', 'ev_silhouette', 'feed_club', 'feed_crowd', 'feed_rooftop', 'feed_decks', 'feed_friends', 'band_stage', 'ven_garden'];
const START_TIMES = ['14:00', '18:00', '20:00', '22:00', '23:00'];
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_PRICE = 500;
const MAX_GUESTS = 20000;
const CATEGORIES: EventCategory[] = ['Concerts', 'Parties', 'Electronic', 'Acoustic', 'Family', 'Festivals', 'Listening'];
const STEPS_PUBLIC = ['Details', 'Location', 'Tickets', 'Preview'];
const STEPS_PRIVATE = ['Details', 'Place', 'Guests', 'Review'];
const OPEN_STATUSES = ['declined', 'cancelled', 'expired', 'completed'];

const digits = (v: string, max: number) => String(Math.min(max, Number(v.replace(/\D/g, '')) || 0));

/** Where someone who cannot publish public events goes next (missing permission, blueprint section 13). */
function publicRoute(user: User): { label: string; href: string; note: string } {
  if (isApproved(user, 'organizer')) return { label: 'Switch to organizer workspace', href: '/workspace', note: 'You’re approved as an organizer. Switch workspace to publish public events.' };
  if (user.application?.role === 'organizer') return { label: 'View organizer application', href: '/application', note: `Your organizer application: ${APPLICATION_STATUS_LABEL[user.application.status].toLowerCase()}.` };
  return { label: 'Apply as organizer', href: '/apply?role=organizer', note: 'Members, artists and venues create private events. Organizers apply once and are reviewed by our team.' };
}

function PublicLocked({ user }: { user: User }) {
  const route = publicRoute(user);
  return (
    <Card style={{ gap: 10 }}>
      <Row gap={12}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="lock-outline" size={22} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="bodyBold">Private event · invite only</T>
          <T v="small">Only people you invite can see it.</T>
        </View>
      </Row>
      <Divider />
      <T v="bodyBold">Public events need an approved organizer account</T>
      <T v="small">{route.note}</T>
      <Button title={route.label} icon="shield-account-outline" variant="light" size="sm" style={{ alignSelf: 'flex-start' }} onPress={() => router.push(route.href as never)} />
    </Card>
  );
}

export default function CreateEvent() {
  const { private: priv, edit } = useLocalSearchParams<{ private?: string; edit?: string }>();
  // ?edit=<id> opens the wizard on an event you organise, prefilled; Save keeps ticket sales.
  const editing = useEvent(edit);
  const user = useApp((s) => s.user);
  const canPublic = canPublishPublicEvents(user);
  // Members, artists and venues only create private events; public ones need an approved organizer workspace.
  const startPrivate = editing ? !!editing.isPrivate : priv === '1' || !canPublic;
  const [visibility, setVisibility] = useState<'private' | 'public'>(startPrivate ? 'private' : 'public');
  const isPrivate = editing ? !!editing.isPrivate : visibility === 'private' || !canPublic;
  const editingDraft = editing?.state === 'draft';
  const steps = isPrivate ? STEPS_PRIVATE : STEPS_PUBLIC;

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const addEvent = useApp((s) => s.addEvent);
  const saveEventDraft = useApp((s) => s.saveEventDraft);
  const updateEvent = useApp((s) => s.updateEvent);
  const createBooking = useApp((s) => s.createBooking);
  const requestQuote = useApp((s) => s.requestQuote);
  const requestChange = useApp((s) => s.requestChange);
  const bookings = useApp((s) => s.bookings);
  const allEvents = useAllEvents();
  const venueList = useVenues();
  const editStartIso = editing?.start;
  const editDay = useMemo(() => {
    if (!editStartIso) return undefined;
    const d = parse(editStartIso);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  }, [editStartIso]);
  const editTime = editing ? editing.start.slice(11, 16) : undefined;
  const dates = useMemo(() => {
    const list = Array.from({ length: 60 }, (_, i) => new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + 2 + i, 12));
    // An edited event keeps its own date in the picker even when it is outside the usual range.
    if (editDay && !list.some((d) => isoDay(d) === isoDay(editDay))) return [editDay, ...list].sort((a, b) => a.getTime() - b.getTime());
    return list;
  }, [editDay]);

  const [step, setStep] = useState(0);
  const [cover, setCover] = useState<ImgKey>(editing?.cover ?? (startPrivate ? 'ev_pool_party' : 'ev_lasers'));
  const [title, setTitle] = useState(editing?.title ?? (startPrivate ? `${user.name.split(' ')[0]}’s Birthday Party` : ''));
  const [category, setCategory] = useState<EventCategory>(editing?.category ?? (startPrivate ? 'Parties' : 'Electronic'));
  const [genre, setGenre] = useState(editing?.genre ?? 'Techno');
  const [date, setDate] = useState(editDay ?? dates[14]);
  const [startTime, setStartTime] = useState(editTime ?? (startPrivate ? '20:00' : '22:00'));
  const [customTime, setCustomTime] = useState(editTime && !START_TIMES.includes(editTime) ? editTime : '');
  const [hours, setHours] = useState(editing ? Math.min(24, Math.max(1, Math.round((parse(editing.end).getTime() - parse(editing.start).getTime()) / 3_600_000))) : 6);
  // Older events have no expected-guest count: start from their capacity so the draft check doesn't flag them.
  const [expected, setExpected] = useState(() => {
    if (!editing) return String(startPrivate ? 30 : 200);
    if (editing.expectedGuests) return String(editing.expectedGuests);
    const cap = editing.ticketTypes.reduce((n, t) => n + t.capacity, 0);
    return String(Math.min(cap, venueList.find((v) => v.id === editing.venueId)?.capacity ?? cap));
  });
  const [oneTime, setOneTime] = useState(true);
  const [weeks, setWeeks] = useState(4);
  const [library, setLibrary] = useState(false);
  const [uploaded, setUploaded] = useState<ImgKey[]>([]);
  const editPaid = editing ? editing.ticketTypes.some((t) => t.price > 0) : undefined;
  const [lineup, setLineup] = useState<string[]>(editing?.lineup ?? (startPrivate ? [] : ['adam']));
  // '' = venue not decided yet (allowed in a draft; flagged by the draft check).
  const [venueId, setVenueId] = useState(editing?.venueId ?? (startPrivate ? '' : 'moonclub'));
  const [description, setDescription] = useState(editing?.description ?? '');
  const [paid, setPaid] = useState(editPaid ?? !startPrivate);
  const [tickets, setTickets] = useState<TicketType[]>(
    editing && editPaid
      ? editing.ticketTypes
      : [
          { id: 'ga', name: 'General admission', description: 'Entry', price: 25, capacity: 200, sold: 0 },
          { id: 'vip', name: 'VIP', description: 'Fast lane', price: 45, capacity: 30, sold: 0 },
        ],
  );
  const freeBefore = editing && !editPaid ? editing.ticketTypes[0] : undefined;
  const [guestLimit, setGuestLimit] = useState(String(freeBefore?.capacity ?? (startPrivate ? 40 : 100)));
  const [costOn, setCostOn] = useState(!!editing?.costSharing?.enabled);
  const [costAmount, setCostAmount] = useState(String(editing?.costSharing?.perGuest ?? 15));
  const [costDeadline, setCostDeadline] = useState<string | undefined>(editing?.costSharing?.deadline);
  const [costNote, setCostNote] = useState(editing?.costSharing?.note ?? '');
  const [refund, setRefund] = useState(editing && editPaid ? editing.refundPolicy ?? 'Refunds up to 48 h before doors' : 'Refunds up to 48 h before doors');
  const [adults, setAdults] = useState(editing ? !!editing.ageLimit : !startPrivate);
  const [error, setError] = useState<string>();

  const artists = profiles.filter((p) => ['dj', 'musician', 'band'].includes(p.kind));
  const venue = venueList.find((v) => v.id === venueId);
  // Choosing "not decided yet" is for drafts: a live event keeps its venue.
  const canLeaveVenueOpen = !editing || editingDraft;
  const [h, m] = startTime.split(':').map(Number);
  const startIso = `${isoDay(date)}T${startTime}:00`;
  const endDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h + hours, m);
  const endIso = `${isoDay(endDate)}T${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}:00`;
  const guestsN = Number(expected) || 0;
  const costN = Number(costAmount) || 0;
  const limitN = Number(guestLimit) || 0;
  const soldBefore = editing ? editing.ticketTypes.reduce((n, t) => n + t.sold, 0) : 0;
  // Invited guests of the event you are editing: once one has paid, the contribution stays as it is (same rule as /invite).
  const guestsBefore = editing ? guestSummary(editing) : undefined;
  const costLocked = !!editing?.costSharing?.enabled && (guestsBefore?.paid ?? 0) > 0;
  // Private events use cost sharing instead of ticket sales (an older private event that sold tickets keeps its ticket types).
  const keepsPrivateTickets = isPrivate && !!editing && !!editPaid;
  const finalTickets: TicketType[] = isPrivate
    ? keepsPrivateTickets && editing
      ? editing.ticketTypes
      : [{ id: freeBefore?.id ?? 'guest', name: 'Guest', description: costOn ? 'Cost sharing per guest' : 'Invitation', price: 0, capacity: limitN, sold: freeBefore?.sold ?? 0 }]
    : paid
      ? tickets
      : [{ id: freeBefore?.id ?? 'free', name: 'Free entry', description: 'Register to get your QR', price: 0, capacity: limitN, sold: freeBefore?.sold ?? 0 }];
  const totalCapacity = finalTickets.reduce((n, t) => n + t.capacity, 0);
  const startDate = parse(startIso);
  const occurrences = oneTime || isPrivate || editing ? 1 : weeks;
  /** The same time slot moved by whole weeks (a weekly series repeats on this weekday). */
  const shiftWeeks = (iso: string, w: number) => {
    const d = parse(iso);
    const moved = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * w, d.getHours(), d.getMinutes());
    return `${isoDay(moved)}T${String(moved.getHours()).padStart(2, '0')}:${String(moved.getMinutes()).padStart(2, '0')}:00`;
  };
  // Another event at the same venue whose time overlaps any of the dates you're saving.
  const clash = venueId
    ? Array.from({ length: occurrences }, (_, w) => ({ s: parse(shiftWeeks(startIso, w)), e: parse(shiftWeeks(endIso, w)) }))
        .map(({ s, e }) => allEvents.find((x) => x.id !== edit && x.venueId === venueId && x.state !== 'cancelled' && parse(x.start) < e && parse(x.end) > s))
        .find(Boolean)
    : undefined;
  const clashText = clash && venue ? `${venue.name} already hosts “${clash.title}” on ${shortDate(clash.start)}, ${time(clash.start)}–${time(clash.end)}` : undefined;

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

  const costSharing = costLocked ? editing?.costSharing : isPrivate && costOn ? { enabled: true, perGuest: costN, deadline: costDeadline, note: costNote.trim() || undefined } : undefined;
  const draft = {
    title: title.trim() || 'Untitled event',
    cover,
    category,
    genre,
    venueId,
    lineup: isPrivate ? (editing?.lineup ?? []) : lineup,
    start: startIso,
    end: endIso,
    ticketTypes: finalTickets,
    description:
      description.trim() ||
      (venue ? (isPrivate ? `Private party at ${venue.name}, ${venue.area}.` : `${genre} night at ${venue.name}, ${venue.area}.`) : isPrivate ? 'Private party. The venue is still to be confirmed.' : `${genre} night. Venue to be announced.`),
    mapPos: venue?.mapPos ?? editing?.mapPos ?? { x: 50, y: 50 },
    ageLimit: adults ? 18 : undefined,
    refundPolicy: isPrivate ? (keepsPrivateTickets && editing ? editing.refundPolicy : costOn ? 'Ask the host about contribution refunds' : 'Free for guests') : paid ? refund : 'Free event',
    isPrivate,
    expectedGuests: guestsN || undefined,
    costSharing: isPrivate ? costSharing : editing?.costSharing,
  };
  // Draft validation (F11): missing or conflicting details. Drafts may be saved with these; publishing and invitations wait for them.
  const issues = [...draftIssues(draft), ...(clashText ? [clashText] : [])];

  // Provider bookings already linked to the event you are editing: a date change never moves them automatically (F13).
  const activeLinked = editing ? linkedBookings(editing, bookings).filter((b) => !isClosed(b.status) && b.status !== 'completed') : [];
  const dateChanged = !!editing && (editing.start !== startIso || editing.end !== endIso);

  const validate = (s: number): string | undefined => {
    if (s === 0) {
      if (title.trim().length < 3) return 'Give your event a name (3+ characters)';
      if (customTime && !TIME_RE.test(customTime)) return 'Enter the start time as HH:MM, e.g. 21:30';
      if (startDate.getTime() <= TODAY.getTime()) return 'Pick a start date in the future';
      if (hours < 1 || hours > 24) return 'Events can last between 1 and 24 hours';
      if (guestsN <= 0) return 'How many guests do you expect?';
      if (guestsN > MAX_GUESTS) return `Expected guests can be at most ${MAX_GUESTS}`;
    }
    // A live event can't move onto another booking at the venue; a draft only gets the conflict flagged.
    if (s === 1 && clashText && editing && !editingDraft) return `${clashText}. Pick another venue, date or time.`;
    if (s === 1 && !venueId && !canLeaveVenueOpen) return 'Choose a venue';
    if (s === 2) {
      if (isPrivate) {
        if (!keepsPrivateTickets && limitN <= 0) return 'Set how many guests can come';
        if (!keepsPrivateTickets && guestsBefore && limitN < guestsBefore.accepted) return `${plural(guestsBefore.accepted, 'guest')} already accepted, so the guest limit can’t go below that`;
        if (costOn && (costN <= 0 || costN > MAX_PRICE)) return `Set a contribution between €1 and €${MAX_PRICE} per guest`;
        if (costOn && costDeadline && !costLocked && parse(costDeadline).getTime() >= startDate.getTime()) return 'The pay-by date must be before the event. Pick it again.';
        if (costOn && costDeadline && !costLocked && costDeadline !== editing?.costSharing?.deadline && parse(costDeadline).getTime() <= TODAY.getTime()) return 'The pay-by date has passed. Pick a later one.';
        if (venue && totalCapacity > venue.capacity) return `${venue.name} fits ${venue.capacity} people, but your guest limit is ${totalCapacity}`;
        return undefined;
      }
      if (paid && tickets.some((t) => !t.name.trim() || t.capacity <= 0)) return 'Every ticket type needs a name and quantity';
      if (paid && tickets.some((t) => t.price > MAX_PRICE)) return `Ticket prices can be at most €${MAX_PRICE}`;
      if (paid && tickets.every((t) => t.price === 0)) return 'Paid events need at least one ticket with a price, or switch to free entry';
      if (paid && new Set(tickets.map((t) => t.name.trim().toLowerCase())).size !== tickets.length) return 'Give each ticket type a different name';
      if (editing && soldBefore > 0 && paid !== !!editPaid) return `${soldBefore} tickets are already sold, so ${editPaid ? 'paid' : 'free'} entry has to stay`;
      const short = paid ? tickets.find((t) => t.capacity < t.sold) : undefined;
      if (short) return `${short.sold} ${short.name} tickets are already sold; the quantity can’t go below that`;
      if (totalCapacity <= 0) return 'Set how many tickets are available';
      if (venue && totalCapacity > venue.capacity) return `${venue.name} fits ${venue.capacity} people, but you have ${totalCapacity} tickets`;
    }
    return undefined;
  };

  /** Booking requests for tagged artists: one independent request per artist, linked to the event. */
  const requestLineup = (eventId: string, ids: string[]) => {
    const day = isoDay(date);
    const toRequest = ids.filter((aid) => !bookings.some((b) => b.targetId === aid && b.date === day && !OPEN_STATUSES.includes(b.status)));
    toRequest.forEach((aid) => {
      const a = profiles.find((p) => p.id === aid);
      if (!a) return;
      const common = {
        type: 'musician' as const,
        targetId: aid,
        eventTitle: draft.title,
        date: day,
        startTime,
        endTime: endIso.slice(11, 16),
        hours,
        location: venue ? `${venue.name}, ${venue.area}` : 'Venue to be confirmed',
        guests: guestsN || totalCapacity,
        equipment: venue?.equipment ?? 'To be agreed',
        extras: 'None',
        note: 'Tagged in the line up.',
        eventId,
      };
      const estimate = artistEstimate(a, { hours, travel: true });
      // Artists who price on request get a quote request; nothing is charged until a quote is accepted.
      if (estimate.quote) requestQuote(common);
      else createBooking({ ...common, amount: estimate.total, charges: toCharges(estimate.items) });
    });
    return toRequest.length;
  };

  const saveChanges = () => {
    if (!editing) return;
    updateEvent(editing.id, { ...draft, subtitle: editing.subtitle });
    // Artists newly tagged in the line up of a live public event get a booking request, like on publish.
    const added = isPrivate || editingDraft ? 0 : requestLineup(editing.id, lineup.filter((aid) => !editing.lineup.includes(aid)));
    // A new date is a change request to each provider: their agreed terms stay until they accept (F13).
    const asked = dateChanged ? activeLinked.filter((b) => b.status !== 'change_requested') : [];
    asked.forEach((b) => requestChange(b.id, `Event moved to ${shortDate(startIso)}, ${startTime}–${endIso.slice(11, 16)}`));
    const parts = ['Changes saved', added ? `${plural(added, 'booking request')} sent` : '', asked.length ? `${plural(asked.length, 'provider')} asked to accept the new date` : ''].filter(Boolean);
    toast(parts.join(' · '));
    router.replace({ pathname: '/event/[id]', params: { id: editing.id } });
  };

  const saveDraft = () => {
    let firstId = '';
    for (let w = 0; w < occurrences; w++) {
      const id = saveEventDraft({ ...draft, start: shiftWeeks(startIso, w), end: shiftWeeks(endIso, w), subtitle: occurrences > 1 ? `Week ${w + 1} of ${occurrences}` : undefined });
      if (!firstId) firstId = id;
    }
    toast(issues.length ? `Draft saved · ${plural(issues.length, 'thing')} to finish` : occurrences > 1 ? `${occurrences} draft dates saved` : 'Draft saved');
    router.replace({ pathname: '/event-created', params: { id: firstId } });
  };

  const publish = () => {
    let firstId = '';
    for (let w = 0; w < occurrences; w++) {
      const id = addEvent({ ...draft, start: shiftWeeks(startIso, w), end: shiftWeeks(endIso, w), subtitle: occurrences > 1 ? `Week ${w + 1} of ${occurrences}` : undefined });
      if (!firstId) firstId = id;
    }
    // Tagged artists get a real booking request for the first date, unless one is already open for that day.
    const sent = requestLineup(firstId, lineup);
    const parts = [occurrences > 1 ? `${occurrences} weekly dates published` : 'Event published', sent ? `${plural(sent, 'booking request')} sent` : ''].filter(Boolean);
    toast(parts.join(' · '));
    router.replace({ pathname: '/event-created', params: { id: firstId } });
  };

  const finish = (kind: 'draft' | 'publish' | 'save') => {
    // Re-check every step first: earlier answers may have changed via "Edit details".
    const bad = [0, 1, 2].find((s) => validate(s));
    if (bad !== undefined) {
      setError(validate(bad));
      setStep(bad);
      return;
    }
    if (kind === 'publish' && (!canPublic || isPrivate)) {
      setError('Public events need an approved organizer account');
      return;
    }
    if ((kind === 'publish' || (kind === 'save' && !editingDraft)) && issues.length) {
      setError(`${kind === 'publish' ? 'Before publishing' : 'Before saving'}: ${issues[0]}`);
      return;
    }
    setError(undefined);
    if (kind === 'save') saveChanges();
    else if (kind === 'publish') publish();
    else saveDraft();
  };

  const next = () => {
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
    const nums = raw.replace(/[^\d]/g, '').slice(0, 4);
    const v = nums.length > 2 ? `${nums.slice(0, 2)}:${nums.slice(2)}` : nums;
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
  const deadlines = deadlineChoices(startIso);
  const lastStep = step === steps.length - 1;
  const publishLabel = oneTime ? 'Publish' : `Publish ${weeks} dates`;

  // ?edit=<id> only opens events you run, and only while they can still change (F13: owner only).
  const editBlock = !edit
    ? undefined
    : !editing
      ? { icon: 'calendar-remove-outline' as const, title: 'Event not found', body: 'This event may have been removed.' }
      : !hostsEvent(editing, user)
        ? { icon: 'account-lock-outline' as const, title: 'Only the host can edit this event', body: 'Changes to an event are made by the person who runs it.' }
        : (() => {
            const st = eventState(editing, bookings);
            if (st === 'cancelled') return { icon: 'calendar-remove-outline' as const, title: 'This event is cancelled', body: 'A cancelled event can’t be edited. Resolve its open bookings in the event workspace.' };
            if (st === 'completed') return { icon: 'history' as const, title: 'This event has ended', body: 'Past events can’t be edited.' };
            if (st === 'in_progress') return { icon: 'calendar-clock' as const, title: 'This event has started', body: 'Details can’t change once doors are open. Handle issues from the event workspace.' };
            return undefined;
          })();
  if (editBlock) {
    const own = !!editing && hostsEvent(editing, user);
    return (
      <Screen header={<ScreenHeader title="Edit event" onBack={() => goBack(editing ? `/event/${editing.id}` : '/my-events')} />}>
        <EmptyState
          icon={editBlock.icon}
          title={editBlock.title}
          body={editBlock.body}
          action={own ? 'Open event workspace' : editing ? 'View event' : 'My events'}
          onAction={() => router.replace((own && editing ? `/event-workspace/${editing.id}` : editing ? `/event/${editing.id}` : '/my-events') as never)}
        />
      </Screen>
    );
  }

  return (
    <Screen
      keyboard
      header={
        <ScreenHeader
          title={editing ? 'Edit event' : isPrivate ? 'Private event' : 'Public event'}
          subtitle={`Step ${step + 1} of ${steps.length} · ${steps[step]}`}
          onBack={() => {
            setError(undefined);
            if (step) setStep(step - 1);
            else goBack(editing ? `/event/${editing.id}` : '/(tabs)');
          }}
        />
      }
      footer={
        <BottomBar>
          {error ? <T v="small" color={colors.danger} style={{ marginBottom: 8 }}>{error}</T> : null}
          {!lastStep ? (
            <Button title="Next" onPress={next} />
          ) : editing ? (
            <Button title="Save changes" onPress={() => finish('save')} />
          ) : isPrivate ? (
            <Button title="Save draft" icon="content-save-outline" onPress={() => finish('draft')} />
          ) : (
            <Row gap={10}>
              <Button title="Save draft" variant="secondary" style={{ flex: 1 }} onPress={() => finish('draft')} />
              <Button title={publishLabel} style={{ flex: 1.3 }} onPress={() => finish('publish')} />
            </Row>
          )}
        </BottomBar>
      }
    >
      <Row gap={6}>
        {steps.map((s, i) => (
          <Pressable
            key={s}
            accessibilityRole="button"
            accessibilityLabel={`Step ${i + 1}: ${s}`}
            accessibilityState={{ selected: i === step, disabled: i > step }}
            disabled={i > step}
            onPress={() => {
              setError(undefined);
              setStep(i);
            }}
            style={{ flex: 1, gap: 6, minHeight: 44, justifyContent: 'center' }}
          >
            <View style={{ height: 5, borderRadius: 3, backgroundColor: i <= step ? colors.brand : colors.track }} />
            <T v="smallBold" style={{ fontSize: 11 }} color={i <= step ? colors.brand : colors.subtle}>{s}</T>
          </Pressable>
        ))}
      </Row>

      {step === 0 ? (
        <>
          {!editing ? (
            canPublic ? (
              <View style={{ gap: 8 }}>
                <T v="label">Visibility</T>
                <Segmented
                  options={[
                    { key: 'private', label: 'Private' },
                    { key: 'public', label: 'Public' },
                  ]}
                  value={visibility}
                  onChange={(k) => {
                    setVisibility(k);
                    setError(undefined);
                  }}
                />
                <T v="small">{isPrivate ? 'Invite only: guests get an invitation and, if you share costs, pay their part.' : 'Visible in Discover, Search and on the map once you publish.'}</T>
              </View>
            ) : (
              <PublicLocked user={user} />
            )
          ) : (
            <Row gap={8}>
              <Pill label={isPrivate ? 'Private · invite only' : 'Public'} icon={isPrivate ? 'lock-outline' : 'earth'} tone="neutral" />
              {editingDraft ? <Pill label="Draft" tone="neutral" /> : null}
            </Row>
          )}
          <View style={{ height: 190, borderRadius: radius.xl, overflow: 'hidden' }}>
            <Photo src={cover} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <Pressable accessibilityRole="button" accessibilityLabel="Change cover from your library" onPress={() => setLibrary(true)} style={{ position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.92)' }}>
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
          <Field
            label="Event name"
            value={title}
            onChangeText={(t) => {
              setTitle(t);
              if (error) setError(undefined);
            }}
            placeholder={isPrivate ? 'e.g. Lena’s 30th on the rooftop' : 'e.g. Bunker Floor Vol. 8'}
            maxLength={60}
          />
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
          <Field
            label="Expected guests"
            value={expected}
            onChangeText={(v) => setExpected(digits(v, 99999))}
            keyboardType="number-pad"
            icon="account-group-outline"
            accessibilityLabel="Expected guests"
            error={expected !== '' && guestsN <= 0 ? 'Required' : undefined}
          />
          {!editing && !isPrivate ? (
            <Row gap={12}>
              <View style={{ flex: 1 }}><T v="bodyBold">One-time event</T><T v="small">{oneTime ? 'Turn off for a weekly series' : `Repeats every ${shortDate(startIso).split(' ')[0]} for ${weeks} weeks`}</T></View>
              <Toggle label="One-time event" value={oneTime} onValueChange={setOneTime} />
            </Row>
          ) : null}
          {!oneTime && !editing && !isPrivate ? (
            <Row justify="space-between">
              <View style={{ flex: 1 }}><T v="label">Number of weeks</T><T v="small">Last date {shortDate(isoDay(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7 * (weeks - 1), 12)))}</T></View>
              <Stepper value={weeks} onChange={setWeeks} min={2} max={12} label="weeks" />
            </Row>
          ) : null}
          {!isPrivate ? (
            <View style={{ gap: 8 }}>
              <T v="label">Line up · tag musicians</T>
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
              <T v="small">
                {lineup.length
                  ? `${plural(lineup.length, 'artist')} tagged. Each gets a separate booking request, linked to this event, when you publish. A tagged artist is not confirmed until they accept and the payment is verified.`
                  : 'Tagged artists get a booking request when you publish.'}
              </T>
            </View>
          ) : (
            <Banner icon="account-music-outline">After saving, find artists and a venue. Each request is a separate booking linked to this event, with its own answer and payment.</Banner>
          )}
        </>
      ) : null}

      {step === 1 ? (
        <>
          <T v="h3">{isPrivate ? 'Where is it?' : 'Select on the map'}</T>
          <View style={{ height: width * 0.7, borderRadius: radius.xl, overflow: 'hidden' }}>
            <Photo src="map_berlin" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            {venueList.map((v) => {
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
            {canLeaveVenueOpen ? (
              <Pressable accessibilityRole="radio" accessibilityLabel="Venue not decided yet" accessibilityState={{ checked: !venueId }} onPress={() => setVenueId('')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, minHeight: 60, borderRadius: 14, borderWidth: !venueId ? 2 : 1, borderColor: !venueId ? colors.brand : colors.border, backgroundColor: colors.surface }}>
                <View style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="map-marker-question-outline" size={24} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <T v="bodyBold">Not decided yet</T>
                  <T v="small">Save the draft and find a venue afterwards</T>
                </View>
                {!venueId ? <Icon name="check" size={22} color={colors.brand} /> : null}
              </Pressable>
            ) : null}
            {venueList.map((v) => (
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
          {clashText ? (
            <Banner icon="calendar-alert" tone="danger">{`${clashText}. ${editing && !editingDraft ? 'Pick another venue, date or time.' : 'Your draft can be saved, but it can’t go live until this is resolved.'}`}</Banner>
          ) : venue ? (
            <Banner icon="information-outline">{`${venue.name} fits ${venue.capacity} people. Choosing it here doesn’t book it: send ${venue.name} a request from the next steps. It is a separate booking with its own answer and payment.`}</Banner>
          ) : (
            <Banner icon="information-outline">No venue yet. Your draft is saved without one; you can open invitations or publish once a venue is set.</Banner>
          )}
          {venue && guestsN > venue.capacity ? <Banner icon="account-alert-outline" tone="warning">{`You expect ${guestsN} guests, but ${venue.name} holds ${venue.capacity}.`}</Banner> : null}
          {venue ? <Button title={`Open ${venue.name}`} variant="ghost" size="sm" icon="storefront-outline" onPress={() => router.push(`/venue/${venue.id}`)} /> : null}
          <Field label="Description" value={description} onChangeText={setDescription} multiline placeholder={isPrivate ? 'Dress code, what to bring, the plan for the night' : 'What should people expect?'} />
        </>
      ) : null}

      {step === 2 && isPrivate ? (
        <>
          {keepsPrivateTickets ? (
            <Banner icon="ticket-confirmation-outline">This private event already uses ticket types. They stay as they are.</Banner>
          ) : (
            <Field label="Guest limit" value={guestLimit} onChangeText={(v) => setGuestLimit(digits(v, 99999))} keyboardType="number-pad" icon="account-multiple-outline" error={limitN <= 0 ? 'Required' : undefined} />
          )}
          {venue ? <T v="small" color={totalCapacity > venue.capacity ? colors.danger : colors.muted}>{totalCapacity} of {venue.capacity} places at {venue.name}</T> : null}
          <Card style={{ gap: 12 }}>
            <Row gap={12}>
              <View style={{ flex: 1 }}>
                <T v="bodyBold">Share costs with guests</T>
                <T v="small">Each guest who accepts pays a contribution and then gets a ticket with a QR code.</T>
              </View>
              {costLocked ? <Pill label="Locked" icon="lock-outline" tone="neutral" /> : <Toggle label="Share costs with guests" value={costOn} onValueChange={setCostOn} />}
            </Row>
            {costLocked && editing?.costSharing ? (
              <Banner icon="lock-outline">{`${plural(guestsBefore?.paid ?? 0, 'guest')} already paid ${euro(editing.costSharing.perGuest)}, so the contribution${editing.costSharing.deadline ? ` and pay-by date (${shortDate(editing.costSharing.deadline)})` : ''} stay as they are.`}</Banner>
            ) : costOn ? (
              <>
                <Field label="Contribution per guest (€)" value={costAmount} onChangeText={(v) => setCostAmount(digits(v, 9999))} keyboardType="number-pad" error={costN <= 0 ? 'Required' : costN > MAX_PRICE ? `Max €${MAX_PRICE}` : undefined} />
                <View style={{ gap: 8 }}>
                  <T v="label">Pay by</T>
                  <Row gap={8} style={{ flexWrap: 'wrap' }}>
                    <Chip label="No deadline" selected={!costDeadline} onPress={() => setCostDeadline(undefined)} />
                    {costDeadline && !deadlines.some((d) => d.day === costDeadline) ? <Chip label={`Current · ${shortDate(costDeadline)}`} selected onPress={() => setCostDeadline(costDeadline)} /> : null}
                    {deadlines.map((d) => <Chip key={d.day} label={`${d.label} · ${shortDate(d.day)}`} selected={costDeadline === d.day} onPress={() => setCostDeadline(d.day)} />)}
                  </Row>
                </View>
                <Field label="What it covers (optional)" value={costNote} onChangeText={setCostNote} placeholder="e.g. DJ and rooftop hire" maxLength={80} />
                {costN > 0 && guestsN > 0 ? <T v="small">{`If ${guestsN} guests accept and pay: ${euro(costN * guestsN)} towards your costs.`}</T> : null}
              </>
            ) : null}
          </Card>
          <Row gap={12}>
            <View style={{ flex: 1 }}><T v="bodyBold">18+ only</T><T v="small">ID is checked at the door</T></View>
            <Toggle label="18+ only" value={adults} onValueChange={setAdults} />
          </Row>
          <Banner icon="information-outline">A failed payment issues no ticket. You can change cost sharing from Invite guests until the first guest has paid.</Banner>
        </>
      ) : null}

      {step === 2 && !isPrivate ? (
        <>
          <Segmented options={[{ key: 'free', label: 'Free entry' }, { key: 'paid', label: 'Paid tickets' }]} value={paid ? 'paid' : 'free'} onChange={(k) => setPaid(k === 'paid')} />
          {paid ? (
            tickets.map((t, i) => (
              <View key={t.id} style={{ gap: 10, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
                <Row justify="space-between">
                  <T v="caption">TICKET TYPE {i + 1}</T>
                  {tickets.length > 1 ? <IconButton name="trash-can-outline" label="Remove ticket type" size={44} iconSize={18} color={colors.danger} onPress={() => setTickets(tickets.filter((_, j) => j !== i))} /> : null}
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
            <Field label="Guest limit" value={guestLimit} onChangeText={(v) => setGuestLimit(digits(v, 99999))} keyboardType="number-pad" error={limitN <= 0 ? 'Required' : undefined} />
          )}
          {venue ? <T v="small" color={totalCapacity > venue.capacity ? colors.danger : colors.muted}>{totalCapacity} of {venue.capacity} places at {venue.name}</T> : <T v="small">{totalCapacity} places · venue not chosen yet</T>}
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
          {paid ? <Banner icon="cash-multiple">Ticket sales show in your event workspace and in Earnings.</Banner> : null}
        </>
      ) : null}

      {step === 3 ? (
        <>
          <T v="small">{isPrivate ? 'This is how invited guests will see your event.' : 'This is how people will see your event in the feed and on the map.'}</T>
          {/* A picture of the card only: the event doesn't exist yet, so its buttons must not navigate or save. */}
          <View style={{ pointerEvents: 'none' }} accessible accessibilityLabel={`Preview of ${draft.title}`}>
            <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <EventCard event={{ ...draft, id: 'preview', organizerId: 'me', going: 0, rating: 0, distanceKm: 0.5 }} />
            </View>
          </View>
          <View style={{ gap: 6, backgroundColor: colors.surface, padding: 16, borderRadius: radius.lg }}>
            <Row justify="space-between"><T v="body" color={colors.muted}>Visibility</T><T v="bodyBold">{isPrivate ? 'Private · invite only' : 'Public · feed & map'}</T></Row>
            <Row justify="space-between"><T v="body" color={colors.muted}>When</T><T v="bodyBold">{shortDate(startIso)}, {startTime}–{endIso.slice(11, 16)}</T></Row>
            {occurrences > 1 ? <Row justify="space-between"><T v="body" color={colors.muted}>Series</T><T v="bodyBold">Weekly · {weeks} dates</T></Row> : null}
            <Row justify="space-between"><T v="body" color={colors.muted}>Expected guests</T><T v="bodyBold">{guestsN}</T></Row>
            <Row justify="space-between"><T v="body" color={colors.muted}>{isPrivate ? 'Guest limit' : 'Tickets'}</T><T v="bodyBold">{isPrivate ? totalCapacity : `${totalCapacity} across ${plural(finalTickets.length, 'type')}`}</T></Row>
            <Row justify="space-between"><T v="body" color={colors.muted}>Venue</T><T v="bodyBold">{venue?.name ?? 'Not decided yet'}</T></Row>
            {isPrivate ? (
              <Row justify="space-between"><T v="body" color={colors.muted}>Cost sharing</T><T v="bodyBold">{costOn && costN > 0 ? `${euro(costN)} per guest` : 'Free for guests'}</T></Row>
            ) : (
              <Row justify="space-between"><T v="body" color={colors.muted}>Line up</T><T v="bodyBold">{lineup.length ? `${plural(lineup.length, 'artist')} tagged` : 'None yet'}</T></Row>
            )}
          </View>

          {issues.length ? (
            <Card style={{ gap: 8, borderWidth: 1, borderColor: colors.warningBg }}>
              <Row gap={8}>
                <Icon name="clipboard-alert-outline" size={20} color={colors.warning} />
                <T v="bodyBold" color={colors.warning}>{editing && !editingDraft ? 'Fix before saving' : isPrivate ? 'To finish before inviting guests' : 'To finish before publishing'}</T>
              </Row>
              {issues.map((i) => (
                <Row key={i} gap={8} align="flex-start">
                  <Icon name="circle-small" size={20} color={colors.warning} />
                  <T v="small" color={colors.inkSoft} style={{ flex: 1 }}>{i}</T>
                </Row>
              ))}
              {!editing || editingDraft ? <T v="small">You can still save the draft now and finish it later.</T> : null}
            </Card>
          ) : (
            <Banner icon="check-circle-outline" tone="success">Nothing missing or conflicting.</Banner>
          )}

          {dateChanged && activeLinked.length ? (
            <Banner icon="calendar-sync-outline" tone="warning">{`A new date doesn’t move your ${plural(activeLinked.length, 'provider booking')}. When you save, each provider is asked to accept the new time; until then the agreed terms stay.`}</Banner>
          ) : null}
          {!editing && isPrivate ? <T v="small">Next: find artists and a venue, then invite guests.</T> : null}
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
              <IconButton name="close" label="Close library" size={44} onPress={() => setLibrary(false)} />
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
