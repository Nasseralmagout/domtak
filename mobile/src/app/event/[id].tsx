import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArtistTile, BackOverlay, FollowButton, GoingFaces, HeartToggle } from '../../components/cards';
import { BottomBar, goBack } from '../../components/layout';
import { Avatar, Button, Icon, type IconName, Photo, RatingBadge, Row, SectionTitle, T } from '../../components/ui';
import { profileById, venueById } from '../../data/mock';
import { compact, eventWhen, priceRange } from '../../lib/format';
import { useApp, useEvent } from '../../store/useApp';
import { colors, fonts, radius, shadow } from '../../theme';

function InfoCard({ icon, title, sub, action, onAction }: { icon: IconName; title: string; sub: string; action?: string; onAction?: () => void }) {
  return (
    <Row gap={14} style={{ backgroundColor: colors.surface, padding: 14, borderRadius: radius.lg, ...shadow(1) }}>
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brandDeep, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={26} color={colors.white} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="title">{title}</T>
        <T v="small">{sub}</T>
      </View>
      {action ? <Button title={action} size="sm" variant="light" onPress={onAction} /> : null}
    </Row>
  );
}

function Stat({ icon, label, onPress }: { icon: IconName; label?: string; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label ?? icon} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 4 }}>
      {label ? <T v="bodyBold">{label}</T> : null}
      <Icon name={icon} size={22} color={colors.ink} />
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
  const [more, setMore] = useState(false);

  if (!event) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 24, gap: 12 }}>
        <T v="h2">Event not found</T>
        <Button title="Back" onPress={() => goBack('/(tabs)/events')} />
      </SafeAreaView>
    );
  }
  const venue = venueById(event.venueId);
  const organizer = event.organizerId === 'me' ? undefined : profileById(event.organizerId);
  const lineup = event.lineup.map((l) => profileById(l)).filter((p): p is NonNullable<typeof p> => !!p);
  const prices = event.ticketTypes.map((t) => t.price);
  const hasTicket = tickets.some((t) => t.eventId === event.id && t.status === 'valid');
  const share = () => Share.share({ message: `${event.title} — ${eventWhen(event.start, event.end)} at ${venue?.name}. Join me on Domtak!` }).catch(() => {});

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
            <Stat icon="comment-outline" label={compact(913)} onPress={() => router.push('/post/p3')} />
            <Stat icon="map-marker-outline" onPress={() => router.push(`/map?focus=${event.id}`)} />
            <Stat icon="navigation-variant-outline" onPress={() => router.push(`/map?focus=${event.id}`)} />
            <Stat icon="account-outline" label={compact(event.going + (going ? 1 : 0))} />
            <Stat icon="share-variant-outline" onPress={share} />
          </Row>
          <Row gap={12}>
            <Button title={going ? 'Going ✓' : 'Going'} variant={going ? 'secondary' : 'primary'} size="md" style={{ flex: 1 }} onPress={() => toggleGoing(event.id)} />
            <Button title={hasTicket ? 'My ticket' : 'Tickets'} size="md" style={{ flex: 1 }} onPress={() => (hasTicket ? router.push('/my-bookings?tab=tickets') : router.push(`/tickets/${event.id}`))} />
          </Row>
          <GoingFaces count={event.going} />

          <InfoCard icon="calendar-month-outline" title={eventWhen(event.start, event.end)} sub="Add to your Domtak calendar" action="Add" onAction={() => router.push('/(tabs)/calendar')} />
          <InfoCard icon="map-marker-outline" title={`${venue?.city}, ${venue?.area}`} sub={venue?.name ?? ''} action="Map" onAction={() => router.push(`/map?focus=${event.id}`)} />
          <InfoCard icon="ticket-confirmation-outline" title={priceRange(prices)} sub={`Ticket price includes tax · ${event.refundPolicy}`} />

          {organizer ? (
            <Row gap={12} style={{ backgroundColor: colors.surface, padding: 14, borderRadius: radius.lg, ...shadow(1) }}>
              <Pressable accessibilityRole="button" onPress={() => router.push(`/profile/${organizer.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
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
            <T v="body" numberOfLines={more ? undefined : 4}>{event.description}</T>
            <Pressable accessibilityRole="button" onPress={() => setMore(!more)}><T v="smallBold" color={colors.brand}>{more ? 'See less' : 'See more'}</T></Pressable>
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
            <Pressable accessibilityRole="button" onPress={() => router.push(`/venue/${venue.id}`)} style={{ borderRadius: radius.lg, overflow: 'hidden', ...shadow(1), backgroundColor: colors.surface }}>
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
            <T v="h3">{priceRange([Math.min(...prices)])}</T>
          </View>
          <Button title={hasTicket ? 'View my ticket' : 'Get tickets'} style={{ flex: 1 }} onPress={() => (hasTicket ? router.push('/my-bookings?tab=tickets') : router.push(`/tickets/${event.id}`))} />
        </Row>
      </BottomBar>
    </View>
  );
}
