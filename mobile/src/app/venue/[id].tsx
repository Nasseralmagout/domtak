import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackOverlay, EventRow, HeartToggle, VenueFacts } from '../../components/cards';
import { BottomBar, goBack } from '../../components/layout';
import { Avatar, Button, Icon, Photo, RatingBadge, Row, SectionTitle, Stars, T } from '../../components/ui';
import { followersOf, profileById, reviewsFor, venueById } from '../../data/mock';
import { compact, euro, shortDate } from '../../lib/format';
import { useAllEvents, useApp } from '../../store/useApp';
import { colors, fonts, radius, shadow } from '../../theme';

export default function VenueDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const venue = venueById(id ?? '');
  const wished = useApp((s) => (id ? s.wishlist.venues.includes(id) : false));
  const following = useApp((s) => (id ? !!s.following[id] : false));
  const toggleWish = useApp((s) => s.toggleWish);
  const toggleFollow = useApp((s) => s.toggleFollow);
  const ensureConversation = useApp((s) => s.ensureConversation);
  const blocked = useApp((s) => s.blocked);
  const bookings = useApp((s) => s.bookings);
  const myReviews = useApp((s) => s.reviews);
  const user = useApp((s) => s.user);
  const events = useAllEvents();
  const [slide, setSlide] = useState(0);

  if (!venue) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 24, gap: 12 }}>
        <T v="h2">Venue not found</T>
        <Button title="Back" onPress={() => goBack('/venues')} />
      </SafeAreaView>
    );
  }
  const gallery = [venue.cover, ...venue.gallery];
  const upcoming = events.filter((e) => e.venueId === venue.id);
  const fans = followersOf(venue.id).filter((p) => !blocked.includes(p.id)).slice(0, 5);
  const half = Math.ceil(venue.occasions.length / 2);
  const followerCount = venue.followers + (following ? 1 : 0);

  // Reviews: your own (from completed bookings) first, then guests, newest first.
  const mine = bookings
    .filter((b) => b.targetId === venue.id && myReviews[b.id])
    .map((b) => ({ id: `mine-${b.id}`, authorId: 'me', rating: myReviews[b.id].rating, text: myReviews[b.id].text, date: b.date, context: b.eventTitle }));
  const allReviews = [
    ...mine,
    ...reviewsFor(venue.id)
      .filter((r) => !blocked.includes(r.authorId))
      .sort((a, b) => b.date.localeCompare(a.date)),
  ];
  const reviewCount = allReviews.length;
  const rating = reviewCount ? allReviews.reduce((n, r) => n + r.rating, 0) / reviewCount : venue.rating;
  const openRatings = () => router.push(`/ratings/${venue.id}`);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ height: 340 }}>
          <FlatList
            data={gallery}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(g, i) => `${g}-${i}`}
            onMomentumScrollEnd={(e) => setSlide(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item }) => <Photo src={item} style={{ width, height: 340 }} />}
          />
          <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0.35)', 'transparent', 'rgba(20,10,40,0.9)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <SafeAreaView edges={['top']} style={{ position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 4 }}>
            <BackOverlay onPress={() => goBack('/venues')} />
            <HeartToggle on={wished} onPress={() => toggleWish('venues', venue.id)} label={wished ? 'Remove from wishlist' : 'Save to wishlist'} />
          </SafeAreaView>
          <Row style={{ position: 'absolute', left: 20, right: 16, bottom: 18 }} justify="space-between" align="flex-end">
            <View>
              <Text style={{ color: colors.white, fontFamily: fonts.display, fontSize: 30 }}>{venue.name}</Text>
              <Text style={{ color: colors.lilacLight, fontFamily: fonts.bodyMedium, fontSize: 14 }}>{venue.city}, {venue.postcode}</Text>
            </View>
            <Row gap={8}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Rated ${rating.toFixed(1)} out of 5${reviewCount ? ` from ${reviewCount} reviews` : ''}. See reviews`} onPress={openRatings} hitSlop={8}>
                <RatingBadge value={rating} />
              </Pressable>
              <Button title={following ? 'Following' : 'Follow'} icon={following ? 'check' : 'plus'} size="sm" onPress={() => toggleFollow(venue.id)} />
            </Row>
          </Row>
          <Row gap={5} style={{ position: 'absolute', top: 70, alignSelf: 'center' }}>
            {gallery.map((g, i) => <View key={`${g}-${i}`} style={{ width: i === slide ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === slide ? colors.white : 'rgba(255,255,255,0.5)' }} />)}
          </Row>
        </View>

        <View style={{ padding: 16, gap: 18 }}>
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
          <Row gap={8}>
            <Icon name="rotate-3d-variant" size={22} color={colors.ink} />
            <T v="h3">Overview 360°</T>
          </Row>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            <View style={pill}><Text style={pillText}>{euro(venue.pricePerNight)}/Night</Text></View>
            <View style={pill}><Text style={pillText}>{venue.equipment}</Text></View>
          </Row>
          <VenueFacts venue={venue} />

          <View style={{ gap: 10 }}>
            <T v="h3" color={colors.brandDeep}>Occasions</T>
            <Row align="flex-start" gap={12}>
              {[venue.occasions.slice(0, half), venue.occasions.slice(half)].map((col, ci) => (
                <View key={ci} style={{ flex: 1, gap: 8 }}>
                  {col.map((o) => <Row key={o} gap={6}><Icon name="check" size={16} color={colors.brand} /><T v="body" style={{ flex: 1 }}>{o}</T></Row>)}
                </View>
              ))}
            </Row>
          </View>
          <View style={{ gap: 6 }}>
            <T v="h3" color={colors.brandDeep}>Description</T>
            <T v="body" color={colors.inkSoft}>{venue.description}</T>
          </View>
          <Row gap={10} style={{ backgroundColor: colors.brandTint, padding: 14, borderRadius: 16 }}>
            <Icon name="shield-check-outline" size={22} color={colors.brand} />
            <T v="small" color="#2E1D5E" style={{ flex: 1 }}>Booking guarantee: your payment stays in escrow until the venue confirms your date.</T>
          </Row>
          {upcoming.length ? (
            <View style={{ gap: 10 }}>
              <SectionTitle title="Upcoming here" />
              {upcoming.map((e) => <EventRow key={e.id} event={e} />)}
            </View>
          ) : null}

          <View style={{ gap: 12 }}>
            <Row justify="space-between">
              <T v="h3" color={colors.brandDeep}>Reviews</T>
              {reviewCount ? (
                <Row gap={6}>
                  <Stars value={rating} size={14} />
                  <T v="bodyBold">{rating.toFixed(1).replace('.', ',')}</T>
                  <T v="small">({reviewCount})</T>
                </Row>
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
              <Button title={`See all ${reviewCount} review${reviewCount === 1 ? '' : 's'}`} variant="secondary" size="md" icon="star-outline" onPress={openRatings} />
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
        <Row gap={12}>
          <Button title="Message" variant="secondary" style={{ flex: 1 }} onPress={() => router.push(`/chat/${ensureConversation(venue.id)}`)} />
          <Button title="Book" style={{ flex: 1.4 }} onPress={() => router.push({ pathname: '/booking/new', params: { type: 'venue', id: venue.id } })} />
        </Row>
      </BottomBar>
    </View>
  );
}

const pill = { backgroundColor: colors.brandDark, borderRadius: 16, paddingHorizontal: 16, height: 36, justifyContent: 'center' as const };
const pillText = { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 15 };
