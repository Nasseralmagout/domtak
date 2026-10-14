import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName, Row, T } from '../components/ui';
import type { Role } from '../data/types';
import { isPro, useApp } from '../store/useApp';
import { colors } from '../theme';

type Action = { icon: IconName; title: string; sub: string; href: string };

/** Role-specific shortcuts shown under "Your tools". */
const ROLE_TOOLS: Record<Role, Action[]> = {
  fan: [],
  musician: [
    { icon: 'calendar-check-outline', title: 'Availability', sub: 'Days, fee and travel radius for bookings', href: '/pro/availability' },
    { icon: 'cash-multiple', title: 'Earnings', sub: 'Payouts, balance and booking income', href: '/pro/earnings' },
  ],
  venue: [{ icon: 'storefront-edit-outline', title: 'My venue listing', sub: 'Photos, capacity, price and occasions', href: '/pro/venue-listing' }],
  organizer: [{ icon: 'calendar-star', title: 'My events', sub: 'Ticket sales, attendees and promotions', href: '/pro/events' }],
};

function ActionRow({ action, onPress }: { action: Action; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${action.title}. ${action.sub}`}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, minHeight: 64, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={action.icon} size={24} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <T v="bodyBold">{action.title}</T>
        <T v="small">{action.sub}</T>
      </View>
      <Icon name="chevron-right" size={22} color={colors.subtle} />
    </Pressable>
  );
}

export default function CreateMenu() {
  const insets = useSafeAreaInsets();
  const role = useApp((s) => s.user.role);
  const close = () => router.back();
  const go = (href: string) => {
    router.back();
    setTimeout(() => router.push(href as never), 10);
  };

  // The "+" is context-aware: organizers create events, fans create posts and booking requests.
  const actions: Action[] = [
    { icon: 'image-outline', title: 'New post', sub: 'Photos, videos or a music link', href: '/new-post' },
    { icon: 'broadcast', title: 'Story', sub: 'Share a moment for 24 hours', href: '/new-post?story=1' },
    ...(role === 'organizer' || role === 'venue'
      ? [{ icon: 'calendar-plus' as const, title: 'Create public event', sub: 'Tickets, lineup and map pin', href: '/create-event' }]
      : [{ icon: 'calendar-plus' as const, title: 'Create private event', sub: 'Birthday or gathering — invite friends', href: '/create-event?private=1' }]),
    { icon: 'account-music-outline', title: 'Book a musician', sub: 'Send a booking request', href: '/artists/all' },
    { icon: 'storefront-outline', title: 'Book a venue', sub: 'Clubs, halls, gardens and lofts', href: '/venues' },
  ];
  const tools: Action[] = [
    ...ROLE_TOOLS[role],
    ...(isPro(role) ? [{ icon: 'view-grid-outline' as const, title: 'Pro workspace', sub: 'Requests, earnings and scanner', href: '/pro/workspace' }] : []),
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
          <T v="h2" accessibilityRole="header" style={{ marginBottom: 6 }}>Create</T>
          {actions.map((a) => <ActionRow key={a.href} action={a} onPress={() => go(a.href)} />)}
          {tools.length ? (
            <>
              <T v="caption" style={{ marginTop: 10, marginBottom: 2 }}>YOUR TOOLS</T>
              {tools.map((a) => <ActionRow key={a.href} action={a} onPress={() => go(a.href)} />)}
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
