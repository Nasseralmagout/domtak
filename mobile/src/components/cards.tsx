import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { type ReactNode, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { parkingLine, profileById, profiles, venueById, venueGarden, venueParking } from '../data/mock';
import type { EventItem, Lesson, Profile, Venue } from '../data/types';
import { compact, dayOfMonth, euro, eventWhen, monthShort, priceRange, time } from '../lib/format';
import { artistEstimate, toLineItems } from '../lib/pricing';
import { isMusician } from '../lib/ratings';
import { type ArtistServices, LESSON_FORMAT_ICON, LESSON_FORMAT_LABEL, useArtistOverlay } from '../store/services';
import { activeWorkspace, OWN_VENUE_ID, overlayVenue, useApp, useArtistScore, useRating, useVenue } from '../store/useApp';
import { colors, fonts, radius, shadow } from '../theme';
import { Avatar, Button, Card, Divider, Icon, type IconName, IconButton, InfoRow, LineItems, Photo, Pill, RatingBadge, Row, T } from './ui';

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

/**
 * The one Sponsored label for event cards: boosted events (Pro → Promote, pass `sponsored`) and
 * sponsored partner events (event.sponsored) look the same and are never labelled twice.
 */
export function SponsoredPill() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: colors.gold }}>
      <Icon name="star-four-points-outline" size={12} color={colors.brandDark} />
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 14, color: colors.brandDark }}>Sponsored</Text>
    </View>
  );
}

/** Whether a card shows the Sponsored pill: a running boost or a sponsored partner event. */
const showsSponsored = (event: EventItem, sponsored?: boolean) => !!sponsored || !!event.sponsored;
const cardLabel = (event: EventItem, sponsored: boolean) => `${sponsored ? 'Sponsored, ' : ''}${event.title}, ${eventWhen(event.start, event.end)}`;

/** Pass `sponsored` (e.g. isPromoted(promotions, event)) to mark a boosted event. */
export function EventCard({ event, sponsored: boosted }: { event: EventItem; sponsored?: boolean }) {
  // Includes the owner's listing edits when the event is at their own venue (Moon Club).
  const venue = useVenue(event.venueId);
  const sponsored = showsSponsored(event, boosted);
  const wished = useApp((s) => s.wishlist.events.includes(event.id));
  const toggleWish = useApp((s) => s.toggleWish);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={cardLabel(event, sponsored)} onPress={() => router.push(`/event/${event.id}`)} style={{ borderRadius: radius.xl, backgroundColor: colors.surface, overflow: 'hidden', ...shadow(2) }}>
      <View style={{ height: 200 }}>
        <Photo src={event.cover} style={{ position: 'absolute', inset: 0 }} />
        <LinearGradient colors={scrim} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 }} />
        <View style={{ position: 'absolute', top: 12, right: 12 }}>
          <HeartToggle on={wished} onPress={() => toggleWish('events', event.id)} label={wished ? 'Remove from wishlist' : 'Save to wishlist'} />
        </View>
        {sponsored ? (
          <View style={{ position: 'absolute', top: 12, left: 12, height: 40, justifyContent: 'center', pointerEvents: 'none' }}>
            <SponsoredPill />
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

/** Pass `sponsored` (e.g. isPromoted(promotions, event)) to mark a boosted event. */
export function EventRow({ event, sponsored: boosted }: { event: EventItem; sponsored?: boolean }) {
  const sponsored = showsSponsored(event, boosted);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={cardLabel(event, sponsored)} onPress={() => router.push(`/event/${event.id}`)} style={{ flexDirection: 'row', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 10, alignItems: 'center', ...shadow(1) }}>
      <View style={{ flex: 1, gap: 4, paddingLeft: 6 }}>
        {sponsored ? <SponsoredPill /> : null}
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

/** Pass `sponsored` (e.g. isPromoted(promotions, event)) to mark a boosted event. */
export function MiniEventCard({ event, width = 220, sponsored: boosted }: { event: EventItem; width?: number; sponsored?: boolean }) {
  const sponsored = showsSponsored(event, boosted);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={cardLabel(event, sponsored)} onPress={() => router.push(`/event/${event.id}`)} style={{ width, borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden', ...shadow(1) }}>
      <Photo src={event.cover} style={{ height: 120 }} />
      {sponsored ? (
        <View style={{ position: 'absolute', top: 8, left: 8, pointerEvents: 'none' }}>
          <SponsoredPill />
        </View>
      ) : null}
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

/** "Quote on request" or "From €300/h" for an artist (quote pricing never shows an invented price). */
export function artistPriceLabel(artist: Pick<Profile, 'pricing' | 'feePerHour'>) {
  return artist.pricing === 'quote' || !artist.feePerHour ? 'Quote on request' : `From ${euro(artist.feePerHour)}/h`;
}

/** "Price on request" or "€800/night" for a venue. */
export function venuePriceLabel(venue: Pick<Venue, 'pricing' | 'pricePerNight'>) {
  return venue.pricing === 'quote' ? 'Price on request' : `${euro(venue.pricePerNight)}/night`;
}

/**
 * Musician score line: "92% would book again" from verified bookings (musicians are not rated with stars).
 * `short` fits narrow tiles ("92% book again").
 */
export function BookAgainLine({ id, short, color = colors.brand }: { id: string; short?: boolean; color?: string }) {
  const score = useArtistScore(id);
  const none = score.recommendPct == null;
  const label = none ? (short ? 'No reviews yet' : 'No verified bookings yet') : short ? `${score.recommendPct}% book again` : `${score.recommendPct}% would book again`;
  const a11y = none ? 'No verified bookings yet' : `${score.recommendPct}% would book again, from ${score.total} verified booking${score.total === 1 ? '' : 's'}`;
  return (
    <Row gap={4} accessibilityLabel={a11y}>
      <Icon name={none ? 'account-music-outline' : 'thumb-up-outline'} size={13} color={none ? colors.subtle : color} />
      <T v="small" numberOfLines={1} style={{ fontSize: short ? 11 : 12, flexShrink: 1 }} color={none ? colors.subtle : color}>{label}</T>
    </Row>
  );
}

export function ArtistTile({ artist, width = 132 }: { artist: Profile; width?: number }) {
  const musician = isMusician(artist.id);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${artist.name}, ${artist.title}`} onPress={() => router.push(`/artist/${artist.id}`)} style={{ width, borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden', ...shadow(1) }}>
      <Photo src={artist.avatar} style={{ height: width * 1.15 }} />
      <View style={{ padding: 8, gap: 2 }}>
        <T v="smallBold" numberOfLines={1}>{artist.name}</T>
        <T v="small" numberOfLines={1} style={{ fontSize: 11 }}>{artist.genres.slice(0, 2).join(', ')}</T>
        {musician ? <BookAgainLine id={artist.id} short /> : null}
      </View>
    </Pressable>
  );
}

export function ArtistCard({ artist: base }: { artist: Profile }) {
  // The demo musician's published services (price, quote mode) show on their own card.
  const artist = useArtistOverlay(base);
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
        {isMusician(artist.id) ? <BookAgainLine id={artist.id} /> : null}
        {artist.feePerHour || artist.pricing === 'quote' ? <T v="smallBold">{artistPriceLabel(artist)}</T> : null}
      </View>
    </Pressable>
  );
}

export function VenueCard({ venue: base }: { venue: Venue }) {
  // The owner's listing edits show on their own venue everywhere (overlay is a no-op for other venues).
  const listing = useApp((s) => s.venueListing);
  const venue = useMemo(() => overlayVenue(base, listing), [base, listing]);
  // Stars only when real reviews back them; a venue without reviews reads "New" (same as the venue page).
  const { rating, count: reviewCount } = useRating(venue.id);
  // The venue owner (approved and working as venue) manages their own venue instead of booking it (same as the venue page).
  const isOwner = useApp((s) => activeWorkspace(s.user) === 'venue') && venue.id === OWN_VENUE_ID;
  const wished = useApp((s) => s.wishlist.venues.includes(venue.id));
  const toggleWish = useApp((s) => s.toggleWish);
  const quote = venue.pricing === 'quote';
  const services = [
    venue.catering?.available ? `Catering ${euro(venue.catering.pricePerGuest)} per guest` : '',
    venue.security?.available ? `Security ${euro(venue.security.pricePerGuard)} per guard` : '',
  ].filter(Boolean);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${venue.name}, ${venue.area}, ${reviewCount ? `rated ${rating.toFixed(1)} stars from ${reviewCount} review${reviewCount === 1 ? '' : 's'}` : 'no reviews yet'}`} onPress={() => router.push(`/venue/${venue.id}`)} style={{ borderRadius: radius.xl, backgroundColor: colors.surface, overflow: 'hidden', ...shadow(2) }}>
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
          {reviewCount ? <RatingBadge value={rating} /> : <Pill label="New" tone="brand" icon="star-outline" />}
        </Row>
      </View>
      <View style={{ padding: 14, gap: 10 }}>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          <View style={pillDark}><Text style={pillDarkText}>{venuePriceLabel(venue)}</Text></View>
          <View style={pillDark}><Text style={pillDarkText}>{venue.equipment}</Text></View>
        </Row>
        <VenueFacts venue={venue} />
        {services.length ? (
          <Row gap={6} accessibilityLabel={services.join(', ')}>
            <Icon name="silverware-fork-knife" size={15} color={colors.brand} />
            <T v="small" color={colors.inkSoft} numberOfLines={1} style={{ flex: 1 }}>{services.join(' · ')}</T>
          </Row>
        ) : null}
        <Row justify="space-between">
          <T v="small" color={colors.inkSoft}>+{compact(venue.followers)} followers</T>
          {isOwner ? (
            <Button title="Edit listing" icon="storefront-edit-outline" accessibilityLabel={`Edit the ${venue.name} listing`} size="sm" onPress={() => router.navigate('/pro/venue-listing')} style={{ paddingHorizontal: 16 }} />
          ) : (
            <Button
              title={quote ? 'Request quote' : 'Book'}
              accessibilityLabel={quote ? `Request a quote from ${venue.name}` : `Book ${venue.name}`}
              size="sm"
              onPress={() => router.push({ pathname: '/booking/new', params: { type: 'venue', id: venue.id } })}
              style={{ paddingHorizontal: quote ? 16 : 24 }}
            />
          )}
        </Row>
      </View>
    </Pressable>
  );
}

/** One amenity as its own pill: parking and the garden are always separate items. */
function AmenityPill({ icon, label, available }: { icon: IconName; label: string; available: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: available ? colors.brandSoft : colors.chipIdle }}
    >
      <Icon name={icon} size={15} color={available ? colors.brand : colors.disabled} />
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: available ? colors.brand : colors.muted }}>{label}</Text>
    </View>
  );
}

/** Short garden label for pills, e.g. "Garden · 120 guests · covered" or "No garden". */
export function gardenShort(venue: Pick<Venue, 'garden'>) {
  const g = venueGarden(venue);
  if (!g.available) return 'No garden or outdoor space';
  return ['Garden', g.capacity ? `${g.capacity} guests` : '', g.covered ? 'covered' : ''].filter(Boolean).join(' · ');
}

/** At a glance: parking, garden, catering and security as four separate pills (venue page header). */
export function VenueAmenities({ venue }: { venue: Venue }) {
  const parking = venueParking(venue);
  const garden = venueGarden(venue);
  const catering = !!venue.catering?.available;
  const security = !!venue.security?.available;
  return (
    <Row gap={8} style={{ flexWrap: 'wrap' }}>
      <AmenityPill icon="parking" label={parking.available ? 'Parking' : 'No parking'} available={parking.available} />
      <AmenityPill icon="tree-outline" label={garden.available ? 'Garden / outdoor' : 'No outdoor space'} available={garden.available} />
      <AmenityPill icon="silverware-fork-knife" label={catering ? 'Catering' : 'No catering'} available={catering} />
      <AmenityPill icon="shield-account-outline" label={security ? 'Security' : 'No security'} available={security} />
    </Row>
  );
}

/**
 * Space facts (capacity, rooms, stages), then parking and garden as two separate pills.
 * Pass amenities={false} to show the space facts only.
 */
export function VenueFacts({ venue, amenities = true }: { venue: Venue; amenities?: boolean }) {
  const facts = [
    { icon: 'account-group-outline' as const, label: `${venue.capacity} guests` },
    { icon: 'door' as const, label: `${venue.rooms} room${venue.rooms === 1 ? '' : 's'}` },
    { icon: 'speaker' as const, label: `${venue.stages} stage${venue.stages === 1 ? '' : 's'}` },
  ];
  const parking = venueParking(venue);
  const garden = venueGarden(venue);
  return (
    <View style={{ gap: 8 }}>
      <Row gap={14} style={{ flexWrap: 'wrap' }}>
        {facts.map((f) => (
          <Row key={f.label} gap={4}><Icon name={f.icon} size={17} color={colors.brand} /><T v="smallBold" color={colors.inkSoft}>{f.label}</T></Row>
        ))}
      </Row>
      {amenities ? (
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          <AmenityPill icon="parking" label={parkingLine(venue)} available={parking.available} />
          <AmenityPill icon="tree-outline" label={gardenShort(venue)} available={garden.available} />
        </Row>
      ) : null}
    </View>
  );
}

// ---------- Provider services (F05, F08) ----------

/** A separate charge line: "Travel · €40" / "Travel included" / not listed. */
function ChargeRow({ icon, what, amount, note }: { icon: IconName; what: string; amount?: number; note?: string }) {
  if (amount == null) return <InfoRow icon={icon} label={what} value="No separate charge listed. Ask in your request." available={false} />;
  if (amount === 0) return <InfoRow icon={icon} label={`${what} included`} value={`No separate ${what.toLowerCase()} charge`} />;
  return <InfoRow icon={icon} label={`${what} · ${euro(amount)}`} value={note ? `${note}. Charged separately from the performance fee.` : 'Charged separately from the performance fee.'} />;
}

/**
 * "Services and pricing" for an artist: listed hourly price or quote on request, travel and
 * equipment as separate charges, and an example breakdown (no invented total for quote pricing).
 * Pass `services` for artists who manage their services in the app (performance types and terms).
 */
export function ArtistPricingCard({ artist, services, hours = 4 }: { artist: Profile; services?: Pick<ArtistServices, 'performances' | 'performanceNote' | 'performanceTerms'>; hours?: number }) {
  const quote = artist.pricing === 'quote' || !artist.feePerHour;
  const est = artistEstimate(artist, { hours, travel: true, equipment: true });
  const c = artist.charges;
  return (
    <Card style={{ gap: 10 }}>
      <InfoRow
        icon="microphone"
        label={quote ? 'Performance · quote on request' : `Performance · ${euro(artist.feePerHour ?? 0)} per hour`}
        value={services?.performanceNote?.trim() || (quote ? 'Send your date, hours and guest count to get an itemised quote.' : 'Listed price for the performance itself.')}
      />
      {services?.performances.length ? (
        <Row gap={6} style={{ flexWrap: 'wrap', paddingLeft: 48 }}>
          {services.performances.map((p) => <Pill key={p} label={p} tone="neutral" />)}
        </Row>
      ) : null}
      <ChargeRow icon="car-outline" what="Travel" amount={c?.travel} note={c?.travelNote} />
      <ChargeRow icon="speaker" what="Equipment" amount={c?.equipment} note={c?.equipmentNote} />
      <Divider />
      {quote ? (
        <T v="small">No total is shown for quote-based services. The artist replies with an itemised quote, with travel and equipment as separate lines, and you decide whether to accept it.</T>
      ) : (
        <View style={{ gap: 8 }}>
          <T v="label">Example: {hours}-hour performance</T>
          <LineItems items={toLineItems(est.items)} total={est.total} totalLabel="Example total" />
          <T v="small">Before the service fee. Your request shows the exact breakdown for your date.</T>
        </View>
      )}
      {services?.performanceTerms?.trim() ? (
        <View style={{ gap: 2 }}>
          <T v="label">Performance terms</T>
          <T v="small">{services.performanceTerms.trim()}</T>
        </View>
      ) : null}
    </Card>
  );
}

/** "€45 per session" or "Quote on request". */
export function lessonPriceLabel(lesson: Pick<Lesson, 'price' | 'quote'>) {
  return lesson.quote || lesson.price == null ? 'Quote on request' : `${euro(lesson.price)} per session`;
}

/** A lesson service (F23): format, duration, level and its own price, never the performance fee. */
export function LessonCard({ lesson, onPress, right }: { lesson: Lesson; onPress?: () => void; right?: ReactNode }) {
  const where = lesson.format === 'online' ? LESSON_FORMAT_LABEL.online : lesson.location || LESSON_FORMAT_LABEL[lesson.format];
  const a11y = `${lesson.title}, ${lesson.instrument}, ${lesson.level}, ${where}, ${lesson.durationMin} minutes, ${lessonPriceLabel(lesson)}`;
  return (
    <Card onPress={onPress} accessibilityLabel={onPress ? a11y : undefined} style={{ gap: 8 }}>
      <Row gap={12} align="flex-start">
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="school-outline" size={20} color={colors.brand} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="title" numberOfLines={2}>{lesson.title}</T>
          <T v="small">{lesson.instrument} · {lesson.level}</T>
        </View>
        {right ?? (onPress ? <Icon name="chevron-right" size={22} color={colors.subtle} /> : null)}
      </Row>
      <Row gap={14} style={{ flexWrap: 'wrap', paddingLeft: 52 }}>
        <Row gap={4}><Icon name={LESSON_FORMAT_ICON[lesson.format]} size={15} color={colors.brand} /><T v="small" color={colors.inkSoft}>{where}</T></Row>
        <Row gap={4}><Icon name="clock-outline" size={15} color={colors.brand} /><T v="small" color={colors.inkSoft}>{lesson.durationMin} min</T></Row>
        <Row gap={4}><Icon name="cash-multiple" size={15} color={colors.brand} /><T v="smallBold" color={colors.ink}>{lessonPriceLabel(lesson)}</T></Row>
      </Row>
      {lesson.description ? <T v="small" style={{ paddingLeft: 52 }} numberOfLines={2}>{lesson.description}</T> : null}
    </Card>
  );
}

/** Recommend / Not recommended badge on a musician review. */
export function RecommendBadge({ recommend }: { recommend: boolean }) {
  return recommend ? <Pill label="Recommended" tone="success" icon="thumb-up" /> : <Pill label="Not recommended" tone="neutral" icon="thumb-down" />;
}

/** Praise tags on one musician review (no counts). */
export function ReviewTags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <Row gap={6} style={{ flexWrap: 'wrap' }}>
      {tags.map((t) => (
        <View key={t} style={{ paddingHorizontal: 10, height: 26, borderRadius: 13, justifyContent: 'center', backgroundColor: colors.brandTint, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.brand }}>{t}</Text>
        </View>
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
  const name = profileById(id)?.name ?? venueById(id)?.name;
  const verb = following ? 'Unfollow' : 'Follow';
  return (
    <Button
      title={following ? 'Following' : 'Follow'}
      accessibilityLabel={name ? `${verb} ${name}` : verb}
      accessibilityState={{ selected: following }}
      icon={following ? 'check' : 'account-plus-outline'}
      variant={following ? 'secondary' : 'primary'}
      size={size}
      // sm is 38 px tall: extend the touch target to 44 px.
      hitSlop={size === 'sm' ? { top: 4, bottom: 4, left: 4, right: 4 } : undefined}
      onPress={() => toggle(id)}
    />
  );
}

export function BackOverlay({ onPress }: { onPress: () => void }) {
  return <IconButton name="chevron-left" label="Back" color={colors.white} bg="rgba(0,0,0,0.35)" size={44} iconSize={28} onPress={onPress} />;
}

const pillDark = { backgroundColor: colors.brandDark, borderRadius: 14, paddingHorizontal: 12, height: 30, justifyContent: 'center' as const };
const pillDarkText = { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 13 };
