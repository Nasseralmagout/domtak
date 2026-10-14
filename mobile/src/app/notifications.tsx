import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { FollowButton } from '../components/cards';
import { goBack, Screen, ScreenHeader } from '../components/layout';
import { Avatar, Icon, type IconName, Photo, Row, T } from '../components/ui';
import { notifications, profileById, venueById } from '../data/mock';
import type { AppNotification, EventItem, Ticket } from '../data/types';
import { parse, TODAY } from '../lib/format';
import { useAllEvents, useApp } from '../store/useApp';
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

function profileHref(id: string) {
  if (venueById(id)) return `/venue/${id}`;
  const p = profileById(id);
  return p && (p.kind === 'dj' || p.kind === 'musician' || p.kind === 'band') ? `/artist/${id}` : `/profile/${id}`;
}

/** Ticket reminders are about the event with the actor's id; keep their countdown in step with today's date. */
function ticketText(n: AppNotification, event: EventItem | undefined, hasTicket: boolean) {
  if (!event) return n.text;
  const days = Math.round((parse(event.start).getTime() - TODAY.getTime()) / 86_400_000);
  const when = days <= 0 ? 'starts today' : days === 1 ? 'starts tomorrow' : `starts in ${days} days`;
  return `${event.title} ${when}. ${hasTicket ? 'Your ticket is ready.' : 'Get your ticket before it sells out.'}`;
}

/** Where tapping a notification should take you. */
function targetFor(n: AppNotification, tickets: Ticket[], bookingIds: string[]) {
  if (n.type === 'ticket') {
    // "Your ticket is ready" opens the matching e-ticket, or the ticket shop when you have none.
    const t = tickets.find((x) => x.eventId === n.actorId && x.status === 'valid');
    return t ? `/ticket/${t.id}` : `/tickets/${n.actorId}`;
  }
  if (n.href?.startsWith('/booking/')) {
    return bookingIds.includes(n.href.slice('/booking/'.length)) ? n.href : '/my-bookings?tab=musician';
  }
  if (n.href && n.href !== '/tickets') return n.href;
  // Activity on your own posts and comments lives on your profile.
  if (n.type === 'comment' || n.type === 'reshare' || n.type === 'like') return '/profile/me';
  return profileHref(n.actorId);
}

export default function Notifications() {
  const markRead = useApp((s) => s.markNotificationsRead);
  const tickets = useApp((s) => s.tickets);
  const bookings = useApp((s) => s.bookings);
  const blocked = useApp((s) => s.blocked);
  const events = useAllEvents();
  useFocusEffect(useCallback(() => markRead(), [markRead]));
  const sections: AppNotification['section'][] = ['Today', 'This week', 'Earlier'];
  const bookingIds = bookings.map((b) => b.id);
  const visible = notifications.filter((n) => !blocked.includes(n.actorId));

  return (
    <Screen header={<ScreenHeader title="Notifications" onBack={() => goBack('/(tabs)')} />}>
      {sections.map((sec) => {
        const list = visible.filter((n) => n.section === sec);
        if (!list.length) return null;
        return (
          <View key={sec} style={{ gap: 10 }}>
            <T v="smallBold" color={colors.muted} accessibilityRole="header">{sec}</T>
            {list.map((n) => {
              const actor = profileById(n.actorId);
              const ticketEvent = n.type === 'ticket' ? events.find((e) => e.id === n.actorId) : undefined;
              // Ticket reminders read as a sentence on their own, e.g. "Dance world starts in 8 days."
              const text = n.type === 'ticket' ? ticketText(n, ticketEvent, tickets.some((t) => t.eventId === n.actorId && t.status === 'valid')) : n.text;
              const name = n.type === 'ticket' && ticketEvent ? '' : actor?.name;
              return (
                <Pressable
                  key={n.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${name ? `${name} ` : ''}${text}, ${n.time} ago`}
                  onPress={() => router.push(targetFor(n, tickets, bookingIds) as never)}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: colors.surface, opacity: pressed ? 0.9 : 1, ...shadow(1) })}
                >
                  <Pressable accessibilityRole="button" accessibilityLabel={`Open ${actor?.name ?? 'profile'}`} onPress={() => router.push(profileHref(n.actorId) as never)}>
                    <Avatar src={actor?.avatar} size={46} label={actor?.name} />
                    <View style={{ position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={TYPE_ICON[n.type]} size={12} color={colors.white} />
                    </View>
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <T v="body" numberOfLines={3}>{name ? <T v="bodyBold">{name} </T> : null}{text}</T>
                    <T v="small" style={{ fontSize: 12 }}>{n.time}</T>
                  </View>
                  {n.type === 'follow' && actor ? <FollowButton id={actor.id} /> : n.thumb ? <Photo src={n.thumb} style={{ width: 52, height: 52 }} radius={10} /> : <Icon name="chevron-right" size={20} color={colors.subtle} />}
                </Pressable>
              );
            })}
          </View>
        );
      })}
      <Row justify="center" gap={6}>
        <Icon name="check-circle-outline" size={16} color={colors.success} />
        <T v="small">You’re all caught up</T>
      </Row>
    </Screen>
  );
}
