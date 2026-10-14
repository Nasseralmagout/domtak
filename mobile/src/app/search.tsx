import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { create } from 'zustand';

import { goBack, Screen } from '../components/layout';
import { Avatar, Button, Chip, EmptyState, Field, Icon, IconButton, Photo, Pill, Row, T } from '../components/ui';
import type { ImgKey } from '../data/images';
import { profiles } from '../data/mock';
import { euro, priceRange, shortDate } from '../lib/format';
import { isPromoted } from '../lib/promotions';
import { useAllEvents, useApp, useVenues } from '../store/useApp';
import { colors, radius, shadow } from '../theme';

type Kind = 'all' | 'event' | 'musician' | 'venue' | 'organizer';
type Result = { key: string; kind: Exclude<Kind, 'all'>; title: string; sub: string; image: ImgKey; href: string; round?: boolean; sponsored?: boolean };

const KINDS: readonly (readonly [Kind, string])[] = [['all', 'All'], ['event', 'Events'], ['musician', 'Musicians'], ['venue', 'Venues'], ['organizer', 'Organizers']];
const SEED_RECENT = ['Techno Kreuzberg', 'Moon Club', 'Acoustic', 'Saxophonist wedding'];

// Recent searches live for the app session, so they survive leaving and reopening this screen.
const useRecent = create<{ items: string[]; setItems: (items: string[]) => void }>()((set) => ({
  items: SEED_RECENT,
  setItems: (items) => set({ items }),
}));

const asKind = (t?: string): Kind => (KINDS.some(([k]) => k === t) ? (t as Kind) : 'all');

export default function Search() {
  const params = useLocalSearchParams<{ type?: string; q?: string }>();
  const [q, setQ] = useState(params.q ?? '');
  const [kind, setKind] = useState<Kind>(asKind(params.type));
  const recent = useRecent((s) => s.items);
  const setRecent = useRecent((s) => s.setItems);
  const events = useAllEvents();
  // Venues with the owner's listing edits (Moon Club), so names, areas and photos match the venue page.
  const venues = useVenues();
  const promotions = useApp((s) => s.promotions);

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

  const results = useMemo<Result[]>(() => {
    // Every word has to match somewhere (name, genre, area, occasion…), so "Techno Kreuzberg" narrows down.
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const match = (s: string) => {
      const hay = s.toLowerCase();
      return words.every((w) => hay.includes(w) || (w.length > 4 && w.endsWith('s') && hay.includes(w.slice(0, -1))));
    };
    const venueOf = (id: string) => venues.find((v) => v.id === id);
    const eventResults: Result[] = [];
    events.forEach((e) => {
      if (e.isPrivate && e.organizerId !== 'me') return;
      const v = venueOf(e.venueId);
      if (match(`${e.title} ${e.subtitle ?? ''} ${e.genre} ${e.category} ${v?.name ?? ''} ${v?.area ?? ''}`)) {
        const sub = [shortDate(e.start), v?.name, priceRange(e.ticketTypes.map((x) => x.price))].filter(Boolean).join(' · ');
        eventResults.push({ key: e.id, kind: 'event', title: e.title, sub, image: e.cover, href: `/event/${e.id}`, sponsored: isPromoted(promotions, e) });
      }
    });
    // Boosted events (Pro → Promote) lead the results, marked as Sponsored.
    const out: Result[] = [...eventResults.filter((r) => r.sponsored), ...eventResults.filter((r) => !r.sponsored)];
    profiles.forEach((p) => {
      if (['dj', 'musician', 'band'].includes(p.kind) && match(`${p.name} ${p.title} ${p.kind === 'dj' ? 'dj' : ''} ${p.genres.join(' ')} ${p.city} ${p.bio} ${(p.instruments ?? []).join(' ')}`)) {
        out.push({ key: p.id, kind: 'musician', title: p.name, sub: `${p.title} · from ${euro(p.feePerHour ?? 0)}/h`, image: p.avatar, href: `/artist/${p.id}`, round: true });
      }
      if (p.kind === 'organizer' && p.title === 'Organizer' && match(`${p.name} ${p.bio} ${p.city} organizer`)) {
        out.push({ key: p.id, kind: 'organizer', title: p.name, sub: `${p.eventsCount ?? 0} events · ${p.city}`, image: p.avatar, href: `/profile/${p.id}`, round: true });
      }
    });
    venues.forEach((v) => {
      if (match(`${v.name} ${v.area} ${v.type} ${v.occasions.join(' ')} venue`)) {
        out.push({ key: v.id, kind: 'venue', title: v.name, sub: `${v.type} · ${v.area} · ${v.capacity} people · ${euro(v.pricePerNight)}/night`, image: v.cover, href: `/venue/${v.id}` });
      }
    });
    return kind === 'all' ? out : out.filter((r) => r.kind === kind);
  }, [q, kind, events, venues, promotions]);

  return (
    <Screen
      keyboard
      header={
        <Row gap={6} style={{ paddingHorizontal: 8, paddingVertical: 8 }}>
          <IconButton name="chevron-left" label="Back" iconSize={30} onPress={() => goBack('/(tabs)')} />
          <Field
            placeholder="Events, musicians, venues, organizers"
            value={q}
            onChangeText={setQ}
            onSubmitEditing={() => remember(q)}
            autoFocus={!params.q}
            accessibilityLabel="Search"
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
      <T v="small" accessibilityLiveRegion="polite">{results.length} result{results.length === 1 ? '' : 's'}{q ? ` for “${q.trim()}”` : ' near Kreuzberg'}</T>
      {results.map((r) => (
        <Pressable
          key={`${r.kind}-${r.key}`}
          accessibilityRole="button"
          accessibilityLabel={`${r.sponsored ? 'Sponsored ' : ''}${r.kind === 'musician' ? 'Artist' : r.kind}: ${r.title}, ${r.sub}`}
          onPress={() => {
            remember(q);
            router.push(r.href as never);
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow(1) }}
        >
          {r.round ? <Avatar src={r.image} size={64} /> : <Photo src={r.image} style={{ width: 64, height: 64 }} radius={14} />}
          <View style={{ flex: 1, gap: 2 }}>
            {r.sponsored ? (
              <Row gap={6}>
                <T v="caption">EVENT</T>
                <Pill label="Sponsored" icon="star-four-points" />
              </Row>
            ) : (
              <T v="caption">{r.kind === 'musician' ? 'ARTIST' : r.kind.toUpperCase()}</T>
            )}
            <T v="title" numberOfLines={1}>{r.title}</T>
            <T v="small" numberOfLines={1}>{r.sub}</T>
          </View>
          <Icon name="chevron-right" size={22} color={colors.subtle} />
        </Pressable>
      ))}
      {q && results.length === 0 ? (
        <EmptyState icon="magnify-close" title="No matches" body={`Nothing found for “${q.trim()}”${kind !== 'all' ? ' in this category' : ''}. Try fewer words or another spelling.`} action={kind !== 'all' ? 'Search everything' : 'Clear search'} onAction={() => (kind !== 'all' ? setKind('all') : setQ(''))} />
      ) : null}
      {!q ? <Button title="Browse all events" variant="ghost" size="md" onPress={() => router.push('/events/all')} /> : null}
    </Screen>
  );
}
