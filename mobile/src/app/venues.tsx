import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VenueCard } from '../components/cards';
import { goBack } from '../components/layout';
import { Chip, EmptyState, Icon, type IconName, IconButton, Photo, Row, T } from '../components/ui';
import { ratingFor, venueGarden, venueParking } from '../data/mock';
import type { Venue } from '../data/types';
import { useApp, useVenues } from '../store/useApp';
import { colors, fonts } from '../theme';

const TYPES: ('All' | Venue['type'])[] = ['All', 'Club', 'Open air', 'Hall', 'Garden', 'Loft', 'Bar'];

/** Amenity filters. Parking and outdoor space are separate filters, never one. */
type Amenity = 'parking' | 'garden' | 'catering' | 'security';
const AMENITIES: { key: Amenity; label: string; icon: IconName; has: (v: Venue) => boolean }[] = [
  { key: 'parking', label: 'Parking', icon: 'parking', has: (v) => venueParking(v).available },
  { key: 'garden', label: 'Garden / outdoor', icon: 'tree-outline', has: (v) => venueGarden(v).available },
  { key: 'catering', label: 'Catering', icon: 'silverware-fork-knife', has: (v) => !!v.catering?.available },
  { key: 'security', label: 'Security', icon: 'shield-account-outline', has: (v) => !!v.security?.available },
];

export default function Venues() {
  const [type, setType] = useState<(typeof TYPES)[number]>('All');
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [sort, setSort] = useState<'rating' | 'price'>('rating');
  // The owner's published listing (Moon Club) applies here too, so filters and sorting see it.
  const venues = useVenues();
  const bookings = useApp((s) => s.bookings);
  const reviews = useApp((s) => s.reviews);
  const blocked = useApp((s) => s.blocked);
  const list = useMemo(() => {
    // Same star rating the cards and /ratings show: review average incl. your own reviews, blocked authors left out.
    const ratingOf = (id: string) => ratingFor(id, { extra: bookings.filter((b) => b.targetId === id && reviews[b.id] && reviews[b.id].rating > 0).map((b) => reviews[b.id].rating), exclude: blocked });
    const l = venues.filter((v) => (type === 'All' || v.type === type) && amenities.every((a) => AMENITIES.find((x) => x.key === a)?.has(v)));
    const ratings = new Map(l.map((v) => [v.id, ratingOf(v.id)]));
    // Quote-based venues have no listed price, so they sort after the priced ones.
    const quoteRank = (v: Venue) => (v.pricing === 'quote' ? 1 : 0);
    return [...l].sort((a, b) => (sort === 'rating' ? (ratings.get(b.id) ?? 0) - (ratings.get(a.id) ?? 0) : quoteRank(a) - quoteRank(b) || a.pricePerNight - b.pricePerNight));
  }, [venues, bookings, reviews, blocked, type, amenities, sort]);
  const filtered = type !== 'All' || amenities.length > 0;
  const toggleAmenity = (a: Amenity) => setAmenities(amenities.includes(a) ? amenities.filter((x) => x !== a) : [...amenities, a]);
  const clear = () => {
    setType('All');
    setAmenities([]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={list}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListHeaderComponent={
          <View>
            <View style={{ height: 220 }}>
              <Photo src="ev_lights" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <LinearGradient colors={['rgba(0,0,0,0.4)', 'rgba(20,10,40,0.85)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <SafeAreaView edges={['top']} style={{ paddingHorizontal: 8 }}>
                <IconButton name="chevron-left" label="Back" color={colors.white} iconSize={30} onPress={() => goBack('/(tabs)/artists')} />
              </SafeAreaView>
              <View style={{ position: 'absolute', left: 20, bottom: 22, right: 20 }}>
                <Text style={{ color: colors.white, fontFamily: fonts.display, fontSize: 30 }}>All venues</Text>
                <Text style={{ color: colors.lilacLight, fontFamily: fonts.body, fontSize: 14 }}>{venues.length} spaces to book in Berlin · each venue accepts or declines your request</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 8 }}>
              {TYPES.map((t) => <Chip key={t} label={t} tone="dark" selected={type === t} onPress={() => setType(t)} />)}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>
              {AMENITIES.map((a) => (
                <Chip
                  key={a.key}
                  label={a.label}
                  icon={amenities.includes(a.key) ? 'check' : a.icon}
                  selected={amenities.includes(a.key)}
                  accessibilityLabel={`${a.label} ${amenities.includes(a.key) ? 'filter on' : 'filter off'}`}
                  onPress={() => toggleAmenity(a.key)}
                />
              ))}
            </ScrollView>
            <Row justify="space-between" style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
              <Row gap={10}>
                <T v="small">{list.length} venue{list.length === 1 ? '' : 's'}</T>
                {filtered ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Clear venue filters" onPress={clear} hitSlop={12} style={{ minHeight: 32, justifyContent: 'center' }}>
                    <T v="smallBold" color={colors.brand}>Clear filters</T>
                  </Pressable>
                ) : null}
              </Row>
              <Pressable accessibilityRole="button" accessibilityLabel={`Sorted by ${sort === 'rating' ? 'top rated' : 'lowest price'}. Change sort`} onPress={() => setSort(sort === 'rating' ? 'price' : 'rating')} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 }}>
                <Icon name={sort === 'rating' ? 'star-outline' : 'cash-multiple'} size={16} color={colors.brand} />
                <T v="smallBold" color={colors.brand}>{sort === 'rating' ? 'Top rated' : 'Lowest price'}</T>
              </Pressable>
            </Row>
          </View>
        }
        renderItem={({ item }) => <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}><VenueCard venue={item} /></View>}
        ListEmptyComponent={<EmptyState icon="storefront-outline" title="No venues match" body="No venue has everything you picked. Remove a filter to see more spaces." action="Clear filters" onAction={clear} />}
      />
    </View>
  );
}
