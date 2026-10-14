import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventCard } from '../../components/cards';
import { DomtakHeader, goBack, ScreenHeader } from '../../components/layout';
import { Chip, EmptyState, Field, IconButton, Row, T } from '../../components/ui';
import { venueById } from '../../data/mock';
import { activeFilterCount, applyFilters, type Filters, useFilters } from '../../store/filters';
import { useAllEvents } from '../../store/useApp';
import { colors } from '../../theme';

/** Area picked under Filters → Location (stored next to the shared filters). */
const areaOf = (f: Filters) => (f.location === 'search' ? (f as Filters & { area?: string }).area : undefined);

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
  const filters = useFilters((s) => s.filters);
  const area = areaOf(filters);
  const count = activeFilterCount(filters) + (area ? 1 : 0);

  const list = useMemo(() => {
    let l = applyFilters(events, filters).filter((e) => !e.isPrivate || e.organizerId === 'me');
    if (area) l = l.filter((e) => venueById(e.venueId)?.area === area);
    if (cat !== 'all') l = l.filter((e) => e.category === cat);
    const t = q.trim().toLowerCase();
    if (t) l = l.filter((e) => `${e.title} ${e.genre} ${e.description} ${venueById(e.venueId)?.name ?? ''}`.toLowerCase().includes(t));
    return [...l].sort((a, b) => a.start.localeCompare(b.start));
  }, [events, filters, area, cat, q]);
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
        renderItem={({ item }) => <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}><EventCard event={item} /></View>}
        ListEmptyComponent={<EmptyState icon="party-popper" title="No events found" body="Try another category or clear your filters." action="Clear filters" onAction={() => { useFilters.getState().reset(); setCat('all'); setQ(''); }} />}
      />
    </SafeAreaView>
  );
}
