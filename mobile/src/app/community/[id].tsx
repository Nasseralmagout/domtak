import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useMemo, useState } from 'react';
import { ScrollView, Share, View } from 'react-native';

import { ActionSheet } from '../../components/ActionSheet';
import { EventRow, FollowButton, PersonRow } from '../../components/cards';
import { goBack, Screen, ScreenHeader } from '../../components/layout';
import { FriendButton, PostCard } from '../../components/PostCard';
import { Avatar, Button, Card, Divider, EmptyState, Icon, IconButton, Photo, Pill, Row, Segmented, T } from '../../components/ui';
import { communityById } from '../../data/mock';
import { compact, plural } from '../../lib/format';
import { isDiscoverable, isUpcoming } from '../../store/filters';
import { communityMembers, memberCount } from '../../store/social';
import { toast } from '../../store/toast';
import { canPostToFeed, useAllEvents, useApp, useFeedPosts } from '../../store/useApp';
import { colors, radius } from '../../theme';

type Tab = 'posts' | 'events' | 'members' | 'about';
const MEMBER_PREVIEW = 12;

export default function CommunityScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const community = communityById(id);
  const joinedIds = useApp((s) => s.joinedCommunities);
  const toggleCommunity = useApp((s) => s.toggleCommunity);
  const friends = useApp((s) => s.friends);
  const blocked = useApp((s) => s.blocked);
  const user = useApp((s) => s.user);
  const posts = useFeedPosts();
  const events = useAllEvents();
  const [tab, setTab] = useState<Tab>('posts');
  const [menu, setMenu] = useState(false);

  const communityPosts = useMemo(() => (community ? posts.filter((p) => community.postIds.includes(p.id) && !blocked.includes(p.authorId)) : []), [community, posts, blocked]);
  const upcoming = useMemo(
    () => (community ? events.filter((e) => community.eventIds.includes(e.id) && isDiscoverable(e) && isUpcoming(e)).sort((a, b) => a.start.localeCompare(b.start)) : []),
    [community, events],
  );
  const members = useMemo(() => (community ? communityMembers(community, { friends, blocked }) : []), [community, friends, blocked]);

  if (!community) {
    return (
      <Screen header={<ScreenHeader title="Community" onBack={() => goBack('/communities')} />}>
        <EmptyState icon="account-group-outline" title="Community not found" body="This community may have been closed, or the link is no longer valid." action="All communities" onAction={() => router.replace('/communities')} />
      </Screen>
    );
  }

  const joined = joinedIds.includes(community.id);
  const total = memberCount(community, joined);
  const friendsHere = members.filter((m) => friends.includes(m.id));
  const share = () => {
    Share.share({ message: `Join ${community.name} on Domtak: https://domtak.de/c/${community.id}` }).catch(() => toast('Could not open the share sheet'));
  };
  const join = () => {
    toggleCommunity(community.id);
    toast(`You joined ${community.name}`);
  };

  const pad = { paddingHorizontal: 16 };

  return (
    <Screen
      scroll={false}
      header={
        <ScreenHeader
          title={community.name}
          subtitle={`${compact(total)} members`}
          onBack={() => goBack('/communities')}
          right={<IconButton name="share-variant-outline" label={`Share ${community.name}`} onPress={share} />}
        />
      }
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Photo src={community.cover} style={{ height: 180 }} accessibilityLabel={community.name} />
        <View style={[pad, { paddingTop: 16, gap: 10 }]}>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            <Pill label="By Domtak" icon="shield-check-outline" />
            {community.genres.map((g) => <Pill key={g} label={g} tone="neutral" />)}
          </Row>
          <T v="h2" color={colors.brandDeep}>{community.name}</T>
          <Row gap={6}>
            <Icon name="account-group-outline" size={16} color={colors.muted} />
            <T v="small">
              {compact(total)} members
              {friendsHere.length ? ` · ${friendsHere.length === 1 ? `${friendsHere[0].name} is here` : `${friendsHere[0].name} and ${plural(friendsHere.length - 1, 'other friend')}`}` : ''}
            </T>
          </Row>
          <T v="body">{community.description}</T>
          <Row gap={10}>
            {joined ? (
              <Button title="Joined" icon="check" variant="secondary" size="md" style={{ flex: 1 }} accessibilityLabel={`Joined ${community.name}. Options`} onPress={() => setMenu(true)} />
            ) : (
              <Button title="Join community" icon="account-multiple-plus-outline" size="md" style={{ flex: 1 }} onPress={join} />
            )}
            <Button title="Invite" icon="share-variant-outline" variant="light" size="md" accessibilityLabel={`Invite friends to ${community.name}`} onPress={share} />
          </Row>
          {friendsHere.length ? (
            <View accessible accessibilityLabel={`Friends in this community: ${friendsHere.map((f) => f.name).join(', ')}`} style={{ flexDirection: 'row' }}>
              {friendsHere.slice(0, 5).map((f, i) => (
                <View key={f.id} style={{ marginLeft: i ? -8 : 0 }}>
                  <Avatar src={f.avatar} size={30} label={f.name} />
                </View>
              ))}
            </View>
          ) : null}
          <View style={{ marginTop: 6 }}>
            <Segmented
              options={[
                { key: 'posts', label: 'Posts' },
                { key: 'events', label: 'Events' },
                { key: 'members', label: 'Members' },
                { key: 'about', label: 'About' },
              ]}
              value={tab}
              onChange={setTab}
            />
          </View>
        </View>

        {tab === 'posts' ? (
          <View style={{ paddingTop: 14 }}>
            <View style={[pad, { marginBottom: 12 }]}>
              <T v="small">
                {canPostToFeed(user)
                  ? 'Posts from verified professionals. Everyone can comment, like and share.'
                  : 'Verified artists, venues and organizers post here. Members comment (with photos), like and share.'}
              </T>
            </View>
            {communityPosts.length ? (
              communityPosts.map((p) => <PostCard key={p.id} post={p} />)
            ) : (
              <EmptyState icon="image-off-outline" title="No posts yet" body="Posts from artists, venues and organizers in this community will show up here." action="See upcoming events" onAction={() => setTab('events')} />
            )}
          </View>
        ) : null}

        {tab === 'events' ? (
          <View style={[pad, { paddingTop: 14, gap: 10 }]}>
            {upcoming.length ? (
              <>
                <T v="small">{plural(upcoming.length, 'upcoming event')} picked for {community.name}</T>
                {upcoming.map((e) => <EventRow key={e.id} event={e} />)}
              </>
            ) : (
              <EmptyState icon="calendar-remove-outline" title="No upcoming events" body="There are no upcoming events in this community right now. Browse all events in Berlin instead." action="Browse events" onAction={() => router.push('/(tabs)/events')} />
            )}
          </View>
        ) : null}

        {tab === 'members' ? (
          <View style={[pad, { paddingTop: 14, gap: 10 }]}>
            <T v="small">
              {compact(total)} members. Showing {Math.min(members.length, MEMBER_PREVIEW) + (joined ? 1 : 0)} people who share this music{friendsHere.length ? ', your friends first' : ''}. Add friends to plan nights out together.
            </T>
            <Card style={{ paddingVertical: 8 }}>
              {joined ? (
                <Row gap={12} style={{ paddingVertical: 6 }}>
                  <Avatar src={user.avatar} size={48} label={user.name} />
                  <View style={{ flex: 1 }}>
                    <T v="bodyBold" numberOfLines={1}>{user.name}</T>
                    <T v="small" numberOfLines={1}>{user.handle}</T>
                  </View>
                  <Pill label="You" tone="brand" />
                </Row>
              ) : null}
              {members.slice(0, MEMBER_PREVIEW).map((m, i) => (
                <Fragment key={m.id}>
                  {i > 0 || joined ? <Divider style={{ marginVertical: 4 }} /> : null}
                  <PersonRow
                    id={m.id}
                    subtitle={friends.includes(m.id) ? `Friend · ${m.title}` : `${m.handle} · ${m.title}`}
                    right={m.kind === 'fan' ? <FriendButton id={m.id} /> : <FollowButton id={m.id} />}
                  />
                </Fragment>
              ))}
            </Card>
            {!members.length && !joined ? <T v="small" center>No members to show yet.</T> : null}
          </View>
        ) : null}

        {tab === 'about' ? (
          <View style={[pad, { paddingTop: 14, gap: 14 }]}>
            {community.rules?.length ? (
              <Card style={{ gap: 8 }}>
                <T v="title">Community rules</T>
                {community.rules.map((r, i) => (
                  <Row key={r} gap={10} align="flex-start">
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <T v="smallBold" color={colors.brand}>{i + 1}</T>
                    </View>
                    <T v="body" style={{ flex: 1 }}>{r}</T>
                  </Row>
                ))}
              </Card>
            ) : null}
            <View style={{ gap: 10, padding: 16, borderRadius: radius.lg, backgroundColor: colors.brandTint }}>
              <T v="title">How communities work</T>
              {[
                { icon: 'shield-check-outline' as const, text: 'Domtak creates and moderates every community.' },
                { icon: 'comment-outline' as const, text: 'Members comment, add photos to comments, like and share.' },
                { icon: 'flag-outline' as const, text: 'Use Report on a post or comment that breaks the rules. Our team reviews it.' },
                { icon: 'account-multiple-plus-outline' as const, text: 'Meet people here, add them as friends and plan events together.' },
              ].map((row) => (
                <Row key={row.text} gap={10} align="flex-start">
                  <Icon name={row.icon} size={20} color={colors.brand} />
                  <T v="small" color={colors.inkSoft} style={{ flex: 1 }}>{row.text}</T>
                </Row>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <ActionSheet
        visible={menu}
        title={community.name}
        actions={[
          { label: 'Invite friends', icon: 'share-variant-outline', onPress: share },
          {
            label: `Leave ${community.name}`,
            sub: 'You can join again any time.',
            icon: 'logout',
            destructive: true,
            onPress: () => {
              toggleCommunity(community.id);
              toast(`You left ${community.name}`);
            },
          },
        ]}
        onClose={() => setMenu(false)}
      />
    </Screen>
  );
}
