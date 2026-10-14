import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { FollowButton } from '../components/cards';
import { Screen, ScreenHeader } from '../components/layout';
import { Avatar, Icon, type IconName, Photo, Row, T } from '../components/ui';
import { notifications, profileById } from '../data/mock';
import type { AppNotification } from '../data/types';
import { useApp } from '../store/useApp';
import { colors, shadow } from '../theme';

const TYPE_ICON: Record<AppNotification['type'], IconName> = {
  follow: 'account-plus-outline',
  comment: 'comment-outline',
  reshare: 'share-variant-outline',
  like: 'heart-outline',
  booking: 'calendar-clock',
  ticket: 'ticket-confirmation-outline',
  event: 'party-popper',
};

export default function Notifications() {
  const markRead = useApp((s) => s.markNotificationsRead);
  useFocusEffect(useCallback(() => markRead(), [markRead]));
  const sections: AppNotification['section'][] = ['Today', 'This week', 'Earlier'];

  return (
    <Screen header={<ScreenHeader title="Notifications" />}>
      {sections.map((sec) => {
        const list = notifications.filter((n) => n.section === sec);
        if (!list.length) return null;
        return (
          <View key={sec} style={{ gap: 10 }}>
            <T v="smallBold" color={colors.muted}>{sec}</T>
            {list.map((n) => {
              const actor = profileById(n.actorId);
              return (
                <Pressable
                  key={n.id}
                  accessibilityRole="button"
                  onPress={() => (n.href ? router.push(n.href as never) : actor && router.push(`/profile/${actor.id}`))}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: colors.surface, ...shadow(1) }}
                >
                  <View>
                    <Avatar src={actor?.avatar} size={46} label={actor?.name} />
                    <View style={{ position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={TYPE_ICON[n.type]} size={12} color={colors.white} />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="body" numberOfLines={3}><T v="bodyBold">{actor?.name} </T>{n.text}</T>
                    <T v="small" style={{ fontSize: 12 }}>{n.time}</T>
                  </View>
                  {n.type === 'follow' && actor ? <FollowButton id={actor.id} /> : n.thumb ? <Photo src={n.thumb} style={{ width: 52, height: 52 }} radius={10} /> : null}
                </Pressable>
              );
            })}
          </View>
        );
      })}
      <Row justify="center"><T v="small">You’re all caught up</T></Row>
    </Screen>
  );
}
