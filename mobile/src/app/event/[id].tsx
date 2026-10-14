import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArtistTile, BackOverlay, FollowButton, GoingFaces, HeartToggle } from '../../components/cards';
import { BottomBar, goBack } from '../../components/layout';
import { Avatar, Button, EmptyState, Icon, type IconName, Photo, RatingBadge, Row, SectionTitle, T } from '../../components/ui';
import { eventDiscussion, profileById, venueById } from '../../data/mock';
import { compact, eventWhen, isoDay, parse, priceRange } from '../../lib/format';
import { toast } from '../../store/toast';
import { useApp, useEvent } from '../../store/useApp';
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
  const [more, setMore] = useState(false);

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
  const venue = venueById(event.venueId);
  const organizer = event.organizerId === 'me' ? undefined : profileById(event.organizerId);
  const lineup = event.lineup.map((l) => profileById(l)).filter((p): p is NonNullable<typeof p> => !!p);
  const prices = event.ticketTypes.map((t) => t.price);
  const myTicket = tickets.find((t) => t.eventId === event.id && t.status === 'valid');
  const hasTicket = !!myTicket;
  const goingCount = event.going + (going ? 1 : 0);
  const commentCount = (eventDiscussion[event.id]?.length ?? 0) + (extraComments?.length ?? 0);
  // Same rule as the calendar tab: going, holding a valid ticket, or organizing it yourself.
  const inCalendar = going || hasTicket || event.organizerId === 'me';
  const longDescription = event.description.length > 160;
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
  const addToCalendar = () => {
    if (inCalendar) {
      // Open the calendar on the event's day.
      router.push(`/(tabs)/calendar?date=${isoDay(parse(event.start))}`);
      return;
    }
    toggleGoing(event.id);
    toast('Added to your calendar');
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
          <GoingFaces count={goingCount} />

          <InfoCard
            icon="calendar-month-outline"
            title={eventWhen(event.start, event.end)}
            sub={inCalendar ? 'In your Domtak calendar' : 'Add to your Domtak calendar'}
            action={inCalendar ? 'Added' : 'Add'}
            actionLabel={inCalendar ? 'Added to your calendar, open calendar' : 'Add to your calendar'}
            actionIcon={inCalendar ? 'check' : 'calendar-plus'}
            actionVariant={inCalendar ? 'secondary' : 'light'}
            onAction={addToCalendar}
          />
          <InfoCard icon="map-marker-outline" title={venue ? `${venue.city}, ${venue.area}` : 'Location to be announced'} sub={venue?.name ?? 'Check back closer to the date'} action="Map" onAction={() => router.push(`/map?focus=${event.id}`)} />
          <InfoCard icon="ticket-confirmation-outline" title={priceRange(prices)} sub={`Ticket price includes tax · ${event.refundPolicy}`} action={hasTicket ? 'View' : 'Buy'} onAction={openTicket} />

          {organizer ? (
            <Row gap={12} style={{ backgroundColor: colors.surface, padding: 14, borderRadius: radius.lg, ...shadow(1) }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Open organizer ${organizer.name}`} onPress={() => router.push(`/profile/${organizer.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                <Avatar src={organizer.avatar} size={52} verified={organizer.verified} />
                <View style={{ flex: 1 }}>
                  <T v="title" numberOfLines={1}>{organizer.name}</T>
                  <T v="small">Organizer</T>
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
            <T v="small">From</T>
            <T v="h3">{priceRange(prices.length ? [Math.min(...prices)] : [])}</T>
          </View>
          <Button title={hasTicket ? 'View my ticket' : 'Get tickets'} style={{ flex: 1 }} onPress={openTicket} />
        </Row>
      </BottomBar>
    </View>
  );
}
