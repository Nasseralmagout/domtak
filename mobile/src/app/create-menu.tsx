import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName, Row, T } from '../components/ui';
import type { Role } from '../data/types';
import { WORKSPACE_LABEL } from '../lib/access';
import {
  activeWorkspace,
  APPLICATION_STATUS_LABEL,
  canPostToFeed,
  canPublishPublicEvents,
  isApproved,
  isPro,
  type User,
  useApp,
} from '../store/useApp';
import { colors } from '../theme';

type Action = { icon: IconName; title: string; sub: string; href: string; locked?: boolean };

/** Role-specific shortcuts shown under "Your tools" (approved workspaces only). */
const ROLE_TOOLS: Record<Role, Action[]> = {
  fan: [],
  musician: [
    { icon: 'calendar-check-outline', title: 'Availability', sub: 'Days, fee and travel radius for bookings', href: '/pro/availability' },
    { icon: 'cash-multiple', title: 'Earnings', sub: 'Payouts, balance and booking income', href: '/pro/earnings' },
  ],
  venue: [{ icon: 'storefront-edit-outline', title: 'My venue listing', sub: 'Capacity, parking, outdoor space, catering and security', href: '/pro/venue-listing' }],
  organizer: [{ icon: 'calendar-star', title: 'My events', sub: 'Ticket sales, attendees and promotions', href: '/pro/events' }],
};

/** Where "Publish public events" leads when you cannot publish yet (blueprint F12: redirect to the application flow). */
function publicEventsRoute(user: User): Action {
  const base = { icon: 'bullhorn-outline' as const, title: 'Publish public events', locked: true };
  if (isApproved(user, 'organizer')) return { ...base, sub: 'Switch to your organizer workspace to publish', href: '/workspace' };
  if (user.application?.role === 'organizer') return { ...base, sub: `Organizer application: ${APPLICATION_STATUS_LABEL[user.application.status].toLowerCase()}`, href: '/application' };
  return { ...base, sub: 'Only approved organizers publish public events. Apply as organizer', href: '/apply?role=organizer' };
}

/** Feed posts and stories are for approved professionals; members share photos in comments. */
function feedRoute(user: User): Action {
  const base = { icon: 'image-multiple-outline' as const, title: 'Feed posts and stories', locked: true };
  if (user.approvedRoles.some((r) => r !== 'fan')) return { ...base, sub: 'Switch to your professional workspace to post', href: '/workspace' };
  if (user.application) return { ...base, sub: `Your application: ${APPLICATION_STATUS_LABEL[user.application.status].toLowerCase()}. Members share photos in comments`, href: '/application' };
  return { ...base, sub: 'For approved artists, venues and organizers. Members share photos in comments', href: '/apply' };
}

function ActionRow({ action, onPress }: { action: Action; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${action.title}. ${action.sub}`}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, minHeight: 64, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: action.locked ? colors.chipIdle : colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={action.icon} size={24} color={action.locked ? colors.label : colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Row gap={6}>
          <T v="bodyBold" style={{ flexShrink: 1 }}>{action.title}</T>
          {action.locked ? <Icon name="lock-outline" size={14} color={colors.label} /> : null}
        </Row>
        <T v="small">{action.sub}</T>
      </View>
      <Icon name="chevron-right" size={22} color={colors.subtle} />
    </Pressable>
  );
}

export default function CreateMenu() {
  const insets = useSafeAreaInsets();
  const user = useApp((s) => s.user);
  const workspace = activeWorkspace(user);
  const canPost = canPostToFeed(user);
  const canPublish = canPublishPublicEvents(user);
  const close = () => router.back();
  const go = (href: string) => {
    router.back();
    setTimeout(() => router.push(href as never), 10);
  };

  // Everyone can host a private event; only an approved organizer (in that workspace) publishes public ones.
  const actions: Action[] = [
    ...(canPost
      ? [
          { icon: 'image-outline' as const, title: 'New post', sub: 'Photos, videos or a music link', href: '/new-post' },
          { icon: 'broadcast' as const, title: 'Story', sub: 'Share a moment for 24 hours', href: '/new-post?story=1' },
        ]
      : []),
    { icon: 'calendar-lock-outline', title: 'Create private event', sub: 'Birthday or gathering. Invite friends and share costs', href: '/create-event?private=1' },
    ...(canPublish ? [{ icon: 'calendar-plus' as const, title: 'Create public event', sub: 'Tickets, lineup and map pin', href: '/create-event' }] : []),
    { icon: 'account-music-outline', title: 'Book a musician', sub: 'Send a booking request', href: '/artists/all' },
    { icon: 'storefront-outline', title: 'Book a venue', sub: 'Clubs, halls, gardens and lofts', href: '/venues' },
  ];
  const locked: Action[] = [...(canPublish ? [] : [publicEventsRoute(user)]), ...(canPost ? [] : [feedRoute(user)])];
  const tools: Action[] = [
    ...ROLE_TOOLS[workspace],
    ...(isPro(workspace) ? [{ icon: 'view-grid-outline' as const, title: 'Pro workspace', sub: 'Requests, earnings and scanner', href: '/pro/workspace' }] : []),
    ...(user.approvedRoles.length > 1 ? [{ icon: 'swap-horizontal' as const, title: 'Switch workspace', sub: `Now: ${WORKSPACE_LABEL[workspace]}`, href: '/workspace' }] : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" style={{ flex: 1, minHeight: 48 }} onPress={close} />
      <View
        accessibilityViewIsModal
        style={{ maxHeight: '88%', backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingBottom: insets.bottom + 12 }}
      >
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 8 }} />
        <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 6 }} showsVerticalScrollIndicator={false}>
          <Row justify="space-between" style={{ marginBottom: 6 }}>
            <T v="h2" accessibilityRole="header">Create</T>
            <T v="smallBold" color={colors.muted}>{WORKSPACE_LABEL[workspace]} workspace</T>
          </Row>
          {actions.map((a) => <ActionRow key={a.title} action={a} onPress={() => go(a.href)} />)}
          {locked.length ? (
            <>
              <T v="caption" style={{ marginTop: 10, marginBottom: 2 }}>NEEDS PROFESSIONAL APPROVAL</T>
              {locked.map((a) => <ActionRow key={a.title} action={a} onPress={() => go(a.href)} />)}
            </>
          ) : null}
          {tools.length ? (
            <>
              <T v="caption" style={{ marginTop: 10, marginBottom: 2 }}>YOUR TOOLS</T>
              {tools.map((a) => <ActionRow key={a.title} action={a} onPress={() => go(a.href)} />)}
            </>
          ) : null}
          <Row justify="center" style={{ marginTop: 6 }}>
            <Pressable accessibilityRole="button" onPress={close} style={{ minHeight: 48, paddingHorizontal: 24, justifyContent: 'center' }}>
              <T v="bodyBold" color={colors.brand}>Cancel</T>
            </Pressable>
          </Row>
        </ScrollView>
      </View>
    </View>
  );
}
