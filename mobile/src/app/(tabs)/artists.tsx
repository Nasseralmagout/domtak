import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArtistTile, lessonPriceLabel } from '../../components/cards';
import { DomtakHeader } from '../../components/layout';
import { Avatar, Icon, Photo, Row, T } from '../../components/ui';
import type { ImgKey } from '../../data/images';
import { artistCategories, profiles } from '../../data/mock';
import { plural } from '../../lib/format';
import { LEARNER_FORMAT_LABEL, useLessonListings } from '../../store/discovery';
import { useApp } from '../../store/useApp';
import { colors, fonts, radius, shadow } from '../../theme';

const MUSIC_KINDS = ['dj', 'musician', 'band'];

interface Category {
  key: string;
  label: string;
  image: ImgKey;
  href: string;
  /** One honest line under the label (only lessons have one: what is actually listed). */
  note?: string;
}

export default function ArtistsTab() {
  const blocked = useApp((s) => s.blocked);
  const lessons = useLessonListings();

  const trending = useMemo(
    () => profiles.filter((p) => MUSIC_KINDS.includes(p.kind) && !blocked.includes(p.id)).sort((a, b) => b.followers - a.followers).slice(0, 8),
    [blocked],
  );
  const teachers = useMemo(() => new Set(lessons.map((x) => x.artist.id)).size, [lessons]);
  // A few lessons to start from: one per teacher, listed prices first.
  const lessonPicks = useMemo(() => {
    const quoted = (l: (typeof lessons)[number]['lesson']) => Number(l.price == null || !!l.quote);
    const sorted = [...lessons].sort((a, b) => quoted(a.lesson) - quoted(b.lesson));
    return sorted.filter((x, i) => sorted.findIndex((y) => y.artist.id === x.artist.id) === i).slice(0, 6);
  }, [lessons]);

  // Musician, Band and DJ from the marketplace, plus Lessons from musicians' lesson services (F23).
  const categories: Category[] = [
    ...artistCategories.map((c) => ({ key: c.key, label: c.label, image: c.image as ImgKey, href: `/artists/${c.key}` })),
    {
      key: 'lessons',
      label: 'Lessons',
      image: 'band_rehearsal',
      href: '/lessons',
      note: lessons.length ? `${plural(lessons.length, 'lesson')} from ${plural(teachers, 'teacher')}` : 'No lessons listed yet',
    },
  ];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.brandDeep }}>
      <DomtakHeader />
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 32 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Book an artist for your event" onPress={() => router.push('/artists/all')} style={{ height: 210 }}>
          <Photo src="band_stage" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <LinearGradient colors={['rgba(20,10,40,0.1)', 'rgba(20,10,40,0.92)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ position: 'absolute', left: 20, right: 20, bottom: 22, gap: 6 }}>
            <Text style={{ color: colors.gold, fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1 }}>MUSICIAN MARKETPLACE</Text>
            <Text style={{ color: colors.white, fontFamily: fonts.display, fontSize: 24 }}>Book Berlin’s best talent</Text>
            <Text style={{ color: colors.lilacLight, fontFamily: fonts.body, fontSize: 14 }}>Reviewed professional profiles with listed fees or quotes. Every request is answered or expires within 24 hours.</Text>
          </View>
        </Pressable>

        <View style={{ padding: 16, gap: 14 }}>
          <Pressable accessibilityRole="search" accessibilityLabel="Search musicians, bands, DJs and lessons" onPress={() => router.push('/search?type=musician')} style={{ height: 48, borderRadius: 14, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, ...shadow(1) }}>
            <Icon name="magnify" size={22} color={colors.muted} />
            <T v="body" color={colors.subtle}>Search musicians, bands, DJs</T>
          </Pressable>
          <T v="h3" color={colors.brandDeep} accessibilityRole="header">Category</T>
          {categories.map((c) => (
            <Pressable
              key={c.key}
              accessibilityRole="button"
              accessibilityLabel={c.note ? `${c.label}, ${c.note}` : c.label}
              onPress={() => router.push(c.href as never)}
              style={{ height: 150, borderRadius: 22, overflow: 'hidden', ...shadow(2) }}
            >
              <Photo src={c.image} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,10,40,0.35)' }} />
              <Text style={{ position: 'absolute', alignSelf: 'center', top: c.note ? 26 : 40, color: colors.white, fontFamily: fonts.display, fontSize: 52, lineHeight: 64 }}>{c.label}</Text>
              {c.note ? (
                <Row gap={6} style={{ position: 'absolute', alignSelf: 'center', bottom: 18, paddingHorizontal: 12, height: 28, borderRadius: 14, backgroundColor: 'rgba(20,10,40,0.6)' }}>
                  <Icon name="school-outline" size={15} color={colors.gold} />
                  <Text style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: 13 }}>{c.note}</Text>
                </Row>
              ) : null}
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="Venues" onPress={() => router.push('/venues')} style={{ height: 110, borderRadius: 22, overflow: 'hidden', ...shadow(2) }}>
            <Photo src="ven_moon" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,10,40,0.45)' }} />
            <Row style={{ position: 'absolute', left: 20, right: 20, top: 0, bottom: 0 }} justify="space-between">
              <View>
                <Text style={{ color: colors.white, fontFamily: fonts.display, fontSize: 30 }}>Venues</Text>
                <Text style={{ color: colors.lilacLight, fontFamily: fonts.body, fontSize: 14 }}>Clubs, halls, gardens & lofts</Text>
              </View>
              <Icon name="chevron-right" size={32} color={colors.white} />
            </Row>
          </Pressable>

          <Row justify="space-between" style={{ marginTop: 8 }}>
            <T v="h3" color={colors.brandDeep} accessibilityRole="header">Trending artists</T>
            <Pressable accessibilityRole="button" accessibilityLabel="See all artists" onPress={() => router.push('/artists/all')} hitSlop={12}><T v="smallBold" color={colors.brand}>See all</T></Pressable>
          </Row>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 6 }}>
          {trending.map((a) => <ArtistTile key={a.id} artist={a} />)}
        </ScrollView>

        {lessonPicks.length ? (
          <>
            <Row justify="space-between" style={{ paddingHorizontal: 16, marginTop: 22, marginBottom: 12 }}>
              <T v="h3" color={colors.brandDeep} accessibilityRole="header">Learn from musicians</T>
              <Pressable accessibilityRole="button" accessibilityLabel="See all lessons" onPress={() => router.push('/lessons' as never)} hitSlop={12}><T v="smallBold" color={colors.brand}>All lessons</T></Pressable>
            </Row>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 6 }}>
              {lessonPicks.map(({ lesson, artist }) => (
                <Pressable
                  key={lesson.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${lesson.title} with ${artist.name}, ${LEARNER_FORMAT_LABEL[lesson.format]}, ${lessonPriceLabel(lesson)}`}
                  onPress={() => router.push(`/lesson/${lesson.id}` as never)}
                  style={{ width: 210, padding: 12, gap: 8, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow(1) }}
                >
                  <Row gap={10}>
                    <Avatar src={artist.avatar} size={40} verified={artist.verified} />
                    <View style={{ flex: 1 }}>
                      <T v="smallBold" numberOfLines={1}>{artist.name}</T>
                      <T v="small" numberOfLines={1}>{lesson.instrument}</T>
                    </View>
                  </Row>
                  <T v="bodyBold" numberOfLines={2} style={{ minHeight: 40 }}>{lesson.title}</T>
                  <T v="small" numberOfLines={1}>{LEARNER_FORMAT_LABEL[lesson.format]} · {lesson.durationMin} min</T>
                  <T v="smallBold" color={colors.brand} numberOfLines={1}>{lessonPriceLabel(lesson)}</T>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
