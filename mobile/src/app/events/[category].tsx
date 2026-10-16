import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventCard } from '../../components/cards';
import { DomtakHeader, goBack, ScreenHeader } from '../../components/layout';
import { Button, Chip, EmptyState, Field, Icon, IconButton, Pill, Row, T } from '../../components/ui';
import type { EventItem } from '../../data/types';
import { plural } from '../../lib/format';
import { isPromoted } from '../../lib/promotions';
import { discoverableEvents, RADIUS_STEPS } from '../../store/discovery';
import { activeArea, activeFilterCount, activeRadius, applyFilters, type Filters, MAX_DISTANCE_KM, SORT_LABEL, type SortKey, sortEvents, useFilters } from '../../store/filters';
import { useAllEvents, useApp, useVenues } from '../../store/useApp';
import { colors } from '../../theme';

const CATS = [
  { key: 'all', label: 'All', icon: 'view-grid-outline' as const },
  { key: 'Concerts', label: 'Concerts', icon: 'microphone' as const },
  { key: 'Parties', label: 'Parties', icon: 'party-popper' as const },
  { key: 'Electronic', label: 'Electronic', icon: 'speaker' as const },
  { key: 'Listening', label: 'Listening', icon: 'music-circle-outline' as const },
  { key: 'Acoustic', label: 'Acoustic', icon: 'music-note' as const },
  { key: 'Festivals', label: 'Festivals', icon: 'account-group-outline' as const },
  { key: 'Family', label: 'Family', icon: 'heart-outline' as const },
];
const SORT_NEXT: Record<SortKey, SortKey> = { soonest: 'nearest', nearest: 'popular', popular: 'soonest' };

export default function EventList() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const [cat, setCat] = useState(category && CATS.some((c) => c.key === category) ? category : 'all');
  const [q, setQ] = useState('');
  const events = useAllEvents();
  const venues = useVenues();
  const promotions = useApp((s) => s.promotions);
  const filters = useFilters((s) => s.filters);
  const setFilters = useFilters((s) => s.set);
  const resetFilters = useFilters((s) => s.reset);
  const area = activeArea(filters);
  const radiusKm = activeRadius(filters);
  const count = activeFilterCount(filters);
  const sort = filters.sort ?? 'soonest';

  // Same pool as the map and search: public published events (or yours) that have not ended.
  const pool = useMemo(() => discoverableEvents(events), [events]);

  const { list, promoted, narrow } = useMemo(() => {
    const venueName = (id: string) => venues.find((v) => v.id === id)?.name ?? '';
    const t = q.trim().toLowerCase();
    const local = (l: EventItem[]) =>
      l.filter((e) => (cat === 'all' || e.category === cat) && (!t || `${e.title} ${e.genre} ${e.description} ${venueName(e.venueId)}`.toLowerCase().includes(t)));
    const run = (f: Filters) => local(applyFilters(pool, f, venues));
    const l = sortEvents(run(filters), sort);
    // Boosted events (Pro → Promote) come first, marked as Sponsored; each group keeps the chosen order.
    const boosted = new Set(l.filter((e) => isPromoted(promotions, e)).map((e) => e.id));
    // Nothing found: count what a wider distance or no filters would show, so the way out is honest.
    let wider: { km?: number; count: number } | undefined;
    if (!l.length && radiusKm != null) {
      const anyDistance = run({ ...filters, maxDistanceKm: MAX_DISTANCE_KM });
      const km = RADIUS_STEPS.find((k) => k > radiusKm && anyDistance.some((e) => e.distanceKm <= k));
      const n = anyDistance.filter((e) => km == null || e.distanceKm <= km).length;
      wider = n ? { km, count: n } : undefined;
    }
    const unfiltered = l.length ? 0 : local(pool).length;
    return { list: [...l.filter((e) => boosted.has(e.id)), ...l.filter((e) => !boosted.has(e.id))], promoted: boosted, narrow: { wider, unfiltered } };
  }, [pool, venues, promotions, filters, cat, q, sort, radiusKm]);

  const title = cat === 'all' ? 'All events' : CATS.find((c) => c.key === cat)?.label ?? 'Events';
  const where = radiusKm != null ? `within ${radiusKm} km of you` : area ? `in ${area}` : 'in Berlin';
  const clearAll = () => {
    resetFilters();
    setCat('all');
    setQ('');
  };

  const empty = (
    <View style={{ paddingHorizontal: 16, gap: 12 }}>
      <EmptyState
        icon="party-popper"
        title="No events found"
        body={
          count
            ? `No upcoming ${cat === 'all' ? '' : `${title.toLowerCase()} `}events match your filters${narrow.unfiltered ? `. ${plural(narrow.unfiltered, 'event')} without them` : ''}.`
            : q.trim()
              ? `Nothing upcoming matches “${q.trim()}”. Try another word or category.`
              : 'Nothing upcoming in this category yet. Other categories may have something on.'
        }
        action={count ? `Clear filters (${count})` : q.trim() ? 'Clear search' : 'All categories'}
        onAction={count ? resetFilters : q.trim() ? () => setQ('') : () => setCat('all')}
      />
      {narrow.wider ? (
        <Button
          title={narrow.wider.km != null ? `Widen to ${narrow.wider.km} km · ${plural(narrow.wider.count, 'event')}` : `Any distance · ${plural(narrow.wider.count, 'event')}`}
          variant="light"
          size="md"
          onPress={() => setFilters({ maxDistanceKm: narrow.wider?.km ?? MAX_DISTANCE_KM })}
        />
      ) : null}
      {count || q.trim() || cat !== 'all' ? <Button title="Start over" variant="ghost" size="md" onPress={clearAll} /> : null}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.brandDeep }}>
      <DomtakHeader showMenu={false} />
      <FlatList
        style={{ flex: 1, backgroundColor: colors.bg }}
        data={list}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 12, paddingBottom: 12 }}>
            <ScreenHeader
              title={title}
              onBack={() => goBack('/(tabs)/events')}
              right={
                <Row gap={0}>
                  <IconButton name="map-outline" label="Show nearby events on the map" onPress={() => router.push('/map')} />
                  <IconButton name="tune-variant" label={`Filters${count ? `, ${count} active` : ''}`} badge={count || undefined} onPress={() => router.push('/filters')} />
                </Row>
              }
            />
            <View style={{ paddingHorizontal: 16 }}>
              <Field placeholder="Search by name, genre…" value={q} onChangeText={setQ} icon="magnify" accessibilityLabel={`Search ${title.toLowerCase()}`} returnKeyType="search" />
            </View>
            <T v="h3" style={{ paddingHorizontal: 16 }} accessibilityRole="header">Categories</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              {CATS.map((c) => <Chip key={c.key} label={c.label} icon={c.icon} selected={cat === c.key} onPress={() => setCat(c.key)} />)}
            </ScrollView>
            <Row justify="space-between" gap={8} style={{ paddingHorizontal: 16 }}>
              <Row gap={10} style={{ flexShrink: 1 }}>
                <T v="small" accessibilityLiveRegion="polite" style={{ flexShrink: 1 }} numberOfLines={1}>{plural(list.length, 'event')} {where}</T>
                {count ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Clear all ${count} filters`} hitSlop={12} onPress={resetFilters} style={{ minHeight: 32, justifyContent: 'center' }}>
                    <T v="smallBold" color={colors.brand}>Clear ({count})</T>
                  </Pressable>
                ) : null}
              </Row>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Sorted by ${SORT_LABEL[sort].toLowerCase()}. Sort by ${SORT_LABEL[SORT_NEXT[sort]].toLowerCase()}`}
                onPress={() => setFilters({ sort: SORT_NEXT[sort] })}
                hitSlop={12}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 }}
              >
                <Icon name="sort" size={16} color={colors.brand} />
                <T v="smallBold" color={colors.brand}>{SORT_LABEL[sort]}</T>
              </Pressable>
            </Row>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 6 }}>
            {/* EventCard already draws its own SPONSORED badge for partner events, so don't label them twice. */}
            {promoted.has(item.id) && !item.sponsored ? <Pill label="Sponsored" icon="star-four-points-outline" /> : null}
            <EventCard event={item} />
          </View>
        )}
        ListEmptyComponent={empty}
      />
    </SafeAreaView>
  );
}
