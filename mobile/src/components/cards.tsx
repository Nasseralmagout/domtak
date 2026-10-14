import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { profileById, profiles, venueById } from '../data/mock';
import type { EventItem, Profile, Venue } from '../data/types';
import { compact, dayOfMonth, euro, eventWhen, monthShort, priceRange, time } from '../lib/format';
import { useApp } from '../store/useApp';
import { colors, fonts, radius, shadow } from '../theme';
import { Avatar, Button, Icon, IconButton, Photo, RatingBadge, Row, T } from './ui';

const scrim = ['transparent', 'rgba(20,10,40,0.85)'] as const;

export function HeartToggle({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      hitSlop={4}
      style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={on ? 'heart' : 'heart-outline'} size={20} color={on ? colors.danger : colors.ink} />
    </Pressable>
  );
}

export function GoingFaces({ count }: { count: number }) {
  const faces = profiles.filter((p) => p.kind === 'fan').slice(0, 4);
  if (count <= 0) return <T v="small" color={colors.inkSoft}>Be the first to go</T>;
  return (
    <Row gap={8}>
      <Row gap={0}>
        {faces.map((f, i) => (
          <View key={f.id} style={{ marginLeft: i === 0 ? 0 : -10 }}>
            <Avatar src={f.avatar} size={28} />
          </View>
        ))}
      </Row>
      <T v="small" color={colors.inkSoft}>+{compact(count)} going</T>
    </Row>
  );
}

const isFree = (event: EventItem) => event.ticketTypes.every((t) => t.price === 0);

export function EventCard({ event }: { event: EventItem }) {
  const venue = venueById(event.venueId);
  const wished = useApp((s) => s.wishlist.events.includes(event.id));
  const toggleWish = useApp((s) => s.toggleWish);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${event.title}, ${eventWhen(event.start, event.end)}`} onPress={() => router.push(`/event/${event.id}`)} style={{ borderRadius: radius.xl, backgroundColor: colors.surface, overflow: 'hidden', ...shadow(2) }}>
      <View style={{ height: 200 }}>
        <Photo src={event.cover} style={{ position: 'absolute', inset: 0 }} />
        <LinearGradient colors={scrim} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 }} />
        <View style={{ position: 'absolute', top: 12, right: 12 }}>
          <HeartToggle on={wished} onPress={() => toggleWish('events', event.id)} label={wished ? 'Remove from wishlist' : 'Save to wishlist'} />
        </View>
        {event.sponsored ? (
          <View style={{ position: 'absolute', top: 14, left: 12, backgroundColor: colors.gold, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: colors.brandDark }}>SPONSORED</Text>
          </View>
        ) : null}
        <Row style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }} align="flex-end" justify="space-between">
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.white }} numberOfLines={1}>{event.title}</Text>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.lilacLight }} numberOfLines={1}>{venue ? `${venue.name}, ${venue.area}` : 'Venue to be announced'}</Text>
          </View>
          {event.rating ? <RatingBadge value={event.rating} /> : null}
        </Row>
      </View>
      <View style={{ padding: 14, gap: 10 }}>
        <T v="bodyBold">{eventWhen(event.start, event.end)}</T>
        <Row gap={14} style={{ flexWrap: 'wrap' }}>
          <Row gap={4}><Icon name="music-note" size={16} color={colors.brand} /><T v="small" color={colors.inkSoft}>{event.genre}</T></Row>
          <Row gap={4}><Icon name="ticket-confirmation-outline" size={16} color={colors.brand} /><T v="small" color={colors.inkSoft}>{priceRange(event.ticketTypes.map((t) => t.price))}</T></Row>
          <Row gap={4}><Icon name="storefront-outline" size={16} color={colors.brand} /><T v="small" color={colors.inkSoft}>{venue?.name}</T></Row>
        </Row>
        <Row justify="space-between">
          <GoingFaces count={event.going} />
          <Button title={isFree(event) ? 'Register' : 'Book'} accessibilityLabel={`${isFree(event) ? 'Register for' : 'Book tickets for'} ${event.title}`} size="sm" onPress={() => router.push(`/tickets/${event.id}`)} style={{ paddingHorizontal: 24 }} />
        </Row>
      </View>
    </Pressable>
  );
}

export function EventRow({ event }: { event: EventItem }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${event.title}, ${eventWhen(event.start, event.end)}`} onPress={() => router.push(`/event/${event.id}`)} style={{ flexDirection: 'row', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 10, alignItems: 'center', ...shadow(1) }}>
      <View style={{ flex: 1, gap: 4, paddingLeft: 6 }}>
        <T v="title" numberOfLines={1}>{event.title}</T>
        <T v="small">{time(event.start)} – {time(event.end)}</T>
        <Row gap={12}>
          <T v="small" color={colors.inkSoft}>{event.distanceKm} km</T>
          <Row gap={3}><Icon name="music-note" size={14} color={colors.brand} /><T v="small" color={colors.brand}>{event.genre}</T></Row>
          <Row gap={3}><Icon name="ticket-confirmation-outline" size={14} color={colors.brand} /><T v="small" color={colors.brand}>{priceRange(event.ticketTypes.map((t) => t.price))}</T></Row>
        </Row>
      </View>
      <Photo src={event.cover} style={{ width: 84, height: 84 }} radius={14} />
    </Pressable>
  );
}

export function DateBadge({ iso, size = 56 }: { iso: string; size?: number }) {
  return (
    <View style={{ width: size, height: size + 4, borderRadius: 14, backgroundColor: colors.brandDeep, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.lilacLight, fontFamily: fonts.bodyBold, fontSize: 12 }}>{monthShort(iso)}</Text>
      <Text style={{ color: colors.white, fontFamily: fonts.display, fontSize: 20, lineHeight: 24 }}>{dayOfMonth(iso)}</Text>
    </View>
  );
}

export function MiniEventCard({ event, width = 220 }: { event: EventItem; width?: number }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${event.title}, ${eventWhen(event.start, event.end)}`} onPress={() => router.push(`/event/${event.id}`)} style={{ width, borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden', ...shadow(1) }}>
      <Photo src={event.cover} style={{ height: 120 }} />
      <View style={{ padding: 10, gap: 4 }}>
        <T v="title" numberOfLines={1}>{event.title}</T>
        <T v="small" numberOfLines={1}>{eventWhen(event.start, event.end)}</T>
        <Row justify="space-between" style={{ marginTop: 4 }}>
          <T v="smallBold" color={colors.brand}>{priceRange(event.ticketTypes.map((t) => t.price))}</T>
          <Button title={isFree(event) ? 'Register' : 'Book'} accessibilityLabel={`${isFree(event) ? 'Register for' : 'Book tickets for'} ${event.title}`} size="sm" onPress={() => router.push(`/tickets/${event.id}`)} />
        </Row>
      </View>
    </Pressable>
  );
}

export function ArtistTile({ artist, width = 132 }: { artist: Profile; width?: number }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${artist.name}, ${artist.title}`} onPress={() => router.push(`/artist/${artist.id}`)} style={{ width, borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden', ...shadow(1) }}>
      <Photo src={artist.avatar} style={{ height: width * 1.15 }} />
      <View style={{ padding: 8 }}>
        <T v="smallBold" numberOfLines={1}>{artist.name}</T>
        <T v="small" numberOfLines={1} style={{ fontSize: 11 }}>{artist.genres.slice(0, 2).join(', ')}</T>
      </View>
    </Pressable>
  );
}

export function ArtistCard({ artist }: { artist: Profile }) {
  const following = useApp((s) => !!s.following[artist.id]);
  const toggleFollow = useApp((s) => s.toggleFollow);
  const wished = useApp((s) => s.wishlist.artists.includes(artist.id));
  const toggleWish = useApp((s) => s.toggleWish);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${artist.name}, ${artist.title}`} onPress={() => router.push(`/artist/${artist.id}`)} style={{ flex: 1, borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden', ...shadow(1) }}>
      <View style={{ height: 190 }}>
        <Photo src={artist.avatar} style={{ position: 'absolute', inset: 0 }} />
        <LinearGradient colors={scrim} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 }} />
        <View style={{ position: 'absolute', top: 8, right: 8 }}>
          <HeartToggle on={wished} onPress={() => toggleWish('artists', artist.id)} label={wished ? 'Remove from wishlist' : 'Save to wishlist'} />
        </View>
        <Row style={{ position: 'absolute', left: 10, right: 8, bottom: 8 }} justify="space-between" align="flex-end">
          <View style={{ flex: 1 }}>
            <Row gap={4}>
              <Text style={{ flexShrink: 1, fontFamily: fonts.displaySemi, fontSize: 15, color: colors.white }} numberOfLines={1}>{artist.name}</Text>
              {artist.verified ? <Icon name="check-decagram" size={14} color="#A78BFA" /> : null}
            </Row>
            <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.lilacLight }}>{artist.title}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={following ? `Unfollow ${artist.name}` : `Follow ${artist.name}`} accessibilityState={{ selected: following }} onPress={() => toggleFollow(artist.id)} hitSlop={10} style={{ height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: following ? colors.white : colors.brand, justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: following ? colors.brand : colors.white }}>{following ? 'Following' : '+ Follow'}</Text>
          </Pressable>
        </Row>
      </View>
      <View style={{ padding: 10, gap: 4 }}>
        <Row gap={4}><Icon name="map-marker-outline" size={14} color={colors.brand} /><T v="small" numberOfLines={1} color={colors.inkSoft} style={{ flex: 1 }}>{artist.city}</T></Row>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {artist.genres.slice(0, 2).map((g) => (
            <Row key={g} gap={2}><Icon name="music-note" size={13} color={colors.brand} /><T v="small" style={{ fontSize: 12 }} color={colors.brand}>{g}</T></Row>
          ))}
        </Row>
        {artist.feePerHour ? <T v="smallBold">From {euro(artist.feePerHour)}/h</T> : null}
      </View>
    </Pressable>
  );
}

export function VenueCard({ venue }: { venue: Venue }) {
  const wished = useApp((s) => s.wishlist.venues.includes(venue.id));
  const toggleWish = useApp((s) => s.toggleWish);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={venue.name} onPress={() => router.push(`/venue/${venue.id}`)} style={{ borderRadius: radius.xl, backgroundColor: colors.surface, overflow: 'hidden', ...shadow(2) }}>
      <View style={{ height: 190 }}>
        <Photo src={venue.cover} style={{ position: 'absolute', inset: 0 }} />
        <LinearGradient colors={scrim} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 100 }} />
        <View style={{ position: 'absolute', top: 12, right: 12 }}>
          <HeartToggle on={wished} onPress={() => toggleWish('venues', venue.id)} label={wished ? 'Remove from wishlist' : 'Save to wishlist'} />
        </View>
        <Row style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }} justify="space-between" align="flex-end">
          <View>
            <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.white }}>{venue.name}</Text>
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.lilacLight }}>{venue.city}, {venue.area}</Text>
          </View>
          <RatingBadge value={venue.rating} />
        </Row>
      </View>
      <View style={{ padding: 14, gap: 10 }}>
        <Row gap={8}>
          <View style={pillDark}><Text style={pillDarkText}>{euro(venue.pricePerNight)}/Night</Text></View>
          <View style={pillDark}><Text style={pillDarkText}>{venue.equipment}</Text></View>
        </Row>
        <VenueFacts venue={venue} />
        <Row justify="space-between">
          <T v="small" color={colors.inkSoft}>+{compact(venue.followers)} followers</T>
          <Button title="Book" accessibilityLabel={`Book ${venue.name}`} size="sm" onPress={() => router.push({ pathname: '/booking/new', params: { type: 'venue', id: venue.id } })} style={{ paddingHorizontal: 24 }} />
        </Row>
      </View>
    </Pressable>
  );
}

export function VenueFacts({ venue }: { venue: Venue }) {
  const facts = [
    { icon: 'account-group-outline' as const, label: `${venue.capacity} people` },
    { icon: 'door' as const, label: `${venue.rooms} rooms` },
    { icon: 'speaker' as const, label: `${venue.stages} stage${venue.stages > 1 ? 's' : ''}` },
    ...(venue.parking ? [{ icon: 'parking' as const, label: 'Parking' }] : []),
  ];
  return (
    <Row gap={14} style={{ flexWrap: 'wrap' }}>
      {facts.map((f) => (
        <Row key={f.label} gap={4}><Icon name={f.icon} size={17} color={colors.brand} /><T v="smallBold" color={colors.inkSoft}>{f.label}</T></Row>
      ))}
    </Row>
  );
}

export function PersonRow({ id, right, subtitle }: { id: string; right?: React.ReactNode; subtitle?: string }) {
  const p = profileById(id);
  if (!p) return null;
  const href = venueById(p.id) ? `/venue/${p.id}` : p.kind === 'fan' || p.kind === 'organizer' ? `/profile/${p.id}` : `/artist/${p.id}`;
  return (
    <Row gap={12} style={{ paddingVertical: 6 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${p.name}, ${subtitle ?? p.title}`} onPress={() => router.push(href as never)} style={{ flexDirection: 'row', flex: 1, alignItems: 'center', gap: 12 }}>
        <Avatar src={p.avatar} size={48} verified={p.verified} />
        <View style={{ flex: 1 }}>
          <T v="bodyBold" numberOfLines={1}>{p.name}</T>
          <T v="small" numberOfLines={1}>{subtitle ?? p.title}</T>
        </View>
      </Pressable>
      {right}
    </Row>
  );
}

export function FollowButton({ id, size = 'sm' }: { id: string; size?: 'sm' | 'md' }) {
  const following = useApp((s) => !!s.following[id]);
  const toggle = useApp((s) => s.toggleFollow);
  const name = profileById(id)?.name;
  return <Button title={following ? 'Following' : 'Follow'} accessibilityLabel={name ? `${following ? 'Unfollow' : 'Follow'} ${name}` : undefined} accessibilityState={{ selected: following }} icon={following ? 'check' : 'account-plus-outline'} variant={following ? 'secondary' : 'primary'} size={size} onPress={() => toggle(id)} />;
}

export function BackOverlay({ onPress }: { onPress: () => void }) {
  return <IconButton name="chevron-left" label="Back" color={colors.white} bg="rgba(0,0,0,0.35)" size={44} iconSize={28} onPress={onPress} />;
}

const pillDark = { backgroundColor: colors.brandDark, borderRadius: 14, paddingHorizontal: 12, height: 30, justifyContent: 'center' as const };
const pillDarkText = { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 13 };
