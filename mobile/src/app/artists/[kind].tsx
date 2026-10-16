import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArtistCard } from '../../components/cards';
import { DomtakHeader, goBack, ScreenHeader } from '../../components/layout';
import { Chip, EmptyState, Field, Icon, IconButton, Row, T } from '../../components/ui';
import { profiles } from '../../data/mock';
import type { Profile } from '../../data/types';
import { plural } from '../../lib/format';
import { artistScore } from '../../lib/ratings';
import { overlayArtist, useServices } from '../../store/services';
import { useApp } from '../../store/useApp';
import { colors } from '../../theme';

type Kind = 'all' | 'dj' | 'musician' | 'band';
type Sort = 'popular' | 'price' | 'score';

const TITLES: Record<Kind, string> = { musician: 'All musicians', band: 'All bands', dj: 'All DJs', all: 'All artists' };
const KIND_CHIPS: { key: Kind; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'dj', label: 'DJs' },
  { key: 'musician', label: 'Musicians' },
  { key: 'band', label: 'Bands' },
];
const STYLES: Record<Kind, string[]> = {
  dj: ['Techno', 'House', 'Trance', 'Pop', 'Electronic'],
  musician: ['Acoustic', 'Soul', 'Jazz', 'Pop', 'Rock', 'Indie'],
  band: ['Indie', 'Rock', 'Jazz'],
  all: ['Techno', 'House', 'Acoustic', 'Soul', 'Jazz', 'Rock', 'Indie', 'Pop'],
};
const MUSIC_KINDS: Profile['kind'][] = ['dj', 'musician', 'band'];
const SORT_NEXT: Record<Sort, Sort> = { popular: 'price', price: 'score', score: 'popular' };
const SORT_TEXT: Record<Sort, string> = { popular: 'Most popular', price: 'Lowest fee', score: 'Would book again' };
const SORT_ICON = { popular: 'sort-descending', price: 'cash-multiple', score: 'thumb-up-outline' } as const;

const isKind = (k?: string): k is Kind => KIND_CHIPS.some((c) => c.key === k);
/** Quote-priced artists have no listed fee, so they sort after every listed fee (never as €0). */
const feeKey = (p: Profile) => (p.pricing === 'quote' || !p.feePerHour ? Number.POSITIVE_INFINITY : p.feePerHour);

export default function ArtistList() {
  const params = useLocalSearchParams<{ kind: string }>();
  const kind: Kind = isKind(params.kind) ? params.kind : 'all';
  const [q, setQ] = useState('');
  const [style, setStyle] = useState<string>();
  const [sort, setSort] = useState<Sort>('popular');
  const insets = useSafeAreaInsets();
  const blocked = useApp((s) => s.blocked);
  const fee = useApp((s) => s.availability.feePerHour);
  const services = useServices((s) => s.services);

  // The demo musician's published services (fee, quote mode) apply to their own profile. Blocked accounts are left out.
  const pool = useMemo(
    () => profiles.filter((p) => MUSIC_KINDS.includes(p.kind) && !blocked.includes(p.id)).map((p) => overlayArtist(p, services, fee)),
    [blocked, services, fee],
  );

  const list = useMemo(() => {
    let l = pool.filter((p) => kind === 'all' || p.kind === kind);
    if (style) l = l.filter((p) => p.genres.includes(style));
    const t = q.trim().toLowerCase();
    if (t) l = l.filter((p) => `${p.name} ${p.title} ${p.genres.join(' ')} ${p.city} ${(p.instruments ?? []).join(' ')}`.toLowerCase().includes(t));
    // Musicians are compared by "would book again" from verified bookings, never by stars.
    const score = (p: Profile) => artistScore(p.id).recommendPct ?? -1;
    return [...l].sort((a, b) =>
      sort === 'popular' ? b.followers - a.followers : sort === 'price' ? feeKey(a) - feeKey(b) || b.followers - a.followers : score(b) - score(a) || b.followers - a.followers,
    );
  }, [pool, kind, style, q, sort]);
  // Pad odd lists so the last card keeps its column width.
  const data: (Profile | null)[] = list.length % 2 ? [...list, null] : list;
  const narrowed = !!style || !!q.trim();
  const clear = () => {
    setStyle(undefined);
    setQ('');
  };

  // Lessons are a category of their own (/lessons), not a kind of profile.
  if (params.kind === 'lessons') return <Redirect href={'/lessons' as never} />;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.brandDeep }}>
      <DomtakHeader showMenu={false} />
      <FlatList
        style={{ flex: 1, backgroundColor: colors.bg }}
        data={data}
        numColumns={2}
        keyExtractor={(p, i) => p?.id ?? `spacer-${i}`}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 12 }}
        contentContainerStyle={{ gap: 12, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <ScreenHeader
              title={TITLES[kind]}
              onBack={() => goBack('/(tabs)/artists')}
              right={<IconButton name={SORT_ICON[sort]} label={`Sorted by ${SORT_TEXT[sort].toLowerCase()}. Sort by ${SORT_TEXT[SORT_NEXT[sort]].toLowerCase()}`} onPress={() => setSort(SORT_NEXT[sort])} />}
            />
            <View style={{ paddingHorizontal: 16 }}>
              <Field placeholder="Search by name, style or area" accessibilityLabel="Search artists" value={q} onChangeText={setQ} icon="magnify" returnKeyType="search" />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              {KIND_CHIPS.map((c) => (
                <Chip key={c.key} label={c.label} selected={kind === c.key} onPress={() => { setStyle(undefined); router.setParams({ kind: c.key }); }} />
              ))}
              <Chip label="Lessons" icon="school-outline" accessibilityLabel="Lessons from musicians" onPress={() => router.push('/lessons' as never)} />
            </ScrollView>
            <T v="h3" style={{ paddingHorizontal: 16 }} accessibilityRole="header">Music style</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              <Chip label="All" selected={!style} onPress={() => setStyle(undefined)} />
              {STYLES[kind].map((s) => <Chip key={s} label={s} selected={style === s} onPress={() => setStyle(style === s ? undefined : s)} />)}
            </ScrollView>
            <Row justify="space-between" style={{ paddingHorizontal: 16 }}>
              <T v="small" accessibilityLiveRegion="polite">{plural(list.length, kind === 'all' ? 'artist' : kind === 'dj' ? 'DJ' : kind, kind === 'all' ? 'artists' : kind === 'dj' ? 'DJs' : `${kind}s`)} in Berlin</T>
              <Pressable accessibilityRole="button" accessibilityLabel={`Sorted by ${SORT_TEXT[sort].toLowerCase()}. Change sort`} onPress={() => setSort(SORT_NEXT[sort])} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 }}>
                <Icon name={SORT_ICON[sort]} size={16} color={colors.brand} />
                <T v="smallBold" color={colors.brand}>{SORT_TEXT[sort]}</T>
              </Pressable>
            </Row>
            {sort === 'score' ? <T v="small" style={{ paddingHorizontal: 16 }}>From verified bookings only. Artists without one yet come last.</T> : null}
          </View>
        }
        renderItem={({ item }) => (item ? <ArtistCard artist={item} /> : <View style={{ flex: 1 }} />)}
        ListEmptyComponent={
          narrowed ? (
            <EmptyState icon="account-music-outline" title="No artists match" body="No artist has everything you picked. Try another style or search term." action="Clear search and style" onAction={clear} />
          ) : (
            <EmptyState icon="account-music-outline" title="No artists here yet" body="Nobody in this category is listed right now. All artists shows every musician, band and DJ." action="See all artists" onAction={() => router.setParams({ kind: 'all' })} />
          )
        }
        ListFooterComponent={<View style={{ height: 72 + insets.bottom }} />}
      />
      {/* Floating access to venues from the artist marketplace */}
      <View style={{ position: 'absolute', right: 16, bottom: 24 + insets.bottom }}>
        <IconButton name="storefront-outline" label="Browse venues" bg={colors.brand} color={colors.white} size={56} onPress={() => router.push('/venues')} />
      </View>
    </SafeAreaView>
  );
}
