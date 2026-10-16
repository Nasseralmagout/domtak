import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { type LayoutChangeEvent, Pressable, View } from 'react-native';

import { BottomBar, goBack, Screen, ScreenHeader } from '../components/layout';
import { Button, Chip, Field, Row, T, Toggle } from '../components/ui';
import { GENRES } from '../data/mock';
import { euro, plural } from '../lib/format';
import { applyQuick, discoverableEvents, type MapQuickFilters, MY_LOCATION, quickFilterCount, RADIUS_STEPS, useMapQuick } from '../store/discovery';
import { activeArea, activeFilterCount, activeRadius, applyFilters, DEFAULT_FILTERS, type Filters, MAX_DISTANCE_KM, SORT_LABEL, type SortKey, useFilters } from '../store/filters';
import { toast } from '../store/toast';
import { useAllEvents, useVenues } from '../store/useApp';
import { colors } from '../theme';


function PriceSlider({ value, onChange, max = 250 }: { value: number; onChange: (n: number) => void; max?: number }) {
  const [w, setW] = useState(1);
  const pct = value / max;
  const setFrom = (x: number) => onChange(Math.max(0, Math.min(max, Math.round(((x / w) * max) / 5) * 5)));
  return (
    <View style={{ gap: 6 }}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Maximum price"
        accessibilityValue={{ min: 0, max, now: value, text: euro(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onChange(Math.max(0, Math.min(max, value + (e.nativeEvent.actionName === 'increment' ? 10 : -10))))}
        onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => setFrom(e.nativeEvent.locationX)}
        onResponderMove={(e) => setFrom(e.nativeEvent.locationX)}
        style={{ height: 44, justifyContent: 'center' }}
      >
        <View style={{ height: 6, borderRadius: 3, backgroundColor: '#8A8496' }}>
          <View style={{ height: 6, borderRadius: 3, width: `${pct * 100}%`, backgroundColor: colors.brandDeep }} />
        </View>
        <View pointerEvents="none" style={{ position: 'absolute', left: Math.max(0, Math.min(w - 28, pct * w - 14)), width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brandDeep, borderWidth: 3, borderColor: colors.white }} />
      </View>
      <Row justify="space-between">
        <T v="small" color={colors.ink}>€0</T>
        <T v="smallBold" color={colors.brand}>{value >= max ? 'Any price' : `up to ${euro(value)}`}</T>
        <T v="small" color={colors.ink}>{euro(max)}+</T>
      </Row>
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <T v="title" accessibilityRole="header">{title}</T>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>{children}</Row>
    </View>
  );
}

const SORTS: SortKey[] = ['soonest', 'nearest', 'popular'];

export default function FiltersScreen() {
  // `from=map`: opened from the map, so the map quick filters (This weekend, Live music) are edited here too.
  const { next, from } = useLocalSearchParams<{ next?: string; from?: string }>();
  const fromMap = from === 'map';
  const current = useFilters((s) => s.filters);
  const apply = useFilters((s) => s.set);
  const weekend = useMapQuick((s) => s.weekend);
  const live = useMapQuick((s) => s.live);
  const setQuick = useMapQuick((s) => s.setQuick);
  const [quick, setQuickDraft] = useState<MapQuickFilters>({ weekend, live });
  const allEvents = useAllEvents();
  // Same pool as the lists and the map: public published events (or yours) that have not ended.
  const events = useMemo(() => discoverableEvents(allEvents), [allEvents]);
  // Includes the owner's saved listing, so a moved venue is found under its new area.
  const allVenues = useVenues();
  const areas = useMemo(() => Array.from(new Set(allVenues.map((v) => v.area))), [allVenues]);
  const [f, setF] = useState<Filters>(current);
  const [areaQuery, setAreaQuery] = useState(current.area ?? '');
  const up = (p: Partial<Filters>) => setF((x) => ({ ...x, ...p }));
  const toggleIn = (key: 'categories' | 'styles', v: string) => {
    const list = f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v];
    up(key === 'categories' ? { categories: list } : { styles: list });
  };

  // applyFilters and activeFilterCount only use the area while "Search for location" is on, and the radius while on "Current location".
  const filtered = applyFilters(events, f, allVenues);
  const matches = (fromMap ? applyQuick(filtered, quick) : filtered).length;
  const areaSuggestions = areas.filter((a) => !areaQuery.trim() || a.toLowerCase().includes(areaQuery.trim().toLowerCase()));
  const changed = activeFilterCount(f) + (fromMap ? quickFilterCount(quick) : 0);
  const radiusKm = activeRadius(f);
  const fallback = fromMap ? '/map' : '/events/all';

  const reset = () => {
    setF(DEFAULT_FILTERS);
    setAreaQuery('');
    setQuickDraft({ weekend: false, live: false });
  };

  const showResults = () => {
    // Keep "area" only when a location search is active, so "Current location" really means near you.
    apply({ ...f, area: activeArea(f) });
    if (fromMap) setQuick(quick);
    toast(changed ? `${plural(changed, 'filter')} applied` : 'Showing all events');
    if (next && next.startsWith('/')) router.replace(next as never);
    else goBack(fallback);
  };

  return (
    <Screen
      keyboard
      header={
        <ScreenHeader
          title="Filters"
          subtitle={fromMap ? 'Nearby events on the map' : undefined}
          onBack={() => goBack(fallback)}
          right={
            <Pressable accessibilityRole="button" accessibilityLabel="Reset all filters" onPress={reset} hitSlop={8} style={{ paddingHorizontal: 16, minHeight: 44, justifyContent: 'center' }}>
              <T v="bodyBold" color={colors.brand}>Reset</T>
            </Pressable>
          }
        />
      }
      contentStyle={{ gap: 26, paddingHorizontal: 20 }}
      footer={
        <BottomBar>
          <Button title={matches ? `Show ${plural(matches, 'event')}${fromMap ? ' on the map' : ''}` : 'No events match'} disabled={!matches} onPress={showResults} />
          {!matches ? <T v="small" center style={{ marginTop: 6 }}>Widen the distance or remove a filter to see events.</T> : null}
        </BottomBar>
      }
    >
      <View style={{ gap: 12 }}>
        <Group title="Location">
          <Chip label="Current location" icon="crosshairs-gps" selected={f.location === 'current'} onPress={() => up({ location: 'current' })} />
          <Chip label="Search for location" icon="magnify" selected={f.location === 'search'} onPress={() => up({ location: 'search' })} />
        </Group>
        {f.location === 'current' ? (
          <View style={{ gap: 10 }}>
            <T v="small">Distances are measured from your location in {MY_LOCATION.label}.</T>
            <T v="label" accessibilityRole="header">Distance from you</T>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {RADIUS_STEPS.map((km) => (
                <Chip key={km} label={`${km} km`} accessibilityLabel={`Within ${km} kilometres`} selected={radiusKm === km} onPress={() => up({ maxDistanceKm: km })} />
              ))}
              <Chip label="Any distance" selected={radiusKm == null} onPress={() => up({ maxDistanceKm: MAX_DISTANCE_KM })} />
            </Row>
          </View>
        ) : null}
        {f.location === 'search' ? (
          <View style={{ gap: 10 }}>
            <Field placeholder="Search a Berlin area" value={areaQuery} onChangeText={setAreaQuery} icon="map-marker-outline" accessibilityLabel="Area" autoCapitalize="words" />
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              <Chip label="All of Berlin" selected={!f.area} onPress={() => { up({ area: undefined }); setAreaQuery(''); }} />
              {areaSuggestions.map((a) => (
                <Chip key={a} label={a} icon="map-marker" selected={f.area === a} onPress={() => { up({ area: a }); setAreaQuery(a); }} />
              ))}
            </Row>
            {!areaSuggestions.length ? <T v="small">No Domtak venues in “{areaQuery}” yet. Try Kreuzberg, Mitte or Friedrichshain.</T> : null}
          </View>
        ) : null}
      </View>
      {fromMap ? (
        <Group title="On the map">
          <Chip label="This weekend" icon="calendar-weekend-outline" selected={quick.weekend} onPress={() => setQuickDraft((q) => ({ ...q, weekend: !q.weekend }))} />
          <Chip label="Live music" icon="microphone-variant" selected={quick.live} onPress={() => setQuickDraft((q) => ({ ...q, live: !q.live }))} />
        </Group>
      ) : null}
      <Group title="Date">
        {([['today', 'Today'], ['tomorrow', 'Tomorrow'], ['week', 'This week'], ['month', 'This month'], ['any', 'Any date']] as const).map(([k, l]) => (
          <Chip key={k} label={l} selected={f.date === k} onPress={() => up({ date: k })} />
        ))}
      </Group>
      <Group title="Time of the day">
        {([['day', 'Day'], ['night', 'Night (from 18:00)'], ['any', 'Any time']] as const).map(([k, l]) => (
          <Chip key={k} label={l} selected={f.time === k} onPress={() => up({ time: k })} />
        ))}
      </Group>
      <View style={{ gap: 12 }}>
        <Row justify="space-between">
          <T v="title" accessibilityRole="header">Price range</T>
          <Row gap={8}><T v="small">Free only</T><Toggle label="Free events only" value={f.freeOnly} onValueChange={(v) => up({ freeOnly: v })} /></Row>
        </Row>
        {!f.freeOnly ? <PriceSlider value={f.maxPrice} onChange={(n) => up({ maxPrice: n })} /> : <T v="small">Only events with free entry are shown.</T>}
      </View>
      <Group title="Categories">
        {['Concerts', 'Parties', 'Electronic', 'Listening', 'Festivals', 'Acoustic', 'Family'].map((c) => (
          <Chip key={c} label={c} selected={f.categories.includes(c)} onPress={() => toggleIn('categories', c)} />
        ))}
      </Group>
      <Group title="Music style">
        {GENRES.map((g) => <Chip key={g} label={g} selected={f.styles.includes(g)} onPress={() => toggleIn('styles', g)} />)}
      </Group>
      <Group title="Sort by">
        {SORTS.map((k) => <Chip key={k} label={SORT_LABEL[k]} selected={(f.sort ?? 'soonest') === k} onPress={() => up({ sort: k })} />)}
      </Group>
    </Screen>
  );
}
