import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, type ReactNode, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActionSheet } from '../components/ActionSheet';
import { goBack, Screen, ScreenHeader } from '../components/layout';
import { FriendButton } from '../components/PostCard';
import { Avatar, Button, Card, Divider, EmptyState, Field, IconButton, Row, Segmented, T } from '../components/ui';
import { communities, profileById, profiles } from '../data/mock';
import type { FriendRequest, Profile } from '../data/types';
import { ago, plural } from '../lib/format';
import { canBefriend, useFriendProfiles, useFriendRequests } from '../store/social';
import { toast } from '../store/toast';
import { useApp } from '../store/useApp';
import { colors } from '../theme';

type Tab = 'friends' | 'requests';

const matches = (p: Profile, q: string) => {
  const needle = q.trim().toLowerCase();
  return !needle || [p.name, p.handle, p.title].some((v) => v.toLowerCase().includes(needle));
};

/** A person row: avatar and name open the profile; actions go on the right. */
function PersonLine({ p, sub, right }: { p: Profile; sub: string; right?: ReactNode }) {
  return (
    <Row gap={12} style={{ paddingVertical: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${p.name}, ${sub}. Open profile`}
        onPress={() => router.push(`/profile/${p.id}`)}
        style={{ flexDirection: 'row', flex: 1, alignItems: 'center', gap: 12, minHeight: 48 }}
      >
        <Avatar src={p.avatar} size={48} label={p.name} verified={p.verified} />
        <View style={{ flex: 1 }}>
          <T v="bodyBold" numberOfLines={1}>{p.name}</T>
          <T v="small" numberOfLines={1}>{sub}</T>
        </View>
      </Pressable>
      {right}
    </Row>
  );
}

function RequestRow({ r, incoming }: { r: FriendRequest; incoming: boolean }) {
  const respond = useApp((s) => s.respondFriendRequest);
  const cancel = useApp((s) => s.cancelFriendRequest);
  const p = profileById(incoming ? r.fromId : r.toId);
  if (!p) return null;
  const when = r.at ? ago(r.at) : '';
  return (
    <View style={{ gap: 8, paddingVertical: 6 }}>
      <PersonLine p={p} sub={incoming ? `Wants to be friends${when ? ` · ${when}` : ''}` : `Request sent${when ? ` ${when}` : ''}`} />
      {incoming ? (
        <Row gap={10} style={{ paddingLeft: 60 }}>
          <Button
            title="Accept"
            icon="account-check-outline"
            size="sm"
            accessibilityLabel={`Accept friend request from ${p.name}`}
            onPress={() => {
              respond(r.id, true);
              toast(`You and ${p.name} are now friends`);
            }}
          />
          <Button
            title="Decline"
            variant="secondary"
            size="sm"
            accessibilityLabel={`Decline friend request from ${p.name}`}
            onPress={() => {
              respond(r.id, false);
              toast(`Request from ${p.name} declined. They are not told.`);
            }}
          />
        </Row>
      ) : (
        <Row gap={10} style={{ paddingLeft: 60 }}>
          <Button
            title="Cancel request"
            variant="secondary"
            size="sm"
            accessibilityLabel={`Cancel friend request to ${p.name}`}
            onPress={() => {
              cancel(r.id);
              toast('Friend request cancelled');
            }}
          />
        </Row>
      )}
    </View>
  );
}

export default function Friends() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'requests' ? 'requests' : 'friends');
  // A new ?tab= (e.g. from a notification while this screen is open) switches the tab.
  const [lastParam, setLastParam] = useState(params.tab);
  if (params.tab !== lastParam) {
    setLastParam(params.tab);
    if (params.tab) setTab(params.tab === 'requests' ? 'requests' : 'friends');
  }
  const [q, setQ] = useState('');
  const [menuFor, setMenuFor] = useState<Profile>();
  const user = useApp((s) => s.user);
  const friendIds = useApp((s) => s.friends);
  const blocked = useApp((s) => s.blocked);
  const friendRequests = useApp((s) => s.friendRequests);
  const following = useApp((s) => s.following);
  const joinedCommunities = useApp((s) => s.joinedCommunities);
  const ensureConversation = useApp((s) => s.ensureConversation);
  const removeFriend = useApp((s) => s.removeFriend);
  const toggleBlock = useApp((s) => s.toggleBlock);
  const toggleFollow = useApp((s) => s.toggleFollow);
  const friends = useFriendProfiles();
  const { incoming, sent } = useFriendRequests();

  const shown = useMemo(() => friends.filter((p) => matches(p, q)), [friends, q]);

  // People you could add: not friends, no open request either way, not blocked, not a venue.
  const addable = useMemo(() => {
    const pending = new Set(friendRequests.filter((r) => r.status === 'pending').flatMap((r) => [r.fromId, r.toId]));
    return profiles.filter((p) => canBefriend(p.id) && !friendIds.includes(p.id) && !blocked.includes(p.id) && !pending.has(p.id));
  }, [friendRequests, friendIds, blocked]);

  // Search results beyond your friends ("Find another member").
  const found = useMemo(() => (q.trim() ? addable.filter((p) => matches(p, q)).slice(0, 8) : []), [addable, q]);

  // Suggestions: members who share your music or the music of the communities you joined.
  const suggestions = useMemo(() => {
    const myGenres = new Set(user.genres.map((g) => g.toLowerCase()));
    const joinedGenres = new Set(communities.filter((c) => joinedCommunities.includes(c.id)).flatMap((c) => c.genres.map((g) => g.toLowerCase())));
    return addable.filter((p) => p.kind === 'fan' && p.genres.some((g) => myGenres.has(g.toLowerCase()) || joinedGenres.has(g.toLowerCase()))).slice(0, 5);
  }, [addable, user.genres, joinedCommunities]);

  const message = (p: Profile) => router.push(`/chat/${ensureConversation(p.id)}`);

  return (
    <Screen header={<ScreenHeader title="Friends" subtitle={plural(friends.length, 'friend')} onBack={() => goBack('/(tabs)')} />} keyboard>
      <Segmented
        options={[
          { key: 'friends', label: `Friends (${friends.length})` },
          { key: 'requests', label: incoming.length ? `Requests (${incoming.length})` : 'Requests' },
        ]}
        value={tab}
        onChange={(k) => {
          setTab(k);
          setQ('');
        }}
      />

      {tab === 'friends' ? (
        <>
          <Field placeholder="Search friends or find people" accessibilityLabel="Search friends or find people" value={q} onChangeText={setQ} icon="magnify" autoCorrect={false} returnKeyType="search" />

          {shown.length ? (
            <Card style={{ paddingVertical: 8 }}>
              {shown.map((p, i) => (
                <Fragment key={p.id}>
                  {i > 0 ? <Divider style={{ marginVertical: 4 }} /> : null}
                  <PersonLine
                    p={p}
                    sub={`${p.handle} · ${p.title}`}
                    right={
                      <Row gap={2}>
                        <Button title="Message" variant="light" size="sm" accessibilityLabel={`Message ${p.name}`} onPress={() => message(p)} />
                        <IconButton name="dots-vertical" label={`More options for ${p.name}`} size={40} onPress={() => setMenuFor(p)} />
                      </Row>
                    }
                  />
                </Fragment>
              ))}
            </Card>
          ) : q.trim() ? (
            !found.length ? <EmptyState icon="magnify-close" title="No one found" body={`No friend or member matches “${q.trim()}”.`} action="Clear search" onAction={() => setQ('')} /> : null
          ) : (
            <EmptyState
              icon="account-multiple-outline"
              title="No friends yet"
              body="Add people you meet in communities and at events. Friends can message you and plan nights out together."
              action="Explore communities"
              onAction={() => router.push('/communities')}
            />
          )}

          {found.length ? (
            <View style={{ gap: 10 }}>
              <T v="h3">People on Domtak</T>
              <Card style={{ paddingVertical: 8 }}>
                {found.map((p, i) => (
                  <Fragment key={p.id}>
                    {i > 0 ? <Divider style={{ marginVertical: 4 }} /> : null}
                    <PersonLine p={p} sub={`${p.handle} · ${p.title}`} right={<FriendButton id={p.id} />} />
                  </Fragment>
                ))}
              </Card>
            </View>
          ) : null}

          {!q.trim() && suggestions.length ? (
            <View style={{ gap: 10 }}>
              <T v="h3">People you may know</T>
              <T v="small">Members who like the same music as you or the communities you joined.</T>
              <Card style={{ paddingVertical: 8 }}>
                {suggestions.map((p, i) => (
                  <Fragment key={p.id}>
                    {i > 0 ? <Divider style={{ marginVertical: 4 }} /> : null}
                    <PersonLine p={p} sub={`${p.handle} · likes ${p.genres.join(', ')}`} right={<FriendButton id={p.id} />} />
                  </Fragment>
                ))}
              </Card>
            </View>
          ) : null}
        </>
      ) : (
        <>
          <View style={{ gap: 10 }}>
            <T v="h3">Received{incoming.length ? ` (${incoming.length})` : ''}</T>
            {incoming.length ? (
              <Card style={{ paddingVertical: 8 }}>
                {incoming.map((r, i) => (
                  <Fragment key={r.id}>
                    {i > 0 ? <Divider style={{ marginVertical: 4 }} /> : null}
                    <RequestRow r={r} incoming />
                  </Fragment>
                ))}
              </Card>
            ) : (
              <T v="body" color={colors.muted}>No friend requests waiting for you.</T>
            )}
          </View>
          <View style={{ gap: 10 }}>
            <T v="h3">Sent{sent.length ? ` (${sent.length})` : ''}</T>
            {sent.length ? (
              <Card style={{ paddingVertical: 8 }}>
                {sent.map((r, i) => (
                  <Fragment key={r.id}>
                    {i > 0 ? <Divider style={{ marginVertical: 4 }} /> : null}
                    <RequestRow r={r} incoming={false} />
                  </Fragment>
                ))}
              </Card>
            ) : (
              <View style={{ gap: 10, alignItems: 'flex-start' }}>
                <T v="body" color={colors.muted}>You have no requests waiting for an answer.</T>
                <Button title="Find people" variant="light" size="sm" icon="account-search-outline" onPress={() => setTab('friends')} />
              </View>
            )}
          </View>
        </>
      )}

      <ActionSheet
        visible={!!menuFor}
        title={menuFor?.name}
        actions={
          menuFor
            ? [
                { label: 'View profile', icon: 'account-outline', onPress: () => router.push(`/profile/${menuFor.id}`) },
                { label: `Message ${menuFor.name}`, icon: 'message-text-outline', onPress: () => message(menuFor) },
                {
                  label: 'Remove friend',
                  icon: 'account-minus-outline',
                  destructive: true,
                  onPress: () => {
                    removeFriend(menuFor.id);
                    toast(`${menuFor.name} is no longer your friend`);
                  },
                },
                {
                  label: `Block ${menuFor.name}`,
                  sub: 'Ends the friendship. They can’t message you or send requests.',
                  icon: 'account-cancel-outline',
                  destructive: true,
                  onPress: () => {
                    if (following[menuFor.id]) toggleFollow(menuFor.id);
                    toggleBlock(menuFor.id);
                    toast(`${menuFor.name} is blocked`);
                  },
                },
              ]
            : []
        }
        onClose={() => setMenuFor(undefined)}
      />
    </Screen>
  );
}
