import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';

import { BookAgainLine, lessonPriceLabel } from '../components/cards';
import { goBack, Screen, ScreenHeader } from '../components/layout';
import { Avatar, Card, Chip, EmptyState, Field, Icon, Photo, Row, T } from '../components/ui';
import type { Lesson } from '../data/types';
import { plural } from '../lib/format';
import { LEARNER_FORMAT_LABEL, type LessonListing, lessonPlace, useArtistScores, useLessonListings } from '../store/discovery';
import { LESSON_FORMAT_ICON } from '../store/services';
import { colors, fonts, radius } from '../theme';

type FormatFilter = 'any' | Lesson['format'];
type PriceFilter = 'any' | 'u40' | 'u60' | 'listed' | 'quote';
type LevelFilter = 'any' | 'beginner';
type Sort = 'price' | 'score';

const FORMATS: { key: FormatFilter; label: string }[] = [
  { key: 'any', label: 'Any format' },
  { key: 'in-person', label: LEARNER_FORMAT_LABEL['in-person'] },
  { key: 'online', label: LEARNER_FORMAT_LABEL.online },
  { key: 'at-studio', label: LEARNER_FORMAT_LABEL['at-studio'] },
];
const PRICES: { key: PriceFilter; label: string }[] = [
  { key: 'any', label: 'Any price' },
  { key: 'u40', label: 'Up to €40' },
  { key: 'u60', label: 'Up to €60' },
  { key: 'listed', label: 'Listed price' },
  { key: 'quote', label: 'Quote on request' },
];

const isQuote = (l: Lesson) => !!l.quote || l.price == null;
const beginnerFriendly = (l: Lesson) => /beginner|all levels/i.test(l.level);

function priceOk(l: Lesson, p: PriceFilter) {
  if (p === 'any') return true;
  if (p === 'quote') return isQuote(l);
  if (isQuote(l)) return false;
  if (p === 'u40') return (l.price ?? 0) <= 40;
  if (p === 'u60') return (l.price ?? 0) <= 60;
  return true;
}

function textOk(x: LessonListing, words: string[]) {
  if (!words.length) return true;
  const hay = `${x.lesson.title} ${x.lesson.instrument} ${x.lesson.level} ${x.lesson.description ?? ''} ${x.lesson.location ?? ''} ${x.artist.name} ${x.artist.title} ${x.artist.genres.join(' ')}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

function FilterRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <T v="label" style={{ paddingHorizontal: 16 }} accessibilityRole="header">{title}</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {children}
      </ScrollView>
    </View>
  );
}

/** One lesson service in the results: teacher, lesson, format, duration and its own price. */
function LessonResult({ item }: { item: LessonListing }) {
  const { lesson, artist } = item;
  const place = lessonPlace(lesson);
  const price = lessonPriceLabel(lesson);
  return (
    <Card
      onPress={() => router.push(`/lesson/${lesson.id}` as never)}
      accessibilityLabel={`${lesson.title} with ${artist.name}. ${lesson.instrument}, ${lesson.level}, ${place}, ${lesson.durationMin} minutes, ${price}`}
      style={{ gap: 10 }}
    >
      <Row gap={12}>
        <Avatar src={artist.avatar} size={48} verified={artist.verified} />
        <View style={{ flex: 1, gap: 1 }}>
          <T v="bodyBold" numberOfLines={1}>{artist.name}</T>
          <BookAgainLine id={artist.id} />
        </View>
        <View style={{ alignItems: 'flex-end', maxWidth: 130 }}>
          <T v="smallBold" color={colors.brand} style={{ textAlign: 'right' }}>{price}</T>
        </View>
      </Row>
      <View style={{ gap: 2 }}>
        <T v="title" numberOfLines={2}>{lesson.title}</T>
        {lesson.description ? <T v="small" numberOfLines={2}>{lesson.description}</T> : null}
      </View>
      <Row gap={14} style={{ flexWrap: 'wrap' }}>
        <Row gap={4}><Icon name="music-note" size={15} color={colors.brand} /><T v="small" color={colors.inkSoft}>{lesson.instrument}</T></Row>
        <Row gap={4}><Icon name={LESSON_FORMAT_ICON[lesson.format]} size={15} color={colors.brand} /><T v="small" color={colors.inkSoft} numberOfLines={1}>{place}</T></Row>
        <Row gap={4}><Icon name="clock-outline" size={15} color={colors.brand} /><T v="small" color={colors.inkSoft}>{lesson.durationMin} min</T></Row>
        <Row gap={4}><Icon name="stairs" size={15} color={colors.brand} /><T v="small" color={colors.inkSoft}>{lesson.level}</T></Row>
      </Row>
    </Card>
  );
}

export default function Lessons() {
  const params = useLocalSearchParams<{ instrument?: string; q?: string }>();
  const listings = useLessonListings();
  const scoreOf = useArtistScores();
  const [q, setQ] = useState(params.q ?? '');
  // ?instrument=guitar matches the offered "Guitar" (case-insensitive), so the chip shows as selected.
  const [instrument, setInstrument] = useState<string | undefined>(() => {
    const want = params.instrument?.trim().toLowerCase();
    return want ? (listings.find((x) => x.lesson.instrument.toLowerCase() === want)?.lesson.instrument ?? params.instrument) : undefined;
  });
  const [format, setFormat] = useState<FormatFilter>('any');
  const [price, setPrice] = useState<PriceFilter>('any');
  const [level, setLevel] = useState<LevelFilter>('any');
  const [sort, setSort] = useState<Sort>('price');

  // Instruments that teachers actually offer, most offered first. An instrument picked by link that nobody
  // offers (e.g. ?instrument=Drums) keeps its chip, so it is visible and can be turned off.
  const instruments = useMemo(() => {
    const counts = new Map<string, number>();
    listings.forEach((x) => counts.set(x.lesson.instrument, (counts.get(x.lesson.instrument) ?? 0) + 1));
    const offered = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
    return instrument && !counts.has(instrument) ? [instrument, ...offered] : offered;
  }, [listings, instrument]);

  const words = useMemo(() => q.trim().toLowerCase().split(/\s+/).filter(Boolean), [q]);
  const { list, teachers, relaxed, relaxedTitle, searchMiss } = useMemo(() => {
    // Same score as the "would book again" line on each result (your own reviews and blocks included).
    const score = (id: string) => scoreOf(id).recommendPct ?? -1;
    const byPrice = (a: LessonListing, b: LessonListing) => Number(isQuote(a.lesson)) - Number(isQuote(b.lesson)) || (a.lesson.price ?? 0) - (b.lesson.price ?? 0);
    const order = (l: LessonListing[]) => [...l].sort((a, b) => (sort === 'score' ? score(b.artist.id) - score(a.artist.id) || byPrice(a, b) : byPrice(a, b)));
    const pick = (x: LessonListing) => (format === 'any' || x.lesson.format === format) && priceOk(x.lesson, price) && (level === 'any' || beginnerFriendly(x.lesson));
    const searched = listings.filter((x) => textOk(x, words));
    const base = searched.filter((x) => !instrument || x.lesson.instrument === instrument);
    const matched = base.filter(pick);
    // No match: drop one cause at a time and say which, never an invented result.
    let loose: LessonListing[] = [];
    let looseTitle = '';
    if (!matched.length) {
      if (base.length) {
        loose = base;
        looseTitle = instrument ? `${instrument} lessons without your other filters` : 'Without your other filters';
      } else if (searched.length) {
        loose = searched;
        looseTitle = words.length ? 'Other instruments for your search' : 'Lessons for other instruments';
      } else if (words.length) {
        loose = listings.filter((x) => (!instrument || x.lesson.instrument === instrument) && pick(x));
        const anyFilter = !!instrument || format !== 'any' || price !== 'any' || level !== 'any';
        looseTitle = anyFilter ? 'Lessons with your filters, without the search' : 'Lessons you can browse instead';
      }
    }
    return {
      list: order(matched),
      teachers: new Set(matched.map((x) => x.artist.id)).size,
      relaxed: order(loose).slice(0, 4),
      relaxedTitle: looseTitle,
      // The search words alone find nothing, so clearing filters would not help.
      searchMiss: words.length > 0 && !searched.length,
    };
  }, [listings, words, instrument, format, price, level, sort, scoreOf]);

  const filtered = !!instrument || format !== 'any' || price !== 'any' || level !== 'any';
  const clear = () => {
    setInstrument(undefined);
    setFormat('any');
    setPrice('any');
    setLevel('any');
  };

  const header = (
    <View style={{ gap: 14, paddingBottom: 12 }}>
      <View style={{ marginHorizontal: 16, height: 150, borderRadius: radius.xl, overflow: 'hidden' }}>
        <Photo src="band_rehearsal" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <LinearGradient colors={['rgba(20,10,40,0.15)', 'rgba(20,10,40,0.9)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 14, gap: 4 }}>
          <Text style={{ color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1 }}>LEARN FROM BERLIN MUSICIANS</Text>
          <Text style={{ color: colors.white, fontFamily: fonts.display, fontSize: 22 }}>Music lessons</Text>
          <Text style={{ color: colors.lilacLight, fontFamily: fonts.body, fontSize: 13 }}>Each lesson has its own price and terms, separate from performance fees.</Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: 16 }}>
        <Field placeholder="Instrument, teacher or style" value={q} onChangeText={setQ} icon="magnify" accessibilityLabel="Search lessons" returnKeyType="search" />
      </View>
      <FilterRow title="Instrument">
        <Chip label="All" accessibilityLabel="All instruments" selected={!instrument} onPress={() => setInstrument(undefined)} />
        {instruments.map((i) => <Chip key={i} label={i} selected={instrument === i} onPress={() => setInstrument(instrument === i ? undefined : i)} />)}
      </FilterRow>
      <FilterRow title="Format">
        {FORMATS.map((f) => <Chip key={f.key} label={f.label} icon={f.key === 'any' ? undefined : LESSON_FORMAT_ICON[f.key]} selected={format === f.key} onPress={() => setFormat(f.key)} />)}
      </FilterRow>
      <FilterRow title="Price">
        {PRICES.map((p) => <Chip key={p.key} label={p.label} selected={price === p.key} onPress={() => setPrice(p.key)} />)}
      </FilterRow>
      <FilterRow title="Level">
        <Chip label="Any level" selected={level === 'any'} onPress={() => setLevel('any')} />
        <Chip label="Beginner-friendly" icon="sprout-outline" selected={level === 'beginner'} onPress={() => setLevel(level === 'beginner' ? 'any' : 'beginner')} />
      </FilterRow>
      <Row justify="space-between" style={{ paddingHorizontal: 16 }}>
        <Row gap={10} style={{ flexShrink: 1 }}>
          <T v="small" accessibilityLiveRegion="polite" numberOfLines={2} style={{ flexShrink: 1 }}>{list.length ? `${plural(list.length, 'lesson')} from ${plural(teachers, 'teacher')}` : 'No lessons'}</T>
          {filtered ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear lesson filters" onPress={clear} hitSlop={12} style={{ minHeight: 32, justifyContent: 'center' }}>
              <T v="smallBold" color={colors.brand}>Clear filters</T>
            </Pressable>
          ) : null}
        </Row>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sorted by ${sort === 'price' ? 'lowest price' : 'would book again'}. Change sort`}
          onPress={() => setSort(sort === 'price' ? 'score' : 'price')}
          hitSlop={12}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 }}
        >
          <Icon name={sort === 'price' ? 'cash-multiple' : 'thumb-up-outline'} size={16} color={colors.brand} />
          <T v="smallBold" color={colors.brand}>{sort === 'price' ? 'Lowest price' : 'Would book again'}</T>
        </Pressable>
      </Row>
    </View>
  );

  const empty = listings.length ? (
    <View style={{ paddingHorizontal: 16, gap: 12 }}>
      <EmptyState
        icon="school-outline"
        title="No lessons match"
        body={
          searchMiss
            ? `Nothing found for “${q.trim()}”. Try an instrument such as guitar or piano.`
            : 'No lesson has everything you picked. Remove a filter to see more teachers.'
        }
        action={searchMiss ? 'Clear search' : 'Clear filters'}
        onAction={searchMiss ? () => setQ('') : clear}
      />
      {relaxed.length ? (
        <View style={{ gap: 10 }}>
          <T v="h3" accessibilityRole="header">{relaxedTitle}</T>
          <T v="small">Closest matches, not a promise of free dates. Each teacher confirms the date and terms in your request.</T>
          {relaxed.map((x) => <LessonResult key={x.lesson.id} item={x} />)}
        </View>
      ) : null}
    </View>
  ) : (
    <EmptyState icon="school-outline" title="No lessons listed yet" body="Musicians add lessons to their services. Until then you can browse artists and message them." action="Browse artists" onAction={() => router.push('/artists/all')} />
  );

  return (
    <Screen scroll={false} keyboard header={<ScreenHeader title="Lessons" subtitle="Discover a teacher, then book or ask for a quote" onBack={() => goBack('/(tabs)/artists')} />}>
      <FlatList
        data={list}
        keyExtractor={(x) => x.lesson.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}
        ListHeaderComponent={header}
        renderItem={({ item }) => <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}><LessonResult item={item} /></View>}
        ListEmptyComponent={empty}
      />
    </Screen>
  );
}
