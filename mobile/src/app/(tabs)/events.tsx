import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventRow } from '../../components/cards';
import { DomtakHeader } from '../../components/layout';
import { Button, Icon, Photo, Pill, Row, T } from '../../components/ui';
import { eventCategories } from '../../data/mock';
import { parse, shortDate, time, TODAY } from '../../lib/format';
import { isPromoted } from '../../lib/promotions';
import { activeFilterCount, useFilters } from '../../store/filters';
import { useAllEvents, useApp, useVenues } from '../../store/useApp';
import { colors, fonts, shadow } from '../../theme';

export default function EventsTab() {
  const { width } = useWindowDimensions();
  const all = useAllEvents();
  const venues = useVenues();
  const promotions = useApp((s) => s.promotions);
  const filterCount = useFilters((s) => activeFilterCount(s.filters));
  const { featured, comingUp, promoted } = useMemo(() => {
    // Private events are invite-only, and past events don't belong in discovery.
    const open = all.filter((e) => !e.isPrivate && parse(e.end) >= TODAY);
    const byDate = [...open].sort((a, b) => a.start.localeCompare(b.start));
    // Boosted events (Pro → Promote) lead both lists in date order, marked as Sponsored.
    const boosted = new Set(open.filter((e) => isPromoted(promotions, e)).map((e) => e.id));
    const sponsoredFirst = byDate.filter((e) => boosted.has(e.id));
    return {
      featured: [...sponsoredFirst, ...open.filter((e) => !boosted.has(e.id) && (e.sponsored || e.going > 200))].slice(0, 4),
      comingUp: [...sponsoredFirst, ...byDate.filter((e) => !boosted.has(e.id))].slice(0, 4),
      promoted: boosted,
    };
  }, [all, promotions]);
  const venueName = (id: string) => venues.find((v) => v.id === id)?.name;
  const [slide, setSlide] = useState(0);
  const tile = (width - 32 - 12) / 2;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.brandDeep }}>
      <DomtakHeader />
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 32 }}>
        <View>
          <FlatList
            data={featured}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(e) => e.id}
            onMomentumScrollEnd={(e) => setSlide(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item }) => (
              <Pressable accessibilityRole="button" accessibilityLabel={promoted.has(item.id) ? `Sponsored: ${item.title}` : item.title} onPress={() => router.push(`/event/${item.id}`)} style={{ width, height: 260 }}>
                <Photo src={item.cover} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                <LinearGradient colors={['transparent', 'rgba(20,10,40,0.9)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 160 }} />
                <View style={{ position: 'absolute', left: 20, right: 20, bottom: 28, gap: 4 }}>
                  {promoted.has(item.id) ? (
                    <Pill label="Sponsored" icon="star-four-points-outline" />
                  ) : (
                    <Text style={{ color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1 }}>{item.sponsored ? 'FEATURED' : 'TRENDING IN BERLIN'}</Text>
                  )}
                  <Text style={{ color: colors.white, fontFamily: fonts.display, fontSize: 26 }} numberOfLines={1}>{item.title}</Text>
                  <Text style={{ color: colors.lilacLight, fontFamily: fonts.bodyMedium, fontSize: 14 }} numberOfLines={1}>{[shortDate(item.start), time(item.start), venueName(item.venueId)].filter(Boolean).join(' · ')}</Text>
                </View>
              </Pressable>
            )}
          />
          <Row gap={5} style={{ position: 'absolute', bottom: 12, alignSelf: 'center' }}>
            {featured.map((e, i) => <View key={e.id} style={{ width: i === slide ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === slide ? colors.white : 'rgba(255,255,255,0.5)' }} />)}
          </Row>
        </View>

        <View style={{ padding: 16, gap: 14 }}>
          <Row gap={10}>
            <Pressable accessibilityRole="search" accessibilityLabel="Search events" onPress={() => router.push('/search?type=event')} style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, ...shadow(1) }}>
              <Icon name="magnify" size={22} color={colors.muted} />
              <T v="body" color={colors.subtle}>Search events</T>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Map view" onPress={() => router.push('/map')} style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="map-outline" size={22} color={colors.white} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Filters${filterCount ? `, ${filterCount} active` : ''}`} onPress={() => router.push({ pathname: '/filters', params: { next: '/events/all' } })} style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="tune-variant" size={22} color={colors.white} />
              {filterCount ? (
                <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white }}>
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: colors.brandDark }}>{filterCount}</Text>
                </View>
              ) : null}
            </Pressable>
          </Row>

          <T v="h3" color={colors.brandDeep}>Events category</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {eventCategories.map((c) => (
              <Pressable key={c.key} accessibilityRole="button" accessibilityLabel={c.label} onPress={() => router.push(`/events/${c.key}`)} style={{ width: tile, height: tile * 0.72, borderRadius: 20, overflow: 'hidden', ...shadow(2) }}>
                <Photo src={c.image} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(20,10,40,0.75)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                <Text style={{ position: 'absolute', left: 14, bottom: 12, right: 10, color: colors.white, fontFamily: fonts.displaySemi, fontSize: 18 }}>{c.label}</Text>
              </Pressable>
            ))}
          </View>

          <Row justify="space-between" style={{ marginTop: 8 }}>
            <T v="h3" color={colors.brandDeep}>Coming up</T>
            <Pressable accessibilityRole="button" accessibilityLabel="See all events" onPress={() => router.push('/events/all')} hitSlop={12}><T v="smallBold" color={colors.brand}>All events</T></Pressable>
          </Row>
          {comingUp.map((e) => (
            <View key={e.id} style={{ gap: 6 }}>
              {promoted.has(e.id) ? <Pill label="Sponsored" icon="star-four-points-outline" /> : null}
              <EventRow event={e} />
            </View>
          ))}
          <Button title="Browse venues" variant="secondary" icon="storefront-outline" onPress={() => router.push('/venues')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
