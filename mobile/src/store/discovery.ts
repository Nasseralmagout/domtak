import { useMemo } from 'react';
import { create } from 'zustand';

import { profileById, profiles } from '../data/mock';
import type { EventItem, Lesson, Profile } from '../data/types';
import { parse, TODAY } from '../lib/format';
import { isDiscoverable, isUpcoming } from './filters';
import { overlayArtist, useServices } from './services';
import { useApp } from './useApp';

/**
 * Discovery helpers (blueprint F08, F23 and user note 5): nearby events on the map,
 * map quick filters, and lessons from musicians' lesson services.
 */

// ---------- Nearby events ----------

/** Radius chips on the map and in the filter sheet (km from you). "Any distance" is MAX_DISTANCE_KM. */
export const RADIUS_STEPS = [1, 3, 5, 10] as const;

/** Where the demo user is. Event distances (EventItem.distanceKm) are measured from here. */
export const MY_LOCATION = { area: 'Kreuzberg', label: 'Kreuzberg, Berlin', mapPos: { x: 55, y: 69 } };

/** Events anyone may discover that have not ended yet (public and published, or your own). */
export const discoverableEvents = (events: EventItem[], now: Date = TODAY) => events.filter((e) => isDiscoverable(e) && isUpcoming(e, now));

/** The coming weekend (Friday 00:00 to Monday 00:00), or the current one from Friday to Sunday. */
export function weekendRange(now: Date = TODAY) {
  const d = now.getDay();
  const toFriday = d === 0 ? -2 : d === 6 ? -1 : 5 - d;
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() + toFriday);
  const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 3);
  return { from, to };
}

/** True when the event runs at some point this weekend. */
export function isThisWeekend(e: EventItem, now: Date = TODAY) {
  const { from, to } = weekendRange(now);
  return parse(e.start).getTime() < to.getTime() && parse(e.end).getTime() > from.getTime();
}

const LIVE_CATEGORIES: string[] = ['Concerts', 'Acoustic'];

/** Live music: a concert or acoustic event, or a lineup with a musician or band (not only DJs). */
export function isLiveMusic(e: EventItem) {
  if (LIVE_CATEGORIES.includes(e.category)) return true;
  return e.lineup.some((id) => {
    const kind = profileById(id)?.kind;
    return kind === 'musician' || kind === 'band';
  });
}

export interface MapQuickFilters {
  /** Only events running this weekend. */
  weekend: boolean;
  /** Only events with live music. */
  live: boolean;
}

interface MapQuickState extends MapQuickFilters {
  /** Venue pins on the map (a display layer, not a filter). */
  venuePins: boolean;
  setQuick: (q: Partial<MapQuickFilters>) => void;
  setVenuePins: (on: boolean) => void;
  resetQuick: () => void;
}

/**
 * Map quick filters that the shared Filters do not cover (This weekend, Live music).
 * Today, Free, genre and distance live in useFilters, so the filter sheet and lists see the same values.
 */
export const useMapQuick = create<MapQuickState>()((set) => ({
  weekend: false,
  live: false,
  venuePins: true,
  setQuick: (q) => set(q),
  setVenuePins: (on) => set({ venuePins: on }),
  resetQuick: () => set({ weekend: false, live: false }),
}));

export const quickFilterCount = (q: MapQuickFilters) => Number(q.weekend) + Number(q.live);

/** Applies the map quick filters (does not change the input). */
export function applyQuick(events: EventItem[], q: MapQuickFilters, now: Date = TODAY) {
  if (!q.weekend && !q.live) return events;
  return events.filter((e) => (!q.weekend || isThisWeekend(e, now)) && (!q.live || isLiveMusic(e)));
}

// ---------- Lessons (F23) ----------

const TEACHER_KINDS: Profile['kind'][] = ['musician', 'dj', 'band'];

/** Learner-facing wording for a lesson format (the teacher-facing label says "At my studio"). */
export const LEARNER_FORMAT_LABEL: Record<Lesson['format'], string> = { 'in-person': 'In person', online: 'Online', 'at-studio': 'At the teacher’s studio' };

export interface LessonListing {
  lesson: Lesson;
  artist: Profile;
}

/** Where a lesson happens, in learner wording. */
export function lessonPlace(lesson: Lesson) {
  if (lesson.format === 'online') return 'Online';
  return lesson.location || LEARNER_FORMAT_LABEL[lesson.format];
}

/**
 * Every lesson service with its teacher, including lessons the demo musician published in
 * Services and pricing. Blocked teachers are left out.
 */
export function useLessonListings(): LessonListing[] {
  const services = useServices((s) => s.services);
  const fee = useApp((s) => s.availability.feePerHour);
  const blocked = useApp((s) => s.blocked);
  return useMemo(
    () =>
      profiles
        .filter((p) => TEACHER_KINDS.includes(p.kind) && !blocked.includes(p.id))
        .map((p) => overlayArtist(p, services, fee))
        .flatMap((artist) => (artist.lessons ?? []).map((lesson) => ({ lesson, artist }))),
    [services, fee, blocked],
  );
}
