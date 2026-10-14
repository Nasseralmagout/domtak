import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { type LayoutChangeEvent, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventRow } from '../components/cards';
import { goBack } from '../components/layout';
import { Button, Chip, IconButton, Photo, T } from '../components/ui';
import { venueById, venues } from '../data/mock';
import { parse, sameDay, TODAY } from '../lib/format';
import { activeFilterCount, applyFilters, type Filters, useFilters } from '../store/filters';
import { useAllEvents } from '../store/useApp';
import { colors } from '../theme';

/** Area picked under Filters → Location (stored next to the shared filters). */
const areaOf = (f: Filters) => (f.location === 'search' ? (f as Filters & { area?: string }).area : undefined);

type Quick = 'all' | 'today' | 'weekend' | 'free' | 'live' | 'venues';

export default function MapScreen() {
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const events = useAllEvents();
  const filters = useFilters((s) => s.filters);
  const resetFilters = useFilters((s) => s.reset);
  const filterCount = activeFilterCount(filters) + (areaOf(filters) ? 1 : 0);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [quick, setQuick] = useState<Quick>('all');
  const [selected, setSelected] = useState<string | undefined>(focus ?? events[0]?.id);

  const shown = useMemo(() => {
    const area = areaOf(filters);
    return applyFilters(events, filters).filter((e) => {
      if (e.isPrivate && e.organizerId !== 'me') return false;
      if (area && venueById(e.venueId)?.area !== area) return false;
      const d = parse(e.start);
      const days = (d.getTime() - TODAY.getTime()) / 86_400_000;
      if (quick === 'today') return sameDay(d, TODAY);
      if (quick === 'weekend') return (d.getDay() === 5 || d.getDay() === 6 || d.getDay() === 0) && days > -1 && days < 7;
      if (quick === 'free') return Math.min(...e.ticketTypes.map((t) => t.price)) === 0;
      if (quick === 'live') return e.category === 'Concerts' || e.category === 'Acoustic';
      return quick !== 'venues';
    });
  }, [events, quick, filters]);

  // The map artwork is square and drawn with "cover", so convert % positions to screen points.
  const side = Math.max(size.w, size.h);
  const offX = (side - size.w) / 2;
  const offY = (side - size.h) / 2;
  const pos = (p: { x: number; y: number }) => ({ left: (p.x / 100) * side - offX, top: (p.y / 100) * side - offY });
  // The card always shows an event that is visible on the map with the current filters.
  const sel = shown.find((e) => e.id === selected) ?? shown[0];

  return (
    <View style={{ flex: 1, backgroundColor: '#1D2A4D' }} onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <Photo src="map_berlin" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} accessibilityLabel="Map of Berlin" />
      {quick === 'venues'
        ? venues.map((v) => (
            <Pressable key={v.id} accessibilityRole="button" accessibilityLabel={`${v.name}, ${v.area}`} onPress={() => router.push(`/venue/${v.id}`)} style={{ position: 'absolute', ...pos(v.mapPos), marginLeft: -22, marginTop: -22 }}>
              <Photo src={v.cover} style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 3, borderColor: colors.gold }} />
            </Pressable>
          ))
        : shown.map((e) => {
            const on = e.id === sel?.id;
            const s = on ? 64 : 44;
            return (
              <Pressable key={e.id} accessibilityRole="button" accessibilityLabel={e.title} accessibilityState={{ selected: on }} onPress={() => setSelected(e.id)} style={{ position: 'absolute', ...pos(e.mapPos), marginLeft: -s / 2, marginTop: -s / 2, zIndex: on ? 2 : 1 }}>
                <Photo src={e.cover} style={{ width: s, height: s, borderRadius: s / 2, borderWidth: on ? 4 : 2, borderColor: on ? colors.brand : colors.white }} />
              </Pressable>
            );
          })}

      <SafeAreaView edges={['top']} style={{ position: 'absolute', left: 0, right: 0 }}>
        <View style={{ flexDirection: 'row', paddingHorizontal: 8 }}>
          <IconButton name="chevron-left" label="Back" color={colors.white} bg="rgba(0,0,0,0.35)" iconSize={30} onPress={() => goBack('/(tabs)')} />
          <View style={{ flex: 1 }} />
          <IconButton name="tune-variant" label={`Filters${filterCount ? `, ${filterCount} active` : ''}`} badge={filterCount || undefined} color={colors.white} bg="rgba(0,0,0,0.35)" onPress={() => router.push('/filters')} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingVertical: 8 }}>
          {([['all', 'All'], ['today', 'Today'], ['weekend', 'Weekend'], ['free', 'Free'], ['live', 'Live music'], ['venues', 'Venues']] as const).map(([k, l]) => (
            <Chip key={k} label={l} selected={quick === k} onPress={() => setQuick(k)} />
          ))}
        </ScrollView>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={{ position: 'absolute', left: 16, right: 16, bottom: 12 }}>
        {quick !== 'venues' && sel ? <EventRow event={sel} /> : null}
        {quick !== 'venues' && !shown.length ? (
          <View style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 16, gap: 10 }}>
            <T v="body">No events on the map for this filter.</T>
            <Button title={filterCount ? 'Clear filters' : 'Show all events'} size="md" variant="light" onPress={() => { if (filterCount) resetFilters(); setQuick('all'); }} />
          </View>
        ) : null}
        {quick === 'venues' ? (
          <View style={{ backgroundColor: colors.surface, padding: 14, borderRadius: 16 }}>
            <T v="small">{venues.length} venues · tap a pin to see rooms, prices and availability</T>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}
