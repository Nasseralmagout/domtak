import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArtistTile, BackOverlay, FollowButton, GoingFaces, HeartToggle } from '../../components/cards';
import { BottomBar, goBack } from '../../components/layout';
import { Avatar, Banner, Button, Card, EmptyState, Icon, type IconName, Photo, Pill, RatingBadge, Row, SectionTitle, Stars, T } from '../../components/ui';
import { eventDiscussion, profileById } from '../../data/mock';
import { isClosed, isConfirmed } from '../../lib/booking';
import { hostsEvent, readinessLine, waitingOn } from '../../lib/eventHost';
import { EVENT_STATE_TONE, eventState, eventStateLabel, guestSummary, linkedBookings, readiness } from '../../lib/events';
import { compact, euro, eventWhen, isoDay, parse, priceRange, shortDate as shortDateLabel } from '../../lib/format';
import { toast } from '../../store/toast';
import { useApp, useEvent, useVenue } from '../../store/useApp';
import { colors, fonts, radius, shadow } from '../../theme';

function InfoCard({ icon, title, sub, action, actionIcon, actionVariant = 'light', actionLabel, onAction }: { icon: IconName; title: string; sub: string; action?: string; actionIcon?: IconName; actionVariant?: 'light' | 'secondary'; actionLabel?: string; onAction?: () => void }) {
  return (
    <Row gap={14} style={{ backgroundColor: colors.surface, padding: 14, borderRadius: radius.lg, ...shadow(1) }}>
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brandDeep, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={26} color={colors.white} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="title">{title}</T>
        <T v="small">{sub}</T>
      </View>
      {action ? <Button title={action} icon={actionIcon} size="sm" variant={actionVariant} onPress={onAction} accessibilityLabel={actionLabel ?? `${action}: ${title}`} /> : null}
    </Row>
  );
}

function Stat({ icon, value, label, onPress }: { icon: IconName; value?: string; label: string; onPress?: () => void }) {
  const content = (
    <>
      {value ? <T v="bodyBold">{value}</T> : null}
      <Icon name={icon} size={22} color={colors.ink} />
    </>
  );
  const base = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, minHeight: 44, minWidth: 44, justifyContent: 'center' as const, paddingHorizontal: 4 };
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label} style={base}>
        {content}
      </View>
    );
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4} style={({ pressed }) => [base, { opacity: pressed ? 0.6 : 1 }]}>
      {content}
    </Pressable>
  );
}

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id);
  const going = useApp((s) => (id ? !!s.going[id] : false));
  const wished = useApp((s) => (id ? s.wishlist.events.includes(id) : false));
  const toggleGoing = useApp((s) => s.toggleGoing);
  const toggleWish = useApp((s) => s.toggleWish);
  const tickets = useApp((s) => s.tickets);
  const extraComments = useApp((s) => (id ? s.extraComments[`event:${id}`] : undefined));
  // Event reviews are stored under the event id (the same id /review/<id> and Your bookings use).
  const myReview = useApp((s) => (id ? s.reviews[id] : undefined));
  // The venue as its public page shows it, including the owner's listing edits.
  const venue = useVenue(event?.venueId);
  const [more, setMore] = useState(false);
  const user = useApp((s) => s.user);
  const bookings = useApp((s) => s.bookings);
  const guestInvites = useApp((s) => s.guestInvites);
  // Your invitation to this event, if you were invited as a guest (F20).
  const invite = useMemo(() => (id ? guestInvites.find((g) => g.eventId === id) : undefined), [guestInvites, id]);
  const linked = useMemo(() => (event ? linkedBookings(event, bookings) : []), [event, bookings]);

  if (!event) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ paddingHorizontal: 12, paddingTop: 4 }}>
          <BackOverlay onPress={() => goBack('/(tabs)/events')} />
        </View>
        <EmptyState icon="calendar-remove-outline" title="Event not found" body="This event may have been cancelled or the link is no longer valid." action="Browse events" onAction={() => router.replace('/(tabs)/events')} />
      </SafeAreaView>
    );
  }
  // Your own events, and the demo organizer's sample events in an approved organizer workspace, can be managed.
  const hosts = hostsEvent(event, user);
  // Private events are visible only to the host and invited guests (explicit invitations, blueprint F11).
  if (event.isPrivate && !hosts && !invite) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ paddingHorizontal: 12, paddingTop: 4 }}>
          <BackOverlay onPress={() => goBack('/(tabs)/events')} />
        </View>
        <EmptyState icon="lock-outline" title="Private event" body="Only people the host invited can see this event. Ask the host for an invitation." action="Browse events" onAction={() => router.replace('/(tabs)/events')} />
      </SafeAreaView>
    );
  }
  const state = eventState(event, bookings);
  const cancelled = state === 'cancelled';
  // Drafts and cancelled events take no RSVPs or ticket sales.
  const closedToGuests = cancelled || state === 'draft';
  const r = readiness(event, bookings);
  const g = guestSummary(event);
  const cs = event.costSharing?.enabled && event.costSharing.perGuest > 0 ? event.costSharing : undefined;
  const inviter = invite ? profileById(invite.fromId) : undefined;
  const inviterName = inviter?.name ?? 'The host';
  const contribution = invite?.contribution ?? 0;
  const inviteNeedsPayment = !!invite && invite.status === 'accepted' && contribution > 0 && !invite.ticketId;
  const organizer = event.organizerId === 'me' ? undefined : profileById(event.organizerId);
  const lineup = event.lineup.map((l) => profileById(l)).filter((p): p is NonNullable<typeof p> => !!p);
  const prices = event.ticketTypes.map((t) => t.price);
  // A ticket that was already scanned at the door still counts (and stays in the calendar, as there).
  const myTicket = tickets.find((t) => t.eventId === event.id && t.status === 'valid') ?? tickets.find((t) => t.eventId === event.id && t.status === 'used');
  const hasTicket = !!myTicket;
  const goingCount = event.going + (going ? 1 : 0);
  const commentCount = (eventDiscussion[event.id]?.length ?? 0) + (extraComments?.length ?? 0);
  // Same rule as the calendar tab: going, holding a valid ticket, or organizing it yourself.
  const inCalendar = going || hasTicket || event.organizerId === 'me';
  const longDescription = event.description.length > 160;
  // Line-up artists the host has not confirmed yet: never shown as confirmed while a booking is pending (F12).
  const unconfirmed = hosts
    ? lineup
        .map((a) => ({ a, b: linked.find((x) => x.targetId === a.id && x.type === 'musician' && !isClosed(x.status)) }))
        .filter(({ b }) => !b || !isConfirmed(b.status))
        .map(({ a, b }) => `${a.name} (${b ? waitingOn(b) : 'no request sent'})`)
    : [];
  const openInvitation = () => (invite ? router.push(invite.ticketId ? `/ticket/${invite.ticketId}` : `/invitation/${invite.id}`) : undefined);
  const inviteTitle = !invite
    ? ''
    : invite.status === 'invited'
      ? `${inviterName} invited you`
      : invite.status === 'declined'
        ? 'You declined this invitation'
        : invite.ticketId
          ? 'You’re going · ticket ready'
          : invite.payment === 'failed'
            ? 'Payment failed · no ticket yet'
            : `Pay your ${euro(contribution)} contribution`;
  const inviteCta = !invite ? '' : invite.ticketId ? 'Show my ticket' : invite.status === 'invited' ? 'Open invitation' : inviteNeedsPayment ? `Pay ${euro(contribution)}` : 'View invitation';
  const reviewTags = myReview?.tags ?? [];
  const reviewText = myReview ? myReview.text || (reviewTags.length ? `Loved the ${reviewTags.join(', ').toLowerCase()}.` : '') : '';
  const openTicket = () => (myTicket ? router.push(`/ticket/${myTicket.id}`) : router.push(`/tickets/${event.id}`));
  const share = () => Share.share({ message: `${event.title} — ${eventWhen(event.start, event.end)}${venue ? ` at ${venue.name}` : ''}. Join me on Domtak!` }).catch(() => toast('Could not open the share sheet'));
  const directions = () => {
    if (!venue) {
      router.push(`/map?focus=${event.id}`);
      return;
    }
    const destination = encodeURIComponent([venue.name, venue.area, venue.city].join(', '));
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destination}`).catch(() => router.push(`/map?focus=${event.id}`));
  };
  const toggleGoingWithToast = () => {
    toggleGoing(event.id);
    // A ticket or your own event keeps it in the calendar even when you are no longer marked as going.
    const staysInCalendar = hasTicket || event.organizerId === 'me';
    toast(going ? (staysInCalendar ? 'No longer marked as going' : 'Removed from your calendar') : 'You’re going! Added to your calendar');
  };
  // Opens the calendar tab on the event's day.
  const openCalendar = () => router.push({ pathname: '/(tabs)/calendar', params: { date: isoDay(parse(event.start)) } });
  const addToCalendar = () => {
    if (!inCalendar) {
      // Going is what puts an event in your Domtak calendar.
      toggleGoing(event.id);
      toast('Added to your calendar');
    }
    openCalendar();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ height: 340, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' }}>
          <Photo src={event.cover} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <LinearGradient colors={['rgba(0,0,0,0.35)', 'transparent', 'rgba(20,10,40,0.92)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <SafeAreaView edges={['top']} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 4 }}>
            <BackOverlay onPress={() => goBack('/(tabs)/events')} />
            <HeartToggle on={wished} onPress={() => toggleWish('events', event.id)} label={wished ? 'Remove from wishlist' : 'Save to wishlist'} />
          </SafeAreaView>
          <View style={{ position: 'absolute', left: 20, right: 16, bottom: 20, gap: 8 }}>
            <Row justify="space-between" align="flex-end">
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.white, fontFamily: fonts.display, fontSize: 30 }} numberOfLines={2}>
                  {event.title}
                  {event.subtitle ? <Text style={{ fontSize: 16, fontFamily: fonts.displayMedium }}> {event.subtitle}</Text> : null}
                </Text>
                <Text style={{ color: colors.lilacLight, fontFamily: fonts.bodyMedium, fontSize: 14 }}>{venue?.name}</Text>
              </View>
              <Row gap={8}>
                {event.rating ? <RatingBadge value={event.rating} /> : null}
              </Row>
            </Row>
            {event.ageLimit ? <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}><Text style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: 12 }}>{event.ageLimit}+</Text></View> : null}
          </View>
        </View>

        <View style={{ padding: 16, gap: 16 }}>
          <Row justify="space-between">
            <Stat icon="comment-outline" value={compact(commentCount)} label={`${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}, open discussion`} onPress={() => router.push(`/event-comments/${event.id}`)} />
            <Stat icon="map-marker-outline" label="Show on map" onPress={() => router.push(`/map?focus=${event.id}`)} />
            <Stat icon="navigation-variant-outline" label="Get directions" onPress={directions} />
            <Stat icon="account-outline" value={compact(goingCount)} label={`${goingCount} going`} />
            <Stat icon="share-variant-outline" label="Share event" onPress={share} />
          </Row>
          {cancelled ? (
            <Banner icon="calendar-remove-outline" tone="danger">{`This event was cancelled${event.cancelReason ? `: ${event.cancelReason}` : ''}.${hasTicket ? ' Your ticket is no longer valid for entry; refunds follow the event’s policy.' : ''}`}</Banner>
          ) : null}

          {hosts ? (
            <Card style={{ gap: 10 }}>
              <Row justify="space-between" gap={8}>
                <T v="title" style={{ flex: 1 }}>{event.isPrivate ? 'You’re hosting' : 'You organise this event'}</T>
                <Pill label={eventStateLabel(state, event.isPrivate)} tone={EVENT_STATE_TONE[state]} />
              </Row>
              <Row gap={8} align="flex-start">
                <Icon name="account-music-outline" size={18} color={r.ready ? colors.success : colors.brand} />
                <T v="small" color={r.ready ? colors.success : colors.inkSoft} style={{ flex: 1 }}>{readinessLine(r)}</T>
              </Row>
              {event.isPrivate ? (
                <Row gap={8} align="flex-start">
                  <Icon name="account-group-outline" size={18} color={colors.brand} />
                  <T v="small" color={colors.inkSoft} style={{ flex: 1 }}>{g.invited ? `${g.accepted} accepted · ${g.waiting} no answer${cs ? ` · ${g.paid} paid` : ''}` : 'No guests invited yet'}</T>
                </Row>
              ) : null}
              {state === 'draft' ? <T v="small">Draft: only you can see this event.</T> : null}
              <Button title="Open event workspace" icon="view-dashboard-outline" size="md" onPress={() => router.push(`/event-workspace/${event.id}`)} />
            </Card>
          ) : null}

          {invite && !hosts ? (
            <Card style={{ gap: 10, borderWidth: 1, borderColor: colors.lilacLight }}>
              <Row gap={12}>
                <Avatar src={inviter?.avatar} size={44} label={inviterName} />
                <View style={{ flex: 1 }}>
                  <T v="bodyBold">{inviteTitle}</T>
                  <T v="small">{contribution > 0 ? `Cost sharing ${euro(contribution)} per guest` : 'Free invitation'}</T>
                </View>
              </Row>
              <Button title={inviteCta} icon={invite.ticketId ? 'qrcode' : 'email-open-outline'} size="md" onPress={openInvitation} />
            </Card>
          ) : null}

          {!event.isPrivate && !closedToGuests ? (
            <Row gap={12}>
              <Button
                title="Going"
                icon={going ? 'check' : 'account-plus-outline'}
                variant={going ? 'secondary' : 'primary'}
                size="md"
                style={{ flex: 1 }}
                accessibilityState={{ selected: going }}
                accessibilityLabel={going ? 'Going, tap to undo' : 'Mark as going'}
                onPress={toggleGoingWithToast}
              />
              <Button title={hasTicket ? 'My ticket' : 'Tickets'} icon={hasTicket ? 'qrcode' : 'ticket-confirmation-outline'} size="md" style={{ flex: 1 }} onPress={openTicket} />
            </Row>
          ) : null}
          <GoingFaces count={goingCount} />

          {myReview ? (
            <Card style={{ gap: 8 }}>
              <Row justify="space-between">
                <T v="h3" accessibilityRole="header">Your review</T>
                <Button
                  title="Edit"
                  variant="ghost"
                  size="sm"
                  icon="pencil-outline"
                  hitSlop={6}
                  accessibilityLabel="Edit your review"
                  style={{ paddingHorizontal: 4 }}
                  onPress={() => router.push(`/review/${event.id}`)}
                />
              </Row>
              <Stars value={myReview.rating} size={18} />
              {reviewText ? <T v="body" color={colors.inkSoft}>{reviewText}</T> : null}
            </Card>
          ) : null}

          <InfoCard
            icon="calendar-month-outline"
            title={eventWhen(event.start, event.end)}
            sub={inCalendar ? 'In your Domtak calendar' : 'Add to your Domtak calendar'}
            action={inCalendar ? 'View' : 'Add'}
            actionLabel={inCalendar ? 'View in calendar' : 'Add to calendar'}
            actionIcon={inCalendar ? 'calendar-check' : 'calendar-plus'}
            actionVariant={inCalendar ? 'secondary' : 'light'}
            onAction={addToCalendar}
          />
          <InfoCard icon="map-marker-outline" title={venue ? `${venue.city}, ${venue.area}` : 'Location to be announced'} sub={venue?.name ?? 'Check back closer to the date'} action="Map" onAction={() => router.push(`/map?focus=${event.id}`)} />
          {event.isPrivate ? (
            <InfoCard
              icon="cash-multiple"
              title={cs ? `${euro(cs.perGuest)} per guest` : 'Free for guests'}
              sub={cs ? `Cost sharing · paid after accepting${cs.deadline ? ` · by ${shortDateLabel(cs.deadline)}` : ''}` : 'Invitation only'}
              action={hosts ? 'Guests' : invite ? (invite.ticketId ? 'Ticket' : 'Invitation') : undefined}
              onAction={hosts ? () => router.push(`/invite?event=${event.id}`) : openInvitation}
            />
          ) : (
            <InfoCard icon="ticket-confirmation-outline" title={priceRange(prices)} sub={`Ticket price includes tax · ${event.refundPolicy}`} action={closedToGuests && !hasTicket ? undefined : hasTicket ? 'View' : 'Buy'} onAction={openTicket} />
          )}

          {organizer ? (
            <Row gap={12} style={{ backgroundColor: colors.surface, padding: 14, borderRadius: radius.lg, ...shadow(1) }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Open organizer ${organizer.name}`} onPress={() => router.push(`/profile/${organizer.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                <Avatar src={organizer.avatar} size={52} verified={organizer.verified} />
                <View style={{ flex: 1 }}>
                  <T v="title" numberOfLines={1}>{organizer.name}</T>
                  <T v="small">{event.isPrivate ? 'Host' : 'Organizer'}</T>
                </View>
              </Pressable>
              <FollowButton id={organizer.id} />
            </Row>
          ) : null}

          <View style={{ gap: 6 }}>
            <T v="h3">About event</T>
            <T v="body" numberOfLines={more || !longDescription ? undefined : 4}>{event.description}</T>
            {longDescription ? (
              <Pressable accessibilityRole="button" accessibilityLabel={more ? 'Show less of the description' : 'Show the full description'} accessibilityState={{ expanded: more }} onPress={() => setMore(!more)} hitSlop={12} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
                <T v="smallBold" color={colors.brand}>{more ? 'See less' : 'See more'}</T>
              </Pressable>
            ) : null}
          </View>

          {lineup.length ? (
            <View>
              <SectionTitle title="Line up" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
                {lineup.map((a) => <ArtistTile key={a.id} artist={a} />)}
              </ScrollView>
              {unconfirmed.length ? (
                <Row gap={8} align="flex-start" style={{ marginTop: 8 }}>
                  <Icon name="timer-sand" size={16} color={colors.warning} />
                  <T v="small" color={colors.warning} style={{ flex: 1 }}>{`Not confirmed yet: ${unconfirmed.join(', ')}. Only you see this.`}</T>
                </Row>
              ) : null}
            </View>
          ) : null}

          {venue ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Open venue ${venue.name}`} onPress={() => router.push(`/venue/${venue.id}`)} style={{ borderRadius: radius.lg, overflow: 'hidden', ...shadow(1), backgroundColor: colors.surface }}>
              <Photo src={venue.cover} style={{ height: 120 }} />
              <Row justify="space-between" style={{ padding: 12 }}>
                <View>
                  <T v="title">{venue.name}</T>
                  <T v="small">{venue.capacity} people · {venue.type}</T>
                </View>
                <Icon name="chevron-right" size={24} color={colors.brand} />
              </Row>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
      <BottomBar>
        <Row gap={14}>
          <View>
            <T v="small">{event.isPrivate ? 'Per guest' : 'From'}</T>
            <T v="h3">{event.isPrivate ? (cs ? euro(cs.perGuest) : 'Free') : priceRange(prices.length ? [Math.min(...prices)] : [])}</T>
          </View>
          {hosts ? (
            <>
              {!cancelled ? <Button title="Edit" icon="pencil-outline" variant="secondary" size="md" accessibilityLabel={`Edit ${event.title}`} style={{ flex: 1 }} onPress={() => router.push({ pathname: '/create-event', params: { edit: event.id } })} /> : null}
              <Button title="Manage" icon="view-dashboard-outline" size="md" accessibilityLabel={`Manage ${event.title}`} style={{ flex: 1 }} onPress={() => router.push(`/event-workspace/${event.id}`)} />
            </>
          ) : invite ? (
            <Button title={inviteCta} style={{ flex: 1 }} onPress={openInvitation} />
          ) : cancelled ? (
            <Button title="Browse other events" variant="secondary" style={{ flex: 1 }} onPress={() => router.replace('/(tabs)/events')} />
          ) : (
            <Button title={hasTicket ? 'View my ticket' : 'Get tickets'} style={{ flex: 1 }} onPress={openTicket} />
          )}
        </Row>
      </BottomBar>
    </View>
  );
}
