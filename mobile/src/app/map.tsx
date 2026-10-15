import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { type LayoutChangeEvent, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventRow } from '../components/cards';
import { goBack } from '../components/layout';
import { Button, Chip, IconButton, Photo, Pill, T } from '../components/ui';
import { parse, sameDay, TODAY } from '../lib/format';
import { isPromoted } from '../lib/promotions';
import { activeFilterCount, applyFilters, useFilters } from '../store/filters';
import { useAllEvents, useApp, useVenues } from '../store/useApp';
import { colors, radius } from '../theme';

type Quick = 'all' | 'today' | 'weekend' | 'free' | 'live' | 'venues';

export default function MapScreen() {
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const events = useAllEvents();
  const venues = useVenues();
  const promotions = useApp((s) => s.promotions);
  const filters = useFilters((s) => s.filters);
  const resetFilters = useFilters((s) => s.reset);
  const filterCount = activeFilterCount(filters);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [quick, setQuick] = useState<Quick>('all');
  // Without a focus the card shows the first event on the map, which is a sponsored one when there is one.
  const [selected, setSelected] = useState<string | undefined>(focus);
  // "Show on map" from an event page keeps that event on the map even when the filters would hide it,
  // until you pick a quick filter or change the filters yourself.
  const [keepFocus, setKeepFocus] = useState(!!focus);
  const [filtersAtFocus] = useState(filters);
  const pinFocus = keepFocus && filters === filtersAtFocus;
  const pickQuick = (k: Quick) => {
    setQuick(k);
    setKeepFocus(false);
  };

  const { shown, promoted } = useMemo(() => {
    const filtered = applyFilters(events, filters, venues).filter((e) => {
      if (e.isPrivate && e.organizerId !== 'me') return false;
      const d = parse(e.start);
      const days = (d.getTime() - TODAY.getTime()) / 86_400_000;
      if (quick === 'today') return sameDay(d, TODAY);
      if (quick === 'weekend') return (d.getDay() === 5 || d.getDay() === 6 || d.getDay() === 0) && days > -1 && days < 7;
      if (quick === 'free') return Math.min(...e.ticketTypes.map((t) => t.price)) === 0;
      if (quick === 'live') return e.category === 'Concerts' || e.category === 'Acoustic';
      return quick !== 'venues';
    });
    const focused = pinFocus && quick !== 'venues' ? events.find((e) => e.id === focus && (!e.isPrivate || e.organizerId === 'me')) : undefined;
    const list = focused && !filtered.some((e) => e.id === focused.id) ? [focused, ...filtered] : filtered;
    // Boosted events (Pro → Promote) come first and get highlighted pins.
    const boosted = new Set(list.filter((e) => isPromoted(promotions, e)).map((e) => e.id));
    return { shown: [...list.filter((e) => boosted.has(e.id)), ...list.filter((e) => !boosted.has(e.id))], promoted: boosted };
  }, [events, venues, promotions, quick, filters, focus, pinFocus]);

  // The map artwork is square and drawn with "cover", so convert % positions to screen points.
  const side = Math.max(size.w, size.h);
  const offX = (side - size.w) / 2;
  const offY = (side - size.h) / 2;
  // Pins near the edge are nudged inside so the whole pin (ring included) stays visible.
  const clamp = (v: number, half: number, max: number) => (max > 0 ? Math.min(Math.max(v, half + 8), max - half - 8) : v);
  const pos = (p: { x: number; y: number }, pin: number) => ({
    left: clamp((p.x / 100) * side - offX, pin / 2, size.w),
    top: clamp((p.y / 100) * side - offY, pin / 2, size.h),
  });
  // The card always shows an event that is visible on the map with the current filters.
  const sel = shown.find((e) => e.id === selected) ?? shown[0];

  return (
    <View style={{ flex: 1, backgroundColor: '#1D2A4D' }} onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <Photo src="map_berlin" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} accessibilityLabel="Map of Berlin" />
      {quick === 'venues'
        ? venues.map((v) => (
            <Pressable key={v.id} accessibilityRole="button" accessibilityLabel={`${v.name}, ${v.area}`} onPress={() => router.push(`/venue/${v.id}`)} style={{ position: 'absolute', ...pos(v.mapPos, 44), marginLeft: -22, marginTop: -22 }}>
              <Photo src={v.cover} style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 3, borderColor: colors.gold }} />
            </Pressable>
          ))
        : shown.map((e) => {
            const on = e.id === sel?.id;
            const boosted = promoted.has(e.id);
            // Sponsored pins are a little larger with a gold ring and sit above regular pins.
            const s = on ? 64 : boosted ? 52 : 44;
            return (
              <Pressable key={e.id} accessibilityRole="button" accessibilityLabel={boosted ? `${e.title}, sponsored` : e.title} accessibilityState={{ selected: on }} onPress={() => setSelected(e.id)} style={{ position: 'absolute', ...pos(e.mapPos, s), marginLeft: -s / 2, marginTop: -s / 2, zIndex: on ? 3 : boosted ? 2 : 1 }}>
                <Photo src={e.cover} style={{ width: s, height: s, borderRadius: s / 2, borderWidth: on ? 4 : boosted ? 3 : 2, borderColor: on ? colors.brand : boosted ? colors.gold : colors.white }} />
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
            <Chip key={k} label={l} selected={quick === k} onPress={() => pickQuick(k)} />
          ))}
        </ScrollView>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={{ position: 'absolute', left: 16, right: 16, bottom: 12 }}>
        {quick !== 'venues' && sel ? (
          <View style={{ gap: 6 }}>
            {promoted.has(sel.id) ? <Pill label="Sponsored" icon="star-four-points-outline" /> : null}
            <View style={promoted.has(sel.id) ? { borderRadius: radius.lg + 2, borderWidth: 2, borderColor: colors.gold } : undefined}>
              <EventRow event={sel} />
            </View>
          </View>
        ) : null}
        {quick !== 'venues' && !shown.length ? (
          <View style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 16, gap: 10 }}>
            <T v="body">No events on the map for this filter.</T>
            <Button title={filterCount ? 'Clear filters' : 'Show all events'} size="md" variant="light" onPress={() => { if (filterCount) resetFilters(); pickQuick('all'); }} />
          </View>
        ) : null}
        {quick === 'venues' ? (
          <View style={{ backgroundColor: colors.surface, padding: 14, borderRadius: 16 }}>
            <T v="small">{venues.length} venues · tap a pin to see rooms, prices and reviews</T>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}
