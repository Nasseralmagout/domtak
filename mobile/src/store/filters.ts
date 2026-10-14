import { create } from 'zustand';

import { venueById } from '../data/mock';
import type { EventItem } from '../data/types';
import { parse, sameDay, TODAY } from '../lib/format';

export type DateFilter = 'any' | 'today' | 'tomorrow' | 'week' | 'month';
export type TimeFilter = 'any' | 'day' | 'night';

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
}

export const DEFAULT_FILTERS: Filters = { location: 'current', date: 'any', time: 'any', maxPrice: 250, categories: [], styles: [], freeOnly: false, area: undefined };

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
  n += f.categories.length + f.styles.length;
  return n;
}

export function applyFilters(events: EventItem[], f: Filters) {
  const area = activeArea(f);
  return events.filter((e) => {
    if (area && venueById(e.venueId)?.area !== area) return false;
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
