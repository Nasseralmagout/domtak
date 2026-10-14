import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateBadge, EventCard, MiniEventCard } from '../../components/cards';
import { DomtakHeader } from '../../components/layout';
import { PostCard } from '../../components/PostCard';
import { Avatar, Icon, Photo, Pill, Row, Segmented, T } from '../../components/ui';
import { profileById, profiles, stories } from '../../data/mock';
import type { EventItem, Post } from '../../data/types';
import { parse, TODAY } from '../../lib/format';
import { isPromoted } from '../../lib/promotions';
import { useAllEvents, useApp, useFeedPosts } from '../../store/useApp';
import { colors, fonts, shadow } from '../../theme';

type FeedTab = 'forYou' | 'following' | 'nearby';
type Item =
  | { kind: 'post'; post: Post }
  | { kind: 'artists' }
  | { kind: 'events' }
  | { kind: 'sponsored' };

function StoriesRow() {
  const user = useApp((s) => s.user);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 14, paddingVertical: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Add to your story" onPress={() => router.push('/new-post?story=1')} style={{ alignItems: 'center', gap: 6, width: 72 }}>
        <View>
          <Avatar src={user.avatar} size={68} label={user.name} />
          <View style={{ position: 'absolute', right: 0, bottom: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={16} color={colors.white} />
          </View>
        </View>
        <T v="small" numberOfLines={1} color={colors.ink}>Your story</T>
      </Pressable>
      {stories.map((s) => {
        const p = profileById(s.authorId);
        if (!p) return null;
        return (
          <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={s.live ? `${p.name} is live now, watch stream` : `${p.name}’s story`} onPress={() => router.push(s.live ? `/live/${s.id}` : `/story/${s.id}`)} style={{ alignItems: 'center', gap: 6, width: 72 }}>
            <LinearGradient colors={s.live ? ['#F2B632', '#E5484D'] : ['#8B5CF6', '#3B1F8B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 66, height: 66, borderRadius: 33, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
                <Photo src={p.avatar} style={{ width: 60, height: 60, borderRadius: 30 }} />
              </View>
            </LinearGradient>
            {s.live ? (
              <View style={{ position: 'absolute', top: 60, backgroundColor: '#E5484D', paddingHorizontal: 6, borderRadius: 4, borderWidth: 2, borderColor: colors.white }}>
                <Text style={{ color: colors.white, fontFamily: fonts.bodyBold, fontSize: 10 }}>LIVE</Text>
              </View>
            ) : null}
            <T v="small" numberOfLines={1} color={colors.ink}>{p.name}</T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function NextGigs() {
  const events = useAllEvents();
  const artists = profiles.filter((p) => ['dj', 'musician', 'band'].includes(p.kind));
  const rows = artists
    .map((a) => ({ a, next: events.filter((e) => e.lineup.includes(a.id)).sort((x, y) => x.start.localeCompare(y.start))[0] }))
    .filter((r) => r.next)
    .slice(0, 8);
  return (
    <View style={{ backgroundColor: colors.surface, paddingVertical: 14, marginBottom: 10 }}>
      <Row justify="space-between" style={{ paddingHorizontal: 14, marginBottom: 10 }}>
        <T v="h3">Musicians’ next events</T>
        <Pressable accessibilityRole="button" accessibilityLabel="See all musicians" onPress={() => router.push('/(tabs)/artists')} hitSlop={12}><T v="smallBold" color={colors.brand}>See all</T></Pressable>
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 12 }}>
        {rows.map(({ a, next }) => (
          <Pressable key={a.id} accessibilityRole="button" accessibilityLabel={`${a.name}, next event: ${next!.title}`} onPress={() => router.push(`/event/${next!.id}`)} style={{ width: 140, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface, ...shadow(1) }}>
            <Photo src={a.avatar} style={{ height: 150 }} />
            <View style={{ position: 'absolute', top: 8, left: 8 }}><DateBadge iso={next!.start} size={42} /></View>
            <View style={{ padding: 8, gap: 2 }}>
              <T v="smallBold" numberOfLines={1}>{a.name}</T>
              <T v="small" numberOfLines={1} style={{ fontSize: 11 }}>{next!.title}</T>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * Public events that have not ended, in date order, with boosted events (Pro → Promote) first.
 * `promoted` holds the ids of the boosted ones, which are marked as Sponsored.
 */
function useDiscoverEvents() {
  const events = useAllEvents();
  const promotions = useApp((s) => s.promotions);
  return useMemo(() => {
    const open = events
      .filter((e) => (!e.isPrivate || e.organizerId === 'me') && parse(e.end) >= TODAY)
      .sort((a, b) => a.start.localeCompare(b.start));
    const promoted = new Set(open.filter((e) => isPromoted(promotions, e)).map((e) => e.id));
    const list: EventItem[] = [...open.filter((e) => promoted.has(e.id)), ...open.filter((e) => !promoted.has(e.id))];
    return { list, promoted };
  }, [events, promotions]);
}

function UpcomingEvents() {
  const { list: discover, promoted } = useDiscoverEvents();
  const list = discover.slice(0, 6);
  return (
    <View style={{ backgroundColor: colors.surface, paddingVertical: 14, marginBottom: 10 }}>
      <Row justify="space-between" style={{ paddingHorizontal: 14, marginBottom: 10 }}>
        <T v="h3">Upcoming events near you</T>
        <Pressable accessibilityRole="button" accessibilityLabel="See all upcoming events" onPress={() => router.push('/events/all')} hitSlop={12}><T v="smallBold" color={colors.brand}>See all</T></Pressable>
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 12, paddingBottom: 4 }}>
        {list.map((e) => (
          <View key={e.id}>
            <MiniEventCard event={e} />
            {promoted.has(e.id) ? (
              <View pointerEvents="none" style={{ position: 'absolute', top: 8, left: 8 }}>
                <Pill label="Sponsored" icon="star-four-points-outline" />
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function Sponsored() {
  const { list, promoted } = useDiscoverEvents();
  // A boosted event takes the sponsored slot first; otherwise a sponsored partner event.
  const ev = list.find((e) => promoted.has(e.id)) ?? list.find((e) => e.sponsored);
  if (!ev) return null;
  return (
    <View style={{ paddingHorizontal: 12, marginBottom: 10, gap: 6 }}>
      {promoted.has(ev.id) ? <Pill label="Sponsored" icon="star-four-points-outline" /> : null}
      <EventCard event={ev} />
    </View>
  );
}

export default function Home() {
  const [tab, setTab] = useState<FeedTab>('forYou');
  const [refreshing, setRefreshing] = useState(false);
  const following = useApp((s) => s.following);
  const allPosts = useFeedPosts();

  const items = useMemo<Item[]>(() => {
    let posts = allPosts.filter((p) => p.feed.includes(tab));
    if (tab === 'following') posts = posts.filter((p) => p.authorId === 'me' || following[p.authorId]);
    const out: Item[] = [];
    posts.forEach((p, i) => {
      out.push({ kind: 'post', post: p });
      if (i === 0) out.push({ kind: 'artists' });
      if (i === 2) out.push({ kind: 'events' });
      if (i === 4 && tab !== 'following') out.push({ kind: 'sponsored' });
    });
    if (posts.length < 3) out.push({ kind: 'events' });
    return out;
  }, [allPosts, tab, following]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.brandDeep }}>
      <DomtakHeader />
      <FlatList
        style={{ flex: 1, backgroundColor: colors.bg }}
        data={items}
        keyExtractor={(it, i) => (it.kind === 'post' ? it.post.id : `${it.kind}-${i}`)}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.brand} colors={[colors.brand]} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 800); }} />}
        ListHeaderComponent={
          <View style={{ backgroundColor: colors.surface, marginBottom: 10 }}>
            <Pressable accessibilityRole="search" accessibilityLabel="Search events, artists, venues" onPress={() => router.push('/search')} style={{ marginHorizontal: 12, marginTop: 12, height: 46, borderRadius: 14, backgroundColor: '#F1EFF6', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}>
              <Icon name="magnify" size={22} color={colors.muted} />
              <T v="body" color={colors.subtle}>Search events, artists, venues</T>
            </Pressable>
            <StoriesRow />
            <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
              <Segmented options={[{ key: 'forYou', label: 'For You' }, { key: 'following', label: 'Following' }, { key: 'nearby', label: 'Nearby' }]} value={tab} onChange={setTab} />
            </View>
          </View>
        }
        renderItem={({ item }) => {
          if (item.kind === 'post') return <PostCard post={item.post} />;
          if (item.kind === 'artists') return <NextGigs />;
          if (item.kind === 'events') return <UpcomingEvents />;
          return <Sponsored />;
        }}
        ListEmptyComponent={<T v="body" center style={{ padding: 32 }}>Follow artists to fill your feed.</T>}
      />
    </SafeAreaView>
  );
}
