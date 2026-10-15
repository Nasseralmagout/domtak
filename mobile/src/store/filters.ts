import { create } from 'zustand';

import { venueById } from '../data/mock';
import type { EventItem, Venue } from '../data/types';
import { parse, sameDay, TODAY } from '../lib/format';

export type DateFilter = 'any' | 'today' | 'tomorrow' | 'week' | 'month';
export type TimeFilter = 'any' | 'day' | 'night';
export type SortKey = 'soonest' | 'nearest' | 'popular';

/** The largest distance step means "any distance" (no radius filter). */
export const MAX_DISTANCE_KM = 25;
/** Radius choices for "near me" (km); the last one is "Any distance". */
export const DISTANCE_STEPS = [1, 2, 5, 10, MAX_DISTANCE_KM];
export const SORT_LABEL: Record<SortKey, string> = { soonest: 'Soonest', nearest: 'Nearest', popular: 'Most popular' };

/** "Within 5 km" or "Any distance". */
export const distanceLabel = (km?: number) => (km == null || km >= MAX_DISTANCE_KM ? 'Any distance' : `Within ${km} km`);

export interface Filters {
  location: 'current' | 'search';
  date: DateFilter;
  time: TimeFilter;
  maxPrice: number;
  categories: string[];
  styles: string[];
  freeOnly: boolean;
  /** Venue area picked under "Search for location" (e.g. 'Kreuzberg'). Only applies while location is 'search'. */
  area?: string;
  /** Radius around you in km while location is 'current'. MAX_DISTANCE_KM (or missing) = any distance. */
  maxDistanceKm?: number;
  /** List / map order. Missing = 'soonest'. */
  sort?: SortKey;
}

export const DEFAULT_FILTERS: Filters = { location: 'current', date: 'any', time: 'any', maxPrice: 250, categories: [], styles: [], freeOnly: false, area: undefined, maxDistanceKm: MAX_DISTANCE_KM, sort: 'soonest' };

/** The radius in effect: only with "Current location" and below the "any distance" step. */
export const activeRadius = (f: Filters) => (f.location === 'current' && f.maxDistanceKm != null && f.maxDistanceKm < MAX_DISTANCE_KM ? f.maxDistanceKm : undefined);

/** The area filter in effect: set and searching by location ("Current location" means near you, so it ignores any area). */
export const activeArea = (f: Filters) => (f.location === 'search' && f.area ? f.area : undefined);

/** Keeps area and location consistent: picking an area searches by location, going back to current location drops it. */
function normalize(next: Filters, patch: Partial<Filters>): Filters {
  if (patch.area && patch.location === undefined) return { ...next, location: 'search' };
  if (patch.location === 'current' && patch.area === undefined) return { ...next, area: undefined };
  return next;
}

interface FilterState {
  filters: Filters;
  set: (f: Partial<Filters>) => void;
  reset: () => void;
}

export const useFilters = create<FilterState>()((set) => ({
  filters: DEFAULT_FILTERS,
  set: (f) => set((s) => ({ filters: normalize({ ...s.filters, ...f }, f) })),
  reset: () => set({ filters: DEFAULT_FILTERS }),
}));

export function activeFilterCount(f: Filters) {
  let n = 0;
  if (f.date !== 'any') n++;
  if (f.time !== 'any') n++;
  if (f.maxPrice < 250) n++;
  if (f.freeOnly) n++;
  if (activeArea(f)) n++;
  if (activeRadius(f) != null) n++;
  n += f.categories.length + f.styles.length;
  return n;
}

/** Pass `venues` (e.g. useVenues()) so the area check sees the venue owner's saved listing. */
export function applyFilters(events: EventItem[], f: Filters, venues?: Venue[]) {
  const area = activeArea(f);
  const radius = activeRadius(f);
  const areaOf = (id: string) => (venues?.find((v) => v.id === id) ?? venueById(id))?.area;
  return events.filter((e) => {
    if (area && areaOf(e.venueId) !== area) return false;
    if (radius != null && e.distanceKm > radius) return false;
    const start = parse(e.start);
    const min = Math.min(...e.ticketTypes.map((t) => t.price));
    if (f.freeOnly && min > 0) return false;
    if (min > f.maxPrice) return false;
    if (f.categories.length && !f.categories.includes(e.category)) return false;
    if (f.styles.length && !f.styles.includes(e.genre)) return false;
    if (f.time === 'day' && start.getHours() >= 18) return false;
    if (f.time === 'night' && start.getHours() < 18) return false;
    const days = (start.getTime() - TODAY.getTime()) / 86_400_000;
    if (f.date === 'today' && !sameDay(start, TODAY)) return false;
    if (f.date === 'tomorrow' && !sameDay(start, new Date(TODAY.getTime() + 86_400_000))) return false;
    if (f.date === 'week' && (days < -1 || days > 7)) return false;
    if (f.date === 'month' && (days < -1 || days > 31)) return false;
    return true;
  });
}

/** Orders events for lists and the map (does not change the input). */
export function sortEvents(events: EventItem[], sort: SortKey = 'soonest') {
  const list = [...events];
  if (sort === 'nearest') return list.sort((a, b) => a.distanceKm - b.distanceKm || a.start.localeCompare(b.start));
  if (sort === 'popular') return list.sort((a, b) => b.going - a.going || a.start.localeCompare(b.start));
  return list.sort((a, b) => a.start.localeCompare(b.start));
}

/** Events anyone may discover: public and not draft or cancelled, plus your own events. */
export function isDiscoverable(e: EventItem) {
  if (e.organizerId === 'me') return true;
  return !e.isPrivate && e.state !== 'draft' && e.state !== 'cancelled';
}

/** Events still running or upcoming on the demo clock. */
export const isUpcoming = (e: EventItem, now: Date = TODAY) => parse(e.end).getTime() >= now.getTime();
