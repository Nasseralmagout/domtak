import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { type LayoutChangeEvent, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SponsoredPill, venuePriceLabel } from '../components/cards';
import { goBack } from '../components/layout';
import { Button, Chip, Icon, IconButton, Photo, Row, T, Toggle } from '../components/ui';
import { GENRES } from '../data/mock';
import type { EventItem, Venue } from '../data/types';
import { plural, priceRange, shortDate, time } from '../lib/format';
import { isPromoted } from '../lib/promotions';
import { applyQuick, discoverableEvents, MY_LOCATION, quickFilterCount, RADIUS_STEPS, radiusChoices, useMapQuick } from '../store/discovery';
import { activeArea, activeFilterCount, activeRadius, applyFilters, MAX_DISTANCE_KM, SORT_LABEL, type SortKey, sortEvents, useFilters } from '../store/filters';
import { useAllEvents, useApp, useVenues } from '../store/useApp';
import { colors, radius, shadow } from '../theme';

type Selection = { kind: 'event' | 'venue'; id: string };
const SORTS: SortKey[] = ['nearest', 'soonest', 'popular'];

/** One event in the map card and the list: date, venue, distance and price. */
function EventLine({ event, venueName, sponsored }: { event: EventItem; venueName?: string; sponsored?: boolean }) {
  const prices = priceRange(event.ticketTypes.map((t) => t.price));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${sponsored ? 'Sponsored, ' : ''}${event.title}, ${shortDate(event.start)} ${time(event.start)}, ${venueName ?? ''}, ${event.distanceKm} km away, ${prices}`}
      onPress={() => router.push(`/event/${event.id}`)}
      style={{ flexDirection: 'row', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 10, alignItems: 'center', borderWidth: sponsored ? 2 : 0, borderColor: colors.gold, ...shadow(1) }}
    >
      <Photo src={event.cover} style={{ width: 76, height: 76 }} radius={14} />
      <View style={{ flex: 1, gap: 3 }}>
        {sponsored ? <SponsoredPill /> : null}
        <T v="title" numberOfLines={1}>{event.title}</T>
        <T v="small" numberOfLines={1}>{shortDate(event.start)} · {time(event.start)}{venueName ? ` · ${venueName}` : ''}</T>
        <Row gap={12} style={{ flexWrap: 'wrap' }}>
          <Row gap={3}><Icon name="map-marker-distance" size={14} color={colors.brand} /><T v="smallBold" color={colors.brand}>{event.distanceKm} km</T></Row>
          <Row gap={3}><Icon name="music-note" size={14} color={colors.brand} /><T v="small" color={colors.brand}>{event.genre}</T></Row>
          <Row gap={3}><Icon name="ticket-confirmation-outline" size={14} color={colors.brand} /><T v="small" color={colors.brand}>{prices}</T></Row>
        </Row>
      </View>
      <Icon name="chevron-right" size={22} color={colors.subtle} />
    </Pressable>
  );
}

export default function MapScreen() {
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const events = useAllEvents();
  const venues = useVenues();
  const promotions = useApp((s) => s.promotions);
  const filters = useFilters((s) => s.filters);
  const setFilters = useFilters((s) => s.set);
  const resetFilters = useFilters((s) => s.reset);
  const weekend = useMapQuick((s) => s.weekend);
  const live = useMapQuick((s) => s.live);
  const venuePins = useMapQuick((s) => s.venuePins);
  const setQuick = useMapQuick((s) => s.setQuick);
  const setVenuePins = useMapQuick((s) => s.setVenuePins);
  const resetQuick = useMapQuick((s) => s.resetQuick);

  const [size, setSize] = useState({ w: 1, h: 1 });
  const [view, setView] = useState<'map' | 'list'>('map');
  // Without a focus the card shows the first event on the map, which is a sponsored one when there is one.
  const [selected, setSelected] = useState<Selection | undefined>(focus ? { kind: 'event', id: focus } : undefined);
  // "Show on map" from an event page keeps that event on the map even when the filters would hide it,
  // until you change a filter.
  const [keepFocus, setKeepFocus] = useState(!!focus);
  const [filtersAtFocus] = useState(filters);
  const pinFocus = keepFocus && filters === filtersAtFocus;

  const radiusKm = activeRadius(filters);
  const area = activeArea(filters);
  const quick = { weekend, live };
  const filterCount = activeFilterCount(filters) + quickFilterCount(quick);
  const sort = filters.sort ?? 'soonest';

  // Any filter change ends the "Show on map" focus.
  const changeFilters = (p: Parameters<typeof setFilters>[0]) => {
    setFilters(p);
    setKeepFocus(false);
  };
  const changeQuick = (p: Parameters<typeof setQuick>[0]) => {
    setQuick(p);
    setKeepFocus(false);
  };
  const clearAll = () => {
    resetFilters();
    resetQuick();
    setKeepFocus(false);
  };

  const pool = useMemo(() => discoverableEvents(events), [events]);
  // Genres that upcoming events actually have, in the usual genre order, plus any genre picked in Filters
  // (so every active genre filter has a visible chip to turn it off).
  const styles = filters.styles;
  const genres = useMemo(() => GENRES.filter((g) => pool.some((e) => e.genre === g) || styles.includes(g)), [pool, styles]);
  const venueName = useMemo(() => new Map(venues.map((v) => [v.id, v.name])), [venues]);

  const { shown, promoted } = useMemo(() => {
    const filtered = applyQuick(applyFilters(pool, filters, venues), { weekend, live });
    const focused = pinFocus ? pool.find((e) => e.id === focus) : undefined;
    const list = focused && !filtered.some((e) => e.id === focused.id) ? [focused, ...filtered] : filtered;
    // Boosted events (Pro → Promote) come first and get highlighted pins.
    const boosted = new Set(list.filter((e) => isPromoted(promotions, e)).map((e) => e.id));
    const ordered = sortEvents(list, sort);
    return { shown: [...ordered.filter((e) => boosted.has(e.id)), ...ordered.filter((e) => !boosted.has(e.id))], promoted: boosted };
  }, [pool, venues, promotions, filters, weekend, live, focus, pinFocus, sort]);

  // Relax the filters without inventing results: the next radius that would show events, with its count.
  const wider = useMemo(() => {
    if (shown.length || radiusKm == null) return undefined;
    const others = applyQuick(applyFilters(pool, { ...filters, maxDistanceKm: MAX_DISTANCE_KM }, venues), { weekend, live });
    const step = RADIUS_STEPS.find((km) => km > radiusKm && others.some((e) => e.distanceKm <= km));
    const count = others.filter((e) => step == null || e.distanceKm <= step).length;
    return count ? { km: step, count } : undefined;
  }, [shown.length, radiusKm, pool, filters, venues, weekend, live]);

  const matchesAt = useMemo(() => {
    const m = new Map<string, EventItem[]>();
    shown.forEach((e) => m.set(e.venueId, [...(m.get(e.venueId) ?? []), e]));
    return m;
  }, [shown]);

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

  // The card always shows something visible with the current filters.
  const selVenue: Venue | undefined = selected?.kind === 'venue' && venuePins ? venues.find((v) => v.id === selected.id) : undefined;
  const selEvent: EventItem | undefined = selVenue ? undefined : (shown.find((e) => selected?.kind === 'event' && e.id === selected.id) ?? shown[0]);

  const countLine = `${plural(shown.length, 'event')}${radiusKm != null ? ` within ${radiusKm} km` : area ? ` in ${area}` : ' at any distance'}`;
  const locationLine = area ? `Searching ${area}` : `Around you · ${MY_LOCATION.label}`;

  const emptyCard = (
    <View style={{ backgroundColor: colors.surface, padding: 16, borderRadius: radius.lg, gap: 10, ...shadow(2) }}>
      <T v="title">No events match nearby</T>
      <T v="small">
        {filters.date === 'today' ? 'Nothing is on today with these filters.' : 'Nothing upcoming matches all of these filters.'}
        {radiusKm != null ? ' Widen the distance or remove a filter.' : ' Remove a filter to see more.'}
      </T>
      {wider ? (
        <Button
          title={wider.km != null ? `Widen to ${wider.km} km · ${plural(wider.count, 'event')}` : `Any distance · ${plural(wider.count, 'event')}`}
          size="md"
          onPress={() => changeFilters({ location: 'current', maxDistanceKm: wider.km ?? MAX_DISTANCE_KM })}
        />
      ) : null}
      {filterCount ? <Button title="Clear all filters" size="md" variant={wider ? 'ghost' : 'light'} onPress={clearAll} /> : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Filters stay visible above the map and the list. */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface, zIndex: 5, ...shadow(1) }}>
        <Row gap={4} style={{ paddingHorizontal: 4, minHeight: 56 }}>
          <IconButton name="chevron-left" label="Back" iconSize={30} onPress={() => goBack('/(tabs)/events')} />
          <View style={{ flex: 1 }}>
            <T v="h3" accessibilityRole="header" numberOfLines={1}>Nearby events</T>
            <Row gap={4}>
              <Icon name={area ? 'map-search-outline' : 'crosshairs-gps'} size={13} color={colors.brand} />
              <T v="small" numberOfLines={1} style={{ flexShrink: 1 }}>{locationLine}</T>
            </Row>
          </View>
          <IconButton
            name={view === 'map' ? 'format-list-bulleted' : 'map-outline'}
            label={view === 'map' ? 'Show results as a list' : 'Show results on the map'}
            bg={colors.brandSoft}
            color={colors.brand}
            size={44}
            onPress={() => setView(view === 'map' ? 'list' : 'map')}
          />
          <IconButton
            name="tune-variant"
            label={`All filters${filterCount ? `, ${filterCount} active` : ''}`}
            badge={filterCount || undefined}
            bg={colors.brand}
            color={colors.white}
            size={44}
            onPress={() => router.push({ pathname: '/filters', params: { from: 'map' } })}
          />
        </Row>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingTop: 4, paddingBottom: 6 }}>
          <Chip label="Today" icon="calendar-today" selected={filters.date === 'today'} onPress={() => { changeFilters({ date: filters.date === 'today' ? 'any' : 'today' }); if (weekend) changeQuick({ weekend: false }); }} />
          <Chip label="This weekend" icon="calendar-weekend-outline" selected={weekend} onPress={() => { changeQuick({ weekend: !weekend }); if (!weekend && (filters.date === 'today' || filters.date === 'tomorrow')) changeFilters({ date: 'any' }); }} />
          <Chip label="Free" icon="ticket-outline" selected={filters.freeOnly} onPress={() => changeFilters({ freeOnly: !filters.freeOnly })} />
          <Chip label="Live music" icon="microphone-variant" selected={live} onPress={() => changeQuick({ live: !live })} />
          <View style={{ width: 1, marginVertical: 6, backgroundColor: colors.border }} />
          {genres.map((g) => (
            <Chip
              key={g}
              label={g}
              selected={filters.styles.includes(g)}
              accessibilityLabel={`Genre ${g}${filters.styles.includes(g) ? ', on' : ''}`}
              onPress={() => changeFilters({ styles: filters.styles.includes(g) ? filters.styles.filter((s) => s !== g) : [...filters.styles, g] })}
            />
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingBottom: 6, alignItems: 'center' }}>
          <Row gap={4} style={{ paddingRight: 2 }}>
            <Icon name="map-marker-radius-outline" size={16} color={colors.muted} />
            <T v="label">Distance</T>
          </Row>
          {radiusChoices(radiusKm).map((km) => (
            <Chip key={km} label={`${km} km`} accessibilityLabel={`Within ${km} kilometres of you`} selected={radiusKm === km} onPress={() => changeFilters({ location: 'current', maxDistanceKm: km })} />
          ))}
          <Chip label="Any" accessibilityLabel="Any distance" selected={radiusKm == null && !area} onPress={() => changeFilters({ location: 'current', maxDistanceKm: MAX_DISTANCE_KM })} />
        </ScrollView>

        <Row justify="space-between" gap={8} style={{ paddingHorizontal: 16, paddingBottom: 8, minHeight: 40 }}>
          <Row gap={8} style={{ flexShrink: 1 }}>
            <T v="smallBold" accessibilityLiveRegion="polite" numberOfLines={1} style={{ flexShrink: 1 }}>{countLine}</T>
            {filterCount ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Clear all ${filterCount} filters`} onPress={clearAll} hitSlop={12} style={{ minHeight: 32, justifyContent: 'center' }}>
                <T v="smallBold" color={colors.brand}>Clear all</T>
              </Pressable>
            ) : null}
          </Row>
          {view === 'map' ? (
            <Row gap={6}>
              <Icon name="storefront-outline" size={16} color={colors.muted} />
              <T v="small">Venues</T>
              <Toggle label="Show venue pins" value={venuePins} onValueChange={setVenuePins} />
            </Row>
          ) : null}
        </Row>
      </SafeAreaView>

      {view === 'list' ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            <T v="label">Sort</T>
            {SORTS.map((k) => <Chip key={k} label={SORT_LABEL[k]} selected={sort === k} onPress={() => setFilters({ sort: k })} />)}
          </Row>
          {shown.map((e) => <EventLine key={e.id} event={e} venueName={venueName.get(e.venueId)} sponsored={promoted.has(e.id)} />)}
          {!shown.length ? emptyCard : null}
          {shown.length ? <T v="small" center>Distances are from your location in {MY_LOCATION.area}. Tickets and prices are on each event.</T> : null}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, overflow: 'hidden', backgroundColor: '#1D2A4D' }} onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          <Photo src="map_berlin" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} accessibilityLabel="Map of Berlin" />

          {/* You are here */}
          <View accessible accessibilityLabel={`Your location, ${MY_LOCATION.label}`} style={{ position: 'absolute', ...pos(MY_LOCATION.mapPos, 40), marginLeft: -20, marginTop: -20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(59,130,246,0.25)', alignItems: 'center', justifyContent: 'center', zIndex: 1, pointerEvents: 'none' }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#3B82F6', borderWidth: 3, borderColor: colors.white }} />
          </View>

          {venuePins
            ? venues.map((v) => {
                const on = selVenue?.id === v.id;
                const hits = matchesAt.get(v.id)?.length ?? 0;
                return (
                  <Pressable
                    key={v.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Venue ${v.name}, ${v.area}, ${hits ? plural(hits, 'matching event') : 'no matching events'}`}
                    accessibilityState={{ selected: on }}
                    onPress={() => setSelected({ kind: 'venue', id: v.id })}
                    style={{ position: 'absolute', ...pos(v.mapPos, 36), marginLeft: -18, marginTop: -18, width: 36, height: 36, borderRadius: 10, backgroundColor: on ? colors.gold : colors.brandDeep, borderWidth: 2, borderColor: on ? colors.brandDeep : colors.gold, alignItems: 'center', justifyContent: 'center', opacity: hits || on ? 1 : 0.7, zIndex: on ? 4 : 1 }}
                  >
                    <Icon name="storefront" size={18} color={on ? colors.brandDeep : colors.gold} />
                  </Pressable>
                );
              })
            : null}

          {shown.map((e) => {
            const on = e.id === selEvent?.id;
            const boosted = promoted.has(e.id);
            // Sponsored pins are a little larger with a gold ring and sit above regular pins.
            const s = on ? 60 : boosted ? 50 : 44;
            return (
              <Pressable
                key={e.id}
                accessibilityRole="button"
                accessibilityLabel={`${boosted ? 'Sponsored, ' : ''}${e.title}, ${shortDate(e.start)}, ${e.distanceKm} km away`}
                accessibilityState={{ selected: on }}
                onPress={() => setSelected({ kind: 'event', id: e.id })}
                style={{ position: 'absolute', ...pos(e.mapPos, s), marginLeft: -s / 2, marginTop: -s / 2, zIndex: on ? 5 : boosted ? 3 : 2 }}
              >
                <Photo src={e.cover} style={{ width: s, height: s, borderRadius: s / 2, borderWidth: on ? 4 : boosted ? 3 : 2, borderColor: on ? colors.brand : boosted ? colors.gold : colors.white }} />
              </Pressable>
            );
          })}

          <SafeAreaView edges={['bottom']} style={{ position: 'absolute', left: 12, right: 12, bottom: 10, zIndex: 6 }}>
            {selVenue ? (
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, gap: 10, ...shadow(2) }}>
                <Row gap={12}>
                  <Photo src={selVenue.cover} style={{ width: 64, height: 64 }} radius={12} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T v="caption">VENUE</T>
                    <T v="title" numberOfLines={1}>{selVenue.name}</T>
                    <T v="small" numberOfLines={1}>{selVenue.type} · {selVenue.area} · {venuePriceLabel(selVenue)}</T>
                  </View>
                  <IconButton name="close" label="Close venue card" size={40} iconSize={20} color={colors.muted} onPress={() => setSelected(undefined)} />
                </Row>
                {(matchesAt.get(selVenue.id) ?? []).length ? (
                  <View style={{ gap: 6 }}>
                    <T v="smallBold">{plural(matchesAt.get(selVenue.id)?.length ?? 0, 'event')} here match your filters</T>
                    {(matchesAt.get(selVenue.id) ?? []).slice(0, 2).map((e) => (
                      <Pressable key={e.id} accessibilityRole="button" accessibilityLabel={`${e.title}, ${shortDate(e.start)}`} onPress={() => router.push(`/event/${e.id}`)} style={{ minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Icon name="calendar-star" size={16} color={colors.brand} />
                        <T v="small" color={colors.ink} numberOfLines={1} style={{ flex: 1 }}>{shortDate(e.start)} · {e.title}</T>
                        <Icon name="chevron-right" size={18} color={colors.subtle} />
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <T v="small">No upcoming events here match your filters.</T>
                )}
                <Button title="Open venue" size="md" variant="light" onPress={() => router.push(`/venue/${selVenue.id}`)} />
              </View>
            ) : selEvent ? (
              <EventLine event={selEvent} venueName={venueName.get(selEvent.venueId)} sponsored={promoted.has(selEvent.id)} />
            ) : (
              emptyCard
            )}
            {selEvent && shown.length > 1 ? (
              <T v="small" center color={colors.white} style={{ marginTop: 6, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 }}>Tap a pin to see another event · {plural(shown.length, 'result')}</T>
            ) : null}
          </SafeAreaView>
        </View>
      )}
    </View>
  );
}
