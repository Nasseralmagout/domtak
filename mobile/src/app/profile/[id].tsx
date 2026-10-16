import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, View, useWindowDimensions } from 'react-native';

import { ActionSheet, ReasonSheet } from '../../components/ActionSheet';
import { EventRow, FollowButton } from '../../components/cards';
import { Screen, ScreenHeader, goBack } from '../../components/layout';
import { FriendButton, REPORT_REASONS } from '../../components/PostCard';
import { Avatar, Banner, Button, Chip, EmptyState, Icon, type IconName, IconButton, Photo, Row, Segmented, T } from '../../components/ui';
import { followersOf, profileById, venueById } from '../../data/mock';
import { compact, plural } from '../../lib/format';
import { isDiscoverable } from '../../store/filters';
import { canBefriend, communitiesFor, useFriendProfiles, useFriendRequests, useFriendStatus } from '../../store/social';
import { toast } from '../../store/toast';
import { activeWorkspace, canPostToFeed, ROLE_LABEL, isPro, useAllEvents, useApp, useFeedPosts } from '../../store/useApp';
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

/** A wide shortcut card on your own profile (Friends, Communities). */
function LinkTile({ icon, title, sub, badge, onPress }: { icon: IconName; title: string; sub: string; badge?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${sub}`}
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60, paddingHorizontal: 12, borderRadius: radius.lg, backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1, ...shadow(1) })}
    >
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={colors.brand} />
        {badge ? <View style={{ position: 'absolute', top: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.warningStrong, borderWidth: 2, borderColor: colors.white }} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <T v="bodyBold" numberOfLines={1}>{title}</T>
        <T v="small" numberOfLines={1}>{sub}</T>
      </View>
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
  const [reporting, setReporting] = useState(false);
  const reportContent = useApp((s) => s.reportContent);
  const respondFriendRequest = useApp((s) => s.respondFriendRequest);
  const removeFriend = useApp((s) => s.removeFriend);
  const joinedCommunities = useApp((s) => s.joinedCommunities);
  const reportedProfile = useApp((s) => s.reports.some((r) => r.byMe && r.targetId === id && r.status === 'open'));
  const friendState = useFriendStatus(id ?? '');
  const myFriends = useFriendProfiles();
  const { incoming: incomingRequests } = useFriendRequests();
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
  const isBlocked = !isMe && blockedList.includes(p!.id);
  // Posts from accounts you blocked are hidden everywhere (feed, communities, post links), so here too.
  const authoredPosts = posts.filter((x) => x.authorId === authorId);
  const myPosts = isBlocked ? [] : authoredPosts;
  const savedPosts = posts.filter((x) => saves[x.id] && !blockedList.includes(x.authorId));
  // Someone else's drafts, cancelled or private events are not shown on their profile.
  const hostEvents = events.filter((e) => e.organizerId === authorId && (isMe || isDiscoverable(e)));
  const cell = (width - 32 - 8) / 3;
  // Platform communities that match this person's music: a place to meet them (F09).
  const sharedCommunities = p ? communitiesFor(p.genres) : [];
  const grid = tab === 'saved' ? savedPosts : myPosts;
  const fallbackGrid = !isMe && !isBlocked && p?.gallery ? p.gallery : [];
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
            <T v="caption">{isMe ? ROLE_LABEL[activeWorkspace(user)].toUpperCase() : p!.title.toUpperCase()}</T>
          </View>
        </View>
      </Row>

      <Row style={{ backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: 10, ...shadow(1) }} gap={0}>
        <Stat value={!isMe && p!.kind === 'organizer' ? compact(p!.eventsCount ?? hostEvents.length) : String(authoredPosts.length)} label={!isMe && p!.kind === 'organizer' ? 'Events' : 'Posts'} />
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
        <View style={{ gap: 10 }}>
          {friendState.status === 'incoming' && friendState.request ? (
            <Banner icon="account-plus-outline">
              <View style={{ gap: 8 }}>
                <T v="smallBold" color={colors.brand}>{name} sent you a friend request</T>
                <Row gap={10}>
                  <Button
                    title="Accept"
                    icon="account-check-outline"
                    size="sm"
                    accessibilityLabel={`Accept friend request from ${name}`}
                    onPress={() => {
                      respondFriendRequest(friendState.request!.id, true);
                      toast(`You and ${name} are now friends`);
                    }}
                  />
                  <Button
                    title="Decline"
                    variant="secondary"
                    size="sm"
                    accessibilityLabel={`Decline friend request from ${name}`}
                    onPress={() => {
                      respondFriendRequest(friendState.request!.id, false);
                      toast(`Request from ${name} declined. They are not told.`);
                    }}
                  />
                </Row>
              </View>
            </Banner>
          ) : null}
          <Row gap={8}>
            {canBefriend(p!.id) && friendState.status !== 'incoming' ? (
              <View style={{ flex: 1 }}><FriendButton id={p!.id} size="md" /></View>
            ) : null}
            <View style={{ flex: 1 }}><FollowButton id={p!.id} size="md" /></View>
            <IconButton name="message-text-outline" label={`Message ${name}`} color={colors.brand} bg={colors.brandSoft} size={46} iconSize={22} onPress={() => router.push(`/chat/${ensureConversation(p!.id)}`)} />
          </Row>
        </View>
      )}

      {isMe ? (
        <Row justify="space-between">
          <Shortcut icon="ticket-confirmation-outline" label="Tickets" onPress={() => router.push('/my-bookings?tab=tickets')} />
          <Shortcut icon="basket-outline" label="Bookings" onPress={() => router.push('/my-bookings?tab=musician')} />
          <Shortcut icon="heart-outline" label="Wishlist" onPress={() => router.push('/wishlist')} />
          {isPro(activeWorkspace(user)) ? <Shortcut icon="view-grid-outline" label="Workspace" onPress={() => router.push('/pro/workspace')} /> : <Shortcut icon="check-decagram" label="Go Pro" onPress={() => router.push('/pro-verification')} />}
        </Row>
      ) : null}

      {isMe ? (
        <Row gap={10}>
          <LinkTile
            icon={incomingRequests.length ? 'account-multiple-plus-outline' : 'account-multiple-outline'}
            title="Friends"
            sub={incomingRequests.length ? plural(incomingRequests.length, 'new request') : plural(myFriends.length, 'friend')}
            badge={incomingRequests.length > 0}
            onPress={() => router.push(incomingRequests.length ? '/friends?tab=requests' : '/friends')}
          />
          <LinkTile icon="account-group-outline" title="Communities" sub={joinedCommunities.length ? `${joinedCommunities.length} joined` : 'Find your scene'} onPress={() => router.push('/communities')} />
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
            <T v="body" color={colors.muted} center>
              {tab === 'saved'
                ? 'Posts you save appear here.'
                : isBlocked
                  ? `You blocked ${name}, so their posts are hidden.`
                  : !isMe
                    ? 'No posts yet.'
                    : canPostToFeed(user)
                      ? 'Share your first night out.'
                      : 'Posting photos and videos to the feed is for verified professionals. You can add photos to comments.'}
            </T>
            {tab === 'posts' && isMe ? (
              canPostToFeed(user) ? <Button title="Create post" size="md" onPress={() => router.push('/new-post')} /> : <Button title="Where to share photos" variant="light" size="md" onPress={() => router.push('/new-post')} />
            ) : null}
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
          {p.bio ? <T v="body">{p.bio}</T> : null}
          {p.genres.length ? <T v="small">Music: {p.genres.join(', ')}</T> : null}
          <T v="small">Based in {p.city}</T>
          {sharedCommunities.length ? (
            <View style={{ gap: 8 }}>
              <T v="label">Communities for this music</T>
              <Row gap={8} style={{ flexWrap: 'wrap' }}>
                {sharedCommunities.map((c) => (
                  <Chip
                    key={c.id}
                    label={joinedCommunities.includes(c.id) ? `${c.name} · joined` : c.name}
                    icon="account-group-outline"
                    accessibilityLabel={`Open the ${c.name} community`}
                    onPress={() => router.push(`/community/${c.id}`)}
                  />
                ))}
              </Row>
            </View>
          ) : null}
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
            ...(friendState.status === 'friends'
              ? [{ label: 'Remove friend', icon: 'account-minus-outline' as const, destructive: true, onPress: () => { removeFriend(p.id); toast(`${name} is no longer your friend`); } }]
              : []),
            reportedProfile
              ? { label: 'Reported', sub: 'Our team is reviewing this profile', icon: 'flag-outline', disabled: true, onPress: () => {} }
              : { label: 'Report profile', icon: 'flag-outline', destructive: true, onPress: () => setReporting(true) },
          ]}
        />
      ) : null}
      {p ? (
        <ReasonSheet
          visible={reporting}
          title={`Report ${name}`}
          body="Tell us what is wrong with this profile. They are not told who reported them. To stop contact right away, block them as well."
          reasons={['Fake account or impersonation', ...REPORT_REASONS]}
          confirmLabel="Send report"
          destructive
          notePlaceholder="Add details (optional)"
          onSubmit={(reason, note) => {
            reportContent('profile', p.id, reason, note || undefined);
            toast('Thanks. Our team will review this profile.');
          }}
          onClose={() => setReporting(false)}
        />
      ) : null}
    </Screen>
  );
}
