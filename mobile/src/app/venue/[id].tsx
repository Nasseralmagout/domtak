import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackOverlay, EventRow, HeartToggle, VenueAmenities } from '../../components/cards';
import { BottomBar, goBack } from '../../components/layout';
import { Avatar, Banner, Button, Card, Chip, Icon, type IconName, InfoRow, LineItems, Photo, RatingBadge, Row, SectionTitle, Stars, Stepper, T } from '../../components/ui';
import { followersOf, PARKING_KIND_LABEL, profileById, reviewsFor, venueGarden, venueParking } from '../../data/mock';
import { compact, euro, plural, shortDate } from '../../lib/format';
import { cateringCost, guardsFor, securityCost, securityRequired, toLineItems, venueEstimate } from '../../lib/pricing';
import { isUpcoming } from '../../store/filters';
import { useServices } from '../../store/services';
import { toast } from '../../store/toast';
import { activeWorkspace, OWN_VENUE_ID, useAllEvents, useApp, useRating, useVenue } from '../../store/useApp';
import { colors, fonts, radius, shadow } from '../../theme';

/** What the listed equipment level means for the host (anything not listed reads as included). */
const EQUIPMENT_NOTE: Record<string, string> = {
  'Full equipment': 'Full sound and light equipment included with the venue hire',
  'Sound & light': 'Sound system and lights included with the venue hire',
  'Sound system': 'Sound system included. Bring your own lights or ask the venue.',
  'Stage only': 'A stage, but no sound or light. Bring your own or ask the venue.',
};

/** One clearly separated block on the venue page. */
function Section({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Row gap={8}>
        <Icon name={icon} size={20} color={colors.brandDeep} />
        <T v="h3" color={colors.brandDeep} accessibilityRole="header">{title}</T>
      </Row>
      {children}
    </View>
  );
}

/** One cell of the key-facts block. */
function Fact({ icon, value, label, onPress, a11y }: { icon: IconName; value: string; label: string; onPress?: () => void; a11y: string }) {
  const body = (
    <>
      <Icon name={icon} size={20} color={colors.brand} />
      <T v="h3" numberOfLines={1}>{value}</T>
      <T v="small" numberOfLines={1}>{label}</T>
    </>
  );
  const style = { width: '50%' as const, padding: 12, gap: 2, minHeight: 88 };
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} style={({ pressed }) => [style, { opacity: pressed ? 0.6 : 1 }]}>
      {body}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={a11y} style={style}>
      {body}
    </View>
  );
}

export default function VenueDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  // Includes the owner's published listing (Pro → Venue listing) for their own venue.
  const venue = useVenue(id);
  // Same review average as the venue cards and /ratings. Venues keep star ratings.
  const { rating, count: reviewCount } = useRating(id ?? '');
  const wished = useApp((s) => (id ? s.wishlist.venues.includes(id) : false));
  const following = useApp((s) => (id ? !!s.following[id] : false));
  const toggleWish = useApp((s) => s.toggleWish);
  const toggleFollow = useApp((s) => s.toggleFollow);
  const ensureConversation = useApp((s) => s.ensureConversation);
  const blocked = useApp((s) => s.blocked);
  const bookings = useApp((s) => s.bookings);
  const myReviews = useApp((s) => s.reviews);
  const user = useApp((s) => s.user);
  const venueDraft = useServices((s) => s.venueDraft);
  const events = useAllEvents();
  const [slide, setSlide] = useState(0);
  const [guestsPicked, setGuests] = useState<number>();
  const [withCatering, setWithCatering] = useState(true);
  const [withSecurity, setWithSecurity] = useState(false);
  const [extras, setExtras] = useState<string[]>([]);

  if (!venue) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 24, gap: 12 }}>
        <T v="h2">Venue not found</T>
        <Button title="Back" onPress={() => goBack('/venues')} />
      </SafeAreaView>
    );
  }
  const gallery = [venue.cover, ...venue.gallery];
  // Public events that have not ended yet (private events only for their organizer, i.e. you). Drafts and cancelled events are not listed.
  const upcoming = events
    .filter((e) => e.venueId === venue.id && (!e.isPrivate || e.organizerId === 'me') && e.state !== 'draft' && e.state !== 'cancelled' && isUpcoming(e))
    .sort((a, b) => a.start.localeCompare(b.start));
  const fans = followersOf(venue.id).filter((p) => !blocked.includes(p.id)).slice(0, 5);
  const half = Math.ceil(venue.occasions.length / 2);
  const followerCount = venue.followers + (following ? 1 : 0);
  // The approved venue owner previewing their own public page edits it instead of following, messaging or booking themselves.
  const isOwner = activeWorkspace(user) === 'venue' && venue.id === OWN_VENUE_ID;
  const quote = venue.pricing === 'quote';

  const parking = venueParking(venue);
  const garden = venueGarden(venue);
  const catering = venue.catering?.available ? venue.catering : undefined;
  const security = venue.security?.available ? venue.security : undefined;
  const facilities = venue.facilities ?? [];
  const requirements = venue.requirements ?? [];
  const extraCharges = venue.extraCharges ?? [];

  // Live estimate: catering and security depend on how many guests come.
  const guests = Math.min(venue.capacity, guestsPicked ?? Math.min(120, venue.capacity));
  const mustHaveSecurity = securityRequired(venue, guests);
  const includeSecurity = !!security && (withSecurity || mustHaveSecurity);
  const includeCatering = !!catering && withCatering;
  const guards = security ? guardsFor(guests, security.guestsPerGuard) : 0;
  const estimate = venueEstimate(venue, { guests, catering: includeCatering, security: includeSecurity, extras });
  const quickLine = [
    catering ? `catering ${euro(cateringCost(venue, guests))}` : '',
    security ? `security ${euro(securityCost(venue, guests))} (${plural(guards, 'guard')})` : '',
  ]
    .filter(Boolean)
    .join(', ');

  // Reviews: your own (from completed bookings) first, then guests, newest first.
  const mine = bookings
    .filter((b) => b.targetId === venue.id && myReviews[b.id] && myReviews[b.id].rating > 0)
    .map((b) => {
      const r = myReviews[b.id];
      const tags = r.tags ?? [];
      return { id: `mine-${b.id}`, authorId: 'me', rating: r.rating, text: r.text || (tags.length ? `Loved the ${tags.join(', ').toLowerCase()}.` : ''), date: b.date, context: b.eventTitle };
    });
  const allReviews = [
    ...mine,
    ...reviewsFor(venue.id)
      .filter((r) => !blocked.includes(r.authorId))
      .sort((a, b) => b.date.localeCompare(a.date)),
  ];
  const reviewsLabel = `${reviewCount} review${reviewCount === 1 ? '' : 's'}`;
  const ratingText = rating.toFixed(1).replace('.', ',');
  const openRatings = () => router.push(`/ratings/${venue.id}`);
  // The estimate choices travel with the request (booking/new can prefill them).
  const book = () =>
    router.push({
      pathname: '/booking/new',
      params: { type: 'venue', id: venue.id, guests: String(guests), catering: includeCatering ? '1' : '0', security: includeSecurity ? '1' : '0', extras: extras.join(',') },
    });

  const parkingValue = parking.available
    ? [parking.spaces ? plural(parking.spaces, 'space') : '', parking.notes ?? ''].filter(Boolean).join(' · ') || 'Ask the venue for details'
    : parking.notes || 'Plan another way to arrive';
  const gardenValue = garden.available
    ? [garden.capacity ? `Up to ${garden.capacity} guests` : '', garden.covered ? 'Covered' : 'Open air, not covered', garden.notes ?? ''].filter(Boolean).join(' · ')
    : garden.notes || 'All space is indoors';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ height: 320 }}>
          <FlatList
            data={gallery}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(g, i) => `${g}-${i}`}
            onMomentumScrollEnd={(e) => setSlide(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item }) => <Photo src={item} style={{ width, height: 320 }} />}
          />
          <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0.35)', 'transparent', 'rgba(20,10,40,0.9)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <SafeAreaView edges={['top']} style={{ position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 4 }}>
            <BackOverlay onPress={() => goBack('/venues')} />
            <HeartToggle on={wished} onPress={() => toggleWish('venues', venue.id)} label={wished ? 'Remove from wishlist' : 'Save to wishlist'} />
          </SafeAreaView>
          <Row style={{ position: 'absolute', left: 20, right: 16, bottom: 18 }} justify="space-between" align="flex-end">
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ color: colors.white, fontFamily: fonts.display, fontSize: 30 }}>{venue.name}</Text>
              <Text style={{ color: colors.lilacLight, fontFamily: fonts.bodyMedium, fontSize: 14 }}>{venue.type} · {venue.area}, {venue.city} {venue.postcode}</Text>
            </View>
            {isOwner ? null : (
              <Button
                title={following ? 'Following' : 'Follow'}
                accessibilityLabel={following ? `Unfollow ${venue.name}` : `Follow ${venue.name}`}
                icon={following ? 'check' : 'plus'}
                size="sm"
                hitSlop={4}
                onPress={() => toggleFollow(venue.id)}
              />
            )}
          </Row>
          <Row gap={5} style={{ position: 'absolute', top: 70, alignSelf: 'center' }}>
            {gallery.map((g, i) => <View key={`${g}-${i}`} style={{ width: i === slide ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === slide ? colors.white : 'rgba(255,255,255,0.5)' }} />)}
          </Row>
        </View>

        <View style={{ padding: 16, gap: 22 }}>
          {isOwner && venueDraft ? (
            <Banner icon="file-document-edit-outline" tone="warning">
              <View style={{ gap: 6 }}>
                <T v="small" color={colors.warning}>You have unpublished changes in a draft. Guests see this published version until you publish.</T>
                <Button title="Open draft" size="sm" variant="secondary" hitSlop={4} style={{ alignSelf: 'flex-start' }} onPress={() => router.navigate('/pro/venue-listing')} />
              </View>
            </Banner>
          ) : null}

          {/* Key facts at a glance */}
          <Card padded={false} style={{ flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 4 }}>
            <Fact icon="account-group-outline" value={String(venue.capacity)} label="guests at most" a11y={`Capacity: up to ${venue.capacity} guests`} />
            <Fact icon="door" value={`${venue.rooms} · ${venue.stages}`} label={`${venue.rooms === 1 ? 'room' : 'rooms'} · ${venue.stages === 1 ? 'stage' : 'stages'}`} a11y={`${plural(venue.rooms, 'room')} and ${plural(venue.stages, 'stage')}`} />
            <Fact
              icon="cash-multiple"
              value={quote ? 'Quote' : euro(venue.pricePerNight)}
              label={quote ? 'Request a quote' : 'per night'}
              a11y={quote ? 'Price on request. Request a quote.' : `${euro(venue.pricePerNight)} per night`}
            />
            <Fact
              icon="star"
              value={reviewCount ? ratingText : 'New'}
              label={reviewCount ? reviewsLabel : 'No reviews yet'}
              a11y={reviewCount ? `Rated ${ratingText} out of 5 from ${reviewsLabel}. See reviews` : 'No reviews yet. See reviews'}
              onPress={openRatings}
            />
          </Card>
          <VenueAmenities venue={venue} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${compact(followerCount)} followers. Show followers`}
            onPress={() => router.push(`/connections/${venue.id}?tab=followers`)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, alignSelf: 'flex-start', opacity: pressed ? 0.6 : 1 })}
          >
            <Row gap={0}>{fans.map((f, i) => <View key={f.id} style={{ marginLeft: i ? -10 : 0 }}><Avatar src={f.avatar} size={32} /></View>)}</Row>
            <T v="bodyBold" color={colors.brandDeep}>{compact(followerCount)} <T v="body" color={colors.brandDeep}>Followers</T></T>
            <Icon name="chevron-right" size={20} color={colors.brandDeep} />
          </Pressable>

          <Section icon="text-box-outline" title="About">
            <T v="body" color={colors.inkSoft}>{venue.description}</T>
          </Section>

          {/* Parking and garden are two separate items. */}
          <Section icon="parking" title="Parking">
            <Card>
              <InfoRow
                icon="parking"
                label={parking.available ? (parking.kind ? PARKING_KIND_LABEL[parking.kind] : 'Parking available') : 'No parking on site'}
                value={parkingValue}
                available={parking.available}
              />
            </Card>
          </Section>

          <Section icon="tree-outline" title="Garden and outdoor space">
            <Card>
              <InfoRow icon="tree-outline" label={garden.available ? 'Garden / outdoor space available' : 'No garden or outdoor space'} value={gardenValue} available={garden.available} />
            </Card>
          </Section>

          <Section icon="speaker" title="Facilities and equipment">
            <Card style={{ gap: 10 }}>
              {venue.equipment === 'No equipment' ? (
                <InfoRow icon="speaker" label="No equipment included" value="Bring your own sound and light, or ask the venue." available={false} />
              ) : (
                <InfoRow icon="speaker" label={venue.equipment} value={EQUIPMENT_NOTE[venue.equipment] ?? 'Included with the venue hire'} />
              )}
              {facilities.length ? (
                <Row gap={8} style={{ flexWrap: 'wrap' }}>
                  {facilities.map((f) => (
                    <Row key={f} gap={4} style={{ paddingHorizontal: 10, height: 30, borderRadius: 15, backgroundColor: colors.brandTint }}>
                      <Icon name="check" size={14} color={colors.brand} />
                      <T v="smallBold" color={colors.inkSoft}>{f}</T>
                    </Row>
                  ))}
                </Row>
              ) : (
                <T v="small">No other facilities listed yet.</T>
              )}
            </Card>
          </Section>

          <Section icon="clipboard-check-outline" title="Requirements">
            <Card style={{ gap: 8 }}>
              {requirements.length ? (
                requirements.map((r) => (
                  <Row key={r} gap={10} align="flex-start">
                    <Icon name="alert-circle-outline" size={18} color={colors.warningStrong} />
                    <T v="body" style={{ flex: 1 }}>{r}</T>
                  </Row>
                ))
              ) : (
                <T v="small">The venue has not listed any special requirements.</T>
              )}
            </Card>
          </Section>

          {/* Catering and security are priced by attendance; each is its own item. */}
          <Section icon="silverware-fork-knife" title="Catering">
            <Card>
              <InfoRow
                icon="silverware-fork-knife"
                label={catering ? `${euro(catering.pricePerGuest)} per guest` : 'No catering through the venue'}
                value={
                  catering
                    ? [catering.minGuests ? `Minimum ${catering.minGuests} guests` : 'No minimum', catering.notes ?? ''].filter(Boolean).join(' · ')
                    : 'Bring your own caterer or ask the venue.'
                }
                available={!!catering}
              />
            </Card>
          </Section>

          <Section icon="shield-account-outline" title="Security">
            <Card>
              <InfoRow
                icon="shield-account-outline"
                label={security ? `${euro(security.pricePerGuard)} per guard` : 'No security through the venue'}
                value={
                  security
                    ? [`1 guard per ${security.guestsPerGuard} guests`, security.requiredFrom != null ? `required from ${security.requiredFrom} guests` : 'optional', security.notes ?? ''].filter(Boolean).join(' · ')
                    : 'Arrange your own door staff if you need them.'
                }
                available={!!security}
              />
            </Card>
          </Section>

          {extraCharges.length ? (
            <Section icon="receipt-text-outline" title="Other charges">
              <Card style={{ gap: 6 }}>
                {extraCharges.map((x) => (
                  <Row key={x.label} justify="space-between" accessibilityLabel={`${x.label}: ${euro(x.amount)}`} style={{ minHeight: 28 }}>
                    <T v="body">{x.label}</T>
                    <T v="bodyBold">{euro(x.amount)}</T>
                  </Row>
                ))}
                <T v="small">Listed separately from the venue hire. Add the ones you need to the estimate below or to your request.</T>
              </Card>
            </Section>
          ) : null}

          {catering || security || extraCharges.length ? (
            <Section icon="calculator-variant-outline" title="Estimate for your guest count">
              <Card style={{ gap: 12 }}>
                <Row justify="space-between" gap={12}>
                  <View style={{ flex: 1 }}>
                    <T v="bodyBold">Guests</T>
                    <T v="small">Up to {venue.capacity}</T>
                  </View>
                  <Stepper value={guests} onChange={setGuests} min={10} max={venue.capacity} step={10} label="guests" />
                </Row>
                {quickLine ? <T v="bodyBold" accessibilityLiveRegion="polite">For {guests} guests: {quickLine}</T> : null}
                <Row gap={8} style={{ flexWrap: 'wrap' }}>
                  {catering ? <Chip label="Catering" icon={includeCatering ? 'check' : 'plus'} selected={includeCatering} accessibilityLabel={includeCatering ? 'Remove catering from the estimate' : 'Add catering to the estimate'} onPress={() => setWithCatering(!withCatering)} /> : null}
                  {security ? (
                    <Chip
                      label={mustHaveSecurity ? 'Security required' : 'Security'}
                      icon={includeSecurity ? 'check' : 'plus'}
                      selected={includeSecurity}
                      accessibilityLabel={mustHaveSecurity ? `Security is required from ${security.requiredFrom} guests` : includeSecurity ? 'Remove security from the estimate' : 'Add security to the estimate'}
                      onPress={() => (mustHaveSecurity ? toast(`${venue.name} requires security from ${security.requiredFrom} guests`) : setWithSecurity(!withSecurity))}
                    />
                  ) : null}
                  {extraCharges.map((x) => {
                    const on = extras.includes(x.label);
                    return <Chip key={x.label} label={x.label} icon={on ? 'check' : 'plus'} selected={on} accessibilityLabel={`${on ? 'Remove' : 'Add'} ${x.label}, ${euro(x.amount)}`} onPress={() => setExtras(on ? extras.filter((e) => e !== x.label) : [...extras, x.label])} />;
                  })}
                </Row>
                {estimate.items.length ? (
                  <LineItems items={toLineItems(estimate.items)} total={estimate.total} totalLabel={quote ? 'Estimate without venue hire' : 'Estimated total'} />
                ) : (
                  <T v="small">Pick catering, security or another charge to see an estimate.</T>
                )}
                <T v="small">
                  {quote
                    ? 'Venue hire is priced on request. The venue sends an itemised quote and you decide whether to accept it.'
                    : 'Estimate before the service fee. The venue confirms the final price when it accepts your request.'}
                </T>
              </Card>
            </Section>
          ) : null}

          <Section icon="party-popper" title="Occasions">
            <Row align="flex-start" gap={12}>
              {[venue.occasions.slice(0, half), venue.occasions.slice(half)].map((col, ci) => (
                <View key={ci} style={{ flex: 1, gap: 8 }}>
                  {col.map((o) => <Row key={o} gap={6}><Icon name="check" size={16} color={colors.brand} /><T v="body" style={{ flex: 1 }}>{o}</T></Row>)}
                </View>
              ))}
            </Row>
          </Section>

          <Banner icon="shield-check-outline">
            {quote
              ? 'A quote request carries no payment. The venue replies with an itemised quote, and you pay only if you accept it. A date that looks free still needs the venue’s acceptance.'
              : 'Requests reach the venue with payment pending their decision. If the venue declines or doesn’t answer within 24 hours, the payment is released or refunded. A date that looks free still needs the venue’s acceptance.'}
          </Banner>

          {upcoming.length ? (
            <View style={{ gap: 10 }}>
              <SectionTitle title="Upcoming here" />
              {upcoming.map((e) => <EventRow key={e.id} event={e} />)}
            </View>
          ) : null}

          <View style={{ gap: 12 }}>
            <Row justify="space-between">
              <T v="h3" color={colors.brandDeep} accessibilityRole="header">Reviews</T>
              {reviewCount ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Rated ${ratingText} out of 5 from ${reviewsLabel}. See reviews`} onPress={openRatings} hitSlop={8}>
                  <RatingBadge value={rating} />
                </Pressable>
              ) : null}
            </Row>
            {allReviews.slice(0, 2).map((r) => {
              const isMine = r.authorId === 'me';
              const p = isMine ? undefined : profileById(r.authorId);
              const authorName = isMine ? 'You' : p?.name ?? 'Domtak guest';
              return (
                <Row key={r.id} gap={12} align="flex-start" style={{ backgroundColor: colors.surface, padding: 12, borderRadius: radius.md, ...shadow(1) }}>
                  <Avatar src={isMine ? user.avatar : p?.avatar} size={36} label={authorName} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Row justify="space-between"><T v="bodyBold" numberOfLines={1} style={{ flexShrink: 1 }}>{authorName}</T><Stars value={r.rating} size={12} /></Row>
                    <T v="small" style={{ fontSize: 12 }} numberOfLines={1}>{r.context} · {shortDate(r.date)}</T>
                    {r.text ? <T v="small" color={colors.inkSoft} style={{ marginTop: 2 }}>{r.text}</T> : null}
                  </View>
                </Row>
              );
            })}
            {reviewCount ? (
              <Button title={reviewCount === 1 ? 'See review' : `See all ${reviewsLabel}`} variant="secondary" size="md" icon="star-outline" onPress={openRatings} />
            ) : (
              <View style={{ backgroundColor: colors.surface, padding: 16, borderRadius: radius.md, gap: 4, ...shadow(1) }}>
                <T v="bodyBold">No reviews yet</T>
                <T v="small">Guests can review {venue.name} after a completed booking.</T>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
      <BottomBar>
        {isOwner ? (
          <View style={{ gap: 8 }}>
            <T v="small" center>This is how guests see your venue.</T>
            <Button title="Edit listing" icon="storefront-edit-outline" onPress={() => router.navigate('/pro/venue-listing')} />
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <T v="small" center>{quote ? 'Price on request · the venue replies with an itemised quote' : `${euro(venue.pricePerNight)} per night${catering || security ? ' · catering and security depend on guest count' : ''}`}</T>
            <Row gap={12}>
              <Button title="Message" variant="secondary" icon="message-text-outline" style={{ flex: 1 }} onPress={() => router.push(`/chat/${ensureConversation(venue.id)}`)} />
              <Button title={quote ? 'Request quote' : 'Book'} accessibilityLabel={quote ? `Request a quote from ${venue.name}` : `Book ${venue.name}`} style={{ flex: 1.4 }} onPress={book} />
            </Row>
          </View>
        )}
      </BottomBar>
    </View>
  );
}
