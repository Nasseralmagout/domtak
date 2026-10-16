import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { BackHandler, View } from 'react-native';

import { ActionSheet, ReasonSheet } from '../../components/ActionSheet';
import { PersonRow } from '../../components/cards';
import { BottomBar, DemoBar, goBack, Screen, ScreenHeader } from '../../components/layout';
import { Avatar, Banner, Button, Card, Divider, EmptyState, Icon, type IconName, IconButton, KeyValue, PaymentPill, Photo, Pill, ProgressBar, Row, StatusPill, T, TimeLeft } from '../../components/ui';
import { profileById } from '../../data/mock';
import type { Booking } from '../../data/types';
import { bookingRef, cancellationOutcome, isClosed, isOutstanding, providerOf } from '../../lib/booking';
import { hostsEvent, invitationLabel, readinessLine } from '../../lib/eventHost';
import { budget, type BudgetLine, draftIssues, EVENT_STATE_NEXT, EVENT_STATE_TONE, eventState, eventStateLabel, guestSummary, linkedBookings, readiness } from '../../lib/events';
import { euro, eventWhen, plural, shortDate } from '../../lib/format';
import { toast } from '../../store/toast';
import { activeWorkspace, APPLICATION_STATUS_LABEL, canPublishPublicEvents, isApproved, useApp, useEvent, useVenue } from '../../store/useApp';
import { colors, radius } from '../../theme';

const CANCEL_REASONS = ['The date no longer works', 'Not enough guests', 'Venue or artist unavailable', 'Personal reasons', 'Something else'];

const BUDGET_PILL: Record<BudgetLine['status'], { label: string; tone: 'success' | 'warning' | 'brand' }> = {
  agreed: { label: 'Agreed', tone: 'success' },
  pending: { label: 'Not confirmed', tone: 'warning' },
  quote: { label: 'Quote requested', tone: 'brand' },
};

function Section({ title, icon, right, children }: { title: string; icon: IconName; right?: ReactNode; children: ReactNode }) {
  return (
    <Card style={{ gap: 12 }}>
      <Row justify="space-between" gap={8}>
        <Row gap={8} style={{ flex: 1 }}>
          <Icon name={icon} size={20} color={colors.brand} />
          <T v="h3" accessibilityRole="header" style={{ flex: 1 }}>{title}</T>
        </Row>
        {right}
      </Row>
      {children}
    </Card>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <View accessible accessibilityLabel={`${value} ${label}`} style={{ flex: 1, padding: 10, borderRadius: radius.sm, backgroundColor: colors.brandTint, alignItems: 'center' }}>
      <T v="h3">{value}</T>
      <T v="small" style={{ fontSize: 12 }} numberOfLines={1}>{label}</T>
    </View>
  );
}

/** One provider booking with its own status, payment and actions (bookings stay independent). */
function BookingRow({ b, cancelled, onCancel }: { b: Booking; cancelled: boolean; onCancel: (b: Booking) => void }) {
  const p = providerOf(b);
  const closed = isClosed(b.status);
  const awaitingQuote = b.pricing === 'quote' && !b.quote?.items.length;
  const needsDecision = cancelled && !closed && b.status !== 'completed';
  return (
    <View style={{ gap: 8, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: closed ? colors.border : needsDecision ? colors.warningBg : colors.border, backgroundColor: closed ? colors.chipIdle : colors.surface }}>
      <Row gap={12}>
        <Avatar src={p.image} size={44} label={p.name} />
        <View style={{ flex: 1 }}>
          <T v="bodyBold" numberOfLines={1}>{p.name}</T>
          <T v="small" numberOfLines={1}>{p.kind === 'venue' ? 'Venue' : 'Artist'} · {shortDate(b.date)} · {bookingRef(b)}</T>
        </View>
        <T v="bodyBold">{awaitingQuote ? 'Quote' : euro(b.amount)}</T>
      </Row>
      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        <StatusPill booking={b} />
        <PaymentPill state={b.payment} />
        {b.status === 'pending' || b.status === 'requested' ? <TimeLeft deadline={b.deadline} /> : null}
      </Row>
      {needsDecision ? <T v="small" color={colors.warning}>{`The event is cancelled, but this booking is still open. Cancel it or agree new terms. ${cancellationOutcome(b)}`}</T> : null}
      {closed ? <T v="small">{`${p.name} won’t take part. Your other bookings are not affected.`}</T> : null}
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        <Button title="View request" size="sm" variant="secondary" accessibilityLabel={`View request with ${p.name}`} onPress={() => router.push(`/booking/${b.id}`)} />
        {!cancelled && (closed || isOutstanding(b.status)) ? (
          <Button title="Find alternative" size="sm" variant="light" accessibilityLabel={`Find an alternative to ${p.name}`} onPress={() => router.push(p.kind === 'venue' ? '/venues' : '/artists/all')} />
        ) : null}
        {needsDecision ? <Button title="Cancel booking" size="sm" variant="danger" accessibilityLabel={`Cancel booking with ${p.name}`} onPress={() => onCancel(b)} /> : null}
      </Row>
    </View>
  );
}

export default function EventWorkspace() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id);
  const venue = useVenue(event?.venueId);
  const user = useApp((s) => s.user);
  const bookings = useApp((s) => s.bookings);
  const setEventState = useApp((s) => s.setEventState);
  const linkBooking = useApp((s) => s.linkBooking);
  const cancelEvent = useApp((s) => s.cancelEvent);
  const cancelBooking = useApp((s) => s.cancelBooking);
  const setInvitationStatus = useApp((s) => s.setInvitationStatus);
  const [review, setReview] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Booking>();
  const [showLink, setShowLink] = useState(false);

  const linked = useMemo(() => (event ? linkedBookings(event, bookings) : []), [event, bookings]);
  // Bookings you already made that are not attached to any event yet (you can link them here).
  const unlinked = useMemo(() => bookings.filter((b) => !b.eventId && b.type !== 'lesson' && !isClosed(b.status) && b.status !== 'completed' && !linked.some((l) => l.id === b.id)), [bookings, linked]);

  // Android back leaves the change/cancel review first.
  useEffect(() => {
    if (!review) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setReview(false);
      return true;
    });
    return () => sub.remove();
  }, [review]);

  const listHref = activeWorkspace(user) === 'organizer' ? '/pro/events' : '/my-events';

  if (!event) {
    return (
      <Screen header={<ScreenHeader title="Event workspace" onBack={() => goBack(listHref)} />}>
        <EmptyState icon="calendar-remove-outline" title="Event not found" body="This event may have been removed. Pick another one from your events." action="My events" onAction={() => router.replace(listHref as never)} />
      </Screen>
    );
  }
  if (!hostsEvent(event, user)) {
    return (
      <Screen header={<ScreenHeader title="Event workspace" onBack={() => goBack(`/event/${event.id}`)} />}>
        <EmptyState icon="account-lock-outline" title="Only the host can manage this event" body="The event workspace shows provider bookings, budget and guests to the person who runs the event." action="View event" onAction={() => router.replace(`/event/${event.id}`)} />
      </Screen>
    );
  }

  const state = eventState(event, bookings);
  const r = readiness(event, bookings);
  const money = budget(event, bookings);
  const g = guestSummary(event);
  const issues = state === 'draft' ? draftIssues(event) : [];
  const cs = event.costSharing?.enabled && event.costSharing.perGuest > 0 ? event.costSharing : undefined;
  const sold = event.ticketTypes.reduce((n, t) => n + t.sold, 0);
  const capacity = event.ticketTypes.reduce((n, t) => n + t.capacity, 0);
  const revenue = event.ticketTypes.reduce((n, t) => n + t.sold * t.price, 0);
  const cancelled = state === 'cancelled';
  const ended = state === 'completed';
  const active = !cancelled && !ended;
  const activeLinked = linked.filter((b) => !isClosed(b.status) && b.status !== 'completed');
  const lineupWithoutRequest = event.isPrivate ? [] : event.lineup.filter((aid) => !linked.some((b) => b.targetId === aid && b.type === 'musician' && !isClosed(b.status)));
  const hasVenueBooking = linked.some((b) => b.type === 'venue' && !isClosed(b.status));
  const invitations = event.invitations ?? [];
  const waitingGuest = invitations.find((i) => i.status === 'invited');
  const unpaidGuest = cs ? invitations.find((i) => i.status === 'accepted' && !i.paid) : undefined;
  const guestTickets = cs ? g.paid : g.accepted;
  const back = () => (review ? setReview(false) : goBack(listHref));

  const goLive = () => {
    if (!setEventState(event.id, 'published')) {
      toast('Public events need an approved organizer account');
      return;
    }
    toast(event.isPrivate ? 'Invitations are open' : 'Event published');
  };

  const submitCancel = (reason: string, note: string) => {
    const full = note ? `${reason}: ${note}` : reason;
    cancelEvent(event.id, full);
    setReview(false);
    toast(activeLinked.length ? `Event cancelled · ${plural(activeLinked.length, 'booking')} still to resolve` : 'Event cancelled');
  };

  const target = cancelTarget;
  const targetName = target ? providerOf(target).name : '';

  // ---------- Change or cancel: review the consequences first (F13) ----------
  if (review) {
    const notified = g.accepted + g.waiting;
    return (
      <Screen header={<ScreenHeader title="Change or cancel" subtitle={event.title} onBack={back} />}>
        <T v="body" color={colors.muted}>Check who is affected before you change or cancel. Nothing is sent until you confirm.</T>

        <Section title={`Providers (${activeLinked.length})`} icon="account-music-outline">
          {activeLinked.length === 0 ? <T v="small">No open provider bookings, so no provider needs to agree to anything.</T> : null}
          {activeLinked.map((b) => {
            const p = providerOf(b);
            return (
              <View key={b.id} style={{ gap: 6 }}>
                <Row justify="space-between" gap={8}>
                  <T v="bodyBold" style={{ flex: 1 }}>{p.name}</T>
                  <StatusPill booking={b} />
                </Row>
                <Row gap={8} align="flex-start">
                  <Icon name="calendar-edit" size={18} color={colors.brand} />
                  <T v="small" style={{ flex: 1 }}>{`New date or details: ${p.name} is asked to accept them. The booking keeps its agreed terms until they do.`}</T>
                </Row>
                <Row gap={8} align="flex-start">
                  <Icon name="close-circle-outline" size={18} color={colors.danger} />
                  <T v="small" style={{ flex: 1 }}>{`Cancel event: the booking is not cancelled automatically. You then cancel it or agree new terms. ${cancellationOutcome(b)}`}</T>
                </Row>
                <Divider style={{ marginTop: 4 }} />
              </View>
            );
          })}
        </Section>

        <Section title="Guests and tickets" icon="account-group-outline">
          {event.isPrivate ? (
            <>
              <KeyValue k="Accepted" v={String(g.accepted)} />
              <KeyValue k="Not answered yet" v={String(g.waiting)} />
              <KeyValue k="Guest tickets issued" v={String(guestTickets)} />
              {cs ? <KeyValue k="Contributions paid" v={`${euro(money.contributionsPaid)} from ${plural(g.paid, 'guest')}`} /> : null}
              <T v="small">{notified ? `${plural(notified, 'guest')} will be told about a change or cancellation.` : 'Nobody has been invited yet.'}{cs && g.paid ? ' Paid contributions need a refund decision: rules for contribution refunds are not final yet, so each one is tracked until it is resolved.' : ''}</T>
            </>
          ) : (
            <>
              <KeyValue k="Tickets sold" v={`${sold} of ${capacity}`} />
              <KeyValue k="Refund policy" v={event.refundPolicy} />
              <T v="small">{sold ? `${plural(sold, 'ticket holder')} will be told. Refunds follow your policy and are complete only once the payment provider confirms them.` : 'No tickets sold yet.'}</T>
            </>
          )}
        </Section>

        <Card style={{ gap: 10 }}>
          <Button title="Change date or details" icon="calendar-edit" variant="secondary" onPress={() => router.push({ pathname: '/create-event', params: { edit: event.id } })} />
          <T v="small">A new date doesn’t move your provider bookings: each provider is asked to accept it.</T>
          <Divider />
          <Button title="Cancel event" icon="calendar-remove-outline" variant="danger" onPress={() => setReasonOpen(true)} />
          <T v="small">{activeLinked.length ? `${plural(activeLinked.length, 'provider booking')} stay open until you resolve each one.` : 'Guests are notified when you cancel.'}</T>
        </Card>

        <ReasonSheet
          visible={reasonOpen}
          title="Cancel this event?"
          body={`${notified ? `${plural(notified, 'guest')} will be notified. ` : ''}${activeLinked.length ? `${plural(activeLinked.length, 'provider booking')} stay open until you cancel each one or agree new terms.` : 'There are no open provider bookings.'}`}
          reasons={CANCEL_REASONS}
          confirmLabel="Cancel event"
          destructive
          notePlaceholder="Message for guests and providers (optional)"
          onSubmit={submitCancel}
          onClose={() => setReasonOpen(false)}
        />
      </Screen>
    );
  }

  const publicLocked = !event.isPrivate && !canPublishPublicEvents(user);
  const lockedHref = isApproved(user, 'organizer') ? '/workspace' : user.application?.role === 'organizer' ? '/application' : '/apply?role=organizer';
  const lockedLabel = isApproved(user, 'organizer') ? 'Switch to organizer workspace' : user.application?.role === 'organizer' ? `Organizer application: ${APPLICATION_STATUS_LABEL[user.application.status].toLowerCase()}` : 'Apply as organizer';

  return (
    <Screen
      header={
        <ScreenHeader
          title="Event workspace"
          subtitle={event.title}
          onBack={back}
          right={<IconButton name="eye-outline" label="View event page" onPress={() => router.push(`/event/${event.id}`)} />}
        />
      }
      footer={
        active ? (
          <BottomBar>
            <Row gap={10}>
              <Button title="Edit" icon="pencil-outline" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/create-event', params: { edit: event.id } })} />
              <Button title="Invite guests" icon="account-plus-outline" size="md" style={{ flex: 1.4 }} onPress={() => router.push(`/invite?event=${event.id}`)} />
            </Row>
          </BottomBar>
        ) : null
      }
    >
      <Card padded={false} style={{ overflow: 'hidden' }}>
        <Row gap={12} style={{ padding: 12 }} align="flex-start">
          <Photo src={event.cover} style={{ width: 76, height: 76 }} radius={14} accessibilityLabel={`${event.title} cover`} />
          <View style={{ flex: 1, gap: 4 }}>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              <Pill label={eventStateLabel(state, event.isPrivate)} tone={EVENT_STATE_TONE[state]} />
              <Pill label={event.isPrivate ? 'Private' : 'Public'} icon={event.isPrivate ? 'lock-outline' : 'earth'} tone="neutral" />
            </Row>
            <T v="title" numberOfLines={2}>{event.title}</T>
            <T v="small">{eventWhen(event.start, event.end)}</T>
            <T v="small" numberOfLines={1}>{venue ? `${venue.name}, ${venue.area}` : 'Venue not decided yet'}{event.expectedGuests ? ` · ${event.expectedGuests} expected` : ''}</T>
          </View>
        </Row>
        <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
          <Row gap={8} style={{ padding: 10, borderRadius: radius.sm, backgroundColor: colors.brandTint }}>
            <Icon name="arrow-right-circle-outline" size={18} color={colors.brand} />
            <T v="smallBold" color={colors.brand} style={{ flex: 1 }}>Next: {EVENT_STATE_NEXT[state]}</T>
          </Row>
          {state === 'in_progress' ? <Button title="Check in guests" icon="qrcode-scan" size="sm" onPress={() => router.push({ pathname: '/pro/scan', params: { eventId: event.id } })} /> : null}
          {ended ? <Button title="Report a problem" icon="lifebuoy" size="sm" variant="secondary" onPress={() => router.push('/help')} /> : null}
        </View>
      </Card>

      {cancelled ? (
        <Banner icon="calendar-remove-outline" tone="danger">
          {`Cancelled${event.cancelledAt ? ` on ${shortDate(event.cancelledAt)}` : ''}${event.cancelReason ? `: ${event.cancelReason}` : ''}. Provider bookings are not cancelled automatically: resolve each one below.`}
        </Banner>
      ) : null}

      {state === 'draft' ? (
        issues.length ? (
          <Card style={{ gap: 8 }}>
            <Row gap={8}>
              <Icon name="clipboard-alert-outline" size={20} color={colors.warning} />
              <T v="bodyBold" color={colors.warning}>{`Draft · ${plural(issues.length, 'thing')} to finish`}</T>
            </Row>
            {issues.map((i) => (
              <Row key={i} gap={8} align="flex-start">
                <Icon name="circle-small" size={20} color={colors.warning} />
                <T v="small" color={colors.inkSoft} style={{ flex: 1 }}>{i}</T>
              </Row>
            ))}
            <Button title="Finish in the editor" icon="pencil-outline" size="sm" variant="light" style={{ alignSelf: 'flex-start' }} onPress={() => router.push({ pathname: '/create-event', params: { edit: event.id } })} />
          </Card>
        ) : publicLocked ? (
          <Card style={{ gap: 8 }}>
            <T v="bodyBold">Public events need an approved organizer account</T>
            <T v="small">Your draft is complete. Publishing it is for approved organizers working in their organizer workspace.</T>
            <Button title={lockedLabel} icon="shield-account-outline" size="sm" variant="light" style={{ alignSelf: 'flex-start' }} onPress={() => router.push(lockedHref as never)} />
          </Card>
        ) : (
          <Card style={{ gap: 8 }}>
            <Row gap={8}>
              <Icon name="check-circle-outline" size={20} color={colors.success} />
              <T v="bodyBold" color={colors.success}>Draft complete</T>
            </Row>
            <T v="small">{event.isPrivate ? 'Open invitations so the guests you invite can see the event and answer.' : 'Publish to show the event in Discover, Search and on the map. Providers still awaiting a reply are not shown as confirmed.'}</T>
            <Button title={event.isPrivate ? 'Open invitations' : 'Publish event'} icon={event.isPrivate ? 'email-fast-outline' : 'earth'} size="md" onPress={goLive} />
          </Card>
        )
      ) : null}

      <Section title="Providers" icon="account-music-outline" right={r.total ? <Pill label={`${r.confirmed}/${r.total} confirmed`} tone={r.ready ? 'success' : 'warning'} /> : undefined}>
        <T v="bodyBold" color={r.ready ? colors.success : r.total ? colors.warning : colors.ink}>{readinessLine(r)}</T>
        {r.total ? <ProgressBar value={r.confirmed / r.total} color={r.ready ? colors.success : colors.brand} label={readinessLine(r)} /> : null}
        <T v="small">
          {r.ready
            ? 'Every provider is confirmed.'
            : r.total
              ? 'The event stays partly arranged until every provider confirms. Each booking has its own answer, deadline and payment.'
              : 'Find an artist or a venue. Each request is a separate booking linked to this event.'}
        </T>
        {linked.map((b) => <BookingRow key={b.id} b={b} cancelled={cancelled} onCancel={setCancelTarget} />)}
        {active
          ? lineupWithoutRequest.map((aid) => {
              const a = profileById(aid);
              if (!a) return null;
              return (
                <Row key={aid} gap={12} style={{ padding: 12, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderStrong }}>
                  <Avatar src={a.avatar} size={40} />
                  <View style={{ flex: 1 }}>
                    <T v="bodyBold" numberOfLines={1}>{a.name}</T>
                    <T v="small">In the line up · no request sent yet</T>
                  </View>
                  <Button title="Request" size="sm" accessibilityLabel={`Send ${a.name} a booking request`} onPress={() => router.push({ pathname: '/booking/new', params: { type: 'musician', id: aid, eventId: event.id } })} />
                </Row>
              );
            })
          : null}
        {active ? (
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            <Button title="Find an artist" icon="account-music-outline" size="sm" variant="light" onPress={() => router.push('/artists/all')} />
            {!hasVenueBooking ? (
              venue ? (
                <Button title={`Request ${venue.name}`} icon="storefront-outline" size="sm" variant="light" onPress={() => router.push({ pathname: '/booking/new', params: { type: 'venue', id: venue.id, eventId: event.id } })} />
              ) : (
                <Button title="Find a venue" icon="storefront-outline" size="sm" variant="light" onPress={() => router.push('/venues')} />
              )
            ) : null}
          </Row>
        ) : null}
        {active && unlinked.length ? (
          <View style={{ gap: 8 }}>
            <Button
              title={showLink ? 'Hide your other bookings' : `Link a booking you already made (${unlinked.length})`}
              icon={showLink ? 'chevron-up' : 'link-variant'}
              size="sm"
              variant="ghost"
              style={{ alignSelf: 'flex-start' }}
              accessibilityState={{ expanded: showLink }}
              onPress={() => setShowLink(!showLink)}
            />
            {showLink
              ? unlinked.map((b) => {
                  const p = providerOf(b);
                  const otherDay = b.date !== event.start.slice(0, 10);
                  return (
                    <Row key={b.id} gap={10} style={{ padding: 10, borderRadius: radius.md, backgroundColor: colors.chipIdle }}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <T v="bodyBold" numberOfLines={1}>{p.name} · {b.eventTitle}</T>
                        <Row gap={6} style={{ flexWrap: 'wrap' }}>
                          <StatusPill booking={b} />
                          {otherDay ? <Pill label={`Booked for ${shortDate(b.date)}`} tone="warning" icon="calendar-alert" /> : null}
                        </Row>
                      </View>
                      <Button
                        title="Link"
                        size="sm"
                        accessibilityLabel={`Link the ${p.name} booking to ${event.title}`}
                        onPress={() => {
                          linkBooking(event.id, b.id);
                          toast(`${p.name} linked · its status and payment stay separate`);
                        }}
                      />
                    </Row>
                  );
                })
              : null}
          </View>
        ) : null}
      </Section>

      <Section title="Budget" icon="calculator-variant-outline">
        {money.items.length === 0 ? (
          <T v="small">No costs yet. Each provider’s price shows here as separate lines (fee, travel, equipment, catering, security) once you send a request.</T>
        ) : (
          <View style={{ gap: 10 }}>
            {money.items.map((i, idx) => (
              <Row key={`${i.label}-${idx}`} gap={10} align="flex-start" accessibilityLabel={`${i.label}, ${BUDGET_PILL[i.status].label}${i.status === 'quote' ? '' : `, ${euro(i.amount)}`}`}>
                <View style={{ flex: 1, gap: 4 }}>
                  <T v="body">{i.label}</T>
                  <Pill label={BUDGET_PILL[i.status].label} tone={BUDGET_PILL[i.status].tone} />
                </View>
                <T v="bodyBold">{i.status === 'quote' ? '—' : euro(i.amount)}</T>
              </Row>
            ))}
            <Divider />
            <KeyValue k="Agreed" v={euro(money.agreed)} color={colors.success} />
            <KeyValue k="Not confirmed yet" v={euro(money.pending)} />
            <KeyValue k="Total if all confirm" v={euro(money.total)} strong />
          </View>
        )}
        {cs ? (
          <>
            <Divider />
            <KeyValue k="Guest contributions expected" v={`${euro(money.contributions)} (${g.accepted} × ${euro(cs.perGuest)})`} />
            <KeyValue k="Contributions paid" v={euro(money.contributionsPaid)} />
          </>
        ) : null}
        {!event.isPrivate && revenue > 0 ? <KeyValue k="Ticket sales so far" v={euro(revenue)} /> : null}
        <T v="small">Each provider is paid separately. An amount awaiting a provider’s decision is not charged unless they accept and the payment is verified.</T>
      </Section>

      <Section
        title="Guests"
        icon="account-group-outline"
        right={active ? <Button title="Invite" icon="account-plus-outline" size="sm" variant="light" onPress={() => router.push(`/invite?event=${event.id}`)} /> : undefined}
      >
        {!event.isPrivate ? (
          <View style={{ gap: 8 }}>
            <Row justify="space-between">
              <T v="label">Tickets sold</T>
              <T v="smallBold">{sold} / {capacity}</T>
            </Row>
            <ProgressBar value={capacity ? sold / capacity : 0} label={`${sold} of ${capacity} tickets sold`} />
            <Button title="Guests and tickets" icon="ticket-confirmation-outline" size="sm" variant="secondary" style={{ alignSelf: 'flex-start' }} onPress={() => router.push(`/pro/attendees/${event.id}`)} />
          </View>
        ) : null}
        {event.isPrivate || invitations.length ? (
          <>
            <Row gap={8}>
              <Stat value={g.invited} label="Invited" />
              <Stat value={g.accepted} label="Accepted" />
              <Stat value={g.waiting} label="No answer" />
              {cs ? <Stat value={g.paid} label="Paid" /> : <Stat value={g.declined} label="Declined" />}
            </Row>
            {event.isPrivate ? (
              <Row gap={8} style={{ padding: 10, borderRadius: radius.sm, backgroundColor: colors.chipIdle }}>
                <Icon name="cash-multiple" size={18} color={colors.label} />
                <T v="small" style={{ flex: 1 }}>{cs ? `Cost sharing: ${euro(cs.perGuest)} per guest${cs.deadline ? ` · pay by ${shortDate(cs.deadline)}` : ''}${cs.note ? ` · ${cs.note}` : ''}` : 'Free for guests: no cost sharing'}</T>
                {active ? <Button title="Change" size="sm" variant="ghost" accessibilityLabel="Change cost sharing" onPress={() => router.push(`/invite?event=${event.id}`)} /> : null}
              </Row>
            ) : null}
            {invitations.length === 0 ? (
              <T v="small">No guests invited yet. Invite friends or people you follow; they see the event only through your invitation.</T>
            ) : (
              invitations.map((inv) => {
                const st = invitationLabel(inv, cs);
                return <PersonRow key={inv.profileId} id={inv.profileId} subtitle={profileById(inv.profileId)?.handle} right={<Pill label={st.label} tone={st.tone} />} />;
              })
            )}
            <T v="small">A declined invitation doesn’t change any booking. A failed payment issues no ticket.</T>
          </>
        ) : null}
        {active && event.isPrivate && (waitingGuest || unpaidGuest) ? (
          <DemoBar title="Demo: guest replies" note="Guests answer from their own invitation. These shortcuts record an answer so you can see the host view update.">
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {waitingGuest ? (
                <>
                  <Button title={`${profileById(waitingGuest.profileId)?.name ?? 'Guest'} accepts`} size="sm" variant="secondary" onPress={() => setInvitationStatus(event.id, waitingGuest.profileId, 'accepted', cs ? false : undefined)} />
                  <Button title={`${profileById(waitingGuest.profileId)?.name ?? 'Guest'} declines`} size="sm" variant="secondary" onPress={() => setInvitationStatus(event.id, waitingGuest.profileId, 'declined')} />
                </>
              ) : null}
              {unpaidGuest ? <Button title={`${profileById(unpaidGuest.profileId)?.name ?? 'Guest'} pays ${cs ? euro(cs.perGuest) : ''}`} size="sm" variant="secondary" onPress={() => setInvitationStatus(event.id, unpaidGuest.profileId, 'accepted', true)} /> : null}
            </Row>
          </DemoBar>
        ) : null}
      </Section>

      {active ? (
        <Card style={{ gap: 8 }}>
          <T v="title">Change or cancel event</T>
          <T v="small">See which providers, guests and tickets are affected, and what happens to each payment, before you confirm.</T>
          <Button title="Review a change or cancellation" icon="calendar-edit" variant="secondary" size="md" onPress={() => setReview(true)} />
        </Card>
      ) : null}

      <ActionSheet
        visible={!!target}
        title={target ? `Booking with ${targetName}` : undefined}
        cancelLabel="Keep booking for now"
        onClose={() => setCancelTarget(undefined)}
        actions={
          target
            ? [
                {
                  label: 'Cancel this booking',
                  icon: 'close-circle-outline',
                  destructive: true,
                  sub: cancellationOutcome(target),
                  onPress: () => {
                    cancelBooking(target.id, `Event cancelled${event.cancelReason ? `: ${event.cancelReason}` : ''}`);
                    toast(`Booking with ${targetName} cancelled`);
                  },
                },
                { label: 'Open booking to agree new terms', icon: 'open-in-new', sub: 'Keep the provider for a new date instead', onPress: () => router.push(`/booking/${target.id}`) },
              ]
            : []
        }
      />
    </Screen>
  );
}
