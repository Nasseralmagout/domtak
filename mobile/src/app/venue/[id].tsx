import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackOverlay, EventRow, HeartToggle, VenueFacts } from '../../components/cards';
import { BottomBar, goBack } from '../../components/layout';
import { Avatar, Button, Icon, Photo, RatingBadge, Row, SectionTitle, T } from '../../components/ui';
import { profiles, venueById } from '../../data/mock';
import { compact, euro } from '../../lib/format';
import { useAllEvents, useApp } from '../../store/useApp';
import { colors, fonts } from '../../theme';

export default function VenueDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const venue = venueById(id ?? '');
  const wished = useApp((s) => (id ? s.wishlist.venues.includes(id) : false));
  const following = useApp((s) => (id ? !!s.following[id] : false));
  const toggleWish = useApp((s) => s.toggleWish);
  const toggleFollow = useApp((s) => s.toggleFollow);
  const ensureConversation = useApp((s) => s.ensureConversation);
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
  const fans = profiles.filter((p) => p.kind === 'fan').slice(4, 9);
  const half = Math.ceil(venue.occasions.length / 2);

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
              <RatingBadge value={venue.rating} />
              <Button title={following ? 'Following' : 'Follow'} icon={following ? 'check' : 'plus'} size="sm" onPress={() => toggleFollow(venue.id)} />
            </Row>
          </Row>
          <Row gap={5} style={{ position: 'absolute', top: 70, alignSelf: 'center' }}>
            {gallery.map((g, i) => <View key={`${g}-${i}`} style={{ width: i === slide ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === slide ? colors.white : 'rgba(255,255,255,0.5)' }} />)}
          </Row>
        </View>

        <View style={{ padding: 16, gap: 18 }}>
          <Row gap={12}>
            <Row gap={0}>{fans.map((f, i) => <View key={f.id} style={{ marginLeft: i ? -10 : 0 }}><Avatar src={f.avatar} size={32} /></View>)}</Row>
            <T v="bodyBold" color={colors.brandDeep}>{compact(venue.followers + (following ? 1 : 0))} <T v="body" color={colors.brandDeep}>Followers</T></T>
          </Row>
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
