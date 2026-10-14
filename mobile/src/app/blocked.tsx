import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { PersonRow } from '../components/cards';
import { Screen, ScreenHeader } from '../components/layout';
import { Avatar, Banner, Button, Card, Divider, EmptyState, Icon, Row, T } from '../components/ui';
import { profileById, venueById } from '../data/mock';
import { useApp } from '../store/useApp';
import { toast } from '../store/toast';
import { colors } from '../theme';

const nameOf = (id: string) => profileById(id)?.name ?? venueById(id)?.name ?? 'This account';

export default function Blocked() {
  const blocked = useApp((s) => s.blocked);
  const toggleBlock = useApp((s) => s.toggleBlock);

  // Newest block first; skip ids that no longer resolve to an account.
  const ids = [...blocked].reverse().filter((id) => profileById(id) || venueById(id));

  const unblock = (id: string) => {
    toggleBlock(id);
    toast(`${nameOf(id)} is unblocked`);
  };

  const unblockButton = (id: string) => (
    <Button title="Unblock" size="sm" variant="secondary" hitSlop={6} accessibilityLabel={`Unblock ${nameOf(id)}`} onPress={() => unblock(id)} />
  );

  return (
    <Screen header={<ScreenHeader title="Blocked users" subtitle={ids.length ? `${ids.length} blocked` : undefined} />}>
      {ids.length ? (
        <>
          <Card style={{ paddingVertical: 8, gap: 0 }}>
            {ids.map((id, i) => {
              const venue = profileById(id) ? undefined : venueById(id);
              return (
                <View key={id}>
                  {i > 0 ? <Divider style={{ marginVertical: 4 }} /> : null}
                  {venue ? (
                    <Row gap={12} style={{ paddingVertical: 6 }}>
                      <Pressable accessibilityRole="button" accessibilityLabel={`${venue.name}, venue in ${venue.area}`} onPress={() => router.push(`/venue/${venue.id}`)} style={{ flexDirection: 'row', flex: 1, alignItems: 'center', gap: 12 }}>
                        <Avatar src={venue.cover} size={48} />
                        <View style={{ flex: 1 }}>
                          <T v="bodyBold" numberOfLines={1}>{venue.name}</T>
                          <T v="small" numberOfLines={1}>Venue · {venue.area}</T>
                        </View>
                      </Pressable>
                      {unblockButton(id)}
                    </Row>
                  ) : (
                    <PersonRow id={id} right={unblockButton(id)} />
                  )}
                </View>
              );
            })}
          </Card>
          <Banner icon="information-outline">Unblocking won’t restore follows you removed. They won’t be told that you unblocked them.</Banner>
        </>
      ) : (
        <EmptyState
          icon="account-cancel-outline"
          title="No blocked users"
          body="Blocked people can’t message you, see your posts and stories, or comment on your events. They’re not notified when you block them."
          action="Find people"
          onAction={() => router.push('/search')}
        />
      )}

      <View style={{ gap: 10 }}>
        <T v="h3">How blocking works</T>
        <Card style={{ gap: 12 }}>
          {[
            { icon: 'message-off-outline' as const, text: 'They can’t message you, and your chat with them leaves your inbox.' },
            { icon: 'eye-off-outline' as const, text: 'Their notifications, reviews and follows are hidden from you, and you stop following them.' },
            { icon: 'bell-off-outline' as const, text: 'They aren’t notified. Block or unblock anytime from their profile.' },
          ].map((r) => (
            <Row key={r.icon} gap={12} align="flex-start">
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={r.icon} size={18} color={colors.brand} />
              </View>
              <T v="body" style={{ flex: 1, paddingTop: 6 }}>{r.text}</T>
            </Row>
          ))}
        </Card>
        <Button title="Help with blocking & reporting" variant="ghost" size="md" icon="shield-account-outline" onPress={() => router.push('/help?section=safety')} />
      </View>
    </Screen>
  );
}
