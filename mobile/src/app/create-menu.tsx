import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName, Row, T } from '../components/ui';
import { isPro, useApp } from '../store/useApp';
import { colors } from '../theme';

type Action = { icon: IconName; title: string; sub: string; href: string };

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
    ...(isPro(role) ? [{ icon: 'view-grid-outline' as const, title: 'Pro workspace', sub: 'Requests, earnings and scanner', href: '/pro/workspace' }] : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}>
      <Pressable accessibilityLabel="Close" style={{ flex: 1 }} onPress={close} />
      <View accessibilityViewIsModal style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 20, gap: 6 }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 8 }} />
        <T v="h2" style={{ marginBottom: 6 }}>Create</T>
        {actions.map((a) => (
          <Pressable key={a.title} accessibilityRole="button" onPress={() => go(a.href)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, opacity: pressed ? 0.7 : 1 })}>
            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={a.icon} size={24} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="bodyBold">{a.title}</T>
              <T v="small">{a.sub}</T>
            </View>
            <Icon name="chevron-right" size={22} color={colors.subtle} />
          </Pressable>
        ))}
        <Row justify="center" style={{ marginTop: 6 }}>
          <Pressable accessibilityRole="button" onPress={close} style={{ padding: 12 }}>
            <T v="bodyBold" color={colors.brand}>Cancel</T>
          </Pressable>
        </Row>
      </View>
    </View>
  );
}
