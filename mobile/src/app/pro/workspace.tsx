import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateBadge } from '../../components/cards';
import { ConversationList, DayStrip, Panel, PanelEmpty, QueueRow, Stat } from '../../components/dashboard';
import { goBack } from '../../components/layout';
import { Avatar, Banner, BookAgainBadge, Button, Checklist, type ChecklistItem, Chip, Icon, type IconName, IconButton, InfoRow, KeyValue, LineItems, PaymentPill, Pill, ProgressBar, Row, StatusPill, Steps, Stepper, T, TagCounts, TimeLeft } from '../../components/ui';
import { attendees, eventDiscussion, gardenLine, parkingLine, profileById, venueGarden, venueParking } from '../../data/mock';
import type { Booking, EventItem, EventState, IncomingRequest, ProfessionalRole, Venue } from '../../data/types';
import { PRO_ROLE_PITCH, PRO_ROLE_TITLE, WORKSPACE_ICON, WORKSPACE_LABEL } from '../../lib/access';
import { CHARGE_LABEL, isClosed, isOutstanding, PAYMENT_PROVIDER_LABEL, providerOf, quoteState, reminderDue, requestConflict, timeLeft, type Tone } from '../../lib/booking';
import { availabilityStrip, byDay, earningsSummary, eventDay, requestGross } from '../../lib/dashboards';
import { DEMO_ORGANIZERS, hostsEvent, readinessLine } from '../../lib/eventHost';
import { budget, EVENT_STATE_TONE, eventState, eventStateLabel, guestSummary, type Readiness, readiness } from '../../lib/events';
import { addHours, ago, dateTime, euro, hoursUntil, isoDay, parse, plural, shortDate, time, TODAY } from '../../lib/format';
import { PLATFORM_COMMISSION_RATE, securityRequired, venueEstimate } from '../../lib/pricing';
import { scoreBasis, scoreLabel } from '../../lib/ratings';
import { isDiscoverable } from '../../store/filters';
import { OWN_ARTIST_ID, servicesChecklist, useArtist, useServices } from '../../store/services';
import { toast } from '../../store/toast';
import { activeWorkspace, APPLICATION_STATUS_LABEL, APPLICATION_STATUS_TONE, OWN_VENUE_ID, useActionQueue, useAllEvents, useApp, useArtistScore, useRating, useVenue } from '../../store/useApp';
import { colors, fonts, radius, shadow } from '../../theme';

/**
 * Professional workspace (blueprint section 11): one dashboard per approved role.
 * Artist: requests due, confirmed work, calendar, profile readiness, earnings.
 * Venue: requests due, upcoming events, space and equipment, availability, earnings.
 * Organizer: event status, unresolved bookings, budget, guest operations, event messages.
 * Without an approved, active professional role it shows the application status instead (F02).
 */

const KIND_LABEL: Record<NonNullable<IncomingRequest['kind']>, string> = { performance: 'Performance', venue: 'Venue hire', lesson: 'Lesson' };
const REVIEW_TARGET_HOURS = 24;
const pct = `${Math.round(PLATFORM_COMMISSION_RATE * 100)}%`;
const todayIso = isoDay(TODAY);
const deadlineMs = (r: IncomingRequest) => (r.deadline ? parse(r.deadline).getTime() : Number.MAX_SAFE_INTEGER);
const upcomingEvent = (e: EventItem) => parse(e.end).getTime() >= TODAY.getTime();
const VERIFIED = ['paid', 'payout_pending', 'paid_out'];

type NavItem = { key: string; icon: IconName; label: string; href: string; badge?: number; a11y?: string };

/** Workspace sections per role (blueprint navigation), minus Overview, which is this screen. */
function navFor(role: ProfessionalRole, due: number): NavItem[] {
  if (role === 'musician') {
    return [
      { key: 'requests', icon: 'inbox-arrow-down', label: 'Requests', href: '/pro/requests', badge: due, a11y: 'Booking requests' },
      { key: 'calendar', icon: 'calendar-month-outline', label: 'Calendar', href: '/(tabs)/calendar' },
      { key: 'availability', icon: 'calendar-check', label: 'Availability', href: '/pro/availability' },
      { key: 'services', icon: 'tag-text-outline', label: 'Services', href: '/pro/services', a11y: 'Services, pricing and lessons' },
      { key: 'profile', icon: 'account-music-outline', label: 'Profile', href: `/artist/${OWN_ARTIST_ID}`, a11y: 'Public profile and media' },
      { key: 'earnings', icon: 'wallet-outline', label: 'Earnings', href: '/pro/earnings' },
      { key: 'messages', icon: 'message-text-outline', label: 'Messages', href: '/inbox' },
    ];
  }
  if (role === 'venue') {
    return [
      { key: 'requests', icon: 'inbox-arrow-down', label: 'Requests', href: '/pro/requests', badge: due, a11y: 'Venue booking requests' },
      { key: 'calendar', icon: 'calendar-check', label: 'Calendar', href: '/pro/availability', a11y: 'Venue availability calendar' },
      { key: 'listing', icon: 'storefront-edit-outline', label: 'Listing', href: '/pro/venue-listing', a11y: 'Pricing, equipment, parking, outdoor space, catering and security' },
      { key: 'page', icon: 'storefront-outline', label: 'Venue page', href: `/venue/${OWN_VENUE_ID}`, a11y: 'Public venue page' },
      { key: 'earnings', icon: 'wallet-outline', label: 'Earnings', href: '/pro/earnings' },
      { key: 'messages', icon: 'message-text-outline', label: 'Messages', href: '/inbox' },
    ];
  }
  return [
    { key: 'events', icon: 'calendar-star', label: 'Events', href: '/pro/events' },
    { key: 'new', icon: 'calendar-plus', label: 'New event', href: '/create-event' },
    { key: 'bookings', icon: 'account-music-outline', label: 'Bookings', href: '/my-bookings?tab=musician', a11y: 'Provider bookings' },
    { key: 'entry', icon: 'qrcode-scan', label: 'Entry', href: '/pro/scan', a11y: 'Scan tickets at the door' },
    { key: 'messages', icon: 'message-text-outline', label: 'Messages', href: '/inbox' },
    { key: 'profile', icon: 'account-circle-outline', label: 'Profile', href: '/profile/me' },
  ];
}

function NavTiles({ items }: { items: NavItem[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
      {items.map((a) => (
        <Pressable
          key={a.key}
          accessibilityRole="button"
          accessibilityLabel={`${a.a11y ?? a.label}${a.badge ? `, ${a.badge} due` : ''}`}
          onPress={() => router.push(a.href as never)}
          style={({ pressed }) => ({ width: 82, alignItems: 'center', gap: 6, paddingVertical: 10, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.85 : 1 })}
        >
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={a.icon} size={21} color={colors.brand} />
          </View>
          <T v="smallBold" numberOfLines={1} style={{ fontSize: 12 }}>{a.label}</T>
          {a.badge ? (
            <View style={{ position: 'absolute', top: 6, right: 8, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.warningStrong, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
              <Text style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: 11 }}>{a.badge}</Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** The single most urgent thing, on top of every dashboard. */
function NextAction({ icon, title, sub, tone = 'brand', cta, onPress }: { icon: IconName; title: string; sub: string; tone?: Tone; cta: string; onPress: () => void }) {
  const fg = tone === 'danger' ? colors.danger : tone === 'warning' ? colors.warningStrong : tone === 'success' ? colors.success : colors.brand;
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: 16, gap: 12, borderLeftWidth: 5, borderLeftColor: fg, ...shadow(2) }}>
      <T v="caption">NEXT ACTION</T>
      <Row gap={12} align="flex-start">
        <Icon name={icon} size={26} color={fg} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="title">{title}</T>
          <T v="small">{sub}</T>
        </View>
      </Row>
      <Button title={cta} size="md" onPress={onPress} />
    </View>
  );
}

function priceLabel(r: IncomingRequest) {
  if (r.pricing === 'quote') return !r.quote || r.quote.version === 0 ? 'Quote requested' : `Your quote v${r.quote.version} · ${euro(r.quote.total)}`;
  return euro(r.offer);
}

/** A request waiting for a response: host, date, size, requirements and time remaining. */
function RequestDueRow({ r, all, venue }: { r: IncomingRequest; all: IncomingRequest[]; venue?: Venue }) {
  const kind = r.kind ?? 'performance';
  const conflict = requestConflict(r, all);
  const overCapacity = venue && r.guests > venue.capacity;
  const security = venue && securityRequired(venue, r.guests);
  const requirements = [r.equipment, r.message].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${r.requester}, ${r.title}, ${r.isoDate ? shortDate(r.isoDate) : r.date}, ${plural(r.guests, 'guest')}, ${priceLabel(r)}, ${timeLeft(r.deadline) || 'no deadline'}. Open request`}
      onPress={() => router.push(`/pro/request/${r.id}`)}
      style={({ pressed }) => ({ gap: 8, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.85 : 1 })}
    >
      <Row gap={10}>
        <Avatar size={40} label={r.initials} />
        <View style={{ flex: 1 }}>
          <T v="bodyBold" numberOfLines={1}>{r.requester}</T>
          <T v="small" numberOfLines={1}>{r.requesterRole}</T>
        </View>
        <TimeLeft deadline={r.deadline} />
      </Row>
      <T v="title" numberOfLines={1}>{r.title}</T>
      <T v="small">{r.isoDate ? shortDate(r.isoDate) : r.date} · {r.time} · {KIND_LABEL[kind]}{kind !== 'venue' ? ` · ${r.hours} h` : ''} · {plural(r.guests, 'guest')}</T>
      {requirements ? <T v="small" numberOfLines={2} color={colors.inkSoft}>Requirements: {requirements}</T> : null}
      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        <Pill label={priceLabel(r)} tone={r.pricing === 'quote' ? 'warning' : 'neutral'} icon={r.pricing === 'quote' ? 'file-document-outline' : 'cash'} />
        {reminderDue(r) ? <Pill label="Reminder sent" tone="warning" icon="bell-ring-outline" /> : null}
        {conflict ? <Pill label={`Clashes with ${conflict.title}`} tone="danger" icon="calendar-alert" /> : null}
        {overCapacity ? <Pill label={`Over your capacity of ${venue.capacity}`} tone="danger" icon="account-group" /> : null}
        {security ? <Pill label="Security required at this size" tone="warning" icon="shield-account-outline" /> : null}
      </Row>
    </Pressable>
  );
}

/** Accepted work: date, event, agreed terms and the payment state as the provider sees it. */
function ConfirmedRow({ r, setup }: { r: IncomingRequest; setup?: boolean }) {
  const verified = !!r.payment && VERIFIED.includes(r.payment);
  const charges = r.charges
    ? (['travel', 'equipment', 'catering', 'security'] as const).filter((k) => r.charges?.[k]).map((k) => `${CHARGE_LABEL[k]} ${euro(r.charges?.[k] ?? 0)}`)
    : [];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${r.title}, ${r.isoDate ? shortDate(r.isoDate) : r.date}, ${r.time}, ${r.requester}, ${euro(requestGross(r))}${r.payment ? `, ${PAYMENT_PROVIDER_LABEL[r.payment]}` : ''}. Open booking`}
      onPress={() => router.push(`/pro/request/${r.id}`)}
      style={({ pressed }) => ({ flexDirection: 'row', gap: 12, paddingVertical: 8, opacity: pressed ? 0.8 : 1 })}
    >
      <DateBadge iso={r.isoDate ?? todayIso} size={52} />
      <View style={{ flex: 1, gap: 4 }}>
        <T v="bodyBold" numberOfLines={1}>{r.title}</T>
        <T v="small" numberOfLines={1}>{r.time} · {r.location.split(',')[0]} · {r.requester}</T>
        {setup ? <T v="small" numberOfLines={2} color={colors.inkSoft}>Setup: {plural(r.guests, 'guest')} · {r.equipment}</T> : null}
        <T v="small" color={colors.inkSoft}>Agreed {euro(requestGross(r))}{charges.length ? ` · incl. ${charges.join(', ')}` : ''}</T>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          <PaymentPill state={r.payment} provider />
        </Row>
        {!verified ? <T v="small" color={colors.warning}>Not confirmed until the customer’s payment is verified.</T> : null}
      </View>
    </Pressable>
  );
}

function EarningsPanel({ requests, recorded, venue }: { requests: IncomingRequest[]; recorded: boolean; venue?: boolean }) {
  const balance = useApp((s) => s.balance);
  const payouts = useApp((s) => s.payouts);
  const e = useMemo(() => earningsSummary(requests, { recorded, balance, payouts }), [requests, recorded, balance, payouts]);
  const empty = e.count === 0 && e.awaitingCount === 0 && e.refunds === 0 && e.available === 0 && e.paidOut === 0;
  return (
    <Panel title="Earnings" icon="wallet-outline" action="Details" onAction={() => router.push('/pro/earnings')} note={empty ? undefined : 'Booking value, commission, refunds and payouts are shown separately.'}>
      {empty ? (
        <PanelEmpty
          icon="cash-multiple"
          title={venue ? 'No venue payments yet' : 'No paid bookings yet'}
          body={venue ? 'Once a venue booking is paid, its booking value, commission and settlement status appear here.' : 'Once a booking is paid, its booking value, commission and payout status appear here.'}
        />
      ) : (
        <>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            <Stat label="Gross booking value" value={euro(e.gross)} sub={plural(e.count, 'paid booking')} icon="cash" />
            <Stat label={`Platform commission (${pct})`} value={`−${euro(e.commission)}`} icon="percent-outline" tone="neutral" />
            <Stat label="Refunds" value={e.refunds ? `−${euro(e.refunds)}` : euro(0)} icon="cash-refund" tone={e.refunds ? 'danger' : 'neutral'} />
            <Stat label="Net earnings" value={euro(e.net)} icon="wallet-outline" tone="success" />
          </Row>
          {recorded ? (
            <View style={{ gap: 2 }}>
              <KeyValue k="Available to pay out" v={euro(e.available)} />
              <KeyValue k="Payout pending" v={euro(e.payoutPending)} />
              {e.processing ? <KeyValue k="Transfers on the way" v={euro(e.processing)} /> : null}
              <KeyValue k="Paid out so far" v={euro(e.paidOut)} />
            </View>
          ) : (
            <KeyValue k="Payout pending" v={euro(e.payoutPending)} />
          )}
          {e.awaitingCount ? (
            <Banner icon="credit-card-clock-outline" tone="warning">{`${euro(e.awaiting)} from ${plural(e.awaitingCount, 'accepted booking')} is waiting for the customer’s verified payment and is not counted yet.`}</Banner>
          ) : null}
        </>
      )}
    </Panel>
  );
}

// ---------- Artist / band / DJ ----------

function ArtistDashboard() {
  const requests = useApp((s) => s.requests);
  const availability = useApp((s) => s.availability);
  const bookings = useApp((s) => s.bookings);
  const services = useServices((s) => s.services);
  const artist = useArtist(OWN_ARTIST_ID);
  const score = useArtistScore(OWN_ARTIST_ID);

  const mine = useMemo(() => requests.filter((r) => r.kind !== 'venue'), [requests]);
  const due = useMemo(() => mine.filter((r) => r.status === 'new').sort((a, b) => deadlineMs(a) - deadlineMs(b)), [mine]);
  const confirmed = useMemo(() => mine.filter((r) => r.status === 'accepted' && (r.isoDate ?? todayIso) >= todayIso).sort((a, b) => (a.isoDate ?? '').localeCompare(b.isoDate ?? '')), [mine]);
  const strip = useMemo(() => availabilityStrip(availability, byDay(confirmed, (r) => r.isoDate, (r) => r.title)), [availability, confirmed]);

  const checklist = useMemo<ChecklistItem[]>(() => {
    const toServices = () => router.push('/pro/services');
    const profile: ChecklistItem[] = [
      { label: 'Profile photo', done: !!artist?.avatar, hint: 'Add a clear photo of you or your act', onPress: () => router.push('/profile-setup') },
      { label: 'Bio of at least 40 characters', done: (artist?.bio ?? '').trim().length >= 40, hint: 'What you play and what a booking includes', onPress: () => router.push('/profile-setup') },
      { label: 'Genres', done: (artist?.genres.length ?? 0) > 0, hint: 'Pick the styles you perform', onPress: () => router.push('/profile-setup') },
      { label: 'At least 3 photos or videos', done: (artist?.gallery?.length ?? 0) >= 3, hint: 'Post media from your sets', onPress: () => router.push('/new-post') },
      { label: 'Usual days published', done: Object.values(availability.days).some(Boolean), hint: 'Show which days you usually take bookings', onPress: () => router.push('/pro/availability') },
    ];
    const svc = servicesChecklist({ ...services, feePerHour: availability.feePerHour }).map((i) => ({ label: i.label, done: i.done, hint: i.hint, onPress: toServices }));
    return [...profile, ...svc];
  }, [artist, availability, services]);
  const missing = checklist.filter((i) => !i.done);
  const openDays = strip.filter((d) => d.kind === 'open').length;

  const next = due[0];
  return (
    <>
      {next ? (
        <NextAction
          icon="timer-sand"
          tone={hoursUntil(next.deadline ?? addHours(TODAY, 48)) < 12 ? 'warning' : 'brand'}
          title={`Respond to ${next.requester}`}
          sub={`${next.title} · ${next.isoDate ? shortDate(next.isoDate) : next.date} · ${timeLeft(next.deadline) || 'no deadline'}. Unanswered requests expire after 24 hours and the customer’s payment is released.`}
          cta="Open request"
          onPress={() => router.push(`/pro/request/${next.id}`)}
        />
      ) : missing.length ? (
        <NextAction icon="account-edit-outline" title="Complete your profile" sub={`${missing[0].label}. ${plural(missing.length, 'item')} left before bookers see everything they need.`} cta="Fix it" onPress={() => missing[0].onPress?.()} />
      ) : (
        <NextAction icon="check-circle-outline" tone="success" title="No requests waiting" sub="Your profile and services are complete. New requests arrive with a 24-hour response window." cta="View public profile" onPress={() => router.push(`/artist/${OWN_ARTIST_ID}`)} />
      )}

      <NavTiles items={navFor('musician', due.length)} />

      <Panel title="Requests due" icon="inbox-arrow-down" count={due.length} action="All requests" onAction={() => router.push('/pro/requests')} note={due.length ? 'Soonest deadline first. Accept, decline or discuss the scope in each request.' : undefined}>
        {due.length ? (
          due.slice(0, 3).map((r) => <RequestDueRow key={r.id} r={r} all={mine} />)
        ) : (
          <PanelEmpty
            icon="inbox-outline"
            title="No requests waiting"
            body={missing.length ? `Bookers decide faster with a complete profile: ${missing.slice(0, 2).map((m) => m.label.toLowerCase()).join(' and ')}.` : 'Your profile is ready to be discovered. Requests arrive here with a 24-hour response window.'}
            actions={[{ label: 'Services and pricing', onPress: () => router.push('/pro/services') }]}
          />
        )}
      </Panel>

      <Panel title="Confirmed work" icon="briefcase-check-outline" count={confirmed.length} action={confirmed.length ? 'All accepted' : undefined} onAction={() => router.push('/pro/requests')}>
        {confirmed.length ? (
          confirmed.slice(0, 4).map((r) => <ConfirmedRow key={r.id} r={r} />)
        ) : (
          <PanelEmpty icon="calendar-blank-outline" title="No confirmed work yet" body="Accepted requests appear here with their date, agreed terms and payment state." />
        )}
      </Panel>

      <Panel title="Calendar" icon="calendar-month-outline" action="Update availability" onAction={() => router.push('/pro/availability')} note={`Next 2 weeks: ${plural(confirmed.filter((r) => strip.some((d) => d.iso === r.isoDate)).length, 'commitment')}, ${plural(openDays, 'open day')}. Open days never confirm a booking by themselves.`}>
        <DayStrip days={strip} />
      </Panel>

      <Panel title="Profile readiness" icon="account-check-outline">
        <Checklist items={checklist} title={missing.length ? 'Complete your profile' : 'Profile complete'} />
        <QueueRow
          icon="school-outline"
          tone="neutral"
          title={services.lessons.length ? `${plural(services.lessons.length, 'lesson')} offered` : 'No lessons offered'}
          sub="Lessons have their own prices and terms, separate from performances"
          onPress={() => router.push('/pro/services')}
        />
      </Panel>

      <Panel title="Reputation" icon="thumb-up-outline" action="Reviews" onAction={() => router.push(`/ratings/${OWN_ARTIST_ID}`)}>
        <Row gap={12}>
          <BookAgainBadge pct={score.recommendPct} total={score.total} />
          <View style={{ flex: 1 }}>
            <T v="bodyBold">{scoreLabel(score)}</T>
            <T v="small">{score.total ? scoreBasis(score) : 'Customers rate you after a completed booking through Domtak.'}</T>
          </View>
        </Row>
        <TagCounts tags={score.topTags} />
      </Panel>

      <EarningsPanel requests={mine} recorded />

      <Panel title="Messages" icon="message-text-outline" action="Inbox" onAction={() => router.push('/inbox')}>
        <ConversationList limit={2} bookings={bookings} />
      </Panel>
    </>
  );
}

// ---------- Venue ----------

function VenueDashboard() {
  const requests = useApp((s) => s.requests);
  const availability = useApp((s) => s.availability);
  const listing = useApp((s) => s.venueListing);
  const bookings = useApp((s) => s.bookings);
  const venueDraft = useServices((s) => s.venueDraft);
  const venue = useVenue(OWN_VENUE_ID);
  const rating = useRating(OWN_VENUE_ID);
  const allEvents = useAllEvents();
  const [guests, setGuests] = useState(Math.min(150, listing.capacity));

  const mine = useMemo(() => requests.filter((r) => r.kind === 'venue'), [requests]);
  const due = useMemo(() => mine.filter((r) => r.status === 'new').sort((a, b) => deadlineMs(a) - deadlineMs(b)), [mine]);
  const confirmed = useMemo(() => mine.filter((r) => r.status === 'accepted' && (r.isoDate ?? todayIso) >= todayIso).sort((a, b) => (a.isoDate ?? '').localeCompare(b.isoDate ?? '')), [mine]);
  const hereEvents = useMemo(() => allEvents.filter((e) => e.venueId === OWN_VENUE_ID && upcomingEvent(e) && isDiscoverable(e)).sort((a, b) => a.start.localeCompare(b.start)), [allEvents]);
  const strip = useMemo(
    () => availabilityStrip(availability, byDay(confirmed, (r) => r.isoDate, (r) => r.title), byDay(hereEvents, (e) => eventDay(e.start), (e) => e.title)),
    [availability, confirmed, hereEvents],
  );

  const edit = () => router.push('/pro/venue-listing');
  const checklist: ChecklistItem[] = [
    { label: 'At least 3 photos', done: listing.photos.length >= 3, hint: `${plural(listing.photos.length, 'photo')} added`, onPress: edit },
    { label: 'Description', done: listing.description.trim().length >= 40, hint: 'Rooms, sound and the events the space suits', onPress: edit },
    { label: 'Price per night or quote on request', done: listing.pricing === 'quote' || listing.pricePerNight > 0, hint: 'Set a nightly price or switch to quotes', onPress: edit },
    { label: 'Parking details', done: !!listing.parkingDetails, hint: 'Whether there is parking, what kind and how many spaces', onPress: edit },
    { label: 'Garden / outdoor space', done: !!listing.garden, hint: 'Whether there is outdoor space and how many guests it holds', onPress: edit },
    { label: 'Catering option', done: !!listing.catering, hint: 'Price per guest, or say it is not offered', onPress: edit },
    { label: 'Security option', done: !!listing.security, hint: 'Guests per guard and price per guard', onPress: edit },
    { label: 'House rules and requirements', done: (listing.requirements?.length ?? 0) > 0, hint: 'Age limit, deposit, curfew…', onPress: edit },
  ];
  const missing = checklist.filter((i) => !i.done);
  const parking = venueParking(listing);
  const garden = venueGarden(listing);
  const est = venue ? venueEstimate(venue, { guests, catering: true, security: true }) : undefined;
  const attendanceLines = (est?.items ?? []).filter((i) => i.key === 'catering' || i.key === 'security');
  const mustHaveSecurity = venue ? securityRequired(venue, guests) : false;

  const next = due[0];
  return (
    <>
      {next ? (
        <NextAction
          icon="timer-sand"
          tone={hoursUntil(next.deadline ?? addHours(TODAY, 48)) < 12 ? 'warning' : 'brand'}
          title={`Review ${next.requester}’s request`}
          sub={`${next.title} · ${next.isoDate ? shortDate(next.isoDate) : next.date} · ${plural(next.guests, 'guest')} · ${timeLeft(next.deadline) || 'no deadline'}`}
          cta="Inspect request"
          onPress={() => router.push(`/pro/request/${next.id}`)}
        />
      ) : venueDraft ? (
        <NextAction icon="content-save-edit-outline" title="Publish your listing changes" sub="You saved changes to your listing that hosts can’t see yet." cta="Open listing" onPress={edit} />
      ) : missing.length ? (
        <NextAction icon="storefront-edit-outline" title="Complete your listing" sub={`${missing[0].label}. Hosts compare these details before they send a request.`} cta="Edit listing" onPress={edit} />
      ) : (
        <NextAction icon="check-circle-outline" tone="success" title="No venue requests waiting" sub="Your listing is complete. Requests arrive with a 24-hour response window." cta="Preview venue page" onPress={() => router.push(`/venue/${OWN_VENUE_ID}`)} />
      )}

      <NavTiles items={navFor('venue', due.length)} />

      <Panel title="Requests due" icon="inbox-arrow-down" count={due.length} action="All requests" onAction={() => router.push('/pro/requests')} note={due.length ? 'Check the host, date, event size and requirements, then accept or decline.' : undefined}>
        {due.length ? (
          due.slice(0, 3).map((r) => <RequestDueRow key={r.id} r={r} all={mine} venue={venue} />)
        ) : (
          <PanelEmpty
            icon="inbox-outline"
            title="No venue requests waiting"
            body={missing.length ? `Hosts choose venues with complete details. Still missing: ${missing.slice(0, 2).map((m) => m.label.toLowerCase()).join(' and ')}.` : 'Requests from hosts arrive here with a 24-hour response window.'}
            actions={[{ label: 'Edit listing', onPress: edit }]}
          />
        )}
      </Panel>

      <Panel title="Upcoming events" icon="calendar-check-outline" count={confirmed.length} action={confirmed.length ? 'All accepted' : undefined} onAction={() => router.push('/pro/requests')}>
        {confirmed.length ? (
          confirmed.slice(0, 4).map((r) => <ConfirmedRow key={r.id} r={r} setup />)
        ) : (
          <PanelEmpty icon="calendar-blank-outline" title="No confirmed venue bookings" body="Accepted venue requests appear here with access and setup details. Open dates alone never create a confirmed event." />
        )}
        {hereEvents.length ? (
          <View style={{ gap: 2 }}>
            <T v="label">Listed at {listing.name} by their organizers</T>
            {hereEvents.slice(0, 3).map((e) => (
              <QueueRow key={e.id} icon="calendar-star" tone="neutral" title={e.title} sub={`${shortDate(e.start)} · ${time(e.start)}–${time(e.end)} · ${profileById(e.organizerId)?.name ?? 'Organizer'}`} onPress={() => router.push(`/event/${e.id}`)} />
            ))}
          </View>
        ) : null}
      </Panel>

      <Panel title="Space and equipment" icon="storefront-outline" action="Edit" onAction={edit} note="What hosts see on your venue page.">
        {venueDraft ? <Banner icon="content-save-edit-outline" tone="warning">You have saved changes that are not published yet.</Banner> : null}
        <Row justify="space-between" align="flex-start" gap={12}>
          <View style={{ flex: 1 }}>
            <T v="title">{listing.name}</T>
            <T v="small">{listing.type} · {listing.area}</T>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <T v="bodyBold">{listing.pricing === 'quote' ? 'Price on request' : `${euro(listing.pricePerNight)} / night`}</T>
            <Row gap={4} accessibilityLabel={rating.count ? `Rated ${rating.rating.toFixed(1)} out of 5 from ${plural(rating.count, 'review')}` : 'No reviews yet'}>
              <Icon name="star" size={14} color={colors.star} />
              <T v="small">{rating.count ? `${rating.rating.toFixed(1).replace('.', ',')} · ${plural(rating.count, 'review')}` : 'No reviews yet'}</T>
            </Row>
          </View>
        </Row>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          <Stat label="Capacity" value={plural(listing.capacity, 'guest')} icon="account-group-outline" />
          <Stat label="Rooms and stages" value={`${listing.rooms} · ${listing.stages}`} sub={`${plural(listing.rooms, 'room')}, ${plural(listing.stages, 'stage')}`} icon="door-open" />
        </Row>
        <View>
          <InfoRow icon="speaker" label="Equipment" value={listing.equipment || 'Not described yet'} available={!!listing.equipment} />
          <InfoRow icon="car" label="Parking" value={[parkingLine(listing), parking.available ? parking.notes : undefined].filter(Boolean).join(' · ')} available={parking.available} />
          <InfoRow icon="tree-outline" label="Garden / outdoor space" value={[gardenLine(listing), garden.available ? garden.notes : undefined].filter(Boolean).join(' · ')} available={garden.available} />
          <InfoRow
            icon="silverware-fork-knife"
            label="Catering"
            value={listing.catering?.available ? `${euro(listing.catering.pricePerGuest)} per guest${listing.catering.minGuests ? ` · minimum ${listing.catering.minGuests} guests` : ''}${listing.catering.notes ? ` · ${listing.catering.notes}` : ''}` : 'Not offered'}
            available={!!listing.catering?.available}
          />
          <InfoRow
            icon="shield-account-outline"
            label="Security"
            value={listing.security?.available ? `1 guard per ${listing.security.guestsPerGuard} guests · ${euro(listing.security.pricePerGuard)} per guard${listing.security.requiredFrom ? ` · required from ${listing.security.requiredFrom} guests` : ''}` : 'Not offered'}
            available={!!listing.security?.available}
          />
          {listing.extraCharges?.length ? <InfoRow icon="receipt-text-outline" label="Extra charges" value={listing.extraCharges.map((x) => `${x.label} ${euro(x.amount)}`).join(' · ')} /> : null}
          {listing.requirements?.length ? <InfoRow icon="clipboard-text-outline" label="Requirements" value={listing.requirements.join(' · ')} /> : null}
        </View>

        {listing.catering?.available || listing.security?.available ? (
          <View style={{ gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.brandTint }}>
            <Row justify="space-between">
              <View style={{ flex: 1 }}>
                <T v="bodyBold">Price by attendance</T>
                <T v="small">Catering and security change with the number of guests.</T>
              </View>
              <Stepper value={guests} onChange={setGuests} min={10} max={Math.max(10, listing.capacity)} step={10} label="guests" />
            </Row>
            {attendanceLines.length ? <LineItems items={attendanceLines.map((i) => ({ label: i.label, amount: i.amount, note: i.note }))} totalLabel={`For ${plural(guests, 'guest')}`} /> : <T v="small">No attendance-based charges at this size.</T>}
            {mustHaveSecurity ? <Pill label={`Security is required from ${listing.security?.requiredFrom} guests`} tone="warning" icon="shield-alert-outline" /> : null}
          </View>
        ) : null}

        <Checklist items={checklist} title="Listing status" />
        <Button title="Preview venue page" icon="eye-outline" size="sm" variant="light" style={{ alignSelf: 'flex-start' }} onPress={() => router.push(`/venue/${OWN_VENUE_ID}`)} />
      </Panel>

      <Panel title="Availability" icon="calendar-month-outline" action="Update calendar" onAction={() => router.push('/pro/availability')} note="Open dates and confirmed commitments for the next 2 weeks. A free date still needs your acceptance.">
        <DayStrip days={strip} kinds={['booked', 'event', 'blocked', 'open', 'closed']} />
      </Panel>

      <EarningsPanel requests={mine} recorded={false} venue />

      <Panel title="Messages" icon="message-text-outline" action="Inbox" onAction={() => router.push('/inbox')}>
        <ConversationList limit={2} bookings={bookings} />
      </Panel>
    </>
  );
}

// ---------- Organizer ----------

interface ManagedRow {
  e: EventItem;
  state: EventState;
  r: Readiness;
}

const STATE_ORDER: EventState[] = ['draft', 'planning', 'published', 'ready', 'in_progress', 'completed', 'cancelled'];

function needsAction(b: Booking) {
  if (b.status === 'payment_failed' || b.payment === 'failed' || b.status === 'change_requested') return true;
  if (b.status === 'accepted' && b.payment !== 'paid') return true;
  if (b.pendingCancellation && !isClosed(b.status)) return true;
  return b.pricing === 'quote' && !!b.quote && b.status === 'requested' && ['sent', 'revised'].includes(quoteState(b.quote));
}

function OrganizerDashboard() {
  const user = useApp((s) => s.user);
  const bookings = useApp((s) => s.bookings);
  const checkIns = useApp((s) => s.checkIns);
  const extraComments = useApp((s) => s.extraComments);
  const removed = useApp((s) => s.removedContent);
  const blocked = useApp((s) => s.blocked);
  const allEvents = useAllEvents();
  const queue = useActionQueue();
  const [budgetId, setBudgetId] = useState<string>();

  const managed = useMemo<ManagedRow[]>(
    () => allEvents.filter((e) => hostsEvent(e, user)).map((e) => ({ e, state: eventState(e, bookings), r: readiness(e, bookings) })),
    [allEvents, user, bookings],
  );
  const upcoming = useMemo(() => managed.filter((m) => upcomingEvent(m.e) && m.state !== 'completed').sort((a, b) => a.e.start.localeCompare(b.e.start)), [managed]);
  const counts = useMemo(() => {
    const c: Partial<Record<EventState, number>> = {};
    managed.forEach((m) => (c[m.state] = (c[m.state] ?? 0) + 1));
    return c;
  }, [managed]);
  const eventOf = useMemo(() => new Map(managed.map((m) => [m.e.id, m])), [managed]);
  const unresolved = useMemo(() => {
    const open = bookings.filter((b) => b.type !== 'lesson' && (isOutstanding(b.status) || (b.pendingCancellation && !isClosed(b.status) && b.status !== 'completed')));
    const toReplace = upcoming.flatMap((m) => m.r.closed);
    const rank = (b: Booking) => (needsAction(b) ? 0 : isClosed(b.status) ? 2 : 1);
    return [...open, ...toReplace.filter((b) => !open.includes(b))].sort((a, b) => rank(a) - rank(b) || (a.deadline ?? a.date).localeCompare(b.deadline ?? b.date));
  }, [bookings, upcoming]);

  const budgetRow = upcoming.find((m) => m.e.id === budgetId) ?? upcoming.find((m) => m.r.total > 0 || m.r.closed.length > 0) ?? upcoming[0];
  const money = budgetRow ? budget(budgetRow.e, bookings) : undefined;
  const ticketRevenue = budgetRow ? budgetRow.e.ticketTypes.reduce((n, t) => n + t.sold * t.price, 0) : 0;

  const discussion = (e: EventItem) => [...(eventDiscussion[e.id] ?? []), ...(extraComments[`event:${e.id}`] ?? [])].filter((c) => !removed.includes(c.id) && !blocked.includes(c.authorId));
  const checkedIn = (e: EventItem) => {
    const scanned = checkIns[e.id] ?? [];
    const sold = e.ticketTypes.reduce((n, t) => n + t.sold, 0);
    return (sold > 0 ? attendees.filter((a) => a.checkedIn && !scanned.includes(a.code)).length : 0) + scanned.length;
  };

  // A failed payment comes first, then change requests, quotes to review and payments to finalize.
  const urgent = (['payment', 'change', 'quote', 'booking'] as const).map((k) => queue.find((q) => q.kind === k)).find((q) => !!q);
  const draft = upcoming.find((m) => m.state === 'draft');
  const live = upcoming.find((m) => m.state === 'in_progress');
  const nextEvent = upcoming.find((m) => m.state !== 'cancelled' && m.state !== 'draft');
  const daysTo = (iso: string) => Math.max(0, Math.ceil((parse(iso).getTime() - TODAY.getTime()) / 86_400_000));

  return (
    <>
      {live ? (
        <NextAction icon="qrcode-scan" tone="success" title={`Doors are open: ${live.e.title}`} sub={`${checkedIn(live.e)} checked in so far. Scan each ticket once at the entrance.`} cta="Scan tickets" onPress={() => router.push({ pathname: '/pro/scan', params: { eventId: live.e.id } })} />
      ) : urgent ? (
        <NextAction icon={urgent.icon} tone={urgent.tone} title={urgent.title} sub={urgent.sub} cta="Open booking" onPress={() => router.push(urgent.href as never)} />
      ) : draft ? (
        <NextAction icon="file-document-edit-outline" title={`Finish your draft: ${draft.e.title}`} sub="Drafts stay private until you publish them." cta="Open event workspace" onPress={() => router.push(`/event-workspace/${draft.e.id}`)} />
      ) : nextEvent ? (
        <NextAction
          icon="calendar-star"
          title={`${nextEvent.e.title} · in ${plural(daysTo(nextEvent.e.start), 'day')}`}
          sub={`${eventStateLabel(nextEvent.state, nextEvent.e.isPrivate)}. ${readinessLine(nextEvent.r)}.`}
          cta="Open event workspace"
          onPress={() => router.push(`/event-workspace/${nextEvent.e.id}`)}
        />
      ) : (
        <NextAction icon="calendar-plus" title="Plan your first public event" sub="Create it as a draft, book artists and a venue, then publish when you’re ready." cta="Create an event" onPress={() => router.push('/create-event')} />
      )}

      <NavTiles items={navFor('organizer', 0)} />

      <Panel title="Event status" icon="calendar-star" action="All events" onAction={() => router.push('/pro/events')}>
        {managed.length ? (
          <>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              {STATE_ORDER.filter((s) => counts[s]).map((s) => (
                <Pill key={s} label={`${eventStateLabel(s)} · ${counts[s]}`} tone={EVENT_STATE_TONE[s]} />
              ))}
            </Row>
            {upcoming.slice(0, 4).map((m) => {
              const sold = m.e.ticketTypes.reduce((n, t) => n + t.sold, 0);
              const cap = m.e.ticketTypes.reduce((n, t) => n + t.capacity, 0);
              return (
                <Pressable
                  key={m.e.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${m.e.title}, ${shortDate(m.e.start)}, ${eventStateLabel(m.state, m.e.isPrivate)}, ${readinessLine(m.r)}. Open event workspace`}
                  onPress={() => router.push(`/event-workspace/${m.e.id}`)}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, opacity: pressed ? 0.75 : 1 })}
                >
                  <DateBadge iso={m.e.start} size={48} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <T v="bodyBold" numberOfLines={1}>{m.e.title}</T>
                    <Row gap={6} style={{ flexWrap: 'wrap' }}>
                      <Pill label={eventStateLabel(m.state, m.e.isPrivate)} tone={EVENT_STATE_TONE[m.state]} />
                      {m.e.isPrivate ? <Pill label="Private" icon="lock-outline" tone="neutral" /> : cap ? <Pill label={`${sold}/${cap} tickets`} icon="ticket-outline" tone="neutral" /> : null}
                    </Row>
                    <T v="small" numberOfLines={2}>{readinessLine(m.r)}</T>
                  </View>
                  <Icon name="chevron-right" size={20} color={colors.subtle} />
                </Pressable>
              );
            })}
            {!upcoming.length ? <T v="small">No upcoming events. Past events stay in your event list.</T> : null}
          </>
        ) : (
          <PanelEmpty icon="calendar-blank-outline" title="No events yet" body="Create a public event as a draft, arrange artists and a venue, then publish it." actions={[{ label: 'Create an event', primary: true, onPress: () => router.push('/create-event') }]} />
        )}
      </Panel>

      <Panel title="Unresolved bookings" icon="account-clock-outline" count={unresolved.length} note={unresolved.length ? 'Each provider booking has its own deadline and payment; resolving one never changes the others.' : undefined}>
        {unresolved.length ? (
          unresolved.slice(0, 5).map((b) => {
            const p = providerOf(b);
            const closed = isClosed(b.status);
            const linked = b.eventId ? eventOf.get(b.eventId)?.e.title : undefined;
            const priced = b.pricing !== 'quote' || (!!b.quote && b.quote.version > 0);
            const q = b.pricing === 'quote' && b.quote ? quoteState(b.quote) : undefined;
            return (
              <View key={b.id} style={{ gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
                <Row gap={12}>
                  <Avatar src={p.image} size={40} label={p.name} />
                  <View style={{ flex: 1 }}>
                    <T v="bodyBold" numberOfLines={1}>{p.name}</T>
                    <T v="small" numberOfLines={1}>{linked ?? b.eventTitle} · {shortDate(b.date)} · {priced ? euro(b.amount) : 'Quote requested'}</T>
                  </View>
                </Row>
                <Row gap={6} style={{ flexWrap: 'wrap' }}>
                  <StatusPill booking={b} />
                  {b.status === 'pending' ? <TimeLeft deadline={b.deadline} /> : null}
                  {q && (q === 'sent' || q === 'revised') && b.quote?.validUntil ? <Pill label={`Quote valid until ${shortDate(b.quote.validUntil)}`} tone="neutral" icon="calendar-clock" /> : null}
                </Row>
                <Row gap={8} style={{ flexWrap: 'wrap' }}>
                  <Button title={closed ? 'View record' : 'Follow up'} size="sm" variant={needsAction(b) ? 'primary' : 'secondary'} onPress={() => router.push(`/booking/${b.id}`)} />
                  {closed || b.status === 'pending' ? (
                    <Button title="Choose another provider" size="sm" variant="light" onPress={() => router.push(p.kind === 'venue' ? '/venues' : '/artists/all')} />
                  ) : null}
                </Row>
              </View>
            );
          })
        ) : (
          <PanelEmpty icon="check-circle-outline" title="No unresolved bookings" body="Provider requests waiting on a reply, a quote or a payment appear here with their deadline." actions={[{ label: 'Find artists', onPress: () => router.push('/artists/all') }, { label: 'Find venues', onPress: () => router.push('/venues') }]} />
        )}
      </Panel>

      <Panel title="Event budget" icon="calculator-variant-outline" action={budgetRow ? 'Line items' : undefined} onAction={() => budgetRow && router.push(`/event-workspace/${budgetRow.e.id}`)}>
        {budgetRow && money ? (
          <>
            {upcoming.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {upcoming.slice(0, 6).map((m) => (
                  <Chip key={m.e.id} label={m.e.title} selected={m.e.id === budgetRow.e.id} onPress={() => setBudgetId(m.e.id)} />
                ))}
              </ScrollView>
            ) : null}
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              <Stat label="Agreed provider costs" value={euro(money.agreed)} icon="check-circle-outline" tone="success" />
              <Stat label="Not confirmed yet" value={euro(money.pending)} icon="timer-sand" tone="warning" />
            </Row>
            {money.items.length ? (
              <LineItems items={money.items.map((i) => ({ label: i.label, amount: i.amount, note: i.status === 'agreed' ? 'Agreed' : i.status === 'quote' ? 'Waiting for a quote' : 'Not confirmed yet' }))} total={money.total} totalLabel="Provider costs" />
            ) : (
              <T v="small">No provider bookings are linked to {budgetRow.e.title} yet. Link or book providers in the event workspace.</T>
            )}
            {budgetRow.e.isPrivate && budgetRow.e.costSharing?.enabled ? (
              <KeyValue k="Guest contributions paid" v={`${euro(money.contributionsPaid)} of ${euro(money.contributions)}`} />
            ) : (
              <KeyValue k="Ticket sales so far (separate from costs)" v={euro(ticketRevenue)} />
            )}
          </>
        ) : (
          <PanelEmpty icon="calculator-variant-outline" title="No upcoming event to budget" body="Each event’s budget lists agreed provider costs and separate charges such as travel, equipment, catering and security." />
        )}
      </Panel>

      <Panel title="Guest operations" icon="account-group-outline">
        {upcoming.filter((m) => m.state !== 'cancelled' && m.state !== 'draft').length ? (
          upcoming
            .filter((m) => m.state !== 'cancelled' && m.state !== 'draft')
            .slice(0, 3)
            .map((m) => {
              const sold = m.e.ticketTypes.reduce((n, t) => n + t.sold, 0);
              const cap = m.e.ticketTypes.reduce((n, t) => n + t.capacity, 0);
              const g = guestSummary(m.e);
              const inside = checkedIn(m.e);
              return (
                <View key={m.e.id} style={{ gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
                  <Row justify="space-between" gap={8}>
                    <T v="bodyBold" numberOfLines={1} style={{ flex: 1 }}>{m.e.title}</T>
                    <T v="small">{m.state === 'in_progress' ? 'Doors open now' : `Doors ${shortDate(m.e.start)}, ${time(m.e.start)}`}</T>
                  </Row>
                  {m.e.isPrivate ? (
                    <T v="small">{g.invited ? `${g.accepted} accepted · ${g.waiting} no answer · ${g.declined} declined` : 'No guests invited yet'}</T>
                  ) : (
                    <>
                      <ProgressBar value={cap ? sold / cap : 0} label={`${sold} of ${cap} tickets sold`} />
                      <T v="small">{sold} of {cap} tickets sold · {inside} checked in</T>
                    </>
                  )}
                  <Row gap={8}>
                    <Button title="Guests" icon="account-group-outline" size="sm" variant="secondary" style={{ flex: 1 }} onPress={() => router.push(`/pro/attendees/${m.e.id}`)} />
                    <Button title="Scan tickets" icon="qrcode-scan" size="sm" variant={m.state === 'in_progress' ? 'primary' : 'light'} style={{ flex: 1 }} onPress={() => router.push({ pathname: '/pro/scan', params: { eventId: m.e.id } })} />
                  </Row>
                </View>
              );
            })
        ) : (
          <PanelEmpty icon="ticket-outline" title="No guests to manage yet" body="RSVPs, ticket sales and entry show up here once an event is published." />
        )}
      </Panel>

      <Panel title="Event messages" icon="forum-outline" action="Inbox" onAction={() => router.push('/inbox')}>
        {upcoming.length ? (
          upcoming.slice(0, 3).map((m) => {
            const list = discussion(m.e);
            const last = list[list.length - 1];
            return (
              <QueueRow
                key={m.e.id}
                icon="forum-outline"
                tone="neutral"
                title={`${m.e.title} · ${plural(list.length, 'message')}`}
                sub={last ? `${profileById(last.authorId)?.name ?? 'Guest'}: ${last.text}` : 'No messages in this event’s discussion yet'}
                onPress={() => router.push(`/event-comments/${m.e.id}`)}
              />
            );
          })
        ) : (
          <ConversationList limit={2} bookings={bookings} />
        )}
      </Panel>

      {user.role === 'organizer' && !managed.some((m) => m.e.organizerId === 'me') && managed.some((m) => DEMO_ORGANIZERS.includes(m.e.organizerId)) ? (
        <T v="small" center>Sample events from the demo organizer accounts are shown as yours.</T>
      ) : null}
    </>
  );
}

// ---------- Not approved yet (F02) ----------

function ApplicationGate() {
  const user = useApp((s) => s.user);
  const switchWorkspace = useApp((s) => s.switchWorkspace);
  const app = user.application;
  const approved = user.approvedRoles.filter((r): r is ProfessionalRole => r !== 'fan');
  const open = (role: ProfessionalRole) => {
    if (switchWorkspace(role)) toast(`Switched to your ${WORKSPACE_LABEL[role]} workspace`);
    else toast(`${WORKSPACE_LABEL[role]} needs an approved application first`);
  };
  const pendingApp = app && app.status !== 'approved' ? app : undefined;
  const reviewDue = pendingApp ? addHours(pendingApp.submittedAt, REVIEW_TARGET_HOURS) : undefined;
  const step = pendingApp ? (pendingApp.status === 'pending' ? 1 : 2) : 0;

  return (
    <>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: 18, gap: 10, ...shadow(2) }}>
        <T v="caption">PROFESSIONAL WORKSPACE</T>
        <T v="h2">{approved.length ? 'Choose a workspace' : pendingApp ? 'Your application' : 'Not set up yet'}</T>
        <T v="body" color={colors.muted}>
          {approved.length
            ? 'You’re approved for a professional workspace. Switch to it to answer requests, manage your listing or run events.'
            : pendingApp
              ? 'The workspace opens once your application is approved. You can follow its status here.'
              : 'Artists, bands, DJs, venues and organizers apply for a professional workspace. Members keep discovering, booking and hosting private events.'}
        </T>
        {approved.map((role) => (
          <Button key={role} title={`Open ${WORKSPACE_LABEL[role]} workspace`} icon={WORKSPACE_ICON[role]} size="md" onPress={() => open(role)} />
        ))}
      </View>

      {pendingApp ? (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 12, ...shadow(1) }}>
          <Row gap={12}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={WORKSPACE_ICON[pendingApp.role]} size={22} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="bodyBold">{PRO_ROLE_TITLE[pendingApp.role]}</T>
              <T v="small">Submitted {ago(pendingApp.submittedAt)} · {dateTime(pendingApp.submittedAt)}</T>
            </View>
            <Pill label={APPLICATION_STATUS_LABEL[pendingApp.status]} tone={APPLICATION_STATUS_TONE[pendingApp.status]} />
          </Row>
          <Steps
            steps={[
              { title: 'Submitted', note: dateTime(pendingApp.submittedAt) },
              { title: 'In review', note: `We aim to decide within ${REVIEW_TARGET_HOURS} hours` },
              { title: pendingApp.status === 'info' ? 'More information needed' : pendingApp.status === 'rejected' ? 'Not approved' : 'Decision', note: pendingApp.decidedAt ? dateTime(pendingApp.decidedAt) : undefined },
            ]}
            current={step}
            failed={pendingApp.status === 'info' || pendingApp.status === 'rejected'}
          />
          {pendingApp.status === 'pending' && reviewDue ? (
            hoursUntil(reviewDue) > 0 ? (
              <TimeLeft deadline={reviewDue} prefix="Review target:" />
            ) : (
              <Banner icon="clock-alert-outline" tone="warning">This review is taking longer than our 24-hour target. You don’t need to do anything; we’ll notify you of the outcome.</Banner>
            )
          ) : null}
          {pendingApp.status === 'info' ? (
            <View style={{ gap: 6 }}>
              <T v="label">Missing</T>
              {(pendingApp.missing?.length ? pendingApp.missing : [pendingApp.reason ?? 'See your application']).map((m) => (
                <Row key={m} gap={8}>
                  <Icon name="alert-circle-outline" size={16} color={colors.warning} />
                  <T v="small" color={colors.inkSoft} style={{ flex: 1 }}>{m}</T>
                </Row>
              ))}
            </View>
          ) : null}
          {pendingApp.status === 'rejected' && pendingApp.reason ? <Banner icon="information-outline" tone="danger">{pendingApp.reason}</Banner> : null}
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            <Button title="View application" size="sm" variant="secondary" onPress={() => router.push('/application')} />
            {pendingApp.status !== 'pending' ? <Button title="Update and resubmit" size="sm" onPress={() => router.push(`/apply?role=${pendingApp.role}`)} /> : null}
          </Row>
        </View>
      ) : null}

      {!approved.length && !pendingApp ? (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 4, ...shadow(1) }}>
          <T v="h3" style={{ marginBottom: 6 }}>Apply as</T>
          {(['musician', 'venue', 'organizer'] as const).map((role) => (
            <QueueRow key={role} icon={WORKSPACE_ICON[role]} title={PRO_ROLE_TITLE[role]} sub={PRO_ROLE_PITCH[role]} onPress={() => router.push(`/apply?role=${role}`)} />
          ))}
        </View>
      ) : null}

      <Banner icon="account-heart-outline">
        <View style={{ gap: 8 }}>
          <T v="small" color="#2E1D5E">Your member account keeps working: discover music, book artists and venues, and host private events.</T>
          <Button title="Member dashboard" icon="view-dashboard-outline" size="sm" variant="secondary" style={{ alignSelf: 'flex-start' }} onPress={() => router.push('/dashboard')} />
        </View>
      </Banner>
    </>
  );
}

// ---------- Screen ----------

const STATUS_LINE: Record<ProfessionalRole, string> = {
  musician: 'Requests, calendar, services and earnings',
  venue: 'Requests, listing, availability and earnings',
  organizer: 'Events, providers, budget and guests',
};

export default function Workspace() {
  const user = useApp((s) => s.user);
  const ws = activeWorkspace(user);
  const city = user.city.split(',')[0];
  const sub = ws === 'fan' ? 'Professional workspace · not active' : `${WORKSPACE_LABEL[ws]} workspace · Approved${city ? ` · ${city}` : ''}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.brandDeep, paddingBottom: 52 }}>
        <Row style={{ paddingHorizontal: 4, height: 56 }} gap={4}>
          <IconButton name="chevron-left" label="Back" color={colors.white} iconSize={30} onPress={() => goBack('/(tabs)')} />
          <Text style={{ flex: 1, color: colors.white, fontFamily: fonts.wordmark, fontSize: 24 }}>
            DOMTAK <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.brandDark, backgroundColor: colors.gold }}> PRO </Text>
          </Text>
          <IconButton name="swap-horizontal" label="Switch workspace" color={colors.lilac} onPress={() => router.push('/workspace')} />
          <IconButton name="cog-outline" label="Settings" color={colors.lilac} onPress={() => router.push('/settings')} />
        </Row>
        <Row gap={12} style={{ paddingHorizontal: 20, paddingTop: 4 }}>
          <Avatar src={user.avatar} size={52} label={user.name} verified={ws !== 'fan'} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.white, fontFamily: fonts.displaySemi, fontSize: 18 }}>Hi, {user.name.split(' ')[0]}</Text>
            <Text style={{ color: colors.lilacLight, fontFamily: fonts.body, fontSize: 13 }} numberOfLines={1}>{sub}</Text>
            {ws !== 'fan' ? <Text style={{ color: colors.lilac, fontFamily: fonts.body, fontSize: 12 }} numberOfLines={1}>{STATUS_LINE[ws]}</Text> : null}
          </View>
        </Row>
      </SafeAreaView>

      <ScrollView style={{ marginTop: -40 }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
        {ws === 'musician' ? <ArtistDashboard /> : ws === 'venue' ? <VenueDashboard /> : ws === 'organizer' ? <OrganizerDashboard /> : <ApplicationGate />}
      </ScrollView>
    </View>
  );
}
