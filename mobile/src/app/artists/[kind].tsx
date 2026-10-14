import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArtistCard } from '../../components/cards';
import { DomtakHeader, goBack, ScreenHeader } from '../../components/layout';
import { Chip, EmptyState, Field, IconButton, Row, T } from '../../components/ui';
import { profiles } from '../../data/mock';
import type { Profile } from '../../data/types';
import { colors } from '../../theme';

const TITLES: Record<string, string> = { musician: 'All musicians', band: 'All bands', dj: 'All DJs', all: 'All artists' };
const STYLES: Record<string, string[]> = {
  dj: ['Techno', 'House', 'Trance', 'Pop', 'Electronic'],
  musician: ['Acoustic', 'Soul', 'Jazz', 'Pop', 'Rock', 'Indie'],
  band: ['Indie', 'Rock', 'Jazz'],
  all: ['Techno', 'House', 'Acoustic', 'Soul', 'Jazz', 'Rock', 'Indie', 'Pop'],
};

export default function ArtistList() {
  const params = useLocalSearchParams<{ kind: string }>();
  const kind = params.kind && TITLES[params.kind] ? params.kind : 'all';
  const [q, setQ] = useState('');
  const [style, setStyle] = useState<string>();
  const [sort, setSort] = useState<'popular' | 'price'>('popular');

  const list = useMemo(() => {
    let l = profiles.filter((p) => (kind === 'all' ? ['dj', 'musician', 'band'].includes(p.kind) : p.kind === kind));
    if (style) l = l.filter((p) => p.genres.includes(style));
    const t = q.trim().toLowerCase();
    if (t) l = l.filter((p) => `${p.name} ${p.title} ${p.genres.join(' ')} ${p.city} ${(p.instruments ?? []).join(' ')}`.toLowerCase().includes(t));
    return [...l].sort((a, b) => (sort === 'popular' ? b.followers - a.followers : (a.feePerHour ?? 0) - (b.feePerHour ?? 0)));
  }, [kind, style, q, sort]);
  // Pad odd lists so the last card keeps its column width.
  const data: (Profile | null)[] = list.length % 2 ? [...list, null] : list;

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
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <ScreenHeader title={TITLES[kind] ?? 'Artists'} onBack={() => goBack('/(tabs)/artists')} right={<IconButton name={sort === 'popular' ? 'sort-descending' : 'cash-multiple'} label={`Sort by ${sort === 'popular' ? 'lowest fee' : 'popularity'}`} onPress={() => setSort(sort === 'popular' ? 'price' : 'popular')} />} />
            <View style={{ paddingHorizontal: 16 }}>
              <Field placeholder="Search by name, style or area" accessibilityLabel="Search artists" value={q} onChangeText={setQ} icon="magnify" />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              {(['all', 'dj', 'musician', 'band'] as const).map((k) => (
                <Chip key={k} label={k === 'all' ? 'All' : k === 'dj' ? 'DJs' : k === 'band' ? 'Bands' : 'Musicians'} selected={kind === k} onPress={() => { setStyle(undefined); router.setParams({ kind: k }); }} />
              ))}
            </ScrollView>
            <T v="h3" style={{ paddingHorizontal: 16 }}>Music style</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              <Chip label="All" selected={!style} onPress={() => setStyle(undefined)} />
              {(STYLES[kind] ?? STYLES.all).map((s) => <Chip key={s} label={s} selected={style === s} onPress={() => setStyle(style === s ? undefined : s)} />)}
            </ScrollView>
            <Row justify="space-between" style={{ paddingHorizontal: 16 }}>
              <T v="small">{list.length} available in Berlin</T>
              <T v="smallBold" color={colors.brand}>{sort === 'popular' ? 'Most popular' : 'Lowest fee'}</T>
            </Row>
          </View>
        }
        renderItem={({ item }) => (item ? <ArtistCard artist={item} /> : <View style={{ flex: 1 }} />)}
        ListEmptyComponent={<EmptyState icon="account-music-outline" title="No artists match" body="Try a different style or search term." action="Clear search" onAction={() => { setStyle(undefined); setQ(''); }} />}
        ListFooterComponent={<View style={{ height: 72 }} />}
      />
      {/* Floating access to venues from the artist marketplace */}
      <View style={{ position: 'absolute', right: 16, bottom: 24 }}>
        <IconButton name="storefront-outline" label="Browse venues" bg={colors.brand} color={colors.white} size={56} onPress={() => router.push('/venues')} />
      </View>
    </SafeAreaView>
  );
}
