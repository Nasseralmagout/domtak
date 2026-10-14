import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventCard } from '../../components/cards';
import { DomtakHeader, ScreenHeader } from '../../components/layout';
import { Chip, EmptyState, Field, IconButton, T } from '../../components/ui';
import { activeFilterCount, applyFilters, useFilters } from '../../store/filters';
import { useAllEvents } from '../../store/useApp';
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
  const filters = useFilters((s) => s.filters);
  const count = activeFilterCount(filters);

  const list = useMemo(() => {
    let l = applyFilters(events, filters);
    if (cat !== 'all') l = l.filter((e) => e.category === cat);
    if (q.trim()) l = l.filter((e) => `${e.title} ${e.genre} ${e.description}`.toLowerCase().includes(q.toLowerCase()));
    return l.sort((a, b) => a.start.localeCompare(b.start));
  }, [events, filters, cat, q]);

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
              title="All events"
              right={<IconButton name="tune-variant" label={`Filters${count ? `, ${count} active` : ''}`} badge={count || undefined} onPress={() => router.push('/filters')} />}
            />
            <View style={{ paddingHorizontal: 16 }}>
              <Field placeholder="Search by name, genre…" value={q} onChangeText={setQ} icon="magnify" />
            </View>
            <T v="h3" style={{ paddingHorizontal: 16 }}>Categories</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              {CATS.map((c) => <Chip key={c.key} label={c.label} icon={c.icon} selected={cat === c.key} onPress={() => setCat(c.key)} />)}
            </ScrollView>
            <T v="small" style={{ paddingHorizontal: 16 }}>{list.length} event{list.length === 1 ? '' : 's'} in Berlin</T>
          </View>
        }
        renderItem={({ item }) => <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}><EventCard event={item} /></View>}
        ListEmptyComponent={<EmptyState icon="party-popper" title="No events found" body="Try another category or clear your filters." action="Clear filters" onAction={() => { useFilters.getState().reset(); setCat('all'); setQ(''); }} />}
      />
    </SafeAreaView>
  );
}
