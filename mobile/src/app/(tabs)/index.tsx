import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateBadge, EventCard, MiniEventCard } from '../../components/cards';
import { DomtakHeader } from '../../components/layout';
import { PostCard } from '../../components/PostCard';
import { Avatar, Chip, Icon, Photo, Pill, Row, Segmented, T } from '../../components/ui';
import { profileById, profiles, stories } from '../../data/mock';
import type { EventItem, Post } from '../../data/types';
import { compact, parse, TODAY } from '../../lib/format';
import { isPromoted } from '../../lib/promotions';
import { isDiscoverable } from '../../store/filters';
import { memberCount, useCommunities, useFriendRequests } from '../../store/social';
import { activeWorkspace, canPostToFeed, isPro, useActionQueue, useAllEvents, useApp, useFeedPosts } from '../../store/useApp';
import { colors, fonts, shadow } from '../../theme';

type FeedTab = 'forYou' | 'following' | 'nearby';
const asFeedTab = (t?: string): FeedTab => (t === 'following' || t === 'nearby' ? t : 'forYou');
type Item =
  | { kind: 'post'; post: Post }
  | { kind: 'artists' }
  | { kind: 'events' }
  | { kind: 'communities' }
  | { kind: 'sponsored' }
  | { kind: 'empty'; tab: FeedTab };

function StoriesRow() {
  const user = useApp((s) => s.user);
  const blocked = useApp((s) => s.blocked);
  // Stories are for approved professionals in their professional workspace (user note 2); members watch only.
  const canPost = canPostToFeed(user);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 14, paddingVertical: 12 }}>
      {canPost ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Add to your story" onPress={() => router.push('/new-post?story=1')} style={{ alignItems: 'center', gap: 6, width: 72 }}>
          <View>
            <Avatar src={user.avatar} size={68} label={user.name} />
            <View style={{ position: 'absolute', right: 0, bottom: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={16} color={colors.white} />
            </View>
          </View>
          <T v="small" numberOfLines={1} color={colors.ink}>Your story</T>
        </Pressable>
      ) : null}
      {stories.map((s) => {
        const p = profileById(s.authorId);
        if (!p || blocked.includes(p.id)) return null;
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

/** Things that need a decision (payments, quotes, invitations, requests): one line into the dashboard. */
function ActionBanner() {
  const queue = useActionQueue();
  const user = useApp((s) => s.user);
  if (!queue.length) return null;
  const pro = isPro(activeWorkspace(user));
  const n = queue.length;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${n} thing${n === 1 ? '' : 's'} need your attention. Open ${pro ? 'your workspace' : 'your dashboard'}`}
      onPress={() => router.push(pro ? '/pro/workspace' : '/dashboard')}
      style={{ marginHorizontal: 12, marginTop: 12, minHeight: 48, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.brandSoft, flexDirection: 'row', alignItems: 'center', gap: 10 }}
    >
      <Icon name="bell-alert-outline" size={22} color={colors.brand} />
      <View style={{ flex: 1 }}>
        <T v="bodyBold">{`${n} thing${n === 1 ? '' : 's'} need${n === 1 ? 's' : ''} your attention`}</T>
        <T v="small" numberOfLines={1}>{queue[0].title}</T>
      </View>
      <Icon name="chevron-right" size={20} color={colors.brand} />
    </Pressable>
  );
}

/** Quick links: communities (F09), friends (F10), lessons (F08) and the nearby events map. */
function SocialLinks() {
  const { incoming } = useFriendRequests();
  const n = incoming.length;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingTop: 12 }}>
      <Chip label="Near me" icon="map-marker-radius-outline" accessibilityLabel="Open the map of events near you" onPress={() => router.push('/map')} />
      <Chip label="Communities" icon="account-group-outline" accessibilityLabel="Open music communities" onPress={() => router.push('/communities')} />
      <Chip
        label={n ? `Friends (${n})` : 'Friends'}
        icon={n ? 'account-multiple-plus-outline' : 'account-multiple-outline'}
        accessibilityLabel={n ? `Friends, ${n} new friend request${n === 1 ? '' : 's'}` : 'Open friends'}
        onPress={() => router.push(n ? '/friends?tab=requests' : '/friends')}
      />
      <Chip label="Lessons" icon="school-outline" accessibilityLabel="Find music lessons" onPress={() => router.push('/lessons')} />
    </ScrollView>
  );
}

/** Platform-created music communities, the ones you joined first (F09). */
function CommunitiesStrip() {
  const { joined, others, joinedIds } = useCommunities();
  const list = [...joined, ...others];
  return (
    <View style={{ backgroundColor: colors.surface, paddingVertical: 14, marginBottom: 10 }}>
      <Row justify="space-between" style={{ paddingHorizontal: 14, marginBottom: 10 }}>
        <T v="h3">Music communities</T>
        <Pressable accessibilityRole="button" accessibilityLabel="See all communities" onPress={() => router.push('/communities')} hitSlop={12} style={{ minHeight: 44, justifyContent: 'center' }}><T v="smallBold" color={colors.brand}>See all</T></Pressable>
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 12, paddingBottom: 4 }}>
        {list.map((c) => {
          const isIn = joinedIds.includes(c.id);
          return (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityLabel={`${c.name}, ${compact(memberCount(c, isIn))} members${isIn ? ', joined' : ''}`}
              onPress={() => router.push(`/community/${c.id}`)}
              style={{ width: 168, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface, ...shadow(1) }}
            >
              <Photo src={c.cover} style={{ height: 96 }} />
              {isIn ? (
                <View style={{ position: 'absolute', top: 8, left: 8 }}>
                  <Pill label="Joined" tone="success" icon="check" />
                </View>
              ) : null}
              <View style={{ padding: 10, gap: 2 }}>
                <T v="smallBold" numberOfLines={1}>{c.name}</T>
                <T v="small" numberOfLines={1} style={{ fontSize: 12 }}>{compact(memberCount(c, isIn))} members · {c.genres.join(', ')}</T>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Shown in place of posts when a feed tab has none, so the page never looks broken. */
function EmptyFeed({ tab }: { tab: FeedTab }) {
  const following = tab === 'following';
  return (
    <View style={{ backgroundColor: colors.surface, marginBottom: 10, padding: 20, alignItems: 'center', gap: 8 }}>
      <Icon name={following ? 'account-heart-outline' : 'image-off-outline'} size={36} color={colors.brand} />
      <T v="title" center>{following ? 'No posts from people you follow' : 'No posts here yet'}</T>
      <T v="small" center>
        {following
          ? 'Follow artists, venues and organizers to see their posts here.'
          : 'Posts from verified artists, venues and organizers will show up here.'}
      </T>
      <Chip label={following ? 'Find artists to follow' : 'Browse communities'} icon={following ? 'account-search-outline' : 'account-group-outline'} onPress={() => router.push(following ? '/(tabs)/artists' : '/communities')} />
    </View>
  );
}

function NextGigs() {
  const events = useAllEvents();
  const artists = profiles.filter((p) => ['dj', 'musician', 'band'].includes(p.kind));
  // "Next" means not ended yet, and only events you can open (others' private events are invite-only; drafts and cancelled events are not discoverable).
  const upcoming = events.filter((e) => isDiscoverable(e) && parse(e.end) >= TODAY);
  const rows = artists
    .map((a) => ({ a, next: upcoming.filter((e) => e.lineup.includes(a.id)).sort((x, y) => x.start.localeCompare(y.start))[0] }))
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
      .filter((e) => isDiscoverable(e) && parse(e.end) >= TODAY)
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
              <View style={{ position: 'absolute', top: 8, left: 8, pointerEvents: 'none' }}>
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
      {/* EventCard already draws its own SPONSORED badge for partner events, so don't label them twice. */}
      {promoted.has(ev.id) && !ev.sponsored ? <Pill label="Sponsored" icon="star-four-points-outline" /> : null}
      <EventCard event={ev} />
    </View>
  );
}

export default function Home() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<FeedTab>(asFeedTab(params.tab));
  // ?tab=following (e.g. after a Followers-only post) switches the feed even when Home is already mounted.
  const [lastParam, setLastParam] = useState(params.tab);
  if (params.tab !== lastParam) {
    setLastParam(params.tab);
    if (params.tab) setTab(asFeedTab(params.tab));
  }
  const [refreshing, setRefreshing] = useState(false);
  const following = useApp((s) => s.following);
  const blocked = useApp((s) => s.blocked);
  const allPosts = useFeedPosts();

  const items = useMemo<Item[]>(() => {
    // Posts from accounts you blocked are left out, as in communities, comments and stories.
    let posts = allPosts.filter((p) => p.feed.includes(tab) && !blocked.includes(p.authorId));
    if (tab === 'following') posts = posts.filter((p) => p.authorId === 'me' || following[p.authorId]);
    const out: Item[] = posts.length ? [] : [{ kind: 'empty', tab }];
    posts.forEach((p, i) => {
      out.push({ kind: 'post', post: p });
      if (i === 0) out.push({ kind: 'artists' });
      if (i === 2) out.push({ kind: 'events' });
      if (i === 3) out.push({ kind: 'communities' });
      if (i === 4 && tab !== 'following') out.push({ kind: 'sponsored' });
    });
    if (posts.length < 3) out.push({ kind: 'events' });
    if (posts.length < 4) out.push({ kind: 'communities' });
    return out;
  }, [allPosts, tab, following, blocked]);

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
            <ActionBanner />
            <SocialLinks />
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
          if (item.kind === 'communities') return <CommunitiesStrip />;
          if (item.kind === 'empty') return <EmptyFeed tab={item.tab} />;
          return <Sponsored />;
        }}
      />
    </SafeAreaView>
  );
}
