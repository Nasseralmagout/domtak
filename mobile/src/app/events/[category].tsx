import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventCard } from '../../components/cards';
import { DomtakHeader, goBack, ScreenHeader } from '../../components/layout';
import { Chip, EmptyState, Field, IconButton, Pill, Row, T } from '../../components/ui';
import { isPromoted } from '../../lib/promotions';
import { activeArea, activeFilterCount, applyFilters, useFilters } from '../../store/filters';
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

export default function EventList() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const [cat, setCat] = useState(category && CATS.some((c) => c.key === category) ? category : 'all');
  const [q, setQ] = useState('');
  const events = useAllEvents();
  const venues = useVenues();
  const promotions = useApp((s) => s.promotions);
  const filters = useFilters((s) => s.filters);
  const area = activeArea(filters);
  const count = activeFilterCount(filters);

  const { list, promoted } = useMemo(() => {
    const venueName = (id: string) => venues.find((v) => v.id === id)?.name ?? '';
    let l = applyFilters(events, filters).filter((e) => !e.isPrivate || e.organizerId === 'me');
    if (cat !== 'all') l = l.filter((e) => e.category === cat);
    const t = q.trim().toLowerCase();
    if (t) l = l.filter((e) => `${e.title} ${e.genre} ${e.description} ${venueName(e.venueId)}`.toLowerCase().includes(t));
    // Boosted events (Pro → Promote) come first, marked as Sponsored; each group stays in date order.
    const boosted = new Set(l.filter((e) => isPromoted(promotions, e)).map((e) => e.id));
    const byDate = [...l].sort((a, b) => a.start.localeCompare(b.start));
    return { list: [...byDate.filter((e) => boosted.has(e.id)), ...byDate.filter((e) => !boosted.has(e.id))], promoted: boosted };
  }, [events, venues, promotions, filters, cat, q]);
  const title = cat === 'all' ? 'All events' : CATS.find((c) => c.key === cat)?.label ?? 'Events';

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.brandDeep }}>
      <DomtakHeader showMenu={false} />
      <FlatList
        style={{ flex: 1, backgroundColor: colors.bg }}
        data={list}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListHeaderComponent={
          <View style={{ gap: 12, paddingBottom: 12 }}>
            <ScreenHeader
              title={title}
              onBack={() => goBack('/(tabs)/events')}
              right={<IconButton name="tune-variant" label={`Filters${count ? `, ${count} active` : ''}`} badge={count || undefined} onPress={() => router.push('/filters')} />}
            />
            <View style={{ paddingHorizontal: 16 }}>
              <Field placeholder="Search by name, genre…" value={q} onChangeText={setQ} icon="magnify" />
            </View>
            <T v="h3" style={{ paddingHorizontal: 16 }}>Categories</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              {CATS.map((c) => <Chip key={c.key} label={c.label} icon={c.icon} selected={cat === c.key} onPress={() => setCat(c.key)} />)}
            </ScrollView>
            <Row justify="space-between" style={{ paddingHorizontal: 16 }}>
              <T v="small">{list.length} event{list.length === 1 ? '' : 's'} in {area ?? 'Berlin'}</T>
              {count ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Clear all filters" hitSlop={12} onPress={() => useFilters.getState().reset()}>
                  <T v="smallBold" color={colors.brand}>Clear filters ({count})</T>
                </Pressable>
              ) : null}
            </Row>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 6 }}>
            {promoted.has(item.id) ? <Pill label="Sponsored" icon="star-four-points-outline" /> : null}
            <EventCard event={item} />
          </View>
        )}
        ListEmptyComponent={<EmptyState icon="party-popper" title="No events found" body="Try another category or clear your filters." action="Clear filters" onAction={() => { useFilters.getState().reset(); setCat('all'); setQ(''); }} />}
      />
    </SafeAreaView>
  );
}
