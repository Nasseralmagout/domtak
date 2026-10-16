import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo, useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { profileById, profiles } from '../data/mock';
import type { Lesson, PricingMode, Profile } from '../data/types';
import { nowIso } from '../lib/format';
import { useApp, type VenueListing } from './useApp';

/**
 * Artist services and pricing (blueprint F05/F07) plus unpublished drafts for the provider editors.
 * The demo musician workspace manages Adam's public profile (the incoming requests are his),
 * the same way the venue workspace manages Moon Club (OWN_VENUE_ID).
 */
export const OWN_ARTIST_ID = 'adam';

/** Kinds of performance an artist can offer. */
export const PERFORMANCE_TYPES = ['Club night', 'Private party', 'Wedding', 'Corporate event', 'Festival', 'Bar or restaurant', 'Warm-up set', 'Live stream'];
export const LESSON_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'All levels'];
export const LESSON_FORMAT_LABEL: Record<Lesson['format'], string> = { 'in-person': 'In person', online: 'Online', 'at-studio': 'At my studio' };
export const LESSON_FORMAT_ICON = { 'in-person': 'account-music-outline', online: 'laptop', 'at-studio': 'home-variant-outline' } as const;

export interface ArtistServices {
  /** 'quote' = bookers request an itemised quote instead of seeing the hourly price. */
  pricing: PricingMode;
  /** Performance types offered (PERFORMANCE_TYPES or custom). */
  performances: string[];
  /** What a performance includes, shown under the price. */
  performanceNote: string;
  /** Travel charge in euro: undefined = not stated yet, 0 = no charge. Always separate from the fee. */
  travel?: number;
  travelNote?: string;
  /** Equipment charge in euro: undefined = not stated yet, 0 = no charge. */
  equipment?: number;
  equipmentNote?: string;
  lessons: Lesson[];
  /** Performances and lessons have separate service terms (F05). */
  performanceTerms: string;
  lessonTerms: string;
  /** Show usual days and blocked dates on the public profile. Availability never confirms a booking. */
  showCalendar: boolean;
  /** When these services were last published. */
  publishedAt?: string;
}

/** The editor works on the services plus the hourly fee (published to availability.feePerHour). */
export type ServicesDraft = ArtistServices & { feePerHour: number };

const seedProfile = profileById(OWN_ARTIST_ID);

export const initialServices: ArtistServices = {
  pricing: seedProfile?.pricing ?? 'listed',
  performances: ['Club night', 'Private party', 'Wedding', 'Corporate event'],
  performanceNote: 'Sets from 2 hours, house into techno. I bring headphones and USBs; CDJs come from the venue or as the equipment charge.',
  travel: seedProfile?.charges?.travel,
  travelNote: seedProfile?.charges?.travelNote,
  equipment: seedProfile?.charges?.equipment,
  equipmentNote: seedProfile?.charges?.equipmentNote,
  lessons: seedProfile?.lessons ?? [],
  performanceTerms: 'Set length, breaks and rider are agreed in each request. Accepted bookings keep the terms agreed at the time.',
  lessonTerms: 'Lessons are booked per session and agreed separately from performances. The studio has CDJs and a mixer; bring your own headphones.',
  showCalendar: true,
};

interface ServicesState {
  /** Published services: what bookers see on /artist/OWN_ARTIST_ID. */
  services: ArtistServices;
  /** Saved but unpublished work from Pro → Services and pricing. */
  servicesDraft?: ServicesDraft;
  /** Saved but unpublished work from Pro → Venue listing (the live listing is useApp venueListing). */
  venueDraft?: VenueListing;

  /** Publishes the services (the caller also saves feePerHour to availability). Clears the draft. */
  publishServices: (s: ArtistServices) => void;
  saveServicesDraft: (d: ServicesDraft) => void;
  discardServicesDraft: () => void;
  /** Quick switch from the availability screen (applies to the live profile right away). */
  setShowCalendar: (on: boolean) => void;
  saveVenueDraft: (v: VenueListing) => void;
  discardVenueDraft: () => void;
}

export const useServices = create<ServicesState>()(
  persist(
    (set) => ({
      services: initialServices,
      servicesDraft: undefined,
      venueDraft: undefined,
      publishServices: (s) => set({ services: { ...s, publishedAt: nowIso() }, servicesDraft: undefined }),
      saveServicesDraft: (d) => set({ servicesDraft: d }),
      discardServicesDraft: () => set({ servicesDraft: undefined }),
      setShowCalendar: (on) =>
        set((st) => ({
          services: { ...st.services, showCalendar: on },
          servicesDraft: st.servicesDraft ? { ...st.servicesDraft, showCalendar: on } : undefined,
        })),
      saveVenueDraft: (v) => set({ venueDraft: v }),
      discardVenueDraft: () => set({ venueDraft: undefined }),
    }),
    {
      name: 'domtak-services',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      // Saved data from an older shape gets today's defaults for any missing field.
      merge: (persisted, current) => {
        const p = (persisted && typeof persisted === 'object' ? persisted : {}) as Partial<ServicesState>;
        return {
          ...current,
          ...p,
          services: { ...current.services, ...p.services },
          servicesDraft: p.servicesDraft ? { ...initialServices, ...p.servicesDraft, feePerHour: p.servicesDraft.feePerHour ?? 0 } : undefined,
        };
      },
    },
  ),
);

const subscribeHydration = (cb: () => void) => useServices.persist.onFinishHydration(cb);
const getHydrated = () => useServices.persist.hasHydrated();

/** True once saved services and drafts are loaded. Editors that start from a saved draft wait for this. */
export function useServicesHydrated() {
  return useSyncExternalStore(subscribeHydration, getHydrated, getHydrated);
}

// ---------- Reading services ----------

/** The profile with the published services applied when it is the demo musician's own profile. */
export function overlayArtist(p: Profile, s: ArtistServices, feePerHour: number): Profile {
  if (p.id !== OWN_ARTIST_ID) return p;
  return {
    ...p,
    feePerHour,
    pricing: s.pricing,
    charges: { travel: s.travel, travelNote: s.travelNote, equipment: s.equipment, equipmentNote: s.equipmentNote },
    lessons: s.lessons,
  };
}

/** An artist profile by id, including the musician's published services for their own profile. */
export function useArtist(id?: string): Profile | undefined {
  const services = useServices((s) => s.services);
  const fee = useApp((s) => s.availability.feePerHour);
  return useMemo(() => {
    const p = id ? profileById(id) : undefined;
    return p ? overlayArtist(p, services, fee) : undefined;
  }, [id, services, fee]);
}

/** Same as useArtist for a profile you already hold (cards, lists). */
export function useArtistOverlay(p: Profile): Profile {
  const services = useServices((s) => s.services);
  const fee = useApp((s) => s.availability.feePerHour);
  return useMemo(() => overlayArtist(p, services, fee), [p, services, fee]);
}

/** Published services detail (performance types, terms, calendar) when the artist manages them in the app. */
export function useArtistServices(id?: string): ArtistServices | undefined {
  const services = useServices((s) => s.services);
  return id === OWN_ARTIST_ID ? services : undefined;
}

/** A lesson by id with its teacher (plain function; useLesson is the hook). */
export function findLesson(lessonId: string | undefined, services: ArtistServices, feePerHour: number): { artist: Profile; lesson: Lesson } | undefined {
  if (!lessonId) return undefined;
  const artist = profiles.map((p) => overlayArtist(p, services, feePerHour)).find((p) => p.lessons?.some((l) => l.id === lessonId));
  const lesson = artist?.lessons?.find((l) => l.id === lessonId);
  return artist && lesson ? { artist, lesson } : undefined;
}

/** A lesson by id with its teacher, including lessons the musician added in Services and pricing. */
export function useLesson(lessonId?: string): { artist: Profile; lesson: Lesson } | undefined {
  const services = useServices((s) => s.services);
  const fee = useApp((s) => s.availability.feePerHour);
  return useMemo(() => findLesson(lessonId, services, fee), [lessonId, services, fee]);
}

// ---------- Completion checklist (F05) ----------

export interface ReadinessItem {
  key: string;
  label: string;
  done: boolean;
  hint?: string;
}

/** What still blocks publishing the services. Optional items (calendar) are not listed. */
export function servicesChecklist(d: ServicesDraft): ReadinessItem[] {
  const items: ReadinessItem[] = [
    { key: 'types', label: 'Choose what you perform at', done: d.performances.length > 0, hint: 'Pick at least one performance type.' },
    {
      key: 'price',
      label: d.pricing === 'quote' ? 'Quote requests switched on' : 'Set your hourly price',
      done: d.pricing === 'quote' || d.feePerHour >= 20,
      hint: 'Enter a price of at least €20 per hour, or switch to quote on request.',
    },
    { key: 'scope', label: 'Describe what a performance includes', done: d.performanceNote.trim().length >= 10, hint: 'A short sentence on set length, gear and style.' },
    { key: 'travel', label: 'State your travel charge', done: d.travel != null, hint: 'Choose No charge, or Charge separately and enter the amount.' },
    { key: 'equipment', label: 'State your equipment charge', done: d.equipment != null, hint: 'Choose No charge, or Charge separately and enter the amount.' },
    { key: 'terms', label: 'Write your performance terms', done: d.performanceTerms.trim().length >= 10, hint: 'What bookers agree to, separate from lesson terms.' },
  ];
  if (d.lessons.length) {
    items.push(
      { key: 'lesson-price', label: 'Price every lesson or mark it quote-based', done: d.lessons.every((l) => l.quote || (l.price ?? 0) > 0), hint: 'Open a lesson to add its price.' },
      { key: 'lesson-terms', label: 'Write your lesson terms', done: d.lessonTerms.trim().length >= 10, hint: 'Lessons need their own terms, separate from performances.' },
    );
  }
  return items;
}
