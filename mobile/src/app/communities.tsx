import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActionSheet } from '../components/ActionSheet';
import { goBack, Screen, ScreenHeader } from '../components/layout';
import { Banner, Button, EmptyState, Field, Icon, Photo, Pill, Row, T } from '../components/ui';
import type { Community } from '../data/types';
import { compact } from '../lib/format';
import { memberCount, useCommunities } from '../store/social';
import { toast } from '../store/toast';
import { useApp } from '../store/useApp';
import { colors, radius, shadow } from '../theme';

const matches = (c: Community, q: string) => {
  const needle = q.trim().toLowerCase();
  return !needle || [c.name, c.description, ...c.genres].some((v) => v.toLowerCase().includes(needle));
};

function CommunityCard({ c, joined, onLeave }: { c: Community; joined: boolean; onLeave: (c: Community) => void }) {
  const toggleCommunity = useApp((s) => s.toggleCommunity);
  const members = compact(memberCount(c, joined));
  const join = () => {
    toggleCommunity(c.id);
    toast(`You joined ${c.name}`);
  };
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', ...shadow(1) }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${c.name}, ${members} members${joined ? ', joined' : ''}`} onPress={() => router.push(`/community/${c.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
        <Photo src={c.cover} style={{ height: 116 }} accessibilityLabel={c.name} />
        {joined ? (
          <View style={{ position: 'absolute', top: 10, left: 10 }}>
            <Pill label="Joined" tone="success" icon="check" />
          </View>
        ) : null}
        <View style={{ padding: 14, paddingBottom: 8, gap: 4 }}>
          <T v="title">{c.name}</T>
          <Row gap={6}>
            <Icon name="account-group-outline" size={15} color={colors.muted} />
            <T v="small">{members} members · {c.genres.join(', ')}</T>
          </Row>
          <T v="small" numberOfLines={2} color={colors.inkSoft}>{c.description}</T>
        </View>
      </Pressable>
      <Row gap={10} style={{ paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 }}>
        {joined ? (
          <Button title="Joined" icon="check" variant="secondary" size="sm" accessibilityLabel={`Joined ${c.name}. Options`} onPress={() => onLeave(c)} />
        ) : (
          <Button title="Join" icon="account-multiple-plus-outline" size="sm" accessibilityLabel={`Join ${c.name}`} onPress={join} />
        )}
        <Button title="View" variant="ghost" size="sm" accessibilityLabel={`View ${c.name}`} onPress={() => router.push(`/community/${c.id}`)} />
      </Row>
    </View>
  );
}

export default function Communities() {
  const { joined, others } = useCommunities();
  const toggleCommunity = useApp((s) => s.toggleCommunity);
  const [q, setQ] = useState('');
  const [leaving, setLeaving] = useState<Community>();

  const mine = useMemo(() => joined.filter((c) => matches(c, q)), [joined, q]);
  const rest = useMemo(() => others.filter((c) => matches(c, q)), [others, q]);
  const searching = !!q.trim();

  return (
    <Screen header={<ScreenHeader title="Communities" subtitle="Music communities on Domtak" onBack={() => goBack('/(tabs)')} />} keyboard>
      <Banner icon="shield-check-outline">
        Domtak creates and moderates these communities. Join one to follow its posts and events, and to comment, like and share with other members.
      </Banner>
      <Field placeholder="Search communities or genres" accessibilityLabel="Search communities" value={q} onChangeText={setQ} icon="magnify" autoCorrect={false} returnKeyType="search" />

      {searching && !mine.length && !rest.length ? (
        <EmptyState icon="magnify-close" title="No communities found" body={`No community matches “${q.trim()}”. Try a genre like Techno, Jazz or Indie.`} action="Clear search" onAction={() => setQ('')} />
      ) : null}

      {!searching || mine.length ? (
        <View style={{ gap: 12 }}>
          <T v="h3">Your communities{joined.length ? ` (${joined.length})` : ''}</T>
          {mine.length ? (
            mine.map((c) => <CommunityCard key={c.id} c={c} joined onLeave={setLeaving} />)
          ) : (
            <View style={{ padding: 16, borderRadius: radius.lg, backgroundColor: colors.brandTint, gap: 4 }}>
              <T v="bodyBold">You haven’t joined a community yet</T>
              <T v="small">Join one below to see its posts and events here first.</T>
            </View>
          )}
        </View>
      ) : null}

      {rest.length ? (
        <View style={{ gap: 12 }}>
          <T v="h3">Discover communities</T>
          {rest.map((c) => <CommunityCard key={c.id} c={c} joined={false} onLeave={setLeaving} />)}
        </View>
      ) : !searching ? (
        <T v="small" center>You’ve joined every community on Domtak.</T>
      ) : null}

      <ActionSheet
        visible={!!leaving}
        title={leaving ? leaving.name : undefined}
        actions={
          leaving
            ? [
                { label: 'Open community', icon: 'account-group-outline', onPress: () => router.push(`/community/${leaving.id}`) },
                {
                  label: `Leave ${leaving.name}`,
                  sub: 'Its posts and events stop showing first for you. You can join again any time.',
                  icon: 'logout',
                  destructive: true,
                  onPress: () => {
                    toggleCommunity(leaving.id);
                    toast(`You left ${leaving.name}`);
                  },
                },
              ]
            : []
        }
        onClose={() => setLeaving(undefined)}
      />
    </Screen>
  );
}
