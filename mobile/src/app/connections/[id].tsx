import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useState } from 'react';
import { Pressable, Share, View } from 'react-native';

import { FollowButton, PersonRow } from '../../components/cards';
import { Screen, ScreenHeader, goBack } from '../../components/layout';
import { Avatar, Card, Divider, EmptyState, Field, Icon, Pill, Row, Segmented, T } from '../../components/ui';
import type { ImgKey } from '../../data/images';
import { followersOf, followingOf, profileById, venueById } from '../../data/mock';
import { compact, plural } from '../../lib/format';
import { useFriendProfiles, useFriendRequests } from '../../store/social';
import { useApp } from '../../store/useApp';
import { colors, radius, shadow } from '../../theme';

type Tab = 'followers' | 'following';

const matches = (q: string, ...values: string[]) => {
  const needle = q.trim().toLowerCase();
  return !needle || values.some((v) => v.toLowerCase().includes(needle));
};

function MeRow({ name, handle, avatar }: { name: string; handle: string; avatar?: ImgKey }) {
  return (
    <Row gap={12} style={{ paddingVertical: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}, that’s you. Open your profile`}
        onPress={() => router.push('/profile/me')}
        style={{ flexDirection: 'row', flex: 1, alignItems: 'center', gap: 12, minHeight: 48 }}
      >
        <Avatar src={avatar} size={48} label={name} />
        <View style={{ flex: 1 }}>
          <T v="bodyBold" numberOfLines={1}>{name}</T>
          <T v="small" numberOfLines={1}>{handle}</T>
        </View>
      </Pressable>
      <Pill label="You" tone="brand" />
    </Row>
  );
}

function VenueRow({ id }: { id: string }) {
  const v = venueById(id);
  if (!v) return null;
  return (
    <Row gap={12} style={{ paddingVertical: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${v.name}, venue in ${v.area}`}
        onPress={() => router.push(`/venue/${v.id}`)}
        style={{ flexDirection: 'row', flex: 1, alignItems: 'center', gap: 12, minHeight: 48 }}
      >
        <Avatar src={v.cover} size={48} label={v.name} />
        <View style={{ flex: 1 }}>
          <T v="bodyBold" numberOfLines={1}>{v.name}</T>
          <T v="small" numberOfLines={1}>{v.type} · {v.area}</T>
        </View>
      </Pressable>
      <FollowButton id={v.id} />
    </Row>
  );
}

export default function Connections() {
  const { id = '', tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const isMe = id === 'me';
  const user = useApp((s) => s.user);
  const followingMap = useApp((s) => s.following);
  const blocked = useApp((s) => s.blocked);
  const [tab, setTab] = useState<Tab>(initialTab === 'following' ? 'following' : 'followers');
  const [q, setQ] = useState('');
  // Keep people you unfollow from this screen in the list until you leave, so the row does not jump away.
  const [seenFollowing] = useState(() => Object.keys(useApp.getState().following));
  const myFriends = useFriendProfiles();
  const { incoming } = useFriendRequests();

  const profile = isMe ? undefined : profileById(id);
  const venue = isMe || profile ? undefined : venueById(id);

  if (!isMe && !profile && !venue) {
    return (
      <Screen header={<ScreenHeader title="Connections" />}>
        <EmptyState icon="account-question-outline" title="Profile not found" body="This account may have been removed or the link is broken." action="Go back" onAction={() => goBack('/')} />
      </Screen>
    );
  }

  const name = isMe ? user.name : profile ? profile.name : venue!.name;
  const subtitle = isMe ? user.handle : profile ? profile.handle : `${venue!.area}, ${venue!.city}`;
  const iFollowSubject = !isMe && !!followingMap[id];
  const subjectFollowsMe = !isMe && followersOf('me').some((p) => p.id === id);
  const visible = (pid: string) => !blocked.includes(pid);
  const resolvable = (pid: string) => !!profileById(pid) || !!venueById(pid);

  // Followers: sample accounts, plus you when you follow this profile.
  const followerIds = [
    ...(iFollowSubject ? ['me'] : []),
    ...followersOf(isMe ? 'me' : id).map((p) => p.id),
  ].filter(visible);

  // Following: for you, everyone in your follow list (venues included); for others, their sample list.
  const currentFollowing = Object.keys(followingMap).filter(resolvable);
  const followingIds = isMe
    ? [...seenFollowing.filter(resolvable), ...currentFollowing.filter((x) => !seenFollowing.includes(x))].filter(visible)
    : [...(subjectFollowsMe ? ['me'] : []), ...followingOf(id).map((p) => p.id)].filter(visible);

  const followerTotal = isMe ? followerIds.length : (profile ? profile.followers : venue!.followers) + (iFollowSubject ? 1 : 0);
  const followingTotal = isMe ? currentFollowing.filter(visible).length : profile ? profile.following : followingIds.length;

  const ids = tab === 'followers' ? followerIds : followingIds;
  const list = ids.filter((pid) => {
    if (pid === 'me') return matches(q, user.name, user.handle);
    const p = profileById(pid);
    if (p) return matches(q, p.name, p.handle, p.title);
    const v = venueById(pid);
    return v ? matches(q, v.name, v.area) : false;
  });

  const renderRow = (pid: string) => {
    if (pid === 'me') return <MeRow name={user.name} handle={user.handle} avatar={user.avatar} />;
    const p = profileById(pid);
    if (p) return <PersonRow id={p.id} subtitle={`${p.handle} · ${p.title}`} right={<FollowButton id={p.id} />} />;
    return <VenueRow id={pid} />;
  };

  const emptyTitle = tab === 'followers' ? (isMe ? 'No followers yet' : `${name} has no followers yet`) : isMe ? 'You’re not following anyone' : `${name} isn’t following anyone yet`;
  const emptyBody =
    tab === 'followers'
      ? isMe
        ? 'Share your profile so friends can find you and follow your nights out.'
        : 'Be the first to follow and get their posts and events in your feed.'
      : isMe
        ? 'Follow artists, venues and friends to see their posts and gigs first.'
        : 'Accounts they follow will show up here.';

  return (
    <Screen header={<ScreenHeader title={name} subtitle={subtitle} />} keyboard>
      {isMe ? (
        // Friends (F10) are separate from followers: a mutual connection that can be messaged and invited.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Friends, ${plural(myFriends.length, 'friend')}${incoming.length ? `, ${plural(incoming.length, 'new request')}` : ''}`}
          onPress={() => router.push(incoming.length ? '/friends?tab=requests' : '/friends')}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 14, borderRadius: radius.lg, backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1, ...shadow(1) })}
        >
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="account-multiple-outline" size={20} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <T v="bodyBold">Friends</T>
            <T v="small">{plural(myFriends.length, 'friend')}{incoming.length ? ` · ${plural(incoming.length, 'new request')}` : ''}</T>
          </View>
          {incoming.length ? <Pill label={String(incoming.length)} tone="warning" /> : null}
          <Icon name="chevron-right" size={22} color={colors.subtle} />
        </Pressable>
      ) : null}
      <Segmented
        options={[
          { key: 'followers', label: `${compact(followerTotal)} Followers` },
          { key: 'following', label: `${compact(followingTotal)} Following` },
        ]}
        value={tab}
        onChange={(k) => {
          setTab(k);
          setQ('');
        }}
      />

      {ids.length ? (
        <Field
          placeholder={tab === 'followers' ? 'Search followers' : 'Search following'}
          value={q}
          onChangeText={setQ}
          icon="magnify"
          autoCorrect={false}
          returnKeyType="search"
        />
      ) : null}

      {!ids.length ? (
        <EmptyState
          icon={tab === 'followers' ? 'account-group-outline' : 'account-plus-outline'}
          title={emptyTitle}
          body={emptyBody}
          action={isMe ? (tab === 'followers' ? 'Share my profile' : 'Discover artists') : undefined}
          onAction={
            isMe
              ? tab === 'followers'
                ? () => Share.share({ message: `Follow me on Domtak: ${user.handle}` }).catch(() => {})
                : () => router.push('/artists/all')
              : undefined
          }
        />
      ) : list.length ? (
        <Card style={{ paddingVertical: 8 }}>
          {list.map((pid, i) => (
            <Fragment key={pid}>
              {i > 0 ? <Divider style={{ marginVertical: 4 }} /> : null}
              {renderRow(pid)}
            </Fragment>
          ))}
        </Card>
      ) : (
        <View style={{ alignItems: 'center', gap: 6, paddingVertical: 24 }}>
          <T v="bodyBold" center>No one matches “{q.trim()}”</T>
          <T v="small" center>Try a different name or handle.</T>
        </View>
      )}
    </Screen>
  );
}
