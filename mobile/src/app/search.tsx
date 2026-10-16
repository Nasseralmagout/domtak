import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { create } from 'zustand';

import { artistPriceLabel, lessonPriceLabel, venuePriceLabel } from '../components/cards';
import { goBack, Screen } from '../components/layout';
import { Avatar, Button, Chip, EmptyState, Field, Icon, IconButton, Photo, Pill, Row, T } from '../components/ui';
import type { ImgKey } from '../data/images';
import { communities, profiles } from '../data/mock';
import type { Community, EventItem, Profile, Venue } from '../data/types';
import { compact, plural, priceRange, shortDate } from '../lib/format';
import { isPromoted } from '../lib/promotions';
import { artistScore } from '../lib/ratings';
import { discoverableEvents, type LessonListing, lessonPlace, useLessonListings } from '../store/discovery';
import { sortEvents } from '../store/filters';
import { overlayArtist, useServices } from '../store/services';
import { memberCount } from '../store/social';
import { type Promotion, useAllEvents, useApp, useVenues } from '../store/useApp';
import { colors, radius, shadow } from '../theme';

type Kind = 'all' | 'event' | 'musician' | 'lesson' | 'venue' | 'community' | 'organizer';
type Result = { key: string; kind: Exclude<Kind, 'all'>; title: string; sub: string; image: ImgKey; href: string; round?: boolean; sponsored?: boolean; joined?: boolean };

const KINDS: readonly (readonly [Kind, string])[] = [
  ['all', 'All'],
  ['event', 'Events'],
  ['musician', 'Artists'],
  ['lesson', 'Lessons'],
  ['venue', 'Venues'],
  ['community', 'Communities'],
  ['organizer', 'Organizers'],
];
const CAPTION: Record<Exclude<Kind, 'all'>, string> = { event: 'EVENT', musician: 'ARTIST', lesson: 'LESSON', venue: 'VENUE', community: 'COMMUNITY', organizer: 'ORGANIZER' };
const SEED_RECENT = ['Techno Kreuzberg', 'Moon Club', 'Guitar lessons', 'Acoustic', 'Saxophonist wedding'];
const MUSIC_KINDS: Profile['kind'][] = ['dj', 'musician', 'band'];

// Recent searches live for the app session, so they survive leaving and reopening this screen.
const useRecent = create<{ items: string[]; setItems: (items: string[]) => void }>()((set) => ({
  items: SEED_RECENT,
  setItems: (items) => set({ items }),
}));

const asKind = (t?: string): Kind => (KINDS.some(([k]) => k === t) ? (t as Kind) : 'all');

interface Sources {
  events: EventItem[];
  venues: Venue[];
  artists: Profile[];
  organizers: Profile[];
  lessons: LessonListing[];
  joined: string[];
  promotions: Promotion[];
}

/** Every result for these words (each word has to match somewhere, so "Techno Kreuzberg" narrows down). */
function searchAll(words: string[], src: Sources): Result[] {
  const match = (s: string) => {
    const hay = s.toLowerCase();
    return words.every((w) => hay.includes(w) || (w.length > 4 && w.endsWith('s') && hay.includes(w.slice(0, -1))));
  };
  const venueOf = (id: string) => src.venues.find((v) => v.id === id);
  const eventResults: Result[] = [];
  src.events.forEach((e) => {
    const v = venueOf(e.venueId);
    if (match(`${e.title} ${e.subtitle ?? ''} ${e.genre} ${e.category} ${v?.name ?? ''} ${v?.area ?? ''} event`)) {
      const sub = [shortDate(e.start), v?.name, priceRange(e.ticketTypes.map((x) => x.price))].filter(Boolean).join(' · ');
      eventResults.push({ key: e.id, kind: 'event', title: e.title, sub, image: e.cover, href: `/event/${e.id}`, sponsored: isPromoted(src.promotions, e) });
    }
  });
  // Boosted events (Pro → Promote) lead the results, marked as Sponsored.
  const out: Result[] = [...eventResults.filter((r) => r.sponsored), ...eventResults.filter((r) => !r.sponsored)];
  src.artists.forEach((p) => {
    if (!match(`${p.name} ${p.title} ${p.kind === 'dj' ? 'dj' : ''} ${p.kind === 'band' ? 'band' : ''} ${p.genres.join(' ')} ${p.city} ${p.bio} ${(p.instruments ?? []).join(' ')} artist musician`)) return;
    // Musicians show the "would book again" score from verified bookings, never stars.
    const score = artistScore(p.id);
    const sub = [p.title, score.recommendPct != null ? `${score.recommendPct}% would book again` : undefined, artistPriceLabel(p)].filter(Boolean).join(' · ');
    out.push({ key: p.id, kind: 'musician', title: p.name, sub, image: p.avatar, href: `/artist/${p.id}`, round: true });
  });
  src.lessons.forEach(({ lesson, artist }) => {
    if (!match(`${lesson.title} ${lesson.instrument} ${lesson.level} ${lesson.description ?? ''} ${lesson.location ?? ''} ${artist.name} ${artist.city} lesson lessons teacher learn`)) return;
    out.push({ key: lesson.id, kind: 'lesson', title: lesson.title, sub: `${artist.name} · ${lessonPlace(lesson)} · ${lessonPriceLabel(lesson)}`, image: artist.avatar, href: `/lesson/${lesson.id}`, round: true });
  });
  src.venues.forEach((v) => {
    if (match(`${v.name} ${v.area} ${v.type} ${v.occasions.join(' ')} venue`)) {
      out.push({ key: v.id, kind: 'venue', title: v.name, sub: `${v.type} · ${v.area} · up to ${v.capacity} guests · ${venuePriceLabel(v)}`, image: v.cover, href: `/venue/${v.id}` });
    }
  });
  communities.forEach((c: Community) => {
    if (!match(`${c.name} ${c.description} ${c.genres.join(' ')} community communities`)) return;
    const joined = src.joined.includes(c.id);
    out.push({ key: c.id, kind: 'community', title: c.name, sub: `${compact(memberCount(c, joined))} members · ${c.genres.join(', ')}`, image: c.cover, href: `/community/${c.id}`, joined });
  });
  src.organizers.forEach((p) => {
    if (match(`${p.name} ${p.bio} ${p.city} organizer`)) {
      out.push({ key: p.id, kind: 'organizer', title: p.name, sub: `${p.eventsCount ?? 0} events · ${p.city}`, image: p.avatar, href: `/profile/${p.id}`, round: true });
    }
  });
  return out;
}

export default function Search() {
  const params = useLocalSearchParams<{ type?: string; q?: string }>();
  const [q, setQ] = useState(params.q ?? '');
  const [kind, setKind] = useState<Kind>(asKind(params.type));
  const recent = useRecent((s) => s.items);
  const setRecent = useRecent((s) => s.setItems);
  const allEvents = useAllEvents();
  // Venues with the owner's listing edits (Moon Club), so names, areas and photos match the venue page.
  const venues = useVenues();
  const promotions = useApp((s) => s.promotions);
  const blocked = useApp((s) => s.blocked);
  const joined = useApp((s) => s.joinedCommunities);
  const services = useServices((s) => s.services);
  const fee = useApp((s) => s.availability.feePerHour);
  const lessons = useLessonListings();

  const remember = (term: string) => {
    const t = term.trim();
    if (t.length < 2) return;
    setRecent([t, ...recent.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, 8));
  };
  const run = (term: string) => {
    setQ(term);
    remember(term);
  };
  const clearRecent = () => setRecent([]);

  const sources = useMemo<Sources>(
    () => ({
      // Only events anyone may discover (public and published, or yours) that have not ended.
      events: discoverableEvents(allEvents),
      venues,
      // The demo musician's published services (price, quote mode) apply to their own result. Blocked accounts are left out.
      artists: profiles.filter((p) => MUSIC_KINDS.includes(p.kind) && !blocked.includes(p.id)).map((p) => overlayArtist(p, services, fee)),
      organizers: profiles.filter((p) => p.kind === 'organizer' && p.title === 'Organizer' && !blocked.includes(p.id)),
      lessons,
      joined,
      promotions,
    }),
    [allEvents, venues, blocked, services, fee, lessons, joined, promotions],
  );

  const words = useMemo(() => q.trim().toLowerCase().split(/\s+/).filter(Boolean), [q]);
  const everything = useMemo(() => searchAll(words, sources), [words, sources]);
  const results = useMemo(() => (kind === 'all' ? everything : everything.filter((r) => r.kind === kind)), [everything, kind]);

  // No results: relax the search (fewer words, all categories) or show nearby events, without promising availability.
  const relax = useMemo(() => {
    if (!words.length || results.length) return { singles: [], nearby: [] as EventItem[] };
    const singles = words.length > 1
      ? words.map((w) => ({ word: w, count: searchAll([w], sources).filter((r) => kind === 'all' || r.kind === kind).length })).filter((s) => s.count > 0)
      : [];
    const nearby = sortEvents(sources.events, 'nearest').slice(0, 3);
    return { singles, nearby };
  }, [words, results.length, sources, kind]);

  const venueName = (id: string) => venues.find((v) => v.id === id)?.name;

  return (
    <Screen
      keyboard
      header={
        <Row gap={6} style={{ paddingHorizontal: 8, paddingVertical: 8 }}>
          <IconButton name="chevron-left" label="Back" iconSize={30} onPress={() => goBack('/(tabs)')} />
          <Field
            placeholder="Events, artists, lessons, venues"
            value={q}
            onChangeText={setQ}
            onSubmitEditing={() => remember(q)}
            autoFocus={!params.q}
            accessibilityLabel="Search events, artists, lessons, venues, communities and organizers"
            returnKeyType="search"
            right={q ? <IconButton name="close-circle" label="Clear search" size={40} iconSize={20} color={colors.subtle} onPress={() => setQ('')} /> : undefined}
            icon={q ? undefined : 'magnify'}
            style={{ flex: 1 }}
          />
        </Row>
      }
      contentStyle={{ paddingTop: 4 }}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {KINDS.map(([k, l]) => (
          <Chip key={k} label={l} selected={kind === k} onPress={() => setKind(k)} />
        ))}
      </ScrollView>
      {!q && recent.length ? (
        <View style={{ gap: 8 }}>
          <Row justify="space-between">
            <T v="smallBold" color={colors.muted}>Recent searches</T>
            <Pressable accessibilityRole="button" accessibilityLabel="Clear recent searches" onPress={clearRecent} hitSlop={12}>
              <T v="smallBold" color={colors.brand}>Clear</T>
            </Pressable>
          </Row>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {recent.map((r) => <Chip key={r} label={r} icon="clock-outline" accessibilityLabel={`Search again for ${r}`} onPress={() => run(r)} />)}
          </Row>
        </View>
      ) : null}
      {!q && (kind === 'all' || kind === 'lesson') ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Browse music lessons with filters" onPress={() => router.push('/lessons' as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, backgroundColor: colors.brandSoft }}>
          <Icon name="school-outline" size={24} color={colors.brand} />
          <View style={{ flex: 1 }}>
            <T v="bodyBold" color={colors.brand}>Music lessons</T>
            <T v="small">Filter by instrument, format and price</T>
          </View>
          <Icon name="chevron-right" size={22} color={colors.brand} />
        </Pressable>
      ) : null}
      <T v="small" accessibilityLiveRegion="polite">{plural(results.length, 'result')}{q ? ` for “${q.trim()}”` : ' in Berlin'}</T>
      {results.map((r) => (
        <Pressable
          key={`${r.kind}-${r.key}`}
          accessibilityRole="button"
          accessibilityLabel={`${r.sponsored ? 'Sponsored ' : ''}${CAPTION[r.kind].toLowerCase()}: ${r.title}, ${r.sub}${r.joined ? ', joined' : ''}`}
          onPress={() => {
            remember(q);
            router.push(r.href as never);
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow(1) }}
        >
          {r.round ? <Avatar src={r.image} size={64} /> : <Photo src={r.image} style={{ width: 64, height: 64 }} radius={14} />}
          <View style={{ flex: 1, gap: 2 }}>
            <Row gap={6}>
              <T v="caption">{CAPTION[r.kind]}</T>
              {r.sponsored ? <Pill label="Sponsored" icon="star-four-points-outline" /> : null}
              {r.joined ? <Pill label="Joined" tone="success" icon="check" /> : null}
            </Row>
            <T v="title" numberOfLines={1}>{r.title}</T>
            <T v="small" numberOfLines={1}>{r.sub}</T>
          </View>
          <Icon name="chevron-right" size={22} color={colors.subtle} />
        </Pressable>
      ))}
      {q && results.length === 0 ? (
        <View style={{ gap: 14 }}>
          <EmptyState
            icon="magnify-close"
            title="No matches"
            body={`Nothing found for “${q.trim()}”${kind !== 'all' ? ' in this category' : ''}. Try fewer words or another spelling.`}
            action={kind !== 'all' ? 'Search everything' : 'Clear search'}
            onAction={() => (kind !== 'all' ? setKind('all') : setQ(''))}
          />
          {kind === 'lesson' && lessons.length ? (
            <Button title={`Browse all ${plural(lessons.length, 'lesson')}`} variant="light" size="md" icon="school-outline" onPress={() => router.push('/lessons' as never)} />
          ) : null}
          {relax.singles.length ? (
            <View style={{ gap: 8 }}>
              <T v="smallBold" color={colors.muted}>Try one word</T>
              <Row gap={8} style={{ flexWrap: 'wrap' }}>
                {relax.singles.map((s) => <Chip key={s.word} label={`${s.word} (${s.count})`} icon="magnify" accessibilityLabel={`Search for ${s.word}, ${plural(s.count, 'result')}`} onPress={() => run(s.word)} />)}
              </Row>
            </View>
          ) : null}
          {relax.nearby.length ? (
            <View style={{ gap: 8 }}>
              <Row justify="space-between">
                <T v="h3" accessibilityRole="header">Events near you</T>
                <Pressable accessibilityRole="button" accessibilityLabel="Open the map of nearby events" onPress={() => router.push('/map')} hitSlop={12} style={{ minHeight: 32, justifyContent: 'center' }}>
                  <T v="smallBold" color={colors.brand}>Open map</T>
                </Pressable>
              </Row>
              <T v="small">Sorted by distance, not by your search. Tickets and prices are on each event.</T>
              {relax.nearby.map((e) => (
                <Pressable key={e.id} accessibilityRole="button" accessibilityLabel={`${e.title}, ${shortDate(e.start)}, ${e.distanceKm} km away`} onPress={() => router.push(`/event/${e.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow(1) }}>
                  <Photo src={e.cover} style={{ width: 52, height: 52 }} radius={12} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T v="title" numberOfLines={1}>{e.title}</T>
                    <T v="small" numberOfLines={1}>{[shortDate(e.start), venueName(e.venueId), `${e.distanceKm} km`].filter(Boolean).join(' · ')}</T>
                  </View>
                  <Icon name="chevron-right" size={22} color={colors.subtle} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      {!q ? <Button title="Browse all events" variant="ghost" size="md" onPress={() => router.push('/events/all')} /> : null}
    </Screen>
  );
}
