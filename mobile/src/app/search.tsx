import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { goBack, Screen } from '../components/layout';
import { Avatar, Chip, Field, Icon, IconButton, Photo, Row, T } from '../components/ui';
import type { ImgKey } from '../data/images';
import { profiles, venues } from '../data/mock';
import { euro, priceRange, shortDate } from '../lib/format';
import { useAllEvents } from '../store/useApp';
import { colors, radius, shadow } from '../theme';

type Kind = 'all' | 'event' | 'musician' | 'venue' | 'organizer';
type Result = { key: string; kind: Exclude<Kind, 'all'>; title: string; sub: string; image: ImgKey; href: string; round?: boolean };

const RECENT = ['Techno Kreuzberg', 'Moon Club', 'Acoustic', 'Saxophonist wedding'];

export default function Search() {
  const params = useLocalSearchParams<{ type?: string }>();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<Kind>((params.type as Kind) ?? 'all');
  const events = useAllEvents();

  const results = useMemo<Result[]>(() => {
    const t = q.trim().toLowerCase();
    const match = (s: string) => !t || s.toLowerCase().includes(t);
    const out: Result[] = [];
    events.forEach((e) => {
      if (match(`${e.title} ${e.genre} ${e.category}`)) out.push({ key: e.id, kind: 'event', title: e.title, sub: `${shortDate(e.start)} · ${priceRange(e.ticketTypes.map((x) => x.price))}`, image: e.cover, href: `/event/${e.id}` });
    });
    profiles.forEach((p) => {
      if (['dj', 'musician', 'band'].includes(p.kind) && match(`${p.name} ${p.title} ${p.genres.join(' ')}`)) out.push({ key: p.id, kind: 'musician', title: p.name, sub: `${p.title} · from ${euro(p.feePerHour ?? 0)}/h`, image: p.avatar, href: `/artist/${p.id}`, round: true });
      if (p.kind === 'organizer' && p.title === 'Organizer' && match(`${p.name} ${p.bio}`)) out.push({ key: p.id, kind: 'organizer', title: p.name, sub: `${p.eventsCount ?? 0} events · ${p.city}`, image: p.avatar, href: `/profile/${p.id}`, round: true });
    });
    venues.forEach((v) => {
      if (match(`${v.name} ${v.area} ${v.type} ${v.occasions.join(' ')}`)) out.push({ key: v.id, kind: 'venue', title: v.name, sub: `${v.type} · ${v.capacity} people · ${euro(v.pricePerNight)}/night`, image: v.cover, href: `/venue/${v.id}` });
    });
    return kind === 'all' ? out : out.filter((r) => r.kind === kind);
  }, [q, kind, events]);

  return (
    <Screen
      keyboard
      header={
        <Row gap={6} style={{ paddingHorizontal: 8, paddingVertical: 8 }}>
          <IconButton name="chevron-left" label="Back" iconSize={30} onPress={() => goBack('/(tabs)')} />
          <Field placeholder="Events, musicians, venues, organizers" value={q} onChangeText={setQ} autoFocus icon="magnify" style={{ flex: 1 }} returnKeyType="search" />
        </Row>
      }
      contentStyle={{ paddingTop: 4 }}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {([['all', 'All'], ['event', 'Events'], ['musician', 'Musicians'], ['venue', 'Venues'], ['organizer', 'Organizers']] as const).map(([k, l]) => (
          <Chip key={k} label={l} selected={kind === k} onPress={() => setKind(k)} />
        ))}
      </ScrollView>
      {!q ? (
        <View style={{ gap: 8 }}>
          <T v="smallBold" color={colors.muted}>Recent searches</T>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {RECENT.map((r) => <Chip key={r} label={r} icon="clock-outline" onPress={() => setQ(r.split(' ')[0])} />)}
          </Row>
        </View>
      ) : null}
      <T v="small">{results.length} results{q ? ` for “${q}”` : ' near Kreuzberg'}</T>
      {results.map((r) => (
        <Pressable key={`${r.kind}-${r.key}`} accessibilityRole="button" onPress={() => router.push(r.href as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow(1) }}>
          {r.round ? <Avatar src={r.image} size={64} /> : <Photo src={r.image} style={{ width: 64, height: 64 }} radius={14} />}
          <View style={{ flex: 1, gap: 2 }}>
            <T v="caption">{r.kind === 'musician' ? 'ARTIST' : r.kind.toUpperCase()}</T>
            <T v="title" numberOfLines={1}>{r.title}</T>
            <T v="small" numberOfLines={1}>{r.sub}</T>
          </View>
          <Icon name="chevron-right" size={22} color={colors.subtle} />
        </Pressable>
      ))}
    </Screen>
  );
}
