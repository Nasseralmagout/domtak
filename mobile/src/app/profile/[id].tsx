import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, View, useWindowDimensions } from 'react-native';

import { ActionSheet } from '../../components/ActionSheet';
import { EventRow, FollowButton } from '../../components/cards';
import { Screen, ScreenHeader, goBack } from '../../components/layout';
import { Avatar, Banner, Button, EmptyState, Icon, type IconName, IconButton, Photo, Row, Segmented, T } from '../../components/ui';
import { followersOf, profileById, venueById } from '../../data/mock';
import { compact } from '../../lib/format';
import { toast } from '../../store/toast';
import { ROLE_LABEL, isPro, useAllEvents, useApp, useFeedPosts } from '../../store/useApp';
import { colors, fonts, radius, shadow } from '../../theme';

function Stat({ value, label, onPress }: { value: string; label: string; onPress?: () => void }) {
  const body = (
    <>
      <T v="h3" color={colors.brandDeep} style={{ fontFamily: fonts.display }}>{value}</T>
      <T v="small">{label}</T>
    </>
  );
  if (!onPress) return <View style={{ flex: 1, alignItems: 'center' }}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}. Show list`}
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, opacity: pressed ? 0.6 : 1 })}
    >
      {body}
    </Pressable>
  );
}

function Shortcut({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ alignItems: 'center', gap: 6, width: 72 }}>
      <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={26} color={colors.brand} />
      </View>
      <T v="small" color={colors.ink}>{label}</T>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isMe = id === 'me';
  const { width } = useWindowDimensions();
  const user = useApp((s) => s.user);
  const saves = useApp((s) => s.saves);
  const followingMap = useApp((s) => s.following);
  const going = useApp((s) => s.going);
  const ensureConversation = useApp((s) => s.ensureConversation);
  const blockedList = useApp((s) => s.blocked);
  const toggleBlock = useApp((s) => s.toggleBlock);
  const toggleFollow = useApp((s) => s.toggleFollow);
  const [menuOpen, setMenuOpen] = useState(false);
  const posts = useFeedPosts();
  const events = useAllEvents();
  const [tab, setTab] = useState<'posts' | 'events' | 'saved' | 'about'>(id === 'me' ? 'posts' : 'about');

  const p = isMe ? undefined : profileById(id ?? '');
  if (!isMe && !p) {
    return (
      <Screen header={<ScreenHeader title="Profile" />}>
        <EmptyState icon="account-question-outline" title="Profile not found" body="This account may have been removed or the link is broken." action="Go back" onAction={() => goBack('/')} />
      </Screen>
    );
  }
  const name = isMe ? user.name : p!.name;
  const handle = isMe ? user.handle : p!.handle;
  const avatar = isMe ? user.avatar : p!.avatar;
  const bio = isMe ? user.bio : p!.bio;
  const city = isMe ? user.city : p!.city;
  const verified = isMe ? user.pro === 'verified' : !!p!.verified;
  const authorId = isMe ? 'me' : p!.id;
  const myPosts = posts.filter((x) => x.authorId === authorId);
  const savedPosts = posts.filter((x) => saves[x.id]);
  const hostEvents = events.filter((e) => e.organizerId === authorId);
  const cell = (width - 32 - 8) / 3;
  const grid = tab === 'saved' ? savedPosts : myPosts;
  const fallbackGrid = !isMe && p?.gallery ? p.gallery : [];
  const isBlocked = !isMe && blockedList.includes(p!.id);
  const myFollowerCount = followersOf('me').filter((f) => !blockedList.includes(f.id)).length;
  const myFollowingCount = Object.keys(followingMap).filter((fid) => (profileById(fid) || venueById(fid)) && !blockedList.includes(fid)).length;
  const openConnections = (t: 'followers' | 'following') => router.push(`/connections/${isMe ? 'me' : p!.id}?tab=${t}`);

  const block = () => {
    if (!p) return;
    if (isBlocked) {
      toggleBlock(p.id);
      toast(`${p.name} is unblocked`);
      return;
    }
    if (followingMap[p.id]) toggleFollow(p.id);
    toggleBlock(p.id);
    toast(`${p.name} is blocked`);
  };

  return (
    <Screen
      header={
        <ScreenHeader
          title={handle}
          right={isMe ? <IconButton name="cog-outline" label="Settings" onPress={() => router.push('/settings')} /> : <IconButton name="dots-horizontal" label="More options" onPress={() => setMenuOpen(true)} />}
        />
      }
    >
      <Row gap={16}>
        <Avatar src={avatar} size={96} label={name} verified={verified} ring />
        <View style={{ flex: 1, gap: 4 }}>
          <T v="h2" color={colors.brandDeep}>{name}</T>
          <Row gap={4}><Icon name="map-marker-outline" size={16} color={colors.muted} /><T v="small">{city}</T></Row>
          <View style={{ alignSelf: 'flex-start', marginTop: 2, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: colors.brandSoft }}>
            <T v="caption">{isMe ? ROLE_LABEL[user.role].toUpperCase() : p!.title.toUpperCase()}</T>
          </View>
        </View>
      </Row>

      <Row style={{ backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: 10, ...shadow(1) }} gap={0}>
        <Stat value={!isMe && p!.kind === 'organizer' ? compact(p!.eventsCount ?? hostEvents.length) : String(myPosts.length)} label={!isMe && p!.kind === 'organizer' ? 'Events' : 'Posts'} />
        <View style={{ width: 1, height: 32, backgroundColor: colors.divider }} />
        <Stat value={isMe ? String(myFollowerCount) : compact(p!.followers + (followingMap[p!.id] ? 1 : 0))} label="Followers" onPress={() => openConnections('followers')} />
        <View style={{ width: 1, height: 32, backgroundColor: colors.divider }} />
        <Stat value={isMe ? String(myFollowingCount) : compact(p!.following)} label="Following" onPress={() => openConnections('following')} />
      </Row>

      {bio ? <T v="body">{bio}</T> : null}

      {isMe ? (
        <Row gap={10}>
          <Button title="Edit profile" size="md" style={{ flex: 1 }} onPress={() => router.push('/profile-setup?mode=edit')} />
          <Button title="Share" variant="secondary" size="md" icon="share-variant-outline" style={{ flex: 1 }} onPress={() => Share.share({ message: `Follow me on Domtak: ${handle}` }).catch(() => {})} />
        </Row>
      ) : isBlocked ? (
        <Banner icon="block-helper" tone="danger">
          <View style={{ gap: 8 }}>
            <T v="smallBold" color={colors.danger}>You blocked {name}</T>
            <T v="small" color={colors.danger}>They can’t message you, follow you or see your posts. They won’t be told.</T>
            <Button title="Unblock" accessibilityLabel={`Unblock ${name}`} variant="secondary" size="sm" icon="account-check-outline" hitSlop={4} style={{ alignSelf: 'flex-start' }} onPress={block} />
          </View>
        </Banner>
      ) : (
        <Row gap={10}>
          <Button title="Message" size="md" style={{ flex: 1.4 }} onPress={() => router.push(`/chat/${ensureConversation(p!.id)}`)} />
          <View style={{ flex: 1 }}><FollowButton id={p!.id} size="md" /></View>
        </Row>
      )}

      {isMe ? (
        <Row justify="space-between">
          <Shortcut icon="ticket-confirmation-outline" label="Tickets" onPress={() => router.push('/my-bookings?tab=tickets')} />
          <Shortcut icon="basket-outline" label="Bookings" onPress={() => router.push('/my-bookings?tab=musician')} />
          <Shortcut icon="heart-outline" label="Wishlist" onPress={() => router.push('/wishlist')} />
          {isPro(user.role) ? <Shortcut icon="view-grid-outline" label="Workspace" onPress={() => router.push('/pro/workspace')} /> : <Shortcut icon="check-decagram" label="Go Pro" onPress={() => router.push('/pro-verification')} />}
        </Row>
      ) : null}

      <Segmented
        options={isMe ? [{ key: 'posts', label: 'Posts' }, { key: 'saved', label: 'Saved' }, { key: 'events', label: 'Events' }] : [{ key: 'about', label: 'About' }, { key: 'posts', label: 'Photos' }, { key: 'events', label: 'Events' }]}
        value={!isMe && tab === 'saved' ? 'about' : tab}
        onChange={setTab}
      />

      {tab === 'posts' || tab === 'saved' ? (
        grid.length || fallbackGrid.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {grid.map((x) => (
              <Pressable key={x.id} accessibilityRole="button" accessibilityLabel="Open post" onPress={() => router.push(`/post/${x.id}`)}>
                <Photo src={x.media[0]} style={{ width: cell, height: cell }} radius={6} />
                {x.media.length > 1 ? <View style={{ position: 'absolute', top: 6, right: 6 }}><Icon name="view-grid-outline" size={16} color={colors.white} /></View> : null}
              </Pressable>
            ))}
            {!grid.length ? fallbackGrid.map((g) => <Photo key={g} src={g} style={{ width: cell, height: cell }} radius={6} />) : null}
          </View>
        ) : (
          <View style={{ alignItems: 'center', padding: 24, gap: 10 }}>
            <Icon name={tab === 'saved' ? 'bookmark-outline' : 'camera-outline'} size={40} color={colors.brand} />
            <T v="body" color={colors.muted} center>{tab === 'saved' ? 'Posts you save appear here.' : 'Share your first night out.'}</T>
            {tab === 'posts' && isMe ? <Button title="Create post" size="md" onPress={() => router.push('/new-post')} /> : null}
          </View>
        )
      ) : null}

      {tab === 'events' ? (
        <View style={{ gap: 10 }}>
          {(hostEvents.length ? hostEvents : events.filter((e) => isMe && going[e.id])).map((e) => <EventRow key={e.id} event={e} />)}
          {!hostEvents.length && !(isMe && events.some((e) => going[e.id])) ? <T v="body" color={colors.muted}>No events yet.</T> : null}
        </View>
      ) : null}

      {tab === 'about' && p ? (
        <View style={{ gap: 12 }}>
          <T v="body">{p.bio}</T>
          {p.genres.length ? <T v="small">Music: {p.genres.join(', ')}</T> : null}
          <T v="small">Based in {p.city}</T>
        </View>
      ) : null}

      {p ? (
        <ActionSheet
          visible={menuOpen}
          title={name}
          onClose={() => setMenuOpen(false)}
          actions={[
            { label: 'Share profile', icon: 'share-variant-outline', onPress: () => Share.share({ message: `${name} (${handle}) on Domtak` }).catch(() => {}) },
            isBlocked
              ? { label: `Unblock ${name}`, icon: 'account-check-outline', onPress: block }
              : { label: `Block ${name}`, icon: 'account-cancel-outline', destructive: true, onPress: block },
            { label: 'Report profile', icon: 'flag-outline', destructive: true, onPress: () => toast('Thanks, our team will review this profile') },
          ]}
        />
      ) : null}
    </Screen>
  );
}
